import { readFileSync } from 'fs';
import { join } from 'path';

import { ProviderExecutionRegistry } from './provider-execution.registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R2 — PROVIDER-EXECUTION OBSERVABILITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The purpose is to separate four things that were previously conflated:
 *
 *     frontend request → backend request → cache miss → PROVIDER EXECUTION
 *
 * Only the last spends quota. `MAP-GNEWS-QUOTA-REGRESSION-1` had to be
 * diagnosed by reading `durationMs` out of an HTTP log; these counters exist so
 * that is never necessary again.
 */
describe('R2 · the counter distinguishes cache from spend', () => {
  let registry: ProviderExecutionRegistry;

  beforeEach(() => {
    registry = new ProviderExecutionRegistry();
  });

  it('a cache hit records no execution — nothing was spent', () => {
    registry.recordCacheHit('country-news');
    registry.recordCacheHit('country-news');

    expect(registry.totalExecutions()).toBe(0);

    const cache = registry.snapshot().find((b) => b.provider === 'cache');

    expect(cache?.cacheHits).toBe(2);
    expect(cache?.executions).toBe(0);
  });

  it('a miss is recorded separately from an execution, because they are different events', () => {
    /*
      A miss means a provider MAY now run. It is not itself a spend, and the
      gap between the two numbers is where a fallback chain becomes visible.
    */
    registry.recordCacheMiss('country-news');
    registry.recordExecution('gnews', 'search');
    registry.recordExecution('gdelt-doc', 'search');

    const cache = registry.snapshot().find((b) => b.provider === 'cache');

    expect(cache?.cacheMisses).toBe(1);
    expect(registry.totalExecutions()).toBe(2);
  });

  it('counts per provider and endpoint class', () => {
    registry.recordExecution('gnews', 'search');
    registry.recordExecution('gnews', 'search');
    registry.recordExecution('gnews', 'top-headlines');

    const snapshot = registry.snapshot();

    expect(snapshot.find((b) => b.endpointClass === 'search')?.executions).toBe(2);
    expect(snapshot.find((b) => b.endpointClass === 'top-headlines')?.executions).toBe(1);
  });

  it('A FAILED CALL STILL COUNTS — this is the SWZ lesson', () => {
    /*
      The live SWZ retrieval took 8272ms: GNews answered "rate limit exceeded",
      then two fallbacks ran, then GDELT timed out into a cooldown. Every one of
      those was spent. A counter that only recorded successes would have
      reported that entire episode as ZERO, which is the opposite of the truth.

      Recording at the invocation rather than the outcome is what makes this
      test pass, and it is why the call site is wrapped rather than the result.
    */
    registry.recordExecution('gnews', 'search');
    registry.recordExecution('gdelt-doc', 'search');
    registry.recordExecution('mock-news', 'search');

    expect(registry.totalExecutions()).toBe(3);
  });

  it('reset clears everything, so one suite cannot inherit another’s counts', () => {
    registry.recordExecution('gnews', 'search');
    registry.reset();

    expect(registry.snapshot()).toEqual([]);
    expect(registry.totalExecutions()).toBe(0);
  });
});

describe('R2 · the counter is wired where the decisions actually happen', () => {
  const src = (...parts: string[]): string =>
    readFileSync(join(__dirname, '..', ...parts), 'utf-8');

  it('the cache hit is recorded inside the country cache branch', () => {
    const country = src('country', 'country-news.service.ts');

    expect(country).toContain("this.executions?.recordCacheHit('country-news')");

    /* Before the early return, or it would never run. */
    const record = country.indexOf("recordCacheHit('country-news')");
    const ret = country.indexOf('return cached;');

    expect(record).toBeGreaterThan(0);
    expect(ret).toBeGreaterThan(record);
  });

  it('and both calls are SELF-CATCHING, so telemetry cannot change behaviour', () => {
    /*
      Learned the hard way. Calling these bare made eight NewsService tests
      change behaviour: a throw landed inside the caller's provider-failure
      handling, so a FAILING provider was recorded as having RESPONDED. The
      worst case must be a lost count, never a changed answer.
    */
    const news = src('news.service.ts');
    const country = src('country', 'country-news.service.ts');

    /* The guard opens immediately before the call, in both files. */
    expect(news).toContain('try {\n        this.executions?.recordExecution(');
    expect(country).toContain('try {\n        this.executions?.recordCacheHit(');

    /* And optional chaining, so a missing registry is also survivable. */
    expect(news).toContain('this.executions?.');
    expect(country).toContain('this.executions?.');
  });

  it('the execution is recorded at the provider INVOCATION, not at its result', () => {
    /*
      ── R5 · THIS ASSERTION WAS REWRITTEN, AND THE RULE GOT STRONGER ───────

      As written in R2 this compared FILE POSITIONS: the `recordExecution`
      call had to appear before `return provider.search(query, {`. That was a
      proxy for "counted at invocation", and it held only because the counter
      lived inside `search()`'s own operation — which is precisely the defect
      R4 found. `topHeadlines()` passes through a different operation and was
      never counted at all, so the one endpoint draining the quota was the one
      endpoint this file could not see.

      Recording now happens in `callProviderSet`, the single place every
      provider invocation in this service passes through, so the two positions
      it used to compare no longer sit in the same function. The intent is
      asserted directly instead: the counter runs BEFORE the awaited
      operation, inside the fan-out all three endpoint classes share.
    */
    /*
      COMMENTS ARE STRIPPED FIRST, and that is not fastidiousness: the comment
      explaining this rule quotes `await operation(provider)`, so a raw
      indexOf found the PROSE before the code and failed an assertion that was
      actually satisfied. A source test that can be broken by its own
      documentation is measuring the wrong thing.
    */
    const news = src('news.service.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const fanOut = news.slice(news.indexOf('const settleOne = async (provider: NewsProvider)'));

    const record = fanOut.indexOf('this.executions?.recordExecution(provider.id, capability)');
    const call = fanOut.indexOf('await operation(provider)');

    expect(record).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(record);
  });

  it('and it is NOT confined to the search path, which is what R4 found', () => {
    /*
      The regression that matters. A counter that only ever sees `search` will
      report zero while the map spends a provider call on every mount, and the
      next investigation gets run with a stopwatch again.
    */
    const news = src('news.service.ts');

    /* The capability label is threaded in, never hard-coded to one endpoint. */
    expect(news).toContain('capability: NewsProviderCapability');
    expect(news).not.toContain("this.executions?.recordExecution(provider.id, 'search')");
  });

  it('cache hits AND misses are both recorded for the home corpus', () => {
    /*
      R2 recorded a hit in the country path and nothing else — no miss, ever,
      anywhere. A registry that reports when the cache SAVED a call but never
      when it failed to cannot answer a quota question.
    */
    const news = src('news.service.ts');

    expect(news).toContain("this.executions?.recordCacheHit('top-headlines')");
    expect(news).toContain("this.executions?.recordCacheMiss('top-headlines')");
  });

  it('the registry is INJECTED as a shared singleton, not instantiated privately', () => {
    /*
      THE DEFECT R4 NAMED. A bare field initialiser is not property injection:
      Nest assigns only a property carrying `@Inject()`, so each service held
      its own registry and the module's provider was never used.

      `@Optional()` is required alongside it — a bare `@Inject()` makes this a
      mandatory dependency, and every test module that omits the registry then
      stops resolving. That turned 19 suites red on the first R5 cut.
    */
    for (const parts of [['news.service.ts'], ['country', 'country-news.service.ts']]) {
      expect(src(...parts)).toContain('@Optional()\n  @Inject(ProviderExecutionRegistry)');
    }
  });

  it('and something actually READS it, behind the admin guard', () => {
    /*
      R2 shipped a write-only counter: nothing outside this spec ever called
      `snapshot()` or `totalExecutions()`. A number nobody can read is not
      observability.
    */
    const admin = readFileSync(
      join(__dirname, '..', '..', 'admin', 'news', 'admin-news.service.ts'),
      'utf-8',
    );

    expect(admin).toContain('this.executions?.snapshot()');
    expect(admin).toContain('this.executions?.totalExecutions()');
  });
});

describe('R2 · nothing sensitive is recorded, and nothing is public', () => {
  const registrySource = readFileSync(join(__dirname, 'provider-execution.registry.ts'), 'utf-8');
  const code = registrySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('no query text, country code, article or credential is stored', () => {
    /*
      A counter that accumulated the places a reader looked at would be a
      behavioural log wearing a metrics costume. The buckets hold four scalars
      and nothing that could identify a person or a search.
    */
    for (const forbidden of [
      'query',
      'countryCode',
      'iso3',
      'apiKey',
      'API_KEY',
      'url',
      'article',
      'email',
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('it is NOT attached to the anonymous public health route', () => {
    /*
      `/news/providers/health` is unauthenticated. Execution counts per provider
      let an anonymous caller watch quota drain in real time and time requests
      against a limit, so the ruling prefers admin-safe instrumentation.
    */
    const controller = readFileSync(
      join(__dirname, '..', 'news.controller.ts'),
      'utf-8',
    );

    expect(controller).not.toContain('ProviderExecutionRegistry');
    expect(controller).not.toContain('recordExecution');
  });
});
