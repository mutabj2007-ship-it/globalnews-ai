import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { findCountryByIso3, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import {
  GEO_IDENTITY_QUARANTINE,
  isGeoQuarantined,
  isGeoQuarantinedRef,
  partitionGeoQuarantined,
  withoutDisputedGeography,
} from './geo-identity-quarantine';
import { computeArticleRef } from '../identity/article-ref.util';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { NewsService } from '../news.service';
import { CountryNewsService } from '../country/country-news.service';
import { memberIso3WithEvidence } from '../../analysis/region/region-coverage';
import { AskContextRefused, AskContextResolver } from '../../ask-v2/context/ask-context.resolver';
import { observedRetrievalOf } from '../../ask-v2/retrieval-outcome';
import { researchRecordOf } from '../../ask-v2/research-record';
import { OBSERVED_RETRIEVAL_OUTCOMES } from '../../ask-observability/ask-observation.contract';

/**
 * MASTER CTO P0 #85 — GEO-IDENTITY QUARANTINE, OFFLINE FIXTURES.
 *
 * Synthetic metadata only (no publisher text, no publisher URL). The five held identities are the
 * persisted ids measured read-only on Alpha; held fixtures use those ids with SYNTHETIC text and
 * URLs, so the hold is proved by identity. Negative controls: a genuine COG report (Brazzaville),
 * a genuine COD report (Goma), and other historical CG/CD rows lacking ArticleCountry rows.
 */
const HELD_IDS = GEO_IDENTITY_QUARANTINE.map((e) => e.articleId);
const HELD_REFS = GEO_IDENTITY_QUARANTINE.map((e) => e.articleRef);
const NOW = Date.now();

const article = (over: Partial<NewsArticle> & { id: string }): NewsArticle => ({
  title: 'Synthetic headline',
  summary: 'Synthetic summary.',
  url: `https://wire.example/${over.id}`,
  sourceId: 'synthetic-wire',
  sourceName: 'Synthetic Wire',
  category: 'world',
  sourcesCount: 1,
  publishedAt: new Date(NOW - 3_600_000).toISOString(),
  ...over,
});
/* the held texts reproduce the defect's shape: a bare "Congo" that the text reader maps to COG */
const HELD_TEXT = { title: 'Contractors ambushed in battlefield loss in Congo', summary: 'Fighters in Congo were killed or wounded.' };
const heldArticles = (): NewsArticle[] =>
  HELD_IDS.map((id) => article({ id, ...HELD_TEXT, countryCode: 'CG', countryName: 'Republic of the Congo' }));
const BENIGN_COG = article({
  id: 'benign-cog-brazzaville',
  title: 'Brazzaville port expansion approved by Republic of the Congo government',
  summary: 'The Republic of the Congo approved the Brazzaville port plan.',
  countryCode: 'CG',
  countryName: 'Republic of the Congo',
});
const BENIGN_COD = article({
  id: 'benign-cod-goma',
  title: 'Floods hit Goma in eastern DR Congo',
  summary: 'Heavy rain flooded Goma, North Kivu, Democratic Republic of the Congo.',
  countryCode: 'CD',
  countryName: 'DR Congo',
});

describe('#85 · the guard (identity only, no rule)', () => {
  it('holds exactly the five measured identities, by persisted id and by articleRef', () => {
    expect(GEO_IDENTITY_QUARANTINE).toHaveLength(5);
    for (const id of HELD_IDS) expect(isGeoQuarantined({ id })).toBe(true);
    for (const ref of HELD_REFS) expect(isGeoQuarantinedRef(ref)).toBe(true);
    expect(isGeoQuarantinedRef(HELD_REFS[0].toUpperCase())).toBe(true);
    expect(Object.isFrozen(GEO_IDENTITY_QUARANTINE)).toBe(true);
  });

  it('is not a CG/CD rule: genuine COG and COD reports, and other historical CG/CD rows, are not held', () => {
    for (const a of [BENIGN_COG, BENIGN_COD, article({ id: 'historic-cg', countryCode: 'CG' }), article({ id: 'historic-cd', countryCode: 'CD' })]) {
      expect(isGeoQuarantined(a)).toBe(false);
      expect(withoutDisputedGeography(a)).toBe(a);
    }
    expect(isGeoQuarantined({})).toBe(false);
    expect(isGeoQuarantinedRef('0'.repeat(64))).toBe(false);
  });

  it('URL matching is by the shared articleRef (spellings that normalize together are one identity)', () => {
    const base = 'https://wire.example/world/story-1';
    expect(computeArticleRef(`${base}?utm_source=x`)).toBe(computeArticleRef(base));
    const source = readFileSync(join(__dirname, 'geo-identity-quarantine.ts'), 'utf8');
    expect(source).toContain('HELD_REFS.has(computeArticleRef(url))');
    /* no publisher URL is written into the hold list */
    expect(source).not.toMatch(/https?:\/\/(www\.)?(reuters|marketscreener|straitstimes|timesnownews|nypost)/i);
  });

  it('a held record keeps its content but loses its stored geography', () => {
    const [held] = heldArticles();
    const stripped = withoutDisputedGeography(held);
    expect(stripped.countryCode).toBeUndefined();
    expect(stripped.countryName).toBeUndefined();
    expect(stripped.title).toBe(held.title);
    const { kept, held: h } = partitionGeoQuarantined([...heldArticles(), BENIGN_COG, BENIGN_COD]);
    expect(h.map((a) => a.id)).toEqual(HELD_IDS);
    expect(kept.map((a) => a.id)).toEqual([BENIGN_COG.id, BENIGN_COD.id]);
  });
});

/* ── persistence: an in-memory evaluator for the where-operators these reads use (rights-absence.spec) ── */
type Row = {
  id: string; title: string; summary: string; url: string; imageUrl: string | null; sourceId: string;
  sourceName: string; sourcesCount: number; category: string; publishedAt: Date; fetchedAt: Date;
  publishedAtBasis: string; countryCode: string | null; countryName: string | null; relevanceScore: number | null;
  confidenceScore: number | null; createdAt: Date; updatedAt: Date;
};
const toRow = (a: NewsArticle): Row => ({
  id: a.id, title: a.title, summary: a.summary, url: a.url, imageUrl: null, sourceId: a.sourceId ?? 'synthetic-wire',
  sourceName: a.sourceName, sourcesCount: 1, category: 'world', publishedAt: new Date(NOW - 3_600_000),
  fetchedAt: new Date(NOW - 3_600_000), publishedAtBasis: 'publisher', countryCode: a.countryCode ?? null,
  countryName: a.countryName ?? null, relevanceScore: null, confidenceScore: null, createdAt: new Date(NOW), updatedAt: new Date(NOW),
});
const ROWS: Row[] = [...heldArticles(), BENIGN_COG, BENIGN_COD, article({ id: 'historic-cg', countryCode: 'CG', countryName: 'Republic of the Congo' })].map(toRow);

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
      if ('startsWith' in c) return String(v).startsWith(String(c.startsWith));
      if ('contains' in c) return String(v).toLowerCase().includes(String(c.contains).toLowerCase());
      return true;
    }
    return v === cond;
  });
}

function store() {
  const upserts: string[] = [];
  const relationUpserts: string[] = [];
  const prisma = {
    article: {
      findMany: jest.fn(async (q: { where?: Record<string, unknown>; take?: number }) =>
        ROWS.filter((r) => matches(r as never, q.where)).slice(0, q.take ?? 100)),
      findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const hit = ROWS.find((r) => matches(r as never, q.where));
        return hit === undefined ? null : { ...hit, countries: [] };
      }),
      upsert: jest.fn((q: { where: { url: string } }) => {
        upserts.push(q.where.url);
        return { url: q.where.url, fetchedAt: new Date(NOW) };
      }),
    },
    /* every row offered as a relevant relation, so the guard (not the data) is what is proved */
    articleCountry: {
      findMany: jest.fn(async (q: { where?: { article?: Record<string, unknown> }; take?: number }) =>
        ROWS.filter((r) => matches(r as never, q.where?.article)).slice(0, q.take ?? 100).map((r) => ({
          id: `ac-${r.id}`, countryCode: 'COG', countryName: 'Congo', relevanceScore: 80, isRelevant: true,
          articleId: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt, article: r,
        }))),
      upsert: jest.fn((q: { where: { articleId_countryCode: { articleId: string } } }) => {
        relationUpserts.push(q.where.articleId_countryCode.articleId);
        return {};
      }),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
  return { svc: new ArticlePersistenceService(prisma as never), upserts, relationUpserts };
}

describe('#85 · persistence reads and writes', () => {
  it('retained query reads keep a held row but never with its stored (disputed) country', async () => {
    const { svc } = store();
    const got = await svc.findRecent({ limit: 50, maxAgeMinutes: 1440 });
    const byId = new Map(got.map((a) => [a.id, a]));
    for (const id of HELD_IDS) {
      expect(byId.has(id)).toBe(true);
      expect(byId.get(id)!.countryCode).toBeUndefined();
      expect(byId.get(id)!.countryName).toBeUndefined();
    }
    expect(byId.get(BENIGN_COG.id)!.countryCode).toBe('CG');
    expect(byId.get(BENIGN_COD.id)!.countryCode).toBe('CD');
    expect(byId.get('historic-cg')!.countryCode).toBe('CG');
  });

  it('country-scoped reads (country feed, security, My Intelligence, companion) never serve a held row', async () => {
    const { svc } = store();
    const viaCountry = (await svc.findRecentByCountry({ countryCode: 'COG', limit: 50 })).map((a) => a.id);
    const viaSecurity = (await svc.readRecentForSecurity({ countryCode: 'COG', limit: 50 })).articles.map((a) => a.id);
    for (const ids of [viaCountry, viaSecurity]) {
      for (const id of HELD_IDS) expect(ids).not.toContain(id);
      expect(ids).toEqual(expect.arrayContaining([BENIGN_COG.id, BENIGN_COD.id, 'historic-cg']));
    }
  });

  it('a held row is not obtainable as a selected story or anchor (by id or by URL); benign rows are', async () => {
    const { svc } = store();
    for (const id of HELD_IDS) {
      expect(await svc.findById(id)).toBeNull();
      expect(await svc.findRetainedByUrl(`https://wire.example/${id}`)).toBeNull();
    }
    expect((await svc.findById(BENIGN_COG.id))?.countryCode).toBe('CG');
    expect((await svc.findRetainedByUrl(BENIGN_COD.url))?.article.countryCode).toBe('CD');
  });

  it('stored data is never rewritten: a re-fetched held copy is not upserted, no relation is created for it', async () => {
    const { svc, upserts, relationUpserts } = store();
    await svc.persistMany([...heldArticles().map((a) => withoutDisputedGeography(a)), BENIGN_COG]);
    expect(upserts).toEqual([BENIGN_COG.url]);
    await svc.persistCountryRelations([
      ...HELD_IDS.map((articleId) => ({ articleId, countryCode: 'COG', countryName: 'Congo', relevanceScore: 9, isRelevant: true })),
      { articleId: BENIGN_COG.id, countryCode: 'COG', countryName: 'Congo', relevanceScore: 9, isRelevant: true },
    ]);
    expect(relationUpserts).toEqual([BENIGN_COG.id]);
  });
});

describe('#85 · NewsService: live and cached responses never re-geolocate a held identity', () => {
  const resolve = (articles: NewsArticle[]): NewsArticle[] =>
    (NewsService.prototype as unknown as { resolveArticleCountries(a: NewsArticle[]): NewsArticle[] }).resolveArticleCountries.call(
      {},
      articles,
    );

  it('held (text says "Congo") → no country at all; genuine Brazzaville → CG; genuine Goma → CD', () => {
    const out = resolve([...heldArticles().map((a) => ({ ...a, countryCode: undefined, countryName: undefined })), BENIGN_COG, BENIGN_COD]);
    for (const a of out.slice(0, 5)) expect(a.countryCode).toBeUndefined();
    expect(out[5].countryCode).toBe('CG');
    expect(out[6].countryCode).toBe('CD');
  });

  it('non-vacuous: text that DOES resolve to a country resolves for an unheld id, and not for a held one', () => {
    const text = { title: BENIGN_COG.title, summary: BENIGN_COG.summary };
    const [unheld, heldOne] = resolve([article({ id: 'control-not-held', ...text }), article({ id: HELD_IDS[0], ...text })]);
    expect(unheld.countryCode).toBe('CG');
    expect(heldOne.countryCode).toBeUndefined();
  });
});

describe('#85 · country feed (/news/country/:code) never serves a held identity for a country', () => {
  it('COG feed: held items are not scored into it; the genuine COG report is', async () => {
    const response: NewsResponse = {
      articles: [...heldArticles().map((a) => ({ ...a, countryCode: undefined, countryName: undefined })), BENIGN_COG],
      totalResults: 6,
      providers: ['gnews'],
      dataMode: 'live',
      generatedAt: new Date().toISOString(),
    };
    const persistCountryRelations = jest.fn().mockResolvedValue(undefined);
    const svc = new CountryNewsService(
      { search: jest.fn(async () => response) } as never,
      { get: () => undefined } as unknown as ConfigService,
      { persistCountryRelations, findRecentByCountry: jest.fn().mockResolvedValue([]), findRecent: jest.fn().mockResolvedValue([]) } as never,
    );
    const feed = await svc.getCountryNews('COG');
    const ids = feed.articles.map((a) => a.id);
    for (const id of HELD_IDS) expect(ids).not.toContain(id);
    expect(ids).toContain(BENIGN_COG.id);
    const related = (persistCountryRelations.mock.calls[0]?.[0] ?? []) as Array<{ articleId: string }>;
    for (const id of HELD_IDS) expect(related.map((r) => r.articleId)).not.toContain(id);
  });
});

describe('#85 · coverage counts', () => {
  it('a held identity never counts a member as covered (even with a stored code attached)', () => {
    const members = [findCountryByIso3('COG')!, findCountryByIso3('COD')!];
    expect([...memberIso3WithEvidence(heldArticles(), members)]).toEqual([]);
    expect([...memberIso3WithEvidence([...heldArticles(), BENIGN_COD], members)]).toEqual(['COD']);
    expect([...memberIso3WithEvidence([BENIGN_COG], members)]).toEqual(['COG']);
  });
});

describe('#85 · Ask story context: an explicit hold, before any read, never "not found", never remapped', () => {
  const reader = () => {
    const findArticleById = jest.fn(async (id: string) => (id === BENIGN_COD.id ? { ...BENIGN_COD } : null));
    const findRetainedArticleByUrl = jest.fn(async () => null);
    return { resolver: new AskContextResolver({ findArticleById, findRetainedArticleByUrl } as never), findArticleById, findRetainedArticleByUrl };
  };
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return 'RESOLVED';
    } catch (e) {
      return e instanceof AskContextRefused ? e.code : 'OTHER';
    }
  };

  it.each(HELD_IDS)('STORY by id %s → ASK_CONTEXT_STORY_GEO_IDENTITY_DISPUTED, store not read', async (articleId) => {
    const r = reader();
    expect(await code(r.resolver.resolve({ kind: 'STORY', articleId }))).toBe('ASK_CONTEXT_STORY_GEO_IDENTITY_DISPUTED');
    expect(r.findArticleById).not.toHaveBeenCalled();
  });

  it.each(HELD_REFS)('STORY by ref %s → held refusal (whatever URL accompanies it), store not read', async (articleRef) => {
    const r = reader();
    expect(await code(r.resolver.resolve({ kind: 'STORY', articleRef, url: 'https://wire.example/any' }))).toBe(
      'ASK_CONTEXT_STORY_GEO_IDENTITY_DISPUTED',
    );
    expect(r.findRetainedArticleByUrl).not.toHaveBeenCalled();
  });

  it('a SELECTION containing a held story is refused as a whole, not silently narrowed', async () => {
    const r = reader();
    const other = 'https://wire.example/other';
    const stories = [
      { articleRef: HELD_REFS[0], url: 'https://wire.example/any' },
      { articleRef: computeArticleRef(other), url: other },
    ];
    expect(await code(r.resolver.resolve({ kind: 'SELECTION', action: 'COMPARE', stories }))).toBe(
      'ASK_CONTEXT_STORY_GEO_IDENTITY_DISPUTED',
    );
    expect(r.findRetainedArticleByUrl).not.toHaveBeenCalled();
  });

  it('control: a genuine COD story still resolves, with its own country', async () => {
    const r = reader();
    expect(await code(r.resolver.resolve({ kind: 'STORY', articleId: BENIGN_COD.id }))).toBe('RESOLVED');
  });
});

describe('#85 · outcome codes: a held-only search is never "no match"', () => {
  const ctx = (over: Record<string, unknown>) => ({ articles: [], retrievalContext: { dataMode: 'live', providers: ['gnews', 'gdelt-doc'], ...over } });

  it('every candidate held → GEO_IDENTITY_HELD (operator observation); governed vocabulary admits it', () => {
    const o = observedRetrievalOf(ctx({ geoIdentityHeld: { count: 5 }, retrievalTrace: { candidatesSeen: 5, candidatesAdmitted: 0 } }) as never);
    expect(o.retrievalOutcome).toBe('GEO_IDENTITY_HELD');
    expect(OBSERVED_RETRIEVAL_OUTCOMES.has('GEO_IDENTITY_HELD')).toBe(true);
  });

  it('control: without a hold the same empty search is COMPLETED_NO_MATCH / ALL_FILTERED (unchanged)', () => {
    expect(observedRetrievalOf(ctx({}) as never).retrievalOutcome).toBe('COMPLETED_NO_MATCH');
    expect(observedRetrievalOf(ctx({ retrievalTrace: { candidatesSeen: 5 } }) as never).retrievalOutcome).toBe('ALL_FILTERED');
  });

  it('evidence admitted beside held items stays MATCHED; failures and rights keep precedence', () => {
    const matched = { articles: [{ id: 'x' }], retrievalContext: { dataMode: 'live', providers: ['gnews'], geoIdentityHeld: { count: 2 } } };
    expect(observedRetrievalOf(matched as never).retrievalOutcome).toBe('MATCHED');
    expect(observedRetrievalOf(ctx({ providers: [], dataMode: 'unavailable', fallbackReason: 'provider-error', geoIdentityHeld: { count: 1 } }) as never).retrievalOutcome).toBe('PROVIDER_FAILED');
    expect(observedRetrievalOf(ctx({ rightsExcluded: { count: 1 }, geoIdentityHeld: { count: 1 } }) as never).retrievalOutcome).toBe('RIGHTS_WITHHELD');
  });

  it('the reader payload carries the existing OUTCOME_UNAVAILABLE (the live frontend has no case for the new code)', () => {
    const record = researchRecordOf(ctx({ geoIdentityHeld: { count: 5 } }) as never);
    expect(record.outcome).toBe('OUTCOME_UNAVAILABLE');
    expect(record.outcome).not.toBe('COMPLETED_NO_MATCH');
  });
});

describe('#85 · persisted story search never matches a held row through its disputed country name', () => {
  const ev = (w: any, r: any): boolean =>
    w == null ||
    Object.entries(w).every(([k, v]: [string, any]) => {
      if (k === 'AND') return (v as any[]).every((x) => ev(x, r));
      if (k === 'OR') return (v as any[]).some((x) => ev(x, r));
      if (k === 'countries') return r.countries.some((c: any) => c.isRelevant && (!v.some.countryCode || v.some.countryCode.in.includes(c.countryCode)));
      if (k === 'publishedAt') return r.publishedAt >= v.gte;
      if (v && typeof v === 'object' && 'contains' in v) return String(r[k] ?? '').toLowerCase().includes(String(v.contains).toLowerCase());
      return true;
    });
  const row = (a: NewsArticle) => ({
    id: a.id, url: a.url, title: a.title, summary: a.summary, imageUrl: null, sourceId: 'synthetic-wire', sourceName: 'Synthetic Wire',
    category: 'world', publishedAt: new Date(NOW - 3_600_000), publishedAtBasis: 'publisher', fetchedAt: new Date(NOW - 3_600_000),
    countryName: a.countryName ?? null, countries: [],
  });
  const prisma: any = {
    article: { findMany: async (q: any) => [...heldArticles(), BENIGN_COG].map(row).filter((r) => ev(q.where, r)) },
    storyArticle: { findMany: async () => [] },
    story: { findMany: async () => [] },
    storyComment: { findMany: async () => [] },
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HomeEditorialService } = require('../../home-editorial/home-editorial.service');
  const svc = new HomeEditorialService(prisma);
  const search = (q: string) => svc.search({ q, scope: 'ALL_RETAINED', region: null, domain: null, days: null, now: new Date(NOW) });

  it('"Republic" matches the genuine COG report by its headline, and no held row by its stored country name', async () => {
    const ids = (await search('Republic')).results.map((c: any) => c.articleRef);
    expect(ids).toContain(computeArticleRef(BENIGN_COG.url));
    for (const a of heldArticles()) expect(ids).not.toContain(computeArticleRef(a.url));
  });

  it('a held row still matches its OWN words (not hidden, just not geolocated)', async () => {
    /* the five copies share one headline: the search collapses them; at least one held row is listed */
    const ids = (await search('ambushed')).results.map((c: any) => c.articleRef);
    const heldRefs = heldArticles().map((a) => computeArticleRef(a.url));
    expect(ids.some((r: string) => heldRefs.includes(r))).toBe(true);
  });
});
