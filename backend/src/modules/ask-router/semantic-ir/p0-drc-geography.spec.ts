import { readEntityCandidates } from './entities';
import { detectAmbiguousCountryMention } from '../../analysis/anchor/event-anchor.util';
import { resolveCountryByCity } from '@globalnews-ai/shared';

/*
  P0 SOURCE-BACKED NEWS ANSWERS R1 — DRC geography in the integrator-owned layers (East Africa lead
  proposals P4 / P5 / P7; their offline pack EA-G1…G5, G8). A bare "Congo" with eastern-DRC context
  is the Democratic Republic of the Congo; Brazzaville / Republic of the Congo stays COG; Rwanda named
  as an actor never replaces the DRC location.
*/
const routerIso = (q: string) => readEntityCandidates(q, 'en').map((c) => c.iso3).filter(Boolean);
const N1 = 'Report abt Eric Prince in congo. According reuters please.';
const N2 = "According to Reuters, what happened to Erik Prince's forces in eastern Congo?";

describe('router (semantic-ir/entities.ts)', () => {
  it('EA-G1 "eastern Congo" is the DRC', () => {
    expect(routerIso(N2)).toContain('COD');
    expect(routerIso(N2)).not.toContain('COG');
  });
  it('EA-G2 a lower-case "congo" is read as a place (N1)', () => {
    /* read as a place, exactly as the capitalised name is (no eastern context: the registry short name) */
    expect(routerIso(N1)).toHaveLength(1);
  });
  it.each([
    'What is happening in Uvira, Congo?',
    'Fighting near Bukavu in Congo',
    'MONUSCO withdrawal from Congo',
    'Ituri violence: what changed in Congo?',
  ])('an eastern-DRC qualifier makes a bare "Congo" the DRC: %s', (q) => {
    expect(routerIso(q)).toContain('COD');
    expect(routerIso(q)).not.toContain('COG');
  });
  it('EA-G4 GUARD Rwanda named as an actor never replaces the DRC location', () => {
    const iso = routerIso('What did Rwanda say about Erik Prince in Congo?');
    expect(iso).toEqual(expect.arrayContaining(['COD', 'RWA']));
  });
  it('EA-G5 GUARD Brazzaville / Republic of the Congo stays COG — and wins over eastern qualifiers', () => {
    expect(routerIso('What is happening in Brazzaville, Republic of the Congo?')).toEqual(['COG']);
    expect(routerIso('Republic of the Congo and Kivu refugees')).not.toContain('COD');
  });
  it('an ordinary lower-case word that only looks like a country is still not a place', () => {
    expect(routerIso('turkey recipes for the holidays')).toEqual([]);
  });
});

describe('question ambiguity (analysis/anchor/event-anchor.util.ts)', () => {
  it('EA-G3 "South Kivu, eastern Congo" is not ambiguous', () => {
    expect(detectAmbiguousCountryMention('What happened in South Kivu, eastern Congo?')).toBeUndefined();
  });
  it('a bare "Congo" with no qualifier is still ambiguous', () => {
    expect(detectAmbiguousCountryMention('What happened in Congo?')).toMatchObject({ mention: 'Congo' });
  });
});

describe('cities (router gazetteer + shared city aliases)', () => {
  /* the router reads these as CITY candidates whose parent country is the DRC (EA-G8 checked only
     country candidates); the shared alias covers a city below the router's population floor (Bunia) */
  it.each(['Uvira', 'Bukavu', 'Bunia', 'Kolwezi', 'Lubumbashi'])('EA-G8 "%s" resolves to the DRC', (city) => {
    expect(resolveCountryByCity(city)?.iso3).toBe('COD');
    const parents = readEntityCandidates(`What happened in ${city} this week?`, 'en').map((c) => c.parentIso3 ?? c.iso3);
    expect(parents.every((p) => p === 'COD')).toBe(true);
  });
});
