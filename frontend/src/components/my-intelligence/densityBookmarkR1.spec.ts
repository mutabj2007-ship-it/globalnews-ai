import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { SEARCH_HISTORY_LIST_LIMIT, type NewsArticle } from '@globalnews-ai/shared';
import { accountFetch } from '@/lib/api/accountFetch';
import { analyzeNews } from '@/lib/api/analysisApi';
import { resetSavedStoriesStoreForTest } from '@/lib/myIntelligence/savedStoriesStore';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE DENSITY + UNIVERSAL BOOKMARK + FOLLOWING/RECENT R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Only the account transport (accountFetch) is replaced, so every count below
 * is a count of the requests the product itself would send.
 */

jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: jest.fn() }));
jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('next/navigation', () => ({ usePathname: () => '/map', useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => {
  const react = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, ...rest }: { href: string; children: unknown }) => react.createElement('a', { href, ...rest }, children) };
});
jest.mock('@/components/ui/SafeImage', () => ({ SafeImage: () => null }));

const transport = jest.mocked(accountFetch);
const assign = jest.fn();
const target = new EventTarget();
Object.assign(globalThis, {
  window: Object.assign(target, { innerHeight: 844, innerWidth: 390, location: { assign }, setTimeout: (callback: () => void, ms?: number) => setTimeout(callback, ms) }),
  document: { cookie: '' },
});
const signIn = (): void => {
  (globalThis as unknown as { document: { cookie: string } }).document.cookie = 'gna_csrf=reader';
};
const signOut = (): void => {
  (globalThis as unknown as { document: { cookie: string } }).document.cookie = '';
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StoryBookmark } = require('@/components/bookmark/StoryBookmark') as typeof import('@/components/bookmark/StoryBookmark');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CountryArticleCard } = require('@/components/map/CountryArticleCard') as typeof import('@/components/map/CountryArticleCard');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sections = require('./MiSections') as typeof import('./MiSections');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const following = require('./MiFollowing') as typeof import('./MiFollowing');

const ok = (body: unknown, status = 200) => ({ ok: true, status, json: async () => body }) as unknown as Response;
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) }) as unknown as Response;
const REF = (n: number) => n.toString(16).padStart(64, '0');
const savedView = (n: number) => ({
  articleRef: REF(n),
  canonicalUrl: `https://wire.example/story-${n}`,
  sourceUrl: `https://wire.example/story-${n}`,
  title: `Story ${n}`,
  sourceName: 'Wire',
  sourceDomain: 'wire.example',
  publishedAt: '2026-09-27T08:00:00.000Z',
  publishedAtBasis: 'publisher',
  countryCodes: [],
  savedAt: '2026-09-27T09:00:00.000Z',
});

let renderer: ReactTestRenderer;
const all = (predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[] =>
  renderer.root.findAll((node) => typeof node.type === 'string' && predicate(node));
const text = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : text(child))).join('');
const calls = (method: string, path?: string) =>
  transport.mock.calls.filter(([p, o]) => ((o as { method?: string } | undefined)?.method ?? 'GET') === method && (path === undefined || p === path));

async function mountAll(element: ReturnType<typeof createElement>): Promise<void> {
  await act(async () => {
    renderer = create(element);
  });
}

beforeEach(() => {
  /* The bookmark notice dismisses itself on a timer; keep timers controlled. */
  jest.useFakeTimers();
  resetSavedStoriesStoreForTest();
  transport.mockReset();
  assign.mockReset();
  jest.mocked(analyzeNews).mockReset();
  signIn();
});
afterEach(() => {
  act(() => renderer?.unmount());
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

/* ─────────────────────────────── A · universal bookmark ─────────────────── */

describe('A · one shared saved-story state — never one GET per card', () => {
  it.each([1, 10, 50])('%i bookmarkable cards → at most ONE saved-list GET', async (n) => {
    transport.mockResolvedValue(ok({ stories: [savedView(3)], limit: 200 }));
    await mountAll(
      createElement('div', null, ...Array.from({ length: n }, (_, i) => createElement(StoryBookmark, { key: i, url: `https://wire.example/story-${i}`, language: 'en' }))),
    );
    expect(calls('GET', '/users/me/saved/stories')).toHaveLength(1);
    expect(transport).toHaveBeenCalledTimes(1);
    /* The already-saved story is shown as saved; the rest are not. */
    const states = all((node) => node.props['data-bookmark'] !== undefined).map((node) => node.props['data-bookmark']);
    expect(states.filter((s) => s === 'saved')).toHaveLength(n > 3 ? 1 : 0);
  });

  it('signed out: zero saved-story requests, nothing shown as saved, and the press goes to sign-in (returning to an allowed page)', async () => {
    signOut();
    await mountAll(createElement('div', null, ...Array.from({ length: 10 }, (_, i) => createElement(StoryBookmark, { key: i, url: `https://wire.example/story-${i}`, language: 'en' }))));
    expect(transport).not.toHaveBeenCalled();
    const buttons = all((node) => node.props['data-bookmark'] !== undefined);
    expect(buttons.every((b) => b.props['data-bookmark'] === 'unsaved')).toBe(true);
    act(() => buttons[0].props.onClick({ preventDefault() {}, stopPropagation() {} }));
    expect(assign).toHaveBeenCalledWith('/api/auth/google?returnTo=%2Fmap');
    expect(transport).not.toHaveBeenCalled();
  });

  it('save = exactly one POST; unsave = exactly one DELETE; duplicate appearances of one story update together; 0 AI', async () => {
    transport.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') return ok(savedView(7), 201);
      if (options?.method === 'DELETE') return ok(null, 204);
      return ok({ stories: [], limit: 200 });
    });
    const url = 'https://wire.example/story-7';
    await mountAll(
      createElement('div', null, createElement(StoryBookmark, { key: 'a', url, language: 'en' }), createElement(StoryBookmark, { key: 'b', url: `${url}?utm_source=rail`, language: 'en' })),
    );
    const buttons = () => all((node) => node.props['data-bookmark'] !== undefined);
    await act(async () => {
      buttons()[0].props.onClick({ preventDefault() {}, stopPropagation() {} });
    });
    expect(calls('POST')).toHaveLength(1);
    expect(calls('POST')[0][1]).toEqual({ method: 'POST', body: { url } });
    expect(buttons().map((b) => b.props['data-bookmark'])).toEqual(['saved', 'saved']);
    expect(buttons()[0].props['aria-label']).toBe('Remove saved story');

    await act(async () => {
      buttons()[1].props.onClick({ preventDefault() {}, stopPropagation() {} });
    });
    expect(calls('DELETE')).toHaveLength(1);
    expect(calls('DELETE')[0][0]).toBe(`/users/me/saved/stories/${REF(7)}`);
    expect(buttons().map((b) => b.props['data-bookmark'])).toEqual(['unsaved', 'unsaved']);
    expect(buttons()[0].props['aria-label']).toBe('Save story');
    expect(calls('GET')).toHaveLength(1);
    expect(analyzeNews).not.toHaveBeenCalled();
  });

  it('a story the server cannot resolve is reported honestly and is NOT shown as saved', async () => {
    transport.mockImplementation(async (_path: string, options?: { method?: string }) =>
      options?.method === 'POST' ? fail(404) : ok({ stories: [], limit: 200 }),
    );
    await mountAll(createElement(StoryBookmark, { url: 'https://wire.example/unknown', language: 'en' }));
    await act(async () => {
      all((node) => node.props['data-bookmark'] !== undefined)[0].props.onClick({ preventDefault() {}, stopPropagation() {} });
    });
    expect(all((node) => node.props['data-bookmark'] !== undefined)[0].props['data-bookmark']).toBe('unsaved');
    const notice = all((node) => node.props['data-bookmark-notice'] !== undefined)[0];
    expect(text(notice)).toContain('can’t be saved yet');
  });

  it('the bookmark is cyan free personalisation: never sand, mint, violet or red', () => {
    const primitives = readFileSync(join(__dirname, 'MiPrimitives.tsx'), 'utf8');
    const block = primitives.slice(primitives.indexOf('export function BookmarkButton'), primitives.indexOf('export function CategoryChip'));
    for (const forbidden of ['#2e2618', '#6a5634', '#D9B98A', '#5BE3A8', '#8C86EE', '#ff8d97']) {
      expect(block.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('a card whose story is a link keeps the bookmark OUTSIDE the link (legacy map card)', async () => {
    transport.mockResolvedValue(ok({ stories: [], limit: 200 }));
    const article = { id: 'a1', url: 'https://wire.example/story-1', title: 'Story 1', sourceName: 'Wire', publishedAt: '2026-09-27T08:00:00.000Z', category: 'world' } as NewsArticle;
    await mountAll(createElement('ul', null, createElement(CountryArticleCard, { article, language: 'en' })));
    const bookmark = all((node) => node.props['data-bookmark'] !== undefined)[0];
    let parent = bookmark.parent;
    while (parent !== null) {
      expect(parent.type).not.toBe('a');
      parent = parent.parent;
    }
  });

  it('every live real-article surface renders the shared bookmark', () => {
    const root = join(__dirname, '..');
    const surfaces: Array<[string, string]> = [
      ['home/WhatsHappeningNow.tsx', 'HomeSaveControl'],
      ['home/SixtySecondBrief.tsx', 'StoryBookmark'],
      ['home/HomeAccountPanel.tsx', 'StoryBookmark'],
      ['map/CountryArticleCard.tsx', 'StoryBookmark'],
      ['analysis-frame/SourcesReporting.tsx', 'StoryBookmark'],
      ['analysis-frame/EvidenceLibrary.tsx', 'StoryBookmark'],
      ['analysis-frame/SourcesDock.tsx', 'StoryBookmark'],
      ['ask/AskCompactResult.tsx', 'StoryBookmark'],
      ['my-intelligence/MiStoryViews.tsx', 'BookmarkButton'],
    ];
    for (const [file, marker] of surfaces) {
      expect(`${file}: ${readFileSync(join(root, file), 'utf8').includes(`<${marker}`)}`).toBe(`${file}: true`);
    }
    /*
      The Spatial map SourceCard is shared with the Conflict dashboard, whose module graph stays
      account-free: it renders the bookmark through an import-free slot that /map fills.
    */
    const sourceCard = readFileSync(join(root, 'map/shell/SourceCard.tsx'), 'utf8');
    expect(sourceCard).toContain('useContext(StoryBookmarkSlot)');
    expect(sourceCard).not.toContain("from '@/components/bookmark/StoryBookmark'");
    expect(readFileSync(join(root, '..', 'app/map/page.tsx'), 'utf8')).toContain('<MapBookmarkProvider>');
    /* No component mounts its own saved-story read any more. */
    const home = readFileSync(join(root, 'my-intelligence/HomeSaveControl.tsx'), 'utf8');
    expect(home).not.toContain('useSavedStories');
  });
});

/* ─────────────────────────────── C · following ──────────────────────────── */

const ISO3 = ['POL', 'KEN', 'BRA', 'JPN', 'DEU', 'FRA', 'ITA', 'ESP', 'NGA', 'EGY', 'IND', 'CHN', 'USA', 'CAN', 'MEX', 'ARG', 'CHL', 'PER', 'COL', 'VEN', 'ZAF', 'GHA', 'SEN', 'MAR', 'TUN', 'DZA', 'ETH', 'UGA', 'RWA', 'TZA', 'AUS', 'NZL', 'IDN', 'MYS', 'THA', 'VNM', 'PHL', 'KOR', 'PAK', 'BGD', 'TUR', 'IRN', 'IRQ', 'SAU', 'ARE', 'ISR', 'UKR', 'SWE', 'NOR', 'FIN'];

describe('C · Following is one compact control with a bounded list', () => {
  const followsResponse = (n: number) => ok({ follows: ISO3.slice(0, n).map((countryCode) => ({ countryCode })), maxFollows: 60 });

  it.each([0, 1, 11, 50])('%i followed countries: every row in ONE bounded, scrollable list; filter only when long', async (n) => {
    transport.mockResolvedValue(followsResponse(n));
    await mountAll(createElement(following.FollowingList, { language: 'en', fallbackFollows: ISO3.slice(0, n), newByCountry: {} }));
    const rows = all((node) => node.props['data-mi-following-row'] !== undefined);
    expect(rows).toHaveLength(n);
    if (n > 0) expect(all((node) => node.props['data-mi-following-scroll'] !== undefined)[0].props.className).toContain('overflow-y-auto');
    expect(all((node) => node.type === 'input')).toHaveLength(n > following.FOLLOWING_FILTER_THRESHOLD ? 1 : 0);
    /* Opening the list is one ACCOUNT read of the existing follow API — never AI. */
    expect(calls('GET', '/follows/countries')).toHaveLength(1);
    expect(analyzeNews).not.toHaveBeenCalled();
  });

  it('filtering is local: no request', async () => {
    transport.mockResolvedValue(followsResponse(50));
    await mountAll(createElement(following.FollowingList, { language: 'en', fallbackFollows: ISO3, newByCountry: {} }));
    const before = transport.mock.calls.length;
    act(() => all((node) => node.type === 'input')[0].props.onChange({ target: { value: 'pol' } }));
    expect(all((node) => node.props['data-mi-following-row'] !== undefined).map((r) => r.props['data-mi-following-row'])).toEqual(['POL']);
    expect(transport.mock.calls.length).toBe(before);
  });

  it('Unfollow uses the existing follow API once and the country stays listed to re-follow', async () => {
    let followed = ['POL', 'KEN'];
    transport.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') {
        followed = followed.filter((c) => !path.endsWith(c));
        return ok(null, 204);
      }
      return ok({ follows: followed.map((countryCode) => ({ countryCode })), maxFollows: 60 });
    });
    const counts: number[] = [];
    await mountAll(createElement(following.FollowingList, { language: 'en', fallbackFollows: ['POL', 'KEN'], newByCountry: {}, onCountChange: (c: number) => counts.push(c) }));
    const toggle = () => all((node) => node.props['data-mi-following-row'] === 'POL')[0].findAll((n) => n.props['data-mi-follow-toggle'] !== undefined)[0];
    await act(async () => {
      toggle().props.onClick();
    });
    expect(calls('DELETE')).toHaveLength(1);
    expect(calls('DELETE')[0][0]).toBe('/follows/countries/POL');
    expect(toggle().props['data-mi-follow-toggle']).toBe('follow');
    expect(counts[counts.length - 1]).toBe(1);
  });

  it('the Overview control makes NO request until opened, then renders a bounded popout', async () => {
    transport.mockResolvedValue(followsResponse(11));
    await mountAll(createElement(following.FollowingControl, { language: 'en', follows: ISO3.slice(0, 11), newByCountry: {} }));
    const trigger = all((node) => node.props['aria-haspopup'] === 'dialog')[0];
    expect(text(trigger)).toContain('Following 11');
    expect(transport).not.toHaveBeenCalled();
    expect(all((node) => node.props['data-mi-following-popout'] !== undefined)).toHaveLength(0);
    await act(async () => {
      trigger.props.onClick();
    });
    const popout = all((node) => node.props['data-mi-following-popout'] !== undefined)[0];
    expect(popout.props.role).toBe('dialog');
    expect(popout.props.className).toContain('max-h-[65dvh]');
    expect(popout.props.className).toContain('md:max-h-[420px]');
    expect(popout.props.className).toContain('md:w-[380px]');
    expect(calls('GET', '/follows/countries')).toHaveLength(1);
    expect(analyzeNews).not.toHaveBeenCalled();
  });

  it('Following is cyan/neutral, never mint', () => {
    const source = readFileSync(join(__dirname, 'MiFollowing.tsx'), 'utf8');
    expect(source).not.toMatch(/#5BE3A8/i);
  });

  it('PL: "Obserwujesz: 11"', async () => {
    await mountAll(createElement(following.FollowingControl, { language: 'pl', follows: ISO3.slice(0, 11), newByCountry: {} }));
    expect(text(all((node) => node.props['aria-haspopup'] === 'dialog')[0])).toContain('Obserwujesz: 11');
  });
});

/* ─────────────────────────────── D · recent ─────────────────────────────── */

const question = (i: number, long = false) => ({
  id: `q${i}`,
  query: long ? `${'Co dalej z inflacją w Polsce i jej skutkami dla gospodarstw domowych '.repeat(4)}#${i}` : `Question ${i}`,
  countryCode: null,
  createdAt: '2026-09-27T08:00:00.000Z',
});

describe('D · Recent Intelligence never renders an unbounded list', () => {
  it.each([0, 3, 50, 1000])('Overview with %i questions renders at most the preview limit', async (n) => {
    await mountAll(createElement(sections.RecentSection, { questions: Array.from({ length: n }, (_, i) => question(i)), language: 'en' }));
    const rows = all((node) => node.props['data-mi-recent-row'] !== undefined);
    expect(rows).toHaveLength(Math.min(n, sections.RECENT_PREVIEW_LIMIT));
    if (n > sections.RECENT_PREVIEW_LIMIT) {
      expect(text(all((node) => node.props.href === '/history')[0])).toContain(`View all (${n})`);
    }
  });

  it('the Recent tab with 1000 questions renders at most the API list bound, in a bounded internal scroll', async () => {
    await mountAll(
      createElement(sections.RecentSection, {
        questions: Array.from({ length: 1000 }, (_, i) => question(i)),
        language: 'en',
        limit: SEARCH_HISTORY_LIST_LIMIT,
        bounded: true,
      }),
    );
    expect(all((node) => node.props['data-mi-recent-row'] !== undefined)).toHaveLength(SEARCH_HISTORY_LIST_LIMIT);
    const list = all((node) => node.props['data-mi-recent-list'] !== undefined)[0];
    expect(list.props.className).toContain('max-h-[440px]');
    expect(list.props.className).toContain('overflow-y-auto');
  });

  it('Ask again stages the question only (a link to /ask?q=), 0 AI; long EN/PL titles clamp', async () => {
    await mountAll(createElement(sections.RecentSection, { questions: [question(1, true)], language: 'pl' }));
    const askAgain = all((node) => typeof node.props.href === 'string' && node.props.href.startsWith('/ask?q='))[0];
    expect(askAgain.props['aria-label']).toMatch(/^Zapytaj ponownie: /);
    expect(askAgain.props.className).toContain('h-[44px] w-[44px]');
    const title = all((node) => node.props.title === question(1, true).query)[0];
    expect(title.props.className).toContain('line-clamp-2');
    expect(title.props.className).toContain('md:line-clamp-1');
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
});
