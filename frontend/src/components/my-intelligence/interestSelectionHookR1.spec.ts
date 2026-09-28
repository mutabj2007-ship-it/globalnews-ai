import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { MAX_SELECTED_STORIES, MY_INTELLIGENCE_INTERESTS, type MyIntelligenceInterest } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { MyIntelligenceData } from './useMyIntelligenceData';
import type { FixtureStory } from './devFixtures';
import { SelectionHook } from './MiPrimitives';
import { matchedInterests, selectForYou } from './interestForYou';
import { forYouReason } from './workspace/WorkspaceDashboard';

jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/components/search/SearchPageClient', () => ({ SearchPageClient: () => null }));
jest.mock('@/components/ask/AskCompactResult', () => ({ AskCompactResult: () => null }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }), usePathname: () => '/my-intelligence' }));
jest.mock('next/link', () => {
  const react = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, ...rest }: { href: string; children: unknown }) => react.createElement('a', { href, ...rest }, children) };
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE — INTEREST-AWARE FOR YOU + SELECTION HOOK + CARD RECOVERY R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   P1 · the sand hook is always visible; pressing it enters selection mode
 *        AND selects that story — 0 AI, 0 provider requests.
 *   P2 · explicit interests filter For you over retained stories only; never
 *        backfilled; New since and Saved never filtered.
 */

const MI = __dirname;
const read = (path: string): string => readFileSync(join(MI, path), 'utf8');
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const REF = (i: number): string => `${'cd'.repeat(31)}${i.toString(16).padStart(2, '0')}`;
const story = (i: number, overrides: Partial<FixtureStory> = {}): FixtureStory =>
  ({
    articleRef: REF(i),
    id: `s${i}`,
    url: `https://example.com/sample/story-${i}`,
    title: `Story ${i}`,
    sourceName: 'Example Wire',
    publishedAt: `2026-09-26T${String(8 + (i % 10)).padStart(2, '0')}:00:00.000Z`,
    countryCode: 'EGY',
    category: 'world',
    interests: [],
    savedAt: '2026-09-26T09:00:00.000Z',
    ...overrides,
  }) as FixtureStory;

/* The Egypt set: football mentions "president" and "security" but is category-exclusive (server-side). */
const EGYPT = {
  football: story(1, { title: 'Al Ahly president hails security at derby', category: 'sports', interests: ['sports'] }),
  budget: story(2, { title: 'Parliament approves budget', category: 'politics', interests: ['politics_governance', 'economy_markets'] }),
  sinai: story(3, { title: 'Military boosts security in Sinai', category: 'world', interests: ['security_conflict'] }),
  talks: story(4, { title: 'Cairo hosts ceasefire talks', category: 'world', interests: ['security_conflict', 'diplomacy', 'politics_governance'] }),
  market: story(5, { title: 'Pound steadies as markets open', category: 'business', interests: ['economy_markets'] }),
};
const CANDIDATES = Object.values(EGYPT);

describe('P2 · the For you rule (pure, retained data only)', () => {
  it('Security + Politics: Egypt football is EXCLUDED; ordered by match count then recency', () => {
    const result = selectForYou(CANDIDATES, ['politics_governance', 'security_conflict'], 6);
    expect(result.filtered).toBe(true);
    expect(result.stories.map((s) => s.id)).toEqual(['s4', 's3', 's2']);
    expect(result.stories).not.toContain(EGYPT.football);
    expect(result.matchCount).toBe(3);
  });

  it('Sports shows the sports story only', () => {
    expect(selectForYou(CANDIDATES, ['sports'], 6).stories).toEqual([EGYPT.football]);
  });

  it('NO BACKFILL: exactly two matches → exactly two stories, never padded to the limit', () => {
    const result = selectForYou(CANDIDATES, ['economy_markets'], 6);
    expect(result.stories.map((s) => s.id)).toEqual(['s5', 's2']);
    expect(result.matchCount).toBe(2);
  });

  it('zero matches is an honest empty list, not unrelated reporting', () => {
    expect(selectForYou(CANDIDATES, ['entertainment'], 6)).toEqual({ stories: [], matchCount: 0, filtered: true });
  });

  it('no interests → the broad fallback, unfiltered and bounded', () => {
    const result = selectForYou(CANDIDATES, [], 3);
    expect(result).toEqual({ stories: CANDIDATES.slice(0, 3), matchCount: 5, filtered: false });
  });

  it('matchedInterests keeps the reader’s own order and ignores stories without interests', () => {
    expect(matchedInterests(EGYPT.talks, ['diplomacy', 'security_conflict'])).toEqual(['diplomacy', 'security_conflict']);
    expect(matchedInterests({ interests: undefined }, ['sports'])).toEqual([]);
  });

  it('the reason line is deterministic: matched interest labels · country, in EN and PL', () => {
    expect(forYouReason(EGYPT.sinai, ['security_conflict', 'politics_governance'], 'en')).toBe('Security & conflict · Egypt');
    expect(forYouReason(EGYPT.sinai, ['security_conflict'], 'pl')).toMatch(/^Bezpieczeństwo.* · Egipt$/);
  });

  it('the For you rule never touches New since or Saved', () => {
    const hook = code(read('useMyIntelligenceData.ts'));
    expect(hook).toMatch(/selectForYou\(/);
    expect(hook).not.toMatch(/selectForYou\([^)]*(newSince|saved)/i);
  });

  it('the rule and the editor use no AI, no provider, no browser storage', () => {
    for (const file of ['interestForYou.ts', 'workspace/InterestEditor.tsx']) {
      const body = code(read(file));
      expect(body).not.toMatch(/analyzeNews|runSelectionAction|analysisApi|fetch\(|localStorage|sessionStorage|indexedDB/);
    }
  });
});

describe('P2 · the vocabulary is governed and bilingual', () => {
  it('EN and PL label every one of the 11 interests, and share the interests key set', () => {
    const en = getDictionary('en').myIntelligence.interests;
    const pl = getDictionary('pl').myIntelligence.interests;
    expect(MY_INTELLIGENCE_INTERESTS).toHaveLength(11);
    for (const interest of MY_INTELLIGENCE_INTERESTS) {
      expect(en.labels[interest]).toBeTruthy();
      expect(pl.labels[interest]).toBeTruthy();
    }
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
  });
});

describe('P1 · the sand selection hook', () => {
  const html = (checked: boolean, language: 'en' | 'pl' = 'en', disabled = false): string =>
    renderToStaticMarkup(createElement(SelectionHook, { checked, disabled, onChange: () => undefined, title: 'Cairo talks', language }));

  it('labels: select / remove, EN and PL, with the story title; title attribute "Select for intelligence"', () => {
    expect(html(false)).toContain('aria-label="Select this story for intelligence actions: Cairo talks"');
    expect(html(true)).toContain('aria-label="Remove this story from selected stories: Cairo talks"');
    expect(html(false)).toContain('title="Select for intelligence"');
    expect(html(false, 'pl')).toContain('aria-label="Zaznacz ten artykuł do działań analitycznych: Cairo talks"');
    expect(html(true, 'pl')).toContain('aria-label="Usuń ten artykuł z zaznaczonych: Cairo talks"');
  });

  it('glyph: "+" unselected, a check selected', () => {
    expect(html(false)).toContain('M12 5.5v13M5.5 12h13');
    expect(html(true)).toContain('m5 12.5 4.5 4.5L19 7.5');
  });

  it('sand family, ≥44px, 2–3px border; no lightning, AI badge, price, red, mint, violet or bright gold', () => {
    const markup = html(false) + html(true);
    for (const token of ['#2E2618', '#6A5634', '#8A7045', '#D9B98A', 'h-[44px]', 'w-[44px]', 'border-[2.5px]']) {
      expect(markup).toContain(token);
    }
    expect(markup).not.toMatch(/lucide-zap|Zap|\bAI\b|€|\$|credit|#ff|#e5484d|red-|#3ee0b0|mint|violet|#8b5cf6|#ffd700|#f5c542/i);
  });

  it('placement is absolute at the left middle, so it takes no headline width', () => {
    const views = read('MiStoryViews.tsx');
    expect(views).toMatch(/ROW_HOOK = 'absolute [^']*top-1\/2 -translate-y-1\/2/);
    expect(views).toMatch(/CARD_HOOK = 'absolute [^']*top-1\/2 -translate-y-1\/2/);
  });

  it('For you cards are compact (3-line title, bounded reason/meta); grids are width-driven (no squeeze)', () => {
    const views = read('MiStoryViews.tsx');
    expect(views).toContain('line-clamp-3');
    const dashboard = read('workspace/WorkspaceDashboard.tsx');
    expect(dashboard).toMatch(/minmax\(min\(100%,3[01]0px\),1fr\)/);
    expect(read('MiSections.tsx')).toMatch(/minmax\(min\(100%,3[12]0px\),1fr\)/);
  });
});

/* ── the REAL client, with only the data hook and the analysis transport replaced ── */
const SAVED = Array.from({ length: MAX_SELECTED_STORIES + 2 }, (_, i) => story(i + 10, { title: `Story ${i}` }));
const saveInterests = jest.fn(async (_next: readonly MyIntelligenceInterest[]) => true);
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
  newSinceSource: 'live',
  saved: SAVED,
  savedSource: 'live',
  forYou: [EGYPT.talks, EGYPT.sinai],
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
  interests: ['security_conflict'],
  interestsLoaded: true,
  forYouFiltered: true,
  forYouMatchCount: 2,
  forYouBroad: CANDIDATES,
  saveInterests,
  isSavingInterests: false,
};
jest.mock('./useMyIntelligenceData', () => ({ FOR_YOU_LIMIT: 6, useMyIntelligenceData: () => data }));

const target = new EventTarget();
Object.assign(globalThis, { window: Object.assign(target, { innerHeight: 900, innerWidth: 1440 }) });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MyIntelligenceClient } = require('./MyIntelligenceClient') as typeof import('./MyIntelligenceClient');

const transport = jest.mocked(analyzeNews);
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
const hook = (title: string): ReactTestInstance | undefined =>
  all((n) => n.props.role === 'checkbox' && String(n.props['aria-label']).endsWith(`: ${title}`))[0];
const selectedCount = (): number =>
  new Set(all((n) => n.props.role === 'checkbox' && n.props['aria-checked'] === true).map((n) => n.props['aria-label'])).size;
const selecting = (): boolean => one('data-mi-control', 'selection-mode-done') !== undefined;

beforeEach(() => {
  transport.mockReset();
  saveInterests.mockClear();
  act(() => {
    renderer = create(createElement(MyIntelligenceClient, { language: 'en' }), {
      createNodeMock: () => ({ focus() {}, scrollBy() {}, scrollLeft: 0, scrollWidth: 0, clientWidth: 0 }),
    });
  });
});
afterEach(() => act(() => renderer.unmount()));

describe('P1 · discovery: the hook is visible OUTSIDE selection mode and enters + selects', () => {
  it('Today: For you cards carry the hook before selection mode exists', () => {
    expect(selecting()).toBe(false);
    expect(hook(EGYPT.talks.title)).toBeDefined();
    expect(hook(EGYPT.talks.title)?.props['aria-checked']).toBe(false);
  });

  it('pressing it enters selection mode AND selects that story — 0 analysis requests', () => {
    press(hook(EGYPT.talks.title));
    expect(selecting()).toBe(true);
    expect(selectedCount()).toBe(1);
    expect(hook(EGYPT.talks.title)?.props['aria-checked']).toBe(true);
    press(hook(EGYPT.talks.title));
    expect(selectedCount()).toBe(0);
    expect(transport).not.toHaveBeenCalled();
  });

  it('with 0 selected, the rail teaches the sand + control', () => {
    press(one('data-mi-control', 'select'));
    const hints = all((n) => 'data-mi-hook-hint' in n.props).map(text);
    expect(hints).toContain('Use the sand + controls on stories to select what you want to analyze.');
  });

  it(`the maximum (${MAX_SELECTED_STORIES}) holds: a further hook does not select, and nothing is sent`, () => {
    press(all((n) => n.type === 'button' && n.props['aria-label'] === 'Saved')[0]);
    for (let i = 0; i < MAX_SELECTED_STORIES + 1; i += 1) press(hook(`Story ${i}`));
    expect(selectedCount()).toBe(MAX_SELECTED_STORIES);
    expect(hook(`Story ${MAX_SELECTED_STORIES}`)?.props['aria-checked']).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('P2 · the For you header and the interest editor', () => {
  it('states the truthful match count and the deterministic reason', () => {
    const body = text(renderer.root);
    expect(body).toContain('2 stories match your current interests.');
    expect(body).toContain('Security & conflict · Egypt');
  });

  it('Tune interests opens the editor; toggling is local; Apply is ONE save; 0 analysis requests', async () => {
    press(one('data-mi-control', 'tune-interests'));
    expect(one('data-mi-interest-editor')).toBeDefined();
    expect(one('data-mi-interest', 'security_conflict')?.props['aria-pressed']).toBe(true);
    press(one('data-mi-interest', 'sports'));
    press(one('data-mi-interest', 'diplomacy'));
    expect(saveInterests).not.toHaveBeenCalled();
    await act(async () => {
      one('data-mi-interest-action', 'apply')?.props.onClick();
    });
    expect(saveInterests).toHaveBeenCalledTimes(1);
    expect(saveInterests).toHaveBeenCalledWith(['security_conflict', 'diplomacy', 'sports']);
    expect(one('data-mi-interest-editor')).toBeUndefined();
    expect(transport).not.toHaveBeenCalled();
  });

  it('Show all clears the set with one save', async () => {
    press(one('data-mi-control', 'tune-interests'));
    await act(async () => {
      one('data-mi-interest-action', 'show-all')?.props.onClick();
    });
    expect(saveInterests).toHaveBeenCalledWith([]);
  });

  it('Account & Control → Preferences opens the same editor', () => {
    const w = getDictionary('en').myIntelligence.workspace;
    const account = w.groups.account;
    press(all((n) => n.type === 'button' && n.props['aria-label'] === w.openRail)[0]);
    press(all((n) => n.type === 'button' && n.props['aria-expanded'] === false && text(n).includes(account))[0]);
    press(one('data-mi-control', 'preferences-interests'));
    expect(one('data-mi-interest-editor')).toBeDefined();
  });

  it('Show broader reporting is an explicit, local action', () => {
    press(one('data-mi-control', 'for-you-broader'));
    expect(hook(EGYPT.football.title)).toBeDefined();
    expect(transport).not.toHaveBeenCalled();
    expect(saveInterests).not.toHaveBeenCalled();
  });
});
