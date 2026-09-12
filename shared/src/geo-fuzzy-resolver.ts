/**
 * Milestone #28 — conservative, curated-entity-only fuzzy geographic
 * typo resolution (e.g. "Kigalli" -> Kigali, "Rwnada" -> Rwanda).
 *
 * This is deliberately NOT general-purpose autocorrect or a spellchecker:
 *
 *   - The only strings this can ever resolve *to* are single-word
 *     COUNTRIES[].name values and single-word curated city names (see
 *     countries.ts) — never people, organizations, surnames, or any
 *     other free-text word. There is no dictionary here, only the
 *     project's own small, curated geographic entity set.
 *   - Every existing exact match (country name/alias/ISO code, curated
 *     city) is tried first, elsewhere (see AnalysisService#detectLocation
 *     in the backend), and always wins over anything this module
 *     produces. This module is only ever consulted as a last-resort
 *     fallback after exact resolution has already failed.
 *   - Short geographic names (under MIN_TARGET_LENGTH) are excluded
 *     entirely from the candidate pool, specifically so that real,
 *     short, four-letter country names ("Chad", "Iran", "Iraq", "Togo",
 *     "Laos", "Mali", "Peru", "Cuba", ...) can never be fuzzy targets —
 *     an edit distance of 1 on a 4-letter word is too large a relative
 *     change to trust, and those names are exactly the kind of thing
 *     that collides with common first names or unrelated short words.
 *   - A candidate must pass BOTH an absolute edit-distance cap (bucketed
 *     by canonical entity length) AND a relative similarity floor to be
 *     considered at all, and there must be exactly one best-scoring
 *     target with a clear margin over the runner-up — anything tied or
 *     within that margin is treated as ambiguous and left unresolved
 *     (see resolveGeoTypo below). There is no partial/"maybe" tier that
 *     still gets auto-applied: a candidate either clears the bar
 *     unambiguously, or it is not resolved at all, and callers should
 *     fall back to ordinary non-geographic retrieval.
 *   - ISO codes and country aliases (COUNTRY_ALIASES in countries.ts) do
 *     not participate as fuzzy targets. Codes are 2-3 characters, far
 *     too short for any tolerance to be safe (a distance-1 typo of "US"
 *     is "UK"). Aliases are a mix of short forms and ordinary English
 *     words ("Holland", "Burma") with unrelated primary meanings, which
 *     raises collision risk beyond canonical proper-noun country/city
 *     names. Only COUNTRIES[].name and curated city names participate.
 *   - Multi-word canonical entities ("South Sudan", "New Delhi", "Costa
 *     Rica", "Addis Ababa", ...) are out of scope for this milestone.
 *     Only single-word typed candidates are matched against single-word
 *     targets; multi-word canonical entities are simply never reachable
 *     here (not filtered out with special-case code — a single token is
 *     naturally far outside the distance/similarity thresholds of any
 *     multi-word target, so no explicit exclusion logic is needed for
 *     them beyond the pool only ever being built from single-word
 *     values in the first place).
 *
 * See the Milestone #28 design proposal for the full rationale and the
 * worked examples (Kigalli, Kigal, Rwnada, Spian, Pariss, Londn, and the
 * Zambia/Gambia ambiguity case) this module is built against.
 */

import { COUNTRIES, getCuratedCityNames } from './countries';

export type GeoMatchKind = 'country' | 'city';

export interface GeoFuzzyMatch {
  /** The raw typed candidate that was resolved, lowercase (e.g. "kigalli"). */
  matchedFrom: string;
  /** The curated entity that was matched, lowercase canonical form (e.g. "kigali"). */
  canonicalLocation: string;
  matchKind: GeoMatchKind;
  /** 0-100. Higher is a closer match. Provenance/telemetry only — resolution is a single hard gate, not a tier selector. */
  matchConfidence: number;
  editDistance: number;
}

interface GeoFuzzyTarget {
  /** Lowercase canonical form, e.g. "kigali" or "rwanda". */
  canonical: string;
  kind: GeoMatchKind;
}

/**
 * Canonical geographic strings shorter than this are never eligible as
 * fuzzy targets, regardless of how close a typed candidate might land.
 * This is the primary defense against dangerous short-name false
 * positives: it specifically excludes every 4-letter-or-shorter country
 * name in COUNTRIES (Chad, Iran, Iraq, Togo, Laos, Mali, Peru, Cuba,
 * and others) from ever being a fuzzy match destination.
 */
const MIN_TARGET_LENGTH = 5;

/** Minimum acceptable normalized similarity (1 - distance / longer-length). */
const MIN_SIMILARITY = 0.8;

/**
 * If more than one target clears the accept gate, the best match's
 * similarity must exceed the runner-up's by at least this much, or the
 * candidate is treated as ambiguous and left unresolved.
 */
const AMBIGUITY_MARGIN = 0.05;

/** Maximum allowed edit distance, bucketed by canonical target length. */
function maxEditDistanceFor(canonicalLength: number): number {
  if (canonicalLength >= 10) return 2;
  return 1;
}

let cachedTargets: GeoFuzzyTarget[] | undefined;

/**
 * Builds (and memoizes) the fuzzy target pool: single-word country
 * names and single-word curated city names, lowercase, at least
 * MIN_TARGET_LENGTH characters. Multi-word entries are excluded by
 * construction (the `.includes(' ')` check), not as a special case.
 */
function getFuzzyTargets(): GeoFuzzyTarget[] {
  if (cachedTargets) return cachedTargets;

  const targets: GeoFuzzyTarget[] = [];
  const seen = new Set<string>();

  for (const country of COUNTRIES) {
    const canonical = country.name.toLowerCase();
    if (canonical.includes(' ')) continue;
    if (canonical.length < MIN_TARGET_LENGTH) continue;
    if (seen.has(`country:${canonical}`)) continue;
    seen.add(`country:${canonical}`);
    targets.push({ canonical, kind: 'country' });
  }

  for (const city of getCuratedCityNames()) {
    const canonical = city.toLowerCase();
    if (canonical.includes(' ')) continue;
    if (canonical.length < MIN_TARGET_LENGTH) continue;
    if (seen.has(`city:${canonical}`)) continue;
    seen.add(`city:${canonical}`);
    targets.push({ canonical, kind: 'city' });
  }

  cachedTargets = targets;
  return targets;
}

/**
 * Damerau-Levenshtein edit distance restricted to adjacent
 * transpositions (the "optimal string alignment" variant, not full
 * Damerau-Levenshtein) — sufficient here since we only ever compare
 * short, single-word strings and only need to recognize the common
 * adjacent-letter-swap typo pattern (e.g. "Rwnada" vs "Rwanda").
 */
function editDistance(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const d: number[][] = Array.from({ length: lenA + 1 }, () => new Array<number>(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i += 1) d[i][0] = i;
  for (let j = 0; j <= lenB; j += 1) d[0][j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      let value = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, d[i - 2][j - 2] + 1); // adjacent transposition
      }

      d[i][j] = value;
    }
  }

  return d[lenA][lenB];
}

function similarity(a: string, b: string, distance: number): number {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  return 1 - distance / longer;
}

/**
 * Attempts to resolve a single free-text word as a typo of a known,
 * curated geographic entity (a country name or a curated city — see
 * getFuzzyTargets above). Returns undefined whenever the candidate is
 * too short, matches no eligible target closely enough, or matches more
 * than one eligible target too closely to call unambiguously — callers
 * must treat undefined as "not resolved" and fall back to ordinary
 * non-geographic retrieval, never as a signal to guess.
 *
 * This function does not consult exact matching at all (that already
 * happened, and won, before this is ever called) and never rewrites the
 * candidate itself — it only reports what it found, in matchedFrom /
 * canonicalLocation, as provenance for the caller to act on.
 */
export function resolveGeoTypo(candidate: string): GeoFuzzyMatch | undefined {
  const typed = candidate.trim().toLowerCase();
  if (!typed || typed.length < MIN_TARGET_LENGTH || typed.includes(' ')) {
    return undefined;
  }

  type Scored = GeoFuzzyTarget & { distance: number; score: number };

  const passing: Scored[] = [];

  for (const target of getFuzzyTargets()) {
    if (typed === target.canonical) continue; // exact matches are never this module's concern

    const distance = editDistance(typed, target.canonical);
    if (distance > maxEditDistanceFor(target.canonical.length)) continue;

    const score = similarity(typed, target.canonical, distance);
    if (score < MIN_SIMILARITY) continue;

    passing.push({ ...target, distance, score });
  }

  if (passing.length === 0) {
    return undefined;
  }

  passing.sort((left, right) => right.score - left.score);

  const [best, runnerUp] = passing;

  if (runnerUp && best.score - runnerUp.score < AMBIGUITY_MARGIN) {
    // Two or more curated entities are too close together to call this
    // confidently (e.g. "ambia" is distance-1 from both Zambia and
    // Gambia) — fail closed rather than guess.
    return undefined;
  }

  return {
    matchedFrom: typed,
    canonicalLocation: best.canonical,
    matchKind: best.kind,
    matchConfidence: Math.round(best.score * 100),
    editDistance: best.distance,
  };
}
