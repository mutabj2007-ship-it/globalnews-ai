import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  ANALYSIS_TOTAL_BUDGET_MS,
  type AskGeographyContext,
  type CountryNewsResponse,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalyzeNewsDto } from '../dto';
import { AnalysisController } from '../controller/analysis.controller';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAP ASK GEOGRAPHY CONTEXT R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `geographyContext: { countryCode, displayName }` travels beside
 * `storyContext`. countryCode is the only retrieval identifier and is
 * validated through the governed registry; displayName is presentation only.
 * A story context outranks it and the two are never merged.
 */

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'id',
    title: 'title',
    summary: 'summary',
    url: 'https://example.com',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSearchResponse(articles: NewsArticle[]): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeCountryResponse(
  countryCode: string,
  countryName: string,
  articles: NewsArticle[],
): CountryNewsResponse {
  return {
    countryCode,
    countryName,
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    feedTier: 'delayed',
    providerDisplayName: 'Mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeConfigService(): AnalysisConfigService {
  const config = {
    maxArticles: 8,
    maxArticleChars: 1200,
    timeoutMs: 20000,
    totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
    cacheTtlSeconds: 300,
    openAiApiKey: undefined,
    openAiModel: 'gpt-4o-mini',
    executionMode: 'development' as const,
    retryAttempts: 2,
    retryBaseDelayMs: 300,
    maxCompletionTokens: 2000,
  };
  return { get: () => config } as unknown as AnalysisConfigService;
}

function harness() {
  const newsService = {
    search: jest.fn().mockResolvedValue(makeSearchResponse([makeArticle({ id: 'generic-1' })])),
    findArticleById: jest.fn(),
  };
  const countryNewsService = {
    getCountryNews: jest.fn((iso3: string) =>
      Promise.resolve(
        makeCountryResponse(iso3, iso3, [
          makeArticle({ id: `${iso3.toLowerCase()}-1`, title: `${iso3} report` }),
        ]),
      ),
    ),
  };
  const provider: AnalysisProvider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn().mockResolvedValue(null),
  };
  const service = new AnalysisService(
    newsService as never,
    countryNewsService as never,
    provider,
    makeConfigService(),
  );
  return { service, newsService, countryNewsService, provider };
}

const ALGERIA_EN: AskGeographyContext = { countryCode: 'DZA', displayName: 'Algeria' };
const ALGERIA_PL: AskGeographyContext = { countryCode: 'DZA', displayName: 'Algieria' };
const NO_PLACE_QUESTION = 'What are the latest developments?';

describe('MAP ASK GEOGRAPHY CONTEXT R1 — AnalysisService', () => {
  it('geographyContext absent → existing behavior unchanged (generic retrieval, no geography flag)', async () => {
    const { service, newsService, countryNewsService } = harness();

    const response = await service.analyzeNews(NO_PLACE_QUESTION, 'en');

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
    expect(newsService.search).toHaveBeenCalled();
    expect(response.retrievalContext.geographyContextUsed).toBeUndefined();
    expect(response.retrievalContext.storyContextUsed).toBeUndefined();
  });

  it('a valid country context routes through the existing country-aware path to that country (DZA)', async () => {
    const { service, newsService, countryNewsService } = harness();

    const response = await service.analyzeNews(
      NO_PLACE_QUESTION,
      'en',
      undefined,
      undefined,
      undefined,
      ALGERIA_EN,
    );

    expect(countryNewsService.getCountryNews).toHaveBeenCalledTimes(1);
    expect(countryNewsService.getCountryNews).toHaveBeenCalledWith(
      'DZA',
      undefined,
      expect.any(Number),
      undefined,
    );
    expect(newsService.search).not.toHaveBeenCalled();
    expect(newsService.findArticleById).not.toHaveBeenCalled();
    expect(response.articles.map((article) => article.id)).toEqual(['dza-1']);
    expect(response.retrievalContext.geographyContextUsed).toBe(true);
    expect(response.retrievalContext.storyContextUsed).toBeUndefined();
  });

  it('displayName cannot alter retrieval — a misleading label still retrieves the countryCode country', async () => {
    const { service, countryNewsService } = harness();

    await service.analyzeNews(NO_PLACE_QUESTION, 'en', undefined, undefined, undefined, {
      countryCode: 'DZA',
      displayName: 'Rwanda',
    });

    expect(countryNewsService.getCountryNews).toHaveBeenCalledTimes(1);
    expect(countryNewsService.getCountryNews.mock.calls[0][0]).toBe('DZA');
  });

  it('displayName does not split the cache: EN and PL labels for the same country share one retrieval', async () => {
    const { service, countryNewsService } = harness();

    await service.analyzeNews(NO_PLACE_QUESTION, 'en', undefined, undefined, undefined, ALGERIA_EN);
    await service.analyzeNews(NO_PLACE_QUESTION, 'en', undefined, undefined, undefined, {
      countryCode: 'DZA',
      displayName: 'A completely different label',
    });

    expect(countryNewsService.getCountryNews).toHaveBeenCalledTimes(1);
  });

  it('two different countries never share a cache entry', async () => {
    const { service, countryNewsService } = harness();

    await service.analyzeNews(NO_PLACE_QUESTION, 'en', undefined, undefined, undefined, ALGERIA_EN);
    await service.analyzeNews(NO_PLACE_QUESTION, 'en', undefined, undefined, undefined, {
      countryCode: 'MAR',
      displayName: 'Morocco',
    });

    expect(countryNewsService.getCountryNews.mock.calls.map((call) => call[0])).toEqual([
      'DZA',
      'MAR',
    ]);
  });

  it('EN/PL display labels are presentation-only: both route to DZA and the request language is what varies', async () => {
    const { service, countryNewsService, provider } = harness();

    const en = await service.analyzeNews(
      NO_PLACE_QUESTION,
      'en',
      undefined,
      undefined,
      undefined,
      ALGERIA_EN,
    );
    const pl = await service.analyzeNews(
      'Jakie są najnowsze wydarzenia?',
      'pl',
      undefined,
      undefined,
      undefined,
      ALGERIA_PL,
    );

    expect(countryNewsService.getCountryNews.mock.calls.map((call) => call[0])).toEqual([
      'DZA',
      'DZA',
    ]);
    expect(en.responseLanguage).toBe('en');
    expect(pl.responseLanguage).toBe('pl');
    /* The label never reaches the model prompt. */
    const promptPayloads = JSON.stringify(jest.mocked(provider.analyzeNews).mock.calls);
    expect(promptPayloads).not.toContain('Algieria');
  });

  it('an unknown country code is ignored defensively by the service (the DTO rejects it first)', async () => {
    const { service, newsService, countryNewsService } = harness();

    const response = await service.analyzeNews(
      NO_PLACE_QUESTION,
      'en',
      undefined,
      undefined,
      undefined,
      {
        countryCode: 'XXX',
        displayName: 'Nowhere',
      },
    );

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
    expect(newsService.search).toHaveBeenCalled();
    expect(response.retrievalContext.geographyContextUsed).toBeUndefined();
  });

  it('story context outranks geography context — the story country governs and nothing is merged', async () => {
    const { service, countryNewsService } = harness();

    const response = await service.analyzeNews(
      NO_PLACE_QUESTION,
      'en',
      { title: 'Rwanda migration story', countryCode: 'RWA' },
      undefined,
      undefined,
      ALGERIA_EN,
    );

    expect(countryNewsService.getCountryNews.mock.calls.map((call) => call[0])).toEqual(['RWA']);
    expect(response.retrievalContext.storyContextUsed).toBe(true);
    expect(response.retrievalContext.geographyContextUsed).toBeUndefined();
  });

  it('a story context with no country still outranks geography — geography never fills in a story gap', async () => {
    const { service, countryNewsService } = harness();

    const response = await service.analyzeNews(
      NO_PLACE_QUESTION,
      'en',
      { title: 'An untagged story' },
      undefined,
      undefined,
      ALGERIA_EN,
    );

    expect(countryNewsService.getCountryNews).not.toHaveBeenCalled();
    expect(response.retrievalContext.geographyContextUsed).toBeUndefined();
  });

  it('a typed country outranks the selected geography, exactly as it outranks the map story camera', async () => {
    const { service, countryNewsService } = harness();

    const response = await service.analyzeNews(
      'Latest news from Kenya',
      'en',
      undefined,
      undefined,
      undefined,
      ALGERIA_EN,
    );

    expect(countryNewsService.getCountryNews.mock.calls.map((call) => call[0])).toEqual(['KEN']);
    expect(response.retrievalContext.geographyContextUsed).toBe(false);
  });

  it('one explicit analysis with geography issues at most one model call and one country retrieval', async () => {
    const { service, countryNewsService, provider } = harness();

    await service.analyzeNews(NO_PLACE_QUESTION, 'en', undefined, undefined, undefined, ALGERIA_EN);

    expect(countryNewsService.getCountryNews).toHaveBeenCalledTimes(1);
    expect(jest.mocked(provider.analyzeNews).mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('MAP ASK GEOGRAPHY CONTEXT R1 — request validation (global ValidationPipe)', () => {
  /* The exact options main.ts registers globally. */
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validateBody = (body: unknown): Promise<AnalyzeNewsDto> =>
    pipe.transform(body, { type: 'body', metatype: AnalyzeNewsDto }) as Promise<AnalyzeNewsDto>;

  it('geographyContext is optional — a { query } body is unchanged', async () => {
    const dto = await validateBody({ query: NO_PLACE_QUESTION });
    expect(dto.geographyContext).toBeUndefined();
  });

  it('accepts a registry country with a display label', async () => {
    const dto = await validateBody({ query: NO_PLACE_QUESTION, geographyContext: ALGERIA_PL });
    expect(dto.geographyContext).toEqual({ countryCode: 'DZA', displayName: 'Algieria' });
  });

  it('normalises case of a registry ISO3 code', async () => {
    const dto = await validateBody({
      query: NO_PLACE_QUESTION,
      geographyContext: { countryCode: ' dza ', displayName: 'Algeria' },
    });
    expect(dto.geographyContext?.countryCode).toBe('DZA');
  });

  it.each([
    ['unknown ISO3', 'XXX'],
    ['ISO2 rather than ISO3', 'DZ'],
    ['a country NAME', 'Algeria'],
    ['empty', ''],
    ['non-string', 12],
  ])('rejects a malformed/unknown countryCode: %s', async (_label, countryCode) => {
    await expect(
      validateBody({
        query: NO_PLACE_QUESTION,
        geographyContext: { countryCode, displayName: 'Algeria' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing or empty displayName', async () => {
    await expect(
      validateBody({ query: NO_PLACE_QUESTION, geographyContext: { countryCode: 'DZA' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validateBody({
        query: NO_PLACE_QUESTION,
        geographyContext: { countryCode: 'DZA', displayName: '' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['articleId', 'a-1'],
    ['sourceId', 'src-1'],
    ['evidenceId', 'S1'],
    ['reportId', 'r-1'],
    ['clusterId', 'c-1'],
    ['previousAnswer', 'PRIOR AI ANSWER'],
    ['evidence', [{ id: 'S1', title: 'supplied' }]],
  ])('geography cannot carry %s', async (field, value) => {
    await expect(
      validateBody({
        query: NO_PLACE_QUESTION,
        geographyContext: { ...ALGERIA_EN, [field]: value },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('MAP ASK GEOGRAPHY CONTEXT R1 — controller transport', () => {
  it('passes geographyContext through to the one analysis call, beside storyContext, unmerged', async () => {
    const analysisService = { analyzeNews: jest.fn().mockResolvedValue({}) };
    const history = { recordExplicitQuestion: jest.fn() };
    const controller = new AnalysisController(analysisService as never, history as never);

    await controller.analyzeNews(
      {
        query: NO_PLACE_QUESTION,
        requestedLanguage: 'en',
        geographyContext: ALGERIA_EN,
      } as AnalyzeNewsDto,
      { headers: {}, cookies: {} } as never,
    );

    expect(analysisService.analyzeNews).toHaveBeenCalledTimes(1);
    expect(analysisService.analyzeNews).toHaveBeenCalledWith(
      NO_PLACE_QUESTION,
      'en',
      undefined,
      undefined,
      undefined,
      ALGERIA_EN,
    );
  });
});
