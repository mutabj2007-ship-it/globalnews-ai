import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — G seams A and FINAL-ADDENDUM on the LIVE
 * /analysis path (contract §2). The shipped AnalysisService runs for real; the harness is
 * the one map-geography-context.spec.ts uses (NewsService and CountryNewsService stubbed
 * at their own boundaries, the provider throws after recording its input).
 */

function harness(corpus: NewsArticle[] = []) {
  const countryCalls: string[] = [];
  const searchCalls: string[] = [];
  const providerInputs: unknown[] = [];

  const newsService = {
    search: jest.fn(async (query: string): Promise<NewsResponse> => {
      searchCalls.push(query);
      return {
        articles: [],
        totalResults: 0,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: new Date().toISOString(),
      } as NewsResponse;
    }),
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
    findArticleById: jest.fn(async () => null),
    findRetainedArticleByUrl: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
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
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      providerInputs.push(args);
      throw new Error('analysis provider reached');
    }),
  };

  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
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
    countryCalls,
    searchCalls,
    providerInputs,
    provider,
  };
}

const iso3Of = (identifier: string) => resolveCountryByAnyIdentifier(identifier)?.iso3;

const POL = { countryCode: 'POL', displayName: 'Poland' };
const RWA = { countryCode: 'RWA', displayName: 'Rwanda' };
const ask = (
  h: ReturnType<typeof harness>,
  q: string,
  lang: 'en' | 'pl',
  geo: { countryCode: string; displayName: string },
) => h.service.analyzeNews(q, lang, undefined, undefined, undefined, geo).catch(() => undefined);

describe('G final addendum seam — a stable named subject does not inherit the Map country', () => {
  it.each([
    ['What is NATO?', 'en'],
    ['Czym jest NATO?', 'pl'],
    ['What is inflation?', 'en'],
    ['Czym jest inflacja?', 'pl'],
    ['Who is Kagame?', 'en'],
    ['Kim jest Kagame?', 'pl'],
    ['How does an induction motor work?', 'en'],
    ['Jak działa silnik indukcyjny?', 'pl'],
  ] as const)('%s with Map Poland → Poland is not retrieved', async (q, lang) => {
    const h = harness();
    await ask(h, q, lang, POL);
    expect(h.countryCalls.map(iso3Of)).not.toContain('POL');
  });

  it.each([
    ['Who is the president?', 'en'],
    ['Kto jest prezydentem?', 'pl'],
    ['What is the inflation rate?', 'en'],
    ['Jaka jest stopa inflacji?', 'pl'],
    ['What is happening?', 'en'],
    ['What is the security situation?', 'en'],
  ] as const)('%s with Map Rwanda → Rwanda MAY scope retrieval', async (q, lang) => {
    const h = harness();
    await ask(h, q, lang, RWA);
    expect(h.countryCalls.map(iso3Of)).toContain('RWA');
  });

  it('a suppressed Map country is stamped ABSENT, never "used"', async () => {
    const h = harness();
    const r = await h.service
      .analyzeNews('What is NATO?', 'en', undefined, undefined, undefined, POL)
      .catch((e: unknown) => e as never);
    const ctx = (r as { retrievalContext?: { geographyContextUsed?: boolean } } | undefined)
      ?.retrievalContext;
    if (ctx !== undefined) expect(ctx.geographyContextUsed).toBeUndefined();
    expect(h.countryCalls.map(iso3Of)).not.toContain('POL');
  });

  it('explicit typed geography still wins: "What is inflation in Rwanda?" with Map Poland → Rwanda', async () => {
    const h = harness();
    await ask(h, 'What is inflation in Rwanda?', 'en', POL);
    expect(h.countryCalls.map(iso3Of)).toContain('RWA');
    expect(h.countryCalls.map(iso3Of)).not.toContain('POL');
  });
});

describe('G seam A — office geography feeds typedLocation', () => {
  it('"Who is the president of Turkey?" scopes to Türkiye', async () => {
    const h = harness();
    await h.service.analyzeNews('Who is the president of Turkey?', 'en').catch(() => undefined);
    expect(h.countryCalls.map(iso3Of)).toContain('TUR');
  });

  it('"What is the cost of turkey at christmas?" never routes to Türkiye', async () => {
    const h = harness();
    await h.service
      .analyzeNews('What is the cost of turkey at christmas?', 'en')
      .catch(() => undefined);
    expect(h.countryCalls.map(iso3Of)).not.toContain('TUR');
  });
});
