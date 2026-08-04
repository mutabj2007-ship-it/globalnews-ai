import type { NewsArticle } from '@globalnews-ai/shared';
import { clusterDuplicateArticles } from './cluster-articles.util';

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
      makeArticle({ id: 'b', url: 'https://b.example.com', title: 'New telescope data reveals galaxy' }),
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
