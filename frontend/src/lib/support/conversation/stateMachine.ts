import type { ConversationState } from './types';

/**
 * THE SEVEN STATES AND THE THREE TRANSITIONS THAT MUST NOT EXIST (`01`).
 *
 * Written as a total function over (state, event) so that a prohibited
 * transition is not "something we remember not to do" but something this file
 * refuses. `08` V-2 and V-3 falsify it directly.
 */
export type ConversationEvent =
  | { type: 'USER_TURN' }
  | { type: 'AGENT_ANSWERED' }
  | { type: 'AGENT_WITHHELD' }
  | { type: 'AGENT_UNAVAILABLE' }
  | { type: 'HANDOFF' }
  | { type: 'OPERATOR_JOINED' }
  | { type: 'CLOSED' };

export interface TransitionResult {
  readonly state: ConversationState;
  /**
   * True when the event was refused. The caller must not treat a refusal as a
   * no-op it can retry differently — it is a defect, and the spec asserts it.
   */
  readonly refused: boolean;
  readonly reason?: string;
}

const PROHIBITED = {
  humanToAi: 'HUMAN -> OPEN_AI: once a person has answered, the agent never speaks again here.',
  closedToAi: 'CLOSED -> OPEN_AI: a reopened conversation returns to HUMAN, not to the agent.',
  doubleWorking: 'AI_WORKING -> AI_WORKING: one agent turn per user turn. No retry, no second attempt.',
} as const;

export function advance(state: ConversationState, event: ConversationEvent): TransitionResult {
  switch (event.type) {
    case 'USER_TURN': {
      /*
        `01` — a user turn is always accepted and always stored (`07` Q-4:
        hitting the limiter must not discard the reader's message). What
        differs is WHO may answer it.
      */
      if (state === 'HUMAN') return { state: 'HUMAN', refused: false };
      // The reopen rule: a reply to a closed conversation reopens it WITH THE
      // HUMAN TEAM. The thing that made it need a person has not un-happened.
      if (state === 'CLOSED') return { state: 'HUMAN', refused: false };
      if (state === 'HANDOFF_PENDING') return { state: 'HANDOFF_PENDING', refused: false };
      if (state === 'AI_WORKING') {
        return { state, refused: true, reason: PROHIBITED.doubleWorking };
      }
      return { state: 'AI_WORKING', refused: false };
    }

    case 'AGENT_ANSWERED':
      if (state !== 'AI_WORKING') {
        return { state, refused: true, reason: 'an agent turn may only resolve AI_WORKING.' };
      }
      return { state: 'OPEN_AI', refused: false };

    case 'AGENT_WITHHELD':
      if (state !== 'AI_WORKING') {
        return { state, refused: true, reason: 'an agent turn may only resolve AI_WORKING.' };
      }
      return { state: 'AI_WITHHELD', refused: false };

    case 'AGENT_UNAVAILABLE':
      if (state !== 'AI_WORKING') {
        return { state, refused: true, reason: 'an agent turn may only resolve AI_WORKING.' };
      }
      return { state: 'AI_UNAVAILABLE', refused: false };

    case 'HANDOFF':
      if (state === 'HUMAN') return { state: 'HUMAN', refused: false };
      return { state: 'HANDOFF_PENDING', refused: false };

    case 'OPERATOR_JOINED':
      return { state: 'HUMAN', refused: false };

    case 'CLOSED':
      return { state: 'CLOSED', refused: false };

    /* istanbul ignore next — exhaustiveness guard */
    default:
      return { state, refused: true, reason: 'unknown event' };
  }
}

/**
 * `01` — HUMAN is terminal for the agent, and CLOSED never returns to it.
 * Exported so the surface and the specs ask ONE function rather than each
 * re-deriving the rule.
 */
export function agentMayWrite(state: ConversationState): boolean {
  return state === 'AI_WORKING';
}

/** The reader may always write. The question is only who answers. */
export function userMayWrite(state: ConversationState): boolean {
  return state !== 'AI_WORKING';
}

export const PROHIBITED_TRANSITIONS = PROHIBITED;
