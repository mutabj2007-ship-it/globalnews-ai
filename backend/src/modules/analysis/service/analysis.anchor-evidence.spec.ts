import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';

/**
 * R4 ANALYSIS FINAL CLOSURE — the CTO's numbered regression contract, executed
 * end to end through AnalysisService.
 *
 * These are checked-in tests, not a harness: they run under the repository's
 * own jest configuration alongside analysis.service.spec.ts and share its
 * fixture idioms deliberately, so a future reader compares like with like.
 *
 * The anchor is the exact story from the failing browser session. The
 * candidate pool is the exact Sources Dock it produced. Nothing here is
 * invented copy.
 */

const ANCHOR_ID = 'anchor-penang';
const ANCHOR_TITLE =
  'Hotel worker charged with sexually assaulting Australian three-year-old in Penang';

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'id',
    title: 'title',
    summary: 'summary',
    url: 'https://example.com',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSearchResponse(
  articles: NewsArticle[],
  overrides: Partial<NewsResponse> = {},
): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCountryResponse(
  countryCode: string,
  countryName: string,
  articles: NewsArticle[],
): CountryNewsResponse {
  return {
    countryCode,
    countryName,
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    feedTier: 'delayed',
    providerDisplayName: 'Mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeConfigService(): AnalysisConfigService {
  return {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      /*
        REV B — STATED, NOT INHERITED. AnalysisService arms its total response
        deadline from this field. Every double in this repository predates it, so
        each one silently supplied `undefined`; `withResponseDeadline` now resolves
        that to the shared authority rather than to an accidental zero, but a test
        that exercises the real service should say which budget it is running
        under rather than rely on a fallback. This is the shipped value, so no
        existing timing expectation changes.
      */
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 300,
      openAiApiKey: undefined,
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
}

const ANCHOR = makeArticle({
  id: ANCHOR_ID,
  title: ANCHOR_TITLE,
  summary:
    'A hotel worker has been charged in Penang after an Australian three-year-old was assaulted at the hotel.',
  url: 'https://example.com/penang-anchor',
  countryCode: 'AU',
  countryName: 'Australia',
});

/** The real Sources Dock: every one of these is about Australia and none is about this event. */
const UNRELATED_AUSTRALIAN_POOL: NewsArticle[] = [
  makeArticle({
    id: 'au-inflation',
    url: 'https://example.com/au-inflation',
    title: 'Australian inflation climbs to a two-year high',
    summary:
      'Inflation in Australia rose again last quarter, with the Australian Bureau of Statistics reporting broad price increases.',
    countryCode: 'AU',
  }),
  makeArticle({
    id: 'au-puppets',
    url: 'https://example.com/au-puppets',
    title: 'Puppet workshop brings a century-old craft back to life in Australia',
    summary:
      'A puppet workshop in regional Australia is teaching the craft to a new generation of Australian makers.',
    countryCode: 'AU',
  }),
  makeArticle({
    id: 'au-murder',
    url: 'https://example.com/au-murder',
    title: 'Man charged over the murder of an Irish mother in Australia',
    summary:
      'A man has been charged with murder after an Irish mother was killed in Australia. Australian police said the man was arrested overnight.',
    countryCode: 'AU',
  }),
  makeArticle({
    id: 'au-investment',
    url: 'https://example.com/au-investment',
    title: 'Japanese investment in Australian energy reaches a record',
    summary:
      'Japanese investment in Australia hit a record this year, with Australian energy projects attracting the bulk of the new investment.',
    countryCode: 'AU',
  }),
  makeArticle({
    id: 'au-defence',
    url: 'https://example.com/au-defence',
    title: 'Australia, Japan and the United States hold trilateral defence talks',
    summary:
      'Defence ministers met for trilateral talks. Australia said the defence relationship remains central to Australian planning.',
    countryCode: 'AU',
  }),
];

const SAME_EVENT_INDEPENDENT_REPORT = makeArticle({
  id: 'penang-independent',
  url: 'https://example.com/penang-independent',
  title: 'Penang hotel employee charged over assault of Australian toddler',
  summary:
    'A hotel worker in Penang has been charged after an Australian three-year-old was assaulted at the hotel. Police in Penang said the hotel worker appeared in court.',
  countryCode: 'AU',
});

function buildService(options: {
  searchResults: NewsArticle[] | NewsResponse;
  anchor?: NewsArticle | null;
  countryArticles?: NewsArticle[];
  provider?: AnalysisProvider;
}) {
  const search = jest
    .fn()
    .mockResolvedValue(
      Array.isArray(options.searchResults)
        ? makeSearchResponse(options.searchResults)
        : options.searchResults,
    );
  const findArticleById = jest
    .fn()
    .mockResolvedValue(options.anchor === undefined ? ANCHOR : options.anchor);
  const getCountryNews = jest
    .fn()
    .mockResolvedValue(
      makeCountryResponse('AUS', 'Australia', options.countryArticles ?? UNRELATED_AUSTRALIAN_POOL),
    );

  const provider: AnalysisProvider = options.provider ?? {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised in this test')),
  };

  const service = new AnalysisService(
    { search, findArticleById } as never,
    { getCountryNews } as never,
    provider,
    makeConfigService(),
  );

  return { service, search, findArticleById, getCountryNews, provider };
}

const STORY_CONTEXT = { title: ANCHOR_TITLE, articleId: ANCHOR_ID, countryCode: 'AU' };

describe('R4 REGRESSION 1 — the provider query is derived from the article, not "Australia"', () => {
  it('sends an anchor-derived query and never the bare country name', async () => {
    const { service, search } = buildService({
      searchResults: UNRELATED_AUSTRALIAN_POOL,
    });

    await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);

    expect(search).toHaveBeenCalled();
    const sent = String(search.mock.calls[0][0]);
    expect(sent).not.toBe('Australia');
    expect(sent.toLowerCase()).not.toContain('australia');
    expect(sent.toLowerCase()).toContain('penang');
  });

  it('does not route an anchored request through the country feed at all', async () => {
    const { service, getCountryNews } = buildService({ searchResults: [] });
    await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    expect(getCountryNews).not.toHaveBeenCalled();
  });
});

describe('R4 REGRESSION 2 — the anchor is present and first', () => {
  it('keeps the selected article at the front of the evidence set', async () => {
    const { service } = buildService({
      searchResults: [SAME_EVENT_INDEPENDENT_REPORT, ...UNRELATED_AUSTRALIAN_POOL],
    });

    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);

    expect(response.articles.length).toBeGreaterThan(0);
    expect(response.articles[0].id).toBe(ANCHOR_ID);
  });
});

describe('R4 REGRESSION 3 — unrelated same-country reporting is rejected', () => {
  it('returns the anchor alone when every candidate is merely Australian', async () => {
    const { service } = buildService({ searchResults: UNRELATED_AUSTRALIAN_POOL });

    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);

    expect(response.articles.map((a) => a.id)).toEqual([ANCHOR_ID]);
  });

  it('none of the seven observed stories survives', async () => {
    const { service } = buildService({ searchResults: UNRELATED_AUSTRALIAN_POOL });
    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    const retained = new Set(response.articles.map((a) => a.id));
    for (const unrelated of UNRELATED_AUSTRALIAN_POOL) {
      expect(retained.has(unrelated.id)).toBe(false);
    }
  });
});

describe('R4 REGRESSION 4 — a genuinely independent report of the same event is retained', () => {
  it('keeps the same-event report and discards the unrelated ones in the same pool', async () => {
    const { service } = buildService({
      searchResults: [...UNRELATED_AUSTRALIAN_POOL, SAME_EVENT_INDEPENDENT_REPORT],
    });

    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    const ids = response.articles.map((a) => a.id);

    expect(ids).toContain('penang-independent');
    expect(ids).toEqual([ANCHOR_ID, 'penang-independent']);
  });
});

describe('R4 REGRESSION 5 — the Airport Chaplain / Tuvalu control', () => {
  const CHAPLAIN_TITLE = 'The Airport Chaplain who has comforted travellers for thirty years';
  const CHAPLAIN = makeArticle({
    id: 'anchor-chaplain',
    url: 'https://example.com/chaplain',
    title: CHAPLAIN_TITLE,
    summary: 'A chaplain at the airport has met travellers for three decades.',
    countryCode: 'TV',
    countryName: 'Tuvalu',
  });

  const TUVALU_POOL = [
    makeArticle({
      id: 'tv-climate',
      url: 'https://example.com/tv-climate',
      title: 'Tuvalu signs a new climate resilience agreement',
      summary:
        'Tuvalu has signed an agreement on climate resilience. Tuvalu officials welcomed it.',
      countryCode: 'TV',
    }),
    makeArticle({
      id: 'tv-fisheries',
      url: 'https://example.com/tv-fisheries',
      title: 'Fisheries revenue rises for Tuvalu',
      summary: 'Tuvalu reported higher fisheries revenue this year, with Tuvalu licensing vessels.',
      countryCode: 'TV',
    }),
  ];

  it('rejects unrelated Tuvalu country news — the same defect must not survive in a second country', async () => {
    const search = jest.fn().mockResolvedValue(makeSearchResponse(TUVALU_POOL));
    const service = new AnalysisService(
      { search, findArticleById: jest.fn().mockResolvedValue(CHAPLAIN) } as never,
      { getCountryNews: jest.fn() } as never,
      {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised')),
      },
      makeConfigService(),
    );

    const response = await service.analyzeNews(CHAPLAIN_TITLE, 'en', {
      title: CHAPLAIN_TITLE,
      articleId: 'anchor-chaplain',
      countryCode: 'TV',
    });

    expect(response.articles.map((a) => a.id)).toEqual(['anchor-chaplain']);
  });
});

describe('R4 REGRESSION 6 — honest scarcity, and no country-feed top-up', () => {
  it('an anchor-only evidence set is a valid result', async () => {
    const { service } = buildService({ searchResults: [] });
    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].id).toBe(ANCHOR_ID);
  });

  it('never calls the country feed to make the evidence set look larger', async () => {
    const { service, getCountryNews } = buildService({ searchResults: [] });
    await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    expect(getCountryNews).not.toHaveBeenCalled();
  });

  it('prefers one relevant report over eight unrelated ones', async () => {
    const { service } = buildService({
      searchResults: [...UNRELATED_AUSTRALIAN_POOL, SAME_EVENT_INDEPENDENT_REPORT],
    });
    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    expect(response.articles.length).toBeLessThanOrEqual(2);
  });

  it('bounds the retry: at most two provider calls for an anchored request', async () => {
    const { service, search } = buildService({ searchResults: [] });
    await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    expect(search.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('R4 REGRESSION 7 — Evidence Geography still resolves Australia', () => {
  it('reports the country from the retained evidence, without the country-feed branch', async () => {
    const { service, getCountryNews } = buildService({
      searchResults: [SAME_EVENT_INDEPENDENT_REPORT],
    });

    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);

    expect(getCountryNews).not.toHaveBeenCalled();
    expect(response.retrievalContext.countryCode).toBe('AU');
    expect(response.retrievalContext.countryName).toBe('Australia');
  });

  it('still resolves geography when the evidence is the anchor alone', async () => {
    const { service } = buildService({ searchResults: [] });
    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    expect(response.retrievalContext.countryName).toBe('Australia');
  });

  it('does NOT promote geography beyond evidence precision — city is never manufactured here', async () => {
    const { service } = buildService({ searchResults: [] });
    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);
    expect(response.retrievalContext.city).toBeUndefined();
    expect(response.retrievalContext.matchedFrom).toBeUndefined();
  });

  it('reports no country at all when neither the anchor nor the evidence supports one', async () => {
    const anchorWithoutCountry = makeArticle({
      id: 'anchor-nogeo',
      url: 'https://example.com/nogeo',
      title: 'Semiconductor export controls tighten again',
      summary: 'New export controls were announced.',
    });

    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const service = new AnalysisService(
      { search, findArticleById: jest.fn().mockResolvedValue(anchorWithoutCountry) } as never,
      { getCountryNews: jest.fn() } as never,
      {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised')),
      },
      makeConfigService(),
    );

    const response = await service.analyzeNews(
      'Semiconductor export controls tighten again',
      'en',
      {
        title: 'Semiconductor export controls tighten again',
        articleId: 'anchor-nogeo',
      },
    );

    expect(response.retrievalContext.countryCode).toBeUndefined();
  });
});

describe('R4 REGRESSION 8 — the World Map country feed is unchanged', () => {
  /**
   * The strongest proof that the correction did not leak out of the Analysis
   * lane is that country-news.service.ts and country-relevance.util.ts carry no
   * diff at all — the closure evidence records that. This test adds the
   * behavioral half: the anchor gate must not reach the country branch even
   * when the very same articles pass through it.
   *
   * The pool below is the one the anchor gate rejects wholesale. On the country
   * path every one of them must still be retained, because on that path the
   * question genuinely IS "is this about Australia?" and the answer genuinely
   * is yes. A correction that made these disappear from the World Map would
   * have fixed Analysis by breaking the map.
   */
  it('a country-feed request still returns every country-relevant article', async () => {
    const getCountryNews = jest
      .fn()
      .mockResolvedValue(makeCountryResponse('AUS', 'Australia', UNRELATED_AUSTRALIAN_POOL));

    const service = new AnalysisService(
      { search: jest.fn(), findArticleById: jest.fn() } as never,
      { getCountryNews } as never,
      {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised')),
      },
      makeConfigService(),
    );

    const response = await service.analyzeNews('Australia');

    expect(getCountryNews).toHaveBeenCalled();
    expect(response.articles.map((a) => a.id).sort()).toEqual(
      UNRELATED_AUSTRALIAN_POOL.map((a) => a.id).sort(),
    );
  });

  it('the country branch still reports its own country geography exactly as before', async () => {
    const getCountryNews = jest
      .fn()
      .mockResolvedValue(makeCountryResponse('AUS', 'Australia', UNRELATED_AUSTRALIAN_POOL));

    const service = new AnalysisService(
      { search: jest.fn(), findArticleById: jest.fn() } as never,
      { getCountryNews } as never,
      {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised')),
      },
      makeConfigService(),
    );

    const response = await service.analyzeNews('Australia');

    expect(response.retrievalContext.countryCode).toBe('AUS');
    expect(response.retrievalContext.countryName).toBe('Australia');
    expect(response.retrievalContext.providerDisplayName).toBe('Mock');
  });
});

describe('R4 REGRESSION 9 — generic, non-article analysis is unaffected', () => {
  it('an ordinary question with no storyContext never looks up an anchor', async () => {
    const { service, findArticleById } = buildService({
      searchResults: [makeArticle({ id: 'generic-1', title: 'NATO summit opens in Brussels' })],
    });

    await service.analyzeNews('What is happening with NATO?');

    expect(findArticleById).not.toHaveBeenCalled();
  });

  it('a storyContext carrying only a countryCode still takes the country-feed branch', async () => {
    const { service, getCountryNews, findArticleById } = buildService({
      searchResults: [],
      anchor: null,
    });

    await service.analyzeNews('Australia', 'en', { title: 'Australia', countryCode: 'AU' });

    expect(findArticleById).not.toHaveBeenCalled();
    expect(getCountryNews).toHaveBeenCalled();
  });

  it('an articleId that does not resolve falls back to the pre-R4 path exactly', async () => {
    const { service, getCountryNews } = buildService({ searchResults: [], anchor: null });

    await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);

    expect(getCountryNews).toHaveBeenCalled();
  });
});

describe('R4 REGRESSION 10 — OpenAI is never invoked without evidence', () => {
  it('does not call the analysis provider when retrieval yields nothing at all', async () => {
    const analyzeNews = jest.fn();
    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const service = new AnalysisService(
      { search, findArticleById: jest.fn().mockResolvedValue(null) } as never,
      {
        getCountryNews: jest.fn().mockResolvedValue(makeCountryResponse('AUS', 'Australia', [])),
      } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews },
      makeConfigService(),
    );

    const response = await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);

    expect(analyzeNews).not.toHaveBeenCalled();
    expect(response.analysis).toBeNull();
    expect(response.articles).toEqual([]);
  });

  it('the anchor alone IS evidence — the guard must not refuse a thin but real set', async () => {
    const analyzeNews = jest.fn().mockRejectedValue(new Error('provider unavailable'));
    const { service } = buildService({
      searchResults: [],
      provider: { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews },
    });

    await service.analyzeNews(ANCHOR_TITLE, 'en', STORY_CONTEXT);

    expect(analyzeNews).toHaveBeenCalled();
  });
});

describe('R4 REGRESSION 14 — a punctuation-only retrieval input never becomes a malformed provider query', () => {
  it('makes no provider call and returns the honest non-retrievable state', async () => {
    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const analyzeNews = jest.fn();
    const service = new AnalysisService(
      { search, findArticleById: jest.fn().mockResolvedValue(null) } as never,
      { getCountryNews: jest.fn() } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews },
      makeConfigService(),
    );

    const response = await service.analyzeNews('!!! ??? ...');

    expect(search).not.toHaveBeenCalled();
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(response.articles).toEqual([]);
    expect(response.retrievalContext.dataMode).toBe('unavailable');
    expect(response.retrievalContext.articlesRetrieved).toBe(0);
  });
});
