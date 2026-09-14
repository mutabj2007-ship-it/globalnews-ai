import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';

import { NewsService } from './news.service';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { resolveRequestedSource } from './identity/requested-source.util';

/**
 * FALLBACK-PEER-TAIL-LATENCY-1 R1 — THE REAL NewsService, NO STUBBED search().
 *
 * THE DEFECT. `callProviderSet()` awaited `Promise.allSettled`, so the fallback
 * tier was as slow as its slowest peer. Live Alpha: Publisher Feeds answered in
 * ~140 ms, GDELT DOC held the fan-out, the request took 13.331 s.
 *
 * THE CORRECTION UNDER TEST. Once the set already holds an article the
 * REQUEST'S OWN admission rules accept, a peer still pending after
 * PEER_TAIL_GRACE_MS is left to finish on its own.
 *
 * The two rules that make this safe rather than merely fast are both asserted
 * below, because both were CTO corrections to my first proposal:
 *   · raw articles NEVER start the grace — only admissible ones do;
 *   · the returned aggregation is SEALED, and a detached peer that later
 *     succeeds or fails cannot touch it.
 *
 * Offline throughout: no network, no live provider, no Railway state.
 */

const GRACE_MS = 1500;
const TOPIC = 'demand for labour in Quarter 2 2026';
const GUS = resolveRequestedSource('Statistics Poland')!;

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: `Story ${overrides.id}`,
    summary: 'Summary',
    url: `https://example.test/${overrides.id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-09-05T09:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
    ...overrides,
  };
}

/**
 * Passes the generic gate for TOPIC.
 *
 * The whole phrase lives in the SUMMARY, so a caller can vary the TITLE freely.
 * That matters: cross-provider dedup compares TITLES, so two peers carrying the
 * same headline are collapsed to one story — correct behaviour, and it hid what
 * two of the scope tests below are actually asserting until the titles were
 * made genuinely distinct.
 */
const relevant = (id: string, extra: Partial<NewsArticle> = {}) =>
  article({
    id,
    title: `Labour market report ${id}`,
    summary: 'Figures on the demand for labour in Quarter 2 2026, including vacancies.',
    ...extra,
  });

/** Raw, non-empty, and REJECTED by the generic gate for TOPIC. */
const irrelevant = (id: string, extra: Partial<NewsArticle> = {}) =>
  article({
    id,
    title: 'Unrelated harvest report',
    summary: 'Rainfall was above average in the region.',
    ...extra,
  });

/** Statistics Poland's own record: curated sourceId and the publisher's host. */
const gusRecord = (id: string) =>
  relevant(id, {
    url: `https://stat.gov.pl/en/topics/labour-market/${id},1,45.html`,
    sourceId: 'feed:gus-pl',
    sourceName: 'Statistics Poland',
  });

interface StubOptions {
  readonly id: string;
  readonly articles?: NewsArticle[];
  readonly delayMs?: number;
  readonly failAfterMs?: number;
  readonly capabilities?: readonly NewsProviderCapability[];
}

function stubProvider(options: StubOptions) {
  const state = { calls: 0, settledAt: undefined as number | undefined };

  const run = async (): Promise<NewsArticle[]> => {
    state.calls += 1;

    if (options.failAfterMs !== undefined) {
      await new Promise((r) => setTimeout(r, options.failAfterMs));
      state.settledAt = Date.now();
      throw new Error(`${options.id} failed`);
    }

    if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
    state.settledAt = Date.now();

    return options.articles ?? [];
  };

  const provider = {
    id: options.id,
    displayName: options.id,
    isMock: false,
    state,
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    search: run,
    topHeadlines: run,
    category: run,
    async health() {
      return {
        providerId: options.id,
        displayName: options.id,
        status: 'ok' as const,
        checkedAt: '2026-09-05T09:00:00.000Z',
      };
    },
  };

  return provider as unknown as NewsProvider & { state: typeof state };
}

async function buildService(
  primaries: NewsProvider[],
  fallbacks: NewsProvider[],
  storedArticles: NewsArticle[] = [],
): Promise<NewsService> {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue(storedArticles),
    findById: jest.fn().mockResolvedValue(null),
  };

  const active = [...primaries, ...fallbacks];

  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: active },
      { provide: ALL_NEWS_PROVIDERS, useValue: active },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbacks },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();

  return moduleRef.get(NewsService);
}

const searchCapable = (id: string, o: Omit<StubOptions, 'id' | 'capabilities'>) =>
  stubProvider({ id, capabilities: ['search'], ...o });

/* ------------------------------------------------------------------ */

describe('R1 · P1 — the reported scenario: a fast admissible peer is not held hostage', () => {
  it('returns in about the grace, not in the slow peer’s time', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', { articles: [relevant('f1')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 9000 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const startedAt = Date.now();
    const response = await service.search(TOPIC, 10, { type: 'generic' });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(GRACE_MS + 900);
    expect(elapsed).toBeGreaterThanOrEqual(GRACE_MS);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
  }, 20000);
});

describe('R1 · P2 — CTO CORRECTION 1: raw articles must NOT start the grace', () => {
  it('a fast peer whose articles fail relevance does not trigger the cutoff', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    // Raw, non-empty, and destined to be discarded by the gate.
    const feeds = searchCapable('rss-feeds', { articles: [irrelevant('f1'), irrelevant('f2')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 3000 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const startedAt = Date.now();
    const response = await service.search(TOPIC, 10, { type: 'generic' });
    const elapsed = Date.now() - startedAt;

    /* THE DECISIVE ASSERTION: the request WAITED for the slow peer… */
    expect(elapsed).toBeGreaterThanOrEqual(3000);
    /* …and the evidence returned is the slow peer's, which a raw-article
       cutoff would have thrown away. */
    expect(response.articles.map((a) => a.id)).toEqual(['g1']);
    expect(gdelt.state.settledAt).toBeDefined();
  }, 20000);

  it('the requested-source equivalent: a wrong-publisher raw result does not trigger it', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    /* Topically relevant — it passes the gate — but the WRONG publisher, so the
       source constraint will discard it. Under a raw-article rule this would
       have cut the tail and lost Statistics Poland entirely. */
    const feeds = searchCapable('rss-feeds', {
      articles: [relevant('f1', { sourceId: 'feed:wp-pl', url: 'https://wiadomosci.wp.pl/x' })],
      delayMs: 20,
    });
    const gdelt = searchCapable('gdelt-doc', { articles: [gusRecord('g1')], delayMs: 3000 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const startedAt = Date.now();
    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(3000);
    expect(response.articles.map((a) => a.id)).toEqual(['g1']);
    expect(response.articles[0].sourceId).toBe('feed:gus-pl');
  }, 20000);

  it('and an ADMISSIBLE requested-source result DOES start it', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', { articles: [gusRecord('f1')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { articles: [gusRecord('g1')], delayMs: 9000 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const startedAt = Date.now();
    const response = await service.search(TOPIC, 10, { type: 'generic' }, { requestedSource: GUS });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(GRACE_MS + 900);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
  }, 20000);
});

describe('R1 · P3 — CTO CORRECTION 3: the returned aggregation is a SEALED SNAPSHOT', () => {
  it('a detached peer that LATER SUCCEEDS cannot mutate what was returned', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', { articles: [relevant('f1')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 2600 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const response = await service.search(TOPIC, 10, { type: 'generic' });

    const snapshot = JSON.stringify({
      ids: response.articles.map((a) => a.id),
      total: response.totalResults,
      providers: response.providers,
      dataMode: response.dataMode,
    });

    /* Outlive the detached peer's own completion. */
    await new Promise((r) => setTimeout(r, 2000));
    expect(gdelt.state.settledAt).toBeDefined();

    const after = JSON.stringify({
      ids: response.articles.map((a) => a.id),
      total: response.totalResults,
      providers: response.providers,
      dataMode: response.dataMode,
    });

    expect(after).toBe(snapshot);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
    expect(response.providers).not.toContain('gdelt-doc');
  }, 20000);

  it('a detached peer that LATER REJECTS cannot mutate it either, and does not go unhandled', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      const gnews = stubProvider({ id: 'gnews', articles: [] });
      const feeds = searchCapable('rss-feeds', { articles: [relevant('f1')], delayMs: 20 });
      const gdelt = searchCapable('gdelt-doc', { failAfterMs: 2600 });

      const service = await buildService([gnews], [feeds, gdelt]);

      const response = await service.search(TOPIC, 10, { type: 'generic' });

      const snapshot = JSON.stringify({
        ids: response.articles.map((a) => a.id),
        total: response.totalResults,
        providers: response.providers,
        fallbackReason: response.fallbackReason ?? null,
      });

      await new Promise((r) => setTimeout(r, 2000));

      const after = JSON.stringify({
        ids: response.articles.map((a) => a.id),
        total: response.totalResults,
        providers: response.providers,
        fallbackReason: response.fallbackReason ?? null,
      });

      expect(after).toBe(snapshot);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  }, 20000);
});

describe('R1 · P4 — CTO CORRECTION 4: the scope is bounded', () => {
  it('a single-provider fallback tier is always awaited in full', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 2400 });

    const service = await buildService([gnews], [gdelt]);

    const startedAt = Date.now();
    const response = await service.search(TOPIC, 10, { type: 'generic' });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(2400);
    expect(response.articles.map((a) => a.id)).toEqual(['g1']);
  }, 20000);

  it('the PRIMARY fan-out is never raced, however slow a primary peer is', async () => {
    /* Genuinely unlike headlines. Cross-provider dedup compares TITLES with a
       0.72 token-overlap threshold, so "…report p1" and "…report p2" collapse
       to one story — correct behaviour that masked this assertion twice. */
    const fast = stubProvider({
      id: 'gnews',
      articles: [relevant('p1', { title: 'Vacancy rate climbs across industry' })],
      delayMs: 20,
    });
    const slow = stubProvider({
      id: 'gnews-2',
      articles: [relevant('p2', { title: 'Regional employment briefing published today' })],
      delayMs: 2400,
    });

    const service = await buildService([fast, slow], []);

    const startedAt = Date.now();
    const response = await service.search(TOPIC, 10, { type: 'generic' });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(2400);
    expect(response.articles.map((a) => a.id).sort()).toEqual(['p1', 'p2']);
  }, 20000);

  it('topHeadlines is untouched — both peers are awaited', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = stubProvider({ id: 'rss-feeds', articles: [relevant('f1')], delayMs: 20 });
    const gdelt = stubProvider({ id: 'gdelt-doc', articles: [relevant('g1')], delayMs: 2400 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const startedAt = Date.now();
    await service.topHeadlines(10);
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(2400);
    expect(gdelt.state.settledAt).toBeDefined();
  }, 20000);

  it('the un-gated public search path still waits for every peer', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', {
      articles: [relevant('f1', { title: 'Vacancy rate climbs across industry' })],
      delayMs: 20,
    });
    const gdelt = searchCapable('gdelt-doc', {
      articles: [relevant('g1', { title: 'Regional employment briefing published today' })],
      delayMs: 2400,
    });

    const service = await buildService([gnews], [feeds, gdelt]);

    const startedAt = Date.now();
    // No relevance mode: this is the public GET /news/search path, which
    // supplies no admission rule of its own. It is NOT raced.
    const response = await service.search(TOPIC, 10);
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(2400);
    expect(response.articles.map((a) => a.id).sort()).toEqual(['f1', 'g1']);
  }, 20000);
});

describe('R1 · P5 — failure accounting stays truthful', () => {
  it('a genuine failure is still a failure, and nothing is mislabelled', async () => {
    /* Every provider REJECTS. A provider that resolves with zero articles
       counts as successful — that is pre-existing behaviour and the reason an
       earlier draft of this test expected the wrong dataMode. */
    const gnews = stubProvider({ id: 'gnews', failAfterMs: 10 });
    const feeds = searchCapable('rss-feeds', { failAfterMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { failAfterMs: 40 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const response = await service.search(TOPIC, 10, { type: 'generic' });

    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('unavailable');
    /* All really failed, so the public fallbackReason must say so. */
    expect(response.fallbackReason).toBe('provider-error');
  }, 20000);

  it('a NOT-AWAITED peer never becomes a provider-error in the public response', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', { articles: [relevant('f1')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { failAfterMs: 9000 });

    const service = await buildService([gnews], [feeds, gdelt]);

    const response = await service.search(TOPIC, 10, { type: 'generic' });

    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
    expect(response.dataMode).toBe('live');
    expect(response.fallbackReason).toBeUndefined();
  }, 20000);
});
