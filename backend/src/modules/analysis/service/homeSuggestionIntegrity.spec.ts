import {
  ANALYSIS_TOTAL_BUDGET_MS,
  HOME_SUGGESTED_QUESTIONS,
  resolveCountryByAnyIdentifier,
  type CountryNewsResponse,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { AnalysisService } from './analysis.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LANE E — HOME SUGGESTION & FIRST-TURN RETRIEVAL INTEGRITY R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every shipped Home suggestion, in EN and PL, through the REAL AnalysisService
 * routing (normalization → intent → provider-safe derivation → the real
 * generic relevance gate → the zero-evidence rule), against realistic headlines.
 *
 * WHAT THIS PROVES: our own routing does not make a suggestion impossible to
 * answer. WHAT IT DOES NOT CLAIM: that a live provider will have a matching
 * article on any given day. Retrieval is a recording stub; no network, no
 * provider quota, and the analysis provider is the mock.
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

/* Unrelated reporting present in every pool, so admission is really tested. */
const DISTRACTORS = [
  a('x-1', 'Football: late goal settles the derby', 'The home side won 2-1 on Saturday.'),
  a('x-2', 'Storm warning issued for the Atlantic coast', 'Forecasters expect strong winds overnight.'),
];

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


interface SuggestionCase {
  readonly question: string;
  readonly language: 'en' | 'pl';
  /** The provider-safe retrieval the routing must produce. */
  readonly expectedQuery: string;
  /** A realistic article the suggestion must be able to admit. */
  readonly target: NewsArticle;
}

const EN = HOME_SUGGESTED_QUESTIONS.en;
const PL = HOME_SUGGESTED_QUESTIONS.pl;

const CASES: readonly SuggestionCase[] = [
  {
    question: EN[0],
    language: 'en',
    expectedQuery: 'Middle East',
    target: a('me-en', 'Middle East ceasefire talks resume in Cairo', 'Negotiators from across the Middle East met on Monday.'),
  },
  {
    question: EN[1],
    language: 'en',
    expectedQuery: 'EU AI regulation',
    target: a('eu-en', 'EU AI Act: what the new AI regulation means for companies', 'The EU AI regulation sets obligations for providers of high-risk systems.'),
  },
  {
    question: EN[2],
    language: 'en',
    expectedQuery: 'ECB interest rates',
    target: a('ecb-en', 'ECB holds interest rates steady as inflation eases', 'The European Central Bank kept its deposit rate unchanged on Thursday.'),
  },
  {
    question: EN[3],
    language: 'en',
    expectedQuery: 'IPCC climate report',
    target: a('ipcc-en', 'IPCC climate report warns warming is accelerating', 'Scientists behind the report urged faster emission cuts.'),
  },
  {
    question: EN[4],
    language: 'en',
    expectedQuery: 'tech earnings',
    target: a('tech-en', 'Tech earnings: Apple and Microsoft beat forecasts', 'Big technology companies reported strong quarterly results.'),
  },
  {
    question: EN[5],
    language: 'en',
    expectedQuery: 'OPEC oil production',
    target: a('opec-en', 'OPEC+ agrees to raise oil production from November', 'The group of oil producers said output would rise gradually.'),
  },
  {
    question: PL[0],
    language: 'pl',
    expectedQuery: 'Bliskim Wschodzie',
    target: a('me-pl', 'Napięcia na Bliskim Wschodzie: rozmowy o rozejmie wznowione', 'Negocjatorzy spotkali się w Kairze w poniedziałek.'),
  },
  {
    question: PL[1],
    language: 'pl',
    expectedQuery: 'przepisy UE o sztucznej inteligencji',
    target: a('eu-pl', 'Nowe przepisy UE o sztucznej inteligencji wchodzą w życie', 'Unijne rozporządzenie nakłada obowiązki na dostawców systemów AI.'),
  },
  {
    question: PL[2],
    language: 'pl',
    expectedQuery: 'stopy procentowe EBC',
    target: a('ecb-pl', 'EBC pozostawił stopy procentowe bez zmian', 'Europejski Bank Centralny utrzymał stopę depozytową.'),
  },
  {
    question: PL[3],
    language: 'pl',
    expectedQuery: 'raport klimatyczny IPCC',
    target: a('ipcc-pl', 'Raport klimatyczny IPCC: ocieplenie przyspiesza', 'Naukowcy wzywają do szybszej redukcji emisji.'),
  },
  {
    question: PL[4],
    language: 'pl',
    expectedQuery: 'wyniki finansowe firm technologicznych',
    target: a('tech-pl', 'Wyniki finansowe firm technologicznych przebiły prognozy', 'Apple i Microsoft pokazały mocne wyniki kwartalne.'),
  },
  {
    question: PL[5],
    language: 'pl',
    expectedQuery: 'wydobycie ropy OPEC',
    target: a('opec-pl', 'OPEC+ zwiększy wydobycie ropy od listopada', 'Kraje kartelu naftowego stopniowo podniosą produkcję.'),
  },
];

describe('Home suggestion integrity — the shipped list is exactly what is tested', () => {
  it('six suggestions per language, each with exactly one integrity case', () => {
    expect(EN).toHaveLength(6);
    expect(PL).toHaveLength(6);
    expect(CASES.map((c) => c.question).sort()).toEqual([...EN, ...PL].sort());
  });

  it('no suggestion leans on unbound context ("today’s … announcement", "the election")', () => {
    for (const q of [...EN, ...PL]) {
      expect(q).not.toMatch(/today[’']s .*announcement|central bank announcement|the election polling|ogłoszenie banku centralnego/i);
    }
  });
});

describe.each(CASES)('$language · $question', ({ question, language, expectedQuery, target }) => {
  it('routes to a provider-safe subject, admits the realistic article, needs no clarification, and runs exactly one analysis', async () => {
    const h = harness([target, ...DISTRACTORS]);
    const r = await h.service.analyzeNews(question, language);

    /* Derivation: the conversational framing is gone, the subject remains. */
    expect(h.searchCalls[0]).toBe(expectedQuery);
    /* No hidden context required: never a clarification. */
    expect(r.retrievalContext.retrievalOutcome).not.toBe('CLARIFICATION_REQUIRED');
    /* The realistic article survives the real relevance gate; distractors do not. */
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    const sent = h.providerInputs[0].articles.map((article) => article.id);
    expect(sent).toContain(target.id);
    expect(sent).not.toContain('x-1');
    /* The reader's own question is what the model receives. */
    expect(h.providerInputs[0].query).toBe(question.replace(/’/g, "'"));
    /* A topic suggestion, not a country feed that would ignore the topic. */
    expect(h.countryCalls).toEqual([]);
  });

  it('with nothing relevant available, it spends zero AI calls', async () => {
    const h = harness([...DISTRACTORS]);
    const r = await h.service.analyzeNews(question, language);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.analysis).toBeNull();
  });
});

describe('Gate E-A regression — the old central-bank suggestion, measured', () => {
  it('"Summarize today’s central bank announcement" no longer sends the whole sentence to the provider', async () => {
    const h = harness([...DISTRACTORS]);
    await h.service.analyzeNews('Summarize today’s central bank announcement', 'en');
    expect(h.searchCalls[0]).toBe('central bank announcement');
    expect(h.searchCalls.join(' ')).not.toMatch(/summari[sz]e|today/i);
  });
});
