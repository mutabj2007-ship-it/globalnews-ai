import type { NewsArticle } from '@globalnews-ai/shared';
import { NewsService } from './news.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REV B FINDING 4 — THE TWO ANALYSIS-CONSUMED PATHS THAT BYPASSED THE PRODUCER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Rev A restored `deriveGeographicPrecision` and wired it at
 * `resolveArticleCountries`, which every RETRIEVAL path runs through. Analysis
 * reaches persisted articles by two routes that are not retrieval:
 *
 *   findArticleById         — the story ANCHOR, i.e. the article the reader
 *                             actually clicked. The single most important one
 *                             on the page, and the one that arrived with
 *                             `geographicPrecision` undefined.
 *   findRetainedByCountry   — previously-retrieved reporting for a declared
 *                             region's members (C907 §8).
 *
 * Both were thin delegates straight to persistence, so both handed Analysis
 * articles the producer had never seen, and `evidenceDisplayCeiling` reported
 * UNRESOLVED for them. These tests assert the derivation now applies on both,
 * on exactly the same missing-only terms as everywhere else.
 *
 * WHAT IS AND IS NOT BEING CREDITED. The derivation reads the article's OWN
 * stored `countryCode` — written from that article's own title and summary when
 * it was persisted. It is article-level evidence, which the ruling permits.
 * `retrievalContext.countryCode` is never read: the producer has no parameter
 * for it, so there is no call this suite could make that would borrow it.
 */

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

function buildNewsService(persistence: {
  findById?: jest.Mock;
  findRecentByCountry?: jest.Mock;
}) {
  const provider = {
    id: 'mock-wire',
    displayName: 'Mock',
    isMock: true,
    search: jest.fn(),
    getTopHeadlines: jest.fn(),
  };

  return new NewsService([provider] as never, [provider] as never, persistence as never);
}

describe('REV B FINDING 4 — findArticleById derives precision it used to skip', () => {
  it('an anchor-only article with a stored article-level country reports COUNTRY', async () => {
    const service = buildNewsService({
      findById: jest.fn().mockResolvedValue(
        makeArticle({
          id: 'anchor-1',
          title: 'Protests continue in Tehran',
          countryCode: 'IR',
          countryName: 'Iran',
        }),
      ),
    });

    const anchor = await service.findArticleById('anchor-1');

    expect(anchor).not.toBeNull();
    expect(anchor?.geographicPrecision).toBe('country');
  });

  it('an anchor with NO stored country reports UNKNOWN, never a borrowed one', async () => {
    const service = buildNewsService({
      findById: jest.fn().mockResolvedValue(makeArticle({ id: 'anchor-2' })),
    });

    const anchor = await service.findArticleById('anchor-2');

    expect(anchor?.geographicPrecision).toBe('unknown');
  });

  it('a stored article that already carries a precision keeps it untouched', async () => {
    /*
      MISSING-ONLY, EVERYWHERE. A provider that genuinely knows better than
      `countryCode` is authoritative; this derivation fills an absence and never
      arbitrates against a producer with more information.
    */
    const service = buildNewsService({
      findById: jest.fn().mockResolvedValue(
        makeArticle({
          id: 'anchor-3',
          countryCode: 'IR',
          geographicPrecision: 'city',
        }),
      ),
    });

    const anchor = await service.findArticleById('anchor-3');

    expect(anchor?.geographicPrecision).toBe('city');
  });

  it('an unresolved id still returns null rather than a fabricated article', async () => {
    const service = buildNewsService({
      findById: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findArticleById('missing')).resolves.toBeNull();
  });
});

describe('REV B FINDING 4 — findRetainedByCountry derives precision it used to skip', () => {
  it('a retained-country article reports COUNTRY', async () => {
    const service = buildNewsService({
      findRecentByCountry: jest
        .fn()
        .mockResolvedValue([
          makeArticle({ id: 'retained-1', countryCode: 'RW', countryName: 'Rwanda' }),
        ]),
    });

    const retained = await service.findRetainedByCountry('RW', 5, 240);

    expect(retained).toHaveLength(1);
    expect(retained[0].geographicPrecision).toBe('country');
  });

  it('a retained article WITHOUT a stored country stays UNKNOWN even though the QUERY named a country', async () => {
    /*
      THE BORROWING TEST. `findRetainedByCountry('RW', ...)` is asked about
      Rwanda, and the article below establishes nothing itself. If the query's
      country were ever credited to an article, this is where it would happen
      and the expectation would be 'country'. It is not, and the producer has no
      parameter through which it could become so.
    */
    const service = buildNewsService({
      findRecentByCountry: jest.fn().mockResolvedValue([makeArticle({ id: 'retained-2' })]),
    });

    const retained = await service.findRetainedByCountry('RW', 5, 240);

    expect(retained[0].geographicPrecision).toBe('unknown');
  });

  it('a retained article that already carries a precision keeps it', async () => {
    const service = buildNewsService({
      findRecentByCountry: jest.fn().mockResolvedValue([
        makeArticle({ id: 'retained-3', countryCode: 'RW', geographicPrecision: 'city' }),
      ]),
    });

    const retained = await service.findRetainedByCountry('RW', 5, 240);

    expect(retained[0].geographicPrecision).toBe('city');
  });

  it('an empty retained set stays empty — the derivation adds nothing of its own', async () => {
    const service = buildNewsService({
      findRecentByCountry: jest.fn().mockResolvedValue([]),
    });

    await expect(service.findRetainedByCountry('RW', 5, 240)).resolves.toEqual([]);
  });
});
