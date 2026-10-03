import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { AnalysisService } from './analysis.service';

/**
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §14 / §44 / PO-02 — through the real AnalysisService:
 * a question about what happens BETWEEN Rwanda and Tanzania is answered only from reports about
 * that relationship. Rwanda-only and Tanzania-only reports (correct country, recent, a valid
 * publisher) are rejected before the model sees them, and counted.
 */
const Q = 'What is happening commercially between Rwanda and Tanzania at the border?';

function article(id: string, title: string, summary = ''): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://example.org/${id}`,
    sourceId: 'wire',
    sourceName: 'Regional Wire',
    category: 'business',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    publishedAtBasis: 'publisher',
  } as NewsArticle;
}

const RWANDA = [
  article(
    'rw-border',
    'Rwanda and Tanzania ease cargo checks at Rusumo border',
    'Truck traders welcome faster customs clearance on the Rwanda Tanzania route.',
  ),
  article(
    'rw-only',
    'Rwanda unveils new tourism campaign for Kigali',
    'Rwanda hopes to attract more visitors to Kigali.',
  ),
];
const TANZANIA = [
  article(
    'tz-trade',
    'Tanzanian exporters report new Rwanda border fees',
    'Tanzania traders say Rwanda customs fees raised costs for goods.',
  ),
  article(
    'tz-only',
    'Tanzania parliament debates mining law',
    'Tanzania lawmakers debated mining royalties in Dodoma.',
  ),
];

function response(articles: NewsArticle[]): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
  } as NewsResponse;
}

function harness() {
  const search = jest.fn(async (term: string) =>
    response(/rwanda/i.test(term) ? RWANDA : /tanzania/i.test(term) ? TANZANIA : []),
  );
  const news = {
    search,
    topHeadlines: jest.fn(async () => response([])),
    findArticleById: jest.fn(async () => undefined),
    findRetainedByCountry: jest.fn(async () => []),
  };
  const inputs: AnalysisProviderInput[] = [];
  const analyzeNews = jest.fn(async (input: AnalysisProviderInput) => {
    inputs.push(input);
    return new MockAnalysisProvider().analyzeNews(input);
  });
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: 60000,
      cacheTtlSeconds: 0,
      openAiModel: 'test',
      executionMode: 'development',
      retryAttempts: 0,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    news as never,
    { getCountryNews: jest.fn() } as never,
    { id: 'test', displayName: 'Test', isMock: true, analyzeNews },
    config,
  );
  return { service, inputs, search };
}

describe('R3 §14 — relationship evidence through the real analysis path (PO-02)', () => {
  it('only the two-sided border/trade reports reach the model; one-sided reports are rejected and counted', async () => {
    const h = harness();
    const result = await h.service.analyzeNews(
      Q,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      {
        relationship: { countries: ['RWA', 'TZA'], relations: ['BORDER', 'TRADE'] },
      },
    );
    expect(h.search).toHaveBeenCalledTimes(2);
    const sent = (h.inputs[0]?.articles ?? []).map((a) => a.id).sort();
    expect(sent).toEqual(['rw-border', 'tz-trade']);
    expect(result.retrievalContext?.relationshipEvidence).toEqual({
      countries: ['RWA', 'TZA'],
      relations: ['BORDER', 'TRADE'],
      admitted: 2,
      rejected: 2,
    });
  });

  it('control: without the relationship scope the same question admits per-side country news', async () => {
    const h = harness();
    await h.service.analyzeNews(Q, 'en');
    const sent = (h.inputs[0]?.articles ?? []).map((a) => a.id);
    expect(sent).toEqual(expect.arrayContaining(['rw-only']));
  });

  it('no two-sided report at all → zero evidence and NO model call (never padded with one-sided news)', async () => {
    const h = harness();
    RWANDA.splice(0, 1);
    TANZANIA.splice(0, 1);
    const result = await h.service.analyzeNews(
      Q,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      {
        relationship: { countries: ['RWA', 'TZA'], relations: ['BORDER', 'TRADE'] },
      },
    );
    expect(h.inputs).toHaveLength(0);
    expect(result.analysis).toBeNull();
    expect(result.articles).toEqual([]);
    expect(result.retrievalContext?.relationshipEvidence).toMatchObject({
      admitted: 0,
      rejected: 2,
    });
  });
});
