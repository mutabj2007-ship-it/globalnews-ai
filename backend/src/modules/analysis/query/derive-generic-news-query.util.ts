/**
 * Milestone #35 — News Query Normalization & Generic Retrieval.
 *
 * AnalysisService#detectLocation() (see ../service/analysis.service.ts)
 * already fully owns country/city routing. This module is called ONLY
 * from that service's existing generic-search branch, strictly AFTER
 * detectLocation() has returned undefined — it has no visibility into,
 * and no effect on, country or city resolution.
 *
 * Purpose: when a user's query is a natural-language question rather
 * than a concise topic ("What's happening with NATO?" vs "NATO"),
 * sending the whole sentence to the news provider's free-text search
 * degrades retrieval quality. This derives a shorter provider search
 * phrase using a small, closed set of deterministic pattern rules —
 * never an AI call, never general stopword removal, never destructive
 * rewriting of an already-concise query.
 *
 * Safety invariant: the result is NEVER empty, and is never "worse"
 * than the input — see deriveGenericNewsQuery's fallback rule.
 */

/**
 * Ordered, first-match-wins. Each pattern must capture the intended
 * search subject in group 1. Deliberately does NOT reuse or extend
 * AnalysisService's COUNTRY_CONTEXT_PATTERN (which lacks "with" and is
 * load-bearing for country routing) — this is an entirely separate
 * pattern set with no shared state.
 */
const SUBJECT_EXTRACTION_PATTERNS: RegExp[] = [
  // "What's happening in/with/on/about/for/regarding X"
  // "What is happening ... X" / "What's going on with X" / "What's new with X" / "What's the latest on X"
  /^(?:what'?s|what\s+is)\s+(?:happening|going\s+on|new|the\s+latest)\s+(?:in|with|on|about|for|regarding)\s+(.+)$/i,
  // "latest/recent news on/about/regarding X"
  /^(?:latest|recent)\s+news\s+(?:on|about|regarding)\s+(.+)$/i,
  // "latest/recent X news" (non-greedy so it captures the shortest middle phrase)
  /^(?:latest|recent)\s+(.+?)\s+news$/i,
  // "news on/about/regarding X"
  /^news\s+(?:on|about|regarding)\s+(.+)$/i,
];

/** Strips exactly one leading "the " from an extracted subject (mirrors the same idiom already used in AnalysisService#detectLocation's word-shrinking scan — a separate local instance, not a shared call). */
function stripLeadingThe(value: string): string {
  return value.replace(/^(?:the)\s+/i, '').trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.trim().replace(/[?!.,;:]+$/g, '').trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/**
 * Derives a concise provider search phrase from a query that has
 * already failed country/city detection.
 *
 * Input is expected to already be the output of normalizeQuery()
 * (smart quotes/whitespace/contraction-punctuation already handled
 * upstream) — this function only strips trailing terminal punctuation
 * itself and applies the subject-extraction patterns above.
 *
 * Fallback rule (never destructive, never empty): a candidate from the
 * pattern list is used ONLY if it is non-empty AND has fewer words
 * than the punctuation-stripped input. Otherwise the punctuation-
 * stripped input itself is returned unchanged — this is what keeps
 * already-concise queries ("NATO", "East Africa") as no-ops, and what
 * keeps an unmatched sentence ("What is quantum?") from being emptied
 * or mangled rather than confidently shortened.
 */
export function deriveGenericNewsQuery(normalizedQuery: string): string {
  const base = stripTrailingPunctuation(normalizedQuery);

  if (base.length === 0) {
    // Defensive only — AnalysisService never calls this with an empty
    // query (analyzeNews already short-circuits on that earlier), but
    // the safety invariant (never return empty) must hold regardless
    // of caller behavior.
    return normalizedQuery.trim();
  }

  const baseWordCount = wordCount(base);

  for (const pattern of SUBJECT_EXTRACTION_PATTERNS) {
    const match = base.match(pattern);
    const captured = match?.[1] ? stripLeadingThe(match[1].trim()) : undefined;

    if (captured && captured.length > 0 && wordCount(captured) < baseWordCount) {
      return captured;
    }
  }

  return base;
}
