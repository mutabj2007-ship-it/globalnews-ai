import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeArticleUrl, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import * as newsApi from '@/lib/api/newsApi';
import { getHomeFeed, type HomeFeed } from '@/lib/homeFeed';
import type { HomeSession } from './HomeSession';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R2 60-SECOND ALLOCATION STARVATION CORRECTION R1
 * ════════════════════════════════════════════════════════════════════════════
 * Live Alpha after PR #61: the exclusive remainder (`latestUpdates`) was empty,
 * so Your world in 60 seconds showed its empty-state card beside a populated
 * What's happening now. The first screen is now ONE partition of the ONE Home
 * response: both modules populated whenever ≥2 distinct stories exist, and
 * never a shared story (id or canonical URL). Every case below runs through the
 * real getHomeFeed() with its single retrieval mocked.
 */

const mockSession: HomeSession = { user: null, isLoading: false, follows: null, newSinceCount: null };
jest.mock('./HomeSession', () => ({
  useHomeSession: () => mockSession,
  HomeSessionProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/bookmark/StoryBookmark', () => ({ StoryBookmark: () => null }));
jest.mock('@/components/my-intelligence/HomeSaveControl', () => ({ HomeSaveControl: () => null }));
jest.mock('@/components/home/StoryVisual', () => ({ StoryVisual: () => null }));
jest.mock('@/components/ui/SafeImage', () => ({ SafeImage: () => null }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const alloc = require('./worldIn60Allocation') as typeof import('./worldIn60Allocation');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WorldIn60Seconds } = require('./WorldIn60Seconds') as typeof import('./WorldIn60Seconds');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WhatsHappeningNow } = require('../WhatsHappeningNow') as typeof import('../WhatsHappeningNow');

const DIR = __dirname;
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const PAGE = readFileSync(join(DIR, '../../../app/page.tsx'), 'utf8');
const ALLOCATOR = readFileSync(join(DIR, 'worldIn60Allocation.ts'), 'utf8');

const PUBLISHERS = ['Manchester Evening News', 'The Guardian', 'PBS', 'UA.news', 'Real Madrid CF'];
const CATEGORIES = ['world', 'politics', 'business', 'technology', 'sports', 'science'] as const;
const BASE = Date.parse('2026-09-28T12:00:00Z');

function story(i: number, overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: `s${i}`,
    title: `Distinct headline number ${i} about a separate development`,
    summary: `Summary ${i}`,
    url: `https://publisher${i}.example/news/story-${i}`,
    imageUrl: `https://img.example/${i}.jpg`,
    sourceId: `pub-${i % PUBLISHERS.length}`,
    sourceName: PUBLISHERS[i % PUBLISHERS.length],
    category: CATEGORIES[i % CATEGORIES.length],
    sourcesCount: 1,
    publishedAt: new Date(BASE - i * 7 * 60_000).toISOString(),
    ...overrides,
  } as NewsArticle;
}

const ids = (list: readonly NewsArticle[]): Set<string> => new Set(list.map((a) => a.id));
const urls = (list: readonly NewsArticle[]): Set<string> => new Set(list.map((a) => normalizeArticleUrl(a.url)));
const intersect = (a: Set<string>, b: Set<string>): string[] => [...a].filter((x) => b.has(x));
const whatsList = (w: ReturnType<typeof alloc.allocateHomeFirstScreen>['whats']): NewsArticle[] =>
  [...(w.featured === null ? [] : [w.featured]), ...w.inFocus, ...w.discovery];

let fetchSpy: jest.Mock;
let originalFetch: typeof fetch;
beforeEach(() => {
  originalFetch = global.fetch;
  fetchSpy = jest.fn();
  global.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

async function liveShaped(n: number): Promise<{ feed: HomeFeed; retrievals: number }> {
  const articles = Array.from({ length: n }, (_, i) => story(i));
  const res = { articles, totalResults: n, providers: ['gnews'], dataMode: 'live', generatedAt: new Date(BASE).toISOString() } as NewsResponse;
  const spy = jest.spyOn(newsApi, 'fetchTopHeadlines').mockResolvedValue(res);
  const feed = await getHomeFeed('en');
  return { feed, retrievals: spy.mock.calls.length };
}

/*
  The allocation table the CTO asked for. w60 = the 60-second set (the module
  renders at most five of it); whats = What's happening now after the partition.
*/
const TABLE: Array<[stories: number, latest: number, w60: number, w60Shown: number, whats: number, transferred: number]> = [
  [24, 12, 12, 5, 12, 0],
  [15, 3, 5, 5, 10, 2],
  [12, 0, 3, 3, 9, 3],
  [9, 0, 3, 3, 6, 3],
  [4, 0, 1, 1, 3, 1],
  [3, 0, 1, 1, 2, 1],
  [2, 0, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0],
];

describe('W60 STARVATION R1 — one first-screen partition of the one Home response', () => {
  it.each(TABLE)(
    '%i distinct stories → latestUpdates %i, 60 s %i (shows %i), What’s happening %i, transferred %i, intersection 0',
    async (n, latest, w60Count, shown, whatsCount, transferred) => {
      const { feed, retrievals } = await liveShaped(n);
      expect(retrievals).toBe(1);
      expect(feed.latestUpdates).toHaveLength(latest);

      const screen = alloc.allocateHomeFirstScreen(feed);
      const whats = whatsList(screen.whats);
      expect(screen.worldIn60).toHaveLength(w60Count);
      expect(whats).toHaveLength(whatsCount);
      expect(n - latest - whatsCount).toBe(transferred);

      // Mutually exclusive by id AND canonical URL.
      expect(intersect(ids(whats), ids(screen.worldIn60))).toEqual([]);
      expect(intersect(urls(whats), urls(screen.worldIn60))).toEqual([]);
      // A partition of the response: nothing invented, nothing dropped.
      expect(ids([...whats, ...screen.worldIn60]).size).toBe(n);
      // The featured story never moves.
      if (n > 0) expect(screen.whats.featured?.id).toBe('s0');
      // Both populated whenever ≥2 distinct stories; What's keeps ≥3 at normal widths.
      if (n >= 2) expect(screen.worldIn60.length).toBeGreaterThanOrEqual(1);
      expect(whats.length).toBeGreaterThanOrEqual(Math.min(n, n >= 4 ? 3 : Math.max(n - 1, 1)));
      // Newest first.
      const times = screen.worldIn60.map((a) => Date.parse(a.publishedAt));
      expect(times).toEqual([...times].sort((a, b) => b - a));

      // Rendered: 60 s shows a real lead (no empty state) whenever ≥2 stories; no shared href on screen.
      const w60Html = renderToStaticMarkup(createElement(WorldIn60Seconds, { items: screen.worldIn60, language: 'en', showEmptyState: screen.whats.featured !== null }));
      const whatsHtml = renderToStaticMarkup(
        createElement(WhatsHappeningNow, { lead: screen.whats.featured, secondary: screen.whats.inFocus, discovery: screen.whats.discovery, dataMode: feed.dataMode, language: 'en' }),
      );
      const hrefs = (html: string): Set<string> => new Set([...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => normalizeArticleUrl(m[1])));
      expect(intersect(hrefs(w60Html), hrefs(whatsHtml))).toEqual([]);
      expect(hrefs(w60Html).size).toBe(shown);
      if (n >= 2) {
        expect(w60Html.match(/data-home-w60-lead=""/g)).toHaveLength(1);
        expect(w60Html).not.toContain('data-home-w60-empty');
      } else {
        expect(w60Html).toContain('data-home-w60-empty=""');
      }
      // Publisher attribution and neutral provenance survive the partition.
      for (const a of screen.worldIn60.slice(0, shown)) expect(w60Html).toContain(a.sourceName);
      if (whats.length > 0) expect(whatsHtml).toContain('LIVE REPORTING');
      expect(whatsHtml).not.toMatch(/GNews/);

      // No request of any kind beyond the one mocked retrieval.
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('a transferred newer brief story leads over an older disjoint remainder story', async () => {
    const { feed } = await liveShaped(15);
    const screen = alloc.allocateHomeFirstScreen(feed);
    expect(screen.worldIn60.map((a) => a.id)).toEqual(['s1', 's2', 's12', 's13', 's14']);
  });

  it('what’s-happening floor: 0–1 → keep all, 2 → 1, 3 → 2, ≥4 → 3', () => {
    expect([0, 1, 2, 3, 4, 5, 12].map(alloc.whatsFloor)).toEqual([0, 1, 1, 2, 3, 3, 3]);
  });
});

describe('W60 STARVATION R1 — identity: duplicate ids and canonical-URL variants', () => {
  it('a transfer removes every What’s happening copy (same id, or same canonical URL) and never doubles the 60 s set', () => {
    const featured = story(0);
    const a = story(1);
    const aSameIdOtherUrl = { ...story(1), url: 'https://mirror.example/other-path-1' };
    const aUrlVariant = { ...story(1), id: 'a-variant', url: `${story(1).url}?utm_source=feed` };
    const b = story(2);
    const c = story(3);
    const screen = alloc.allocateHomeFirstScreen({
      featured,
      inFocus: [a, b, aUrlVariant],
      discovery: [aSameIdOtherUrl, c],
      latestUpdates: [{ ...story(2), id: 'b-dup-in-latest', url: `${story(2).url}#top` }],
      briefUpdates: [a, b, { ...featured, id: 'featured-variant' }],
    });
    const whats = whatsList(screen.whats);
    expect(intersect(ids(whats), ids(screen.worldIn60))).toEqual([]);
    expect(intersect(urls(whats), urls(screen.worldIn60))).toEqual([]);
    // The latestUpdates URL variant of b is excluded (b is in What's happening). Transferring a removes
    // all three of its copies, which brings What's happening to its floor of 3, so b stays there.
    expect(screen.worldIn60.map((x) => x.id)).toEqual(['s1']);
    expect(whats.map((x) => x.id)).toEqual(['s0', 's2', 's3']);
    // The featured story (and its variant) never leaves What's happening.
    expect(screen.whats.featured).toBe(featured);
  });

  it('the featured story is never transferred, even as the only brief candidate', () => {
    const screen = alloc.allocateHomeFirstScreen({
      featured: story(0),
      inFocus: [story(1)],
      discovery: [],
      latestUpdates: [],
      briefUpdates: [{ ...story(0), id: 'featured-dup' }],
    });
    expect(screen.worldIn60).toEqual([]);
    expect(whatsList(screen.whats).map((x) => x.id)).toEqual(['s0', 's1']);
  });
});

describe('W60 STARVATION R1 — wiring and economy', () => {
  it('page reads one partition; no newestFirst, no overlapping briefUpdates as the 60 s input', () => {
    expect(PAGE).toMatch(/const firstScreen = allocateHomeFirstScreen\(feed\);/);
    expect(PAGE).toMatch(/<WorldIn60Seconds items=\{worldIn60\}/);
    expect(code(PAGE)).not.toMatch(/newestFirst/);
    expect(code(PAGE)).not.toMatch(/items=\{feed\.briefUpdates\}/);
    expect(code(PAGE).match(/getHomeFeed\(/g)).toHaveLength(1);
  });

  it('the allocator is pure: no fetch, no AI, and the one shared URL identity', () => {
    const src = code(ALLOCATOR);
    expect(src).not.toMatch(/fetch\(|analyzeNews|accountFetch|lib\/api/);
    expect(src).toMatch(/normalizeArticleUrl/);
    expect(src).not.toMatch(/new URL\(/);
  });
});
