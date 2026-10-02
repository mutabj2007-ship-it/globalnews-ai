import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { HumanitarianRetainedRecord } from '@globalnews-ai/shared';
import type { PrismaService } from '../../database/prisma.service';
import type { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { MyIntelligenceFeedService } from '../my-intelligence/my-intelligence-feed.service';
import * as ruling from './reader-clearance.ruling';
import { HumanitarianReadController, HumanitarianReadModule } from './humanitarian-read.module';
import { HumanitarianRetainedCorpus } from './humanitarian-retained-corpus';

/**
 * CROSS-SURFACE PROOF (backend half). ONE fixture of Main's canonical records
 * (qualification/humanitarian/cross-surface/records.json — the frontend half reads the same file)
 * enters the ONE corpus once and reaches both reader paths without duplication:
 *
 *   corpus → GET /humanitarian/observations (+ /reader-ruling) → [frontend: G gate → H brief → Home]
 *   corpus → lane A delta feed → My Intelligence feed role
 *
 * and neither path fetches a source, runs a model, exposes protected/internal evidence, turns a
 * missing figure into zero, or presents a retained record as current.
 */
jest.mock('./reader-clearance.ruling', () => {
  const actual = jest.requireActual('./reader-clearance.ruling');
  const cleared: string[] = [];
  return {
    ...actual,
    READER_CLEARED_SOURCE_IDS: cleared,
    sourceIsReaderCleared: (id: string) => cleared.includes(id),
    readerAdmissionFromRuling:
      () => (r: { observation?: { identity?: { upstreamAuthority?: unknown } } }) =>
        cleared.includes(String(r?.observation?.identity?.upstreamAuthority)),
  };
});
const cleared = ruling.READER_CLEARED_SOURCE_IDS as string[];

const FIXTURE = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../qualification/humanitarian/cross-surface/records.json'),
    'utf8',
  ),
) as {
  firstSeenAt: string;
  previousVisit: string;
  followed: string[];
  records: HumanitarianRetainedRecord[];
};
const KEYS = FIXTURE.records.map((r) => r.observation.observationKey).sort();

async function harness() {
  const module = await Test.createTestingModule({ imports: [HumanitarianReadModule] }).compile();
  const app = module.createNestApplication();
  await app.init();
  const corpus = module.get(HumanitarianRetainedCorpus);
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({ visitBoundaryAt: new Date(FIXTURE.previousVisit) })),
    },
    countryFollow: {
      findMany: jest.fn(async () => FIXTURE.followed.map((countryCode) => ({ countryCode }))),
    },
  } as unknown as PrismaService;
  const persistence = {
    findRecentByCountry: jest.fn(async () => []),
  } as unknown as ArticlePersistenceService;
  return { module, app, corpus, mi: new MyIntelligenceFeedService(prisma, persistence, corpus) };
}

describe('cross-surface — one retained corpus → Home read and My Intelligence delta', () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    cleared.splice(0, cleared.length);
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('no source fetch, ever'));
  });
  afterEach(() => fetchSpy.mockRestore());

  it('ONE instance: the read controller and My Intelligence see the same corpus object', async () => {
    const { module, app, corpus } = await harness();
    try {
      expect(
        (module.get(HumanitarianReadController) as unknown as { corpus: unknown }).corpus,
      ).toBe(corpus);
    } finally {
      await app.close();
    }
  });

  it('REAL ruling: the same records reach NEITHER surface', async () => {
    const { app, corpus, mi } = await harness();
    try {
      for (const r of FIXTURE.records) corpus.retain(r, FIXTURE.firstSeenAt);
      const read = await request(app.getHttpServer()).get('/humanitarian/observations').expect(200);
      expect(read.body).toEqual({ kind: 'UNAVAILABLE', absence: 'NOT_ASSESSED', observations: [] });
      expect((await mi.feed('u')).humanitarian?.items).toEqual([]);
    } finally {
      await app.close();
    }
  });

  describe('counterfactual ruling (both sources reader-cleared, test only)', () => {
    beforeEach(() => cleared.push('GDACS', 'RELIEFWEB'));

    it('the same observations flow to both paths, once, unduplicated', async () => {
      const { app, corpus, mi } = await harness();
      try {
        for (const r of FIXTURE.records) corpus.retain(r, FIXTURE.firstSeenAt);
        expect(corpus.size).toBe(FIXTURE.records.length);

        const read = await request(app.getHttpServer())
          .get('/humanitarian/observations')
          .expect(200);
        expect(read.headers['cache-control']).toBe('no-store');
        expect(read.body.kind).toBe('RETAINED');
        expect(read.body.observations).toEqual(
          expect.arrayContaining(
            FIXTURE.records.map((r) => expect.objectContaining({ observation: r.observation })),
          ),
        );
        const ruled = await request(app.getHttpServer())
          .get('/humanitarian/reader-ruling')
          .expect(200);
        expect(ruled.body.requiredDisclosures).toEqual([
          ...ruling.HUMANITARIAN_REQUIRED_DISCLOSURES,
        ]);
        expect(ruled.body.relayAttributedSourceIds).toEqual(['GDACS']);

        const feed = await mi.feed('u');
        const items = feed.humanitarian!.items;
        expect(items.map((i) => i.observationKey).sort()).toEqual(KEYS);
        expect(
          items.every((i) => i.change === 'NEW' && i.firstSeenAt === FIXTURE.firstSeenAt),
        ).toBe(true);
        expect(feed.source).toBe('retained');
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it('MISSING IMPACT IS NEVER ZERO: the event carries no figure; the assertion carries its own', async () => {
      const { app, corpus, mi } = await harness();
      try {
        for (const r of FIXTURE.records) corpus.retain(r, FIXTURE.firstSeenAt);
        const items = (await mi.feed('u')).humanitarian!.items;
        const event = items.find((i) => i.title !== null)!;
        const figure = items.find((i) => i.figure !== null)!;
        expect(event.figure).toBeNull();
        expect(figure.figure).toEqual({
          measure: 'PEOPLE_DISPLACED',
          value: 1200,
          unit: 'PERSONS',
          basis: 'SOURCE_STATED',
        });
      } finally {
        await app.close();
      }
    });

    it('PROTECTED/INTERNAL never reaches a reader: a governed-geometry row withholds BOTH paths whole', async () => {
      const { app, corpus, mi } = await harness();
      try {
        for (const r of FIXTURE.records) corpus.retain(r, FIXTURE.firstSeenAt);
        const withGeometry = JSON.parse(
          JSON.stringify(FIXTURE.records[0]),
        ) as HumanitarianRetainedRecord;
        (withGeometry.observation.claim as { geometryRecordKey?: string }).geometryRecordKey =
          'geom-PROTECTED';
        (withGeometry.observation.revision as { revisionOrdinal: number }).revisionOrdinal = 1;
        (
          withGeometry.observation.revision as { supersedesRevisionOrdinal: number | null }
        ).supersedesRevisionOrdinal = 0;
        corpus.retain(withGeometry, FIXTURE.firstSeenAt);
        const read = await request(app.getHttpServer())
          .get('/humanitarian/observations')
          .expect(200);
        expect(read.body).toEqual({
          kind: 'UNAVAILABLE',
          absence: 'COVERAGE_GAP',
          observations: [],
        });
        const feed = await mi.feed('u');
        expect(feed.humanitarian?.items).toEqual([]);
        expect(JSON.stringify(read.body) + JSON.stringify(feed)).not.toContain('geom-PROTECTED');
      } finally {
        await app.close();
      }
    });
  });

  it('neither path has a model, provider or writer reachable from it', () => {
    for (const f of [
      'humanitarian-retained-corpus.ts',
      'humanitarian-read.module.ts',
      '../my-intelligence/my-intelligence-humanitarian.ts',
    ]) {
      const src = readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect({
        f,
        hit: /fetch\(|HttpService|analyzeNews|openai|anthropic|producers\/|@Cron|setInterval/i.test(
          src,
        ),
      }).toEqual({ f, hit: false });
    }
  });
});
