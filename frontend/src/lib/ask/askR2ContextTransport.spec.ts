import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { askV2Api, type AskV2Operation } from '@/lib/api/askV2Api';
import { useAskR2Conversation } from './useAskR2Conversation';
import type { AskContextRefWire } from './askContextRef';

/**
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — the embedded entry points on the ONE Ask
 * conversation. The Ask V2 client is mocked AT ITS BOUNDARY so every request is a count.
 *
 *   · one explicit Send = exactly one turn request; a second Send in flight = +0
 *   · context references reach the turn request; without them the call is exactly /ask's
 *   · a deeper request is a QUOTE: no accept / reserve / execute until confirmDeeper
 *   · the Standalone /ask (no context) cannot quote without a thread — unchanged
 */
jest.mock('@/lib/api/askV2Api', () => {
  const actual = jest.requireActual('@/lib/api/askV2Api');
  return {
    ...actual,
    askV2Api: {
      createThread: jest.fn(),
      submit: jest.fn(),
      operation: jest.fn(),
      accept: jest.fn(),
      reserve: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
      guestStatus: jest.fn(),
    },
  };
});
const api = jest.mocked(askV2Api);

const REF = 'a'.repeat(64);
const CONTEXT: AskContextRefWire = { entry: 'story', stories: [{ articleRef: REF, url: 'https://wire.example/a' }] };

const op = (over: Partial<AskV2Operation> = {}): AskV2Operation => ({
  operationId: 'op-1',
  computeClass: 'FRESH_BOUNDED',
  status: 'COMPLETED',
  quotedSand: 0,
  chargingEnabled: false,
  requiresAcceptance: false,
  quoteExpiresAt: '2026-10-01T10:00:00Z',
  acceptedAt: null,
  storedResultId: 'sr-1',
  storedResultReused: false,
  failureCode: null,
  result: null,
  ...over,
});

type Hook = ReturnType<typeof useAskR2Conversation>;
function mount(): { current: () => Hook } {
  let latest: Hook | undefined;
  function Probe(): null {
    latest = useAskR2Conversation('en', '/');
    return null;
  }
  act(() => {
    create(createElement(Probe));
  });
  return { current: () => latest! };
}
const calls = () => Object.values(api).reduce((n, fn) => n + (fn as jest.Mock).mock.calls.length, 0);

beforeEach(() => {
  jest.resetAllMocks();
  api.createThread.mockResolvedValue({ ok: true, value: { id: 'thread-1', language: 'en', returnPath: '/' } });
  api.submit.mockResolvedValue({ ok: true, value: op() });
});

describe('Stage A — one Send is one ordinary Ask turn, with governed references', () => {
  it('mounting (= opening Ask) makes zero requests', () => {
    mount();
    expect(calls()).toBe(0);
  });

  it('one Send: one thread + ONE turn request carrying the references; intent ask', async () => {
    const hook = mount();
    await act(async () => {
      await hook.current().submit('What does this mean for trade?', CONTEXT);
    });
    expect(api.submit).toHaveBeenCalledTimes(1);
    const [threadId, question, language, intent, key, context] = api.submit.mock.calls[0];
    expect([threadId, question, language, intent]).toEqual(['thread-1', 'What does this mean for trade?', 'en', 'ask']);
    expect(typeof key).toBe('string');
    expect(context).toEqual(CONTEXT);
    expect(api.accept).not.toHaveBeenCalled();
    expect(api.execute).not.toHaveBeenCalled();
  });

  it('no double submit: a second Send while one is in flight is refused with +0 requests', async () => {
    let release: (v: unknown) => void = () => undefined;
    api.submit.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve({ ok: true, value: op() });
      }),
    );
    const hook = mount();
    let first: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = hook.current().submit('First question', CONTEXT);
      await Promise.resolve();
    });
    let second: unknown;
    await act(async () => {
      second = await hook.current().submit('Second question', CONTEXT);
    });
    expect(second).toBe('busy');
    await act(async () => {
      release(undefined);
      await first;
    });
    expect(api.submit).toHaveBeenCalledTimes(1);
  });

  it('without references the turn request is exactly the Standalone /ask call (context undefined)', async () => {
    const hook = mount();
    await act(async () => {
      await hook.current().submit('Plain question');
    });
    expect(api.submit.mock.calls[0][5]).toBeUndefined();
  });
});

describe('Stage A — deeper analysis is quote → explicit accept → reserve → execute', () => {
  it('an embedded deeper request opens a thread and asks for a QUOTE only — nothing runs', async () => {
    api.submit.mockResolvedValue({
      ok: true,
      value: op({ status: 'QUOTED', computeClass: 'DEEP_ANALYSIS', requiresAcceptance: true, result: null }),
    });
    const hook = mount();
    await act(async () => {
      await hook.current().runDeeper('Compare the selected stories', {
        entry: 'my-intelligence',
        action: 'COMPARE',
        stories: [
          { articleRef: REF, url: 'https://wire.example/a' },
          { articleRef: 'b'.repeat(64), url: 'https://wire.example/b' },
        ],
      });
    });
    expect(api.createThread).toHaveBeenCalledTimes(1);
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.submit.mock.calls[0][3]).toBe('deep-analysis');
    expect(api.accept).not.toHaveBeenCalled();
    expect(api.reserve).not.toHaveBeenCalled();
    expect(api.execute).not.toHaveBeenCalled();
    expect(hook.current().deepQuote).not.toBeNull();
  });

  it('accept → reserve → execute happens only on confirmDeeper, once', async () => {
    api.submit.mockResolvedValue({
      ok: true,
      value: op({ status: 'QUOTED', computeClass: 'DEEP_ANALYSIS', requiresAcceptance: true }),
    });
    api.accept.mockResolvedValue({ ok: true, value: op({ status: 'ACCEPTED' }) });
    api.reserve.mockResolvedValue({ ok: true, value: op({ status: 'RESERVED' }) });
    api.execute.mockResolvedValue({ ok: true, value: op() });
    const hook = mount();
    await act(async () => {
      await hook.current().runDeeper('Compare the selected stories', CONTEXT);
    });
    await act(async () => {
      await hook.current().confirmDeeper();
    });
    await act(async () => {
      await hook.current().confirmDeeper();
    });
    expect([api.accept, api.reserve, api.execute].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('the Standalone /ask (no references) still cannot quote without a thread: 0 requests', async () => {
    const hook = mount();
    let quoted: unknown;
    await act(async () => {
      quoted = await hook.current().runDeeper('Go deeper');
    });
    expect(quoted).toBe(false);
    expect(calls()).toBe(0);
  });
});
