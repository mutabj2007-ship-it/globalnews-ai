import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspectMarketCapture, type MarketRetainedCapture } from './market-retained-capture';
import { MarketReadRepository } from './market-read.repository';
import { MarketRetainedProducer } from './market-retained.producer';
import type { PrismaService } from '../../database/prisma.service';
jest.mock('../../database/prisma.service', () => ({ PrismaService: class {} }));

// Synthetic, test-only Comext evidence. Never seeded or imported into a runtime.
function fixture(change: (body: any) => void = () => {}) {
  const request = {
    freq: 'M',
    reporter: 'PL',
    partner: 'DE',
    product: '01',
    flow: '1',
    indicators: 'VALUE_IN_EUROS',
  };
  const body: any = {
    class: 'dataset',
    version: '2.0',
    source: 'ESTAT',
    id: [...Object.keys(request), 'time'],
    size: [1, 1, 1, 1, 1, 1, 1],
    dimension: Object.fromEntries(
      Object.entries(request).map(([k, v]) => [k, { category: { index: { [v]: 0 } } }]),
    ),
    value: { '0': 12 },
    status: { '0': 'p' },
    extension: {
      id: 'DS-TEST',
      annotation: [
        { type: 'UNIT', title: 'EUR' },
        { type: 'UPDATE_DATA', date: '2026-09-01T00:00:00Z' },
      ],
    },
  };
  body.dimension.time = { category: { index: { '2026-08': 0 } } };
  change(body);
  const bytes = Buffer.from(JSON.stringify(body));
  const c: MarketRetainedCapture = {
    retrievalId: 'test-only',
    providerId: 'EUROSTAT',
    endpointId: 'DS-TEST',
    parameters: Object.entries(request).map(([key, value]) => ({ key, value })),
    requestedAt: new Date('2026-09-02'),
    retrievedAt: new Date('2026-09-02'),
    admissibility: 'ADMITTED',
    completeness: 'COMPLETE',
    httpStatus: 200,
    rightsGrade: 'E-5',
    rightsInstrumentRef: 'test-only-rights',
    payloadRetentionPermitted: true,
    contentAddress: createHash('sha256').update(bytes).digest('hex'),
    payload: { bytes, storageState: 'RETAINED', byteLength: bytes.length },
  };
  return c;
}
function row(c = fixture()) {
  const draft = inspectMarketCapture(c).observations[0];
  return {
    ...draft,
    id: 'row',
    publisherChangedAt: new Date(draft.publisherChangedAt!),
    providerId: 'EUROSTAT',
    subjectClass: 'CORRIDOR',
    snapshotAdmissibility: 'ADMITTED',
    snapshotContentAddress: c.contentAddress,
    snapshotRetrieval: c,
    ingestedAt: new Date('2026-09-03'),
    run: { providerId: 'EUROSTAT', subjectClass: 'CORRIDOR', outcome: 'SUCCEEDED' },
  };
}
function reader(rows: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  return {
    repo: new MarketReadRepository({ marketObservation: { findMany } } as unknown as PrismaService),
    findMany,
  };
}
describe('retained Market artifact validation', () => {
  it('inspects the artifact class, units, geography and publisher date', () => {
    const result = inspectMarketCapture(fixture());
    expect(result.sourceClass).toBe('STATISTICAL_RELEASE');
    expect(result.geography.reporter).toBe('PL');
    expect(result.observations[0]).toMatchObject({
      value: 12,
      unit: 'EUR',
      publisherChangedAt: '2026-09-01T00:00:00.000Z',
    });
  });
  it.each(['TED', 'GLEIF', 'UNKNOWN'])('rejects unsupported provider %s', (providerId) => {
    expect(() => inspectMarketCapture({ ...fixture(), providerId })).toThrow();
  });
  it.each([
    ['refused', (c: any): unknown => (c.admissibility = 'REFUSED')],
    ['incomplete', (c: any): unknown => (c.completeness = 'TRUNCATED')],
    ['rights', (c: any): unknown => (c.payloadRetentionPermitted = false)],
    ['digest', (c: any): unknown => (c.contentAddress = 'bad')],
    ['collected', (c: any): unknown => (c.payload.storageState = 'COLLECTED')],
    ['timestamps', (c: any): unknown => (c.requestedAt = new Date('2026-09-03'))],
    [
      'geography',
      (c: any): unknown => (c.parameters.find((p: any) => p.key === 'reporter').value = 'CH'),
    ],
    ['subject', (c: any): unknown => (c.parameters = [])],
  ] as const)('rejects %s', (_, mutate) => {
    const c = fixture();
    mutate(c);
    expect(() => inspectMarketCapture(c)).toThrow();
  });
  it.each([
    ['unit', (b: any): unknown => (b.extension.annotation[0].title = 'PUBLISHER_STATED')],
    ['date', (b: any): unknown => (b.extension.annotation[1].date = 'bad')],
    ['value', (b: any): unknown => (b.value[0] = '12')],
    ['endpoint', (b: any): unknown => (b.extension.id = 'OTHER')],
    ['dimension', (b: any): unknown => (b.dimension.reporter.category.index = { DE: 0 })],
    ['status', (b: any): unknown => (b.status = { 0: 'unknown' })],
  ] as const)('rejects malformed %s', (_, mutate) => {
    expect(() => inspectMarketCapture(fixture(mutate))).toThrow();
  });
});
describe('public retained reads', () => {
  it('returns evidence while acquisition remains off, without a fetch', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Forbidden network'));
    try {
      const { repo } = reader([row()]);
      expect(await repo.latest()).toEqual([
        expect.objectContaining({
          sourceClass: 'STATISTICAL_RELEASE',
          freshnessBasis: 'RETAINED_ONLY',
          retentionIsFinal: false,
        }),
      ]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it('keeps empty honest and bounds even non-finite limits', async () => {
    const { repo, findMany } = reader([]);
    expect(await repo.latest(NaN)).toEqual([]);
    expect(findMany.mock.calls[0][0].take).toBe(250);
  });
  it.each(['value', 'unit', 'subjectClass', 'providerId'])('rejects tampered %s', async (field) => {
    expect(await reader([{ ...row(), [field]: 'wrong' }]).repo.latest()).toEqual([]);
  });
  it('does not resurrect a superseded value behind a withdrawal', async () => {
    expect(await reader([{ ...row(), releaseStatus: 'WITHDRAWN' }, row()]).repo.latest()).toEqual(
      [],
    );
  });
  it('deduplicates retained revisions', async () => {
    expect(await reader([row(), row()]).repo.latest()).toHaveLength(1);
  });
  it('checks the read module has no producer registration', () => {
    expect(readFileSync(join(__dirname, 'market-read.module.ts'), 'utf8')).not.toMatch(
      /MarketRetainedProducer|MarketIngestScheduler|Adapter/,
    );
  });
});
describe('bounded offline producer', () => {
  it('defaults off before touching storage', async () => {
    await expect(
      new MarketRetainedProducer({} as PrismaService).admit('test-only', 'reviewer'),
    ).rejects.toThrow('approval');
  });
  it('writes the admitted retrieval reference and pins bytes in one serializable transaction', async () => {
    const c = fixture();
    const tx = {
      snapshotRetrieval: { findUnique: jest.fn().mockResolvedValue(c) },
      marketIngestRun: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'run' }),
        update: jest.fn(),
      },
      marketObservation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      snapshotPin: { upsert: jest.fn() },
    };
    const transaction = jest.fn().mockImplementation((fn) => fn(tx));
    const producer = new MarketRetainedProducer(
      { $transaction: transaction } as unknown as PrismaService,
      ['test-only'],
    );
    expect(await producer.admit('test-only', 'reviewer')).toBe(1);
    expect(tx.marketObservation.create.mock.calls[0][0].data).toMatchObject({
      snapshotRetrievalId: 'test-only',
      snapshotAdmissibility: 'ADMITTED',
      snapshotContentAddress: c.contentAddress,
    });
    expect(tx.snapshotPin.upsert).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    tx.marketIngestRun.findUnique.mockResolvedValue({ id: 'run' });
    expect(await producer.admit('test-only', 'reviewer')).toBe(0);
    expect(tx.marketObservation.create).toHaveBeenCalledTimes(1);
  });
});

it('never substitutes an older revision for broken capture provenance', async () => {
  const newest = row();
  newest.snapshotRetrieval.admissibility = 'REFUSED';
  expect(await reader([newest, row()]).repo.latest()).toEqual([]);
});
it('rejects a retained row whose ingest run claims another provider', async () => {
  const item = row();
  item.run.providerId = 'TED';
  expect(await reader([item]).repo.latest()).toEqual([]);
});
it('rejects duplicate JSON keys through the canonical strict parser', () => {
  const c = fixture();
  const bytes = Buffer.from(
    Buffer.from(c.payload!.bytes!)
      .toString()
      .replace('"value":{"0":12}', '"value":{"0":12,"0":13}'),
  );
  c.payload!.bytes = bytes;
  c.payload!.byteLength = bytes.length;
  c.contentAddress = createHash('sha256').update(bytes).digest('hex');
  expect(() => inspectMarketCapture(c)).toThrow('Malformed retained JSON');
});
it('keeps publisher revisions distinct without changing observation identity', () => {
  const first = inspectMarketCapture(fixture()).observations[0];
  const revision = inspectMarketCapture(
    fixture((b) => {
      b.extension.annotation[1].date = '2026-09-02T00:00:00Z';
      b.value[0] = 13;
    }),
  ).observations[0];
  expect(revision.observationKey).toBe(first.observationKey);
  expect(revision.publisherChangedAt).not.toBe(first.publisherChangedAt);
  expect(revision.value).toBe(13);
});
it('refuses conflicting values for the same publisher revision before any write', async () => {
  const tx = {
    snapshotRetrieval: { findUnique: async () => fixture() },
    marketIngestRun: { findUnique: async () => null, create: async () => ({ id: 'test' }) },
    marketObservation: {
      findUnique: async () => ({ value: 99, unit: 'EUR', providerId: 'EUROSTAT' }),
      create: jest.fn(),
    },
  };
  const producer = new MarketRetainedProducer(
    { $transaction: (fn: any) => fn(tx) } as unknown as PrismaService,
    ['test-only'],
  );
  await expect(producer.admit('test-only', 'reviewer')).rejects.toThrow('Conflicting');
  expect(tx.marketObservation.create).not.toHaveBeenCalled();
});

describe('R2 release status evidence', () => {
  it.each([
    undefined,
    null,
    {},
    { '0': '' },
    { '0': 'unknown' },
    { '0': 'f' },
    { '0': 'FINAL' },
    { '1': 'p' },
  ])('refuses absent or unsupported cell status %p instead of manufacturing FINAL', (status) => {
    expect(() =>
      inspectMarketCapture(
        fixture((b) => {
          b.status = status;
        }),
      ),
    ).toThrow('explicit release status');
  });
  it.each([
    ['p', 'PRELIMINARY'],
    ['r', 'REVISED'],
  ])('maps explicit %s to %s', (flag, expected) => {
    const result = inspectMarketCapture(
      fixture((b) => {
        b.status = { '0': flag };
      }),
    );
    expect(result.observations[0].releaseStatus).toBe(expected);
    expect(result.observations[0].releaseStatus).not.toBe('FINAL');
  });
  it('withholds a legacy FINAL row whose artifact has no status', async () => {
    const item = { ...row(), releaseStatus: 'FINAL' };
    const capture = fixture((b) => {
      delete b.status;
    });
    item.snapshotRetrieval = capture;
    item.snapshotContentAddress = capture.contentAddress;
    expect(await reader([item]).repo.latest()).toEqual([]);
  });
  it('withholds FINAL when the captured flag explicitly says preliminary', async () => {
    expect(await reader([{ ...row(), releaseStatus: 'FINAL' }]).repo.latest()).toEqual([]);
  });
  it('fails before run, observation or pin writes when a capture has no status', async () => {
    const write = jest.fn();
    const tx = {
      snapshotRetrieval: {
        findUnique: async () =>
          fixture((b) => {
            delete b.status;
          }),
      },
      marketIngestRun: { findUnique: write, create: write },
      marketObservation: { create: write },
      snapshotPin: { upsert: write },
    };
    const producer = new MarketRetainedProducer(
      { $transaction: (fn: any) => fn(tx) } as unknown as PrismaService,
      ['test-only'],
    );
    await expect(producer.admit('test-only', 'reviewer')).rejects.toThrow(
      'explicit release status',
    );
    expect(write).not.toHaveBeenCalled();
  });
});

it('refuses legacy FINAL on the same revision even when the value and unit match', async () => {
  const tx = {
    snapshotRetrieval: { findUnique: async () => fixture() },
    marketIngestRun: { findUnique: async () => null, create: async () => ({ id: 'test' }) },
    marketObservation: {
      findUnique: async () => ({
        value: 12,
        unit: 'EUR',
        providerId: 'EUROSTAT',
        releaseStatus: 'FINAL',
      }),
      create: jest.fn(),
    },
  };
  const producer = new MarketRetainedProducer(
    { $transaction: (fn: any) => fn(tx) } as unknown as PrismaService,
    ['test-only'],
  );
  await expect(producer.admit('test-only', 'reviewer')).rejects.toThrow('Conflicting');
  expect(tx.marketObservation.create).not.toHaveBeenCalled();
});
