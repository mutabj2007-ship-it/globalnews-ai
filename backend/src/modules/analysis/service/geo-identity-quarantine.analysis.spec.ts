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
  /* the country feed: records which country each request was scoped to */
  const getCountryNews = jest.fn(async (iso3: string) => ({
    articles: [],
    totalResults: 0,
    providers: ['gnews'],
    dataMode: 'live',
    countryCode: iso3,
    countryName: iso3,
    feedTier: 'delayed',
    providerDisplayName: 'GNews',
    generatedAt: new Date().toISOString(),
  }));
  const svc = new AnalysisService(news as never, { getCountryNews } as never, provider, config);
  return { svc, news, analyze, getCountryNews };
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

describe('#85 · BW-EA-Q5 (EA P6 / Q-3): legacy /analysis/news never trusts a client country for a held story', () => {
  const STORY_QUESTION = 'What is the latest on this story?';
  const scopedTo = (calls: unknown[][]) => calls.map((c) => c[0]);

  it.each(HELD_IDS)('{articleId: %s, countryCode: CG} → never scoped to COG (as if no country was sent)', async (articleId) => {
    const { svc, getCountryNews } = service([]);
    const result = await svc.analyzeNews(STORY_QUESTION, 'en', { title: 'Synthetic held story', articleId, countryCode: 'CG' });
    expect(scopedTo(getCountryNews.mock.calls)).not.toContain('COG');
    expect(result.retrievalContext.countryCode).not.toBe('CG');
    expect(result.retrievalContext.countryCode).not.toBe('COG');
  });

  it('control: an unheld story with countryCode CG is still scoped to COG (unchanged)', async () => {
    const { svc, getCountryNews } = service([]);
    await svc.analyzeNews(STORY_QUESTION, 'en', { title: 'Synthetic story', articleId: 'unheld-story-1', countryCode: 'CG' });
    expect(scopedTo(getCountryNews.mock.calls)).toContain('COG');
  });
});

describe('#85 · BW-EA-Q4: the anchored country never comes from a held report', () => {
  const resolveAnchored = (anchor: NewsArticle, supporting: NewsArticle[]) =>
    (AnalysisService.prototype as unknown as {
      resolveAnchoredEvidenceCountry(a: NewsArticle, s: NewsArticle[], c: string | undefined): { iso2: string } | undefined;
    }).resolveAnchoredEvidenceCountry.call({}, anchor, supporting, undefined);
  const withCountry = (a: NewsArticle, countryCode: string) => ({ ...a, countryCode });

  it('a held anchor carrying CG supplies no country; 5 held supporting carrying CG supply none', () => {
    expect(resolveAnchored(withCountry(held[0], 'CG'), [])).toBeUndefined();
    expect(resolveAnchored(withCountry(benign, ''), held.map((h) => withCountry(h, 'CG')))).toBeUndefined();
  });
  it('a held anchor falls through to authentic supporting reporting (COD decides)', () => {
    expect(resolveAnchored(withCountry(held[0], 'CG'), [withCountry(benign, 'CD'), ...held.map((h) => withCountry(h, 'CG'))])?.iso2).toBe('CD');
  });
  it('control: an unheld anchor carrying CG still gives CG', () => {
    expect(resolveAnchored(withCountry(benign, 'CG'), [])?.iso2).toBe('CG');
  });
});
