import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import type { NewsProvider } from './interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { collapseCrossProviderDuplicates } from './cross-provider-dedup.util';

/**
 * ── R4 GDELT — TEST H, REWRITTEN AFTER A CTO REVIEW ────────────────────
 *
 * WHAT THE PREVIOUS VERSION OF THIS TEST DID WRONG, RECORDED SO IT IS NOT
 * REPEATED. It claimed "when both DO contribute, the URL rung collapses
 * them to one" while building the service with `buildService([primary], [])`
 * — a single provider. Both articles therefore arrived from ONE provider
 * and were collapsed by the PER-PROVIDER pass. The cross-provider seam was
 * never entered: `collapseCrossProviderDuplicates` only runs when
 * `results.length > 1`. The test passed and proved nothing about the thing
 * it was named after.
 *
 * WHAT WRITING IT PROPERLY FOUND. Once two real provider identities were
 * genuinely put through the seam, the pair did NOT collapse. The seam's
 * only similarity decision was `areLikelyDuplicateArticles`, which compares
 * TITLES — and two providers rendering one story rarely spell its headline
 * identically. Two records at one address survived as two. That was a
 * production defect, not a test defect, and it is fixed in
 * cross-provider-dedup.util.ts by applying exact identity before
 * similarity.
 *
 * HOW SIMULTANEOUS CONTRIBUTION IS REACHED HERE, HONESTLY. Under the
 * approved tiering, GNews and GDELT DOC can never both contribute ARTICLES
 * to one live response: the fallback is consulted only when the primaries
 * produced zero. That is a deliberate property, and this file does not
 * weaken it to make a test possible. Instead:
 *
 *   - the SERVICE-level tests register TWO PRIMARY providers, which the
 *     registry has always permitted (`realCandidates` is a list, and E1's
 *     accumulating rule was built for exactly this), so two identities
 *     genuinely flow through buildResponse into the cross-provider seam;
 *   - the SEAM-level tests call `collapseCrossProviderDuplicates` directly
 *     with gnews/gdelt-doc records, which is the lowest level at which the
 *     question "do two providers' copies of one story collapse" exists.
 *
 * Both matter. The seam must be correct because a deployment can register
 * two primaries today, and because tier configuration is a config decision
 * that may change without this code being revisited.
 */

const SHARED_URL = 'https://outlet.example/one-story-two-providers';

function gnewsArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'gnews-1',
    title: 'Central bank holds rates as inflation cools',
    summary: 'Summary',
    // Real-world shape: GNews delivers the story with campaign tags.
    url: `${SHARED_URL}?utm_source=gnews&utm_medium=rss`,
    imageUrl: 'https://cdn.outlet.example/story.jpg',
    sourceId: 'outlet',
    sourceName: 'Outlet',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-08-26T09:00:00.000Z',
    publishedAtBasis: 'publisher',
    providerId: 'gnews',
    sourceLanguage: 'en',
    ...overrides,
  } as NewsArticle;
}

function gdeltArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'gdelt-doc-1',
    /*
     * DELIBERATELY A DIFFERENT HEADLINE RENDERING. GDELT reports the page's
     * own <title>; GNews reports its normalized headline. Token overlap
     * here is below the 0.72 similarity threshold, so ONLY the exact-URL
     * identity can collapse this pair — which is precisely the property
     * under test. A fixture that shared a headline would have passed
     * against the old, broken seam.
     */
    title: 'Rates unchanged — full statement and market reaction',
    summary: '',
    /*
     * ONLY REMOVABLE TRACKING DIFFERENCES. Both providers hand back the
     * same address wearing different campaign tags. A content-bearing
     * parameter must NOT appear here — `cmp` is content-bearing, so putting
     * one in would make these two genuinely different articles and the test
     * would be asserting the opposite of what it claims. That case gets its
     * own test at the end of this block.
     */
    url: `${SHARED_URL}?utm_campaign=gdelt&fbclid=abc123`,
    imageUrl: 'https://cdn.outlet.example/social.jpg',
    sourceId: 'outlet-example',
    sourceName: 'outlet.example',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-08-26T09:55:00.000Z',
    publishedAtBasis: 'observed',
    providerId: 'gdelt-doc',
    sourceLanguage: 'en',
    ...overrides,
  } as NewsArticle;
}

function stubProvider(id: string, articles: NewsArticle[]): NewsProvider & { calls: number } {
  const provider = {
    id,
    displayName: id,
    isMock: false,
    calls: 0,
    async search(): Promise<NewsArticle[]> {
      provider.calls += 1;
      return articles;
    },
    async topHeadlines(): Promise<NewsArticle[]> {
      provider.calls += 1;
      return articles;
    },
    async category(): Promise<NewsArticle[]> {
      provider.calls += 1;
      return articles;
    },
    async health() {
      return {
        providerId: id,
        displayName: id,
        status: 'ok' as const,
        checkedAt: '2026-08-26T09:00:00.000Z',
      };
    },
  };

  return provider as NewsProvider & { calls: number };
}

async function buildService(providers: NewsProvider[]): Promise<NewsService> {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: providers },
      { provide: ALL_NEWS_PROVIDERS, useValue: providers },
      // Both providers are PRIMARY here, which is what makes them
      // contribute at the same time.
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();

  return moduleRef.get(NewsService);
}

describe('H — the cross-provider seam, exercised directly', () => {
  const PROVIDER_ORDER = ['gnews', 'gdelt-doc'];

  it('collapses one GNews and one GDELT record that share a normalized URL', () => {
    const collapsed = collapseCrossProviderDuplicates(
      [gnewsArticle(), gdeltArticle()],
      PROVIDER_ORDER,
    );

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].id).toBe('gnews-1');
  });

  it('the fixture really does defeat the title heuristic, so the URL is doing the work', () => {
    /*
     * Guards the guard. If someone later edits these titles to be similar,
     * this test fails and tells them the regression above stopped proving
     * what it claims.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { areLikelyDuplicateArticles } = jest.requireActual<
      typeof import('./country/deduplicate-articles.util')
    >('./country/deduplicate-articles.util');

    expect(areLikelyDuplicateArticles(gnewsArticle(), gdeltArticle())).toBe(false);
  });

  it('the winner is deterministic and independent of input order', () => {
    const forward = collapseCrossProviderDuplicates(
      [gnewsArticle(), gdeltArticle()],
      PROVIDER_ORDER,
    );
    const reversed = collapseCrossProviderDuplicates(
      [gdeltArticle(), gnewsArticle()],
      PROVIDER_ORDER,
    );

    expect(forward[0].id).toBe('gnews-1');
    expect(reversed[0].id).toBe('gnews-1');
  });

  it('REGISTRATION ORDER decides the winner when the content signal ties', () => {
    // Same sourcesCount on both, so rule 1 cannot separate them and rule 2
    // — the deployment's declared preference order — must.
    const gdeltFirst = collapseCrossProviderDuplicates(
      [gnewsArticle(), gdeltArticle()],
      ['gdelt-doc', 'gnews'],
    );

    expect(gdeltFirst[0].id).toBe('gdelt-doc-1');
  });

  it('a higher sourcesCount OUTRANKS registration order, as the accepted rule states', () => {
    const collapsed = collapseCrossProviderDuplicates(
      [gnewsArticle({ sourcesCount: 1 }), gdeltArticle({ sourcesCount: 9 })],
      PROVIDER_ORDER,
    );

    expect(collapsed[0].id).toBe('gdelt-doc-1');
  });

  it('PROVENANCE SURVIVES WHOLE — the winner is not merged with the loser', () => {
    const collapsed = collapseCrossProviderDuplicates(
      [gnewsArticle(), gdeltArticle()],
      PROVIDER_ORDER,
    );

    const survivor = collapsed[0];

    expect(survivor.providerId).toBe('gnews');
    expect(survivor.sourceName).toBe('Outlet');
    expect(survivor.publishedAtBasis).toBe('publisher');
    // Nothing from the dropped record leaks into the survivor.
    expect(survivor.url).not.toContain('gdelt');
    expect(survivor.imageUrl).toBe('https://cdn.outlet.example/story.jpg');
  });

  it('two GENUINELY different stories from two providers both survive', () => {
    const collapsed = collapseCrossProviderDuplicates(
      [
        gnewsArticle(),
        gdeltArticle({
          id: 'gdelt-doc-2',
          url: 'https://outlet.example/an-entirely-different-story',
          title: 'Port strike enters second week',
        }),
      ],
      PROVIDER_ORDER,
    );

    expect(collapsed.map((a) => a.id).sort()).toEqual(['gdelt-doc-2', 'gnews-1']);
  });

  it('the content-bearing parameters still keep two providers apart', () => {
    /*
     * The E lane's whole point, re-proved at the cross-provider seam: `cmp`
     * is content-bearing, so two records differing only by it are two
     * different articles even when both providers carry them.
     */
    const collapsed = collapseCrossProviderDuplicates(
      [
        gnewsArticle({
          url: 'https://outlet.example/story?cmp=A',
          // Deliberately unrelated headlines. "Model A reviewed" vs "Model B
          // reviewed" would score 1.0 on the title heuristic and collapse for
          // a reason that has nothing to do with the parameter under test.
          title: 'Quarterly figures published by the finance ministry',
        }),
        gdeltArticle({
          url: 'https://outlet.example/story?cmp=B',
          title: 'Port strike enters its second week',
        }),
      ],
      PROVIDER_ORDER,
    );

    expect(collapsed).toHaveLength(2);
  });
});

describe('H — the cross-provider seam, reached through NewsService', () => {
  it('two providers contributing simultaneously yield exactly one story', async () => {
    const gnews = stubProvider('gnews', [gnewsArticle()]);
    const gdelt = stubProvider('gdelt-doc', [gdeltArticle()]);

    const service = await buildService([gnews, gdelt]);

    const response = await service.search('rates');

    // Both genuinely participated — this is what the previous test failed
    // to establish.
    expect(gnews.calls).toBe(1);
    expect(gdelt.calls).toBe(1);
    expect(response.providers.sort()).toEqual(['gdelt-doc', 'gnews']);

    expect(response.articles).toHaveLength(1);
    expect(response.articles[0].id).toBe('gnews-1');
    expect(response.articles[0].providerId).toBe('gnews');
  });

  it('the surviving record keeps its own provenance end to end', async () => {
    const service = await buildService([
      stubProvider('gnews', [gnewsArticle()]),
      stubProvider('gdelt-doc', [gdeltArticle()]),
    ]);

    const [survivor] = (await service.search('rates')).articles;

    expect(survivor.sourceName).toBe('Outlet');
    expect(survivor.publishedAtBasis).toBe('publisher');
    expect(survivor.sourceLanguage).toBe('en');
  });

  it('with only ONE provider contributing, the cross-provider pass is not entered at all', async () => {
    /*
     * The pre-R4 guarantee, restated: a single-provider response is
     * byte-for-byte what it was before any of this existed.
     */
    const service = await buildService([
      stubProvider('gnews', [
        gnewsArticle(),
        gnewsArticle({
          id: 'gnews-2',
          url: 'https://outlet.example/second-story',
          title: 'Port strike enters second week',
        }),
      ]),
    ]);

    const response = await service.search('rates');

    expect(response.articles.map((a) => a.id)).toEqual(['gnews-1', 'gnews-2']);
  });

  it('DISCLOSURE — under the approved tiering GNews and GDELT never co-contribute live', async () => {
    /*
     * Stated as an executable fact rather than a comment, because it is the
     * reason the tests above register two PRIMARIES instead of using the
     * real production tier configuration. If tiering ever changed so that
     * the fallback ran alongside a productive primary, this test would fail
     * and the disclosure in the CTO report would need rewriting.
     */
    const gnews = stubProvider('gnews', [gnewsArticle()]);
    const gdelt = stubProvider('gdelt-doc', [gdeltArticle()]);

    const persistence = {
      persistMany: jest.fn().mockResolvedValue(new Map()),
      findRecent: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: NEWS_PROVIDERS, useValue: [gnews, gdelt] },
        { provide: ALL_NEWS_PROVIDERS, useValue: [gnews, gdelt] },
        { provide: FALLBACK_NEWS_PROVIDERS, useValue: [gdelt] },
        { provide: ArticlePersistenceService, useValue: persistence },
      ],
    }).compile();

    const response = await moduleRef.get(NewsService).search('rates');

    expect(gdelt.calls).toBe(0);
    expect(response.providers).toEqual(['gnews']);
  });
});
