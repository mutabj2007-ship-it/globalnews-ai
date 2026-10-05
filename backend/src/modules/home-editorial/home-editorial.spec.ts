import { assessHomeEligibility } from './home-eligibility';
import { assembleHomeEditorial, type RetainedRow } from './home-editorial.assemble';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §5, §6, §11, §13 — eligibility examples and counterexamples
 * (headlines are real Alpha retained rows of 2026-09-26 … 10-02), plus the assembly rules.
 */
const yes = (title: string, category = 'world', summary = '') => assessHomeEligibility({ title, summary, category });

describe('Home eligibility — business and conflict only', () => {
  it.each([
    ["Dangote's planned Kenya refinery faces legal challenge by consumer-rights group", 'world', 'business'],
    ['Ruto downplays rivalry over oil refinery in East Africa', 'politics', 'business'],
    ['Is Ethiopia on the verge of another civil war as fighting erupts in Tigray?', 'politics', 'conflict'],
    ['Telecoms snarled in Ethiopia amid clashes', 'politics', 'conflict'],
    ["UN rights chief 'deeply alarmed' by escalating fighting in Ethiopia", 'world', 'conflict'],
    ['EU agrees new tariffs on Chinese electric vehicles', 'business', 'business'],
    ['Houthi missile attack disrupts Red Sea shipping', 'world', 'conflict'],
    ['Poland inflation eases to 3.1% as central bank holds rates', 'business', 'business'],
  ])('ELIGIBLE: %s', (title, category, domain) => {
    const v = yes(title, category);
    expect(v.eligible).toBe(true);
    if (v.eligible) expect(v.domains).toContain(domain);
  });

  it.each([
    ['AFCON qualifiers: Wissa guides DR Congo to win, Tunisia held by Botswana', 'world', 'SPORT'],
    ['Zimbabwe vs. DR Congo Lineups, Live Streaming, How & Where to Watch on TV', 'world', 'SPORT'],
    ['Wissa spoils Zimbabwe homecoming as DR Congo win AFCON qualifier', 'world', 'SPORT'],
    ['Club sold for $3bn in record takeover', 'sports', 'EXCLUDED_CATEGORY'],
    ['Actress reveals investment in Nairobi start-up', 'world', 'CELEBRITY_ENTERTAINMENT'],
    ['New PlayStation game release breaks sales records', 'business', 'GAMING'],
    ['Best places to visit in Zanzibar this autumn', 'world', 'LIFESTYLE'],
    ['Scientists use GPS to track four African raptors in Kenya and discover they avoid turbines', 'science', 'NO_BUSINESS_OR_CONFLICT_EVIDENCE'],
    ['Market day brings crowds to Kigali', 'business', 'NO_BUSINESS_OR_CONFLICT_EVIDENCE'],
    ['Kenya', 'world', 'NO_BUSINESS_OR_CONFLICT_EVIDENCE'],
    ['At least 17 killed in DR Congo plane crash, including senior military officials', 'politics', 'NO_BUSINESS_OR_CONFLICT_EVIDENCE'],
    ['Heart attack survivor shares her story', 'health', 'NO_BUSINESS_OR_CONFLICT_EVIDENCE'],
  ])('REJECTED: %s', (title, category, reason) => {
    const v = yes(title, category);
    expect(v).toMatchObject({ eligible: false, reason });
  });

  it('a sports headline cannot be smuggled in by a business-sounding summary', () => {
    expect(yes('Premier League club confirms takeover', 'business', 'The investment deal values the company at $2bn').eligible).toBe(false);
  });
});

const NOW = new Date('2026-10-05T12:00:00Z');
const h = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
let n = 0;
const row = (title: string, iso3: string, ageH: number, extra: Partial<RetainedRow> = {}): RetainedRow => ({
  id: `a${++n}`,
  url: `https://example.org/${n}`,
  title,
  summary: null,
  imageUrl: null,
  sourceId: 'gnews',
  sourceName: `Publisher ${n}`,
  category: 'world',
  publishedAt: h(ageH),
  publishedAtBasis: 'publisher',
  fetchedAt: h(ageH),
  countries: [{ iso3, relevance: 80 }],
  ...extra,
});

describe('Home editorial assembly', () => {
  const rows = [
    row('Kenya refinery investment faces court challenge', 'KEN', 5),
    row('Tanzania raises fuel prices as import costs climb', 'TZA', 30),
    row('Uganda central bank holds interest rate', 'UGA', 200),
    row('Fighting erupts in Tigray as ceasefire collapses', 'ETH', 10),
    row('Fighting erupts in Tigray as ceasefire collapses, residents say', 'ETH', 12, { sourceName: 'Wire copy' }),
    row('AFCON qualifier: DR Congo beat Zimbabwe', 'COD', 2),
    row('Poland inflation eases as central bank holds rates', 'POL', 20),
    row('EU agrees tariffs on Chinese electric vehicles', 'BEL', 40),
    row('Houthi missile attack disrupts Red Sea shipping', 'YEM', 8),
    row('Israel airstrikes hit Lebanon border towns', 'LBN', 50),
    row('Mock story', 'KEN', 1, { id: 'mock-1' }),
  ];

  it('rows exist in the governed order and never contain sport or mock rows', () => {
    const r = assembleHomeEditorial({ rows, storyIdByUrl: new Map(), discussionByStory: new Map(), preferences: null, now: NOW });
    expect(r.regions.map((x) => x.id)).toEqual(['region:east-africa', 'region:european-union', 'region:middle-east']);
    const all = [r.hero!.story, ...r.hero!.more, ...r.regions.flatMap((x) => x.stories)];
    expect(all.some((c) => /AFCON|Mock/.test(c.title))).toBe(false);
  });

  it('same development is one card with its other report named; no story appears twice', () => {
    const r = assembleHomeEditorial({ rows, storyIdByUrl: new Map(), discussionByStory: new Map(), preferences: null, now: NOW });
    const all = [r.hero!.story, ...r.hero!.more, ...r.regions.flatMap((x) => x.stories)];
    const tigray = all.filter((c) => c.title.startsWith('Fighting erupts in Tigray'));
    expect(tigray).toHaveLength(1);
    expect(tigray[0].otherReports.count).toBe(1);
    expect(new Set(all.map((c) => c.articleRef)).size).toBe(all.length);
  });

  it('older stories are kept and labelled EARLIER (ranking window, not deletion)', () => {
    const r = assembleHomeEditorial({ rows, storyIdByUrl: new Map(), discussionByStory: new Map(), preferences: null, now: NOW });
    const all = [r.hero!.story, ...r.hero!.more, ...r.regions.flatMap((x) => x.stories)];
    expect(all.find((c) => c.title.startsWith('Uganda'))?.freshness).toBe('EARLIER');
  });

  it('preferences change the hero meaningfully; unset preferences give a stable default', () => {
    const base = { rows, storyIdByUrl: new Map(), discussionByStory: new Map(), now: NOW };
    const def1 = assembleHomeEditorial({ ...base, preferences: null });
    const def2 = assembleHomeEditorial({ ...base, preferences: null, now: new Date(NOW.getTime() + 60_000) });
    expect(def1.hero!.basis).toBe('DEFAULT');
    expect(def2.hero!.story.articleRef).toBe(def1.hero!.story.articleRef); // no re-roll per render
    const poland = assembleHomeEditorial({ ...base, preferences: { countries: new Set(['POL']), domains: new Set() } });
    expect(poland.hero!.basis).toBe('PREFERENCES');
    expect(poland.hero!.story.title).toMatch(/Poland/);
    expect(poland.hero!.matched.countries.map((c) => c.iso3)).toEqual(['POL']);
    const conflict = assembleHomeEditorial({ ...base, preferences: { countries: new Set(['UGA']), domains: new Set(['business']) } });
    expect(conflict.hero!.story.title).toMatch(/Uganda/);
  });

  it('discussion keeps an older qualifying story prominent but cannot make an irrelevant one eligible', () => {
    const old = row('Lebanon port reopens to cargo shipping after strikes', 'LBN', 120);
    const sport = row('Derby result sparks celebrations', 'LBN', 2);
    const storyIdByUrl = new Map([[old.url, 's-old'], [sport.url, 's-sport']]);
    const discussionByStory = new Map([
      ['s-old', { comments: 9, participants: 4, lastActivityAt: h(3) }],
      ['s-sport', { comments: 500, participants: 300, lastActivityAt: h(1) }],
    ]);
    const r = assembleHomeEditorial({ rows: [old, sport], storyIdByUrl, discussionByStory, preferences: null, now: NOW });
    const all = [r.hero?.story, ...(r.hero?.more ?? []), ...r.regions.flatMap((x) => x.stories)].filter(Boolean);
    expect(all.map((c) => c!.title)).toEqual(['Lebanon port reopens to cargo shipping after strikes']);
    expect(all[0]!.freshness).toBe('ACTIVE_DISCUSSION');
  });

  it('an empty region is EMPTY — never back-filled from another region or a global feed', () => {
    const r = assembleHomeEditorial({ rows: [row('Kenya refinery investment faces court challenge', 'KEN', 5)], storyIdByUrl: new Map(), discussionByStory: new Map(), preferences: null, now: NOW });
    expect(r.regions.find((x) => x.id === 'region:middle-east')!.state).toBe('EMPTY');
    expect(r.regions.find((x) => x.id === 'region:european-union')!.stories).toEqual([]);
  });

  it('every card carries the canonical identity, attribution, dates, domain, geography and source status', () => {
    const r = assembleHomeEditorial({ rows, storyIdByUrl: new Map(), discussionByStory: new Map(), preferences: null, now: NOW });
    for (const c of [r.hero!.story, ...r.regions.flatMap((x) => x.stories)]) {
      expect(c.articleRef).toMatch(/^[0-9a-f]{64}$/);
      expect(c.publisher).not.toBe('');
      expect(Date.parse(c.publishedAt)).not.toBeNaN();
      expect(['business', 'conflict']).toContain(c.primaryDomain);
      expect(c.signals.length).toBeGreaterThan(0);
      expect(c.countries.length).toBeGreaterThan(0);
      expect(c.sourceStatus).toBe('RETAINED_PUBLISHER_REPORT');
    }
  });
});

describe('Story search (service, in-memory store)', () => {
  /* Minimal evaluator for the where-clauses HomeEditorialService builds (AND / OR / contains / countries / publishedAt). */
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
  const art = (id: string, title: string, summary: string, category = 'world', iso3 = 'KEN') => ({
    id, url: `https://example.org/${id}`, title, summary, imageUrl: null, sourceId: 'gnews', sourceName: `P-${id}`, category,
    publishedAt: h(10), publishedAtBasis: 'publisher', fetchedAt: h(10), countryName: null,
    countries: [{ countryCode: iso3, relevanceScore: 80, isRelevant: true }],
  });
  const store = [
    art('s1', 'Derby result sparks celebrations', 'Fans gathered outside the refineries district', 'sports'),
    art('b1', 'Kenya refinery investment faces court challenge', 'A legal challenge to the refinery plan'),
    art('c1', 'Fighting erupts in Tigray as ceasefire collapses', 'Clashes resumed', 'world', 'ETH'),
  ];
  const prisma: any = {
    article: { findMany: async (q: any) => store.filter((r) => ev(q.where, r)) },
    storyArticle: { findMany: async () => [] }, story: { findMany: async () => [] }, storyComment: { findMany: async () => [] },
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HomeEditorialService } = require('./home-editorial.service');
  const svc = new HomeEditorialService(prisma);
  const search = (q: string, scope: 'HOME_ELIGIBLE' | 'ALL_RETAINED' = 'HOME_ELIGIBLE') =>
    svc.search({ q, scope, region: null, domain: null, days: null, now: NOW });

  it('finds eligible stories by keyword and never returns sport in the Home scope', async () => {
    expect((await search('refinery')).results.map((c: any) => c.title)).toEqual(['Kenya refinery investment faces court challenge']);
    expect((await search('Derby')).results).toEqual([]);
    expect((await search('Derby', 'ALL_RETAINED')).results.map((c: any) => c.primaryDomain)).toEqual([null]);
  });
  it('a misspelling whose only raw hit is out of scope still relaxes to the word stem', async () => {
    const r = await search('refineri');
    expect(r.relaxed).toBe(true);
    expect(r.results.map((c: any) => c.title)).toEqual(['Kenya refinery investment faces court challenge']);
  });
  it('a country name matches the story geography', async () => {
    expect((await search('Ethiopia')).results.map((c: any) => c.title)).toEqual(['Fighting erupts in Tigray as ceasefire collapses']);
  });
  it('too-short queries return nothing without touching the store', async () => {
    expect((await search('a')).results).toEqual([]);
  });
});
