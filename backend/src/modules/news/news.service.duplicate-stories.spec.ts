import { Test, type TestingModule } from '@nestjs/testing';
import type { NewsArticle, ProviderHealthStatus } from '@globalnews-ai/shared';
import { NewsService } from './news.service';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import type { NewsProvider } from './interfaces';

/**
 * R4 — the homepage semantic duplicate correction, at the seam where the
 * defect actually lived.
 *
 * WHAT THIS FILE ADDS THAT THE UNIT SPEC CANNOT. `article-identity.util.spec.ts`
 * proves the identity ladder in isolation. This file proves the ladder is
 * REACHED on the path a reader's homepage request takes — specifically with
 * a SINGLE provider, which is the shipped configuration and the exact case
 * the previous cross-provider pass skipped:
 *
 *     const deduplicated =
 *       results.length > 1 ? collapseCrossProviderDuplicates(...) : merged;
 *
 * Delete the new `collapseDuplicateStories(merged)` line from
 * `news.service.ts` and every assertion below fails, while the isolated
 * unit tests all still pass. That asymmetry is the point of the file.
 *
 * `news.service.spec.ts` and `news.service.multi-provider.spec.ts` remain
 * untouched: nothing they assert changes.
 */

const OBSERVED_HEADLINE = 'Solvit et Titus marks 60 years of Ultraman with limited-edition watches';
const DISTINCT_HEADLINE = 'Committee schedules vote on cross-border data proposal';

function makeArticle(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: OBSERVED_HEADLINE,
    summary: 'Summary',
    url: `https://watchesnews.example/${overrides.id}`,
    imageUrl: 'https://cdn.watchesnews.example/ultraman-60.jpg',
    sourceId: 'watchesnews',
    sourceName: 'Watches News',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-08-25T09:00:00.000Z',
    providerId: 'gnews',
    ...overrides,
  };
}

/** One real provider — the shipped configuration. */
class SingleRealProvider implements NewsProvider {
  readonly isMock = false;
  readonly id = 'gnews';

  constructor(private readonly articles: NewsArticle[]) {}

  get displayName(): string {
    return 'Fake GNews';
  }

  async search(): Promise<NewsArticle[]> {
    return this.articles;
  }

  async topHeadlines(): Promise<NewsArticle[]> {
    return this.articles;
  }

  async category(): Promise<NewsArticle[]> {
    return this.articles;
  }

  async health(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      displayName: this.displayName,
      status: 'ok',
      checkedAt: '2026-08-25T09:00:00.000Z',
    };
  }
}

async function buildService(articles: NewsArticle[]): Promise<NewsService> {
  const provider = new SingleRealProvider(articles);
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map<string, string>()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: [provider] },
      { provide: ALL_NEWS_PROVIDERS, useValue: [provider] },
      // R4 GDELT — no fallback-tier provider in this fixture, so the
      // tiered path collapses to the pre-R4 single-pass fan-out.
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();

  return module.get<NewsService>(NewsService);
}

describe('R4 — a single provider can no longer emit one story twice', () => {
  /**
   * THE OBSERVED DEFECT, as a test. Two ids, one address, one headline,
   * one image — which is precisely what two adjacent Global Developments
   * cards rendered.
   */
  it('topHeadlines emits the Ultraman story once', async () => {
    const service = await buildService([
      makeArticle({
        id: 'gnews-1837462',
        url: 'https://watchesnews.example/solvit-et-titus-ultraman-60',
      }),
      makeArticle({
        id: 'gnews-905513',
        url: 'https://watchesnews.example/solvit-et-titus-ultraman-60?utm_source=gnews&utm_medium=rss',
        publishedAt: '2026-08-25T09:12:00.000Z',
      }),
    ]);

    const response = await service.topHeadlines(12);

    expect(response.articles).toHaveLength(1);
    expect(response.totalResults).toBe(1);
    expect(response.articles[0].id).toBe('gnews-1837462');
    expect(response.articles[0].title).toBe(OBSERVED_HEADLINE);
  });

  it('search emits it once too — the correction is at the shared choke point', async () => {
    const service = await buildService([
      makeArticle({ id: 'gnews-1', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'gnews-2', url: 'https://watchesnews.example/u60#gallery' }),
    ]);

    const response = await service.search('ultraman');

    expect(response.articles).toHaveLength(1);
  });

  it('byCategory emits it once as well', async () => {
    const service = await buildService([
      makeArticle({ id: 'gnews-1', url: 'https://watchesnews.example/u60/' }),
      makeArticle({ id: 'gnews-2', url: 'https://watchesnews.example/u60' }),
    ]);

    const response = await service.byCategory('business');

    expect(response.articles).toHaveLength(1);
  });

  it('genuinely different stories from the one provider all survive', async () => {
    const service = await buildService([
      makeArticle({ id: 'gnews-1', url: 'https://watchesnews.example/a' }),
      makeArticle({
        id: 'gnews-2',
        url: 'https://watchesnews.example/b',
        title: DISTINCT_HEADLINE,
        imageUrl: 'https://cdn.watchesnews.example/committee.jpg',
      }),
    ]);

    const response = await service.topHeadlines(12);

    expect(response.articles).toHaveLength(2);
  });

  it('keeps two opposite updates of a developing story', async () => {
    const service = await buildService([
      makeArticle({
        id: 'gnews-1',
        title: 'Ukraine peace talks resume in Geneva',
        url: 'https://watchesnews.example/talks-resume',
      }),
      makeArticle({
        id: 'gnews-2',
        title: 'Ukraine peace talks collapse in Geneva',
        url: 'https://watchesnews.example/talks-collapse',
        publishedAt: '2026-08-25T11:00:00.000Z',
      }),
    ]);

    const response = await service.topHeadlines(12);

    // Both survive, in the provider's own order — topHeadlines does not
    // re-sort by recency on this path, so the assertion pins the ORDER
    // too rather than settling for the count.
    expect(response.articles.map((article) => article.title)).toEqual([
      'Ukraine peace talks resume in Geneva',
      'Ukraine peace talks collapse in Geneva',
    ]);
  });

  it('preserves provenance and the response contract on the retained record', async () => {
    const service = await buildService([
      makeArticle({
        id: 'gnews-1',
        url: 'https://watchesnews.example/u60',
        sourceName: 'Watches News',
        providerId: 'gnews',
      }),
      makeArticle({
        id: 'gnews-2',
        url: 'https://watchesnews.example/u60?fbclid=abc',
        sourceName: 'Somewhere Else',
        providerId: 'other',
      }),
    ]);

    const response = await service.topHeadlines(12);

    expect(response.articles[0].sourceName).toBe('Watches News');
    expect(response.articles[0].providerId).toBe('gnews');
    // The public response shape is unchanged by this correction.
    expect(response.providers).toEqual(['gnews']);
    expect(response.dataMode).toBe('live');
  });

  it('the limit is applied to the deduplicated set, so a page is not short-changed', async () => {
    const service = await buildService([
      makeArticle({ id: 'gnews-1', url: 'https://watchesnews.example/a', title: 'Alpha story' }),
      makeArticle({
        id: 'gnews-1-dup',
        url: 'https://watchesnews.example/a?utm_source=x',
        title: 'Alpha story',
      }),
      makeArticle({ id: 'gnews-2', url: 'https://watchesnews.example/b', title: 'Bravo story' }),
    ]);

    const response = await service.topHeadlines(2);

    expect(response.articles.map((article) => article.title)).toEqual([
      'Alpha story',
      'Bravo story',
    ]);
  });
});
