/**
 * ASK RETRIEVAL / CONVERSATION R2 — THE ONE DOCUMENTED ASK INPUT LIMIT.
 *
 * Every Ask surface (standalone /ask, the embedded dock, story follow-up) and the backend
 * validation read this constant. A research question with several paragraphs (the R2 benchmark
 * corridor prompt is ~1,100 characters) must fit; the earlier 1,000-character `maxLength` cut a
 * pasted question silently mid-word ("Finish with three practica", Alpha 2026-10-06 06:36 UTC).
 *
 * Counting is by Unicode code point (what a reader perceives as characters, and what the backend
 * validator counts), never by UTF-16 unit. Over the limit, the composer keeps the whole draft and
 * says so BEFORE submit; the backend refuses with ASK_QUESTION_TOO_LONG. Nothing is truncated.
 */
export const ASK_QUESTION_MAX_CHARS = 4000;
export const ASK_QUESTION_MIN_CHARS = 2;
export const ASK_QUESTION_TOO_LONG = 'ASK_QUESTION_TOO_LONG';

/** Length in code points, so an emoji or a non-BMP character counts once. */
export function askQuestionLength(text: string): number {
  let n = 0;
  for (const _ of text) n += 1;
  return n;
}

/** True when the trimmed question is within the documented Ask limit. */
export function askQuestionWithinLimit(text: string): boolean {
  return askQuestionLength(text.trim()) <= ASK_QUESTION_MAX_CHARS;
}
