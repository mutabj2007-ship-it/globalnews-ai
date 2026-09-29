import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ANALYSIS_TOTAL_BUDGET_MS,
  ASK_ANSWER_STATES,
  ASK_EVIDENCE_ROLES,
  RESERVED_INACTIVE_ROLES,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { EXECUTOR_SUPPLIES } from '../../ask-v2/ask-r2-execution.adapter';
import {
  ASK_ACCESS_BUCKET_MS,
  ASK_ACCESS_EVENTS,
  ASK_ROUTE_PATHS,
  ASK_OBSERVATION_RETENTION_DAYS,
  EMITTED_ASK_ROUTE_PATHS,
} from '../../ask-observability/ask-observation.contract';
import {
  OPERATIONAL_SWITCHES,
  OperationalSwitchService,
} from '../../compute-controls/operational-switch.service';
import { resolveComputeControlsConfig } from '../../compute-controls/compute-controls.config';
import { GLOBAL_SCOPE, dayBucket, hourBucket } from '../../compute-controls/compute-scopes';
import {
  ADMIN_ASK_ALERT_IDS,
  ADMIN_ASK_ARRAY_SAMPLE_LIMIT,
  ADMIN_ASK_COUNTRY_LIMIT,
  ADMIN_ASK_FAILURE_RATE_CRITICAL,
  ADMIN_ASK_FAILURE_RATE_WARN,
  ADMIN_ASK_LATENCY_CRITICAL_FRACTION,
  ADMIN_ASK_LATENCY_WARN_FRACTION,
  ADMIN_ASK_LONG_WINDOW_HOURS,
  ADMIN_ASK_POOR_OUTCOME_STATES,
  ADMIN_ASK_PROCEDURE_DOCUMENT,
  ADMIN_ASK_PROCEDURE_KEY,
  ADMIN_ASK_REJECTION_RATE_CRITICAL,
  ADMIN_ASK_REJECTION_RATE_WARN,
  ADMIN_ASK_SATURATION_CRITICAL,
  ADMIN_ASK_SATURATION_WARN,
  ADMIN_ASK_SHORT_WINDOW_HOURS,
  ADMIN_ASK_THRESHOLD_SOURCES,
  type AdminAskAlert,
  type AdminAskAlertSeverity,
  type AdminAskAlerts,
  type AdminAskArraySample,
  type AdminAskCount,
  type AdminAskEvidence,
  type AdminAskHealth,
  type AdminAskImprovement,
  type AdminAskIntelligenceResponse,
  type AdminAskOperations,
} from './admin-ask-intelligence.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS MINIMUM R1 — THE READ SIDE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * READ-ONLY, AND STRUCTURALLY SO. Every database call in this file is a `count`, a
 * `groupBy`, a `findMany` or an `aggregate`. `admin.contract.spec.ts` scans every non-spec
 * file under `modules/admin` and fails on a write call, so this class cannot acquire one
 * without that guard firing, and `adminAskIntelligence.privacy.spec.ts` repeats the scan
 * against this directory with a wider list.
 *
 * IT LIVES UNDER `modules/admin`, NOT BESIDE THE WRITER, FOR THE REASON THE EXISTING
 * ANALYTICS READER GIVES: the writer's module must stay unreadable from the outside, and
 * the only thing that reads these tables should sit behind the admin guard chain.
 *
 * NO COLUMN THAT COULD IDENTIFY A PERSON IS SELECTED ANYWHERE IN THIS FILE.
 *   - `AskTurn` is never read. Its `question` column is the reader's own words, and the
 *     safest way to keep that off an admin screen is to have no code path that fetches it.
 *   - `SearchHistoryEntry` is never read, for the same reason the existing analytics
 *     reader never reads it.
 *   - `ComputeOperation` is read for COUNTS only. `userId` is never selected, and
 *     `fingerprint` — a hash of the question, and therefore re-identifiable by dictionary
 *     against a low-entropy input — is never selected and never grouped by.
 *   - `AskObservation` has no account column at all, so there is nothing here to join on.
 *
 * A SECTION THAT CANNOT BE READ IS null, NEVER AN EMPTY RESULT. Each block is wrapped and
 * a failure logs and yields null, so the screen can render an error with a retry. A caught
 * failure that returned zeros would present a failed read as a measurement of nothing —
 * which on an operations page is the difference between a quiet Beta and a dead one.
 */
@Injectable()
export class AdminAskIntelligenceService {
  private readonly logger = new Logger(AdminAskIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly switches: OperationalSwitchService,
    private readonly config: ConfigService,
  ) {}

  async askIntelligence(now: Date = new Date()): Promise<AdminAskIntelligenceResponse> {
    const short = this.since(now, ADMIN_ASK_SHORT_WINDOW_HOURS);
    const long = this.since(now, ADMIN_ASK_LONG_WINDOW_HOURS);

    /*
      ONE BOUNDED READ FEEDS EVERY LIST-VALUED TALLY.

      Evidence roles, analytical domains, geography codes and refusal codes are PostgreSQL
      text[] columns. A relational GROUP BY cannot count members inside an array, and the
      alternative — raw SQL with `unnest` — would put a hand-built query on the admin
      surface for a number a bounded read already answers. So they are tallied in memory
      from the most recent rows, and the bound travels in the response so no screen can read
      "of the last N" as "of all".
    */
    const listRows = await this.section('sample', () => this.listSample(long));

    const [health, operations, alerts] = await Promise.all([
      this.section('health', () => this.health(short, long)),
      this.section('operations', () => this.operations(short, long)),
      this.section('alerts', () => this.alerts(now, short)),
    ]);

    const evidence =
      listRows === null
        ? null
        : await this.section('evidence', () => this.evidence(listRows, long));
    const improvement =
      listRows === null
        ? null
        : await this.section('improvement', () => this.improvement(listRows, long));

    const arraySample: AdminAskArraySample = {
      sampleCount: listRows?.length ?? 0,
      limit: ADMIN_ASK_ARRAY_SAMPLE_LIMIT,
      truncated: (listRows?.length ?? 0) >= ADMIN_ASK_ARRAY_SAMPLE_LIMIT,
    };

    return {
      health,
      evidence,
      operations,
      improvement,
      alerts,
      arraySample,
      windows: {
        shortHours: ADMIN_ASK_SHORT_WINDOW_HOURS,
        longHours: ADMIN_ASK_LONG_WINDOW_HOURS,
      },
      retention: {
        declaredDays: ASK_OBSERVATION_RETENTION_DAYS,
        enforced: true,
        enforcedBy: 'OPPORTUNISTIC_SWEEP_ON_WRITE',
      },
      disclosures: {
        rawQuestionStored: false,
        questionReviewImplemented: false,
        monetaryCostAvailable: false,
        deviceClassAvailable: false,
        readOnly: true,
        legacyRoutePathInstrumented: EMITTED_ASK_ROUTE_PATHS.includes('LEGACY_ANALYSIS'),
        quotedWithoutExecutionObserved: false,
      },
      generatedAt: now.toISOString(),
    };
  }

  /* ── HEALTH ────────────────────────────────────────────────────────────── */

  private async health(short: Date, long: Date): Promise<AdminAskHealth> {
    const inShort = { occurredAt: { gte: short } };
    const inLong = { occurredAt: { gte: long } };

    const [
      attemptsLast24h,
      attemptsLast7d,
      executionsLast24h,
      executionsLast7d,
      completionsLast24h,
      failuresLast24h,
      storedResultReusedLast7d,
      zeroModelLast24h,
      totals,
      latency,
      tokens,
      byAnswerState,
      clarificationRequiredLast7d,
      capabilityUnavailableLast7d,
    ] = await Promise.all([
      /* COUNTS ONLY. No column of ComputeOperation is selected, so `userId` and the
         question `fingerprint` cannot leave this method even by accident. */
      this.prisma.computeOperation.count({ where: { createdAt: { gte: short } } }),
      this.prisma.computeOperation.count({ where: { createdAt: { gte: long } } }),
      this.prisma.askObservation.count({ where: inShort }),
      this.prisma.askObservation.count({ where: inLong }),
      this.prisma.askObservation.count({ where: { ...inShort, failureCode: null } }),
      this.prisma.askObservation.count({ where: { ...inShort, failureCode: { not: null } } }),
      this.prisma.computeOperation.count({
        where: { createdAt: { gte: long }, storedResultReused: true },
      }),
      this.prisma.askObservation.count({ where: { ...inShort, modelInvocationCount: 0 } }),
      this.prisma.askObservation.aggregate({
        where: inShort,
        _sum: { modelInvocationCount: true, providerCallCount: true },
      }),
      this.prisma.askObservation.aggregate({
        where: { ...inShort, latencyMs: { not: null } },
        _count: { latencyMs: true },
        _avg: { latencyMs: true },
        _min: { latencyMs: true },
        _max: { latencyMs: true },
      }),
      this.prisma.askObservation.aggregate({
        where: { ...inShort, tokensMeasured: true },
        _count: { promptTokens: true },
        _sum: { promptTokens: true, completionTokens: true },
      }),
      this.prisma.askObservation.groupBy({
        by: ['answerState'],
        where: inLong,
        _count: { _all: true },
      }),
      this.prisma.askObservation.count({ where: { ...inLong, clarificationRequired: true } }),
      this.prisma.askObservation.count({ where: { ...inLong, capabilityUnavailable: true } }),
    ]);

    const latencySamples = latency._count.latencyMs;
    const order = await this.latencyOrderStatistics(short, latencySamples);

    return {
      attemptsLast24h,
      attemptsLast7d,
      executionsLast24h,
      executionsLast7d,
      completionsLast24h,
      failuresLast24h,
      storedResultReusedLast7d,
      modelInvocationsLast24h: totals._sum.modelInvocationCount ?? 0,
      providerCallsLast24h: totals._sum.providerCallCount ?? 0,
      zeroModelLast24h,
      latency:
        latencySamples > 0
          ? {
              sampleCount: latencySamples,
              /* A mean over zero rows is not zero — it does not exist, so these fields are
                 omitted entirely rather than reported as 0. */
              averageMs: Math.round(latency._avg.latencyMs ?? 0),
              minMs: latency._min.latencyMs ?? undefined,
              maxMs: latency._max.latencyMs ?? undefined,
              medianMs: order.medianMs,
              p95Ms: order.p95Ms,
            }
          : { sampleCount: 0 },
      tokens: this.tokenTotals(
        tokens._count.promptTokens,
        tokens._sum.promptTokens,
        tokens._sum.completionTokens,
      ),
      byAnswerState: this.sorted(
        byAnswerState.map((g) => ({ key: g.answerState, count: g._count._all })),
      ),
      declaredAnswerStates: [...ASK_ANSWER_STATES],
      clarificationRequiredLast7d,
      capabilityUnavailableLast7d,
    };
  }

  /* ── CAPABILITY / EVIDENCE GAPS ────────────────────────────────────────── */

  private async evidence(rows: readonly ListRow[], long: Date): Promise<AdminAskEvidence> {
    const requested = this.index(rows.flatMap((row) => row.evidenceRolesRequested));
    const obtained = this.index(rows.flatMap((row) => row.evidenceRolesObtained));
    const missing = this.index(rows.flatMap((row) => row.evidenceRolesMissing));

    const reporting = await this.prisma.askObservation.aggregate({
      where: { occurredAt: { gte: long }, reportingItemCount: { not: null } },
      _count: { reportingItemCount: true },
      _avg: { reportingItemCount: true },
      _min: { reportingItemCount: true },
      _max: { reportingItemCount: true },
    });
    const reportingSamples = reporting._count.reportingItemCount;

    return {
      roles: ASK_EVIDENCE_ROLES.map((role) => ({
        role,
        requested: requested.get(role) ?? 0,
        obtained: obtained.get(role) ?? 0,
        unavailable: missing.get(role) ?? 0,
      })),
      declaredRoles: [...ASK_EVIDENCE_ROLES],
      reservedInactiveRoles: [...RESERVED_INACTIVE_ROLES],
      executorSuppliedRoles: [...EXECUTOR_SUPPLIES].sort(),
      /* Reused shape: these are item counts, not milliseconds, so only the sample-bearing
         fields are populated and the ms-named fields carry the counts they describe. */
      reportingItems:
        reportingSamples > 0
          ? {
              sampleCount: reportingSamples,
              averageMs: Math.round(reporting._avg.reportingItemCount ?? 0),
              minMs: reporting._min.reportingItemCount ?? undefined,
              maxMs: reporting._max.reportingItemCount ?? undefined,
            }
          : { sampleCount: 0 },
    };
  }

  /* ── OPERATIONS ────────────────────────────────────────────────────────── */

  private async operations(short: Date, long: Date): Promise<AdminAskOperations> {
    const inShort = { occurredAt: { gte: short } };
    const [byFailure, byBreakerOutcome, byRoutePath, breakers, counters] = await Promise.all([
      this.prisma.askObservation.groupBy({
        by: ['failureCode'],
        where: { ...inShort, failureCode: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.askObservation.groupBy({
        by: ['breakerOutcome'],
        where: { ...inShort, breakerOutcome: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.askObservation.groupBy({
        by: ['routePath'],
        where: { occurredAt: { gte: long } },
        _count: { _all: true },
      }),
      this.prisma.circuitBreakerState.findMany({ orderBy: { provider: 'asc' } }),
      this.prisma.askAccessCounter.findMany({
        where: { bucketStart: { gte: long } },
        orderBy: { bucketStart: 'desc' },
        take: ADMIN_ASK_ARRAY_SAMPLE_LIMIT,
      }),
    ]);

    const failures = byFailure
      .filter((g): g is typeof g & { failureCode: string } => g.failureCode !== null)
      .map((g) => ({ key: g.failureCode, count: g._count._all }));
    const withPrefix = (prefix: string): AdminAskCount[] =>
      this.sorted(failures.filter((row) => row.key.startsWith(prefix)));

    const accessTotals = new Map<string, number>();
    for (const row of counters)
      accessTotals.set(row.event, (accessTotals.get(row.event) ?? 0) + row.count);

    return {
      switches: await this.switchRows(),
      breakers: breakers.map((row) => ({
        provider: row.provider,
        state: row.state,
        openUntil: row.openUntil ? row.openUntil.toISOString() : null,
        cooldownS: row.cooldownS,
        trialsInFlight: row.trialsInFlight,
        updatedAt: row.updatedAt.toISOString(),
      })),
      budgetRejections: withPrefix('BUDGET_'),
      circuitRejections: withPrefix('CIRCUIT_'),
      switchRejections: this.sorted(
        failures.filter(
          (row) => row.key === 'ASK_R2_DISABLED' || row.key === 'ASK_PUBLIC_COMPUTE_DISABLED',
        ),
      ),
      /* A provider error is a failure the executor names for the MODEL leg. A budget or
         circuit refusal is a control doing its job and is never counted as one. */
      providerErrors: withPrefix('MODEL_'),
      failureCodes: this.sorted(failures),
      byBreakerOutcome: this.sorted(
        byBreakerOutcome
          .filter((g): g is typeof g & { breakerOutcome: string } => g.breakerOutcome !== null)
          .map((g) => ({ key: g.breakerOutcome, count: g._count._all })),
      ),
      signedOutAttempts: this.sorted(
        [...accessTotals.entries()].map(([key, count]) => ({ key, count })),
      ),
      declaredAccessEvents: [...ASK_ACCESS_EVENTS],
      accessBucketHours: ASK_ACCESS_BUCKET_MS / (60 * 60 * 1000),
      byRoutePath: this.sorted(
        byRoutePath.map((g) => ({ key: g.routePath, count: g._count._all })),
      ),
      declaredRoutePaths: [...ASK_ROUTE_PATHS],
      instrumentedRoutePaths: [...EMITTED_ASK_ROUTE_PATHS],
      legacyInstrumented: EMITTED_ASK_ROUTE_PATHS.includes('LEGACY_ANALYSIS'),
    };
  }

  private async switchRows(): Promise<AdminAskOperations['switches']> {
    return Promise.all(
      OPERATIONAL_SWITCHES.map(async (name) => {
        /* Resolved through the SAME service the Ask path consults, so the screen cannot
           disagree with the executor about whether a switch is on. `setBy` is not read: it
           names a person and has no field in this contract. */
        const state = await this.switches.state(name);
        return {
          name: state.name,
          deploymentValueIsLiteralTrue: state.deploymentValueIsLiteralTrue,
          rowPresent: state.row !== null,
          rowEnabled: state.row ? state.row.enabled : null,
          effective: state.effective,
          readable: state.readable,
          setAt: state.row ? state.row.setAt.toISOString() : null,
        };
      }),
    );
  }

  /* ── IMPROVEMENT QUEUE ─────────────────────────────────────────────────── */

  private async improvement(rows: readonly ListRow[], long: Date): Promise<AdminAskImprovement> {
    const where = { occurredAt: { gte: long } };
    const [observationsInWindow, capabilityUnavailableTotal, byFailure, unavailableByClass] =
      await Promise.all([
        this.prisma.askObservation.count({ where }),
        this.prisma.askObservation.count({ where: { ...where, capabilityUnavailable: true } }),
        this.prisma.askObservation.groupBy({
          by: ['failureCode'],
          where: { ...where, failureCode: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.askObservation.groupBy({
          by: ['questionClass'],
          where: { ...where, capabilityUnavailable: true },
          _count: { _all: true },
        }),
      ]);

    const poor = rows.filter((row) => ADMIN_ASK_POOR_OUTCOME_STATES.includes(row.answerState));

    return {
      observationsInWindow,
      capabilityUnavailableTotal,
      unavailableByQuestionClass: this.sorted(
        unavailableByClass.map((g) => ({ key: g.questionClass, count: g._count._all })),
      ),
      missingEvidenceRoles: this.tally(rows.flatMap((row) => row.evidenceRolesMissing)),
      failureReasons: this.sorted(
        byFailure
          .filter((g): g is typeof g & { failureCode: string } => g.failureCode !== null)
          .map((g) => ({ key: g.failureCode, count: g._count._all })),
      ),
      affectedQuestionClasses: this.tally(poor.map((row) => row.questionClass)),
      affectedDomains: this.tally(poor.flatMap((row) => row.domains)),
      affectedCountries: this.tally(poor.flatMap((row) => row.geographyCodes)).slice(
        0,
        ADMIN_ASK_COUNTRY_LIMIT,
      ),
      poorOutcomeStates: [...ADMIN_ASK_POOR_OUTCOME_STATES],
      refusalCodes: this.tally(rows.flatMap((row) => row.refusalCodes)),
      countryLimit: ADMIN_ASK_COUNTRY_LIMIT,
    };
  }

  /* ── OPERATOR ALERTS ───────────────────────────────────────────────────── */

  /**
   * THE OPERATOR-WARNING MECHANISM.
   *
   * Every threshold below is a RATIO OF A MEASUREMENT TO A LANDED NUMBER, or is marked
   * `PO_PENDING`. There is no invented currency anywhere in it:
   *   saturation      measured meter units / the landed hourly and daily unit ceilings
   *   call volume     measured calls / (hourly unit ceiling / per-request unit ceiling),
   *                   which is how many maximally-sized requests that ceiling admits
   *   latency         measured p95 / the landed analysis time budget
   *   breaker         the breaker's own stored state; no threshold is needed to read OPEN
   *   rates           refusal and failure rates, which are Product judgements, marked as
   *                   pending a Product Owner ruling rather than presented as derived
   *
   * A FIGURE THAT CANNOT BE MEASURED IS `UNKNOWN`, NEVER `OK`. That is the whole reason
   * severity has four values: an operations page whose alerts go quiet when the database is
   * unreachable is worse than no operations page.
   */
  private async alerts(now: Date, short: Date): Promise<AdminAskAlerts> {
    const knobs = resolveComputeControlsConfig((name) => this.config.get<string>(name));
    const inShort = { occurredAt: { gte: short } };

    const [hourMeter, dayMeter, breakers, observations, failures, totals, latencyAgg, byFailure] =
      await Promise.all([
        this.prisma.computeMeter.findMany({
          where: { scope: GLOBAL_SCOPE, bucketStart: hourBucket(now) },
        }),
        this.prisma.computeMeter.findMany({
          where: { scope: GLOBAL_SCOPE, bucketStart: dayBucket(now) },
        }),
        this.prisma.circuitBreakerState.findMany(),
        this.prisma.askObservation.count({ where: inShort }),
        this.prisma.askObservation.count({ where: { ...inShort, failureCode: { not: null } } }),
        this.prisma.askObservation.aggregate({
          where: { occurredAt: { gte: hourBucket(now) } },
          _sum: {
            modelInvocationCount: true,
            providerCallCount: true,
            promptTokens: true,
            completionTokens: true,
          },
          _count: { promptTokens: true },
        }),
        this.prisma.askObservation.aggregate({
          where: { ...inShort, latencyMs: { not: null } },
          _count: { latencyMs: true },
        }),
        this.prisma.askObservation.groupBy({
          by: ['failureCode'],
          where: { ...inShort, failureCode: { not: null } },
          _count: { _all: true },
        }),
      ]);

    const hourUnits = Number(hourMeter[0]?.units ?? 0n);
    const dayUnits = Number(dayMeter[0]?.units ?? 0n);
    const openBreakers = breakers.filter((row) => row.state === 'OPEN').length;
    const budgetRejections = byFailure
      .filter((g) => (g.failureCode ?? '').startsWith('BUDGET_'))
      .reduce((total, g) => total + g._count._all, 0);
    const latencySamples = latencyAgg._count.latencyMs;
    const p95 = (await this.latencyOrderStatistics(short, latencySamples)).p95Ms ?? null;

    /* How many maximally-sized requests the hourly ceiling admits. Both numbers are landed
       knobs, so this ceiling is derived rather than chosen. */
    const requestCeiling =
      knobs.unitsPerRequestMax > 0
        ? Math.floor(knobs.globalUnitsPerHour / knobs.unitsPerRequestMax)
        : 0;
    const measuredUnitsThisHour =
      (totals._sum.promptTokens ?? 0) + knobs.outputWeight * (totals._sum.completionTokens ?? 0);

    const alerts: AdminAskAlert[] = [
      this.alert('PROVIDER_BREAKER_OPEN', openBreakers, 1, 1, 'COUNT', null, 'COUNT', {
        source: ADMIN_ASK_THRESHOLD_SOURCES.breakerState,
        windowHours: 0,
        sampleCount: breakers.length,
        minimumSampleCount: 0,
      }),
      this.ratioAlert(
        'BUDGET_SATURATION_HOUR',
        hourUnits,
        knobs.globalUnitsPerHour,
        ADMIN_ASK_THRESHOLD_SOURCES.globalUnitsPerHour,
        1,
        'UNITS_PER_HOUR',
      ),
      this.ratioAlert(
        'BUDGET_SATURATION_DAY',
        dayUnits,
        knobs.globalUnitsPerDay,
        ADMIN_ASK_THRESHOLD_SOURCES.globalUnitsPerDay,
        24,
        'UNITS_PER_DAY',
      ),
      this.alert(
        'BUDGET_REJECTION_RATE',
        observations > 0 ? budgetRejections / observations : null,
        ADMIN_ASK_REJECTION_RATE_WARN,
        ADMIN_ASK_REJECTION_RATE_CRITICAL,
        'RATIO',
        null,
        'RATIO',
        {
          source: ADMIN_ASK_THRESHOLD_SOURCES.ownerPending,
          windowHours: ADMIN_ASK_SHORT_WINDOW_HOURS,
          sampleCount: observations,
          minimumSampleCount: knobs.breakerMinSamples,
        },
      ),
      this.ratioAlert(
        'MODEL_CALL_VOLUME_HOUR',
        totals._sum.modelInvocationCount ?? 0,
        requestCeiling,
        ADMIN_ASK_THRESHOLD_SOURCES.requestCeiling,
        1,
        'CALLS_PER_HOUR',
      ),
      this.ratioAlert(
        'PROVIDER_CALL_VOLUME_HOUR',
        totals._sum.providerCallCount ?? 0,
        requestCeiling,
        ADMIN_ASK_THRESHOLD_SOURCES.requestCeiling,
        1,
        'CALLS_PER_HOUR',
      ),
      this.ratioAlert(
        'TOKEN_VOLUME_HOUR',
        measuredUnitsThisHour,
        knobs.globalUnitsPerHour,
        ADMIN_ASK_THRESHOLD_SOURCES.globalUnitsPerHour,
        1,
        'UNITS_PER_HOUR',
        totals._count.promptTokens,
      ),
      this.alert(
        'FAILURE_RATE',
        observations > 0 ? failures / observations : null,
        ADMIN_ASK_FAILURE_RATE_WARN,
        ADMIN_ASK_FAILURE_RATE_CRITICAL,
        'RATIO',
        null,
        'RATIO',
        {
          source: ADMIN_ASK_THRESHOLD_SOURCES.ownerPending,
          windowHours: ADMIN_ASK_SHORT_WINDOW_HOURS,
          sampleCount: observations,
          /* The breaker's own minimum sample count, reused: this platform already has a
             ruling on how many observations a ratio needs before it means anything. */
          minimumSampleCount: knobs.breakerMinSamples,
        },
      ),
      this.alert(
        'LATENCY_P95',
        p95,
        Math.round(ANALYSIS_TOTAL_BUDGET_MS * ADMIN_ASK_LATENCY_WARN_FRACTION),
        Math.round(ANALYSIS_TOTAL_BUDGET_MS * ADMIN_ASK_LATENCY_CRITICAL_FRACTION),
        'MS',
        ANALYSIS_TOTAL_BUDGET_MS,
        'MS',
        {
          source: ADMIN_ASK_THRESHOLD_SOURCES.analysisBudget,
          windowHours: ADMIN_ASK_SHORT_WINDOW_HOURS,
          sampleCount: latencySamples,
          minimumSampleCount: knobs.breakerMinSamples,
        },
      ),
    ];

    const rank: Record<AdminAskAlertSeverity, number> = {
      OK: 0,
      UNKNOWN: 1,
      WARNING: 2,
      CRITICAL: 3,
    };
    const worstSeverity = alerts.reduce<AdminAskAlertSeverity>(
      (worst, alert) => (rank[alert.severity] > rank[worst] ? alert.severity : worst),
      'OK',
    );

    return {
      alerts,
      worstSeverity,
      procedureKey: ADMIN_ASK_PROCEDURE_KEY,
      procedureDocument: ADMIN_ASK_PROCEDURE_DOCUMENT,
    };
  }

  /**
   * A saturation line: a measured count over a landed ceiling.
   *
   * `observed` IS ALWAYS A RATIO. What the ceiling counts travels as `ceilingUnit`, and the
   * two were briefly conflated: labelling the call-volume line `CALLS_PER_HOUR` made a
   * screen render 0.44 as `0` and report a three-quarters-full hour as an empty one.
   */
  private ratioAlert(
    id: string,
    measured: number,
    ceiling: number,
    source: string,
    windowHours: number,
    ceilingUnit: string,
    sampleCount = 1,
  ): AdminAskAlert {
    /* A ratio against a ceiling of zero is not zero — it is unmeasurable, and an
       unmeasurable alert is UNKNOWN rather than OK. */
    const observed = ceiling > 0 ? measured / ceiling : null;
    return this.alert(
      id,
      observed,
      ADMIN_ASK_SATURATION_WARN,
      ADMIN_ASK_SATURATION_CRITICAL,
      'RATIO',
      ceiling > 0 ? ceiling : null,
      ceilingUnit,
      { source, windowHours, sampleCount, minimumSampleCount: 0 },
    );
  }

  private alert(
    id: string,
    observed: number | null,
    warnAt: number,
    criticalAt: number,
    unit: string,
    ceiling: number | null,
    ceilingUnit: string,
    meta: {
      source: string;
      windowHours: number;
      sampleCount: number;
      minimumSampleCount: number;
    },
  ): AdminAskAlert {
    const severity: AdminAskAlertSeverity =
      observed === null || meta.sampleCount < meta.minimumSampleCount
        ? 'UNKNOWN'
        : observed >= criticalAt
          ? 'CRITICAL'
          : observed >= warnAt
            ? 'WARNING'
            : 'OK';

    return {
      id,
      severity,
      observed,
      warnAt,
      criticalAt,
      unit,
      ceiling,
      ceilingUnit,
      thresholdSource: meta.source,
      windowHours: meta.windowHours,
      sampleCount: meta.sampleCount,
      minimumSampleCount: meta.minimumSampleCount,
    };
  }

  /* ── shared reads and helpers ──────────────────────────────────────────── */

  /**
   * Median and p95, read as ORDER STATISTICS rather than computed from a distribution.
   *
   * Two bounded reads — the row at the median offset and the row at the 95th percentile
   * offset — over an index the schema declares. A percentile derived from a mean and a
   * maximum is not a percentile, and a full scan to compute one exactly would be an
   * unbounded read on an admin screen. Absent when there is no sample.
   */
  private async latencyOrderStatistics(
    since: Date,
    sampleCount: number,
  ): Promise<{ medianMs?: number; p95Ms?: number }> {
    if (sampleCount <= 0) return {};
    const at = async (offset: number): Promise<number | undefined> => {
      const rows = await this.prisma.askObservation.findMany({
        where: { occurredAt: { gte: since }, latencyMs: { not: null } },
        orderBy: { latencyMs: 'asc' },
        skip: Math.max(0, Math.min(offset, sampleCount - 1)),
        take: 1,
        select: { latencyMs: true },
      });
      return rows[0]?.latencyMs ?? undefined;
    };
    const [medianMs, p95Ms] = await Promise.all([
      at(Math.floor((sampleCount - 1) / 2)),
      at(Math.floor((sampleCount - 1) * 0.95)),
    ]);
    return { medianMs, p95Ms };
  }

  /**
   * The bounded sample every list-valued tally is computed from.
   *
   * THE SELECT IS AN ALLOW-LIST, NOT A FILTER APPLIED LATER. Only the columns named here
   * are fetched, so a column added to the model in future does not silently start arriving
   * in an admin response.
   */
  private async listSample(long: Date): Promise<ListRow[]> {
    return this.prisma.askObservation.findMany({
      where: { occurredAt: { gte: long } },
      orderBy: { occurredAt: 'desc' },
      take: ADMIN_ASK_ARRAY_SAMPLE_LIMIT,
      select: {
        questionClass: true,
        answerState: true,
        domains: true,
        geographyCodes: true,
        evidenceRolesRequested: true,
        evidenceRolesObtained: true,
        evidenceRolesMissing: true,
        refusalCodes: true,
      },
    });
  }

  private tokenTotals(
    sampleCount: number,
    promptSum: number | null,
    completionSum: number | null,
  ): AdminAskHealth['tokens'] {
    if (sampleCount <= 0) return { sampleCount: 0 };
    const promptTokens = promptSum ?? undefined;
    const completionTokens = completionSum ?? undefined;
    return {
      sampleCount,
      promptTokens,
      completionTokens,
      totalTokens:
        promptTokens === undefined && completionTokens === undefined
          ? undefined
          : (promptTokens ?? 0) + (completionTokens ?? 0),
    };
  }

  private since(now: Date, hours: number): Date {
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }

  /**
   * Runs one section and converts a failure into null. The failure is LOGGED rather than
   * swallowed: an operations page that quietly shows one fewer panel teaches an operator to
   * distrust the whole page.
   */
  private async section<T>(name: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(
        `Ask intelligence section "${name}" could not be read: ${
          (error as Error)?.message ?? 'unknown'
        }`,
      );
      return null;
    }
  }

  private index(values: readonly string[]): Map<string, number> {
    const totals = new Map<string, number>();
    for (const value of values) totals.set(value, (totals.get(value) ?? 0) + 1);
    return totals;
  }

  private tally(values: readonly string[]): AdminAskCount[] {
    return this.sorted([...this.index(values).entries()].map(([key, count]) => ({ key, count })));
  }

  private sorted(counts: AdminAskCount[]): AdminAskCount[] {
    return [...counts].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }
}

/** The bounded sample's row shape. Named so the select above is the only definition of it. */
interface ListRow {
  questionClass: string;
  answerState: string;
  domains: string[];
  geographyCodes: string[];
  evidenceRolesRequested: string[];
  evidenceRolesObtained: string[];
  evidenceRolesMissing: string[];
  refusalCodes: string[];
}

/** Exported so a spec can assert the sample shape without importing a private name. */
export type AdminAskListRow = ListRow;

/** Re-exported so a spec can pin the alert identifiers against the service that emits them. */
export { ADMIN_ASK_ALERT_IDS };
