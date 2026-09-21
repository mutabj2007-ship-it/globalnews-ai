import type { AskTurn, AskTurnResponse, SandQuote } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — conversation state, as pure functions.
 *
 * Kept out of the React component deliberately. This repository has no
 * React Testing Library and no jsdom (confirmed: neither is a
 * dependency, and the existing frontend specs either test pure
 * functions or read component source as text — see
 * staleResponseProtection.spec.ts, which documents the same
 * constraint). A reducer that lives inside a component body can only
 * be tested by reading its source; a reducer that lives here can be
 * tested by running it.
 *
 * So everything that could actually be wrong — turn ordering,
 * duplicate suppression, idempotency-key lifetime, the pending state,
 * quote handling — is here, and the component is left as thin
 * rendering over this state.
 */

export interface AskConversationState {
  threadId?: string;
  turns: AskTurn[];
  /** True while a turn is in flight. Drives the composer's disabled state. */
  pending: boolean;
  /** §9 — set when the server returned a quote awaiting confirmation. */
  pendingQuote?: SandQuote;
  /** The question that produced pendingQuote, so confirming can resend it. */
  pendingQuestion?: string;
  /**
   * §12 — the idempotency key for the CURRENT submission.
   *
   * Held in state rather than generated at call time, and this is the
   * single most important detail in this file. A key generated inside
   * the submit handler would be a NEW key on every retry — which
   * means a double click, a reconnect retry, or a confirm-after-quote
   * would each look like a different logical operation to the server
   * and defeat §12 entirely. The key is minted once when a question is
   * first submitted and reused for every retry of that same question,
   * including the confirmation round trip.
   */
  idempotencyKey?: string;
  error?: AskConversationError;
}

export type AskConversationError =
  | 'network'
  | 'timeout'
  | 'rate-limited'
  | 'invalid-question'
  | 'server'
  | 'unknown';

export const INITIAL_ASK_CONVERSATION: AskConversationState = {
  turns: [],
  pending: false,
};

export type AskConversationAction =
  | { type: 'submit'; question: string; idempotencyKey: string }
  | { type: 'resolved'; response: AskTurnResponse }
  | { type: 'failed'; error: AskConversationError }
  | { type: 'confirm' }
  | { type: 'dismiss-quote' }
  | { type: 'resume'; threadId: string; turns: AskTurn[] }
  | { type: 'reset' };

/**
 * Merges turns without duplicating any.
 *
 * Deduplicated by id, and the incoming copy wins for an id already
 * present. This matters for §12: a replayed duplicate submission
 * returns the ORIGINAL turns, with their original ids, so a naive
 * append would show the same exchange twice in the conversation the
 * user is looking at. Sorting by sequence keeps the transcript in
 * conversational order even if two responses settle out of order.
 */
function mergeTurns(existing: AskTurn[], incoming: AskTurn[]): AskTurn[] {
  const byId = new Map(existing.map((turn) => [turn.id, turn]));
  for (const turn of incoming) byId.set(turn.id, turn);

  return [...byId.values()].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    // Ephemeral turns (persistence off) all carry sequence 0, so fall
    // back to creation time to keep them in order.
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function askConversationReducer(
  state: AskConversationState,
  action: AskConversationAction,
): AskConversationState {
  switch (action.type) {
    case 'submit':
      return {
        ...state,
        pending: true,
        error: undefined,
        // The quote is cleared on a NEW question but preserved by the
        // 'confirm' action below, which resubmits the same one.
        pendingQuote: undefined,
        pendingQuestion: action.question,
        idempotencyKey: action.idempotencyKey,
      };

    case 'resolved': {
      const { response } = action;
      const turns = mergeTurns(state.turns, [response.userTurn, response.assistantTurn]);

      // §9 — an awaiting-confirmation response is NOT a completed
      // turn. The question stays pending (as pendingQuestion) and the
      // idempotency key is retained, so confirming resubmits the same
      // logical operation rather than starting a new one.
      if (response.assistantTurn.status === 'awaiting-confirmation') {
        return {
          ...state,
          threadId: response.threadId,
          turns,
          pending: false,
          pendingQuote: response.quote,
          error: undefined,
        };
      }

      return {
        ...state,
        threadId: response.threadId,
        turns,
        pending: false,
        pendingQuote: undefined,
        pendingQuestion: undefined,
        // The exchange is complete, so the key has done its job. A
        // later identical question is a genuinely new operation and
        // must mint a new key, or it would replay this answer forever.
        idempotencyKey: undefined,
        error: undefined,
      };
    }

    case 'failed':
      return {
        ...state,
        pending: false,
        error: action.error,
        // The key is DELIBERATELY retained on failure. Retrying a
        // failed submission must reuse it, so a request that actually
        // succeeded server-side but failed in transit (a dropped
        // response, a timeout after the work completed) replays the
        // existing operation instead of paying for it twice.
      };

    case 'confirm':
      return { ...state, pending: true, error: undefined };

    case 'dismiss-quote':
      return {
        ...state,
        pendingQuote: undefined,
        pendingQuestion: undefined,
        idempotencyKey: undefined,
        // The awaiting-confirmation placeholder turn is removed: the
        // user declined, so it never became part of the conversation.
        turns: state.turns.filter((turn) => turn.status !== 'awaiting-confirmation'),
      };

    case 'resume':
      return {
        ...INITIAL_ASK_CONVERSATION,
        threadId: action.threadId,
        turns: mergeTurns([], action.turns),
      };

    case 'reset':
      return INITIAL_ASK_CONVERSATION;
  }
}

/**
 * §12 — mints an idempotency key.
 *
 * Uses crypto.randomUUID where available and falls back to a
 * timestamp-plus-randomness composite otherwise. The fallback exists
 * because randomUUID requires a secure context, and this code also
 * runs during SSR and in older embedded webviews — a thrown
 * ReferenceError there would break Ask entirely on those clients.
 *
 * The key is a DEDUPLICATION token, not a secret and not an
 * authorization credential: the server namespaces it per caller
 * (see buildOperationIdempotencyIdentity), so one caller's key can
 * never collide with or reach another's operation. Fallback
 * randomness therefore only needs to avoid self-collision within one
 * client, which timestamp + 2 random segments comfortably does.
 */
export function createIdempotencyKey(): string {
  const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  return [
    'ask',
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 12),
    Math.random().toString(36).slice(2, 12),
  ].join('-');
}

/** The turns actually worth rendering — an awaiting-confirmation turn is a placeholder. */
export function visibleTurns(state: AskConversationState): AskTurn[] {
  return state.turns.filter((turn) => turn.status !== 'awaiting-confirmation');
}

/** Whether the composer should accept input. */
export function canSubmit(state: AskConversationState, draft: string): boolean {
  return !state.pending && state.pendingQuote === undefined && draft.trim().length >= 2;
}
