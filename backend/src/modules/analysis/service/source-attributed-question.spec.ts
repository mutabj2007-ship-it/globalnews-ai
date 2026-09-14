import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { deriveSourceAttributedQuery } from '../query/derive-source-attributed-query.util';
import {
  resolveRequestedSource,
  isAttributableToRequestedSource,
  type RequestedSource,
} from '../../news/identity/requested-source.util';

/**
 * NATURAL SOURCE-ATTRIBUTED QUESTION R1 — ACCEPTANCE.
 *
 * The harness is the one G-ALPHA-2 acceptance already uses, unchanged in
 * construction: the SHIPPED AnalysisService, with NewsService and
 * CountryNewsService stubbed at their own boundaries, and the REAL, UNMODIFIED
 * scoreGenericRelevance / scoreCountryRelevance applied exactly where those
 * services apply them. An article admitted below is an article the shipped
 * gates admit.
 *
 * The analysis provider THROWS if it is ever reached. Every "no OpenAI"
 * assertion in this file is therefore enforced by the harness itself, not by
 * reading a flag afterwards.
 */

interface Harness {
  service: AnalysisService;
  searchCalls: Array<{ query: string; mode: string; requestedSourceId?: string }>;
  countryCalls: string[];
  provider: AnalysisProvider;
}

/**
 * R1 REV A — THE STUB NOW REPRODUCES BOTH HALVES OF THE REAL CONTRACT.
 *
 * This harness has always applied the REAL, UNMODIFIED relevance gate exactly
 * where NewsService applies it. Rev A moved the requested-source constraint
 * into NewsService too, so the stub applies the REAL, UNMODIFIED
 * `isAttributableToRequestedSource` exactly where NewsService now applies it.
 * An "accepted" article here is still an article the shipped code accepts.
 *
 * The TIER behaviour that constraint now participates in is not stubbable at
 * this boundary and is not stubbed: it is proven against a real NewsService
 * with real primary and fallback providers in
 * ../../news/news.service.source-constraint-tier.spec.ts.
 */
function harness(corpus: NewsArticle[]): Harness {
  const searchCalls: Array<{ query: string; mode: string; requestedSourceId?: string }> = [];
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
          mode: mode?.type ?? 'none',
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
    findArticleById: jest.fn(async () => null),
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
/* THE CORPUS — the live article, and every near miss that must not  */
/* be allowed to stand in for it.                                    */
/* ---------------------------------------------------------------- */

/** The real record. Registry identity, publisher's own host, publisher's own name. */
const GUS_LABOUR: NewsArticle = {
  id: 'gus-1',
  title: 'Demand for labour in Quarter 2 2026',
  summary:
    'Statistics Poland presents data on the demand for labour in Quarter 2 2026, including ' +
    'vacancies and newly created workplaces.',
  url: 'https://stat.gov.pl/en/topics/labour-market/demand-for-labour-in-q2-2026,1,45.html',
  sourceId: 'feed:gus-pl',
  sourceName: 'Statistics Poland',
  category: 'business',
  sourcesCount: 1,
  publishedAt: '2026-09-05T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

/** Same publisher, different subject. Must not be admitted for the labour question. */
const GUS_UNRELATED: NewsArticle = {
  id: 'gus-2',
  title: 'Consumer price indices in August 2026',
  summary: 'Statistics Poland publishes the consumer price index for August 2026.',
  url: 'https://stat.gov.pl/en/topics/prices-trade/cpi-august-2026,1,46.html',
  sourceId: 'feed:gus-pl',
  sourceName: 'Statistics Poland',
  category: 'business',
  sourcesCount: 1,
  publishedAt: '2026-09-06T08:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

/** Same subject, a different publisher entirely. */
const OTHER_PUBLISHER_SAME_TOPIC: NewsArticle = {
  id: 'wp-1',
  title: 'Demand for labour in Quarter 2 2026 slows, analysts say',
  summary: 'Coverage of the demand for labour in Quarter 2 2026 from a national newsroom.',
  url: 'https://wiadomosci.wp.pl/rynek-pracy-q2-2026-123456',
  sourceId: 'feed:wp-pl',
  sourceName: 'Wirtualna Polska — Wiadomości',
  category: 'business',
  sourcesCount: 1,
  publishedAt: '2026-09-05T10:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

/**
 * THE MASQUERADE. An aggregator record on the right topic that has typed the
 * publisher's name into `sourceName`. Its URL is not the publisher's host and
 * its `sourceId` is the aggregator's. It must never be admitted.
 */
const GNEWS_MASQUERADE: NewsArticle = {
  id: 'gn-1',
  title: 'Demand for labour in Quarter 2 2026 reported',
  summary: 'Aggregated coverage of the demand for labour in Quarter 2 2026.',
  url: 'https://news.aggregator.example/pl/labour-q2-2026',
  sourceId: 'gnews',
  sourceName: 'Statistics Poland',
  category: 'business',
  sourcesCount: 3,
  providerId: 'gnews',
  publishedAt: '2026-09-05T11:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

const GDELT_MASQUERADE: NewsArticle = {
  ...GNEWS_MASQUERADE,
  id: 'gd-1',
  url: 'https://gdelt.example/doc/labour-q2-2026',
  sourceId: 'gdelt-doc',
  providerId: 'gdelt-doc',
} as NewsArticle;

const RSS_MASQUERADE: NewsArticle = {
  ...GNEWS_MASQUERADE,
  id: 'rss-1',
  url: 'https://rss.example/feeds/labour-q2-2026',
  sourceId: 'rss-feeds',
  providerId: 'rss-feeds',
} as NewsArticle;

const FULL_CORPUS = [
  GUS_LABOUR,
  GUS_UNRELATED,
  OTHER_PUBLISHER_SAME_TOPIC,
  GNEWS_MASQUERADE,
  GDELT_MASQUERADE,
  RSS_MASQUERADE,
];

const THE_QUESTION =
  'What does Statistics Poland report about the demand for labour in Quarter 2 2026?';
const THE_CONTROL = 'The demand for labour in Quarter 2 2026';

/* ---------------------------------------------------------------- */

describe('NATURAL SOURCE-ATTRIBUTED QUESTION R1 · the confirmed Alpha failure', () => {
  it('1 — the Statistics Poland natural question now retrieves the known labour article', async () => {
    const h = harness(FULL_CORPUS);

    const response = await h.service.analyzeNews(THE_QUESTION);

    expect(response.articles.map((a) => a.id)).toEqual(['gus-1']);

    // The topic half, not the sentence, is what reached the provider.
    expect(h.searchCalls).toHaveLength(1);
    expect(h.searchCalls[0].query).toBe('demand for labour in Quarter 2 2026');
    expect(h.searchCalls[0].mode).toBe('generic');

    /*
     * REV A — the constraint TRAVELS WITH THE REQUEST. This is the assertion
     * that would have caught the R1 blocker: under R1 the search call carried
     * no source at all and the filtering happened afterwards, which is why a
     * healthy primary tier could end retrieval before the publisher's own tier
     * was ever asked.
     */
    expect(h.searchCalls[0].requestedSourceId).toBe('feed:gus-pl');

    // The country branch was never taken, although the sentence contains "Poland".
    expect(h.countryCalls).toEqual([]);
  });

  it('2 — the direct topic control still passes, unchanged', async () => {
    const h = harness(FULL_CORPUS);

    const response = await h.service.analyzeNews(THE_CONTROL);

    // No source constraint exists for a bare topic, so every topically
    // relevant record survives — exactly as it did before this correction.
    expect(response.articles.length).toBeGreaterThan(1);
    expect(response.articles.map((a) => a.id)).toContain('gus-1');
    expect(h.searchCalls[0].query).toBe('The demand for labour in Quarter 2 2026');
  });

  it('3 — an unrelated Statistics Poland article is rejected', async () => {
    const h = harness(FULL_CORPUS);

    const response = await h.service.analyzeNews(THE_QUESTION);

    expect(response.articles.map((a) => a.id)).not.toContain('gus-2');
  });

  it('4 — another publisher on the same topic cannot satisfy the question', async () => {
    const h = harness(FULL_CORPUS);

    const response = await h.service.analyzeNews(THE_QUESTION);

    expect(response.articles.map((a) => a.id)).not.toContain('wp-1');
  });

  it('5 — an unknown publisher name never becomes an unrestricted topic query', async () => {
    const h = harness(FULL_CORPUS);

    const response = await h.service.analyzeNews(
      'What does the Northern Chronicle report about the demand for labour in Quarter 2 2026?',
    );

    /*
     * The decisive assertion is the QUERY, not the result. If the source half
     * were discarded, the topic "demand for labour in Quarter 2 2026" would
     * have been sent and four topically relevant records would have come back
     * attributed to an outlet the user never named.
     */
    expect(h.searchCalls.map((c) => c.query)).not.toContain('demand for labour in Quarter 2 2026');
    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('6 — a known publisher with zero qualifying evidence returns zero evidence and no OpenAI', async () => {
    // The publisher is real and curated; it simply has nothing on this topic.
    const h = harness([OTHER_PUBLISHER_SAME_TOPIC, GNEWS_MASQUERADE]);

    const response = await h.service.analyzeNews(THE_QUESTION);

    // Retrieval genuinely ran and genuinely found topically relevant records.
    expect(h.searchCalls[0].query).toBe('demand for labour in Quarter 2 2026');

    expect(response.articles).toEqual([]);
    expect(response.analysis).toBeNull();
    expect(response.provenance.status).toBe('not-attempted');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('7 — gnews, gdelt-doc and rss-feeds cannot masquerade as the requested publisher', async () => {
    const h = harness(FULL_CORPUS);

    const response = await h.service.analyzeNews(THE_QUESTION);
    const ids = response.articles.map((a) => a.id);

    expect(ids).not.toContain('gn-1');
    expect(ids).not.toContain('gd-1');
    expect(ids).not.toContain('rss-1');

    // …and the same three, asserted directly against the predicate, so the
    // protection is proven at its own boundary and not only end to end.
    const requested = resolveRequestedSource('Statistics Poland');
    expect(requested?.sourceId).toBe('feed:gus-pl');

    for (const masquerade of [GNEWS_MASQUERADE, GDELT_MASQUERADE, RSS_MASQUERADE]) {
      expect(isAttributableToRequestedSource(masquerade, requested!)).toBe(false);
    }

    // A matching `sourceName` with no usable URL is still not enough — the
    // constraint is fail-closed on unverified free text.
    expect(
      isAttributableToRequestedSource(
        { sourceId: 'gnews', url: '' } as NewsArticle,
        requested!,
      ),
    ).toBe(false);
  });

  it('8 — the admitted record keeps the original publisher URL and sourceName', async () => {
    const h = harness(FULL_CORPUS);

    const response = await h.service.analyzeNews(THE_QUESTION);
    const admitted = response.articles[0];

    expect(admitted.url).toBe(GUS_LABOUR.url);
    expect(admitted.sourceName).toBe('Statistics Poland');
    expect(admitted.sourceId).toBe('feed:gus-pl');
    expect(admitted.url.startsWith('https://stat.gov.pl/')).toBe(true);
  });
});

describe('NATURAL SOURCE-ATTRIBUTED QUESTION R1 · the frame is closed', () => {
  it('splits the reported question into its two halves', () => {
    expect(deriveSourceAttributedQuery(THE_QUESTION)).toEqual({
      sourcePhrase: 'Statistics Poland',
      topic: 'demand for labour in Quarter 2 2026',
    });
  });

  it('accepts the bounded equivalent frames', () => {
    expect(deriveSourceAttributedQuery('What does Statistics Poland say about inflation?')).toEqual({
      sourcePhrase: 'Statistics Poland',
      topic: 'inflation',
    });

    expect(
      deriveSourceAttributedQuery('What has Statistics Poland published about inflation?'),
    ).toEqual({ sourcePhrase: 'Statistics Poland', topic: 'inflation' });

    expect(
      deriveSourceAttributedQuery('According to Statistics Poland, what is the inflation rate?'),
    ).toEqual({ sourcePhrase: 'Statistics Poland', topic: 'inflation rate' });
  });

  it('does not match questions the product already routes', () => {
    for (const query of [
      "What's happening with NATO?",
      'What is happening in Rwanda?',
      'cybersecurity',
      'Rwanda and Kenya trade',
      'What do you know about President Donald Trump?',
      'Tell me about NATO',
      'Latest developments in semiconductor exports',
      'Co wiesz o NATO?',
      'Opowiedz mi o Kigali',
    ]) {
      expect(deriveSourceAttributedQuery(query)).toBeUndefined();
    }
  });

  it('refuses an implausibly long source span rather than guessing', () => {
    expect(
      deriveSourceAttributedQuery(
        'What does the committee that met last week in the capital city say about inflation?',
      ),
    ).toBeUndefined();
  });
});

describe('NATURAL SOURCE-ATTRIBUTED QUESTION R1 · resolution is curated, not fuzzy', () => {
  it('resolves only exact curated publisher names', () => {
    expect(resolveRequestedSource('Statistics Poland')?.sourceId).toBe('feed:gus-pl');
    expect(resolveRequestedSource('statistics  poland.')?.sourceId).toBe('feed:gus-pl');
    expect(resolveRequestedSource('KT Press')?.sourceId).toBe('feed:ktpress-rw');
    expect(resolveRequestedSource('the Standard')?.sourceId).toBe('feed:standardmedia-ke');
    expect(resolveRequestedSource('Central Bank of Kenya')?.sourceId).toBe('feed:cbk-ke');
  });

  it('never resolves a partial, adjacent or aggregator name', () => {
    for (const phrase of [
      'Statistics',
      'Poland',
      'Statistics Polska',
      'Northern Chronicle',
      'gnews',
      'GNews',
      'gdelt-doc',
      'rss-feeds',
      'RSS',
      '',
    ]) {
      expect(resolveRequestedSource(phrase)).toBeUndefined();
    }
  });

  it('admits the publisher by curated id and by its own domain, and nothing else', () => {
    const requested = resolveRequestedSource('Statistics Poland')!;

    expect(isAttributableToRequestedSource(GUS_LABOUR, requested)).toBe(true);
    // Transport is not publisher: the same bulletin delivered by an aggregator
    // is still the publisher's, because the URL is the publisher's.
    expect(
      isAttributableToRequestedSource(
        { sourceId: 'gnews', url: 'https://www.stat.gov.pl/en/topics/labour-market/x.html' } as NewsArticle,
        requested,
      ),
    ).toBe(true);
    expect(isAttributableToRequestedSource(OTHER_PUBLISHER_SAME_TOPIC, requested)).toBe(false);
  });
});
