import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { observedRetrievalOf, retrievalIncomplete } from '../../ask-v2/retrieval-outcome';
import { __setReaderRightsFixtureModeForTests } from '../../news/rights/reader-rights';
jest.setTimeout(180000);
beforeAll(() => __setReaderRightsFixtureModeForTests(true));
afterAll(() => __setReaderRightsFixtureModeForTests(false));
const WINDOW = { statedPeriod: 'this week', from: '2026-10-12T00:00:00.000Z', to: '2026-10-16T00:00:00.000Z' } as const;
const art = (id: string, publishedAt: string | undefined, basis: 'publisher' | undefined = 'publisher'): NewsArticle =>
  ({ id, title: 'Fuel prices adjusted again', summary: 'A fuel price change was announced in the market.',
     url: `https://${id}.example/${id}`, sourceId: `src-${id}`, sourceName: `Outlet ${id}`, category: 'business',
     sourcesCount: 1, publishedAt, publishedAtBasis: basis, sourceLanguage: 'en' }) as unknown as NewsArticle;
function stub(id: string, arts: readonly NewsArticle[], fail?: Error): NewsProvider {
  return { id, displayName: id, isMock: false, capabilities: ['search', 'topHeadlines', 'category'],
    async search() { if (fail) throw fail; return [...arts]; },
    async topHeadlines() { if (fail) throw fail; return [...arts]; },
    async category() { return []; },
    async health() { return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' }; } } as unknown as NewsProvider;
}
async function svc(primary: NewsProvider[], fallback: NewsProvider[] = []) {
  const persistence = { persistMany: jest.fn().mockResolvedValue(new Map()), findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null), findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]), persistCountryRelations: jest.fn().mockResolvedValue(undefined) };
  const all = [...primary, ...fallback];
  const m = await Test.createTestingModule({ providers: [NewsService, CountryNewsService,
    { provide: ConfigService, useValue: { get: () => undefined } }, { provide: NEWS_PROVIDERS, useValue: all },
    { provide: ALL_NEWS_PROVIDERS, useValue: all }, { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallback },
    { provide: ArticlePersistenceService, useValue: persistence }] }).compile();
  const model: AnalysisProvider = { id: 'openai', displayName: 'm', isMock: false,
    analyzeNews: async (_i: AnalysisProviderInput) => ({ summary: 'x', keyPoints: [], sentiment: 'neutral', topics: [] } as never) };
  const config = { get: () => ({ maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
    cacheTtlSeconds: 0, openAiApiKey: undefined, openAiModel: 'f', executionMode: 'development' as const, retryAttempts: 1,
    retryBaseDelayMs: 1, maxCompletionTokens: 2000 }) } as unknown as AnalysisConfigService;
  return new AnalysisService(m.get(NewsService), m.get(CountryNewsService), model, config);
}
const Q = 'fuel prices';
const IN1 = art('in-1', '2026-10-14T06:00:00.000Z');
const IN2 = art('in-2', '2026-10-13T06:00:00.000Z');
const OUT1 = art('out-1', '2026-10-01T06:00:00.000Z');
const OUT2 = art('out-2', '2026-09-20T06:00:00.000Z');
const NODATE = art('nodate', undefined, undefined);
/*
  ════════════════════════════════════════════════════════════════════════════
  MASTER CTO R85 TASK 2(a) — BETA-ASK-005 / G R76-F1: candidatesSeen AFTER A
  REPORTING WINDOW EXCLUDES EVERYTHING
  ════════════════════════════════════════════════════════════════════════════

  TEST DATA AND SPECS ONLY — NOT WIRED. Main owns the code. Every assertion below is either
  (a) already true at b3e1744 and asserted so it cannot regress, or (b) marked PENDING with the
  truthful outcome Main's fix should produce. A PENDING line is a one-line edit on the day the fix
  lands; nothing here is red today.

  THE DEFECT, restated. The order on the analysis path is relevance gate -> reporting window ->
  rights/geo holds. When the window excludes everything, `reportingWindow.excludedOutsideWindow`
  records it truthfully, but `retrievalTrace.candidatesSeen` is taken from the POST-filter article
  count and reads 0, so observedRetrievalOf() cannot tell ALL_FILTERED from COMPLETED_NO_MATCH and
  returns the latter: "the search completed and returned nothing relevant", for a turn where
  reporting WAS retrieved and set aside for falling outside the reader's own period.

  WHY SOME ROWS ARE COUNTER-ONLY. At b3e1744 an item that survives the window then meets the rights
  hold (no CLEARED source exists in the reviewed registry), so the FINAL outcome code for those rows
  is RIGHTS_WITHHELD — correct containment, and nothing to do with the window. Those rows therefore
  assert the window COUNTERS, which is where the defect lives. To exercise their final outcome, Main
  can admit a cleared source with `__setRightsTestFeeds` (news/rights/rights-enforcement.ts) and
  `__setProviderAdmissionTestFeeds` (news/rights/provider-admission.ts); G has NOT done so and marks
  those assertions NOT_EXERCISED rather than guessing.

  Fixture mode is ON here so providers are admitted: this is a WINDOW test, not a rights test.
  Offline — no live provider, model, network or clock. Dates are fixed instants.
*/
describe('R85 2(a) — a window that excludes everything must not read as a completed no-match', () => {
  const run = async (arts: NewsArticle[], withWindow = true, peerFails = false) => {
    const primary = stub('gnews', arts);
    const fallback = peerFails
      ? [stub('gdelt-doc', [], Object.assign(new Error('timeout'), { kind: 'timeout' }))]
      : [];
    const service = await svc([primary], fallback);
    const r = await service.analyzeNews(Q, 'en', undefined, undefined, undefined, undefined,
      withWindow ? ({ reportingWindow: WINDOW } as never) : undefined);
    return {
      ids: (r.articles ?? []).map((a) => a.id),
      seen: r.retrievalContext?.retrievalTrace?.candidatesSeen ?? null,
      admitted: r.retrievalContext?.retrievalTrace?.candidatesAdmitted ?? null,
      excluded: r.retrievalContext?.reportingWindow?.excludedOutsideWindow ?? null,
      basis: r.retrievalContext?.reportingWindow?.basis ?? null,
      observed: observedRetrievalOf(r as never).retrievalOutcome,
      incomplete: retrievalIncomplete(r as never),
    };
  };

  it('C1 — only publisher-dated out-of-window matches', async () => {
    const o = await run([OUT1, OUT2]);
    expect(o.ids).toEqual([]);
    expect(o.excluded).toBe(2);                 /* truthful today: the exclusion IS recorded */
    expect(o.basis).toBe('PUBLICATION_TIME');
    /* MAIN R96 — G's PENDING "expected 2" is deliberately NOT adopted: these items are uncleared, and
       the trace reaches the reader, so the fix classifies from the window fact the response already
       carries instead of adding a count (CTO R80: never surface an uncleared source's existence). */
    expect(o.seen).toBe(0);
    /* MAIN R96 — WAS PENDING (expected COMPLETED_NO_MATCH at b3e1744): now ALL_FILTERED. The reader
       wording ("No qualifying reports were verified within your requested period") is the FE half. */
    expect(o.observed).toBe('ALL_FILTERED');
    expect(o.incomplete).toBe(false);
  });

  it('C2 — a genuine zero-return completed search', async () => {
    const o = await run([]);
    expect(o.excluded).toBe(0);
    expect(o.seen).toBe(0);
    expect(o.observed).toBe('COMPLETED_NO_MATCH');  /* correct today AND after the fix */
    expect(o.incomplete).toBe(false);
  });

  it('C3 — one in-window item (window counters; final code is the rights hold)', async () => {
    const o = await run([IN1]);
    expect(o.excluded).toBe(0);                 /* the window excluded nothing */
    expect(o.basis).toBe('PUBLICATION_TIME');
    expect(o.observed).toBe('RIGHTS_WITHHELD'); /* NOT_EXERCISED as a window outcome: see header */
  });

  it('C4 — mixed in-window and out-of-window', async () => {
    const o = await run([IN1, OUT1, OUT2]);
    expect(o.excluded).toBe(2);                 /* exactly the out-of-window pair */
    expect(o.observed).toBe('RIGHTS_WITHHELD'); /* NOT_EXERCISED as a window outcome: see header */
  });

  it('C5 — an unknown publisher date is excluded, and that is not an empty search', async () => {
    const o = await run([NODATE]);
    expect(o.excluded).toBe(1);                 /* strict: only a publisher-stated time qualifies */
    expect(o.ids).toEqual([]);
    expect(o.seen).toBe(0);                     /* MAIN R96 — G's PENDING "expected 1" not adopted: see C1 */
    /* MAIN R96 — WAS PENDING (expected COMPLETED_NO_MATCH at b3e1744): an item was retrieved and set
       aside for an UNKNOWN date, so the period is not reported as searched-and-empty. */
    expect(o.observed).toBe('ALL_FILTERED');
  });

  it('C6 — a partial provider failure beside a window stays incomplete', async () => {
    const o = await run([IN1], true, true);
    expect(o.observed).toBe('RIGHTS_WITHHELD'); /* NOT_EXERCISED: the rights hold precedes here */
    /* PENDING: with a cleared source, expected PARTIAL_NO_MATCH and incomplete true — a peer
       outage beside a window is not a completed empty period. */
  });

  /* C7 — RIGHTS-HELD ROWS. NOT_EXERCISED BY G.
     Needs a CLEARED source admitted through __setRightsTestFeeds + __setProviderAdmissionTestFeeds
     and then withheld for display. Expected: RIGHTS_WITHHELD, never a window or no-match claim, and
     the rights count distinct from excludedOutsideWindow so the two reasons never merge. */

  it('C8 — no stated window: nothing about a window is claimed', async () => {
    const o = await run([OUT1, OUT2], false);
    expect(o.excluded).toBeNull();
    expect(o.basis).toBeNull();
  });
});
