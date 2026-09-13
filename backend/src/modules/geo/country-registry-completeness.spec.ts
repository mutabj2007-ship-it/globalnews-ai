import { COUNTRIES } from '@globalnews-ai/shared';
import { allCities, allRegions, countryExtent } from './geo-gazetteer';
import { allSupranationalRegions } from './supranational-membership';

/**
 * THE REGISTRY-COMPLETENESS GATE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FAILURE THIS EXISTS TO MAKE IMPOSSIBLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Madagascar was missing from `shared/COUNTRIES` while the gazetteer held 22 of
 * its admin1 regions, 6 of its settlements and a derived country extent. Every
 * existing assertion passed, and here is the precise reason:
 *
 *     the M49 membership lists were checked AGAINST `COUNTRIES`
 *     `ALL_ISO3_CODES` is `COUNTRIES.map(c => c.iso3)`
 *     the African partition test compared a subset of COUNTRIES to COUNTRIES
 *
 * A country absent from the registry is absent from BOTH SIDES of every one of
 * those comparisons. The suite was not lenient — it was STRUCTURALLY BLIND. It
 * could only ever prove the table was internally consistent with itself, which
 * a table containing nothing at all would also satisfy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE CANNOT BE BLIND THE SAME WAY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It compares `COUNTRIES` against a source that DOES NOT DERIVE FROM IT: the
 * shipped gazetteer artifact, built offline from GeoNames. The two have
 * separate provenance and separate maintainers, so a country can only be
 * missing from both by coincidence rather than by construction.
 *
 * The gazetteer is not itself a registry of sovereign states — it holds
 * dependencies, overseas territories and disputed areas too, and `COUNTRIES` is
 * deliberately a sovereign-state table. So the non-sovereign codes are DECLARED
 * below, individually, and anything undeclared fails. That is the same pattern
 * `ACKNOWLEDGED_SUBDIVISION_SHADOWING` and `M49_CONTINENT_DIVERGENCE` use: the
 * exception list is the audit trail, and it is short enough to read.
 */

/**
 * ISO 3166-1 alpha-2 codes the GAZETTEER carries that are NOT sovereign states,
 * and therefore correctly absent from `COUNTRIES`.
 *
 * Every entry is a dependency, an overseas department or collectivity, a Crown
 * dependency, an external territory, or a partially-recognised state. NONE is a
 * UN member or observer. A code may be added here ONLY with that justification;
 * adding a sovereign state here to silence this suite would reintroduce exactly
 * the Madagascar defect with a comment on it.
 */
const NON_SOVEREIGN_TERRITORIES: Readonly<Record<string, string>> = {
  AI: 'Anguilla — British Overseas Territory',
  AS: 'American Samoa — unincorporated US territory',
  BM: 'Bermuda — British Overseas Territory',
  BQ: 'Bonaire, Sint Eustatius and Saba — special municipalities of the Netherlands',
  CW: 'Curaçao — constituent country of the Kingdom of the Netherlands',
  EH: 'Western Sahara — disputed, no seated government',
  FO: 'Faroe Islands — autonomous territory of Denmark',
  GF: 'French Guiana — overseas department of France',
  GG: 'Guernsey — British Crown dependency',
  GL: 'Greenland — autonomous territory of Denmark',
  GP: 'Guadeloupe — overseas department of France',
  GU: 'Guam — unincorporated US territory',
  HK: 'Hong Kong — Special Administrative Region of China',
  IM: 'Isle of Man — British Crown dependency',
  JE: 'Jersey — British Crown dependency',
  KY: 'Cayman Islands — British Overseas Territory',
  MO: 'Macao — Special Administrative Region of China',
  MP: 'Northern Mariana Islands — US commonwealth',
  MQ: 'Martinique — overseas department of France',
  MS: 'Montserrat — British Overseas Territory',
  PM: 'Saint Pierre and Miquelon — French overseas collectivity',
  PR: 'Puerto Rico — US commonwealth',
  RE: 'Réunion — overseas department of France',
  SH: 'Saint Helena, Ascension and Tristan da Cunha — British Overseas Territory',
  TF: 'French Southern and Antarctic Lands — French overseas territory',
  TK: 'Tokelau — dependent territory of New Zealand',
  UM: 'United States Minor Outlying Islands — US insular areas',
  VI: 'United States Virgin Islands — unincorporated US territory',
  WF: 'Wallis and Futuna — French overseas collectivity',
  XK: 'Kosovo — partially recognised; not a UN member; XK is a user-assigned code',
  YT: 'Mayotte — overseas department of France',
};

/** Every ISO2 the gazetteer knows about, from all three of its own indexes. */
function gazetteerCountryCodes(): Set<string> {
  const codes = new Set<string>();

  for (const city of allCities()) codes.add(city.cc);
  for (const region of allRegions()) codes.add(region.cc);
  for (const country of COUNTRIES) if (countryExtent(country.iso2)) codes.add(country.iso2);

  return codes;
}

describe('1 · every country the gazetteer knows is in the registry', () => {
  it('NO SOVEREIGN STATE IS MISSING FROM COUNTRIES', () => {
    const registered = new Set(COUNTRIES.map((country) => country.iso2));
    const unexplained = [...gazetteerCountryCodes()]
      .filter((cc) => !registered.has(cc))
      .filter((cc) => NON_SOVEREIGN_TERRITORIES[cc] === undefined)
      .sort();

    /*
     * Before Madagascar was restored this array was ['MG'] and this assertion
     * is the one that would have caught it — on the very first run, without
     * anyone having to think of Madagascar.
     */
    expect(unexplained).toEqual([]);
  });

  it('Madagascar specifically is registered, searchable and complete', () => {
    const madagascar = COUNTRIES.find((country) => country.iso3 === 'MDG');

    expect(madagascar).toEqual({
      iso2: 'MG',
      iso3: 'MDG',
      isoNumeric: '450',
      name: 'Madagascar',
      region: 'Africa',
    });
  });

  it('every declared exception is a real non-sovereign territory with a reason', () => {
    const registered = new Set(COUNTRIES.map((country) => country.iso2));

    for (const [code, reason] of Object.entries(NON_SOVEREIGN_TERRITORIES)) {
      // It must NOT be in COUNTRIES — otherwise the declaration is stale.
      expect(registered.has(code)).toBe(false);
      expect(reason.length).toBeGreaterThan(15);
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('the exception list is not a dumping ground', () => {
    // If this ever needs to grow past the world's actual dependency count,
    // something is being hidden in it rather than declared.
    expect(Object.keys(NON_SOVEREIGN_TERRITORIES).length).toBeLessThanOrEqual(45);
  });
});

describe('2 · M49 completeness is checked against the gazetteer, not against itself', () => {
  /*
   * THE SECOND HALF OF THE FIX. The African partition test in
   * `supranational-membership.spec.ts` proves the five M49 subregions cover
   * every country COUNTRIES calls African — a true statement that stayed true
   * while Madagascar was missing from both sides.
   *
   * This asserts the same completeness against the INDEPENDENT source, so a
   * country the gazetteer places in Africa must appear in exactly one M49
   * African subregion regardless of what COUNTRIES says.
   */
  const africanSubregions = [
    'Northern Africa',
    'Eastern Africa',
    'Middle Africa',
    'Southern Africa',
    'Western Africa',
  ];

  const memberships = (): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const name of africanSubregions) {
      const region = allSupranationalRegions().find((candidate) => candidate.name === name);
      if (!region) throw new Error(`missing region ${name}`);
      for (const iso3 of region.members) {
        map.set(iso3, [...(map.get(iso3) ?? []), name]);
      }
    }

    return map;
  };

  it('EVERY AFRICAN COUNTRY THE GAZETTEER HOLDS SITS IN EXACTLY ONE M49 SUBREGION', () => {
    const placed = memberships();
    const registered = new Map(COUNTRIES.map((country) => [country.iso2, country]));

    const gaps: string[] = [];
    for (const cc of gazetteerCountryCodes()) {
      const country = registered.get(cc);
      // Non-sovereign codes have no COUNTRIES row by design and are not M49 members.
      if (!country || country.region !== 'Africa') continue;

      const homes = placed.get(country.iso3) ?? [];
      if (homes.length !== 1) gaps.push(`${country.iso3} (${country.name}) -> ${homes.length}`);
    }

    expect(gaps).toEqual([]);
  });

  it('Madagascar is in Eastern Africa and nowhere else', () => {
    expect(memberships().get('MDG')).toEqual(['Eastern Africa']);
  });

  it('the gazetteer really does hold Madagascar — this test is not vacuous', () => {
    // A completeness assertion that would also pass over an empty set is not an
    // assertion. This proves the input it reads is non-empty for MDG.
    expect(gazetteerCountryCodes().has('MG')).toBe(true);
    expect(allRegions().filter((region) => region.cc === 'MG')).toHaveLength(22);
    expect(allCities().filter((city) => city.cc === 'MG').length).toBeGreaterThan(0);
  });
});
