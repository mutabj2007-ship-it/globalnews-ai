jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: jest.fn() }));

import { accountFetch } from '@/lib/api/accountFetch';
import {
  askV2Api,
  forgetUnconfirmedSubmissions,
  isAmbiguousSubmitFailure,
  SUBMIT_RECOVERY,
  type AskV2Operation,
} from '@/lib/api/askV2Api';
import { failedTurnCopy } from '@/lib/ask/askR2View';
import { askR2Strings as getAskR2Strings } from '@/lib/ask/askR2Strings';

/*
  CTO P0 ALPHA PROXY TIMEOUT R1 — the Ask client's contract for an AMBIGUOUS submission.

  Live Alpha db95d4e: the proxy answered 500 at ~30 s; the backend completed the operation at
  ~31 s; the reader was told "Nothing was run". Here, against the client's own transport:
    - backend completion after a frontend timeout is recovered and shown, from ONE key;
    - a post-dispatch disconnection is recovered the same way (replay → running → read);
    - a genuine pre-dispatch failure (offline before sending) sends nothing and stays NETWORK;
    - an unrecoverable outcome is UNCONFIRMED ("may have run"), never "nothing ran", and the
      reader's retry of the same question reuses the SAME key, so it cannot run twice;
    - typed refusals are definitive and never replayed; the guest surface recovers through the
      guest's own operation read.
*/
const fetchMock = accountFetch as jest.MockedFunction<typeof accountFetch>;
const response = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  }) as unknown as Response;
const op = (status: string, over: Partial<AskV2Operation> = {}) =>
  ({
    operationId: 'op-1',
    status,
    requiresAcceptance: false,
    computeClass: 'FRESH_BOUNDED',
    failureCode: null,
    result: status === 'COMPLETED' ? { payload: { schema: 'ask-r2-result/1', answer: { state: 'CURRENT_REPORTING' } } } : null,
    ...over,
  }) as unknown as AskV2Operation;
const QUESTION =
  'What changed in trade and transportation between Tanzania and Rwanda during the past 30 days?';
const TURN_PATH = '/ask-v2/threads/t-1/turns';
const sentKeys = () =>
  fetchMock.mock.calls
    .filter(([path, init]) => path === TURN_PATH && init?.method === 'POST')
    .map(([, init]) => (init?.body as { idempotencyKey: string }).idempotencyKey);
const posts = (path = TURN_PATH) =>
  fetchMock.mock.calls.filter(([p, init]) => p === path && init?.method === 'POST').length;

const realSleep = SUBMIT_RECOVERY.sleep;
const realNow = SUBMIT_RECOVERY.now;
let clock = 0;
beforeEach(() => {
  fetchMock.mockReset();
  forgetUnconfirmedSubmissions();
  clock = 0;
  SUBMIT_RECOVERY.sleep = async (ms: number) => {
    clock += ms;
  };
  SUBMIT_RECOVERY.now = () => clock;
});
afterAll(() => {
  SUBMIT_RECOVERY.sleep = realSleep;
  SUBMIT_RECOVERY.now = realNow;
});

describe('P0 · backend completion after the frontend timed out', () => {
  it('the proxy 500 is not "nothing ran": the same key is replayed and the completed answer is shown', async () => {
    fetchMock
      .mockResolvedValueOnce(response(500)) // the proxy's generic 500 at ~30 s
      .mockResolvedValueOnce(response(201, op('COMPLETED'))); // the replay: the SAME operation
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-A');
    expect(out.ok).toBe(true);
    expect(out.ok && out.value.status).toBe('COMPLETED');
    expect(sentKeys()).toEqual(['key-A', 'key-A']);
  });

  it('a replay that finds the operation still RUNNING follows it through the owner-scoped operation read', async () => {
    fetchMock
      .mockResolvedValueOnce(response(502))
      .mockResolvedValueOnce(response(201, op('RUNNING')))
      .mockResolvedValueOnce(response(200, op('RUNNING')))
      .mockResolvedValueOnce(response(200, op('COMPLETED')));
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-B');
    expect(out.ok && out.value.status).toBe('COMPLETED');
    expect(sentKeys()).toEqual(['key-B', 'key-B']);
    const reads = fetchMock.mock.calls.filter(([p]) => p === '/ask-v2/operations/op-1');
    expect(reads.length).toBe(2);
    expect(reads.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
});

describe('P0 · post-dispatch disconnection', () => {
  it('a dropped connection (fetch rejects) is recovered from the same key; a refused-then-recovered network still sends ONE key', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response(201, op('COMPLETED')));
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-C');
    expect(out.ok).toBe(true);
    expect(new Set(sentKeys())).toEqual(new Set(['key-C']));
  });
});

describe('P0 · genuine pre-dispatch failure', () => {
  const nav = globalThis as unknown as { navigator?: { onLine: boolean } };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  afterEach(() => {
    if (had) Object.defineProperty(globalThis, 'navigator', had);
    else delete nav.navigator;
  });
  it('offline before sending: nothing is sent, the outcome is NETWORK, and the copy may truthfully say nothing ran', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-D');
    expect(out).toEqual({ ok: false, reason: 'NETWORK' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('P0 · nothing can be confirmed', () => {
  it('UNCONFIRMED — never "nothing ran" — and the reader\'s retry of the same question reuses the SAME key', async () => {
    fetchMock.mockResolvedValue(response(504));
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-E');
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('UNCONFIRMED');
    expect(posts()).toBe(1 + SUBMIT_RECOVERY.replayDelaysMs.length);
    for (const locale of ['en', 'pl'] as const) {
      const s = getAskR2Strings(locale);
      const copy = failedTurnCopy('UNCONFIRMED', s);
      expect(copy).toBe(s.timedOut);
      expect(copy).not.toBe(s.unavailable);
      expect(copy).not.toBe(s.r3.networkFailed);
    }
    expect(failedTurnCopy('UNCONFIRMED', getAskR2Strings('en'))).not.toMatch(/nothing was run/i);

    /* the hook passes a FRESH key on the reader's next Send; the kept one is used instead */
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(response(201, op('COMPLETED')));
    const retry = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-FRESH');
    expect(retry.ok).toBe(true);
    expect(sentKeys()).toEqual(['key-E']);

    /* once confirmed, the kept key is released: a later, new question uses its own key */
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(response(201, op('COMPLETED')));
    await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-NEXT');
    expect(sentKeys()).toEqual(['key-NEXT']);
  });

  it('a kept key is only for the SAME submission: another question or thread uses its own key', async () => {
    fetchMock.mockResolvedValue(response(504));
    await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-F');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(response(201, op('COMPLETED')));
    await askV2Api.submit('t-1', 'What is inflation?', 'en', 'ask', 'key-G');
    await askV2Api.submit('t-2', QUESTION, 'en', 'ask', 'key-H');
    expect(fetchMock.mock.calls.map(([, init]) => (init?.body as { idempotencyKey: string }).idempotencyKey)).toEqual([
      'key-G',
      'key-H',
    ]);
  });

  it('an operation still running past the bounded window is UNCONFIRMED (the next Send re-reads it by key)', async () => {
    fetchMock.mockResolvedValueOnce(response(500)).mockResolvedValue(response(201, op('RUNNING')));
    fetchMock.mockImplementation(async (path) =>
      path === TURN_PATH ? response(201, op('RUNNING')) : response(200, op('RUNNING')),
    );
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-I');
    expect(!out.ok && out.reason).toBe('UNCONFIRMED');
    expect(clock).toBeGreaterThanOrEqual(SUBMIT_RECOVERY.settleDeadlineMs);
  });
});

describe('P0 · definitive outcomes are unchanged', () => {
  it.each([
    [429, { code: 'ASK_RATE_LIMITED' }],
    [403, undefined],
    [409, undefined],
    [503, { code: 'ASK_UNAVAILABLE' }],
  ])('HTTP %s is returned as it was, with no replay', async (status, body) => {
    fetchMock.mockResolvedValueOnce(response(status, body));
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-J');
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('REFUSED');
    expect(posts()).toBe(1);
  });
  it('a 401 stays SIGNED_OUT with no replay', async () => {
    fetchMock.mockResolvedValueOnce(response(401));
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'ask', 'key-K');
    expect(!out.ok && out.reason).toBe('SIGNED_OUT');
    expect(posts()).toBe(1);
  });
  it('a deep quote (requiresAcceptance) is returned at once — recovery never accepts or executes anything', async () => {
    fetchMock.mockResolvedValueOnce(response(201, op('QUOTED', { requiresAcceptance: true })));
    const out = await askV2Api.submit('t-1', QUESTION, 'en', 'deep-analysis', 'key-L');
    expect(out.ok && out.value.status).toBe('QUOTED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('the classification: only NETWORK and an untyped 500/502/503/504 are ambiguous', () => {
    expect(isAmbiguousSubmitFailure({ ok: false, reason: 'NETWORK' })).toBe(true);
    expect(isAmbiguousSubmitFailure({ ok: false, reason: 'REFUSED', status: 500 })).toBe(true);
    expect(isAmbiguousSubmitFailure({ ok: false, reason: 'REFUSED', status: 503, code: 'X_Y_Z' })).toBe(false);
    expect(isAmbiguousSubmitFailure({ ok: false, reason: 'REFUSED', status: 400 })).toBe(false);
    expect(isAmbiguousSubmitFailure({ ok: false, reason: 'SIGNED_OUT', status: 401 })).toBe(false);
  });
});

describe('P0 · guest boundary', () => {
  it('a guest submission recovers through the GUEST operation read, never the account one, with the guest header and one key', async () => {
    const guestPath = '/ask-v2/guest/threads/g-1/turns';
    fetchMock
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(201, op('RUNNING')))
      .mockResolvedValueOnce(response(200, op('COMPLETED')));
    const out = await askV2Api.guestSubmit('g-1', 'What is inflation?', 'en', 'key-M');
    expect(out.ok && out.value.status).toBe('COMPLETED');
    const calls = fetchMock.mock.calls;
    const guestPosts = calls.filter(([p]) => p === guestPath);
    expect(guestPosts.map(([, init]) => (init?.body as { idempotencyKey: string }).idempotencyKey)).toEqual([
      'key-M',
      'key-M',
    ]);
    expect(guestPosts.every(([, init]) => (init?.headers as Record<string, string>)['X-Requested-With'] === 'globalnews-ask')).toBe(true);
    expect(calls.some(([p]) => p === '/ask-v2/guest/operations/op-1')).toBe(true);
    expect(calls.some(([p]) => String(p).startsWith('/ask-v2/operations/'))).toBe(false);
  });
});

describe('P0 · the accepted deep run (execute) behind the same proxy', () => {
  const EXEC = '/ask-v2/operations/op-1/execute';
  it('a proxy 500 on execute is replayed (server-idempotent) and followed to the settled answer', async () => {
    fetchMock
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(201, op('RUNNING', { requiresAcceptance: true })))
      .mockResolvedValueOnce(response(200, op('COMPLETED', { requiresAcceptance: true })));
    const out = await askV2Api.execute('op-1');
    expect(out.ok && out.value.status).toBe('COMPLETED');
    expect(fetchMock.mock.calls.filter(([p]) => p === EXEC).length).toBe(2);
  });
  it('unprovable → UNCONFIRMED, never "nothing ran"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const out = await askV2Api.execute('op-1');
    expect(!out.ok && out.reason).toBe('UNCONFIRMED');
  });
  it('a typed refusal on execute is returned unchanged with no replay', async () => {
    fetchMock.mockResolvedValueOnce(response(409, { code: 'QUOTE_EXPIRED' }));
    const out = await askV2Api.execute('op-1');
    expect(!out.ok && out.reason).toBe('REFUSED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
