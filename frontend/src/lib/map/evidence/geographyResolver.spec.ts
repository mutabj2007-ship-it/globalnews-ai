import {
  mapFeedRequestKey,
  type MapEvidenceGeography,
  type MapFeedRequest,
} from '@/lib/api/mapFeedApi';

import { createGeographyResolver } from './geographyResolver';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT B-1 — THE MIXED GLOBAL/COUNTRY DUPLICATE CASE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"share deterministic results between global/country enrichment
 * where inputs overlap"* and *"Instrument tests with request counts … not timing
 * alone."*
 *
 * The map enriches twice: the global feed resolves each headline with ITS OWN
 * country as context, and selecting a country then resolves that country's
 * headlines — largely the SAME articles. Every assertion below counts what the
 * resolver actually asks for, so "shared" is measured rather than claimed.
 */

const place = (iso3: string): MapEvidenceGeography =>
  ({
    precision: 'CITY',
    renderable: true,
    contested: false,
    candidates: [],
    place: { joinKeys: { iso3 } },
    reason: 'test',
  }) as unknown as MapEvidenceGeography;

const noMatch = (): MapEvidenceGeography =>
  ({
    precision: 'UNKNOWN',
    renderable: false,
    contested: false,
    candidates: [],
    reason: 'test',
  }) as unknown as MapEvidenceGeography;

const article = (text: string, iso3: string): MapFeedRequest => ({
  text,
  mode: 'article',
  contextCountryIso3: iso3,
});

/** A counting fetcher. `asked` is the flat list of everything it was ever sent. */
function countingFetcher(answer: (r: MapFeedRequest) => MapEvidenceGeography | null = (r) =>
  place(r.contextCountryIso3 ?? 'RWA'),
) {
  const batches: MapFeedRequest[][] = [];

  const fetchBatch = async (requests: readonly MapFeedRequest[]) => {
    batches.push([...requests]);

    return new Map(requests.map((r) => [mapFeedRequestKey(r), answer(r)]));
  };

  return {
    fetchBatch,
    batches,
    get callCount() {
      return batches.length;
    },
    get asked() {
      return batches.flat();
    },
  };
}

describe('B-1 — createGeographyResolver', () => {
  describe('THE MIXED GLOBAL / COUNTRY DUPLICATE CASE', () => {
    it('a headline resolved by the GLOBAL pass is NOT re-requested when its country is selected', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      /* Global pass: three Rwandan headlines, resolved with RWA as context. */
      const globalPass = [
        article('Kigali road closure confirmed', 'RWA'),
        article('Musanze District update', 'RWA'),
        article('Rubavu border post reopens', 'RWA'),
      ];
      await resolve(globalPass);

      expect(fetcher.callCount).toBe(1);
      expect(fetcher.asked).toHaveLength(3);

      /* The user selects Rwanda. The country feed returns the SAME articles. */
      await resolve(globalPass);

      expect(fetcher.callCount).toBe(1); // no second request at all
      expect(fetcher.asked).toHaveLength(3);
    });

    it('a PARTIAL overlap asks only for the genuinely new headlines', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      await resolve([article('Shared A', 'RWA'), article('Shared B', 'RWA')]);
      expect(fetcher.asked).toHaveLength(2);

      await resolve([
        article('Shared A', 'RWA'),
        article('Shared B', 'RWA'),
        article('New C', 'RWA'),
        article('New D', 'RWA'),
      ]);

      expect(fetcher.callCount).toBe(2);
      expect(fetcher.batches[1].map((r) => r.text)).toEqual(['New C', 'New D']);
    });

    it('the shared answer is IDENTICAL, not merely present', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      const request = article('Kigali road closure confirmed', 'RWA');

      const first = await resolve([request]);
      const second = await resolve([request]);

      expect(second.get(mapFeedRequestKey(request))).toBe(first.get(mapFeedRequestKey(request)));
    });

    it('the same text under a DIFFERENT country is asked again — it is a different question', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      await resolve([article('Aberdeen', 'GBR')]);
      await resolve([article('Aberdeen', 'USA')]);

      expect(fetcher.callCount).toBe(2);
      expect(fetcher.asked).toHaveLength(2);
    });
  });

  describe('DEDUPLICATION WITHIN ONE CALL', () => {
    it('a repeated request inside one call is asked for once', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      await resolve(Array.from({ length: 8 }, () => article('Same headline', 'RWA')));

      expect(fetcher.callCount).toBe(1);
      expect(fetcher.asked).toHaveLength(1);
    });

    it('every caller-supplied request still gets an answer key', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      const requests = [article('A', 'RWA'), article('A', 'RWA'), article('B', 'KEN')];
      const answers = await resolve(requests);

      for (const request of requests) {
        expect(answers.has(mapFeedRequestKey(request))).toBe(true);
      }
    });
  });

  describe('A FAILURE IS NEVER REMEMBERED', () => {
    it('a null answer is returned but not memoised, so the next pass retries it', async () => {
      let attempt = 0;
      const batches: MapFeedRequest[][] = [];

      const resolve = createGeographyResolver(async (requests) => {
        batches.push([...requests]);
        attempt += 1;

        return new Map(
          requests.map((r) => [mapFeedRequestKey(r), attempt === 1 ? null : place('RWA')]),
        );
      });

      const request = article('Kigali road closure confirmed', 'RWA');

      expect((await resolve([request])).get(mapFeedRequestKey(request))).toBeNull();

      /* The outage clears. The second pass MUST ask again. */
      const second = await resolve([request]);

      expect(batches).toHaveLength(2);
      expect(second.get(mapFeedRequestKey(request))?.renderable).toBe(true);
    });

    it('a genuine NO-MATCH is remembered — it is a real answer, not a failure', async () => {
      const fetcher = countingFetcher(() => noMatch());
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      const request = article('the turkey was served cold', 'RWA');

      await resolve([request]);
      const second = await resolve([request]);

      expect(fetcher.callCount).toBe(1);
      expect(second.get(mapFeedRequestKey(request))?.renderable).toBe(false);
    });
  });

  describe('NO REQUEST WHEN NOTHING IS NEW', () => {
    it('an empty request list issues no batch', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      const answers = await resolve([]);

      expect(fetcher.callCount).toBe(0);
      expect(answers.size).toBe(0);
    });

    it('a fully-memoised list issues no batch', async () => {
      const fetcher = countingFetcher();
      const resolve = createGeographyResolver(fetcher.fetchBatch);

      const requests = [article('A', 'RWA'), article('B', 'RWA')];

      await resolve(requests);
      await resolve(requests);
      await resolve(requests);

      expect(fetcher.callCount).toBe(1);
    });
  });
});
