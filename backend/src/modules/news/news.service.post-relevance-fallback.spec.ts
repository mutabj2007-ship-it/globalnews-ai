import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';
import { NewsService, readProviderFailures } from './news.service';
import type { NewsProvider, NewsProviderCapability } from './interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from './providers/provider.tokens';
import { ArticlePersistenceService } from './persistence/article-persistence.service';
import { GNewsProviderError } from './providers/gnews.provider';

/**
 * G-ALPHA-1 D1 — THE BOUNDED POST-RELEVANCE FALLBACK.
 *
 * R4 gave the news layer a fallback tier and triggered it on ZERO RAW ARTICLES,
 * counted inside callAllProviders before the relevance gate has run. That is
 * correct for a provider that answered with nothing, and wrong for the case
 * that actually empties these responses in the live Alpha: a primary that
 * returns ten articles which the gate then rejects looks, to the tier logic,
 * exactly like success — so the fallback is never asked and the reader is told
 * there is no reporting.
 *
 * The rescue added by D1 fires once, after relevance, and puts whatever it
 * retrieves through the SAME unmodified gate. These tests exist to prove both
 * halves of that: that it fires when it must, and — the harder guarantee —
 * that it stays silent everywhere else and never fans out.
 *
 * EVERYTHING HERE IS OFFLINE. Every provider is a stub; no network call is
 * made, no live provider is contacted, and no Railway state is read.
 */

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: `Story ${overrides.id}`,
    summary: 'Summary',
    url: `https://primary.example/${overrides.id}`,
    sourceId: 'primary',
    sourceName: 'Primary Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-26T09:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
    ...overrides,
  };
}

/** An article the 'generic' gate ACCEPTS for the phrase below. */
const RELEVANT_PHRASE = 'nato summit';
function relevantArticle(id: string, host = 'primary'): NewsArticle {
  return article({
    id,
    title: `The nato summit opens in Vilnius (${id})`,
    summary: 'Delegations arrived overnight.',
    url: `https://${host}.example/${id}`,
  });
}

/** An article the 'generic' gate REJECTS for that phrase — no whole-phrase match. */
function irrelevantArticle(id: string, host = 'primary'): NewsArticle {
  return article({
    id,
    title: `Unrelated harvest report (${id})`,
    summary: 'Rainfall was above average in the region.',
    url: `https://${host}.example/${id}`,
  });
}

interface StubOptions {
  readonly id: string;
  readonly articles?: NewsArticle[];
  readonly failWith?: Error;
  readonly capabilities?: readonly NewsProviderCapability[];
}

function stubProvider(options: StubOptions): NewsProvider & { calls: number } {
  const provider = {
    id: options.id,
    displayName: options.id,
    isMock: false,
    calls: 0,
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    async search(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async topHeadlines(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async category(): Promise<NewsArticle[]> {
      provider.calls += 1;
      if (options.failWith) throw options.failWith;
      return options.articles ?? [];
    },
    async health() {
      return {
        providerId: options.id,
        displayName: options.id,
        status: 'ok' as const,
        checkedAt: '2026-08-26T09:00:00.000Z',
      };
    },
  };

  return provider as NewsProvider & { calls: number };
}

async function buildService(
  primaries: NewsProvider[],
  fallbacks: NewsProvider[],
  storedArticles: NewsArticle[] = [],
): Promise<{
  service: NewsService;
  persistence: { persistMany: jest.Mock; findRecent: jest.Mock };
}> {
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

  return { service: moduleRef.get(NewsService), persistence };
}

describe('S-A — GNews yields ACCEPTED evidence: GDELT is never called', () => {
  it('does not consult the fallback when relevance accepts a primary article', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [relevantArticle('p1')] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
    expect(response.articles.map((a) => a.id)).toEqual(['p1']);
    expect(response.providers).toEqual(['gnews']);
  });

  it('holds when the primary returns a MIX — one accepted article is enough', async () => {
    const primary = stubProvider({
      id: 'gnews',
      articles: [irrelevantArticle('p1'), relevantArticle('p2'), irrelevantArticle('p3')],
    });
    const fallback = stubProvider({ id: 'gdelt-doc', capabilities: ['search'] });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(fallback.calls).toBe(0);
    expect(response.articles.map((a) => a.id)).toEqual(['p2']);
  });
});

describe('S-B — GNews returns ZERO RAW records: the pre-existing rescue still fires, exactly once', () => {
  it('consults the fallback once, and the post-relevance rescue does not double it', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(primary.calls).toBe(1);
    // THE CRITICAL COUNT. callAllProviders already spent the tier on the
    // zero-raw path, so the new rescue must recognise that and stay out.
    expect(fallback.calls).toBe(1);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
  });

  it('stays at one call even when the fallback ALSO returns nothing relevant', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [irrelevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(fallback.calls).toBe(1);
    expect(response.articles).toEqual([]);
  });
});

describe('S-C — GNews returns RAW records that relevance REJECTS: the new rescue', () => {
  it('THE DEFECT ITSELF — the fallback is consulted, once, and rescues the request', async () => {
    const primary = stubProvider({
      id: 'gnews',
      articles: [irrelevantArticle('p1'), irrelevantArticle('p2'), irrelevantArticle('p3')],
    });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(1);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
  });

  it('applies the SAME unmodified relevance gate to the rescued articles', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [irrelevantArticle('f1', 'fallback'), relevantArticle('f2', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    // The rescue is not a bypass: f1 is rejected by the same rule that rejected
    // p1. Only the genuinely relevant rescued article survives.
    expect(response.articles.map((a) => a.id)).toEqual(['f2']);
  });

  it('EVIDENCE FAILURE STAYS HONEST — a fallback with nothing relevant invents nothing', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [irrelevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(fallback.calls).toBe(1);
    expect(response.articles).toEqual([]);
    expect(response.totalResults).toBe(0);
  });

  it('NO FAN-OUT — the rescue never re-asks the primary', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(1);
  });

  it('ONE FALLBACK CALL EACH, even with two fallback providers registered', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const fallbackA = stubProvider({ id: 'gdelt-doc', capabilities: ['search'] });
    const fallbackB = stubProvider({
      id: 'other-fallback',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallbackA, fallbackB]);

    await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(fallbackA.calls).toBe(1);
    expect(fallbackB.calls).toBe(1);
  });
});

describe('S-D — provider REFUSALS: quota and rate limit', () => {
  it('a GNews 403 quota refusal is rescued, and the reason survives', async () => {
    const primary = stubProvider({
      id: 'gnews',
      failWith: new GNewsProviderError('allowance exhausted', undefined, 'quota'),
    });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(fallback.calls).toBe(1);
    expect(response.articles.map((a) => a.id)).toEqual(['f1']);
    // A rescue must not erase WHY the primary refused.
    expect(readProviderFailures(response)).toEqual([{ providerId: 'gnews', kind: 'quota' }]);
  });

  it('a GNews 429 rate-limit refusal is rescued, and keeps its own distinct kind', async () => {
    const primary = stubProvider({
      id: 'gnews',
      failWith: new GNewsProviderError('slow down', undefined, 'rate-limited'),
    });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(readProviderFailures(response)).toEqual([{ providerId: 'gnews', kind: 'rate-limited' }]);
  });

  it('quota AND a failing fallback: both reasons are kept, nothing is invented', async () => {
    const primary = stubProvider({
      id: 'gnews',
      failWith: new GNewsProviderError('allowance exhausted', undefined, 'quota'),
    });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      failWith: new Error('gdelt unreachable'),
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(response.articles).toEqual([]);
    expect(response.dataMode).toBe('unavailable');
    expect(
      readProviderFailures(response)
        .map((f) => f.providerId)
        .sort(),
    ).toEqual(['gdelt-doc', 'gnews']);
  });
});

describe('S-E — GDELT DISABLED: the live Alpha configuration, unchanged', () => {
  it('an empty fallback tier means no rescue is attempted and behaviour is as before', async () => {
    const primary = stubProvider({
      id: 'gnews',
      articles: [irrelevantArticle('p1'), irrelevantArticle('p2')],
    });

    // FALLBACK_NEWS_PROVIDERS is [] whenever GDELT_DOC_ENABLED is not "true" —
    // which is every deployment today, including the live Alpha.
    const { service } = await buildService([primary], []);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(primary.calls).toBe(1);
    expect(response.articles).toEqual([]);
    // A provider that ANSWERED, even with nothing the gate accepted, is not an
    // unreachable provider. This must stay 'live'.
    expect(response.dataMode).toBe('live');
  });

  it('a registered fallback that cannot serve this capability is never called', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    // Declares only 'top-headlines': it is not eligible for a search request, so
    // it is skipped rather than called — and a skipped provider is not a failed
    // provider.
    const fallback = stubProvider({ id: 'gdelt-doc', capabilities: ['top-headlines'] });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(fallback.calls).toBe(0);
    expect(response.providers).toEqual(['gnews']);
  });
});

describe('S-F — PROVENANCE survives every path', () => {
  it('a rescued response names the provider that actually rescued it', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [relevantArticle('f1', 'fallback')],
    });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    // Both providers answered this request, and the response says so.
    expect(response.providers).toContain('gnews');
    expect(response.providers).toContain('gdelt-doc');
    expect(response.articles[0].url).toContain('fallback.example');
  });
});

describe('S-G — the STORED database fallback stays reachable and truthful', () => {
  it('is used when live retrieval yields nothing relevant, and is labelled cached', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const fallback = stubProvider({
      id: 'gdelt-doc',
      capabilities: ['search'],
      articles: [irrelevantArticle('f1', 'fallback')],
    });

    const stored = [relevantArticle('s1', 'stored')];
    const { service, persistence } = await buildService([primary], [fallback], stored);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(fallback.calls).toBe(1);
    expect(persistence.findRecent).toHaveBeenCalled();
    expect(response.dataMode).toBe('cached');
    expect(response.articles.map((a) => a.id)).toEqual(['s1']);
  });

  it('applies the SAME relevance rule to stored articles — no laxer path to evidence', async () => {
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const stored = [irrelevantArticle('s1', 'stored')];

    const { service } = await buildService([primary], [], stored);

    const response = await service.search(RELEVANT_PHRASE, 10, { type: 'generic' });

    expect(response.articles).toEqual([]);
    expect(response.dataMode).not.toBe('cached');
  });
});

describe('S-H — callers that do NOT opt into relevance filtering are byte-for-byte unchanged', () => {
  it('the public search path (mode none) cannot trigger the post-relevance rescue', async () => {
    // With no relevance gate, raw articles ARE the result, so the rescue's
    // precondition (zero articles after filtering, tier not yet consulted) can
    // never be met. CountryNewsService and GET /news/search both call this way.
    const primary = stubProvider({ id: 'gnews', articles: [irrelevantArticle('p1')] });
    const fallback = stubProvider({ id: 'gdelt-doc', capabilities: ['search'] });

    const { service } = await buildService([primary], [fallback]);

    const response = await service.search(RELEVANT_PHRASE, 10);

    expect(fallback.calls).toBe(0);
    expect(response.articles.map((a) => a.id)).toEqual(['p1']);
  });
});
