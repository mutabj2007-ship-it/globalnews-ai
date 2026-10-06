import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';

import { NewsService, readProviderFailures } from './news.service';
import {
  GENERATION_RESERVE_MS,
  TIER_SHARE,
  retrievalBudgetMs,
  withRetrievalDeadline,
} from './retrieval-budget';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { resolveRequestedSource } from './identity/requested-source.util';

/**
 * ASK R2 LIVE-GATE REPAIR — harness copied from news.service.peer-tail-latency.spec.ts.
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

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   ASK R2 LIVE-GATE REPAIR (P0-3) — DETERMINISTIC TIMING OF ONE BOUNDED RETRIEVAL SCHEDULE.
   Live Alpha 2026-10-06 10:42Z: GDELT held the fallback tier 12.1 s, supplements followed, and
   the 28 s analysis budget expired before generation finished (MODEL_FAILURE). Here every fan-out
   runs under a SMALL retrieval budget (2,000 ms ⇒ one tier may wait at most 1,200 ms) so the
   proofs are fast; production derives the same shape from the overall budget (28 s ⇒ 15 s
   retrieval, 13 s reserved for generation). Real NewsService, stub providers, real timers.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
const BUDGET_MS = 2000;
const TIER_CAP_MS = Math.round(BUDGET_MS * TIER_SHARE);
const underBudget = <T>(work: () => Promise<T>) =>
  withRetrievalDeadline(Date.now() + BUDGET_MS, work, BUDGET_MS);
const failing = (id: string, kind: string, delayMs = 10) =>
  ({
    ...stubProvider({ id, capabilities: ['search'] }),
    search: async () => {
      await new Promise((r) => setTimeout(r, delayMs));
      const e = new Error(`${id} ${kind}`) as Error & { kind: string };
      e.kind = kind;
      throw e;
    },
  }) as unknown as NewsProvider;

describe('ASK R2 · P0-3 — the overall budget leaves time for generation', () => {
  it('28 s overall ⇒ 15 s retrieval, 13 s reserved for the model; a tier may hold at most 60 %', () => {
    expect(GENERATION_RESERVE_MS).toBe(13_000);
    expect(retrievalBudgetMs(28_000)).toBe(15_000);
    expect(Math.round(retrievalBudgetMs(28_000) * TIER_SHARE)).toBe(9_000);
    /* a tiny overall budget still gives retrieval a floor */
    expect(retrievalBudgetMs(5_000)).toBe(4_000);
  });
});

describe('ASK R2 · P0-3 — slow GDELT cannot hold the turn', () => {
  it('GNews 0 + feeds irrelevant + GDELT 5 s: the tier stops at the tier cap; GDELT is named "timeout", not "checked"', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', { articles: [irrelevant('f1')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 5000 });
    const service = await buildService([gnews], [feeds, gdelt]);
    const startedAt = Date.now();
    const response = await underBudget(() => service.search(TOPIC, 10, { type: 'generic' }));
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(TIER_CAP_MS - 50);
    expect(elapsed).toBeLessThan(TIER_CAP_MS + 700);
    expect(response.providers).not.toContain('gdelt-doc');
    expect(readProviderFailures(response)).toEqual(
      expect.arrayContaining([{ providerId: 'gdelt-doc', kind: 'timeout' }]),
    );
  }, 20000);
});

describe('ASK R2 · P0-3 — one healthy local source answers fast', () => {
  it('feeds admissible in 20 ms, GDELT slow: evidence returns within the grace, well inside the budget', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', { articles: [relevant('f1')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 5000 });
    const service = await buildService([gnews], [feeds, gdelt]);
    const startedAt = Date.now();
    const response = await underBudget(() => service.search(TOPIC, 10, { type: 'generic' }));
    expect(Date.now() - startedAt).toBeLessThan(TIER_CAP_MS + 700);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
  }, 20000);
});

describe('ASK R2 · P0-3 — every provider degraded', () => {
  it('GNews rate-limited, feeds failing, GDELT slow: bounded, empty, and every lane named with its own reason', async () => {
    const gnews = failing('gnews', 'rate-limited');
    const feeds = failing('rss-feeds', 'unreachable', 30);
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 5000 });
    const service = await buildService([gnews], [feeds, gdelt]);
    const startedAt = Date.now();
    const response = await underBudget(() => service.search(TOPIC, 10, { type: 'generic' }));
    expect(Date.now() - startedAt).toBeLessThan(BUDGET_MS + 700);
    expect(response.articles).toHaveLength(0);
    const kinds = Object.fromEntries(readProviderFailures(response).map((f) => [f.providerId, f.kind]));
    expect(kinds['gdelt-doc']).toBe('timeout');
    expect(kinds['gnews']).toBeDefined();
  }, 20000);
});

describe('ASK R2 · P0-3 — budget spent ⇒ providers are not even started (no quota, no retry)', () => {
  it('a search issued after the retrieval deadline makes NO provider call and says so', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [relevant('n1')] });
    const service = await buildService([gnews], []);
    const response = await withRetrievalDeadline(Date.now() + 100, async () => {
      await new Promise((r) => setTimeout(r, 200));
      return service.search(TOPIC, 10, { type: 'generic' });
    }, 100);
    expect(gnews.state.calls).toBe(0);
    expect(response.articles).toHaveLength(0);
    expect(readProviderFailures(response)).toEqual([{ providerId: 'gnews', kind: 'unavailable' }]);
  }, 20000);
});

describe('ASK R2 · P0-3 — outside an analysis nothing changes', () => {
  it('no retrieval deadline: the tier waits for its slow peer exactly as before', async () => {
    const gnews = stubProvider({ id: 'gnews', articles: [] });
    const feeds = searchCapable('rss-feeds', { articles: [irrelevant('f1')], delayMs: 20 });
    const gdelt = searchCapable('gdelt-doc', { articles: [relevant('g1')], delayMs: 1500 });
    const service = await buildService([gnews], [feeds, gdelt]);
    const response = await service.search(TOPIC, 10, { type: 'generic' });
    expect(response.articles.map((a) => a.id)).toEqual(['g1']);
  }, 20000);
});

describe('ASK R2 · P0-3 — never hammer GNews after a 429', () => {
  it('a 429 opens the local cooldown: the next search in the same turn makes no request', async () => {
    const { GNewsProvider } = await import('./providers/gnews.provider');
    const { ConfigService } = await import('@nestjs/config');
    const provider = new GNewsProvider(new ConfigService({ GNEWS_API_KEY: 'test-key-not-real' }) as never);
    const fetchMock = jest.fn(async () => new Response('{}', { status: 429 }));
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await expect(provider.search('Kenya small business')).rejects.toMatchObject({ kind: 'rate-limited' });
      await expect(provider.search('Rwanda Dar es Salaam')).rejects.toMatchObject({ kind: 'rate-limited' });
    } finally {
      global.fetch = original;
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
