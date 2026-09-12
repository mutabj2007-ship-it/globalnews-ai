/**
 * Milestone #47 — Polish Retrieval Query Derivation.
 *
 * This is deliberately NOT a Polish NLP engine, NOT stemming, and NOT a
 * general declension/inflection resolver. It supports a small, closed
 * set of high-value current-news question shapes (mirroring
 * derive-generic-news-query.util.ts's own English design), plus a tiny,
 * explicitly-disclosed, closed lookup for exactly two demonstrated
 * grammatical-case forms (see POLISH_CASE_NORMALIZATION below) — never
 * a general Polish morphology system.
 *
 * Safety invariant, matching the English utility: the result is NEVER
 * empty and never "worse" than the input — an unmatched sentence
 * returns the punctuation-stripped original, never a fabricated or
 * emptied value.
 *
 * Unicode-safe throughout: Polish diacritics (ą ć ę ł ń ó ś ź ż) pass
 * through every regex/string operation here untouched — none of them
 * are stripped, case-folded incorrectly, or treated as ASCII.
 */

const POLISH_SUBJECT_PATTERNS: RegExp[] = [
  // "Co dzieje się teraz w X?" / "Co dzieje się w X?" (teraz optional)
  /^co\s+dzieje\s+si[eę]\s+(?:teraz\s+)?w\s+(.+)$/iu,
  // "Najnowsze informacje o X"
  /^najnowsze\s+informacje\s+o\s+(.+)$/iu,
  // "Jakie są najważniejsze wiadomości z/o/w X?"
  /^jakie\s+s[ąa]\s+najwa[żz]niejsze\s+wiadomo[śs]ci\s+(?:z|o|w)\s+(.+)$/iu,
];

/**
 * Milestone #47 — a TINY, explicitly closed lookup, not a declension
 * engine. Covers exactly the two grammatical-case forms demonstrated in
 * the approved CTO examples: "z Polski" (genitive of "Polska") and "w
 * Warszawie" (locative of "Warszawa"). Deliberately does not attempt to
 * cover Polish noun declension in general — an unrecognized captured
 * subject (including any OTHER case-inflected place name) is returned
 * exactly as captured, never guessed at. This is disclosed here as a
 * bounded exception, not silently presented as general Polish grammar
 * support.
 */
const POLISH_CASE_NORMALIZATION: Record<string, string> = {
  polski: 'Polska',
  warszawie: 'Warszawa',
};

function stripTrailingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/[?!.,;:]+$/gu, '')
    .trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function normalizeCapturedSubject(captured: string): string {
  const trimmed = captured.trim();
  const normalized = POLISH_CASE_NORMALIZATION[trimmed.toLowerCase()];
  return normalized ?? trimmed;
}

/**
 * Derives a concise Polish (or already-international, e.g. "NATO")
 * retrieval topic from a Polish natural-language question. Input is
 * expected to already be the output of normalizeQuery() (whitespace/
 * smart-quote handling already done upstream), matching
 * deriveGenericNewsQuery()'s own contract.
 *
 * Fallback rule (never destructive, never empty), identical in spirit
 * to deriveGenericNewsQuery(): a pattern candidate is used only if it
 * is non-empty AND has fewer words than the punctuation-stripped
 * input. Otherwise the punctuation-stripped input itself is returned
 * unchanged — this keeps an already-concise query ("NATO") a no-op,
 * and keeps an unmatched Polish sentence from being emptied or
 * mangled.
 */
export function derivePolishRetrievalQuery(normalizedQuery: string): string {
  const base = stripTrailingPunctuation(normalizedQuery);

  if (base.length === 0) {
    return normalizedQuery.trim();
  }

  const baseWordCount = wordCount(base);

  for (const pattern of POLISH_SUBJECT_PATTERNS) {
    const match = base.match(pattern);
    const captured = match?.[1] ? normalizeCapturedSubject(match[1]) : undefined;

    if (captured && captured.length > 0 && wordCount(captured) < baseWordCount) {
      return captured;
    }
  }

  return base;
}
