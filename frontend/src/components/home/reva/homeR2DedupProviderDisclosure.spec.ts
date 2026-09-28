import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeArticleUrl, type NewsArticle, type NewsDataMode, type NewsResponse } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { allocateHomeFeed } from '@/lib/homeFeedAllocation';
import type { HomeSession } from './HomeSession';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R2 STORY DEDUPLICATION + PROVIDER DISCLOSURE CORRECTION R1
 * ════════════════════════════════════════════════════════════════════════════
 * - Your world in 60 seconds and What's happening now never show the same
 *   story at once (id AND canonical URL), and the 60-second module is never
 *   padded: fewer distinct stories means fewer rows.
 * - Still ONE Home retrieval, no added provider call, no AI.
 * - Home's live badge is provider-neutral; cached / demo / unavailable /
 *   unknown stay visible and truthful; publisher names stay.
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
const { WorldIn60Seconds } = require('./WorldIn60Seconds') as typeof import('./WorldIn60Seconds');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { allocateWorldIn60 } = require('./worldIn60Allocation') as typeof import('./worldIn60Allocation');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WhatsHappeningNow } = require('../WhatsHappeningNow') as typeof import('../WhatsHappeningNow');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DataModeLabel } = require('@/components/ui/DataModeLabel') as typeof import('@/components/ui/DataModeLabel');

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
const response = (n: number): NewsArticle[] => Array.from({ length: n }, (_, i) => story(i));

function homeRoles(articles: NewsArticle[]) {
  const feed = allocateHomeFeed(articles);
  const whats = [...(feed.featured === null ? [] : [feed.featured]), ...feed.inFocus, ...feed.discovery];
  return { feed, whats, w60: allocateWorldIn60(feed) };
}
const ids = (list: readonly NewsArticle[]): Set<string> => new Set(list.map((a) => a.id));
const urls = (list: readonly NewsArticle[]): Set<string> => new Set(list.map((a) => normalizeArticleUrl(a.url)));
const intersect = (a: Set<string>, b: Set<string>): string[] => [...a].filter((x) => b.has(x));

const renderW60 = (items: readonly NewsArticle[], language: 'en' | 'pl' = 'en', showEmptyState = true): string =>
  renderToStaticMarkup(createElement(WorldIn60Seconds, { items, language, showEmptyState }));

describe('DATA SEPARATION — What’s happening now and the 60-second module are disjoint', () => {
  it('normal 24-story response: What’s happening keeps its editorial roles, 60 s gets distinct stories', () => {
    const { feed, whats, w60 } = homeRoles(response(24));
    expect(feed.featured).not.toBeNull();
    expect(feed.inFocus).toHaveLength(5);
    expect(feed.discovery).toHaveLength(6);
    expect(whats).toHaveLength(12);
    expect(w60).toHaveLength(12);
    expect(intersect(ids(whats), ids(w60))).toEqual([]);
    expect(intersect(urls(whats), urls(w60))).toEqual([]);

    const shown = [...renderW60(w60).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(shown).size).toBe(5);
    for (const href of shown) expect(urls(whats).has(normalizeArticleUrl(href))).toBe(false);
  });

  it('page wiring: both modules read ONE first-screen partition, never the merged pool', () => {
    /* W60 STARVATION R1 — the partition replaces the one-sided subtraction. */
    expect(PAGE).toMatch(/lead=\{whats\.featured\}/);
    expect(PAGE).toMatch(/secondary=\{whats\.inFocus\}/);
    expect(PAGE).toMatch(/discovery=\{whats\.discovery\}/);
    expect(PAGE).toMatch(/const firstScreen = allocateHomeFirstScreen\(feed\);/);
    expect(PAGE).toMatch(/<WorldIn60Seconds items=\{worldIn60\}/);
    expect(code(PAGE)).not.toMatch(/newestFirst/);
  });

  it('guards by id AND canonical URL even if the pool is handed a What’s happening story', () => {
    const { feed } = homeRoles(response(24));
    const lead = feed.featured as NewsArticle;
    const focus = feed.inFocus[0];
    const pool = allocateWorldIn60({
      ...feed,
      latestUpdates: [
        { ...lead }, // same id
        { ...focus, id: 'variant-id', url: `${focus.url}?utm_source=x` }, // new id, same canonical URL
        story(90),
        { ...story(90), id: 's90-dup' }, // duplicate within the pool by URL
        story(91),
      ],
    });
    expect(pool.map((a) => a.id)).toEqual(['s90', 's91']);
  });

  it('fewer than five distinct latest stories: renders fewer, no duplicate filling', () => {
    const { whats, w60 } = homeRoles(response(15));
    expect(w60).toHaveLength(3);
    const html = renderW60(w60);
    expect(html.match(/data-home-w60-lead=""/g)).toHaveLength(1);
    expect(html.match(/data-home-w60-row=""/g)).toHaveLength(2);
    for (const a of whats) expect(html).not.toContain(`href="${a.url}"`);
    for (const a of w60) expect(html).toContain(a.title);
  });

  /* W60 STARVATION R1 — the page no longer shows this empty remainder (see homeW60StarvationR1.spec.ts); the pure helper and the component's empty state are still pinned here. */
  it('narrow response: the disjoint remainder is empty; the empty state stays truthful, no "five" promise', () => {
    const { whats, w60 } = homeRoles(response(9));
    expect(whats).toHaveLength(9);
    expect(w60).toEqual([]);
    for (const language of ['en', 'pl'] as const) {
      const html = renderW60(w60, language);
      expect(html).toContain('data-home-w60-empty=""');
      expect(html).not.toMatch(/href=/);
      expect(html).not.toMatch(/Five|Pięć/);
    }
    // Empty feed (nothing in What's happening either): the module is simply absent.
    expect(renderW60([], 'en', false)).toBe('');
    expect(PAGE).toMatch(/showEmptyState=\{whats\.featured !== null\}/);
  });

  it('copy is count-neutral in EN and PL', () => {
    for (const language of ['en', 'pl'] as const) {
      const w = getDictionary(language).homeReva.w60;
      expect(`${w.note} ${w.noteSigned} ${w.empty}`).not.toMatch(/\b(five|5)\b|pięć/i);
    }
  });
});

describe('PROVIDER CALLS — one Home retrieval, nothing added', () => {
  afterEach(() => jest.restoreAllMocks());

  it('getHomeFeed issues exactly one request; the 60 s allocation and render add none', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const newsApi = require('@/lib/api/newsApi') as typeof import('@/lib/api/newsApi');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getHomeFeed } = require('@/lib/homeFeed') as typeof import('@/lib/homeFeed');
    const res = { articles: response(24), totalResults: 24, providers: ['gnews'], dataMode: 'live', generatedAt: new Date(BASE).toISOString() } as NewsResponse;
    const spy = jest.spyOn(newsApi, 'fetchTopHeadlines').mockResolvedValue(res);
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const feed = await getHomeFeed('en');
      const pool = allocateWorldIn60(feed);
      renderW60(pool);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
      const whats = [...(feed.featured ? [feed.featured] : []), ...feed.inFocus, ...feed.discovery];
      expect(intersect(ids(whats), ids(pool))).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('the page still calls getHomeFeed once; the allocator and module carry no fetch/AI path', () => {
    expect(code(PAGE).match(/getHomeFeed\(/g)).toHaveLength(1);
    expect(code(ALLOCATOR)).not.toMatch(/fetch\(|analyzeNews|accountFetch|lib\/api/);
    const w60Source = code(readFileSync(join(DIR, 'WorldIn60Seconds.tsx'), 'utf8'));
    expect(w60Source).not.toMatch(/fetch\(|accountFetch|analyzeNews/);
  });
});

describe('PROVENANCE — provider-neutral on Home, every state truthful', () => {
  const whats = (dataMode: NewsDataMode | null, language: 'en' | 'pl'): string => {
    const { feed } = homeRoles(response(24));
    return renderToStaticMarkup(
      createElement(WhatsHappeningNow, { lead: feed.featured, secondary: feed.inFocus, discovery: feed.discovery, dataMode, language }),
    );
  };

  it('live: "LIVE REPORTING" / "RELACJE NA ŻYWO", never "Powered by GNews"', () => {
    expect(whats('live', 'en')).toContain('LIVE REPORTING');
    expect(whats('live', 'pl')).toContain('RELACJE NA ŻYWO');
    for (const language of ['en', 'pl'] as const) {
      const html = whats('live', language);
      expect(html).not.toMatch(/GNews/i);
      expect(html).not.toMatch(/Powered by|Obsługiwane przez/i);
    }
  });

  it.each([
    ['cached', 'CACHED · Previously retrieved reporting', 'Z PAMIĘCI · Wcześniej pobrane relacje'],
    ['mock', 'DEMO MODE · Sample content only', 'TRYB DEMO · Wyłącznie treść przykładowa'],
    ['unavailable', 'NO REPORTING AVAILABLE', 'BRAK DOSTĘPNYCH RELACJI'],
    [null, 'DATA STATUS UNKNOWN', 'STATUS DANYCH NIEZNANY'],
  ] as const)('%s stays visible and truthful in EN and PL', (mode, en, pl) => {
    expect(whats(mode, 'en')).toContain(en);
    expect(whats(mode, 'pl')).toContain(pl);
  });

  it('bounded: DataModeLabel without Home labels is unchanged for every other caller', () => {
    expect(renderToStaticMarkup(createElement(DataModeLabel, { dataMode: 'live', language: 'en' }))).toContain('LIVE · Powered by GNews');
    expect(renderToStaticMarkup(createElement(DataModeLabel, { dataMode: 'unavailable', language: 'en' }))).toContain('DATA STATUS UNKNOWN');
    expect(getDictionary('en').liveStatusStrip.live).toBe('LIVE · Powered by GNews');
  });

  it('provider identity remains disclosed in Source Policy', () => {
    const en = readFileSync(join(DIR, '../../../lib/i18n/dictionaries/en.ts'), 'utf8');
    expect(en).toMatch(/depends on a single provider, GNews/);
  });
});

describe('PUBLISHER SOURCE — actual publishers stay rendered', () => {
  it('both modules render each story’s own sourceName', () => {
    const { feed, w60 } = homeRoles(response(24));
    const w60Html = renderW60(w60);
    for (const a of w60.slice(0, 5)) expect(w60Html).toContain(a.sourceName);
    const whatsHtml = renderToStaticMarkup(
      createElement(WhatsHappeningNow, { lead: feed.featured, secondary: feed.inFocus, discovery: feed.discovery, dataMode: 'live', language: 'en' }),
    );
    for (const name of PUBLISHERS) expect(whatsHtml).toContain(name);
  });
});
