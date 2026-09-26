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

  it('collapses the same syndicated development across different publishers into one Home card', () => {
    const headline = 'Woman who accused Jay-Z of sexual assault says her claims were false';
    const sharedImage = 'https://cdn.example.com/jay-z-story.jpg';
    const articles = [
      makeArticle({
        id: 'npr-copy',
        title: headline,
        url: 'https://npr.example/jay-z-claims-false',
        imageUrl: sharedImage,
        sourceId: 'npr',
        sourceName: 'NPR',
        publishedAt: '2026-09-26T01:00:00.000Z',
      }),
      makeArticle({
        id: 'gpb-copy',
        title: headline,
        url: 'https://gpb.example/news/jay-z-claims-false',
        imageUrl: sharedImage,
        sourceId: 'gpb',
        sourceName: 'GPB',
        publishedAt: '2026-09-26T01:08:00.000Z',
      }),
      makeArticle({
        id: 'other-story',
        title: 'Distinct world development',
        url: 'https://example.com/distinct-world-development',
      }),
    ];

    const allocation = allocateHomeFeed(articles);
    const rail = railItems(allocation);

    expect(rail.filter((item) => item.title === headline)).toHaveLength(1);
    expect(rail.map((item) => item.id)).toEqual(['npr-copy', 'other-story']);

    const inclusive = allocateHomeFeed(articles, 5, 6, 'chronological-inclusive');
    expect(inclusive.latestUpdates.filter((item) => item.title === headline)).toHaveLength(1);
  });

  it('keeps materially different updates even when they concern the same event', () => {
    const articles = [
      makeArticle({
        id: 'talks-resume',
        title: 'Ukraine peace talks resume in Geneva',
        url: 'https://wire.example/talks-resume',
        imageUrl: 'https://cdn.example.com/geneva.jpg',
        publishedAt: '2026-09-26T01:00:00.000Z',
      }),
      makeArticle({
        id: 'talks-collapse',
        title: 'Ukraine peace talks collapse in Geneva',
        url: 'https://wire.example/talks-collapse',
        imageUrl: 'https://cdn.example.com/geneva.jpg',
        publishedAt: '2026-09-26T01:30:00.000Z',
      }),
    ];

    const rail = railItems(allocateHomeFeed(articles));

    expect(rail.map((item) => item.id)).toEqual(['talks-resume', 'talks-collapse']);
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

  it('the rail placing a story keeps it OUT of the stream by default — ALPHA POST-CUTOVER R1', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60?utm_source=x' }),
    ];

    /*
      RE-AMENDED UNDER THE ALPHA POST-CUTOVER R1 CLOSEOUT.

      HISTORY, SO THE NEXT READER DOES NOT REVERSE THIS BY ACCIDENT. C905 ruled
      for visible-surface exclusivity and this expectation was 0. C907 withdrew
      that widening and the expectation became 1. The carried-defect closeout
      restores the governed placement rule as the DEFAULT — one story, one Home
      placement — so it is 0 again, but for a reason neither earlier ruling
      had: the permission C907 granted is not gone, it is now something a
      caller must ask for BY NAME. See the `chronological-inclusive` block
      below, where every behaviour C907 specified is still asserted.

      THE HALF THAT HAS NEVER MOVED. The two records are ONE story by
      `allocationKey`, and no policy has ever let a stream show it twice. That
      is the R4 guard this file exists for, and it is asserted under both
      policies.
    */
    const allocation = allocateHomeFeed(articles);

    expect(allocation.featured?.id).toBe('a');
    expect(allocation.latestUpdates).toHaveLength(0);
  });

  it('and carries it when a caller names the explicit contract', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60?utm_source=x' }),
    ];

    const allocation = allocateHomeFeed(articles, 5, 6, 'chronological-inclusive');

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
  ALPHA POST-CUTOVER R1 — THE HOMEPAGE GLOBAL INTELLIGENCE FEED
  ════════════════════════════════════════════════════════════════════════════

  THE CARRIED DEFECT, AND WHY IT IS ONE DEFECT AND NOT TWO DISAGREEING SUITES.
  The Model-A cutover measured `homeFeed` and `homeFeedAllocation` failing
  together. Both were asserting the same thing: a story consumed by a rail role
  must not reappear in the main Home feed. The allocator had stopped honouring
  it, because the block this one replaces encoded a BLANKET, DEFAULT permission
  to repeat:

      "Global Intelligence / latestUpdates = chronological live/current stream
       = MAY contain a story also surfaced editorially."

  WHAT THE CLOSEOUT CHANGES — SCOPE, NOT EXISTENCE. That permission is not
  deleted. It is demoted from an unconditional property of the return shape to
  an EXPLICIT CONTRACT (`HomeFeedStreamPolicy`) that a caller requests by name.
  The default is `'exclusive'`: one story occupies one governed Home placement.

  WHY THE C907 CONCERN NO LONGER BITES, MEASURED. C907 withdrew exclusivity
  because 1 + 5 + 6 = 12 rail-consumed records subtracted from a TWELVE-record
  response emptied the stream, and the hero panel reported a healthy provider as
  unavailable. `getHomeFeed` retrieves 24. The stream receives 12 — asserted in
  `homeFeed.spec.ts`, and the allocator arithmetic is asserted directly below.
  The failure mode C907 named is therefore closed by width, not by permission.

  WHAT SURVIVES UNCHANGED, AND IS STILL ASSERTED HERE IN FULL. One STORY appears
  at most once within any one surface, keyed on the normalized url — the R4
  guard. Ordering is newest-first. The allocator fetches nothing and mutates
  nothing. Every C907 behaviour is re-asserted below under the explicit policy,
  so demoting the default did not cost a single unit of coverage.
*/
describe('ALPHA POST-CUTOVER R1 — governed placement is the DEFAULT', () => {
  const distinct = (count: number): NewsArticle[] =>
    Array.from({ length: count }, (_, index) =>
      makeArticle({
        id: `story-${index}`,
        title: `Story ${index}`,
        url: `https://watchesnews.example/story-${index}`,
        publishedAt: new Date(Date.UTC(2026, 7, 25, 9, 0, index)).toISOString(),
      }),
    );

  it('THE CLOSEOUT REGRESSION — no story taken by the rail is repeated in the stream', () => {
    /*
      The defect itself, reproduced at the released retrieval width. Before the
      correction every one of these twelve rail stories appeared a second time.
    */
    const allocation = allocateHomeFeed(distinct(24));
    const rail = new Set(railItems(allocation).map((a) => normalizeArticleUrl(a.url)));
    const repeated = allocation.latestUpdates.filter((a) => rail.has(normalizeArticleUrl(a.url)));

    expect(rail.size).toBe(12);
    expect(repeated).toEqual([]);
  });

  it('the stream is what REMAINS — 24 retrieved, 12 placed by the rail, 12 streamed', () => {
    const allocation = allocateHomeFeed(distinct(24));

    expect(allocation.featured?.id).toBe('story-0');
    expect(allocation.inFocus).toHaveLength(5);
    expect(allocation.discovery).toHaveLength(6);
    expect(allocation.latestUpdates).toHaveLength(12);

    /* Every governed placement across the whole homepage is a distinct story. */
    const everywhere = [...railItems(allocation), ...allocation.latestUpdates].map((a) =>
      normalizeArticleUrl(a.url),
    );
    expect(new Set(everywhere).size).toBe(24);
  });

  it('a twelve-record response gives the rail everything and the stream nothing — and that is arithmetic, not a diagnosis', () => {
    /*
      The case C907 named. It is retained deliberately: the outcome is real and
      the allocator states it plainly. What it is NOT is a provider claim —
      "never infer provider failure from latestUpdates.length === 0" is enforced
      at the surface that would otherwise make that claim, in
      HeroLiveFeedPanel.spec.ts, and this closeout does not touch it. The
      released retrieval width is 24, so this is not the shipped shape.
    */
    const allocation = allocateHomeFeed(distinct(12));

    expect(railItems(allocation)).toHaveLength(12);
    expect(allocation.latestUpdates).toHaveLength(0);
  });

  it('an undersupplied day is short, not padded, and still never repeats', () => {
    /* Nine articles is what the live Alpha retrieved on the reported day. */
    const allocation = allocateHomeFeed(distinct(9));

    expect(allocation.discovery).toHaveLength(3);
    expect(railItems(allocation)).toHaveLength(9);
    expect(allocation.latestUpdates).toHaveLength(0);
  });

  it('the editorial roles remain mutually exclusive WITH EACH OTHER', () => {
    const allocation = allocateHomeFeed(distinct(24));
    const editorial = railItems(allocation).map((a) => normalizeArticleUrl(a.url));

    expect(editorial).toHaveLength(12);
    expect(new Set(editorial).size).toBe(12);
  });

  it('a story is never repeated WITHIN the stream, however many records carry it', () => {
    /* The R4 identity guard, binding on the stream under the default policy. */
    const articles = [
      ...distinct(12),
      makeArticle({ id: 'x', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'y', url: 'https://watchesnews.example/u60?utm_source=x' }),
      makeArticle({ id: 'z', url: 'https://watchesnews.example/u60#gallery' }),
    ];
    const keys = allocateHomeFeed(articles).latestUpdates.map((a) => normalizeArticleUrl(a.url));

    /* The rail took the twelve distinct stories; one story remains, once. */
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(1);
  });

  it('the stream is ordered newest first', () => {
    const times = allocateHomeFeed(distinct(24)).latestUpdates.map((a) =>
      new Date(a.publishedAt).getTime(),
    );

    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(times[0]).toBeGreaterThan(times[times.length - 1]);
  });

  it('a genuinely empty response yields an empty stream and asserts nothing about the provider', () => {
    const allocation = allocateHomeFeed([]);

    expect(allocation.latestUpdates).toEqual([]);
    expect(allocation.featured).toBeNull();
  });

  it('allocation stays deterministic across repeated runs', () => {
    const runs = [0, 1, 2, 3, 4].map(() =>
      allocateHomeFeed(distinct(24)).latestUpdates.map((a) => a.id),
    );
    runs.forEach((run) => expect(run).toEqual(runs[0]));
  });

  it('the input array is never mutated', () => {
    const articles = distinct(24);
    const before = articles.map((a) => a.id);

    allocateHomeFeed(articles);

    expect(articles.map((a) => a.id)).toEqual(before);
  });

  it('no second request is issued — the allocator is pure and fetches nothing under EITHER policy', () => {
    const source = readFileSync(join(__dirname, 'homeFeedAllocation.ts'), 'utf8');

    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toMatch(/fetchTopHeadlines|axios|XMLHttpRequest/);

    /* And the one caller still makes exactly one call per invocation. */
    const feedSource = readFileSync(join(__dirname, 'homeFeed.ts'), 'utf8');
    const codeOnly = feedSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect((codeOnly.match(/fetchTopHeadlines\(/g) ?? []).length).toBe(1);
  });

  it('MUTATION GUARD — exclusivity is the DEFAULT and cannot be flipped silently', () => {
    /*
      The permission may be granted, but only by name. If a future edit makes
      `'chronological-inclusive'` the default again, this fails rather than
      quietly reinstating the duplication the cutover measured.
    */
    const source = readFileSync(join(__dirname, 'homeFeedAllocation.ts'), 'utf8');

    expect(source).toMatch(/DEFAULT_STREAM_POLICY:\s*HomeFeedStreamPolicy\s*=\s*'exclusive'/);
    expect(source).toMatch(/streamPolicy:\s*HomeFeedStreamPolicy\s*=\s*DEFAULT_STREAM_POLICY/);
  });
});

/*
  ────────────────────────────────────────────────────────────────────────────
  THE EXPLICIT CONTRACT — every C907 behaviour, preserved and still asserted.
  ────────────────────────────────────────────────────────────────────────────

  These are the C907 assertions verbatim in substance. They did not become
  wrong; they became conditional. A caller that names the contract gets exactly
  the chronological stream C907 specified, which is why demoting the default
  removed no coverage and no capability.
*/
describe('C907, under the explicit chronological-inclusive contract', () => {
  const distinct = (count: number): NewsArticle[] =>
    Array.from({ length: count }, (_, index) =>
      makeArticle({
        id: `story-${index}`,
        title: `Story ${index}`,
        url: `https://watchesnews.example/story-${index}`,
        publishedAt: new Date(Date.UTC(2026, 7, 25, 9, 0, index)).toISOString(),
      }),
    );

  const inclusive = (articles: NewsArticle[]) =>
    allocateHomeFeed(articles, 5, 6, 'chronological-inclusive');

  it('THE C907 REGRESSION — 12 live distinct articles fill the stream, not empty it', () => {
    const allocation = inclusive(distinct(12));

    expect(allocation.latestUpdates).toHaveLength(12);
    expect(allocation.featured?.id).toBe('story-0');
    expect(allocation.inFocus).toHaveLength(5);
    expect(allocation.discovery).toHaveLength(6);
  });

  it('the stream MAY repeat what the editorial roles surfaced, and here it does', () => {
    const allocation = inclusive(distinct(12));
    const editorial = new Set(railItems(allocation).map((a) => normalizeArticleUrl(a.url)));
    const overlap = allocation.latestUpdates.filter((a) =>
      editorial.has(normalizeArticleUrl(a.url)),
    );

    expect(overlap).toHaveLength(12);
  });

  it('the editorial roles remain mutually exclusive WITH EACH OTHER', () => {
    const allocation = inclusive(distinct(12));
    const editorial = railItems(allocation).map((a) => normalizeArticleUrl(a.url));

    expect(editorial).toHaveLength(12);
    expect(new Set(editorial).size).toBe(12);
  });

  it('a story is never repeated WITHIN the stream, however many records carry it', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://watchesnews.example/u60' }),
      makeArticle({ id: 'b', url: 'https://watchesnews.example/u60?utm_source=x' }),
      makeArticle({ id: 'c', url: 'https://watchesnews.example/u60#gallery' }),
      ...distinct(12),
    ];
    const keys = inclusive(articles).latestUpdates.map((a) => normalizeArticleUrl(a.url));

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(13);
  });

  it('the stream is ordered newest first', () => {
    const times = inclusive(distinct(12)).latestUpdates.map((a) =>
      new Date(a.publishedAt).getTime(),
    );

    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(times[0]).toBeGreaterThan(times[times.length - 1]);
  });

  it('an undersupplied day is short, not empty, and is never padded', () => {
    const allocation = inclusive(distinct(9));

    expect(allocation.latestUpdates).toHaveLength(9);
    expect(allocation.discovery).toHaveLength(3);
  });

  it('a genuinely empty response yields an empty stream and asserts nothing about the provider', () => {
    const allocation = inclusive([]);

    expect(allocation.latestUpdates).toEqual([]);
    expect(allocation.featured).toBeNull();
  });

  it('allocation stays deterministic across repeated runs', () => {
    const runs = [0, 1, 2, 3, 4].map(() => inclusive(distinct(12)).latestUpdates.map((a) => a.id));
    runs.forEach((run) => expect(run).toEqual(runs[0]));
  });

  it('the input array is never mutated', () => {
    const articles = distinct(12);
    const before = articles.map((a) => a.id);

    inclusive(articles);

    expect(articles.map((a) => a.id)).toEqual(before);
  });
});
