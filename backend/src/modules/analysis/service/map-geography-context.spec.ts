import { execSync } from 'child_process';
import { BadRequestException, ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import type { AnalysisApiResponse, CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import {
  ANALYSIS_TOTAL_BUDGET_MS,
  COUNTRIES,
  MAX_GEOGRAPHY_DISPLAY_NAME_LENGTH,
  resolveCountryByAnyIdentifier,
  resolveGovernedCountryCode,
} from '@globalnews-ai/shared';

import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from '../controller/analysis.controller';
import { AnalyzeNewsDto } from '../dto';
import type { HistoryService } from '../../history/history.service';
import { computeArticleRef } from '../../news/identity/article-ref.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';

/**
 * MAP ASK GEOGRAPHY CONTEXT R1 — the map country with no story selected.
 *
 * The shipped AnalysisService runs for real. NewsService and
 * CountryNewsService are stubbed at their own boundaries; the country stub
 * applies the REAL country-relevance gate. The analysis provider records what
 * it was given and then THROWS, so any claim about what reached the model is
 * read from the provider's own input.
 */

/* A display name that must never be read by retrieval, cache or prompt. */
const DISPLAY_SENTINEL = 'Zzyzx Presentation Label';

function harness(corpus: NewsArticle[] = []) {
  const countryCalls: string[] = [];
  const searchCalls: string[] = [];
  const providerInputs: unknown[] = [];

  const newsService = {
    search: jest.fn(async (query: string): Promise<NewsResponse> => {
      searchCalls.push(query);
      return {
        articles: [],
        totalResults: 0,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: new Date().toISOString(),
      } as NewsResponse;
    }),
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
    findArticleById: jest.fn(async () => null),
    findRetainedArticleByUrl: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
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
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      providerInputs.push(args);
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
    service: new AnalysisService(newsService as never, countryNewsService as never, provider, config),
    countryCalls,
    searchCalls,
    providerInputs,
    provider,
  };
}

const iso3Of = (identifier: string) => resolveCountryByAnyIdentifier(identifier)?.iso3;

const POLAND_STORY: NewsArticle = {
  id: 'pl-1',
  title: 'Poland parliament debates new energy law in Warsaw',
  summary: 'Polish lawmakers in Warsaw debated the energy bill on Tuesday.',
  url: 'https://www.example.pl/poland-energy-law',
  sourceId: 'example-pl',
  sourceName: 'Example PL',
  countryCode: 'POL',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-09-26T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

const OPEN_QUESTION = 'What are the latest developments?';

/* ------------------------------------------------------------------ */

describe('the geography context is the map camera when no story is selected', () => {
  it('its countryCode scopes retrieval to that country and is stamped as used', async () => {
    const h = harness();
    const response = await h.service.analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, {
      countryCode: 'POL',
      displayName: 'Poland',
    });

    expect(h.countryCalls.map(iso3Of)).toEqual(['POL']);
    expect(response.retrievalContext?.geographyContextUsed).toBe(true);
    expect(response.retrievalContext?.storyContextUsed).toBeUndefined();
  });

  it('an alpha-2 code is accepted and resolves to the same country', async () => {
    const h = harness();
    await h.service.analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, {
      countryCode: 'pl',
      displayName: 'Poland',
    });
    expect(h.countryCalls.map(iso3Of)).toEqual(['POL']);
  });

  it('without a geography context the same question is routed exactly as before', async () => {
    const withGeo = harness();
    const without = harness();
    await withGeo.service.analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, {
      countryCode: 'POL',
      displayName: 'Poland',
    });
    const response = await without.service.analyzeNews(OPEN_QUESTION, 'en');

    expect(without.countryCalls).toEqual([]);
    expect(response.retrievalContext?.geographyContextUsed).toBeUndefined();
    expect(withGeo.countryCalls).not.toEqual(without.countryCalls);
  });

  it.each(['ZZZ', 'ZZ', 'Poland', 'UK', '616'])(
    'R1.1 — no silent fallback: the service itself refuses an ungoverned code (%s) before any retrieval',
    async (countryCode) => {
      const h = harness();
      await expect(
        h.service.analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, {
          countryCode,
          displayName: 'Nowhere',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(h.countryCalls).toEqual([]);
      expect(h.searchCalls).toEqual([]);
      expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    },
  );

  it('R1.1 — an ungoverned code is refused even when a story context would outrank it', async () => {
    const h = harness();
    await expect(
      h.service.analyzeNews(OPEN_QUESTION, 'en', { title: 't', countryCode: 'KEN' }, undefined, undefined, {
        countryCode: 'ZZZ',
        displayName: 'Nowhere',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.countryCalls).toEqual([]);
  });
});

describe('R1.1 — the governed-country check reuses the shared COUNTRIES registry', () => {
  it.each([
    ['POL', 'POL'],
    ['PL', 'POL'],
    ['pol', 'POL'],
    ['pl', 'POL'],
    ['USA', 'USA'],
  ])('%s resolves to the governed country %s', (code, iso3) => {
    const governed = resolveGovernedCountryCode(code);
    expect(governed?.iso3).toBe(iso3);
    expect(COUNTRIES).toContain(governed);
  });

  it.each(['ZZZ', 'ZZ', 'Poland', 'poland', 'UK', 'Britain', '616', '', ' POL', 'POL ', 'P', 'POLA', 42, null, undefined])(
    '%p does not resolve',
    (code) => {
      expect(resolveGovernedCountryCode(code)).toBeUndefined();
    },
  );

  it('a two-letter code is only ever an ISO alpha-2 and a three-letter one only an ISO alpha-3', () => {
    for (const country of COUNTRIES) {
      expect(resolveGovernedCountryCode(country.iso2)).toBe(country);
      expect(resolveGovernedCountryCode(country.iso3)).toBe(country);
    }
  });
});

describe('displayName is presentation only', () => {
  it('a displayName naming ANOTHER country cannot move retrieval: countryCode is the authority', async () => {
    const h = harness();
    await h.service.analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, {
      countryCode: 'POL',
      displayName: 'Kenya',
    });
    expect(h.countryCalls.map(iso3Of)).toEqual(['POL']);
    expect(h.searchCalls.join(' ')).not.toMatch(/kenya/i);
  });

  it('the displayName never reaches the model prompt', async () => {
    const h = harness([POLAND_STORY]);
    await h.service
      .analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, {
        countryCode: 'POL',
        displayName: DISPLAY_SENTINEL,
      })
      .catch(() => undefined);

    expect(h.providerInputs.length).toBeGreaterThan(0);
    expect(JSON.stringify(h.providerInputs)).not.toContain(DISPLAY_SENTINEL);
    expect(h.countryCalls.join(' ')).not.toContain(DISPLAY_SENTINEL);
    expect(h.searchCalls.join(' ')).not.toContain(DISPLAY_SENTINEL);
  });

  it('two display names for one code produce identical retrieval and identical model input', async () => {
    const a = harness([POLAND_STORY]);
    const b = harness([POLAND_STORY]);
    await a.service
      .analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, { countryCode: 'POL', displayName: 'Poland' })
      .catch(() => undefined);
    await b.service
      .analyzeNews(OPEN_QUESTION, 'en', undefined, undefined, undefined, { countryCode: 'POL', displayName: 'Polska' })
      .catch(() => undefined);

    expect(a.countryCalls).toEqual(b.countryCalls);
    const strip = (inputs: unknown[]) =>
      JSON.stringify(inputs).replace(/"(generatedAt|requestId|startedAt|now)":"[^"]*"/g, '');
    expect(strip(a.providerInputs)).toEqual(strip(b.providerInputs));
  });

  it('the service source never reads geographyContext.displayName', () => {
    const source = execSync('git grep -n "displayName" -- src/modules/analysis/service/analysis.service.ts', {
      cwd: `${__dirname}/../../../..`,
    }).toString();
    expect(source).not.toMatch(/geographyContext\??\.displayName/);
  });
});

describe('precedence: story context and typed places outrank the map country', () => {
  it('a storyContext is the more specific anchor: the geography context is ignored entirely', async () => {
    const h = harness();
    const response = await h.service.analyzeNews(
      OPEN_QUESTION,
      'en',
      { title: 'Kenya election commission sets date', countryCode: 'KEN' },
      undefined,
      undefined,
      { countryCode: 'POL', displayName: 'Poland' },
    );

    expect(h.countryCalls.map(iso3Of)).toEqual(['KEN']);
    expect(response.retrievalContext?.storyContextUsed).toBe(true);
    expect(response.retrievalContext?.geographyContextUsed).toBeUndefined();
  });

  it('a country typed in the question outranks the map country', async () => {
    const h = harness();
    const response = await h.service.analyzeNews(
      'What is happening in Kenya?',
      'en',
      undefined,
      undefined,
      undefined,
      { countryCode: 'POL', displayName: 'Poland' },
    );

    expect(h.countryCalls.map(iso3Of)).toEqual(['KEN']);
    expect(response.retrievalContext?.geographyContextUsed).toBe(false);
  });

  it('a multi-story selection is the whole scope: the geography context is ignored', async () => {
    const h = harness();
    const url = 'https://www.example.pl/not-retained';
    const response = await h.service.analyzeNews(
      'Summarize these',
      'en',
      undefined,
      undefined,
      { action: 'SUMMARIZE', stories: [{ articleRef: computeArticleRef(url), url }] },
      { countryCode: 'POL', displayName: 'Poland' },
    );

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toEqual([]);
    expect(response.retrievalContext?.geographyContextUsed).toBeUndefined();
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */

describe('the request contract: exactly { countryCode, displayName }', () => {
  /* The production global pipe, configured exactly as main.ts configures it. */
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'body', metatype: AnalyzeNewsDto, data: '' };
  const accept = (body: unknown) => pipe.transform(body, meta) as Promise<AnalyzeNewsDto>;

  it('accepts a valid geography context and remains optional', async () => {
    await expect(
      accept({ query: OPEN_QUESTION, geographyContext: { countryCode: 'POL', displayName: 'Poland' } }),
    ).resolves.toMatchObject({ geographyContext: { countryCode: 'POL', displayName: 'Poland' } });
    await expect(accept({ query: OPEN_QUESTION })).resolves.toMatchObject({ query: OPEN_QUESTION });
  });

  it.each(['articleId', 'sourceId', 'evidenceId', 'reportId', 'clusterId', 'url', 'title'])(
    'rejects an identity smuggled alongside it: %s',
    async (field) => {
      await expect(
        accept({
          query: OPEN_QUESTION,
          geographyContext: { countryCode: 'POL', displayName: 'Poland', [field]: 'x-1' },
        }),
      ).rejects.toThrow();
    },
  );

  it.each([
    ['POL', 'POL'],
    ['PL', 'PL'],
  ])('R1.1 — the governed code %s is accepted unchanged', async (countryCode, expected) => {
    const dto = await accept({ query: OPEN_QUESTION, geographyContext: { countryCode, displayName: 'Poland' } });
    expect(dto.geographyContext?.countryCode).toBe(expected);
  });

  it.each([
    ['pol', 'POL'],
    ['pl', 'PL'],
  ])('R1.1 — PINNED: lower-case %s is accepted and normalized deterministically to %s', async (countryCode, expected) => {
    const dto = await accept({ query: OPEN_QUESTION, geographyContext: { countryCode, displayName: 'Poland' } });
    expect(dto.geographyContext?.countryCode).toBe(expected);
  });

  it.each([
    ['an unknown alpha-3 (ZZZ)', 'ZZZ'],
    ['an unknown alpha-2 (ZZ)', 'ZZ'],
    ['a country name (Poland)', 'Poland'],
    ['a numeric code (616)', '616'],
    ['an alias (UK)', 'UK'],
    ['an alias (Britain)', 'Britain'],
    ['a padded code', ' POL'],
  ])('R1.1 — rejects %s with a 400 naming countryCode', async (_label, countryCode) => {
    const rejection = accept({ query: OPEN_QUESTION, geographyContext: { countryCode, displayName: 'Poland' } });
    await expect(rejection).rejects.toBeInstanceOf(BadRequestException);
    await expect(rejection).rejects.toMatchObject({
      response: { message: expect.arrayContaining([expect.stringContaining('countryCode')]) },
    });
  });

  it.each([
    ['a missing code', { displayName: 'Poland' }],
    ['a missing display name', { countryCode: 'POL' }],
    ['an empty display name', { countryCode: 'POL', displayName: '' }],
    ['an over-long display name', { countryCode: 'POL', displayName: 'P'.repeat(MAX_GEOGRAPHY_DISPLAY_NAME_LENGTH + 1) }],
  ])('rejects %s', async (_label, geographyContext) => {
    await expect(accept({ query: OPEN_QUESTION, geographyContext })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('the controller: only an explicit POST computes', () => {
  function controllerHarness() {
    const analysisService = {
      analyzeNews: jest.fn(async () => ({}) as AnalysisApiResponse),
    };
    const history = { recordExplicitQuestion: jest.fn(async () => undefined) };
    const controller = new AnalysisController(analysisService as never, history as unknown as HistoryService);
    /* An unverified request: history is covered through the real guard in question-history-writer.spec. */
    return { controller, analysisService, request: {} as never };
  }

  it('passes the geography context through to the one compute boundary', async () => {
    const h = controllerHarness();
    const geographyContext = { countryCode: 'POL', displayName: 'Poland' };
    await h.controller.analyzeNews({ query: OPEN_QUESTION, geographyContext } as AnalyzeNewsDto, h.request);
    expect(h.analysisService.analyzeNews).toHaveBeenCalledWith(
      OPEN_QUESTION,
      undefined,
      undefined,
      undefined,
      undefined,
      geographyContext,
    );
  });

  it('the geography context adds no route: it is accepted by POST /analysis/news only', () => {
    const files = execSync('git grep -l "geographyContext" -- "src/**/*.ts"', { cwd: `${__dirname}/../../../..` })
      .toString()
      .trim()
      .split('\n')
      .filter((file) => !file.endsWith('.spec.ts'))
      .sort();
    expect(files).toEqual([
      'src/modules/analysis/controller/analysis.controller.ts',
      'src/modules/analysis/dto/analyze-news.dto.ts',
      'src/modules/analysis/service/analysis.service.ts',
    ]);
  });
});
