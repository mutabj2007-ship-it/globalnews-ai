import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { NewsService } from '../news.service';
import { readerSafeNewsResponse } from '../news.controller';
import { __setProviderAdmissionTestFeeds } from './provider-admission';
import { __setReaderRightsFixtureModeForTests, __setReaderRightsTestFeeds } from './reader-rights';

/*
  CTO #95 6376647758 §5 — the Map reads GET /news/top-headlines/retained (topHeadlinesCacheOnly), which
  never executes a provider. With Gate A admitting nothing it answered an empty list with NO reason, so
  the Map could only infer one. It now carries the same typed reason as the executing route — and only
  when acquisition is closed, never for an ordinary "nothing retained yet" miss.
*/
const CLEARED_FEED = {
  sourceId: 'feed:map-test-cleared',
  displayName: 'Map Test Cleared Publisher',
  countryCode: 'KE',
  sourceType: 'NEWS_PROVIDER',
  feedUrl: 'https://cleared.example/feed',
  canonicalHost: 'cleared.example',
  language: 'en',
  enabled: false,
  provenanceNote: 'TEST ONLY — Map typed-reason positive control.',
  verifiedAt: '2026-10-24',
  rights: { state: 'CLEARED', evidence: 'TEST ONLY' },
} as unknown as FeedSourceEntry;

/** A provider double that fails the test if any method is called: this route must never execute one. */
const forbidden = (id: string) => {
  const fail = (m: string) =>
    jest.fn(() => {
      throw new Error(`NON-EXECUTING ROUTE BREACH: ${id}.${m} was called`);
    });
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search', 'top-headlines', 'category'],
    search: fail('search'),
    topHeadlines: fail('topHeadlines'),
    category: fail('category'),
    health: jest.fn(),
  };
};
const persistence = () => ({
  persistMany: jest.fn().mockResolvedValue(new Map()),
  findRecent: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  findByUrl: jest.fn().mockResolvedValue(null),
  findRecentByCountry: jest.fn().mockResolvedValue([]),
  findRetainedByUrl: jest.fn().mockResolvedValue(null),
  persistCountryRelations: jest.fn().mockResolvedValue(undefined),
});
const newsService = (providers: object[]) =>
  new NewsService(providers as never, providers as never, [] as never, persistence() as never);

beforeEach(() => {
  __setReaderRightsFixtureModeForTests(false);
  __setReaderRightsTestFeeds(null);
  __setProviderAdmissionTestFeeds(null);
});
afterAll(() => {
  __setReaderRightsTestFeeds(null);
  __setProviderAdmissionTestFeeds(null);
  __setReaderRightsFixtureModeForTests(true);
});

describe('GET /news/top-headlines/retained (the Map) states the typed reason, never an inferred one', () => {
  it('Gate A admits nothing (the live Alpha registry) → SOURCE_RIGHTS_UNCLEARED, and no provider is called', () => {
    expect(FEED_SOURCES.filter((f) => f.rights.state === 'CLEARED')).toEqual([]);
    const gnews = forbidden('gnews');
    const gdelt = forbidden('gdelt-doc');
    const out = readerSafeNewsResponse(
      newsService([gnews, gdelt]).topHeadlinesCacheOnly(10, { lang: 'en' }),
    );
    expect(out.articles).toEqual([]);
    expect(out.dataMode).toBe('unavailable');
    expect((out as unknown as { acquisition?: unknown }).acquisition).toEqual({
      state: 'SOURCE_RIGHTS_UNCLEARED',
      notSearched: ['gnews', 'gdelt-doc'],
    });
    expect(gnews.topHeadlines).not.toHaveBeenCalled();
    expect(gdelt.topHeadlines).not.toHaveBeenCalled();
  });

  it('positive control: with an admitted lane, an empty miss is just "not retained yet" — no reason is invented', () => {
    __setProviderAdmissionTestFeeds([...FEED_SOURCES, CLEARED_FEED]);
    const feed = { ...forbidden('rss-feeds'), capabilities: ['search', 'top-headlines'] };
    const out = newsService([forbidden('gnews'), feed]).topHeadlinesCacheOnly(10, { lang: 'en' });
    expect(out.articles).toEqual([]);
    expect((out as unknown as { acquisition?: unknown }).acquisition).toBeUndefined();
    expect(feed.topHeadlines).not.toHaveBeenCalled();
  });
});
