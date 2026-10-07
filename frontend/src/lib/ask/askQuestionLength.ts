/**
 * H PROD-1 — THE QUESTION LENGTH BOUND, MEASURED BUT NEVER ENFORCED BY CUTTING.
 *
 * The Production backend accepts a question of at most 1,000 characters
 * (ask-v2.dto.ts `@Length(2, 1000)`), and that limit stays authoritative. What changed is how the
 * composers meet it. They used to set `maxLength={1000}`, so a pasted or typed draft over the
 * bound lost its overflow SILENTLY while Send stayed live (STATE-MATRIX §1 "toolong"). Now the
 * whole draft stays in the box, the count and the limit are disclosed, and Send waits until the
 * reader has shortened it.
 *
 * What is measured is what is sent: the conversation trims the draft before it leaves
 * (useAskR2Conversation), so surrounding whitespace does not count. Characters are CODE POINTS.
 * The backend's validator counts a surrogate pair (and an emoji presentation sequence) as one
 * character, so a code-point count is never lower than the server's: nothing the composer lets
 * through can be refused for length, and an ordinary question is counted exactly as the server
 * counts it.
 */
export const ASK_QUESTION_MAX_CHARS = 1000;

/** The length the server will measure for this draft. */
export function askQuestionLength(draft: string): number {
  return Array.from(draft.trim()).length;
}

/** True only past the bound: exactly 1,000 characters may still be sent. */
export function askQuestionOverLimit(draft: string): boolean {
  return askQuestionLength(draft) > ASK_QUESTION_MAX_CHARS;
}
