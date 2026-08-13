/**
 * Milestone #37 — Relational Query Decomposition.
 *
 * Deterministic, closed-pattern-set extraction of a relational
 * "X affecting/affects Y" shape from a user's already-normalized query
 * (post normalizeQuery() — see shared/src/query-normalization.ts). No
 * AI call, no NLP library, no embeddings, no POS tagging — the same
 * discipline established by M35's derive-generic-news-query.util.ts,
 * which this module intentionally mirrors in structure.
 *
 * Only ever called from AnalysisService's generic (non-country/city)
 * branch, and only BEFORE falling back to M35's deriveGenericNewsQuery()
 * — an unmatched query here falls through unchanged to that existing
 * M35/M36 path (see analysis.service.ts). Country/city routing,
 * detectLocation(), and everything M30-M36 established are completely
 * untouched by this module.
 *
 * CAUSALITY BOUNDARY: this module only ever extracts two concept
 * phrases (X, Y) and a provider search string. It makes no claim about
 * causality, does not inspect or classify relationship type, and
 * nothing here — or in the relational relevance gate that consumes its
 * output (scoreRelationalRelevance in
 * news/relevance/generic-relevance.util.ts) — ever establishes "X
 * caused Y". See that function's own doc comment for the full
 * causality-safety statement.
 */

export interface RelationalSearchQuery {
  /** Sent verbatim to NewsService.search() as the single provider query — `${x} ${y}`. */
  providerQuery: string;
  /** The extracted subject concept, used ONLY for relevance validation, never concatenated for matching. */
  x: string;
  /** The extracted target concept, used ONLY for relevance validation, never concatenated for matching. */
  y: string;
}

const MAX_CONCEPT_WORDS = 4;

/**
 * Closed set of 4 relational pattern shapes, each capturing X in group 1
 * and Y in group 2. Deliberately does NOT reuse or extend
 * AnalysisService's COUNTRY_CONTEXT_PATTERN or M35's
 * SUBJECT_EXTRACTION_PATTERNS — this is an entirely separate pattern
 * set with no shared state, matching the same isolation discipline
 * those modules already established.
 */
const RELATIONAL_PATTERNS: RegExp[] = [
  // "How is/are X affecting Y"
  /^how\s+(?:is|are)\s+(.+?)\s+affecting\s+(.+)$/i,
  // "How does/do X affect Y"
  /^how\s+(?:does|do)\s+(.+?)\s+affect\s+(.+)$/i,
  // "What impact is/are X having on Y"
  /^what\s+impact\s+(?:is|are)\s+(.+?)\s+having\s+on\s+(.+)$/i,
  // "Why is/are X affecting Y"
  /^why\s+(?:is|are)\s+(.+?)\s+affecting\s+(.+)$/i,
];

function stripTrailingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

/** Strips exactly one leading "the " — mirrors the same idiom already used in derive-generic-news-query.util.ts and AnalysisService#detectLocation. */
function stripLeadingThe(value: string): string {
  return value.replace(/^(?:the)\s+/i, '').trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/**
 * Attempts deterministic relational decomposition of a query already
 * processed by normalizeQuery(). Returns undefined whenever the closed
 * pattern set doesn't match, either capture is empty after cleanup, or
 * either concept exceeds MAX_CONCEPT_WORDS — rejecting rather than
 * truncating an oversized concept, per the approved design (a truncated
 * fragment risks producing a nonsensical provider query/relevance
 * check, whereas falling back to the existing, unmodified M35/M36
 * generic path is always safe).
 */
export function deriveRelationalSearchQueries(
  normalizedQuery: string,
): RelationalSearchQuery | undefined {
  const base = stripTrailingPunctuation(normalizedQuery);
  if (base.length === 0) return undefined;

  for (const pattern of RELATIONAL_PATTERNS) {
    const match = base.match(pattern);
    if (!match) continue;

    const rawX = match[1]?.trim();
    const rawY = match[2]?.trim();
    if (!rawX || !rawY) continue;

    // A raw capture that is nothing but the article "the" itself has no
    // real concept content — stripLeadingThe() only strips a leading
    // "the " *prefix*, so a bare "the" (no word following it) would
    // otherwise pass through unstripped and unrejected.
    if (rawX.toLowerCase() === 'the' || rawY.toLowerCase() === 'the') continue;

    const x = stripLeadingThe(rawX);
    const y = stripLeadingThe(rawY);
    if (!x || !y) continue;

    if (wordCount(x) > MAX_CONCEPT_WORDS) continue;
    if (wordCount(y) > MAX_CONCEPT_WORDS) continue;

    return {
      providerQuery: `${x} ${y}`,
      x,
      y,
    };
  }

  return undefined;
}
