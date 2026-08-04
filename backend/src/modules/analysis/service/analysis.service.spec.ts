import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';

function makeArticle(overrides: Partial<NewsArticle>): NewsArticle {
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

function makeConfigService(overrides: Partial<ReturnType<AnalysisConfigService['get']>> = {}) {
  const config = {
    maxArticles: 8,
    maxArticleChars: 1200,
    timeoutMs: 20000,
    cacheTtlSeconds: 300,
    openAiApiKey: undefined,
    openAiModel: 'gpt-4o-mini',
    ...overrides,
  };
  return { get: () => config } as unknown as AnalysisConfigService;
}

function validCandidateFor(articles: NewsArticle[]) {
  return {
    headline: 'Headline',
    summary: 'Summary',
    keyFacts: [{ claim: articles[0].title, sourceArticleIds: [articles[0].id] }],
    agreements: [],
    differences: [],
    unknowns: [],
    timeline: [],
    confidence: { level: 'medium', score: 50, explanation: 'x' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
  };
}

describe('AnalysisService', () => {
  it('returns a clear analysisError and empty articles when no news results are found', async () => {
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse([])) };
    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn(),
    };
    const service = new AnalysisService(newsService as never, provider, makeConfigService());

    const response = await service.analyzeNews('nonexistent query');

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.analysisError).toMatch(/no related articles/i);
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('falls back to showing articles with an explanation when the AI provider fails', async () => {
    const articles = [makeArticle({ id: 'a1' })];
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
    const provider: AnalysisProvider = {
      id: 'openai',
      displayName: 'OpenAI',
      isMock: false,
      analyzeNews: jest.fn().mockRejectedValue(new Error('OpenAI rate limit exceeded.')),
    };
    const service = new AnalysisService(newsService as never, provider, makeConfigService());

    const response = await service.analyzeNews('test query');

    expect(response.analysis).toBeNull();
    expect(response.articles).toHaveLength(1);
    expect(response.analysisError).toMatch(/temporarily unavailable/i);
  });

  it('returns a validated analysis on success', async () => {
    const articles = [makeArticle({ id: 'a1' })];
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };
    const service = new AnalysisService(newsService as never, provider, makeConfigService());

    const response = await service.analyzeNews('test query');

    expect(response.analysis).not.toBeNull();
    expect(response.analysis?.analysisMode).toBe('mock-ai');
    expect(response.analysisError).toBeUndefined();
  });

  it('caches a successful response and does not call the news service again for the same query', async () => {
    const articles = [makeArticle({ id: 'a1' })];
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };
    const service = new AnalysisService(newsService as never, provider, makeConfigService());

    await service.analyzeNews('Same Query');
    await service.analyzeNews('same query'); // different case, same normalized key

    expect(newsService.search).toHaveBeenCalledTimes(1);
  });

  it('does not cache when cacheTtlSeconds is 0', async () => {
    const articles = [makeArticle({ id: 'a1' })];
    const newsService = { search: jest.fn().mockResolvedValue(makeSearchResponse(articles)) };
    const provider: AnalysisProvider = {
      id: 'mock-analysis',
      displayName: 'Mock',
      isMock: true,
      analyzeNews: jest.fn().mockResolvedValue(validCandidateFor(articles)),
    };
    const service = new AnalysisService(
      newsService as never,
      provider,
      makeConfigService({ cacheTtlSeconds: 0 }),
    );

    await service.analyzeNews('test query');
    await service.analyzeNews('test query');

    expect(newsService.search).toHaveBeenCalledTimes(2);
  });
});
