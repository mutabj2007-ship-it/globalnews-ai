import {
  isNewSince,
  type MyIntelligenceHumanitarianChange,
  type MyIntelligenceHumanitarianNewSince,
} from '@globalnews-ai/shared';
import type { HumanitarianReaderChangePage } from '../humanitarian/humanitarian-retained-corpus';

/** The section is bounded like every other My Intelligence list. */
export const HUMANITARIAN_NEW_SINCE_MAX = 8;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE · HUMANITARIAN NEW SINCE — lane A's delta feed, through My Intelligence's rules
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Input: one page of the ONE retained corpus's reader-checked delta feed
 * (`HumanitarianRetainedCorpus.changesSince`: NEW/REVISED by lane A's revision semantics — a
 * same-revision re-put or an older revision is never a change — E1-scoped, whole page withheld
 * if a row fails Main's reader contract).
 *
 * Applied here, and only here, with My Intelligence's EXISTING rules:
 *   - FOLLOWS are the reader's CountryFollow rows (ISO3), matched against the record's own
 *     source-stated `countryIso3` — never inferred from geometry or text;
 *   - NEW SINCE is the same `isNewSince(firstSeenAt, User.visitBoundaryAt)` as stories, where
 *     `firstSeenAt` is when GLOBALNEWS AI wrote the record (or revision) down, never a publisher
 *     time; no known previous visit ⇒ nothing is claimed new.
 *
 * Pure, synchronous: no fetch, no model, no clock, nothing sent to the reader, no alerting.
 * `gapPossible` is carried through unchanged so an eviction is stated, never silently absorbed.
 */
export function humanitarianNewSince(
  page: HumanitarianReaderChangePage,
  followedIso3: readonly string[],
  previousSeenAt: string | null,
): MyIntelligenceHumanitarianNewSince {
  const followed = new Set(followedIso3);
  const items: MyIntelligenceHumanitarianChange[] = [];
  if (!page.readerRefused) {
    for (const change of page.changes) {
      const o = change.record.observation;
      const countries = o.claim.countryIso3.filter((iso3) => followed.has(iso3));
      if (countries.length === 0) continue;
      if (!isNewSince(change.firstSeenAt, previousSeenAt)) continue;
      const claim = o.claim;
      items.push({
        observationKey: o.observationKey,
        change: change.change,
        firstSeenAt: change.firstSeenAt,
        countryIso3: countries,
        title:
          claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION' ? null : (claim.sourceTitle ?? null),
        figure:
          claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION'
            ? {
                measure: claim.measure,
                value: claim.value,
                unit: 'unit' in claim && typeof claim.unit === 'string' ? claim.unit : null,
                basis: claim.basis,
              }
            : null,
        publisher:
          o.provenance.institution ?? o.provenance.providerId ?? o.identity.upstreamAuthority,
        publisherStatedAt: o.temporal.publisherVintage ?? null,
        sourceUrl: o.sourceReference.sourceUrl ?? null,
      });
    }
  }
  /* Newest observation first; bounded. */
  items.sort((a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt));
  return { items: items.slice(0, HUMANITARIAN_NEW_SINCE_MAX), gapPossible: page.gapPossible };
}
