import { Test } from '@nestjs/testing';
import type { ConfigService } from '@nestjs/config';
import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';

import {
  GOVERNED_INSTITUTIONS,
  readInstitutionalStatusQuestion,
  scoreInstitutionalStatusRelevance,
} from './governed-institutions';
import { scoreGenericRelevance } from './generic-relevance.util';
import {
  deriveGenericNewsQuery,
  makeProviderSafeNewsQuery,
} from '../../analysis/query/derive-generic-news-query.util';
import { GdeltDocProvider } from '../providers/gdelt-doc.provider';
import { NewsService, type RelevanceMode } from '../news.service';
import type { NewsProvider } from '../interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../providers/provider.tokens';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { AnalysisService } from '../../analysis/service/analysis.service';
import type { AnalysisProvider } from '../../analysis/interfaces';
import type { AnalysisConfigService } from '../../analysis/config/analysis-config.service';

/**
 * ASK CURRENT REPORTING FINAL CLOSURE R1 (M2) — the NBP retrieval shape, BEFORE and AFTER,
 * deterministically: no network, no provider quota, no model. The analysis provider in the
 * wiring test throws if reached, so a zero-evidence path is proven to make no model call.
 */
const NBP_EN =
  'What is the current policy interest rate of the National Bank of Poland, and when was it last changed?';
const NBP_PL =
  'Jaka jest obecna stopa referencyjna Narodowego Banku Polskiego i kiedy ją zmieniono?';
const NBP = GOVERNED_INSTITUTIONS[0]!;
const RATE = NBP.subjects[0]!;

const art = (id: string, title: string, summary: string, extra: Partial<NewsArticle> = {}) =>
  ({
    id,
    title,
    summary,
    url: `https://example.test/${id}`,
    sourceId: 'feed:wp-pl',
    sourceName: 'Wirtualna Polska',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-09-29T08:00:00.000Z',
    publishedAtBasis: 'publisher',
    ...extra,
  }) as NewsArticle;

/* What reporting about this actually looks like — and the near misses that must stay out. */
const EN_WIRE = art(
  'en-1',
  "Poland's central bank holds interest rates at 5.75% as inflation eases",
  'The National Bank of Poland kept its reference rate unchanged on Wednesday.',
  { sourceId: 'gnews', sourceName: 'Reuters' },
);
const EN_ACRONYM = art(
  'en-2',
  'NBP keeps rates unchanged, signals no cut before year-end',
  'Governor Adam Glapiński said the policy rate would stay at 5.75%.',
  { sourceId: 'gnews', sourceName: 'Notes from Poland' },
);
const PL_WP = art(
  'pl-1',
  'RPP obniżyła stopy procentowe. Decyzja Rady Polityki Pieniężnej',
  'Rada Polityki Pieniężnej obniżyła stopę referencyjną NBP o 25 punktów bazowych.',
);
const PL_SUMMARY_ANCHOR = art(
  'pl-2',
  'Decyzja NBP w środę',
  'Analitycy oczekiwali tego od tygodni. NBP pozostawił stopy bez zmian na poziomie 5,75 proc.',
);
const MORTGAGE_NO_INSTITUTION = art(
  'x-1',
  'Polish banks raise mortgage interest rates for new borrowers',
  'Commercial lenders in Poland lifted interest rates on new mortgages.',
);
const EXCHANGE_RATES = art(
  'x-2',
  'NBP publishes daily exchange rates table',
  'The National Bank of Poland published its average exchange rates for Tuesday.',
);
const GUS_LABOUR = art(
  'x-3',
  'Demand for labour in Quarter 2 2026',
  'Statistics Poland presents data on the demand for labour in Quarter 2 2026.',
  { sourceId: 'feed:gus-pl', sourceName: 'Statistics Poland' },
);
const SCATTERED = art(
  'x-4',
  'NBP governor comments on the zloty',
  'The governor spoke about the currency. Separately, US interest rates were debated.',
);
const CORPUS = [
  EN_WIRE,
  EN_ACRONYM,
  PL_WP,
  PL_SUMMARY_ANCHOR,
  MORTGAGE_NO_INSTITUTION,
  EXCHANGE_RATES,
  GUS_LABOUR,
  SCATTERED,
];
const RELEVANT = ['en-1', 'en-2', 'pl-1', 'pl-2'];

const gdelt = new GdeltDocProvider({ get: () => undefined } as unknown as ConfigService);
const gdeltExpression = (q: string): string | null =>
  (gdelt as unknown as { buildQueryExpression(q: string): string | null }).buildQueryExpression(q);

describe('M2 — the shape is recognised only when BOTH institution and subject are named', () => {
  it.each([
    ['en', NBP_EN],
    ['pl', NBP_PL],
    ['en', 'What is the NBP reference rate now?'],
    ['en', 'Did Poland’s central bank cut interest rates?'],
    ['pl', 'Czy RPP obniżyła stopy procentowe?'],
    ['pl', 'Jaka jest stopa referencyjna NBP?'],
  ])('[%s] %s → one family, anchor first', (_lang, question) => {
    const shape = readInstitutionalStatusQuestion(question);
    expect(shape?.institution.id).toBe('PL_NBP');
    expect(shape?.subject.id).toBe('POLICY_RATE');
    expect(shape?.providerQuery).toBe('Poland interest rate');
  });

  it.each([
    'What is the NBP?',
    'Who is the governor of the National Bank of Poland?',
    'What are current US interest rates?',
    'Will the ECB cut interest rates?',
    'What is happening in Poland?',
    'Jak działa nbp w praktyce?', // lower-case "nbp" is not the acronym
  ])('no shape: %s', (question) => {
    expect(readInstitutionalStatusQuestion(question)).toBeNull();
  });
});

describe('M2 — BEFORE: the whole prose sentence was the query and the gate', () => {
  const before = makeProviderSafeNewsQuery(deriveGenericNewsQuery(NBP_EN))!;

  it('the provider phrase was the entire sentence', () => {
    expect(before.toLowerCase()).toContain('when was it last changed');
  });

  it('GDELT’s bounded 12-term expression dropped "poland"', () => {
    expect(gdeltExpression(before)).not.toMatch(/\bpoland\b/);
  });

  it('the generic gate admitted none of the relevant reporting', () => {
    for (const article of CORPUS)
      expect(scoreGenericRelevance(article, before).isRelevant).toBe(false);
  });
});

describe('M2 — AFTER: anchor-first query, governed institution + subject gate', () => {
  const after = readInstitutionalStatusQuestion(NBP_EN)!.providerQuery;

  it('the anchor survives every bounded provider expression', () => {
    expect(gdeltExpression(after)).toBe('poland interest rate');
    expect(makeProviderSafeNewsQuery(after)).toBe('Poland interest rate');
  });

  it('admits exactly the reporting about the NBP policy rate (EN and PL), nothing else', () => {
    const admitted = CORPUS.filter(
      (article) => scoreInstitutionalStatusRelevance(article, NBP, RATE).isRelevant,
    ).map((article) => article.id);
    expect(admitted).toEqual(RELEVANT);
  });

  it('is not looser than the parity locality: institution and subject must meet in one sentence', () => {
    expect(scoreInstitutionalStatusRelevance(SCATTERED, NBP, RATE).isRelevant).toBe(false);
    expect(scoreInstitutionalStatusRelevance(EXCHANGE_RATES, NBP, RATE).isRelevant).toBe(false);
    expect(scoreInstitutionalStatusRelevance(MORTGAGE_NO_INSTITUTION, NBP, RATE).isRelevant).toBe(
      false,
    );
  });

  it('ordinary generic relevance is byte-for-byte unchanged (no global equivalence added)', () => {
    const q = 'US interest rate decision';
    const policy = art('p', 'Fed policy rate decision looms', 'The Fed meets next week.');
    expect(scoreGenericRelevance(policy, q).isRelevant).toBe(false);
  });
});

/* ── NewsService, real, with fake providers: the tier ladder is unchanged ─────────── */
function stub(id: string, articles: NewsArticle[]): NewsProvider {
  const empty = async (): Promise<NewsArticle[]> => articles;
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search'],
    search: empty,
    topHeadlines: empty,
    category: empty,
    health: async () => ({
      providerId: id,
      displayName: id,
      status: 'ok' as const,
      checkedAt: '2026-09-29T08:00:00.000Z',
    }),
  } as unknown as NewsProvider;
}
async function newsService(primary: NewsArticle[], fallback: NewsArticle[]): Promise<NewsService> {
  const primaries = [stub('gnews', primary)];
  const fallbacks = [stub('rss-feeds', fallback)];
  const all = [...primaries, ...fallbacks];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: all },
      { provide: ALL_NEWS_PROVIDERS, useValue: all },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbacks },
      {
        provide: ArticlePersistenceService,
        useValue: {
          persistMany: jest.fn().mockResolvedValue(new Map()),
          findRecent: jest.fn().mockResolvedValue([]),
          findById: jest.fn().mockResolvedValue(null),
        },
      },
    ],
  }).compile();
  return moduleRef.get(NewsService);
}

describe('M2 — through the real NewsService (primary empty, Polish feeds offer their records)', () => {
  const FEEDS = [PL_WP, GUS_LABOUR, EXCHANGE_RATES, MORTGAGE_NO_INSTITUTION];
  const INSTITUTIONAL: RelevanceMode = {
    type: 'institutional',
    institutionId: 'PL_NBP',
    subjectId: 'POLICY_RATE',
  };

  it('BEFORE: the whole sentence through the generic gate → 0 articles', async () => {
    const service = await newsService([], FEEDS);
    const before = makeProviderSafeNewsQuery(deriveGenericNewsQuery(NBP_EN))!;
    const response = await service.search(before, 20, { type: 'generic' });
    expect(response.articles).toHaveLength(0);
  });

  it('AFTER: the shaped query through the institutional gate → the rate decision, only', async () => {
    const service = await newsService([], FEEDS);
    const response = await service.search('Poland interest rate', 20, INSTITUTIONAL);
    expect(response.articles.map((a) => a.id)).toEqual(['pl-1']);
  });

  it('AFTER, nothing relevant anywhere → still 0 (no threshold was lowered)', async () => {
    const service = await newsService([], [GUS_LABOUR, EXCHANGE_RATES, MORTGAGE_NO_INSTITUTION]);
    const response = await service.search('Poland interest rate', 20, INSTITUTIONAL);
    expect(response.articles).toHaveLength(0);
  });
});

/* ── AnalysisService wiring: the branch is taken for this shape and for nothing else ── */
function analysis(corpus: NewsArticle[]) {
  const calls: Array<{ query: string; mode: string }> = [];
  const newsServiceStub = {
    search: jest.fn(async (query: string, _limit?: number, mode?: RelevanceMode) => {
      calls.push({ query, mode: mode?.type ?? 'none' });
      const articles =
        mode?.type === 'institutional'
          ? corpus.filter((a) => scoreInstitutionalStatusRelevance(a, NBP, RATE).isRelevant)
          : mode?.type === 'generic'
            ? corpus.filter((a) => scoreGenericRelevance(a, query).isRelevant)
            : corpus;
      return {
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: '2026-09-29T08:00:00.000Z',
      } as NewsResponse;
    }),
    topHeadlines: jest.fn(
      async () =>
        ({
          articles: [],
          totalResults: 0,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: '2026-09-29T08:00:00.000Z',
        }) as NewsResponse,
    ),
    findArticleById: jest.fn(async () => null),
    findRetainedByQuery: jest.fn(async () => []),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(
      async () =>
        ({
          articles: [],
          totalResults: 0,
          providers: [],
          dataMode: 'live',
        }) as unknown as CountryNewsResponse,
    ),
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
      newsServiceStub as never,
      countryNewsService as never,
      provider,
      config,
    ),
    calls,
    provider,
    countryNewsService,
  };
}

describe('M2 — AnalysisService takes the institutional branch for this shape only', () => {
  it('the NBP question sends ONE anchor-first search in institutional mode (EN)', async () => {
    const h = analysis([]);
    const response = await h.service.analyzeNews(NBP_EN);
    expect(h.calls).toEqual([{ query: 'Poland interest rate', mode: 'institutional' }]);
    expect(h.countryNewsService.getCountryNews).not.toHaveBeenCalled();
    /* nothing admitted → the existing zero-evidence surface, and no model call */
    expect(response.articles).toHaveLength(0);
    expect(response.analysis).toBeNull();
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('the Polish question takes the same branch', async () => {
    const h = analysis([]);
    await h.service.analyzeNews(NBP_PL, 'pl');
    expect(h.calls).toEqual([{ query: 'Poland interest rate', mode: 'institutional' }]);
  });

  it('with relevant reporting present, it is admitted as evidence', async () => {
    const h = analysis(CORPUS);
    const response = await h.service.analyzeNews(NBP_EN).catch(() => null);
    /* the mock provider throws once evidence exists — reaching it proves admission */
    expect(h.provider.analyzeNews).toHaveBeenCalled();
    expect(response === null || response.articles.length > 0).toBe(true);
  });

  it('an unrelated interest-rate question keeps the ordinary generic path', async () => {
    const h = analysis([]);
    await h.service.analyzeNews('What are current US interest rates?');
    expect(h.calls.every((c) => c.mode === 'generic')).toBe(true);
    expect(h.calls.some((c) => c.query === 'Poland interest rate')).toBe(false);
  });
});
