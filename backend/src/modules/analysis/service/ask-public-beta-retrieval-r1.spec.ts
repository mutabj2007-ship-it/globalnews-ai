import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { GNewsProviderError } from '../../news/providers/gnews.provider';
import {
  COMPOUND_PLAN_PACING,
  MAX_ADDITIONAL_LANGUAGE_SEARCHES,
  MAX_READER_LANGUAGE_SEARCHES,
  deriveCompoundRetrievalPlan,
  withoutFormatDirectives,
} from '../query/compound-retrieval-plan.util';
import { scoreCompoundPlanRelevance } from '../../news/relevance/compound-plan-relevance.util';
import {
  assessSingleSourceDiscipline,
  detectDevelopmentBreadth,
} from '../validation/brief-compliance.util';
import {
  buildDevelopmentBreadthSection,
  buildSingleSourceBasisSection,
} from '../prompt/build-analysis-prompt.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA RETRIEVAL REPAIR R1 — BETA-ASK-002 / 003 on the real services.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production op 5944db16 (request 444058c7): the eastern-DRC question reached GNews as one
 * ~35-term AND phrase, returned nothing, and was answered "0 matching reports". Fixtures are
 * [RECONSTRUCTED] headlines of the kind the wires and Radio Okapi / Actualite.cd publish; no
 * live provider or model is called.
 */

const Q2 =
  'What are the most recent verified security or territorial changes in eastern Democratic Republic of the Congo, and what effects on civilians or displacement are currently reported? Separate confirmed facts from analytical inference, identify important claims that remain disputed, distinguish event dates from publication dates, and cite independent local/regional, official, and international sources where available.';
const Q3 = "What has changed in Poland's economy? Give the dates and cite the sources.";

function a(
  id: string,
  title: string,
  summary: string,
  extra: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://${id}.example/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Outlet ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher' as const,
    sourceLanguage: 'en',
    ...extra,
  };
}

const EN_SECURITY = a(
  'en-sec',
  'M23 rebels seize another town in North Kivu',
  'Fighting in eastern Democratic Republic of Congo pushed the front line north of Goma.',
);
const EN_DISPLACED = a(
  'en-hum',
  'Thousands flee as clashes spread in Ituri',
  'Aid agencies said civilians displaced in eastern Congo lack shelter.',
);
const FR_LOCAL = a(
  'fr-loc',
  'Nord-Kivu : le M23 prend le contrôle de Masisi',
  "Les combats dans l'est de la RDC ont provoqué le déplacement de milliers de civils.",
  { sourceLanguage: 'fr' },
);
const COG = a(
  'cog',
  'Brazzaville: Republic of the Congo army deploys after clashes',
  'Clashes in the Pool region of the Republic of the Congo displaced villagers.',
);
const COG_EASTERN = a(
  'cog-east',
  'Violence in eastern Congo-Brazzaville displaces families',
  'Fighting near the border of the Republic of the Congo displaced families, Brazzaville said.',
);
const KINSHASA_POLITICS = a(
  'kin',
  'DR Congo parliament debates budget in Kinshasa',
  'Lawmakers in the Democratic Republic of Congo debated spending.',
);
/* One wire story, syndicated under two outlets. */
const SYNDICATED_A = a(
  'syn-a',
  'M23 rebels seize Masisi town in North Kivu, residents say',
  'Rebels seized Masisi in eastern Democratic Republic of Congo on Monday, residents said.',
);
const SYNDICATED_B = a(
  'syn-b',
  'M23 rebels seize Masisi town in North Kivu, residents say',
  'Rebels seized Masisi in eastern Democratic Republic of Congo on Monday, residents said.',
);

/* Plan pacing is exercised by its own test; everything else runs without real waiting. */
beforeAll(() => {
  COMPOUND_PLAN_PACING.spacingMs = 0;
});

type Call = { providerId: string; q: string; lang?: string };

function stub(
  id: string,
  byLang: (lang: string | undefined) => NewsArticle[],
  calls: Call[],
  failWith?: Error,
): NewsProvider {
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search'],
    async search(q: string, options?: { lang?: string }) {
      calls.push({ providerId: id, q, ...(options?.lang ? { lang: options.lang } : {}) });
      if (failWith) throw failWith;
      return byLang(options?.lang);
    },
    async topHeadlines() {
      return [];
    },
    async category() {
      return [];
    },
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' };
    },
  } as unknown as NewsProvider;
}

async function services(primary: NewsProvider[], fallback: NewsProvider[] = [], summary?: string) {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const all = [...primary, ...fallback];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: all },
      { provide: ALL_NEWS_PROVIDERS, useValue: all },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallback },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  const model: AnalysisProvider = {
    id: 'openai',
    displayName: 'Fixture model',
    isMock: false,
    analyzeNews: async (input: AnalysisProviderInput) => {
      inputs.push(input);
      const out = (await mock.analyzeNews(input)) as Record<string, unknown>;
      return summary === undefined ? out : { ...out, summary };
    },
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'fixture',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    moduleRef.get(NewsService),
    moduleRef.get(CountryNewsService),
    model,
    config,
  );
  return { service, inputs };
}

describe('1–3 · the compound question becomes a bounded plan that keeps the eastern scope', () => {
  const plan = deriveCompoundRetrievalPlan(Q2, 'en');

  it('answer-format directives are not retrieval terms', () => {
    expect(withoutFormatDirectives(Q2)).toBe(
      'What are the most recent verified security or territorial changes in eastern Democratic Republic of the Congo, and what effects on civilians or displacement are currently reported?',
    );
    for (const query of plan?.queries ?? []) {
      expect(query.q).not.toMatch(
        /separate|confirmed|inference|distinguish|publication|cite|independent|official|international|disputed/i,
      );
    }
  });

  it('is bounded: ≤3 reader-language searches + ≤1 governed additional-language search', () => {
    expect(plan).toBeDefined();
    const reader = plan!.queries.filter((q) => q.lang === undefined);
    const other = plan!.queries.filter((q) => q.lang !== undefined);
    expect(reader.length).toBeLessThanOrEqual(MAX_READER_LANGUAGE_SEARCHES);
    expect(other.length).toBeLessThanOrEqual(MAX_ADDITIONAL_LANGUAGE_SEARCHES);
    expect(plan!.queries.map((q) => q.q)).toEqual([
      'eastern Congo',
      'Congo',
      'eastern Congo fighting',
      'eastern Congo displaced',
    ]);
    /* Only the first search may reach the slow fallback tier. */
    expect(plan!.queries.map((q) => q.allowFallback)).toEqual([true, false, false, false]);
    expect(plan!.facets).toEqual(['SECURITY', 'HUMANITARIAN']);
  });

  it('eastern-DRC scope survives country normalisation, from the governed gazetteer', () => {
    expect(plan!.iso3).toBe('COD');
    expect(plan!.scope?.qualifier).toBe('eastern');
    expect(plan!.scope?.places).toEqual(
      expect.arrayContaining(['north kivu', 'south kivu', 'ituri', 'goma', 'bukavu', 'beni']),
    );
    /* Western DRC is not "eastern". */
    expect(plan!.scope?.places).not.toEqual(expect.arrayContaining(['kinshasa']));
    expect(plan!.scope?.places).not.toEqual(expect.arrayContaining(['matadi']));
  });

  it('English evidence language + the governed pack language (French for COD)', () => {
    expect(plan!.evidenceLanguages).toEqual(['en', 'fr']);
    /* BETA-ASK-004: the governed local-language lane runs SECOND, not last. */
    expect(plan!.queries[1]).toMatchObject({ q: 'Congo', lang: 'fr' });
  });

  it('short questions, non-English questions and country-economy questions keep their path', () => {
    expect(
      deriveCompoundRetrievalPlan('What is the security situation in eastern DRC?', 'en'),
    ).toBeUndefined();
    expect(deriveCompoundRetrievalPlan(Q3, 'en')).toBeUndefined();
    expect(deriveCompoundRetrievalPlan(Q2, 'pl')).toBeUndefined();
  });
});

describe('4–5 · admission: DRC vs Congo-Brazzaville, and French local reporting', () => {
  const plan = deriveCompoundRetrievalPlan(Q2, 'en')!;
  const admit = (article: NewsArticle) => scoreCompoundPlanRelevance(article, plan).isRelevant;

  it('admits eastern-DRC security and displacement reporting', () => {
    expect(admit(EN_SECURITY)).toBe(true);
    expect(admit(EN_DISPLACED)).toBe(true);
  });

  it('admits governed French DRC reporting for an English question', () => {
    expect(admit(FR_LOCAL)).toBe(true);
  });

  it('rejects Republic of the Congo reporting, even when it says "eastern"', () => {
    expect(admit(COG)).toBe(false);
    expect(admit(COG_EASTERN)).toBe(false);
  });

  it('rejects DRC reporting outside the eastern scope or off-topic', () => {
    expect(admit(KINSHASA_POLITICS)).toBe(false);
  });
});

describe('Q2 on the real AnalysisService + NewsService', () => {
  it('BEFORE/AFTER: bounded searches, EN + FR admitted, no COG, one model call', async () => {
    const calls: Call[] = [];
    const gnews = stub(
      'gnews',
      (lang) =>
        lang === 'fr'
          ? [FR_LOCAL, COG]
          : [EN_SECURITY, EN_DISPLACED, COG, COG_EASTERN, KINSHASA_POLITICS],
      calls,
    );
    const { service, inputs } = await services([gnews]);

    const result = await service.analyzeNews(Q2, 'en');

    expect(calls).toEqual([
      { providerId: 'gnews', q: 'eastern Congo' },
      { providerId: 'gnews', q: 'Congo', lang: 'fr' },
      { providerId: 'gnews', q: 'eastern Congo fighting' },
      { providerId: 'gnews', q: 'eastern Congo displaced' },
    ]);
    const ids = result.articles.map((article) => article.id).sort();
    expect(ids).toEqual(['en-hum', 'en-sec', 'fr-loc']);
    /* Provenance and source language survive; nothing is translated. */
    const fr = result.articles.find((article) => article.id === 'fr-loc')!;
    expect(fr.sourceLanguage).toBe('fr');
    expect(fr.title).toBe(FR_LOCAL.title);
    expect(inputs).toHaveLength(1);
    expect(result.analysis).not.toBeNull();
  });

  it('8 · zero qualifying evidence still means no model call', async () => {
    const calls: Call[] = [];
    const gnews = stub('gnews', () => [COG, COG_EASTERN, KINSHASA_POLITICS], calls);
    const { service, inputs } = await services([gnews]);

    const result = await service.analyzeNews(Q2, 'en');

    expect(result.articles).toEqual([]);
    expect(result.analysis).toBeNull();
    expect(inputs).toHaveLength(0);
  });

  it('a refused provider is disclosed, stops the plan, and is never "nothing happened"', async () => {
    const calls: Call[] = [];
    const gnews = stub(
      'gnews',
      () => [],
      calls,
      new GNewsProviderError('GNews rate limit reached.', 429, 'rate-limited'),
    );
    const { service, inputs } = await services([gnews]);

    const result = await service.analyzeNews(Q2, 'en');

    expect(calls).toHaveLength(1);
    expect(inputs).toHaveLength(0);
    expect(result.retrievalContext?.outcome).toBe('PROVIDER_RATE_LIMITED');
  });
});

describe('6 · syndicated copies do not satisfy independence twice (claims discipline)', () => {
  it('two copies of one wire story are ONE cluster, and the prompt narrows the prose', () => {
    const breadth = detectDevelopmentBreadth([SYNDICATED_A, SYNDICATED_B]);
    expect(breadth.clusters).toBe(1);
    const section = buildDevelopmentBreadthSection(breadth);
    expect(section).toContain('SINGLE-SOURCE BASIS');
    expect(section).toContain('One qualifying report currently indicates');
    expect(section).toMatch(/do NOT describe anything as verified or confirmed/);
  });

  it('two independent reports are two clusters and carry no single-source clause', () => {
    const breadth = detectDevelopmentBreadth([EN_SECURITY, EN_DISPLACED]);
    expect(breadth.clusters).toBe(2);
    expect(buildSingleSourceBasisSection(breadth)).toBe('');
  });
});

describe('6b · the single-source rule binds the RENDERED answer, not only the prompt', () => {
  const BROAD =
    'Multiple reports confirm that security across eastern DRC has deteriorated nationwide, with the region now verified to be under rebel control.';
  const NARROW =
    'One qualifying report currently indicates that M23 rebels seized another town in North Kivu; this rests on a single report.';

  it('unit: one cluster + multi-source certainty or no one-report attribution → non-compliant', () => {
    const one = detectDevelopmentBreadth([SYNDICATED_A, SYNDICATED_B]);
    expect(assessSingleSourceDiscipline(BROAD, one, 'en').compliant).toBe(false);
    expect(
      assessSingleSourceDiscipline('Security in eastern DRC has deteriorated.', one, 'en')
        .compliant,
    ).toBe(false);
    expect(assessSingleSourceDiscipline(NARROW, one, 'en').compliant).toBe(true);
    expect(
      assessSingleSourceDiscipline('Jeden raport wskazuje, że gospodarka zwolniła.', one, 'pl')
        .compliant,
    ).toBe(true);
    /* Two independent clusters: the rule does not apply. */
    const two = detectDevelopmentBreadth([EN_SECURITY, EN_DISPLACED]);
    expect(assessSingleSourceDiscipline(BROAD, two, 'en').compliant).toBe(true);
  });

  it('Q2 with ONE surviving cluster: a broad multi-source brief is withheld from the reader', async () => {
    const calls: Call[] = [];
    const gnews = stub('gnews', () => [SYNDICATED_A, SYNDICATED_B, COG], calls);
    const { service, inputs } = await services([gnews], [], BROAD);

    const result = await service.analyzeNews(Q2, 'en');

    expect(inputs).toHaveLength(1);
    expect(inputs[0].developmentBreadth?.clusters).toBe(1);
    expect(result.analysis?.briefState?.availability).toBe('withheld-non-compliant');
    expect(result.analysis?.summary).toBe('');
  });

  it('Q2 with ONE surviving cluster: an explicitly single-source brief is served', async () => {
    const calls: Call[] = [];
    const gnews = stub('gnews', () => [SYNDICATED_A, SYNDICATED_B], calls);
    const { service } = await services([gnews], [], NARROW);

    const result = await service.analyzeNews(Q2, 'en');

    expect(result.analysis?.briefState?.availability).toBe('accepted');
    expect(result.analysis?.summary).toBe(NARROW);
  });

  it('Q3 Poland economy with one report: prompt carries the rule and a national conclusion is withheld', async () => {
    const calls: Call[] = [];
    const wire = a(
      'pl-gdp',
      "Poland's economy grew 3.2% in the second quarter, statistics office says",
      'Gross domestic product in Poland rose 3.2% year on year in the second quarter of 2026.',
    );
    const gnews = stub('gnews', () => [wire], calls);
    const broad = await services(
      [gnews],
      [],
      "Poland's economy is booming nationwide, as multiple reports confirm.",
    );
    const withheld = await broad.service.analyzeNews(Q3, 'en');
    expect(withheld.articles.map((x) => x.id)).toEqual(['pl-gdp']);
    expect(broad.inputs[0].developmentBreadth?.clusters).toBe(1);
    expect(withheld.analysis?.briefState?.availability).toBe('withheld-non-compliant');

    const narrow = await services(
      [stub('gnews', () => [wire], [])],
      [],
      "One qualifying report currently indicates Poland's GDP rose 3.2% year on year in Q2 2026.",
    );
    const served = await narrow.service.analyzeNews(Q3, 'en');
    expect(served.analysis?.briefState?.availability).toBe('accepted');
  });
});

/*
  BETA-ASK-004 — RELEVANCE COHERENCE. Production smoke on f39cd7a admitted the Lake Kivu vessel
  capsize as evidence for "security or territorial changes … effects on civilians or
  displacement": the bare word "dead" satisfied the humanitarian leg.
*/
describe('BETA-ASK-004 · the humanitarian leg needs a conflict nexus or explicit displacement', () => {
  const plan = deriveCompoundRetrievalPlan(Q2, 'en')!;
  const admit = (article: NewsArticle) => scoreCompoundPlanRelevance(article, plan).isRelevant;

  /* [PRODUCTION-OBSERVED title] The exact negative control. */
  const LAKE_KIVU_CAPSIZE = a(
    'kivu-boat',
    "12 dead, dozens missing after vessel capsizes in eastern Congo's Lake Kivu",
    'A boat carrying passengers and goods capsized on Lake Kivu near Goma, local officials said.',
  );

  it('rejects the exact Lake Kivu vessel-capsize shape (in scope, but not conflict)', () => {
    expect(admit(LAKE_KIVU_CAPSIZE)).toBe(false);
    /* Geography is not what rejected it — the scope and country still hold. */
    const verdict = scoreCompoundPlanRelevance(LAKE_KIVU_CAPSIZE, plan);
    expect(verdict.scope).toBe(true);
    expect(verdict.country).toBe(true);
    expect(verdict.facets).toEqual([]);
  });

  it.each([
    [
      'road accident',
      'Truck crash kills 20 on road near Bukavu',
      'The accident happened in eastern Congo on Sunday; 20 dead.',
    ],
    [
      'aviation accident',
      'Cargo plane crash near Goma leaves 5 dead',
      'The plane crashed on landing in eastern Congo.',
    ],
    [
      'disease deaths',
      'Cholera outbreak kills 40 in North Kivu',
      'Health officials in eastern Congo reported 40 deaths from the disease.',
    ],
    [
      'mpox',
      'Mpox deaths rise in South Kivu',
      'Victims of the mpox epidemic in eastern Congo rose to 30.',
    ],
    [
      'natural disaster',
      'Floods and landslide leave 60 dead near Uvira',
      'Torrential rain in eastern Congo caused flooding; many victims.',
    ],
    [
      'ordinary crime',
      'Robbery at Goma market leaves one dead',
      'Police in eastern Congo said the robbery victim died.',
    ],
    ['mortality alone', '12 dead in Beni', 'Twelve people died in eastern Congo, officials said.'],
    [
      'French boat capsize',
      'Naufrage sur le lac Kivu : 12 morts',
      "Une embarcation a chaviré dans l'est de la RDC près de Goma.",
    ],
  ])('rejects %s', (_label, title, summary) => {
    expect(admit(a(`neg-${_label}`, title, summary))).toBe(false);
  });

  it.each([
    [
      'civilian killings in fighting',
      'Rebels kill 20 civilians in attack near Beni',
      'The attack in eastern Congo was blamed on an armed group.',
    ],
    [
      'conflict displacement',
      'Thousands displaced as fighting reaches Sake',
      'Families fled clashes in eastern Congo, aid groups said.',
    ],
    [
      'refugee movement',
      'Congolese refugees cross into Uganda from Ituri',
      'The UN refugee agency said arrivals from eastern Congo rose.',
    ],
    [
      'humanitarian access',
      'Humanitarian access cut in North Kivu',
      'Aid convoys to camps around Goma in eastern Congo were suspended.',
    ],
    [
      'shelling casualties',
      'Shelling near Goma kills 5 and wounds dozens',
      'Bombs hit a camp in eastern Congo, the army said.',
    ],
    [
      'territorial change',
      'M23 seizes Walikale in North Kivu',
      'The rebels captured the town in eastern Democratic Republic of Congo.',
    ],
  ])('keeps %s', (_label, title, summary) => {
    expect(admit(a(`pos-${_label}`, title, summary))).toBe(true);
  });

  it('eastern scope and Congo-Brazzaville rejection are unchanged', () => {
    expect(admit(COG)).toBe(false);
    expect(admit(COG_EASTERN)).toBe(false);
    expect(admit(KINSHASA_POLITICS)).toBe(false);
    expect(admit(FR_LOCAL)).toBe(true);
  });

  it('Q2 end to end: capsize dropped, conflict evidence kept, syndicated copies collapse', async () => {
    const calls: Call[] = [];
    const gnews = stub(
      'gnews',
      (lang) =>
        lang === 'fr'
          ? [FR_LOCAL]
          : [LAKE_KIVU_CAPSIZE, EN_SECURITY, SYNDICATED_A, SYNDICATED_B, EN_DISPLACED],
      calls,
    );
    const { service, inputs } = await services([gnews]);

    const result = await service.analyzeNews(Q2, 'en');

    const ids = result.articles.map((x) => x.id);
    expect(ids).not.toContain('kivu-boat');
    expect(ids).toEqual(expect.arrayContaining(['en-hum', 'fr-loc']));
    expect(inputs).toHaveLength(1);
    /* SYNDICATED_A/B are one story: they never count as two independent clusters. */
    const syndicated = ids.filter((id) => id === 'syn-a' || id === 'syn-b');
    expect(syndicated.length).toBeLessThanOrEqual(1);
  });

  it('only the capsize in the pool → zero qualifying evidence → no model call', async () => {
    const { service, inputs } = await services([stub('gnews', () => [LAKE_KIVU_CAPSIZE], [])]);
    const result = await service.analyzeNews(Q2, 'en');
    expect(result.articles).toEqual([]);
    expect(result.analysis).toBeNull();
    expect(inputs).toHaveLength(0);
  });
});

describe('BETA-ASK-004 · the governed local lane is not starved by an early provider limit', () => {
  it('a rate limit on the THIRD search still leaves the French lane executed and admitted', async () => {
    const calls: Call[] = [];
    let n = 0;
    const gnews = {
      ...stub('gnews', () => [], calls),
      async search(q: string, options?: { lang?: string }) {
        calls.push({ providerId: 'gnews', q, ...(options?.lang ? { lang: options.lang } : {}) });
        n += 1;
        if (n >= 3) throw new GNewsProviderError('GNews rate limit reached.', 429, 'rate-limited');
        return options?.lang === 'fr' ? [FR_LOCAL] : [EN_SECURITY];
      },
    } as unknown as NewsProvider;
    const { service } = await services([gnews]);

    const result = await service.analyzeNews(Q2, 'en');

    expect(calls.map((c) => c.lang ?? 'en')).toEqual(['en', 'fr', 'en']);
    expect(result.articles.map((x) => x.id).sort()).toEqual(['en-sec', 'fr-loc']);
    const fr = result.articles.find((x) => x.id === 'fr-loc')!;
    expect(fr.sourceLanguage).toBe('fr');
  });

  it('plan searches are paced; the number of searches is unchanged', async () => {
    const at: number[] = [];
    const gnews = {
      ...stub('gnews', () => [], []),
      async search() {
        at.push(Date.now());
        return [];
      },
    } as unknown as NewsProvider;
    const { service } = await services([gnews]);
    COMPOUND_PLAN_PACING.spacingMs = 40;
    try {
      await service.analyzeNews(Q2, 'en');
    } finally {
      COMPOUND_PLAN_PACING.spacingMs = 0;
    }
    expect(at).toHaveLength(4);
    for (let i = 1; i < at.length; i += 1) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(35);
  });
});
