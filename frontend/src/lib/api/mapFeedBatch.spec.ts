import {
  MAP_FEED_BATCH_MAX_ITEMS,
  fetchMapFeedBatch,
  mapFeedBatchChunkSizes,
  mapFeedRequestKey,
  type MapFeedRequest,
} from './mapFeedApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT B-1 — THE FAN-OUT IS GONE, MEASURED IN REQUEST COUNTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Instrument tests with request counts/provider execution counts,
 * not timing alone"* and *"N articles → O(1) bounded batch request(s), never one
 * HTTP call per article."*
 *
 * Every assertion here counts `fetch` invocations. A timing assertion would
 * pass on a fast machine with the fan-out intact; a count cannot.
 *
 * THE BASELINE BEING REPLACED, for the record: enrichment issued one request
 * per article, capped at 24 (global feed) and 12 (per country). Measured in
 * Alpha, single user actions produced /geo/map-feed x3, x4, x7 and x8.
 */

/** A minimal payload that satisfies `readMapFeed` and resolves to a place. */
const resolvedPayload = (iso3: string) => ({
  precision: 'CITY',
  renderable: true,
  contested: false,
  candidates: [],
  place: { joinKeys: { iso3 } },
  reason: 'test',
});

/** A minimal payload that satisfies `readMapFeed` and names no place. */
const noMatchPayload = () => ({
  precision: 'UNKNOWN',
  renderable: false,
  contested: false,
  candidates: [],
  unresolvable: 'NO_PLACE_EVIDENCE',
  reason: 'test',
});

interface Call {
  readonly url: string;
  readonly method: string;
  readonly items: { q: string; mode?: string; country?: string }[];
}

let calls: Call[];

/** Records every request and answers with one result per item, index-aligned. */
function installFetch(
  respond: (item: { q: string; mode?: string; country?: string }) => unknown = (item) =>
    resolvedPayload(item.country ?? 'RWA'),
  init: { ok?: boolean; truncate?: number } = {},
): void {
  calls = [];

  global.fetch = jest.fn(async (url: unknown, options: unknown) => {
    const opts = options as { method?: string; body?: string };
    const body = JSON.parse(opts.body ?? '{}') as {
      items: { q: string; mode?: string; country?: string }[];
    };

    calls.push({
      url: String(url),
      method: opts.method ?? 'GET',
      items: body.items,
    });

    const results = body.items.map(respond);

    return {
      ok: init.ok ?? true,
      json: async () =>
        ({ results: init.truncate === undefined ? results : results.slice(0, init.truncate) }),
    };
  }) as unknown as typeof fetch;
}

const article = (text: string, iso3: string): MapFeedRequest => ({
  text,
  mode: 'article',
  contextCountryIso3: iso3,
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('B-1 — fetchMapFeedBatch', () => {
  describe('N ARTICLES → O(1) BOUNDED REQUESTS', () => {
    it('resolves 24 articles — the global cap — in ONE request, not 24', () => {
      installFetch();

      const requests = Array.from({ length: 24 }, (_, i) => article(`Headline ${i}`, 'RWA'));

      return fetchMapFeedBatch(requests).then((answers) => {
        expect(calls).toHaveLength(1);
        expect(calls[0].items).toHaveLength(24);
        expect(answers.size).toBe(24);
      });
    });

    it('resolves 12 articles — the per-country cap — in ONE request, not 12', async () => {
      installFetch();

      await fetchMapFeedBatch(Array.from({ length: 12 }, (_, i) => article(`H${i}`, 'KEN')));

      expect(calls).toHaveLength(1);
      expect(calls[0].items).toHaveLength(12);
    });

    it('the request count does NOT grow with the article count', async () => {
      const counts: number[] = [];

      for (const size of [1, 5, 12, 24, 36, MAP_FEED_BATCH_MAX_ITEMS]) {
        installFetch();
        await fetchMapFeedBatch(Array.from({ length: size }, (_, i) => article(`H${i}`, 'RWA')));
        counts.push(calls.length);
      }

      expect(counts).toEqual([1, 1, 1, 1, 1, 1]);
    });

    it('uses POST to the batch route — the scalar GET route is not touched here', async () => {
      installFetch();

      await fetchMapFeedBatch([article('Goma residents flee', 'COD')]);

      expect(calls[0].method).toBe('POST');
      expect(calls[0].url).toContain('/geo/map-feed/batch');
      expect(calls[0].url).not.toContain('?q=');
    });

    it('sends q / mode / country per item, matching the scalar contract', async () => {
      installFetch();

      await fetchMapFeedBatch([article('Goma residents flee', 'COD')]);

      expect(calls[0].items[0]).toEqual({
        q: 'Goma residents flee',
        mode: 'article',
        country: 'COD',
      });
    });

    it('omits mode and country when not supplied, so the backend default applies', async () => {
      installFetch();

      await fetchMapFeedBatch([{ text: 'what is happening in Musanze?' }]);

      expect(calls[0].items[0]).toEqual({ q: 'what is happening in Musanze?' });
    });
  });

  describe('DEDUPLICATION — AN IDENTICAL INPUT IS RESOLVED ONCE', () => {
    it('eight copies of one headline become ONE item on the wire', async () => {
      installFetch();

      const duplicated = Array.from({ length: 8 }, () => article('Same headline', 'RWA'));
      const answers = await fetchMapFeedBatch(duplicated);

      expect(calls).toHaveLength(1);
      expect(calls[0].items).toHaveLength(1);
      expect(answers.size).toBe(1);
    });

    it('identical text with DIFFERENT country context is NOT deduplicated', async () => {
      /*
        `country` changes the answer, so collapsing these would hand one
        country's resolution to the other.
      */
      installFetch();

      await fetchMapFeedBatch([article('Aberdeen', 'GBR'), article('Aberdeen', 'USA')]);

      expect(calls[0].items).toHaveLength(2);
    });

    it('identical text with a DIFFERENT mode is NOT deduplicated', async () => {
      installFetch();

      await fetchMapFeedBatch([
        { text: 'Goma residents flee', mode: 'article' },
        { text: 'Goma residents flee', mode: 'query' },
      ]);

      expect(calls[0].items).toHaveLength(2);
    });

    it('an explicit query mode and an omitted mode ARE the same request', async () => {
      /* The backend defaults mode to query, so these must share one key. */
      installFetch();

      await fetchMapFeedBatch([
        { text: 'what is happening in Musanze?', mode: 'query' },
        { text: 'what is happening in Musanze?' },
      ]);

      expect(calls[0].items).toHaveLength(1);
    });

    it('empty and whitespace-only text is never sent', async () => {
      installFetch();

      await fetchMapFeedBatch([{ text: '' }, { text: '   ' }, article('Real headline', 'RWA')]);

      expect(calls[0].items).toHaveLength(1);
      expect(calls[0].items[0].q).toBe('Real headline');
    });

    it('a request list that is entirely empty text issues NO request at all', async () => {
      installFetch();

      const answers = await fetchMapFeedBatch([{ text: '' }, { text: '  ' }]);

      expect(calls).toHaveLength(0);
      expect(answers.size).toBe(0);
    });
  });

  describe('DETERMINISTIC ASSOCIATION', () => {
    it('every answer is retrievable by its request key', async () => {
      installFetch((item) => resolvedPayload(item.country ?? 'RWA'));

      const requests = [article('A', 'RWA'), article('B', 'KEN'), article('C', 'POL')];
      const answers = await fetchMapFeedBatch(requests);

      for (const request of requests) {
        const answer = answers.get(mapFeedRequestKey(request));

        expect(answer).not.toBeUndefined();
        expect(answer?.place?.joinKeys.iso3).toBe(request.contextCountryIso3);
      }
    });

    it('two same-text different-country requests receive their OWN answers', async () => {
      installFetch((item) => resolvedPayload(item.country ?? 'RWA'));

      const gbr = article('Aberdeen', 'GBR');
      const usa = article('Aberdeen', 'USA');
      const answers = await fetchMapFeedBatch([gbr, usa]);

      expect(answers.get(mapFeedRequestKey(gbr))?.place?.joinKeys.iso3).toBe('GBR');
      expect(answers.get(mapFeedRequestKey(usa))?.place?.joinKeys.iso3).toBe('USA');
    });

    it('a no-match in the middle does not shift the answers around it', async () => {
      installFetch((item) =>
        item.q === 'nothing here' ? noMatchPayload() : resolvedPayload(item.country ?? 'RWA'),
      );

      const first = article('A', 'RWA');
      const middle = article('nothing here', 'RWA');
      const last = article('C', 'KEN');
      const answers = await fetchMapFeedBatch([first, middle, last]);

      expect(answers.get(mapFeedRequestKey(first))?.renderable).toBe(true);
      expect(answers.get(mapFeedRequestKey(middle))?.renderable).toBe(false);
      expect(answers.get(mapFeedRequestKey(last))?.place?.joinKeys.iso3).toBe('KEN');
    });
  });

  describe('NULL / NO-MATCH PRESERVATION', () => {
    it('a no-match is a PRESENT answer, not a missing key', async () => {
      installFetch(() => noMatchPayload());

      const request = article('the turkey was served cold', 'RWA');
      const answers = await fetchMapFeedBatch([request]);

      expect(answers.has(mapFeedRequestKey(request))).toBe(true);
      expect(answers.get(mapFeedRequestKey(request))?.renderable).toBe(false);
    });

    it('a country-context mismatch is refused, exactly as the scalar guard refuses it', async () => {
      /* The guard rejects a place whose iso3 contradicts the stated context. */
      installFetch(() => resolvedPayload('POL'));

      const request = article('Somewhere', 'RWA');
      const answers = await fetchMapFeedBatch([request]);

      expect(answers.get(mapFeedRequestKey(request))).toBeNull();
    });
  });

  describe('CHUNKING — BOUNDED, DETERMINISTIC, NEVER TRUNCATING', () => {
    it('splits deterministically at the declared bound', () => {
      expect(mapFeedBatchChunkSizes(0)).toEqual([]);
      expect(mapFeedBatchChunkSizes(1)).toEqual([1]);
      expect(mapFeedBatchChunkSizes(MAP_FEED_BATCH_MAX_ITEMS)).toEqual([MAP_FEED_BATCH_MAX_ITEMS]);
      expect(mapFeedBatchChunkSizes(MAP_FEED_BATCH_MAX_ITEMS + 1)).toEqual([
        MAP_FEED_BATCH_MAX_ITEMS,
        1,
      ]);
    });

    it('an over-bound union is CHUNKED, and every item still resolves', async () => {
      installFetch();

      const size = MAP_FEED_BATCH_MAX_ITEMS + 20;
      const requests = Array.from({ length: size }, (_, i) => article(`H${i}`, 'RWA'));
      const answers = await fetchMapFeedBatch(requests);

      expect(calls).toHaveLength(2);
      expect(calls[0].items).toHaveLength(MAP_FEED_BATCH_MAX_ITEMS);
      expect(calls[1].items).toHaveLength(20);
      expect(answers.size).toBe(size);
    });

    it('nothing is silently truncated — the union is fully answered', async () => {
      installFetch();

      const requests = Array.from({ length: 150 }, (_, i) => article(`H${i}`, 'RWA'));
      const answers = await fetchMapFeedBatch(requests);

      expect(answers.size).toBe(150);
      for (const request of requests) {
        expect(answers.has(mapFeedRequestKey(request))).toBe(true);
      }
    });
  });

  describe('FAILS SOFT, AND NEVER MISATTRIBUTES', () => {
    it('a non-ok response yields null for that chunk, not a thrown error', async () => {
      installFetch(undefined, { ok: false });

      const request = article('A', 'RWA');
      const answers = await fetchMapFeedBatch([request]);

      expect(answers.get(mapFeedRequestKey(request))).toBeNull();
    });

    it('a network failure yields nulls rather than rejecting', async () => {
      calls = [];
      global.fetch = jest.fn(async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch;

      const request = article('A', 'RWA');
      const answers = await fetchMapFeedBatch([request]);

      expect(answers.get(mapFeedRequestKey(request))).toBeNull();
    });

    it('a LENGTH MISMATCH is refused wholesale rather than misaligned', async () => {
      /*
        If the response is short, positions no longer mean what they meant.
        Attributing anyway would put one article's geography on another, which
        is worse than showing none.
      */
      installFetch(undefined, { truncate: 1 });

      const a = article('A', 'RWA');
      const b = article('B', 'KEN');
      const answers = await fetchMapFeedBatch([a, b]);

      expect(answers.get(mapFeedRequestKey(a))).toBeNull();
      expect(answers.get(mapFeedRequestKey(b))).toBeNull();
    });

    it('one failed chunk does not blank the other', async () => {
      let call = 0;
      calls = [];
      global.fetch = jest.fn(async (_url: unknown, options: unknown) => {
        const body = JSON.parse((options as { body: string }).body) as {
          items: { q: string; country?: string }[];
        };
        calls.push({ url: '', method: 'POST', items: body.items });
        call += 1;

        if (call === 1) return { ok: false, json: async () => ({}) };

        return {
          ok: true,
          json: async () => ({ results: body.items.map((i) => resolvedPayload(i.country ?? 'RWA')) }),
        };
      }) as unknown as typeof fetch;

      const requests = Array.from({ length: MAP_FEED_BATCH_MAX_ITEMS + 5 }, (_, i) =>
        article(`H${i}`, 'RWA'),
      );
      const answers = await fetchMapFeedBatch(requests);

      const values = [...answers.values()];

      expect(values.filter((v) => v === null)).toHaveLength(MAP_FEED_BATCH_MAX_ITEMS);
      expect(values.filter((v) => v !== null)).toHaveLength(5);
    });
  });

  describe('COST CLASS — GEO ONLY, NO PROVIDER ANYWHERE', () => {
    it('every request goes to /geo — no news, GNews, RSS, GDELT or OpenAI endpoint is touched', async () => {
      installFetch();

      await fetchMapFeedBatch(Array.from({ length: 30 }, (_, i) => article(`H${i}`, 'RWA')));

      expect(calls).toHaveLength(1);
      for (const call of calls) {
        expect(call.url).toContain('/geo/');
        expect(call.url).not.toMatch(/\/news/);
        expect(call.url).not.toMatch(/gnews/i);
        expect(call.url).not.toMatch(/rss/i);
        expect(call.url).not.toMatch(/gdelt/i);
        expect(call.url).not.toMatch(/analysis/i);
        expect(call.url).not.toMatch(/openai/i);
      }
    });
  });
});
