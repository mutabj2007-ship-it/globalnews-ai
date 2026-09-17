import {
  fetchMapFeedBatch,
  mapFeedRequestKey,
  type MapEvidenceGeography,
  type MapFeedRequest,
} from '@/lib/api/mapFeedApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT B-1 — ONE RESOLUTION PATH, SHARED BY EVERY ENRICHMENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE OVERLAP THIS CLOSES. The map enriches evidence twice over: once for the
 * global feed, where each headline is resolved with ITS OWN country as context,
 * and again per country when one is selected. A country's top headlines are
 * largely the same articles that put it in the global feed, so the SAME
 * `(text, mode, country)` arrived on the wire twice — two requests that were
 * identical by construction and could only ever return the same answer.
 *
 * ─── WHY THIS IS DEDUPLICATION AND NOT A CACHE ────────────────────────────
 *
 * The CTO ruling is explicit: *"Shared memoization is permitted as
 * deduplication, but must not be used as a substitute for eliminating the HTTP
 * fan-out."*
 *
 * The fan-out is eliminated in `fetchMapFeedBatch`, which sends N inputs in one
 * request. This memo removes a DIFFERENT redundancy — the same input arriving
 * from two independent code paths — and it could be deleted tomorrow without
 * the fan-out returning. The two are not alternatives.
 *
 * ─── A FAILURE IS NEVER REMEMBERED ────────────────────────────────────────
 *
 * `fetchMapFeedBatch` fails soft: a chunk it could not resolve yields `null`
 * for its keys. Writing that null into the memo would make a transient outage
 * PERMANENT for those articles, because nothing would ever ask again. Only real
 * resolutions are stored, so a later render retries exactly the ones that did
 * not land — and a no-match is a real resolution, so text that genuinely names
 * no place is not re-asked either.
 */

export type GeographyResolver = (
  requests: readonly MapFeedRequest[],
) => Promise<ReadonlyMap<string, MapEvidenceGeography | null>>;

export type GeographyBatchFetcher = (
  requests: readonly MapFeedRequest[],
) => Promise<ReadonlyMap<string, MapEvidenceGeography | null>>;

/**
 * Builds a resolver that answers from memory where it can and batches the rest.
 *
 * The fetcher is injected so the memo can be exercised against a counting stub
 * — the whole point of this module is a claim about HOW MANY requests happen,
 * and that is not assertable against a hard-wired import.
 */
export function createGeographyResolver(
  fetchBatch: GeographyBatchFetcher = fetchMapFeedBatch,
): GeographyResolver {
  const memo = new Map<string, MapEvidenceGeography>();

  return async (requests) => {
    const answers = new Map<string, MapEvidenceGeography | null>();
    const misses: MapFeedRequest[] = [];
    const missKeys = new Set<string>();

    for (const request of requests) {
      const key = mapFeedRequestKey(request);
      const remembered = memo.get(key);

      if (remembered !== undefined) {
        answers.set(key, remembered);
        continue;
      }

      /*
        Deduplicate WITHIN this call too. `fetchMapFeedBatch` would collapse
        these anyway, but doing it here keeps `misses` honest — it is the list
        this resolver is about to ask for, and a caller counting it should see
        the real number.
      */
      if (!missKeys.has(key)) {
        missKeys.add(key);
        misses.push(request);
      }
    }

    if (misses.length > 0) {
      const fresh = await fetchBatch(misses);

      for (const [key, value] of fresh) {
        answers.set(key, value);
        if (value !== null) memo.set(key, value);
      }
    }

    return answers;
  };
}

/**
 * ── CHECKPOINT C · THE RESOLVER OUTLIVES THE COMPONENT ────────────────────
 *
 * The map is a route. Opening Analysis unmounts it and Back remounts it, so a
 * resolver held in a `useRef` lost its memo exactly when returning to the map
 * needed it most — every headline had to be resolved again to rebuild a view
 * the reader already had.
 *
 * Module scope gives the memo the lifetime of the tab rather than the lifetime
 * of one mount. Nothing else about it changes: it still deduplicates, it still
 * batches the misses through `fetchMapFeedBatch`, and it still refuses to
 * remember a failure.
 *
 * `createGeographyResolver` remains exported and unchanged, because a test that
 * shared this instance would leak resolutions between cases and make a
 * "resolved without a request" assertion pass for the wrong reason.
 */
export const sharedGeographyResolver: GeographyResolver = createGeographyResolver();
