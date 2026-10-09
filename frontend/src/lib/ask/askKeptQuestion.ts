import { accountSignInUrl } from '@/lib/api/accountLinks';

/**
 * ASK R2 SIGNED-OUT FALLBACK REMOVAL R1 — the question a signed-out reader typed survives
 * the sign-in round trip.
 *
 * The existing sign-in mechanic (`/api/auth/google?returnTo=…`) returns only to an exact,
 * allowlisted path — `/ask`, never `/ask?q=…` — so the question cannot ride in the URL (and
 * should not: it would land in history and logs). It is kept for THIS TAB in
 * sessionStorage, read ONCE on return, removed, and placed in the composer as a draft.
 * Nothing is ever sent from here. Storage is optional: when it is unavailable the reader
 * simply retypes.
 */
export const ASK_KEPT_QUESTION_KEY = 'globalnews-ai:ask-kept-question';
/**
 * ASK R2 — a storage backstop only, far above the documented Ask limit (ASK_INPUT_MAX_CHARS).
 * The old 1,000 bound cut a kept long question silently; the composer now keeps the WHOLE draft
 * and says when it is over the limit, so the store must not shorten it either.
 */
const MAX_KEPT_LENGTH = 16_000;

/** Where "Sign in to ask" goes: the existing Google sign-in, back to /ask. */
export const ASK_SIGN_IN_HREF = accountSignInUrl('/ask');

export function keepQuestion(question: string): void {
  const q = question.trim().slice(0, MAX_KEPT_LENGTH);
  if (q.length === 0) return;
  try {
    sessionStorage.setItem(ASK_KEPT_QUESTION_KEY, q);
  } catch {
    /* storage is optional */
  }
}

/**
 * REASON TO RETURN R1 · G7 — forget any kept draft. Called on sign-out and account deletion: a
 * question one reader typed must not be placed in the next reader's composer on a shared device.
 */
export function clearKeptQuestion(): void {
  try {
    sessionStorage.removeItem(ASK_KEPT_QUESTION_KEY);
  } catch {
    /* storage is optional */
  }
}

/** Read once and forget. */
export function readKeptQuestion(): string | null {
  try {
    const q = sessionStorage.getItem(ASK_KEPT_QUESTION_KEY);
    sessionStorage.removeItem(ASK_KEPT_QUESTION_KEY);
    return q !== null && q.trim().length > 0 ? q.slice(0, MAX_KEPT_LENGTH) : null;
  } catch {
    return null;
  }
}
