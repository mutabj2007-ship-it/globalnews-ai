import { readFileSync } from 'fs';
import { join } from 'path';
import { isNewSince, type NewsArticle } from '@globalnews-ai/shared';
import type { PrismaService } from '../../database/prisma.service';
import type { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { FEED_STORIES_PER_COUNTRY, FEED_WINDOW_MINUTES, MyIntelligenceFeedService } from './my-intelligence-feed.service';

/**
 * MY INTELLIGENCE R1 — Following / For You / New Since, from retained data.
 */

const story = (id: string, overrides: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id,
    title: `Story ${id}`,
    summary: 's',
    url: `https://wire.example/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-27T08:00:00.000Z',
    ...overrides,
  }) as NewsArticle;

function harness(options: {
  boundary: string | null;
  follows: string[];
  byCountry: Record<string, NewsArticle[]>;
}) {
  const persistence = {
    findRecentByCountry: jest.fn(async ({ countryCode }: { countryCode: string }) => options.byCountry[countryCode] ?? []),
  } as unknown as ArticlePersistenceService;
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({ visitBoundaryAt: options.boundary ? new Date(options.boundary) : null })),
    },
    countryFollow: {
      findMany: jest.fn(async () => options.follows.map((countryCode) => ({ countryCode }))),
    },
  } as unknown as PrismaService;
  return { service: new MyIntelligenceFeedService(prisma, persistence), persistence };
}

const BOUNDARY = '2026-09-27T06:00:00.000Z';

describe('New Since — one rule only: firstSeenAt > previousSeenAt', () => {
  it('the shared rule', () => {
    expect(isNewSince('2026-09-27T07:00:00.000Z', BOUNDARY)).toBe(true);
    expect(isNewSince('2026-09-27T06:00:00.000Z', BOUNDARY)).toBe(false);
    expect(isNewSince('2026-09-27T05:00:00.000Z', BOUNDARY)).toBe(false);
    expect(isNewSince(undefined, BOUNDARY)).toBe(false);
    expect(isNewSince('2026-09-27T07:00:00.000Z', null)).toBe(false);
    expect(isNewSince('not-a-date', BOUNDARY)).toBe(false);
  });

  it('publishedAt NEVER decides it — in either direction', async () => {
    const { service } = harness({
      boundary: BOUNDARY,
      follows: ['POL'],
      byCountry: {
        POL: [
          /* Published after the boundary, but first seen before it → NOT new. */
          story('late-published', { publishedAt: '2026-09-27T09:00:00.000Z', firstSeenAt: '2026-09-27T05:00:00.000Z' }),
          /* Published long before, but first seen after the boundary → new. */
          story('late-seen', { publishedAt: '2026-09-20T09:00:00.000Z', firstSeenAt: '2026-09-27T07:00:00.000Z' }),
        ],
      },
    });
    const feed = await service.feed('user-1');
    const byId = Object.fromEntries(feed.stories.map((entry) => [entry.id, entry.newSince]));
    expect(byId).toEqual({ 'late-published': false, 'late-seen': true });
    expect(feed.newSinceCount).toBe(1);
  });

  it('a story without firstSeenAt appears, but is never New Since and never counted; nothing is fabricated', async () => {
    const { service } = harness({
      boundary: BOUNDARY,
      follows: ['POL'],
      byCountry: { POL: [story('no-first-seen', { publishedAt: '2026-09-27T09:00:00.000Z' })] },
    });
    const feed = await service.feed('user-1');
    expect(feed.stories).toHaveLength(1);
    expect(feed.stories[0].newSince).toBe(false);
    expect(feed.stories[0]).not.toHaveProperty('firstSeenAt');
    expect(feed.newSinceCount).toBe(0);
    expect(feed.followedCountries[0].newSinceCount).toBe(0);
  });

  it('no known previous visit → previousSeenAt null and nothing is new (never "everything is new")', async () => {
    const { service } = harness({
      boundary: null,
      follows: ['POL'],
      byCountry: { POL: [story('a', { firstSeenAt: '2026-09-27T07:00:00.000Z' })] },
    });
    const feed = await service.feed('user-1');
    expect(feed.previousSeenAt).toBeNull();
    expect(feed.newSinceCount).toBe(0);
  });
});

describe('Following / For You counts', () => {
  it('per-country counts, deduplicated stories across countries, and a distinct New Since total', async () => {
    const shared = story('shared', { firstSeenAt: '2026-09-27T07:00:00.000Z' });
    const { service } = harness({
      boundary: BOUNDARY,
      follows: ['POL', 'DEU'],
      byCountry: {
        POL: [shared, story('pl-only', { firstSeenAt: '2026-09-27T05:00:00.000Z' })],
        DEU: [shared],
      },
    });
    const feed = await service.feed('user-1');

    expect(feed.followedCountries).toEqual([
      { countryCode: 'POL', storyCount: 2, newSinceCount: 1 },
      { countryCode: 'DEU', storyCount: 1, newSinceCount: 1 },
    ]);
    expect(feed.stories.map((entry) => entry.id).sort()).toEqual(['pl-only', 'shared']);
    expect(feed.stories.find((entry) => entry.id === 'shared')?.countryCodes).toEqual(['POL', 'DEU']);
    /* The shared story is new in two countries but is ONE new story. */
    expect(feed.newSinceCount).toBe(1);
    expect(feed.stories[0].articleRef).toBe(computeArticleRef(feed.stories[0].url));
  });

  it('no follows → an empty feed with no reads at all', async () => {
    const { service, persistence } = harness({ boundary: BOUNDARY, follows: [], byCountry: {} });
    const feed = await service.feed('user-1');
    expect(feed).toMatchObject({ followedCountries: [], stories: [], newSinceCount: 0, source: 'retained' });
    expect(persistence.findRecentByCountry).not.toHaveBeenCalled();
  });
});

describe('retained data only — opening My Intelligence costs no provider call and no AI', () => {
  it('reads each followed country from the retained ArticleCountry corpus with bounded windows', async () => {
    const { service, persistence } = harness({ boundary: BOUNDARY, follows: ['POL', 'KEN'], byCountry: {} });
    await service.feed('user-1');
    expect(persistence.findRecentByCountry).toHaveBeenCalledTimes(2);
    expect(persistence.findRecentByCountry).toHaveBeenCalledWith({
      countryCode: 'POL',
      limit: FEED_STORIES_PER_COUNTRY,
      maxAgeMinutes: FEED_WINDOW_MINUTES,
      relevantOnly: true,
    });
  });

  it('the module cannot reach any provider or the analysis pipeline', () => {
    const moduleSource = readFileSync(join(__dirname, 'my-intelligence.module.ts'), 'utf8');
    const imports = moduleSource.match(/^import .*$/gm) ?? [];
    for (const line of imports) {
      expect(line).not.toMatch(/news\.module|analysis|providers|ask-v2|watch|country-news/i);
    }
    for (const file of ['saved-stories.service.ts', 'my-intelligence-feed.service.ts']) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect(source).not.toMatch(/NewsService|CountryNewsService|AnalysisService|ANALYSIS_PROVIDER|NEWS_PROVIDERS|fetch\(/);
    }
  });

  it('ArticlePersistenceService — the only data dependency — has no provider dependency', () => {
    const source = readFileSync(join(__dirname, '../news/persistence/article-persistence.service.ts'), 'utf8');
    /* Home R1 Stage B adds ONE optional, DB-only observation port (retained-article-observer.port.ts);
       the constructor still takes PrismaService and nothing that can reach a provider. */
    expect(source).toMatch(
      /constructor\(\s*private readonly prisma: PrismaService,\s*\/\*[^*]*\*\/\s*@Optional\(\) @Inject\(RETAINED_ARTICLE_OBSERVER\) private readonly observer\?: RetainedArticleObserver,\s*\)/,
    );
    const imports = (source.match(/^import [\s\S]*?;$/gm) ?? []).join('\n');
    expect(imports).not.toMatch(/provider|news\.service|country-news|analysis/i);
  });
});
