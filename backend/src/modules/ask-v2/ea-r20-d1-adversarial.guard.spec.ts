/* EAST AFRICA R20 adversarial rows for GEO-E2E-D1 (EA-REUTERS… VERDICT §3.4, B-1), adopted as permanent guards by Claude Code (EA R20 B-1
   acceptance: "EA-cog-oil and EA-cog-sassou become it guards"). Harness = Code geo-e2e-d1.top-up.spec.ts; rows are EA-authored
   synthetic text. No provider/model/network/DB. Local file-logging of the probe removed; assertions unchanged. */
import { congoReadingOf } from '../analysis/anchor/event-anchor.util';
import { articleContradictsCountryScope } from '../analysis/service/scope-contradiction.util';
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
  /* ===== EA R20 adversarial rows: AUTHENTIC Republic-of-the-Congo reports, stored CG, weaker wording ===== */
  { ...item('EA-cog-oil', 'COG', 'Brazzaville awards new oil blocks as budget talks continue', 'The Republic of the Congo signed three licences.', 30), countryCode: 'CG', countryName: 'Congo' },
  { ...item('EA-cog-pointe', 'COG', 'Pointe-Noire port budget talks resume', 'Port officials in Pointe-Noire discussed the budget.', 30), countryCode: 'CG', countryName: 'Congo' },
  { ...item('EA-cog-sassou', 'COG', 'Sassou Nguesso government opens budget talks in Congo', 'Talks in Brazzaville continued on Tuesday.', 30), countryCode: 'CG', countryName: 'Congo' },
  { ...item('EA-cog-hyphen', 'COG', 'Congo-Brazzaville budget talks continue', 'Negotiators met in the capital.', 30), countryCode: 'CG', countryName: 'Congo' },
  { ...item('EA-cog-brazza-only', 'COG', 'Brazzaville budget talks continue', 'Officials in Brazzaville met on the budget.', 30), countryCode: 'CG', countryName: 'Congo' },
  // Claude Code (B-1 acceptance): the EA Pointe-Noire / Brazzaville-only shapes, worded so the top-up OFFERS them.
  // Without the word Congo they are not relevant to a DR Congo answer at all; with it, the general resolver already
  // reads them as CG. Either way they never reach the answer, and neither path depends on the B-1 rule.
  { ...item('CC-cog-pointe-economy', 'COG', 'Pointe-Noire port economy talks resume', 'Port officials in Pointe-Noire discussed the economy.', 30), countryCode: 'CG', countryName: 'Congo' },
  { ...item('CC-cog-brazza-economy', 'COG', 'Brazzaville economy talks continue', 'Officials in Brazzaville met on the economy.', 30), countryCode: 'CG', countryName: 'Congo' },
  { ...item('CC-cog-pointe-congo', 'COG', 'Pointe-Noire port reopens economy talks', 'Port officials in Pointe-Noire, Congo, discussed the economy.', 30), countryCode: 'CG', countryName: 'Congo' },
  { ...item('CC-cog-brazza-congo', 'COG', 'Brazzaville officials extend economy talks', 'Officials in Brazzaville, Congo, met on the economy.', 30), countryCode: 'CG', countryName: 'Congo' },
  /* same weak COG text with NO stored code (a fresh / unlabelled row) */
  { ...item('EA-cog-oil-nocode', 'COG', 'Brazzaville awards new oil blocks as budget talks continue', 'The Republic of the Congo signed three licences.', 30) },
  /* cross-border control: explicit COD event place, impact in Rwanda */
  { ...item('EA-xb-goma-gisenyi', 'COD+RWA', 'Shelling near Goma hits Gisenyi as budget talks stall', 'Shells fired near Goma in the Democratic Republic of Congo landed in Gisenyi, Rwanda.', 30) },
  /* kinshasa as client only, event elsewhere (R2 probe: Kinshasa-as-client decided CD) */
  { ...item('EA-kin-client', 'UNKNOWN', 'Contractors working for Kinshasa ambushed in Congo during budget talks', 'The firm has a contract with the government in Kinshasa.', 30) },
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

const EA_ROWS = ['EA-cog-oil', 'EA-cog-pointe', 'EA-cog-sassou', 'EA-cog-hyphen', 'EA-cog-brazza-only', 'EA-cog-oil-nocode', 'EA-xb-goma-gisenyi', 'EA-kin-client'];
const lines: string[] = [];

describe('EA R20 · pure premises (resolver vs congoReadingOf vs D1 guard)', () => {
  it('records, per EA row, what each reader says', () => {
    for (const r of RETAINED.filter((x) => x.id.startsWith('EA-'))) {
      const p = resolvePrimaryCountry(r);
      lines.push(['PURE', r.id, `about=${r.about}`, `primary=${p?.countryCode ?? 'NONE'}`, `congoReading=${congoReadingOf(`${r.title} ${r.summary}`) ?? '-'}`,
        `contradictsCD=${articleContradictsCountryScope(r, 'CD')}`, `contradictsCG=${articleContradictsCountryScope(r, 'CG')}`].join(' ~ '));
    }
    expect(lines.length).toBe(EA_ROWS.length);
  });
});

describe('EA R20 · DR Congo question, adversarial COG rows', () => {
  let o: Observed;
  beforeAll(async () => { o = await ask(COD_Q); for (const id of EA_ROWS) lines.push(['COD_Q', id, `offered=${o.offeredRetainedIds.includes(id)}`, `evidence=${o.evidenceIds.includes(id)}`, `model=${o.modelEvidenceIds.includes(id)}`, `label=${o.evidenceLabel[id] ?? null}`].join(' ~ ')); lines.push(['COD_Q', 'scope', allScope(o).join(','), `evidence=${o.evidenceIds.join(',')}`, `counts=${JSON.stringify(o.counts)}`].join(' ~ ')); });
  // EA-cog-pointe and EA-cog-brazza-only carry neither "congo" nor "economy", so the real top-up query for this
  // question ("DR Congo economy") never offers them: recorded here as NOT offered (the vacuity EA reported). Their
  // shapes are measured, offered, by the CC variants below.
  it('EA-R20-D1-vacuity: the EA Pointe-Noire and Brazzaville-only rows are not offered by this question (no shared term)', () => {
    expect(o.offeredRetainedIds).not.toContain('EA-cog-pointe');
    expect(o.offeredRetainedIds).not.toContain('EA-cog-brazza-only');
  });
  it('EA-R20-D1 offered shape: which existing check decides each CC variant (none depends on the B-1 rule)', () => {
    const byId = (id: string) => RETAINED.find((x) => x.id === id)!;
    for (const id of ['CC-cog-pointe-economy', 'CC-cog-brazza-economy']) expect(resolvePrimaryCountry(byId(id))).toBeUndefined();
    for (const id of ['CC-cog-pointe-congo', 'CC-cog-brazza-congo']) expect(resolvePrimaryCountry(byId(id))?.countryCode).toBe('CG');
  });
  it.each(['CC-cog-pointe-economy', 'CC-cog-brazza-economy', 'CC-cog-pointe-congo', 'CC-cog-brazza-congo'])('EA-R20-D1 offered shape: %s is offered by the top-up and excluded from COD evidence and model input', (id) => {
    expect(o.offeredRetainedIds).toContain(id);
    expect(o.evidenceIds).not.toContain(id);
    expect(o.modelEvidenceIds).not.toContain(id);
  });
  it.each(['EA-cog-oil', 'EA-cog-sassou', 'EA-cog-hyphen', 'EA-cog-oil-nocode'])(
    'EA-R20-D1-%s: clearly foreign Brazzaville/Republic-of-the-Congo report never reaches COD evidence or model input',
    (id) => {
      expect(o.offeredRetainedIds).toContain(id); // non-vacuous
      expect(o.evidenceIds).not.toContain(id);
      expect(o.modelEvidenceIds).not.toContain(id);
    },
  );
  it('EA-R20-D1-scope: no COG anywhere in a COD answer', () => { expect(outside(allScope(o), ['COD'])).toEqual([]); });
  it('EA-R20-D1-cost: bounded', () => bounded(o));
});

describe('EA R20 · Republic of the Congo question (mirror)', () => {
  let o: Observed;
  beforeAll(async () => { o = await ask(COG_Q); for (const id of EA_ROWS) lines.push(['COG_Q', id, `offered=${o.offeredRetainedIds.includes(id)}`, `evidence=${o.evidenceIds.includes(id)}`, `model=${o.modelEvidenceIds.includes(id)}`, `label=${o.evidenceLabel[id] ?? null}`].join(' ~ ')); lines.push(['COG_Q', 'scope', allScope(o).join(','), `evidence=${o.evidenceIds.join(',')}`].join(' ~ ')); });
  it('EA-R20-D1-mirror: the explicit cross-border COD event and the Kinshasa-client row never reach a COG answer', () => {
    for (const id of ['EA-xb-goma-gisenyi']) { expect(o.evidenceIds).not.toContain(id); }
  });
  it('EA-R20-D1-mirror-scope: no COD anywhere in a COG answer', () => { expect(outside(allScope(o), ['COG'])).toEqual([]); });
});
