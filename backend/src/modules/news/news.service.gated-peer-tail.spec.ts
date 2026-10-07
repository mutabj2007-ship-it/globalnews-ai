import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';

import { NewsService } from './news.service';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import { ALL_NEWS_PROVIDERS, FALLBACK_NEWS_PROVIDERS, NEWS_PROVIDERS } from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { retrievalPeerTailAdmits, withGatedRetrievalDeadline, withRetrievalDeadline } from './retrieval-budget';
import { admitsReport, questionAnchorsOf } from '../analysis/query/question-anchors.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 A/B/C BLOCKER REPAIR R1 — a gated Ask analysis does not wait out a slow peer
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha 8ade90e, B (Rwanda corridor): GNews returned 0, the publisher feeds answered in 0.5 s
 * and 0.8 s, and each fallback tier then waited for GDELT — 6.6 s and 2.8 s of an 11 s retrieval
 * share — which never delivered. Generation was cancelled at the 28 s budget.
 *
 * The existing FALLBACK-PEER-TAIL grace (1.5 s after the first ADMISSIBLE result) applied only to
 * searches with a relevance mode or a requested source. Inside an Ask analysis with a gated
 * question, the question's own evidence gate is now that admission rule. Outside one, nothing changes.
 */

const LIVE_B =
  'As of 7 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security.';

function article(id: string, title: string, summary: string): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://example.test/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-10-06T09:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
  };
}

const corridorReport = article('f1', 'Dar es Salaam port clears transit backlog', 'Rwanda-bound cargo moves faster through the port of Dar es Salaam.');
const unrelated = article('f2', 'Kibeho pilgrims', 'Visitors in Rwanda gathered at the shrine.');

function stub(id: string, articles: NewsArticle[], delayMs: number, capabilities?: readonly NewsProviderCapability[]) {
  const run = async (): Promise<NewsArticle[]> => {
    await new Promise((r) => setTimeout(r, delayMs));
    return articles;
  };
  return {
    id,
    displayName: id,
    isMock: false,
    ...(capabilities === undefined ? {} : { capabilities }),
    search: run,
    topHeadlines: run,
    category: run,
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '2026-10-06T09:00:00.000Z' };
    },
  } as unknown as NewsProvider;
}

async function service(fallbacks: NewsProvider[]): Promise<NewsService> {
  const gnews = stub('gnews', [], 5);
  const active = [gnews, ...fallbacks];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: active },
      { provide: ALL_NEWS_PROVIDERS, useValue: active },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbacks },
      {
        provide: ArticlePersistenceService,
        useValue: {
          persistMany: jest.fn().mockResolvedValue(new Map()),
          findRecent: jest.fn().mockResolvedValue([]),
          findById: jest.fn().mockResolvedValue(null),
        },
      },
    ],
  }).compile();
  return moduleRef.get(NewsService);
}

const anchors = questionAnchorsOf(LIVE_B);
const gate = (a: { title: string; summary?: string | null }) => admitsReport(anchors, a).admitted;
const far = () => Date.now() + 20_000;

describe('gated Ask retrieval — the peer-tail grace uses the question’s evidence gate', () => {
  jest.setTimeout(20_000);

  it('the gate travels with the retrieval deadline', async () => {
    expect(await withGatedRetrievalDeadline(far(), gate, async () => retrievalPeerTailAdmits())).toBe(gate);
    expect(await withRetrievalDeadline(far(), async () => retrievalPeerTailAdmits())).toBeUndefined();
  });

  it('a fast feed with corridor evidence: a 9 s GDELT is not waited out (returns in about the grace)', async () => {
    const news = await service([stub('rss-feeds', [corridorReport], 20, ['search']), stub('gdelt-doc', [], 9_000, ['search'])]);
    const started = Date.now();
    const response = await withGatedRetrievalDeadline(far(), gate, () => news.search(LIVE_B, 20));
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(4_000);
    expect(response.articles.map((a) => a.id)).toContain('f1');
  });

  it('when the fast feed has nothing the gate admits, the slow peer is still awaited', async () => {
    const news = await service([stub('rss-feeds', [unrelated], 20, ['search']), stub('gdelt-doc', [], 2_500, ['search'])]);
    const started = Date.now();
    await withGatedRetrievalDeadline(far(), gate, () => news.search(LIVE_B, 20));
    expect(Date.now() - started).toBeGreaterThanOrEqual(2_300);
  });

  it('outside a gated analysis nothing changes: an ungated search still awaits every peer', async () => {
    const news = await service([stub('rss-feeds', [corridorReport], 20, ['search']), stub('gdelt-doc', [], 2_500, ['search'])]);
    const started = Date.now();
    await withRetrievalDeadline(far(), () => news.search(LIVE_B, 20));
    expect(Date.now() - started).toBeGreaterThanOrEqual(2_300);
  });
});
