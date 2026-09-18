import { NewsService } from './news.service';
import { ProviderExecutionRegistry } from './telemetry/provider-execution.registry';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R5 — THE INVARIANT, ASSERTED AS A COUNT OF PROVIDER INVOCATIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Opening or navigating the Map must never execute GNews merely to obtain
 * the global corpus.**
 *
 * Every assertion below counts calls on a provider spy. No latency is read
 * anywhere in this file — R4 existed because "the endpoint was called" had
 * been mistaken for "the provider ran", and a stopwatch is what made that
 * mistake possible.
 *
 * `topHeadlinesCacheOnly` is the map's path. `topHeadlines` is Home's. The
 * whole design is that those two names mean different things to the quota, and
 * these tests are what stop them converging again.
 */

const ARTICLE: NewsArticle = {
  id: 'a1',
  title: 'Headline',
  summary: 'Summary',
  url: 'https://example.invalid/a1',
  sourceId: 'src',
  sourceName: 'Source',
  category: 'world',
  sourcesCount: 1,
  publishedAt: new Date().toISOString(),
  countryCode: 'RW',
};

interface Harness {
  readonly service: NewsService;
  readonly registry: ProviderExecutionRegistry;
  /** Provider invocations — THE QUOTA-BEARING COUNT. */
  executions(): number;
}

function buildService(articles: NewsArticle[] = [ARTICLE]): Harness {
  const topHeadlines = jest.fn().mockResolvedValue(articles);

  const provider = {
    id: 'gnews',
    displayName: 'GNews',
    isMock: false,
    search: jest.fn().mockResolvedValue([]),
    topHeadlines,
    category: jest.fn().mockResolvedValue([]),
    health: jest.fn(),
  };

  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };

  const service = new NewsService([provider] as never, [provider] as never, persistence as never);

  /*
    The registry Nest would inject. Assigned the same way the container assigns
    it, so these tests observe the counters the running application observes
    rather than a parallel instrument.
  */
  const registry = new ProviderExecutionRegistry();
  (service as unknown as { executions: ProviderExecutionRegistry }).executions = registry;

  return { service, registry, executions: () => topHeadlines.mock.calls.length };
}

/** The map's arrival, spelled once so no test can accidentally use Home's. */
const mapOpen = (h: Harness, lang = 'en'): NewsResponse =>
  h.service.topHeadlinesCacheOnly(24, { lang });

/** Home's render, which is allowed to pay. */
const homeLoad = (h: Harness, lang = 'en'): Promise<NewsResponse> =>
  h.service.topHeadlines(24, { lang });

describe('R5 · THE MAP CANNOT SPEND QUOTA, UNDER ANY SEQUENCE', () => {
  it('a COLD map open with nothing cached executes NOTHING', async () => {
    const h = buildService();

    const response = mapOpen(h);

    expect(h.executions()).toBe(0);
    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('unavailable');
  });

  it('and it says "nothing retained" rather than "retrieval failed"', () => {
    /*
      Both members of NewsFallbackReason assert something about a provider that
      was consulted. Nothing was consulted, so attaching either would be the
      response telling the reader a retrieval failed when none was attempted.
    */
    const h = buildService();

    expect(mapOpen(h).fallbackReason).toBeUndefined();
    expect(mapOpen(h).providers).toEqual([]);
  });

  it('TEN repeated map reloads cost ZERO executions', async () => {
    const h = buildService();

    for (let i = 0; i < 10; i += 1) mapOpen(h);

    expect(h.executions()).toBe(0);
  });

  it('a map open never WRITES the cache either, so it cannot warm itself', async () => {
    /*
      A read that populates is a retrieval wearing a different name. If the
      cache-only path cached its own empty answer, the next Home load would be
      served an empty corpus from a miss that cost nothing to produce.
    */
    const h = buildService();

    mapOpen(h);
    await homeLoad(h);

    expect(h.executions()).toBe(1);
    expect((await homeLoad(h)).articles).toHaveLength(1);
  });
});

describe('R5 · THE 300s WINDOW NO LONGER DECIDES WHAT THE MAP COSTS', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('map open at 299s → 0 executions', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T10:00:00Z'));

    const h = buildService();
    await homeLoad(h);
    expect(h.executions()).toBe(1);

    jest.setSystemTime(new Date('2026-09-18T10:04:59Z'));
    const response = mapOpen(h);

    expect(h.executions()).toBe(1);
    expect(response.articles).toHaveLength(1);
  });

  it('map open at 301s → STILL 0 executions, and an honest empty world', async () => {
    /*
      THE ONE THAT MATTERS MOST. Before R5 this was the moment a reader paid:
      the entry had expired, the map's fetch fell through, and a provider ran.
      Now the corpus is simply gone and the map says so.
    */
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T10:00:00Z'));

    const h = buildService();
    await homeLoad(h);
    expect(h.executions()).toBe(1);

    jest.setSystemTime(new Date('2026-09-18T10:05:01Z'));
    const response = mapOpen(h);

    expect(h.executions()).toBe(1);
    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('unavailable');
  });

  it('a map open after simulated expiry, with no Home load at all, executes nothing', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T10:00:00Z'));

    const h = buildService();
    mapOpen(h);

    jest.setSystemTime(new Date('2026-09-18T11:00:00Z'));
    mapOpen(h);

    expect(h.executions()).toBe(0);
  });
});

describe('R5 · THE STRONGER B2 CONTRACT — HOME PAYS ONCE, MAP PAYS NEVER', () => {
  it('Home cold → AT MOST ONE execution', async () => {
    const h = buildService();

    await homeLoad(h);

    expect(h.executions()).toBe(1);
  });

  it('Home → Map warm → NO second execution, and the map sees Home’s corpus', async () => {
    const h = buildService();

    await homeLoad(h);
    const onMap = mapOpen(h);

    expect(h.executions()).toBe(1);
    expect(onMap.articles).toHaveLength(1);
    expect(onMap.dataMode).not.toBe('unavailable');
  });

  it('Home once, then SIX map opens → still exactly one execution', async () => {
    const h = buildService();

    await homeLoad(h);
    for (let i = 0; i < 6; i += 1) mapOpen(h);

    expect(h.executions()).toBe(1);
  });
});

describe('R5 · EN → PL, THE LANGUAGE-REFRESH PATH', () => {
  it('EN map then PL map refresh → 0 executions, both of them', () => {
    /*
      `ALPHA-LANGUAGE-REFRESH-DOUBLE-RETRIEVAL-1`. A reader whose cookie is
      absent but whose localStorage says Polish makes LanguageSync refresh, and
      the map's effect re-runs at a second key. R4 recorded that as TWO
      executions on a first visit. It is now two cache-only reads.

      The double HTTP request remains, and remains an efficiency item. What it
      can no longer be is a quota event.
    */
    const h = buildService();

    const en = mapOpen(h, 'en');
    const pl = mapOpen(h, 'pl');

    expect(h.executions()).toBe(0);
    expect(en.dataMode).toBe('unavailable');
    expect(pl.dataMode).toBe('unavailable');
  });

  it('a warm EN corpus does NOT answer a PL map open — and still costs nothing', async () => {
    /*
      The corpora are genuinely disjoint: GNews is asked for `lang` and the
      provider then keeps only articles whose own sourceLanguage matches. A PL
      reader served the EN corpus would be shown English reporting as if it
      were theirs. So the miss is CORRECT, and the point of R5 is that a
      correct miss is now free.
    */
    const h = buildService();

    await homeLoad(h, 'en');
    const pl = mapOpen(h, 'pl');

    expect(h.executions()).toBe(1);
    expect(pl.articles).toEqual([]);
  });
});

describe('R5 · ALPHA-TOPHEADLINES-KEY-DIVERGENCE-1 — THE KEY IS `limit:language`', () => {
  it('the map reading width 24 is served by Home writing width 24', async () => {
    const h = buildService();

    await homeLoad(h);

    expect(h.service.topHeadlinesCacheOnly(24, { lang: 'en' }).articles).toHaveLength(1);
  });

  it('a WIDTH divergence silently empties the map — which is why it is pinned here', async () => {
    /*
      THE HAZARD, STATED AS A TEST RATHER THAN A COMMENT.

      If Home ever wrote `24:en` while the map read `12:en`, the map would miss
      on every open and — because its route cannot retrieve — would show an
      EMPTY WORLD while Home showed a full one. Nothing in the product would
      report the disagreement. This asserts the divergence is real so that the
      two call sites are never "tidied" into disagreement.
    */
    const h = buildService();

    await homeLoad(h);

    expect(h.service.topHeadlinesCacheOnly(12, { lang: 'en' }).articles).toEqual([]);
    expect(h.executions()).toBe(1);
  });

  it('an ABSENT language is a THIRD key, not a match for `en`', async () => {
    const h = buildService();

    await homeLoad(h, 'en');

    expect(h.service.topHeadlinesCacheOnly(24, {}).articles).toEqual([]);
  });

  it('24:en and 24:pl are separate corpora', async () => {
    const h = buildService();

    await homeLoad(h, 'en');
    await homeLoad(h, 'pl');

    expect(h.executions()).toBe(2);
    expect(h.service.topHeadlinesCacheOnly(24, { lang: 'en' }).articles).toHaveLength(1);
    expect(h.service.topHeadlinesCacheOnly(24, { lang: 'pl' }).articles).toHaveLength(1);
  });
});

describe('R5 · A DEGRADED PROVIDER CANNOT TURN THE MAP INTO A RETRY LOOP', () => {
  it('Home failing to retrieve leaves the map at zero cost, not at three', async () => {
    /*
      R4's worst case. `rememberHomeNews` refuses to cache an empty response —
      correctly, so one quota refusal cannot blank the homepage for a window —
      and the consequence used to be that EVERY map mount re-executed against a
      provider that was already failing. The map is now out of that loop
      entirely: Home still retries, the map simply shows nothing.
    */
    const h = buildService([]);

    await homeLoad(h);
    mapOpen(h);
    mapOpen(h);
    mapOpen(h);

    expect(h.executions()).toBe(1);
  });
});

describe('R5 · TELEMETRY OBSERVES THE PATH R4 COULD NOT SEE', () => {
  it('a cache-only HIT is recorded as a top-headlines hit, with no execution', async () => {
    const h = buildService();

    await homeLoad(h);
    h.registry.reset();

    mapOpen(h);

    const bucket = h.registry.snapshot().find((b) => b.provider === 'cache');

    expect(bucket?.endpointClass).toBe('top-headlines');
    expect(bucket?.cacheHits).toBe(1);
    expect(h.registry.totalExecutions()).toBe(0);
  });

  it('a cache-only MISS is recorded as a miss, and still no execution', () => {
    const h = buildService();

    mapOpen(h);

    const bucket = h.registry.snapshot().find((b) => b.provider === 'cache');

    expect(bucket?.cacheMisses).toBe(1);
    expect(h.registry.totalExecutions()).toBe(0);
  });

  it('a HOME execution is recorded against the provider AND classed top-headlines', async () => {
    /*
      THE GAP R4 FOUND. R2 recorded executions inside `search()` only, so the
      endpoint under investigation reported nothing at all. Recording now
      happens in `callProviderSet`, through which every provider invocation in
      this service passes.
    */
    const h = buildService();

    await homeLoad(h);

    const bucket = h.registry.snapshot().find((b) => b.provider === 'gnews');

    expect(bucket?.endpointClass).toBe('top-headlines');
    expect(bucket?.executions).toBe(1);
    expect(h.registry.totalExecutions()).toBe(1);
  });

  it('telemetry never alters what the provider did', async () => {
    /*
      The rule the R2 counter broke once already: a throw from the counter
      landed in provider-failure handling and a FAILING provider was recorded
      as having responded. A registry that throws on every call must leave the
      response byte-identical.
    */
    const broken = () => {
      throw new Error('telemetry is broken');
    };

    const exploding = {
      recordExecution: broken,
      recordCacheHit: broken,
      recordCacheMiss: broken,
    };

    /* The same request, once with a working registry and once with a hostile one. */
    const control = await homeLoad(buildService());

    const h = buildService();
    (h.service as unknown as { executions: unknown }).executions = exploding;

    const response = await homeLoad(h);

    expect(response.articles).toHaveLength(1);
    expect(response.providers).toEqual(control.providers);
    expect(() => mapOpen(h)).not.toThrow();
  });
});
