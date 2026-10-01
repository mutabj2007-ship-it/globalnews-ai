'use client';

/**
 * HOME R1 · STAGE A — "Ask = Send" (FINAL spec §3: the Home Ask button runs ONE ordinary
 * Ask turn; there is no second "stage then Send" step).
 *
 * A SEPARATE event from `openGlobalAsk` on purpose: that module is the zero-compute staging
 * hand-off and stays untouched (Claude H §2 — leaving it alone is what keeps staging
 * provably free). Only the embedded dock listens to this event, and only while
 * the R2 dock is mounted (every platform route); the Home composer is its only caller. The
 * reader's press of Ask IS the explicit Send — one press, one turn; a press while a turn is
 * in flight is refused by the dock exactly as a second Send is.
 */
export const GLOBAL_ASK_SUBMIT_EVENT = 'globalnews:ask-submit';

export interface GlobalAskSubmitDetail {
  readonly question: string;
}

export function submitGlobalAsk(question: string): boolean {
  if (typeof window === 'undefined') return false;
  const trimmed = question.trim();
  if (trimmed.length < 2) return false;
  window.dispatchEvent(
    new CustomEvent<GlobalAskSubmitDetail>(GLOBAL_ASK_SUBMIT_EVENT, { detail: { question: trimmed } }),
  );
  return true;
}
