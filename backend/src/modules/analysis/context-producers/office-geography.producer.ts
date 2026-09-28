/**
 * ════════════════════════════════════════════════════════════════════════════
 * A · OFFICE GEOGRAPHY — "president of Rwanda" is geography, "cost of living" is not
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE MEASURED GAP THIS CLOSES
 *
 *   COUNTRY_CONTEXT_PATTERN = /\b(?:in|from|about|across|inside|within)\s+(.+)$/i
 *
 * `of` is absent, and `classifyQueryIntent().countries` cannot compensate: it
 * contributes only on a two-or-more country coordination, because "one country
 * from a frame is indistinguishable from ordinary prepositional geography, which
 * detectLocation() already owns, so it is left to it." So for
 * "who is the current president of rwanda" every disjunct of
 * `typedScopeOverridesStory` is false and the MAP country becomes the scope — a
 * reader looking at Poland is answered about Poland.
 *
 * WHY NOT JUST ADD `of` TO THE PATTERN, AND WHY NOT JUST SCAN THE WHOLE QUESTION
 *
 * Both were measured before this design was chosen, and both fail:
 *
 *   adding `of`            captures "the board", "living", "the year" — the
 *                          brief's three named false positives
 *   whole-text scan        `resolvePrimaryCountry` on the raw question already
 *     (the landed         resolves all three CORRECTLY to nothing, because they
 *      resolver)           contain no country name. It fails on HOMOGRAPHS:
 *                            "the cost of turkey at christmas"  -> TR
 *                            "end of jordan career"             -> JO
 *
 * The homographs are the real hazard and the brief's three examples do not reach
 * them. Turkey, Jordan, Chad, Georgia, Niger, Oman, Togo and Guinea are ordinary
 * English words and names, so no amount of preposition tuning makes a bare
 * country-mention scan safe for ROUTING. It is safe for FILTERING, which is what
 * the landed resolver is for.
 *
 * THE RULE: A CONJUNCTION, AND BOTH HALVES ARE REQUIRED
 *
 *   an OFFICE or INSTITUTION head noun   +   `of`   +   a GOVERNED COUNTRY
 *
 * The office noun is what disambiguates the homograph, and it does so in the
 * right direction: "the cost of turkey" is refused because `cost` is not an
 * office, while "the president of Turkey" RESOLVES — because with an office in
 * front of it, Turkey is the country and nothing else. That is the property that
 * makes this a rule rather than a blocklist.
 *
 * REUSE, NOT A SECOND MECHANISM. The country lookup is the landed
 * `resolveCountryByAnyIdentifier`. This file adds the CONSTRUCTION only, because
 * the construction is the part that is genuinely absent.
 */

import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import type { OfficeGeographyCandidate } from './ask-context-producers.contract';

/**
 * Office and institution head nouns, EN.
 *
 * CURATED AND CLOSED, and it must stay closed: every member is a word that makes
 * a following country name a statement about that country's public authority.
 * A generic noun ("history of", "map of", "population of") is deliberately
 * ABSENT — those are legitimate questions but they are not current-office
 * constructions, and the brief scopes this to current office.
 *
 * EXPORTED so the multilingual lane can extend it in place. MA §12 forbids
 * forking Ask AI for multilingual work, so PL forms belong in this array, added
 * by the lane that owns the language — not in a second producer.
 */
export const OFFICE_HEAD_NOUNS: readonly string[] = [
  'president',
  'vice president',
  'prime minister',
  'deputy prime minister',
  'head of state',
  'head of government',
  'government',
  'cabinet',
  'parliament',
  'senate',
  'national assembly',
  'ministry',
  'minister',
  'foreign ministry',
  'finance ministry',
  'central bank',
  'supreme court',
  'constitutional court',
  'chief justice',
  'attorney general',
  'electoral commission',
  'statistics office',
  'presidency',
  'monarch',
  'king',
  'queen',
  'governor',
  'ambassador',
  'embassy',
  'military',
  'armed forces',
];

/** Longest first, so "vice president of X" is not matched as "president of X". */
const OFFICE_NOUNS_BY_LENGTH: readonly string[] = [...OFFICE_HEAD_NOUNS].sort(
  (a, b) => b.length - a.length,
);

/** Articles and determiners that may sit between `of` and the country name. */
const LEADING_DETERMINERS: readonly string[] = ['the', 'a', 'an'];

/** Words that may sit between an office noun and `of` without breaking the construction. */
const PERMITTED_INFIX: readonly string[] = ['current', 'new', 'former', 'acting', 'sitting', 'incumbent'];

function normalize(query: string): string {
  return ` ${query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
}

/**
 * Strip determiners from the front of the complement, once.
 * "of the united kingdom" -> "united kingdom"; "of the board" -> "board".
 */
function stripDeterminer(words: readonly string[]): readonly string[] {
  const first = words[0];
  if (first !== undefined && LEADING_DETERMINERS.includes(first)) return words.slice(1);
  return words;
}

/**
 * Does an office noun end at `beforeOfIndex`, allowing one permitted infix?
 * Returns the office term as the reader wrote it, or null.
 *
 * "president of"                  -> 'president'
 * "current president of"          -> 'president'   (infix consumed)
 * "cost of"                       -> null
 * "president of the board of"     -> 'president', and the complement then fails
 */
function officeTermEndingAt(words: readonly string[], beforeOfIndex: number): string | null {
  for (const noun of OFFICE_NOUNS_BY_LENGTH) {
    const nounWords = noun.split(' ');
    const start = beforeOfIndex - nounWords.length + 1;
    if (start < 0) continue;
    const slice = words.slice(start, beforeOfIndex + 1);
    if (slice.join(' ') === noun) return noun;
  }
  // Allow exactly one permitted infix between the office noun and `of`.
  const infix = words[beforeOfIndex];
  if (infix !== undefined && PERMITTED_INFIX.includes(infix) && beforeOfIndex > 0) {
    return officeTermEndingAt(words, beforeOfIndex - 1);
  }
  return null;
}

/**
 * Produce a typed-geography candidate from a current-office construction, or null.
 *
 * TOTAL AND NEVER THROWING. Returns the FIRST construction found, left to right:
 * a question naming two offices in two countries is a comparison and belongs to
 * the coordination path that already owns it, not here.
 */
export function detectOfficeGeography(query: string): OfficeGeographyCandidate | null {
  const normalized = normalize(query);
  const words = normalized.trim().split(' ').filter((w) => w.length > 0);

  for (let i = 1; i < words.length - 1; i += 1) {
    if (words[i] !== 'of') continue;

    const officeTerm = officeTermEndingAt(words, i - 1);
    if (officeTerm === null) continue;

    const complement = stripDeterminer(words.slice(i + 1));
    if (complement.length === 0) continue;

    /* Longest prefix first: "united states of america" before "united". A
       country name is a phrase, and trying one word only would lose every
       multi-word country. */
    for (let len = complement.length; len >= 1; len -= 1) {
      const candidate = complement.slice(0, len).join(' ');
      const country = resolveCountryByAnyIdentifier(candidate);
      if (country === undefined) continue;

      return {
        countryCode: country.iso3,
        officeTerm,
        countryTerm: candidate,
        construction: 'OFFICE_OF_COUNTRY',
        scopeSource: 'TYPED_GEOGRAPHY',
        provenance: 'STATED',
      };
    }
  }

  return null;
}

/**
 * THE SEAM. One line, one place, and it is ADDITIVE.
 *
 * `detectLocation()` keeps its six prepositions and its whole algorithm. This
 * producer is consulted only where that algorithm has already returned nothing,
 * so no existing case can change: a question the landed path resolves takes
 * exactly the path it takes today.
 *
 *   const typedLocation =
 *     rawTypedLocation ?? officeGeographyLocation(normalizedQuery);
 *
 * Because the result feeds `typedLocation`, `typedScopeOverridesStory` becomes
 * true by the SAME disjunct it always used, the precedence table is untouched,
 * and `geographyContextUsed` is stamped `false` by the SAME line. No rank is
 * added and no rank is reordered.
 */
export function officeGeographyCountryCode(query: string): string | null {
  return detectOfficeGeography(query)?.countryCode ?? null;
}
