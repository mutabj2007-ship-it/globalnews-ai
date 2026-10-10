import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import {
  isAttributableToRequestedSource,
  type RequestedSource,
} from '../../news/identity/requested-source.util';
import { EAST_AFRICA } from '../region/declared-regions';

/*
  MASTER CTO P0 RIGHTS CONTAINMENT R1 / E1-TAA-1 — the feed registry is REAL by default here: no live
  row is CLEARED today (Statistics Poland UNREVIEWED, KT Press UNRESOLVED, Wirtualna Polska PROHIBITED),
  so no RSS item may reach evidence or the model; the real-state rulings are pinned in the "RULED"
  block of this file. Tests about ROUTING / ATTRIBUTION MECHANICS switch on a SYNTHETIC registry for
  that test only: the real rows, every state below CLEARED marked CLEARED, RESTRICTED / PROHIBITED
  kept real (the rss-feed.provider.spec.ts pattern, made switchable per test).
*/
let mockSyntheticClearedRegistry = false;
jest.mock('../../news/providers/feed-source-registry', () => {
  const actual = jest.requireActual('../../news/providers/feed-source-registry');
  const synthetic = actual.FEED_SOURCES.map((row: { rights: { state: string } }) =>
    row.rights.state === 'RESTRICTED' || row.rights.state === 'PROHIBITED'
      ? row
      : { ...row, rights: { ...row.rights, state: 'CLEARED' } },
  );
  return {
    ...actual,
    get FEED_SOURCES() {
      return mockSyntheticClearedRegistry ? synthetic : actual.FEED_SOURCES;
    },
  };
});
afterEach(() => {
  mockSyntheticClearedRegistry = false;
});

/**
 * REV B · B — EXPLICIT SOURCE INTENT MUST NOT BE LOST TO REGION ROUTING.
 *
 * THE EDGE. The declared-region branch is resolved first and wins, which is
 * correct for a reader who typed a place and nothing else. It is wrong when
 * the reader ALSO named a publisher:
 *
 *   "What does KT Press report about East Africa?"
 *
 * routed through ordinary East Africa retrieval fans out across eleven member
 * countries, and the KT Press constraint is simply gone — the reader is
 * answered with whoever happened to publish about the region.
 *
 * The shipped AnalysisService runs for real below. NewsService and
 * CountryNewsService are stubbed at their own boundaries, and the stubs apply
 * the REAL, UNMODIFIED gates and the REAL, UNMODIFIED attribution predicate
 * exactly where the services apply them. The analysis provider THROWS if it is
 * ever reached, so every "no OpenAI" claim is enforced by the harness.
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

const REGION_TOPIC = 'East Africa';

/** KT Press's own record — curated sourceId and the publisher's own host. */
const KTPRESS_EAST_AFRICA: NewsArticle = {
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

/** Another East Africa publisher on the same subject. */
const OTHER_EAST_AFRICA: NewsArticle = {
  id: 'std-1',
  title: 'East Africa trade corridor talks resume in Nairobi',
  summary: 'The Standard reports on East Africa trade corridor negotiations.',
  url: 'https://www.standardmedia.co.ke/article/east-africa-corridor',
  sourceId: 'feed:standardmedia-ke',
  sourceName: 'The Standard',
  countryCode: 'KEN',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-09-05T09:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

const CORPUS = [KTPRESS_EAST_AFRICA, OTHER_EAST_AFRICA];

/* ------------------------------------------------------------------ */

describe('REV B · B1 — an ordinary region question is untouched', () => {
  it("What's happening in East Africa? still takes the declared-region path", async () => {
    const h = harness(CORPUS);

    await h.service.analyzeNews("What's happening in East Africa?");

    /*
     * The declared-region branch retrieves PER MEMBER — one provider search
     * per declared member, never one generic search for the whole region.
     * Eleven declared members, eleven retrievals, and not one of them carries
     * a source constraint.
     *
     * This same assertion is run against the BASE tree, where it produces the
     * identical numbers: the region path is untouched by Rev B.
     */
    expect(h.searchCalls.length).toBe(EAST_AFRICA.members.length);
    expect(h.searchCalls.every((call) => call.requestedSourceId === undefined)).toBe(true);
    expect(h.countryCalls).toEqual([]);
  });
});

describe('REV B · B2 — the same region, with a publisher named', () => {
  it('routes to source-attributed retrieval constrained to feed:ktpress-rw', async () => {
    /* MECHANICS under the synthetic CLEARED registry; the real-state ruling is pinned in the RULED block */
    mockSyntheticClearedRegistry = true;
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews(
      'What does KT Press report about East Africa?',
    );

    // The region fan-out did not happen at all.
    expect(h.countryCalls).toEqual([]);

    // One constrained generic search carrying the topic and the publisher.
    expect(h.searchCalls).toHaveLength(1);
    expect(h.searchCalls[0].query).toBe(REGION_TOPIC);
    expect(h.searchCalls[0].requestedSourceId).toBe('feed:ktpress-rw');

    expect(response.articles.map((a) => a.id)).toEqual(['kt-1']);
    expect(response.articles[0].sourceName).toBe('KT Press');
    expect(response.articles[0].url.startsWith('https://www.ktpress.rw/')).toBe(true);
  });

  it('another East Africa publisher cannot satisfy the question', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews(
      'What does KT Press report about East Africa?',
    );

    expect(response.articles.map((a) => a.id)).not.toContain('std-1');
  });

  it('zero qualifying KT Press evidence returns zero evidence and never calls OpenAI', async () => {
    // The region is covered — by someone else.
    const h = harness([OTHER_EAST_AFRICA]);

    const response = await h.service.analyzeNews(
      'What does KT Press report about East Africa?',
    );

    expect(h.countryCalls).toEqual([]);
    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });
});

describe('REV B · B3 — the article anchor still outranks this intent', () => {
  it('a resolved story anchor keeps its own routing', async () => {
    const h = harness(CORPUS, KTPRESS_EAST_AFRICA);

    await h.service.analyzeNews('What does KT Press report about East Africa?', 'en', {
      articleId: 'kt-1',
      title: KTPRESS_EAST_AFRICA.title,
    });

    /*
     * The decisive fact is that the source-attributed branch was NOT the one
     * that ran. With `declaredRegion` standing down, the chain reaches
     * `else if (anchorArticle)` next — so a reader who selected a specific
     * story still gets that story's routing, and no constrained generic
     * search is issued.
     */
    expect(h.searchCalls.every((call) => call.requestedSourceId === undefined)).toBe(true);
    expect(h.countryCalls).toEqual([]);
  });
});

/* ---------------------------------------------------------------- */
/* RULED — MASTER CTO P0 RIGHTS CONTAINMENT R1, on the REAL registry */
/* ---------------------------------------------------------------- */

/**
 * B2 above used to admit KT Press's RSS item as evidence. On the REAL, governed feed registry KT Press
 * is recorded UNRESOLVED: the precedence (source-attributed retrieval, no region fan-out) is unchanged,
 * but the item is withheld at the rights chokepoint with its reason — never "not relevant", never proof
 * that no reporting exists.
 */
describe('RULED · RIGHTS CONTAINMENT R1 — B2 on the real registry', () => {
  it('same route and constraint; the KT Press item is withheld, with its reason', async () => {
    const h = harness(CORPUS);

    const response = await h.service.analyzeNews('What does KT Press report about East Africa?');

    expect(h.countryCalls).toEqual([]);
    expect(h.searchCalls).toHaveLength(1);
    expect(h.searchCalls[0].query).toBe(REGION_TOPIC);
    expect(h.searchCalls[0].requestedSourceId).toBe('feed:ktpress-rw');
    expect(response.articles).toEqual([]);
    expect(response.retrievalContext?.rightsExcluded).toEqual({
      count: 1,
      reasons: { RIGHTS_NOT_CLEARED_FOR_AI: 1 },
      sourceIds: ['feed:ktpress-rw'],
    });
    expect(response.retrievalContext?.outcome).not.toBe('NO_RELEVANT_EVIDENCE');
  });
});
