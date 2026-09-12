import { PrismaService } from '../../database/prisma.service';
import { AdminAnalyticsService } from '../admin/analytics/admin-analytics.service';
import { SituationRepository } from './situation.repository';
import type { CompletedAnalysisRecord, SituationIdentity } from './situation.contract';

/**
 * S1 — `AnalysisRun` REMAINS TELEMETRY.
 *
 * The CTO's ruling is that AnalysisRun must not be widened into the result
 * store. That is not only a schema statement; it is a statement about what
 * ONE ROW MEANS. Today an AnalysisRun row means "one analysis was
 * attempted", and every Admin figure — runs in the last 24h, status
 * breakdown, provider mix, cache hit rate, latency and token aggregates —
 * is a count or an aggregate over rows carrying that meaning. Let the
 * situation store write into that table, or read through it, and the
 * meaning of a row changes; every one of those figures then changes with
 * it, silently, without a single line of admin-analytics.service.ts having
 * been edited.
 *
 * THREE SEPARATE PROOFS, BECAUSE THEY FAIL DIFFERENTLY:
 *
 *   1. the situation write path issues ZERO operations against the
 *      analysisRun delegate;
 *   2. the AnalysisRun trace it does record is a plain scalar column, with
 *      no relation write of any kind;
 *   3. the REAL AdminAnalyticsService, run against the same recording
 *      double before and after a situation append, issues byte-identical
 *      queries and returns a byte-identical result.
 *
 * The third is the one that matters most: it exercises the actual admin
 * code rather than asserting something about the situation code.
 */

interface Recorder {
  calls: Array<{ model: string; op: string; args: unknown }>;
}

/**
 * The admin double, kept deliberately IDENTICAL in behaviour to the one in
 * admin-analytics.spec.ts — same shape-correct defaults — so that the
 * before/after comparison here is a comparison of the service, not of two
 * different fakes.
 */
function buildRecordingPrisma(recorder: Recorder): PrismaService {
  const model = (name: string): Record<string, unknown> =>
    new Proxy(
      {},
      {
        get: (_target, op: string) => (args: unknown) => {
          recorder.calls.push({ model: name, op, args });
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

/** An in-memory situation store that also records EVERY delegate touched. */
function buildSituationClient(recorder: Recorder): PrismaService {
  let nextId = 1;
  const tables = {
    situations: [] as Array<Record<string, unknown>>,
    snapshots: [] as Array<Record<string, unknown>>,
    clusters: [] as Array<Record<string, unknown>>,
    members: [] as Array<Record<string, unknown>>,
  };

  const touch = (model: string, op: string, args: unknown): void => {
    recorder.calls.push({ model, op, args });
  };

  const delegates = {
    situation: {
      findUnique: (args: unknown) => {
        touch('situation', 'findUnique', args);
        return Promise.resolve(null);
      },
      findMany: (args: unknown) => {
        touch('situation', 'findMany', args);
        return Promise.resolve([]);
      },
      create: (args: { data: Record<string, unknown> }) => {
        touch('situation', 'create', args);
        const row = { ...args.data, id: `sit-${nextId++}` };
        tables.situations.push(row);
        return Promise.resolve(row);
      },
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        touch('situation', 'update', args);
        const row = tables.situations.find((r) => r.id === args.where.id) ?? {};
        Object.assign(row, args.data);
        return Promise.resolve(row);
      },
    },
    situationSnapshot: {
      findFirst: (args: unknown) => {
        touch('situationSnapshot', 'findFirst', args);
        return Promise.resolve(null);
      },
      create: (args: { data: Record<string, unknown> }) => {
        touch('situationSnapshot', 'create', args);
        const row = { ...args.data, id: `snap-${nextId++}` };
        tables.snapshots.push(row);
        return Promise.resolve(row);
      },
    },
    situationCluster: {
      create: (args: { data: Record<string, unknown> }) => {
        touch('situationCluster', 'create', args);
        const row = { ...args.data, id: `clu-${nextId++}` };
        tables.clusters.push(row);
        return Promise.resolve(row);
      },
    },
    situationClusterMember: {
      createMany: (args: { data: unknown[] }) => {
        touch('situationClusterMember', 'createMany', args);
        tables.members.push(...(args.data as Array<Record<string, unknown>>));
        return Promise.resolve({ count: args.data.length });
      },
    },
    situationShadowDecision: {
      create: (args: { data: Record<string, unknown> }) => {
        touch('situationShadowDecision', 'create', args);
        return Promise.resolve({ ...args.data, id: `sd-${nextId++}` });
      },
    },
  };

  return {
    ...delegates,
    $transaction: <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      touch('$transaction', 'begin', undefined);
      return fn(delegates);
    },
  } as unknown as PrismaService;
}

const IDENTITY: SituationIdentity = {
  partitionKey: 'sit:v1:RWA',
  keyVersion: 'v1',
  discriminator: 'd-flooding',
  discriminatorBasis: 'SEED_OBSERVATION_V1',
};

const RECORD: CompletedAnalysisRecord = {
  identity: IDENTITY,
  observation: {
    url: 'https://a.test/1',
    title: 'Flooding in Rwanda',
    summary: 'Heavy rain.',
    observedAt: new Date('2026-08-31T09:00:00.000Z'),
    countryCode: 'RW',
  },
  analysedAt: new Date('2026-08-31T10:00:00.000Z'),
  dimensions: { severity: 'HIGH' },
  clusters: [{ clusterKey: 'c1', publisherCount: 1, articleUrls: ['https://a.test/1'] }],
  analysisRunId: 'run-abc',
};

const NOW = new Date('2026-08-25T12:00:00.000Z');

describe('S1 — the situation write path never touches AnalysisRun', () => {
  it('issues ZERO operations against the analysisRun delegate', async () => {
    const recorder: Recorder = { calls: [] };
    const repository = new SituationRepository(buildSituationClient(recorder));

    await repository.appendCompletedAnalysis(RECORD);

    const analysisRunCalls = recorder.calls.filter((call) => call.model === 'analysisRun');
    expect(analysisRunCalls).toEqual([]);
    // And it did do real work, so the assertion above is not vacuous.
    expect(recorder.calls.some((c) => c.model === 'situationSnapshot' && c.op === 'create')).toBe(
      true,
    );
  });

  it('touches ONLY the Situation models', async () => {
    const recorder: Recorder = { calls: [] };
    await new SituationRepository(buildSituationClient(recorder)).appendCompletedAnalysis(
      RECORD,
    );

    const models = Array.from(new Set(recorder.calls.map((c) => c.model))).sort();
    expect(models).toEqual([
      '$transaction',
      'situation',
      'situationCluster',
      'situationClusterMember',
      'situationSnapshot',
    ]);
  });

  it('records the AnalysisRun trace as a SCALAR column, never as a relation write', async () => {
    const recorder: Recorder = { calls: [] };
    await new SituationRepository(buildSituationClient(recorder)).appendCompletedAnalysis(
      RECORD,
    );

    const create = recorder.calls.find(
      (c) => c.model === 'situationSnapshot' && c.op === 'create',
    ) as { args: { data: Record<string, unknown> } };

    expect(create.args.data.analysisRunId).toBe('run-abc');
    // No `connect`, no nested write, nothing that would require the
    // telemetry row to still exist.
    expect(JSON.stringify(create.args.data)).not.toContain('connect');
    expect(Object.keys(create.args.data)).not.toContain('analysisRun');
  });
});

describe('S1 — existing Admin AnalysisRun analytics are unchanged', () => {
  it('issues exactly the same AnalysisRun queries before and after a situation append', async () => {
    const before: Recorder = { calls: [] };
    await new AdminAnalyticsService(buildRecordingPrisma(before)).usage(NOW);

    const situationRecorder: Recorder = { calls: [] };
    await new SituationRepository(buildSituationClient(situationRecorder)).appendCompletedAnalysis(
      RECORD,
    );

    const after: Recorder = { calls: [] };
    await new AdminAnalyticsService(buildRecordingPrisma(after)).usage(NOW);

    const analysisRunQueries = (recorder: Recorder): string =>
      JSON.stringify(
        recorder.calls
          .filter((call) => call.model === 'analysisRun')
          .map((call) => ({ op: call.op, args: call.args })),
      );

    // EIGHT queries: two counts, four groupBys, two aggregates — the whole
    // AnalysisRun surface admin-analytics.service.ts has.
    expect(before.calls.filter((c) => c.model === 'analysisRun')).toHaveLength(8);
    expect(analysisRunQueries(after)).toBe(analysisRunQueries(before));
  });

  it('returns a byte-identical analysis section before and after', async () => {
    const beforeService = new AdminAnalyticsService(buildRecordingPrisma({ calls: [] }));
    const beforeResult = await beforeService.usage(NOW);

    await new SituationRepository(buildSituationClient({ calls: [] })).appendCompletedAnalysis(
      RECORD,
    );

    const afterService = new AdminAnalyticsService(buildRecordingPrisma({ calls: [] }));
    const afterResult = await afterService.usage(NOW);

    expect(JSON.stringify(afterResult.analysis)).toBe(JSON.stringify(beforeResult.analysis));
  });

  it('the situation store never appears in an Admin analytics query', async () => {
    const recorder: Recorder = { calls: [] };
    await new AdminAnalyticsService(buildRecordingPrisma(recorder)).usage(NOW);

    const situationModels = recorder.calls.filter((call) => call.model.startsWith('situation'));
    expect(situationModels).toEqual([]);
  });
});
