import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

/*
  MASTER CTO R47 / E1-R46 (#93) — THE EXTERNAL-READER CONTAINMENT, R46-1 … R46-15 as E1 named them.
  Every Ask reader is external (anonymous, guest, ordinary signed-in): a source reaches the reader or
  the model only on a POSITIVE recorded basis. The live registry holds no CLEARED feed today, so the
  no-false-negative cases (R46-12) use ONE fixture CLEARED entry added to the registry for this spec.
*/
jest.mock('../news/providers/feed-source-registry', () => {
  const actual = jest.requireActual('../news/providers/feed-source-registry');
  const cleared = { ...actual.FEED_SOURCES[0], sourceId: 'feed:r46-fixture-cleared', rights: { ...actual.FEED_SOURCES[0].rights, state: 'CLEARED' } };
  return { ...actual, FEED_SOURCES: [...actual.FEED_SOURCES, cleared] };
});

// eslint-disable-next-line import/first
import { AnalysisService } from '../analysis/service/analysis.service';
// eslint-disable-next-line import/first
import type { AnalysisProvider } from '../analysis/interfaces';
// eslint-disable-next-line import/first
import type { AnalysisConfigService } from '../analysis/config/analysis-config.service';
// eslint-disable-next-line import/first
import { scoreGenericRelevance } from '../news/relevance/generic-relevance.util';
// eslint-disable-next-line import/first
import { sourceUseDecision, sourceUsePermittedForReader } from '../news/rights/source-use-policy';
// eslint-disable-next-line import/first
import {
  priorWorkRightsClearedWith,
  readerSafeAssessment,
  assessmentEvidenceIds,
  withheldForSourceRights,
  WITHHELD_BASIS,
} from './source-rights-withholding';
// eslint-disable-next-line import/first
import { BriefingsService } from './briefings/briefings.service';

const CLEARED_FEED = 'feed:r46-fixture-cleared';
const BASE = {
  title: 'Erik Prince firm signs new contract',
  summary: 'FIXTURE — synthetic summary naming Erik Prince.',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-10-09T12:00:00.000Z',
  publishedAtBasis: 'publisher',
} as const;
const art = (id: string, sourceId: string, extra: Record<string, unknown> = {}): NewsArticle =>
  ({ ...BASE, id, sourceId, sourceName: sourceId, url: `https://example.invalid/${id}`, ...extra }) as unknown as NewsArticle;
/* GNews-origin, fresh (providerId present) and stored (providerId not persisted) */
const PENDING_FRESH = art('pending-fresh', 'bbc', { providerId: 'gnews', imageUrl: 'https://example.invalid/i.jpg' });
const PENDING_STORED = art('pending-stored', 'bbc');
const UNKNOWN = art('unknown', '');
const CLEARED = art('cleared', CLEARED_FEED, { publishedAtBasis: 'observed' });

const payloadWith = (articles: NewsArticle[], recent: Array<Record<string, unknown>> = []) => ({
  schema: 'ask-r2-result/1',
  answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
  analysis: {
    articles,
    analysis: {
      summary: 'FIXTURE answer quoting “a short verbatim excerpt”.',
      sources: articles.map((a) => ({ articleId: a.id, title: a.title, publisher: a.sourceName, url: a.url, publishedAt: a.publishedAt })),
      summaryStatements: [{ text: 'FIXTURE excerpt', sourceArticleIds: articles.map((a) => a.id) }],
    },
  },
  recentReporting: { items: recent },
});

function analysisHarness(corpus: NewsArticle[]) {
  const newsService = {
    search: jest.fn(async (query: string, _l?: number, mode?: { type?: string }): Promise<NewsResponse> => {
      const articles = mode?.type === 'generic' ? corpus.filter((c) => scoreGenericRelevance(c, query).isRelevant) : corpus;
      return { articles, totalResults: articles.length, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as NewsResponse;
    }),
    topHeadlines: jest.fn(async () => ({ articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() }) as NewsResponse),
    findArticleById: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      const country = resolveCountryByAnyIdentifier(identifier);
      return { countryCode: country?.iso3 ?? identifier, countryName: country?.name ?? identifier, articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as unknown as CountryNewsResponse;
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
  return { service: new AnalysisService(newsService as never, countryNewsService as never, provider, config), provider };
}
const modelArticleIds = (provider: AnalysisProvider): string[] => {
  const calls = (provider.analyzeNews as jest.Mock).mock.calls;
  return calls.length === 0 ? [] : ((calls[0][0] as { articles?: NewsArticle[] }).articles ?? []).map((a) => a.id);
};
const QUESTION = 'Give any reports about Eric Prince please.';

function briefingsWith(versionRefs: string[], stored: Array<{ id: string; sourceId: string; url: string }>) {
  const prisma = {
    briefing: { findFirst: jest.fn(async () => ({ id: 'b1', title: 'T', versions: [{ version: 1 }] })) },
    briefingVersion: {
      findUnique: jest.fn(async () => ({
        version: 1, asOf: new Date(), windowFrom: null, windowTo: null,
        blocks: { schema: 'briefing-blocks/1', answerState: 'CURRENT_REPORTING', summary: 'FIXTURE stored text', keyFacts: [] },
        evidenceRefs: versionRefs.map((id) => ({ id, host: 'example.invalid', url: `https://example.invalid/${id}`, title: 't', publisher: 'p', publishedAt: null })),
        evidenceRevision: 'r1', coverageGaps: [], createdAt: new Date(),
      })),
    },
    article: { findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => stored.filter((r) => where.id.in.includes(r.id))) },
  };
  return { svc: new BriefingsService(prisma as never), prisma };
}
const line = (id: string) => ({ id, url: `https://example.invalid/${id}`, title: `title ${id}`, publisher: 'p', publishedAt: null });
const ASSESSMENT = {
  schema: 'followed-assessment/2',
  outcome: 'NEW_EVIDENCE',
  newEvidence: [line('pending-stored'), line('cleared')],
  earlierReportingFoundNow: [line('unknown')],
  possibleCorrections: [],
  supportedChanges: [
    { claim: 'FIXTURE claim on a pending source', sourceArticleIds: ['pending-stored'] },
    { claim: 'FIXTURE claim on a cleared source', sourceArticleIds: ['cleared'] },
  ],
};

describe('E1-R46 · the external-reader containment (positive basis only)', () => {
  it('R46-1 pending GNews row, fresh Ask: no headline or snippet in the JSON; the withheld reason is present', () => {
    for (const row of [PENDING_FRESH, PENDING_STORED]) {
      const out = withheldForSourceRights(payloadWith([row])) as Record<string, unknown>;
      expect(out.analysis).toBeNull();
      expect((out.answer as { basis: string }).basis).toBe(WITHHELD_BASIS);
      expect(out.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 1 });
      expect(JSON.stringify(out)).not.toContain(BASE.title);
    }
  });

  it('R46-2 pending GNews row, metadata-only fields (name, date, link): withheld from the listing', () => {
    const out = withheldForSourceRights(payloadWith([CLEARED], [
      { sourceId: 'bbc', title: 'listed pending', url: 'https://example.invalid/l1', sourceName: 'BBC', publishedAt: BASE.publishedAt },
      { sourceId: 'bbc', providerId: 'gnews', title: 'listed fresh', url: 'https://example.invalid/l2', sourceName: 'BBC', publishedAt: BASE.publishedAt },
      { sourceId: 'feed:taarifa-rw', title: 'listed metadata-only feed', url: 'https://example.invalid/l3', sourceName: 'Taarifa', publishedAt: BASE.publishedAt },
    ])) as { recentReporting: { items: Array<{ title: string }> } };
    expect(out.recentReporting.items.map((i) => i.title)).toEqual(['listed metadata-only feed']);
  });

  it('R46-3 (frontend sink) a headline is never link text: the withheld JSON carries no title to anchor a link', () => {
    const out = withheldForSourceRights(payloadWith([PENDING_FRESH])) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/"title"/);
  });

  it('R46-4 a model-quoted excerpt resting on a pending source is withheld with the answer', () => {
    const out = withheldForSourceRights(payloadWith([PENDING_STORED, CLEARED])) as Record<string, unknown>;
    expect(out.analysis).toBeNull();
    expect(JSON.stringify(out)).not.toContain('short verbatim excerpt');
  });

  it('R46-5 stored reopen of a pending-sourced answer: withheld at read time; the stored object is unchanged', () => {
    const stored = payloadWith([PENDING_STORED]);
    const snapshot = JSON.stringify(stored);
    withheldForSourceRights(stored);
    expect(JSON.stringify(stored)).toBe(snapshot);
  });

  it('R46-6 saved briefing version resting on a pending source: withheld (451), stored version untouched (#93 stays OPEN)', async () => {
    const { svc, prisma } = briefingsWith(['pending-stored'], [{ id: 'pending-stored', sourceId: 'bbc', url: 'https://example.invalid/pending-stored' }]);
    await expect(svc.getVersion('u1', 'b1', 1)).rejects.toMatchObject({ status: 451 });
    expect(prisma.article.findMany).toHaveBeenCalledTimes(1);
  });

  it('R46-7 Saved view (reopen through the same operation read): the reader snapshot is not rewritten', () => {
    const stored = payloadWith([PENDING_FRESH]);
    const before = JSON.stringify(stored);
    const out = withheldForSourceRights(stored);
    expect(out).not.toBe(stored);
    expect(JSON.stringify(stored)).toBe(before);
  });

  it('R46-8 My Updates BEFORE / LATEST and the check lines: withheld, counted — never "no relevant news"', async () => {
    const permitted = { metadata: new Set(['cleared']), aiInput: new Set(['cleared']) };
    const out = readerSafeAssessment(ASSESSMENT, permitted) as typeof ASSESSMENT & { withheld: { reason: string; count: number } };
    expect(out.newEvidence.map((l) => l.id)).toEqual(['cleared']);
    expect(out.earlierReportingFoundNow).toEqual([]);
    expect(out.supportedChanges.map((c) => c.claim)).toEqual(['FIXTURE claim on a cleared source']);
    expect(out.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 3 });
    expect(out.outcome).toBe('NEW_EVIDENCE');
    expect(assessmentEvidenceIds(ASSESSMENT).sort()).toEqual(['cleared', 'pending-stored', 'unknown']);
    /* the version read on either side of a comparison is the same gate (451 → the reader sees WITHHELD) */
    const { svc } = briefingsWith(['cleared', 'pending-stored'], [
      { id: 'cleared', sourceId: CLEARED_FEED, url: 'https://example.invalid/cleared' },
      { id: 'pending-stored', sourceId: 'bbc', url: 'https://example.invalid/pending-stored' },
    ]);
    await expect(svc.getVersion('u1', 'b1', 1)).rejects.toMatchObject({ status: 451 });
  });

  it('R46-9 prompt assembly with a pending source: the source is absent from the prompt; 0 model calls; counted as rights-withheld', async () => {
    const h = analysisHarness([PENDING_FRESH]);
    const r = await h.service.analyzeNews(QUESTION);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.articles).toEqual([]);
    expect(r.retrievalContext.rightsExcluded?.reasons).toEqual({ PROVIDER_RIGHTS_NOT_CLEARED: 1 });
    expect(r.retrievalContext.rightsPending).toBeUndefined();
  });

  it('R46-10 model re-input of a prior sourced answer resting on a pending source: refused', async () => {
    const find = jest.fn(async (id: string) => (id === 'p' ? PENDING_STORED : id === 'c' ? CLEARED : null));
    await expect(priorWorkRightsClearedWith({ provenance: 'SOURCED_REPORTING', evidenceRefs: ['p'] }, find, 8)).resolves.toBe(false);
    await expect(priorWorkRightsClearedWith({ provenance: 'SOURCED_REPORTING', evidenceRefs: ['c'] }, find, 8)).resolves.toBe(true);
  });

  it('R46-11 a hotlinked imageUrl of a pending source never reaches any response', async () => {
    const h = analysisHarness([PENDING_FRESH]);
    const r = await h.service.analyzeNews(QUESTION);
    expect(JSON.stringify(r)).not.toContain('i.jpg');
    expect(JSON.stringify(withheldForSourceRights(payloadWith([PENDING_FRESH])))).not.toContain('i.jpg');
  });

  it('R46-12 NO FALSE NEGATIVE: a feed:* CLEARED source renders and reaches the model unchanged', async () => {
    const h = analysisHarness([CLEARED]);
    await h.service.analyzeNews(QUESTION).catch(() => undefined);
    expect(modelArticleIds(h.provider)).toEqual(['cleared']);
    const payload = payloadWith([CLEARED]);
    expect(withheldForSourceRights(payload)).toBe(payload);
    expect(sourceUsePermittedForReader(CLEARED, 'AI_INPUT')).toBe(true);
    expect(sourceUsePermittedForReader(CLEARED, 'METADATA')).toBe(true);
    const { svc } = briefingsWith(['cleared'], [{ id: 'cleared', sourceId: CLEARED_FEED, url: 'https://example.invalid/cleared' }]);
    await expect(svc.getVersion('u1', 'b1', 1)).resolves.toMatchObject({ version: 1 });
  });

  it('R46-13 UNKNOWN_PROVENANCE row: withheld at the sink; stored data and global enforcement unchanged', () => {
    const stored = payloadWith([UNKNOWN]);
    const before = JSON.stringify(stored);
    expect((withheldForSourceRights(stored) as { withheld: unknown }).withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 1 });
    expect(JSON.stringify(stored)).toBe(before);
    /* the policy's own default is still `record`: no global switch was flipped */
    expect(sourceUseDecision(PENDING_STORED, 'AI_INPUT')).toEqual({ allowed: true, basis: 'PROVIDER_PENDING_REVIEW', provider: 'stored-provider-unverified' });
    expect(process.env.ASK_PROVIDER_RIGHTS_ENFORCEMENT).toBeUndefined();
  });

  it('R46-14 publication-date basis passes through unaltered: observed stays observed, never upgraded to publisher', () => {
    const payload = payloadWith([CLEARED]);
    const out = withheldForSourceRights(payload) as typeof payload;
    expect((out.analysis.articles[0] as unknown as { publishedAtBasis: string }).publishedAtBasis).toBe('observed');
  });

  it('R46-15 the gate bites AND does not over-block (mutations are run against this spec; see 01-CANDIDATE.md)', () => {
    /* recorded here so the suite names it; the two mutation runs (revert to record → R46-1/R46-9 fail;
       withhold everything → R46-12 fails) are executed and reported by the candidate document */
    expect(sourceUsePermittedForReader(PENDING_FRESH, 'AI_INPUT')).toBe(false);
    expect(sourceUsePermittedForReader(CLEARED, 'AI_INPUT')).toBe(true);
  });
});
