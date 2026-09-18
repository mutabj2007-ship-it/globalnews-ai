import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B-2A — MAP OPEN ASKS FOR THE GOVERNED HOME CORPUS WIDTH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The backend proof (`news.service.home-map-corpus.spec.ts`) shows that two
 * requests at the SAME width execute the provider once. That proof only applies
 * to the product if the two callers actually ask for the same width — which is
 * what this file asserts, on the real source of both.
 *
 * THE DEFECT. `NewsService.buildHomeNewsCacheKey` keys the shared corpus as
 * `${limit}:${lang}`. Home retrieved at 24 and Map open asked for 50, so the
 * keys were `24:en` and `50:en` — two entries for one corpus, and a guaranteed
 * provider execution on Map open no matter how warm Home was.
 *
 * CTO ruling: the cache contract and C7 are preserved; the CALLER moves. So the
 * assertion that matters is an EQUALITY between two files, not a literal in
 * one: if either side drifts, the cache silently fragments again and nothing
 * else in the suite would notice.
 */

const mapClient = readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8');
const homeFeed = readFileSync(
  join(__dirname, '..', '..', 'lib', 'homeFeed.ts'),
  'utf-8',
);

/** The width Map open requests from /news/top-headlines. */
function mapOpenWidth(): number {
  const match = mapClient.match(/^const GLOBAL_FEED_LIMIT = (\d+);/m);

  if (match === null) throw new Error('GLOBAL_FEED_LIMIT not found in MapPageClient.tsx');

  return Number(match[1]);
}

/** The width Home requests from the same endpoint. */
function homeWidth(): number {
  const match = homeFeed.match(/fetchTopHeadlines\((\d+),\s*language\)/);

  if (match === null) throw new Error('fetchTopHeadlines(width, language) not found in homeFeed.ts');

  return Number(match[1]);
}

function enrichCap(): number {
  const match = mapClient.match(/^const GLOBAL_FEED_ENRICH_CAP = (\d+);/m);

  if (match === null) throw new Error('GLOBAL_FEED_ENRICH_CAP not found');

  return Number(match[1]);
}

describe('B-2A — the Map and Home share one corpus identity', () => {
  it('Map open requests EXACTLY the width Home warms', () => {
    /*
      The load-bearing assertion in this file. It is an equality between two
      independently-maintained call sites, so it fails if EITHER moves — which
      is the only way to keep `${limit}:${lang}` from fragmenting again.
    */
    expect(mapOpenWidth()).toBe(homeWidth());
  });

  it('that shared width is the governed public corpus width, 24', () => {
    expect(homeWidth()).toBe(24);
    expect(mapOpenWidth()).toBe(24);
  });

  it('Map open no longer asks for 50 — the width that guaranteed a cache miss', () => {
    expect(mapOpenWidth()).not.toBe(50);
  });

  it('the map does not retrieve more than it enriches', () => {
    /*
      Enrichment is capped at GLOBAL_FEED_ENRICH_CAP. Retrieving beyond it was
      the part of the old width that had no demonstrated initial-map need:
      items 25-50 were never resolved to a geography and reached only the
      country-level evidence set.
    */
    expect(mapOpenWidth()).toBeLessThanOrEqual(enrichCap());
  });

  it('items beyond the governed width are not fetched anywhere in Map open', () => {
    /*
      CTO ruling: if the Map ever genuinely needs items 25-50, that must be an
      EXPLICIT later retrieval action and not a cost hidden inside opening the
      map. There is exactly one top-headlines call on this surface.

      R5 — AND IT IS NOW THE NON-EXECUTING ONE. The ruling's principle was
      about hidden cost, and R4 found the cost was hidden in the OPENING
      itself rather than in the width: every mount reached the executing route
      and paid on any cache miss. The map reads the same governed 24 through
      `/news/top-headlines/retained`, which cannot reach a provider.
    */
    expect(mapClient.split('fetchRetainedTopHeadlines(').length - 1).toBe(1);
    expect(mapClient).toContain('fetchRetainedTopHeadlines(GLOBAL_FEED_LIMIT, language)');

    /* The executing client is not reachable from this surface at all. */
    expect(mapClient.split('fetchTopHeadlines(').length - 1).toBe(0);
  });

  it('Home still issues exactly one top-headlines call', () => {
    expect(homeFeed.split('fetchTopHeadlines(').length - 1).toBe(1);
  });

  it('neither caller sends a q parameter, which would bypass the shared cache entirely', () => {
    /*
      `buildHomeNewsCacheKey` returns null when `q` is present — analysis
      retrieval is deliberately outside this cache. A `q` appearing on either
      of these two callers would silently restore one-retrieval-per-render
      while still looking, in review, like a cached path.
    */
    expect(mapClient).toContain('fetchRetainedTopHeadlines(GLOBAL_FEED_LIMIT, language)');
    expect(homeFeed).toMatch(/fetchTopHeadlines\(\d+,\s*language\)/);
  });
});
