import { Logger } from '@nestjs/common';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { attachProviderFailures } from '../../news/news.service';

/**
 * ASK FIRST-ANSWER RETRIEVAL R3 — offline regression for Production operation 0b4985f8.
 *
 * EVIDENCE BOUNDARY. These are FIXTURES, not a Production replay. The 10 Statistics Poland
 * records the feed offered on 2026-09-30 were never persisted and cannot be reconstructed.
 * What is reproduced here is the MECHANISM: the stubbed provider applies the SAME unmodified
 * `scoreGenericRelevance` gate NewsService applies in 'generic' mode to a fixture pool, so
 * the only thing that decides admission is the phrase AnalysisService sends. Both the
 * whole-phrase path and the governed-term-parity path of that gate are exercised below.
 */

function article(id: string, title: string, summary = ''): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://example.test/${id}`,
    sourceId: 'fixture',
    sourceName: 'Fixture',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
  };
}

/* Same-country pool: two economy items, two unrelated same-country items. */
const POOL: NewsArticle[] = [
  article('pl-econ-1', "Poland's economy grew 3.1% in the second quarter, statistics office says"),
  article('pl-econ-2', 'Employment in national economy in Poland in April 2026'),
  article('pl-sport', 'iQFOiL U23 World Championships underway in Poland'),
  article('pl-border', "Residents brace for possible hybrid attack on Poland's border"),
  article('ke-econ', "Kenya's economy slows as tax protests weigh on growth"),
  article('ke-air', 'Kenya Airways adds Nairobi–Lagos route'),
  article('pl-energy', "Poland's energy sources shift as coal share falls"),
];

function response(articles: NewsArticle[], overrides: Partial<NewsResponse> = {}): NewsResponse {
  return {
    articles,
    totalResults: articles.length,
    providers: ['fixture'],
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** NewsService.search in 'generic' mode, reduced to its admission rule. */
function gatedSearch(pool: NewsArticle[]) {
  return jest.fn(async (query: string) =>
    response(pool.filter((a) => scoreGenericRelevance(a, query).isRelevant)),
  );
}

function config(): AnalysisConfigService {
  return {
    get: () => ({
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
    }),
  } as unknown as AnalysisConfigService;
}

function build(news: Record<string, unknown>) {
  const provider: AnalysisProvider = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    analyzeNews: jest.fn().mockRejectedValue(new Error('model not exercised')),
  };
  const country = { getCountryNews: jest.fn() };
  const service = new AnalysisService(news as never, country as never, provider, config());
  return { service, provider, country };
}

const BASE_NEWS = () => ({
  findArticleById: jest.fn().mockResolvedValue(null),
  findRetainedByQuery: jest.fn().mockResolvedValue([]),
  topHeadlines: jest.fn().mockResolvedValue(response([])),
});

const ids = (articles: readonly NewsArticle[]) => articles.map((a) => a.id).sort();

describe('R3 · the Appendix-A question now retrieves on its subject', () => {
  it('sends the subject, never the answer-format instruction, and admits only economy reporting', async () => {
    const search = gatedSearch(POOL);
    const { service, country } = build({ ...BASE_NEWS(), search });

    const result = await service.analyzeNews(
      "What has changed in Poland's economy? Give the dates and cite the sources.",
      'en',
    );

    const sent = search.mock.calls.map(([q]) => q as string);
    expect(sent[0]).toBe('Poland s economy');
    for (const q of sent) expect(q).not.toMatch(/\b(give|cite|dates|sources)\b/i);
    expect(ids(result.articles)).toEqual(['pl-econ-1', 'pl-econ-2']);
    /* Geography is not forced into the whole-country feed. */
    expect(country.getCountryNews).not.toHaveBeenCalled();
    /* The model still receives the reader's whole question (prompt, cache key, response.query). */
    expect(result.query).toContain('Give the dates and cite the sources');
  });

  it('curly and straight apostrophes derive the same subject', async () => {
    const a = gatedSearch(POOL);
    const b = gatedSearch(POOL);
    await build({ ...BASE_NEWS(), search: a }).service.analyzeNews(
      'What has changed in Poland’s economy? Give the dates and cite the sources.',
      'en',
    );
    await build({ ...BASE_NEWS(), search: b }).service.analyzeNews(
      "What has changed in Poland's economy? Give the dates and cite the sources.",
      'en',
    );
    expect(a.mock.calls[0][0]).toBe(b.mock.calls[0][0]);
  });

  it('the same shape for another country (Kenya) behaves identically and rejects the unrelated item', async () => {
    const search = gatedSearch(POOL);
    const { service } = build({ ...BASE_NEWS(), search });
    const result = await service.analyzeNews(
      "What has changed in Kenya's economy? Please cite your sources.",
      'en',
    );
    expect(search.mock.calls[0][0]).toBe('Kenya s economy');
    expect(ids(result.articles)).toEqual(['ke-econ']);
  });

  it('the unfixed phrase is what rejected everything (the measured mechanism, on fixtures)', () => {
    const polluted = 'What has changed in Poland s economy Give the dates and cite the sources';
    expect(POOL.filter((a) => scoreGenericRelevance(a, polluted).isRelevant)).toEqual([]);
    /* The governed-term-parity path is what admits the second economy item for the subject. */
    expect(scoreGenericRelevance(POOL[1], 'Poland s economy').reasons.join(' ')).toMatch(
      /governed term-parity/,
    );
    expect(scoreGenericRelevance(POOL[0], "Poland's economy").reasons).toContain(
      'whole-phrase match',
    );
  });

  it('a "this week" question keeps its time bound in the subject (no silent removal)', async () => {
    const search = gatedSearch(POOL);
    const { service } = build({ ...BASE_NEWS(), search });
    await service.analyzeNews(
      "What has changed in Poland's economy this week? Give the dates and cite the sources.",
      'en',
    );
    expect(search.mock.calls[0][0]).toBe('Poland s economy this week');
  });

  it('topic words that look like instructions are kept ("energy sources")', async () => {
    const search = gatedSearch(POOL);
    const { service } = build({ ...BASE_NEWS(), search });
    const result = await service.analyzeNews("What are Poland's energy sources?", 'en');
    const sent = search.mock.calls.map(([q]) => q as string);
    expect(sent.some((q) => /sources/i.test(q))).toBe(true);
    expect(ids(result.articles)).toEqual(['pl-energy']);
  });

  it('a source-attributed question keeps its publisher constraint after the instruction is removed', async () => {
    const search = gatedSearch(POOL);
    const { service, country } = build({ ...BASE_NEWS(), search });
    await service.analyzeNews('What does Reuters report about Poland? Cite the sources.', 'en');
    /* Rev C: a named source stands the country route down, with or without the instruction. */
    expect(country.getCountryNews).not.toHaveBeenCalled();
    for (const [q] of search.mock.calls) expect(q as string).not.toMatch(/\bcite\b/i);
  });
});

describe('R3 · Polish', () => {
  it('"Co się zmieniło w gospodarce Polski? Podaj daty i źródła." sends the Polish subject only', async () => {
    const news = { ...BASE_NEWS(), search: jest.fn().mockResolvedValue(response([])) };
    const { service } = build(news);
    await service.analyzeNews('Co się zmieniło w gospodarce Polski? Podaj daty i źródła.', 'pl');
    expect(news.topHeadlines).toHaveBeenCalledTimes(1);
    const q = (news.topHeadlines.mock.calls[0][1] as { q: string }).q;
    expect(q).toBe('gospodarce Polski');
    expect(q).not.toMatch(/podaj|daty|źródła/i);
  });
});

describe('R3 · degradation truth: a refused FALLBACK is a limited search, not "no reporting"', () => {
  /* A question whose derived subject has a distinct bounded fallback phrase. */
  const QUESTION = 'Tell me about the wheat export corridor in the Black Sea';

  it('primary answered empty, fallback rate-limited → PROVIDER_RATE_LIMITED, one local rescue, no third call', async () => {
    const search = jest
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        attachProviderFailures(response([], { dataMode: 'unavailable' }), [
          {
            providerId: 'gnews',
            kind: 'rate-limited',
            message: 'GNews rate limit exceeded.',
          } as never,
        ]),
      );
    const news = { ...BASE_NEWS(), search };
    const { service, provider } = build(news);

    const result = await service.analyzeNews(QUESTION, 'en');

    expect(search).toHaveBeenCalledTimes(2);
    expect(result.retrievalContext?.outcome).toBe('PROVIDER_RATE_LIMITED');
    expect(news.findRetainedByQuery).toHaveBeenCalledTimes(1);
    expect(result.articles).toEqual([]);
    expect(provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('primary and fallback both answered empty → no outcome claim of failure', async () => {
    const search = jest.fn().mockResolvedValue(response([]));
    const news = { ...BASE_NEWS(), search };
    const { service } = build(news);
    const result = await service.analyzeNews(QUESTION, 'en');
    expect(search).toHaveBeenCalledTimes(2);
    expect(result.retrievalContext?.outcome).not.toBe('PROVIDER_RATE_LIMITED');
    expect(result.retrievalContext?.outcome).not.toBe('PROVIDER_UNAVAILABLE');
    expect(news.findRetainedByQuery).not.toHaveBeenCalled();
  });

  it('a relevance-gated retained article stands in after a refused fallback, disclosed as RETAINED_ONLY', async () => {
    const retainedHit = article('kept', 'Wheat export corridor Black Sea talks resume');
    const search = jest
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        attachProviderFailures(response([], { dataMode: 'unavailable' }), [
          { providerId: 'gnews', kind: 'rate-limited', message: 'x' } as never,
        ]),
      );
    const news = {
      ...BASE_NEWS(),
      search,
      findRetainedByQuery: jest
        .fn()
        .mockResolvedValue([retainedHit, article('noise', 'Football results from the weekend')]),
    };
    const { service } = build(news);
    const result = await service.analyzeNews(QUESTION, 'en');
    expect(result.retrievalContext?.outcome).toBe('RETAINED_ONLY');
    expect(ids(result.articles)).toEqual(['kept']);
  });

  it('Polish: a refused primary is stated on the response (PROVIDER_RATE_LIMITED), no English fallback', async () => {
    const news = {
      ...BASE_NEWS(),
      search: jest.fn(),
      topHeadlines: jest
        .fn()
        .mockResolvedValue(
          attachProviderFailures(response([], { dataMode: 'unavailable' }), [
            { providerId: 'gnews', kind: 'rate-limited', message: 'x' } as never,
          ]),
        ),
    };
    const { service } = build(news);
    const result = await service.analyzeNews('Co się zmieniło w gospodarce Polski?', 'pl');
    expect(news.search).not.toHaveBeenCalled();
    expect(result.retrievalContext?.outcome).toBe('PROVIDER_RATE_LIMITED');
  });

  it('Polish: a refused English fallback is stated on the response', async () => {
    const news = {
      ...BASE_NEWS(),
      topHeadlines: jest.fn().mockResolvedValue(response([])),
      search: jest
        .fn()
        .mockResolvedValue(
          attachProviderFailures(response([], { dataMode: 'unavailable' }), [
            { providerId: 'gnews', kind: 'unavailable', message: 'x' } as never,
          ]),
        ),
    };
    const { service } = build(news);
    const result = await service.analyzeNews('Co się zmieniło w gospodarce Polski?', 'pl');
    expect(news.search).toHaveBeenCalledTimes(1);
    expect(result.retrievalContext?.outcome).toBe('PROVIDER_UNAVAILABLE');
  });
});

describe('R3 · log redaction: no reader text in the covered retrieval log lines', () => {
  const emitted: string[] = [];
  const spies: jest.SpyInstance[] = [];
  beforeEach(() => {
    emitted.length = 0;
    for (const level of ['log', 'warn', 'debug', 'error', 'verbose'] as const) {
      spies.push(
        jest.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
          emitted.push(String(message));
        }),
      );
    }
  });
  afterEach(() => {
    for (const s of spies.splice(0)) s.mockRestore();
  });

  it.each([
    [
      "What has changed in Poland's economy? Give the dates and cite the sources.",
      ['Poland', 'economy', 'cite'],
    ],
    ['What does Reuters report about Poland? Cite the sources.', ['Reuters', 'Poland']],
    ['What does Totally Unknown Wire report about Kenya?', ['Totally Unknown Wire', 'Kenya']],
  ])('%s', async (question, fragments) => {
    const search = gatedSearch(POOL);
    const { service } = build({ ...BASE_NEWS(), search });
    await service.analyzeNews(question as string, 'en');
    for (const line of emitted) {
      for (const fragment of fragments as string[]) expect(line).not.toContain(fragment);
    }
  });
});
