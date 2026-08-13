/**
 * Milestone #29 — deterministic organization alias resolution.
 *
 * Deliberately narrow and conservative, mirroring the curation
 * discipline countries.ts already documents for CITY_TO_ISO3 ("only
 * cities whose country mapping is unambiguous belong here"):
 *
 *   - Exact canonical-name matching, then a small curated alias table.
 *     NO fuzzy/typo matching — a near-miss like "Untied Nations" must
 *     never resolve. That is a deliberate, tested exclusion (see the
 *     accompanying spec), not an oversight: unlike geography's ~200
 *     stable, well-known countries, organization names are open-ended
 *     and a mis-resolved typo risks merging two unrelated entities.
 *   - Deterministic only. No LLM, no scoring, no confidence — every
 *     alias here is a flat, hand-vetted 1:1 mapping, so ambiguity is
 *     prevented structurally (an alias key can only ever point at one
 *     canonical name) rather than through runtime tie-breaking.
 *   - Organizations/institutions only. People, companies, and
 *     conflicts/events are explicitly out of scope for entity
 *     resolution (see the Milestone #29 design) and must never be
 *     added to this table.
 *   - Countries and cities are explicitly out of scope here too, even
 *     when they're commonly discussed alongside organizations in news
 *     text (e.g. "DRC" / "DR Congo" / "Democratic Republic of the
 *     Congo") — those are already fully resolved by the geographic
 *     layer (countries.ts / geo-fuzzy-resolver.ts), which this module
 *     does not duplicate, extend, or import from. Adding a country
 *     alias here would create two competing sources of truth for the
 *     same entity; countries.ts remains the only one.
 *   - This module is intentionally independent of geo-fuzzy-resolver.ts
 *     (no shared code, no shared types) — Milestone #28's geographic
 *     resolution behavior is not touched by this file existing.
 */

/**
 * Canonical organization/institution names this module will resolve
 * to. Mirrors (and is kept in sync with) article-entities.util.ts's
 * own ORGANIZATION_NAMES candidate list, minus the alias duplicates
 * that table used to list as unrelated peers (e.g. "UN" alongside
 * "United Nations") — those duplicates are now expressed as aliases
 * below instead.
 */
export const ORGANIZATION_CANONICAL_NAMES = [
  'African Union',
  'Arab League',
  'East African Community',
  'European Central Bank',
  'European Union',
  'Federal Reserve',
  'International Criminal Court',
  'International Monetary Fund',
  'NATO',
  'OPEC',
  'Red Cross',
  'United Nations',
  'UNICEF',
  'World Bank',
  'World Food Programme',
  'World Health Organization',
];

/**
 * Curated alias -> canonical map. Deliberately small. Only add an
 * entry here if it is unambiguous in a general news context — if an
 * abbreviation could plausibly mean more than one thing, leave it out
 * rather than guessing (see module doc comment above).
 */
const ORGANIZATION_ALIASES: Record<string, string> = {
  un: 'United Nations',
  who: 'World Health Organization',
  eu: 'European Union',
};

const CANONICAL_SET = new Set(ORGANIZATION_CANONICAL_NAMES);

/**
 * All surface-form strings this module can ever match against source
 * text: the canonical names themselves, plus the curated alias keys in
 * their conventional display casing. Used by article-entities.util.ts
 * to know what to search for in article text — kept here, alongside
 * the alias table it's derived from, so the two can never drift apart.
 */
export const ORGANIZATION_CANDIDATE_PHRASES: string[] = [
  ...ORGANIZATION_CANONICAL_NAMES,
  ...Object.keys(ORGANIZATION_ALIASES).map((key) => key.toUpperCase()),
];

export interface OrganizationResolution {
  /** Canonical organization name, e.g. "United Nations". */
  canonical: string;
  /** The exact surface form that was resolved, as passed in (not re-cased). */
  matchedFrom: string;
}

/**
 * Resolves a candidate surface-form string to a canonical organization
 * identity: an exact canonical-name match first, then a curated alias
 * lookup. Returns undefined for anything else — including near-misses
 * of a real organization name, which this module never fuzzy-corrects.
 */
export function resolveOrganizationAlias(candidate: string): OrganizationResolution | undefined {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return undefined;
  }

  if (CANONICAL_SET.has(trimmed)) {
    return { canonical: trimmed, matchedFrom: trimmed };
  }

  const aliasKey = trimmed.toLowerCase();
  const canonical = ORGANIZATION_ALIASES[aliasKey];

  if (canonical) {
    return { canonical, matchedFrom: trimmed };
  }

  return undefined;
}
