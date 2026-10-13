import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
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
import { readRetrievalDiagnostics } from '../../news/retrieval-trace/retrieval-diagnostics';

/*
  RETRIEVAL R1 · T1 — the envelope through a real AnalysisService run (fixture model, stub
  providers, no network). Synthetic headlines only.
*/

function a(
  id: string,
  title: string,
  summary: string,
  extra: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://${id}.example/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Outlet ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher' as const,
    sourceLanguage: 'en',
    ...extra,
  };
}

function stub(id: string, articles: NewsArticle[] | Error, calls: { n: number }): NewsProvider {
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search'],
    async search() {
      calls.n += 1;
      if (articles instanceof Error) throw articles;
      return articles.map((article) => ({ ...article, providerId: id }));
    },
    async topHeadlines() {
      return [];
    },
    async category() {
      return [];
    },
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' };
    },
  } as unknown as NewsProvider;
}

async function services(
  primary: NewsProvider[],
  fallback: NewsProvider[] = [],
  cacheTtlSeconds = 0,
) {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const all = [...primary, ...fallback];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: all },
      { provide: ALL_NEWS_PROVIDERS, useValue: all },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallback },
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
      cacheTtlSeconds,
      openAiApiKey: undefined,
      rightsAudience: 'TEST_FIXTURE' as const, openAiModel: 'fixture',
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
  return { service, inputs };
}

const RELEVANT = [
  a(
    'rail-1',
    'Nairobi commuter rail expansion approved',
    'The Nairobi commuter rail expansion was approved by cabinet on Tuesday.',
  ),
  a(
    'rail-2',
    'Nairobi commuter rail expansion funding confirmed',
    'Treasury confirmed funding for the Nairobi commuter rail expansion.',
  ),
];

describe('T1 · analysis run — envelope attached, invisible to the public JSON', () => {
  it('attaches diagnostics on a non-enumerable channel with model-input and citation counts', async () => {
    const calls = { n: 0 };
    const { service, inputs } = await services([stub('gnews', RELEVANT, calls)]);
    const result = await service.analyzeNews('Nairobi commuter rail expansion', 'en');

    const diagnostics = readRetrievalDiagnostics(result);
    expect(diagnostics).toBeDefined();
    expect(Object.keys(result)).not.toContain('retrievalDiagnostics');
    /* Non-enumerable: an enumerable symbol would ride into spreads and structural equality. */
    expect(
      Object.getOwnPropertySymbols(result).filter(
        (symbol) => Object.getOwnPropertyDescriptor(result, symbol)?.enumerable === true,
      ),
    ).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('retrieval-diagnostics/1');

    expect(diagnostics?.reuse).toBe('NONE');
    expect(diagnostics?.attempts[0]).toMatchObject({
      providerId: 'gnews',
      outcome: 'SUCCESS',
      rawFetchedCount: 2,
    });
    expect(inputs).toHaveLength(1);
    expect(diagnostics?.analysisStages.modelInput).toBe(inputs[0]?.articles.length);
    expect(diagnostics?.analysisStages.cited).toBeGreaterThan(0);
    expect(diagnostics?.analysisStages.cited ?? 0).toBeLessThanOrEqual(
      diagnostics?.analysisStages.modelInput ?? 0,
    );
    expect(diagnostics?.totals.finalEvidence).toBe(result.articles.length);
    expect(diagnostics?.invariants).toEqual({ ok: true, violations: [] });
    expect(diagnostics?.evidenceEmpty).toBe(false);
  });
});

describe('T1 · analysis run — zero evidence never reaches the model, and the cause is specific', () => {
  it('Q1 shape: GNews answered with off-phrase items, GDELT timed out → RELEVANCE_REJECTED + PROVIDER_FAILED_TIMEOUT, model not called', async () => {
    const calls = { n: 0 };
    const { service, inputs } = await services(
      [
        stub(
          'gnews',
          [
            a(
              'off-1',
              'Ministers meet to discuss budget timetable',
              'The cabinet discussed the budget timetable.',
            ),
            a(
              'off-2',
              'Football club announces new stadium plan',
              'The club unveiled stadium plans.',
            ),
          ],
          calls,
        ),
      ],
      [stub('gdelt-doc', new GNewsProviderError('synthetic timeout', undefined, 'timeout'), calls)],
    );
    const result = await service.analyzeNews('Kibirizi floodwater relief convoy update', 'en');
    expect(result.analysis).toBeNull();
    expect(inputs).toHaveLength(0);

    const diagnostics = readRetrievalDiagnostics(result);
    const causes = diagnostics?.causes.map((c) => c.cause) ?? [];
    expect(causes).toEqual(
      expect.arrayContaining(['RELEVANCE_REJECTED', 'PROVIDER_FAILED_TIMEOUT', 'INCOMPLETE_CHECK']),
    );
    expect(causes).not.toContain('PROVIDER_EMPTY');
    expect(diagnostics?.analysisStages.modelInput).toBeNull();
    expect(diagnostics?.unobserved).toEqual(
      expect.arrayContaining(['modelInput (no model call on this operation)']),
    );
    expect(diagnostics?.evidenceEmpty).toBe(true);
  });
});

describe('T1 · analysis run — rights exclusions per use are carried, not re-decided', () => {
  it('a prohibited feed item is RIGHTS_WITHHELD for AI input; aggregator items stay "pending review", never "cleared"', async () => {
    const calls = { n: 0 };
    const { service, inputs } = await services([
      stub(
        'gnews',
        [
          ...RELEVANT,
          a(
            'wp',
            'Nairobi commuter rail expansion criticised',
            'Critics of the Nairobi commuter rail expansion spoke out.',
            {
              sourceId: 'feed:wp-pl',
            },
          ),
        ],
        calls,
      ),
    ]);
    const result = await service.analyzeNews('Nairobi commuter rail expansion', 'en');
    const diagnostics = readRetrievalDiagnostics(result);
    expect(inputs[0]?.articles.map((article) => article.id)).not.toContain('wp');
    expect(diagnostics?.analysisStages.rightsAiInput.excluded).toBe(1);
    expect(diagnostics?.causes.map((c) => c.cause)).toContain('RIGHTS_WITHHELD');
    expect(diagnostics?.analysisStages.rightsAiInput.pendingReview).toBeGreaterThan(0);
    /* T1.1 — the executed AI-input gate is recorded once, with its own counts (E1 use E) */
    const gate = diagnostics?.rightsDecisions['AI_INPUT@ANALYSIS_EVIDENCE'];
    expect(gate).toMatchObject({ excluded: 1 });
    expect(gate?.allowedPendingReview).toBe(
      diagnostics?.analysisStages.rightsAiInput.pendingReview,
    );
    expect(
      (gate?.allowedCleared ?? 0) + (gate?.allowedPendingReview ?? 0) + (gate?.excluded ?? 0),
    ).toBe(gate?.evaluated);
    expect(diagnostics?.rightsUses.E).toEqual({ decidedAt: ['AI_INPUT@ANALYSIS_EVIDENCE'] });
    expect(diagnostics?.rightsUses.A).toBe('NOT_ASSESSED');
  });
});

describe('T1 · analysis cache replay — no new provider attempt, relabelled', () => {
  it('the second identical request is served from the analysis cache with ANALYSIS_CACHE and the same attempts', async () => {
    const calls = { n: 0 };
    const { service } = await services([stub('gnews', RELEVANT, calls)], [], 60);
    const first = await service.analyzeNews('Nairobi commuter rail expansion', 'en');
    const callsAfterFirst = calls.n;
    const second = await service.analyzeNews('Nairobi commuter rail expansion', 'en');

    expect(calls.n).toBe(callsAfterFirst);
    expect(readRetrievalDiagnostics(first)?.reuse).toBe('NONE');
    expect(readRetrievalDiagnostics(second)?.reuse).toBe('ANALYSIS_CACHE');
    expect(readRetrievalDiagnostics(second)?.attempts).toEqual(
      readRetrievalDiagnostics(first)?.attempts,
    );
  });
});
