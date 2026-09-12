import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

/**
 * G-ALPHA-2 ACCEPTANCE — END TO END THROUGH THE REAL AnalysisService.
 *
 * Everything below runs the SHIPPED service. Only NewsService and
 * CountryNewsService are stubbed, at their own boundaries, and the stubs
 * reproduce the real retrieval contract rather than a convenient one: the
 * generic stub applies the REAL, UNMODIFIED scoreGenericRelevance exactly where
 * NewsService applies it, and the country stub applies the REAL, UNMODIFIED
 * scoreCountryRelevance exactly where CountryNewsService applies it. So an
 * "accepted" article here is an article the shipped gates would accept.
 *
 * No network call. No live provider. The analysis provider is a spy that
 * THROWS if it is ever reached without evidence.
 */

interface Harness {
  service: AnalysisService;
  searchCalls: Array<{ query: string; mode: string }>;
  countryCalls: string[];
  provider: AnalysisProvider;
}

function article(id: string, title: string, summary: string, countryCode?: string): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://wire.example/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    countryCode,
    publishedAt: '2026-08-29T06:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
  } as NewsArticle;
}

function harness(corpus: NewsArticle[], anchor?: NewsArticle): Harness {
  const searchCalls: Array<{ query: string; mode: string }> = [];
  const countryCalls: string[] = [];

  const newsService = {
    search: jest.fn(
      async (query: string, _limit?: number, mode?: { type?: string }): Promise<NewsResponse> => {
        searchCalls.push({ query, mode: mode?.type ?? 'none' });

        // The REAL gate, applied exactly where NewsService applies it — and
        // ONLY when the caller opted in, exactly as NewsService does.
        const articles =
          mode?.type === 'generic'
            ? corpus.filter((candidate) => scoreGenericRelevance(candidate, query).isRelevant)
            : corpus;

        return {
          articles,
          totalResults: articles.length,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: new Date().toISOString(),
        } as NewsResponse;
      },
    ),
    topHeadlines: jest.fn(
      async (): Promise<NewsResponse> =>
        ({
          articles: [],
          totalResults: 0,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: new Date().toISOString(),
        }) as NewsResponse,
    ),
    findArticleById: jest.fn(async () => anchor ?? null),
  };

  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      countryCalls.push(identifier);

      const country = resolveCountryByAnyIdentifier(identifier);
      const articles = country
        ? corpus.filter((candidate) => scoreCountryRelevance(candidate, country).isRelevant)
        : [];

      return {
        countryCode: country?.iso3 ?? identifier,
        countryName: country?.name ?? identifier,
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: new Date().toISOString(),
      } as unknown as CountryNewsResponse;
    }),
  };

  const provider: AnalysisProvider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn(async () => {
      throw new Error('analysis provider reached');
    }),
  };

  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;

  return {
    service: new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      config,
    ),
    searchCalls,
    countryCalls,
    provider,
  };
}

const UKRAINE_RUSSIA = [
  article(
    'u1',
    'Ukraine reports overnight strikes on energy infrastructure',
    'Officials in Kyiv said the grid was hit again.',
  ),
  article(
    'u2',
    'Russia says talks on grain corridor stalled',
    'Moscow blamed the impasse on European conditions.',
  ),
  article(
    'z1',
    'Rainfall was above average this month',
    'No country was named anywhere in this report.',
  ),
];

const RWANDA_KENYA = [
  article(
    'r1',
    'Rwanda unveils a new investment plan',
    'Kigali said the programme starts in October.',
  ),
  article('k1', 'Kenya central bank holds interest rates', 'Nairobi kept its benchmark unchanged.'),
  article(
    'z2',
    'Rainfall was above average this month',
    'No country was named anywhere in this report.',
  ),
];

/* ------------------------------------------------------------------ */

describe('THE REPORTED FAILURES — measured end to end', () => {
  it('NQ-001 the Ukrainian/Russian question now retrieves BOTH sides and yields evidence', async () => {
    const { service, searchCalls, countryCalls } = harness(UKRAINE_RUSSIA);

    const response = await service.analyzeNews(
      'Provide recent updates in the Ukrainian and Russian conflicts affecting both ' +
        'countries and other countries affected economically and politically.',
    );

    expect(searchCalls.map((call) => call.query)).toEqual(['Ukraine', 'Russia']);
    expect(countryCalls).toEqual([]);
    expect(response.articles.length).toBeGreaterThan(0);
    expect(response.retrievalContext.articlesRetrieved).toBe(response.articles.length);
  });

  it('NQ-002 an ordinary "it" never routes to Italy', async () => {
    const { service, countryCalls } = harness([]);

    await service.analyzeNews(
      'What is quantum? Explain what quantum is and elaborate more about it.',
    );

    expect(countryCalls).toEqual([]);
  });

  it('NQ-003 an implicit comparison asks for clarification and spends NO provider call', async () => {
    const { service, searchCalls, countryCalls, provider } = harness(RWANDA_KENYA);

    const response = await service.analyzeNews('Which country is more powerful in East Africa?');

    expect(searchCalls).toEqual([]);
    expect(countryCalls).toEqual([]);
    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('NQ-004 the conversational entity question still works — G-ALPHA-1 D2 preserved', async () => {
    const { service, searchCalls } = harness([
      article(
        't1',
        'President Donald Trump comments on the budget',
        'He said the proposal was unacceptable.',
      ),
    ]);

    const response = await service.analyzeNews('What do you know about President Donald Trump?');

    expect(searchCalls[0]).toEqual({ query: 'President Donald Trump', mode: 'generic' });
    expect(response.articles).toHaveLength(1);
  });
});

describe('CTO REGRESSION EXAMPLES', () => {
  it('"What is happening between Russia and Ukraine?" retrieves both sides, in the order asked', async () => {
    const { service, searchCalls } = harness(UKRAINE_RUSSIA);

    const response = await service.analyzeNews('What is happening between Russia and Ukraine?');

    expect(searchCalls.map((call) => call.query)).toEqual(['Russia', 'Ukraine']);
    expect(response.articles).toHaveLength(2);
  });

  it('"Compare the current situations in Rwanda and Kenya." is NOT answered with one of them', async () => {
    const { service, searchCalls, countryCalls } = harness(RWANDA_KENYA);

    const response = await service.analyzeNews(
      'Compare the current situations in Rwanda and Kenya.',
    );

    // The measured baseline behaviour was a single Rwanda country feed.
    expect(countryCalls).toEqual([]);
    expect(searchCalls.map((call) => call.query)).toEqual(['Rwanda', 'Kenya']);
    expect(response.articles).toHaveLength(2);
  });

  it('"Explain quantum computing." searches the subject, not the sentence', async () => {
    const { service, searchCalls } = harness([
      article(
        'c1',
        'Quantum computing startup raises a funding round',
        'The company says its chip is stable.',
      ),
    ]);

    const response = await service.analyzeNews('Explain quantum computing.');

    expect(searchCalls[0].query).toBe('quantum computing');
    expect(response.articles).toHaveLength(1);
  });

  it('"What is quantum?" searches the subject too', async () => {
    const { service, searchCalls } = harness([]);

    await service.analyzeNews('What is quantum?');

    expect(searchCalls[0].query).toBe('quantum');
  });

  it('a demonym routes to that country feed', async () => {
    const { service, countryCalls } = harness(RWANDA_KENYA);

    await service.analyzeNews('Kenyan election results');

    expect(countryCalls).toEqual(['KEN']);
  });
});

describe('NO EXISTING ROUTE MOVED', () => {
  it('an explicit single-country question still uses the country feed', async () => {
    const { service, countryCalls, searchCalls } = harness(RWANDA_KENYA);

    await service.analyzeNews('What is happening in Rwanda?');

    expect(countryCalls).toEqual(['RWA']);
    expect(searchCalls).toEqual([]);
  });

  it('an ordinary generic topic still takes the generic path with its derived query', async () => {
    const { service, searchCalls, countryCalls } = harness([]);

    await service.analyzeNews("What's happening with NATO?");

    expect(countryCalls).toEqual([]);
    expect(searchCalls[0].mode).toBe('generic');
    expect(searchCalls[0].query).toBe('NATO');
  });

  it('an explicit ISO code still resolves', async () => {
    const { service, countryCalls } = harness([]);

    await service.analyzeNews('is USA under pressure of war?');

    expect(countryCalls).toEqual(['USA']);
  });

  it('a relational question still takes M37s relational path, not per-side retrieval', async () => {
    const { service, searchCalls } = harness([]);

    await service.analyzeNews('How is climate change affecting food prices?');

    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0].mode).toBe('relational');
  });
});

describe('ARTICLE_ANCHORED PRECEDENCE — required by the CTO, enforced by the service', () => {
  const anchor = article(
    'anchor-1',
    'Hotel worker charged in Penang assault case',
    'The accused appeared in court in George Town.',
    'MYS',
  );

  it('a resolved articleId outranks a multi-entity reading', async () => {
    const { service, searchCalls, countryCalls } = harness(UKRAINE_RUSSIA, anchor);

    await service.analyzeNews('What is happening between Russia and Ukraine?', 'en', {
      articleId: 'anchor-1',
      title: anchor.title,
    });

    // No per-side retrieval, and no country feed: the anchor branch owns this.
    expect(searchCalls.map((call) => call.query)).not.toContain('Russia');
    expect(searchCalls.map((call) => call.query)).not.toContain('Ukraine');
    expect(countryCalls).toEqual([]);
  });

  it('a resolved articleId outranks a comparison reading', async () => {
    const { service, searchCalls } = harness(RWANDA_KENYA, anchor);

    await service.analyzeNews('Compare the current situations in Rwanda and Kenya.', 'en', {
      articleId: 'anchor-1',
      title: anchor.title,
    });

    expect(searchCalls.map((call) => call.query)).not.toContain('Rwanda');
    expect(searchCalls.map((call) => call.query)).not.toContain('Kenya');
  });

  it('a resolved articleId outranks a clarification reading — the anchor is answerable', async () => {
    const { service, searchCalls } = harness(RWANDA_KENYA, anchor);

    const response = await service.analyzeNews(
      'Which country is more powerful in East Africa?',
      'en',
      { articleId: 'anchor-1', title: anchor.title },
    );

    // The clarification branch makes NO provider call at all; the anchor branch
    // does. A non-empty call list is proof the anchor branch ran instead.
    expect(searchCalls.length).toBeGreaterThan(0);
    expect(response.retrievalContext).toBeDefined();
  });
});

describe('THE EVIDENCE GATES ARE NOT WEAKENED', () => {
  it('per-side retrieval admits ONLY articles the country gate accepts', async () => {
    const { service } = harness(UKRAINE_RUSSIA);

    const response = await service.analyzeNews('What is happening between Russia and Ukraine?');

    // The third corpus article names no country and is rejected by the real
    // gate — it must not ride in on a sibling side's retrieval.
    expect(response.articles.map((item) => item.id).sort()).toEqual(['u1', 'u2']);
  });

  it('zero qualifying evidence across every side still means NO analysis call', async () => {
    const { service, provider } = harness([
      article('z3', 'Rainfall was above average this month', 'No country was named.'),
    ]);

    const response = await service.analyzeNews('What is happening between Russia and Ukraine?');

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('a side is never duplicated into evidence twice', async () => {
    const shared = article(
      's1',
      'Russia and Ukraine resume talks',
      'Moscow and Kyiv met on Tuesday.',
    );
    const { service } = harness([shared]);

    const response = await service.analyzeNews('What is happening between Russia and Ukraine?');

    expect(response.articles).toHaveLength(1);
  });

  it('retrieval metadata is truthful when nothing qualified', async () => {
    const { service } = harness([
      article('z4', 'Rainfall was above average this month', 'No country was named.'),
    ]);

    const response = await service.analyzeNews('What is happening between Russia and Ukraine?');

    expect(response.retrievalContext.articlesRetrieved).toBe(0);
    expect(response.retrievalContext.fallbackReason).toBe('no-live-results');
    // The providers ANSWERED — they are not blamed for having nothing.
    expect(response.retrievalContext.providers).toEqual(['gnews']);
  });
});
