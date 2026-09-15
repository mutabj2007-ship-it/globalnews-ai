import { Test, TestingModule } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import type { NewsProvider } from './interfaces';
import { ArticlePersistenceService } from './persistence/article-persistence.service';

/**
 * NAVIGATION-LIVE-RETRIEVAL-CORRECTION (Option 1) — the quota gates.
 *
 * WHAT THESE ASSERT, AND WHY IT IS A CALL COUNT RATHER THAN A RESPONSE SHAPE.
 * The defect this correction closes was never visible in a response: every one
 * of the 95 production retrievals returned HTTP 200. What was wrong was how
 * many times a provider was reached to produce them. So the unit under test
 * here is the provider spy's call count, and nothing else.
 *
 * NOT ONE OF THESE TESTS CONSUMES GNEWS QUOTA, BY CONSTRUCTION. The provider is
 * a local spy object. There is no network client anywhere in this file, no API
 * key is read, and no fixture contains one. That is a hard requirement of this
 * lane and it is met by the test design, not by configuration.
 *
 * TIME IS INJECTED, NEVER SLEPT. Expiry is exercised by moving Date.now()
 * forward with a fake timer. A test that slept for 300 seconds would be a
 * flaky test, and a flaky quota gate gets disabled within a month — which is
 * worse than not having written it.
 */

const HOME_LIMIT = 24;
const TTL_SECONDS = 300;

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: overrides.id ?? 'article-1',
    title: 'Headline',
    summary: 'Summary',
    url: `https://example.com/${overrides.id ?? 'article-1'}`,
    sourceId: 'spy-provider',
    sourceName: 'Spy Provider',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Counts every topHeadlines() invocation and records the language it was asked
 * for, so a test can assert not merely HOW MANY retrievals happened but WHICH
 * corpus each one was for. B5 and B6 depend on that distinction: "at most one
 * retrieval" is only the right answer if the one retrieval was for the cold
 * corpus and not a redundant re-fetch of the warm one.
 */
class SpyProvider implements NewsProvider {
  readonly id = 'spy-provider';
  readonly displayName = 'Spy Provider';
  readonly isMock = false;

  topHeadlinesCalls: Array<{ lang?: string; limit?: number }> = [];
  searchCalls = 0;
  categoryCalls = 0;

  constructor(private readonly articlesFor: (lang?: string) => NewsArticle[] = () => [makeArticle()]) {}

  async search(): Promise<NewsArticle[]> {
    this.searchCalls += 1;
    return [makeArticle({ id: 'search-1' })];
  }

  async topHeadlines(options?: { lang?: string; limit?: number }): Promise<NewsArticle[]> {
    this.topHeadlinesCalls.push({ lang: options?.lang, limit: options?.limit });
    return this.articlesFor(options?.lang);
  }

  async category(): Promise<NewsArticle[]> {
    this.categoryCalls += 1;
    return [makeArticle({ id: 'category-1' })];
  }

  async health() {
    return { id: this.id, displayName: this.displayName, healthy: true } as never;
  }

  get callCount(): number {
    return this.topHeadlinesCalls.length;
  }

  langsRequested(): Array<string | undefined> {
    return this.topHeadlinesCalls.map((call) => call.lang);
  }
}

/** A provider that always throws, standing in for a quota-exhausted GNews. */
class FailingProvider implements NewsProvider {
  readonly id = 'failing-provider';
  readonly displayName = 'Failing Provider';
  readonly isMock = false;

  calls = 0;

  async search(): Promise<NewsArticle[]> {
    throw new Error('provider down');
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    this.calls += 1;
    throw new Error('GNews returned 403');
  }

  async category(): Promise<NewsArticle[]> {
    throw new Error('provider down');
  }

  async health() {
    return { id: this.id, displayName: this.displayName, healthy: false } as never;
  }
}

/**
 * A provider that answers only after a caller-controlled delay, used by the
 * cold-cache concurrency diagnostic. The delay is what creates the window in
 * which several requests can be in flight at once with the cache still empty.
 */
class DelayedProvider implements NewsProvider {
  readonly id = 'delayed-provider';
  readonly displayName = 'Delayed Provider';
  readonly isMock = false;

  calls = 0;

  constructor(private readonly delayMs: number) {}

  async search(): Promise<NewsArticle[]> {
    return [];
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    this.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return [makeArticle({ id: 'delayed-1' })];
  }

  async category(): Promise<NewsArticle[]> {
    return [];
  }

  async health() {
    return { id: this.id, displayName: this.displayName, healthy: true } as never;
  }
}

function createPersistenceStub() {
  return {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
  } as unknown as ArticlePersistenceService;
}

/**
 * Builds the service with a real provider TIER split.
 *
 * `fallbackProviders` must be a subset of `providers` by identity, because
 * eligibleProvidersForTier() partitions `this.providers` using the id set of
 * `this.fallbackProviders` — a fallback provider that is not also registered in
 * NEWS_PROVIDERS is never called at all. Passing the same instances into both
 * arrays is what makes this a genuine tier test rather than a test of two
 * unrelated arrays.
 */
async function createService(
  providers: NewsProvider[],
  fallbackProviders: NewsProvider[] = [],
): Promise<NewsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: providers },
      { provide: ALL_NEWS_PROVIDERS, useValue: providers },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbackProviders },
      { provide: ArticlePersistenceService, useValue: createPersistenceStub() },
    ],
  }).compile();

  return module.get<NewsService>(NewsService);
}

describe('NAVIGATION-LIVE-RETRIEVAL-CORRECTION — Home shared-evidence cache', () => {
  describe('A — English corpus freshness', () => {
    it('A1: a cold EN Home render performs at most one provider retrieval', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.callCount).toBe(1);
    });

    it('A2: a second EN Home render performs zero additional retrievals', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const afterFirst = spy.callCount;
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.callCount - afterFirst).toBe(0);
      expect(spy.callCount).toBe(1);
    });

    it('A3: a SECOND READER of the same corpus performs zero additional retrievals', async () => {
      /*
        The heart of the correction. Two independent requests, no shared
        request context, no shared session — the only thing they have in common
        is the corpus they are asking for, and that has to be enough.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.callCount).toBe(1);
    });

    it('A4: an EN Home reload performs zero additional retrievals', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.callCount).toBe(1);
    });

    it('A5: an OAuth landing on a warm EN Home performs zero additional retrievals', async () => {
      /*
        Production proved the shape of this on 2026-09-15 at 01:53: three OAuth
        callbacks produced three homepage renders and three live retrievals.
        The sign-in path itself never touched a provider then and does not now;
        what cost quota was the page it returned the reader to. This asserts
        that landing is now free when the corpus is warm.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' }); // pre-sign-in render
      const beforeLanding = spy.callCount;

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' }); // post-OAuth landing

      expect(spy.callCount - beforeLanding).toBe(0);
    });
  });

  describe('B — Polish corpus, and crossing between corpora', () => {
    it('B1: a cold PL Home render performs at most one provider retrieval', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' });

      expect(spy.callCount).toBe(1);
      expect(spy.langsRequested()).toEqual(['pl']);
    });

    it('B2: a second PL Home render performs zero additional retrievals', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' });

      expect(spy.callCount).toBe(1);
    });

    it('B3: EN warm -> PL warm performs zero provider calls', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' }); // warm EN
      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' }); // warm PL
      const afterWarming = spy.callCount;

      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' }); // the switch

      expect(spy.callCount - afterWarming).toBe(0);
    });

    it('B4: PL warm -> EN warm performs zero provider calls', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const afterWarming = spy.callCount;

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.callCount - afterWarming).toBe(0);
    });

    it('B5: EN warm -> PL cold performs exactly one retrieval, and it is for PL', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const afterEn = spy.callCount;

      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' });

      expect(spy.callCount - afterEn).toBe(1);
      expect(spy.topHeadlinesCalls[spy.callCount - 1].lang).toBe('pl');
    });

    it('B6: PL warm -> EN cold performs exactly one retrieval, and it is for EN', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'pl' });
      const afterPl = spy.callCount;

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.callCount - afterPl).toBe(1);
      expect(spy.topHeadlinesCalls[spy.callCount - 1].lang).toBe('en');
    });

    it('B7: an unspecified language is NOT served from the English snapshot', async () => {
      /*
        Absent lang and lang='en' are different corpora at the provider: with a
        language GNews filters and discards unknown-language articles; without
        one it returns an unfiltered mixture. Serving one as the other would be
        a correctness bug wearing a cache's clothing.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      await service.topHeadlines(HOME_LIMIT);

      expect(spy.callCount).toBe(2);
      expect(spy.langsRequested()).toEqual(['en', undefined]);
    });
  });

  describe('C — sharing, expiry, failure and scope', () => {
    it('C1: the snapshot is shared between anonymous and authenticated readers', async () => {
      /*
        There is no auth-state parameter on this path at all, which is the
        strongest possible form of this guarantee: the service cannot tell the
        two apart, so it cannot serve them separately. Asserted through the
        public API rather than by reading the key, because the property that
        matters is the observable one.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' }); // anonymous reader
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' }); // signed-in reader

      expect(spy.callCount).toBe(1);
    });

    it('C2: the cache key is never keyed by user, session, auth state or route', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      const keys = Array.from(
        (service as unknown as { homeNewsCache: Map<string, unknown> }).homeNewsCache.keys(),
      );

      expect(keys).toEqual(['24:en']);
      for (const key of keys) {
        expect(key).not.toMatch(/user|session|auth|token|route|returnTo|watch|follow/i);
      }
    });

    it('C3: expiry causes at most one new retrieval for that corpus', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00.000Z'));

      try {
        const spy = new SpyProvider();
        const service = await createService([spy]);

        await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
        expect(spy.callCount).toBe(1);

        // Still inside the window: free.
        jest.setSystemTime(new Date(Date.now() + (TTL_SECONDS - 1) * 1000));
        await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
        expect(spy.callCount).toBe(1);

        // Past the window: exactly one refill, not one per reader.
        jest.setSystemTime(new Date(Date.now() + 2000));
        await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
        await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
        expect(spy.callCount).toBe(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('C4: a cached response carries its metadata through unchanged', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      const first = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const second = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(spy.callCount).toBe(1);
      expect(second.dataMode).toBe(first.dataMode);
      expect(second.fallbackReason).toBe(first.fallbackReason);
      expect(second.providers).toEqual(first.providers);
    });

    it('C5: a provider failure is NEVER cached as a successful result', async () => {
      /*
        The gate that stops this correction turning a quota hiccup into an
        outage. If an empty/failed response were stored, one 403 would blank the
        homepage for every reader for the whole window — silently, because the
        endpoint still answers 200.
      */
      const failing = new FailingProvider();
      const service = await createService([failing]);

      const first = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      expect(first.articles).toHaveLength(0);
      expect(failing.calls).toBe(1);

      // The next reader must retry, not inherit the failure.
      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      expect(failing.calls).toBe(2);

      const keys = Array.from(
        (service as unknown as { homeNewsCache: Map<string, unknown> }).homeNewsCache.keys(),
      );
      expect(keys).toEqual([]);
    });

    it('C6: a keyword-filtered call (Analysis) is never cached and always reaches the provider', async () => {
      /*
        Analysis retrieval is outside this lane. It reaches this same method
        with a `q`, and is excluded by construction rather than by call-site
        discipline, so it cannot drift into this cache by a later edit.
      */
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'pl', q: 'Polska bezpieczeństwo' });
      await service.topHeadlines(HOME_LIMIT, { lang: 'pl', q: 'Polska bezpieczeństwo' });

      expect(spy.callCount).toBe(2);

      const keys = Array.from(
        (service as unknown as { homeNewsCache: Map<string, unknown> }).homeNewsCache.keys(),
      );
      expect(keys).toEqual([]);
    });

    it('C6b: search() is untouched by this correction', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.search('kenya', 8);
      await service.search('kenya', 8);

      expect(spy.searchCalls).toBe(2);
    });

    it('C7: a different retrieval width is a different corpus and is not served from the cache', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.topHeadlines(24, { lang: 'en' });
      await service.topHeadlines(12, { lang: 'en' });

      expect(spy.callCount).toBe(2);
    });

    it('C8: byCategory() is untouched by this correction', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      await service.byCategory('world', 12);
      await service.byCategory('world', 12);

      expect(spy.categoryCalls).toBe(2);
    });

    it('C9: provenance and evidence identity survive a cache hit unchanged', async () => {
      const spy = new SpyProvider();
      const service = await createService([spy]);

      const first = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const second = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(second.articles.map((a) => a.url)).toEqual(first.articles.map((a) => a.url));
      expect(second.articles.map((a) => a.sourceName)).toEqual(
        first.articles.map((a) => a.sourceName),
      );
      expect(second.articles.map((a) => a.sourceId)).toEqual(first.articles.map((a) => a.sourceId));
    });
  });

  /**
   * D — THE REAL PROVIDER-TIER TEST.
   *
   * WHY THIS EXISTS SEPARATELY FROM C4. The original C4 was labelled "fallback"
   * but instantiated no fallback tier: it registered one healthy provider and
   * therefore proved only that a cached response keeps its metadata. That is a
   * true statement and C4 still asserts it, but it is NOT the fallback claim,
   * and the two were conflated under one name. This suite makes the claim the
   * name implied, with a genuine two-tier registration.
   *
   * THE TIER SPLIT IS BY IDENTITY, NOT BY ARRAY. eligibleProvidersForTier()
   * partitions NEWS_PROVIDERS using the id set of FALLBACK_NEWS_PROVIDERS, so
   * the fallback instance must appear in BOTH arrays or it is never called at
   * all. Getting that wrong is exactly how a fallback test ends up proving
   * nothing, which is what happened the first time.
   */
  describe('D — real primary-failure -> fallback-success, then cached', () => {
    /**
     * Fails the way a quota-exhausted GNews fails: a thrown provider error, the
     * same class the production logs recorded 53 times as HTTP 403 and 26 times
     * as HTTP 429 in a single day.
     */
    class QuotaRefusedPrimary implements NewsProvider {
      readonly id = 'primary-gnews-like';
      readonly displayName = 'Primary (quota refused)';
      readonly isMock = false;

      calls = 0;

      async search(): Promise<NewsArticle[]> {
        throw new Error('GNews returned 403');
      }

      async topHeadlines(): Promise<NewsArticle[]> {
        this.calls += 1;
        throw new Error('GNews returned 403. On this plan that indicates the daily quota.');
      }

      async category(): Promise<NewsArticle[]> {
        throw new Error('GNews returned 403');
      }

      async health() {
        return { id: this.id, displayName: this.displayName, healthy: false } as never;
      }
    }

    /** Stands in for the configured RSS fallback tier: it answers with real reporting. */
    class HealthyFallback implements NewsProvider {
      readonly id = 'fallback-rss-like';
      readonly displayName = 'Fallback (RSS-like)';
      readonly isMock = false;

      calls = 0;

      async search(): Promise<NewsArticle[]> {
        return [];
      }

      async topHeadlines(): Promise<NewsArticle[]> {
        this.calls += 1;
        return [
          makeArticle({ id: 'fallback-1', sourceId: 'fallback-rss-like', sourceName: 'Fallback Wire' }),
          makeArticle({ id: 'fallback-2', sourceId: 'fallback-rss-like', sourceName: 'Fallback Wire' }),
        ];
      }

      async category(): Promise<NewsArticle[]> {
        return [];
      }

      async health() {
        return { id: this.id, displayName: this.displayName, healthy: true } as never;
      }
    }

    it('D1: the first request calls the primary once, the fallback once, and returns fallback evidence', async () => {
      const primary = new QuotaRefusedPrimary();
      const fallback = new HealthyFallback();
      const service = await createService([primary, fallback], [fallback]);

      const response = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(primary.calls).toBe(1);
      expect(fallback.calls).toBe(1);
      expect(response.articles.length).toBeGreaterThan(0);
      // The evidence served is the FALLBACK's, and it says so.
      expect(response.providers).toEqual(['fallback-rss-like']);
      expect(response.articles.every((a) => a.sourceId === 'fallback-rss-like')).toBe(true);
    });

    it('D2: a second reader in the same window calls NEITHER provider again', async () => {
      /*
        This is the gate that matters for quota. Production showed 87 fallback
        activations against 79 primary refusals in one day: every reader was
        re-attempting an exhausted primary before falling through. After this
        correction the second reader touches neither tier.
      */
      const primary = new QuotaRefusedPrimary();
      const fallback = new HealthyFallback();
      const service = await createService([primary, fallback], [fallback]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const primaryAfterFirst = primary.calls;
      const fallbackAfterFirst = fallback.calls;

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(primary.calls - primaryAfterFirst).toBe(0);
      expect(fallback.calls - fallbackAfterFirst).toBe(0);
      expect(primary.calls).toBe(1);
      expect(fallback.calls).toBe(1);
    });

    it('D3: the cached fallback evidence keeps its identity, provenance and degraded metadata', async () => {
      const primary = new QuotaRefusedPrimary();
      const fallback = new HealthyFallback();
      const service = await createService([primary, fallback], [fallback]);

      const first = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      const second = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      // Identity and provenance, article for article.
      expect(second.articles.map((a) => a.url)).toEqual(first.articles.map((a) => a.url));
      expect(second.articles.map((a) => a.sourceId)).toEqual(first.articles.map((a) => a.sourceId));
      expect(second.articles.map((a) => a.sourceName)).toEqual(
        first.articles.map((a) => a.sourceName),
      );

      // The degraded state is cached, never disguised: a reader served from the
      // cache is told exactly what the first reader was told.
      expect(second.providers).toEqual(first.providers);
      expect(second.providers).toEqual(['fallback-rss-like']);
      expect(second.dataMode).toBe(first.dataMode);
      expect(second.fallbackReason).toBe(first.fallbackReason);
    });

    it('D4: when BOTH tiers fail, nothing is cached and the next reader retries both', async () => {
      /*
        The companion to C5 at tier level. A total outage must not be stored as
        a successful snapshot, or one bad minute would blank the homepage for
        the whole freshness window.
      */
      const primary = new QuotaRefusedPrimary();
      const deadFallback = new QuotaRefusedPrimary() as unknown as HealthyFallback & {
        calls: number;
      };
      Object.defineProperty(deadFallback, 'id', { value: 'fallback-dead' });

      const service = await createService(
        [primary, deadFallback as unknown as NewsProvider],
        [deadFallback as unknown as NewsProvider],
      );

      const first = await service.topHeadlines(HOME_LIMIT, { lang: 'en' });
      expect(first.articles).toHaveLength(0);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' });

      expect(primary.calls).toBe(2);
      expect(deadFallback.calls).toBe(2);
    });
  });

  /**
   * E — COLD-CACHE CONCURRENCY DIAGNOSTIC.
   *
   * THIS MEASURES; IT DOES NOT DEMAND. The implementation was deliberately NOT
   * changed to influence this number, per the verification lane's instruction.
   * The assertion band is therefore deliberately wide: it proves the request
   * count cannot EXCEED the number of concurrent callers (which would indicate
   * something far worse than a stampede) while leaving the actual value free to
   * be whatever the shipped code does. The measured number is reported to the
   * CTO as CONCURRENT_COLD_CALLS.
   *
   *   1 call   -> in-flight deduplication effectively present
   *   > 1 call -> known cold-cache stampede limitation
   */
  describe('E — cold-cache concurrency (diagnostic only)', () => {
    it('E1: measures provider invocations for three concurrent cold same-corpus requests', async () => {
      const delayed = new DelayedProvider(50);
      const service = await createService([delayed]);

      await Promise.all([
        service.topHeadlines(HOME_LIMIT, { lang: 'en' }),
        service.topHeadlines(HOME_LIMIT, { lang: 'en' }),
        service.topHeadlines(HOME_LIMIT, { lang: 'en' }),
      ]);

      // Reported to the CTO as CONCURRENT_COLD_CALLS.
      // eslint-disable-next-line no-console
      console.log(`CONCURRENT_COLD_CALLS = ${delayed.calls}`);

      expect(delayed.calls).toBeGreaterThanOrEqual(1);
      expect(delayed.calls).toBeLessThanOrEqual(3);
    });

    it('E2: once the window is populated, concurrency costs nothing further', async () => {
      /*
        The stampede, if present, is bounded to the COLD window only. This
        asserts the property that actually governs steady-state quota: after one
        successful fill, any number of simultaneous readers are free.
      */
      const delayed = new DelayedProvider(20);
      const service = await createService([delayed]);

      await service.topHeadlines(HOME_LIMIT, { lang: 'en' }); // warm it
      const afterWarm = delayed.calls;

      await Promise.all([
        service.topHeadlines(HOME_LIMIT, { lang: 'en' }),
        service.topHeadlines(HOME_LIMIT, { lang: 'en' }),
        service.topHeadlines(HOME_LIMIT, { lang: 'en' }),
        service.topHeadlines(HOME_LIMIT, { lang: 'en' }),
      ]);

      expect(delayed.calls - afterWarm).toBe(0);
    });
  });
});
