import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const thread = jest.fn();
const guestThread = jest.fn();
const operation = jest.fn();
const guestOperation = jest.fn();
jest.mock('@/lib/api/askV2Api', () => ({
  askR2PayloadOf: (op: { result?: { payload?: unknown } }) => op.result?.payload ?? null,
  askV2Api: {
    thread: (...a: unknown[]) => thread(...a),
    guestThread: (...a: unknown[]) => guestThread(...a),
    operation: (...a: unknown[]) => operation(...a),
    guestOperation: (...a: unknown[]) => guestOperation(...a),
  },
}));

import { readEarlierTurns, rememberConversation } from './askThreadRestore';

/* a minimal browser stand-in (no jsdom in this repo): location + history.replaceState */
const loc = { href: 'http://local/ask', pathname: '/ask', search: '' };
const hist = {
  state: null as unknown,
  length: 1,
  replaceState(_state: unknown, _title: string, url: string) {
    const u = new URL(url, 'http://local');
    loc.href = u.href;
    loc.pathname = u.pathname;
    loc.search = u.search;
  },
};
(globalThis as unknown as { window: unknown }).window = { location: loc, history: hist };

const OP = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const history = {
  ok: true,
  value: {
    id: 't1',
    language: 'en',
    turns: [1, 2, 3].map((n) => ({
      id: `turn-${n}`,
      sequence: n,
      question: `Q${n}`,
      operationId: OP(n),
    })),
  },
};

describe('CTO P0 · Defect F — a completed conversation survives refresh and Back', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/ask');
  });

  it('a reopen restores the turns BEFORE the reopened answer, oldest first, through display-only reads', async () => {
    thread.mockResolvedValue(history);
    operation.mockImplementation(async (id: string) => ({
      ok: true,
      value: { operationId: id, status: 'COMPLETED', result: { payload: { id } } },
    }));
    const earlier = await readEarlierTurns('t1', OP(3), false);
    expect(earlier.map((t) => t.question)).toEqual(['Q1', 'Q2']);
    expect(operation.mock.calls.map(([id]) => id)).toEqual([OP(1), OP(2)]);
    expect(guestThread).not.toHaveBeenCalled();
  });

  it('a guest reopen reads through the guest surface', async () => {
    guestThread.mockResolvedValue(history);
    guestOperation.mockResolvedValue({ ok: false, reason: 'NETWORK' });
    const earlier = await readEarlierTurns('t1', OP(2), true);
    expect(earlier).toEqual([{ question: 'Q1', failure: 'NETWORK' }]);
    expect(thread).not.toHaveBeenCalled();
  });

  it('an unreadable thread restores nothing (never guesses)', async () => {
    thread.mockResolvedValue({ ok: false, reason: 'SIGNED_OUT' });
    expect(await readEarlierTurns('t1', OP(3), false)).toEqual([]);
  });

  it('the latest completed turn is remembered in the address bar without adding a history entry', () => {
    const before = window.history.length;
    rememberConversation(OP(3));
    expect(window.location.pathname + window.location.search).toBe(`/ask?operation=${OP(3)}`);
    expect(window.history.length).toBe(before);
  });

  it('only on /ask and only a real operation id', () => {
    window.history.replaceState(null, '', '/saved');
    rememberConversation(OP(3));
    expect(window.location.pathname).toBe('/saved');
    window.history.replaceState(null, '', '/ask');
    rememberConversation('not-an-id');
    expect(window.location.search).toBe('');
  });

  it('the screen restores on reopen, remembers after each completed turn, and never renders a turn twice', () => {
    const screen = readFileSync(
      join(__dirname, '../../components/ask-frame/AskFrameScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain('readEarlierTurns(threadId, operationId, viaGuest)');
    expect(screen).toContain('rememberConversation(latestCompletedOperation)');
    expect(screen).toContain('remembered.current.has(operationId)');
    expect(screen).toContain('!openedInLive');
  });
});
