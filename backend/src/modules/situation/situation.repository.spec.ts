import { PrismaService } from '../../database/prisma.service';
import {
  InvalidSituationDimensionsError,
  type CompletedAnalysisRecord,
  type SituationIdentity,
  type SituationObservation,
} from './situation.contract';
import { InvalidSituationIdentityError } from './situation-identity.port';
import { InvalidSituationClusterError, SituationRepository } from './situation.repository';
import { SituationClientShapeError, asSituationPrismaPort } from './situation.prisma-port';

/**
 * S1-R2 — THE REPOSITORY.
 *
 * THE FAKE IS A REAL LITTLE DATABASE, NOT A CALL RECORDER. The guarantees under
 * test are ALL-OR-NOTHING and APPEND-ONLY, and neither can be observed by
 * asserting which methods were called. `$transaction` below works on a COPY and
 * commits it only when the callback resolves, so a rollback is a real rollback.
 *
 * It also enforces the ONE unique index that carries R2's correction —
 * (partitionKey, keyVersion, discriminator) — and, deliberately, NOTHING on
 * partitionKey alone. The first test in this file is the one that would have
 * failed under S1.
 *
 * What the fake does NOT do is re-implement Prisma or PostgreSQL. The
 * SQL-level guarantees — the constraints, the cascades, the assign-once
 * trigger, the shadowOnly CHECK, the rollback — are proven separately against a
 * real PostgreSQL 16 in the delivered evidence pack.
 */

interface Tables {
  situations: Array<Record<string, unknown> & { id: string }>;
  snapshots: Array<Record<string, unknown> & { id: string; analysedAt: Date; createdAt: Date }>;
  clusters: Array<Record<string, unknown> & { id: string }>;
  members: Array<Record<string, unknown> & { id: string }>;
  shadow: Array<Record<string, unknown> & { id: string }>;
}

const emptyTables = (): Tables => ({
  situations: [],
  snapshots: [],
  clusters: [],
  members: [],
  shadow: [],
});

const clone = (t: Tables): Tables => ({
  situations: t.situations.map((r) => ({ ...r })),
  snapshots: t.snapshots.map((r) => ({ ...r })),
  clusters: t.clusters.map((r) => ({ ...r })),
  members: t.members.map((r) => ({ ...r })),
  shadow: t.shadow.map((r) => ({ ...r })),
});

interface Fake {
  tables: Tables;
  calls: string[];
  client: PrismaService;
}

function buildFake(seed: Tables = emptyTables()): Fake {
  const state = { tables: seed };
  const calls: string[] = [];
  let n = 1;
  const id = (p: string): string => `${p}-${n++}`;

  // The getter matters: `$transaction` REPLACES state.tables with the committed
  // clone, so delegates that closed over the array they were built with would
  // keep reading a stale one. Resolving at call time is what makes the
  // non-transactional reads see committed data.
  const delegatesFor = (get: () => Tables): Record<string, unknown> => ({
    situation: {
      findUnique: (args: {
        where: {
          partitionKey_keyVersion_discriminator: {
            partitionKey: string;
            keyVersion: string;
            discriminator: string;
          };
        };
      }) => {
        calls.push('situation.findUnique');
        const k = args.where.partitionKey_keyVersion_discriminator;
        return Promise.resolve(
          get().situations.find(
            (r) =>
              r.partitionKey === k.partitionKey &&
              r.keyVersion === k.keyVersion &&
              r.discriminator === k.discriminator,
          ) ?? null,
        );
      },
      findMany: (args: { where: { partitionKey: string; keyVersion: string }; take?: number }) => {
        calls.push('situation.findMany');
        const rows = get().situations.filter(
          (r) =>
            r.partitionKey === args.where.partitionKey && r.keyVersion === args.where.keyVersion,
        );
        return Promise.resolve(args.take === undefined ? rows : rows.slice(0, args.take));
      },
      create: (args: { data: Record<string, unknown> }) => {
        calls.push('situation.create');
        // THE ONLY UNIQUE INDEX ON THIS TABLE. Note what is NOT here: any check
        // on partitionKey alone.
        if (
          get().situations.some(
            (r) =>
              r.partitionKey === args.data.partitionKey &&
              r.keyVersion === args.data.keyVersion &&
              r.discriminator === args.data.discriminator,
          )
        ) {
          return Promise.reject(
            new Error('unique constraint: (partitionKey, keyVersion, discriminator)'),
          );
        }
        const row = { ...args.data, id: id('sit') } as Tables['situations'][number];
        get().situations.push(row);
        return Promise.resolve(row);
      },
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push('situation.update');
        const row = get().situations.find((r) => r.id === args.where.id);
        if (row === undefined) return Promise.reject(new Error('no such Situation'));
        // THE ASSIGN-ONCE TRIGGER, IN MINIATURE. The real one is installed by
        // the migration and proven against PostgreSQL; this mirrors it so a
        // repository change that tried to move an identity column fails here
        // too, in a unit test, rather than only in the database.
        for (const immutable of [
          'discriminator',
          'discriminatorBasis',
          'partitionKey',
          'keyVersion',
          'seedArticleUrl',
          'seedObservedAt',
          'firstObservedAt',
        ]) {
          if (immutable in args.data && args.data[immutable] !== row[immutable]) {
            return Promise.reject(
              new Error(`Situation identity is assign-once: ${immutable} cannot be changed`),
            );
          }
        }
        Object.assign(row, args.data);
        return Promise.resolve(row);
      },
    },
    situationSnapshot: {
      findFirst: (args: { where: { situationId: string } }) => {
        calls.push('situationSnapshot.findFirst');
        const rows = get().snapshots
          .filter((r) => r.situationId === args.where.situationId)
          .sort(
            (a, b) =>
              b.analysedAt.getTime() - a.analysedAt.getTime() ||
              b.createdAt.getTime() - a.createdAt.getTime(),
          );
        return Promise.resolve(rows[0] ?? null);
      },
      create: (args: { data: Record<string, unknown> }) => {
        calls.push('situationSnapshot.create');
        const row = {
          ...args.data,
          id: id('snap'),
          createdAt: new Date(2000 + n, 0, 1),
        } as Tables['snapshots'][number];
        get().snapshots.push(row);
        return Promise.resolve(row);
      },
    },
    situationCluster: {
      create: (args: { data: Record<string, unknown> }) => {
        calls.push('situationCluster.create');
        if (
          get().clusters.some(
            (r) =>
              r.snapshotId === args.data.snapshotId && r.clusterKey === args.data.clusterKey,
          )
        ) {
          return Promise.reject(new Error('unique constraint: (snapshotId, clusterKey)'));
        }
        const row = { ...args.data, id: id('clu') } as Tables['clusters'][number];
        get().clusters.push(row);
        return Promise.resolve(row);
      },
    },
    situationClusterMember: {
      createMany: (args: { data: Array<{ clusterId: string; articleUrl: string }> }) => {
        calls.push('situationClusterMember.createMany');
        for (const e of args.data) {
          if (
            get().members.some((r) => r.clusterId === e.clusterId && r.articleUrl === e.articleUrl)
          ) {
            return Promise.reject(new Error('unique constraint: (clusterId, articleUrl)'));
          }
          get().members.push({ ...e, id: id('mem') });
        }
        return Promise.resolve({ count: args.data.length });
      },
    },
    situationShadowDecision: {
      create: (args: { data: Record<string, unknown> }) => {
        calls.push('situationShadowDecision.create');
        if (args.data.shadowOnly !== true) {
          return Promise.reject(new Error('check constraint: shadowOnly = true'));
        }
        const row = { ...args.data, id: id('sd') } as Tables['shadow'][number];
        get().shadow.push(row);
        return Promise.resolve(row);
      },
    },
  });

  const client = {
    ...delegatesFor(() => state.tables),
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      calls.push('$transaction');
      const staged = clone(state.tables);
      const result = await fn(delegatesFor(() => staged));
      state.tables = staged;
      return result;
    },
  };

  return {
    get tables(): Tables {
      return state.tables;
    },
    calls,
    client: client as unknown as PrismaService,
  };
}

const OBS: SituationObservation = {
  url: 'https://a.test/flood',
  title: 'Flooding displaces thousands in Rwanda',
  summary: 'Heavy rain has displaced thousands.',
  observedAt: new Date('2026-08-30T09:00:00.000Z'),
  countryCode: 'RW',
};

const IDENTITY: SituationIdentity = {
  partitionKey: 'sit:v1:RWA',
  keyVersion: 'v1',
  discriminator: 'd-flooding',
  discriminatorBasis: 'SEED_OBSERVATION_V1',
};

const T1 = new Date('2026-08-30T10:00:00.000Z');
const T2 = new Date('2026-08-31T10:00:00.000Z');

const record = (over: Partial<CompletedAnalysisRecord> = {}): CompletedAnalysisRecord => ({
  identity: IDENTITY,
  observation: OBS,
  analysedAt: T1,
  dimensions: { severity: 'HIGH', countryCode: 'RW' },
  clusters: [
    { clusterKey: 'cluster-a', publisherCount: 2, articleUrls: ['https://a.test/1', 'https://b.test/2'] },
  ],
  ...over,
});

const repo = (f: Fake): SituationRepository => new SituationRepository(f.client);

describe('S1-R2 — the partition key is NOT unique, and that is the correction', () => {
  it('THREE DISTINCT SITUATIONS COEXIST IN ONE BUCKET — S1 would have rejected the second', async () => {
    // G's contract: `sit:v1:RWA` holds every Rwandan situation, and six of G's
    // own fixtures share it while representing at least four distinct
    // situations. Under S1's `key @unique` the second insert below would have
    // been a constraint violation — a false merge manufactured by the schema.
    const fake = buildFake();
    const r = repo(fake);

    await r.appendCompletedAnalysis(record());
    await r.appendCompletedAnalysis(
      record({ identity: { ...IDENTITY, discriminator: 'd-inflation' }, analysedAt: T1 }),
    );
    await r.appendCompletedAnalysis(
      record({ identity: { ...IDENTITY, discriminator: 'd-corridor' }, analysedAt: T1 }),
    );

    expect(fake.tables.situations).toHaveLength(3);
    expect(new Set(fake.tables.situations.map((s) => s.partitionKey))).toEqual(
      new Set(['sit:v1:RWA']),
    );
  });

  it('the SAME triple is one situation — a second analysis appends to it', async () => {
    const fake = buildFake();
    const r = repo(fake);

    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.appendCompletedAnalysis(record({ analysedAt: T2 }));

    expect(fake.tables.situations).toHaveLength(1);
    expect(fake.tables.snapshots).toHaveLength(2);
  });

  it('the same discriminator under a DIFFERENT key version is a different situation', async () => {
    // G's invariant 3: a v1 situation must never be matched against a v2 key.
    const fake = buildFake();
    const r = repo(fake);

    await r.appendCompletedAnalysis(record());
    await r.appendCompletedAnalysis(record({ identity: { ...IDENTITY, keyVersion: 'v2' } }));

    expect(fake.tables.situations).toHaveLength(2);
  });

  it('persists the key version on every row, never assuming it', async () => {
    const fake = buildFake();
    await repo(fake).appendCompletedAnalysis(record());

    expect(fake.tables.situations[0].keyVersion).toBe('v1');
  });

  it('the bucket lookup filters on partition AND version, and is bounded by count', async () => {
    const fake = buildFake();
    const r = repo(fake);

    await r.appendCompletedAnalysis(record());
    await r.appendCompletedAnalysis(record({ identity: { ...IDENTITY, discriminator: 'd-2' } }));
    await r.appendCompletedAnalysis(record({ identity: { ...IDENTITY, keyVersion: 'v2' } }));

    const anchors = await r.loadBucketAnchors('sit:v1:RWA', 'v1');
    expect(anchors).toHaveLength(2);
    expect(await r.loadBucketAnchors('sit:v1:RWA', 'v1', 1)).toHaveLength(1);
    expect(await r.loadBucketAnchors('sit:v1:RWA', 'v2')).toHaveLength(1);
    expect(await r.loadBucketAnchors('sit:v1:COD', 'v1')).toHaveLength(0);
  });
});

describe('S1-R2 — the discriminator is assign-once', () => {
  it('is written on creation and NEVER included in an update', async () => {
    const fake = buildFake();
    const r = repo(fake);

    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.appendCompletedAnalysis(record({ analysedAt: T2 }));

    const updates = fake.calls.filter((c) => c === 'situation.update');
    expect(updates.length).toBeGreaterThan(0);
    // The fake rejects any update touching an identity column, so reaching
    // here at all proves none was attempted.
    expect(fake.tables.situations[0].discriminator).toBe('d-flooding');
    expect(fake.tables.situations[0].discriminatorBasis).toBe('SEED_OBSERVATION_V1');
  });

  it('the SEED is the opening observation, and a later analysis does not move it', async () => {
    const fake = buildFake();
    const r = repo(fake);

    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.appendCompletedAnalysis(
      record({
        analysedAt: T2,
        observation: { ...OBS, url: 'https://later.test/x', observedAt: T2 },
      }),
    );

    expect(fake.tables.situations[0].seedArticleUrl).toBe('https://a.test/flood');
    expect(fake.tables.situations[0].seedObservedAt).toEqual(OBS.observedAt);
  });

  it('firstObservedAt is set once and never moved', async () => {
    const fake = buildFake();
    const r = repo(fake);

    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.appendCompletedAnalysis(record({ analysedAt: T2 }));

    expect(fake.tables.situations[0].firstObservedAt).toEqual(T1);
  });

  it('rejects a blank, padded or over-long identity component rather than storing it', async () => {
    const fake = buildFake();
    const r = repo(fake);

    await expect(
      r.appendCompletedAnalysis(record({ identity: { ...IDENTITY, discriminator: '' } })),
    ).rejects.toThrow(InvalidSituationIdentityError);
    await expect(
      r.appendCompletedAnalysis(record({ identity: { ...IDENTITY, partitionKey: ' sit:v1:RWA ' } })),
    ).rejects.toThrow(InvalidSituationIdentityError);
    await expect(
      r.appendCompletedAnalysis(record({ identity: { ...IDENTITY, keyVersion: '' } })),
    ).rejects.toThrow(InvalidSituationIdentityError);
    // Nothing was written and no transaction was opened.
    expect(fake.calls).toEqual([]);
  });
});

describe('S1-R2 — the append is all-or-nothing', () => {
  it('writes situation, snapshot, cluster and members together', async () => {
    const fake = buildFake();
    const result = await repo(fake).appendCompletedAnalysis(record());

    expect(fake.tables.situations).toHaveLength(1);
    expect(fake.tables.snapshots).toHaveLength(1);
    expect(fake.tables.clusters).toHaveLength(1);
    expect(fake.tables.members).toHaveLength(2);
    expect(result.clustersWritten).toBe(1);
    expect(result.membersWritten).toBe(2);
  });

  it('every write happens INSIDE one transaction', async () => {
    const fake = buildFake();
    await repo(fake).appendCompletedAnalysis(record());

    expect(fake.calls[0]).toBe('$transaction');
    expect(fake.calls.filter((c) => c === '$transaction')).toHaveLength(1);
  });

  it('a failure part-way through leaves NOTHING behind — not a bare situation row', async () => {
    const fake = buildFake();
    const inner = fake.client as unknown as {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    };
    const failing = {
      ...(fake.client as unknown as Record<string, unknown>),
      $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
        inner.$transaction((tx) => {
          const t = tx as Record<string, unknown>;
          t.situationCluster = {
            create: () => Promise.reject(new Error('database went away mid-append')),
          };
          return fn(t);
        }),
    };

    await expect(
      new SituationRepository(failing as unknown as PrismaService).appendCompletedAnalysis(record()),
    ).rejects.toThrow('database went away mid-append');

    expect(fake.tables.situations).toHaveLength(0);
    expect(fake.tables.snapshots).toHaveLength(0);
    expect(fake.tables.clusters).toHaveLength(0);
    expect(fake.tables.members).toHaveLength(0);
  });
});

describe('S1-R2 — history is append-only and states stay honest', () => {
  it('never issues an update or delete against a snapshot, cluster or member', async () => {
    const fake = buildFake();
    const r = repo(fake);
    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.appendCompletedAnalysis(record({ analysedAt: T2 }));

    expect(
      fake.calls.filter((c) =>
        /^situation(Snapshot|Cluster|ClusterMember)\.(update|delete|deleteMany|upsert)/.test(c),
      ),
    ).toEqual([]);
  });

  it('the first snapshot is FIRST_OBSERVATION and stays so; the second carries the comparison', async () => {
    const fake = buildFake();
    const r = repo(fake);
    const first = await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    const second = await r.appendCompletedAnalysis(record({ analysedAt: T2 }));

    expect(first.state).toBe('FIRST_OBSERVATION');
    expect(second.state).toBe('STABLE');
    expect(fake.tables.snapshots[0].state).toBe('FIRST_OBSERVATION');
  });

  it('MORE COVERAGE IS NOT A CHANGE: extra articles with identical dimensions stay STABLE', async () => {
    const fake = buildFake();
    const r = repo(fake);
    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    const second = await r.appendCompletedAnalysis(
      record({
        analysedAt: T2,
        clusters: [
          {
            clusterKey: 'cluster-a',
            publisherCount: 40,
            articleUrls: ['https://a.test/1', 'https://b.test/2', 'https://c.test/3'],
          },
        ],
      }),
    );

    expect(second.state).toBe('STABLE');
    expect(second.membersWritten).toBe(3);
  });

  it('a changed dimension on the later analysis is MATERIAL_CHANGE', async () => {
    const fake = buildFake();
    const r = repo(fake);
    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    const second = await r.appendCompletedAnalysis(
      record({ analysedAt: T2, dimensions: { severity: 'CRITICAL', countryCode: 'RW' } }),
    );

    expect(second.state).toBe('MATERIAL_CHANGE');
  });
});

describe('S1-R2 — timestamp semantics', () => {
  it('a first completed analysis sets all three to the ANALYSIS time', async () => {
    const fake = buildFake();
    await repo(fake).appendCompletedAnalysis(record({ analysedAt: T1 }));

    const s = fake.tables.situations[0];
    expect(s.firstObservedAt).toEqual(T1);
    expect(s.lastRetrievedAt).toEqual(T1);
    expect(s.lastAnalysedAt).toEqual(T1);
  });

  it('a later analysis advances both last* columns', async () => {
    const fake = buildFake();
    const r = repo(fake);
    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.appendCompletedAnalysis(record({ analysedAt: T2 }));

    expect(fake.tables.situations[0].lastAnalysedAt).toEqual(T2);
    expect(fake.tables.situations[0].firstObservedAt).toEqual(T1);
  });

  it('RETRIEVAL IS NOT ANALYSIS: it moves lastRetrievedAt only', async () => {
    const fake = buildFake();
    const r = repo(fake);
    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.recordRetrieval(IDENTITY, T2);

    expect(fake.tables.situations[0].lastRetrievedAt).toEqual(T2);
    expect(fake.tables.situations[0].lastAnalysedAt).toEqual(T1);
  });

  it('a retrieval for an UNKNOWN situation creates nothing and says so', async () => {
    // S1 created a situation here. Under R2 that would be asserting a new
    // identity in a bucket, which is the tier-2 decision — so it refuses.
    const fake = buildFake();
    const result = await repo(fake).recordRetrieval(IDENTITY, T1);

    expect(result).toBeNull();
    expect(fake.tables.situations).toHaveLength(0);
  });

  it('a country a later analysis could not establish does NOT erase the one already known', async () => {
    const fake = buildFake();
    const r = repo(fake);
    await r.appendCompletedAnalysis(record({ analysedAt: T1 }));
    await r.appendCompletedAnalysis(
      record({ analysedAt: T2, observation: { ...OBS, countryCode: null } }),
    );

    expect(fake.tables.situations).toHaveLength(1);
    expect(fake.tables.situations[0].countryCode).toBe('RW');
  });
});

describe('S1-R2 — the optional AnalysisRun trace', () => {
  it('stores the id as a plain nullable pointer, or NULL when absent', async () => {
    const withId = buildFake();
    await repo(withId).appendCompletedAnalysis(record({ analysisRunId: 'run-abc' }));
    expect(withId.tables.snapshots[0].analysisRunId).toBe('run-abc');

    const without = buildFake();
    await repo(without).appendCompletedAnalysis(record());
    expect(without.tables.snapshots[0].analysisRunId).toBeNull();
  });
});

describe('S1-R2 — refuses unusable input at the door', () => {
  it('rejects a snapshot with no dimensions', async () => {
    const fake = buildFake();
    await expect(
      repo(fake).appendCompletedAnalysis(record({ dimensions: {} })),
    ).rejects.toThrow(InvalidSituationDimensionsError);
    expect(fake.calls).toEqual([]);
  });

  it('rejects PROSE in a dimension value', async () => {
    const fake = buildFake();
    await expect(
      repo(fake).appendCompletedAnalysis(record({ dimensions: { summary: 'x'.repeat(400) } })),
    ).rejects.toThrow(InvalidSituationDimensionsError);
  });

  it('rejects a duplicated cluster key before opening a transaction', async () => {
    const fake = buildFake();
    await expect(
      repo(fake).appendCompletedAnalysis(
        record({
          clusters: [
            { clusterKey: 'dup', publisherCount: 1, articleUrls: ['https://a.test/1'] },
            { clusterKey: 'dup', publisherCount: 1, articleUrls: ['https://b.test/2'] },
          ],
        }),
      ),
    ).rejects.toThrow(InvalidSituationClusterError);
    expect(fake.calls).toEqual([]);
  });

  it('stores memberCount as the number actually written, and publisherCount as supplied', async () => {
    const fake = buildFake();
    await repo(fake).appendCompletedAnalysis(
      record({
        clusters: [
          {
            clusterKey: 'c',
            publisherCount: 9,
            articleUrls: ['https://a.test/1', 'https://b.test/2', 'https://c.test/3'],
          },
        ],
      }),
    );

    expect(fake.tables.clusters[0].memberCount).toBe(3);
    expect(fake.tables.clusters[0].publisherCount).toBe(9);
  });
});

describe('S1-R2 — the Prisma port fails loudly rather than at 3am inside a write', () => {
  it('names the missing delegate when the generated client predates the migration', () => {
    const stale = {
      $transaction: () => Promise.resolve(),
      situation: { findUnique: () => null, findMany: () => [], create: () => null, update: () => null },
      situationSnapshot: { findFirst: () => null, create: () => null },
      situationCluster: { create: () => null },
      situationClusterMember: { createMany: () => null },
    };

    let message = '';
    try {
      asSituationPrismaPort(stale);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('situationShadowDecision');
    expect(message).toContain('prisma generate');
  });

  it('accepts a client carrying the whole surface', () => {
    expect(() => asSituationPrismaPort(buildFake().client)).not.toThrow();
  });

  it('rejects a client with no $transaction', () => {
    expect(() => asSituationPrismaPort({ situation: {} })).toThrow(SituationClientShapeError);
  });
});
