import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { askR2Strings } from '@/lib/ask/askR2Strings';

/**
 * ASK GUEST TRIAL R3 — the /ask frame for a first-visit guest, with `fetch` mocked AT THE WIRE:
 * every request is recorded by method and path, and the server's answers are scripted. Proves
 * the client only mirrors the server, never runs research on open, keeps the draft on every
 * refusal, and continues the conversation through sign-in without putting anything identifying
 * in a URL.
 */

jest.mock('./askDashboard.module.css', () => new Proxy({}, { get: (_t, k) => String(k) }));
let search = '';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/ask',
}));

type Call = { method: string; path: string; headers: Record<string, string>; body?: unknown };
let calls: Call[] = [];
let script: (c: Call) => { status: number; body: unknown };
const store = new Map<string, string>();
const assign = jest.fn();

const OP = (id: string, state = 'CURRENT_REPORTING', basis = 'REQUIRED_EVIDENCE_OBTAINED') => ({
  operationId: id,
  turnId: `turn-${id}`,
  status: 'COMPLETED',
  computeClass: 'FRESH_BOUNDED',
  requiresAcceptance: false,
  result: {
    payload: {
      schema: 'ask-r2-result/1',
      route: {
        questionClass: 'CURRENT_REPORTING',
        terminalState: 'EXECUTABLE',
        scopedBy: 'TYPED_GEOGRAPHY',
        refusals: [],
        disclosures: [],
        clarification: [],
        normalization: 'QUALIFIED',
        questionLanguage: 'en',
      },
      chips: { kind: 'NONE' },
      answer: { state, basis, missingRoles: [] },
      aiExecuted: true,
      modelPriorCitable: false,
      analysis: null,
      checkedAt: '2026-09-30T10:00:00Z',
    },
    expired: false,
  },
});

function installBrowser(): void {
  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.document = { cookie: 'gna_csrf=guest-csrf', querySelector: () => null };
  g.innerHeight = 800;
  g.location = { search, pathname: '/ask', assign };
  g.history = { length: 1, back: jest.fn() };
  g.addEventListener = () => undefined;
  g.removeEventListener = () => undefined;
  g.requestAnimationFrame = () => 0;
  g.cancelAnimationFrame = () => undefined;
  g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  g.getComputedStyle = () => ({
    lineHeight: '23px',
    paddingTop: '0px',
    paddingBottom: '0px',
    borderTopWidth: '0px',
    borderBottomWidth: '0px',
    fontSize: '16px',
    getPropertyValue: () => '',
  });
  g.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  g.fetch = jest.fn(
    async (
      input: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string },
    ) => {
      const call: Call = {
        method: init?.method ?? 'GET',
        path: String(input).replace(/^https?:\/\/[^/]+/, ''),
        headers: init?.headers ?? {},
        ...(init?.body ? { body: JSON.parse(init.body) } : {}),
      };
      calls.push(call);
      const { status, body } = script(call);
      return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
    },
  );
}

const nodeMock = () => ({
  value: '',
  clientWidth: 600,
  offsetWidth: 600,
  style: { setProperty() {} },
  scrollHeight: 0,
  scrollTop: 0,
  clientHeight: 0,
  focus() {},
  getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0, width: 0 }),
});

const settle = () => new Promise((res) => setTimeout(res, 30));

async function render(locale: 'en' | 'pl' = 'en'): Promise<ReactTestRenderer> {
  const { AskFrameScreen } = await import('./AskFrameScreen');
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(AskFrameScreen, { locale }), { createNodeMock: nodeMock });
    await settle();
  });
  return r;
}
async function ask(r: ReactTestRenderer, question: string): Promise<void> {
  const input = r.root.find((n) => n.props['data-ask'] === 'composer-input');
  await act(async () => input.props.onChange({ target: { value: question } }));
  const form = r.root.find((n) => n.type === 'form' && n.props['data-ask'] === 'composer');
  await act(async () => {
    form.props.onSubmit({ preventDefault() {} });
    await settle();
  });
}
const text = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());
const byAsk = (r: ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props['data-ask'] === id && typeof n.type === 'string');
const composerValue = (r: ReactTestRenderer) =>
  r.root.find((n) => n.props['data-ask'] === 'composer-input').props.value as string;
const posts = () => calls.filter((c) => c.method !== 'GET');

/** A scripted guest server: `committed` moves only when the scripted answer counts. */
function guestServer(
  opts: { committed?: number; answers?: Array<'count' | 'nocount' | number> } = {},
) {
  let committed = opts.committed ?? 0;
  const answers = [...(opts.answers ?? [])];
  let n = 0;
  return (c: Call): { status: number; body: unknown } => {
    if (c.path === '/api/ask-v2/guest/status') {
      return {
        status: 200,
        body: {
          signedIn: false,
          available: true,
          session: committed > 0 || n > 0 ? { expiresAt: '2026-10-07T00:00:00Z' } : null,
          allowance: 3,
          remaining: 3 - committed,
          committed,
          reserved: 0,
          state: committed >= 3 ? 'EXHAUSTED' : 'OPEN',
          cooldownUntil: null,
        },
      };
    }
    if (c.path === '/api/ask-v2/guest/threads' && c.method === 'GET')
      return { status: 200, body: [] };
    if (c.path === '/api/ask-v2/guest/threads' && c.method === 'POST')
      return { status: 201, body: { id: 'thread-g', language: 'en' } };
    if (c.path.endsWith('/turns') && c.method === 'POST') {
      const next = answers.shift() ?? 'count';
      if (typeof next === 'number')
        return {
          status: next,
          body: {
            code: next === 409 ? 'GUEST_TRIAL_EXHAUSTED' : 'GUEST_COOLDOWN',
            retryAfterS: 60,
          },
        };
      n += 1;
      if (next === 'count') committed += 1;
      return {
        status: 201,
        body:
          next === 'count' ? OP(`op-${n}`) : OP(`op-${n}`, 'INSUFFICIENT', 'NO_ANSWER_PRODUCED'),
      };
    }
    if (c.path === '/api/ask-v2/guest/claim') return { status: 201, body: { claimed: true } };
    return { status: 401, body: {} };
  };
}

beforeEach(() => {
  calls = [];
  store.clear();
  search = '';
  assign.mockReset();
  installBrowser();
});

const EN = askR2Strings('en').guest;
const PL = askR2Strings('pl').guest;

describe('ASK GUEST TRIAL R3 — first visit', () => {
  it('shows the restrained intro and "3 guest questions remaining" — and opening sends only ONE read', async () => {
    script = guestServer();
    const r = await render();
    expect(text(r)).toContain(EN.intro);
    expect(text(r)).toContain(EN.remaining(3));
    expect(text(r)).toContain(EN.privacy);
    expect(calls).toEqual([
      expect.objectContaining({ method: 'GET', path: '/api/ask-v2/guest/status' }),
    ]);
    expect(posts()).toHaveLength(0);
  });

  it('a first question goes to the GUEST surface (never the account route, never legacy analysis) and the counter moves after the answer', async () => {
    script = guestServer();
    const r = await render();
    await ask(r, 'What has changed in Kenya’s economy?');
    expect(posts().map((c) => c.path)).toEqual([
      '/api/ask-v2/guest/threads',
      '/api/ask-v2/guest/threads/thread-g/turns',
    ]);
    expect(posts()[0].headers['X-Requested-With']).toBe('globalnews-ask');
    expect(posts()[1].headers['X-CSRF-Token']).toBe('guest-csrf');
    expect(calls.some((c) => c.path.includes('/analysis/news'))).toBe(false);
    expect(calls.some((c) => c.path === '/api/ask-v2/threads')).toBe(false);
    expect(text(r)).toContain(EN.remaining(2));
    expect(byAsk(r, 'guest-not-counted')).toHaveLength(0);
    /* Saving is an account feature: a guest answer shows no Save control. */
    expect(byAsk(r, 'save')).toHaveLength(0);
  });

  it('an answer that did not count says so, and the counter stays', async () => {
    script = guestServer({ answers: ['nocount'] });
    const r = await render();
    await ask(r, 'What is happening?');
    expect(text(r)).toContain(EN.notCounted);
    expect(text(r)).toContain(EN.remaining(3));
  });

  it('after the third answer: the continuation sits BELOW the answer; the fourth is refused and its draft stays', async () => {
    script = guestServer({ committed: 2, answers: ['count', 409] });
    const r = await render();
    await ask(r, 'Third question?');
    expect(text(r)).toContain(EN.exhaustedBody);
    expect(text(r)).toContain(EN.continueAction);
    /* The completed third answer is still rendered (nothing hidden or blurred). */
    expect(byAsk(r, 'guest-continue')).toHaveLength(1);
    await ask(r, 'Fourth question?');
    expect(composerValue(r)).toBe('Fourth question?');
    expect(text(r)).toContain(EN.exhaustedBody);
  });

  it('"Sign in to continue" claims THIS conversation, keeps the draft, and puts nothing identifying in the URL', async () => {
    script = guestServer({ committed: 2, answers: ['count'] });
    const r = await render();
    await ask(r, 'Third question?');
    const input = r.root.find((n) => n.props['data-ask'] === 'composer-input');
    await act(async () => input.props.onChange({ target: { value: 'My unsent fourth question' } }));
    const button = r.root.find((n) => n.props['data-ask'] === 'guest-sign-in');
    await act(async () => {
      button.props.onClick();
      await settle();
    });
    const claim = calls.find((c) => c.path === '/api/ask-v2/guest/claim');
    expect(claim?.body).toEqual({ threadId: 'thread-g' });
    expect(store.get('globalnews-ai:ask-kept-question')).toBe('My unsent fourth question');
    expect(assign).toHaveBeenCalledWith('/api/auth/google?returnTo=%2Fask&intent=ask-guest');
    const target = String(assign.mock.calls[0][0]);
    for (const secret of ['thread-g', 'unsent', 'claim', 'guest-csrf'])
      expect(target).not.toContain(secret);
  });

  it('a cooldown is a temporary limitation, never "you used your questions"; the draft stays', async () => {
    script = guestServer({ answers: [429] });
    const r = await render();
    await ask(r, 'Another?');
    expect(text(r)).toContain(EN.cooldown);
    expect(text(r)).not.toContain(EN.exhaustedBody);
    expect(composerValue(r)).toBe('Another?');
  });

  it('back from a cancelled guest sign-in: the conversation is said to be still here; nothing is sent', async () => {
    search = 'auth_error=cancelled';
    installBrowser();
    script = guestServer();
    const r = await render();
    expect(text(r)).toContain(EN.cancelled);
    expect(posts()).toHaveLength(0);
  });

  it('signed in after a claim: the continued conversation is READ back (no request that can run anything)', async () => {
    script = (c) => {
      if (c.path === '/api/ask-v2/guest/status')
        return { status: 200, body: { signedIn: true, available: false } };
      if (c.path === '/api/ask-v2/continuation')
        return { status: 200, body: { threadId: 'thread-g' } };
      if (c.path === '/api/ask-v2/threads/thread-g')
        return {
          status: 200,
          body: {
            id: 'thread-g',
            language: 'en',
            turns: [{ id: 't1', sequence: 1, question: 'What changed?', operationId: 'op-1' }],
          },
        };
      if (c.path === '/api/ask-v2/operations/op-1') return { status: 200, body: OP('op-1') };
      return { status: 404, body: {} };
    };
    store.set('globalnews-ai:ask-kept-question', 'My unsent fourth question');
    const r = await render();
    expect(text(r)).toContain('What changed?');
    expect(text(r)).toContain(EN.resumed);
    /* Signed in, the continued answer can be saved again. */
    expect(byAsk(r, 'save')).toHaveLength(1);
    expect(composerValue(r)).toBe('My unsent fourth question');
    expect(posts()).toHaveLength(0);
  });

  it('a guest reload restores its own conversation by reads only', async () => {
    script = (c) => {
      if (c.path === '/api/ask-v2/guest/status')
        return {
          status: 200,
          body: {
            signedIn: false,
            available: true,
            session: { expiresAt: 'x' },
            allowance: 3,
            remaining: 2,
            committed: 1,
            reserved: 0,
            state: 'OPEN',
          },
        };
      if (c.path === '/api/ask-v2/guest/threads')
        return {
          status: 200,
          body: [
            {
              id: 'thread-g',
              language: 'en',
              createdAt: 'x',
              lastActiveAt: 'x',
              firstQuestion: 'Q1',
            },
          ],
        };
      if (c.path === '/api/ask-v2/guest/threads/thread-g')
        return {
          status: 200,
          body: {
            id: 'thread-g',
            language: 'en',
            turns: [{ id: 't1', sequence: 1, question: 'Q1 restored', operationId: 'op-1' }],
          },
        };
      if (c.path === '/api/ask-v2/guest/operations/op-1') return { status: 200, body: OP('op-1') };
      return { status: 404, body: {} };
    };
    const r = await render();
    expect(text(r)).toContain('Q1 restored');
    expect(text(r)).toContain(EN.remaining(2));
    expect(posts()).toHaveLength(0);
  });

  it('PL: the intro, the counter plurals and the continuation copy', async () => {
    script = guestServer();
    const r = await render('pl');
    expect(text(r)).toContain(PL.intro);
    expect(text(r)).toContain('Pozostały 3 pytania gościa');
    expect(PL.remaining(1)).toBe('Pozostało 1 pytanie gościa');
    expect(PL.remaining(2)).toBe('Pozostały 2 pytania gościa');
    expect(PL.remaining(0)).toBe('Pozostało 0 pytań gościa');
    expect(PL.remaining(5)).toBe('Pozostało 5 pytań gościa');
    expect(PL.exhaustedBody).toBe(
      'Wykorzystano 3 pytania gościa. Zaloguj się, aby kontynuować tę rozmowę i zachować odpowiedzi.',
    );
    expect(EN.remaining(1)).toBe('1 guest question remaining');
  });

  it('the guest trial off: the landed sign-in requirement, unchanged', async () => {
    script = (c) =>
      c.path === '/api/ask-v2/guest/status'
        ? { status: 200, body: { signedIn: false, available: false, session: null } }
        : { status: 401, body: {} };
    const r = await render();
    expect(text(r)).not.toContain(EN.intro);
    await ask(r, 'Who was Hitler?');
    expect(byAsk(r, 'sign-in-required')).toHaveLength(1);
    expect(posts().map((c) => c.path)).toEqual(['/api/ask-v2/threads']);
  });
});
