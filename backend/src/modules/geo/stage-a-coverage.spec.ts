/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE-A · ENTITY / PLACE COVERAGE — R4_PARALLEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Each block below pins a defect FAMILY that was measured at 752d8b7, not the
 * phrase that exposed it. The named example appears, and so do siblings that
 * must behave the same way and controls that must NOT change.
 */
import { COUNTRIES, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { allCities, allRegions } from './geo-gazetteer';
import { foldPlaceName } from './geo-normalize.util';
import { resolveGeography } from './geo-resolver';
import { fragmentVerdict } from './stage-a-proper-run-guard';

const iso2Of = (text: string, options = {}): string | undefined => {
  const top = resolveGeography(text, options).candidates[0];

  return top?.country?.iso2;
};
const precisionOf = (text: string, options = {}): string =>
  String(resolveGeography(text, options).precision);
const cityOf = (text: string, options = {}): string | undefined =>
  resolveGeography(text, options).candidates[0]?.cityName;

describe('Stage-A fragment guard — the unit', () => {
  it('refuses a match a strictly longer governed run contains', () => {
    const verdict = fragmentVerdict('cabo', ['cabo delgado']);

    expect(verdict.admitted).toBe(false);
    expect(verdict.refusal).toBe('FRAGMENT_OF_GOVERNED_RUN');
    expect(verdict.container).toBe('cabo delgado');
  });

  it('ADMITS a match of equal length — a city inside its own province is not a fragment', () => {
    /* Kinshasa the city sits inside Kinshasa the province; both are true. */
    expect(fragmentVerdict('kinshasa', ['kinshasa']).admitted).toBe(true);
  });

  it('admits when no governed run contains it, however many runs there are', () => {
    expect(fragmentVerdict('goma', ['north kivu', 'dr congo']).admitted).toBe(true);
  });

  it('requires WHOLE-TOKEN containment, not substring containment', () => {
    /* "car" is a substring of "cardiff" but not one of its tokens. */
    expect(fragmentVerdict('car', ['cardiff']).admitted).toBe(true);
  });

  it('matches a contiguous run anywhere inside the container, not only at its head', () => {
    expect(fragmentVerdict('verde', ['cabo verde']).admitted).toBe(false);
    expect(fragmentVerdict('cabo', ['cabo verde']).admitted).toBe(false);
  });

  it('admits on an empty governed-run set and on empty input', () => {
    expect(fragmentVerdict('cabo', []).admitted).toBe(true);
    expect(fragmentVerdict('', ['cabo delgado']).admitted).toBe(true);
  });

  it('never refuses without naming the container that justified it', () => {
    const verdict = fragmentVerdict('republic', ['czech republic']);

    expect(verdict.admitted).toBe(false);
    expect(verdict.container).toBe('czech republic');
  });
});

describe('Stage-A substring negatives — the contract example and its family', () => {
  /*
   * MEASURED AT 752d8b7: every row below answered BRA / Pernambuco / "Cabo".
   * Cabo Delgado is a province of Mozambique.
   */
  it.each([
    'Cabo Delgado',
    'attacks in Cabo Delgado',
    'floods in Cabo Delgado province',
    'Cabo Delgado Attacks Displace Thousands',
  ])('"%s" is Mozambique, never a Brazilian city', (text) => {
    expect(iso2Of(text)).toBe('MZ');
    expect(cityOf(text)).toBeUndefined();
  });

  it('"Czech Republic" is Czechia, not a settlement called Republic in the USA', () => {
    expect(iso2Of('Czech Republic')).toBe('CZ');
  });

  it('the bare fragment still resolves on its own — the guard removes no governed place', () => {
    /*
     * "Cabo" ALONE IS THE BRAZILIAN CITY AND MUST STAY SO. The guard refuses a
     * fragment of a longer governed name; it does not blacklist the name.
     */
    expect(iso2Of('Cabo')).toBe('BR');
    expect(cityOf('Cabo')).toBe('Cabo');
  });

  it('refuses across the measured governed shadowing family, never worse than before', () => {
    /*
     * THE FAMILY, MEASURED: 284 governed multi-word region names whose first
     * token is also a one-word city in a DIFFERENT country. At 752d8b7, 132 of
     * them resolved to the wrong country. The guard repaired 88 and regressed
     * none, leaving 44 - names like "Central Province" that are genuinely
     * shared between countries and need corroboration, not a fragment rule.
     *
     * The bound can only fall. A rise means a regression.
     */
    const cityByFolded = new Map<string, Set<string>>();

    for (const city of allCities()) {
      const folded = foldPlaceName(city.n);

      if (folded.split(' ').length !== 1) continue;

      const seen = cityByFolded.get(folded) ?? new Set<string>();

      seen.add(city.cc);
      cityByFolded.set(folded, seen);
    }

    let misresolved = 0;
    let family = 0;

    for (const region of allRegions()) {
      const tokens = foldPlaceName(region.n).split(' ');

      if (tokens.length < 2) continue;

      const ccs = cityByFolded.get(tokens[0]);

      if (!ccs || [...ccs].every((cc) => cc === region.cc)) continue;

      family += 1;
      if (iso2Of(region.n) !== region.cc) misresolved += 1;
    }

    expect(family).toBeGreaterThanOrEqual(284);
    expect(misresolved).toBeLessThanOrEqual(44);
  });
});

describe('Stage-A exact entity identity — COD versus COG', () => {
  it.each([
    ['DR Congo', 'CD'],
    ['Democratic Republic of the Congo', 'CD'],
    ['Congo-Kinshasa', 'CD'],
    ['Republic of Congo', 'CG'],
    ['Congo', 'CG'],
    ['Congo-Brazzaville', 'CG'],
  ])('"%s" is %s', (text, iso2) => {
    expect(iso2Of(text)).toBe(iso2);
  });

  it('"Congolese" stays UNRESOLVED — the demonym does not choose between the two', () => {
    /*
     * A GOVERNED DEMONYM MUST BE UNAMBIGUOUS. "Congolese" describes nationals of
     * both states, so resolving it would be picking one at random.
     */
    expect(precisionOf('Congolese')).toBe('UNKNOWN');
    expect(resolveGeography('Congolese').reason).toBe('NO_PLACE_EVIDENCE');
  });
});

describe('Stage-A governed entity forms — the names the states themselves use', () => {
  /*
   * MEASURED AT 752d8b7: each of these resolved to NO COUNTRY, and "Cabo Verde"
   * to a Brazilian city, because only the older English exonym was governed.
   */
  it.each([
    ['Cabo Verde', 'CV'],
    ['Cape Verde', 'CV'],
    ['Timor-Leste', 'TL'],
    ['East Timor', 'TL'],
    ["Côte d'Ivoire", 'CI'],
    ['Ivory Coast', 'CI'],
    ['Viet Nam', 'VN'],
    ['Republic of Korea', 'KR'],
    ['Syrian Arab Republic', 'SY'],
    ['Lao PDR', 'LA'],
    ['Guinea-Bissau', 'GW'],
  ])('"%s" resolves to %s', (text, iso2) => {
    expect(iso2Of(text)).toBe(iso2);
  });

  it('"What happened in Cabo Verde?" is the country, not a city in Brazil', () => {
    expect(iso2Of('What happened in Cabo Verde?')).toBe('CV');
    expect(precisionOf('What happened in Cabo Verde?')).toBe('COUNTRY');
  });

  it('every canonical country name resolves from its own folded form', () => {
    /*
     * MEASURED AT 752d8b7: 204 of 206 did. Folding removes punctuation, and the
     * geo scan only ever asks in folded form, so "Guinea-Bissau" and "Falkland
     * Islands (Malvinas)" were unreachable from prose by their own governed
     * names. This pins the whole table, not the two that failed.
     */
    const unreachable = COUNTRIES.filter(
      (country) => resolveCountryByAnyIdentifier(foldPlaceName(country.name))?.iso3 !== country.iso3,
    ).map((country) => country.name);

    expect(unreachable).toEqual([]);
  });

  it('refuses the ambiguous acronym "CAR" rather than claiming a country', () => {
    /*
     * DELIBERATELY NOT GOVERNED. A key of "car" would claim the Central African
     * Republic every time an article mentioned a vehicle. The unambiguous full
     * name resolves instead.
     */
    expect(iso2Of('Central African Republic')).toBe('CF');
    expect(precisionOf('CAR')).toBe('UNKNOWN');
  });
});

describe('Stage-A lowercase safe aliases', () => {
  it.each([
    ['cabo verde', 'CV'],
    ['timor leste', 'TL'],
    ['dr congo', 'CD'],
    ['guinea bissau', 'GW'],
  ])('the identifier "%s" resolves to %s case-insensitively', (text, iso2) => {
    expect(resolveCountryByAnyIdentifier(text)?.iso2).toBe(iso2);
    expect(resolveCountryByAnyIdentifier(text.toUpperCase())?.iso2).toBe(iso2);
  });

  it('a lowercase prose word is NOT promoted to a place by these additions', () => {
    /* None of the added keys is an ordinary lowercase word; this pins that. */
    expect(precisionOf('the car broke down on the way to the office')).toBe('UNKNOWN');
    expect(precisionOf('a republic is a form of government')).toBe('UNKNOWN');
  });
});

describe('Stage-A venue and disputed-object roles', () => {
  it('"Badme" stays unresolved — a disputed object outside the governed tables', () => {
    expect(precisionOf('Badme')).toBe('UNKNOWN');
  });

  it('a venue is NOT admitted as a governed place by this lane', () => {
    /*
     * MEASURED AND DELIBERATELY LEFT OPEN. "Stade des Martyrs" is a stadium in
     * Kinshasa and still resolves to Stade in Lower Saxony, GERMANY, because a
     * lowercase connector separates the fragment from its continuation and no
     * governed run spells the venue.
     *
     * A VENUE IS NOT A WEAKER PLACE. Closing it needs a governed venue table,
     * which is a product decision and not a heuristic this lane may invent, so
     * the defect is PINNED AS IT STANDS rather than hidden. When a venue
     * authority lands, this expectation must be inverted deliberately.
     */
    expect(iso2Of('Stade des Martyrs')).toBe('DE');
  });

  it('a Portuguese exonym with a lowercase particle is still unrepaired, and pinned', () => {
    /*
     * "Cidade do Cabo" is Cape Town. No governed entry spells it, so the guard
     * has no longer run to find and the Brazilian city stands. The fix is an
     * EXONYM, not a rule - recorded as a case, pinned here so the next lane
     * sees the real state rather than a passing test.
     */
    expect(iso2Of('Cidade do Cabo')).toBe('BR');
  });
});

describe('Stage-A unknown-place negative controls', () => {
  it.each(['Wakanda', 'Gondor', 'the quarterly results meeting'])(
    '"%s" stays unresolved rather than invented',
    (text) => {
      expect(precisionOf(text)).toBe('UNKNOWN');
      expect(resolveGeography(text).candidates).toEqual([]);
    },
  );
});

describe('Stage-A controls that must not move', () => {
  /*
   * THE REGRESSION SURFACE. Every row here resolved correctly at 752d8b7 and
   * exercises a path the guard sits on: a bare city, a city beside another
   * capitalized city, a comma-separated city/country pair, a multi-word city,
   * and a city inside a same-named country run.
   */
  it.each([
    ['Kinshasa', 'CD'],
    ['Kinshasa and Goma', 'CD'],
    ['Musanze, Rwanda', 'RW'],
    ['New York City', 'US'],
    ['Port Moresby', 'PG'],
    ['Addis Ababa', 'ET'],
    ['Tel Aviv', 'IL'],
    ['San Francisco', 'US'],
    ['New Caledonia', 'NC'],
  ])('"%s" still resolves to %s', (text, iso2) => {
    expect(iso2Of(text)).toBe(iso2);
  });

  it.each([
    'Kinshasa Floods Kill 30',
    'Nairobi Protests Continue',
    'Khartoum Fighting Intensifies',
    'Dhaka Garment Workers Strike',
    'Kabul Earthquake Response Underway',
  ])('the title-case headline "%s" still resolves a place', (text) => {
    /*
     * THE HAZARD THAT SANK THE FIRST IMPLEMENTATION. A guard keyed on "the next
     * token is capitalized" refused Goma, Nairobi and Mogadishu here, because in
     * a headline EVERY word is capitalized. Positive evidence - a governed run
     * that actually matched - cannot make that mistake, and this pins it.
     */
    expect(precisionOf(text)).not.toBe('UNKNOWN');
  });
});
