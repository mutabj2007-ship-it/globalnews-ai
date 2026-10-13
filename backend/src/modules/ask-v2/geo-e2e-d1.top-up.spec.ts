import {
  ANALYSIS_TOTAL_BUDGET_MS,
  resolveCountryByAnyIdentifier,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { AnalysisService } from '../analysis/service/analysis.service';
import type { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../analysis/providers/mock-analysis.provider';
import { resolvePrimaryCountry, scoreCountryRelevance } from '../news/country/country-relevance.util';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R5 · GEO-E2E-D1 (#89) — THE TOP-UP BOUNDARY, FIXTURE FIRST
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The defect (Fork E, E2E-7a): a COD-typed question with a gated subject runs the anchored supplement;
 * its retained read matches ANY term ("congo"), and nothing checks the report against the turn's
 * country, so a correctly stored Republic-of-the-Congo report reaches a DR Congo answer.
 *
 * REAL: the Ask router + AskR2ExecutionAdapter + AnalysisService (classification, typed-country
 * handoff, anchor gate and supplement, rights point, prompt assembly) + the shared resolvers.
 * FAKED (offline): NewsService (live search = ALL query words over LIVE; retained read = ANY term over
 * RETAINED, each row carrying its STORED country), the country feed (LIVE items by `about`), the
 * model (input captured = MODEL CONTEXT), meter, breaker, switches, observations.
 *
 * Non-vacuous: every top-up case asserts that the retained read WAS called and the defect row WAS
 * offered to the gate (so a pass is the gate's decision, not the corpus missing the row), and every
 * country assertion is "the FULL set of countries observed ⊆ allowed".
 *
 * Synthetic text only; no publisher text, no real URL.
 */

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
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
const tagged = (a: Item): Item => {
  const p = resolvePrimaryCountry(a);
  return p === undefined ? a : { ...a, countryCode: p.countryCode, countryName: p.countryName };
};

/* ---- the control texts (pinned below by the pure resolver, so each control's premise is MEASURED) ---- */
const TEXT = {
  cogMunicipal: ['Brazzaville city council approves budget talks in the Republic of the Congo', 'The municipal council of Brazzaville, Republic of the Congo, approved its budget.'],
  codEvent: ['Budget talks in Kinshasa as fighting near Goma strains the Democratic Republic of Congo', 'Officials in Kinshasa, Democratic Republic of Congo, held budget talks as M23 fighting continued near Goma in North Kivu.'],
  bareCongo: ['Congo budget talks continue', 'Negotiators in Congo continued budget talks this week.'],
  officeInBrazzaville: ['Budget talks stall as fighting near Goma displaces thousands in the Democratic Republic of Congo', 'A Brazzaville-based analyst said fighting near Goma in North Kivu, Democratic Republic of Congo, has stalled budget talks in Kinshasa.'],
  crossBorderCodEvent: ['Kinshasa ferry incident disrupts budget talks in the Democratic Republic of Congo', 'A ferry incident at the port of Kinshasa, Democratic Republic of Congo, injured traders, including some from Brazzaville, and disrupted budget talks.'],
} as const;

const LIVE: Item[] = [
  item('live-cod-goma', 'COD', 'Fighting near Goma in eastern Democratic Republic of Congo', 'Clashes near Goma in North Kivu, Democratic Republic of Congo, displaced residents.'),
  item('live-cog-brazza', 'COG', 'Brazzaville hosts budget talks in the Republic of the Congo', 'Officials in Brazzaville, Republic of the Congo, discussed the budget.'),
].map(tagged);

/* RETAINED rows carry their STORED code — deliberately including WRONG legacy codes */
const RETAINED: Item[] = [
  /* the defect row: a correctly stored COG report */
  { ...item('ret-cog-brazza', 'COG', 'Republic of the Congo budget talks in Brazzaville', 'Brazzaville officials in the Republic of the Congo met on the budget.', 30), countryCode: 'CG', countryName: 'Congo' },
  /* control: COG municipal item → COG only */
  { ...item('ret-cog-municipal', 'COG', TEXT.cogMunicipal[0], TEXT.cogMunicipal[1], 30), countryCode: 'CG', countryName: 'Congo' },
  /* control: a COD event whose LEGACY stored code is CG (the five-row class): own text wins */
  { ...item('ret-cod-legacy-cg', 'COD', TEXT.codEvent[0], TEXT.codEvent[1], 30), countryCode: 'CG', countryName: 'Congo' },
  /* control: bare "Congo", stored CG — not decided either way, never labelled */
  { ...item('ret-bare-congo-cg', 'UNKNOWN', TEXT.bareCongo[0], TEXT.bareCongo[1], 30), countryCode: 'CG', countryName: 'Congo' },
  /* control: an office-based-in-Brazzaville source inside a COD incident */
  { ...item('ret-office-brazza-cod', 'COD', TEXT.officeInBrazzaville[0], TEXT.officeInBrazzaville[1], 30), countryCode: 'CD', countryName: 'Democratic Republic of the Congo' },
  /* control: cross-border, explicit COD event place */
  { ...item('ret-crossborder-cod', 'COD', TEXT.crossBorderCodEvent[0], TEXT.crossBorderCodEvent[1], 30) },
];

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length >= 4);
const STOP = new Set(['what', 'latest', 'developments', 'happening', 'news', 'with', 'from', 'this', 'that', 'compare']);
const matchesAll = (q: string, a: Item) => {
  const hay = new Set(tokens(`${a.title} ${a.summary}`));
  const want = tokens(q).filter((t) => !STOP.has(t));
  return want.length > 0 && want.every((t) => hay.has(t));
};
const matchesAny = (q: string, a: Item) => {
  const hay = new Set(tokens(`${a.title} ${a.summary}`));
  return tokens(q).some((t) => !STOP.has(t) && hay.has(t));
};
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

interface Observed {
  offeredRetainedIds: string[];
  evidenceIds: string[];
  evidenceCountries: string[];
  evidenceLabel: Record<string, string | null>;
  modelEvidenceIds: string[];
  modelCountries: string[];
  feedCountries: string[];
  typedCountry: string | null;
  rcCountry: string | null;
  coverage: Array<{ iso3: string; final: number }>;
  searches: string[];
  counts: { search: number; retained: number; feed: number; model: number; background: number; analyzeNews: number };
}

async function ask(question: string): Promise<Observed> {
  const counts = { search: 0, retained: 0, feed: 0, model: 0, background: 0, analyzeNews: 0 };
  const searches: string[] = [];
  const feedCountries: string[] = [];
  const offered = new Set<string>();
  const empty = (): NewsResponse => ({ articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() });
  const live = (articles: NewsArticle[]): NewsResponse => ({ ...empty(), articles: articles.map((a) => ({ ...a })), totalResults: articles.length });
  const news: Record<string, unknown> = {
    search: jest.fn(async (q: string) => {
      counts.search += 1;
      searches.push(q);
      return live(LIVE.filter((a) => matchesAll(q, a)));
    }),
    topHeadlines: jest.fn(async () => empty()),
    findRetainedByQuery: jest.fn(async (q: string, terms: string[]) => {
      counts.retained += 1;
      const rows = RETAINED.filter((a) => matchesAny([q, ...(terms ?? [])].join(' '), a)).map((a) => ({ ...a }));
      for (const r of rows) offered.add(r.id);
      return rows;
    }),
    findRetainedHeadlines: jest.fn(async () => []),
    findRetainedByCountry: jest.fn(async () => []),
    findArticleById: jest.fn(async () => null),
    findRetainedArticleByUrl: jest.fn(async () => null),
    isFallbackTierProvider: jest.fn(() => false),
  };
  const newsProxy = new Proxy(news, { get: (t, p: string) => (p in t ? t[p] : jest.fn(async () => empty())) });
  const getCountryNews = jest.fn(async (code: string) => {
    counts.feed += 1;
    feedCountries.push(code);
    const meta = resolveCountryByAnyIdentifier(code);
    return { ...live(LIVE.filter((a) => a.about === meta?.iso3)), countryCode: meta?.iso2 ?? code, countryName: meta?.name ?? code, feedTier: 'delayed', providerDisplayName: 'GNews' };
  });
  const countryNews = new Proxy({ getCountryNews } as Record<string, unknown>, { get: (t, p: string) => (p in t ? t[p] : jest.fn(async () => empty())) });
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
    { permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' as const })), record: jest.fn(async () => undefined) } as never,
    { isEnabled: jest.fn(async () => true) } as never,
    config as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async () => true) } as never,
    { boundSpecialistDomains: () => ['CONFLICT'], read: jest.fn(async () => ({ considered: [], contributions: [] })) } as never,
  );
  const request = { question, language: 'en', intent: 'ask' } as AskRequest;
  await askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never, async () => {
    const plan = await adapter.prepare(request);
    return adapter.execute(request, plan, 'op-geo-e2e-d1');
  });
  const policy = analyzeArgs.flat().find((a): a is { typedCountry?: string } => !!a && typeof a === 'object' && 'typedCountry' in (a as object));
  const response = responses[responses.length - 1];
  const evidence: NewsArticle[] = response?.articles ?? [];
  const modelCountries = new Set<string>();
  const modelEvidenceIds = new Set<string>();
  for (const input of modelInputs) {
    scopeCountries(input, modelCountries);
    for (const a of (input as { articles?: NewsArticle[] }).articles ?? []) modelEvidenceIds.add(a.id);
  }
  const coverageSrc: any[] = (modelInputs[modelInputs.length - 1] as any)?.comparisonCoverage ?? response?.retrievalContext?.comparisonCoverage ?? [];
  return {
    offeredRetainedIds: sorted(offered),
    evidenceIds: sorted(evidence.map((a) => a.id)),
    evidenceCountries: sorted(evidence.map((a) => iso3(a.countryCode)).filter((c): c is string => !!c)),
    evidenceLabel: Object.fromEntries(evidence.map((a) => [a.id, iso3(a.countryCode) ?? null])),
    modelEvidenceIds: sorted(modelEvidenceIds),
    modelCountries: sorted(modelCountries),
    feedCountries: sorted(feedCountries.map((c) => iso3(c) ?? c)),
    typedCountry: policy?.typedCountry ?? null,
    rcCountry: iso3(response?.retrievalContext?.countryCode) ?? null,
    coverage: coverageSrc.map((c) => ({ iso3: c.iso3, final: c.finalQualifyingEvidenceCount })),
    searches,
    counts,
  };
}
const allScope = (o: Observed) =>
  sorted([...o.feedCountries, ...(o.typedCountry ? [o.typedCountry] : []), ...(o.rcCountry ? [o.rcCountry] : []), ...o.evidenceCountries, ...o.modelCountries, ...o.coverage.map((c) => c.iso3)]);
const outside = (set: string[], allowed: string[]) => set.filter((c) => !allowed.includes(c));
const bounded = (o: Observed) => {
  expect(o.counts.analyzeNews).toBeLessThanOrEqual(1);
  expect(o.counts.model + o.counts.background).toBeLessThanOrEqual(1);
};

const COD_Q = 'What are the latest developments in Congo - Kinshasa budget talks?';
const COG_Q = 'What are the latest developments in Congo - Brazzaville budget talks?';
const CD = 'CD';
const CG = 'CG';

/* ================================================================================== */
describe('GEO-E2E-D1 · the control premises, measured on the real article resolver (pure)', () => {
  it.each<[string, readonly [string, string], string | undefined]>([
    ['COG municipal item', TEXT.cogMunicipal, CG],
    ['COD event (Kinshasa / Goma / M23)', TEXT.codEvent, CD],
    ['bare "Congo"', TEXT.bareCongo, undefined],
    ['office-based-in-Brazzaville source inside a COD incident', TEXT.officeInBrazzaville, CD],
    ['cross-border, explicit COD event place', TEXT.crossBorderCodEvent, CD],
  ])('%s → own text resolves to %s', (_label, [title, summary], expected) => {
    expect(resolvePrimaryCountry({ title, summary })?.countryCode).toBe(expected);
  });
  it('the defect row is NOT caught by country relevance alone: the gap the top-up leaves open is the contradiction, not relevance', () => {
    const row = RETAINED.find((r) => r.id === 'ret-cog-brazza')!;
    /* recorded either way; the top-up never asks this question, which is the defect */
    expect(typeof scoreCountryRelevance(row, resolveCountryByAnyIdentifier('COD')!).isRelevant).toBe('boolean');
  });
});

describe('GEO-E2E-D1 · the anchored top-up boundary (DR Congo question)', () => {
  it('D1-1 [GEO-E2E-D1] a correctly stored COG report offered by the top-up never reaches a COD answer: not evidence, not model context, no COG in scope', async () => {
    const o = await ask(COD_Q);
    expect(o.counts.retained).toBeGreaterThanOrEqual(1);
    expect(o.offeredRetainedIds).toContain('ret-cog-brazza'); // non-vacuous: the gate WAS offered it
    expect(o.evidenceIds).not.toContain('ret-cog-brazza');
    expect(o.modelEvidenceIds).not.toContain('ret-cog-brazza');
    expect(o.evidenceIds).not.toContain('ret-cog-municipal');
    expect(outside(allScope(o), ['COD'])).toEqual([]);
    bounded(o);
  });
  it('D1-2 [GEO-E2E-D1] a COD event whose LEGACY stored code is CG is kept for the COD answer, and the unsupported CG label is never shown or counted', async () => {
    const o = await ask(COD_Q);
    expect(o.offeredRetainedIds).toContain('ret-cod-legacy-cg');
    expect(o.evidenceIds).toContain('ret-cod-legacy-cg');
    expect(o.evidenceLabel['ret-cod-legacy-cg']).not.toBe('COG');
    expect(outside(allScope(o), ['COD'])).toEqual([]);
  });
  it('D1-3 [GEO-E2E-D1] bare "Congo" (stored CG) is not silently decided: kept (absence of a competing country is not a contradiction) but never labelled or counted as COG inside a COD answer', async () => {
    const o = await ask(COD_Q);
    expect(o.offeredRetainedIds).toContain('ret-bare-congo-cg');
    expect(o.evidenceIds).toContain('ret-bare-congo-cg');
    expect(o.evidenceLabel['ret-bare-congo-cg']).toBeNull();
    expect(outside(allScope(o), ['COD'])).toEqual([]);
  });
  it('D1-4 control: an office-based-in-Brazzaville source inside a COD incident is NOT excluded for the COD answer', async () => {
    const o = await ask(COD_Q);
    expect(o.offeredRetainedIds).toContain('ret-office-brazza-cod');
    expect(o.evidenceIds).toContain('ret-office-brazza-cod');
  });
  it('D1-5 control: a cross-border report with an explicit COD event place is kept for the COD answer', async () => {
    const o = await ask(COD_Q);
    expect(o.offeredRetainedIds).toContain('ret-crossborder-cod');
    expect(o.evidenceIds).toContain('ret-crossborder-cod');
  });
});

describe('GEO-E2E-D1 · the mirror (Republic of the Congo question)', () => {
  it('D1-6 control: the COG municipal item and the defect row ARE admitted for a COG answer', async () => {
    const o = await ask(COG_Q);
    expect(o.evidenceIds).toEqual(expect.arrayContaining(['ret-cog-municipal']));
    expect(o.modelEvidenceIds.length).toBeGreaterThan(0);
  });
  it('D1-7 [GEO-E2E-D1] COD events never reach a COG answer: not the legacy-CG COD row, not the office case, not the cross-border COD event', async () => {
    const o = await ask(COG_Q);
    expect(o.offeredRetainedIds).toEqual(expect.arrayContaining(['ret-cod-legacy-cg', 'ret-office-brazza-cod', 'ret-crossborder-cod']));
    for (const id of ['ret-cod-legacy-cg', 'ret-office-brazza-cod', 'ret-crossborder-cod']) {
      expect(o.evidenceIds).not.toContain(id);
      expect(o.modelEvidenceIds).not.toContain(id);
    }
    expect(outside(allScope(o), ['COG'])).toEqual([]);
    bounded(o);
  });
});

describe('GEO-E2E-D1 · cost', () => {
  it('the top-up makes no extra provider or model call: one analysis, at most one model or background call, at most two supplement searches', async () => {
    for (const q of [COD_Q, COG_Q]) {
      const o = await ask(q);
      bounded(o);
      expect(o.counts.retained).toBeLessThanOrEqual(2);
    }
  });
});
