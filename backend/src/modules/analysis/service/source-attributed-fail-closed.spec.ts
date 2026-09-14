import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import {
  isAttributableToRequestedSource,
  resolveRequestedSource,
  type RequestedSource,
} from '../../news/identity/requested-source.util';
import {
  detectSourceAttributedIntent,
  deriveSourceAttributedQuery,
} from '../query/derive-source-attributed-query.util';
import { EAST_AFRICA } from '../region/declared-regions';

/**
 * REV C — AN UNRESOLVED PUBLISHER IS STILL A CONSTRAINT.
 *
 * THE DEFECT. R1 treated a source-attributed frame whose publisher did not
 * resolve as "no source intent", and let ordinary routing resume. I defended
 * that as a strict no-op. It is a no-op against exactly one risk — an
 * unrestricted topic search — and not against the branches that route on a
 * PLACE:
 *
 *   "What does Reuters report about Poland?"      -> country routing, answered
 *                                                   with any Polish reporting
 *   "What does Reuters report about East Africa?" -> eleven-member fan-out
 *
 * Both answer a question about Reuters with somebody else's reporting. Same
 * substitution, different road.
 *
 * The shipped AnalysisService runs for real below. NewsService and
 * CountryNewsService are stubbed at their own boundaries and apply the REAL,
 * UNMODIFIED gates and the REAL, UNMODIFIED attribution predicate exactly
 * where the services apply them. The analysis provider THROWS if reached, so
 * every "no OpenAI" claim is enforced by the harness rather than read off a
 * flag.
 */

interface Harness {
  service: AnalysisService;
  searchCalls: Array<{ query: string; requestedSourceId?: string }>;
  countryCalls: string[];
  provider: AnalysisProvider;
}

function harness(corpus: NewsArticle[], anchor?: NewsArticle): Harness {
  const searchCalls: Array<{ query: string; requestedSourceId?: string }> = [];
  const countryCalls: string[] = [];

  const newsService = {
    search: jest.fn(
      async (
        query: string,
        _limit?: number,
        mode?: { type?: string },
        options?: { requestedSource?: RequestedSource },
      ): Promise<NewsResponse> => {
        searchCalls.push({
          query,
          ...(options?.requestedSource
            ? { requestedSourceId: options.requestedSource.sourceId }
            : {}),
        });

        const gated =
          mode?.type === 'generic'
            ? corpus.filter((candidate) => scoreGenericRelevance(candidate, query).isRelevant)
            : corpus;

        const articles = options?.requestedSource
          ? gated.filter((candidate) =>
              isAttributableToRequestedSource(candidate, options.requestedSource!),
            )
          : gated;

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
      async (): Promise<NewsResponse> =>
        ({
          articles: [],
          totalResults: 0,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: new Date().toISOString(),
        }) as NewsResponse,
    ),
    findArticleById: jest.fn(async () => anchor ?? null),
    findRetainedByCountry: jest.fn(async () => []),
  };

  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      countryCalls.push(identifier);

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

  return {
    service: new AnalysisService(
      newsService as never,
      countryNewsService as never,
      provider,
      config,
    ),
    searchCalls,
    countryCalls,
    provider,
  };
}

/* ---------------------------------------------------------------- */
/* A corpus rich enough that every WRONG route would have produced   */
/* a confident, plausible answer.                                    */
/* ---------------------------------------------------------------- */

const POLISH_STORY: NewsArticle = {
  id: 'pl-1',
  title: 'Poland reports record industrial output',
  summary: 'Warsaw said Poland posted its strongest month of industrial output this year.',
  url: 'https://wiadomosci.wp.pl/przemysl-2026',
  sourceId: 'feed:wp-pl',
  sourceName: 'Wirtualna Polska — Wiadomości',
  countryCode: 'POL',
  category: 'business',
  sourcesCount: 1,
  publishedAt: '2026-09-05T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

const EAST_AFRICA_STORY: NewsArticle = {
  id: 'kt-1',
  title: 'East Africa trade corridor talks resume',
  summary: 'KT Press reports on East Africa trade corridor negotiations in Kigali.',
  url: 'https://www.ktpress.rw/2026/09/east-africa-corridor/',
  sourceId: 'feed:ktpress-rw',
  sourceName: 'KT Press',
  countryCode: 'RWA',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-09-05T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

const GUS_LABOUR: NewsArticle = {
  id: 'gus-1',
  title: 'Demand for labour in Quarter 2 2026',
  summary:
    'Statistics Poland presents data on the demand for labour in Quarter 2 2026, including vacancies.',
  url: 'https://stat.gov.pl/en/topics/labour-market/demand-q2-2026,1,45.html',
  sourceId: 'feed:gus-pl',
  sourceName: 'Statistics Poland',
  countryCode: 'POL',
  category: 'business',
  sourcesCount: 1,
  publishedAt: '2026-09-05T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

const CORPUS = [POLISH_STORY, EAST_AFRICA_STORY, GUS_LABOUR];

/* ---------------------------------------------------------------- */

describe('REV C · C1 — an uncurated publisher cannot be answered by a COUNTRY route', () => {
  it('"What does Reuters report about Poland?" returns zero evidence and never calls OpenAI', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews('What does Reuters report about Poland?');

    /*
     * The decisive assertions are the ROUTES NOT TAKEN. The corpus contains a
     * perfectly good Polish story; under R1 the country branch would have
     * found it and presented it in answer to a question about Reuters.
     */
    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toEqual([]);

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });
});

describe('REV C · C2 — nor by a DECLARED-REGION route', () => {
  it('"What does Reuters report about East Africa?" fans out to nobody', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews('What does Reuters report about East Africa?');

    // Not one of the eleven declared members was retrieved.
    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toEqual([]);
    expect(EAST_AFRICA.members.length).toBeGreaterThan(1);

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('and the same holds for the "According to <source>," phrasing', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews(
      'According to Reuters, what is happening in East Africa?',
    );

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toEqual([]);
    expect(response.articles).toEqual([]);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });
});

describe('REV C · C3 — the curated publishers are unaffected', () => {
  it('Statistics Poland still resolves and still retrieves its own reporting', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews(
      'What does Statistics Poland report about the demand for labour in Quarter 2 2026?',
    );

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toHaveLength(1);
    expect(h.searchCalls[0].requestedSourceId).toBe('feed:gus-pl');
    expect(response.articles.map((a) => a.id)).toEqual(['gus-1']);
  });

  it('KT Press + East Africa is still constrained to feed:ktpress-rw', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews('What does KT Press report about East Africa?');

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toHaveLength(1);
    expect(h.searchCalls[0].requestedSourceId).toBe('feed:ktpress-rw');
    expect(response.articles.map((a) => a.id)).toEqual(['kt-1']);
  });

  it('and resolution itself is unchanged — Reuters is not in the registry, and was not added', () => {
    expect(resolveRequestedSource('Reuters')).toBeUndefined();
    expect(resolveRequestedSource('Statistics Poland')?.sourceId).toBe('feed:gus-pl');
    expect(resolveRequestedSource('KT Press')?.sourceId).toBe('feed:ktpress-rw');
  });
});

describe('REV C · C4 — ordinary place questions are untouched', () => {
  it('"What\'s happening in Poland?" still takes the country route', async () => {
    const h = harness(CORPUS);

    await h.service.analyzeNews("What's happening in Poland?");

    expect(h.countryCalls.length).toBeGreaterThan(0);
    expect(h.searchCalls.every((call) => call.requestedSourceId === undefined)).toBe(true);
  });

  it('"What\'s happening in East Africa?" still takes the declared-region route', async () => {
    const h = harness(CORPUS);

    await h.service.analyzeNews("What's happening in East Africa?");

    expect(h.searchCalls.length).toBe(EAST_AFRICA.members.length);
    expect(h.searchCalls.every((call) => call.requestedSourceId === undefined)).toBe(true);
    expect(h.countryCalls).toEqual([]);
  });
});

describe('REV C · C5 — the article anchor still outranks all of it', () => {
  it('an unresolved publisher does NOT override a resolved story anchor', async () => {
    const h = harness(CORPUS, EAST_AFRICA_STORY);

    const response = await h.service.analyzeNews(
      'What does Reuters report about East Africa?',
      'en',
      { articleId: 'kt-1' },
    );

    /*
     * The anchored branch is reached before the fail-closed arm, so the reader
     * who selected a story still gets that story's routing — the fail-closed
     * rule never silently discards an explicit selection.
     */
    expect(response.articles.map((a) => a.id)).toContain('kt-1');
    expect(h.searchCalls.every((call) => call.requestedSourceId === undefined)).toBe(true);
  });
});

/* ---------------------------------------------------------------- */
/* REV C REV A — A MATCHED FRAME WHOSE SOURCE THE PARSER CANNOT USE  */
/* ---------------------------------------------------------------- */

/**
 * Seven words — one past MAX_SOURCE_WORDS. The frame matches; the span is
 * rejected as a publisher NAME. Under Rev C that rejection also erased the
 * intent, and ordinary place routing became eligible again.
 */
const OVER_LIMIT_SOURCE = 'The International Center for Investigative Reporting Network';

describe('REV C REV A · D0 — the parser reports the two facts separately', () => {
  it('an over-limit source still registers as source intent', () => {
    const intent = detectSourceAttributedIntent(
      `What does ${OVER_LIMIT_SOURCE} report about Poland?`,
    );

    expect(intent).toBeDefined();
    expect(intent?.query).toBeUndefined();
    expect(intent?.rejection).toBe('source-too-long');
    expect(intent?.rawSourcePhrase).toBe(OVER_LIMIT_SOURCE);
  });

  it('and the usable-parse contract is unchanged for every existing caller', () => {
    // Still undefined — the span is not usable as a publisher name.
    expect(
      deriveSourceAttributedQuery(`What does ${OVER_LIMIT_SOURCE} report about Poland?`),
    ).toBeUndefined();

    // Still the exact two halves for a usable one.
    expect(deriveSourceAttributedQuery('What does Statistics Poland say about inflation?')).toEqual({
      sourcePhrase: 'Statistics Poland',
      topic: 'inflation',
    });

    // Still undefined — genuinely no source-attributed syntax at all.
    expect(deriveSourceAttributedQuery("What's happening in Poland?")).toBeUndefined();
    expect(detectSourceAttributedIntent("What's happening in Poland?")).toBeUndefined();
  });

  it('the six-word bound is preserved — it decides usability, not intent', () => {
    const withinBound = detectSourceAttributedIntent(
      'What does Central Bank of Kenya report about inflation?',
    );

    expect(withinBound?.query).toEqual({
      sourcePhrase: 'Central Bank of Kenya',
      topic: 'inflation',
    });
    expect(withinBound?.rejection).toBeUndefined();
  });
});

describe('REV C REV A · D1 — an over-limit source cannot be answered by a COUNTRY route', () => {
  it('fails closed on Poland: no country route, no search, no OpenAI', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews(
      `What does ${OVER_LIMIT_SOURCE} report about Poland?`,
    );

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toEqual([]);

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });
});

describe('REV C REV A · D2 — nor by a DECLARED-REGION route', () => {
  it('fails closed on East Africa: no member fan-out, no search, no OpenAI', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews(
      `What does ${OVER_LIMIT_SOURCE} report about East Africa?`,
    );

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toEqual([]);
    expect(EAST_AFRICA.members.length).toBeGreaterThan(1);

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('and the "According to <over-limit source>," frame fails closed identically', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews(
      `According to ${OVER_LIMIT_SOURCE}, what is happening in East Africa?`,
    );

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toEqual([]);
    expect(response.articles).toEqual([]);
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });
});

describe('REV C REV A · D3 — nothing else moved', () => {
  it('ordinary place questions still take their own routes', async () => {
    const poland = harness(CORPUS);
    await poland.service.analyzeNews("What's happening in Poland?");
    expect(poland.countryCalls.length).toBeGreaterThan(0);

    const region = harness(CORPUS);
    await region.service.analyzeNews("What's happening in East Africa?");
    expect(region.searchCalls.length).toBe(EAST_AFRICA.members.length);
    expect(region.countryCalls).toEqual([]);
  });

  it('a curated publisher is still retrieved normally', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews('What does KT Press report about East Africa?');

    expect(h.searchCalls).toHaveLength(1);
    expect(h.searchCalls[0].requestedSourceId).toBe('feed:ktpress-rw');
    expect(response.articles.map((a) => a.id)).toEqual(['kt-1']);
  });

  it('and a resolved article anchor still outranks an over-limit source intent', async () => {
    const h = harness(CORPUS, EAST_AFRICA_STORY);

    const response = await h.service.analyzeNews(
      `What does ${OVER_LIMIT_SOURCE} report about East Africa?`,
      'en',
      { articleId: 'kt-1' },
    );

    expect(response.articles.map((a) => a.id)).toContain('kt-1');
    expect(h.searchCalls.every((call) => call.requestedSourceId === undefined)).toBe(true);
  });

  it('the curated registry was not widened', () => {
    expect(resolveRequestedSource(OVER_LIMIT_SOURCE)).toBeUndefined();
    expect(resolveRequestedSource('Reuters')).toBeUndefined();
    expect(resolveRequestedSource('Statistics Poland')?.sourceId).toBe('feed:gus-pl');
  });
});
