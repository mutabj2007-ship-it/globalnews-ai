import { ANALYSIS_TOTAL_BUDGET_MS, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { GEO_IDENTITY_QUARANTINE } from '../../news/geo-quarantine/geo-identity-quarantine';

/**
 * MASTER CTO P0 #85 — the ONE evidence point (analysis.service.ts, beside the rights partition):
 * a held identity is withheld from the evidence before any claim, trace or model call and counted as
 * geoIdentityHeld; a held-only search makes no model call and is never a completed no-match.
 * Real AnalysisService, mock analysis provider, stub news search. Offline; synthetic metadata only.
 */
const HELD_IDS = GEO_IDENTITY_QUARANTINE.map((e) => e.articleId);
const NOW = Date.now();
const article = (id: string, title: string, summary: string): NewsArticle => ({
  id,
  title,
  summary,
  url: `https://wire.example/${id}`,
  sourceId: 'synthetic-wire',
  sourceName: 'Synthetic Wire',
  category: 'world',
  sourcesCount: 1,
  publishedAt: new Date(NOW - 3_600_000).toISOString(),
  publishedAtBasis: 'publisher',
});
const held = HELD_IDS.map((id) =>
  article(id, 'Erik Prince contractors ambushed in battlefield loss', 'Fighters linked to Erik Prince were killed or wounded in an ambush.'),
);
const benign = article(
  'benign-prince-1',
  'Erik Prince contractors ambush investigated by officials',
  'Officials investigated the ambush involving Erik Prince contractors.',
);

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
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const svc = new AnalysisService(news as never, { getCountryNews: jest.fn() } as never, provider, config);
  return { svc, news, analyze };
}

const QUESTION = 'What happened in the ambush involving Erik Prince contractors?';

describe('#85 · the analysis evidence point', () => {
  it('held identities never reach the evidence or the model; the genuine report does; the hold is counted', async () => {
    const { svc, analyze } = service([...held, benign]);
    const result = await svc.analyzeNews(QUESTION);
    const ids = result.articles.map((a) => a.id);
    for (const id of HELD_IDS) expect(ids).not.toContain(id);
    expect(ids).toContain(benign.id);
    expect(result.retrievalContext.geoIdentityHeld?.count).toBe(HELD_IDS.length);
    /* nothing held is in the model input */
    for (const call of analyze.mock.calls) {
      const sent = JSON.stringify(call);
      for (const id of HELD_IDS) expect(sent).not.toContain(id);
    }
    /* no extra model call: one analysis call for one question */
    expect(analyze.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('a held-only search makes NO model call, admits nothing and records the hold (never a silent zero)', async () => {
    const { svc, analyze } = service(held);
    const result = await svc.analyzeNews(QUESTION);
    expect(result.articles).toHaveLength(0);
    expect(result.analysis).toBeNull();
    expect(analyze).not.toHaveBeenCalled();
    expect(result.retrievalContext.geoIdentityHeld?.count).toBe(HELD_IDS.length);
  });

  it('control: the same genuine report alone is answered exactly as before (no hold recorded)', async () => {
    const { svc } = service([benign]);
    const result = await svc.analyzeNews(QUESTION);
    expect(result.articles.map((a) => a.id)).toEqual([benign.id]);
    expect(result.retrievalContext.geoIdentityHeld).toBeUndefined();
  });
});
