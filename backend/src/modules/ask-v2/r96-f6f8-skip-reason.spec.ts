import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { NewsService, readProviderFailures } from '../news/news.service';
import type { NewsProvider } from '../news/interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from '../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { GNewsProviderError } from '../news/providers/gnews.provider';
import { laneFailureReason } from '../analysis/service/analysis.service';
import { observedRetrievalOf, retrievalIncomplete, retrievalNotPermitted } from './retrieval-outcome';
import {
  noEvidenceReasonText,
  priorEvidenceGap,
  validateStoredArtifact,
} from './conversation/conversation-artifact';
import {
  earlierReportsUnverifiedRule,
  SOURCES_NOT_PERMITTED_RULE,
  SOURCES_UNAVAILABLE_RULE,
} from './job-execution';

/*
  R96 F6–F8 — skip-reason truthfulness: what the EA gate fixtures do not reach.
  E1 R96 checks 1 (the only producer), R-3 (incomplete stays TRUE), R-4 (every validator admits the
  new reason), R-8 (a genuine outage is never "not permitted") and W-1…W-6 for the follow-up wording.
  Offline: stub providers, no network, no model, no DB.
*/

/* W-1 / W-2: outage, transient and configuration words a refusal is never described with */
const OUTAGE_WORDS = /unavailable|rate-limited|could not be reached|temporar|try again|retry|not configured/i;

function throwing(id: string, error: unknown, calls: string[]): NewsProvider {
  const act = async () => {
    calls.push(id);
    throw error;
  };
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search', 'topHeadlines', 'category'],
    search: act,
    topHeadlines: act,
    category: act,
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' };
    },
  } as unknown as NewsProvider;
}

async function newsServiceOf(providers: NewsProvider[]): Promise<NewsService> {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: providers },
      { provide: ALL_NEWS_PROVIDERS, useValue: providers },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  return moduleRef.get(NewsService);
}

describe('R96 F6 · the only producer of the not-started kinds is the skip bookkeeping (E1 check 1)', () => {
  it.each(['rights-not-cleared', 'budget-cut'])(
    'a provider that RAN and threw kind "%s" is recorded as unavailable, never as a not-started lane',
    async (kind) => {
      const calls: string[] = [];
      const service = await newsServiceOf([throwing('gnews', Object.assign(new Error('x'), { kind }), calls)]);
      const response = await service.search('Kenya fuel prices', 10, { type: 'none' });
      expect(calls).toEqual(['gnews']);
      expect(readProviderFailures(response)).toEqual([{ providerId: 'gnews', kind: 'unavailable' }]);
    },
  );

  it('control: a provider that ran and was rate-limited keeps its real kind', async () => {
    const calls: string[] = [];
    const service = await newsServiceOf([throwing('gnews', Object.assign(new Error('x'), { kind: 'rate-limited' }), calls)]);
    const response = await service.search('Kenya fuel prices', 10, { type: 'none' });
    expect(readProviderFailures(response)).toEqual([{ providerId: 'gnews', kind: 'rate-limited' }]);
  });

  it.each(['rights-not-cleared', 'budget-cut'] as const)(
    'GNewsProviderError cannot carry "%s" as its upstream kind (shared taxonomy untouched)',
    (kind) => {
      const error = new GNewsProviderError('x', undefined, kind);
      expect(error.kind).toBe('unknown');
      expect(error.analysisKind).toBeUndefined();
    },
  );
});

describe('R96 F6 · the reader-visible lane reason', () => {
  it('a refused lane reads rights-not-cleared; a budget cut keeps the reader reason it had (unavailable)', () => {
    expect(laneFailureReason('rights-not-cleared')).toBe('rights-not-cleared');
    expect(laneFailureReason('budget-cut')).toBe('unavailable');
  });
  it('R-2: raw provider kinds are never passed through (malformed / unreachable / bad-request → unavailable)', () => {
    for (const kind of ['malformed', 'unreachable', 'bad-request', 'unknown']) expect(laneFailureReason(kind)).toBe('unavailable');
  });
});

const ctx = (retrievalContext: Record<string, unknown>) => ({ articles: [], retrievalContext });
const refused = (ids: string[]) => ids.map((providerId) => ({ providerId, kind: 'rights-not-cleared' }));

describe('R96 F7 · NOT_PERMITTED is chosen only for an all-refusal (E1 R-8, R-7)', () => {
  it('all refused, the provider list naming only refused lanes (G rows 5/6 shape) → NOT_PERMITTED, still incomplete', () => {
    const r = ctx({ providers: ['gnews', 'gdelt-doc'], outcome: 'PROVIDER_UNAVAILABLE', providerFailures: refused(['gnews', 'gdelt-doc']) });
    expect(observedRetrievalOf(r).retrievalOutcome).toBe('NOT_PERMITTED');
    expect(retrievalNotPermitted(r)).toBe(true);
    expect(retrievalIncomplete(r)).toBe(true);
  });
  it('the aggregate news-providers lane (an unattributed provider error) is never a refusal', () => {
    const r = ctx({
      providers: [],
      fallbackReason: 'provider-error',
      retrievalTrace: { lanesUnavailable: [{ lane: 'news-providers', reason: 'provider-error' }] },
    });
    expect(observedRetrievalOf(r).retrievalOutcome).toBe('PROVIDER_FAILED');
  });
  it('a refusal beside a budget cut, nothing answered → PROVIDER_FAILED (a real limit of this request is not masked)', () => {
    const r = ctx({
      providers: [],
      fallbackReason: 'provider-error',
      providerFailures: [...refused(['gnews']), { providerId: 'gdelt-doc', kind: 'budget-cut' }],
    });
    expect(observedRetrievalOf(r).retrievalOutcome).toBe('PROVIDER_FAILED');
  });
  it('a refused lane recorded only on the trace still counts as a refusal (stored traces carry no providerFailures)', () => {
    const r = ctx({
      providers: [],
      fallbackReason: 'provider-error',
      retrievalTrace: { lanesUnavailable: [{ lane: 'gnews', reason: 'rights-not-cleared' }] },
    });
    expect(observedRetrievalOf(r).retrievalOutcome).toBe('NOT_PERMITTED');
  });
  it('not attempted → no outcome at all (R79-F2 boundary unchanged)', () => {
    const r = ctx({ retrievalAttempted: false, providers: [], providerFailures: refused(['gnews']) });
    expect(observedRetrievalOf(r).retrievalOutcome).toBeNull();
    expect(retrievalNotPermitted(r)).toBe(false);
  });
});

describe('R96 F7 · the record and the follow-up wording (E1 R-3 alternative, R-4, W-1…W-6)', () => {
  const record = (noEvidenceReason: string) =>
    validateStoredArtifact({
      kind: 'SOURCED_REPORT',
      provenance: 'SOURCED_REPORTING',
      label: 'What is happening in Sudan this week?',
      components: ['Current reporting was not searched: no news source is cleared for use here.'],
      currentFindings: 'NONE',
      noEvidenceReason,
    });

  it('R-4: the stored-artifact validator keeps SOURCE_RIGHTS_NOT_CLEARED (never dropped to an unspecific record)', () => {
    expect(record('SOURCE_RIGHTS_NOT_CLEARED')?.noEvidenceReason).toBe('SOURCE_RIGHTS_NOT_CLEARED');
  });
  it('control: an unknown reason is still dropped', () => {
    expect(record('MADE_UP')?.noEvidenceReason).toBeUndefined();
  });
  it('R-3: a not-searched record is read back as INCOMPLETE, never as "completed, found nothing"', () => {
    expect(priorEvidenceGap(record('SOURCE_RIGHTS_NOT_CLEARED') ?? undefined)).toBe('UNAVAILABLE');
  });
  it('W-1/W-3: the follow-up wording says "not searched", never an outage, never "no reporting"', () => {
    const text = noEvidenceReasonText('UNAVAILABLE', false, true);
    const rule = earlierReportsUnverifiedRule('UNAVAILABLE', false, true);
    /* the rule's own statement of the fact (its later sentences name what NOT to say) */
    const ruleStatement = SOURCES_NOT_PERMITTED_RULE.split('. ')[0];
    for (const t of [text, rule, ruleStatement]) {
      expect(t).toMatch(/not searched/);
      expect(t).not.toMatch(OUTAGE_WORDS);
      expect(t).not.toMatch(/found no qualifying reporting/);
    }
    expect(SOURCES_NOT_PERMITTED_RULE).toMatch(/do not describe this as a technical failure, an outage or a temporary/);
  });
  it('R-8: the outage wording is unchanged for a genuine outage', () => {
    expect(earlierReportsUnverifiedRule('UNAVAILABLE')).toMatch(/unavailable or rate-limited/);
    expect(SOURCES_UNAVAILABLE_RULE).toMatch(/rate-limited, timed out or unavailable/);
  });
});

/* ═════════ EA BE-REVIEW 796aad6 · C-1 (E1 L-1): the cleared lane ADMITS reporting, the others are refused ═════════ */
describe('R96 C-1 · a partial answer never reads "complete": refused lanes are named even when reporting was admitted', () => {
  const FEED_ID = 'feed:r96-c1-test-cleared';
  const CLEARED = [{ sourceId: FEED_ID, rights: { state: 'CLEARED' } }];
  const feedArticle = (q: string) => ({
    id: 'feed-1', title: `${q} — Kenya fuel prices rise in Nairobi`, summary: 'Kenya fuel prices rose this week in Nairobi, the regulator said.',
    url: 'https://feed.example/kenya-fuel', sourceId: FEED_ID, sourceName: 'Example Feed', category: 'world', sourcesCount: 1,
    countryCode: 'KE', publishedAt: new Date().toISOString(), publishedAtBasis: 'publisher',
  });
  const answering = (id: string, calls: string[], articles: (q: string) => unknown[]): NewsProvider =>
    ({
      id, displayName: id, isMock: false, capabilities: ['search', 'topHeadlines', 'category'],
      search: async (q: string) => { calls.push(id); return articles(q); },
      topHeadlines: async () => { calls.push(id); return articles(''); },
      category: async () => { calls.push(id); return articles(''); },
      async health() { return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' }; },
    }) as unknown as NewsProvider;

  async function analysisOf(calls: string[], onlyFeed = false) {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require */
    const { CountryNewsService } = require('../news/country/country-news.service');
    const { AnalysisService } = require('../analysis/service/analysis.service');
    const { ANALYSIS_TOTAL_BUDGET_MS } = require('@globalnews-ai/shared');
    /* eslint-enable @typescript-eslint/no-var-requires, global-require */
    const gnews = answering('gnews', calls, () => []);
    const gdelt = answering('gdelt-doc', calls, () => []);
    const feeds = answering('rss-feeds', calls, (q) => [feedArticle(q)]);
    const all = onlyFeed ? [feeds] : [gnews, gdelt, feeds];
    const persistence = {
      persistMany: jest.fn().mockResolvedValue(new Map()), findRecent: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null), findRetainedByUrl: jest.fn().mockResolvedValue(null),
      findRecentByCountry: jest.fn().mockResolvedValue([]), persistCountryRelations: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsService, CountryNewsService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: NEWS_PROVIDERS, useValue: all }, { provide: ALL_NEWS_PROVIDERS, useValue: all },
        { provide: FALLBACK_NEWS_PROVIDERS, useValue: onlyFeed ? [feeds] : [gdelt, feeds] },
        { provide: ArticlePersistenceService, useValue: persistence },
      ],
    }).compile();
    const model = {
      id: 'openai', displayName: 'Fixture model', isMock: false,
      analyzeNews: async () => ({ headline: 'h', summary: 'x', keyFacts: [], keyPoints: [], sentiment: 'neutral', topics: [] }),
    };
    const config = {
      get: () => ({
        maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0,
        openAiApiKey: undefined, openAiModel: 'fixture', executionMode: 'development' as const, retryAttempts: 1, retryBaseDelayMs: 1, maxCompletionTokens: 2000,
      }),
    };
    return new AnalysisService(moduleRef.get(NewsService), moduleRef.get(CountryNewsService), model, config);
  }

  /* eslint-disable @typescript-eslint/no-var-requires, global-require */
  const enforcement = require('../news/rights/rights-enforcement') as {
    __setReaderRightsFixtureModeForTests: (on: boolean) => void;
    __setRightsTestFeeds: (f: unknown) => void;
  };
  const admission = require('../news/rights/provider-admission') as { __setProviderAdmissionTestFeeds: (f: unknown) => void };
  /* eslint-enable @typescript-eslint/no-var-requires, global-require */
  afterEach(() => {
    admission.__setProviderAdmissionTestFeeds(null);
    enforcement.__setRightsTestFeeds(null);
    enforcement.__setReaderRightsFixtureModeForTests(true);
  });

  it.each([
    ['country route (EA MIXED-article-country-kenya)', 'What fuel price changes were reported in Kenya this week?'],
    ['generic search', 'What is the latest on Kenya fuel prices?'],
  ])('%s → reporting admitted, outcome PARTIAL, incomplete, gnews + gdelt-doc named rights-not-cleared', async (_label, q) => {
    enforcement.__setReaderRightsFixtureModeForTests(false);
    admission.__setProviderAdmissionTestFeeds(CLEARED);
    enforcement.__setRightsTestFeeds(CLEARED);
    const calls: string[] = [];
    const r = await (await analysisOf(calls)).analyzeNews(q, 'en');
    const ctx = r.retrievalContext as {
      fallbackReason?: string;
      providerFailures?: { providerId: string; kind: string }[];
      retrievalTrace?: { lanesUnavailable?: { lane: string; reason: string }[] };
    };
    expect(calls).toEqual(['rss-feeds']);
    expect(r.articles.length).toBeGreaterThan(0);
    expect(observedRetrievalOf(r as never).retrievalOutcome).toBe('PARTIAL');
    expect(retrievalIncomplete(r as never)).toBe(true);
    const refusedLanes = (ctx.retrievalTrace?.lanesUnavailable ?? []).filter((l) => l.lane !== 'rss-feeds');
    expect(refusedLanes.map((l) => l.lane).sort()).toEqual(['gdelt-doc', 'gnews']);
    for (const l of refusedLanes) expect(l.reason).toBe('rights-not-cleared');
    expect((ctx.providerFailures ?? []).filter((f) => f.kind === 'rights-not-cleared').map((f) => f.providerId).sort()).toEqual([
      'gdelt-doc',
      'gnews',
    ]);
  });

  it('control: enforcement ON, the cleared feed is the only configured provider → nothing refused, no lane invented, MATCHED', async () => {
    enforcement.__setReaderRightsFixtureModeForTests(false);
    admission.__setProviderAdmissionTestFeeds(CLEARED);
    enforcement.__setRightsTestFeeds(CLEARED);
    const calls: string[] = [];
    const r = await (await analysisOf(calls, true)).analyzeNews('What fuel price changes were reported in Kenya this week?', 'en');
    const ctx = r.retrievalContext as { providerFailures?: { kind: string }[] };
    expect(calls).toEqual(['rss-feeds']);
    expect(r.articles.length).toBeGreaterThan(0);
    expect((ctx.providerFailures ?? []).some((f) => f.kind === 'rights-not-cleared')).toBe(false);
    expect(observedRetrievalOf(r as never).retrievalOutcome).toBe('MATCHED');
  });
});
