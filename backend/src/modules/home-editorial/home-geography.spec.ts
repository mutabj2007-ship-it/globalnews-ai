import { EAST_AFRICA_MEMBERS, MIDDLE_EAST_MEMBERS, productCoverageScope } from '@globalnews-ai/shared';
import { REGION_MEMBERS, assembleHomeEditorial, candidatesOf, type RetainedRow } from './home-editorial.assemble';
import { supportedCountries } from './home-geography';

/**
 * HOME DATA TRUTH CORRECTION R1 · B3 — a Home region placement must be supported by the story
 * itself; an upstream country tag alone never places a story in a region row.
 */
const NOW = new Date('2026-10-05T12:00:00Z');
let n = 0;
const row = (title: string, summary: string | null, tags: string[], ageH = 6): RetainedRow => ({
  id: `g${++n}`,
  url: `https://example.org/g${n}`,
  title,
  summary,
  imageUrl: null,
  sourceId: 'gnews',
  sourceName: `Publisher ${n}`,
  category: 'business',
  publishedAt: new Date(NOW.getTime() - ageH * 3_600_000),
  publishedAtBasis: 'publisher',
  fetchedAt: new Date(NOW.getTime() - ageH * 3_600_000),
  countries: tags.map((iso3) => ({ iso3, relevance: 40 })),
});
const regionsOfRow = (r: RetainedRow): string[] => candidatesOf([r], NOW).flatMap((c) => [...c.regionRelevance.keys()]);
const placed = (rows: RetainedRow[]) => {
  const home = assembleHomeEditorial({ rows, storyIdByUrl: new Map(), discussionByStory: new Map(), preferences: null, now: NOW });
  return [home.hero?.story, ...(home.hero?.more ?? []), ...home.regions.flatMap((g) => g.stories)].filter(Boolean);
};

describe('B3 · unsupported country tags never create a Home region claim', () => {
  it('a UK story tagged Spain (Spain only as a comparison in the summary) does not enter the EU row', () => {
    const r = row(
      'Obesity costs Britain’s economy £20bn a year',
      'UK suffers greater productivity losses from excess weight than Germany, France, Italy and Spain, study finds',
      ['ESP'],
    );
    expect(supportedCountries(r, r.countries)).toEqual([]);
    expect(regionsOfRow(r)).toEqual([]);
    expect(placed([r])).toEqual([]);
  });

  it('a US corporate story tagged Kenya (a person named Kenya) does not enter East Africa', () => {
    const r = row(
      'City Council votes to intervene in Dominion, NextEra merger',
      'Councilwoman Kenya Gibson called on the State Corporation Commission to put a stop to the pending merger.',
      ['KEN'],
    );
    expect(supportedCountries(r, r.countries)).toEqual([]);
    expect(placed([r])).toEqual([]);
  });

  it.each([
    ['Kenya raises fuel prices as import costs climb', null, 'KEN'],
    ['Rwandan exporters hit by new cargo levies at the border', null, 'RWA'],
    ['Dar es Salaam port delays slow cargo for Burundi traders', null, 'TZA'],
    ['Maize flour prices climb for third month', 'Households in Kampala are paying more as costs rise across Uganda.', 'UGA'],
    ['Ethiopia war: fighting spreads to Amhara towns', null, 'ETH'],
  ])('a real East African story still enters East Africa: %s', (title, summary, iso3) => {
    const r = row(title, summary, [iso3]);
    expect(regionsOfRow(r)).toEqual(['region:east-africa']);
  });

  it('a cross-regional story enters each region whose relation the story supports — and only those', () => {
    const both = row('Kenya and Israel sign trade deal on farm exports', null, ['KEN', 'ISR']);
    expect(regionsOfRow(both).sort()).toEqual(['region:east-africa', 'region:middle-east']);
    const one = row('Kenya signs trade deal on farm exports', 'Officials in Nairobi said talks with Spain continue.', ['KEN', 'ESP']);
    expect(regionsOfRow(one)).toEqual(['region:east-africa']);
  });

  it('the card shows only supported countries; the stored tags are not changed', () => {
    const r = row('Kenya signs trade deal on farm exports', null, ['KEN', 'ESP']);
    const [card] = placed([r]);
    expect(card!.countries.map((c) => c.iso3)).toEqual(['KEN']);
    expect(r.countries.map((c) => c.iso3)).toEqual(['KEN', 'ESP']);
  });

  it('a headline naming only a region-internal locality outside the canonical vocabulary is not placed (known, conservative)', () => {
    const r = row('Fighting erupts in Tigray as ceasefire collapses', 'Clashes resumed.', ['ETH']);
    expect(regionsOfRow(r)).toEqual([]);
  });
});

describe('B3 · region authority is the shared scope (no local list)', () => {
  it('East Africa is the 11-member product scope, distinct from the EAC (8): a non-EAC member places', () => {
    expect([...REGION_MEMBERS['region:east-africa']]).toEqual([...EAST_AFRICA_MEMBERS]);
    expect(productCoverageScope('region:east-africa')?.disclosure).toMatch(/East African Community \(8/);
    expect(regionsOfRow(row('Ethiopia raises fuel prices as import costs climb', null, ['ETH']))).toEqual(['region:east-africa']);
  });

  it('the Middle East row uses the frozen GlobalNewsAI monitoring scope', () => {
    expect([...REGION_MEMBERS['region:middle-east']]).toEqual([...MIDDLE_EAST_MEMBERS]);
    expect(productCoverageScope('region:middle-east')?.scopeLabel).toBe('GlobalNewsAI Middle East monitoring scope');
  });
});
