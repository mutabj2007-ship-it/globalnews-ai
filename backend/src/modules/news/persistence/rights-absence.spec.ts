import * as policy from '../rights/source-use-policy';
import { ArticlePersistenceService } from './article-persistence.service';

/*
  E1-TAA-5 — ENFORCE BY ABSENCE, PROVED WITH A MUTATION. The store's own read methods must be unable
  to return a row from a held RSS source (Taarifa, Standard KE, WP PL, KT Press, GUS) or with an
  empty / malformed source id. A small in-memory evaluator stands in for Postgres and interprets
  exactly the where-operators these methods use; the mutation then disables the control at runtime,
  verifies that it took effect, and shows the same probe leaking — so the passing probe is evidence.
*/
type Row = {
  id: string; title: string; summary: string; url: string; imageUrl: string | null; sourceId: string;
  sourceName: string; sourcesCount: number; category: string; publishedAt: Date; fetchedAt: Date;
  publishedAtBasis: string; countryCode: string | null; countryName: string | null; relevanceScore: number | null;
  confidenceScore: number | null; createdAt: Date; updatedAt: Date;
};
const NOW = Date.now();
const row = (id: string, sourceId: string): Row => ({
  id, title: `Erik Prince report ${id}`, summary: `FIXTURE body ${id}`, url: `https://example.invalid/${id}`,
  imageUrl: null, sourceId, sourceName: id, sourcesCount: 1, category: 'world',
  publishedAt: new Date(NOW - 3600_000), fetchedAt: new Date(NOW - 3600_000), publishedAtBasis: 'publisher',
  countryCode: 'COD', countryName: 'DR Congo', relevanceScore: 80, confidenceScore: null,
  createdAt: new Date(NOW), updatedAt: new Date(NOW),
});
const ROWS: Row[] = [
  row('provider', 'bbc'),
  row('taarifa', 'feed:taarifa-rw'),
  row('standard', 'feed:standardmedia-ke'),
  row('wp', 'feed:wp-pl'),
  row('ktpress', 'feed:ktpress-rw'),
  row('gus', 'feed:gus-pl'),
  row('unknown-feed', 'feed:not-in-registry'),
  row('empty', ''),
  row('malformed', 'Bad Id'),
];
const HELD = ROWS.filter((r) => r.id !== 'provider').map((r) => r.id);

/* evaluates the where-operators these repository methods actually use */
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
  const article = {
    findMany: jest.fn(async (q: { where?: Record<string, unknown>; take?: number }) =>
      ROWS.filter((r) => matches(r as never, q.where)).slice(0, q.take ?? 100)),
    findFirst: jest.fn(async (q: { where?: Record<string, unknown> }) => {
      const hit = ROWS.find((r) => matches(r as never, q.where));
      return hit === undefined ? null : { ...hit, countries: [{ countryCode: 'COD' }] };
    }),
  };
  const articleCountry = {
    findMany: jest.fn(async (q: { where?: { article?: Record<string, unknown> }; take?: number }) =>
      ROWS.filter((r) => matches(r as never, q.where?.article)).slice(0, q.take ?? 100).map((r) => ({
        id: `ac-${r.id}`, countryCode: 'COD', countryName: 'DR Congo', relevanceScore: 80, isRelevant: true,
        articleId: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt, article: r,
      }))),
  };
  return new ArticlePersistenceService({ article, articleCountry } as never);
}

async function probe(svc: ArticlePersistenceService): Promise<string[]> {
  const got = new Set<string>();
  for (const a of await svc.findRecent({ limit: 50, maxAgeMinutes: 1440 })) got.add(a.id);
  for (const a of await svc.findRecent({ limit: 50, maxAgeMinutes: 1440, query: 'Erik Prince', queryTerms: ['Erik Prince'] })) got.add(a.id);
  const byCountry = await svc.findRecentByCountry({ countryCode: 'COD', limit: 50, maxAgeMinutes: 1440 } as never);
  for (const a of (Array.isArray(byCountry) ? byCountry : (byCountry as { articles: { id: string }[] }).articles)) got.add(a.id);
  for (const id of ROWS.map((r) => r.id)) {
    if ((await svc.findById(id)) !== null) got.add(id);
    if ((await svc.findRetainedByUrl(`https://example.invalid/${id}`)) !== null) got.add(id);
  }
  return [...got].sort();
}

describe('E1-TAA-5 — the store cannot hand out a held source (enforced by absence)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('every read path returns only the provider row: no held RSS source, no empty, unknown or malformed id', async () => {
    expect(await probe(store())).toEqual(['provider']);
  });

  it('MUTATION: with the control disabled at runtime the same probe leaks every held row — so the probe binds', async () => {
    const whereSpy = jest.spyOn(policy, 'admittedStoredSourceWhere').mockReturnValue({});
    const rowSpy = jest.spyOn(policy, 'storedRowAdmissible').mockReturnValue(true);
    const leaked = await probe(store());
    /* the mutation took effect at runtime before anything is concluded */
    expect(whereSpy).toHaveBeenCalled();
    expect(rowSpy).toHaveBeenCalled();
    expect(leaked).toEqual(expect.arrayContaining(HELD));
  });
});
