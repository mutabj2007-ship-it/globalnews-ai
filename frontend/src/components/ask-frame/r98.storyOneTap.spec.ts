import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
/**
 * MASTER CTO R98 (PO iPhone proof, 15 Oct 2026) — "Explain a story": ONE explicit tap on the held
 * form's primary action asks the reader's words, once, through the ordinary Ask submission.
 *
 * The /ask frame with `fetch` mocked AT THE WIRE (no provider, model or paid call), proving:
 *   · opening the form, typing, Enter and Close send nothing;
 *   · one tap → exactly ONE turn POST carrying the reader's exact words (no prefix), the form closes
 *     and no unsent copy is left in the Ask box;
 *   · a rapid double tap still sends once;
 *   · an unsent question already in the Ask box is kept untouched;
 *   · a refused ask (signed out) keeps the words: back in the Ask box when it is free, otherwise back
 *     in the reopened form.
 */
jest.mock('./askDashboard.module.css', () => new Proxy({}, { get: (_t, k) => String(k) }));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/ask',
}));

type Call = { method: string; path: string; body?: unknown };
let calls: Call[] = [];
let signedIn = true;
let threadsCreated = 0;
const frames: Array<() => void> = [];
const flushFrames = (): void => {
  for (const frame of frames.splice(0)) {
    try {
      frame();
    } catch {
      /* a layout callback with no real DOM behind it */
    }
  }
};

const OP = (id: string, threadId: string) => ({
  operationId: id,
  turnId: `turn-${id}`,
  threadId,
  language: 'en',
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
      answer: { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles: ['REPORTING'] },
      aiExecuted: false,
      modelPriorCitable: false,
      analysis: null,
      checkedAt: '2026-10-15T10:00:00Z',
    },
    expired: false,
  },
});

function server(c: Call): { status: number; body: unknown } {
  if (c.path === '/api/ask-v2/guest/status') return { status: 200, body: { signedIn, available: false } };
  if (c.path === '/api/ask-v2/continuation') return { status: 200, body: { threadId: null } };
  if (c.path === '/api/ask-v2/threads' && c.method === 'POST') {
    if (!signedIn) return { status: 401, body: { statusCode: 401, message: 'Unauthorized' } };
    threadsCreated += 1;
    return { status: 201, body: { id: `thread-${threadsCreated}`, language: 'en', returnPath: null } };
  }
  const turn = c.path.match(/^\/api\/ask-v2\/threads\/(thread-\d+)\/turns$/);
  if (turn !== null && c.method === 'POST') {
    if (!signedIn) return { status: 401, body: { statusCode: 401, message: 'Unauthorized' } };
    return { status: 201, body: OP(`op-${calls.length}`, turn[1]) };
  }
  return { status: 404, body: {} };
}

function installBrowser(): void {
  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.document = { cookie: 'gna_csrf=csrf', querySelector: () => null };
  g.innerHeight = 800;
  g.location = { search: '', pathname: '/ask', assign: jest.fn() };
  g.history = { length: 1, back: jest.fn(), state: null, replaceState: jest.fn() };
  g.addEventListener = () => undefined;
  g.removeEventListener = () => undefined;
  frames.length = 0;
  g.requestAnimationFrame = (cb: () => void) => frames.push(cb);
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
  const store = new Map<string, string>();
  g.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  g.fetch = jest.fn(async (input: string, init?: { method?: string; body?: string }) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      path: String(input).replace(/^https?:\/\/[^/]+/, ''),
      ...(init?.body ? { body: JSON.parse(init.body) } : {}),
    };
    calls.push(call);
    const { status, body } = server(call);
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
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
  focus() {},
  setAttribute() {},
  removeAttribute() {},
  getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0, width: 0 }),
});
const settle = () => new Promise((res) => setTimeout(res, 30));
const byAsk = (r: ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props['data-ask'] === id && typeof n.type === 'string');
const composerValue = (r: ReactTestRenderer) =>
  r.root.find((n) => n.props['data-ask'] === 'composer-input').props.value as string;
const writes = () => calls.filter((c) => c.method !== 'GET');
const turnPosts = () => calls.filter((c) => c.method === 'POST' && /\/turns$/.test(c.path));

async function render(): Promise<ReactTestRenderer> {
  const { AskFrameScreen } = await import('./AskFrameScreen');
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(AskFrameScreen, { locale: 'en' }), { createNodeMock: nodeMock });
    await settle();
  });
  return r;
}
async function typeInComposer(r: ReactTestRenderer, text: string): Promise<void> {
  const input = r.root.find((n) => n.props['data-ask'] === 'composer-input');
  await act(async () => input.props.onChange({ target: { value: text } }));
}
async function openStoryForm(r: ReactTestRenderer): Promise<void> {
  await act(async () => {
    byAsk(r, 'cue-g2')[0]!.props.onClick();
    await settle();
  });
  expect(byAsk(r, 'story-picker')).toHaveLength(1);
}
async function describe_(r: ReactTestRenderer, text: string): Promise<void> {
  await act(async () => byAsk(r, 'picker-describe')[0]!.props.onChange({ target: { value: text } }));
}
async function tapAsk(r: ReactTestRenderer, times = 1): Promise<void> {
  await act(async () => {
    const cta = byAsk(r, 'picker-continue')[0]!;
    for (let i = 0; i < times; i += 1) cta.props.onClick();
    await settle();
    flushFrames();
    await settle();
  });
}

beforeEach(() => {
  calls = [];
  signedIn = true;
  threadsCreated = 0;
  installBrowser();
});

describe('MASTER CTO R98 — the held "Explain a story" form asks with ONE explicit tap', () => {
  it('opening the form and typing send nothing; one tap sends ONE turn with the exact words and closes the form', async () => {
    const r = await render();
    const before = writes().length;
    await openStoryForm(r);
    await describe_(r, "What's happening in Poland?");
    expect(writes().length).toBe(before); /* opening + typing: no request of any kind */
    expect(byAsk(r, 'picker-continue')[0]!.props['data-staged']).toBe('ask');

    await tapAsk(r);
    expect(turnPosts()).toHaveLength(1);
    expect(JSON.stringify(turnPosts()[0]!.body)).toContain("What's happening in Poland?");
    expect(JSON.stringify(turnPosts()[0]!.body)).not.toContain('Explain this story');
    expect(byAsk(r, 'story-picker')).toHaveLength(0); /* the form closed */
    expect(composerValue(r)).toBe(''); /* no unsent copy needing a second Send */
  });

  it('a rapid double tap sends exactly once', async () => {
    const r = await render();
    await openStoryForm(r);
    await describe_(r, 'fuel prices in Kigali');
    await tapAsk(r, 2);
    expect(turnPosts()).toHaveLength(1);
  });

  it('Close, Escape-free close and an empty form send nothing', async () => {
    const r = await render();
    const before = writes().length;
    await openStoryForm(r);
    /* empty: the action is the way back into Ask, staging nothing and sending nothing */
    expect(byAsk(r, 'picker-continue')[0]!.props['data-staged']).toBe('none');
    await tapAsk(r);
    await openStoryForm(r);
    await describe_(r, 'something');
    await act(async () => byAsk(r, 'picker-close')[0]!.props.onClick());
    expect(writes().length).toBe(before);
  });

  it('an unsent question already in the Ask box is KEPT untouched; the story is asked separately', async () => {
    const r = await render();
    await typeInComposer(r, 'What changed in Rwanda?');
    await openStoryForm(r);
    await describe_(r, 'fuel prices in Kigali');
    expect(byAsk(r, 'picker-draft-kept')).toHaveLength(1); /* "Your unsent question stays in the Ask box." */
    await tapAsk(r);
    expect(turnPosts()).toHaveLength(1);
    expect(JSON.stringify(turnPosts()[0]!.body)).toContain('fuel prices in Kigali');
    expect(composerValue(r)).toBe('What changed in Rwanda?');
  });

  it('signed out: nothing runs, and the words come back into the free Ask box', async () => {
    signedIn = false;
    const r = await render();
    await openStoryForm(r);
    await describe_(r, 'fuel prices in Kigali');
    await tapAsk(r);
    expect(threadsCreated).toBe(0); /* nothing was created or run for a signed-out reader */
    expect(composerValue(r)).toBe('fuel prices in Kigali');
  });

  it('signed out with the Ask box taken: its question is kept AND the story words return in the reopened form', async () => {
    signedIn = false;
    const r = await render();
    await typeInComposer(r, 'What changed in Rwanda?');
    await openStoryForm(r);
    await describe_(r, 'fuel prices in Kigali');
    await tapAsk(r);
    expect(composerValue(r)).toBe('What changed in Rwanda?');
    expect(byAsk(r, 'story-picker')).toHaveLength(1);
    expect(byAsk(r, 'picker-describe')[0]!.props.value).toBe('fuel prices in Kigali');
  });
});
