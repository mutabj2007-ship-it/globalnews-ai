import { writeFileSync } from 'fs';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS, type NewsArticle } from '@globalnews-ai/shared';

import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { FEED_SOURCES } from '../../news/providers/feed-source-registry';
import { __setProviderAdmissionTestFeeds } from '../../news/rights/provider-admission';
import { __setReaderRightsFixtureModeForTests, __setRightsTestFeeds } from '../../news/rights/rights-enforcement';
import { observedRetrievalOf, retrievalIncomplete } from '../../ask-v2/retrieval-outcome';
import { researchRecordOf } from '../../ask-v2/research-record';

/*
  CTO R115 (#95 / #93) — THE LIVE ALPHA TUPLE AS A FIXTURE-FIRST REGRESSION. TEST-ONLY.

  Measured LIVE on Alpha at 8ec1f4a: "What has changed in eastern DRC over the last 7 days?" → COD
  country route, windowH=168, gnews + gdelt-doc rights-skipped BEFORE any network, yet the envelope
  said failed=gnews:unavailable+gdelt-doc:unavailable, dataMode=unavailable, fallback=provider-error,
  and the reader saw "Live reporting is temporarily unavailable. Please try again in a moment."

  Must FAIL at exact 8ec1f4a and PASS at bc13149 (the F6–F8 + C-1 line). No production code is
  changed by this commit. Offline: stub providers (calls recorded, never a network), stub model
  (calls recorded), stub persistence, no DB. R115_OUT=<file.json> dumps what each case produced.
*/
jest.setTimeout(180000);

const QUESTION = 'What has changed in eastern DRC over the last 7 days?';
/* the live tuple's window: the Ask router's 168 h reporting window, passed exactly as the Ask adapter passes it */
const WINDOW_POLICY = () => {
  const to = new Date();
  return { reportingWindow: { statedPeriod: 'last 7 days', from: new Date(to.getTime() - 168 * 3_600_000).toISOString(), to: to.toISOString() } };
};
const OBS: Record<string, unknown> = {};
afterAll(() => {
  if (process.env.R115_OUT) writeFileSync(process.env.R115_OUT, JSON.stringify(OBS, null, 2));
});
afterEach(() => {
  __setProviderAdmissionTestFeeds(null);
  __setRightsTestFeeds(null);
  __setReaderRightsFixtureModeForTests(true);
});

type Behaviour = 'empty' | { throwKind: string } | { items: () => NewsArticle[] };
type Call = { providerId: string; q: string };
function stub(id: string, calls: Call[], behaviour: Behaviour = 'empty'): NewsProvider {
  const act = async (q: string): Promise<NewsArticle[]> => {
    calls.push({ providerId: id, q });
    if (behaviour === 'empty') return [];
    if ('throwKind' in behaviour) throw Object.assign(new Error(`${id} ${behaviour.throwKind}`), { kind: behaviour.throwKind });
    return behaviour.items();
  };
  return {
    id, displayName: id, isMock: false, capabilities: ['search', 'top-headlines'],
    search: (q: string) => act(q), topHeadlines: () => act(''), category: () => act(''),
    async health() { return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' }; },
  } as unknown as NewsProvider;
}

async function run(providers: NewsProvider[], fallback: NewsProvider[] = []) {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()), findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null), findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]), persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const ref = await Test.createTestingModule({
    providers: [
      NewsService, CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: providers },
      { provide: ALL_NEWS_PROVIDERS, useValue: [...providers, ...fallback.filter((f) => !providers.includes(f))] },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallback },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const modelCalls: unknown[] = [];
  const model: AnalysisProvider = {
    id: 'openai', displayName: 'Fixture model', isMock: false,
    analyzeNews: async (input) => { modelCalls.push(input); return { headline: 'h', summary: 'x', keyFacts: [], keyPoints: [], sentiment: 'neutral', topics: [] } as never; },
  };
  const config = {
    get: () => ({
      maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0,
      openAiApiKey: undefined, openAiModel: 'fixture', executionMode: 'development' as const, retryAttempts: 1, retryBaseDelayMs: 1, maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const news = ref.get(NewsService);
  const country = ref.get(CountryNewsService);
  const r = await new AnalysisService(news, country, model, config).analyzeNews(QUESTION, 'en', undefined, undefined, undefined, undefined, WINDOW_POLICY() as never);
  const ctx = (r.retrievalContext ?? {}) as unknown as {
    countryCode?: string; dataMode?: string; fallbackReason?: string; evidenceState?: string;
    providers?: string[]; providerFailures?: { providerId: string; kind: string }[];
    reportingWindow?: { from?: string; to?: string } | null;
    retrievalTrace?: { lanesUnavailable?: { lane: string; reason: string }[] };
    rightsExcluded?: { count: number; reasons: Record<string, number> };
  };
  return {
    r, ctx, news, country, modelCalls,
    observed: observedRetrievalOf(r as never).retrievalOutcome,
    incomplete: retrievalIncomplete(r as never),
    research: researchRecordOf(r as never),
    windowHours: ctx.reportingWindow?.from && ctx.reportingWindow?.to
      ? Math.round((Date.parse(ctx.reportingWindow.to) - Date.parse(ctx.reportingWindow.from)) / 3_600_000)
      : null,
  };
}
const observe = (id: string, o: Awaited<ReturnType<typeof run>>, calls: Call[]) => {
  OBS[id] = {
    calls: calls.length, modelCalls: o.modelCalls.length, observed: o.observed, incomplete: o.incomplete,
    research: o.research.outcome, countryCode: o.ctx.countryCode ?? null, windowHours: o.windowHours,
    dataMode: o.ctx.dataMode ?? null, fallbackReason: o.ctx.fallbackReason ?? null, evidenceState: o.ctx.evidenceState ?? null,
    providerFailures: o.ctx.providerFailures ?? [], lanesUnavailable: o.ctx.retrievalTrace?.lanesUnavailable ?? [],
    rightsExcluded: o.ctx.rightsExcluded ?? null, analysisError: (o.r as { analysisError?: string }).analysisError ?? null,
  };
};

/* ══════════════════ the live tuple ══════════════════ */
describe('R115 · the live Alpha tuple: COD country route, 168 h window, gnews + gdelt-doc rights-skipped', () => {
  async function live() {
    __setReaderRightsFixtureModeForTests(false); /* Gate A enforced: the running-service state */
    const calls: Call[] = [];
    const gnews = stub('gnews', calls);
    const gdelt = stub('gdelt-doc', calls);
    const o = await run([gnews, gdelt], [gdelt]);
    observe('live-tuple', o, calls);
    return { o, calls };
  }

  it('reaches the COD country route with the 168 h window, and no provider is called (skip BEFORE network)', async () => {
    const { o, calls } = await live();
    expect(o.ctx.countryCode).toBe('COD');
    expect(o.windowHours).toBe(168);
    expect(calls).toEqual([]);
  });

  it('research / observed outcome is NOT_PERMITTED (never PROVIDER_FAILED), and the search stays incomplete', async () => {
    const { o } = await live();
    expect(o.research.outcome).toBe('NOT_PERMITTED');
    expect(o.observed).toBe('NOT_PERMITTED');
    expect(o.incomplete).toBe(true);
  });

  it('the refused lanes are named rights-not-cleared — never providerFailures "unavailable"', async () => {
    const { o } = await live();
    const kinds = (o.ctx.providerFailures ?? []).map((f) => f.kind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).not.toContain('unavailable');
    expect(new Set(kinds)).toEqual(new Set(['rights-not-cleared']));
    for (const lane of o.ctx.retrievalTrace?.lanesUnavailable ?? []) expect(lane.reason).toBe('rights-not-cleared');
  });

  /*
    G-1 (CTO R115), RE-EXPRESSED AS THE BACKEND FACT THE FRONTEND READS — Main's ruling: option 1, FE-only.
    The envelope of an all-refused turn KEEPS dataMode 'unavailable' + fallbackReason 'provider-error'
    (→ evidenceState 'degraded-fallback'); the frontend (Worktrees/f6f8-fe 2827cf3,
    evidenceDisplay.rightsRefusedOnly) reads research NOT_PERMITTED / every unreached lane
    rights-not-cleared with none answered and shows the R115 not-cleared sentence, never "temporarily
    unavailable". This test PINS that known backend shape, so any later backend change to it is a
    deliberate, reviewed change (the FE rule would then need re-checking), never an accident.
  */
  it('G-1 · the KNOWN envelope shape the FE reads: NOT_PERMITTED + lanes rights-not-cleared ×2 beside dataMode "unavailable" / fallback "provider-error"', async () => {
    const { o } = await live();
    expect(o.research.outcome).toBe('NOT_PERMITTED');
    expect(o.ctx.providers ?? []).toEqual([]);
    expect([...(o.ctx.retrievalTrace?.lanesUnavailable ?? [])].sort((a, b) => a.lane.localeCompare(b.lane))).toEqual([
      { lane: 'gdelt-doc', reason: 'rights-not-cleared' },
      { lane: 'gnews', reason: 'rights-not-cleared' },
    ]);
    expect(o.ctx.dataMode).toBe('unavailable');
    expect(o.ctx.fallbackReason).toBe('provider-error');
    expect(o.ctx.evidenceState).toBe('degraded-fallback');
    /* the analysis's own sentence already says "not searched", never an outage */
    expect((o.r as { analysisError?: string }).analysisError).toMatch(/^Current reporting was not searched: no news source is cleared for use here\./);
  });

  /* G-2 (CTO R115) — pre-existing at 8ec1f4a and bc13149, off the Ask path; DEFERRED by Main (recorded). */
  it.todo('G-2 · deferred, pre-existing: CountryNewsService.getCountryNews discloses acquisition.notSearched when every provider is rights-skipped');

  it('no model call, no rights-held count or publisher id inferable (W-2 / S-3 / C-1)', async () => {
    const { o } = await live();
    expect(o.modelCalls).toEqual([]);
    expect(o.ctx.rightsExcluded).toBeUndefined();
    expect(JSON.stringify(o.r)).not.toMatch(/feed:|reuters|PUBLISHER_RIGHTS_HOLD|RIGHTS_RESTRICTED|RIGHTS_PROHIBITED/i);
  });
});

/* ══════════════════ controls (CTO R115) ══════════════════ */
describe('R115 controls', () => {
  it('a PERMITTED provider\'s genuine timeout / 5xx is still PROVIDER_FAILED (never NOT_PERMITTED), each query asked once (no auto-retry)', async () => {
    __setReaderRightsFixtureModeForTests(true); /* enforcement off: both providers admitted */
    const calls: Call[] = [];
    const gnews = stub('gnews', calls, { throwKind: 'timeout' });
    const gdelt = stub('gdelt-doc', calls, { throwKind: 'unreachable' });
    const o = await run([gnews, gdelt], [gdelt]);
    observe('control-outage', o, calls);
    expect(o.observed).toBe('PROVIDER_FAILED');
    expect(o.incomplete).toBe(true);
    expect((o.ctx.providerFailures ?? []).map((f) => f.kind)).not.toContain('rights-not-cleared');
    const keys = calls.map((c) => `${c.providerId}|${c.q}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mixed partial: one permitted lane answered (empty) + one rights-skipped → partial, incomplete, the skipped lane named, never complete', async () => {
    __setReaderRightsFixtureModeForTests(false);
    const CLEARED = [{ ...FEED_SOURCES[0], sourceId: 'feed:r115-cleared', rights: { state: 'CLEARED' as const, evidence: 'TEST ONLY' } }];
    __setProviderAdmissionTestFeeds(CLEARED as never);
    __setRightsTestFeeds(CLEARED as never);
    const calls: Call[] = [];
    const gnews = stub('gnews', calls);
    const feeds = stub('rss-feeds', calls);
    const o = await run([gnews, feeds], [feeds]);
    observe('control-mixed', o, calls);
    expect(calls.map((c) => c.providerId)).not.toContain('gnews');
    expect(o.observed).not.toBe('NOT_PERMITTED');
    expect(o.observed).not.toBe('COMPLETED_NO_MATCH');
    expect(o.incomplete).toBe(true);
    expect((o.ctx.providerFailures ?? []).filter((f) => f.providerId === 'gnews').map((f) => f.kind)).toEqual(['rights-not-cleared']);
  });

  it('an already-CLEARED provider answering with a report → MATCHED, nothing marked refused', async () => {
    __setReaderRightsFixtureModeForTests(false);
    const CLEARED = [{ ...FEED_SOURCES[0], sourceId: 'feed:r115-cleared', rights: { state: 'CLEARED' as const, evidence: 'TEST ONLY' } }];
    __setProviderAdmissionTestFeeds(CLEARED as never);
    __setRightsTestFeeds(CLEARED as never);
    const calls: Call[] = [];
    const report = (): NewsArticle[] => [
      {
        id: 'r115-1', title: 'Fighting reported near Goma in eastern DRC this week', summary: 'Clashes were reported near Goma, eastern Democratic Republic of the Congo, this week.',
        url: 'https://r115-cleared.example/goma', sourceId: 'feed:r115-cleared', sourceName: 'Cleared test publisher', category: 'world', sourcesCount: 1,
        countryCode: 'COD', publishedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(), publishedAtBasis: 'publisher',
      } as unknown as NewsArticle,
    ];
    const feeds = stub('rss-feeds', calls, { items: report });
    const o = await run([feeds], [feeds]);
    observe('control-cleared', o, calls);
    expect((o.ctx.providerFailures ?? []).some((f) => f.kind === 'rights-not-cleared')).toBe(false);
    expect(o.observed).toBe('MATCHED');
  });
});
