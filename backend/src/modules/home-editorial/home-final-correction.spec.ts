import { assessHomeEligibility } from './home-eligibility';
import { candidatesOf, type RetainedRow } from './home-editorial.assemble';
import { supportedCountries } from './home-geography';
import { scoreCountryRelevance } from '../news/country/country-relevance.util';
import { findCountryByIso3 } from '@globalnews-ai/shared';

/**
 * HOME DATA TRUTH — FINAL CORRECTION (East Africa re-review of 636c3c4).
 * R1 — a governed member the headline names must not depend on an upstream tag.
 * R2 — casualty / generic attack / legal-process / background wording is not armed conflict;
 *      UNGA is not the staple "unga".
 */
const NOW = new Date('2026-10-05T12:00:00Z');
let n = 0;
const row = (title: string, summary: string | null, tags: string[]): RetainedRow => ({
  id: `f${++n}`, url: `https://example.org/f${n}`, title, summary, imageUrl: null, sourceId: 'gnews', sourceName: `P${n}`,
  category: 'world', publishedAt: new Date(NOW.getTime() - 3_600_000), publishedAtBasis: 'publisher',
  fetchedAt: new Date(NOW.getTime() - 3_600_000), countries: tags.map((iso3) => ({ iso3, relevance: 40 })),
});
const sup = (r: RetainedRow) => supportedCountries(r, r.countries).map((c) => c.iso3).sort();
const regions = (r: RetainedRow) => candidatesOf([r], NOW).flatMap((c) => [...c.regionRelevance.keys()]).sort();
const v = (title: string, summary = '') => assessHomeEligibility({ title, summary, category: 'world' });

describe('R1 · a headline-named governed member supports placement without an upstream tag', () => {
  it('Saudi Arabia named, only Yemen tagged → Saudi/Middle East retained', () => {
    const r = row('Houthis hit Saudi base amid renewed fighting with Yemen government forces', null, ['IRN']);
    expect(sup(r)).toEqual(['SAU', 'YEM']);
    expect(regions(r)).toEqual(['region:middle-east']);
  });
  it('Saudi Arabia named with a stray Iran tag → Saudi supported, the unnamed Iran tag is not', () => {
    const r = row('Saudi Arabia demands protection for key West Asia shipping routes', null, ['IRN']);
    expect(sup(r)).toEqual(['SAU']);
  });
  it('Riyadh follows the canonical scorer exactly (no Home-only city mapping)', () => {
    const r = row('Houthis target Riyadh with drones', null, ['YEM']);
    const scorerSaysSaudi = scoreCountryRelevance({ title: r.title, summary: '' }, findCountryByIso3('SAU')!).reasons.includes('country reference appears in title');
    expect(sup(r).includes('SAU')).toBe(scorerSaysSaudi);
  });
  it('Qatar named with no Qatar tag → Middle East placement supported', () => {
    const r = row('Qatar raises LNG output as Gulf exports climb', null, ['KEN']);
    expect(sup(r)).toEqual(['QAT']);
    expect(regions(r)).toEqual(['region:middle-east']);
  });
  it('Burundians (canonical plural) and a named Kenya both support East Africa', () => {
    const r = row('Burundians Flock to Embassy Amid Kenya’s Trade Crackdown', null, ['BDI']);
    expect(sup(r)).toEqual(['BDI', 'KEN']);
    expect(regions(r)).toEqual(['region:east-africa']);
  });
  it('the original false placements stay gone', () => {
    expect(regions(row('Obesity costs Britain’s economy £20bn a year', 'UK suffers greater losses than Germany, France, Italy and Spain, study finds', ['ESP']))).toEqual([]);
    expect(regions(row('City Council votes to intervene in Dominion, NextEra merger', 'Councilwoman Kenya Gibson called on the commission to stop the merger.', ['KEN']))).toEqual([]);
  });
  it('the headline country controls; a country compared only in the summary does not add a region', () => {
    const r = row('Kenya raises fuel prices as import costs climb', 'Prices are now higher than in France and Israel.', ['KEN', 'FRA', 'ISR']);
    expect(sup(r)).toEqual(['KEN']);
    expect(regions(r)).toEqual(['region:east-africa']);
  });
  it('an unnamed tag without a supporting lead sentence is rejected', () => {
    expect(regions(row('Fuel prices climb again', 'Motorists queue at pumps as stocks run low.', ['UGA']))).toEqual([]);
  });
  it('stored tags are never changed', () => {
    const r = row('Houthis hit Saudi base amid renewed fighting with Yemen government forces', null, ['IRN']);
    candidatesOf([r], NOW);
    expect(r.countries.map((c) => c.iso3)).toEqual(['IRN']);
  });
});

describe('R2 · casualty, generic attack, legal-process and background words are not armed conflict', () => {
  it.each([
    ['fire in a rebel-controlled city', 'Tragedy Strikes Bukavu: Fire Claims Lives of 24 Children in Rebel-Controlled City', 'Firefighters struggled for hours.'],
    ['fire in a rebel-held town (paraphrase)', 'Blaze kills 12 in rebel-held town', 'The fire started in a market.'],
    ['nightclub assault', 'Two injured in nightclub assault in Mombasa', 'Police are investigating.'],
    ['police raid', 'Police raid on suspected robbers in Kampala leaves three dead', 'Officers recovered stolen goods.'],
    ['city + raid', 'Mombasa raid nets drugs haul', 'Officers seized several kilos.'],
    ['criminal shooting', 'Shooting at Nairobi bar leaves two dead', 'Detectives are hunting the gunman.'],
    ['genocide trial', "Doctor charged in UK over Rwanda genocide 'supervised violence that killed six' during 1994 massacre, court hears", ''],
    ['historic killings charge', 'Man charged over 1994 killings during Rwanda war', ''],
    ['arrests near a war-used base', 'Men arrested on explosives charges near UK air base used by US in Iran war', ''],
    ['incident near a war-used base', '‘Terror’ incident near RAF base used for Iran war: What we know', ''],
    ['generic casualty report', 'Dozens dead and hundreds wounded after bus plunges off bridge', ''],
    ['background war, diplomatic event', 'Modi forges BRICS consensus in shadow of worsening Iran war', ''],
  ])('%s → not admitted as conflict', (_l, title, summary) => {
    const r = v(title, summary);
    expect(r.eligible && r.domains.includes('conflict')).toBe(false);
  });

  it.each([
    ['fighters seize town', 'Fighters seize town in South Kivu as residents flee', ''],
    ['rebels overrun military post', 'Rebels overrun military post near Beni', ''],
    ['Houthis attack pipeline', 'Houthis attack Saudi pipeline near Red Sea coast', ''],
    ['Houthis hit base', 'Houthis claim hit on Saudi base after renewed fighting', ''],
    ['al-Shabaab attack', 'Al-Shabaab attack on army camp in Lower Shabelle', ''],
    ['armed group clashes', 'Armed groups clash near Bunia gold mines', ''],
    ['families flee fighting', 'Families flee fighting in Sudan’s El Fasher', ''],
    ['drone strike in a conflict', 'Drone strike hits fuel depot in Port Sudan', ''],
    ['war in eastern Congo', 'Can Geneva talks break the cycle of war in eastern Congo?', ''],
    ['country-prefixed attack', 'Russian attack on Ukraine power grid leaves millions without heat', ''],
    ['casualties corroborate a real conflict family', 'Militants storm military base, killing 20 soldiers', ''],
    ['legal headline with a genuine current development', 'Court halts deployment as rebels capture border town', ''],
  ])('%s → admitted as conflict', (_l, title, summary) => {
    const r = v(title, summary);
    expect(r.eligible && r.domains.includes('conflict')).toBe(true);
  });

  it('casualty words alone never admit, even several of them', () => {
    expect(v('Killed, wounded and dead: the toll of the floods', 'Casualties rose as violence of the storm continued.').eligible).toBe(false);
  });

  it('"trade war" stays business-only', () => {
    const r = v('Washington and Beijing slide toward a trade war', 'New duties on electronics take effect.');
    expect(r.eligible && r.domains).toEqual(['business']);
  });
});

describe('R2 · UNGA is not the staple "unga"', () => {
  it('an UNGA sanctions story gains no staple / price evidence', () => {
    const r = v('Trump pushes Iran sanctions enforcement at UNGA with Gulf leaders', '');
    expect(r.eligible && r.signals.business).not.toEqual(expect.arrayContaining(['staples']));
    expect(r.eligible).toBe(false);
  });
  it('the Swahili staple still counts through governed phrasing ("unga flour", "maize flour")', () => {
    expect(v('Price of unga flour climbs in Nairobi', '').eligible).toBe(true);
    expect(v('Maize flour prices climb for third month', '').eligible).toBe(true);
  });
});
