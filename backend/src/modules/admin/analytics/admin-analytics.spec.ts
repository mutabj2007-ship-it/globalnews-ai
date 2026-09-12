import { PrismaService } from '../../../database/prisma.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import {
  ADMIN_COVERAGE_COUNTRY_LIMIT,
  ADMIN_USERS_PAGE_SIZE_DEFAULT,
  ADMIN_USERS_PAGE_SIZE_MAX,
} from './admin-analytics.contract';

/**
 * ADMIN-03 — the analytics read service.
 *
 * THE DOUBLE RECORDS QUERIES AND RETURNS CANNED ROWS; IT DOES NOT
 * REIMPLEMENT PRISMA. That is deliberate. A fake that re-derives
 * groupBy and aggregate semantics would mostly test the fake, and it
 * would diverge from the real client exactly where the real client is
 * subtle. What actually needs asserting here is on this side of the
 * boundary:
 *
 *   - the QUERY SHAPE, because that is where the window boundaries live
 *     and where the account select decides which columns can ever leave
 *     the database;
 *   - the TRANSFORMATION, because that is where a null becomes a zero,
 *     an unsampled mean becomes a number, or a truncated list becomes a
 *     claim about the whole.
 *
 * Whether PostgreSQL counts correctly is not this file's business.
 */
interface Recorder {
  calls: Array<{ model: string; op: string; args: unknown }>;
}

type Canned = Record<string, unknown>;

/**
 * `fail` names an operation, as `model.op`, that should THROW — so the
 * section-level failure handling is exercised against a real rejection
 * rather than a flag.
 */
function buildPrismaDouble(canned: Canned, recorder: Recorder, fail: string[] = []): PrismaService {
  const model = (name: string): Record<string, unknown> =>
    new Proxy(
      {},
      {
        get: (_target, op: string) => (args: unknown) => {
          recorder.calls.push({ model: name, op, args });
          const key = `${name}.${op}`;
          if (fail.includes(key)) return Promise.reject(new Error(`forced failure: ${key}`));
          if (key in canned) return Promise.resolve(canned[key]);
          // Shape-correct defaults. A double that returned 0 for a
          // groupBy would fail the service inside its own mapper and
          // report that as a section failure, which is a test artifact
          // masquerading as the behaviour under test.
          if (op === 'groupBy' || op === 'findMany') return Promise.resolve([]);
          if (op === 'aggregate') {
            return Promise.resolve({
              _count: { latencyMs: 0, totalTokens: 0 },
              _avg: { latencyMs: null },
              _min: { latencyMs: null },
              _max: { latencyMs: null },
              _sum: { promptTokens: null, completionTokens: null, totalTokens: null },
            });
          }
          return Promise.resolve(0);
        },
      },
    );

  return new Proxy({}, { get: (_target, name: string) => model(name) }) as unknown as PrismaService;
}

const NOW = new Date('2026-08-25T12:00:00.000Z');
const H24 = new Date('2026-08-24T12:00:00.000Z');
const D7 = new Date('2026-08-18T12:00:00.000Z');

const argsOf = (recorder: Recorder, key: string): unknown[] =>
  recorder.calls.filter((call) => `${call.model}.${call.op}` === key).map((call) => call.args);

describe('ADMIN-03 AdminAnalyticsService — usage', () => {
  it('counts accounts against the two window boundaries, and NULL lastSeenAt separately', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(buildPrismaDouble({}, recorder));

    await service.usage(NOW);

    expect(argsOf(recorder, 'user.count')).toEqual([
      undefined,
      { where: { createdAt: { gte: H24 } } },
      { where: { createdAt: { gte: D7 } } },
      { where: { lastSeenAt: { gte: H24 } } },
      { where: { lastSeenAt: { gte: D7 } } },
      // NEVER OBSERVED is its own query. It is not derived by subtracting
      // the returning counts from the total, which would silently fold
      // "we have never seen them" into "they have not come back".
      { where: { lastSeenAt: null } },
    ]);
  });

  it('a section whose read fails is null, and the other sections still resolve', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(
      buildPrismaDouble(
        { 'productEvent.groupBy': [{ name: 'return_visit', _count: { _all: 3 } }] },
        recorder,
        ['user.count'],
      ),
    );

    const result = await service.usage(NOW);

    // NULL, NOT ZEROS. A failed read that returned a zeroed shape is the
    // A-1 defect rebuilt: the screen would present a measurement nobody
    // took, and an operator would read it as "no accounts".
    expect(result.accounts).toBeNull();
    expect(result.analysis).not.toBeNull();
    expect(result.events).not.toBeNull();
    expect(result.generatedAt).toBe(NOW.toISOString());
  });

  it('an unsampled latency or token aggregate is OMITTED, never reported as zero', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(
      buildPrismaDouble(
        {
          'analysisRun.groupBy': [],
          'analysisRun.aggregate': {
            _count: { latencyMs: 0, totalTokens: 0 },
            _avg: { latencyMs: null },
            _min: { latencyMs: null },
            _max: { latencyMs: null },
            _sum: { promptTokens: null, completionTokens: null, totalTokens: null },
          },
        },
        recorder,
      ),
    );

    const { analysis } = await service.usage(NOW);

    expect(analysis?.latency).toEqual({ sampleCount: 0 });
    expect(analysis?.tokens).toEqual({ sampleCount: 0 });
    expect(analysis?.latency).not.toHaveProperty('averageMs');
    expect(analysis?.tokens).not.toHaveProperty('totalTokens');
  });

  it('a sampled aggregate carries the sample size alongside the number', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(
      buildPrismaDouble(
        {
          'analysisRun.groupBy': [],
          'analysisRun.aggregate': {
            _count: { latencyMs: 7, totalTokens: 4 },
            _avg: { latencyMs: 1234.6 },
            _min: { latencyMs: 900 },
            _max: { latencyMs: 3000 },
            _sum: { promptTokens: 100, completionTokens: 60, totalTokens: 160 },
          },
        },
        recorder,
      ),
    );

    const { analysis } = await service.usage(NOW);

    // The sample size is the difference between "mean latency 1235ms"
    // and "mean latency 1235ms, over 7 rows". Only the second is a
    // measurement a reader can weigh.
    expect(analysis?.latency).toEqual({
      sampleCount: 7,
      averageMs: 1235,
      minMs: 900,
      maxMs: 3000,
    });
    expect(analysis?.tokens.sampleCount).toBe(4);
    expect(analysis?.tokens.totalTokens).toBe(160);
  });

  it('the failure-reason grouping never asks for rows without a reason', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(
      buildPrismaDouble({ 'analysisRun.groupBy': [] }, recorder),
    );

    await service.usage(NOW);

    const reasonQuery = argsOf(recorder, 'analysisRun.groupBy').find(
      (args) => (args as { by: string[] }).by[0] === 'failureReason',
    ) as { where: Record<string, unknown> };

    expect(reasonQuery.where).toEqual({
      createdAt: { gte: D7 },
      failureReason: { not: null },
    });
  });

  it('recorded events carry only the names that are actually present', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(
      buildPrismaDouble(
        {
          'productEvent.groupBy': [
            { name: 'analysis_started', _count: { _all: 4 } },
            { name: 'return_visit', _count: { _all: 9 } },
          ],
        },
        recorder,
      ),
    );

    const { events } = await service.usage(NOW);

    // Two names, not twelve. An event that cannot be emitted has no zero
    // to report -- nobody measured one.
    expect(events?.recorded).toEqual([
      { key: 'return_visit', count: 9 },
      { key: 'analysis_started', count: 4 },
    ]);
    expect(events?.instrumentedEventNames).toHaveLength(5);
    expect(events?.uninstrumentedEventNames).toHaveLength(7);
    expect(events?.uninstrumentedEventNames).toContain('today_view');
    expect(events?.instrumentedEventNames).not.toContain('today_view');
  });

  it('the retention disclosure states the declared rule AND that nothing enforces it', async () => {
    const service = new AdminAnalyticsService(buildPrismaDouble({}, { calls: [] }));
    const { retention } = await service.usage(NOW);

    expect(retention).toEqual({ declaredDays: 90, enforced: false });
  });

  it('no query anywhere in the usage path reads ProductEvent.userId or SearchHistoryEntry', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(buildPrismaDouble({}, recorder));

    await service.usage(NOW);

    expect(recorder.calls.some((call) => call.model === 'searchHistoryEntry')).toBe(false);
    const serialized = JSON.stringify(recorder.calls);
    expect(serialized).not.toContain('userId');
    expect(serialized).not.toContain('email');
  });
});

describe('ADMIN-03 AdminAnalyticsService — coverage geography', () => {
  const coverageDouble = (recorder: Recorder, fail: string[] = []): PrismaService => {
    let call = 0;
    const relevant = [
      { countryCode: 'RWA', countryName: 'Rwanda', _count: { _all: 2 } },
      { countryCode: 'RWA', countryName: 'Republic of Rwanda', _count: { _all: 9 } },
      { countryCode: 'POL', countryName: 'Poland', _count: { _all: 40 } },
      ...Array.from({ length: 40 }, (_unused, index) => ({
        countryCode: `X${String(index).padStart(2, '0')}`,
        countryName: `Country ${index}`,
        _count: { _all: 1 },
      })),
    ];
    const totals = [
      { countryCode: 'RWA', _count: { _all: 30 } },
      { countryCode: 'POL', _count: { _all: 55 } },
    ];

    return new Proxy(
      {},
      {
        get: (_t, model: string) =>
          new Proxy(
            {},
            {
              get: (_t2, op: string) => (args: unknown) => {
                recorder.calls.push({ model, op, args });
                const key = `${model}.${op}`;
                if (fail.includes(key)) return Promise.reject(new Error('forced'));
                if (key === 'articleCountry.groupBy') {
                  call += 1;
                  return Promise.resolve(call === 1 ? relevant : totals);
                }
                if (key === 'countryFollow.groupBy') {
                  return Promise.resolve([
                    { countryCode: 'UKR', _count: { _all: 1 } },
                    { countryCode: 'POL', _count: { _all: 5 } },
                  ]);
                }
                return Promise.resolve([]);
              },
            },
          ),
      },
    ) as unknown as PrismaService;
  };

  it('resolves a country name by WEIGHT, so one mislabelled row cannot rename a country', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(coverageDouble(recorder));

    const result = await service.coverageGeography(NOW);
    const rwanda = result.countries?.find((row) => row.countryCode === 'RWA');

    expect(rwanda?.countryName).toBe('Republic of Rwanda');
    expect(rwanda?.relevantArticleCount).toBe(11);
    expect(rwanda?.totalArticleCount).toBe(30);
  });

  it('the distinct-country count is taken BEFORE the cap, and the cap is disclosed', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(coverageDouble(recorder));

    const result = await service.coverageGeography(NOW);

    // 42 countries exist; the list is capped. Reporting the capped
    // length as the distinct count would understate coverage, and the
    // screen would say the platform covers fewer countries than it does.
    expect(result.countries).toHaveLength(ADMIN_COVERAGE_COUNTRY_LIMIT);
    expect(result.distinctCountriesWithRelevantCoverage).toBe(42);
    expect(result.countryLimit).toBe(ADMIN_COVERAGE_COUNTRY_LIMIT);
  });

  it('only relevant rows drive the ranking', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(coverageDouble(recorder));

    await service.coverageGeography(NOW);

    const [first] = argsOf(recorder, 'articleCountry.groupBy') as Array<{
      where?: Record<string, unknown>;
    }>;
    expect(first.where).toEqual({ isRelevant: true });
  });

  it('followed countries are a follower-ACCOUNT count, ranked, and carry no account identifier', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(coverageDouble(recorder));

    const result = await service.coverageGeography(NOW);

    expect(result.followedCountries).toEqual([
      { countryCode: 'POL', followerAccountCount: 5 },
      { countryCode: 'UKR', followerAccountCount: 1 },
    ]);
    expect(JSON.stringify(result.followedCountries)).not.toContain('userId');
  });

  it('a failed coverage read is null while followed countries still resolve, and vice versa', async () => {
    const a = await new AdminAnalyticsService(
      coverageDouble({ calls: [] }, ['articleCountry.groupBy']),
    ).coverageGeography(NOW);
    expect(a.countries).toBeNull();
    expect(a.distinctCountriesWithRelevantCoverage).toBeNull();
    expect(a.followedCountries).not.toBeNull();

    const b = await new AdminAnalyticsService(
      coverageDouble({ calls: [] }, ['countryFollow.groupBy']),
    ).coverageGeography(NOW);
    expect(b.followedCountries).toBeNull();
    expect(b.countries).not.toBeNull();
  });

  it('AUDIENCE GEOGRAPHY HAS NO REPRESENTATION IN THE RESPONSE AT ALL', async () => {
    const result = await new AdminAnalyticsService(coverageDouble({ calls: [] })).coverageGeography(
      NOW,
    );

    // Not "absent because it is empty" -- absent because there is no key
    // for it. Audience location is never inferred from coverage, from
    // followed countries, from retrieval scope or from language, and the
    // shape of the response is what makes that structural.
    const keys = Object.keys(result).sort();
    expect(keys).toEqual([
      'countries',
      'countryLimit',
      'distinctCountriesWithRelevantCoverage',
      'followedCountries',
      'generatedAt',
    ]);
  });
});

describe('ADMIN-03 AdminAnalyticsService — accounts', () => {
  const usersDouble = (recorder: Recorder, rows: unknown[], fail: string[] = []): PrismaService =>
    new Proxy(
      {},
      {
        get: (_t, model: string) =>
          new Proxy(
            {},
            {
              get: (_t2, op: string) => (args: unknown) => {
                recorder.calls.push({ model, op, args });
                const key = `${model}.${op}`;
                if (fail.includes(key)) return Promise.reject(new Error('forced'));
                if (key === 'user.findMany') return Promise.resolve(rows);
                if (key === 'user.count') return Promise.resolve(rows.length);
                if (key === 'user.groupBy') {
                  return Promise.resolve([
                    { adminRole: null, _count: { _all: 9 } },
                    { adminRole: 'SUPER_ADMIN', _count: { _all: 1 } },
                    { adminRole: 'NOT_A_REAL_ROLE', _count: { _all: 2 } },
                  ]);
                }
                return Promise.resolve([]);
              },
            },
          ),
      },
    ) as unknown as PrismaService;

  const row = {
    id: 'acc-1',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    lastSeenAt: null,
    adminRole: null,
  };

  it('SELECTS EXACTLY FOUR COLUMNS — the address is never fetched, not merely never rendered', async () => {
    const recorder: Recorder = { calls: [] };
    await new AdminAnalyticsService(usersDouble(recorder, [row])).users(1, 25, NOW);

    const [query] = argsOf(recorder, 'user.findMany') as Array<{ select: Record<string, boolean> }>;

    expect(Object.keys(query.select).sort()).toEqual([
      'adminRole',
      'createdAt',
      'id',
      'lastSeenAt',
    ]);
    // The six fields the ruling forbade, and displayName, have no way in:
    // a column absent from the select is absent from the row object, so
    // no later mapper can surface one by accident.
    ['email', 'displayName', 'identities', 'sessions', 'history', 'tokenHash'].forEach((field) => {
      expect(query.select).not.toHaveProperty(field);
    });
  });

  it('an unrecognised role column value resolves to NOT an administrator, never to a role', async () => {
    const recorder: Recorder = { calls: [] };
    const result = await new AdminAnalyticsService(
      usersDouble(recorder, [{ ...row, adminRole: 'NOT_A_REAL_ROLE' }]),
    ).users(1, 25, NOW);

    expect(result.accounts?.[0].adminRole).toBeNull();
    // The same fail-closed rule applies to the distribution: the
    // unrecognised bucket merges into `none` rather than appearing as a
    // fifth role that the capability model has never heard of.
    expect(result.byAdminRole).toEqual([
      { key: 'none', count: 11 },
      { key: 'SUPER_ADMIN', count: 1 },
    ]);
  });

  it('the page size is clamped and a nonsense page is refused rather than passed through', async () => {
    const recorder: Recorder = { calls: [] };
    const service = new AdminAnalyticsService(usersDouble(recorder, [row]));

    expect((await service.users(1, 100000, NOW)).pageSize).toBe(ADMIN_USERS_PAGE_SIZE_MAX);
    expect((await service.users(1, 0, NOW)).pageSize).toBe(ADMIN_USERS_PAGE_SIZE_DEFAULT);
    expect((await service.users(-3, Number.NaN, NOW)).pageSize).toBe(ADMIN_USERS_PAGE_SIZE_DEFAULT);
    expect((await service.users(-3, Number.NaN, NOW)).page).toBe(1);

    const skips = (argsOf(recorder, 'user.findMany') as Array<{ skip: number }>).map((q) => q.skip);
    expect(skips.every((skip) => skip >= 0)).toBe(true);
  });

  it('a null lastSeenAt is reported as null — never as a date and never as inactive', async () => {
    const result = await new AdminAnalyticsService(usersDouble({ calls: [] }, [row])).users(
      1,
      25,
      NOW,
    );

    expect(result.accounts?.[0]).toEqual({
      id: 'acc-1',
      createdAt: '2026-08-01T00:00:00.000Z',
      lastSeenAt: null,
      adminRole: null,
    });
  });

  it('a failed read yields null for every data field while page and pageSize still describe the request', async () => {
    const result = await new AdminAnalyticsService(
      usersDouble({ calls: [] }, [row], ['user.findMany']),
    ).users(2, 10, NOW);

    expect(result.accounts).toBeNull();
    expect(result.totalCount).toBeNull();
    expect(result.byAdminRole).toBeNull();
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });
});
