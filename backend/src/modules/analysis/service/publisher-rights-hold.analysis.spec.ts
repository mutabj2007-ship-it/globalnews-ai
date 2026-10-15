import { ANALYSIS_TOTAL_BUDGET_MS, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';

/**
 * MASTER CTO R4 · P0 #86 — the ONE evidence point (analysis.service.ts rights partition): an item
 * whose own URL host is under a publisher rights hold never reaches the model or the evidence, is
 * counted as a rights exclusion (PUBLISHER_RIGHTS_HOLD), and a held-only search makes no model
 * call and no extra provider call. Real AnalysisService, mock analysis provider, stub news search.
 * Offline; synthetic text only.
 */
const NOW = Date.now();
const article = (id: string, url: string, sourceId: string): NewsArticle => ({
  id,
  title: 'Erik Prince contractors ambush investigated by officials',
  summary: 'Officials investigated the ambush involving Erik Prince contractors.',
  url,
  sourceId,
  sourceName: 'Synthetic',
  category: 'world',
  sourcesCount: 1,
  publishedAt: new Date(NOW - 3_600_000).toISOString(),
  publishedAtBasis: 'publisher',
});
const held = [
  article('gnews-r1', 'https://www.reuters.com/world/africa/synthetic-a/', 'reuters'),
  article('gnews-r2', 'https://uk.reuters.com/world/synthetic-b', 'reuters-com'),
];
const benign = article('gnews-b1', 'https://www.bbc.com/news/synthetic-c', 'bbc');
const syndication = article('gnews-s1', 'https://www.straitstimes.com/world/synthetic-d', 'the-straits-times');

function service(articles: NewsArticle[]) {
  const response = (): NewsResponse => ({
    articles: articles.map((a) => ({ ...a })),
    totalResults: articles.length,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
  });
  const news = {
    search: jest.fn(async () => response()),
    topHeadlines: jest.fn(async () => response()),
    findArticleById: jest.fn(async () => null),
    findRetainedByQuery: jest.fn(async () => []),
    findRetainedHeadlines: jest.fn(async () => []),
    findRetainedByCountry: jest.fn(async () => []),
  };
  const provider = new MockAnalysisProvider();
  const analyze = jest.spyOn(provider, 'analyzeNews');
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      rightsAudience: 'TEST_FIXTURE' as const, openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const getCountryNews = jest.fn(async (iso3: string) => ({
    articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', countryCode: iso3, countryName: iso3,
    feedTier: 'delayed', providerDisplayName: 'GNews', generatedAt: new Date().toISOString(),
  }));
  const svc = new AnalysisService(news as never, { getCountryNews } as never, provider, config);
  return { svc, news, analyze };
}

const QUESTION = 'What happened in the ambush involving Erik Prince contractors?';
const providerCalls = (news: ReturnType<typeof service>['news']) =>
  news.search.mock.calls.length + news.topHeadlines.mock.calls.length;

describe('#86 · the analysis evidence point', () => {
  it('held-host items never reach the evidence or the model; benign and syndicated reports do; the hold is counted', async () => {
    const { svc, analyze } = service([...held, benign, syndication]);
    const result = await svc.analyzeNews(QUESTION);
    const ids = result.articles.map((a) => a.id);
    expect(ids).not.toContain('gnews-r1');
    expect(ids).not.toContain('gnews-r2');
    expect(ids).toEqual(expect.arrayContaining(['gnews-b1', 'gnews-s1']));
    /* E1 R102 S-3 — SUPERSEDED, NOT DELETED: was toMatchObject({ count: 2, reasons: { PUBLISHER_RIGHTS_HOLD: 2 } }); the classes that could identify a publisher fold into one reader class (count conserved) */
    expect(result.retrievalContext.rightsExcluded).toMatchObject({ count: 2, reasons: { SOURCE_RIGHTS_NOT_CLEARED: 2 } });
    /* E1 R102 F-2 — the reader JSON never names the held publisher class or host */
    expect(JSON.stringify(result.retrievalContext)).not.toMatch(/PUBLISHER_RIGHTS_HOLD|reuters/i);
    for (const call of analyze.mock.calls) {
      const sent = JSON.stringify(call);
      expect(sent).not.toContain('reuters.com');
      expect(sent).not.toContain('gnews-r1');
    }
    expect(analyze.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('a held-only search makes NO model call and no extra provider call; it is recorded as a rights exclusion', async () => {
    const control = service([]);
    await control.svc.analyzeNews(QUESTION);
    const { svc, analyze, news } = service(held);
    const result = await svc.analyzeNews(QUESTION);
    expect(result.articles).toHaveLength(0);
    expect(result.analysis).toBeNull();
    expect(analyze).not.toHaveBeenCalled();
    /* E1 R102 S-3 — SUPERSEDED, NOT DELETED: was toMatchObject({ count: 2, reasons: { PUBLISHER_RIGHTS_HOLD: 2 } }); the classes that could identify a publisher fold into one reader class (count conserved) */
    expect(result.retrievalContext.rightsExcluded).toMatchObject({ count: 2, reasons: { SOURCE_RIGHTS_NOT_CLEARED: 2 } });
    /* E1 R102 F-2 — the reader JSON never names the held publisher class or host */
    expect(JSON.stringify(result.retrievalContext)).not.toMatch(/PUBLISHER_RIGHTS_HOLD|reuters/i);
    /* the same provider-call shape as a genuinely empty search: nothing added, nothing retried */
    expect(providerCalls(news)).toBe(providerCalls(control.news));
  });

  it('control: without a held item nothing is excluded and the call shape is unchanged', async () => {
    const { svc, analyze } = service([benign, syndication]);
    const result = await svc.analyzeNews(QUESTION);
    expect(result.retrievalContext.rightsExcluded).toBeUndefined();
    expect(analyze.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
