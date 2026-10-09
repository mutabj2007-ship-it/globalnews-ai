jest.mock('@/lib/api/askV2Api', () => {
  const actual = jest.requireActual('@/lib/api/askV2Api');
  return {
    ...actual,
    askV2Api: {
      guestStatus: jest.fn(),
      continuation: jest.fn(),
      thread: jest.fn(),
      operation: jest.fn(),
      guestThreads: jest.fn(),
      guestThread: jest.fn(),
      guestOperation: jest.fn(),
      createThread: jest.fn(),
      submit: jest.fn(),
      guestSubmit: jest.fn(),
      guestCreateThread: jest.fn(),
      execute: jest.fn(),
    },
  };
});

import { createElement, StrictMode } from 'react';
import { act, create } from 'react-test-renderer';
import { askV2Api } from '@/lib/api/askV2Api';
import { useAskR2Conversation } from './useAskR2Conversation';

/*
  CTO — ASK ALPHA NO-EVIDENCE PRESENTATION R1 · item 4, CONTROLLED (no inference from timing).

  Live: a second operation (51794ad5) appeared in the same thread after the page was restored.
  Proven here against the conversation hook itself (byte-pinned, unchanged):
    - restoring a signed-in conversation (reload, StrictMode double effects) READS only —
      zero createThread / submit / guestSubmit / execute;
    - each explicit Send is exactly ONE submission with its OWN key; the same question sent again
      ("Refresh reporting" on a reopened answer does exactly this) is a new, deliberate operation;
    - nothing auto-retries a finished turn.
  The P0 recovery (askV2LostResponseRecovery.spec) replays only the SAME key inside one Send.
*/
const api = askV2Api as unknown as Record<string, jest.Mock>;
const OP = (id: string) => ({
  operationId: id,
  status: 'COMPLETED',
  requiresAcceptance: false,
  failureCode: null,
  result: { payload: { schema: 'ask-r2-result/1', answer: { state: 'INSUFFICIENT' } } },
});
const Q = 'What changed in trade and transportation between Tanzania and Rwanda during the past 30 days?';

let hook!: ReturnType<typeof useAskR2Conversation>;
function Probe() {
  hook = useAskR2Conversation('en', '/ask', { guestTrial: true });
  return null;
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await act(async () => undefined);
};

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  api.guestStatus.mockResolvedValue({ ok: true, value: { signedIn: true, available: false } });
  api.continuation.mockResolvedValue({ ok: true, value: { threadId: 't-1' } });
  api.thread.mockResolvedValue({
    ok: true,
    value: { id: 't-1', language: 'en', turns: [{ id: 'turn-1', sequence: 0, question: Q, operationId: 'op-78ca' }] },
  });
  api.operation.mockResolvedValue({ ok: true, value: OP('op-78ca') });
});

const writes = () => ['createThread', 'submit', 'guestSubmit', 'guestCreateThread', 'execute'].map((k) => api[k].mock.calls.length);

it('restoring a conversation (StrictMode, effects flushed) READS only — no new operation of any kind', async () => {
  await act(async () => {
    create(createElement(StrictMode, null, createElement(Probe)));
  });
  await flush();
  expect(api.thread).toHaveBeenCalled();
  expect(api.operation).toHaveBeenCalledWith('op-78ca');
  expect(writes()).toEqual([0, 0, 0, 0, 0]);
  expect(hook.turns.map((t) => t.question)).toEqual([Q]);
});

it('each explicit Send is ONE submission with its own key; sending the same question again is a new, deliberate one', async () => {
  await act(async () => {
    create(createElement(Probe));
  });
  await flush();
  api.submit.mockResolvedValueOnce({ ok: true, value: OP('op-5179') }).mockResolvedValueOnce({ ok: true, value: OP('op-next') });
  await act(async () => {
    await hook.submit(Q);
  });
  await flush();
  expect(api.submit).toHaveBeenCalledTimes(1);
  expect(api.submit.mock.calls[0][0]).toBe('t-1');
  await act(async () => {
    await hook.submit(Q);
  });
  expect(api.submit).toHaveBeenCalledTimes(2);
  const [k1, k2] = api.submit.mock.calls.map((c) => c[4]);
  expect(typeof k1).toBe('string');
  expect(k1).not.toBe(k2);
  expect(api.createThread).not.toHaveBeenCalled();
});

it('a double click while a Send is in flight is refused locally (busy), never a second submission', async () => {
  await act(async () => {
    create(createElement(Probe));
  });
  await flush();
  let release!: (v: unknown) => void;
  api.submit.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
  let second: string | undefined;
  await act(async () => {
    const first = hook.submit(Q);
    second = await hook.submit(Q);
    release({ ok: true, value: OP('op-1') });
    await first;
  });
  expect(second).toBe('busy');
  expect(api.submit).toHaveBeenCalledTimes(1);
});
