import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  ANALYSIS_TOTAL_BUDGET_MS,
  resolveCountryByAnyIdentifier,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { routeAskR2 } from '../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { AnalysisService } from '../analysis/service/analysis.service';
import type { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../analysis/providers/mock-analysis.provider';
import { OpenAiGeneralBackgroundProvider } from '../analysis/providers/general-background.provider';
import { buildAnalysisMessages } from '../analysis/prompt/build-analysis-prompt.util';
import { WP6_PRESENTATION_RULES } from '../analysis/prompt/presentation-rules.util';
import { resolvePrimaryCountry } from '../news/country/country-relevance.util';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R7 · ANSWER PRESENTATION — PO FIELD VERDICT PRESENTATION_HOLD (GitHub #91), TEST-ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The three questions the Product Owner sent on Alpha (BE bf202a4, FE 639785e, 2026-10-13), verbatim
 * from the published CTO R7 test journeys. Observed live (codes only, Main's read-only structure read):
 *   Q1 statedPeriod none, no typed country, 6 admitted items all BI, newest 2026-10-08, MATCHED.
 *   Q2 statedPeriod none, no geography, gdelt-doc timeout, 8 items, newest 2026-10-10.
 *   Q3 REFERENCE_BACKGROUND via the separate general-background path.
 *
 * REAL: the Ask R2 router, AskR2ExecutionAdapter, AnalysisService (classification, retrieval branches,
 * gates, window enforcement, evidence admission), the article-side country resolver, the REAL analysis
 * prompt builder (`buildAnalysisMessages`, called with the very input Analysis handed its provider —
 * the same function and arguments OpenAiAnalysisProvider uses, so the captured system/user text is the
 * prompt that would have been sent), and the REAL OpenAiGeneralBackgroundProvider with `fetch` mocked
 * (the captured system prompt is the one that would have been sent; NO network, a fake key).
 * FAKED: news providers / retained store / country feed (synthetic metadata shaped like the observed
 * evidence; no publisher text), the analysis model (MockAnalysisProvider), meter, breaker, switches.
 *
 * `it` = what bf202a4 does today (characterization; a fix shows up as a deliberate change).
 * `it.failing` = the DESIRED behaviour that bf202a4 does not deliver; each names its defect id (R7-Dn).
 * No provider or model call, no DB, no network.
 */

const Q1 =
  'What are the most important verified developments in Kenya and Rwanda in the last 48 hours, especially the economy and transport? Separate the two countries. Cite publication dates and explain what you could not verify.';
const Q2 =
  'What are the most important current energy and transport developments in the European Union and the Middle East over the last 48 hours? Separate the regions and cite original sources.';
/* Q2 without its stated period: keeps a live-evidence prompt to inspect whatever the window fix does */
const Q2B =
  'What are the most important current energy and transport developments in the European Union and the Middle East? Separate the regions and cite original sources.';
const Q3 =
  'Explain the difference between a news report, an independent confirmation, and a forecast, using a hypothetical port disruption.';

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const DAY = 24;

interface Item extends NewsArticle {
  readonly about: string;
}
const item = (id: string, about: string, title: string, summary: string, h: number): Item => ({
  id,
  about,
  title,
  summary,
  url: `https://news.example/${id}`,
  sourceId: `synthetic-${about.toLowerCase()}`,
  sourceName: `Synthetic ${about} Desk`,
  category: 'world',
  sourcesCount: 1,
  publishedAt: hoursAgo(h),
  publishedAtBasis: 'publisher',
});
const tag = (a: Item): Item => {
  const p = resolvePrimaryCountry(a);
  return p === undefined ? a : { ...a, countryCode: p.countryCode, countryName: p.countryName };
};

/* Q1 corpus — shaped like the observed evidence: Burundi humanitarian/economy items 4–13 days old,
   plus Kenya and Rwanda economy/transport items that are ALSO older than 48 h, plus ONE Kenya item
   inside the window (so a correctly applied 48 h window has something legitimate to keep). */
const Q1_CORPUS: Item[] = [
  item('bi-wfp-1', 'BDI', 'WFP Burundi situation report: fuel shortages raise transport prices', 'The World Food Programme said fuel shortages in Burundi raised transport and food prices; trucks via Kenya and Rwanda were delayed.', 5 * DAY),
  item('bi-wfp-2', 'BDI', 'Burundi economy: prices climb as fuel imports slow', 'Burundi recorded higher prices as fuel imports through Rwanda slowed, the economy ministry said.', 9 * DAY),
  item('bi-au-1', 'BDI', 'African Union statement on Burundi economy and transport corridors', 'The African Union discussed Burundi transport corridors to Kenya and Rwanda and the regional economy.', 12 * DAY),
  item('ken-old-1', 'KEN', 'Kenya economy: shilling steady as transport costs ease', 'Kenya transport costs eased and the Kenyan shilling held steady, the central bank said.', 4 * DAY),
  item('rwa-old-1', 'RWA', 'Rwanda transport: Kigali bus fares revised', 'Rwanda revised Kigali bus fares as part of a transport and economy review.', 6 * DAY),
  item('ken-new-1', 'KEN', 'Kenya economy: fuel price review announced for transport operators', 'Kenya announced a fuel price review affecting transport operators and the economy.', 20),
].map(tag);

/* Q2 corpus — EU / ME energy & transport items 2–5 days old, one tangential technology item, and the
   GDELT timeout the live run recorded (gnews answered, gdelt-doc timed out). */
const Q2_CORPUS: Item[] = [
  item('eu-energy-1', 'EU', 'European Union energy ministers discuss gas storage and transport fuel', 'European Union energy ministers discussed gas storage, energy prices and transport fuel.', 3 * DAY),
  item('eu-transport-1', 'EU', 'European Union transport rules for rail freight energy use', 'New European Union transport rules address rail freight energy use.', 4 * DAY),
  item('me-energy-1', 'ME', 'Middle East energy exports and shipping transport costs', 'Middle East energy exporters reported higher shipping and transport costs.', 2.5 * DAY),
  item('tech-tangential', 'XX', 'Sequencer maker announces technology investment in energy-efficient labs', 'A sequencer maker announced a technology investment in energy-efficient laboratories and transport of samples.', 3 * DAY),
].map(tag);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length >= 4);
const STOP = new Set(['what', 'most', 'important', 'verified', 'developments', 'current', 'latest', 'last', 'hours', 'over', 'with', 'from', 'this', 'that', 'especially', 'separate', 'cite', 'publication', 'dates', 'explain', 'could', 'verify', 'regions', 'original', 'sources', 'countries', 'news']);
const matchesAny = (q: string, a: Item) => {
  const hay = new Set(tokens(`${a.title} ${a.summary}`));
  return tokens(q).some((t) => !STOP.has(t) && hay.has(t));
};
const matchesMost = (q: string, a: Item) => {
  const hay = new Set(tokens(`${a.title} ${a.summary}`));
  const want = tokens(q).filter((t) => !STOP.has(t));
  if (want.length === 0) return false;
  const hit = want.filter((t) => hay.has(t)).length;
  return hit >= Math.min(2, want.length);
};

interface Observed {
  route: { geo: string[]; statedPeriod: string | null; requirement: string | null; reportingWindow: unknown; knowledge: string | null };
  policyWindow: unknown;
  searches: string[];
  feedCountries: string[];
  evidenceIds: string[];
  evidenceCountries: string[];
  evidenceAgesHours: number[];
  rcKeys: string[];
  rcOutcome: string | null;
  observation: unknown;
  analysisError: string | null;
  coverage: unknown;
  rcWindow: unknown;
  prompt: { system: string; user: string } | null;
  promptWp6: { system: string; user: string } | null;
  background: { system: string; user: string; jobRules: string } | null;
  counts: { search: number; retained: number; feed: number; model: number; background: number; analyzeNews: number; fetch: number; interpreter: number };
  answerState: string | null;
  basis: string | null;
}

const iso3 = (code: unknown): string | undefined =>
  typeof code === 'string' && code.length > 0 ? resolveCountryByAnyIdentifier(code)?.iso3 ?? `?${code}` : undefined;
const sorted = (s: Iterable<string>) => [...new Set(s)].sort();

function harness(corpus: Item[], opts: { gdeltTimeout?: boolean } = {}) {
  const counts = { search: 0, retained: 0, feed: 0, model: 0, background: 0, analyzeNews: 0, fetch: 0, interpreter: 0 };
  const searches: string[] = [];
  const feedCountries: string[] = [];
  const base = (): NewsResponse => ({
    articles: [],
    totalResults: 0,
    providers: ['gnews'],
    dataMode: 'live',
    generatedAt: new Date(NOW).toISOString(),
    ...(opts.gdeltTimeout ? { providerFailures: [{ providerId: 'gdelt-doc', kind: 'timeout' }] } : {}),
  }) as NewsResponse;
  const live = (articles: NewsArticle[]): NewsResponse => ({ ...base(), articles: articles.map((a) => ({ ...a })), totalResults: articles.length });
  const news: Record<string, unknown> = {
    search: jest.fn(async (q: string) => {
      counts.search += 1;
      searches.push(q);
      return live(corpus.filter((a) => matchesMost(q, a)));
    }),
    topHeadlines: jest.fn(async () => live([])),
    findRetainedByQuery: jest.fn(async (q: string, terms: string[]) => {
      counts.retained += 1;
      return corpus.filter((a) => matchesAny([q, ...(terms ?? [])].join(' '), a)).map((a) => ({ ...a }));
    }),
    findRetainedHeadlines: jest.fn(async () => []),
    findRetainedByCountry: jest.fn(async () => []),
    findArticleById: jest.fn(async () => null),
    findRetainedArticleByUrl: jest.fn(async () => null),
    isFallbackTierProvider: jest.fn(() => false),
  };
  const newsProxy = new Proxy(news, { get: (t, p: string) => (p in t ? t[p] : jest.fn(async () => base())) });
  const getCountryNews = jest.fn(async (code: string) => {
    counts.feed += 1;
    feedCountries.push(code);
    const meta = resolveCountryByAnyIdentifier(code);
    const articles = corpus.filter((a) => a.about === meta?.iso3);
    return { ...live(articles), countryCode: meta?.iso2 ?? code, countryName: meta?.name ?? code, feedTier: 'delayed', providerDisplayName: 'GNews' };
  });
  const countryNews = new Proxy({ getCountryNews } as Record<string, unknown>, {
    get: (t, p: string) => (p in t ? t[p] : jest.fn(async () => base())),
  });
  const provider = new MockAnalysisProvider();
  const modelInputs: any[] = [];
  const realAnalyze = provider.analyzeNews.bind(provider);
  provider.analyzeNews = (async (input: never) => {
    counts.model += 1;
    modelInputs.push(input);
    return realAnalyze(input);
  }) as never;
  const cfg = {
    maxArticles: 8,
    maxArticleChars: 1200,
    timeoutMs: 20000,
    totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
    cacheTtlSeconds: 0,
    /* a fake, never-used key so the REAL background provider builds its request; fetch is mocked */
    openAiApiKey: 'sk-r7-offline-fixture-0000000000',
    openAiModel: 'gpt-4o-mini',
    executionMode: 'development' as const,
    retryAttempts: 0,
    retryBaseDelayMs: 300,
    maxCompletionTokens: 2000,
  };
  const config = { get: () => cfg } as unknown as AnalysisConfigService;
  const svc = new AnalysisService(newsProxy as never, countryNews as never, provider, config);
  const analyzeArgs: unknown[][] = [];
  const responses: any[] = [];
  const realSvcAnalyze = svc.analyzeNews.bind(svc);
  (svc as any).analyzeNews = async (...args: unknown[]) => {
    counts.analyzeNews += 1;
    analyzeArgs.push(args);
    const r = await (realSvcAnalyze as any)(...args);
    responses.push(r);
    return r;
  };
  const observations: any[] = [];
  const backgroundCaptured: Array<{ system: string; user: string; jobRules: string }> = [];
  const realBackground = new OpenAiGeneralBackgroundProvider(config);
  const background = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    /* The ONE bounded semantic interpretation of an ambiguous turn (adapter interpretSemantics).
       ASSUMPTION, stated: live returned a verdict that led to a CURRENT_REPORTING answer for Q1/Q2;
       the canned verdict is the schema-valid "current news" reading (job CURRENT_REPORTING, every
       clause CURRENT, no relation). It carries no geography or period — the closed IR has none. */
    completeStructured: jest.fn(async (input: { user: string }) => {
      counts.interpreter += 1;
      const line = input.user.split('\n').find((l) => l.startsWith('Clauses: ')) ?? 'Clauses: []';
      const clauses = JSON.parse(line.slice('Clauses: '.length)) as Array<{ id: number }>;
      return JSON.stringify({
        job: 'CURRENT_REPORTING',
        needsCurrentEvidence: true,
        depth: 'STANDARD',
        transformation: null,
        confidence: 'HIGH',
        clauses: clauses.map((c) => ({ id: c.id, kind: 'CURRENT' })),
        relation: null,
        reference: 'NONE',
      });
    }),
    answerBackground: jest.fn(async (input: any) => {
      counts.background += 1;
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((async (_url: unknown, init: any) => {
        counts.fetch += 1;
        const body = JSON.parse(init.body);
        backgroundCaptured.push({
          system: body.messages[0].content,
          user: body.messages[1].content,
          jobRules: String(input.jobRules ?? ''),
        });
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'Illustrative background answer.' } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as never);
      try {
        return await realBackground.answerBackground(input);
      } finally {
        fetchSpy.mockRestore();
      }
    }),
  };
  const adapter = new AskR2ExecutionAdapter(
    svc,
    { id: 'mock-analysis', displayName: 'Mock', isMock: true } as never,
    background as never,
    {
      config: { outputWeight: 4 },
      reserve: jest.fn(async () => ({ admitted: true as const, reservationId: 'r', estimatedUnits: 1 })),
      settle: jest.fn(async () => true),
    } as never,
    {
      permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' as const })),
      record: jest.fn(async () => undefined),
    } as never,
    { isEnabled: jest.fn(async () => true) } as never,
    config as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async (o: any) => { observations.push(o); return true; }) } as never,
    { boundSpecialistDomains: () => ['CONFLICT'], read: jest.fn(async () => ({ considered: [], contributions: [] })) } as never,
  );
  return { adapter, counts, searches, feedCountries, modelInputs, analyzeArgs, responses, backgroundCaptured, cfg, observations };
}

/** The exact prompt OpenAiAnalysisProvider would send for this provider input (same builder, same args). */
function promptFor(input: any, cfg: { maxArticleChars: number }, wp6: boolean): { system: string; user: string } {
  return buildAnalysisMessages(
    input.query,
    input.articles,
    cfg.maxArticleChars,
    input.relationalContext,
    input.responseLanguage,
    input.repairDirective,
    input.developmentBreadth,
    input.comparisonCoverage,
    input.evidenceState,
    input.newestEvidence,
    input.eventAnchor,
    input.eventEvidenceRelations,
    input.conversationSubject,
    input.selection,
    input.governed,
    input.reportingWindow,
    input.evidenceLinkageGuard,
    input.broadHeadlinesCoverage,
    wp6,
  );
}

function routeOf(q: string) {
  const r: any = routeAskR2(
    { originalQuestion: q, sourceLanguage: 'en', normalizationLanguage: 'en', displayLanguage: 'en', origin: 'ASK' } as never,
    { requestInstant: new Date(NOW).toISOString() } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );
  return {
    geo: (r.envelope?.geography?.candidates ?? []).map((c: { source: string; value: string }) => `${c.source}:${c.value}`),
    statedPeriod: r.envelope?.time?.statedPeriod ?? null,
    requirement: r.envelope?.time?.requirement ?? null,
    reportingWindow: r.reportingWindow ?? null,
    knowledge: r.knowledgeRequirement ?? null,
  };
}

const RESULTS: Record<string, Observed> = {};
async function ask(id: string, question: string, corpus: Item[], opts: { gdeltTimeout?: boolean } = {}): Promise<Observed> {
  const h = harness(corpus, opts);
  const request = { question, language: 'en', intent: 'ask' } as AskRequest;
  let payload: any = null;
  try {
    payload = await askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never, async () => {
      const plan = await h.adapter.prepare(request);
      return JSON.parse((await h.adapter.execute(request, plan, `op-r7-${id}`)).payloadJson);
    });
  } catch (e) {
    payload = { refused: (e as Error).message };
  }
  const policy: any = h.analyzeArgs.flat().find((a: any) => a && typeof a === 'object' && ('reportingWindow' in a || 'typedCountry' in a || 'questionAnchors' in a));
  const response = h.responses[h.responses.length - 1];
  const evidence: NewsArticle[] = response?.articles ?? [];
  const lastInput = h.modelInputs[h.modelInputs.length - 1];
  const o: Observed = {
    route: routeOf(question),
    policyWindow: policy?.reportingWindow ?? null,
    searches: h.searches,
    feedCountries: sorted(h.feedCountries.map((c) => iso3(c) ?? c)),
    evidenceIds: sorted(evidence.map((a) => a.id)),
    evidenceCountries: sorted(evidence.map((a) => iso3(a.countryCode)).filter((c): c is string => !!c)),
    evidenceAgesHours: evidence.map((a) => Math.round((NOW - Date.parse(a.publishedAt)) / 3_600_000)).sort((a, b) => a - b),
    rcKeys: Object.keys(response?.retrievalContext ?? {}).sort(),
    rcOutcome: response?.retrievalContext?.outcome ?? null,
    observation: ((ob: any) => ob && { questionClass: ob.questionClass, terminalState: ob.terminalState, answerState: ob.answerState, answerBasis: ob.answerBasis, domains: ob.domains, geographyCodes: ob.geographyCodes, scopedBy: ob.scopedBy, temporalRequirement: ob.temporalRequirement, statedPeriodPresent: ob.statedPeriodPresent, retrievalOutcome: ob.retrievalOutcome })(h.observations[h.observations.length - 1]),
    analysisError: response?.analysisError ?? null,
    coverage: (response?.retrievalContext?.comparisonCoverage ?? []).map((c: any) => ({ iso3: c.iso3, final: c.finalQualifyingEvidenceCount })),
    rcWindow: response?.retrievalContext?.reportingWindow ?? null,
    prompt: lastInput ? promptFor(lastInput, h.cfg, false) : null,
    promptWp6: lastInput ? promptFor(lastInput, h.cfg, true) : null,
    background: h.backgroundCaptured[h.backgroundCaptured.length - 1] ?? null,
    counts: h.counts,
    answerState: payload?.answer?.state ?? payload?.refused ?? null,
    basis: payload?.answer?.basis ?? null,
  };
  RESULTS[id] = o;
  return o;
}

afterAll(() => {
  const out = process.env.R7_OUT;
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    const slim = Object.fromEntries(
      Object.entries(RESULTS).map(([k, v]) => [
        k,
        {
          ...v,
          prompt: v.prompt ? { systemChars: v.prompt.system.length, userChars: v.prompt.user.length } : null,
          promptWp6: v.promptWp6 ? { systemChars: v.promptWp6.system.length, userChars: v.promptWp6.user.length } : null,
          background: v.background ? { systemChars: v.background.system.length, jobRules: v.background.jobRules } : null,
        },
      ]),
    );
    writeFileSync(out, JSON.stringify(slim, null, 1));
  }
});

/* ================================================================================== */
let q1: Observed;
let q2: Observed;
let q3: Observed;
let q2b: Observed;
beforeAll(async () => {
  q1 = await ask('q1', Q1, Q1_CORPUS);
  q2 = await ask('q2', Q2, Q2_CORPUS, { gdeltTimeout: true });
  q3 = await ask('q3', Q3, []);
  q2b = await ask('q2b', Q2B, Q2_CORPUS, { gdeltTimeout: true });
}, 120_000);

/** cost invariant: one analysis attempt, at most one answering model call, at most one interpreter call */
const bounded = (o: Observed) => {
  expect(o.counts.analyzeNews).toBeLessThanOrEqual(1);
  expect(o.counts.model + o.counts.background).toBeLessThanOrEqual(1);
  expect(o.counts.interpreter).toBeLessThanOrEqual(1);
};

describe('R7 · characterization at bf202a4 (what the live code does today)', () => {
  it('C-1 the router reads NO stated period for "in the last 48 hours" (Q1) or "over the last 48 hours" (Q2)', () => {
    expect(q1.route.statedPeriod).toBeNull();
    expect(q1.route.reportingWindow).toBeNull();
    expect(q2.route.statedPeriod).toBeNull();
    expect(q2.route.reportingWindow).toBeNull();
    expect(q2.policyWindow).toBeNull();
  });
  it('C-2 Q1 "Kenya and Rwanda": the route types ONLY Kenya (Rwanda is not in the envelope)', () => {
    expect(q1.route.geo).toEqual(['TYPED_GEOGRAPHY:KEN']);
  });
  it('C-3 Q1 offline: comparison sides searched, then the question-anchor gate empties the evidence (no model call)', () => {
    expect(q1.searches).toEqual(['Kenya', 'Rwanda', 'Kenya economy', 'Rwanda economy']);
    expect(q1.rcOutcome).toBe('NO_RELEVANT_EVIDENCE');
    expect(q1.counts.model).toBe(0);
    bounded(q1);
  });
  it('C-4 Q2 reproduces the field defect: a CURRENT_REPORTING answer built from evidence 60–96 h old, no window applied', () => {
    expect(q2.answerState).toBe('CURRENT_REPORTING');
    expect(q2.evidenceAgesHours.length).toBeGreaterThan(0);
    expect(Math.min(...q2.evidenceAgesHours)).toBeGreaterThan(48);
    expect(q2.counts.model).toBe(1);
    bounded(q2);
  });
  it('C-5 Q2B (no stated period) live evidence state: the analysis prompt carries NO newest-evidence / freshness sentence', () => {
    expect(q2b.prompt!.system).not.toMatch(/newest report in this evidence set/i);
    expect(q2b.prompt!.system).not.toMatch(/REPORTING WINDOW \(authoritative\)/);
  });
  it('C-6 WP6 OFF as on Alpha: the analysis prompt has no presentation block; the base prompt has no rule against inferring absence', () => {
    expect(q2b.prompt!.system).not.toContain('ANSWER PRESENTATION');
    expect(q2b.prompt!.system).not.toMatch(/never state that an event did not happen because no report was found/i);
  });
  it('C-7 Q2B WP6 ON (test config only): the presentation block reaches the SAME single prompt; no extra model call by construction', () => {
    expect(q2b.promptWp6!.system).toContain(WP6_PRESENTATION_RULES);
    expect(q2b.promptWp6!.system.startsWith(q2b.prompt!.system.slice(0, 2000))).toBe(true);
    expect(q2b.promptWp6!.user).toBe(q2b.prompt!.user);
    expect(q2b.counts.model).toBe(1);
  });
  it('C-8 Q3 runs the SEPARATE general-background path (one call), untouched by WP6', () => {
    expect(q3.answerState).toBe('REFERENCE_BACKGROUND');
    expect(q3.counts.background).toBe(1);
    expect(q3.counts.fetch).toBe(1);
    expect(q3.counts.analyzeNews).toBe(0);
    expect(q3.background!.system).not.toContain('ANSWER PRESENTATION');
    bounded(q3);
  });
  it('C-9 Q3 background system prompt has no rule about illustrative numbers or invented probabilities; job rules carry only the artifact memory line', () => {
    expect(q3.background!.system).not.toMatch(/illustrat|percentage|probabilit/i);
    expect(q3.background!.jobRules).toMatch(/^R4 JOB RULES \(trusted\)\n1\. MEMORY:/);
    expect(q3.background!.jobRules).not.toMatch(/\n2\./);
  });
});

describe('R7 · DESIRED behaviour (it.failing = defect present at bf202a4)', () => {
  it.failing('R7-D1 "in/over the last 48 hours" is read as a stated period and becomes a 48 h reporting window (Q1 and Q2)', () => {
    /* the envelope's statedPeriod records only CONSTRAINT periods; an honoured window rides on reportingWindow */
    expect((q1.route.reportingWindow as { statedPeriod?: string } | null)?.statedPeriod).toMatch(/48 hours/);
    expect((q1.route.reportingWindow as { hours?: number } | null)?.hours).toBe(48);
    expect((q2.route.reportingWindow as { statedPeriod?: string } | null)?.statedPeriod).toMatch(/48 hours/);
    expect((q2.route.reportingWindow as { hours?: number } | null)?.hours).toBe(48);
  });
  it.failing('R7-D1b Q2: evidence published more than 48 h before the request is not presented as the answer (excluded by the window)', () => {
    expect(q2.evidenceAgesHours.every((h) => h <= 48)).toBe(true);
  });
  it.failing('R7-D2 Q1: both named countries reach the route (KEN and RWA)', () => {
    expect(q1.route.geo).toEqual(expect.arrayContaining(['TYPED_GEOGRAPHY:KEN', 'TYPED_GEOGRAPHY:RWA']));
  });
  it.failing('R7-D3 a "current / latest" answer from live evidence tells the model how old the newest report is', () => {
    expect(q2b.prompt!.system).toMatch(/newest report in this evidence set was published at/i);
  });
  it.failing('R7-D4 the prompt Alpha actually sends forbids inferring that nothing happened from the absence of reports', () => {
    expect(q2b.prompt!.system).toMatch(/never state that an event did not happen because no report was found/i);
  });
  it.failing('R7-D5 Q3 background: illustrative numbers must be labelled illustrative; no arbitrary probability', () => {
    expect(q3.background!.system).toMatch(/illustrat/i);
    expect(q3.background!.system).toMatch(/probabilit|percentage/i);
  });
  it.failing('R7-D6 Q3 background: the compact answer contract (direct lead first, short sections, no paragraph-style numbered lists)', () => {
    expect(q3.background!.system).toMatch(/Lead with the direct answer/i);
  });
});

