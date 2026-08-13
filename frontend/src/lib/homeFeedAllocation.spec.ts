import { allocateHomeFeed } from './homeFeedAllocation';
import type { NewsArticle } from '@globalnews-ai/shared';

function makeArticle(id: string, publishedAt: string): NewsArticle {
  return {
    id,
    title: `Title ${id}`,
    summary: 'Summary',
    url: `https://example.com/${id}`,
    sourceId: 'source',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt,
  };
}

describe('allocateHomeFeed (Milestone #51 Phase B)', () => {
  const now = Date.now();
  const twelveArticles = Array.from({ length: 12 }, (_, i) =>
    makeArticle(`a${i}`, new Date(now - i * 60_000).toISOString()),
  );

  it('1. selects exactly one featured story', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.featured?.id).toBe('a0');
  });

  it('2. featured is excluded from inFocus', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.inFocus.some((a) => a.id === result.featured?.id)).toBe(false);
  });

  it('3. inFocus is excluded from discovery', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.discovery.some((a) => result.inFocus.some((f) => f.id === a.id))).toBe(false);
  });

  it('4. no duplicate article identity across featured/inFocus/discovery', () => {
    const result = allocateHomeFeed(twelveArticles);
    const ids = [result.featured?.id, ...result.inFocus.map((a) => a.id), ...result.discovery.map((a) => a.id)].filter(
      Boolean,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('5. latestUpdates is sorted by publishedAt descending', () => {
    const result = allocateHomeFeed(twelveArticles);
    const times = result.latestUpdates.map((a) => new Date(a.publishedAt).getTime());
    const sorted = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sorted);
  });

  it('6. latestUpdates is allowed to repeat stories already shown in featured/inFocus/discovery', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.latestUpdates.some((a) => a.id === result.featured?.id)).toBe(true);
    expect(result.latestUpdates).toHaveLength(12);
  });

  it('7. does not mutate the source articles array or its objects', () => {
    const original = twelveArticles.map((a) => ({ ...a }));
    allocateHomeFeed(twelveArticles);
    expect(twelveArticles).toEqual(original);
  });

  it('8. handles empty input without throwing', () => {
    const result = allocateHomeFeed([]);
    expect(result.featured).toBeNull();
    expect(result.inFocus).toEqual([]);
    expect(result.discovery).toEqual([]);
    expect(result.latestUpdates).toEqual([]);
  });

  it('9. handles undersupplied input gracefully — each role gets only what genuinely remains', () => {
    const three = [
      makeArticle('x0', new Date(now).toISOString()),
      makeArticle('x1', new Date(now - 60_000).toISOString()),
      makeArticle('x2', new Date(now - 120_000).toISOString()),
    ];
    const result = allocateHomeFeed(three);
    expect(result.featured?.id).toBe('x0');
    expect(result.inFocus).toHaveLength(2);
    expect(result.discovery).toHaveLength(0);
    const ids = [result.featured?.id, ...result.inFocus.map((a) => a.id)];
    expect(new Set(ids).size).toBe(3);
  });
});
