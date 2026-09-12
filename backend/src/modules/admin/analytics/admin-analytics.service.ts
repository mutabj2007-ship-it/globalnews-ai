import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { parseAdminRole } from '../rbac/capabilities';
import {
  ADMIN_ANALYTICS_LONG_WINDOW_HOURS,
  ADMIN_ANALYTICS_SHORT_WINDOW_HOURS,
  ADMIN_COVERAGE_COUNTRY_LIMIT,
  ADMIN_TELEMETRY_RETENTION_DAYS,
  ADMIN_TELEMETRY_RETENTION_ENFORCED,
  ADMIN_USERS_PAGE_SIZE_DEFAULT,
  ADMIN_USERS_PAGE_SIZE_MAX,
  INSTRUMENTED_PRODUCT_EVENT_NAMES,
  type AdminAccountAggregates,
  type AdminAnalysisAggregates,
  type AdminAnalyticsCount,
  type AdminAnalyticsUsageResponse,
  type AdminCoverageCountry,
  type AdminCoverageGeographyResponse,
  type AdminFollowedCountry,
  type AdminProductEventAggregates,
  type AdminUsersResponse,
} from './admin-analytics.contract';
import { ProductEventName } from '../../../generated/prisma/enums';

/**
 * ADMIN-03 — the read side of the analytics, coverage-geography and
 * account surfaces.
 *
 * READ-ONLY, AND STRUCTURALLY SO. Every call in this file is a count, a
 * groupBy, an aggregate or a findMany. `admin.contract.spec.ts` scans
 * every non-spec file under modules/admin and fails on a create, update
 * or upsert, so this class cannot acquire a write path without that
 * guard firing.
 *
 * IT LIVES UNDER modules/admin, NOT modules/telemetry, DELIBERATELY.
 * `telemetry.privacy.spec.ts` asserts that the telemetry module exposes
 * no read route -- telemetry is written there and never served -- and
 * pins its file list exactly. Putting the reader here keeps both true
 * and means the only thing that reads these tables sits behind the
 * admin guard chain.
 *
 * NO COLUMN THAT COULD IDENTIFY A PERSON IS SELECTED ANYWHERE IN THIS
 * FILE. ProductEvent.userId is never read. SearchHistoryEntry is never
 * read at all -- its `query` column is free text a user typed, and the
 * safest way to keep it off an admin screen is to have no code path
 * that fetches it. The account list selects four columns by name, so
 * the address is excluded by the select rather than by remembering to
 * drop it later.
 *
 * A SECTION THAT CANNOT BE READ IS null, NEVER AN EMPTY RESULT. Each
 * block below is wrapped, and a failure logs and yields null so the
 * screen can render an error with a retry. A caught failure that
 * returned zeros would be the A-1 defect rebuilt: a failed read
 * presented as a measurement of nothing.
 */
@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async usage(now: Date = new Date()): Promise<AdminAnalyticsUsageResponse> {
    const short = this.since(now, ADMIN_ANALYTICS_SHORT_WINDOW_HOURS);
    const long = this.since(now, ADMIN_ANALYTICS_LONG_WINDOW_HOURS);

    const [accounts, analysis, events] = await Promise.all([
      this.section('accounts', () => this.accounts(short, long)),
      this.section('analysis', () => this.analysis(short, long)),
      this.section('events', () => this.events(long)),
    ]);

    return {
      accounts,
      analysis,
      events,
      retention: {
        declaredDays: ADMIN_TELEMETRY_RETENTION_DAYS,
        enforced: ADMIN_TELEMETRY_RETENTION_ENFORCED,
      },
      windows: {
        shortHours: ADMIN_ANALYTICS_SHORT_WINDOW_HOURS,
        longHours: ADMIN_ANALYTICS_LONG_WINDOW_HOURS,
      },
      generatedAt: now.toISOString(),
    };
  }

  async coverageGeography(now: Date = new Date()): Promise<AdminCoverageGeographyResponse> {
    const coverage = await this.section('coverage', () => this.coverage());
    const followedCountries = await this.section('followedCountries', () => this.followed());

    return {
      countries: coverage?.countries ?? null,
      distinctCountriesWithRelevantCoverage: coverage?.distinctCount ?? null,
      followedCountries,
      countryLimit: ADMIN_COVERAGE_COUNTRY_LIMIT,
      generatedAt: now.toISOString(),
    };
  }

  async users(
    requestedPage: number,
    requestedPageSize: number,
    now: Date = new Date(),
  ): Promise<AdminUsersResponse> {
    const page =
      Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
    const pageSize = this.resolvePageSize(requestedPageSize);

    const result = await this.section('users', async () => {
      // FOUR COLUMNS, NAMED. The address is not excluded by filtering it
      // out afterwards -- it is never fetched, so no later edit to a
      // mapper can reintroduce it by accident.
      const [rows, totalCount, byRole] = await Promise.all([
        this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: { id: true, createdAt: true, lastSeenAt: true, adminRole: true },
        }),
        this.prisma.user.count(),
        this.prisma.user.groupBy({ by: ['adminRole'], _count: { _all: true } }),
      ]);

      return {
        accounts: rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
          // parseAdminRole is the existing trust boundary: a column value
          // this build does not recognise resolves to null, i.e. NOT an
          // administrator. Drift can only ever remove privilege here too.
          adminRole: parseAdminRole(row.adminRole),
        })),
        totalCount,
        // MERGED BY RESOLVED KEY, NOT MAPPED ONE-TO-ONE. A NULL role and a
        // role value this build does not recognise BOTH resolve to `none`,
        // and mapping each group separately produced two rows labelled
        // `none` -- a table that appears to contain a duplicate category
        // and whose numbers do not add up to the account total. The
        // fail-closed rule has to be applied before the grouping, not
        // after it.
        //
        // `none` is a BUCKET LABEL, not a fifth role. The role model has
        // no NONE member and this string never reaches it.
        byAdminRole: this.sorted(
          [
            ...byRole
              .reduce((totals, group) => {
                const key = parseAdminRole(group.adminRole) ?? 'none';
                return totals.set(key, (totals.get(key) ?? 0) + group._count._all);
              }, new Map<string, number>())
              .entries(),
          ].map(([key, count]) => ({ key, count })),
        ),
      };
    });

    return {
      accounts: result?.accounts ?? null,
      totalCount: result?.totalCount ?? null,
      byAdminRole: result?.byAdminRole ?? null,
      page,
      pageSize,
      generatedAt: now.toISOString(),
    };
  }

  private resolvePageSize(requested: number): number {
    if (!Number.isFinite(requested) || requested <= 0) return ADMIN_USERS_PAGE_SIZE_DEFAULT;
    return Math.min(Math.floor(requested), ADMIN_USERS_PAGE_SIZE_MAX);
  }

  private since(now: Date, hours: number): Date {
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }

  /**
   * Runs one section and converts a failure into null.
   *
   * The failure is LOGGED rather than swallowed. An admin screen that
   * quietly shows one fewer panel teaches an operator to distrust the
   * whole screen, and the server log is where the reason has to be.
   */
  private async section<T>(name: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(
        `Admin analytics section "${name}" could not be read: ${
          (error as Error)?.message ?? 'unknown'
        }`,
      );
      return null;
    }
  }

  private async accounts(short: Date, long: Date): Promise<AdminAccountAggregates> {
    const [
      total,
      createdLast24h,
      createdLast7d,
      observedReturningLast24h,
      observedReturningLast7d,
      neverObservedReturning,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: short } } }),
      this.prisma.user.count({ where: { createdAt: { gte: long } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: short } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: long } } }),
      this.prisma.user.count({ where: { lastSeenAt: null } }),
    ]);

    return {
      total,
      createdLast24h,
      createdLast7d,
      observedReturningLast24h,
      observedReturningLast7d,
      neverObservedReturning,
    };
  }

  private async analysis(short: Date, long: Date): Promise<AdminAnalysisAggregates> {
    const window = { createdAt: { gte: long } };

    const [
      runsLast24h,
      runsLast7d,
      byStatus,
      byFailureReason,
      byProvider,
      byCached,
      latency,
      tokens,
    ] = await Promise.all([
      this.prisma.analysisRun.count({ where: { createdAt: { gte: short } } }),
      this.prisma.analysisRun.count({ where: window }),
      this.prisma.analysisRun.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
      this.prisma.analysisRun.groupBy({
        by: ['failureReason'],
        where: { ...window, failureReason: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.analysisRun.groupBy({
        by: ['provider', 'model'],
        where: window,
        _count: { _all: true },
      }),
      this.prisma.analysisRun.groupBy({ by: ['cached'], where: window, _count: { _all: true } }),
      this.prisma.analysisRun.aggregate({
        where: { ...window, latencyMs: { not: null } },
        _count: { latencyMs: true },
        _avg: { latencyMs: true },
        _min: { latencyMs: true },
        _max: { latencyMs: true },
      }),
      this.prisma.analysisRun.aggregate({
        where: { ...window, totalTokens: { not: null } },
        _count: { totalTokens: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      }),
    ]);

    const cachedCount = (flag: boolean): number =>
      byCached.find((group) => group.cached === flag)?._count._all ?? 0;

    const latencySampleCount = latency._count.latencyMs;
    const tokenSampleCount = tokens._count.totalTokens;

    return {
      runsLast24h,
      runsLast7d,
      byStatus: this.sorted(byStatus.map((g) => ({ key: g.status, count: g._count._all }))),
      byFailureReason: this.sorted(
        byFailureReason
          .filter((g): g is typeof g & { failureReason: string } => g.failureReason !== null)
          .map((g) => ({ key: g.failureReason, count: g._count._all })),
      ),
      byProvider: byProvider
        .map((g) => ({ provider: g.provider, model: g.model, count: g._count._all }))
        .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider)),
      cacheHits: cachedCount(true),
      cacheMisses: cachedCount(false),
      // A mean over zero rows is not zero -- it does not exist. The
      // aggregate fields are omitted entirely rather than reported as 0.
      latency:
        latencySampleCount > 0
          ? {
              sampleCount: latencySampleCount,
              averageMs: Math.round(latency._avg.latencyMs ?? 0),
              minMs: latency._min.latencyMs ?? undefined,
              maxMs: latency._max.latencyMs ?? undefined,
            }
          : { sampleCount: 0 },
      tokens:
        tokenSampleCount > 0
          ? {
              sampleCount: tokenSampleCount,
              promptTokens: tokens._sum.promptTokens ?? undefined,
              completionTokens: tokens._sum.completionTokens ?? undefined,
              totalTokens: tokens._sum.totalTokens ?? undefined,
            }
          : { sampleCount: 0 },
    };
  }

  private async events(long: Date): Promise<AdminProductEventAggregates> {
    const grouped = await this.prisma.productEvent.groupBy({
      by: ['name'],
      where: { createdAt: { gte: long } },
      _count: { _all: true },
    });

    const instrumented = [...INSTRUMENTED_PRODUCT_EVENT_NAMES] as string[];
    // Derived from the generated enum rather than transcribed, so a new
    // event name in the schema appears here without anyone remembering to
    // add it -- on the UNINSTRUMENTED side, which is the safe default.
    const uninstrumented = Object.values(ProductEventName)
      .filter((name) => !instrumented.includes(name))
      .sort();

    return {
      recorded: this.sorted(grouped.map((g) => ({ key: g.name, count: g._count._all }))),
      instrumentedEventNames: [...instrumented].sort(),
      uninstrumentedEventNames: uninstrumented,
    };
  }

  private async coverage(): Promise<{
    countries: AdminCoverageCountry[];
    distinctCount: number;
  }> {
    const [relevant, all] = await Promise.all([
      this.prisma.articleCountry.groupBy({
        by: ['countryCode', 'countryName'],
        where: { isRelevant: true },
        _count: { _all: true },
      }),
      this.prisma.articleCountry.groupBy({ by: ['countryCode'], _count: { _all: true } }),
    ]);

    // The same ISO code can carry more than one stored display name. The
    // name is chosen by weight rather than by whichever row arrived
    // first, so a single mislabelled row cannot rename a country.
    const byCode = new Map<string, { countryName: string; nameWeight: number; relevant: number }>();
    for (const group of relevant) {
      const count = group._count._all;
      const existing = byCode.get(group.countryCode);
      if (!existing) {
        byCode.set(group.countryCode, {
          countryName: group.countryName,
          nameWeight: count,
          relevant: count,
        });
        continue;
      }
      existing.relevant += count;
      if (count > existing.nameWeight) {
        existing.countryName = group.countryName;
        existing.nameWeight = count;
      }
    }

    const totals = new Map(all.map((group) => [group.countryCode, group._count._all]));

    const countries = [...byCode.entries()]
      .map(([countryCode, entry]) => ({
        countryCode,
        countryName: entry.countryName,
        relevantArticleCount: entry.relevant,
        totalArticleCount: totals.get(countryCode) ?? entry.relevant,
      }))
      .sort(
        (a, b) =>
          b.relevantArticleCount - a.relevantArticleCount ||
          a.countryCode.localeCompare(b.countryCode),
      );

    return {
      // distinctCount is taken BEFORE the cap, so a truncated list never
      // shrinks the number of countries the platform says it covers.
      distinctCount: countries.length,
      countries: countries.slice(0, ADMIN_COVERAGE_COUNTRY_LIMIT),
    };
  }

  private async followed(): Promise<AdminFollowedCountry[]> {
    const grouped = await this.prisma.countryFollow.groupBy({
      by: ['countryCode'],
      _count: { _all: true },
    });

    // CountryFollow carries a composite unique on (userId, countryCode),
    // so one row IS one account. The count is a follower-account count by
    // construction, not an approximation of one.
    return grouped
      .map((group) => ({
        countryCode: group.countryCode,
        followerAccountCount: group._count._all,
      }))
      .sort(
        (a, b) =>
          b.followerAccountCount - a.followerAccountCount ||
          a.countryCode.localeCompare(b.countryCode),
      );
  }

  private sorted(counts: AdminAnalyticsCount[]): AdminAnalyticsCount[] {
    return [...counts].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }
}
