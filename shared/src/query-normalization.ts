/**
 * Deterministic, low-risk query normalization.
 *
 * This intentionally does NOT perform fuzzy spelling correction,
 * edit-distance correction, dictionary lookups, or general autocorrect.
 * Every rule here is a fixed, reversible-in-spirit text transformation
 * that either:
 *   - normalizes punctuation/whitespace variants that mean the same
 *     thing (smart quotes, doubled punctuation, doubled whitespace), or
 *   - repairs a punctuation mistake inside a *closed, whitelisted* set
 *     of common English contraction stems (pronouns/auxiliaries only),
 *     e.g. "what;s" -> "what's".
 *
 * Because the whitelist in CONTRACTION_STEMS only contains pronouns
 * and auxiliary verbs, this can never rewrite a name, place, org, or
 * any other proper noun — those words simply never match the pattern.
 *
 * This module is intentionally framework-free (no NestJS, no I/O) so
 * it can be shared unmodified between backend and frontend.
 */

export interface NormalizedQuery {
  /** Exactly what the caller passed in, unmodified. */
  originalQuery: string;
  /** The normalized form, safe to use for retrieval/caching. */
  normalizedQuery: string;
  /** True when normalizedQuery differs from originalQuery.trim(). */
  wasNormalized: boolean;
}

/**
 * Closed whitelist of contraction stems. Deliberately limited to
 * pronouns and auxiliary/modal verbs — never proper nouns — so the
 * punctuation-repair rule below can never touch a name, city,
 * organization, or other ambiguous term.
 */
const CONTRACTION_STEMS = [
  'what',
  'it',
  'that',
  'there',
  'who',
  'he',
  'she',
  'let',
  'we',
  'they',
  'you',
  'i',
  'don',
  'isn',
  'aren',
  'wasn',
  'weren',
  'didn',
  'doesn',
  'hasn',
  'haven',
  'can',
  'couldn',
  'wouldn',
  'shouldn',
  'won',
].join('|');

/**
 * Matches a whitelisted contraction stem followed by a punctuation
 * mark (semicolon, comma, or colon) standing in for an apostrophe,
 * immediately followed by a common contraction suffix.
 *
 * Examples matched: "what;s", "it,s", "don:t", "there;s".
 * Never matches: "Kigali;s", "Chad,s" — those stems aren't whitelisted.
 */
const CONTRACTION_PUNCTUATION_PATTERN = new RegExp(
  `\\b(${CONTRACTION_STEMS})[;,:](s|t|re|ve|ll|d)\\b`,
  'gi',
);

/** Curly/smart quote and apostrophe variants that should read as a straight apostrophe. */
const SMART_QUOTE_PATTERN = /[\u2018\u2019\u00b4\u0060]/g;

/** Two or more `?` or `!` in a row, collapsed to a single occurrence. */
const REPEATED_TERMINAL_PUNCTUATION_PATTERN = /([?!])\1+/g;

function normalizeSmartQuotes(value: string): string {
  return value.replace(SMART_QUOTE_PATTERN, "'");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function collapseRepeatedTerminalPunctuation(value: string): string {
  return value.replace(REPEATED_TERMINAL_PUNCTUATION_PATTERN, '$1');
}

function repairContractionPunctuation(value: string): string {
  return value.replace(CONTRACTION_PUNCTUATION_PATTERN, "$1'$2");
}

/**
 * Produces a normalized form of a user's query, safe for retrieval and
 * caching, while preserving the original verbatim for display.
 *
 * This function is pure and deterministic: the same input always
 * produces the same output, with no external lookups.
 */
export function normalizeQuery(input: string): NormalizedQuery {
  const originalQuery = input;
  const trimmedOriginal = input.trim();

  let normalized = trimmedOriginal;
  normalized = normalizeSmartQuotes(normalized);
  normalized = repairContractionPunctuation(normalized);
  normalized = collapseRepeatedTerminalPunctuation(normalized);
  normalized = collapseWhitespace(normalized);

  return {
    originalQuery,
    normalizedQuery: normalized,
    wasNormalized: normalized !== trimmedOriginal,
  };
}
