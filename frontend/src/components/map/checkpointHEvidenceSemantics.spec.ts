import { readFileSync } from 'fs';
import { join } from 'path';

import {
  geographyTotals,
  qualifyingRecords,
  type EvidenceRecord,
} from '@/lib/map/evidence/evidenceModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT H — RETAINED EVIDENCE SEMANTICS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SPATIAL-SOURCE-VS-PUBLISHER-SEMANTICS-1 ·
 * SPATIAL-CURRENT-WINDOW-VS-RETAINED-SCOPE-1
 *
 * CTO: *"Do not label visibly different publishers as '1 SOURCE' unless the
 * underlying metric genuinely means something else and the UI explains it."*
 *
 * ─── SIX QUANTITIES, NAMED ────────────────────────────────────────────────
 *
 *   article count      one retrieved article. `recordCount` after the fold —
 *                      one article can become one record.
 *   current-window     records inside the selected period, measured from
 *   reports            `set.loadedAt`. This is what every total is built from.
 *   retained reports   everything held in the set, including records the
 *                      current period excludes. Strictly a superset.
 *   report count       `reportCount`, summed. The producer's own figure.
 *   source count       `sourceCount` — THE PROVIDER'S OWN NUMBER, hard-coded
 *                      to 1 by all three providers, folded with `Math.max`.
 *                      It is not a distinct-outlet count and never was.
 *   publisher count    `publisherCount` — DISTINCT outlets, counted from
 *                      `publisherId`, or null when nobody supplied one.
 *
 * ─── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * `EvidenceRecord.publisherId` already existed, and `globalEvidenceFeed`
 * already carried it. The map's COUNTRY ENRICHMENT path did not — neither
 * `mapFeedRecordsFrom` nor `GeoRecordInput` accepted a publisher — so every
 * record from that path reached `geographyTotals` with no identity and fell
 * back to `Math.max(sourceCount)`.
 *
 * Since the providers hard-code that field to 1, the result was literally
 * "1 SOURCE" for a geography several visibly different outlets had reported on:
 * a wrong number derived from real data, which is the failure mode the
 * `publisherId` comment itself names.
 *
 * ─── AND ONE FIELD MEANT TWO THINGS ───────────────────────────────────────
 *
 * The distinct-publisher count used to OVERWRITE `sourceCount`, so that one
 * field meant distinct outlets when identities happened to exist and the
 * hard-coded 1 otherwise — a difference no reader and no surface could see.
 * They are separate fields now, and `publisherCount` is null rather than 1
 * when nobody said, because "we were not told" and "one outlet" are different
 * facts and the second is a claim.
 */

const record = (over: Partial<EvidenceRecord> = {}): EvidenceRecord =>
  ({
    id: 'r1',
    geography: { id: 'geo:RWA', countryIso3: 'RWA', displayName: 'Rwanda' },
    precision: 'COUNTRY',
    reportCount: 1,
    sourceCount: 1,
    lastObservedAt: '2026-09-17T00:00:00.000Z',
    ...over,
  }) as EvidenceRecord;

const set = (records: readonly EvidenceRecord[]) =>
  ({ records, scope: 'GLOBAL', loadedAt: '2026-09-17T12:00:00.000Z' }) as never;

const src = (...parts: string[]): string =>
  readFileSync(join(__dirname, '..', '..', ...parts), 'utf-8');

describe('H — three different publishers are not "1 SOURCE"', () => {
  describe('THE MEASURED DEFECT, AND THAT IT IS GONE', () => {
    const threeOutlets = [
      record({ id: 'a', publisherId: 'reuters', sourceCount: 1 }),
      record({ id: 'b', publisherId: 'bbc', sourceCount: 1 }),
      record({ id: 'c', publisherId: 'lemonde', sourceCount: 1 }),
    ];

    it('counts DISTINCT outlets, not the provider’s hard-coded 1', () => {
      expect(geographyTotals(threeOutlets)[0]?.publisherCount).toBe(3);
    });

    it('and the old field still shows why it was wrong', () => {
      /*
        `Math.max` over three records each saying 1 is 1. That is the number
        that used to render under the word SOURCES.
      */
      const withoutIdentity = threeOutlets.map((r) => ({ ...r, publisherId: undefined }));

      expect(geographyTotals(withoutIdentity)[0]?.sourceCount).toBe(1);
    });

    it('two records from ONE outlet count as one publisher', () => {
      /* The count is distinct outlets, not articles. */
      const sameOutlet = [
        record({ id: 'a', publisherId: 'reuters' }),
        record({ id: 'b', publisherId: 'reuters' }),
      ];
      const total = geographyTotals(sameOutlet)[0];

      expect(total?.publisherCount).toBe(1);
      expect(total?.recordCount).toBe(2);
    });
  });

  describe('null IS A STATE, AND IT IS NOT ONE', () => {
    it('no publisher identity yields null, never 1 and never 0', () => {
      const total = geographyTotals([record({ publisherId: undefined })])[0];

      expect(total?.publisherCount).toBeNull();
      expect(total?.publisherCount).not.toBe(1);
      expect(total?.publisherCount).not.toBe(0);
    });

    it('a partially-identified set counts only what was actually supplied', () => {
      /*
        No inference from the unidentified records: they contribute nothing
        rather than being assumed distinct or assumed the same.
      */
      const mixed = [
        record({ id: 'a', publisherId: 'reuters' }),
        record({ id: 'b', publisherId: undefined }),
        record({ id: 'c', publisherId: 'bbc' }),
      ];

      expect(geographyTotals(mixed)[0]?.publisherCount).toBe(2);
    });
  });

  describe('THE SIX QUANTITIES STAY DISTINCT', () => {
    const records = [
      record({ id: 'a', publisherId: 'reuters', reportCount: 4, sourceCount: 1 }),
      record({ id: 'b', publisherId: 'bbc', reportCount: 2, sourceCount: 1 }),
    ];

    it('articles, reports and publishers are three different numbers', () => {
      const total = geographyTotals(records)[0];

      expect(total?.recordCount).toBe(2);
      expect(total?.reportCount).toBe(6);
      expect(total?.publisherCount).toBe(2);
    });

    it('and the provider figure is preserved rather than quietly replaced', () => {
      /* It remains readable, so a future audit can still see what the producer claimed. */
      expect(geographyTotals(records)[0]?.sourceCount).toBeDefined();
    });
  });

  describe('CURRENT WINDOW VS RETAINED SCOPE', () => {
    const now = '2026-09-17T12:00:00.000Z';
    const inWindow = record({ id: 'fresh', lastObservedAt: '2026-09-17T06:00:00.000Z' });
    const older = record({ id: 'stale', lastObservedAt: '2026-09-01T00:00:00.000Z' });

    it('totals are built from the CURRENT WINDOW, not from everything retained', () => {
      const qualifying = qualifyingRecords(set([inWindow, older]), 'WORLD', '24H');

      expect(qualifying.map((r) => r.id)).toEqual(['fresh']);
    });

    it('the retained set is strictly larger, and still holds the excluded record', () => {
      /*
        The distinction the item names: a record outside the period is not
        deleted, it is out of scope for this window. Widening the period
        recovers it without a new request.
      */
      const wide = qualifyingRecords(set([inWindow, older]), 'WORLD', '30D');

      expect(wide.map((r) => r.id).sort()).toEqual(['fresh', 'stale']);
    });

    it('the window is measured from loadedAt, never from wall-clock now', () => {
      /*
        Proven by moving loadedAt rather than by reading it back: the SAME
        record qualifies under one load time and not under another. If the
        horizon came from Date.now() the two would agree, and a retained set
        would answer differently on every render.
      */
      const laterLoad = {
        records: [older],
        scope: 'GLOBAL',
        loadedAt: '2026-09-17T12:00:00.000Z',
      } as never;
      const loadedWhenItWasFresh = {
        records: [older],
        scope: 'GLOBAL',
        loadedAt: '2026-09-01T06:00:00.000Z',
      } as never;

      expect(qualifyingRecords(laterLoad, 'WORLD', '24H')).toHaveLength(0);
      expect(qualifyingRecords(loadedWhenItWasFresh, 'WORLD', '24H')).toHaveLength(1);
    });

    it('so a publisher count is a count WITHIN the window, not for all time', () => {
      const totals = geographyTotals(
        qualifyingRecords(
          set([
            record({ id: 'a', publisherId: 'reuters', lastObservedAt: now }),
            record({ id: 'b', publisherId: 'bbc', lastObservedAt: '2026-09-01T00:00:00.000Z' }),
          ]),
          'WORLD',
          '24H',
        ),
      );

      expect(totals[0]?.publisherCount).toBe(1);
    });
  });
});

describe('H — the identity now reaches every producer, not just one', () => {
  const evidenceFeed = src('lib', 'map', 'evidence', 'evidenceFeed.ts');
  const globalFeed = src('lib', 'map', 'evidence', 'globalEvidenceFeed.ts');
  const pageClient = src('components', 'map', 'MapPageClient.tsx');
  const retained = src('lib', 'map', 'state', 'retainedMapState.ts');

  it('the global feed still carries it, as it always did', () => {
    expect(globalFeed).toContain('publisherId: article.sourceId,');
  });

  it('the map-feed record builder now accepts and forwards it', () => {
    expect(evidenceFeed).toContain('publisherId: input.publisherId,');
  });

  it('both record-construction paths in the shell were closed, not just one', () => {
    /*
      `GeoRecordInput` and `MapFeedRecordInput` are two producers of the same
      record type. Fixing one would have left a geography reporting two
      different source counts depending on which path filled it.
    */
    expect(evidenceFeed.split('publisherId: input.publisherId,')).toHaveLength(3);
  });

  it('the country enrichment supplies the article’s real outlet', () => {
    expect(pageClient).toContain('publisherId: article.sourceId,');
    expect(pageClient).toContain('publisherId: entry.publisherId,');
  });

  it('and BOTH enrichment sites do, not just the first', () => {
    expect(pageClient.split('publisherId: article.sourceId,')).toHaveLength(3);
  });

  it('retained state carries it across the Analysis round trip', () => {
    /*
      Otherwise restored evidence would report a different publisher count from
      the evidence that produced it — the retained corpus would silently
      disagree with itself.
    */
    expect(retained).toContain('readonly publisherId: string;');
  });
});

describe('H — no surface prints a number nobody supplied', () => {
  const card = src('components', 'map', 'shell', 'EvidenceSelectionCard.tsx');
  const callout = src('components', 'map', 'shell', 'SelectionCallout.tsx');
  const mobile = src('components', 'map', 'mobile', 'MobileSpatialShell.tsx');
  const panel = src('components', 'map', 'shell', 'ContextSummaryPanel.tsx');

  it('the selection card reads publisherCount and dashes a null', () => {
    expect(card).toContain('value={total.publisherCount}');
    expect(card).toContain("{value ?? '—'}");
  });

  it('the callout does too', () => {
    expect(callout).toContain('[total.publisherCount, labels.sources');
    expect(callout).toContain("{value ?? '—'}");
  });

  it('and the mobile shell no longer falls back to zero', () => {
    /*
      `?? 0` was the worst of the three: it asserted that zero outlets reported,
      for a geography whose publishers simply were not counted.
    */
    expect(mobile).not.toContain('selectedTotal?.sourceCount ?? 0');
    expect(mobile).toContain('selectedTotal?.publisherCount ?? null');
  });

  it('the context panel keeps the treatment it already had', () => {
    /* It was already correct, and is the precedent the other three now follow. */
    expect(panel).toContain("{totals.sourceCount ?? '—'}");
  });

  it('no map surface renders the raw provider figure under the SOURCES label', () => {
    for (const surface of [card, callout, mobile]) {
      expect(surface).not.toMatch(/sourceCount[^)\n]*labels\.sources/);
    }
  });
});
