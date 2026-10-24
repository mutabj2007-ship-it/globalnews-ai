import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { NewsService } from '../news.service';
import { __setProviderAdmissionTestFeeds } from './provider-admission';
import { __setReaderRightsFixtureModeForTests, __setReaderRightsTestFeeds } from './reader-rights';

/*
  E1 OBS-G (ADDENDUM-21) — the "no source is cleared" claim is safe only because notAdmittedProviderIds()
  is ALL-OR-NOTHING: it returns the refused providers only when EVERY configured provider is refused, and
  [] otherwise. Two routes rely on that with different conditions (the executing route also requires an
  empty result; the Map's cache-only route does not), so a "simplification" returning the refused SUBSET
  would make the Map tell readers no source is cleared while one is. This pins the invariant itself.
*/
const CLEARED_FEED = {
  sourceId: 'feed:obs-g-cleared',
  displayName: 'OBS-G Test Cleared Publisher',
  countryCode: 'KE',
  sourceType: 'NEWS_PROVIDER',
  feedUrl: 'https://cleared.example/feed',
  canonicalHost: 'cleared.example',
  language: 'en',
  enabled: false,
  provenanceNote: 'TEST ONLY — OBS-G partial-refusal control.',
  verifiedAt: '2026-10-24',
  rights: { state: 'CLEARED', evidence: 'TEST ONLY' },
} as unknown as FeedSourceEntry;

const provider = (id: string) => ({
  id,
  displayName: id,
  isMock: false,
  capabilities: ['search', 'top-headlines', 'category'],
  search: jest.fn().mockResolvedValue([]),
  topHeadlines: jest.fn().mockResolvedValue([]),
  category: jest.fn().mockResolvedValue([]),
  health: jest.fn(),
});
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

describe('E1 OBS-G · notAdmittedProviderIds() is all-or-nothing', () => {
  it('every configured provider refused → the refused list', () => {
    expect(
      newsService([provider('gnews'), provider('gdelt-doc')]).notAdmittedProviderIds(),
    ).toEqual(['gnews', 'gdelt-doc']);
  });

  it('PARTIAL refusal (one lane admitted, two refused) → [] — never the refused subset', () => {
    __setProviderAdmissionTestFeeds([...FEED_SOURCES, CLEARED_FEED]);
    const service = newsService([provider('gnews'), provider('rss-feeds'), provider('gdelt-doc')]);
    expect(service.notAdmittedProviderIds()).toEqual([]);
  });

  it('PARTIAL refusal → the Map (cache-only) route invents no rights reason', () => {
    __setProviderAdmissionTestFeeds([...FEED_SOURCES, CLEARED_FEED]);
    const out = newsService([provider('gnews'), provider('rss-feeds')]).topHeadlinesCacheOnly(10, {
      lang: 'en',
    });
    expect((out as unknown as { acquisition?: unknown }).acquisition).toBeUndefined();
  });

  it('zero configured providers → [] — an empty provider list is not a rights refusal', () => {
    expect(newsService([]).notAdmittedProviderIds()).toEqual([]);
  });
});
