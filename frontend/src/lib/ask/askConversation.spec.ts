import type { AskTurn, AskTurnResponse, SandQuote } from '@globalnews-ai/shared';
import {
  INITIAL_ASK_CONVERSATION,
  askConversationReducer,
  canSubmit,
  createIdempotencyKey,
  visibleTurns,
  type AskConversationState,
} from './askConversation';

let turnCounter = 0;

function turn(overrides: Partial<AskTurn> = {}): AskTurn {
  turnCounter += 1;
  return {
    id: `turn-${turnCounter}`,
    threadId: 'thread-1',
    sequence: turnCounter,
    role: 'assistant',
    status: 'answered',
    createdAt: new Date(2026, 8, 21, 12, 0, turnCounter).toISOString(),
    ...overrides,
  };
}

function response(overrides: Partial<AskTurnResponse> = {}): AskTurnResponse {
  return {
    threadId: 'thread-1',
    userTurn: turn({ role: 'user', question: 'A question' }),
    assistantTurn: turn({ role: 'assistant', status: 'answered' }),
    entitlementState: 'included',
    reused: false,
    ...overrides,
  };
}

const QUOTE: SandQuote = {
  operationId: 'op-1',
  kind: 'ask-turn',
  computeClass: 'DEEP_ANALYSIS',
  quotedSand: 24,
  requiresConfirmation: true,
  entitlementState: 'metered',
  storedResultAvailable: false,
  label: 'Deep Analysis',
  rationale: ['multi-country:6'],
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  chargingEnabled: false,
};

beforeEach(() => {
  turnCounter = 0;
});

describe('BETA-SIMPLE-ASK-SAND-1 §3 — a multi-turn conversation accumulates', () => {
  it('appends both turns of an exchange', () => {
    const state = askConversationReducer(
      askConversationReducer(INITIAL_ASK_CONVERSATION, {
        type: 'submit',
        question: 'A question',
        idempotencyKey: 'key-1',
      }),
      { type: 'resolved', response: response() },
    );

    expect(state.turns).toHaveLength(2);
    expect(state.threadId).toBe('thread-1');
    expect(state.pending).toBe(false);
  });

  it('keeps every previous turn visible as the conversation grows', () => {
    let state: AskConversationState = INITIAL_ASK_CONVERSATION;

    for (let i = 0; i < 5; i += 1) {
      state = askConversationReducer(state, {
        type: 'submit',
        question: `Question ${i}`,
        idempotencyKey: `key-${i}`,
      });
      state = askConversationReducer(state, { type: 'resolved', response: response() });
    }

    expect(state.turns).toHaveLength(10);
  });

  it('orders turns by sequence even when responses settle out of order', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'resolved',
      response: response({
        userTurn: turn({ role: 'user', sequence: 3, question: 'Later' }),
        assistantTurn: turn({ sequence: 4 }),
      }),
    });

    state = askConversationReducer(state, {
      type: 'resolved',
      response: response({
        userTurn: turn({ role: 'user', sequence: 1, question: 'Earlier' }),
        assistantTurn: turn({ sequence: 2 }),
      }),
    });

    expect(state.turns.map((t) => t.sequence)).toEqual([1, 2, 3, 4]);
    expect(state.turns[0].question).toBe('Earlier');
  });

  it('orders ephemeral turns by creation time when every sequence is 0', () => {
    // With ASK_PERSISTENCE off the backend returns unsaved turns, all
    // carrying sequence 0. They must still render in order.
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'resolved',
      response: response({
        userTurn: turn({ role: 'user', sequence: 0, question: 'First' }),
        assistantTurn: turn({ sequence: 0 }),
      }),
    });
    state = askConversationReducer(state, {
      type: 'resolved',
      response: response({
        userTurn: turn({ role: 'user', sequence: 0, question: 'Second' }),
        assistantTurn: turn({ sequence: 0 }),
      }),
    });

    expect(state.turns).toHaveLength(4);
    expect(state.turns[0].question).toBe('First');
    expect(state.turns[2].question).toBe('Second');
  });
});

describe('§12 — a replayed duplicate does not duplicate the conversation', () => {
  it('does not append the same exchange twice', () => {
    const exchange = response();

    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'resolved',
      response: exchange,
    });
    // The server replays the ORIGINAL turns, with their original ids.
    state = askConversationReducer(state, {
      type: 'resolved',
      response: { ...exchange, reused: true },
    });

    expect(state.turns).toHaveLength(2);
  });

  it('lets an updated copy of a turn replace the earlier one', () => {
    const first = turn({ status: 'answered' });
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'resolved',
      response: response({ assistantTurn: first }),
    });

    state = askConversationReducer(state, {
      type: 'resolved',
      response: response({ assistantTurn: { ...first, status: 'no-evidence' } }),
    });

    expect(state.turns.filter((t) => t.id === first.id)).toHaveLength(1);
    expect(state.turns.find((t) => t.id === first.id)?.status).toBe('no-evidence');
  });
});

describe('§12 — idempotency-key lifetime', () => {
  it('retains the key while a submission is in flight', () => {
    const state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'A question',
      idempotencyKey: 'key-1',
    });
    expect(state.idempotencyKey).toBe('key-1');
  });

  it('RETAINS the key on failure, so a retry cannot pay twice for work that succeeded', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'A question',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, { type: 'failed', error: 'timeout' });

    // A timeout can mean the work completed and the response was lost.
    // Retrying with the same key replays that operation; a new key
    // would run and charge for it a second time.
    expect(state.idempotencyKey).toBe('key-1');
    expect(state.error).toBe('timeout');
    expect(state.pending).toBe(false);
  });

  it('CLEARS the key once an exchange completes, so the next question is a new operation', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'A question',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, { type: 'resolved', response: response() });

    // Without this, asking the same question later would replay the
    // old answer forever instead of recomputing against new evidence.
    expect(state.idempotencyKey).toBeUndefined();
  });

  it('keeps the key across the quote/confirm round trip', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'Deep question',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, {
      type: 'resolved',
      response: response({
        assistantTurn: turn({ status: 'awaiting-confirmation' }),
        quote: QUOTE,
      }),
    });
    state = askConversationReducer(state, { type: 'confirm' });

    // Confirming must resubmit the SAME logical operation, not start a
    // second one at a second price.
    expect(state.idempotencyKey).toBe('key-1');
    expect(state.pendingQuestion).toBe('Deep question');
  });
});

describe('§9 — the quote/confirm flow', () => {
  it('surfaces the quote and stops, without completing the turn', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'Deep question',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, {
      type: 'resolved',
      response: response({
        assistantTurn: turn({ status: 'awaiting-confirmation' }),
        quote: QUOTE,
      }),
    });

    expect(state.pendingQuote?.quotedSand).toBe(24);
    expect(state.pendingQuote?.label).toBe('Deep Analysis');
    expect(state.pending).toBe(false);
  });

  it('hides the awaiting-confirmation placeholder from the transcript', () => {
    const state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'resolved',
      response: response({
        assistantTurn: turn({ status: 'awaiting-confirmation' }),
        quote: QUOTE,
      }),
    });

    expect(state.turns).toHaveLength(2);
    // The user has not been answered yet; showing an empty assistant
    // bubble beside the quote panel would read as a failed answer.
    expect(visibleTurns(state)).toHaveLength(1);
  });

  it('clears everything when the user declines', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'Deep question',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, {
      type: 'resolved',
      response: response({
        assistantTurn: turn({ status: 'awaiting-confirmation' }),
        quote: QUOTE,
      }),
    });
    state = askConversationReducer(state, { type: 'dismiss-quote' });

    expect(state.pendingQuote).toBeUndefined();
    expect(state.pendingQuestion).toBeUndefined();
    expect(state.idempotencyKey).toBeUndefined();
    expect(state.turns.some((t) => t.status === 'awaiting-confirmation')).toBe(false);
  });

  it('completes normally once confirmation resolves', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'Deep question',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, {
      type: 'resolved',
      response: response({ assistantTurn: turn({ status: 'awaiting-confirmation' }), quote: QUOTE }),
    });
    state = askConversationReducer(state, { type: 'confirm' });
    state = askConversationReducer(state, { type: 'resolved', response: response() });

    expect(state.pendingQuote).toBeUndefined();
    expect(state.pending).toBe(false);
    expect(visibleTurns(state).length).toBeGreaterThan(0);
  });
});

describe('§3 — reload/resume', () => {
  it('restores a full conversation from a fetched thread', () => {
    const state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'resume',
      threadId: 'thread-9',
      turns: [
        turn({ role: 'user', sequence: 1, question: 'Q1' }),
        turn({ sequence: 2 }),
        turn({ role: 'user', sequence: 3, question: 'Q2' }),
        turn({ sequence: 4 }),
      ],
    });

    expect(state.threadId).toBe('thread-9');
    expect(state.turns).toHaveLength(4);
    expect(state.pending).toBe(false);
    expect(state.error).toBeUndefined();
  });

  it('discards any stale in-flight state when resuming', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'Interrupted',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, { type: 'resume', threadId: 'thread-9', turns: [] });

    expect(state.pending).toBe(false);
    expect(state.idempotencyKey).toBeUndefined();
    expect(state.pendingQuestion).toBeUndefined();
  });
});

describe('§3 — composer availability', () => {
  it('blocks submission while a turn is in flight', () => {
    const pending = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'A question',
      idempotencyKey: 'key-1',
    });
    expect(canSubmit(pending, 'another question')).toBe(false);
  });

  it('blocks submission while a quote awaits an answer', () => {
    const quoted = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'resolved',
      response: response({ assistantTurn: turn({ status: 'awaiting-confirmation' }), quote: QUOTE }),
    });
    expect(canSubmit(quoted, 'another question')).toBe(false);
  });

  it('rejects a draft shorter than the backend would accept', () => {
    // Matches AddAskTurnDto's @MinLength(2); failing locally avoids a
    // pointless round trip and a 400 the user cannot act on.
    expect(canSubmit(INITIAL_ASK_CONVERSATION, '')).toBe(false);
    expect(canSubmit(INITIAL_ASK_CONVERSATION, ' a ')).toBe(false);
    expect(canSubmit(INITIAL_ASK_CONVERSATION, 'ab')).toBe(true);
  });

  it('re-enables the composer after a failure, so the user can retry', () => {
    let state = askConversationReducer(INITIAL_ASK_CONVERSATION, {
      type: 'submit',
      question: 'A question',
      idempotencyKey: 'key-1',
    });
    state = askConversationReducer(state, { type: 'failed', error: 'network' });
    expect(canSubmit(state, 'retry this')).toBe(true);
  });
});

describe('§12 — createIdempotencyKey', () => {
  it('produces a distinct key each time', () => {
    const keys = new Set(Array.from({ length: 200 }, () => createIdempotencyKey()));
    expect(keys.size).toBe(200);
  });

  it('produces a key the backend DTO will accept (8..128 chars)', () => {
    for (let i = 0; i < 20; i += 1) {
      const key = createIdempotencyKey();
      expect(key.length).toBeGreaterThanOrEqual(8);
      expect(key.length).toBeLessThanOrEqual(128);
    }
  });

  it('works without crypto.randomUUID, as in a non-secure context or SSR', () => {
    const original = globalThis.crypto;
    // @ts-expect-error — deliberately removing the API to prove the fallback.
    delete globalThis.crypto;

    try {
      const keys = new Set(Array.from({ length: 200 }, () => createIdempotencyKey()));
      expect(keys.size).toBe(200);
      expect([...keys][0].startsWith('ask-')).toBe(true);
    } finally {
      globalThis.crypto = original;
    }
  });
});
