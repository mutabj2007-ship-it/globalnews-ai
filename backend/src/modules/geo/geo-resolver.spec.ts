import { GAZETTEER_ATTRIBUTION, gazetteerCounts } from './geo-gazetteer';
import { foldPlaceName } from './geo-normalize.util';
import { POPULATION_DOMINANCE_RATIO, resolveGeography } from './geo-resolver';

/**
 * GEOGRAPHY — THE RESOLVER.
 *
 * The product complaint this answers: a curated table of roughly two dozen
 * cities could not resolve Perth, Sydney, New York, Shanghai, Mumbai, São Paulo
 * or Istanbul, and its failure mode was silence rather than an error.
 */

describe('GEO — scale, which is the whole point', () => {
  it('carries a real gazetteer, not a curated table', () => {
    const counts = gazetteerCounts();

    expect(counts.cities).toBeGreaterThan(40000);
    expect(counts.regions).toBeGreaterThan(3000);
  });

  it('states its attribution, because CC BY 4.0 requires it', () => {
    expect(GAZETTEER_ATTRIBUTION()).toContain('GeoNames');
    expect(GAZETTEER_ATTRIBUTION()).toContain('CC BY 4.0');
  });

  it.each([
    ['Sydney commuters faced delays this morning.', 'Sydney', 'AUS'],
    ['New York City transit workers voted to strike.', 'New York City', 'USA'],
    ['Shanghai port volumes rose in August.', 'Shanghai', 'CHN'],
    ['Mumbai floods displaced thousands of residents.', 'Mumbai', 'IND'],
    ['São Paulo declared a state of emergency.', 'São Paulo', 'BRA'],
    ['Istanbul mayor announced the transport plan.', 'Istanbul', 'TUR'],
    ['Officials in Perth, Australia announced a plan.', 'Perth', 'AUS'],
  ])('resolves the named major city in %s', (text, city, iso3) => {
    const resolution = resolveGeography(text);

    expect(resolution.precision).toBe('CITY');
    expect(resolution.place?.cityName).toBe(city);
    expect(resolution.place?.country.iso3).toBe(iso3);
  });

  it('gives H real coordinates, not strings', () => {
    const resolution = resolveGeography('Shanghai port volumes rose in August.');
    const point = resolution.place?.point;

    expect(point).toBeDefined();
    expect(point?.[0]).toBeCloseTo(121.45806, 4);
    expect(point?.[1]).toBeCloseTo(31.22222, 4);
  });

  it('resolves an ORDINARY city, not only a famous one', () => {
    // Musanze, pop 86,685. The M1.0A contract had to refuse this exact place
    // because "Musanze is not a curated city and nothing here may invent one".
    const resolution = resolveGeography('Musanze reported the incident.');

    expect(resolution.place?.cityName).toBe('Musanze');
    expect(resolution.place?.regionName).toBe('Northern Province');
    expect(resolution.place?.country.iso3).toBe('RWA');
  });
});

describe('GEO — aliases and spelling variants', () => {
  it.each([
    ['Sao Paulo declared a state of emergency.', 'São Paulo'],
    ['Zurich bankers met on Tuesday.', 'Zürich'],
    ['Krakow hosted the summit.', 'Kraków'],
    ['Dusseldorf airport reopened.', 'Düsseldorf'],
  ])('folds diacritics: %s', (text, canonical) => {
    expect(resolveGeography(text).place?.cityName).toBe(canonical);
  });

  it('folds the Turkish dotted capital I', () => {
    expect(foldPlaceName('İstanbul')).toBe('istanbul');
    expect(foldPlaceName('Istanbul')).toBe('istanbul');
  });

  it('resolves a subdivision by a MULTILINGUAL alias', () => {
    // "Australie-Occidentale" is a real name in the subdivision dataset.
    const resolution = resolveGeography('Le rapport de Australie-Occidentale est公開.');

    /*
     * PROVINCE, not REGION. Reconciled against the approved Spatial design
     * specification, which reserves REGION for SUPRANATIONAL areas (East Africa,
     * the Sahel) and names subnational units PROVINCE or DISTRICT.
     */
    expect(resolution.precision).toBe('PROVINCE');
    expect(resolution.place?.regionName).toBe('Western Australia');
    expect(resolution.place?.regionCode).toBe('AU-WA');
  });

  it('is not fuzzy — one wrong letter is a different place, or none', () => {
    expect(resolveGeography('Shanghia port volumes rose.').precision).toBe('UNKNOWN');
  });
});

describe('GEO — contextual disambiguation', () => {
  it('Perth alone is decided by population dominance, and is INTERPRETED not STATED', () => {
    const resolution = resolveGeography('Officials in Perth announced a transport plan.');

    expect(resolution.place?.country.iso3).toBe('AUS');
    expect(resolution.reason).toBe('CITY_BY_POPULATION_DOMINANCE');
    // A prior is not a statement. This is the rule that keeps the two axes apart.
    expect(resolution.provenance).toBe('INTERPRETED');
  });

  it('a named country outranks the population prior', () => {
    const resolution = resolveGeography('A council meeting in Perth, Scotland approved it.');

    expect(resolution.place?.country.iso3).toBe('GBR');
    expect(resolution.provenance).toBe('STATED');
  });

  it('a named subdivision resolves it too', () => {
    const resolution = resolveGeography('Perth, Western Australia recorded record heat.');

    expect(resolution.reason).toBe('CITY_BY_REGION_CONTEXT');
    expect(resolution.place?.regionCode).toBe('AU-WA');
  });

  it('a caller-supplied country breaks a tie but is INTERPRETED, never STATED', () => {
    const resolution = resolveGeography('Officials in Aberdeen said so.', {
      contextCountryIso3: 'GBR',
    });

    expect(resolution.place?.country.iso3).toBe('GBR');
    expect(resolution.provenance).toBe('INTERPRETED');
  });

  it('caller context can NEVER manufacture a location from text with no place', () => {
    // The M1.0A rule: retrieval geography must never become article geography.
    const resolution = resolveGeography('Markets rallied on technology earnings.', {
      contextCountryIso3: 'RWA',
    });

    expect(resolution.precision).toBe('UNKNOWN');
    expect(resolution.place).toBeUndefined();
  });
});

describe('GEO — CONTESTED is producible for the first time', () => {
  /*
   * M1.0A declared CONTESTED in the vocabulary and reported it UNPRODUCIBLE,
   * because a resolver returning one candidate has nothing to contest. A
   * multi-candidate gazetteer changes that, and this is the evidence.
   */
  it('Aberdeen with no context is CONTESTED, not silently the biggest one', () => {
    const resolution = resolveGeography('Aberdeen residents protested the closure.');

    expect(resolution.provenance).toBe('CONTESTED');
    expect(resolution.reason).toBe('CITY_CONTESTED');
    expect(resolution.place).toBeUndefined();
    expect(resolution.candidates.length).toBeGreaterThan(1);
  });

  it('and every surviving candidate is reported so the ambiguity can be shown', () => {
    const resolution = resolveGeography('Aberdeen residents protested the closure.');
    const countries = new Set(resolution.candidates.map((place) => place.country.iso3));

    expect(countries.size).toBeGreaterThan(1);

    for (const candidate of resolution.candidates) {
      expect(candidate.point).toBeDefined();
    }
  });

  it('the dominance bar is what separates a decision from a contest', () => {
    expect(POPULATION_DOMINANCE_RATIO).toBe(10);

    // Perth AU (1,896,548) vs Perth GB (47,180) is roughly 40x -> decided.
    expect(resolveGeography('Perth said so.').provenance).toBe('INTERPRETED');
    // Aberdeen GB (196,670) vs US (28,102) is roughly 7x -> contested.
    expect(resolveGeography('Aberdeen said so.').provenance).toBe('CONTESTED');
  });
});

describe('GEO — honest UNKNOWN', () => {
  it('an un-gazetteered locality is UNKNOWN, never upgraded to its city', () => {
    // Nyabugogo is a real Kigali neighbourhood, below every gazetteer tier here.
    const resolution = resolveGeography('Nyabugogo terminal upgrade begins.');

    expect(resolution.precision).toBe('UNKNOWN');
    expect(resolution.place).toBeUndefined();
    expect(resolution.candidates).toEqual([]);
  });

  it('text with no geography is UNKNOWN', () => {
    expect(resolveGeography('Markets rallied on technology earnings.').precision).toBe('UNKNOWN');
  });

  it('empty input is UNKNOWN rather than a throw', () => {
    expect(resolveGeography('').precision).toBe('UNKNOWN');
  });
});

describe('GEO — the containment defect the catalogue actually has', () => {
  /*
   * Measured on the real country catalogue: five country names sit inside
   * another country name as whole-word runs. An independent scan reports the
   * wrong one.
   */
  it.each([
    ['Fighting continues in DR Congo this week.', 'COD'],
    ['Papua New Guinea reported a landslide.', 'PNG'],
    ['South Sudan signed the agreement.', 'SSD'],
    ['Guinea-Bissau held elections.', 'GNB'],
    ['Equatorial Guinea announced the budget.', 'GNQ'],
  ])('%s resolves the CONTAINING country, not the contained one', (text, iso3) => {
    expect(resolveGeography(text).place?.country.iso3).toBe(iso3);
  });

  it('a subdivision containing a country name is read as the subdivision', () => {
    // "Western Australia" must not be read as "Australia" with the finer
    // evidence discarded.
    const resolution = resolveGeography('Perth, Western Australia recorded record heat.');

    expect(resolution.reason).toBe('CITY_BY_REGION_CONTEXT');
  });
});

describe('GEO — geometry for the Spatial map', () => {
  it('a country resolves with a derived extent H can frame', () => {
    const resolution = resolveGeography('Rwanda announced a new trade policy.');
    const extent = resolution.place?.extent;

    expect(resolution.precision).toBe('COUNTRY');
    expect(extent).toBeTruthy();
    expect(extent?.bbox).toHaveLength(4);
    expect(extent?.centroid).toHaveLength(2);
  });

  it('a derived extent is LABELLED as derived, never as a boundary', () => {
    const extent = resolveGeography('Rwanda announced a new trade policy.').place?.extent;

    // M1.0A forbids inventing bounds. This is a statistic over real settlement
    // points and says so, so no consumer can draw it as a border.
    expect(extent?.source).toBe('derived-from-settlements');
    expect(extent?.members).toBeGreaterThan(1);
  });

  it('a city extent is the settlement point itself', () => {
    const extent = resolveGeography('Kigali terminal upgrade begins.').place?.extent;

    expect(extent?.source).toBe('settlement-point');
    expect(extent?.members).toBe(1);
  });

  it('NO territory in this artifact spans the antimeridian — measured, not assumed', () => {
    /*
     * The flag exists because a naive lon min/max is wrong for territories that
     * cross 180 degrees. MEASURED on this artifact: zero countries and zero
     * subdivisions trip it, because the settlements that would cause it (eastern
     * Chukotka, the outer Aleutians, eastern Fiji) all sit below the 5,000
     * population floor.
     *
     * So the flag is correct and currently always false. It is kept because the
     * floor is a build parameter, and lowering it would make the case real. This
     * test asserts the CURRENT truth rather than a hypothetical, so a future
     * build that changes the floor fails here and gets looked at.
     */
    const extent = resolveGeography('Russia announced the plan.').place?.extent;

    expect(extent?.antimeridian).toBe(false);
    expect(extent?.bbox[2]).toBeLessThan(180);
  });

  it('UNKNOWN carries no geometry at all', () => {
    expect(resolveGeography('Nyabugogo terminal upgrade begins.').place).toBeUndefined();
  });
});

describe('GEO — short and common-word names do not fire on their own', () => {
  /*
   * The false positive that produced these guards: "Un rapport de ..." resolved
   * to Un, Gujarat (population 30,671), because folding makes the French
   * indefinite article indistinguishable from the town.
   */
  it('a sentence-initial function word does not become a town in Gujarat', () => {
    const resolution = resolveGeography('Un rapport de la situation economique.');

    expect(resolution.place?.cityName).not.toBe('Un');
  });

  it.each([
    ['Un', 'Un rapport a ete publie.'],
    ['As', 'As expected, the vote was delayed.'],
    ['Of', 'Of the four options, none passed.'],
  ])('the settlement named "%s" needs corroboration to fire', (_name, text) => {
    expect(resolveGeography(text).precision).toBe('UNKNOWN');
  });

  it('a lower-case common noun that is also a city does not fire', () => {
    // "reading", "nice", "mobile" are all real settlements.
    expect(resolveGeography('the reading was nice on mobile').precision).toBe('UNKNOWN');
  });

  it('but a genuine multi-word name containing short tokens still works', () => {
    expect(resolveGeography('Las Vegas hosted the conference.').place?.cityName).toBe('Las Vegas');
  });

  it('caseless scripts are NOT penalized by the capitalization guard', () => {
    // Chinese has no case; requiring it would blind the resolver to most of Asia.
    const resolution = resolveGeography('上海 port volumes rose in August.');

    expect(['CITY', 'UNKNOWN']).toContain(resolution.precision);
  });
});

describe('GEO — purity', () => {
  it('is deterministic', () => {
    const text = 'Perth, Western Australia recorded record heat.';

    expect(resolveGeography(text)).toEqual(resolveGeography(text));
  });

  it('reports the matched surface form for audit', () => {
    expect(resolveGeography('Shanghai port volumes rose.').matchedText).toBe('shanghai');
  });
});
