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
import { resolveGeography } from '../geo/geo-resolver';
import { AnalysisService } from '../analysis/service/analysis.service';
import type { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../analysis/providers/mock-analysis.provider';
import { resolvePrimaryCountry } from '../news/country/country-relevance.util';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R4 §5 — GEOGRAPHY END TO END (Fork E, TEST-ONLY)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * REAL layers: the Ask R2 router (inside AskR2ExecutionAdapter.prepare/execute), the
 * AskR2ExecutionAdapter itself, AnalysisService (classification, detectLocation, the typed-country
 * handoff where present, GATE F, relevance/anchor gates, comparison retrieval and coverage, evidence
 * admission, prompt assembly), the shared country tables and resolvers, and the article-side
 * country resolver `resolvePrimaryCountry` (used to tag LIVE items exactly as NewsService would).
 *
 * FAKED layers (deterministic, offline): the news providers (NewsService.search / topHeadlines =
 * a keyword search over a fixed synthetic corpus), the retained store (findRetainedByQuery = a
 * term match over fixed synthetic stored rows with their STORED country), the country feed
 * (CountryNewsService.getCountryNews = the corpus items about that country; every call recorded),
 * the analysis model (MockAnalysisProvider, input captured = the MODEL CONTEXT), the background
 * model, the meter, breaker, switches, observations and specialist reads.
 *
 * Non-vacuous by construction (E1 admissibility finding on the 12/12 probe): every assertion is
 * "the FULL set of countries observed ⊆ allowed", over ALL countries — so an outsider such as TON
 * is detected wherever it appears; it is never "the expected value is among {COD, COG, …}".
 *
 * Observed per case and written to $GEO_E2E_OUT (if set) for the cross-tree comparison:
 *   routeGeo        — the route envelope's geography candidates (all sources)
 *   typedCountry    — the executionPolicy.typedCountry Ask passed to Analysis (absent before G-1)
 *   feedCountries   — every country the country feed was asked for
 *   rcCountry       — the retrieval context's established country
 *   evidenceCountries — countries of the admitted evidence (response.articles)
 *   modelCountries  — countries in the MODEL CONTEXT scope fields (articles[].countryCode,
 *                     comparisonCoverage[].iso3, any other *country* / *iso* field outside text)
 *   searches        — provider queries sent; counts of every faked call
 */

type Lang = 'en' | 'pl' | 'fr' | 'es' | 'pt' | 'rw';
const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

/* ---------------- synthetic corpus (no publisher text) ---------------- */
interface Item extends NewsArticle {
  readonly about: string;
}
const item = (id: string, about: string, title: string, summary: string, h = 2): Item => ({
  id,
  about,
  title,
  summary,
  url: `https://news.example/${id}`,
  sourceId: 'synthetic-wire',
  sourceName: 'Synthetic Wire',
  category: 'world',
  sourcesCount: 1,
  publishedAt: hoursAgo(h),
  publishedAtBasis: 'publisher',
});
const LIVE: Item[] = [
  item('live-cod-goma', 'COD', 'Fighting near Goma in eastern Democratic Republic of Congo', 'Clashes near Goma in North Kivu, Democratic Republic of Congo, displaced residents.'),
  item('live-cod-kinshasa', 'COD', 'Kinshasa officials announce new measures in the Democratic Republic of Congo', 'The government in Kinshasa, Democratic Republic of Congo, announced the measures.'),
  item('live-cog-brazza', 'COG', 'Brazzaville hosts budget talks in the Republic of the Congo', 'Officials in Brazzaville, Republic of the Congo, discussed the budget.'),
  item('live-ton-cyclone', 'TON', 'Cyclone recovery continues in Tonga', 'Residents of Tonga rebuild after the cyclone in Nukuʻalofa.'),
  item('live-pl-cod', 'COD', 'Walki w pobliżu Gomy w Demokratycznej Republice Konga', 'Mieszkańcy Gomy w Demokratycznej Republice Konga uciekają przed walkami.'),
  item('live-pl-cod-nom', 'COD', 'Demokratyczna Republika Konga: walki w pobliżu Gomy', 'Demokratyczna Republika Konga: mieszkańcy Gomy uciekają przed walkami w Kiwu Północnym.'),
  item('live-pl-ton', 'TON', 'Tonga: odbudowa po cyklonie', 'Mieszkańcy Tonga odbudowują domy po cyklonie.'),
  item('live-pol', 'POL', 'Polska: rząd ogłasza nowy budżet', 'Rząd w Warszawie przedstawił budżet Polski.'),
  item('live-ken-1', 'KEN', 'Kenya economy: inflation eases', 'Kenya inflation slowed as the Kenyan shilling held steady.'),
  item('live-ken-2', 'KEN', 'Kenya economy: central bank holds rates', 'The Central Bank of Kenya held its policy rate.'),
  item('live-ken-3', 'KEN', 'Kenya economy: exports rise', 'Kenya tea and horticulture exports rose this quarter.'),
  item('live-rwa-1', 'RWA', 'Rwanda economy: GDP grows', 'Rwanda GDP grew strongly, the statistics institute of Rwanda reported.'),
].map((a) => {
  /* LIVE items are tagged exactly as NewsService.resolveArticleCountries would tag them on this tree */
  const p = resolvePrimaryCountry(a);
  return p === undefined ? a : { ...a, countryCode: p.countryCode, countryName: p.countryName };
});
/* RETAINED rows carry their STORED country (what the store holds), not a re-derivation */
const RETAINED: Item[] = [
  { ...item('ret-cog-brazza', 'COG', 'Republic of the Congo budget talks in Brazzaville', 'Brazzaville officials in the Republic of the Congo met on the budget.', 30), countryCode: 'CG', countryName: 'Congo' },
];

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length >= 4);
const STOP = new Set(['what', 'latest', 'developments', 'happening', 'news', 'jakie', 'najnowsze', 'wydarzenia', 'with', 'from', 'this', 'that', 'compare', 'economic', 'quelles', 'sont', 'dernieres', 'nouvelles', 'esta', 'pasando', 'quais', 'ultimas', 'noticias', 'amakuru', 'mashya']);
/* LIVE providers (GNews / GDELT) match ALL query words; the RETAINED read matches ANY term
   (article-persistence.service.ts findRecent: "OR, not AND, and that is deliberate"). */
const matchesAll = (q: string, a: Item) => {
  const hay = new Set(tokens(`${a.title} ${a.summary}`));
  const want = tokens(q).filter((t) => !STOP.has(t));
  return want.length > 0 && want.every((t) => hay.has(t));
};
const matchesAny = (q: string, a: Item) => {
  const hay = new Set(tokens(`${a.title} ${a.summary}`));
  return tokens(q).some((t) => !STOP.has(t) && hay.has(t));
};

/* ---------------- harness ---------------- */
interface Observed {
  routeGeo: string[];
  typedCountry: string | null;
  feedCountries: string[];
  rcCountry: string | null;
  evidenceIds: string[];
  evidenceCountries: string[];
  modelCountries: string[];
  modelEvidenceIds: string[];
  searches: string[];
  coverage: Array<{ iso3: string; final: number }>;
  counts: { search: number; topHeadlines: number; retained: number; feed: number; model: number; background: number; analyzeNews: number };
  answerState: string | null;
  basis: string | null;
}
const iso3 = (code: unknown): string | undefined =>
  typeof code === 'string' && code.length > 0 ? resolveCountryByAnyIdentifier(code)?.iso3 ?? `?${code}` : undefined;
const TEXT_KEYS = new Set(['title', 'summary', 'query', 'content', 'text', 'excerpt', 'claim', 'headline', 'url', 'sourceName', 'id', 'evidenceId']);
function scopeCountries(node: unknown, out: Set<string>, key = ''): void {
  if (Array.isArray(node)) return node.forEach((v) => scopeCountries(v, out, key));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) if (!TEXT_KEYS.has(k)) scopeCountries(v, out, k);
    return;
  }
  if (typeof node === 'string' && /country|iso/i.test(key) && !/name/i.test(key)) {
    const c = iso3(node);
    if (c) out.add(c);
  }
}
const sorted = (s: Iterable<string>) => [...new Set(s)].sort();

function harness() {
  const counts = { search: 0, topHeadlines: 0, retained: 0, feed: 0, model: 0, background: 0, analyzeNews: 0 };
  const searches: string[] = [];
  const feedCountries: string[] = [];
  const empty = (): NewsResponse => ({ articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() });
  const live = (articles: NewsArticle[]): NewsResponse => ({ ...empty(), articles: articles.map((a) => ({ ...a })), totalResults: articles.length });
  const news: Record<string, unknown> = {
    search: jest.fn(async (q: string) => {
      counts.search += 1;
      searches.push(q);
      return live(LIVE.filter((a) => matchesAll(q, a)));
    }),
    topHeadlines: jest.fn(async () => {
      counts.topHeadlines += 1;
      return empty();
    }),
    findRetainedByQuery: jest.fn(async (q: string, terms: string[]) => {
      counts.retained += 1;
      return RETAINED.filter((a) => matchesAny([q, ...(terms ?? [])].join(' '), a)).map((a) => ({ ...a }));
    }),
    findRetainedHeadlines: jest.fn(async () => []),
    findRetainedByCountry: jest.fn(async () => []),
    findArticleById: jest.fn(async () => null),
    findRetainedArticleByUrl: jest.fn(async () => null),
    isFallbackTierProvider: jest.fn(() => false),
  };
  const newsProxy = new Proxy(news, {
    get: (t, p: string) => (p in t ? t[p] : jest.fn(async () => empty())),
  });
  const getCountryNews = jest.fn(async (code: string) => {
    counts.feed += 1;
    feedCountries.push(code);
    const articles = LIVE.filter((a) => a.about === code);
    const meta = resolveCountryByAnyIdentifier(code);
    return { ...live(articles), countryCode: meta?.iso2 ?? code, countryName: meta?.name ?? code, feedTier: 'delayed', providerDisplayName: 'GNews' };
  });
  const countryNews = new Proxy({ getCountryNews } as Record<string, unknown>, {
    get: (t, p: string) => (p in t ? t[p] : jest.fn(async () => empty())),
  });
  const provider = new MockAnalysisProvider();
  const modelInputs: unknown[] = [];
  const realAnalyze = provider.analyzeNews.bind(provider);
  provider.analyzeNews = (async (input: never) => {
    counts.model += 1;
    modelInputs.push(input);
    return realAnalyze(input);
  }) as never;
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
  const background = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    answerBackground: jest.fn(async (input: { usageSink?: (u: unknown) => void }) => {
      counts.background += 1;
      input.usageSink?.({ promptTokens: 10, completionTokens: 10 });
      return { text: 'Background.\n\nGeneral guidance.' };
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
    { record: jest.fn(async () => true) } as never,
    { boundSpecialistDomains: () => ['CONFLICT'], read: jest.fn(async () => ({ considered: [], contributions: [] })) } as never,
  );
  return { adapter, counts, searches, feedCountries, modelInputs, analyzeArgs, responses };
}

const routeGeoOf = (q: string, lang: Lang): string[] => {
  try {
    const r: any = routeAskR2(
      { originalQuestion: q, sourceLanguage: lang, normalizationLanguage: lang, displayLanguage: lang, origin: 'ASK' } as never,
      { requestInstant: new Date(NOW).toISOString() } as never,
      { specialistRegistry: specialistRegistryFixture } as never,
    );
    return r.envelope.geography.candidates.map((c: { source: string; value: string }) => `${c.source}:${c.value}`);
  } catch (e) {
    return [`<route error ${(e as Error).name}>`];
  }
};

const RESULTS: Record<string, Observed> = {};
async function ask(id: string, question: string, language: Lang): Promise<Observed> {
  const h = harness();
  const request = { question, language, intent: 'ask' } as AskRequest;
  let payload: any = null;
  try {
    payload = await askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never, async () => {
      const plan = await h.adapter.prepare(request);
      return JSON.parse((await h.adapter.execute(request, plan, `op-geo-e2e-${id}`)).payloadJson);
    });
  } catch (e) {
    payload = { refused: (e as Error).message };
  }
  const policy = h.analyzeArgs
    .flat()
    .find((a): a is { typedCountry?: string } => !!a && typeof a === 'object' && 'typedCountry' in (a as object));
  const response = h.responses[h.responses.length - 1];
  const evidence: NewsArticle[] = response?.articles ?? [];
  const modelCountries = new Set<string>();
  const modelEvidenceIds = new Set<string>();
  for (const input of h.modelInputs) {
    scopeCountries(input, modelCountries);
    for (const a of (input as { articles?: NewsArticle[] }).articles ?? []) modelEvidenceIds.add(a.id);
  }
  const coverageSrc: any[] =
    (h.modelInputs[h.modelInputs.length - 1] as any)?.comparisonCoverage ?? response?.retrievalContext?.comparisonCoverage ?? [];
  const o: Observed = {
    routeGeo: routeGeoOf(question, language),
    typedCountry: policy?.typedCountry ?? null,
    feedCountries: sorted(h.feedCountries.map((c) => iso3(c) ?? c)),
    rcCountry: iso3(response?.retrievalContext?.countryCode) ?? null,
    evidenceIds: sorted(evidence.map((a) => a.id)),
    evidenceCountries: sorted(evidence.map((a) => iso3(a.countryCode)).filter((c): c is string => !!c)),
    modelCountries: sorted(modelCountries),
    modelEvidenceIds: sorted(modelEvidenceIds),
    searches: h.searches,
    coverage: coverageSrc.map((c) => ({ iso3: c.iso3, final: c.finalQualifyingEvidenceCount })),
    counts: h.counts,
    answerState: payload?.answer?.state ?? payload?.refused ?? null,
    basis: payload?.answer?.basis ?? null,
  };
  RESULTS[id] = o;
  return o;
}
/** Every country this turn put into retrieval scope or model context (the non-vacuous universe). */
const allScope = (o: Observed) =>
  sorted([
    ...o.feedCountries,
    ...(o.typedCountry ? [o.typedCountry] : []),
    ...(o.rcCountry ? [o.rcCountry] : []),
    ...o.evidenceCountries,
    ...o.modelCountries,
    ...o.coverage.map((c) => c.iso3),
  ]);
const outside = (set: string[], allowed: string[]) => set.filter((c) => !allowed.includes(c));
const routeCountries = (o: Observed) => sorted(o.routeGeo.map((g) => g.split(':')[1]).filter(Boolean));
/** cost invariant for every case: at most one analysis call, one model call, one background call */
const bounded = (o: Observed) => {
  expect(o.counts.analyzeNews).toBeLessThanOrEqual(1);
  expect(o.counts.model).toBeLessThanOrEqual(1);
  expect(o.counts.background).toBeLessThanOrEqual(1);
  expect(o.counts.model + o.counts.background).toBeLessThanOrEqual(1);
};

afterAll(() => {
  const out = process.env.GEO_E2E_OUT;
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(RESULTS, null, 1));
  }
});

/* ================================================================================== */
describe('E2E-1 · EN D0.1 drafts: the chosen Congo end to end', () => {
  it('E2E-1a "Congo - Kinshasa" → route COD; nothing outside COD in retrieval scope or model context', async () => {
    const o = await ask('1a-en-kinshasa', 'What are the latest developments in Congo - Kinshasa?', 'en');
    expect(routeCountries(o)).toEqual(['COD']);
    expect(outside(allScope(o), ['COD'])).toEqual([]);
    expect(o.evidenceIds).not.toContain('live-cog-brazza');
    expect(o.evidenceIds).not.toContain('ret-cog-brazza');
    bounded(o);
  });
  it('E2E-1b "Congo - Brazzaville" → route COG; nothing outside COG', async () => {
    const o = await ask('1b-en-brazzaville', 'What are the latest developments in Congo - Brazzaville?', 'en');
    expect(routeCountries(o)).toEqual(['COG']);
    expect(outside(allScope(o), ['COG'])).toEqual([]);
    expect(o.evidenceIds).not.toContain('live-cod-goma');
    bounded(o);
  });
});

describe('E2E-2/3 · PL drafts: safe from the wrong country (demonstrated, not country-grounded)', () => {
  it('E2E-2 PL "Demokratyczna Republika Konga: …" → route COD; Analysis types NOTHING, no country feed; no TON or COG anywhere', async () => {
    const o = await ask('2-pl-drc', 'Demokratyczna Republika Konga: jakie są najnowsze wydarzenia?', 'pl');
    expect(routeCountries(o)).toEqual(['COD']);
    expect(o.typedCountry === null || o.typedCountry === 'COD').toBe(true);
    expect(o.feedCountries).toEqual([]); // ordinary search, not a country feed
    expect(o.rcCountry).toBeNull();
    expect(outside(allScope(o), ['COD'])).toEqual([]); // TON / COG never appear anywhere
    bounded(o);
  });
  it('E2E-2b non-vacuity: the PL draft\'s ordinary search DOES reach the model with Polish DR Congo reporting, and nothing outside COD reaches it', async () => {
    const o = await ask('2b-pl-drc-evidence', 'Demokratyczna Republika Konga: jakie są najnowsze wydarzenia?', 'pl');
    expect(o.feedCountries).toEqual([]);
    expect(o.evidenceIds).toContain('live-pl-cod-nom');
    expect(o.counts.model).toBe(1);
    expect(o.evidenceIds).not.toContain('live-pl-ton');
    expect(o.evidenceIds).not.toContain('live-ton-cyclone');
    expect(o.evidenceIds).not.toContain('live-cog-brazza');
    expect(outside(allScope(o), ['COD'])).toEqual([]);
    bounded(o);
  });
  it('E2E-3a PL bare "Kongo: …" → no route country; no feed; never COG or TON in scope', async () => {
    const o = await ask('3a-pl-kongo', 'Kongo: jakie są najnowsze wydarzenia?', 'pl');
    expect(routeCountries(o)).toEqual([]);
    expect(o.typedCountry).toBeNull();
    expect(o.feedCountries).toEqual([]);
    expect(outside(allScope(o), [])).toEqual([]);
    bounded(o);
  });
  it('E2E-3b PL "Polska: …" → route POL; nothing outside POL', async () => {
    const o = await ask('3b-pl-polska', 'Polska: jakie są najnowsze wydarzenia?', 'pl');
    expect(routeCountries(o)).toEqual(['POL']);
    expect(outside(allScope(o), ['POL'])).toEqual([]);
    bounded(o);
  });
});

describe('E2E-4 · Kenya–Rwanda comparison', () => {
  it('E2E-4a EN: both sides in the route; each side searched WITH the subject; coverage never credits Kenya reports to Rwanda', async () => {
    const o = await ask('4a-en-ken-rwa', 'Compare the latest economic news from Kenya and Rwanda.', 'en');
    expect(routeCountries(o)).toEqual(['KEN', 'RWA']);
    expect(outside(allScope(o), ['KEN', 'RWA'])).toEqual([]);
    expect(o.searches.some((q) => /rwanda/i.test(q) && /econom/i.test(q))).toBe(true);
    expect(o.searches.some((q) => /kenya/i.test(q) && /econom/i.test(q))).toBe(true);
    const rwaEvidence = o.evidenceIds.filter((id) => id.startsWith('live-rwa')).length;
    const rwa = o.coverage.find((c) => c.iso3 === 'RWA');
    expect(rwa).toBeDefined();
    expect(rwa!.final).toBe(rwaEvidence);
    const ken = o.coverage.find((c) => c.iso3 === 'KEN');
    expect(ken!.final).toBe(o.evidenceIds.filter((id) => id.startsWith('live-ken')).length);
    bounded(o);
  });
  it('E2E-4b PL comparison: recorded as the router reads it; never a third country', async () => {
    const o = await ask('4b-pl-ken-rwa', 'Porównaj najnowsze wiadomości gospodarcze z Kenii i Rwandy.', 'pl');
    expect(outside(allScope(o), ['KEN', 'RWA'])).toEqual([]);
    bounded(o);
  });
});

describe('E2E-5 · multilingual negatives and controls', () => {
  it.each<[string, string, Lang, string[]]>([
    ['5a-fr-rdc', 'Quelles sont les dernières nouvelles en RDC ?', 'fr', ['COD']],
    ['5b-fr-roc', 'Quelles sont les dernières nouvelles en République du Congo ?', 'fr', ['COG']],
    ['5c-es-rdc', '¿Qué está pasando en la República Democrática del Congo?', 'es', ['COD']],
    ['5d-pt-rdc', 'Quais são as últimas notícias da República Democrática do Congo?', 'pt', ['COD']],
    ['5e-pt-roc', 'Quais são as últimas notícias da República do Congo?', 'pt', ['COG']],
    ['5f-rw-rdc', 'Amakuru mashya muri RDC?', 'rw', ['COD']],
    ['5g-rw-kongo', 'Amakuru mashya muri Kongo?', 'rw', []],
  ])('%s · Analysis scope and model context stay inside the named Congo (D-29: the ES ROUTE may still say COG; Analysis must not retrieve it)', async (id, q, lang, allowed) => {
    const o = await ask(id, q, lang);
    const analysisScope = sorted([...o.feedCountries, ...(o.typedCountry ? [o.typedCountry] : []), ...(o.rcCountry ? [o.rcCountry] : []), ...o.evidenceCountries, ...o.modelCountries]);
    expect(outside(analysisScope, allowed)).toEqual([]);
    bounded(o);
  });
  it('5h Tonga positive control: "What is happening in Tonga?" → TON reaches retrieval; nothing else', async () => {
    const o = await ask('5h-en-tonga', 'What is happening in Tonga?', 'en');
    expect(routeCountries(o)).toEqual(['TON']);
    expect(allScope(o)).toContain('TON');
    expect(outside(allScope(o), ['TON'])).toEqual([]);
    bounded(o);
  });
  it.each(['Pinga', 'Remeka', 'Burora'])('5i "%s" → no country anywhere (no city addition, no typo snap)', async (place) => {
    const o = await ask(`5i-${place}`, `What happened in ${place}?`, 'en');
    expect(routeCountries(o)).toEqual([]);
    expect(outside(allScope(o), [])).toEqual([]);
    expect((resolveGeography(place) as any).place).toBeUndefined();
    bounded(o);
  });
});

describe('E2E-6 · D-21 / P0-4 restrictions preserved', () => {
  /* pinned existing tests: ask-router/semantic-ir/p0-drc-geography.spec.ts "a bare \"Congo\" with no
     qualifier is still ambiguous"; ea-geo-r1.acceptance.spec.ts B-05 (bare Congo fails closed). */
  it('E2E-6a bare "Congo" (GATE F) → no route country, no typed country, no feed', async () => {
    const o = await ask('6a-en-bare-congo', 'What is the latest news from Congo?', 'en');
    expect(routeCountries(o)).toEqual([]);
    expect(o.typedCountry).toBeNull();
    expect(o.feedCountries).toEqual([]);
    expect(o.rcCountry).toBeNull();
    bounded(o);
  });
  it('E2E-6b non-Congo router controls (recorded for the cross-tree P0-4 comparison)', async () => {
    for (const [id, q] of [
      ['6b-kenya', 'What is happening in Kenya?'],
      ['6b-kigali', 'What is happening in Kigali?'],
      ['6b-world', 'What is the latest world news?'],
    ]) {
      const o = await ask(id, q, 'en');
      bounded(o);
    }
    expect(RESULTS['6b-kenya'].routeGeo.join()).toContain('KEN');
  });
});

describe('E2E-7 · persisted and live evidence', () => {
  /* DEFECT GEO-E2E-D1 (found by this spec at baa9167): a COD-typed question with a gated subject runs
     the anchored supplement ("DR Congo economy"); its retained read matches ANY term ("congo") and the
     admission gate does not check the typed country, so a stored-CG Brazzaville row reaches the
     evidence and the model context of a COD question. it.failing until a scoped fix; never weakened. */
  it('E2E-7a [GEO-E2E-D1 FIXED] the retained (stored CG) Brazzaville row is admitted only for a COG question', async () => {
    const cog = await ask('7a-cog-retained', 'What are the latest developments in Congo - Brazzaville budget talks?', 'en');
    const cod = await ask('7a-cod-retained', 'What are the latest developments in Congo - Kinshasa budget talks?', 'en');
    expect(cod.evidenceIds).not.toContain('ret-cog-brazza');
    expect(cod.modelEvidenceIds).not.toContain('ret-cog-brazza');
    expect(outside(allScope(cod), ['COD'])).toEqual([]);
    expect(outside(allScope(cog), ['COG'])).toEqual([]);
  });
  it('E2E-7b a live Goma item is admitted for a COD question, never for a COG question', async () => {
    const cod = await ask('7b-cod', 'What is happening near Goma in Congo - Kinshasa?', 'en');
    const cog = await ask('7b-cog', 'What are the latest developments in Congo - Brazzaville?', 'en');
    expect(cod.evidenceIds).toContain('live-cod-goma');
    expect(outside(allScope(cod), ['COD'])).toEqual([]);
    expect(cog.evidenceIds).not.toContain('live-cod-goma');
    expect(cog.modelEvidenceIds).not.toContain('live-cod-goma');
    expect(outside(allScope(cog), ['COG'])).toEqual([]);
  });
  it('E2E-7c OBSERVATION ONLY (contradictory question naming Goma AND "Congo - Brazzaville"): recorded, not asserted', async () => {
    const o = await ask('7c-goma-and-brazzaville', 'What is happening near Goma in Congo - Brazzaville?', 'en');
    bounded(o);
  });
});
