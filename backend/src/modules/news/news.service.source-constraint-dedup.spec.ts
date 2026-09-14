import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';

import { NewsService } from './news.service';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { resolveRequestedSource } from './identity/requested-source.util';

/**
 * REV B · A — THE REQUESTED PUBLISHER MUST SURVIVE CROSS-PROVIDER DEDUP.
 *
 * THE EDGE. `buildResponse()` collapses cross-provider duplicates before any
 * admission rule runs, and it picks a deterministic WINNER: higher
 * `sourcesCount` first, then PROVIDER REGISTRATION ORDER, then id. GDELT DOC
 * is registered ahead of the Publisher Feeds connector, so at equal
 * `sourcesCount` a GDELT record carrying the same story BEATS the Statistics
 * Poland record — and the feed article is gone before attribution is ever
 * consulted. Rev A's constraint then filtered a set the right article had
 * already been deleted from, and the reader got zero.
 *
 * Every test uses a REAL NewsService through the real Nest testing module,
 * with real tier tokens. `newsService.search` is not stubbed. Offline.
 */

interface StubOptions {
  readonly id: string;
  readonly articles?: NewsArticle[];
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
      return options.articles ?? [];
    },
    async topHeadlines(): Promise<NewsArticle[]> {
      provider.calls += 1;
      return options.articles ?? [];
    },
    async category(): Promise<NewsArticle[]> {
      provider.calls += 1;
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

async function buildService(primaries: NewsProvider[], fallbacks: NewsProvider[]): Promise<NewsService> {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
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

const TOPIC = 'demand for labour in Quarter 2 2026';
const GUS = resolveRequestedSource('Statistics Poland')!;

/**
 * THE COLLISION, BUILT TO THE WINNER RULE'S OWN TERMS.
 *
 * Identical titles, so the similarity decision is unambiguous. DIFFERENT
 * urls, so this is decided by the similarity pass rather than the exact-URL
 * identity pass. EQUAL `sourcesCount`, so the first tie-break is exhausted
 * and REGISTRATION ORDER decides — which is the condition under which the
 * wrong publisher wins.
 */
const SHARED_TITLE = 'Demand for labour in Quarter 2 2026';
const SHARED_SUMMARY =
  'Figures on the demand for labour in Quarter 2 2026, including vacancies and newly created workplaces.';

/** The requested publisher's own record, arriving on the Publisher Feeds connector. */
const GUS_RECORD: NewsArticle = {
  id: 'rss-gus-1',
  title: SHARED_TITLE,
  summary: SHARED_SUMMARY,
  url: 'https://stat.gov.pl/en/topics/labour-market/demand-for-labour-q2-2026,1,45.html',
  sourceId: 'feed:gus-pl',
  sourceName: 'Statistics Poland',
  providerId: 'rss-feeds',
  category: 'business',
  sourcesCount: 3,
  publishedAt: '2026-09-05T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

/** A GDELT record for the same story, from a publisher the reader did not ask about. */
const GDELT_RECORD: NewsArticle = {
  id: 'gdelt-1',
  title: SHARED_TITLE,
  summary: SHARED_SUMMARY,
  url: 'https://wiadomosci.wp.pl/rynek-pracy-q2-2026-123456',
  sourceId: 'gdelt-doc',
  sourceName: 'Wirtualna Polska — Wiadomości',
  providerId: 'gdelt-doc',
  category: 'business',
  sourcesCount: 3,
  publishedAt: '2026-09-05T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

/** Topically relevant, wrong publisher — this is what ends the primary tier. */
const GNEWS_WRONG_PUBLISHER: NewsArticle = {
  id: 'gnews-1',
  title: 'Demand for labour in Quarter 2 2026 slows, analysts say',
  summary: 'Coverage of the demand for labour in Quarter 2 2026 from a national newsroom.',
  url: 'https://wiadomosci.wp.pl/analiza-2026',
  sourceId: 'feed:wp-pl',
  sourceName: 'Wirtualna Polska — Wiadomości',
  providerId: 'gnews',
  category: 'business',
  sourcesCount: 1,
  publishedAt: '2026-09-05T07:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

/*
 * GDELT DOC is registered AHEAD of the Publisher Feeds connector, which is the
 * accepted order and the thing that makes it win an otherwise-tied collision.
 */
function tiers() {
  const gnews = stubProvider({ id: 'gnews', articles: [GNEWS_WRONG_PUBLISHER] });
  const gdelt = stubProvider({ id: 'gdelt-doc', capabilities: ['search'], articles: [GDELT_RECORD] });
  const feeds = stubProvider({ id: 'rss-feeds', capabilities: ['search'], articles: [GUS_RECORD] });

  return { gnews, gdelt, feeds };
}

/* ------------------------------------------------------------------ */

describe('REV B · A1 — the unconstrained winner rule, pinned before anything is changed', () => {
  it('GDELT wins the tie on registration order when no source was requested', async () => {
    const { gnews, gdelt, feeds } = tiers();
    const service = await buildService([gnews], [gdelt, feeds]);

    // No constraint: gnews answers with a relevant article, so the ladder
    // stops at the primary and the collision never even forms.
    const response = await service.search(TOPIC, 10, { type: 'generic' });

    expect(response.articles.map((a) => a.id)).toEqual(['gnews-1']);
    expect(gdelt.calls).toBe(0);
    expect(feeds.calls).toBe(0);
  });

  it('and when the collision DOES form, GDELT is still the winner', async () => {
    // The primary contributes nothing, so both fallback providers answer into
    // one merged set and the cross-provider rule actually decides.
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const gdelt = stubProvider({ id: 'gdelt-doc', capabilities: ['search'], articles: [GDELT_RECORD] });
    const feeds = stubProvider({ id: 'rss-feeds', capabilities: ['search'], articles: [GUS_RECORD] });

    const service = await buildService([gnews], [gdelt, feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' });

    /*
     * THIS IS THE PRE-EXISTING BEHAVIOUR AND IT MUST NOT MOVE. One story
     * survives, and it is GDELT's — equal sourcesCount, earlier registration.
     */
    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].id).toBe('gdelt-1');
  });
});

describe('REV B · A2 — the requested publisher survives the collision', () => {
  it('Statistics Poland is not erased by a wrong-publisher GDELT duplicate', async () => {
    const { gnews, gdelt, feeds } = tiers();
    const service = await buildService([gnews], [gdelt, feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    // The primary's relevant-but-wrong-publisher article no longer ends the
    // ladder, so both fallback providers are asked…
    expect(gdelt.calls).toBe(1);
    expect(feeds.calls).toBe(1);

    // …and the record that survives is the one that was asked for.
    expect(response.articles.map((a) => a.id)).toEqual(['rss-gus-1']);
    expect(response.articles[0].sourceId).toBe('feed:gus-pl');
    expect(response.articles[0].sourceName).toBe('Statistics Poland');
    expect(response.articles[0].url.startsWith('https://stat.gov.pl/')).toBe(true);
    expect(response.totalResults).toBe(1);
  });

  it('provenance still names every provider that answered, including the narrowed-away one', async () => {
    const { gnews, gdelt, feeds } = tiers();
    const service = await buildService([gnews], [gdelt, feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    /*
     * Narrowing the candidate pool must not rewrite history. GDELT and GNews
     * both answered; that they carried nothing attributable is a fact about
     * the evidence, not about whether they responded.
     */
    expect(response.providers).toEqual(expect.arrayContaining(['gnews', 'gdelt-doc', 'rss-feeds']));
    expect(response.dataMode).toBe('live');
  });

  it('the narrowing admits nothing — an unrelated publisher still cannot get in', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const gdelt = stubProvider({ id: 'gdelt-doc', capabilities: ['search'], articles: [GDELT_RECORD] });
    const feeds = stubProvider({
      id: 'rss-feeds',
      capabilities: ['search'],
      articles: [
        {
          ...GUS_RECORD,
          id: 'rss-kt-1',
          url: 'https://www.ktpress.rw/2026/09/labour-q2',
          sourceId: 'feed:ktpress-rw',
          sourceName: 'KT Press',
        } as NewsArticle,
      ],
    });

    const service = await buildService([gnews], [gdelt, feeds]);

    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });

    expect(response.articles).toEqual([]);
  });
});
