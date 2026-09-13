import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { AnalysisService, AnalysisDeadlineExceededError } from './analysis.service';
import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REV B FINDING 1 — AN IN-FLIGHT JOINER IS A CALLER, AND EVERY CALLER IS BOUND
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT REV A LEFT OPEN. `withResponseDeadline` was applied at the bottom of
 * `analyzeNews`, which is the FRESH-operation return. The branch above it —
 * the one a request takes when identical work is already running — did
 * `await existingInFlightAnalysis` with no deadline of any kind. A caller that
 * joined a struggling run waited for as long as that run took, without limit,
 * even though its own browser was counting down against a compiled 40-second
 * abort.
 *
 * These are BEHAVIORAL tests, not structural ones. They run the real
 * `AnalysisService` against a provider that never settles and assert on what
 * actually happens on the clock: the joiner rejects, it rejects inside its own
 * budget, and the provider is still called exactly once.
 *
 * THE BUDGET IS DELIBERATELY TINY (80 ms). Nothing about the mechanism depends
 * on the magnitude — it is the same `setTimeout` race either way — and a real
 * 32,000 ms budget would make this suite unrunnable. The tolerance below is
 * generous enough that a loaded CI machine cannot make it flake, while still
 * being several orders of magnitude short of "unbounded", which is the only
 * distinction under test.
 */

const JOINER_BUDGET_MS = 80;

/**
 * The ceiling a bounded joiner must finish inside. Far above the budget so
 * timer jitter and a busy event loop cannot fail it; far below the "waits for
 * the operation" behaviour being regressed against, which never finishes at all
 * in these tests.
 */
const BOUNDED_TOLERANCE_MS = 4_000;

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

function makeCountryResponse(articles: NewsArticle[]): CountryNewsResponse {
  return {
    countryCode: 'ESP',
    countryName: 'Spain',
    articles,
    totalResults: articles.length,
    providers: ['mock-wire'],
    dataMode: 'mock',
    feedTier: 'delayed',
    providerDisplayName: 'Mock',
    generatedAt: new Date().toISOString(),
  };
}

function makeConfigService(totalBudgetMs: number): AnalysisConfigService {
  return {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs,
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

function validCandidateFor(articles: NewsArticle[]) {
  return {
    headline: 'Headline',
    summary: 'Summary',
    keyFacts: [{ claim: articles[0].title, evidenceIds: ['S1'] }],
    agreements: [],
    differences: [],
    unknowns: [],
    uncertainties: [],
    timeline: [],
    confidence: { level: 'medium', score: 50, explanation: 'x' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function buildService(totalBudgetMs: number, providerResult: Promise<unknown>) {
  const articles = [makeArticle({ id: 'a1' })];
  const search = jest.fn().mockResolvedValue(makeSearchResponse(articles));
  const getCountryNews = jest.fn().mockResolvedValue(makeCountryResponse([]));

  const provider: AnalysisProvider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn().mockReturnValue(providerResult),
  };

  const service = new AnalysisService(
    { search } as never,
    { getCountryNews } as never,
    provider,
    makeConfigService(totalBudgetMs),
  );

  return { service, provider, articles };
}

describe('REV B FINDING 1 — the in-flight joiner is bounded', () => {
  it('a joiner REJECTS on the deadline instead of waiting for an operation that never finishes', async () => {
    /*
      THE REGRESSION IN ONE LINE. Before this correction the provider promise
      below never settles, so `call2` never settled either — this assertion
      could not be written at all, because the test would hang until Jest's own
      timeout killed it and reported a suite failure rather than a bounded wait.
    */
    const neverSettles = deferred<unknown>();
    const { service } = buildService(JOINER_BUDGET_MS, neverSettles.promise);

    const originator = service.analyzeNews('an identical question');
    const joiner = service.analyzeNews('an identical question');

    await expect(joiner).rejects.toBeInstanceOf(AnalysisDeadlineExceededError);

    /* The originator is bounded too; awaited so neither rejection is orphaned. */
    await expect(originator).rejects.toBeInstanceOf(AnalysisDeadlineExceededError);

    neverSettles.resolve(undefined);
  });

  it('the joiner finishes inside its own budget, measured on the wall clock', async () => {
    const neverSettles = deferred<unknown>();
    const { service } = buildService(JOINER_BUDGET_MS, neverSettles.promise);

    const originator = service.analyzeNews('another identical question');

    const startedAt = Date.now();
    const joiner = service.analyzeNews('another identical question');

    await expect(joiner).rejects.toBeInstanceOf(AnalysisDeadlineExceededError);
    const waited = Date.now() - startedAt;

    /*
      The claim under test is boundedness, not precision. `waited` is compared
      against a ceiling, never against the budget exactly — an armed timer is
      allowed to fire late on a busy event loop and still be a real deadline.
    */
    expect(waited).toBeLessThan(BOUNDED_TOLERANCE_MS);

    await expect(originator).rejects.toBeInstanceOf(AnalysisDeadlineExceededError);
    neverSettles.resolve(undefined);
  });

  it('bounding the joiner does NOT duplicate provider work — one shared operation, one call', async () => {
    /*
      THE CONSTRAINT THE CORRECTION HAD TO RESPECT. The easy way to bound a
      joiner is to stop sharing and let it start its own run, which would double
      the provider spend on exactly the requests that are already struggling.
      `withResponseDeadline` races the SHARED promise and never replaces it, so
      the coalescing guarantee is untouched.
    */
    const neverSettles = deferred<unknown>();
    const { service, provider } = buildService(JOINER_BUDGET_MS, neverSettles.promise);

    const originator = service.analyzeNews('a third identical question');
    const joiner = service.analyzeNews('a third identical question');

    await expect(joiner).rejects.toBeInstanceOf(AnalysisDeadlineExceededError);
    await expect(originator).rejects.toBeInstanceOf(AnalysisDeadlineExceededError);

    expect(provider.analyzeNews).toHaveBeenCalledTimes(1);

    neverSettles.resolve(undefined);
  });

  it('a deadline is a 504, so it is reported as a timeout and not as a server fault', async () => {
    /*
      FINDING 3, asserted where the error is actually produced. Rev A threw a
      plain Error, which GlobalExceptionFilter sanitised into a 500 — and
      `codeForStatus` maps `>= 500` to 'server'. The status is the whole
      mechanism by which the frontend can say "it took too long" rather than
      "the backend broke", so it is pinned here.
    */
    const neverSettles = deferred<unknown>();
    const { service } = buildService(JOINER_BUDGET_MS, neverSettles.promise);

    const originator = service.analyzeNews('a fourth identical question');
    const joiner = service.analyzeNews('a fourth identical question');

    const raised = await joiner.catch((error: unknown) => error);

    expect(raised).toBeInstanceOf(AnalysisDeadlineExceededError);
    expect((raised as AnalysisDeadlineExceededError).getStatus()).toBe(504);

    await expect(originator).rejects.toBeInstanceOf(AnalysisDeadlineExceededError);
    neverSettles.resolve(undefined);
  });

  it('within budget, a joiner still resolves normally and keeps its OWN query envelope', async () => {
    /*
      THE NEGATIVE CONTROL. A deadline that fired on healthy traffic would be a
      worse defect than the one being fixed, so the ordinary shared-success path
      is asserted under the SHIPPED budget: the joiner resolves, shares the
      analysis, and still reports the query text it itself sent.
    */
    const pending = deferred<unknown>();
    const { service, provider, articles } = buildService(
      ANALYSIS_TOTAL_BUDGET_MS,
      pending.promise,
    );

    const originator = service.analyzeNews('Shared Question');
    const joiner = service.analyzeNews('shared question');

    pending.resolve(validCandidateFor(articles));

    const [first, second] = await Promise.all([originator, joiner]);

    expect(provider.analyzeNews).toHaveBeenCalledTimes(1);
    expect(second.analysis).toEqual(first.analysis);
    expect(first.query).toBe('Shared Question');
    expect(second.query).toBe('shared question');
  });
});
