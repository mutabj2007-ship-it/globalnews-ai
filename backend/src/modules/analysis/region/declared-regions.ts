import type { CountryMeta } from '@globalnews-ai/shared';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DECLARED PRODUCT REGIONS — C907 §8
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE RULING: *"East Africa is declared product scope: BDI COD DJI ERI ETH KEN
 * RWA SOM SSD TZA UGA … must resolve EAST AFRICA as REQUEST SCOPE. Do not
 * route the whole request as one generic global provider search."*
 *
 * ── WHAT WENT WRONG ON ALPHA ────────────────────────────────────────────────
 *
 * The question
 *
 *     "What's happening in East Africa, economically and politically? do we
 *      have severe humanitarian indications affecting countries in that
 *      region?"
 *
 * matched no country, matched no relational pattern, and fell through to the
 * generic branch — one provider search for a derived keyword, gated by
 * `scoreGenericRelevance`. "East Africa" is not a country name the resolver
 * knows and not a keyword a wire service files under, so the search returned
 * nothing relevant and the reader was told there was no reporting about a
 * region that eleven countries file into every day.
 *
 * ── WHY A DECLARED LIST AND NOT AN INFERENCE ────────────────────────────────
 *
 * Membership is a PRODUCT DECISION, written down, and never derived at request
 * time. The eleven codes below are the ruling's own list, in the ruling's own
 * order. Nothing here consults the map camera, a provider response, a
 * gazetteer heuristic or a model — which is what makes "the typed question is
 * authoritative" implementable rather than aspirational: there is exactly one
 * place the membership can come from, and the user's sentence is what selects
 * it.
 *
 * The frontend already carries the same idea for the map's jump targets
 * (`declaredProductRegions.ts`, `membershipSource: 'PRODUCT_GOVERNED'`). This
 * is the retrieval-side statement of it. The two lists are deliberately
 * separate modules on separate sides of the wire and are asserted to agree by
 * spec rather than shared through a runtime import.
 *
 * ── WHAT A REGION MAY NEVER DO ──────────────────────────────────────────────
 *
 * *"Requested regional scope must never raise evidence precision."* A region
 * chooses WHICH COUNTRIES TO ASK. It attaches nothing to an article, changes
 * no article's resolved country, and appears in the response only as
 * `retrievalContext.requestedScope` — a description of the request, beside the
 * evidence, never on it.
 */

export interface DeclaredRegion {
  readonly id: string;
  readonly label: string;
  /** ISO 3166-1 alpha-3, in declaration order. */
  readonly members: readonly string[];
  /**
   * Phrases that select this region when they appear in the normalized
   * question. Deliberately a short, closed list of the names the region is
   * actually called — not a fuzzy matcher. A region that matched loosely would
   * capture questions it has no business answering.
   */
  readonly phrases: readonly string[];
}

export const EAST_AFRICA: DeclaredRegion = {
  id: 'east-africa',
  label: 'East Africa',
  /* The ruling's list, verbatim and in its order. */
  members: ['BDI', 'COD', 'DJI', 'ERI', 'ETH', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA'],
  phrases: ['east africa', 'eastern africa', 'the horn of africa', 'east african'],
};

export const DECLARED_REGIONS: readonly DeclaredRegion[] = [EAST_AFRICA];

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE BOUND IS ON CONCURRENCY, NOT ON MEMBERSHIP — C907 §0.1(3) FINAL RULING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THE FIRST IMPLEMENTATION GOT WRONG, recorded because it is the whole
 * reason this constant is named the way it is now.
 *
 * C907 as first delivered applied the bound as `members.slice(0, 6)` over the
 * declared order. The declared order is the ruling's own list, which is
 * alphabetical by ISO3, so the six asked and the five never asked were fixed
 * for every request this product will ever serve:
 *
 *     declared :  BDI COD DJI ERI ETH KEN RWA SOM SSD TZA UGA
 *     asked    :  BDI COD DJI ERI ETH KEN
 *     never    :  RWA SOM SSD TZA UGA
 *
 * "What's happening in East Africa" would never have asked about Rwanda — the
 * product's flagship country and the subject of the entire NISR authority —
 * nor Uganda, Somalia, South Sudan or Tanzania, three of which are the accepted
 * `EAST_AFRICA_UNIVERSAL_CORE`. A bound is defensible. A bound plus an
 * arbitrary order is a silent, permanent exclusion, and the response disclosed
 * the count without disclosing that it was always the same six.
 *
 * THE RULING: *"ALL 11 members must be eligible for retrieval. The bound
 * applies to CONCURRENCY / batching, not permanent membership … Do not
 * silently stop after the first six merely because the first batch returned
 * evidence."*
 *
 * So the number stayed and its meaning changed. It is how many provider
 * requests may be IN FLIGHT AT ONCE, not how many countries exist. A broad
 * regional question attempts the whole declared membership in batches of this
 * size, and the only thing that stops it early is the provider itself.
 */
export const MAX_CONCURRENT_REGION_REQUESTS = 6;

/**
 * The declared region a typed question names, or undefined.
 *
 * Matched on WORD BOUNDARIES against the normalized question. "East African
 * Community" and "in east africa" both select the region; a question about
 * "southeast africa" does not, because the phrase is not one of the names.
 */
export function detectDeclaredRegion(normalizedQuery: string): DeclaredRegion | undefined {
  const haystack = ` ${normalizedQuery.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

  for (const region of DECLARED_REGIONS) {
    for (const phrase of region.phrases) {
      if (haystack.includes(` ${phrase} `)) return region;
    }
  }

  return undefined;
}

/**
 * The member countries, resolved through the SAME curated registry every other
 * retrieval path uses.
 *
 * A code that does not resolve is DROPPED rather than substituted, and the
 * caller reports how many members it actually reached — so a registry gap
 * shows up as "5 of 11 members" in the response instead of as a silently
 * narrower answer.
 */
export function resolveRegionMembers(region: DeclaredRegion): CountryMeta[] {
  const resolved: CountryMeta[] = [];

  for (const iso3 of region.members) {
    const country = resolveCountryByAnyIdentifier(iso3);
    if (country) resolved.push(country);
  }

  return resolved;
}
