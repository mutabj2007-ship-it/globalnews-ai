import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService, type AnalysisExecutionPolicy } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { GNewsProviderError } from '../../news/providers/gnews.provider';
import { FEED_SOURCES } from '../../news/providers/feed-source-registry';
import { buildBroadHeadlinesInstruction } from '../prompt/build-analysis-prompt.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC BETA HARDENING R1B — BROAD GLOBAL NEWS / HEADLINES RESILIENCE, on the real services.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production 2026-10-01: "Any global news can you share?" was searched as the phrase "global
 * news"; GNews was rate-limited, the publisher feeds had nothing matching the words, the retained
 * term net found nothing → INSUFFICIENT. The broad request is now retrieved as HEADLINES (the
 * existing top-headlines tier ladder), with ONE bounded retained read only after a refusal.
 * Real NewsService tier ladder + real AnalysisService; stub providers and persistence; no live
 * provider or model is called.
 */

const Q = 'Any global news can you share?';
const BROAD: AnalysisExecutionPolicy = { broadHeadlines: true };

interface Calls {
  search: string[];
  headlines: string[];
}

function article(id: string, title: string, extra: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id,
    title,
    summary: `${title}. Reported on Wednesday.`,
    url: `https://${id}.example/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Outlet ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    publishedAtBasis: 'publisher' as const,
    sourceLanguage: 'en',
    ...extra,
  };
}

const WORLD = [
  article('w1', 'UN Security Council meets on Sudan ceasefire'),
  article('w2', 'Earthquake of magnitude 6.1 strikes off Japan coast'),
  article('w3', 'Central banks hold rates as inflation cools in Europe'),
];
const FEEDS = [
  article('f1', 'Kigali hosts regional trade forum', { sourceName: 'KT Press' }),
  article('f2', 'Nairobi commuters face fuel price rise', { sourceName: 'The Standard' }),
];

function provider(
  id: string,
  capabilities: Array<'search' | 'top-headlines'>,
  calls: Calls,
  headlines: () => NewsArticle[],
  fail?: Error,
): NewsProvider {
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities,
    async search(q: string) {
      calls.search.push(`${id}:${q}`);
      if (fail) throw fail;
      return [];
    },
    async topHeadlines() {
      calls.headlines.push(id);
      if (fail) throw fail;
      return headlines();
    },
    async category() {
      return [];
    },
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' };
    },
  } as unknown as NewsProvider;
}

const rateLimited = () => new GNewsProviderError('GNews rate limit reached.', 429, 'rate-limited');

async function services(opts: {
  gnews: () => NewsArticle[];
  gnewsFails?: boolean;
  feeds?: () => NewsArticle[];
  retained?: NewsArticle[];
}) {
  const calls: Calls = { search: [], headlines: [] };
  const gnews = provider(
    'gnews',
    ['search', 'top-headlines'],
    calls,
    opts.gnews,
    opts.gnewsFails ? rateLimited() : undefined,
  );
  const feeds = provider('rss-feeds', ['search', 'top-headlines'], calls, opts.feeds ?? (() => []));
  /* GDELT DOC is search-only: it must never be asked for headlines, nor searched here. */
  const gdelt = provider('gdelt-doc', ['search'], calls, () => []);
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue(opts.retained ?? []),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const all = [gnews, feeds, gdelt];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: all },
      { provide: ALL_NEWS_PROVIDERS, useValue: all },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [feeds, gdelt] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  const model: AnalysisProvider = {
    id: 'openai',
    displayName: 'Fixture model',
    isMock: false,
    analyzeNews: async (input: AnalysisProviderInput) => {
      inputs.push(input);
      return mock.analyzeNews(input);
    },
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'fixture',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    moduleRef.get(NewsService),
    moduleRef.get(CountryNewsService),
    model,
    config,
  );
  const ask = (question = Q, language: 'en' | 'pl' = 'en', policy = BROAD) =>
    service.analyzeNews(question, language, undefined, undefined, undefined, undefined, policy);
  return { ask, calls, inputs, persistence };
}

describe('PUBLIC BETA HARDENING R1B — broad global headlines, live first', () => {
  it('1–2 · GNews healthy: ONE top-headlines call, no free-text search, evidence admitted, AI runs', async () => {
    const { ask, calls, inputs, persistence } = await services({ gnews: () => WORLD });
    const result = await ask();
    expect(calls.headlines).toEqual(['gnews']);
    expect(calls.search).toEqual([]);
    expect(result.articles.map((x) => x.id).sort()).toEqual(['w1', 'w2', 'w3']);
    expect(result.analysis).not.toBeNull();
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.broadHeadlinesCoverage).toBe('LIVE');
    expect(inputs[0]!.evidenceLinkageGuard).toBe(true);
    expect(result.retrievalContext?.fallbackReason).toBeUndefined();
    expect(result.retrievalContext?.retrievalTrace?.queryVariants).toEqual(['top-headlines']);
    expect(result.retrievalContext?.retrievalTrace?.lanesSucceeded).toEqual(['gnews']);
    /* no retained read when live succeeded */
    expect(persistence.findRecent).not.toHaveBeenCalled();
  });

  it('3 · GNews rate-limited, Publisher Feeds answer: feeds contribute, LIMITED disclosed, no GNews retry, no GDELT', async () => {
    const { ask, calls, inputs, persistence } = await services({
      gnews: () => WORLD,
      gnewsFails: true,
      feeds: () => FEEDS,
    });
    const result = await ask();
    expect(calls.headlines).toEqual(['gnews', 'rss-feeds']);
    expect(calls.search).toEqual([]);
    expect(calls.headlines.filter((id) => id === 'gnews')).toHaveLength(1);
    expect(calls.headlines).not.toContain('gdelt-doc');
    expect(result.articles.map((x) => x.id).sort()).toEqual(['f1', 'f2']);
    expect(result.retrievalContext?.fallbackReason).toBe('provider-error');
    expect(result.retrievalContext?.retrievalTrace?.lanesUnavailable).toEqual([
      { lane: 'gnews', reason: 'rate-limited' },
    ]);
    expect(inputs[0]!.broadHeadlinesCoverage).toBe('LIMITED');
    expect(persistence.findRecent).not.toHaveBeenCalled();
  });

  it('4 · GNews rate-limited, feeds empty, recent retained reporting: ONE bounded retained read, zero extra provider calls, RETAINED', async () => {
    const now = Date.now();
    const retained = [
      article('r1', 'Retained: Sudan talks resume in Jeddah'),
      article('r2', 'Retained: Floods close schools in Bangladesh'),
      /* an aggregator-OBSERVED time is not a publication time: never admitted */
      article('r-observed', 'Observed only', { publishedAtBasis: 'observed' }),
      /* a synthetic fixture is never reporting */
      article('mock-wire-1', 'Mock wire item'),
      /* a publication time in the future is not trusted */
      article('r-future', 'Future dated', {
        publishedAt: new Date(now + 3 * 3_600_000).toISOString(),
      }),
    ];
    const { ask, calls, inputs, persistence } = await services({
      gnews: () => WORLD,
      gnewsFails: true,
      retained,
    });
    const result = await ask();
    /* the provider calls are exactly the live ladder's: no retry, no GDELT, no search */
    expect(calls.headlines).toEqual(['gnews', 'rss-feeds']);
    expect(calls.search).toEqual([]);
    /* ONE local read, bounded by count and by the 24-hour age, with no invented topic */
    expect(persistence.findRecent).toHaveBeenCalledTimes(1);
    expect(persistence.findRecent).toHaveBeenCalledWith({ limit: 40, maxAgeMinutes: 1440 });
    expect(result.articles.map((x) => x.id).sort()).toEqual(['r1', 'r2']);
    expect(result.retrievalContext?.dataMode).toBe('cached');
    expect(result.retrievalContext?.fallbackReason).toBe('provider-error');
    expect(result.retrievalContext?.outcome).toBe('RETAINED_ONLY');
    /* AI only from the admitted retained evidence, told it is retained */
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.articles.map((x) => x.id).sort()).toEqual(['r1', 'r2']);
    expect(inputs[0]!.broadHeadlinesCoverage).toBe('RETAINED');
    /* each report keeps its own publication time */
    expect(result.articles.find((x) => x.id === 'r1')!.publishedAt).toBe(retained[0]!.publishedAt);
  });

  it('5 · GNews rate-limited, no live or retained evidence: INSUFFICIENT path, no model call', async () => {
    const { ask, calls, inputs, persistence } = await services({
      gnews: () => WORLD,
      gnewsFails: true,
    });
    const result = await ask();
    expect(calls.headlines).toEqual(['gnews', 'rss-feeds']);
    expect(persistence.findRecent).toHaveBeenCalledTimes(1);
    expect(result.articles).toEqual([]);
    expect(result.analysis).toBeNull();
    expect(inputs).toEqual([]);
    expect(result.retrievalContext?.outcome).toBe('PROVIDER_RATE_LIMITED');
    expect(result.retrievalContext?.verificationNotice).toBe('COVERAGE_INCOMPLETE');
  });

  it('6 · the six-feed registry is never labelled complete global coverage', async () => {
    /* the registry is six regional feeds (RW, KE, PL) — not the world */
    expect(FEED_SOURCES).toHaveLength(6);
    expect([...new Set(FEED_SOURCES.map((f) => f.countryCode))].sort()).toEqual(['KE', 'PL', 'RW']);
    /* GNews HEALTHY but empty, feeds answer: still LIMITED — a fallback-tier-only set is never LIVE */
    const { ask, inputs } = await services({ gnews: () => [], feeds: () => FEEDS });
    const result = await ask();
    expect(result.articles.map((x) => x.id).sort()).toEqual(['f1', 'f2']);
    expect(inputs[0]!.broadHeadlinesCoverage).toBe('LIMITED');
    expect(result.retrievalContext?.fallbackReason).toBe('provider-error');
    /* and the prompt never lets any headline set be called the world */
    for (const coverage of ['LIVE', 'LIMITED', 'RETAINED'] as const) {
      const rule = buildBroadHeadlinesInstruction(coverage);
      expect(rule).toMatch(/do NOT present them as complete global coverage/);
    }
    expect(buildBroadHeadlinesInstruction('LIMITED')).toMatch(/coverage is limited/);
    expect(buildBroadHeadlinesInstruction('RETAINED')).toMatch(/not a live check/);
    expect(buildBroadHeadlinesInstruction(undefined)).toBe('');
  });

  it('7 · an ordinary topic ("What\'s happening with NATO?") keeps its normal topic search', async () => {
    const { ask, calls, inputs } = await services({ gnews: () => WORLD });
    await ask("What's happening with NATO?", 'en', {});
    expect(calls.headlines).toEqual([]);
    expect(calls.search.length).toBeGreaterThan(0);
    expect(calls.search[0]).toMatch(/^gnews:/);
    expect(inputs.every((input) => input.broadHeadlinesCoverage === undefined)).toBe(true);
  });

  it('13 · Polish: the same path in the reader language', async () => {
    const { ask, calls, inputs } = await services({
      gnews: () => WORLD.map((x) => ({ ...x, sourceLanguage: 'pl' })),
    });
    const result = await ask('Co się dzieje na świecie?', 'pl');
    expect(calls.headlines).toEqual(['gnews']);
    expect(calls.search).toEqual([]);
    expect(result.articles).toHaveLength(3);
    expect(inputs[0]!.broadHeadlinesCoverage).toBe('LIVE');
  });
});
