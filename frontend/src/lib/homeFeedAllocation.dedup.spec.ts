import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeArticleUrl, type NewsArticle } from '@globalnews-ai/shared';
import { allocateHomeFeed, allocateToday } from './homeFeedAllocation';

/**
 * R4 — the homepage allocator's defence-in-depth guard.
 *
 * THIS IS NOT THE CORRECTION. The correction is in NewsService, where
 * duplicate records are collapsed before they are ever served. This file
 * covers the second line only: a payload that somehow still carries two
 * records of one story must not be placed into two homepage positions in
 * front of a reader.
 *
 * WHY THE GUARD WAS NEEDED AT ALL. `allocateHomeFeed` tracked used
 * articles in a `Set<string>` keyed on `article.id`. Two records of one
 * story arrive with two ids — `GNewsProvider.buildStableId()` hashes the
 * RAW url — so the set saw two distinct articles and placed both: one as
 * `featured`, the next as the first `inFocus` card. Global Developments
 * renders `[lead, ...secondary, ...discovery]` in array order, which put
 * them side by side. That is the observed defect, reproduced below.
 *
 * `homeFeedAllocation.spec.ts` is left untouched; every assertion it
 * makes still holds.
 */

const OBSERVED_HEADLINE = 'Solvit et Titus marks 60 years of Ultraman with limited-edition watches';

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
    ...overrides,
  };
}

/** Exactly what GlobalDevelopments renders: lead, then in-focus, then discovery. */
function railItems(allocation: ReturnType<typeof allocateHomeFeed>): NewsArticle[] {
  return allocation.featured
    ? [allocation.featured, ...allocation.inFocus, ...allocation.discovery]
    : [];
}

describe('MANDATORY 11 — one semantic article cannot take two Global Developments positions', () => {
  it('reproduces and closes the observed adjacent-duplicate pair', () => {
    const articles = [
      makeArticle({
        id: 'gnews-1837462',
        url: 'https://watchesnews.example/solvit-et-titus-ultraman-60',
      }),
      makeArticle({
        id: 'gnews-905513',
        url: 'https://watchesnews.example/solvit-et-titus-ultraman-60?utm_source=gnews&utm_medium=rss',
      }),
      makeArticle({
        id: 'gnews-3',
        url: 'https://watchesnews.example/other',
        title: 'Committee schedules vote on cross-border data proposal',
      }),
    ];

    const rail = railItems(allocateHomeFeed(articles));

    expect(rail.filter((item) => item.title === OBSERVED_HEADLINE)).toHaveLength(1);
    expect(rail.map((item) => item.id)).toEqual(['gnews-1837462', 'gnews-3']);
  });

  it('collapses fragment, trailing-slash and host-case variants across all three roles', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60#gallery' }),
      makeArticle({ id: 'c', url: 'https://watchesnews.example/u60/' }),
      makeArticle({ id: 'd', url: 'https://WatchesNews.example/u60' }),
    ];

    const allocation = allocateHomeFeed(articles);

    expect(allocation.featured?.id).toBe('a');
    expect(allocation.inFocus).toHaveLength(0);
    expect(allocation.discovery).toHaveLength(0);
    expect(railItems(allocation)).toHaveLength(1);
  });

  it('still fills every role when the stories are genuinely distinct', () => {
    const articles = Array.from({ length: 12 }, (_, index) =>
      makeArticle({
        id: `a${index}`,
        url: `https://watchesnews.example/story-${index}`,
        title: `Distinct story ${index}`,
      }),
    );

    const allocation = allocateHomeFeed(articles);

    expect(allocation.featured?.id).toBe('a0');
    expect(allocation.inFocus).toHaveLength(5);
    expect(allocation.discovery).toHaveLength(6);
    expect(new Set(railItems(allocation).map((item) => item.id)).size).toBe(12);
  });

  it('falls back to the article id when a record has no usable url', () => {
    const articles = [
      makeArticle({ id: 'no-url-1', url: '', title: 'Alpha' }),
      makeArticle({ id: 'no-url-2', url: '', title: 'Bravo' }),
    ];

    const allocation = allocateHomeFeed(articles);

    // Two ids, no url to key on: previous behaviour is preserved exactly.
    expect(railItems(allocation).map((item) => item.id)).toEqual(['no-url-1', 'no-url-2']);
  });

  it('latestUpdates no longer re-publishes what the rail already placed', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60?utm_source=x' }),
    ];

    /*
      AMENDED UNDER THE VISIBLE-SURFACE EXCLUSIVITY RULING. The note here used
      to read "the exclusivity guarantee has always applied to featured/inFocus/
      discovery only. This correction does not quietly change that." That is the
      scope the Product Owner has now widened on purpose: exclusivity covers
      every surface a reader can see at once, latestUpdates included.

      Both records are one story by `allocationKey`, so `featured` takes it and
      the hero feed is left with nothing to add.
    */
    expect(allocateHomeFeed(articles).latestUpdates).toHaveLength(0);
  });

  it('allocation is deterministic across repeated runs', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60#x' }),
      makeArticle({ id: 'c', url: 'https://watchesnews.example/other', title: 'Other' }),
    ];

    const runs = [0, 1, 2, 3, 4].map(() => railItems(allocateHomeFeed(articles)).map((i) => i.id));
    runs.forEach((run) => expect(run).toEqual(runs[0]));
  });
});

describe('R4 — Today records are deduplicated on the same normalized address', () => {
  const observedAt = '2026-08-25T12:00:00.000Z';

  it('counts one story once despite a tracking-parameter variant', () => {
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://watchesnews.example/u60',
        firstSeenAt: '2026-08-25T09:05:00.000Z',
      }),
      makeArticle({
        id: 'b',
        url: 'https://watchesnews.example/u60?utm_source=rss',
        firstSeenAt: '2026-08-25T09:06:00.000Z',
      }),
    ];

    expect(allocateToday(articles, observedAt).records).toHaveLength(1);
  });

  it('keeps two genuinely different addresses', () => {
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://watchesnews.example/u60',
        firstSeenAt: '2026-08-25T09:05:00.000Z',
      }),
      makeArticle({
        id: 'b',
        url: 'https://watchesnews.example/u61',
        firstSeenAt: '2026-08-25T09:06:00.000Z',
      }),
    ];

    expect(allocateToday(articles, observedAt).records).toHaveLength(2);
  });
});

describe('MUTATION GUARD — the allocator guard cannot be removed silently', () => {
  const source = readFileSync(join(__dirname, 'homeFeedAllocation.ts'), 'utf8');

  it('the allocator keys on story identity, not on id alone', () => {
    expect(source).toContain('allocationKey');
    expect(source).toContain('normalizeArticleUrl');
    // The pre-R4 id-only set must not come back.
    expect(source).not.toContain('usedIds.has(article.id)');
  });

  it('the normalizer is imported from shared, not reimplemented here', () => {
    expect(source).toContain("from '@globalnews-ai/shared'");
    expect(source).not.toContain('utm_source');
  });
});

/*
  VISIBLE-SURFACE EXCLUSIVITY — the standing release gate: a duplicate story
  appears once.

  The guard above covers two records of ONE story landing in two rail slots.
  These cover the defect measured on the live Alpha, which is different: one
  record, correctly allocated, shown TWICE because `latestUpdates` carried the
  whole pool and the hero rail re-published what GlobalDevelopments had already
  placed. Nine of nine trending stories reappeared in the hero feed.

  The invariant is stated over what a reader can actually SEE at once:
  GlobalDevelopments (featured + inFocus + discovery) and the hero live feed
  (latestUpdates) must share no story key.
*/
describe('visible-surface exclusivity — one story is shown once', () => {
  const distinct = (count: number): NewsArticle[] =>
    Array.from({ length: count }, (_, index) =>
      makeArticle({
        id: `story-${index}`,
        title: `Story ${index}`,
        url: `https://watchesnews.example/story-${index}`,
        publishedAt: new Date(Date.UTC(2026, 7, 25, 9, 0, index)).toISOString(),
      }),
    );

  it('shares no story between the rail and the hero live feed, at a healthy pool', () => {
    const allocation = allocateHomeFeed(distinct(24));
    const rail = new Set(railItems(allocation).map((a) => a.url));
    const overlap = allocation.latestUpdates.filter((a) => rail.has(a.url));

    expect(rail.size).toBeGreaterThan(0);
    expect(allocation.latestUpdates.length).toBeGreaterThan(0);
    expect(overlap).toHaveLength(0);
  });

  it('SHOWS FEWER CARDS rather than repeating, when the pool is too small', () => {
    /* Nine articles is what the live Alpha actually retrieved on the day the
       duplication was reported. The rail takes its roles first; the hero feed
       gets only what is left, and may legitimately be short or empty. */
    const allocation = allocateHomeFeed(distinct(9));
    const rail = railItems(allocation).map((a) => a.url);
    const feed = allocation.latestUpdates.map((a) => a.url);

    expect(feed.filter((url) => rail.includes(url))).toHaveLength(0);
    expect(new Set([...rail, ...feed]).size).toBe(rail.length + feed.length);
  });

  it('never repeats a story even when two records carry one story identity', () => {
    /* One story, two records, two ids — the shape the provider actually
       produces when the raw url differs by a tracking parameter. Identity is
       the normalized url, which is what allocationKey uses; the titles of the
       surrounding fixtures are deliberately not the test. */
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60?utm_source=x' }),
      ...distinct(22),
    ];
    const allocation = allocateHomeFeed(articles);
    const everythingVisible = [
      ...railItems(allocation),
      ...allocation.latestUpdates,
    ].map((a) => normalizeArticleUrl(a.url));

    const counts = new Map<string, number>();
    everythingVisible.forEach((u) => counts.set(u, (counts.get(u) ?? 0) + 1));

    expect([...counts.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  it('holds for every visible surface pair, not just the reported one', () => {
    const allocation = allocateHomeFeed(distinct(24));
    const surfaces: Record<string, NewsArticle[]> = {
      featured: allocation.featured ? [allocation.featured] : [],
      inFocus: allocation.inFocus,
      discovery: allocation.discovery,
      latestUpdates: allocation.latestUpdates,
    };
    const names = Object.keys(surfaces);

    names.forEach((left, i) => {
      names.slice(i + 1).forEach((right) => {
        const l = new Set(surfaces[left].map((a) => a.url));
        const shared = surfaces[right].filter((a) => l.has(a.url));
        expect({ pair: `${left} x ${right}`, shared: shared.map((a) => a.url) })
          .toEqual({ pair: `${left} x ${right}`, shared: [] });
      });
    });
  });
});
