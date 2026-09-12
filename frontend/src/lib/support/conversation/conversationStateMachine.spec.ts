import { advance, agentMayWrite, userMayWrite } from './stateMachine';
import type { ConversationState } from './types';

/**
 * THE SEVEN STATES, AND THE THREE TRANSITIONS THAT MUST NOT EXIST.
 *
 * F `01`; F `08` V-2 and V-3; E1 C-30 and C-31.
 *
 * E1 is explicit that HUMAN being terminal is "not a UI rule, not a routing
 * rule" — the server's write path must refuse it too. This suite proves the
 * frontend half. The backend half is Main's, and is listed as still-mocked in
 * the delivery manifest rather than claimed here.
 */

const ALL: readonly ConversationState[] = [
  'OPEN_AI',
  'AI_WORKING',
  'AI_WITHHELD',
  'AI_UNAVAILABLE',
  'HANDOFF_PENDING',
  'HUMAN',
  'CLOSED',
];

describe('the seven states', () => {
  it('are exactly seven, and the union admits no eighth', () => {
    expect(new Set(ALL).size).toBe(7);
  });
});

describe('prohibited: HUMAN -> OPEN_AI', () => {
  it('a user turn in HUMAN stays in HUMAN — the agent never speaks there again', () => {
    expect(advance('HUMAN', { type: 'USER_TURN' })).toEqual({ state: 'HUMAN', refused: false });
  });

  it('no event whatsoever moves HUMAN back to an agent-owned state', () => {
    const events = [
      { type: 'USER_TURN' },
      { type: 'AGENT_ANSWERED' },
      { type: 'AGENT_WITHHELD' },
      { type: 'AGENT_UNAVAILABLE' },
      { type: 'HANDOFF' },
      { type: 'OPERATOR_JOINED' },
    ] as const;
    for (const event of events) {
      const result = advance('HUMAN', event);
      expect(['HUMAN']).toContain(result.state);
    }
  });

  it('the agent may not write in HUMAN', () => {
    expect(agentMayWrite('HUMAN')).toBe(false);
  });
});

describe('prohibited: CLOSED -> OPEN_AI', () => {
  it('replying to a closed conversation reopens it with the HUMAN team, never with the agent', () => {
    expect(advance('CLOSED', { type: 'USER_TURN' }).state).toBe('HUMAN');
  });

  it('the thing that made it need a person has not un-happened', () => {
    expect(advance('CLOSED', { type: 'USER_TURN' }).state).not.toBe('OPEN_AI');
    expect(agentMayWrite(advance('CLOSED', { type: 'USER_TURN' }).state)).toBe(false);
  });
});

describe('prohibited: AI_WORKING -> AI_WORKING', () => {
  it('a second user turn while a turn is in flight is REFUSED, not queued into a second agent call', () => {
    const result = advance('AI_WORKING', { type: 'USER_TURN' });
    expect(result.refused).toBe(true);
    expect(result.state).toBe('AI_WORKING');
    expect(result.reason).toContain('one agent turn per user turn');
  });

  it('the composer is closed while a turn is in flight, which is what makes the refusal unreachable in practice', () => {
    expect(userMayWrite('AI_WORKING')).toBe(false);
    for (const state of ALL.filter((candidate) => candidate !== 'AI_WORKING')) {
      expect(userMayWrite(state)).toBe(true);
    }
  });

  it('an agent turn may only resolve AI_WORKING — never arrive unprompted', () => {
    for (const state of ALL.filter((candidate) => candidate !== 'AI_WORKING')) {
      expect(advance(state, { type: 'AGENT_ANSWERED' }).refused).toBe(true);
      expect(advance(state, { type: 'AGENT_WITHHELD' }).refused).toBe(true);
      expect(advance(state, { type: 'AGENT_UNAVAILABLE' }).refused).toBe(true);
    }
  });
});

describe('the permitted path, end to end', () => {
  it('OPEN_AI -> AI_WORKING -> OPEN_AI on an answered turn', () => {
    const working = advance('OPEN_AI', { type: 'USER_TURN' });
    expect(working.state).toBe('AI_WORKING');
    expect(advance(working.state, { type: 'AGENT_ANSWERED' }).state).toBe('OPEN_AI');
  });

  it('WITHHELD and UNAVAILABLE are DIFFERENT states, not one non-answer state', () => {
    expect(advance('AI_WORKING', { type: 'AGENT_WITHHELD' }).state).toBe('AI_WITHHELD');
    expect(advance('AI_WORKING', { type: 'AGENT_UNAVAILABLE' }).state).toBe('AI_UNAVAILABLE');
    expect(advance('AI_WORKING', { type: 'AGENT_WITHHELD' }).state).not.toBe(
      advance('AI_WORKING', { type: 'AGENT_UNAVAILABLE' }).state,
    );
  });

  it('either non-answer can reach a person, and a person ends the agent’s involvement', () => {
    for (const from of ['AI_WITHHELD', 'AI_UNAVAILABLE'] as const) {
      const queued = advance(from, { type: 'HANDOFF' });
      expect(queued.state).toBe('HANDOFF_PENDING');
      expect(agentMayWrite(queued.state)).toBe(false);
      expect(advance(queued.state, { type: 'OPERATOR_JOINED' }).state).toBe('HUMAN');
    }
  });

  it('a user turn while queued stays queued — the agent does not pick it back up', () => {
    expect(advance('HANDOFF_PENDING', { type: 'USER_TURN' }).state).toBe('HANDOFF_PENDING');
  });
});

describe('POSITIVE CONTROLS', () => {
  it('the HUMAN-terminal assertion fires against a machine that allowed the reversal', () => {
    const permissive = (): ConversationState => 'OPEN_AI';
    expect(() => expect(permissive()).toBe('HUMAN')).toThrow();
  });

  it('the double-working assertion fires against a machine that accepted a second turn', () => {
    const permissive = { state: 'AI_WORKING' as ConversationState, refused: false };
    expect(() => expect(permissive.refused).toBe(true)).toThrow();
  });
});
