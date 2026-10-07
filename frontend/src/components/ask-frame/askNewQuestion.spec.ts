import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { askV2Api } from '@/lib/api/askV2Api';

/**
 * ASK DESIGN COMPLETENESS R2 — CTO LIVE MOBILE CORRECTION: "New question" semantics.
 *
 *   existing answer → New question → clean READY state → previous conversation still in Recent
 *
 * The /ask frame with `fetch` mocked AT THE WIRE, for a signed-in reader. Proves that New
 * question clears the active turn and thread locally, empties and focuses the composer, removes
 * the operation/question URL state without a reload, deletes nothing on the server (so Recent
 * still lists the old conversation), starts the next question on a NEW thread, and is disabled —
 * never a simulated reset — while Ask is already empty.
 */

jest.mock('./askDashboard.module.css', () => new Proxy({}, { get: (_t, k) => String(k) }));
let search = '';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/ask',
}));

type Call = { method: string; path: string; body?: unknown };
let calls: Call[] = [];
const replaceState = jest.fn();
const focus = jest.fn();
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
      answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
      aiExecuted: true,
      modelPriorCitable: false,
      analysis: null,
      checkedAt: '2026-10-07T10:00:00Z',
    },
    expired: false,
  },
});

function server(c: Call): { status: number; body: unknown } {
  if (c.path === '/api/ask-v2/guest/status') return { status: 200, body: { signedIn: true, available: false } };
  if (c.path === '/api/ask-v2/continuation') return { status: 200, body: { threadId: null } };
  /* A stored two-turn conversation B → C on thread-9 (opened from the drawer by its latest op). */
  if (c.path === '/api/ask-v2/operations/op-c') return { status: 200, body: { ...OP('op-c', 'thread-9'), question: 'Follow-up C' } };
  if (c.path === '/api/ask-v2/operations/op-b') return { status: 200, body: { ...OP('op-b', 'thread-9'), question: 'Root question B' } };
  if (c.path.startsWith('/api/ask-v2/threads/thread-9') && c.method === 'GET')
    return {
      status: 200,
      body: {
        id: 'thread-9',
        language: 'en',
        turns: [
          { id: 'tb', sequence: 1, question: 'Root question B', operationId: 'op-b' },
          { id: 'tc', sequence: 2, question: 'Follow-up C', operationId: 'op-c' },
        ],
      },
    };
  if (c.path === '/api/ask-v2/threads' && c.method === 'POST') {
    threadsCreated += 1;
    return { status: 201, body: { id: `thread-${threadsCreated}`, language: 'en', returnPath: null } };
  }
  const turn = c.path.match(/^\/api\/ask-v2\/threads\/(thread-\d+)\/turns$/);
  if (turn !== null && c.method === 'POST') return { status: 201, body: OP(`op-${calls.length}`, turn[1]) };
  if (c.path === '/api/ask-v2/threads' && c.method === 'GET') {
    /* Recent: every thread this reader created, newest first — nothing was deleted. */
    return {
      status: 200,
      body: Array.from({ length: threadsCreated }, (_v, i) => ({
        id: `thread-${threadsCreated - i}`,
        language: 'en',
        returnPath: null,
        createdAt: '2026-10-07T10:00:00Z',
        lastActiveAt: '2026-10-07T10:00:00Z',
        turnCount: 1,
        firstQuestion: `question ${threadsCreated - i}`,
        firstQuestionTruncated: false,
        latestTurnId: null,
        latestOperationId: null,
        latestState: 'COMPLETED',
      })),
    };
  }
  return { status: 404, body: {} };
}

function installBrowser(): void {
  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.document = {
    cookie: 'gna_csrf=csrf',
    querySelector: (selector: string) => (selector === '[data-ask="composer-input"]' ? { focus } : null),
  };
  g.innerHeight = 800;
  g.location = { search, pathname: '/ask', assign: jest.fn() };
  g.history = { length: 1, back: jest.fn(), state: null, replaceState };
  g.addEventListener = () => undefined;
  g.removeEventListener = () => undefined;
  /* Frames are QUEUED and flushed explicitly: running them synchronously re-enters the
     textarea's own resize loop. */
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

async function render(): Promise<ReactTestRenderer> {
  const { AskFrameScreen } = await import('./AskFrameScreen');
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(AskFrameScreen, { locale: 'en' }), { createNodeMock: nodeMock });
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

beforeEach(() => {
  calls = [];
  search = '';
  threadsCreated = 0;
  replaceState.mockReset();
  focus.mockReset();
  installBrowser();
});

describe('ASK DESIGN COMPLETENESS R2 — New question', () => {
  it('is disabled in the empty READY state — no simulated reset', async () => {
    const r = await render();
    const [button] = byAsk(r, 'new-question');
    expect(button.props.disabled).toBe(true);
    expect(byAsk(r, 'empty')).toHaveLength(1);
  });

  it('existing answer → New question → clean READY state → previous conversation still in Recent', async () => {
    const r = await render();
    await ask(r, 'What changed in the port dispute?');
    expect(byAsk(r, 'turn')).toHaveLength(1);
    expect(byAsk(r, 'empty')).toHaveLength(0);
    const [button] = byAsk(r, 'new-question');
    expect(button.props.disabled).toBe(false);

    await act(async () => {
      button.props.onClick();
      await settle();
    });

    /* clean READY: no turn, the welcome group back, the composer empty and focused */
    expect(byAsk(r, 'turn')).toHaveLength(0);
    expect(byAsk(r, 'empty')).toHaveLength(1);
    expect(composerValue(r)).toBe('');
    act(() => flushFrames());
    expect(focus).toHaveBeenCalled();
    expect(byAsk(r, 'new-question')[0].props.disabled).toBe(true);
    /* the operation/question URL state is removed in place (no reload, no new history entry) */
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/ask');

    /* nothing was deleted or altered on the server */
    expect(calls.filter((c) => c.method === 'DELETE' || c.method === 'PATCH')).toHaveLength(0);
    /* the previous conversation is still in Recent */
    const recent = await askV2Api.threads();
    expect(recent.ok && recent.value.map((t) => t.id)).toEqual(['thread-1']);

    /* the next question opens a NEW thread, never continuing the cleared one */
    await ask(r, 'A different question');
    const turnPosts = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/turns'));
    expect(turnPosts.map((c) => c.path)).toEqual([
      '/api/ask-v2/threads/thread-1/turns',
      '/api/ask-v2/threads/thread-2/turns',
    ]);
    const after = await askV2Api.threads();
    expect(after.ok && after.value.map((t) => t.id)).toEqual(['thread-2', 'thread-1']);
  });

  it('THREADS, NOT TURNS — reopening B→C from history on the same page restores both, and the next follow-up stays in that thread', async () => {
    const r = await render();
    await ask(r, 'A conversation already on screen');
    expect(byAsk(r, 'turn')).toHaveLength(1);
    /* the drawer row opens the conversation by its latest operation (same route, same frame) */
    search = 'operation=op-c';
    installBrowser();
    const { AskFrameScreen } = await import('./AskFrameScreen');
    await act(async () => {
      r.update(createElement(AskFrameScreen, { locale: 'en' }));
      await settle();
    });
    const shown = JSON.stringify(r.toJSON());
    expect(shown).toContain('Root question B');
    expect(shown).toContain('Follow-up C');
    expect(shown).not.toContain('A conversation already on screen');
    await ask(r, 'Follow-up D');
    const lastTurn = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/turns')).pop();
    expect(lastTurn?.path).toBe('/api/ask-v2/threads/thread-9/turns');
  });

  it('a conversation row is titled by its ROOT question, never its latest follow-up', async () => {
    const { conversationTitle } = await import('./AskConversations');
    const row = {
      firstQuestion: 'What are the import routes into Rwanda?',
      firstQuestionTruncated: false,
      latestQuestion: 'My shipment goes through Dar es Salaam, not Mombasa',
      latestQuestionTruncated: false,
    };
    expect(conversationTitle(row, '—')).toBe('What are the import routes into Rwanda?');
    expect(conversationTitle({ ...row, firstQuestion: null }, '—')).toBe(row.latestQuestion);
    expect(conversationTitle({ ...row, firstQuestion: null, latestQuestion: null }, '—')).toBe('—');
  });

  it('New question from the drawer in the empty READY state only focuses the composer', async () => {
    const r = await render();
    const shell = await import('@/components/ask-nav/AskNavShell');
    expect(typeof shell.useAskNavOptional).toBe('function');
    /* the frame's own handler: nothing to reset, so it focuses */
    const [button] = byAsk(r, 'new-question');
    expect(button.props.disabled).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const frame = readFileSync(require.resolve('./AskFrameScreen.tsx'), 'utf8');
    expect(frame).toMatch(/if \(entryState\) \{\s*focusComposer\(\);\s*return;\s*\}/);
    const list = readFileSync(require.resolve('./AskConversations.tsx'), 'utf8');
    expect(list).toMatch(/if \(nav\.runNewQuestion\(\)\) return;/);
  });

  it('the label is "New question", and the menu control remains the conversations drawer', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const frame = readFileSync(require.resolve('./AskFrameScreen.tsx'), 'utf8');
    expect(frame).toMatch(/data-ask="new-question"[\s\S]*?\{shell\.askNavStrings\.newQuestion\}/);
    expect(frame).toMatch(/disabled=\{entryState \|\| isPending\}/);
    expect(frame).toMatch(/data-ask="shell-menu"[\s\S]*?onClick=\{shellMenu\.onToggle\}/);
  });
});
