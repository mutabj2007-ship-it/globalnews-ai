import type { NewsResponse } from '@globalnews-ai/shared';
import { getHomeFeed } from './homeFeed';
import * as newsApi from './api/newsApi';

function makeArticle(id: string, publishedAt: string) {
  return {
    id,
    title: `Title ${id}`,
    summary: 'Summary',
    url: `https://example.com/${id}`,
    sourceId: 'source',
    sourceName: 'Source',
    category: 'world' as const,
    sourcesCount: 1,
    publishedAt,
  };
}

describe('getHomeFeed (Milestone #51 Phase B — single-request architecture)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls fetchTopHeadlines exactly once per invocation, with limit=12', async () => {
    const now = Date.now();
    const response: NewsResponse = {
      articles: Array.from({ length: 12 }, (_, i) => makeArticle(`a${i}`, new Date(now - i * 60_000).toISOString())),
      totalResults: 12,
      providers: ['gnews'],
      dataMode: 'live',
      generatedAt: new Date().toISOString(),
    };
    const spy = jest.spyOn(newsApi, 'fetchTopHeadlines').mockResolvedValue(response);

    await getHomeFeed('pl');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(12, 'pl');
  });

  it('forwards the requested language through to the single backend request', async () => {
    const response: NewsResponse = {
      articles: [makeArticle('a0', new Date().toISOString())],
      totalResults: 1,
      providers: ['gnews'],
      dataMode: 'live',
      generatedAt: new Date().toISOString(),
    };
    const spy = jest.spyOn(newsApi, 'fetchTopHeadlines').mockResolvedValue(response);

    await getHomeFeed('en');

    expect(spy).toHaveBeenCalledWith(12, 'en');
  });

  it('returns the four explicit semantic roles derived from that one response', async () => {
    const now = Date.now();
    const response: NewsResponse = {
      articles: Array.from({ length: 12 }, (_, i) => makeArticle(`a${i}`, new Date(now - i * 60_000).toISOString())),
      totalResults: 12,
      providers: ['gnews'],
      dataMode: 'live',
      generatedAt: new Date().toISOString(),
    };
    jest.spyOn(newsApi, 'fetchTopHeadlines').mockResolvedValue(response);

    const feed = await getHomeFeed('en');

    expect(feed.featured).not.toBeNull();
    expect(feed.inFocus.length).toBeGreaterThan(0);
    expect(feed.discovery.length).toBeGreaterThan(0);
    expect(feed.latestUpdates).toHaveLength(12);
    expect('trending' in feed).toBe(false);
    expect('categoryCards' in feed).toBe(false);
  });

  it('degrades to an empty feed (not a throw) if the backend is unreachable', async () => {
    jest.spyOn(newsApi, 'fetchTopHeadlines').mockRejectedValue(new Error('unreachable'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const feed = await getHomeFeed('en');

    expect(feed.featured).toBeNull();
    expect(feed.inFocus).toEqual([]);
    expect(feed.discovery).toEqual([]);
    expect(feed.latestUpdates).toEqual([]);
    expect(feed.isLive).toBe(false);
  });
});
