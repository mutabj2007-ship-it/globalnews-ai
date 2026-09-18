import { readFileSync } from 'fs';
import { join } from 'path';

import { providerStatusFrom } from '@/lib/map/selection/selectionIntelligence';
import type { CountryNewsResponse } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R5 — THE MAP MUST BE UNABLE TO REACH THE EXECUTING ROUTE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Product invariant: opening or navigating the Map must never execute GNews
 * merely to obtain the global corpus.**
 *
 * The backend half is counted in `r5NonExecutingGlobal.spec.ts`. This half is
 * about which function the map is WIRED to, because the invariant is only as
 * strong as the call site: R4 measured the map spending quota on every mount
 * for months, and not one line of code said it intended to.
 *
 * Source assertions, deliberately. A mocked-module test would prove the mock
 * was called; these prove the shipped file cannot call the other thing.
 */

const mapClient = readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8');
const newsApi = readFileSync(join(__dirname, '..', '..', 'lib', 'api', 'newsApi.ts'), 'utf-8');
const homeFeed = readFileSync(join(__dirname, '..', '..', 'lib', 'homeFeed.ts'), 'utf-8');

/** Comments describe the rule; only executable code can break it. */
const strip = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const mapCode = strip(mapClient);

describe('R5 · the Map acquires its corpus through the NON-EXECUTING path', () => {
  it('MapPageClient calls fetchRetainedTopHeadlines', () => {
    expect(mapCode).toContain('fetchRetainedTopHeadlines(GLOBAL_FEED_LIMIT, language)');
  });

  it('and it does NOT call fetchTopHeadlines anywhere', () => {
    /*
      THE ASSERTION THAT ACTUALLY GUARDS THE INVARIANT. Adding the retained
      call while leaving the executing one in place — in a second effect, a
      retry, a "refresh on focus" — would reintroduce the whole defect while
      every other test in this file still passed.
    */
    expect(mapCode).not.toContain('fetchTopHeadlines');
  });

  it('and it does not import the executing client at all', () => {
    expect(mapCode).toMatch(/import \{ fetchRetainedTopHeadlines \} from '@\/lib\/api\/newsApi'/);
  });

  it('no automatic retry or timer was added alongside it', () => {
    /*
      The ruling forbids a new automatic retry, and a quiet-window timer was
      already rejected in R3.1. An empty world is an honest answer; a timer
      that turned it into a retrieval would be the defect wearing a delay.
    */
    const effect = mapCode.slice(mapCode.indexOf('fetchRetainedTopHeadlines'));
    const nextEffect = effect.indexOf('useEffect(');

    const region = nextEffect === -1 ? effect : effect.slice(0, nextEffect);

    expect(region).not.toContain('setTimeout');
    expect(region).not.toContain('setInterval');
  });
});

describe('R5 · the retained client and the executing client request the SAME corpus', () => {
  it('the retained route is the only thing fetchRetainedTopHeadlines hits', () => {
    const fn = newsApi.slice(newsApi.indexOf('export function fetchRetainedTopHeadlines'));

    expect(fn).toContain('/news/top-headlines/retained?');
  });

  it('both clients send limit and lang identically', () => {
    /*
      ALPHA-TOPHEADLINES-KEY-DIVERGENCE-1, at the point the divergence would
      be introduced. The backend key is `limit:language`; Home warms it through
      the executing route and the map reads it through the retained one. If the
      two ever built their query differently the map would miss on every open
      and — because its route cannot retrieve — show an EMPTY WORLD while Home
      showed a full one, with nothing reporting the disagreement.
    */
    const executing = newsApi.slice(
      newsApi.indexOf('export function fetchTopHeadlines'),
      newsApi.indexOf('export function fetchRetainedTopHeadlines'),
    );
    const retained = newsApi.slice(newsApi.indexOf('export function fetchRetainedTopHeadlines'));

    for (const clause of [
      "new URLSearchParams({ limit: String(limit) })",
      "if (lang) params.set('lang', lang);",
    ]) {
      expect(executing).toContain(clause);
      expect(retained).toContain(clause);
    }
  });

  it('Home requests width 24 and the Map reads width 24', () => {
    /*
      The two numbers that must agree, asserted against the two files that own
      them rather than against a constant this test could define itself.
    */
    expect(strip(homeFeed)).toContain('fetchTopHeadlines(24, language)');
    expect(mapCode).toContain('const GLOBAL_FEED_LIMIT = 24;');
  });
});

describe('R5 · Home is deliberately left on the executing path', () => {
  it('getHomeFeed still calls fetchTopHeadlines', () => {
    /*
      Not an oversight. Home is the surface that pays for the corpus, once,
      and that payment is what leaves something for the map to read. Moving
      Home to the retained route would make the world permanently empty.
    */
    expect(strip(homeFeed)).toContain('fetchTopHeadlines(');
    expect(strip(homeFeed)).not.toContain('fetchRetainedTopHeadlines');
  });
});

describe('R5 · SELECTION-INTELLIGENCE-UNGUARDED-TRIM-1', () => {
  const complete: CountryNewsResponse = {
    countryCode: 'RWA',
    countryName: 'Rwanda',
    articles: [],
    totalResults: 0,
    providers: [],
    dataMode: 'cached',
    feedTier: 'live',
    providerDisplayName: 'Stored reporting',
    generatedAt: new Date().toISOString(),
  };

  it('a complete envelope is read exactly as before', () => {
    expect(providerStatusFrom(complete).providerName).toBe('Stored reporting');
  });

  it('a MISSING providerDisplayName degrades to null instead of throwing', () => {
    /*
      THE MEASURED FAILURE. A response without this field made
      `providerDisplayName.trim()` throw, React followed with #310, and the
      ENTIRE MAP SHELL UNMOUNTED — a blank page where one panel should have
      said it did not know the provider. Observed against the deployed Alpha
      build during R3.2 validation.

      The field is still REQUIRED by the shared contract; nothing here weakens
      it. What changes is that one malformed envelope costs one panel rather
      than the map.
    */
    const malformed = { ...complete } as Partial<CountryNewsResponse>;
    delete malformed.providerDisplayName;

    expect(() => providerStatusFrom(malformed as CountryNewsResponse)).not.toThrow();
    expect(providerStatusFrom(malformed as CountryNewsResponse).providerName).toBeNull();
  });

  it('a non-string is treated as ABSENT, never stringified into a label', () => {
    /*
      `providerName: 'undefined'` would be worse than null: the reader would be
      shown a provider name that no provider claimed.
    */
    for (const value of [null, undefined, 42, {}, []]) {
      const malformed = { ...complete, providerDisplayName: value } as unknown as CountryNewsResponse;

      expect(providerStatusFrom(malformed).providerName).toBeNull();
    }
  });

  it('an empty or whitespace name is still null, as it always was', () => {
    expect(providerStatusFrom({ ...complete, providerDisplayName: '' }).providerName).toBeNull();
    expect(providerStatusFrom({ ...complete, providerDisplayName: '   ' }).providerName).toBeNull();
  });

  it('and the condition it reports is unchanged by the guard', () => {
    const malformed = { ...complete, dataMode: 'live' as const } as CountryNewsResponse;
    delete (malformed as Partial<CountryNewsResponse>).providerDisplayName;

    expect(providerStatusFrom(malformed).condition).toBe('LIVE');
  });
});

describe('R5 · PROBE-FIXTURE-INCOMPLETE-ENVELOPE-1 is repaired at its source', () => {
  const probe = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'scripts', 'map-request-economy-probe.mjs'),
    'utf-8',
  );

  it('the country fixture carries every REQUIRED field of the real envelope', () => {
    const fixture = probe.slice(
      probe.indexOf('const COUNTRY_FIXTURE'),
      probe.indexOf('const HEADLINES_FIXTURE'),
    );

    for (const field of [
      'countryCode',
      'countryName',
      'articles',
      'totalResults',
      'providers',
      'dataMode',
      'feedTier',
      'providerDisplayName',
      'generatedAt',
    ]) {
      expect(fixture).toContain(field);
    }
  });

  it('a crashed shell now FAILS the probe instead of passing quietly', () => {
    /*
      The previous version would have exited 0 with a dead page: every count
      was zero because nothing was mounted to make a request.
    */
    expect(probe).toContain("page.on('pageerror'");
    expect(probe).toContain('assertAlive');
    expect(probe).toContain('failed.length === 0 && pageErrors.length === 0');
  });
});
