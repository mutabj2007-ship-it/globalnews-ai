import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';

/**
 * GEO-PRECISION — G3, THE ANALYSIS LOCATION SCAN.
 *
 * The shrinking scan tries the longest prefix of a captured phrase first and
 * gives up a word at a time. Measured before this repair:
 *
 *     resolveCountryByAnyIdentifier('Niger State') -> no match
 *     resolveCountryByAnyIdentifier('Niger')       -> Niger (NER)
 *
 * so "in Niger State" failed at two words, discarded "State", matched the bare
 * head word, and routed retrieval into the sovereign Niger country feed — a
 * second, independent instance of the same defect, on a different code path
 * from the article annotator.
 *
 * These tests observe the ROUTING DECISION, which is the only externally
 * visible consequence: a country-branch request calls CountryNewsService, a
 * generic one does not.
 */

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

function makeSearchResponse(articles: NewsArticle[]): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeCountryResponse(articles: NewsArticle[]): CountryNewsResponse {
  return {
    countryCode: 'NER',
    countryName: 'Niger',
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

function buildService() {
  const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
  const topHeadlines = jest.fn().mockResolvedValue(makeSearchResponse([]));
  const findArticleById = jest.fn().mockResolvedValue(null);
  const getCountryNews = jest.fn().mockResolvedValue(makeCountryResponse([]));

  const provider: AnalysisProvider = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised in this test')),
  };

  const service = new AnalysisService(
    { search, topHeadlines, findArticleById } as never,
    { getCountryNews } as never,
    provider,
    makeConfigService(),
  );

  return { service, search, getCountryNews };
}

describe('N5 — G3: the scan must not turn "Niger State" into sovereign Niger', () => {
  it('a question about Niger State does not route into the country feed', async () => {
    const { service, getCountryNews } = buildService();

    await service.analyzeNews('What is happening in Niger State?');

    expect(getCountryNews).not.toHaveBeenCalled();
  });

  it('it falls through to generic retrieval instead of inventing a country', async () => {
    const { service, search, getCountryNews } = buildService();

    await service.analyzeNews('What is happening in Niger State?');

    expect(getCountryNews).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalled();
  });

  it('other subdivision qualifiers fail closed the same way', async () => {
    for (const query of [
      'What is happening in Georgia State?',
      'What is happening in Mexico Province?',
    ]) {
      const { service, getCountryNews } = buildService();
      await service.analyzeNews(query);
      expect(getCountryNews).not.toHaveBeenCalled();
    }
  });
});

describe('N15 (routing half) — a bare country question is completely unaffected', () => {
  it('"in Niger" still routes to the country feed', async () => {
    const { service, getCountryNews } = buildService();

    await service.analyzeNews('What is happening in Niger?');

    expect(getCountryNews).toHaveBeenCalled();
  });

  it('"in Rwanda" — the ordinary country path — is untouched', async () => {
    const { service, getCountryNews } = buildService();

    await service.analyzeNews('What is happening in Rwanda?');

    expect(getCountryNews).toHaveBeenCalled();
  });

  it('a trailing non-qualifier word still shortens normally', async () => {
    // "the United States today" must still give up "today". G3 fires only on a
    // discarded SUBDIVISION qualifier, never on ordinary trailing words.
    const { service, getCountryNews } = buildService();

    await service.analyzeNews('What is happening in the United States today?');

    expect(getCountryNews).toHaveBeenCalled();
  });
});

describe('N14 — the accepted anchored Evidence Geography path still resolves', () => {
  it('an anchored request still reports the anchor’s country', async () => {
    const anchor = makeArticle({
      id: 'anchor-au',
      url: 'https://example.com/anchor',
      title: 'Hotel worker charged with sexually assaulting Australian three-year-old in Penang',
      summary: 'A hotel worker has been charged in Penang.',
      countryCode: 'AU',
      countryName: 'Australia',
    });

    const search = jest.fn().mockResolvedValue(makeSearchResponse([]));
    const service = new AnalysisService(
      {
        search,
        topHeadlines: jest.fn(),
        findArticleById: jest.fn().mockResolvedValue(anchor),
      } as never,
      { getCountryNews: jest.fn() } as never,
      {
        id: 'openai',
        displayName: 'OpenAI',
        isMock: false,
        analyzeNews: jest.fn().mockRejectedValue(new Error('not exercised')),
      },
      makeConfigService(),
    );

    const response = await service.analyzeNews(anchor.title, 'en', {
      title: anchor.title,
      articleId: 'anchor-au',
      countryCode: 'AU',
    });

    expect(response.retrievalContext.countryCode).toBe('AU');
    expect(response.retrievalContext.countryName).toBe('Australia');
  });
});
