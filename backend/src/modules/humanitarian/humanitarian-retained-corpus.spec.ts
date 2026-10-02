import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  domainObservationKey,
  humanitarianIdentity,
  type HumanitarianObservation,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import * as ruling from './reader-clearance.ruling';
import {
  HUMANITARIAN_CORPUS_CAPACITY,
  HumanitarianRetainedCorpus,
} from './humanitarian-retained-corpus';

/**
 * THE ONE RUNTIME RETAINED CORPUS. The real ruling clears no source; a counterfactual ruling
 * (a mutable reader-cleared list, test-only) proves the corpus can serve, so a corpus that
 * refuses forever cannot pass.
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
beforeEach(() => cleared.splice(0, cleared.length));

const AT = '2026-09-20T06:00:00Z';
function record(
  id: string,
  o: { provider?: string; revision?: number; geometry?: boolean; country?: string } = {},
): HumanitarianRetainedRecord {
  const provider = o.provider ?? 'GDACS';
  const identity = humanitarianIdentity(provider, id);
  return {
    captureKey: `capture-${id}-${o.revision ?? 0}`,
    publisherReleasedAt: AT,
    observation: {
      observationKey: domainObservationKey(identity),
      identity,
      observationKind: 'HUMANITARIAN_EVENT',
      subjectType: 'SOURCE_EVENT',
      subjectId: id,
      claim: {
        claimType: 'HUMANITARIAN_EVENT',
        hazardType: 'FLOOD',
        sourceNativeType: 'FL',
        sourceTitle: `Flood ${id}`,
        eventStatus: 'ONGOING',
        countryIso3: [o.country ?? 'SDN'],
        originatingAgency: 'GLOFAS',
        ...(o.geometry ? { geometryRecordKey: `geom-${id}` } : {}),
      },
      temporal: { publisherVintage: AT, retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' },
      provenance: {
        sourceType: 'PUBLIC_DATA',
        providerId: provider,
        institution: provider,
        retrievedAt: AT,
        evidenceRole: 'PRIMARY_RECORD',
      },
      sourceReference: { sourceUrl: `https://example.invalid/${id}` },
      attributeAuthorship: [{ attribute: 'hazardType', authorship: 'PUBLISHER_STATED' }],
      revision: {
        revisionOrdinal: o.revision ?? 0,
        supersedesRevisionOrdinal: o.revision ? o.revision - 1 : null,
        recordedAt: AT,
      },
    } as unknown as HumanitarianObservation,
  };
}

describe('the one retained corpus — the REAL ruling (no source reader-cleared)', () => {
  it('an empty corpus reads NOT_ASSESSED (no approved reader), never "nothing happened"', () => {
    const corpus = new HumanitarianRetainedCorpus();
    expect(corpus.readerRead()).toEqual({
      kind: 'UNAVAILABLE',
      absence: 'NOT_ASSESSED',
      observations: [],
    });
    expect(corpus.changesSince(0).changes).toEqual([]);
  });
  it('a corpus HOLDING records still exposes none of them to a reader', () => {
    const corpus = new HumanitarianRetainedCorpus();
    corpus.retain(record('1'), AT);
    expect(corpus.size).toBe(1);
    expect(corpus.readerRead().kind).toBe('UNAVAILABLE');
    expect(corpus.changesSince(0)).toMatchObject({
      changes: [],
      readerRefused: false,
      nextSinceSequence: 1,
    });
  });
});

describe('the one retained corpus — counterfactual ruling (GDACS reader-cleared, test only)', () => {
  beforeEach(() => cleared.push('GDACS'));

  it('an empty corpus under a cleared source is the store state NO_RETAINED_EVIDENCE', () => {
    expect(new HumanitarianRetainedCorpus().readerRead().kind).toBe('NO_RETAINED_EVIDENCE');
  });
  it('reads only E1-cleared sources; a cleared source serves its records', () => {
    const corpus = new HumanitarianRetainedCorpus();
    corpus.retain(record('1'), AT);
    corpus.retain(record('2', { provider: 'COPERNICUS_EMS' }), AT);
    const read = corpus.readerRead();
    expect(read.kind).toBe('RETAINED');
    expect(read.observations.map((r) => r.observation.identity.upstreamAuthority)).toEqual([
      'GDACS',
    ]);
  });
  it('a reader-scoped row failing Main’s contract refuses the WHOLE read (lossy coverage gap)', () => {
    const corpus = new HumanitarianRetainedCorpus();
    corpus.retain(record('1'), AT);
    corpus.retain(record('9', { geometry: true }), AT);
    expect(corpus.readerRead()).toEqual({
      kind: 'UNAVAILABLE',
      absence: 'COVERAGE_GAP',
      observations: [],
    });
    expect(corpus.changesSince(0)).toMatchObject({ changes: [], readerRefused: true });
  });
  it('the delta feed: NEW, then REVISED on a higher revision; no change for a same or older revision', () => {
    const corpus = new HumanitarianRetainedCorpus();
    corpus.retain(record('1'), '2026-09-21T00:00:00Z');
    const first = corpus.changesSince(0);
    expect(first.changes.map((c) => [c.change, c.firstSeenAt])).toEqual([
      ['NEW', '2026-09-21T00:00:00Z'],
    ]);
    corpus.retain(record('1'), '2026-09-22T00:00:00Z');
    expect(corpus.changesSince(first.nextSinceSequence).changes).toEqual([]);
    corpus.retain(record('1', { revision: 1 }), '2026-09-23T00:00:00Z');
    const revised = corpus.changesSince(first.nextSinceSequence);
    expect(
      revised.changes.map((c) => [c.change, c.record.observation.revision.revisionOrdinal]),
    ).toEqual([['REVISED', 1]]);
    corpus.retain(record('1', { revision: 0 }), '2026-09-24T00:00:00Z');
    expect(corpus.changesSince(revised.nextSinceSequence).changes).toEqual([]);
    expect(corpus.readerRead().observations[0]!.observation.revision.revisionOrdinal).toBe(1);
  });
  it('is bounded; an eviction before a reader looked is reported as gapPossible', () => {
    const corpus = new HumanitarianRetainedCorpus();
    for (let i = 0; i <= HUMANITARIAN_CORPUS_CAPACITY; i++) corpus.retain(record(String(i)), AT);
    expect(corpus.size).toBe(HUMANITARIAN_CORPUS_CAPACITY);
    expect(corpus.changesSince(0).gapPossible).toBe(true);
    expect(corpus.readerRead().observations).toHaveLength(HUMANITARIAN_CORPUS_CAPACITY);
  });
});

describe('the one retained corpus — structure', () => {
  it('fetches nothing, imports no producer, and has NO production writer today', () => {
    const src = readFileSync(join(__dirname, 'humanitarian-retained-corpus.ts'), 'utf8');
    expect(src).not.toMatch(/fetch\(|HttpService|Prisma|producers\/|async\s|await\s/);
    const root = join(__dirname, '../..');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          path.endsWith('.ts') &&
          !path.endsWith('.spec.ts') &&
          !path.endsWith('humanitarian-retained-corpus.ts')
        ) {
          if (
            /\.retain\(/.test(readFileSync(path, 'utf8')) &&
            /HumanitarianRetainedCorpus/.test(readFileSync(path, 'utf8'))
          )
            offenders.push(path);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
