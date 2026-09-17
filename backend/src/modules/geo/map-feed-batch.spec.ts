import { GeoController, MAP_FEED_BATCH_MAX_ITEMS } from './geo.controller';
import { mapGeographyForArticle, mapGeographyForQuery } from './map-feed.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT B-1 — THE BATCH RESOLVER IS THE SCALAR RESOLVER, N TIMES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Add a bounded POST batch route whose per-item semantics are
 * exactly equivalent to the existing scalar resolver. Do not create a second
 * geography algorithm."*
 *
 * The defect being closed is a frontend fan-out of ONE HTTP REQUEST PER
 * ARTICLE — capped at 24 on map open and 12 per country selection, and measured
 * in Alpha as /geo/map-feed x3, x4, x7, x8 for single user actions. None of it
 * consumed provider quota; this resolver is synchronous and touches no
 * provider, database or network. The cost was N round-trips and N rate-limit
 * slots for one action.
 *
 * EQUIVALENCE IS ASSERTED AGAINST THE SCALAR ROUTE ITSELF, not against a
 * remembered expectation. Every case below computes both answers and compares
 * them, so the two can only agree — and if a future change alters the gate, it
 * alters both or this suite fails.
 */
describe('B-1 — POST /geo/map-feed/batch', () => {
  const controller = new GeoController();

  /*
    A deliberately mixed corpus: resolvable article prose, a query that
    resolves, a contested name, a country tiebreak, and text that names no
    place at all. The no-match cases matter as much as the hits — they are the
    ones an over-eager implementation would drop.
  */
  const CORPUS = [
    { q: 'Goma residents flee as fighting intensifies', mode: 'article' as const },
    { q: 'Musanze District officials confirm road closure', mode: 'article' as const },
    { q: 'what is happening in Musanze?', mode: 'query' as const },
    { q: 'Aberdeen', mode: 'article' as const, country: 'GBR' },
    { q: 'Aberdeen', mode: 'article' as const },
    { q: 'the turkey was served cold at the reception', mode: 'article' as const },
    { q: 'Chad missed the bus', mode: 'query' as const },
    { q: 'Rubavu border post reopens after two weeks', mode: 'article' as const },
  ];

  describe('SCALAR / BATCH EQUIVALENCE', () => {
    it('every item resolves exactly as the scalar route resolves it', () => {
      const batch = controller.mapFeedBatch({ items: [...CORPUS] });

      CORPUS.forEach((item, index) => {
        expect(batch.results[index]).toEqual(controller.mapFeed(item));
      });
    });

    it('and exactly as the underlying contract functions resolve it — no third path', () => {
      const batch = controller.mapFeedBatch({ items: [...CORPUS] });

      CORPUS.forEach((item, index) => {
        const direct =
          item.mode === 'article'
            ? mapGeographyForArticle(item.q, item.country)
            : mapGeographyForQuery(item.q, item.country);

        expect(batch.results[index]).toEqual(direct);
      });
    });

    it('defaults mode to query, exactly as the scalar route does', () => {
      const withoutMode = { q: 'what is happening in Musanze?' };

      expect(controller.mapFeedBatch({ items: [withoutMode] }).results[0]).toEqual(
        mapGeographyForQuery(withoutMode.q, undefined),
      );
    });

    it('honours the country tiebreak per item, independently', () => {
      const batch = controller.mapFeedBatch({
        items: [
          { q: 'Aberdeen', mode: 'article', country: 'GBR' },
          { q: 'Aberdeen', mode: 'article' },
        ],
      });

      expect(batch.results[0]).toEqual(
        controller.mapFeed({ q: 'Aberdeen', mode: 'article', country: 'GBR' }),
      );
      expect(batch.results[1]).toEqual(controller.mapFeed({ q: 'Aberdeen', mode: 'article' }));
    });

    it('the article and query gates stay distinct inside one batch', () => {
      /*
        Sending a user question through the article gate is as wrong as the
        reverse. A batch mixes both, so this is where a single shared gate would
        show up.
      */
      const batch = controller.mapFeedBatch({
        items: [
          { q: 'Goma residents flee as fighting intensifies', mode: 'article' },
          { q: 'Goma residents flee as fighting intensifies', mode: 'query' },
        ],
      });

      expect(batch.results[0]).toEqual(
        mapGeographyForArticle('Goma residents flee as fighting intensifies', undefined),
      );
      expect(batch.results[1]).toEqual(
        mapGeographyForQuery('Goma residents flee as fighting intensifies', undefined),
      );
    });
  });

  describe('DETERMINISTIC ASSOCIATION', () => {
    it('results are index-aligned with items, one for one', () => {
      const batch = controller.mapFeedBatch({ items: [...CORPUS] });

      expect(batch.results).toHaveLength(CORPUS.length);
    });

    it('reordering the items reorders the results correspondingly', () => {
      const forward = controller.mapFeedBatch({ items: [...CORPUS] }).results;
      const reversed = controller.mapFeedBatch({ items: [...CORPUS].reverse() }).results;

      expect(reversed).toEqual([...forward].reverse());
    });

    it('identical text with different country context stays distinguishable by POSITION', () => {
      /*
        This is why association is positional rather than keyed on the query
        text: two items can carry the same text and legitimately deserve
        different answers, and a text-keyed response could not tell them apart.
      */
      const batch = controller.mapFeedBatch({
        items: [
          { q: 'Aberdeen', mode: 'article', country: 'GBR' },
          { q: 'Aberdeen', mode: 'article', country: 'USA' },
        ],
      });

      expect(batch.results).toHaveLength(2);
      expect(batch.results[0]).toEqual(
        controller.mapFeed({ q: 'Aberdeen', mode: 'article', country: 'GBR' }),
      );
      expect(batch.results[1]).toEqual(
        controller.mapFeed({ q: 'Aberdeen', mode: 'article', country: 'USA' }),
      );
    });

    it('duplicate items are NOT collapsed server-side — alignment outranks deduplication here', () => {
      /*
        Deduplication is the caller's concern, because only the caller knows
        which of ITS items shared an input. Collapsing here would break index
        alignment, which is the more valuable guarantee.
      */
      const duplicated = [CORPUS[0], CORPUS[0], CORPUS[0]];
      const batch = controller.mapFeedBatch({ items: duplicated });

      expect(batch.results).toHaveLength(3);
      expect(batch.results[0]).toEqual(batch.results[1]);
      expect(batch.results[1]).toEqual(batch.results[2]);
    });
  });

  describe('NO-MATCH PRESERVATION', () => {
    it('text that names no place yields a RESULT, never an omission', () => {
      const nowhere = { q: 'the turkey was served cold at the reception', mode: 'article' as const };
      const batch = controller.mapFeedBatch({ items: [nowhere] });

      expect(batch.results).toHaveLength(1);
      expect(batch.results[0]).toEqual(controller.mapFeed(nowhere));
      expect(batch.results[0].renderable).toBe(false);
    });

    it('a batch of ONLY no-matches still returns one result per item', () => {
      const items = [
        { q: 'the turkey was served cold at the reception', mode: 'article' as const },
        { q: 'Chad missed the bus', mode: 'query' as const },
      ];
      const batch = controller.mapFeedBatch({ items });

      expect(batch.results).toHaveLength(2);
      for (const result of batch.results) expect(result.renderable).toBe(false);
    });

    it('a no-match between two hits does not shift the hits', () => {
      /*
        The failure this guards is a filter() somewhere in the pipeline: the
        results would still "look right" but every record after the gap would be
        attributed to the wrong article.
      */
      const items = [
        CORPUS[0],
        { q: 'the turkey was served cold at the reception', mode: 'article' as const },
        CORPUS[1],
      ];
      const batch = controller.mapFeedBatch({ items });

      expect(batch.results).toHaveLength(3);
      expect(batch.results[0]).toEqual(controller.mapFeed(items[0]));
      expect(batch.results[1].renderable).toBe(false);
      expect(batch.results[2]).toEqual(controller.mapFeed(items[2]));
    });
  });

  describe('BOUNDS', () => {
    it('declares a bound, and it is large enough for the largest legitimate union', () => {
      /*
        The frontend ceilings are 24 (global feed) and 12 (per country), so the
        largest union one screen can ask for is 36 distinct inputs.
      */
      expect(MAP_FEED_BATCH_MAX_ITEMS).toBeGreaterThanOrEqual(36);
    });

    it('resolves a full-size batch without truncating it', () => {
      const items = Array.from({ length: MAP_FEED_BATCH_MAX_ITEMS }, (_, i) => ({
        q: `Musanze District update number ${i}`,
        mode: 'article' as const,
      }));

      expect(controller.mapFeedBatch({ items }).results).toHaveLength(MAP_FEED_BATCH_MAX_ITEMS);
    });
  });

  describe('THE SCALAR ROUTE IS UNTOUCHED', () => {
    it('GET /geo/map-feed still returns the projection', () => {
      const feed = controller.mapFeed({ q: 'what is happening in Musanze?' });

      expect(feed.place?.joinKeys.iso3).toBe('RWA');
      expect(feed.renderable).toBe(true);
    });

    it('GET /geo/map-feed still resolves article prose the query gate refuses', () => {
      expect(controller.mapFeed({ q: 'Goma residents flee as fighting intensifies' }).renderable)
        .toBe(false);
      expect(
        controller.mapFeed({
          q: 'Goma residents flee as fighting intensifies',
          mode: 'article',
        }).renderable,
      ).toBe(true);
    });
  });

  describe('COST CLASS — THIS ROUTE SPENDS NOTHING', () => {
    /*
      The ruling requires GNews / RSS / GDELT / OpenAI counts of zero. The
      strongest available proof is structural rather than a spy count: the geo
      module holds no provider dependency at all, and GeoController is
      constructed here with NO arguments, so there is nothing for a provider to
      have been injected into.
    */
    it('GeoController takes no constructor dependencies — no provider can be injected', () => {
      expect(GeoController.length).toBe(0);
    });

    it('resolution is synchronous — a Promise would mean I/O happened', () => {
      const result = controller.mapFeedBatch({ items: [...CORPUS] });

      expect(result).not.toBeInstanceOf(Promise);
      expect(result.results[0]).not.toBeInstanceOf(Promise);
    });

    it('the controller source imports no provider, news, prisma or openai module', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const source = require('fs').readFileSync(`${__dirname}/geo.controller.ts`, 'utf-8') as string;
      const imports = source
        .split('\n')
        .filter((line) => line.trimStart().startsWith('import'))
        .join('\n');

      expect(imports).not.toMatch(/gnews/i);
      expect(imports).not.toMatch(/\brss\b/i);
      expect(imports).not.toMatch(/gdelt/i);
      expect(imports).not.toMatch(/openai/i);
      expect(imports).not.toMatch(/news\.service/i);
      expect(imports).not.toMatch(/prisma/i);
    });

    it('a batch of N is still one synchronous pass — no per-item awaiting', () => {
      const items = Array.from({ length: 36 }, (_, i) => ({
        q: `Musanze District update number ${i}`,
        mode: 'article' as const,
      }));

      const before = Date.now();
      const result = controller.mapFeedBatch({ items });
      const elapsed = Date.now() - before;

      expect(result.results).toHaveLength(36);
      /*
        Not a performance assertion — a structural one. Anything that awaited
        per item, or opened a socket, could not complete 36 resolutions inside
        this window on any machine that runs this suite.
      */
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
