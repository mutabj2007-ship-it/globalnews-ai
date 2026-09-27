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
import { buildAnalysisMessages } from '../prompt/build-analysis-prompt.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { AnalysisService } from './analysis.service';

/**
 * ASK CONVERSATIONAL TOPIC CONTINUITY R1 — through the REAL AnalysisService with
 * recording stubs for retrieval and the provider (the Anchoring R1 harness).
 * Gate D-A: docs/ask-conversational-topic-continuity-r1.md. Every text here is
 * a controlled fixture; no user conversation is logged.
 */

const a = (id: string, title: string, summary: string, countryCode?: string): NewsArticle =>
  ({
    id,
    title,
    summary,
    url: `https://wire.example/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    ...(countryCode ? { countryCode } : {}),
    publishedAt: '2026-09-25T10:00:00.000Z',
    publishedAtBasis: 'publisher',
  }) as NewsArticle;

const CORPUS = [
  a('eu-1', 'EU AI Act: what the new AI regulation means', 'The EU AI regulation sets obligations for providers of high-risk AI systems.'),
  a('eu-2', 'European Union AI rules enter into force', 'The AI Act introduces transparency duties for general-purpose AI models.'),
  a('pl-1', 'Inflation in Poland stays high as food prices rise', 'Polish consumer prices rose again, the statistics office said.', 'PL'),
  a('ir-1', 'High interest rates squeeze the economy', 'Central bank interest rates weigh on growth and borrowing.'),
  a('sa-1', 'New sanctions on Russia target energy exports', 'The EU adopted sanctions on Russia covering oil and gas.'),
  a('crash-1', 'Military plane crashes in eastern DR Congo, killing senior officers', 'The Congolese army confirmed the crash near Goma.', 'CD'),
  a('crash-2', 'DR Congo army confirms deaths of generals in plane crash', 'Officials said an inquiry had been opened.', 'CD'),
];

const EU_T1 = 'Explain the new EU AI regulation in plain English';
const EU_T2 = 'how will this affect GlobalNewsAI in general? Should I be scared?';

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


const promptFor = (input: AnalysisProviderInput) =>
  buildAnalysisMessages(
    input.query,
    input.articles,
    1200,
    undefined,
    input.responseLanguage ?? 'en',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    input.eventAnchor,
    input.eventEvidenceRelations,
    input.conversationSubject,
  );

/** Runs one turn and returns what it did, measured. */
async function turn(h: ReturnType<typeof harness>, q: string, prior?: string, lang: 'en' | 'pl' = 'en') {
  const searchBefore = h.searchCalls.length;
  const countryBefore = h.countryCalls.length;
  const providerBefore = h.provider.analyzeNews.mock.calls.length;
  const r = await h.service.analyzeNews(q, lang, undefined, prior);
  return {
    r,
    search: h.searchCalls.slice(searchBefore),
    country: h.countryCalls.slice(countryBefore),
    providerCalls: h.provider.analyzeNews.mock.calls.length - providerBefore,
    input: h.provider.analyzeNews.mock.calls.length > providerBefore ? h.providerInputs[h.providerInputs.length - 1] : undefined,
  };
}

describe('1 — the live defect: EU AI regulation → "how will this affect GlobalNewsAI?"', () => {
  it('BEFORE (Gate D-A) Turn 2 searched its own words and found nothing; AFTER it retrieves the EU AI regulation with exactly one call', async () => {
    const h = harness(CORPUS);
    const t1 = await turn(h, EU_T1);
    const t2 = await turn(h, EU_T2, EU_T1);

    expect(t1.search).toEqual(['EU AI regulation']);
    expect(t1.providerCalls).toBe(1);

    expect(t2.search).toEqual(['EU AI regulation']);
    expect(t2.providerCalls).toBe(1);
    expect(t2.r.articles.map((x) => x.id)).toEqual(expect.arrayContaining(['eu-1', 'eu-2']));
    /* The reader's actual question is preserved separately from the retrieval meaning. */
    expect(t2.input!.query).toBe(EU_T2);
    expect(t2.r.retrievalContext.conversationSubject).toEqual({
      subject: 'EU AI regulation',
      /* D.1 — "GlobalNewsAI" is disclosed, never searched; "should I be scared" is framing. */
      focus: [],
      retrievalMeaning: 'EU AI regulation',
      source: 'prior-question',
      disclosures: ['PRODUCT_APPLICABILITY_NOT_ESTABLISHED'],
    });
    expect(t2.r.retrievalContext.eventAnchor).toBeUndefined();
  });

  it('GlobalNewsAI applicability: the prompt forbids inventing product facts and asks for what would need verifying', async () => {
    const h = harness(CORPUS);
    await turn(h, EU_T1);
    const t2 = await turn(h, EU_T2, EU_T1);
    const { system } = promptFor(t2.input!);
    expect(system).toContain('The question is a follow-up about: "EU AI regulation"');
    expect(system).toContain('NO evidence item and NO supplied source describes GlobalNewsAI');
    expect(system).toContain('exact applicability to GlobalNewsAI cannot be established');
    expect(system).toContain('which requirements of the subject would be relevant to verify');
  });

  it('a subject follow-up that is not about the product carries no product disclosure', async () => {
    const h = harness(CORPUS);
    const t2 = await turn(h, 'Why does this matter to AI companies?', EU_T1);
    const disclosures = t2.r.retrievalContext.conversationSubject?.disclosures ?? [];
    expect(disclosures).not.toContain('PRODUCT_APPLICABILITY_NOT_ESTABLISHED');
    /* D.1 — no EU report names "companies", and the answer is told so. */
    expect(disclosures).toContain('FOCUS_NOT_IN_EVIDENCE');
    expect(promptFor(t2.input!).system).not.toContain('GlobalNewsAI');
  });
});

describe('2–4 — the other required shapes', () => {
  it('2: "Why is inflation high in Poland?" → "Why does this matter to consumers?" keeps the Poland route', async () => {
    const h = harness(CORPUS);
    const t1 = await turn(h, 'Why is inflation high in Poland?');
    const t2 = await turn(h, 'Why does this matter to consumers?', 'Why is inflation high in Poland?');
    expect(t2.country).toEqual(t1.country);
    expect(t2.country).toEqual(['POL']);
    expect(t2.providerCalls).toBe(1);
    expect(t2.input!.query).toBe('Why does this matter to consumers?');
    expect(t2.r.retrievalContext.conversationSubject?.subject).toBe('inflation high Poland');
  });

  it('3: "What are high interest rates doing to the economy?" → "What about businesses?" routes exactly as Turn 1 did', async () => {
    const h = harness(CORPUS);
    const t1 = await turn(h, 'What are high interest rates doing to the economy?');
    const t2 = await turn(h, 'What about businesses?', 'What are high interest rates doing to the economy?');
    /*
      Continuity is exact: Turn 2 performs Turn 1's retrieval. Turn 1 itself
      finds nothing here — a Turn-1 recall gap recorded in Gate D-A and out of
      D's scope — so both turns honestly spend zero AI calls.
    */
    expect(t2.search).toEqual(t1.search);
    expect(t2.search).not.toContain('businesses');
    expect(t2.r.retrievalContext.conversationSubject?.source).toBe('prior-question');
    expect(t1.providerCalls + t2.providerCalls).toBe(0);
  });

  it('4: "Explain the sanctions on Russia" → "How could this affect Poland?" continues the sanctions subject', async () => {
    const h = harness(CORPUS);
    await turn(h, 'Explain the sanctions on Russia');
    const t2 = await turn(h, 'How could this affect Poland?', 'Explain the sanctions on Russia');
    expect(t2.search).toEqual(['sanctions on Russia']);
    expect(t2.r.articles.map((x) => x.id)).toContain('sa-1');
    expect(t2.input!.query).toBe('How could this affect Poland?');
    expect(t2.r.retrievalContext.conversationSubject?.subject).toBe('sanctions on Russia');
  });
});

describe('5–6 — current text outranks; nothing to inherit fails closed', () => {
  it('5: a new subject overrides — "What about inflation in Poland?" is a fresh question, never EU + inflation', async () => {
    const h = harness(CORPUS);
    const t2 = await turn(h, 'What about inflation in Poland?', EU_T1);
    expect(t2.r.retrievalContext.conversationSubject).toBeUndefined();
    expect(t2.search.join(' ')).not.toMatch(/EU AI/);
    expect(t2.r.articles.map((x) => x.id)).not.toContain('eu-1');
  });

  it.each([
    ['What happened this week in Sudan?'],
    ['Is it true that inflation rose in Poland?'],
    ['Explain quantum computing'],
  ])('5: "%s" names its own subject and inherits nothing', async (q) => {
    const h = harness(CORPUS);
    const t2 = await turn(h, q, EU_T1);
    expect(t2.r.retrievalContext.conversationSubject).toBeUndefined();
    expect(t2.search).not.toContain('EU AI regulation');
  });

  it('6: an ambiguous "this" with no prior question fails closed — no subject, no evidence, no AI call', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'How will this affect GlobalNewsAI?');
    expect(t.r.retrievalContext.conversationSubject).toBeUndefined();
    expect(t.r.analysis).toBeNull();
    expect(t.providerCalls).toBe(0);
  });

  it('6: a prior question that itself only refers back supplies no subject', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'What about businesses?', 'How will this affect GlobalNewsAI?');
    expect(t.r.retrievalContext.conversationSubject).toBeUndefined();
    expect(t.providerCalls).toBe(0);
  });
});

describe('7 — EventAnchor conversations are unchanged', () => {
  it('the Congo crash follow-up is still anchored by the event authority, never by the subject path', async () => {
    const h = harness(CORPUS);
    const T1 = 'What caused the plane crash in Congo?';
    const t2 = await turn(h, 'Does this influence the neighboring countries?', T1);
    expect(t2.r.retrievalContext.eventAnchor).toMatchObject({ topic: 'plane crash', source: 'prior-question' });
    expect(t2.r.retrievalContext.conversationSubject).toBeUndefined();
    expect(t2.search).toEqual(['plane crash Congo']);
  });
});

describe('8 — prior AI prose never becomes evidence', () => {
  it('Turn 2 carries only the prior USER question: no Turn 1 answer prose, headline or conclusion reaches the prompt', async () => {
    /* Distinctive Turn 1 answer text, so any leak into Turn 2 is unmistakable. */
    const T1_HEADLINE = 'ZX-T1-HEADLINE The regulation is a turning point';
    const T1_SUMMARY = 'ZX-T1-SUMMARY The regulation will certainly reshape every news platform.';
    const h = harness(CORPUS, (raw, input) => {
      if (input.query !== EU_T1) return;
      raw.headline = T1_HEADLINE;
      raw.summary = T1_SUMMARY;
    });
    const t1 = await turn(h, EU_T1);
    expect(t1.r.analysis!.summary).toBe(T1_SUMMARY);
    const t2 = await turn(h, EU_T2, EU_T1);
    const { system, user } = promptFor(t2.input!);
    const prompt = `${system}\n${user}`;
    expect(prompt).not.toContain('ZX-T1');
    expect(JSON.stringify(t2.input)).not.toContain('ZX-T1');
    /* The subject passed to the model is a span of the user's own words. */
    expect(EU_T1).toContain(t2.input!.conversationSubject!.subject);
  });
});

describe('9–10 — language and EN/PL follow-up forms', () => {
  it('PL: "Jak to wpłynie na GlobalNewsAI?" continues the Polish subject, in Polish, with the product disclosure', async () => {
    const h = harness(CORPUS);
    const prior = 'Wyjaśnij nowe unijne przepisy o sztucznej inteligencji';
    const t = await turn(h, 'Jak to wpłynie na GlobalNewsAI?', prior, 'pl');
    expect(t.r.retrievalContext.conversationSubject).toEqual({
      subject: 'unijne przepisy o sztucznej inteligencji',
      focus: [],
      retrievalMeaning: 'unijne przepisy o sztucznej inteligencji',
      source: 'prior-question',
      disclosures: ['PRODUCT_APPLICABILITY_NOT_ESTABLISHED'],
    });
    expect(t.r.requestedLanguage).toBe('pl');
  });

  it('PL: "A co z firmami?" is an audience ellipsis and continues the subject', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'A co z firmami?', 'Dlaczego inflacja w Polsce jest wysoka?', 'pl');
    expect(t.r.retrievalContext.conversationSubject?.source).toBe('prior-question');
  });

  it('EN: the English "to" is not the Polish anaphor — "doing to the economy" is not a follow-up', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'What are high interest rates doing to the economy?', EU_T1);
    expect(t.r.retrievalContext.conversationSubject).toBeUndefined();
  });
});

describe('11–12 — compute invariants', () => {
  it('each explicit turn is at most one provider call; a subject follow-up with evidence is exactly one', async () => {
    const h = harness(CORPUS);
    expect((await turn(h, EU_T1)).providerCalls).toBe(1);
    expect((await turn(h, EU_T2, EU_T1)).providerCalls).toBe(1);
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(2);
  });

  it('zero evidence for the continued subject = zero AI calls', async () => {
    const h = harness([CORPUS[4]]);
    const t = await turn(h, EU_T2, EU_T1);
    expect(t.r.retrievalContext.conversationSubject?.subject).toBe('EU AI regulation');
    expect(t.r.analysis).toBeNull();
    expect(t.providerCalls).toBe(0);
  });

  it('the answer cache is keyed by the prior question, so a subject follow-up never replays a fresh one', async () => {
    const h = harness(CORPUS);
    await turn(h, EU_T2);
    const t = await turn(h, EU_T2, EU_T1);
    expect(t.r.retrievalContext.conversationSubject?.subject).toBe('EU AI regulation');
  });
});

/**
 * D.1 — FOLLOW-UP RETRIEVAL INTENT COMPOSITION.
 *
 * Retrieval meaning = INHERITED SUBJECT + CURRENT-TURN EVIDENCE-BEARING FOCUS.
 * The subject still decides what is fetched (every gate unchanged); the focus
 * decides which of that evidence reaches the model ahead of the 8-report cap,
 * and is disclosed when nothing retrieved addresses it.
 */
describe('D.1 — the current turn narrows the inherited subject', () => {
  /* Distinct stories, so duplicate clustering keeps them apart. */
  const POLAND_TOPICS = ['central bank holds rates', 'zloty weakens against euro', 'fuel tax debate in Sejm', 'food exporters report record year', 'rail strike ends in Warsaw', 'Gdansk port expansion approved', 'farm protests near border', 'energy grid upgrade funded', 'housing permits climb in Krakow'];
  const polandPool = [
    ...POLAND_TOPICS.map((topic, i) =>
      a(`pl-g${i}`, `Poland inflation and ${topic}`, `Poland: ${topic}, officials said.`, 'PL'),
    ),
    a('pl-consumers', 'Polish consumers cut spending as inflation bites', 'Households in Poland face higher bills.', 'PL'),
  ];
  const SANCTIONS_TOPICS = ['target shipping insurers', 'add diamond import ban', 'freeze bank assets', 'hit aluminium trade', 'curb software exports', 'list new oligarchs', 'close oil price cap loophole', 'restrict fertilizer sales', 'ban luxury car exports'];
  const sanctionsPool = [
    ...SANCTIONS_TOPICS.map((topic, i) =>
      a(`sa-g${i}`, `Sanctions on Russia ${topic}`, `The new sanctions on Russia ${topic}.`),
    ),
    a('sa-poland', 'Sanctions on Russia leave Poland facing gas price rise', 'Polish importers seek new suppliers.'),
  ];

  it('1: EU AI regulation → GlobalNewsAI: retrieval stays on the regulation; product and "scared" never enter it', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, EU_T2, EU_T1);
    const subject = t.r.retrievalContext.conversationSubject!;
    expect(subject.retrievalMeaning).toBe('EU AI regulation');
    expect(subject.focus).toEqual([]);
    expect(t.search).toEqual(['EU AI regulation']);
    expect(`${t.search.join(' ')} ${subject.retrievalMeaning}`).not.toMatch(/GlobalNewsAI|scared|general/i);
    expect(subject.disclosures).toContain('PRODUCT_APPLICABILITY_NOT_ESTABLISHED');
    expect(t.input!.query).toBe(EU_T2);
  });

  it('2: Poland inflation → consumers: the consumer report reaches the model FIRST, even from beyond the cap', async () => {
    const h = harness(polandPool);
    const t = await turn(h, 'Why does this matter to consumers?', 'Why is inflation high in Poland?');
    const subject = t.r.retrievalContext.conversationSubject!;
    expect(subject.retrievalMeaning).toBe('inflation high Poland consumers impact');
    expect(subject.focus).toEqual(['consumers']);
    expect(t.input!.articles[0].id).toBe('pl-consumers');
    expect(t.input!.articles).toHaveLength(8);
    expect(subject.disclosures).not.toContain('FOCUS_NOT_IN_EVIDENCE');

    /* Material: without the focus (the pre-D.1 prior-question-only retrieval), the cap drops it. */
    const control = harness(polandPool);
    const c = await turn(control, 'Why is inflation high in Poland?');
    expect(c.input!.articles.map((x) => x.id)).not.toContain('pl-consumers');
  });

  it('3: interest rates → businesses: the business focus is part of the retrieval meaning', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'What about businesses?', 'What are high interest rates doing to the economy?');
    const subject = t.r.retrievalContext.conversationSubject!;
    expect(subject.focus).toEqual(['businesses']);
    expect(subject.retrievalMeaning).toBe('high interest rates doing economy businesses');
    expect(subject.retrievalMeaning).not.toMatch(/what about/i);
  });

  it('4: sanctions → Poland: the Poland-linked sanctions report is selected first', async () => {
    const h = harness(sanctionsPool);
    const t = await turn(h, 'How could this affect Poland?', 'Explain the sanctions on Russia');
    const subject = t.r.retrievalContext.conversationSubject!;
    expect(subject.retrievalMeaning).toBe('sanctions on Russia Poland impact');
    expect(subject.focus).toEqual(['Poland']);
    expect(t.search).toEqual(['sanctions on Russia']);
    expect(t.input!.articles[0].id).toBe('sa-poland');
    expect(promptFor(t.input!).system).toContain("the reader's current focus is: Poland");
  });

  it('4: when no retrieved report addresses the focus, the answer says so instead of implying it', async () => {
    const h = harness(sanctionsPool.slice(0, 9));
    const t = await turn(h, 'How could this affect Poland?', 'Explain the sanctions on Russia');
    expect(t.r.retrievalContext.conversationSubject!.disclosures).toContain('FOCUS_NOT_IN_EVIDENCE');
    expect(promptFor(t.input!).system).toContain('No evidence item addresses Poland directly');
    expect(t.providerCalls).toBe(1);
  });

  it('5: a new unrelated subject still overrides — no inherited subject, no focus composition', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'What about inflation in Poland?', EU_T1);
    expect(t.r.retrievalContext.conversationSubject).toBeUndefined();
  });

  it('6: the EventAnchor path is unchanged — no subject, no focus reordering of event evidence', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'Does this influence the neighboring countries?', 'What caused the plane crash in Congo?');
    expect(t.r.retrievalContext.eventAnchor).toMatchObject({ topic: 'plane crash' });
    expect(t.r.retrievalContext.conversationSubject).toBeUndefined();
  });

  it('7: previous AI prose is absent from the composed retrieval meaning and the prompt', async () => {
    const h = harness(polandPool, (raw, input) => {
      if (input.query === 'Why is inflation high in Poland?') raw.summary = 'ZX-PRIOR-ANSWER inflation consumers wages';
    });
    await turn(h, 'Why is inflation high in Poland?');
    const t = await turn(h, 'Why does this matter to consumers?', 'Why is inflation high in Poland?');
    expect(t.r.retrievalContext.conversationSubject!.retrievalMeaning).not.toContain('ZX-PRIOR');
    const { system, user } = promptFor(t.input!);
    expect(`${system}\n${user}`).not.toContain('ZX-PRIOR');
  });

  it.each([
    ['A co z firmami?', ['firmami'], 'inflacja Polsce wysoka firmami'],
    ['Jak to wpłynie na konsumentów?', ['konsumentów'], 'inflacja Polsce wysoka konsumentów impact'],
  ])('8: PL "%s" keeps the Polish focus', async (followUp, focus, meaning) => {
    const h = harness(CORPUS);
    const t = await turn(h, followUp, 'Dlaczego inflacja w Polsce jest wysoka?', 'pl');
    expect(t.r.retrievalContext.conversationSubject).toMatchObject({ focus, retrievalMeaning: meaning });
  });

  it('8: EN aspects and targets are kept, conversational framing is not', async () => {
    const h = harness(CORPUS);
    const t = await turn(h, 'What about enforcement and timing?', EU_T1);
    expect(t.r.retrievalContext.conversationSubject).toMatchObject({
      focus: ['enforcement', 'timing'],
      retrievalMeaning: 'EU AI regulation enforcement timing',
    });
  });
});
