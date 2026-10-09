import type { AskV2BriefingSummary, AskV2Operation } from '@/lib/api/askV2Api';
import type { FollowStrings } from './followStrings';

/**
 * REASON TO RETURN R1 · §8 — pure helpers for followed questions (no network, no clock unless
 * passed in). The server decides every outcome; these only read what it returned.
 */

/** Operation states after which nothing more will run for a turn. */
const TERMINAL = new Set(['COMPLETED', 'RELEASED', 'REFUNDED']);

/**
 * A short re-check guard. A check within this window of the last one would almost always reuse
 * the same stored result (the engine's own stored-result reuse), so the control says so instead
 * of inviting a duplicate job. The server stays the authority (idempotent per turn).
 */
export const FOLLOW_RECHECK_MINUTES = 10;

/** Only Ask-question briefings are followed questions. */
export function isFollowedQuestion(row: Pick<AskV2BriefingSummary, 'scope'>): boolean {
  return row.scope.kind === 'ASK_QUESTION' && typeof row.scope.question === 'string';
}

export function sameFollowedQuestion(a: string, b: string): boolean {
  return a.normalize('NFC').trim() === b.normalize('NFC').trim();
}

/** "3 days ago" / "5 hours ago" / "just now" — the baseline's age, never rounded up to fresh. */
export function ageText(iso: string | null, now: Date, s: FollowStrings): string | null {
  if (iso === null) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const minutes = Math.max(0, Math.floor((now.getTime() - at) / 60_000));
  if (minutes < 60) return s.ageJustNow;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return s.ageHours(hours);
  return s.ageDays(Math.floor(hours / 24));
}

/** Minutes until a re-check is offered again (0 = offer it now). */
export function recheckWaitMinutes(lastCheckedAt: string | null | undefined, now: Date): number {
  if (!lastCheckedAt) return 0;
  const at = Date.parse(lastCheckedAt);
  if (!Number.isFinite(at)) return 0;
  const elapsed = (now.getTime() - at) / 60_000;
  return elapsed >= FOLLOW_RECHECK_MINUTES ? 0 : Math.ceil(FOLLOW_RECHECK_MINUTES - elapsed);
}

/**
 * The turn that ran as the check: the FIRST turn sent after arrival whose question is the
 * followed question and whose operation has finished. Null while none has.
 */
export function finishedCheckTurn<T extends { readonly question: string; readonly operation?: AskV2Operation; readonly failure?: string }>(
  turns: readonly T[],
  followedQuestion: string,
  sentFromIndex: number,
): T | null {
  for (const turn of turns.slice(sentFromIndex)) {
    if (!sameFollowedQuestion(turn.question, followedQuestion)) continue;
    const op = turn.operation;
    if (op === undefined || !op.turnId) return null;
    return TERMINAL.has(op.status) ? turn : null;
  }
  return null;
}

/** The `/ask` address that opens a check of one followed question (an id only, never text). */
export function followCheckHref(briefingId: string): string {
  return `/ask?follow=${encodeURIComponent(briefingId)}`;
}

/** My updates: the reader's followed questions (under the governed `saved` surface). */
export const MY_UPDATES_HREF = '/saved/updates';
