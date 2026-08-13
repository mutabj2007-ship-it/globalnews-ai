import type { NewsArticle } from '@globalnews-ai/shared';
import { clusterDuplicateArticles, clusterArticlesWithMembership } from './cluster-articles.util';

function makeArticle(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'id',
    title: 'title',
    summary: '',
    url: 'https://example.com/unique',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('clusterDuplicateArticles', () => {
  it('collapses articles with the exact same URL', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one (syndicated)' }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('collapses near-identical titles published close together', () => {
    const now = new Date();
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://outlet-a.example.com/story',
        title: 'Coastal cities begin evacuation drills ahead of storm season',
        publishedAt: now.toISOString(),
      }),
      makeArticle({
        id: 'b',
        url: 'https://outlet-b.example.com/story-copy',
        title: 'Coastal cities begin evacuation drills ahead of storm season today',
        publishedAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(1);
  });

  it('keeps genuinely distinct articles separate', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://a.example.com', title: 'Markets rally on rate news' }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com',
        title: 'New telescope data reveals galaxy',
      }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(2);
  });

  it('does not merge similar titles published far apart in time', () => {
    const now = new Date();
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://a.example.com/x',
        title: 'Committee schedules vote on cross-border data proposal',
        publishedAt: now.toISOString(),
      }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com/y',
        title: 'Committee schedules vote on cross-border data proposal',
        publishedAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(clusterDuplicateArticles([])).toEqual([]);
  });
});

describe('clusterArticlesWithMembership (Milestone #43)', () => {
  it('R. clusterDuplicateArticles() output is structurally identical before/after the computeClusters refactor, on the same fixtures used above', () => {
    const exactUrlDup = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one (syndicated)' }),
    ];
    expect(clusterDuplicateArticles(exactUrlDup)).toEqual([exactUrlDup[0]]);

    const distinct = [
      makeArticle({ id: 'a', url: 'https://a.example.com', title: 'Markets rally on rate news' }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com',
        title: 'New telescope data reveals galaxy',
      }),
    ];
    expect(clusterDuplicateArticles(distinct)).toEqual(distinct);

    expect(clusterDuplicateArticles([])).toEqual([]);
  });

  it('reports full membership for a duplicate URL cluster', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one (syndicated)' }),
    ];
    const result = clusterArticlesWithMembership(articles);
    expect(result).toHaveLength(1);
    expect(result[0].representative.id).toBe('a');
    expect(result[0].members.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('reports each genuinely distinct article as its own singleton cluster', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://a.example.com', title: 'Markets rally on rate news' }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com',
        title: 'New telescope data reveals galaxy',
      }),
    ];
    const result = clusterArticlesWithMembership(articles);
    expect(result).toHaveLength(2);
    expect(result[0].members).toHaveLength(1);
    expect(result[1].members).toHaveLength(1);
  });

  it('returns an empty array for empty input', () => {
    expect(clusterArticlesWithMembership([])).toEqual([]);
  });

  it('members().map(representative) equals clusterDuplicateArticles() output exactly, for a mixed fixture', () => {
    const now = new Date();
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one (syndicated)' }),
      makeArticle({ id: 'c', url: 'https://c.example.com', title: 'Unrelated separate report' }),
      makeArticle({
        id: 'd',
        url: 'https://d.example.com',
        title: 'Coastal cities begin evacuation drills ahead of storm season',
        publishedAt: now.toISOString(),
      }),
      makeArticle({
        id: 'e',
        url: 'https://e.example.com',
        title: 'Coastal cities begin evacuation drills ahead of storm season today',
        publishedAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      }),
    ];
    const membership = clusterArticlesWithMembership(articles);
    const viaMembership = membership.map((c) => c.representative);
    const viaOriginal = clusterDuplicateArticles(articles);
    expect(viaMembership).toEqual(viaOriginal);
  });
});

describe('URL identity normalization (Milestone #43 correction)', () => {
  it('1. tracking/query variants cluster together even with deliberately dissimilar titles', () => {
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://example.com/story?utm_source=x',
        title: 'Alpha completely unrelated headline wording here',
      }),
      makeArticle({
        id: 'b',
        url: 'https://example.com/story?ref=abc',
        title: 'Zeta totally different phrasing altogether now',
      }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(1);
  });

  it('2. www vs non-www clusters together even with dissimilar titles', () => {
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://www.example.com/story',
        title: 'Alpha completely unrelated headline wording here',
      }),
      makeArticle({
        id: 'b',
        url: 'https://example.com/story',
        title: 'Zeta totally different phrasing altogether now',
      }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(1);
  });

  it('3. fragment-only variants cluster together', () => {
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://example.com/story#section-a',
        title: 'Alpha completely unrelated headline wording here',
      }),
      makeArticle({
        id: 'b',
        url: 'https://example.com/story#section-b',
        title: 'Zeta totally different phrasing altogether now',
      }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(1);
  });

  it('4. same domain, genuinely different paths do NOT become duplicates merely by domain', () => {
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://example.com/story-a',
        title: 'Alpha completely unrelated headline wording here',
      }),
      makeArticle({
        id: 'b',
        url: 'https://example.com/story-b',
        title: 'Zeta totally different phrasing altogether now',
      }),
    ];
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(2);
  });

  it('5. malformed URLs do not crash and fall through to the title/time heuristic', () => {
    const now = new Date();
    const articles = [
      makeArticle({
        id: 'a',
        url: 'not a valid url at all',
        title: 'Coastal cities begin evacuation drills ahead of storm season',
        publishedAt: now.toISOString(),
      }),
      makeArticle({
        id: 'b',
        url: 'also not a valid url',
        title: 'Coastal cities begin evacuation drills ahead of storm season today',
        publishedAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      }),
    ];
    expect(() => clusterDuplicateArticles(articles)).not.toThrow();
    // Two malformed URLs are never treated as URL-identity-equal to each
    // other (null !== null under the "both must be non-null" rule) —
    // this pair still clusters, but via the title/time fallback, not a
    // fabricated URL match.
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(1);
  });

  it('5b. one malformed URL and one well-formed URL never crash and never falsely match on URL identity', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'not a valid url at all', title: 'Markets rally on rate news' }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com/x',
        title: 'New telescope data reveals galaxy',
      }),
    ];
    expect(() => clusterDuplicateArticles(articles)).not.toThrow();
    const result = clusterDuplicateArticles(articles);
    expect(result).toHaveLength(2);
  });

  it('6. existing clusterDuplicateArticles() fixtures remain behaviorally unchanged after the URL-identity correction', () => {
    const exactUrlDup = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one (syndicated)' }),
    ];
    expect(clusterDuplicateArticles(exactUrlDup)).toEqual([exactUrlDup[0]]);

    const distinct = [
      makeArticle({ id: 'a', url: 'https://a.example.com', title: 'Markets rally on rate news' }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com',
        title: 'New telescope data reveals galaxy',
      }),
    ];
    expect(clusterDuplicateArticles(distinct)).toEqual(distinct);

    expect(clusterDuplicateArticles([])).toEqual([]);
  });
});
