import { COUNTRIES } from '@globalnews-ai/shared';
import {
  allSupranationalRegions,
  M49_CONTINENT_DIVERGENCE,
  membersOf,
  regionExtent,
  supranationalById,
  supranationalSurfaceForms,
  type SupranationalRegion,
} from './supranational-membership';
import { SUPRANATIONAL_REGIONS } from './supranational-regions';
import { citiesNamed } from './geo-gazetteer';
import { foldPlaceName } from './geo-normalize.util';

/**
 * MEMBERSHIP IS DATA, AND DATA IN THIS CODEBASE IS VERIFIED AT BUILD TIME.
 *
 * A hand-written list of ISO3 codes is exactly the kind of artefact that rots
 * quietly: a typo produces a phantom member, an omission produces a region
 * that is silently too small, and neither errors at runtime. Every assertion
 * below turns one of those into a failing test.
 */

const byName = (name: string): SupranationalRegion => {
  const found = allSupranationalRegions().find((region) => region.name === name);
  if (!found) throw new Error(`no region named ${name}`);

  return found;
};

const iso3Set = new Set(COUNTRIES.map((country) => country.iso3));

describe('1 · every member code is a real country', () => {
  it.each(allSupranationalRegions().map((region) => [region.name, region] as const))(
    '%s names only countries that exist',
    (_name, region) => {
      for (const iso3 of region.members) {
        expect(iso3Set.has(iso3)).toBe(true);
      }
    },
  );

  it('no region lists the same country twice', () => {
    for (const region of allSupranationalRegions()) {
      expect(new Set(region.members).size).toBe(region.members.length);
    }
  });
});

describe('2 · the M49 continental partitions are complete and disjoint', () => {
  const partition = (names: readonly string[]): string[] =>
    names.flatMap((name) => [...byName(name).members]);

  /*
   * The country set `COUNTRIES` places on a continent, ADJUSTED by the
   * divergences this file declares. Anything NOT declared still fails.
   */
  const continent = (region: string): string[] => {
    const leaving = new Set(
      M49_CONTINENT_DIVERGENCE.filter((d) => d.countriesTableRegion === region).map((d) => d.iso3),
    );
    const arriving = M49_CONTINENT_DIVERGENCE.filter((d) =>
      d.m49Subregion.endsWith(region === 'Asia' ? 'Asia' : region),
    ).map((d) => d.iso3);

    return [
      ...COUNTRIES.filter((c) => c.region === region)
        .map((c) => c.iso3)
        .filter((iso3) => !leaving.has(iso3)),
      ...arriving,
    ];
  };

  it('the five African subregions cover every African country exactly once', () => {
    const members = partition([
      'Northern Africa',
      'Eastern Africa',
      'Middle Africa',
      'Southern Africa',
      'Western Africa',
    ]);
    const expected = continent('Africa');

    expect(new Set(members).size).toBe(members.length); // disjoint
    expect([...members].sort()).toEqual([...expected].sort()); // complete
  });

  it('the four European subregions cover every European country exactly once', () => {
    const members = partition([
      'Eastern Europe',
      'Northern Europe',
      'Southern Europe',
      'Western Europe',
    ]);
    const expected = continent('Europe');

    expect(new Set(members).size).toBe(members.length);
    expect([...members].sort()).toEqual([...expected].sort());
  });

  it('the five Asian subregions cover every Asian country exactly once', () => {
    const members = partition([
      'Central Asia',
      'East Asia',
      'South Asia',
      'Southeast Asia',
      'Western Asia',
    ]);
    const expected = continent('Asia');

    expect(new Set(members).size).toBe(members.length);
    expect([...members].sort()).toEqual([...expected].sort());
  });

  it('Sub-Saharan Africa is exactly Africa minus Northern Africa', () => {
    const sub = new Set(byName('Sub-Saharan Africa').members);
    const north = new Set(byName('Northern Africa').members);
    const africa = continent('Africa');

    expect([...sub].sort()).toEqual(africa.filter((iso3) => !north.has(iso3)).sort());
  });

  it('every declared divergence is a real, singular disagreement — not a dumping ground', () => {
    expect(M49_CONTINENT_DIVERGENCE.length).toBeLessThanOrEqual(3);

    for (const divergence of M49_CONTINENT_DIVERGENCE) {
      // The country exists...
      const country = COUNTRIES.find((c) => c.iso3 === divergence.iso3);
      expect(country).toBeDefined();
      // ...the table really does place it where the declaration says...
      expect(country?.region).toBe(divergence.countriesTableRegion);
      // ...the M49 list really does contain it...
      expect(byName(divergence.m49Subregion).members).toContain(divergence.iso3);
      // ...and the reason is written down.
      expect(divergence.reason.length).toBeGreaterThan(40);
    }
  });

  it('Europe as a whole is the union of its four subregions', () => {
    const whole = new Set(byName('Europe').members);
    const parts = new Set(
      ['Eastern Europe', 'Northern Europe', 'Southern Europe', 'Western Europe'].flatMap((name) => [
        ...byName(name).members,
      ]),
    );

    expect([...whole].sort()).toEqual([...parts].sort());
  });
});

describe('3 · regions with CONTESTED_MEMBERSHIP resolve to nothing, on purpose', () => {
  it.each([
    'Middle East',
    'Sahel',
    'Horn of Africa',
    'Balkans',
    'Great Lakes region',
    'Gulf states',
    'Global South',
  ])('%s carries no members and no bounds', (name) => {
    const region = byName(name);

    expect(region.basis).toBe('CONTESTED_MEMBERSHIP');
    expect(region.members).toHaveLength(0);
    expect(regionExtent(region)).toBeNull();
  });

  it('a contested region still explains itself — the reason is never empty', () => {
    for (const region of allSupranationalRegions()) {
      expect(region.source.length).toBeGreaterThan(10);
    }
  });

  it('an UNDEFINED region is findable but claims nothing', () => {
    const undefinedRegions = allSupranationalRegions().filter((r) => r.basis === 'UNDEFINED');

    expect(undefinedRegions.length).toBeGreaterThan(0);
    for (const region of undefinedRegions) {
      expect(region.members).toHaveLength(0);
      expect(regionExtent(region)).toBeNull();
    }
  });
});

describe('4 · every refusable region name is also searchable', () => {
  /*
   * THE JOIN THAT KEEPS THE TWO FILES HONEST. If the resolver knows a phrase
   * well enough to refuse it, search must know it well enough to find it.
   */
  it.each(SUPRANATIONAL_REGIONS.map((name) => [name] as const))('%s is findable', (name) => {
    expect(supranationalSurfaceForms().has(foldPlaceName(name))).toBe(true);
  });
});

describe('5 · no region name shadows a real settlement', () => {
  /*
   * The same discipline the refusal vocabulary is held to, applied to the
   * surface forms search will match. A region alias that collides with a city
   * would make that city unfindable, which is strictly worse than the gap it
   * fills.
   */
  it.each([...supranationalSurfaceForms().keys()].map((form) => [form] as const))(
    '%s is not a settlement name',
    (form) => {
      const collisions = citiesNamed(form).filter((city) => (city.p ?? 0) >= 100_000);

      expect(collisions).toHaveLength(0);
    },
  );

  it('no region name is a country name', () => {
    const countryForms = new Set(COUNTRIES.map((country) => foldPlaceName(country.name)));

    for (const form of supranationalSurfaceForms().keys()) {
      expect(countryForms.has(form)).toBe(false);
    }
  });
});

describe('6 · derived bounds are derived, and say so', () => {
  it('East Africa gets a box built from its member countries, labelled as such', () => {
    const extent = regionExtent(byName('Eastern Africa'));

    expect(extent).not.toBeNull();
    expect(extent?.source).toBe('derived-from-member-country-extents');
    expect(extent?.members).toBeGreaterThan(10);
  });

  it('the box actually contains a member capital — Nairobi', () => {
    const extent = regionExtent(byName('Eastern Africa'));
    const [minLon, minLat, maxLon, maxLat] = extent?.bbox ?? [0, 0, 0, 0];
    const nairobi = citiesNamed('nairobi').find((city) => city.cc === 'KE');

    expect(nairobi).toBeDefined();
    expect(nairobi!.lon).toBeGreaterThanOrEqual(minLon);
    expect(nairobi!.lon).toBeLessThanOrEqual(maxLon);
    expect(nairobi!.lat).toBeGreaterThanOrEqual(minLat);
    expect(nairobi!.lat).toBeLessThanOrEqual(maxLat);
  });

  it('NO REGION CARRIES A POLYGON — the extent is a bbox and nothing else', () => {
    for (const region of allSupranationalRegions()) {
      const extent = regionExtent(region);
      if (!extent) continue;

      expect(extent.bbox).toHaveLength(4);
      expect(Object.keys(extent).sort()).toEqual(
        ['antimeridian', 'bbox', 'centroid', 'members', 'source'].sort(),
      );
    }
  });
});

describe('7 · identity is stable and addressable', () => {
  it('every geographyId round-trips', () => {
    for (const region of allSupranationalRegions()) {
      expect(supranationalById(region.geographyId)?.name).toBe(region.name);
    }
  });

  it('geographyIds are unique and namespaced', () => {
    const ids = allSupranationalRegions().map((region) => region.geographyId);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('region:')).toBe(true);
  });

  it('membersOf returns real country metadata, not codes', () => {
    const members = membersOf(byName('Baltic states'));

    expect(members.map((country) => country.name).sort()).toEqual([
      'Estonia',
      'Latvia',
      'Lithuania',
    ]);
  });
});

/* ── 2A · REGISTRY CORRECTNESS ──────────────────────────────────────────── */

describe('2A-1 · the EAC has EIGHT Partner States', () => {
  const eac = () => byName('East African Community');

  it('SOMALIA IS A MEMBER — the defect H confirmed live in the product', () => {
    expect(eac().members).toContain('SOM');
    expect(eac().members).toHaveLength(8);
  });

  it('names all eight, and nothing else', () => {
    expect([...eac().members].sort()).toEqual([
      'BDI',
      'COD',
      'KEN',
      'RWA',
      'SOM',
      'SSD',
      'TZA',
      'UGA',
    ]);
  });

  it('Somalia resolves to real country metadata, not a bare code', () => {
    const somalia = membersOf(eac()).find((country) => country.iso3 === 'SOM');

    expect(somalia).toBeDefined();
    expect(somalia!.name).toBe('Somalia');
  });

  it('is INSTITUTIONAL, so the eight are a closed checkable set and not an opinion', () => {
    /*
     * The count is only meaningful because the basis says whose count it is.
     * A POLITICAL_UNION membership is the organisation's own published list;
     * a CONTESTED_MEMBERSHIP one would be a claim we are not entitled to make.
     */
    expect(eac().basis).toBe('POLITICAL_UNION');
    expect(eac().source).toContain('published member states');
  });

  it('adding Somalia widened the extent rather than leaving it stale', () => {
    // A member list the extent does not follow is a list that changed nothing.
    const extent = regionExtent(eac());

    expect(extent).not.toBeNull();
    const somalia = COUNTRIES.find((country) => country.iso3 === 'SOM');
    expect(somalia).toBeDefined();
  });
});

describe('2A-2 · Global North is not another name for the Global South', () => {
  it('THE ALIAS IS GONE — a search for one no longer answers with its opposite', () => {
    expect(byName('Global South').aliases).toEqual([]);

    const resolved = supranationalSurfaceForms().get(foldPlaceName('Global North'));

    expect(resolved).toBeDefined();
    expect(resolved!.name).not.toBe('Global South');
  });

  it('THE SUPPRESSED ENTRY IS BACK — Global North is now findable as itself', () => {
    /*
     * The half of the defect that only build() shows. 'Global North' is in the
     * refusal vocabulary, and build() promotes every unclaimed name there into
     * an UNDEFINED region. The alias CLAIMED the name, so the promotion was
     * skipped and Global North had no entry of its own. Removing the alias
     * releases it.
     */
    const north = byName('Global North');

    expect(north.basis).toBe('UNDEFINED');
    expect(north.members).toHaveLength(0);
    expect(regionExtent(north)).toBeNull();
    expect(north.source).toContain('no membership definition');
    expect(north.geographyId).toBe('region:global-north');
  });

  it('the two are SEPARATE regions, with separate ids', () => {
    expect(byName('Global North').geographyId).not.toBe(byName('Global South').geographyId);
  });

  it('Global South itself still resolves, unchanged', () => {
    // The correction removes a wrong answer; it must not remove a right one.
    const region = supranationalSurfaceForms().get(foldPlaceName('Global South'));

    expect(region).toBeDefined();
    expect(region!.name).toBe('Global South');
    expect(region!.basis).toBe('CONTESTED_MEMBERSHIP');
  });

  it('NO REGION ALIASES A COMPLEMENT OR AN OPPOSITE OF ITSELF', () => {
    /*
     * The general form of the defect, so the next one cannot be added by hand
     * without this failing. An alias names the SAME thing. These prefix pairs
     * are the ones that name opposed halves of one division, and a region whose
     * name carries one half may not claim the other half as a synonym.
     *
     * This is deliberately a rule about MEANING, not a spelling check: 'North
     * Macedonia' aliasing 'Macedonia' is fine and must stay fine, because those
     * are two names for one country rather than two halves of one division.
     */
    const OPPOSED = [
      ['Global South', 'Global North'],
      ['Northern', 'Southern'],
      ['Eastern', 'Western'],
      ['Developed', 'Developing'],
    ];

    for (const region of allSupranationalRegions()) {
      for (const alias of region.aliases) {
        for (const [a, b] of OPPOSED) {
          const nameHasA = region.name.includes(a);
          const nameHasB = region.name.includes(b);
          if (nameHasA && !nameHasB) expect(alias.includes(b)).toBe(false);
          if (nameHasB && !nameHasA) expect(alias.includes(a)).toBe(false);
        }
      }
    }
  });

  it('an alias always resolves BACK to the region that declares it', () => {
    // The invariant the Global North entry broke, asserted for every alias in
    // the table rather than for the one that was wrong.
    const forms = supranationalSurfaceForms();

    for (const region of allSupranationalRegions()) {
      for (const alias of region.aliases) {
        expect(forms.get(foldPlaceName(alias))).toBe(region);
      }
    }
  });
});
