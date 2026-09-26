import {
  ANALYSIS_TOTAL_BUDGET_MS,
  resolveCountryByAnyIdentifier,
  type CountryNewsResponse,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import {
  buildAnalysisMessages,
  buildEvidenceReferences,
} from '../prompt/build-analysis-prompt.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { AnalysisService } from './analysis.service';

/**
 * ASK CONVERSATIONAL EVIDENCE ANCHORING R1 — the Product Owner's exact two
 * turns and the adversarial fixtures, through the REAL AnalysisService with
 * recording stubs for retrieval and the provider. Every text here is a
 * controlled fixture; no user conversation is logged.
 */

const T1 = 'What caused the plane crash in Congo?';
const T2 =
  'Does this influence the neighboring countries? how had its the effect and who are involved. why is it a great concern now?';
const COD_CONTEXT = { title: 'Congo - Kinshasa', countryCode: 'COD' };

const a = (id: string, title: string, summary: string): NewsArticle =>
  ({
    id,
    title,
    summary,
    url: `https://wire.example/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    countryCode: 'CD',
    publishedAt: '2026-09-25T10:00:00.000Z',
    publishedAtBasis: 'publisher',
  }) as NewsArticle;

const CRASH = [
  a(
    'crash-1',
    'Military plane crashes in eastern DR Congo, killing senior officers',
    'The Congolese army confirmed the crash near Goma; the cause is under investigation.',
  ),
  a(
    'crash-2',
    'DR Congo army confirms deaths of generals in plane crash',
    'Officials said an inquiry had been opened; no cause was given.',
  ),
  a(
    'crash-3',
    'Plane crash in Congo kills army commanders, officials say',
    'The aircraft went down shortly after take-off from Goma airport.',
  ),
  a(
    'crash-4',
    'Congo mourns officers killed in military plane crash',
    'President ordered national mourning; investigators have not determined the cause.',
  ),
];
/* A context-only health story whose OWN text matches the follow-up's words. */
const EBOLA = a(
  'ebola-1',
  'WHO warns of Ebola outbreak spreading in DR Congo',
  'The World Health Organization said cases were rising and neighbouring countries were on alert.',
);
/* An unrelated event in the same country. */
const MINE = a(
  'mine-1',
  'DR Congo cobalt exports rise as prices recover',
  'Mining revenue grew in the third quarter.',
);
/* A context-only security story. */
const M23 = a(
  'm23-1',
  'M23 rebels advance near Goma in DR Congo',
  'Fighting displaced thousands in North Kivu.',
);
/* An unrelated event in a neighbouring country. */
const UGANDA = a(
  'uganda-1',
  'Uganda reports Ebola case near DR Congo border',
  'Health officials traced contacts.',
);
/* An article mentioning both subjects without linking them. */
const BOTH = a(
  'both-1',
  'DR Congo mourns plane crash victims as Ebola spreads to neighbouring countries',
  'Health officials warned of rising cases.',
);
/* A genuine source that explicitly reports a cross-border consequence. */
const GENUINE = a(
  'genuine-1',
  'Rwanda closes border after DR Congo plane crash',
  'Neighbouring Rwanda closed the crossing in response to the plane crash, officials said.',
);

type Corpus = readonly NewsArticle[];

function harness(
  corpus: Corpus,
  decorate?: (raw: Record<string, unknown>, input: AnalysisProviderInput) => void,
) {
  const searchCalls: string[] = [];
  const countryCalls: string[] = [];
  const providerInputs: AnalysisProviderInput[] = [];
  const now = () => new Date().toISOString();
  const newsService = {
    search: jest.fn(
      async (query: string, _l?: number, mode?: { type?: string }): Promise<NewsResponse> => {
        searchCalls.push(query);
        const articles =
          mode?.type === 'generic'
            ? corpus.filter((c) => scoreGenericRelevance(c, query).isRelevant)
            : [...corpus];
        return {
          articles,
          totalResults: articles.length,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: now(),
        } as NewsResponse;
      },
    ),
    topHeadlines: jest.fn(async () => ({
      articles: [],
      totalResults: 0,
      providers: ['gnews'],
      dataMode: 'live',
      generatedAt: now(),
    })),
    findArticleById: jest.fn(async (id: string) => corpus.find((c) => c.id === id) ?? null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      countryCalls.push(identifier);
      const country = resolveCountryByAnyIdentifier(identifier);
      const articles = country
        ? corpus.filter((c) => scoreCountryRelevance(c, country).isRelevant)
        : [];
      return {
        countryCode: country?.iso3 ?? identifier,
        countryName: country?.name ?? identifier,
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: now(),
      } as unknown as CountryNewsResponse;
    }),
  };
  const mock = new MockAnalysisProvider();
  const provider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn(async (input: AnalysisProviderInput) => {
      providerInputs.push(input);
      const raw = (await mock.analyzeNews(input)) as Record<string, unknown>;
      decorate?.(raw, input);
      return raw;
    }),
  };
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
      retryAttempts: 0,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    newsService as never,
    countryNewsService as never,
    provider as never,
    config,
  );
  return { service, searchCalls, countryCalls, providerInputs, provider };
}

const relationsById = (input: AnalysisProviderInput) =>
  Object.fromEntries(
    input.articles.map((article, i) => [article.id, input.eventEvidenceRelations?.[i]]),
  );

const promptFor = (input: AnalysisProviderInput) =>
  buildAnalysisMessages(
    input.query,
    input.articles,
    1200,
    undefined,
    'en',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    input.eventAnchor,
    input.eventEvidenceRelations,
  );

describe('Turn 1 — "What caused the plane crash in Congo?"', () => {
  it('interprets DR Congo FROM THE EVENT EVIDENCE, with provenance, in exactly one search', async () => {
    const h = harness([...CRASH, EBOLA, MINE]);
    const r = await h.service.analyzeNews(T1, 'en');

    expect(h.searchCalls).toEqual(['plane crash Congo']);
    expect(h.countryCalls).toEqual([]);
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    expect(r.retrievalContext.countryCode).toBe('COD');
    const anchor = r.retrievalContext.eventAnchor!;
    expect(anchor).toMatchObject({
      topic: 'plane crash',
      source: 'current-question',
      countryIso3: 'COD',
    });
    expect(anchor.disclosures).toEqual([
      'COUNTRY_INTERPRETED_FROM_EVIDENCE',
      'CAUSE_NOT_ESTABLISHED',
    ]);
    expect(anchor.contextArticleIds).toEqual([]);
    /* Only crash reporting reached the model, each labelled as the event itself. */
    expect(new Set(Object.values(relationsById(h.providerInputs[0])))).toEqual(
      new Set(['DIRECT_EVENT']),
    );
    expect(promptFor(h.providerInputs[0]).system).toContain(
      'No evidence item establishes what caused the plane crash.',
    );
  });

  it('asks the reader to choose when the event evidence does not settle which Congo', async () => {
    const bare = [
      a(
        'bare-1',
        'Plane crash in Congo kills army commanders',
        'Officials gave no further detail.',
      ),
      a('bare-2', 'Congo mourns officers killed in plane crash', 'An inquiry was opened.'),
    ];
    const h = harness(bare);
    const r = await h.service.analyzeNews(T1, 'en');

    expect(h.searchCalls).toHaveLength(1);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.analysis).toBeNull();
    expect(r.articles).toEqual([]);
    expect(r.retrievalContext).toMatchObject({
      retrievalOutcome: 'CLARIFICATION_REQUIRED',
      clarificationReason: 'AMBIGUOUS_COUNTRY',
      clarificationCandidates: ['COD', 'COG'],
    });
    expect(r.retrievalContext.countryCode).toBeUndefined();
  });

  it('a bare ambiguous place with no event to test asks the reader, with no provider call at all', async () => {
    const h = harness([...CRASH]);
    const r = await h.service.analyzeNews('Congo?', 'en');
    expect(h.searchCalls).toEqual([]);
    expect(h.countryCalls).toEqual([]);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.retrievalContext.clarificationReason).toBe('AMBIGUOUS_COUNTRY');
  });

  it('a qualified name is never ambiguous: "DR Congo" goes straight to the country', async () => {
    const h = harness([...CRASH, EBOLA]);
    const r = await h.service.analyzeNews('What caused the plane crash in DR Congo?', 'en');
    expect(r.retrievalContext.retrievalOutcome).toBeUndefined();
    expect(r.retrievalContext.countryCode).toBe('COD');
    expect(r.retrievalContext.eventAnchor?.disclosures).not.toContain(
      'COUNTRY_INTERPRETED_FROM_EVIDENCE',
    );
  });
});

describe('Turn 2 — the anaphoric follow-up stays anchored to the crash', () => {
  it('with the map-selected DR Congo context: crash is DIRECT_EVENT, Ebola and cobalt are CONTEXT_ONLY', async () => {
    const h = harness([...CRASH, EBOLA, MINE]);
    const r = await h.service.analyzeNews(T2, 'en', COD_CONTEXT, T1);

    expect(h.countryCalls).toEqual(['COD']);
    expect(h.searchCalls).toEqual([]);
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    const anchor = r.retrievalContext.eventAnchor!;
    expect(anchor).toMatchObject({
      topic: 'plane crash',
      source: 'prior-question',
      countryIso3: 'COD',
    });
    expect(anchor.contextArticleIds).toEqual(expect.arrayContaining(['ebola-1', 'mine-1']));
    expect(anchor.consequenceArticleIds).toEqual([]);
    expect(anchor.disclosures).toEqual([
      'COUNTRY_FROM_SELECTED_CONTEXT',
      'CAUSE_NOT_ESTABLISHED',
      'CROSS_BORDER_NOT_ESTABLISHED',
      'CONTEXT_SEPARATED',
    ]);

    const input = h.providerInputs[0];
    const relations = relationsById(input);
    expect(relations['ebola-1']).toBe('CONTEXT_ONLY');
    expect(relations['mine-1']).toBe('CONTEXT_ONLY');
    for (const id of input.articles.map((x) => x.id).filter((id) => id.startsWith('crash-'))) {
      expect(relations[id]).toBe('DIRECT_EVENT');
    }
    /* Event evidence is ordered before context. */
    const order = input.articles.map((x) => x.id);
    expect(order.indexOf('ebola-1')).toBeGreaterThan(
      Math.max(...order.filter((id) => id.startsWith('crash-')).map((id) => order.indexOf(id))),
    );

    const { system, user } = promptFor(input);
    expect(system).toContain(
      'The available reporting does not yet establish a direct impact on neighbouring countries from the plane crash itself.',
    );
    expect(system).toContain('Separate regional context');
    expect(system).toContain('Never use CONTEXT_ONLY evidence');
    expect(user).toMatch(/\[relation: CONTEXT_ONLY\] "WHO warns of Ebola outbreak/);
  });

  it('with only the prior question: the crash is re-anchored from Turn 1, in one search', async () => {
    const h = harness([...CRASH, EBOLA, MINE]);
    const r = await h.service.analyzeNews(T2, 'en', undefined, T1);
    expect(h.searchCalls).toEqual(['plane crash Congo']);
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    expect(r.retrievalContext.eventAnchor).toMatchObject({
      topic: 'plane crash',
      source: 'prior-question',
      countryIso3: 'COD',
    });
    expect(r.retrievalContext.eventAnchor?.disclosures).toEqual([
      'COUNTRY_INTERPRETED_FROM_EVIDENCE',
      'CAUSE_NOT_ESTABLISHED',
      'CROSS_BORDER_NOT_ESTABLISHED',
    ]);
  });

  it('a spillover claim cited ONLY to the Ebola context is withheld; a crash-cited impact is kept', async () => {
    const h = harness([...CRASH, EBOLA, MINE], (raw, input) => {
      const ids = new Map(
        buildEvidenceReferences(input.articles).map((ref) => [ref.articleId, ref.evidenceId]),
      );
      const ebola = input.articles.find((x) => x.id === 'ebola-1')!;
      const crash = input.articles.find((x) => x.id === 'crash-2')!;
      const claim = (article: NewsArticle, text: string) => ({
        claim: text,
        evidenceIds: [ids.get(article.id)],
        evidenceBasis: { evidenceId: ids.get(article.id), excerpt: article.title },
        relationshipAssessmentIds: [],
      });
      raw.spilloverImplications = [claim(ebola, 'Neighbouring countries are on alert.')];
      raw.immediateImpacts = [claim(crash, 'DR Congo army generals were killed.')];
    });
    const r = await h.service.analyzeNews(T2, 'en', COD_CONTEXT, T1);
    expect(r.analysis).not.toBeNull();
    expect(r.analysis!.spilloverImplications ?? []).toEqual([]);
    expect((r.analysis!.immediateImpacts ?? []).map((p) => p.claim)).toEqual([
      'DR Congo army generals were killed.',
    ]);
    expect(r.retrievalContext.eventAnchor?.contextOnlyClaimsWithheld).toBe(1);
  });
});

describe('adversarial fixtures — context never becomes consequence; genuine consequence is admitted', () => {
  it('same-country, neighbouring, health, security and both-subjects stories are never consequences', async () => {
    /* Two crash reports keep the fixture inside the 8-article model budget, so every adversarial item reaches the model. */
    const h = harness([CRASH[0], CRASH[1], EBOLA, MINE, M23, UGANDA, BOTH]);
    const r = await h.service.analyzeNews(T2, 'en', COD_CONTEXT, T1);
    const anchor = r.retrievalContext.eventAnchor!;
    const relations = relationsById(h.providerInputs[0]);
    expect(relations).toMatchObject({
      'ebola-1': 'CONTEXT_ONLY',
      'mine-1': 'CONTEXT_ONLY',
      'm23-1': 'CONTEXT_ONLY',
      'uganda-1': 'CONTEXT_ONLY',
      'both-1': 'DIRECT_EVENT',
    });
    expect(anchor.consequenceArticleIds).toEqual([]);
    expect(anchor.disclosures).toContain('CROSS_BORDER_NOT_ESTABLISHED');
  });

  it('a genuine source explicitly reporting a cross-border consequence is admitted as REPORTED_CONSEQUENCE', async () => {
    const h = harness([...CRASH, EBOLA, GENUINE]);
    const r = await h.service.analyzeNews(T2, 'en', COD_CONTEXT, T1);
    const anchor = r.retrievalContext.eventAnchor!;
    expect(anchor.consequenceArticleIds).toEqual(['genuine-1']);
    expect(relationsById(h.providerInputs[0])['genuine-1']).toBe('REPORTED_CONSEQUENCE');
    expect(anchor.disclosures).not.toContain('CROSS_BORDER_NOT_ESTABLISHED');
    expect(promptFor(h.providerInputs[0]).system).not.toContain(
      'does not yet establish a direct impact on neighbouring countries',
    );
  });
});

describe('preserved contracts', () => {
  /* R1.1 B3 — ordinary analytical why/effect questions are NOT events. */
  const ANALYTICAL = [
    a(
      'eu-1',
      'EU AI regulation enters into force',
      'The AI regulation sets obligations for AI providers.',
    ),
    a(
      'pl-1',
      'Inflation in Poland stays high as food prices rise',
      'Polish inflation remained high in August.',
    ),
    a(
      'ir-1',
      'High interest rates weigh on borrowers',
      'The effects of high interest rates reached mortgages.',
    ),
    ...CRASH,
  ];
  it.each([
    'Why is AI regulation important?',
    'Why is inflation high in Poland?',
    'What are the effects of high interest rates?',
  ])('R1.1 B3: "%s" gets no anchor, no relation tags and a byte-identical prompt', async (q) => {
    const h = harness(ANALYTICAL);
    const r = await h.service.analyzeNews(q, 'en');
    expect(r.retrievalContext.eventAnchor).toBeUndefined();
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    const input = h.providerInputs[0];
    expect(input.eventAnchor).toBeUndefined();
    expect(input.eventEvidenceRelations).toBeUndefined();
    const base = buildAnalysisMessages(input.query, input.articles, 1200, undefined, 'en');
    expect(promptFor(input)).toEqual(base);
    expect(base.system).not.toContain('AUTHORITATIVE EVENT ANCHOR');
    expect(base.user).not.toContain('[relation:');
  });

  it('R1.1 B3: a "this" follow-up to a NON-event question keeps its pre-R1 routing (no prior-question re-anchoring)', async () => {
    const follow = 'Why does this matter for neighbouring countries?';
    const withPrior = harness(ANALYTICAL);
    const r = await withPrior.service.analyzeNews(
      follow,
      'en',
      undefined,
      'Why is AI regulation important?',
    );
    const alone = harness(ANALYTICAL);
    await alone.service.analyzeNews(follow, 'en');
    expect(r.retrievalContext.eventAnchor).toBeUndefined();
    expect(withPrior.searchCalls).toEqual(alone.searchCalls);
    expect(withPrior.countryCalls).toEqual(alone.countryCalls);
    expect(withPrior.searchCalls.join(' ')).not.toMatch(/regulation/i);
  });

  it.each([
    [
      'What were the effects of the earthquake?',
      'earthquake',
      [a('eq-1', 'Earthquake strikes eastern Turkey', 'The earthquake damaged buildings.')],
    ],
    [
      'Did the explosion affect neighbouring countries?',
      'explosion',
      [a('ex-1', 'Explosion at Beirut port', 'The explosion destroyed warehouses.')],
    ],
  ] as const)('R1.1 B3: genuine event — "%s" — is anchored', async (q, topic, corpus) => {
    const h = harness(corpus);
    const r = await h.service.analyzeNews(q, 'en');
    expect(r.retrievalContext.eventAnchor).toMatchObject({ topic, source: 'current-question' });
  });

  it('R1.1 B1: a chronological "after" story is event reporting, never a cross-border consequence', async () => {
    const chrono = a(
      'chrono-1',
      'After the DR Congo plane crash, officials discussed an unrelated Ebola outbreak',
      'Health officials said neighbouring countries were on alert.',
    );
    const h = harness([CRASH[0], CRASH[1], chrono, EBOLA]);
    const r = await h.service.analyzeNews(T2, 'en', COD_CONTEXT, T1);
    const anchor = r.retrievalContext.eventAnchor!;
    expect(relationsById(h.providerInputs[0])['chrono-1']).toBe('DIRECT_EVENT');
    expect(anchor.consequenceArticleIds).toEqual([]);
    expect(anchor.disclosures).toContain('CROSS_BORDER_NOT_ESTABLISHED');
  });

  it('a question that does not reason about an event gets no anchor and a byte-identical prompt', async () => {
    const h = harness([
      a('eu-1', 'EU AI Act enters into force', 'The regulation sets obligations for AI providers.'),
    ]);
    const r = await h.service.analyzeNews(
      'Explain the new EU AI regulation in plain English',
      'en',
    );
    expect(r.retrievalContext.eventAnchor).toBeUndefined();
    const input = h.providerInputs[0];
    expect(input.eventAnchor).toBeUndefined();
    const withAnchorArgs = promptFor(input);
    const without = buildAnalysisMessages(input.query, input.articles, 1200, undefined, 'en');
    expect(withAnchorArgs).toEqual(without);
    expect(withAnchorArgs.system).not.toContain('AUTHORITATIVE EVENT ANCHOR');
  });

  it('zero evidence for an anchored follow-up never reaches the provider', async () => {
    const h = harness([MINE]);
    const r = await h.service.analyzeNews(T2, 'en', undefined, T1);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.analysis).toBeNull();
  });

  it('PL: the anaphoric follow-up re-anchors to the prior question too', async () => {
    const h = harness([...CRASH, EBOLA]);
    const r = await h.service.analyzeNews(
      'Czy to wpływa na sąsiednie kraje?',
      'pl',
      COD_CONTEXT,
      T1,
    );
    expect(r.retrievalContext.eventAnchor).toMatchObject({
      topic: 'plane crash',
      source: 'prior-question',
    });
    expect(r.retrievalContext.eventAnchor?.disclosures).toContain('CROSS_BORDER_NOT_ESTABLISHED');
  });
});
