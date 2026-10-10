import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { isAttributableToRequestedSource, type RequestedSource } from '../../news/identity/requested-source.util';

/*
  MASTER CTO P0 RIGHTS CONTAINMENT R1 — through the real AnalysisService (providers stubbed, no
  network, no model): an article whose source is not cleared for AI processing never reaches the
  model or the answer's evidence, whether it came live, from RSS or from the retained store; the
  withholding is recorded as a rights exclusion, never as "not relevant".
*/
const BASE = {
  title: 'Erik Prince firm signs new contract',
  summary: 'FIXTURE — synthetic summary naming Erik Prince.',
  category: 'world',
  countryCode: 'COD',
  sourcesCount: 1,
  publishedAt: '2026-10-09T12:00:00.000Z',
  publishedAtBasis: 'publisher',
} as const;
const art = (id: string, sourceId: string, sourceName: string, providerId?: string): NewsArticle =>
  ({ ...BASE, id, sourceId, sourceName, ...(providerId ? { providerId } : {}), url: `https://example.invalid/${id}` }) as unknown as NewsArticle;
const PROVIDER = art('provider', 'bbc', 'BBC', 'gnews');
const TAARIFA = art('taarifa', 'feed:taarifa-rw', 'Taarifa Rwanda');
const STANDARD = art('standard', 'feed:standardmedia-ke', 'The Standard');
const WP = art('wp', 'feed:wp-pl', 'Wirtualna Polska');
const UNKNOWN = art('unknown', '', 'Unknown');
function harness(corpus: NewsArticle[], retained: NewsArticle[] = []) {
  const searchCalls: Array<{ query: string; requestedSourceId?: string }> = [];
  const countryCalls: string[] = [];
  const newsService = {
    search: jest.fn(async (query: string, _l?: number, mode?: { type?: string }, options?: { requestedSource?: RequestedSource }): Promise<NewsResponse> => {
      searchCalls.push({ query, ...(options?.requestedSource ? { requestedSourceId: options.requestedSource.sourceId } : {}) });
      const gated = mode?.type === 'generic' ? corpus.filter((c) => scoreGenericRelevance(c, query).isRelevant) : corpus;
      const articles = options?.requestedSource ? gated.filter((c) => isAttributableToRequestedSource(c, options.requestedSource!)) : gated;
      return { articles, totalResults: articles.length, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as NewsResponse;
    }),
    topHeadlines: jest.fn(async (): Promise<NewsResponse> => ({ articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() }) as NewsResponse),
    findArticleById: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => retained),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      countryCalls.push(identifier);
      const country = resolveCountryByAnyIdentifier(identifier);
      const articles = country ? corpus.filter((c) => scoreCountryRelevance(c, country).isRelevant) : [];
      return { countryCode: country?.iso3 ?? identifier, countryName: country?.name ?? identifier, articles, totalResults: articles.length, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as unknown as CountryNewsResponse;
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
      maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0,
      openAiApiKey: undefined, openAiModel: 'gpt-4o-mini', executionMode: 'development' as const, retryAttempts: 2, retryBaseDelayMs: 300, maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  return { service: new AnalysisService(newsService as never, countryNewsService as never, provider, config), searchCalls, countryCalls, provider };
}
const modelArticles = (h: ReturnType<typeof harness>): NewsArticle[] => {
  const calls = (h.provider.analyzeNews as jest.Mock).mock.calls;
  return calls.length === 0 ? [] : ((calls[0][0] as { articles?: NewsArticle[] }).articles ?? []);
};

describe('rights containment at the Ask evidence point', () => {
  it('mixed sources: only the provider-path article reaches the model; each exclusion keeps its reason', async () => {
    const h = harness([PROVIDER, TAARIFA, STANDARD, WP, UNKNOWN]);
    const r = await h.service.analyzeNews('Give any reports about Eric Prince please.');
    expect(modelArticles(h).map((a) => a.id)).toEqual(['provider']);
    expect(r.retrievalContext.rightsExcluded).toEqual({
      count: 4,
      reasons: { RIGHTS_NOT_CLEARED_FOR_AI: 1, RIGHTS_RESTRICTED: 1, RIGHTS_PROHIBITED: 1, UNKNOWN_PROVENANCE: 1 },
      sourceIds: ['<none>', 'feed:standardmedia-ke', 'feed:taarifa-rw', 'feed:wp-pl'],
    });
    expect(r.retrievalContext.articlesRetrieved).toBe(1);
  });

  it('only rights-excluded sources: no model call, no evidence, and the exclusion is recorded', async () => {
    const h = harness([TAARIFA, STANDARD, WP]);
    const r = await h.service.analyzeNews('Give any reports about Eric Prince please.');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.articles).toEqual([]);
    expect(r.retrievalContext.rightsExcluded?.count).toBe(3);
  });

  it('provider-path only (record mode, the default): used, counted as PENDING review — never cleared', async () => {
    const h = harness([PROVIDER]);
    const r = await h.service.analyzeNews('Give any reports about Eric Prince please.');
    expect(modelArticles(h).map((a) => a.id)).toEqual(['provider']);
    expect(r.retrievalContext.rightsExcluded).toBeUndefined();
    expect(r.retrievalContext.rightsPending).toEqual({ count: 1, providers: { gnews: 1 } });
  });

  it('the environment cannot change the policy: ASK_PROVIDER_RIGHTS_ENFORCEMENT is ignored, RSS stays excluded, the provider stays pending', async () => {
    const before = process.env.ASK_PROVIDER_RIGHTS_ENFORCEMENT;
    process.env.ASK_PROVIDER_RIGHTS_ENFORCEMENT = 'enforce';
    try {
      const h = harness([PROVIDER, TAARIFA]);
      const r = await h.service.analyzeNews('Give any reports about Eric Prince please.');
      expect(modelArticles(h).map((a) => a.id)).toEqual(['provider']);
      expect(r.retrievalContext.rightsExcluded?.reasons).toEqual({ RIGHTS_NOT_CLEARED_FOR_AI: 1 });
      expect(r.retrievalContext.rightsPending).toEqual({ count: 1, providers: { gnews: 1 } });
    } finally {
      if (before === undefined) delete process.env.ASK_PROVIDER_RIGHTS_ENFORCEMENT;
      else process.env.ASK_PROVIDER_RIGHTS_ENFORCEMENT = before;
    }
  });
});
