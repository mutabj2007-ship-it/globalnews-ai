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

  it('latestUpdates carries the story even when the rail placed it — C907', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60?utm_source=x' }),
    ];

    /*
      AMENDED UNDER THE C907 RULING, WHICH SUPERSEDES THE C905 VISIBLE-SURFACE
      EXCLUSIVITY RULING THIS TEST PREVIOUSLY ENCODED.

      The two records are ONE story by `allocationKey`, so the stream still
      collapses them to a single row — that half is unchanged and is the R4
      guard this file exists for. What changed is that `featured` taking the
      story no longer REMOVES it: *"Global Intelligence / latestUpdates =
      chronological live/current stream = MAY contain a story also surfaced
      editorially."* The previous expectation here was `toHaveLength(0)`.
    */
    const allocation = allocateHomeFeed(articles);

    expect(allocation.latestUpdates).toHaveLength(1);
    expect(allocation.latestUpdates[0].id).toBe('a');
    expect(allocation.featured?.id).toBe('a');
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
  ════════════════════════════════════════════════════════════════════════════
  C907 CORRECTION 1 — THE HOMEPAGE GLOBAL INTELLIGENCE FEED
  ════════════════════════════════════════════════════════════════════════════

  THIS BLOCK REPLACES `visible-surface exclusivity — one story is shown once`,
  and the replacement is a REVERSAL, not a refinement. That block was written
  under the C905 ruling that widened exclusivity to every simultaneously
  visible surface. The C907 ruling withdraws that widening by name:

      "featured / inFocus / discovery = editorial-curation roles = mutually
       exclusive WITH EACH OTHER; Global Intelligence / latestUpdates =
       chronological live/current stream = MAY contain a story also surfaced
       editorially."

  WHAT THE OLD RULE COST, MEASURED. The three editorial roles consume
  1 + 5 + 6 = 12 records. Subtracting them from the stream meant a live
  response of twelve distinct stories produced `latestUpdates = []` — and the
  hero panel, which branched on emptiness alone, then told the reader the live
  feed was unavailable. A healthy provider was being reported as a failure by
  arithmetic. The first test below is the ruling's own named regression case.

  WHAT SURVIVES UNCHANGED. One STORY still appears at most once within any one
  surface, keyed on the normalized url — the R4 guard above. Two records of one
  story are still collapsed. Only cross-surface subtraction is withdrawn.
*/
describe('C907 — Global Intelligence is a chronological stream, not a remainder', () => {
  const distinct = (count: number): NewsArticle[] =>
    Array.from({ length: count }, (_, index) =>
      makeArticle({
        id: `story-${index}`,
        title: `Story ${index}`,
        url: `https://watchesnews.example/story-${index}`,
        publishedAt: new Date(Date.UTC(2026, 7, 25, 9, 0, index)).toISOString(),
      }),
    );

  it('THE RULING REGRESSION — 12 live distinct articles fill the stream, not empty it', () => {
    /*
      The exact case the ruling specifies: *"Add regression test: 12 live
      distinct articles."* Under the superseded rule this produced zero.
    */
    const allocation = allocateHomeFeed(distinct(12));

    expect(allocation.latestUpdates).toHaveLength(12);
    expect(allocation.featured?.id).toBe('story-0');
    expect(allocation.inFocus).toHaveLength(5);
    expect(allocation.discovery).toHaveLength(6);
  });

  it('the editorial roles remain mutually exclusive WITH EACH OTHER', () => {
    /* The half of the old rule the ruling keeps, asserted on its own. */
    const allocation = allocateHomeFeed(distinct(12));
    const editorial = railItems(allocation).map((a) => normalizeArticleUrl(a.url));

    expect(editorial).toHaveLength(12);
    expect(new Set(editorial).size).toBe(12);
  });

  it('the stream MAY repeat what the editorial roles surfaced, and here it does', () => {
    const allocation = allocateHomeFeed(distinct(12));
    const editorial = new Set(railItems(allocation).map((a) => normalizeArticleUrl(a.url)));
    const overlap = allocation.latestUpdates.filter((a) =>
      editorial.has(normalizeArticleUrl(a.url)),
    );

    expect(overlap).toHaveLength(12);
  });

  it('a story is never repeated WITHIN the stream, however many records carry it', () => {
    /* The R4 identity guard, still binding on the stream itself. */
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60?utm_source=x' }),
      makeArticle({ id: 'c', url: 'https://watchesnews.example/u60#gallery' }),
      ...distinct(12),
    ];
    const keys = allocateHomeFeed(articles).latestUpdates.map((a) => normalizeArticleUrl(a.url));

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(13);
  });

  it('the stream is ordered newest first', () => {
    const times = allocateHomeFeed(distinct(12)).latestUpdates.map((a) =>
      new Date(a.publishedAt).getTime(),
    );

    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(times[0]).toBeGreaterThan(times[times.length - 1]);
  });

  it('an undersupplied day is short, not empty, and is never padded', () => {
    /* Nine articles is what the live Alpha retrieved on the reported day. */
    const allocation = allocateHomeFeed(distinct(9));

    expect(allocation.latestUpdates).toHaveLength(9);
    expect(allocation.discovery).toHaveLength(3);
  });

  it('a genuinely empty response yields an empty stream and asserts nothing about the provider', () => {
    /*
      The allocator's job here is arithmetic, not diagnosis. It returns an
      empty stream and says nothing at all about why — the ruling's *"never
      infer provider failure from latestUpdates.length === 0"* is enforced at
      the surface that would otherwise make that claim, and is asserted in
      HeroLiveFeedPanel.spec.ts.
    */
    const allocation = allocateHomeFeed([]);

    expect(allocation.latestUpdates).toEqual([]);
    expect(allocation.featured).toBeNull();
  });

  it('allocation stays deterministic across repeated runs', () => {
    const runs = [0, 1, 2, 3, 4].map(() =>
      allocateHomeFeed(distinct(12)).latestUpdates.map((a) => a.id),
    );
    runs.forEach((run) => expect(run).toEqual(runs[0]));
  });

  it('no second request is issued — the allocator is pure and fetches nothing', () => {
    const source = readFileSync(join(__dirname, 'homeFeedAllocation.ts'), 'utf8');

    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toMatch(/fetchTopHeadlines|axios|XMLHttpRequest/);

    /* And the one caller still makes exactly one call per invocation. */
    const feedSource = readFileSync(join(__dirname, 'homeFeed.ts'), 'utf8');
    const codeOnly = feedSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect((codeOnly.match(/fetchTopHeadlines\(/g) ?? []).length).toBe(1);
  });

  it('the input array is never mutated', () => {
    const articles = distinct(12);
    const before = articles.map((a) => a.id);

    allocateHomeFeed(articles);

    expect(articles.map((a) => a.id)).toEqual(before);
  });
});
