'use client';

import type { AskContextRefWire } from './askContextRef';

/**
 * HOME R1 · STAGE A — a deeper, metered analysis requested from OUTSIDE the conversation
 * (My Intelligence's multi-story actions; FINAL spec §9 "deeper actions route to the Ask V2
 * deep operation").
 *
 * The dock (only under `ask.embedded`) answers this by asking the server for a QUOTE —
 * `intent: 'deep-analysis'` with the selection as governed references. Nothing runs: the
 * reader sees the quote and must press Accept (accept → reserve → execute, idempotent,
 * server-owned). A guest is asked to sign in instead; deep work is account-only.
 */
export const GLOBAL_ASK_DEEPER_EVENT = 'globalnews:ask-deeper';

export interface GlobalAskDeeperDetail {
  readonly question: string;
  readonly context: AskContextRefWire;
}

export function requestDeeperAsk(detail: GlobalAskDeeperDetail): boolean {
  if (typeof window === 'undefined' || detail.question.trim().length < 2) return false;
  window.dispatchEvent(new CustomEvent<GlobalAskDeeperDetail>(GLOBAL_ASK_DEEPER_EVENT, { detail }));
  return true;
}
