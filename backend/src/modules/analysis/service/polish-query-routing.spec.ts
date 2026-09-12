import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

/**
 * G-ALPHA-2.1 (A + D) ACCEPTANCE — POLISH STAGE 2, END TO END.
 *
 * Runs the shipped AnalysisService with `requestedLanguage: 'pl'`. The stubs
 * apply the REAL, UNMODIFIED relevance functions at the same boundaries the
 * real services apply them — including `scoreCountryRelevance(article, country,
 * 'pl')`, which is how a Polish article is matched to a country today.
 *
 * The load-bearing claim under test is not only "Polish now routes", but "Polish
 * still retrieves in Polish": a Polish question must never be answered by an
 * English-language provider call it did not ask for.
 */

interface Call {
  kind: 'search' | 'topHeadlines' | 'country';
  query: string;
  lang?: string;
}

function article(id: string, title: string, summary: string): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://wire.example/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-29T06:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
  } as NewsArticle;
}

function harness(corpus: NewsArticle[]) {
  const calls: Call[] = [];

  const newsService = {
    search: jest.fn(
      async (query: string, _limit?: number, mode?: { type?: string }): Promise<NewsResponse> => {
        calls.push({ kind: 'search', query });

        const articles =
          mode?.type === 'generic'
            ? corpus.filter((candidate) => scoreGenericRelevance(candidate, query).isRelevant)
            : corpus;

        return {
          articles,
          totalResults: articles.length,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: new Date().toISOString(),
        } as NewsResponse;
      },
    ),
    topHeadlines: jest.fn(
      async (_limit?: number, options?: { lang?: string; q?: string }): Promise<NewsResponse> => {
        calls.push({ kind: 'topHeadlines', query: options?.q ?? '', lang: options?.lang });

        return {
          articles: corpus,
          totalResults: corpus.length,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: new Date().toISOString(),
        } as NewsResponse;
      },
    ),
    findArticleById: jest.fn(async () => null),
  };

  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      calls.push({ kind: 'country', query: identifier });

      const country = resolveCountryByAnyIdentifier(identifier);
      const articles = country
        ? corpus.filter((candidate) => scoreCountryRelevance(candidate, country).isRelevant)
        : [];

      return {
        countryCode: country?.iso3 ?? identifier,
        countryName: country?.name ?? identifier,
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: new Date().toISOString(),
      } as unknown as CountryNewsResponse;
    }),
  };

  const provider: AnalysisProvider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn(async () => {
      throw new Error('analysis provider reached');
    }),
  };

  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 2,
      retryBaseDelayMs: 300,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;

  return {
    service: new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      config,
    ),
    calls,
    provider,
  };
}

const PL_RU_UA = [
  article('p1', 'Rosja wznawia rozmowy o zbożu', 'Moskwa poinformowała o spotkaniu we wtorek.'),
  article(
    'p2',
    'Ukraina zgłasza nocne ataki',
    'Kijów podał, że sieć energetyczna została trafiona.',
  ),
  article('p3', 'Opady były powyżej średniej', 'Nie wymieniono żadnego kraju.'),
];

const PL_RW_KE = [
  article(
    'p4',
    'Rwanda ogłasza nowy plan inwestycyjny',
    'Kigali podało, że program rusza w październiku.',
  ),
  article('p5', 'Kenia utrzymuje stopy procentowe', 'Nairobi pozostawiło poziom bez zmian.'),
];

describe('POLISH MULTI-ENTITY AND COMPARISON NOW ROUTE — AND RETRIEVE IN POLISH', () => {
  it('"Co dzieje się między Rosją a Ukrainą?" retrieves both sides', async () => {
    const { service, calls } = harness(PL_RU_UA);

    const response = await service.analyzeNews('Co dzieje się między Rosją a Ukrainą?', 'pl');

    expect(calls.map((call) => call.query)).toEqual(['Rosja', 'Ukraina']);
    expect(response.articles.length).toBeGreaterThan(0);
  });

  it('EVERY per-side Polish call is a Polish-language call — never an English search', async () => {
    const { service, calls } = harness(PL_RU_UA);

    await service.analyzeNews('Co dzieje się między Rosją a Ukrainą?', 'pl');

    expect(calls.every((call) => call.kind === 'topHeadlines')).toBe(true);
    expect(calls.every((call) => call.lang === 'pl')).toBe(true);
    expect(calls.some((call) => call.kind === 'search')).toBe(false);
  });

  it('the side terms are the POLISH country names, not the English ones', async () => {
    const { service, calls } = harness(PL_RW_KE);

    await service.analyzeNews('Porównaj sytuację w Rwandzie i Kenii', 'pl');

    expect(calls.map((call) => call.query)).toEqual(['Rwanda', 'Kenia']);
    expect(calls.map((call) => call.query)).not.toContain('Kenya');
  });

  it('the English pair is unchanged and still uses the English search path', async () => {
    const { service, calls } = harness(PL_RW_KE);

    await service.analyzeNews('Compare the current situations in Rwanda and Kenya.', 'en');

    expect(calls.every((call) => call.kind === 'search')).toBe(true);
    expect(calls.map((call) => call.query)).toEqual(['Rwanda', 'Kenya']);
  });

  it('Polish evidence is admitted by the same country gate, in Polish', async () => {
    const { service } = harness(PL_RU_UA);

    const response = await service.analyzeNews('Co dzieje się między Rosją a Ukrainą?', 'pl');

    // The third article names no country and is rejected by the real gate.
    expect(response.articles.map((item) => item.id).sort()).toEqual(['p1', 'p2']);
  });
});

describe('POLISH CLARIFICATION — asks rather than inventing, and spends no provider call', () => {
  it('"Które państwo jest silniejsze w Afryce Wschodniej?" makes no provider call', async () => {
    const { service, calls, provider } = harness(PL_RW_KE);

    const response = await service.analyzeNews(
      'Które państwo jest silniejsze w Afryce Wschodniej?',
      'pl',
    );

    expect(calls).toEqual([]);
    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  });
});

describe('POLISH EXPLANATION — the subject fills the gap the M47 derivation leaves', () => {
  it('a long-form Polish explanation searches the concept, not the sentence', async () => {
    const { service, calls } = harness([]);

    await service.analyzeNews('Wyjaśnij czym jest kwant i opowiedz o tym więcej', 'pl');

    expect(calls[0].kind).toBe('topHeadlines');
    expect(calls[0].lang).toBe('pl');
    expect(calls[0].query).toBe('kwant');
  });

  it('an M47 shape keeps its own topic — the classifier is ignored when the derivation worked', async () => {
    const { service, calls } = harness([]);

    await service.analyzeNews('Co dzieje się teraz w Polsce?', 'pl');

    expect(calls[0].query).toBe('Polsce');
  });
});

describe('NO POLISH ROUTE WAS TAKEN AWAY', () => {
  it('an ordinary Polish question still uses the M47 staged Polish path', async () => {
    const { service, calls } = harness([]);

    await service.analyzeNews('Polska, bezpieczeństwo', 'pl');

    expect(calls[0].kind).toBe('topHeadlines');
    expect(calls[0].lang).toBe('pl');
  });

  it('zero Polish evidence still means the analysis provider is never called', async () => {
    const { service, provider } = harness([
      article('pz', 'Opady były powyżej średniej', 'Nie wymieniono żadnego kraju.'),
    ]);

    const response = await service.analyzeNews('Co dzieje się między Rosją a Ukrainą?', 'pl');

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  });
});

describe('G-ALPHA-2.1 (C) — MORE COUNTRIES THAN CAN BE RETRIEVED, IN BOTH LANGUAGES', () => {
  it('English: six named countries asks rather than answering from three', async () => {
    const { service, calls, provider } = harness(PL_RW_KE);

    const response = await service.analyzeNews(
      'Compare Nigeria, Kenya, Rwanda, Uganda, Tanzania and Ethiopia',
      'en',
    );

    expect(calls).toEqual([]);
    expect(response.articles).toEqual([]);
    expect(response.retrievalContext.articlesRetrieved).toBe(0);
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('Polish: the same ceiling behaves the same way', async () => {
    const { service, calls } = harness(PL_RW_KE);

    await service.analyzeNews('Porównaj Nigerię, Kenię, Rwandę i Ugandę', 'pl');

    expect(calls).toEqual([]);
  });

  it('exactly three is still retrieved — the ceiling was not lowered', async () => {
    const { service, calls } = harness(PL_RW_KE);

    await service.analyzeNews('Compare the economies of Nigeria, Kenya and Rwanda', 'en');

    expect(calls.map((call) => call.query)).toEqual(['Nigeria', 'Kenya', 'Rwanda']);
  });
});
