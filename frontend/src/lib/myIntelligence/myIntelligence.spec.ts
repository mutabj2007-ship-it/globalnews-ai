import { resetSavedStoriesStoreForTest } from './savedStoriesStore';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MAX_SELECTED_STORIES, type SelectedStoryRef } from '@globalnews-ai/shared';
import { accountFetch } from '@/lib/api/accountFetch';
import { analyzeNews } from '@/lib/api/analysisApi';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import {
  fetchMyIntelligenceFeed,
  fetchQuestionHistory,
  fetchSavedStories,
  MY_INTELLIGENCE_PATHS,
  removeSavedStory,
  saveStory,
} from './myIntelligenceApi';
import { useMyIntelligenceFeed, useQuestionHistory, useSavedStories } from './hooks';
import {
  runSelectionAction,
  SELECTION_ACTION_QUESTIONS,
  SelectionActionError,
  useStorySelection,
} from './selection';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE R1 — THE ZERO-COMPUTE MATRIX, ON THE FRONTEND SEAMS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Counted, not inferred: `analyzeNews` is the single browser transport for
 * POST /analysis/news, and `accountFetch` is the single transport for account
 * data. Opening, tab changes, saving, unsaving, selecting, reading history and
 * reopening a question must never reach analyzeNews. Only runSelectionAction —
 * the explicit Run — may, and then exactly once.
 */

jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: jest.fn() }));
jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/lib/ask/openGlobalAsk', () => ({ openGlobalAsk: jest.fn() }));

const fetchMock = jest.mocked(accountFetch);
const analyzeMock = jest.mocked(analyzeNews);
const stageMock = jest.mocked(openGlobalAsk);

const REF = (n: number) => n.toString(16).padStart(64, '0');
const story = (n: number): SelectedStoryRef => ({ articleRef: REF(n), url: `https://wire.example/${n}` });
const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const FEED = { previousSeenAt: null, followedCountries: [], stories: [], newSinceCount: 0, source: 'retained' };
const SAVED = { stories: [], limit: 200 };
const HISTORY = [{ id: 'h1', query: 'Why is inflation high in Poland?', countryCode: null, createdAt: '2026-09-27T08:00:00.000Z' }];

/*
  UNIVERSAL BOOKMARK R1 — the saved-story list is ONE shared store, read only
  when a session hint exists. These tests model a signed-in reader, so the hint
  cookie is present, and the store is reset so each test starts from a clean read.
*/
Object.assign(globalThis, { document: { cookie: 'gna_csrf=signed-in-reader' } });

beforeEach(() => {
  resetSavedStoriesStoreForTest();
  fetchMock.mockReset();
  analyzeMock.mockReset();
  stageMock.mockReset();
  fetchMock.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    if (options?.method === 'POST') {
      return ok({ articleRef: REF(1), sourceUrl: (options.body as { url: string }).url, title: 'Server title' });
    }
    if (options?.method === 'DELETE') return { ok: true, status: 204 } as unknown as Response;
    if (path === MY_INTELLIGENCE_PATHS.feed) return ok(FEED);
    if (path === MY_INTELLIGENCE_PATHS.savedStories) return ok(SAVED);
    if (path === MY_INTELLIGENCE_PATHS.history) return ok(HISTORY);
    return { ok: false, status: 404 } as unknown as Response;
  });
});

describe('the data client stays inside existing authenticated /api families', () => {
  it('feed, saved stories and history paths', async () => {
    await fetchMyIntelligenceFeed();
    await fetchSavedStories();
    await fetchQuestionHistory();
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/users/me/intelligence/feed',
      '/users/me/saved/stories',
      '/history',
    ]);
  });

  it('saving sends only the URL (+ optional provider id hint) — never a title or summary', async () => {
    await saveStory({ url: 'https://wire.example/1', providerArticleId: 'gnews-1' });
    await saveStory({ url: 'https://wire.example/2' });
    expect(fetchMock.mock.calls[0]).toEqual([
      '/users/me/saved/stories',
      { method: 'POST', body: { url: 'https://wire.example/1', providerArticleId: 'gnews-1' } },
    ]);
    expect(fetchMock.mock.calls[1][1]).toEqual({ method: 'POST', body: { url: 'https://wire.example/2' } });
  });

  it('unsaving is a DELETE by articleRef', async () => {
    await removeSavedStory(REF(7));
    expect(fetchMock).toHaveBeenCalledWith(`/users/me/saved/stories/${REF(7)}`, { method: 'DELETE' });
  });

  it('none of these reach the analysis transport', () => {
    expect(analyzeMock).not.toHaveBeenCalled();
  });
});

/* ── mounted: the zero-compute matrix ───────────────────────────────────── */

type Hooks = {
  feed: ReturnType<typeof useMyIntelligenceFeed>;
  saved: ReturnType<typeof useSavedStories>;
  history: ReturnType<typeof useQuestionHistory>;
  selection: ReturnType<typeof useStorySelection>;
};

let hooks: Hooks;
function Probe(): null {
  hooks = {
    feed: useMyIntelligenceFeed(),
    saved: useSavedStories(),
    history: useQuestionHistory(),
    selection: useStorySelection(),
  };
  return null;
}

async function mount(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(Probe));
  });
  return renderer;
}

describe('zero-compute matrix', () => {
  it('opening My Intelligence = three account reads, 0 AI', async () => {
    const renderer = await mount();
    expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual(
      ['/history', '/users/me/intelligence/feed', '/users/me/saved/stories'].sort(),
    );
    expect(fetchMock.mock.calls.every((call) => call[1] === undefined)).toBe(true);
    expect(analyzeMock).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('save / unsave = account writes only, 0 AI', async () => {
    const renderer = await mount();
    await act(async () => {
      await hooks.saved.save({ url: 'https://wire.example/1' });
    });
    expect(hooks.saved.isSaved(REF(1))).toBe(true);
    await act(async () => {
      await hooks.saved.remove(REF(1));
    });
    expect(hooks.saved.isSaved(REF(1))).toBe(false);
    expect(analyzeMock).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('select / deselect / clear up to 8 = no request at all; the 9th is refused', async () => {
    const renderer = await mount();
    const before = fetchMock.mock.calls.length;
    for (let n = 1; n <= MAX_SELECTED_STORIES; n += 1) {
      act(() => {
        expect(hooks.selection.toggle(story(n))).toBe(true);
      });
    }
    let accepted = true;
    act(() => {
      accepted = hooks.selection.toggle(story(9));
    });
    expect(accepted).toBe(false);
    expect(hooks.selection.selected).toHaveLength(8);
    act(() => {
      hooks.selection.toggle(story(1));
    });
    expect(hooks.selection.isSelected(REF(1))).toBe(false);
    act(() => hooks.selection.clear());
    expect(hooks.selection.selected).toEqual([]);
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(analyzeMock).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('reopening an old question STAGES it in Ask: 0 AI, and no history write', async () => {
    const renderer = await mount();
    const before = fetchMock.mock.calls.length;
    await act(async () => {
      await hooks.history.refresh();
    });
    act(() => hooks.history.stage(HISTORY[0]));
    expect(stageMock).toHaveBeenCalledWith('Why is inflation high in Poland?');
    /* Only the re-read happened; nothing POSTed, nothing analysed. */
    expect(fetchMock.mock.calls.slice(before).every((call) => call[1] === undefined)).toBe(true);
    expect(analyzeMock).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('canRun follows each action minimum', async () => {
    const renderer = await mount();
    act(() => {
      hooks.selection.toggle(story(1));
    });
    expect(hooks.selection.canRun('SUMMARIZE')).toBe(true);
    expect(hooks.selection.canRun('ASK_SELECTED')).toBe(true);
    expect(hooks.selection.canRun('WHAT_CHANGED')).toBe(true);
    expect(hooks.selection.canRun('COMPARE')).toBe(false);
    expect(hooks.selection.canRun('EXPLAIN_DISAGREEMENTS')).toBe(false);
    expect(hooks.selection.canRun('CREATE_BRIEFING')).toBe(false);
    act(() => renderer.unmount());
  });
});

describe('the explicit Run — the only compute boundary', () => {
  it('refuses locally, with no request, outside the bounds', async () => {
    await expect(runSelectionAction('COMPARE', [story(1)], 'en')).rejects.toEqual(new SelectionActionError('too-few'));
    const nine = Array.from({ length: 9 }, (_, i) => story(i + 1));
    await expect(runSelectionAction('SUMMARIZE', nine, 'en')).rejects.toEqual(new SelectionActionError('too-many'));
    await expect(runSelectionAction('ASK_SELECTED', [story(1)], 'en', ' ')).rejects.toEqual(
      new SelectionActionError('question-required'),
    );
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('one Run = exactly one analyzeNews call carrying the selection', async () => {
    analyzeMock.mockResolvedValue({} as never);
    await runSelectionAction('COMPARE', [story(1), story(2)], 'en');
    expect(analyzeMock).toHaveBeenCalledTimes(1);
    expect(analyzeMock).toHaveBeenCalledWith('Compare the selected stories', 'en', undefined, undefined, {
      action: 'COMPARE',
      stories: [story(1), story(2)],
    });
  });

  it('Ask about selected keeps the reader’s own question as the question', async () => {
    analyzeMock.mockResolvedValue({} as never);
    await runSelectionAction('ASK_SELECTED', [story(3)], 'en', 'Who is affected?');
    expect(analyzeMock.mock.calls[0][0]).toBe('Who is affected?');
  });

  it('EN and PL action wording', async () => {
    analyzeMock.mockResolvedValue({} as never);
    await runSelectionAction('CREATE_BRIEFING', [story(1), story(2)], 'pl');
    expect(analyzeMock.mock.calls[0][0]).toBe(SELECTION_ACTION_QUESTIONS.pl.CREATE_BRIEFING);
    expect(analyzeMock.mock.calls[0][1]).toBe('pl');
    expect(Object.keys(SELECTION_ACTION_QUESTIONS.en)).toEqual(Object.keys(SELECTION_ACTION_QUESTIONS.pl));
  });
});
