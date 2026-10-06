import { findCountryByIso3 } from '@globalnews-ai/shared';
import { demonymForms, resolveCountriesByDemonym, scoreCountryRelevance } from './country-relevance.util';

/**
 * HOME DATA TRUTH — FINAL CORRECTION · R1 (canonical authority): Burundi had no curated demonym,
 * and article relevance never matched a demonym in the plural ("Burundians Flock to Embassy…"
 * resolved to nothing).
 */
const score = (title: string, iso3: string) => scoreCountryRelevance({ title, summary: '' }, findCountryByIso3(iso3)!);
const inTitle = (title: string, iso3: string) => score(title, iso3).reasons.includes('demonym appears in title');

describe('canonical demonyms · Burundi and regular plurals (article relevance)', () => {
  it('Burundian and Burundians both resolve to Burundi through the canonical scorer', () => {
    expect(inTitle('Burundian traders protest new border rules', 'BDI')).toBe(true);
    expect(inTitle('Burundians Flock to Embassy Amid Kenya’s Trade Crackdown', 'BDI')).toBe(true);
    expect(score('Burundians Flock to Embassy', 'BDI').isRelevant).toBe(true);
  });

  it('the regular plural works for the other curated "-an" / "-i" demonyms too', () => {
    expect(inTitle('Kenyans queue for fuel', 'KEN')).toBe(true);
    expect(inTitle('Rwandans and Ugandans trade at the border', 'RWA')).toBe(true);
    expect(inTitle('Rwandans and Ugandans trade at the border', 'UGA')).toBe(true);
    expect(inTitle('Israelis and Somalis meet in Doha', 'ISR')).toBe(true);
    expect(inTitle('Iraqis vote in local elections', 'IRQ')).toBe(true);
  });

  it('only the regular plural is derived: invariant and irregular forms are not invented', () => {
    expect(demonymForms('sudanese')).toEqual(['sudanese']);
    expect(demonymForms('swiss')).toEqual(['swiss']);
    expect(demonymForms('french')).toEqual(['french']);
    expect(demonymForms('kenyan')).toEqual(['kenyan', 'kenyans']);
    expect(demonymForms('iraqi')).toEqual(['iraqi', 'iraqis']);
  });

  it('every guard applies to the plural exactly as to the singular', () => {
    expect(inTitle('the burundians said nothing', 'BDI')).toBe(false); // capitalisation guard
    expect(inTitle('South Sudanese refugees return', 'SDN')).toBe(false); // longest form wins
    expect(inTitle('South Sudanese refugees return', 'SSD')).toBe(true);
    expect(inTitle('German shepherds win the show', 'DEU')).toBe(false); // non-locative compound
  });

  it('Ask query routing is untouched by the plural rule (pinned by the Ask qualification suite)', () => {
    expect(resolveCountriesByDemonym('rwandans')).toEqual([]);
    expect(resolveCountriesByDemonym('Burundian traders').map((c) => c.iso3)).toEqual(['BDI']);
  });
});
