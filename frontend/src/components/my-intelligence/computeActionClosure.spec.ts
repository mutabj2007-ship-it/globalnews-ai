import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import type { MyIntelligenceData } from './useMyIntelligenceData';
import type { FixtureStory } from './devFixtures';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE — COMPUTE-ACTION CLOSURE R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The REAL client and the REAL runSelectionAction(). Only the transport is replaced, so every
 * count below is a count of the requests the product would actually send.
 *
 * UNIFIED INTELLIGENCE BINDING R2D — the transport is now the canonical Ask V2 conversation's
 * submit (one Confirm = one Ask V2 turn carrying a SELECTION reference). The conversation is
 * mocked AT ITS BOUNDARY and each submit is recorded in the old argument layout — (question,
 * language, -, -, {action, stories}) — taken from the SELECTION reference, so "exactly one
 * request with exactly these stories" still means what it meant.
 *
 *   enter mode · select · choose action · open sheet · cancel · Clear · Done  → 0
 *   final explicit Run / Send                                               → exactly 1
 */

jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
const mockTransport = jest.fn();
jest.mock('@/lib/ask/useAskR2Conversation', () => ({
  ...jest.requireActual('@/lib/ask/useAskR2Conversation'),
  useAskR2Conversation: (language: string) => ({
    startNewTopic: () => undefined,
    submit: async (
      question: string,
      context: { action: string; stories: unknown },
      onTurn: (turn: unknown) => void,
    ) => {
      try {
        const response = await mockTransport(question, language, undefined, undefined, {
          action: context.action,
          stories: context.stories,
        });
        onTurn({
          question,
          operation: { operationId: 'op-1' },
          payload: {
            schema: 'ask-r2-result/1',
            answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
            analysis: response,
          },
        });
        return 'sent';
      } catch {
        onTurn({ question, failure: 'NETWORK' });
        return 'failed';
      }
    },
  }),
}));
jest.mock('@/components/search/SearchPageClient', () => ({
  resolveAnalysisErrorMessage: () => 'GOVERNED ANALYSIS ERROR COPY',
}));
jest.mock('next/link', () => {
  const react = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children }: { href: string; children: unknown }) => react.createElement('a', { href }, children) };
});
/* The governed reader, stubbed so the spec can see WHICH reader is mounted and with WHAT. */
jest.mock('@/components/ask/AskCompactResult', () => {
  const react = jest.requireActual('react');
  return {
    AskCompactResult: (props: { question: string; showFullAnalysisLink?: boolean; response: AnalysisApiResponse }) =>
      react.createElement('div', {
        'data-stub': 'AskCompactResult',
        'data-question': props.question,
        'data-show-full': String(props.showFullAnalysisLink),
        'data-summary': props.response.analysis?.summary ?? '',
      }),
  };
});

/* ── the page's data: 10 governed stories and 1 without a governed reference ── */
const REF = (i: number): string => `${'ab'.repeat(31)}${i.toString(16).padStart(2, '0')}`;
const story = (i: number, withRef = true): FixtureStory =>
  ({
    ...(withRef ? { articleRef: REF(i) } : {}),
    id: `s${i}`,
    url: `https://example.com/sample/story-${i}`,
    title: `Story ${i}`,
    sourceName: 'Example Wire',
    publishedAt: '2026-09-26T08:00:00.000Z',
    countryCode: 'PL',
    category: 'Economy',
    savedAt: '2026-09-26T09:00:00.000Z',
  }) as FixtureStory;
const SAVED = [...Array.from({ length: 10 }, (_, i) => story(i)), story(99, false)];

const data: MyIntelligenceData = {
  isLoading: false,
  isSignedIn: true,
  userEmail: 'reader@example.com',
  userName: 'Reader',
  previousSeenAt: '2026-09-25T08:00:00.000Z',
  isFirstVisit: false,
  boundarySource: 'live',
  boundaryFailed: false,
  newSince: [],
  newSinceCount: 0,
  humanitarianNewSince: null,
  newSinceSource: 'live',
  saved: SAVED,
  savedSource: 'live',
  forYou: [],
  forYouSource: 'live',
  follows: [],
  followsSource: 'live',
  recent: [],
  recentSource: 'live',
  usesFixtures: false,
  hasError: false,
  isDegraded: false,
  savedRefs: new Set(SAVED.map((s) => s.url)),
  toggleSaved: () => undefined,
  retry: () => undefined,
  signOut: async () => undefined,
  interests: [],
  interestsLoaded: true,
  forYouFiltered: false,
  forYouMatchCount: 0,
  forYouBroad: [],
  saveInterests: async () => true,
  isSavingInterests: false,
};
jest.mock('./useMyIntelligenceData', () => ({ useMyIntelligenceData: () => data }));

const target = new EventTarget();
Object.assign(globalThis, { window: Object.assign(target, { innerHeight: 844, innerWidth: 390 }) });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MyIntelligenceClient } = require('./MyIntelligenceClient') as typeof import('./MyIntelligenceClient');

const transport = mockTransport;
let renderer: ReactTestRenderer;

const all = (predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[] =>
  renderer.root.findAll((node) => typeof node.type === 'string' && predicate(node));
const one = (key: string, value?: string): ReactTestInstance | undefined =>
  all((node) => (value === undefined ? key in node.props : String(node.props[key]) === value))[0];
const text = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : text(child))).join('');
const press = (node: ReactTestInstance | undefined): void => {
  if (node === undefined) throw new Error('control not found');
  act(() => {
    node.props.onClick?.({ preventDefault() {}, stopPropagation() {} });
  });
};

function mount(): void {
  act(() => {
    renderer = create(createElement(MyIntelligenceClient, { language: 'en' }), { createNodeMock: () => ({ focus() {}, scrollBy() {}, scrollLeft: 0, scrollWidth: 0, clientWidth: 0 }) });
  });
  /*
    PREMIUM WORKSPACE R1 — the Saved DESTINATION lists every saved story. It
    is reached from the workspace rail (the tablist is gone, D2); the rail's
    "Selected stories" item carries data-mi-control="select" and the context
    rail's Done carries "selection-mode-done", so the steps below are unchanged.
  */
  press(all((n) => n.type === 'button' && n.props['aria-label'] === 'Saved')[0]);
}
const enterSelection = (): void => press(one('data-mi-control', 'select'));
const select = (...indices: number[]): void => {
  for (const i of indices) {
    /* INTEREST + SELECTION HOOK R1 — the sand hook's label ends with the story title. */
    press(all((n) => n.props.role === 'checkbox' && String(n.props['aria-label']).endsWith(`: Story ${i}`))[0]);
  }
};
const chooseAction = (id: string): void => press(all((n) => n.props['data-mi-action'] === id && !n.props.disabled)[0]);
const runButton = (): ReactTestInstance | undefined => one('data-mi-control', 'run');
/* Each story renders as a phone row AND a desktop card (one hidden by CSS): count stories, not boxes. */
const selectedCount = (): number =>
  new Set(all((n) => n.props.role === 'checkbox' && n.props['aria-checked'] === true).map((n) => n.props['aria-label'])).size;

const okResponse = (overrides: Partial<AnalysisApiResponse['retrievalContext']> = {}): AnalysisApiResponse =>
  ({
    query: 'q',
    analysis: { summary: 'SOURCE-BACKED RESULT', sources: [] },
    articles: [],
    retrievalContext: {
      dataMode: 'cached',
      providers: [],
      articlesRetrieved: 2,
      selection: { action: 'COMPARE', requested: 2, resolved: 2, unresolvedRefs: [] },
      ...overrides,
    },
  }) as unknown as AnalysisApiResponse;

beforeEach(() => {
  transport.mockReset();
  mount();
});
afterEach(() => act(() => renderer.unmount()));

describe('zero compute before the explicit Run', () => {
  it('entering selection mode, selecting 1/2/8, choosing every action, opening and cancelling the sheet, Clear and Done = 0 requests', () => {
    enterSelection();
    select(0);
    select(1);
    select(2, 3, 4, 5, 6, 7);
    expect(selectedCount()).toBe(8);
    for (const id of ['compare', 'summarize', 'askAbout', 'explain', 'whatChanged', 'briefing']) {
      chooseAction(id);
      expect(one('data-mi-compute-sheet', 'idle')).toBeDefined();
      press(all((n) => n.type === 'button' && text(n) === 'Cancel')[0]);
      expect(one('data-mi-compute-sheet')).toBeUndefined();
    }
    press(one('data-mi-control', 'clear'));
    expect(selectedCount()).toBe(0);
    press(one('data-mi-control', 'selection-mode-done'));
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('the final explicit Run = exactly one analysis request, with the exact governed payload', () => {
  it.each([
    ['compare', 'COMPARE', 'Compare the selected stories'],
    ['summarize', 'SUMMARIZE', 'Summarize the selected stories'],
    ['explain', 'EXPLAIN_DISAGREEMENTS', 'Explain the disagreements between the selected stories'],
    ['whatChanged', 'WHAT_CHANGED', 'What changed across the selected stories'],
    ['briefing', 'CREATE_BRIEFING', 'Create a briefing from the selected stories'],
  ])('%s → %s', async (id, action, query) => {
    transport.mockResolvedValueOnce(okResponse());
    enterSelection();
    select(3, 1);
    chooseAction(id);
    await act(async () => {
      runButton()?.props.onClick();
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(query, 'en', undefined, undefined, {
      action,
      stories: [
        { articleRef: REF(3), url: 'https://example.com/sample/story-3' },
        { articleRef: REF(1), url: 'https://example.com/sample/story-1' },
      ],
    });
  });

  it('Ask about selected passes the reader’s typed question and runs once', async () => {
    transport.mockResolvedValueOnce(okResponse({ selection: { action: 'ASK_SELECTED', requested: 1, resolved: 1, unresolvedRefs: [] } }));
    enterSelection();
    select(2);
    chooseAction('askAbout');
    /* Empty question: refused locally, zero requests. */
    expect(runButton()?.props.disabled).toBe(true);
    press(runButton());
    expect(transport).not.toHaveBeenCalled();
    act(() => {
      renderer.root.findByType('textarea').props.onChange({ target: { value: '  Who is affected most?  ' } });
    });
    await act(async () => {
      runButton()?.props.onClick();
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith('Who is affected most?', 'en', undefined, undefined, {
      action: 'ASK_SELECTED',
      stories: [{ articleRef: REF(2), url: 'https://example.com/sample/story-2' }],
    });
  });

  it('a double tap cannot produce two requests; the sheet shows the running state and holds the selection', async () => {
    transport.mockReturnValue(new Promise(() => undefined));
    enterSelection();
    select(0, 1);
    chooseAction('compare');
    const run = runButton();
    act(() => {
      run?.props.onClick();
      run?.props.onClick();
    });
    press(runButton());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(one('data-mi-compute-sheet', 'running')).toBeDefined();
    expect(runButton()?.props.disabled).toBe(true);
    expect(text(runButton()!)).toContain('Running…');
    expect(all((n) => n.type === 'button' && text(n) === 'Cancel')[0].props.disabled).toBe(true);
    expect(selectedCount()).toBe(2);
  });

  it('at most 8 stories can be selected, so at most 8 are ever sent', async () => {
    transport.mockResolvedValueOnce(okResponse());
    enterSelection();
    select(0, 1, 2, 3, 4, 5, 6, 7, 8);
    expect(selectedCount()).toBe(8);
    expect(text(renderer.root)).toContain('You can select up to 8 stories.');
    chooseAction('summarize');
    await act(async () => {
      runButton()?.props.onClick();
    });
    const payload = transport.mock.calls[0][4]!;
    expect(payload.stories).toHaveLength(8);
  });
});

describe('a story without a governed reference is refused honestly', () => {
  it('it is left out, never sent as a bare URL — and an action it would leave short cannot run', () => {
    enterSelection();
    select(99, 0);
    chooseAction('summarize');
    expect(one('data-mi-excluded', '1')).toBeDefined();
    press(all((n) => n.type === 'button' && text(n) === 'Cancel')[0]);
    chooseAction('compare');
    /* Compare needs 2 verified stories; only 1 carries a governed reference. */
    expect(one('data-mi-too-few')).toBeDefined();
    expect(runButton()?.props.disabled).toBe(true);
    press(runButton());
    expect(transport).not.toHaveBeenCalled();
  });

  it('when the action can still run, only the governed stories are sent', async () => {
    transport.mockResolvedValueOnce(okResponse());
    enterSelection();
    select(99, 4);
    chooseAction('summarize');
    await act(async () => {
      runButton()?.props.onClick();
    });
    const payload = transport.mock.calls[0][4]!;
    expect(payload.stories).toEqual([{ articleRef: REF(4), url: 'https://example.com/sample/story-4' }]);
    expect(JSON.stringify(transport.mock.calls[0])).not.toContain('story-99');
  });
});

describe('result presentation — the existing reader, plus the selection facts', () => {
  it('success opens the result: action, resolved/unresolved stories and AskCompactResult without the unscoped /search link', async () => {
    transport.mockResolvedValueOnce(
      okResponse({ selection: { action: 'COMPARE', requested: 2, resolved: 1, unresolvedRefs: [REF(1)] } }),
    );
    enterSelection();
    select(0, 1);
    chooseAction('compare');
    await act(async () => {
      runButton()?.props.onClick();
    });
    expect(one('data-mi-compute-sheet')).toBeUndefined();
    expect(one('data-mi-result', 'COMPARE')).toBeDefined();
    expect(one('data-mi-resolved', '1/2')).toBeDefined();
    expect(text(one('data-mi-unresolved', '1')!)).toContain('Story 1');
    const reader = one('data-stub', 'AskCompactResult')!;
    expect(reader.props['data-summary']).toBe('SOURCE-BACKED RESULT');
    expect(reader.props['data-show-full']).toBe('false');
    expect(reader.props['data-question']).toBe('Compare the selected stories');
    /* The selection survives success, so another action can run on it. */
    expect(selectedCount()).toBe(2);
  });

  it('failure stays on the workflow with the governed error copy, keeps the selection, and retry is one more explicit Run', async () => {
    transport.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(okResponse());
    enterSelection();
    select(0, 1);
    chooseAction('compare');
    await act(async () => {
      runButton()?.props.onClick();
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(one('data-mi-compute-sheet', 'failed')).toBeDefined();
    /* R2D — a failed canonical turn shows the governed "did not complete" copy. */
    expect(text(one('data-mi-run-failed')!)).toContain('The analysis did not complete. Your selection is kept.');
    expect(text(runButton()!)).toContain('Try again');
    expect(selectedCount()).toBe(2);
    /* No automatic retry: nothing more is sent until the reader presses again. */
    expect(transport).toHaveBeenCalledTimes(1);
    await act(async () => {
      runButton()?.props.onClick();
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(one('data-mi-result', 'COMPARE')).toBeDefined();
  });

  it('too few stories resolving server-side is shown honestly, through the same reader', async () => {
    transport.mockResolvedValueOnce({
      ...okResponse({ selection: { action: 'COMPARE', requested: 2, resolved: 0, unresolvedRefs: [REF(0), REF(1)] } }),
      analysis: null,
    } as unknown as AnalysisApiResponse);
    enterSelection();
    select(0, 1);
    chooseAction('compare');
    await act(async () => {
      runButton()?.props.onClick();
    });
    expect(one('data-mi-resolved', '0/2')).toBeDefined();
    expect(text(one('data-mi-unresolved', '2')!)).toContain('Story 0');
    expect(one('data-stub', 'AskCompactResult')!.props['data-summary']).toBe('');
  });
});
