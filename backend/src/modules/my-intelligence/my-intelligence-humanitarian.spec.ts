import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  domainObservationKey,
  humanitarianIdentity,
  type HumanitarianObservation,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import type { PrismaService } from '../../database/prisma.service';
import type { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import * as ruling from '../humanitarian/reader-clearance.ruling';
import { HumanitarianRetainedCorpus } from '../humanitarian/humanitarian-retained-corpus';
import { MyIntelligenceFeedService } from './my-intelligence-feed.service';
import { HUMANITARIAN_NEW_SINCE_MAX, humanitarianNewSince } from './my-intelligence-humanitarian';

/** Counterfactual reader clearance (test-only), so a refuse-forever path cannot pass. */
jest.mock('../humanitarian/reader-clearance.ruling', () => {
  const actual = jest.requireActual('../humanitarian/reader-clearance.ruling');
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
beforeEach(() => cleared.splice(0, cleared.length));

const BOUNDARY = '2026-09-20T00:00:00.000Z';
const BEFORE = '2026-09-19T00:00:00.000Z';
const AFTER = '2026-09-21T00:00:00.000Z';

function rec(
  id: string,
  o: {
    country?: string;
    revision?: number;
    provider?: string;
    geometry?: boolean;
    figure?: number;
  } = {},
): HumanitarianRetainedRecord {
  const provider = o.provider ?? 'GDACS';
  const identity = humanitarianIdentity(provider, id);
  const claim =
    o.figure === undefined
      ? {
          claimType: 'HUMANITARIAN_EVENT',
          hazardType: 'FLOOD',
          sourceNativeType: 'FL',
          sourceTitle: `Flood ${id}`,
          eventStatus: 'ONGOING',
          countryIso3: [o.country ?? 'SDN'],
          originatingAgency: 'GLOFAS',
          ...(o.geometry ? { geometryRecordKey: `geom-${id}` } : {}),
        }
      : {
          claimType: 'HUMANITARIAN_IMPACT_ASSERTION',
          measure: 'PEOPLE_DISPLACED',
          value: o.figure,
          unit: 'PERSONS',
          basis: 'SOURCE_STATED',
          sourceBasisStatement: 'The report states this figure.',
          aboutEventKey: domainObservationKey(humanitarianIdentity('GDACS', 'E')),
          countryIso3: [o.country ?? 'SDN'],
        };
  return {
    captureKey: `capture-${id}`,
    publisherReleasedAt: BEFORE,
    observation: {
      observationKey: domainObservationKey(identity),
      identity,
      observationKind: claim.claimType,
      subjectType: 'SOURCE_EVENT',
      subjectId: id,
      claim,
      temporal: {
        publisherVintage: BEFORE,
        retrievedAt: BEFORE,
        temporalBasis: 'PUBLISHER_VINTAGE',
      },
      provenance: {
        sourceType: 'PUBLIC_DATA',
        providerId: provider,
        institution: provider,
        retrievedAt: BEFORE,
      },
      sourceReference: { sourceUrl: `https://example.invalid/${id}` },
      attributeAuthorship:
        o.figure === undefined
          ? [{ attribute: 'hazardType', authorship: 'PUBLISHER_STATED' }]
          : [
              { attribute: 'value', authorship: 'PUBLISHER_STATED' },
              { attribute: 'measure', authorship: 'PUBLISHER_STATED' },
            ],
      revision: {
        revisionOrdinal: o.revision ?? 0,
        supersedesRevisionOrdinal: o.revision ? o.revision - 1 : null,
        recordedAt: BEFORE,
      },
    } as unknown as HumanitarianObservation,
  };
}

describe('My Intelligence · Humanitarian new since — lane A feed through My Intelligence rules', () => {
  it('REAL ruling (no source reader-cleared): a corpus holding followed records yields nothing', () => {
    const corpus = new HumanitarianRetainedCorpus();
    corpus.retain(rec('1'), AFTER);
    expect(humanitarianNewSince(corpus.changesSince(0), ['SDN'], BOUNDARY).items).toEqual([]);
  });

  describe('counterfactual: GDACS + RELIEFWEB reader-cleared', () => {
    beforeEach(() => cleared.push('GDACS', 'RELIEFWEB'));

    it('only followed countries, only first seen after the previous visit', () => {
      const corpus = new HumanitarianRetainedCorpus();
      corpus.retain(rec('old'), BEFORE);
      corpus.retain(rec('new'), AFTER);
      corpus.retain(rec('ken', { country: 'KEN' }), AFTER);
      const out = humanitarianNewSince(corpus.changesSince(0), ['SDN'], BOUNDARY);
      expect(out.items.map((i) => [i.title, i.change, i.countryIso3])).toEqual([
        ['Flood new', 'NEW', ['SDN']],
      ]);
    });
    it('no known previous visit ⇒ nothing is claimed new', () => {
      const corpus = new HumanitarianRetainedCorpus();
      corpus.retain(rec('new'), AFTER);
      expect(humanitarianNewSince(corpus.changesSince(0), ['SDN'], null).items).toEqual([]);
    });
    it('REVISED only on a higher revision; same-revision and older re-puts make no change', () => {
      const corpus = new HumanitarianRetainedCorpus();
      corpus.retain(rec('1'), BEFORE);
      corpus.retain(rec('1'), AFTER); /* same revision, later: NOT a change */
      expect(humanitarianNewSince(corpus.changesSince(0), ['SDN'], BOUNDARY).items).toEqual([]);
      corpus.retain(rec('1', { revision: 1 }), AFTER);
      corpus.retain(rec('1', { revision: 0 }), '2026-09-22T00:00:00.000Z'); /* older: ignored */
      const out = humanitarianNewSince(corpus.changesSince(0), ['SDN'], BOUNDARY);
      expect(out.items.map((i) => [i.change, i.firstSeenAt])).toEqual([['REVISED', AFTER]]);
    });
    it('a figure is carried verbatim; a record stating none carries null — never a zero', () => {
      const corpus = new HumanitarianRetainedCorpus();
      corpus.retain(rec('f', { provider: 'RELIEFWEB', figure: 1200 }), AFTER);
      corpus.retain(rec('e'), AFTER);
      const items = humanitarianNewSince(corpus.changesSince(0), ['SDN'], BOUNDARY).items;
      const byKey = Object.fromEntries(items.map((i) => [i.title ?? 'figure', i.figure]));
      expect(byKey.figure).toEqual({
        measure: 'PEOPLE_DISPLACED',
        value: 1200,
        unit: 'PERSONS',
        basis: 'SOURCE_STATED',
      });
      expect(byKey['Flood e']).toBeNull();
    });
    it('a reader-scoped row failing Main’s contract withholds the WHOLE page (never thinned)', () => {
      const corpus = new HumanitarianRetainedCorpus();
      corpus.retain(rec('ok'), AFTER);
      corpus.retain(rec('geo', { geometry: true }), AFTER);
      expect(humanitarianNewSince(corpus.changesSince(0), ['SDN'], BOUNDARY).items).toEqual([]);
    });
    it('eviction uncertainty stays explicit (gapPossible) and the list is bounded', () => {
      const corpus = new HumanitarianRetainedCorpus();
      for (let i = 0; i <= 200; i++) corpus.retain(rec(String(i)), AFTER);
      const out = humanitarianNewSince(corpus.changesSince(0), ['SDN'], BOUNDARY);
      expect(out.gapPossible).toBe(true);
      expect(out.items).toHaveLength(HUMANITARIAN_NEW_SINCE_MAX);
    });
    it('the feed service carries the role from the SAME corpus, beside the stories', async () => {
      const corpus = new HumanitarianRetainedCorpus();
      corpus.retain(rec('new'), AFTER);
      const prisma = {
        user: { findUnique: jest.fn(async () => ({ visitBoundaryAt: new Date(BOUNDARY) })) },
        countryFollow: { findMany: jest.fn(async () => [{ countryCode: 'SDN' }]) },
      } as unknown as PrismaService;
      const persistence = {
        findRecentByCountry: jest.fn(async () => []),
      } as unknown as ArticlePersistenceService;
      const response = await new MyIntelligenceFeedService(prisma, persistence, corpus).feed('u');
      expect(response.humanitarian?.items.map((i) => i.title)).toEqual(['Flood new']);
      expect(response.source).toBe('retained');
      const without = await new MyIntelligenceFeedService(prisma, persistence).feed('u');
      expect('humanitarian' in without).toBe(false);
    });
  });

  it('structure: no fetch, no model, no notification or Watch path', () => {
    const src = readFileSync(join(__dirname, 'my-intelligence-humanitarian.ts'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(src).not.toMatch(/fetch\(|async\s|await\s|openai|anthropic|notif|watch|Prisma/i);
  });
});
