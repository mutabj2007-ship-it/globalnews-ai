import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { accountSourceCoverage, loadSourcePacks } from '@globalnews-ai/shared';
import type {
  CountrySourcePack,
  GovernedSourceRegion,
  SourcePackEntry,
} from '@globalnews-ai/shared';
import { GlobalReachService } from './global-reach.service';
import { GlobalReachAcquisitionService } from './global-reach-acquisition.service';
import { GlobalReachModule } from './global-reach.module';
import { GLOBAL_REACH_REGIONS } from './source-pack.registry';
import { AdminGlobalReachController } from '../admin/admin-global-reach.controller';
import { AdminPlatformEnabledGuard } from '../admin/admin-platform.guard';
import { AdminGuard } from '../admin/admin.guard';
import { RequireAuthGuard } from '../auth/require-auth.guard';

const regions: readonly GovernedSourceRegion[] = [
  { id: 'test-region', members: ['POL', 'RWA'], provenanceNote: 'Test membership only' },
];
function source(overrides: Partial<SourcePackEntry> = {}): SourcePackEntry {
  return {
    sourceId: 'fixture:publisher',
    publisherName: 'Fixture Publisher',
    iso2: 'PL',
    iso3: 'POL',
    governedRegion: 'test-region',
    canonicalHost: 'publisher.example',
    transport: 'RSS',
    endpoint: 'https://publisher.example/feed',
    sourceClass: 'NEWS_PROVIDER',
    languages: ['pl'],
    basis: 'LOCAL',
    rights: {
      standing: 'PERMITTED',
      binding: { rightsAuthorityId: 'fixture', rightsRecordKey: 'fixture' },
      usageNote: 'Fixture permission only',
    },
    verifiedAt: '2026-09-01',
    captureCapability: 'METADATA_ONLY',
    activationStatus: 'ACTIVE',
    failureReason: null,
    provenanceNote: 'Test fixture, never activate in production',
    health: {
      status: 'HEALTHY',
      lastAttemptAt: '2026-09-01',
      lastSuccessAt: '2026-09-01',
      consecutiveFailures: 0,
      failureReason: null,
    },
    ...overrides,
  };
}
function pack(entries: readonly SourcePackEntry[] = [source()]): CountrySourcePack {
  return {
    schemaVersion: 1,
    iso2: 'PL',
    iso3: 'POL',
    governedRegion: 'test-region',
    verifiedAt: '2026-09-01',
    gapReason: null,
    provenanceNote: 'Fixture country pack',
    entries,
  };
}
function reach(entries: readonly SourcePackEntry[] = [source()]) {
  return new GlobalReachService({ regions, packs: [pack(entries)] });
}

describe('Global Reach schema and coverage authority', () => {
  it('shares publisher references across overlapping regions independent of JSON key order', () => {
    const secondRegion = { ...regions[0], id: 'overlap' };
    const secondSource = Object.fromEntries(
      Object.entries({ ...source(), governedRegion: 'overlap' }).reverse(),
    );
    const secondPack = { ...pack(), governedRegion: 'overlap', entries: [secondSource] };
    expect(loadSourcePacks([pack(), secondPack], [...regions, secondRegion])).toHaveLength(2);
    expect(() =>
      loadSourcePacks(
        [
          pack(),
          { ...secondPack, entries: [{ ...secondSource, publisherName: 'Conflicting identity' }] },
        ],
        [...regions, secondRegion],
      ),
    ).toThrow();
  });
  it('loads JSON into immutable detached authority', () => {
    const original = [pack()];
    const result = loadSourcePacks(JSON.stringify(original), regions);
    expect(result).toEqual(original);
    expect(Object.isFrozen(result[0].entries[0].health)).toBe(true);
  });
  it.each([
    ['ISO mismatch', { iso2: 'RW' }],
    ['noncanonical code', { iso3: 'pol' }],
    ['ungoverned region', { governedRegion: 'elsewhere' }],
    ['schema version', { schemaVersion: 2 }],
    ['missing provenance', { provenanceNote: '' }],
    ['invalid date', { verifiedAt: '2026-02-30' }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => loadSourcePacks([{ ...pack(), ...overrides }], regions)).toThrow();
  });
  it.each([
    { endpoint: 'http://publisher.example/feed' },
    { endpoint: 'https://other.example/feed' },
    { endpoint: 'https://user:password@publisher.example/feed' },
    { transport: 'FETCH' },
    { languages: ['not_a_language'] },
    { languages: ['pl', 'pl'] },
    { canonicalHost: 'https://publisher.example' },
    { rights: { standing: 'PERMITTED', binding: null, usageNote: 'Not a grant' } },
    {
      health: {
        status: 'HEALTHY',
        lastAttemptAt: null,
        lastSuccessAt: null,
        consecutiveFailures: 0,
        failureReason: null,
      },
    },
    { activationStatus: 'BLOCKED', failureReason: null },
    { basis: 'PROVIDER' },
  ])('rejects malformed entry %j', (overrides) => {
    expect(() =>
      loadSourcePacks([pack([{ ...source(), ...overrides } as SourcePackEntry])], regions),
    ).toThrow();
  });
  it('rejects duplicate packs, source IDs, host aliases and normalized publisher names', () => {
    expect(() => loadSourcePacks([pack(), pack()], regions)).toThrow();
    expect(() => loadSourcePacks([pack([source(), source()])], regions)).toThrow();
    expect(() =>
      loadSourcePacks(
        [
          pack([
            source(),
            source({ sourceId: 'fixture:second', canonicalHost: 'www.publisher.example' }),
          ]),
        ],
        regions,
      ),
    ).toThrow();
    expect(() =>
      loadSourcePacks(
        [
          pack([
            source(),
            source({
              sourceId: 'fixture:second',
              canonicalHost: 'other.example',
              endpoint: 'https://other.example/feed',
              publisherName: 'Fixture-Publisher',
            }),
          ]),
        ],
        regions,
      ),
    ).toThrow();
  });
  it('accounts for every member and never substitutes international sources', () => {
    expect(
      reach()
        .coverage()
        .map((r) => r.state),
    ).toEqual(['VALIDATED_LOCAL_BASELINE', 'COVERAGE_GAP']);
    expect(reach([source({ basis: 'INTERNATIONAL' })]).coverage()[0]).toMatchObject({
      state: 'COVERAGE_GAP',
      internationalPublisherCount: 1,
      localPublisherCount: 0,
      languages: [],
    });
    expect(reach([source({ verifiedAt: null })]).coverage()[0].state).toBe('UNVERIFIED');
    expect(reach([source({ captureCapability: 'UNKNOWN' })]).coverage()[0].state).toBe('PARTIAL');
    expect(reach([source({ activationStatus: 'DISABLED' })]).coverage()[0].state).toBe(
      'VALIDATED_LOCAL_BASELINE',
    );
  });
  it('fails closed on malformed governed membership and unknown countries', () => {
    expect(() => loadSourcePacks([], [{ ...regions[0], members: ['XXX'] }])).toThrow();
    expect(() => loadSourcePacks([], [regions[0], regions[0]])).toThrow();
  });
  it('reports all installed members as gaps with no regional manifests populated', () => {
    const packs = loadSourcePacks([], GLOBAL_REACH_REGIONS);
    const rows = accountSourceCoverage(GLOBAL_REACH_REGIONS, packs);
    expect(rows.length).toBe(GLOBAL_REACH_REGIONS.reduce((n, r) => n + r.members.length, 0));
    expect(rows.every((r) => r.state === 'COVERAGE_GAP' && r.gapReason)).toBe(true);
  });
});

describe('retained-first acquisition gates', () => {
  const port = () => ({
    readRetained: jest.fn().mockResolvedValue([]),
    resolveRights: jest.fn().mockReturnValue({
      rightsRecordKey: 'fixture',
      rightsClass: 'E-5',
      instrument: 'Fixture licence',
      productConditions: [],
      publisherRetainsHistory: false,
    }),
    acquireAndRetain: jest.fn().mockResolvedValue([{ id: 'fixture-article' }]),
  });
  const worker = (config = {}, entries = [source()]) =>
    new GlobalReachAcquisitionService(new ConfigService(config), reach(entries));
  const enabled = {
    GLOBAL_REACH_ACQUISITION_ACTIVE: 'true',
    GLOBAL_REACH_SOURCE_ALLOWLIST: 'fixture:publisher',
  };
  it('reads retained evidence first even while acquisition is disabled', async () => {
    const p = port();
    p.readRetained.mockResolvedValue([{ id: 'retained' }]);
    expect(
      await worker().acquireForWorker('fixture:publisher', 'SCHEDULED_WORKER', p),
    ).toMatchObject({ origin: 'RETAINED' });
    expect(p.acquireAndRetain).not.toHaveBeenCalled();
    expect(p.resolveRights).not.toHaveBeenCalled();
  });
  it.each([undefined, 'false', 'TRUE', '1', true])(
    'is disabled unless flag is exactly true text: %s',
    async (flag) => {
      const p = port();
      expect(
        await worker({ ...enabled, GLOBAL_REACH_ACQUISITION_ACTIVE: flag }).acquireForWorker(
          'fixture:publisher',
          'SCHEDULED_WORKER',
          p,
        ),
      ).toMatchObject({ reason: 'ACQUISITION_DISABLED' });
      expect(p.acquireAndRetain).not.toHaveBeenCalled();
    },
  );
  it.each(['', '*', 'fixture:other'])(
    'requires an exact source allowlist: %s',
    async (allowlist) => {
      const p = port();
      expect(
        await worker({ ...enabled, GLOBAL_REACH_SOURCE_ALLOWLIST: allowlist }).acquireForWorker(
          'fixture:publisher',
          'EXPLICIT_OPERATOR',
          p,
        ),
      ).toMatchObject({ reason: 'SOURCE_NOT_ALLOWLISTED' });
      expect(p.acquireAndRetain).not.toHaveBeenCalled();
    },
  );
  it.each(['CATEGORY_CLICK', 'MAP_CLICK', 'ASK_OPEN'])(
    'refuses product triggers: %s',
    async (trigger) => {
      const p = port();
      expect(
        await worker(enabled).acquireForWorker(
          'fixture:publisher',
          trigger as 'SCHEDULED_WORKER',
          p,
        ),
      ).toMatchObject({ reason: 'INVALID_TRIGGER' });
      expect(p.acquireAndRetain).not.toHaveBeenCalled();
    },
  );
  it('requires resolved rights and never treats an international source as a local fallback', async () => {
    const p = port();
    p.resolveRights.mockReturnValue(null);
    expect(
      await worker(enabled).acquireForWorker('fixture:publisher', 'SCHEDULED_WORKER', p),
    ).toMatchObject({ reason: 'RIGHTS_NOT_PERMITTED' });
    expect(
      await worker(enabled, [source({ basis: 'INTERNATIONAL' })]).acquireForWorker(
        'fixture:publisher',
        'SCHEDULED_WORKER',
        p,
      ),
    ).toMatchObject({ reason: 'SOURCE_NOT_READY' });
    expect(p.acquireAndRetain).not.toHaveBeenCalled();
  });
  it('invokes the governed adapter only after every gate passes', async () => {
    const p = port();
    expect(
      await worker(enabled).acquireForWorker('fixture:publisher', 'SCHEDULED_WORKER', p),
    ).toMatchObject({ origin: 'ACQUIRED' });
    expect(p.acquireAndRetain).toHaveBeenCalledTimes(1);
    expect(p.acquireAndRetain).toHaveBeenCalledWith(source());
  });
});

describe('Admin Global Reach HTTP projections', () => {
  it('has no worker invocation in any product route or UI source', () => {
    const root = join(__dirname, '../../../..');
    function calls(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'generated' ? [] : calls(path);
        return /\.tsx?$/.test(entry.name) &&
          !entry.name.endsWith('.spec.ts') &&
          /\.acquireForWorker\s*\(/.test(readFileSync(path, 'utf8'))
          ? [path]
          : [];
      });
    }
    expect([...calls(join(root, 'frontend/src')), ...calls(join(root, 'backend/src'))]).toEqual([]);
  });
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [GlobalReachModule],
      controllers: [AdminGlobalReachController],
    })
      .overrideGuard(AdminPlatformEnabledGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequireAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('serves every endpoint with zero acquisition/provider calls', async () => {
    const acquire = jest.spyOn(app.get(GlobalReachAcquisitionService), 'acquireForWorker');
    const fetch = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network forbidden'));
    try {
      for (const route of [
        'summary',
        'countries-governed',
        'validated-local-baseline',
        'countries-partial',
        'coverage-gaps',
        'unverified',
        'publishers-by-country',
        'language-coverage',
        'last-verification',
      ]) {
        await request(app.getHttpServer()).get(`/admin/global-reach/${route}`).expect(200);
      }
      expect(acquire).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      acquire.mockRestore();
      fetch.mockRestore();
    }
  });
});
