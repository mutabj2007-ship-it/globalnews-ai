/**
 * UNIFIED INTELLIGENCE BINDING R2E — "is this question the story's own headline?"
 *
 * A product surface (the Map's "Ask about this", /search?q=<title>&articleId=…) may hand the
 * story's HEADLINE in as the question. The places and demonyms inside that text are the
 * STORY's, written by its publisher — not a scope the reader typed. When the question is the
 * headline of the server-resolved anchor, they must not outrank the anchor.
 *
 * Deliberately conservative: equality after case, Unicode and punctuation/whitespace folding
 * only. A reader who edits the headline, adds words or types their own question gets exactly
 * the existing typed-scope behaviour.
 */
export function foldHeadline(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function isSameHeadline(
  question: string | undefined,
  headline: string | undefined,
): boolean {
  if (typeof question !== 'string' || typeof headline !== 'string') return false;
  const q = foldHeadline(question);
  return q.length > 0 && q === foldHeadline(headline);
}
