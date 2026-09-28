import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { askV2Api, type AskV2Operation } from '@/lib/api/askV2Api';
import {
  openFullAnalysisHref,
  sanitizeReturnPath,
  useAskR2Conversation,
} from './useAskR2Conversation';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE F — the Ask R2 conversation, with the Ask V2
 * client mocked AT ITS BOUNDARY so every request is a count.
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
    },
  };
});
const api = jest.mocked(askV2Api);

const op = (over: Partial<AskV2Operation> = {}): AskV2Operation => ({
  operationId: 'op-1',
  computeClass: 'FRESH_BOUNDED',
  status: 'COMPLETED',
  quotedSand: 0,
  chargingEnabled: false,
  requiresAcceptance: false,
  quoteExpiresAt: '2026-09-28T05:00:00Z',
  acceptedAt: null,
  storedResultId: 'sr-1',
  storedResultReused: false,
  failureCode: null,
  result: {
    id: 'sr-1',
    payload: {
      schema: 'ask-r2-result/1',
      answer: { state: 'CURRENT_REPORTING', basis: 'x', missingRoles: [] },
    },
    evidenceRevision: 'r',
    expiresAt: '2026-09-28T05:00:00Z',
    expired: false,
    displayOnly: true,
  },
  ...over,
});

type Hook = ReturnType<typeof useAskR2Conversation>;
function mount(returnPath: string | null = null): { current: () => Hook } {
  let latest: Hook | undefined;
  function Probe(): null {
    latest = useAskR2Conversation('en', returnPath);
    return null;
  }
  act(() => {
    create(createElement(Probe));
  });
  return { current: () => latest! };
}
const calls = () =>
  Object.values(api).reduce((n, fn) => n + (fn as jest.Mock).mock.calls.length, 0);

beforeEach(() => jest.resetAllMocks());

describe('§22 — opening Ask requests nothing', () => {
  it('mounting the conversation makes 0 requests', () => {
    mount();
    expect(calls()).toBe(0);
  });
});

describe('§8 — Ask V2 first, existing Ask as the rollback path', () => {
  it.each(['UNAVAILABLE', 'SIGNED_OUT'] as const)(
    '%s at the first Send → legacy, and no turn is invented',
    async (reason) => {
      api.createThread.mockResolvedValue({ ok: false, reason });
      const h = mount();
      let outcome = '';
      await act(async () => {
        outcome = await h.current().submit('What is happening in Kenya?');
      });
      expect(outcome).toBe('legacy');
      expect(h.current().availability).toBe('legacy');
      expect(h.current().turns).toEqual([]);
      expect(api.submit).not.toHaveBeenCalled();
    },
  );

  it('once legacy, later Sends do not ask Ask V2 again', async () => {
    api.createThread.mockResolvedValue({ ok: false, reason: 'UNAVAILABLE' });
    const h = mount();
    await act(async () => void (await h.current().submit('first')));
    await act(async () => void (await h.current().submit('second')));
    expect(api.createThread).toHaveBeenCalledTimes(1);
  });
});

describe('one Send = one operation', () => {
  it('creates the thread once, with the captured return path, then one submit per Send', async () => {
    api.createThread.mockResolvedValue({
      ok: true,
      value: { id: 't-1', language: 'en', returnPath: '/map?country=RW' },
    });
    api.submit.mockResolvedValue({ ok: true, value: op() });
    const h = mount('/map?country=RW');
    await act(async () => void (await h.current().submit('What is happening in Kenya?')));
    await act(async () => void (await h.current().submit('And Rwanda?')));
    expect(api.createThread).toHaveBeenCalledTimes(1);
    expect(api.createThread.mock.calls[0]![1]).toBe('/map?country=RW');
    expect(api.submit).toHaveBeenCalledTimes(2);
    expect(api.submit.mock.calls[0]![3]).toBe('ask');
    /* each Send carries its own idempotency key */
    expect(api.submit.mock.calls[0]![4]).not.toBe(api.submit.mock.calls[1]![4]);
    expect(h.current().turns.map((t) => t.payload?.answer.state)).toEqual([
      'CURRENT_REPORTING',
      'CURRENT_REPORTING',
    ]);
  });

  it('a refused operation carries its failureCode, never a fabricated answer', async () => {
    api.createThread.mockResolvedValue({
      ok: true,
      value: { id: 't-1', language: 'en', returnPath: null },
    });
    api.submit.mockResolvedValue({
      ok: true,
      value: op({ status: 'RELEASED', failureCode: 'ASK_R2_DISABLED', result: null }),
    });
    const h = mount();
    await act(async () => void (await h.current().submit('What is happening in Kenya?')));
    expect(h.current().turns[0]).toMatchObject({ failure: 'ASK_R2_DISABLED', payload: null });
  });
});

describe('D25 10 — Run deeper asks first; nothing runs until confirmed', () => {
  async function withAnswer() {
    api.createThread.mockResolvedValue({
      ok: true,
      value: { id: 't-1', language: 'en', returnPath: null },
    });
    api.submit.mockResolvedValueOnce({ ok: true, value: op() });
    const h = mount();
    await act(async () => void (await h.current().submit('What is happening in Kenya?')));
    return h;
  }

  it('runDeeper only QUOTES (deep-analysis); accept/reserve/execute are not called', async () => {
    const h = await withAnswer();
    api.submit.mockResolvedValueOnce({
      ok: true,
      value: op({
        status: 'QUOTED',
        requiresAcceptance: true,
        computeClass: 'DEEP_ANALYSIS',
        result: null,
      }),
    });
    await act(async () => void (await h.current().runDeeper('What is happening in Kenya?')));
    expect(api.submit.mock.calls[1]![3]).toBe('deep-analysis');
    expect(h.current().deepQuote?.operation.status).toBe('QUOTED');
    expect(api.accept).not.toHaveBeenCalled();
    expect(api.execute).not.toHaveBeenCalled();
  });

  it('confirm = accept → reserve → execute, in that order, once', async () => {
    const h = await withAnswer();
    api.submit.mockResolvedValueOnce({
      ok: true,
      value: op({ operationId: 'op-2', status: 'QUOTED', requiresAcceptance: true, result: null }),
    });
    await act(async () => void (await h.current().runDeeper('q')));
    const order: string[] = [];
    api.accept.mockImplementation(
      async () => (order.push('accept'), { ok: true, value: op({ operationId: 'op-2' }) }),
    );
    api.reserve.mockImplementation(
      async () => (order.push('reserve'), { ok: true, value: op({ operationId: 'op-2' }) }),
    );
    api.execute.mockImplementation(
      async () => (order.push('execute'), { ok: true, value: op({ operationId: 'op-2' }) }),
    );
    await act(async () => void (await h.current().confirmDeeper()));
    expect(order).toEqual(['accept', 'reserve', 'execute']);
    expect(h.current().deepQuote).toBeNull();
  });

  it('"Not now" releases the quote and runs nothing', async () => {
    const h = await withAnswer();
    api.submit.mockResolvedValueOnce({
      ok: true,
      value: op({ operationId: 'op-3', status: 'QUOTED', requiresAcceptance: true, result: null }),
    });
    await act(async () => void (await h.current().runDeeper('q')));
    api.release.mockResolvedValue({
      ok: true,
      value: op({ operationId: 'op-3', status: 'RELEASED' }),
    });
    await act(async () => void (await h.current().cancelDeeper()));
    expect(api.release).toHaveBeenCalledWith('op-3');
    expect(api.execute).not.toHaveBeenCalled();
  });
});

describe('§15 / §16 — result address and return path', () => {
  it('Open full analysis is a display-only operation address', () => {
    expect(openFullAnalysisHref('op-1')).toBe('/ask?operation=op-1');
  });

  it.each([
    ['/map?country=RW', '/map?country=RW'],
    ['https://evil.test/', null],
    ['//evil.test', null],
    ['/map?x=<script>', null],
    ['', null],
    [null, null],
  ] as const)('sanitizeReturnPath(%j) → %j (same rule as the server)', (input, out) => {
    expect(sanitizeReturnPath(input)).toBe(out);
  });
});
