import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import {
  ANALYSIS_TOTAL_BUDGET_MS,
  type CountryNewsResponse,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { CountryNewsService } from '../../news/country/country-news.service';
import {
  attachProviderFailures,
  readProviderFailures,
  type NewsService,
  type ProviderFailure,
} from '../../news/news.service';
import type { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';

/**
 * CURRENT-REPORTING TRUTH R1 — East Africa finding B2 (CTO ruling 2026-10-06): usable evidence +
 * a provider failure + no stronger fallbackReason → 'provider-error', ONE rule after branch
 * selection; the country path exposes its provider failures. Independent of B1.
 */
const FAILURE: ProviderFailure = { providerId: 'gdelt-doc', kind: 'unavailable' } as ProviderFailure;

/* ── B2 — the country path exposes its failures; the rule applies after branch selection ── */

function article(id: string): NewsArticle {
  return {
    id,
    title: `Kenya ${id} report`,
    summary: 'Kenya summary',
    url: `https://example.com/${id}`,
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    countryCode: 'KEN',
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher',
  };
}

function liveSearch(failures: ProviderFailure[]): NewsResponse {
  return attachProviderFailures(
    {
      articles: [article('a'), article('b')],
      totalResults: 2,
      providers: ['gnews'],
      dataMode: 'live',
      generatedAt: new Date().toISOString(),
    },
    failures,
  );
}

describe('B2 · CountryNewsService exposes the provider failures of the search it ran', () => {
  const persistence = {
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    findRecent: jest.fn().mockResolvedValue([]),
  } as unknown as ArticlePersistenceService;
  const config = { get: () => undefined } as unknown as ConfigService;

  it('a lane that failed beside a healthy one reaches the caller', async () => {
    const search = jest.fn().mockResolvedValue(liveSearch([FAILURE]));
    const service = new CountryNewsService({ search } as unknown as NewsService, config, persistence);
    const response = await service.getCountryNews('KEN', undefined, 20);
    expect(response.articles.length).toBeGreaterThan(0);
    expect(response.dataMode).toBe('live');
    expect(readProviderFailures(response)).toEqual([FAILURE]);
  });

  it('a healthy search carries none, and a cache hit never replays an earlier failure', async () => {
    const search = jest.fn().mockResolvedValueOnce(liveSearch([FAILURE]));
    const service = new CountryNewsService({ search } as unknown as NewsService, config, persistence);
    await service.getCountryNews('KEN', undefined, 20);
    const again = await service.getCountryNews('KEN', undefined, 20);
    expect(search).toHaveBeenCalledTimes(1);
    expect(readProviderFailures(again)).toEqual([]);
  });
});

function countryResponse(over: Partial<CountryNewsResponse>, failures: ProviderFailure[] = []): CountryNewsResponse {
  return attachProviderFailures<CountryNewsResponse>(
    {
      countryCode: 'KEN',
      countryName: 'Kenya',
      articles: [article('a'), article('b')],
      totalResults: 2,
      providers: ['gnews'],
      dataMode: 'live',
      feedTier: 'delayed',
      providerDisplayName: 'GNews',
      generatedAt: new Date().toISOString(),
      ...over,
    },
    failures,
  );
}

function analysisService(country: CountryNewsResponse): AnalysisService {
  const empty: NewsResponse = {
    articles: [],
    totalResults: 0,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
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
  return new AnalysisService(
    {
      search: jest.fn().mockResolvedValue(empty),
      topHeadlines: jest.fn().mockResolvedValue(empty),
      findArticleById: jest.fn().mockResolvedValue(null),
    } as never,
    { getCountryNews: jest.fn().mockResolvedValue(country) } as never,
    new MockAnalysisProvider(),
    config,
  );
}

describe('B2 · one promotion rule after branch selection (country branch)', () => {
  it('usable country evidence + a provider failure → provider-error (live evidence kept)', async () => {
    const result = await analysisService(countryResponse({}, [FAILURE])).analyzeNews('What is happening in Kenya?');
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.retrievalContext.fallbackReason).toBe('provider-error');
    expect(result.retrievalContext.evidenceState).toBe('degraded-fallback');
  });

  it('a healthy country search is unchanged: no fallbackReason, live', async () => {
    const result = await analysisService(countryResponse({})).analyzeNews('What is happening in Kenya?');
    expect(result.retrievalContext.fallbackReason).toBeUndefined();
    expect(result.retrievalContext.evidenceState).toBe('live');
  });

  it('retained country evidence after a failure keeps its stronger, existing state', async () => {
    const result = await analysisService(
      countryResponse({ dataMode: 'cached', fallbackReason: 'provider-error' }, [FAILURE]),
    ).analyzeNews('What is happening in Kenya?');
    expect(result.retrievalContext.dataMode).toBe('cached');
    expect(result.retrievalContext.fallbackReason).toBe('provider-error');
  });

  it('the rule is written once, after branch selection, before the evidence state is stamped', () => {
    const source = readFileSync(join(__dirname, 'analysis.service.ts'), 'utf8');
    const rule = source.indexOf('CURRENT-REPORTING TRUTH R1 (B2) — PROVIDER HEALTH, ONE RULE FOR EVERY BRANCH.');
    const stamp = source.indexOf('evidenceState: resolveEvidenceState(retrievalContext, articles.length),');
    expect(rule).toBeGreaterThan(-1);
    expect(rule).toBeLessThan(stamp);
    expect(source.slice(rule, stamp)).toMatch(
      /articles\.length > 0 &&\s*retrievalFailures\.length > 0 &&\s*retrievalContext\.fallbackReason === undefined/,
    );
  });
});
