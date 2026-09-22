import { AnalysisService } from './modules/analysis/service/analysis.service';

it.each([
  ['Rwanda and Kenya', ['Rwanda', 'Kenya']],
  ['Israel, Iran, Saudi Arabia, Turkey and the UAE', []],
])(
  'long explicit scope %s does not inherit a previous relation or Pakistan story',
  async (countries, expected) => {
    const empty = {
      articles: [],
      totalResults: 0,
      providers: [],
      dataMode: 'live',
      generatedAt: new Date().toISOString(),
    };
    const news = {
      search: jest.fn().mockResolvedValue(empty),
      findArticleById: jest.fn().mockResolvedValue(null),
      findRetainedByCountry: jest.fn().mockResolvedValue([]),
      findRetainedByQuery: jest.fn().mockResolvedValue([]),
    };
    const country = { getCountryNews: jest.fn() };
    const provider = { id: 'denied', displayName: 'Denied', isMock: true, analyzeNews: jest.fn() };
    const config = {
      get: () => ({
        maxArticles: 8,
        maxArticleChars: 1200,
        timeoutMs: 20000,
        totalBudgetMs: 32000,
        cacheTtlSeconds: 0,
        executionMode: 'development',
        retryAttempts: 0,
        retryBaseDelayMs: 300,
        maxCompletionTokens: 2000,
      }),
    };
    const service = new AnalysisService(
      news as never,
      country as never,
      provider as never,
      config as never,
    );
    const result = await service.analyzeNews(
      'Compare how current local reporting in ' +
        countries +
        ' is framing the same regional security developments and identify the limits of the available evidence.',
      'en',
      { articleId: 'stale-pakistan', countryCode: 'PAK', title: 'Pakistan security measure' },
      'How does Middle East conflict affect East Africa?',
    );
    expect(news.search.mock.calls.map((call) => call[0])).toEqual(expected);
    expect(country.getCountryNews).not.toHaveBeenCalled();
    expect(news.findArticleById).not.toHaveBeenCalled();
    expect(result.articles).toEqual([]);
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  },
);
