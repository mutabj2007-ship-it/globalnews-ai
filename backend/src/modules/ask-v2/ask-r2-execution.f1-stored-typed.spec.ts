import { ANALYSIS_TOTAL_BUDGET_MS, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from '../analysis/service/analysis.service';
import type { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../analysis/providers/mock-analysis.provider';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { NO_CURRENT_FINDINGS_RULE, RIGHTS_WITHHELD_RULE, SOURCES_UNAVAILABLE_RULE } from './job-execution';

/**
 * MASTER CTO R4 · P0 #86 follow-up / #87 F-1 — STORED-ONLY AND TYPED-COUNTRY HELD RESULTS.
 *
 * Reuters-host rows reach Analysis from the retained store (NewsService retained reads opt in with
 * `retainPublisherRightsHeld`) and from the typed-country feed (CountryNewsService keeps them; its
 * reader edge strips them). Analysis's ONE rights point withholds them and counts them
 * (rightsExcluded.PUBLISHER_RIGHTS_HOLD), so a held-only stored or typed-feed result selects the
 * RIGHTS_WITHHELD rule exactly like the live case — never a completed no-match.
 *
 * REAL AnalysisService (stub news + country feed, mock analysis provider) feeding the REAL Ask
 * executor (fake background provider). Offline; synthetic text only.
 */
const NOW = Date.now();
const KENYA_TITLE = 'Kenya central bank holds interest rate as inflation eases in Nairobi';
const art = (id: string, url: string, sourceId: string, title = KENYA_TITLE): NewsArticle => ({
  id,
  title,
  summary: 'Kenya central bank officials in Nairobi said inflation eased; Kenya interest rate unchanged.',
  url,
  sourceId,
  sourceName: 'Synthetic',
  category: 'business',
  sourcesCount: 1,
  publishedAt: new Date(NOW - 3_600_000).toISOString(),
  publishedAtBasis: 'publisher',
});
const HELD = [
  art('gnews-r1', 'https://www.reuters.com/markets/synthetic-kenya-1/', 'reuters'),
  art('gnews-r2', 'https://www.reuters.com/world/africa/synthetic-kenya-2/', 'reuters'),
];
const BENIGN = [art('gnews-b1', 'https://www.bbc.com/news/synthetic-kenya-3', 'bbc')];

type Shape = {
  /** the live/retained search response */
  search: { articles: NewsArticle[]; dataMode: 'live' | 'cached'; providers: string[]; fallbackReason?: string };
  /** the typed-country feed response */
  country: NewsArticle[];
};

function harness(shape: Shape) {
  const response = (): NewsResponse => ({
    articles: shape.search.articles.map((a) => ({ ...a })),
    totalResults: shape.search.articles.length,
    providers: shape.search.providers,
    dataMode: shape.search.dataMode,
    ...(shape.search.fallbackReason === undefined ? {} : { fallbackReason: shape.search.fallbackReason as never }),
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
  const getCountryNews = jest.fn(async (iso3: string) => ({
    articles: shape.country.map((a) => ({ ...a })),
    totalResults: shape.country.length,
    providers: ['gnews'],
    dataMode: 'live',
    countryCode: iso3,
    countryName: iso3,
    feedTier: 'delayed',
    providerDisplayName: 'GNews',
    generatedAt: new Date().toISOString(),
  }));
  const provider = new MockAnalysisProvider();
  const model = jest.spyOn(provider, 'analyzeNews');
  const config = {
    get: () => ({
      maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0,
      openAiApiKey: undefined, rightsAudience: 'TEST_FIXTURE' as const, openAiModel: 'gpt-4o-mini', executionMode: 'development' as const, retryAttempts: 2,
      retryBaseDelayMs: 300, maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const analysis = new AnalysisService(news as never, { getCountryNews } as never, provider, config);
  const analysisResults: Array<{ retrievalContext?: { rightsExcluded?: { reasons?: Record<string, number> } } }> = [];

  const backgroundCalls: Array<{ jobRules?: string }> = [];
  const observations: Array<Record<string, unknown>> = [];
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        const r = await (analysis.analyzeNews as (...a: unknown[]) => Promise<unknown>)(...args);
        analysisResults.push(r as never);
        return r;
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    {
      id: 'openai', displayName: 'OpenAI', isMock: false,
      answerBackground: jest.fn(async (input: { jobRules?: string; usageSink?: (u: unknown) => void }) => {
        backgroundCalls.push(input);
        input.usageSink?.({ promptTokens: 400, completionTokens: 150 });
        return { text: 'Background.\n\nGeneral guidance follows.' };
      }),
    } as never,
    {
      config: { outputWeight: 4 },
      reserve: jest.fn(async () => ({ admitted: true as const, reservationId: 'r', estimatedUnits: 1 })),
      settle: jest.fn(async () => true),
    } as never,
    { permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' as const })), record: jest.fn(async () => undefined) } as never,
    { isEnabled: jest.fn(async () => true) } as never,
    { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async (o: Record<string, unknown>) => { observations.push(o); return true; }) } as never,
    { boundSpecialistDomains: () => ['CONFLICT'], read: jest.fn(async () => ({ considered: [], contributions: [] })) } as never,
  );
  const calls = () => ({
    providerish:
      news.search.mock.calls.length + news.topHeadlines.mock.calls.length + getCountryNews.mock.calls.length +
      news.findRetainedByQuery.mock.calls.length + news.findRetainedByCountry.mock.calls.length + news.findRetainedHeadlines.mock.calls.length,
    model: model.mock.calls.length,
    background: backgroundCalls.length,
  });
  return { adapter, backgroundCalls, observations, analysisResults, calls };
}

async function ask(shape: Shape, question: string) {
  const h = harness(shape);
  const request = { question, language: 'en', intent: 'ask' } as AskRequest;
  const payload = await askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never, async () => {
    const plan = await h.adapter.prepare(request);
    return JSON.parse((await h.adapter.execute(request, plan, 'op-f1-stored')).payloadJson) as {
      answer: { state: string; basis?: string };
      artifact?: { noEvidenceReason?: string };
    };
  });
  return { ...h, payload, observation: h.observations[h.observations.length - 1] ?? {} };
}

const rulesOf = (calls: Array<{ jobRules?: string }>) => calls.map((c) => String(c.jobRules ?? ''));
const GENERIC_Q = 'What is the latest on the Kenya central bank interest rate decision?';
const TYPED_Q = 'What are the latest developments in Kenya?';
/* a typed-country question whose explanatory part reaches the background model (mixed reference/current) */
const TYPED_GUIDANCE_Q = 'What are the latest developments in Kenya and what do they mean for investors?';

/* the retained store answered (live sources answered empty), every relevant row Reuters-host */
const RETAINED_ALL_HELD: Shape = { search: { articles: HELD, dataMode: 'cached', providers: [], fallbackReason: 'no-live-results' }, country: [] };
/* the same, but the live sources FAILED: the search did not complete (precedence → unavailable) */
const RETAINED_ALL_HELD_PROVIDERS_FAILED: Shape = { search: { articles: HELD, dataMode: 'cached', providers: [], fallbackReason: 'provider-error' }, country: [] };
const RETAINED_HELD_PLUS_ADMITTED: Shape = { search: { articles: [...HELD, ...BENIGN], dataMode: 'cached', providers: [], fallbackReason: 'no-live-results' }, country: [] };
const STORED_NO_MATCH: Shape = { search: { articles: [], dataMode: 'cached', providers: [], fallbackReason: 'no-live-results' }, country: [] };
const TYPED_ALL_HELD: Shape = { search: { articles: [], dataMode: 'live', providers: ['gnews'] }, country: HELD };
const TYPED_NO_MATCH: Shape = { search: { articles: [], dataMode: 'live', providers: ['gnews'] }, country: [] };

describe('#86 follow-up / #87 F-1 · stored-only and typed-country held results (real Analysis → real executor)', () => {
  it('retained-only, all held → Analysis counts PUBLISHER_RIGHTS_HOLD and the executor selects REPORTING WITHHELD', async () => {
    const t = await ask(RETAINED_ALL_HELD, GENERIC_Q);
    expect(t.analysisResults[0]?.retrievalContext?.rightsExcluded?.reasons?.PUBLISHER_RIGHTS_HOLD).toBe(2);
    expect(t.backgroundCalls).toHaveLength(1);
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(RIGHTS_WITHHELD_RULE);
      expect(r).not.toContain(NO_CURRENT_FINDINGS_RULE);
    }
    expect(t.observation.retrievalOutcome).toBe('RIGHTS_WITHHELD');
    expect(t.payload.artifact?.noEvidenceReason).toBe('RIGHTS_WITHHELD');
  });

  it('typed-country feed, all held (no-evidence answer path) → counted, recorded RIGHTS_WITHHELD, memory never "no qualifying reporting"', async () => {
    const t = await ask(TYPED_ALL_HELD, TYPED_Q);
    expect(t.analysisResults[0]?.retrievalContext?.rightsExcluded?.reasons?.PUBLISHER_RIGHTS_HOLD).toBe(2);
    /* this question shape answers with the executor's no-evidence answer (no background call), exactly as
       its no-match control does — so no rule is chosen; the stored facts must still say "withheld" */
    expect(t.backgroundCalls).toHaveLength(0);
    expect(t.observation.retrievalOutcome).toBe('RIGHTS_WITHHELD');
    expect(t.payload.artifact?.noEvidenceReason).toBe('RIGHTS_WITHHELD');
    expect(JSON.stringify(t.payload.artifact ?? {})).not.toContain('No qualifying reporting');
    const control = await ask(TYPED_NO_MATCH, TYPED_Q);
    expect(control.backgroundCalls).toHaveLength(0);
    expect(control.payload.artifact?.noEvidenceReason).toBe('NO_QUALIFYING_REPORTING');
  });

  it('typed-country feed, all held (background path) → REPORTING WITHHELD (never "no findings")', async () => {
    const t = await ask(TYPED_ALL_HELD, TYPED_GUIDANCE_Q);
    expect(t.analysisResults[0]?.retrievalContext?.rightsExcluded?.reasons?.PUBLISHER_RIGHTS_HOLD).toBe(2);
    expect(t.backgroundCalls).toHaveLength(1);
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(RIGHTS_WITHHELD_RULE);
      expect(r).not.toContain(NO_CURRENT_FINDINGS_RULE);
    }
    /* control: the same question with a genuinely empty typed feed keeps NO CURRENT FINDINGS */
    const control = await ask(TYPED_NO_MATCH, TYPED_GUIDANCE_Q);
    for (const r of rulesOf(control.backgroundCalls)) expect(r).toContain(NO_CURRENT_FINDINGS_RULE);
    expect(control.backgroundCalls).toHaveLength(1);
  });

  it('retained held plus admitted evidence → an ordinary sourced answer (no background call, held never in evidence)', async () => {
    const t = await ask(RETAINED_HELD_PLUS_ADMITTED, GENERIC_Q);
    expect(t.backgroundCalls).toHaveLength(0);
    expect(t.payload.answer.basis ?? '').not.toMatch(/^PARTIAL_CURRENT_/);
    expect(JSON.stringify(t.payload)).not.toContain('reuters.com');
    expect(t.analysisResults[0]?.retrievalContext?.rightsExcluded?.reasons?.PUBLISHER_RIGHTS_HOLD).toBe(2);
  });

  it('control: a genuine stored no-match stays NO CURRENT FINDINGS', async () => {
    const t = await ask(STORED_NO_MATCH, GENERIC_Q);
    expect(t.analysisResults[0]?.retrievalContext?.rightsExcluded).toBeUndefined();
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(NO_CURRENT_FINDINGS_RULE);
      expect(r).not.toContain(RIGHTS_WITHHELD_RULE);
    }
  });

  it('PRECEDENCE: retained-only held while the live sources failed → SOURCES UNAVAILABLE (the search did not complete)', async () => {
    const t = await ask(RETAINED_ALL_HELD_PROVIDERS_FAILED, GENERIC_Q);
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(SOURCES_UNAVAILABLE_RULE);
      expect(r).not.toContain(RIGHTS_WITHHELD_RULE);
    }
  });

  it('COST: a held-only result makes NO analysis-model call and the same retrieval calls as its no-match control', async () => {
    for (const [held, control, q] of [
      [RETAINED_ALL_HELD, STORED_NO_MATCH, GENERIC_Q],
      [TYPED_ALL_HELD, TYPED_NO_MATCH, TYPED_Q],
      [TYPED_ALL_HELD, TYPED_NO_MATCH, TYPED_GUIDANCE_Q],
    ] as const) {
      const a = await ask(held, q);
      const b = await ask(control, q);
      expect(a.calls().model).toBe(0);
      expect(a.calls().providerish).toBe(b.calls().providerish);
      expect(a.calls().background).toBe(b.calls().background);
      expect(a.observation.providerCallCount).toBe(b.observation.providerCallCount);
      expect(a.observation.modelInvocationCount).toBe(b.observation.modelInvocationCount);
    }
  });
});
