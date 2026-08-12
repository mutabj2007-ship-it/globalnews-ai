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
  // Milestone #46 — "What are/is the [most important/latest/key/...]
  // developments/updates/news/happenings in/with/on/about/for/regarding
  // X [right now/today/currently]?" — the exact real-runtime failure
  // shape ("What are the most important developments in NATO right
  // now?") did not match any pattern above, so the entire sentence was
  // sent to the provider verbatim. Non-greedy capture + an optional
  // trailing time-phrase group correctly strips "right now"/"today"/
  // "currently" from the end without needing them to be present.
  /^what\s+(?:are|is)\s+the\s+(?:most\s+important\s+|latest\s+|key\s+|major\s+|biggest\s+|current\s+|top\s+|recent\s+)*(?:developments|updates|news|happenings)\s+(?:in|with|on|about|for|regarding)\s+(.+?)(?:\s+right\s+now|\s+today|\s+currently)?$/i,
  // Milestone #46 — "Tell me about X"
  /^tell\s+me\s+about\s+(.+)$/i,
  // Milestone #46 — "Give me the latest on/about/regarding X"
  /^give\s+me\s+the\s+latest\s+(?:on|about|regarding)\s+(.+)$/i,
];

/** Strips exactly one leading "the " from an extracted subject (mirrors the same idiom already used in AnalysisService#detectLocation's word-shrinking scan — a separate local instance, not a shared call). */
function stripLeadingThe(value: string): string {
  return value.replace(/^(?:the)\s+/i, '').trim();
}

function stripTrailingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .trim();
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

/**
 * Milestone #46 — small, closed stopword list used ONLY by
 * deriveFallbackNewsQuery() below, never by the primary subject-
 * extraction patterns above and never applied to the raw user
 * sentence. Deliberately narrow: common function/question words and
 * the generic "news framing" vocabulary itself (developments, updates,
 * news, latest, etc.) that carry no topical meaning of their own once
 * a query has already failed to match a more specific pattern above.
 */
const FALLBACK_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'about',
  'regarding',
  'right',
  'now',
  'today',
  'currently',
  'this',
  'that',
  'these',
  'those',
  'and',
  'or',
  'but',
  'most',
  'important',
  'latest',
  'recent',
  'current',
  'key',
  'major',
  'top',
  'new',
  'happening',
  'happenings',
  'developments',
  'development',
  'updates',
  'update',
  'news',
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'going',
  'tell',
  'me',
  'give',
  'us',
]);

/**
 * Milestone #46 — Bounded Fallback Retrieval.
 *
 * Used ONLY by AnalysisService's generic branch, and ONLY as a single,
 * capped second attempt when the PRIMARY deriveGenericNewsQuery()
 * result yields zero relevant articles from the provider (post
 * relevance-gate) — never called speculatively, never chained into a
 * second fallback of its own, never a multi-query fan-out. See
 * AnalysisService's generic branch for the exact trigger condition.
 *
 * Deterministic, zero AI calls: strips the small closed stopword set
 * above from the ALREADY-derived primary query (never the raw user
 * sentence — this is a second, narrower pass over what
 * deriveGenericNewsQuery() already produced), leaving only the
 * remaining significant terms as the fallback provider search phrase.
 *
 * Returns undefined — never an empty string, and never the identical
 * query again — when stripping would remove every word, or would strip
 * nothing at all (which would just re-run an identical, already-failed
 * search). AnalysisService is expected to skip the fallback attempt
 * entirely when this returns undefined.
 */
export function deriveFallbackNewsQuery(primaryDerivedQuery: string): string | undefined {
  const words = primaryDerivedQuery.trim().split(/\s+/).filter(Boolean);
  const significant = words.filter((word) => !FALLBACK_STOPWORDS.has(word.toLowerCase()));

  if (significant.length === 0) return undefined;
  if (significant.length === words.length) return undefined;

  return significant.join(' ');
}
