import { type Turn, type UserTurn, isUserTurn } from './types';

/**
 * PROVISIONAL BOUNDS — E1 C-8, and the honest status of these numbers.
 *
 * E1 requires a HARD, SERVER-ENFORCED context bound expressed as constants
 * with a test. That bound is Main's to own and enforce; the server is the only
 * place it can actually bind. What this module provides is the same bound
 * applied on the frontend path so the UI is built, reviewed and proven against
 * the behaviour rather than against an unbounded projection — and so the
 * "conversation too long" states exist before the backend does.
 *
 * THE VALUES BELOW ARE PLACEHOLDERS AND ARE DECLARED AS SUCH. E1 C-23 and F's
 * Q-1 both put the real numbers with an owner, not with this lane. They are
 * NEVER rendered: Q-5 and C-28 forbid disclosing the limiter's shape, so the
 * reader is told a conversation has grown too long to keep sending in full,
 * and never told by how much or how many.
 *
 * E1 C-8 also says why this is a cost control before it is a privacy control:
 * re-exporting the whole user side on every turn makes the token cost of a
 * conversation grow QUADRATICALLY in its length. An unbounded projection is a
 * cost-amplification primitive that needs no cleverness to exploit.
 */
export const PROJECTION_BOUNDS = {
  MAX_PROJECTED_TURNS: 12,
  MAX_PROJECTED_CHARACTERS: 6000,
  MAX_TURNS_PER_CONVERSATION: 40,
} as const;

export interface ProjectionResult {
  readonly userTurns: readonly UserTurn[];
  /** True when the bound dropped at least one of the reader's earlier turns. */
  readonly truncated: boolean;
  /** True at the conversation ceiling F's H-8 assumes (E1 C-8). */
  readonly atConversationCeiling: boolean;
}

/**
 * THE TYPED TRANSCRIPT PROJECTION — F `01`'s central design decision, E1 §3,
 * and the ONLY producer of provider input in this codebase (E1 C-5).
 *
 *     UserTurn      ───────────────►  included   (the question, and its history)
 *     AgentTurn     ───────✗          excluded by type
 *     OperatorTurn  ───────✗          excluded by type
 *     SystemTurn    ───────✗          excluded by type
 *
 * This gives genuine multi-turn — "what did I ask before?", "the second one",
 * "no, I meant the Polish version" all resolve, because the reader's own turns
 * are what a follow-up refers back to — while making an AI-to-AI loop
 * impossible BY CONSTRUCTION. Breaking it requires writing an
 * `AgentTurn -> UserTurn` conversion, which is a named, reviewable act rather
 * than an oversight.
 *
 * It is also ASK RULE A applied to a transcript: prior turns shape the
 * QUESTION and are never EVIDENCE. Nothing here is citable, nothing is
 * assigned an evidenceId, nothing counts toward breadth or diversity.
 *
 * E1 C-2 — the filter is an ALLOWLIST. E1 C-8 — the bound is applied AFTER the
 * allowlist, never before, and truncation is OLDEST-FIRST.
 */
export function projectAgentInput(turns: readonly Turn[]): readonly UserTurn[] {
  return project(turns).userTurns;
}

export function project(turns: readonly Turn[]): ProjectionResult {
  // 1 · allowlist, by discriminant.
  const allowed = turns.filter(isUserTurn);

  // 2 · bound, oldest-first, applied to what survived the allowlist.
  let bounded = allowed.slice(-PROJECTION_BOUNDS.MAX_PROJECTED_TURNS);

  let characters = bounded.reduce((total, turn) => total + turn.body.length, 0);
  while (bounded.length > 1 && characters > PROJECTION_BOUNDS.MAX_PROJECTED_CHARACTERS) {
    characters -= bounded[0].body.length;
    bounded = bounded.slice(1);
  }

  return {
    userTurns: bounded,
    truncated: bounded.length < allowed.length,
    atConversationCeiling: turns.length >= PROJECTION_BOUNDS.MAX_TURNS_PER_CONVERSATION,
  };
}

/**
 * The exported text, assembled from the projection and nothing else. This is
 * the single assembly site E1 C-5 requires: no second one may exist, and the
 * source guard in `conversationProjection.spec.ts` counts them.
 *
 * F `06` §2 — THE EXPORT GROWS WITH THE THREAD, and that is the most important
 * privacy fact in this contract. A reader who wrote something in turn 1 and
 * asks an unrelated question in turn 6 has had turn 1 sent six times. The
 * disclosure copy (C-2/C-12) therefore describes the export as THE
 * CONVERSATION, never as "this message".
 *
 * E1 C-6 — no GlobalNews identifier of any kind appears here. Not the
 * reader's, not the conversation's, not a turn's. No account field, no locale
 * header, no agent text and no operator text: the spec seeds a transcript with
 * a planted identifier in all four and asserts none of it survives.
 */
export function buildProviderQuery(turns: readonly Turn[]): string {
  return projectAgentInput(turns)
    .map((turn) => turn.body.trim())
    .filter((body) => body.length > 0)
    .join('\n\n')
    .trim();
}
