import { UnprocessableEntityException } from '@nestjs/common';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import {
  canonicalUrlHostOf,
  heldPublisherHostOf,
  isPublisherRightsHeld,
  partitionPublisherRightsHeld,
  PUBLISHER_RIGHTS_HOLDS,
} from './publisher-rights-hold';
import {
  admittedStoredSourceWhere,
  partitionByRights,
  sourceUseDecision,
  storedRowAdmissible,
  storedRowExclusionReason,
  summarizeExclusions,
} from './source-use-policy';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { readerSafeNewsResponse } from '../news.controller';
import { CountryNewsService } from '../country/country-news.service';
import { StoryIdentityService } from '../../stories/story-identity.service';
import { computeArticleRef } from '../identity/article-ref.util';

/**
 * MASTER CTO R4 · P0 #86 — the Reuters-host publisher rights hold (E1-REUTERS-PER-USE-MATRIX-R2).
 * Offline: no provider, model, network or database. Synthetic URLs and text only — no publisher
 * headline or body is reproduced here.
 */

/* ── B · the host predicate ─────────────────────────────────────────────────────────────────── */
describe('#86 · host predicate — matches the article URL host only', () => {
  it('holds exactly one host, reuters.com, under ruling #86 and the E1 matrix', () => {
    expect(PUBLISHER_RIGHTS_HOLDS.map((h) => h.host)).toEqual(['reuters.com']);
    expect(PUBLISHER_RIGHTS_HOLDS[0]).toMatchObject({ reason: 'PUBLISHER_RIGHTS_HOLD', ruling: '#86', authority: 'E1-REUTERS-PER-USE-MATRIX-R2' });
    expect(Object.isFrozen(PUBLISHER_RIGHTS_HOLDS)).toBe(true);
  });

  it.each([
    ['https://reuters.com/world/africa/x-2026-10-09/'],
    ['https://www.reuters.com/world/africa/x-2026-10-09/'],
    ['http://www.reuters.com/markets/y'],
    ['https://jp.reuters.com/article/z'],
    ['https://WWW.Reuters.COM/world/x'],
    ['https://www.reuters.com./world/x'],
    ['https://www.reuters.com:443/world/x'],
    ['  https://www.reuters.com/world/x  '],
  ])('POSITIVE %s → reuters.com', (url) => {
    expect(heldPublisherHostOf(url)).toBe('reuters.com');
    expect(isPublisherRightsHeld({ url })).toBe(true);
  });

  it.each([
    ['lookalike suffix', 'https://reuters.com.example/world/x'],
    ['lookalike prefix', 'https://notreuters.com/world/x'],
    ['other TLD', 'https://reuters.co/world/x'],
    ['userinfo trick', 'https://reuters.com@other.example/world/x'],
    ['userinfo with www', 'https://www.reuters.com:pw@other.example/x'],
    ['host in path', 'https://other.example/www.reuters.com/world/x'],
    ['host in query', 'https://other.example/r?u=https://www.reuters.com/world/x'],
    ['host in fragment', 'https://other.example/x#www.reuters.com'],
    ['redirector on another host', 'https://news.google.com/rss/articles/abc?url=https%3A%2F%2Fwww.reuters.com%2Fx'],
    ['hyphenated lookalike', 'https://reuters-com.example/x'],
    ['not http(s)', 'ftp://www.reuters.com/x'],
    ['no scheme', 'www.reuters.com/world/x'],
    ['empty', ''],
    ['null', null],
  ])('NEGATIVE %s', (_label, url) => {
    expect(heldPublisherHostOf(url as string | null)).toBeUndefined();
    expect(isPublisherRightsHeld({ url: url as string | null })).toBe(false);
  });

  it.each([
    ['syndication: MarketScreener', 'https://www.marketscreener.com/news/x'],
    ['syndication: Straits Times', 'https://www.straitstimes.com/world/x'],
    ['syndication: Times Now', 'https://www.timesnownews.com/world/x'],
    ['syndication: NY Post', 'https://nypost.com/2026/10/10/x/'],
    ['other publisher: BBC', 'https://www.bbc.com/news/x'],
    ['other publisher: AP', 'https://apnews.com/article/x'],
  ])('BENIGN CONTROL %s is not held (a separate licence chain, decided by E1 per publisher)', (_label, url) => {
    expect(isPublisherRightsHeld({ url })).toBe(false);
  });

  it('never decides by publisher NAME or sourceId', () => {
    expect(isPublisherRightsHeld({ url: 'https://www.bbc.com/news/x', ...({ sourceName: 'Reuters', sourceId: 'reuters' } as object) })).toBe(false);
    expect(sourceUseDecision({ sourceId: 'reuters', url: 'https://www.bbc.com/news/x' }, 'AI_INPUT')).toMatchObject({ allowed: true });
  });

  it('canonical host is lowercased with trailing dots removed', () => {
    expect(canonicalUrlHostOf('https://WWW.Reuters.COM../x')).toBe('www.reuters.com');
  });
});

/* ── D · the source-use decision ────────────────────────────────────────────────────────────── */
describe('#86 · sourceUseDecision — the hold decides first, for both uses, in every mode', () => {
  const held = { sourceId: 'reuters', url: 'https://www.reuters.com/world/x' };
  it.each(['AI_INPUT', 'METADATA'] as const)('%s: PUBLISHER_RIGHTS_HOLD in record mode (PROVIDER_PENDING_REVIEW is not a licence)', (use) => {
    expect(sourceUseDecision(held, use)).toEqual({ allowed: false, reason: 'PUBLISHER_RIGHTS_HOLD' });
    expect(sourceUseDecision(held, use, { enforcement: 'record' })).toEqual({ allowed: false, reason: 'PUBLISHER_RIGHTS_HOLD' });
    expect(sourceUseDecision(held, use, { enforcement: 'enforce' })).toEqual({ allowed: false, reason: 'PUBLISHER_RIGHTS_HOLD' });
  });

  it('the global default is NOT flipped: an unheld stored provider row stays PROVIDER_PENDING_REVIEW in record mode', () => {
    expect(sourceUseDecision({ sourceId: 'bbc', url: 'https://www.bbc.com/news/x' }, 'AI_INPUT')).toEqual({
      allowed: true,
      basis: 'PROVIDER_PENDING_REVIEW',
      provider: 'stored-provider-unverified',
    });
    /* syndication copy of a wire story: unaffected by this hold (E1 B-4 UNRESOLVED, separate decision) */
    expect(sourceUseDecision({ sourceId: 'the-straits-times', url: 'https://www.straitstimes.com/world/x' }, 'AI_INPUT')).toMatchObject({ allowed: true });
  });

  it('a call without a URL behaves exactly as before (no hold)', () => {
    expect(sourceUseDecision({ sourceId: 'reuters' }, 'AI_INPUT')).toMatchObject({ allowed: true, basis: 'PROVIDER_PENDING_REVIEW' });
  });

  it('partitionByRights counts a held item as a rights exclusion with its own reason (never "not relevant")', () => {
    const items = [held, { sourceId: 'bbc', url: 'https://www.bbc.com/news/x' }];
    const { allowed, excluded } = partitionByRights(items, 'AI_INPUT');
    expect(allowed).toEqual([items[1]]);
    expect(summarizeExclusions(excluded)).toEqual({ count: 1, reasons: { PUBLISHER_RIGHTS_HOLD: 1 }, sourceIds: ['reuters'] });
  });

  it('stored-row admission: a held URL is not admissible; the same sourceId on another host is', () => {
    expect(storedRowExclusionReason('reuters', undefined, 'https://www.reuters.com/x')).toBe('PUBLISHER_RIGHTS_HOLD');
    expect(storedRowAdmissible('reuters', undefined, 'https://www.reuters.com/x')).toBe(false);
    expect(storedRowAdmissible('reuters', undefined, 'https://www.bbc.com/x')).toBe(true);
    expect(storedRowAdmissible('bbc')).toBe(true);
  });

  it('the stored-read query carries the hold clause (query half)', () => {
    expect(JSON.stringify(admittedStoredSourceWhere())).toContain('https://www.reuters.com/');
  });
});

/* ── C · persistence: no new admission, no rewrite, not obtainable ──────────────────────────── */
type Row = {
  id: string; title: string; summary: string; url: string; imageUrl: string | null; sourceId: string;
  sourceName: string; sourcesCount: number; category: string; publishedAt: Date; fetchedAt: Date;
  publishedAtBasis: string; countryCode: string | null; countryName: string | null; confidenceScore: number | null;
};
const NOW = Date.now();
const row = (id: string, sourceId: string, url: string): Row => ({
  id, title: `Synthetic ambush report ${id}`, summary: `Synthetic body ${id}`, url, imageUrl: 'https://img.example/x.jpg', sourceId,
  sourceName: id, sourcesCount: 1, category: 'world', publishedAt: new Date(NOW - 3_600_000), fetchedAt: new Date(NOW - 3_600_000),
  publishedAtBasis: 'publisher', countryCode: 'CD', countryName: 'DR Congo', confidenceScore: null,
});
const ROWS: Row[] = [
  row('gnews-held-www', 'reuters', 'https://www.reuters.com/world/africa/synthetic-1/'),
  row('gnews-held-sub', 'reuters-com', 'https://uk.reuters.com/article/synthetic-2'),
  row('gnews-bbc', 'bbc', 'https://www.bbc.com/news/synthetic-3'),
  row('gnews-st', 'the-straits-times', 'https://www.straitstimes.com/world/synthetic-4'),
];

function matches(r: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (where === undefined) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'AND') return (cond as Record<string, unknown>[]).every((w) => matches(r, w));
    if (key === 'OR') return (cond as Record<string, unknown>[]).some((w) => matches(r, w));
    if (key === 'NOT') return !matches(r, cond as Record<string, unknown>);
    const v = r[key];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      const c = cond as Record<string, unknown>;
      if ('gte' in c) return (v as Date) >= (c.gte as Date);
      if ('in' in c) return (c.in as unknown[]).includes(v);
      if ('startsWith' in c) return String(v).toLowerCase().startsWith(String(c.startsWith).toLowerCase());
      if ('contains' in c) return String(v).toLowerCase().includes(String(c.contains).toLowerCase());
      return true;
    }
    return v === cond;
  });
}

function store() {
  const upsert = jest.fn((q: { where: { url: string } }) => ({ url: q.where.url, fetchedAt: new Date(NOW) }));
  const article = {
    upsert,
    findMany: jest.fn(async (q: { where?: Record<string, unknown>; take?: number }) =>
      ROWS.filter((r) => matches(r as never, q.where)).slice(0, q.take ?? 100)),
    findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
      const hit = ROWS.find((r) => matches(r as never, q.where));
      return hit === undefined ? null : { ...hit, countries: [] };
    }),
  };
  const articleCountry = {
    findMany: jest.fn(async (q: { where?: { article?: Record<string, unknown> }; take?: number }) =>
      ROWS.filter((r) => matches(r as never, q.where?.article)).slice(0, q.take ?? 100).map((r) => ({
        id: `ac-${r.id}`, countryCode: 'COD', countryName: 'DR Congo', relevanceScore: 80, isRelevant: true, articleId: r.id, article: r,
      }))),
  };
  const $transaction = jest.fn(async (ops: unknown[]) => ops);
  const svc = new ArticlePersistenceService({ article, articleCountry, $transaction } as never);
  return { svc, upsert, $transaction, article };
}

const live = (id: string, url: string): NewsArticle => ({
  id, title: `Synthetic ${id}`, summary: 'Synthetic.', url, sourceId: 'synthetic', sourceName: 'Synthetic', category: 'world',
  sourcesCount: 1, publishedAt: new Date(NOW).toISOString(), publishedAtBasis: 'publisher',
});

describe('#86 · persistence — new admission paused, stored rows retained as-is and not obtainable', () => {
  it('persistMany never inserts or updates a held-host article; the others are written as before', async () => {
    const { svc, upsert } = store();
    await svc.persistMany([
      live('gnews-new-held', 'https://www.reuters.com/world/new/'),
      live('gnews-existing-held', 'https://www.reuters.com/world/africa/synthetic-1/'),
      live('gnews-bbc-new', 'https://www.bbc.com/news/new'),
    ]);
    const written = upsert.mock.calls.map(([q]) => (q as { where: { url: string } }).where.url);
    expect(written).toEqual(['https://www.bbc.com/news/new']);
  });

  it('a batch of only held-host articles starts no transaction at all', async () => {
    const { svc, $transaction, upsert } = store();
    const seen = await svc.persistMany([live('a', 'https://www.reuters.com/x'), live('b', 'https://uk.reuters.com/y')]);
    expect(seen.size).toBe(0);
    expect($transaction).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('retained reads never return a held-host row (query half + exact predicate on subdomains)', async () => {
    const { svc } = store();
    const ids = new Set<string>();
    for (const a of await svc.findRecent({ limit: 50, maxAgeMinutes: 1440 })) ids.add(a.id);
    for (const a of await svc.findRecent({ limit: 50, maxAgeMinutes: 1440, query: 'Synthetic ambush', queryTerms: ['Synthetic', 'ambush'] })) ids.add(a.id);
    for (const a of await svc.findRecentByCountry({ countryCode: 'COD', limit: 50, maxAgeMinutes: 1440 })) ids.add(a.id);
    expect([...ids].sort()).toEqual(['gnews-bbc', 'gnews-st']);
  });

  it('a held-host row is not obtainable by id or by URL; benign rows are', async () => {
    const { svc } = store();
    expect(await svc.findById('gnews-held-www')).toBeNull();
    expect(await svc.findById('gnews-held-sub')).toBeNull();
    expect(await svc.findRetainedByUrl('https://www.reuters.com/world/africa/synthetic-1/')).toBeNull();
    expect(await svc.findRetainedByUrl('https://uk.reuters.com/article/synthetic-2')).toBeNull();
    expect((await svc.findById('gnews-bbc'))?.id).toBe('gnews-bbc');
    expect((await svc.findRetainedByUrl('https://www.straitstimes.com/world/synthetic-4'))?.article.id).toBe('gnews-st');
  });
});

/* ── C · reader surfaces ─────────────────────────────────────────────────────────────────────── */
describe('#86 · reader surfaces never carry a held-host item', () => {
  const resp = (articles: NewsArticle[]): NewsResponse => ({
    articles, totalResults: articles.length, providers: ['gnews'], dataMode: 'live', generatedAt: new Date(NOW).toISOString(),
  });

  it('/news routes: held items are removed and totalResults follows; an unaffected response is returned as-is', () => {
    const mixed = resp([live('h', 'https://www.reuters.com/x'), live('b', 'https://www.bbc.com/y')]);
    const out = readerSafeNewsResponse(mixed);
    expect(out.articles.map((a) => a.id)).toEqual(['b']);
    expect(out.totalResults).toBe(1);
    const clean = resp([live('b', 'https://www.bbc.com/y')]);
    expect(readerSafeNewsResponse(clean)).toBe(clean);
  });

  it('/news reader edge never throws on a response without an article list (returned as-is)', () => {
    const odd = {} as NewsResponse;
    expect(readerSafeNewsResponse(odd)).toBe(odd);
  });

  it('country feed: a held item is never shown, scored or related to the country', async () => {
    const persistence = {
      persistCountryRelations: jest.fn(async () => undefined),
      findRecentByCountry: jest.fn(async () => []),
      findRecent: jest.fn(async () => []),
    };
    const kenya = (id: string, url: string): NewsArticle => ({ ...live(id, url), title: `Kenya parliament passes budget ${id}`, summary: 'Nairobi, Kenya.' });
    const search = jest.fn(async () => resp([kenya('held-1', 'https://www.reuters.com/world/africa/k/'), kenya('ok-1', 'https://www.bbc.com/news/k')]));
    const config = { get: (_k: string, d?: unknown) => d } as never;
    const svc = new CountryNewsService({ search } as never, config, persistence as never);
    const out = await svc.getCountryNews('KEN');
    expect(out.articles.map((a) => a.id)).toEqual(['ok-1']);
    const related = (persistence.persistCountryRelations.mock.calls as unknown as Array<[Array<{ articleId: string }>]>).flatMap(([rels]) => rels.map((r) => r.articleId));
    expect(related).not.toContain('held-1');
    expect(related).toContain('ok-1');
    /* no extra provider call */
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('story ensure refuses a held-host URL (422 PUBLISHER_RIGHTS_HOLD) before any read; a benign URL proceeds', async () => {
    const prisma = {
      article: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
      storyArticle: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
    };
    const svc = new StoryIdentityService(prisma as never);
    const url = 'https://www.reuters.com/world/africa/synthetic-1/';
    await expect(svc.ensureStoryForArticle({ articleRef: computeArticleRef(url), url })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.article.findFirst).not.toHaveBeenCalled();
    const benign = 'https://www.bbc.com/news/synthetic-3';
    await expect(svc.ensureStoryForArticle({ articleRef: computeArticleRef(benign), url: benign })).rejects.not.toBeInstanceOf(UnprocessableEntityException);
  });

  it('partition keeps order and separates held items', () => {
    const items = [{ url: 'https://www.bbc.com/1' }, { url: 'https://www.reuters.com/2' }, { url: 'https://apnews.com/3' }];
    expect(partitionPublisherRightsHeld(items)).toEqual({ kept: [items[0], items[2]], held: [items[1]] });
  });
});

/* ── C · Home rows and /stories/search (direct Prisma readers) ──────────────────────────────── */
describe('#86 · Home editorial reads (direct Prisma) never list a held-host row', () => {
  const h = (hours: number) => new Date(NOW - hours * 3_600_000);
  const art = (id: string, url: string, title: string) => ({
    id, url, title, summary: 'Kenya refinery plan faces a legal challenge.', imageUrl: null, sourceId: 'gnews', sourceName: `P-${id}`,
    category: 'business', publishedAt: h(10), publishedAtBasis: 'publisher', fetchedAt: h(10), countryName: null,
    countries: [{ countryCode: 'KEN', relevanceScore: 80, isRelevant: true }],
  });
  const rows = [
    art('held-sub', 'https://uk.reuters.com/business/k', 'Kenya refinery investment faces court challenge in Nairobi'),
    art('held-www', 'https://www.reuters.com/business/k2', 'Kenya refinery investment faces court challenge from investors'),
    art('ok', 'https://www.bbc.com/news/k', 'Kenya refinery investment faces court challenge'),
  ];
  const ev = (where: Record<string, unknown> | undefined, r: Record<string, unknown>): boolean => matches(r, where);
  const prisma = {
    article: { findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => rows.filter((r) => ev(q.where, r as never))) },
    storyArticle: { findMany: async () => [] },
    story: { findMany: async () => [] },
    storyComment: { findMany: async () => [] },
  };

  it('/stories/search (both scopes) never lists a held-host row; the benign report is listed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HomeEditorialService } = require('../../home-editorial/home-editorial.service');
    const svc = new HomeEditorialService(prisma);
    for (const scope of ['HOME_ELIGIBLE', 'ALL_RETAINED'] as const) {
      const r = await svc.search({ q: 'refinery', scope, region: null, domain: null, days: null, now: new Date(NOW) });
      const urls = JSON.stringify(r.results);
      expect(urls).not.toContain('reuters.com');
      expect(r.matched).toBe(1);
    }
  });
});

/* ── C · Home rows load, story observe / rung-3 / backfill, alert subjects ──────────────────── */
describe('#86 · remaining direct readers', () => {
  const heldRow = {
    id: 'gnews-held', url: 'https://uk.reuters.com/world/synthetic', title: 'Synthetic held', summary: 'S.', imageUrl: null,
    sourceId: 'reuters', sourceName: 'Synthetic', category: 'world', publishedAt: new Date(NOW - 3_600_000),
    publishedAtBasis: 'publisher', fetchedAt: new Date(NOW - 3_600_000), countryName: null,
    countries: [{ countryCode: 'KEN', relevanceScore: 80, isRelevant: true }],
  };
  const okRow = { ...heldRow, id: 'gnews-ok', url: 'https://www.bbc.com/news/synthetic', title: 'Synthetic ok' };

  it('Home rows load: a held-host row never becomes a Home row (subdomain caught by the exact predicate)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HomeEditorialService } = require('../../home-editorial/home-editorial.service');
    const prisma = {
      article: { findMany: jest.fn(async () => [heldRow, okRow]) },
      storyArticle: { findMany: async () => [] },
      story: { findMany: async () => [] },
      storyComment: { findMany: async () => [] },
    };
    const svc = new HomeEditorialService(prisma);
    const loaded = await (svc as unknown as { load: (now: Date) => Promise<{ rows: Array<{ id: string }> }> }).load(new Date(NOW));
    expect(loaded.rows.map((r) => r.id)).toEqual(['gnews-ok']);
  });

  it('story observe never places a held-host row; backfill skips it; rung-3 never offers it as a join candidate', async () => {
    const prisma = {
      storyAlert: { count: jest.fn(async () => 1) },
      article: { findMany: jest.fn(async () => [heldRow, okRow]) },
    };
    const svc = new StoryIdentityService(prisma as never);
    const place = jest.spyOn(svc as unknown as { placeArticle: () => Promise<string> }, 'placeArticle').mockResolvedValue('CREATED');
    await svc.observeRetainedForAlerts([live('a', heldRow.url), live('b', okRow.url)]);
    expect(place.mock.calls.map((c) => (c as unknown as [string, { url: string }])[1].url)).toEqual([okRow.url]);

    place.mockClear();
    prisma.storyAlert.count.mockResolvedValue(0);
    const report = await svc.backfill({ limit: 10 });
    expect(place.mock.calls.map((c) => (c as unknown as [string, { url: string }])[1].url)).toEqual([okRow.url]);
    expect(report).toMatchObject({ processed: 2, created: 1 });

    const rung3 = await (svc as unknown as { rung3Candidates: (r: object) => Promise<Array<{ url: string }>> }).rung3Candidates({
      url: 'https://www.bbc.com/other', title: 'Synthetic held', publishedAt: new Date(NOW),
    });
    expect(rung3.map((r) => r.url)).toEqual([okRow.url]);
  });

  it('alert subject / joined evidence never show a held-host headline', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AlertsService } = require('../../stories/alerts.service');
    const byUrl = (url: string) => (url === heldRow.url ? heldRow : url === okRow.url ? okRow : null);
    const prisma = {
      storyArticle: {
        findMany: jest.fn(async () => [
          { articleRef: 'r-held', articleUrl: heldRow.url, addedAt: new Date(1) },
          { articleRef: 'r-ok', articleUrl: okRow.url, addedAt: new Date(2) },
        ]),
        findFirst: jest.fn(async () => ({ articleUrl: heldRow.url })),
      },
      article: { findFirst: jest.fn(async (q: { where: { url: string } }) => byUrl(q.where.url)) },
      storyIdentityEvent: { findFirst: jest.fn(async () => ({ articleRefs: ['r-held'] })) },
    };
    const svc = new AlertsService(prisma, {} as never);
    const subject = await (svc as unknown as { subjectOf: (id: string) => Promise<{ url: string } | null> }).subjectOf('story-1');
    expect(subject?.url).toBe(okRow.url);
    const joined = await (svc as unknown as { joinedEvidenceOf: (s: string, c: string, v: number) => Promise<unknown> }).joinedEvidenceOf('s', 'c', 2);
    expect(joined).toBeNull();
    /* control: a benign joined report is shown */
    prisma.storyArticle.findFirst.mockResolvedValue({ articleUrl: okRow.url });
    const joinedOk = (await (svc as unknown as { joinedEvidenceOf: (s: string, c: string, v: number) => Promise<{ url: string } | null> }).joinedEvidenceOf('s', 'c', 2));
    expect(joinedOk?.url).toBe(okRow.url);
  });
});
