import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { SourceRole } from '@globalnews-ai/shared';
import { EvidenceDiscoveryService } from '../../news/evidence/evidence-discovery.service';
import { articleFromCandidate, candidateFromArticle } from '../../news/evidence/evidence-candidate';
import { classifySocialAccount } from '../../news/social/social-account-registry';
import {
  XRecentSearchProvider,
  YouTubeSearchProvider,
} from '../../news/social/social-search.providers';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { COMPOUND_PLAN_PACING } from '../query/compound-retrieval-plan.util';
import { deriveEventFrame } from '../query/event-frame.util';
import { assessClaims } from '../validation/claim-graph.util';
import { FEED_SOURCES, resolveActiveFeedSources } from '../../news/providers/feed-source-registry';

/*
  MASTER CTO P0 RIGHTS CONTAINMENT R1 / E1-TAA-1 — the feed registry is REAL by default here (no live
  row is CLEARED today, so a real registry activates nothing and every RSS row is withheld from AI
  input). Where a test is about fan-out MECHANICS, it switches on a SYNTHETIC registry for that test
  only: the real rows, with every state below CLEARED marked CLEARED (RESTRICTED / PROHIBITED keep their
  real states) — the pattern of rss-feed.provider.spec.ts, made switchable per test.
*/
let mockSyntheticClearedRegistry = false;
jest.mock('../../news/providers/feed-source-registry', () => {
  const actual = jest.requireActual('../../news/providers/feed-source-registry');
  const synthetic = actual.FEED_SOURCES.map((row: { rights: { state: string } }) =>
    row.rights.state === 'RESTRICTED' || row.rights.state === 'PROHIBITED'
      ? row
      : { ...row, rights: { ...row.rights, state: 'CLEARED' } },
  );
  return {
    ...actual,
    get FEED_SOURCES() {
      return mockSyntheticClearedRegistry ? synthetic : actual.FEED_SOURCES;
    },
  };
});
afterEach(() => {
  mockSyntheticClearedRegistry = false;
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA RETRIEVAL REPAIR R1 — BETA-ASK-002 / 003 on the real services.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production op 5944db16 (request 444058c7): the eastern-DRC question reached GNews as one
 * ~35-term AND phrase, returned nothing, and was answered "0 matching reports". Fixtures are
 * [RECONSTRUCTED] headlines of the kind the wires and Radio Okapi / Actualite.cd publish; no
 * live provider or model is called.
 */

function a(
  id: string,
  title: string,
  summary: string,
  extra: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://${id}.example/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Outlet ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher' as const,
    sourceLanguage: 'en',
    ...extra,
  };
}

/* One wire story, syndicated under two outlets. */

/* Plan pacing is exercised by its own test; everything else runs without real waiting. */
beforeAll(() => {
  COMPOUND_PLAN_PACING.spacingMs = 0;
});

type Call = { providerId: string; q: string; lang?: string };

function stub(
  id: string,
  byLang: (lang: string | undefined) => NewsArticle[],
  calls: Call[],
  failWith?: Error,
): NewsProvider {
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search'],
    async search(q: string, options?: { lang?: string }) {
      calls.push({ providerId: id, q, ...(options?.lang ? { lang: options.lang } : {}) });
      if (failWith) throw failWith;
      return byLang(options?.lang);
    },
    async topHeadlines() {
      return [];
    },
    async category() {
      return [];
    },
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' };
    },
  } as unknown as NewsProvider;
}

async function services(
  primary: NewsProvider[],
  fallback: NewsProvider[] = [],
  summary?: string,
  discovery?: EvidenceDiscoveryService,
) {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const all = [...primary, ...fallback];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: all },
      { provide: ALL_NEWS_PROVIDERS, useValue: all },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallback },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  const model: AnalysisProvider = {
    id: 'openai',
    displayName: 'Fixture model',
    isMock: false,
    analyzeNews: async (input: AnalysisProviderInput) => {
      inputs.push(input);
      const out = (await mock.analyzeNews(input)) as Record<string, unknown>;
      return summary === undefined ? out : { ...out, summary };
    },
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'fixture',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    moduleRef.get(NewsService),
    moduleRef.get(CountryNewsService),
    model,
    config,
    discovery,
  );
  return { service, inputs };
}

/* ════════════════════════════════════════════════════════════════════════════
   ASK TRUTHFUL RETRIEVAL R2A — BETA-ASK-006 and the negative-assertion guard.
   [RECONSTRUCTED] headline shapes; no live provider or model is called.
   ════════════════════════════════════════════════════════════════════════════ */

const FLYDUBAI_Q =
  'tell me in details what happened today in the Air from Dubai to Israel in a passenger plane. How did it happen?, Indicate if there were some casualties in that incidence';

const fresh = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
/* The irrelevant Israel-country corpus Production answered from. */
const GAZA_COLLAPSE = a(
  'gaza-collapse',
  'Apartment building collapses in Gaza City, several dead',
  'Rescuers in Gaza searched the rubble; Israel said it was reviewing the incident.',
);
/* The event itself, as the wires and the airline would report it. */
const FLIGHT_WIRE = a(
  'flight-wire',
  'Flydubai flight from Dubai to Tel Aviv makes emergency landing',
  'Flydubai flight FZ1073 declared an emergency after an engine problem; the airline said no injuries were reported among the passengers.',
  { publishedAt: fresh(3) },
);
const FLIGHT_LOCAL = a(
  'flight-local',
  'Passenger jet from Dubai lands safely at Ben Gurion airport after mid-air scare',
  'The Israel Airports Authority said the aircraft landed safely in Tel Aviv.',
  { publishedAt: fresh(2) },
);

/* ════════════════════════════════════════════════════════════════════════════
   ASK MULTI-SOURCE DISCOVERY R2B — candidates, roles, families, social lanes (OFF by default)
   ════════════════════════════════════════════════════════════════════════════ */

type Fetched = { url: string; headers?: Record<string, string> };
const fakeFetch =
  (
    status: number,
    body: unknown,
    seen: Fetched[],
  ): ((
    url: string,
    init?: { headers?: Record<string, string> },
  ) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>) =>
  async (url, init) => {
    seen.push({ url, ...(init?.headers ? { headers: init.headers } : {}) });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
const configOf = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const X_BODY = {
  data: [
    {
      id: '1840000000000000001',
      text: 'Our flight FZ1073 from Dubai to Tel Aviv landed safely after a technical issue. All passengers are safe.',
      author_id: '100',
      created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      lang: 'en',
    },
    {
      id: '1840000000000000002',
      text: 'Just saw a plane from Dubai circling over Tel Aviv, smoke from the engine?!',
      author_id: '200',
      created_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      lang: 'en',
    },
    {
      id: '1840000000000000003',
      text: 'Flydubai jet makes emergency landing in Tel Aviv https://t.co/x',
      author_id: '300',
      created_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      lang: 'en',
      referenced_tweets: [{ type: 'quoted', id: '1839999999999999999' }],
      entities: { urls: [{ expanded_url: 'https://www.reuters.com/world/flydubai-landing' }] },
    },
  ],
  includes: {
    users: [
      { id: '100', username: 'flydubai', name: 'flydubai', verified_type: 'business' },
      { id: '200', username: 'someone', name: 'Someone' },
      { id: '300', username: 'aggregator', name: 'Aggregator' },
    ],
  },
};

describe('R2B · social lanes fail closed and stay OFF until configured', () => {
  it('no switch or no credential → configured() false, NO network call, not-configured', async () => {
    const seen: Fetched[] = [];
    for (const values of [
      {},
      { ASK_SOCIAL_X_ENABLED: 'true' },
      { X_API_BEARER_TOKEN: 'secret' },
      { ASK_SOCIAL_X_ENABLED: 'yes', X_API_BEARER_TOKEN: 'secret' },
    ]) {
      const x = new XRecentSearchProvider(configOf(values), fakeFetch(200, X_BODY, seen));
      expect(x.configured()).toBe(false);
      await expect(x.search('Dubai Israel flight')).rejects.toMatchObject({
        kind: 'not-configured',
      });
    }
    const yt = new YouTubeSearchProvider(
      configOf({ YOUTUBE_API_KEY: 'k' }),
      fakeFetch(200, {}, seen),
    );
    expect(yt.configured()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('X configured: official API, window, retained fields only, credential never in a candidate', async () => {
    const seen: Fetched[] = [];
    const x = new XRecentSearchProvider(
      configOf({ ASK_SOCIAL_X_ENABLED: 'true', X_API_BEARER_TOKEN: 'secret-token' }),
      fakeFetch(200, X_BODY, seen),
    );
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const candidates = await x.search('Dubai Israel flight', {
      from,
      to: new Date().toISOString(),
    });
    const url = new URL(seen[0]!.url);
    expect(url.origin + url.pathname).toBe('https://api.x.com/2/tweets/search/recent');
    expect(url.searchParams.get('query')).toBe('Dubai Israel flight -is:retweet');
    expect(url.searchParams.get('start_time')).toBe(from);
    expect(seen[0]!.headers?.Authorization).toBe('Bearer secret-token');
    expect(JSON.stringify(candidates)).not.toContain('secret-token');
    expect(candidates.map((c) => [c.sourceRole, c.timestampBasis, c.sourceFamily])).toEqual([
      /* platform-verified organisation */
      ['OFFICIAL_SOCIAL', 'PLATFORM', 'x:100'],
      /* an ordinary original post is a witness claim */
      ['WITNESS_SOCIAL', 'PLATFORM', 'x:200'],
      /* a quote that shares Reuters is a lead, in the Reuters family */
      ['DISCOVERY_LEAD', 'PLATFORM', 'reuters.com'],
    ]);
    expect(candidates[0]!.provenance).toMatchObject({ lane: 'x', postId: '1840000000000000001' });
  });

  it.each([
    [401, 'auth'],
    [429, 'rate-limited'],
    [503, 'unavailable'],
  ])('X HTTP %s → %s (a failed lane, never "nothing happened")', async (status, kind) => {
    const x = new XRecentSearchProvider(
      configOf({ ASK_SOCIAL_X_ENABLED: 'true', X_API_BEARER_TOKEN: 't' }),
      fakeFetch(status, {}, []),
    );
    await expect(x.search('q')).rejects.toMatchObject({ kind });
  });

  it('YouTube configured: Data API search, channel/video ids, publication time', async () => {
    const seen: Fetched[] = [];
    const yt = new YouTubeSearchProvider(
      configOf({ ASK_SOCIAL_YOUTUBE_ENABLED: 'true', YOUTUBE_API_KEY: 'yt-key' }),
      fakeFetch(
        200,
        {
          items: [
            {
              id: { videoId: 'abc123' },
              snippet: {
                publishedAt: '2026-10-01T08:00:00Z',
                channelId: 'UC1',
                channelTitle: 'Plane Spotter',
                title: 'Flydubai emergency landing Tel Aviv',
                description: 'Video of the landing',
              },
            },
          ],
        },
        seen,
      ),
    );
    const [video] = await yt.search('Dubai Israel flight');
    const url = new URL(seen[0]!.url);
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/youtube/v3/search');
    expect(url.searchParams.get('type')).toBe('video');
    expect(video).toMatchObject({
      id: 'yt:abc123',
      url: 'https://www.youtube.com/watch?v=abc123',
      channel: 'VIDEO',
      sourceRole: 'WITNESS_SOCIAL',
      sourceFamily: 'youtube:UC1',
      publishedAt: '2026-10-01T08:00:00Z',
      timestampBasis: 'PLATFORM',
    });
    expect(JSON.stringify(video)).not.toContain('yt-key');
  });

  it('a governed registry entry puts an organisation account in its web family', () => {
    const registry = [
      {
        platform: 'x' as const,
        accountId: '100',
        handle: 'flydubai',
        role: 'OFFICIAL_SOCIAL' as const,
        family: 'flydubai.com',
        provenanceNote: 'test',
        verifiedAt: '2026-10-01',
      },
    ];
    expect(
      classifySocialAccount(
        { platform: 'x', accountId: '100', platformVerification: null, isRepost: false },
        registry,
      ),
    ).toEqual({ role: 'OFFICIAL_SOCIAL', family: 'flydubai.com' });
  });
});

describe('R2B · one candidate contract for every lane', () => {
  it('news articles normalise with a role from verified identity, never a display name', () => {
    expect(candidateFromArticle(FLIGHT_WIRE, 'gnews').sourceRole).toBe('INTERNATIONAL_REPORTING');
    const reuters = a('r', 'x', 'y', { url: 'https://www.reuters.com/world/x' });
    expect(candidateFromArticle(reuters, 'gnews')).toMatchObject({
      sourceRole: 'WIRE_REPORTING',
      sourceFamily: 'reuters.com',
      timestampBasis: 'PUBLISHER',
    });
    const official = a('cbk', 'x', 'y', {
      sourceId: 'feed:cbk-ke',
      url: 'https://www.centralbank.go.ke/s',
    });
    expect(candidateFromArticle(official, 'rss-feeds').sourceRole).toBe('OFFICIAL_WEB');
    const fakeName = {
      ...official,
      sourceName: 'Central Bank of Kenya',
      url: 'https://elsewhere.example/s',
    };
    expect(candidateFromArticle(fakeName, 'gnews').sourceRole).toBe('INTERNATIONAL_REPORTING');
    const observed = a('g', 'x', 'y', { publishedAtBasis: 'observed' });
    expect(candidateFromArticle(observed, 'gdelt-doc')).toMatchObject({
      sourceRole: 'AGGREGATOR',
      timestampBasis: 'OBSERVED',
      publishedAt: null,
    });
  });
});

describe('R2B · claim states with social evidence (acceptance E, F, G)', () => {
  const event = deriveEventFrame(FLYDUBAI_Q, 'en')!;
  const ctx = (incomplete = false) => ({
    event: {
      eventType: event.eventType,
      endpoints: event.endpoints,
      identifiers: event.identifiers,
      notBefore: event.notBefore,
    },
    coverageIncomplete: incomplete,
  });
  const social = (id: string, role: SourceRole, family: string, text: string) =>
    articleFromCandidate({
      id,
      url: `https://x.com/u/status/${id}`,
      channel: 'SOCIAL',
      sourceRole: role,
      sourceId: `social:x:${family}`,
      sourceName: '@u (X)',
      title: text,
      text,
      language: 'en',
      publishedAt: fresh(1),
      observedAt: null,
      timestampBasis: 'PLATFORM',
      sourceFamily: family,
      provenance: { lane: 'x' },
    });
  const occurrence = [
    { id: 'occurrence', type: 'OCCURRENCE', text: 'An aviation incident occurred' },
  ];

  it('E · one anonymous post is never CONFIRMED (REPORTED at most); a lead alone is NOT_VERIFIED', () => {
    const witness = social('w1', 'WITNESS_SOCIAL', 'x:200', 'Plane from Dubai circling Tel Aviv');
    expect(assessClaims(occurrence, [witness], ctx())[0]!.state).toBe('REPORTED');
    const witnesses = [
      witness,
      social('w2', 'WITNESS_SOCIAL', 'x:201', 'Plane from Dubai circling Tel Aviv too'),
    ];
    /* two eyewitness posts are not "corroborated reporting" */
    expect(assessClaims(occurrence, witnesses, ctx())[0]!.state).toBe('REPORTED');
    const lead = social('l1', 'DISCOVERY_LEAD', 'x:post:9', 'RT plane emergency');
    expect(assessClaims(occurrence, [lead], ctx())[0]!.state).toBe('NOT_VERIFIED');
  });

  it('a repost of Reuters and Reuters itself are ONE family', () => {
    const reuters = a('reuters', 'Flydubai jet lands in Tel Aviv', 'Reuters report.', {
      url: 'https://www.reuters.com/world/flydubai-landing',
    });
    const share = social('s1', 'SOCIAL_REPORT', 'reuters.com', 'Flydubai jet lands in Tel Aviv');
    const [occ] = assessClaims(occurrence, [reuters, share], ctx());
    expect(occ!.independentFamilies).toBe(1);
    expect(occ!.state).toBe('REPORTED');
  });

  it("an organisation's site and its own X account are ONE family", () => {
    const site = a('site', 'Statement on flight FZ1073', 'flydubai statement.', {
      url: 'https://www.flydubai.com/en/media-centre/statement',
    });
    const post = social('p1', 'OFFICIAL_SOCIAL', 'flydubai.com', 'Statement on flight FZ1073');
    expect(assessClaims(occurrence, [site, post], ctx())[0]!.independentFamilies).toBe(1);
  });

  it('F · official statement + independent reporting reaches CONFIRMED', () => {
    const official = social(
      'o1',
      'OFFICIAL_SOCIAL',
      'flydubai.com',
      'Our flight FZ1073 landed safely in Tel Aviv',
    );
    expect(assessClaims(occurrence, [official, FLIGHT_LOCAL], ctx())[0]!.state).toBe('CONFIRMED');
    /* official + only a witness is not CONFIRMED */
    const witness = social('w3', 'WITNESS_SOCIAL', 'x:202', 'Plane landed in Tel Aviv');
    expect(assessClaims(occurrence, [official, witness], ctx())[0]!.state).toBe('REPORTED');
  });

  it('G · provider outage with nothing found is COVERAGE_INCOMPLETE, never a denial', () => {
    expect(assessClaims(occurrence, [], ctx(true))[0]!.state).toBe('COVERAGE_INCOMPLETE');
  });
});

describe('R2B · discovery lanes in the Ask (Flydubai, social configured)', () => {
  it('X joins the event retrieval in parallel; admitted by the SAME event gate; trace names every lane', async () => {
    const xSeen: Fetched[] = [];
    const x = new XRecentSearchProvider(
      configOf({ ASK_SOCIAL_X_ENABLED: 'true', X_API_BEARER_TOKEN: 't' }),
      fakeFetch(200, X_BODY, xSeen),
    );
    const youtube = new YouTubeSearchProvider(configOf({}), fakeFetch(200, {}, []));
    const discovery = new EvidenceDiscoveryService([x, youtube]);
    const gnews = stub('gnews', () => [GAZA_COLLAPSE, FLIGHT_LOCAL], []);
    const { service, inputs } = await services([gnews], [], undefined, discovery);

    const result = await service.analyzeNews(FLYDUBAI_Q, 'en');

    expect(xSeen).toHaveLength(1);
    const ids = result.articles.map((x0) => x0.id);
    /*
      RULED (MASTER CTO P0 RIGHTS CONTAINMENT R1, SOCIAL_RIGHTS_NOT_REVIEWED): social discovery items
      have no recorded platform-rights review, so they are withheld at the chokepoint — never evidence,
      never model input. Before: the official X post ('x:1840000000000000001') was admitted as evidence.
    */
    expect(ids).toEqual(['flight-local']);
    expect(ids).not.toContain('gaza-collapse');
    expect(ids.some((id) => id.startsWith('x:'))).toBe(false);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].articles.map((x0) => x0.id)).toEqual(['flight-local']);
    /*
      The SAME event gate still ran first: the two on-event posts (official @flydubai, author 100, and
      the anonymous eyewitness, author 200) reached the rights chokepoint and were withheld there, with
      their reason; the repost/quote (author 300) is a lead, dropped before rights — never evidence.
    */
    expect(result.retrievalContext?.rightsExcluded).toEqual({
      count: 2,
      reasons: { SOCIAL_RIGHTS_NOT_REVIEWED: 2 },
      sourceIds: ['social:x:100', 'social:x:200'],
    });
    const trace = result.retrievalContext!.retrievalTrace!;
    expect(trace.lanesSucceeded).toEqual(expect.arrayContaining(['gnews', 'x']));
    expect(trace.lanesUnavailable).toEqual(
      expect.arrayContaining([{ lane: 'youtube', reason: 'not-configured' }]),
    );
    /* An unconfigured lane is shown, but does not by itself make coverage "incomplete". */
    expect(result.retrievalContext?.verificationNotice).toBeUndefined();
    /*
      RULED: with the airline's own post withheld, the occurrence rests on one independent news family
      — REPORTED, with no official family (before: CONFIRMED, officialFamily true). The claim-graph
      mechanic "official statement + independent reporting reaches CONFIRMED" is still pinned directly
      by 'F · official statement + independent reporting reaches CONFIRMED' above.
    */
    const occ = result.retrievalContext!.claimAssessments!.find((c) => c.id === 'occurrence')!;
    expect(occ.state).toBe('REPORTED');
    expect(occ.officialFamily).toBe(false);
  });

  it('social lanes OFF (default): the Ask behaves exactly as R2A, the lanes are listed not-configured', async () => {
    const discovery = new EvidenceDiscoveryService([
      new XRecentSearchProvider(configOf({}), fakeFetch(200, X_BODY, [])),
      new YouTubeSearchProvider(configOf({}), fakeFetch(200, {}, [])),
    ]);
    const gnews = stub('gnews', () => [FLIGHT_LOCAL], []);
    const { service } = await services([gnews], [], undefined, discovery);
    const result = await service.analyzeNews(FLYDUBAI_Q, 'en');
    expect(result.articles.map((x0) => x0.id)).toEqual(['flight-local']);
    expect(result.retrievalContext!.retrievalTrace!.lanesUnavailable).toEqual([
      { lane: 'x', reason: 'not-configured' },
      { lane: 'youtube', reason: 'not-configured' },
    ]);
  });
});

describe('R2B · governed local fan-out (active publisher feeds)', () => {
  const RW_Q =
    'What are the most recent security changes in Rwanda, and what effects on civilians or displacement are currently reported by local and international media?';
  const WIRE_RW = a(
    'wire-rw',
    'Rwanda army deployed after border clashes',
    'Clashes near the border displaced families in Rwanda, officials said.',
  );
  const LOCAL_RW = a(
    'local-rw',
    'Rwanda: displaced families return after clashes near Rubavu',
    'Local reporting on the clashes and displaced civilians in Rwanda.',
    {
      sourceId: 'feed:ktpress-rw',
      url: 'https://www.ktpress.rw/2026/10/displaced',
    },
  );

  it('RULED (E1-TAA-1): an UNCLEARED feed named in RSS_FEED_SOURCES is refused — never asked, never evidence', async () => {
    /* real registry: KT Press is recorded UNRESOLVED, so naming it activates nothing */
    const selection = resolveActiveFeedSources(FEED_SOURCES, 'feed:ktpress-rw');
    expect(selection.sources).toEqual([]);
    expect(selection.refused).toEqual([
      expect.objectContaining({ sourceId: 'feed:ktpress-rw', reason: 'RIGHTS_NOT_CLEARED', rightsState: 'UNRESOLVED' }),
    ]);
    const calls: string[] = [];
    const gnews = {
      ...stub('gnews', () => [], []),
      async search() {
        calls.push('gnews');
        return [WIRE_RW];
      },
    } as unknown as NewsProvider;
    const feeds = {
      ...stub('rss-feeds', () => [], []),
      async search() {
        calls.push('rss-feeds');
        return [LOCAL_RW];
      },
    } as unknown as NewsProvider;
    const discovery = new EvidenceDiscoveryService(
      [],
      configOf({ RSS_FEED_SOURCES: 'feed:ktpress-rw' }),
    );
    expect(discovery.hasGovernedLocalFeeds(['RW'])).toBe(false);
    const { service } = await services([gnews], [feeds], undefined, discovery);
    const result = await service.analyzeNews(RW_Q, 'en');
    expect(calls).not.toContain('rss-feeds');
    expect(result.articles.map((x) => x.id)).toEqual(['wire-rw']);
  });

  it('an ACTIVE feed for the asked country is asked alongside the primary on the first search', async () => {
    /* MECHANICS under the synthetic CLEARED registry (the real-state ruling is pinned by the test above) */
    mockSyntheticClearedRegistry = true;
    const calls: string[] = [];
    const gnews = {
      ...stub('gnews', () => [], []),
      async search() {
        calls.push('gnews');
        return [WIRE_RW];
      },
    } as unknown as NewsProvider;
    const feeds = {
      ...stub('rss-feeds', () => [], []),
      async search() {
        calls.push('rss-feeds');
        return [LOCAL_RW];
      },
    } as unknown as NewsProvider;
    const discovery = new EvidenceDiscoveryService(
      [],
      configOf({ RSS_FEED_SOURCES: 'feed:ktpress-rw' }),
    );
    const { service } = await services([gnews], [feeds], undefined, discovery);
    const result = await service.analyzeNews(RW_Q, 'en');
    expect(calls.slice(0, 2).sort()).toEqual(['gnews', 'rss-feeds']);
    expect(result.articles.map((x) => x.id)).toEqual(
      expect.arrayContaining(['wire-rw', 'local-rw']),
    );
  });

  it('no active feed for the country → the feed lane is NOT promoted (unchanged tiering)', async () => {
    const calls: string[] = [];
    const gnews = {
      ...stub('gnews', () => [], []),
      async search() {
        calls.push('gnews');
        return [WIRE_RW];
      },
    } as unknown as NewsProvider;
    const feeds = {
      ...stub('rss-feeds', () => [], []),
      async search() {
        calls.push('rss-feeds');
        return [LOCAL_RW];
      },
    } as unknown as NewsProvider;
    const discovery = new EvidenceDiscoveryService([], configOf({}));
    const { service } = await services([gnews], [feeds], undefined, discovery);
    await service.analyzeNews(RW_Q, 'en');
    expect(calls).not.toContain('rss-feeds');
  });
});
