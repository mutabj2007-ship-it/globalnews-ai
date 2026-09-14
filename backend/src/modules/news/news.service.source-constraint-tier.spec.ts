import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';

import { NewsService } from './news.service';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { resolveRequestedSource } from './identity/requested-source.util';

/**
 * NATURAL SOURCE-ATTRIBUTED QUESTION R1 REV A — THE TIER PROOF.
 *
 * THE BLOCKER THIS FILE EXISTS FOR. R1 applied the requested-publisher
 * constraint in AnalysisService, to whatever NewsService had already returned.
 * `callAllProviders()` stops at the primary tier the moment the primaries
 * return at least one RAW article. So:
 *
 *   GNews healthy -> returns one topically relevant article from the WRONG
 *   publisher -> the ladder stops -> Publisher Feeds is never asked -> the
 *   constraint removes the only article there was -> ZERO.
 *
 * …while `feed:gus-pl` held exactly the report the reader asked for. R1 only
 * worked while GNews was failing, which is to say it did not work.
 *
 * EVERY TEST BELOW USES A REAL NewsService, compiled through the real Nest
 * testing module, with real tier tokens and real provider objects at the
 * primary and fallback tiers. `newsService.search` is NOT stubbed anywhere in
 * this file — the tier ladder, the bounded post-relevance rescue and the
 * constraint all run for real. Everything is offline: no network, no live
 * provider, no Railway state.
 */

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: `Story ${overrides.id}`,
    summary: 'Summary',
    url: `https://primary.example/${overrides.id}`,
    sourceId: 'gnews',
    sourceName: 'Primary Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-05T09:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
    ...overrides,
  };
}

/** The topic half AnalysisService derives from the reported question. */
const TOPIC = 'demand for labour in Quarter 2 2026';

/** Statistics Poland's own record: curated sourceId AND the publisher's own host. */
function gusArticle(id: string): NewsArticle {
  return article({
    id,
    title: 'Demand for labour in Quarter 2 2026',
    summary: 'Statistics Poland presents data on the demand for labour in Quarter 2 2026.',
    url: `https://stat.gov.pl/en/topics/labour-market/${id},1,45.html`,
    sourceId: 'feed:gus-pl',
    sourceName: 'Statistics Poland',
  });
}

/** Topically relevant, and NOT the requested publisher. */
function wrongPublisherArticle(id: string): NewsArticle {
  return article({
    id,
    title: 'Demand for labour in Quarter 2 2026 slows, analysts say',
    summary: 'Coverage of the demand for labour in Quarter 2 2026 from a national newsroom.',
    url: `https://wiadomosci.wp.pl/${id}`,
    sourceId: 'feed:wp-pl',
    sourceName: 'Wirtualna Polska — Wiadomości',
  });
}

/** Topically irrelevant — the gate rejects it before attribution is even asked. */
function irrelevantArticle(id: string): NewsArticle {
  return article({
    id,
    title: 'Unrelated harvest report',
    summary: 'Rainfall was above average in the region.',
    url: `https://primary.example/${id}`,
  });
}

interface StubOptions {
  readonly id: string;
  readonly articles?: NewsArticle[];
  readonly failWith?: Error;
  readonly capabilities?: readonly NewsProviderCapability[];
}

function stubProvider(options: StubOptions): NewsProvider & { calls: number } {
  const provider = {
    id: options.id,
    displayName: options.id,
    isMock: false,
    calls: 0,
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    async search(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async topHeadlines(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async category(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async health() {
      return {
        providerId: options.id,
        displayName: options.id,
        status: 'ok' as const,
        checkedAt: '2026-09-05T09:00:00.000Z',
      };
    },
  };

  return provider as NewsProvider & { calls: number };
}

async function buildService(
  primaries: NewsProvider[],
  fallbacks: NewsProvider[],
  storedArticles: NewsArticle[] = [],
): Promise<NewsService> {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue(storedArticles),
    findById: jest.fn().mockResolvedValue(null),
  };

  const active = [...primaries, ...fallbacks];

  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: active },
      { provide: ALL_NEWS_PROVIDERS, useValue: active },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbacks },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();

  return moduleRef.get(NewsService);
}

const GUS = resolveRequestedSource('Statistics Poland')!;

/* ------------------------------------------------------------------ */

describe('REV A · T1 — the blocker itself: healthy GNews must not end the ladder', () => {
  it('consults the fallback tier once and Statistics Poland survives', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [wrongPublisherArticle('p1')] });
    const feeds = stubProvider({
      id: 'rss-feeds',
      capabilities: ['search'],
      articles: [gusArticle('f1')],
    });

    const service = await buildService([gnews], [feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    /*
     * THE DECISIVE FACT. GNews answered with a RAW article, so under R1 the
     * ladder stopped here and this expectation was 0.
     */
    expect(feeds.calls).toBe(1);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
    expect(response.articles[0].sourceId).toBe('feed:gus-pl');
    expect(response.articles[0].url.startsWith('https://stat.gov.pl/')).toBe(true);
    expect(response.totalResults).toBe(1);
  });
});

describe('REV A · T2 — a genuine Statistics Poland record on the PRIMARY tier', () => {
  it('survives, and the fallback tier is not spent', async () => {
    // Delivered by GNews, but the record is the publisher's own: transport is
    // not publisher, so trusted domain identity admits it.
    const gnews = stubProvider({
      id: 'gnews',
      articles: [
        { ...gusArticle('p1'), sourceId: 'gnews', sourceName: 'Statistics Poland' },
        wrongPublisherArticle('p2'),
      ],
    });
    const feeds = stubProvider({ id: 'rss-feeds', capabilities: ['search'], articles: [gusArticle('f1')] });

    const service = await buildService([gnews], [feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(response.articles.map((a) => a.id)).toEqual(['p1']);
    expect(feeds.calls).toBe(0);
  });
});

describe('REV A · T3 — the fallback has no qualifying evidence either', () => {
  it('returns zero evidence rather than another publisher', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [wrongPublisherArticle('p1')] });
    const feeds = stubProvider({
      id: 'rss-feeds',
      capabilities: ['search'],
      articles: [wrongPublisherArticle('f1')],
    });

    const service = await buildService([gnews], [feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(feeds.calls).toBe(1);
    expect(response.articles).toEqual([]);
    expect(response.totalResults).toBe(0);
  });
});

describe('REV A · T4 — the Alpha success that already worked must keep working', () => {
  it('GNews fails outright and the Statistics Poland fallback still answers', async () => {
    const gnews = stubProvider({ id: 'gnews', failWith: new Error('quota exhausted') });
    const feeds = stubProvider({
      id: 'rss-feeds',
      capabilities: ['search'],
      articles: [gusArticle('f1')],
    });

    const service = await buildService([gnews], [feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
    expect(feeds.calls).toBe(1);
  });
});

describe('REV A · T5 — a GDELT timeout in the SAME fan-out must not erase the feed article', () => {
  it('keeps the Publisher Feed record when its tier-mate throws', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [wrongPublisherArticle('p1')] });
    const feeds = stubProvider({
      id: 'rss-feeds',
      capabilities: ['search'],
      articles: [gusArticle('f1')],
    });
    const gdelt = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      failWith: new Error('GDELT DOC timed out after 8000ms'),
    });

    // Both sit in the fallback tier, in the accepted order.
    const service = await buildService([gnews], [feeds, gdelt]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(feeds.calls).toBe(1);
    expect(gdelt.calls).toBe(1);

    // The failure is recorded, and it costs nothing that succeeded.
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
    expect(response.articles[0].sourceId).toBe('feed:gus-pl');
  });
});

describe('REV A · T6 — an unrelated fallback publisher cannot satisfy the constraint', () => {
  it('rejects a topically relevant fallback record from the wrong newsroom', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const feeds = stubProvider({
      id: 'rss-feeds',
      capabilities: ['search'],
      articles: [
        // KT Press is curated, and it is not who was asked about.
        article({
          id: 'f1',
          title: 'Demand for labour in Quarter 2 2026 discussed at summit',
          summary: 'Regional coverage of the demand for labour in Quarter 2 2026.',
          url: 'https://www.ktpress.rw/2026/09/labour-q2',
          sourceId: 'feed:ktpress-rw',
          sourceName: 'KT Press',
        }),
      ],
    });

    const service = await buildService([gnews], [feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(feeds.calls).toBe(1);
    expect(response.articles).toEqual([]);
  });
});

describe('REV A · T7 — the constraint is OPTIONAL and additive', () => {
  it('a caller that passes none reaches byte-identical behaviour', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [wrongPublisherArticle('p1')] });
    const feeds = stubProvider({ id: 'rss-feeds', capabilities: ['search'], articles: [gusArticle('f1')] });

    const service = await buildService([gnews], [feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' });

    // No constraint: the primary's relevant article is enough, the ladder
    // stops, and the fallback is never consulted — exactly as before Rev A.
    expect(feeds.calls).toBe(0);
    expect(response.articles.map((a) => a.id)).toEqual(['p1']);
  });

  it('and the un-gated public search path is untouched', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const feeds = stubProvider({ id: 'rss-feeds', capabilities: ['search'] });

    const service = await buildService([gnews], [feeds]);

    const response = await service.search(TOPIC, 10);

    expect(response.articles.map((a) => a.id)).toEqual(['p1']);
  });
});

describe('REV A · T8 — the STORED path obeys the same rule', () => {
  it('retained reporting from another publisher cannot answer the question', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = stubProvider({ id: 'rss-feeds', capabilities: ['search'], articles: [] });

    // The database holds a topically relevant record — from the wrong publisher.
    const service = await buildService([gnews], [feeds], [wrongPublisherArticle('s1')]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(response.articles).toEqual([]);
  });

  it('and retained Statistics Poland reporting still answers it', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = stubProvider({ id: 'rss-feeds', capabilities: ['search'], articles: [] });

    const service = await buildService([gnews], [feeds], [gusArticle('s1')]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(response.articles.map((a) => a.id)).toEqual(['s1']);
  });
});
