import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * ASK R2 SIGNED-OUT FALLBACK REMOVAL R1 — the live Alpha defect, end to end on the REAL
 * /ask frame, with `fetch` mocked AT THE WIRE so every request is counted by path:
 *
 *   POST /api/ask-v2/threads → 401   was followed by   POST /api/analysis/news → 201
 *
 * A signed-out reader's question must go nowhere else: no legacy news analysis, no
 * provider, no model. The reader sees a sign-in requirement, with the question kept.
 * The governed rollback (Ask V2 disabled → 404) still takes the existing Ask path.
 */
/* This jest config has no CSS transform; the class map is irrelevant to what is counted. */
jest.mock('./askDashboard.module.css', () => new Proxy({}, { get: (_t, k) => String(k) }));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/ask',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

type Call = { method: string; path: string };
let calls: Call[] = [];
/*
  ASK GUEST TRIAL R3 — /ask now makes ONE read-only GET /ask-v2/guest/status on open (0 AI,
  0 provider, no session minted) so a first-visit guest can be told whether it may ask. It is
  excluded from the request lists below, and asserted separately to be a GET and nothing more.
  Here it answers 503, i.e. the guest trial is NOT available — the landed signed-out behaviour.
*/
const GUEST_STATUS = '/api/ask-v2/guest/status';
const askCalls = (): Call[] => calls.filter((c) => c.path !== GUEST_STATUS);
let threadsStatus = 401;
const store = new Map<string, string>();

function installBrowser(): void {
  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.document = { cookie: '' };
  g.innerHeight = 800;
  g.location = { search: '', pathname: '/ask', assign: jest.fn() };
  g.history = { length: 1, back: jest.fn() };
  g.addEventListener = () => undefined;
  g.removeEventListener = () => undefined;
  /* Layout measurement is irrelevant here; a live rAF loop would only keep the test alive. */
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
  g.fetch = jest.fn(async (input: string, init?: { method?: string }) => {
    const path = String(input).replace(/^https?:\/\/[^/]+/, '');
    calls.push({ method: init?.method ?? 'GET', path });
    if (path.endsWith('/ask-v2/threads')) {
      return { ok: false, status: threadsStatus, json: async () => ({}) } as Response;
    }
    return { ok: false, status: 503, json: async () => ({}) } as Response;
  });
}

const nodeMock = () => ({
  value: '',
  clientWidth: 600,
  offsetWidth: 600,
  style: { setProperty() {} },
  scrollHeight: 0,
  scrollTop: 0,
  clientHeight: 0,
  getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0, width: 0 }),
});

async function renderAndAsk(question: string, locale: 'en' | 'pl'): Promise<ReactTestRenderer> {
  const { AskFrameScreen } = await import('./AskFrameScreen');
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(AskFrameScreen, { locale }), { createNodeMock: nodeMock });
  });
  const input = r.root.find((n) => n.props['data-ask'] === 'composer-input');
  await act(async () => input.props.onChange({ target: { value: question } }));
  const form = r.root.find((n) => n.type === 'form' && n.props['data-ask'] === 'composer');
  await act(async () => {
    form.props.onSubmit({ preventDefault() {} });
    await new Promise((res) => setTimeout(res, 20));
  });
  return r;
}
const text = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());
const byAsk = (r: ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props['data-ask'] === id && typeof n.type === 'string');

beforeEach(() => {
  calls = [];
  store.clear();
  threadsStatus = 401;
  installBrowser();
});

describe('POST /ask-v2/threads → 401 can never cause POST /analysis/news', () => {
  it.each(['en', 'pl'] as const)(
    '%s: one Ask V2 request, zero legacy analysis requests',
    async (locale) => {
      await renderAndAsk('Who was Hitler?', locale);
      expect(askCalls()).toEqual([{ method: 'POST', path: '/api/ask-v2/threads' }]);
      expect(calls.filter((c) => c.path === GUEST_STATUS).every((c) => c.method === 'GET')).toBe(
        true,
      );
      expect(calls.some((c) => c.path.includes('/analysis/news'))).toBe(false);
      expect(calls.some((c) => c.path.includes('/turns'))).toBe(false);
    },
  );

  it('a second Send while signed out still never reaches the legacy path', async () => {
    const r = await renderAndAsk('Who was Hitler?', 'en');
    const form = r.root.find((n) => n.type === 'form' && n.props['data-ask'] === 'composer');
    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
      await new Promise((res) => setTimeout(res, 20));
    });
    expect(calls.filter((c) => c.path.endsWith('/ask-v2/threads'))).toHaveLength(2);
    expect(calls.some((c) => c.path.includes('/analysis/news'))).toBe(false);
  });
});

describe('the reader sees a sign-in requirement — never a reporting failure', () => {
  it.each([
    ['en', 'SIGN-IN REQUIRED', 'Sign in to ask GlobalNewsAI.', 'Sign in to ask'],
    [
      'pl',
      'WYMAGANE LOGOWANIE',
      'Zaloguj się, aby zapytać GlobalNewsAI.',
      'Zaloguj się, aby zapytać',
    ],
  ] as const)('%s', async (locale, title, body, action) => {
    const r = await renderAndAsk('Who was Hitler?', locale);
    const panel = byAsk(r, 'sign-in-required');
    expect(panel).toHaveLength(1);
    const html = text(r);
    expect(html).toContain(title);
    expect(html).toContain(body);
    const link = byAsk(r, 'sign-in')[0];
    expect(link.props.href).toBe('/api/auth/google?returnTo=%2Fask');
    expect(html).toContain(action);
    /* The legacy path's words never appear: no live-reporting failure, no pipeline error. */
    expect(html).not.toMatch(/live reporting|reporting unavailable|doniesie[nń] na żywo/i);
    expect(byAsk(r, 'turn')).toHaveLength(0);
  });

  it('the question is kept in the composer and survives the sign-in round trip', async () => {
    const r = await renderAndAsk('Who was Hitler?', 'en');
    const input = r.root.find((n) => n.props['data-ask'] === 'composer-input');
    expect(input.props.value).toBe('Who was Hitler?');
    await act(async () => byAsk(r, 'sign-in')[0].props.onClick());
    expect(store.get('globalnews-ai:ask-kept-question')).toBe('Who was Hitler?');

    /* Back from sign-in: the draft returns once, nothing is sent. */
    calls = [];
    const { AskFrameScreen } = await import('./AskFrameScreen');
    let back!: ReactTestRenderer;
    await act(async () => {
      back = create(createElement(AskFrameScreen, { locale: 'en' }), { createNodeMock: nodeMock });
    });
    const again = back.root.find((n) => n.props['data-ask'] === 'composer-input');
    expect(again.props.value).toBe('Who was Hitler?');
    expect(store.has('globalnews-ai:ask-kept-question')).toBe(false);
    expect(askCalls()).toEqual([]);
  });
});

describe('the governed rollback is kept: Ask V2 disabled (404) still uses the existing Ask', () => {
  it('404 → the question goes down the existing path, and no sign-in state is shown', async () => {
    threadsStatus = 404;
    const r = await renderAndAsk('What is happening in Kenya?', 'en');
    expect(askCalls()[0]).toEqual({ method: 'POST', path: '/api/ask-v2/threads' });
    expect(calls.some((c) => c.path.endsWith('/analysis/news'))).toBe(true);
    expect(byAsk(r, 'sign-in-required')).toHaveLength(0);
  });
});
