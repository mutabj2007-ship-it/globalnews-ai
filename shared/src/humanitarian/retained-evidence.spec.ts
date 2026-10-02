import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { domainObservationKey } from '../observation/domain-observation';
import { humanitarianIdentity, type HumanitarianObservation } from './observation';
import type { HumanitarianRetainedRecord } from './retained-read';
import {
  MAX_RETAINED_CHANGE_FEED_PAGE,
  RETAINED_FACT_STATUSES,
  RetainedEvidenceCache,
  retainedChangeFeedSince,
  assertRetainedFactStatusIsKnown,
  dedupeRetainedEvidence,
  deriveRetainedFactStatus,
  normalizeRetainedEvidence,
  normalizeSourceUrlForMatching,
  projectCitation,
  readerFactStatus,
  type FactAvailability,
} from './retained-evidence';

/**
 * Lane A's retained-evidence behaviour (086db67), proven ON MAIN'S RECORD after convergence.
 * A's cases are kept (renamed where Main's identity spine changes the axis); the Main-specific
 * cases are marked MAIN.
 */

const T0 = '2026-09-30T00:00:00Z';
const T1 = '2026-10-01T00:00:00Z';

function row(o: {
  provider?: string;
  id: string;
  kind?: 'HUMANITARIAN_EVENT' | 'HUMANITARIAN_REPORT';
  url?: string;
  retrievedAt?: string;
  revision?: number;
  citation?: string;
  language?: string;
  vintage?: string | null;
  title?: string;
}): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity(o.provider ?? 'GDACS', o.id);
  const kind = o.kind ?? 'HUMANITARIAN_EVENT';
  const vintage = o.vintage === undefined ? T0 : o.vintage;
  const claim =
    kind === 'HUMANITARIAN_EVENT'
      ? {
          claimType: kind,
          hazardType: 'FLOOD' as const,
          sourceNativeType: 'FL',
          sourceTitle: o.title ?? `Flood ${o.id}`,
          eventStatus: 'ONGOING' as const,
          countryIso3: ['RWA'],
        }
      : {
          claimType: kind,
          sourceTitle: o.title ?? `Report ${o.id}`,
          countryIso3: ['RWA'],
          aboutEventKeys: [],
        };
  const observation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: kind,
    subjectType: 'SOURCE_EVENT',
    subjectId: o.id,
    claim,
    temporal:
      vintage === null
        ? { retrievedAt: o.retrievedAt ?? T1, temporalBasis: 'RETRIEVAL_ONLY' }
        : {
            publisherVintage: vintage,
            retrievedAt: o.retrievedAt ?? T1,
            temporalBasis: 'PUBLISHER_VINTAGE',
          },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: o.provider ?? 'GDACS',
      institution: 'Global Disaster Alert and Coordination System, GDACS',
      retrievedAt: o.retrievedAt ?? T1,
      evidenceRole: 'PRIMARY_RECORD',
      ...(o.language === undefined ? {} : { language: o.language }),
    },
    sourceReference: {
      ...(o.url === undefined ? {} : { sourceUrl: o.url }),
      ...(o.citation === undefined ? {} : { citation: o.citation }),
    },
    attributeAuthorship: [{ attribute: 'hazardType', authorship: 'PUBLISHER_STATED' }],
    revision: {
      revisionOrdinal: o.revision ?? 0,
      supersedesRevisionOrdinal: o.revision ? o.revision - 1 : null,
      recordedAt: T1,
    },
  } as unknown as HumanitarianObservation;
  return {
    captureKey: `capture-${o.id}-${o.revision ?? 0}`,
    publisherReleasedAt: vintage ?? T1,
    observation,
  };
}
const n = (o: Parameters<typeof row>[0]) => normalizeRetainedEvidence(row(o));

describe('A · normalizeSourceUrlForMatching', () => {
  it('lower-cases scheme/host, strips a bare root and fragments', () => {
    expect(normalizeSourceUrlForMatching('HTTPS://Example.COM/')).toBe('https://example.com');
    expect(normalizeSourceUrlForMatching('https://Example.com/path?x=1#frag')).toBe(
      'https://example.com/path?x=1',
    );
  });
  it('undefined for missing or unparseable input, never a throw', () => {
    for (const v of [undefined, '', 'not a url'])
      expect(normalizeSourceUrlForMatching(v)).toBeUndefined();
  });
  it('never reorders or drops query parameters', () => {
    expect(normalizeSourceUrlForMatching('https://example.com/x?b=2&a=1')).toBe(
      'https://example.com/x?b=2&a=1',
    );
  });
});

describe('A · normalizeRetainedEvidence (on Main)', () => {
  it("MAIN: identity, provider, revision and capture come from Main's spine", () => {
    const r = n({
      id: 'EQ:1001',
      url: 'https://www.gdacs.org/report.aspx?eventid=1001',
      revision: 2,
      language: 'fr',
    });
    expect(r.provider).toBe('GDACS');
    expect(r.sourceNativeRecordId).toBe('EQ:1001');
    expect(r.revisionOrdinal).toBe(2);
    expect(r.observationKey).toBe(domainObservationKey(humanitarianIdentity('GDACS', 'EQ:1001')));
    expect(r.captureKey).toBe('capture-EQ:1001-2');
    expect(r.publisher).toBe('Global Disaster Alert and Coordination System, GDACS');
    expect(r.rawSourceUrl).toBe('https://www.gdacs.org/report.aspx?eventid=1001');
    expect(r.language).toBe('fr'); // carried, never translated or defaulted
    expect(r.countryIso3).toEqual(['RWA']);
    expect(r.evidenceRole).toBe('PRIMARY_RECORD');
  });
  it('a missing URL is omitted, never invented', () => {
    const r = n({ id: '1' });
    expect(r.rawSourceUrl).toBeUndefined();
    expect(r.normalizedSourceUrl).toBeUndefined();
  });
  it('no publication time: RETRIEVAL_ONLY basis, no invented vintage', () => {
    const r = n({ id: '1', vintage: null });
    expect(r.temporal.temporalBasis).toBe('RETRIEVAL_ONLY');
    expect(r.temporal.publisherVintage).toBeUndefined();
  });
  it('is pure', () => {
    const input = row({ id: '1', url: 'https://x.example/a' });
    expect(normalizeRetainedEvidence(input)).toEqual(normalizeRetainedEvidence(input));
  });
  it('MAIN: refuses a record whose key disagrees with its identity (no second identity system)', () => {
    const bad = row({ id: '1' });
    expect(() =>
      normalizeRetainedEvidence({
        ...bad,
        observation: { ...bad.observation, observationKey: 'obs:forged' },
      }),
    ).toThrow();
  });
  it("MAIN: refuses an observation kind outside Main's registry", () => {
    const bad = row({ id: '1' });
    expect(() =>
      normalizeRetainedEvidence({
        ...bad,
        observation: {
          ...bad.observation,
          observationKind: 'SOMETHING_ELSE',
        } as HumanitarianObservation,
      }),
    ).toThrow(/HUM-K-1/);
  });
  it("MAIN: A's temporary AdmittedHumanitarianRecord does not exist as a second record system", () => {
    const src = readFileSync(join(__dirname, 'retained-evidence.ts'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(src).not.toMatch(/AdmittedHumanitarianRecord/);
    expect(src).not.toMatch(/\bgeography\s*\?\s*:/);
  });
});

describe("B · dedupe (on Main's identity spine)", () => {
  it('MAIN: the same observationKey is ONE record — the latest revision supersedes (not the earliest)', () => {
    const v0 = n({ id: 'EQ:1', revision: 0, retrievedAt: T0 });
    const v1 = n({ id: 'EQ:1', revision: 1, retrievedAt: T1 });
    const { survivors, collapsed } = dedupeRetainedEvidence([v1, v0]);
    expect(survivors).toHaveLength(1);
    expect(survivors[0]!.revisionOrdinal).toBe(1);
    expect(collapsed).toEqual([
      {
        keptObservationKey: v0.observationKey,
        discardedObservationKey: v0.observationKey,
        discardedRevisionOrdinal: 0,
        matchedOn: 'REVISION_SUPERSEDED',
      },
    ]);
  });
  it('collapses normalized-exact URL matches with different native ids (earliest retrieved survives)', () => {
    const a = n({ id: 'A', url: 'HTTPS://Example.com/r?id=1#x', retrievedAt: T1 });
    const b = n({ id: 'B', url: 'https://example.com/r?id=1', retrievedAt: T0 });
    const { survivors, collapsed } = dedupeRetainedEvidence([a, b]);
    expect(survivors.map((s) => s.sourceNativeRecordId)).toEqual(['B']);
    expect(collapsed[0]!.matchedOn).toBe('SOURCE_URL');
  });
  it('REQUIREMENT F: similar-but-different reports with no strong identity both survive', () => {
    const a = n({ id: 'A', title: 'Flooding in the north' });
    const b = n({ id: 'B', title: 'Flooding in the north' });
    const { survivors, collapsed } = dedupeRetainedEvidence([a, b]);
    expect(survivors).toHaveLength(2);
    expect(collapsed).toHaveLength(0);
  });
  it('REQUIREMENT F: the same event from DIFFERENT providers is never collapsed, even with one URL', () => {
    const a = n({ provider: 'GDACS', id: '1', url: 'https://example.com/same' });
    const b = n({ provider: 'RELIEFWEB', id: '1', url: 'https://example.com/same' });
    expect(dedupeRetainedEvidence([a, b]).survivors).toHaveLength(2);
  });
  it('is deterministic regardless of input order', () => {
    const set = [
      n({ id: 'A', url: 'https://e.example/1', retrievedAt: T1 }),
      n({ id: 'B', url: 'https://e.example/1', retrievedAt: T0 }),
      n({ id: 'C', revision: 0 }),
      n({ id: 'C', revision: 1 }),
      n({ id: 'D' }),
    ];
    const forward = dedupeRetainedEvidence(set);
    const reversed = dedupeRetainedEvidence([...set].reverse());
    expect(forward).toEqual(reversed);
  });
  it('transitively merges a URL chain', () => {
    const a = n({ id: 'A', url: 'https://e.example/1' });
    const b = n({ id: 'B', url: 'https://e.example/1' });
    const c = n({ id: 'C', url: 'https://e.example/1' });
    expect(dedupeRetainedEvidence([a, b, c]).survivors).toHaveLength(1);
  });
  it('never matches on title text (no such axis exists)', () => {
    const src = readFileSync(join(__dirname, 'retained-evidence.ts'), 'utf8');
    const dedupe = src.slice(
      src.indexOf('export function dedupeRetainedEvidence'),
      src.indexOf('/* ═══ C ·'),
    );
    expect(dedupe).not.toMatch(/sourceTitle|title|description/);
  });
});

describe('C · bounded retained cache', () => {
  it('is bounded: evicts the oldest-inserted entry', () => {
    const cache = new RetainedEvidenceCache(2);
    for (const id of ['1', '2', '3']) cache.put(n({ id }), T1);
    expect(cache.size).toBe(2);
    expect(cache.get(n({ id: '1' }).observationKey)).toBeUndefined();
  });
  it('MAIN: an older revision never overwrites a newer one', () => {
    const cache = new RetainedEvidenceCache(4);
    cache.put(n({ id: '1', revision: 2 }), T1);
    cache.put(n({ id: '1', revision: 1 }), T1);
    expect(cache.get(n({ id: '1' }).observationKey)!.record.revisionOrdinal).toBe(2);
  });
  it('an explicit newest retained timestamp, undefined when empty (never "now")', () => {
    const cache = new RetainedEvidenceCache(4);
    expect(cache.newestRetainedTimestamp()).toBeUndefined();
    cache.put(n({ id: '1', vintage: T0 }), T1);
    expect(cache.newestRetainedTimestamp()).toBe(T0);
  });
  it('REQUIREMENT F: staleness is explicit; a missing key is stale', () => {
    const cache = new RetainedEvidenceCache(4);
    const r = n({ id: '1', vintage: T0 });
    cache.put(r, T1);
    expect(cache.isStale(r.observationKey, '2026-12-01T00:00:00Z', 86_400_000)).toBe(true);
    expect(cache.isStale(r.observationKey, T1, 7 * 86_400_000)).toBe(false);
    expect(cache.isStale('obs:none', T1, 1)).toBe(true);
  });
  it('REQUIREMENT F/C: a citation-bearing record survives a cache/reopen cycle unchanged; reopen is local', () => {
    const cache = new RetainedEvidenceCache(4);
    const r = n({
      id: '1',
      kind: 'HUMANITARIAN_REPORT',
      citation: 'Publisher statement, verbatim.',
      url: 'https://x.example/r',
    });
    cache.put(r, T1);
    expect(cache.get(r.observationKey)!.record).toEqual(r);
    expect(projectCitation(cache.get(r.observationKey)!.record)).toEqual(projectCitation(r));
    const src = readFileSync(join(__dirname, 'retained-evidence.ts'), 'utf8');
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|axios|Date\.now\(|new Date\(\)/);
  });
  it('refuses a non-positive-integer capacity', () => {
    for (const c of [0, -1, 1.5])
      expect(() => new RetainedEvidenceCache(c)).toThrow(/HUM-RET-CACHE-1/);
  });
});

describe('C2 · bounded changed-since feed (lane A R2, on Main)', () => {
  const keys = (cache: RetainedEvidenceCache, since: number) =>
    retainedChangeFeedSince(cache, since).changes.map((e) => e.record.observationKey);

  it('an empty cache yields an empty, clean page that keeps the cursor', () => {
    const page = retainedChangeFeedSince(new RetainedEvidenceCache(4), 0);
    expect(page).toEqual({
      changes: [],
      nextSinceSequence: 0,
      truncated: false,
      gapPossible: false,
    });
  });
  it('returns only changes after the cursor, ascending, and advances the cursor', () => {
    const cache = new RetainedEvidenceCache(8);
    for (const id of ['1', '2', '3']) cache.put(n({ id }), T1);
    const first = retainedChangeFeedSince(cache, 0);
    expect(first.changes.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(first.changes.every((e) => e.change === 'NEW')).toBe(true);
    expect(first.nextSinceSequence).toBe(3);
    cache.put(n({ id: '4' }), T1);
    expect(keys(cache, first.nextSinceSequence)).toEqual([n({ id: '4' }).observationKey]);
  });
  it('MAIN: a higher revision is a REVISED change; a same-revision re-put is not a change', () => {
    const cache = new RetainedEvidenceCache(8);
    cache.put(n({ id: '1', revision: 0 }), T1);
    cache.put(n({ id: '1', revision: 0 }), '2026-12-01T00:00:00Z');
    expect(cache.latestSequence).toBe(1);
    /* first-seen is kept: a same-revision re-put must not look newly observed */
    expect(cache.get(n({ id: '1' }).observationKey)!.cachedAt).toBe(T1);
    expect(keys(cache, 1)).toEqual([]);
    cache.put(n({ id: '1', revision: 1 }), T1);
    const page = retainedChangeFeedSince(cache, 1);
    expect(page.changes).toHaveLength(1);
    expect(page.changes[0]!.change).toBe('REVISED');
    expect(page.changes[0]!.record.revisionOrdinal).toBe(1);
  });
  it('MAIN: a refused older revision stamps nothing', () => {
    const cache = new RetainedEvidenceCache(8);
    cache.put(n({ id: '1', revision: 2 }), T1);
    cache.put(n({ id: '1', revision: 1 }), T1);
    expect(cache.latestSequence).toBe(1);
    expect(keys(cache, 1)).toEqual([]);
  });
  it('is page-bounded: truncated, then paged to completion with no loss or repeat', () => {
    const cache = new RetainedEvidenceCache(16);
    for (let i = 0; i < 5; i++) cache.put(n({ id: String(i) }), T1);
    const seen: number[] = [];
    let since = 0;
    for (;;) {
      const page = retainedChangeFeedSince(cache, since, 2);
      seen.push(...page.changes.map((e) => e.sequence));
      since = page.nextSinceSequence;
      if (!page.truncated) break;
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });
  it('MISSING STAYS MISSING: a change evicted before it was read raises gapPossible', () => {
    const cache = new RetainedEvidenceCache(2);
    for (const id of ['1', '2', '3']) cache.put(n({ id }), T1);
    expect(cache.evictedThroughSequence).toBe(1);
    const behind = retainedChangeFeedSince(cache, 0);
    expect(behind.gapPossible).toBe(true);
    expect(behind.changes.map((e) => e.sequence)).toEqual([2, 3]);
    expect(retainedChangeFeedSince(cache, 1).gapPossible).toBe(false);
  });
  it('refuses a malformed cursor or an out-of-range limit', () => {
    const cache = new RetainedEvidenceCache(2);
    for (const s of [-1, 1.5, Number.NaN])
      expect(() => retainedChangeFeedSince(cache, s)).toThrow(/HUM-RET-FEED-1/);
    for (const l of [0, MAX_RETAINED_CHANGE_FEED_PAGE + 1, 2.5])
      expect(() => retainedChangeFeedSince(cache, 0, l)).toThrow(/HUM-RET-FEED-2/);
  });
  it('reopen is synchronous and local; the page is internal, not a reader projection', () => {
    expect(retainedChangeFeedSince.constructor.name).not.toBe('AsyncFunction');
    const cache = new RetainedEvidenceCache(2);
    cache.put(n({ id: '1' }), T1);
    const entry = retainedChangeFeedSince(cache, 0).changes[0]!;
    expect(entry.record).toEqual(cache.get(entry.record.observationKey)!.record);
    const src = readFileSync(join(__dirname, 'retained-evidence.ts'), 'utf8');
    expect(src).not.toMatch(/projectRetainedReaderFact|async\s+function|await\s/);
  });
});

describe('D · citation projection', () => {
  it('a report projects a genuine retained citation', () => {
    const p = projectCitation(
      n({
        id: '1',
        kind: 'HUMANITARIAN_REPORT',
        citation: 'Statement.',
        url: 'https://x.example/r',
      }),
    );
    expect(p.kind).toBe('RETAINED_CITATION');
    expect(p.sourceReference).toEqual({ citation: 'Statement.', sourceUrl: 'https://x.example/r' });
  });
  it('GDACS-style event metadata is never presented as a citation, even if citation text exists', () => {
    const p = projectCitation(
      n({ id: '1', kind: 'HUMANITARIAN_EVENT', citation: 'should not appear' }),
    );
    expect(p.kind).toBe('EVENT_METADATA');
    expect(p.sourceReference).toEqual({});
  });
  it('REQUIREMENT F: no URL and no citation projects cleanly, never invents one', () => {
    const p = projectCitation(n({ id: '1', kind: 'HUMANITARIAN_REPORT' }));
    expect(p.sourceReference).toEqual({});
  });
});

describe('E · fact status (internal) and its lossy reader projection', () => {
  const grid: FactAvailability[] = [];
  for (const a of [true, false])
    for (const b of [true, false])
      for (const c of [true, false])
        for (const d of [true, false]) {
          grid.push({
            freshProviderCallSucceeded: a && b,
            freshProviderCallAttempted: b,
            hasRetainedRecord: c,
            evaluated: d,
          });
        }
  it('A: a successful provider call this request wins; retained → RETAINED_REPORTING; else NOT_ASSESSED / SOURCE_UNAVAILABLE', () => {
    expect(
      deriveRetainedFactStatus({
        freshProviderCallSucceeded: true,
        freshProviderCallAttempted: true,
        hasRetainedRecord: true,
        evaluated: true,
      }),
    ).toBe('CURRENT_PROVIDER_OBSERVATION');
    expect(
      deriveRetainedFactStatus({
        freshProviderCallSucceeded: false,
        freshProviderCallAttempted: true,
        hasRetainedRecord: true,
        evaluated: true,
      }),
    ).toBe('RETAINED_REPORTING');
    expect(
      deriveRetainedFactStatus({
        freshProviderCallSucceeded: false,
        freshProviderCallAttempted: false,
        hasRetainedRecord: false,
        evaluated: false,
      }),
    ).toBe('NOT_ASSESSED');
    expect(
      deriveRetainedFactStatus({
        freshProviderCallSucceeded: false,
        freshProviderCallAttempted: true,
        hasRetainedRecord: false,
        evaluated: true,
      }),
    ).toBe('SOURCE_UNAVAILABLE');
  });
  it('CTO freshness ruling: no provider call this request → never CURRENT, however recent the retained record', () => {
    for (const f of grid.filter((g) => !g.freshProviderCallAttempted)) {
      expect(deriveRetainedFactStatus(f)).not.toBe('CURRENT_PROVIDER_OBSERVATION');
    }
  });
  it('is total over the grid', () => {
    for (const f of grid) expect(RETAINED_FACT_STATUSES).toContain(deriveRetainedFactStatus(f));
  });
  it('CTO topology ruling: readers never see SOURCE_UNAVAILABLE', () => {
    expect(readerFactStatus('SOURCE_UNAVAILABLE')).toBe('COVERAGE_GAP');
    for (const f of grid)
      expect(readerFactStatus(deriveRetainedFactStatus(f))).not.toBe('SOURCE_UNAVAILABLE');
    expect(readerFactStatus('RETAINED_REPORTING')).toBe('RETAINED_REPORTING');
  });
  it('closed vocabulary at a boundary', () => {
    for (const s of RETAINED_FACT_STATUSES) expect(assertRetainedFactStatusIsKnown(s)).toBe(true);
    expect(() => assertRetainedFactStatusIsKnown('CURRENT')).toThrow(/HUM-RET-STATUS-1/);
  });
});
