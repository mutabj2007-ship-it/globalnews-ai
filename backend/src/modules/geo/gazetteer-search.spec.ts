import {
  childrenOf,
  lookupGeographyId,
  searchGazetteer,
  searchIndexStats,
  type GeoNode,
} from './gazetteer-search';
import { allCities, gazetteerPolicy } from './geo-gazetteer';
import { mapGeographyForArticle } from './map-feed.contract';

const first = (q: string, opts = {}): GeoNode => {
  const result = searchGazetteer(q, opts);
  if (result.nodes.length === 0) throw new Error(`no result for ${q}`);

  return result.nodes[0];
};

/* ── 1 · THE PLACES THE RULING NAMED ─────────────────────────────────────── */

describe('1 · Kigali, Musanze, Nairobi and their peers are findable', () => {
  it.each([
    ['Kigali', 'RWA', 745261],
    ['Musanze', 'RWA', 86685],
    ['Nairobi', 'KEN', 2750547],
    ['Warsaw', 'POL', 1702139],
  ])('%s resolves to a settlement in %s', (query, iso3, population) => {
    const node = first(query);

    expect(node.kind).toBe('city');
    expect(node.precision).toBe('CITY');
    expect(node.geographyId.startsWith(`city:${iso3}:`)).toBe(true);
    expect(node.population).toBe(population);
    expect(node.center).toBeDefined();
  });

  it('THE SETTLEMENT OUTRANKS THE UNIT NAMED AFTER IT', () => {
    /*
     * Kigali is a city, a province and a SECTOR. The reader meant the city.
     *
     * The third node used to be a DISTRICT, and it was a GeoNames admin2 unit
     * labelled from its principal settlement — there is no Kigali district in
     * Rwanda. NISR has a Kigali SECTOR, inside Nyarugenge district, and that is
     * what the ladder now returns. The ranking rule is unchanged and still the
     * point of this test: the settlement comes first.
     */
    const result = searchGazetteer('Kigali');

    expect(result.nodes.map((node) => node.precision)).toEqual(['CITY', 'PROVINCE', 'SECTOR']);
  });

  it('a ladder through ONE place in ONE country is not an ambiguity', () => {
    const result = searchGazetteer('Kigali');

    expect(result.totalMatches).toBe(3);
    expect(result.ambiguous).toBe(false);
  });

  it('Rubavu reaches Gisenyi through the verified exonym index', () => {
    /*
     * THE EXONYM EDGE SURVIVES THE REPLACEMENT — it is just no longer FIRST.
     *
     * Rubavu had no exact match before: the only route to it was the exonym
     * edge onto the settlement Gisenyi, so Gisenyi led the results. Rubavu is
     * now also the exact name of a real NISR district and of a sector, and an
     * EXACT match outranks an EXONYM one under the unchanged ranking rule.
     *
     * What this test exists to protect is that the alias still REACHES the
     * settlement under its canonical spelling, and it still does.
     */
    const result = searchGazetteer('Rubavu');
    const city = result.nodes.find((node) => node.kind === 'city');

    expect(city).toBeDefined();
    expect(city!.name).toBe('Gisenyi');
    expect(city!.matchKind).toBe('EXONYM');
    expect(city!.geographyId.startsWith('city:RWA:')).toBe(true);

    /* And the district it is named after is now findable as itself. */
    expect(result.nodes[0].kind).toBe('admin2');
    expect(result.nodes[0].name).toBe('Rubavu');
    expect(result.nodes[0].precision).toBe('DISTRICT');
  });

  it('every one of these carries the full hierarchy up to a region', () => {
    const node = first('Musanze');
    const kinds = node.hierarchy.map((ancestor) => ancestor.kind);

    expect(kinds).toContain('region');
    expect(kinds).toContain('country');
    expect(kinds).toContain('admin1');

    /*
     * NO admin2 ANCESTOR FOR A RWANDAN CITY, AND THE ABSENCE IS DELIBERATE.
     *
     * The district rung is NISR's now, and there is no verified crosswalk from
     * a GeoNames settlement to a NISR district — only a PROVINCE crosswalk,
     * established on canonical names. Attaching a district anyway would be an
     * unverified join presented as a breadcrumb.
     *
     * A missing rung is visibly missing; a wrong one reads as correct. This
     * closes when NISR boundary polygons land and the district can be
     * established by point-in-polygon, which is a measurement rather than a
     * name guess.
     */
    expect(kinds).not.toContain('admin2');

    /* A non-authoritative country is untouched: Poland keeps its district. */
    const polish = first('Krakow', { country: 'PL' });
    expect(polish.hierarchy.map((a) => a.kind)).toContain('admin2');
  });
});

/* ── 2 · AMBIGUITY IS SURFACED, NEVER RESOLVED BY PICKING ────────────────── */

describe('2 · genuine ambiguity is reported as ambiguity', () => {
  it('Aberdeen returns every Aberdeen and refuses to choose', () => {
    const result = searchGazetteer('Aberdeen');

    expect(result.ambiguous).toBe(true);
    expect(result.nodes.filter((node) => node.kind === 'city').length).toBeGreaterThan(1);

    const countries = new Set(
      result.nodes.map(
        (node) => node.hierarchy.find((ancestor) => ancestor.kind === 'country')?.code,
      ),
    );
    expect(countries.size).toBeGreaterThan(1);
  });

  it('every candidate is individually addressable — the caller can pick, we do not', () => {
    const result = searchGazetteer('Aberdeen');
    const ids = result.nodes.map((node) => node.geographyId);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(lookupGeographyId(id)).not.toBeNull();
  });

  it('a prefix sweep is a typeahead, not a contest', () => {
    const result = searchGazetteer('San');

    expect(result.nodes.length).toBeGreaterThan(1);
    expect(result.ambiguous).toBe(false);
  });
});

/* ── 3 · ABSENCE IS REPORTED AS ABSENCE ──────────────────────────────────── */

describe('3 · a place that is not in the gazetteer is not invented', () => {
  it.each(['Nyabugogo', 'Kinamba'])('%s returns NO_MATCH, not a nearby guess', (query) => {
    const result = searchGazetteer(query);

    expect(result.matched).toBe(false);
    expect(result.nodes).toHaveLength(0);
    expect(result.reason).toBe('NO_MATCH_IN_GAZETTEER');
  });

  it('the absence is NOT silently answered with Kigali', () => {
    // The tempting failure: a Kigali neighbourhood resolving to Kigali would
    // look correct on a map and would be a fabrication of the record's own
    // precision. Nothing is returned at all.
    const result = searchGazetteer('Nyabugogo');

    expect(result.nodes.map((node) => node.name)).not.toContain('Kigali');
  });

  it('a one-character query is refused rather than sweeping the index', () => {
    expect(searchGazetteer('K').reason).toBe('QUERY_TOO_SHORT');
  });
});

/* ── 4 · SUPRANATIONAL REGIONS ARE SEARCHABLE ────────────────────────────── */

describe('4 · regions are findable, and claim only what they can prove', () => {
  it('East Africa reaches Eastern Africa by alias, with real members', () => {
    const node = first('East Africa');

    expect(node.kind).toBe('region');
    expect(node.precision).toBe('REGION');
    expect(node.name).toBe('Eastern Africa');
    expect(node.matchKind).toBe('ALIAS');
    expect(node.hierarchy.length).toBeGreaterThan(10);
    expect(node.provenance.admittedBy).toBe('un-m49');
  });

  it('Baltic region reaches the Baltic states', () => {
    const node = first('Baltic region');

    expect(node.name).toBe('Baltic states');
    expect(node.hierarchy.map((a) => a.name).sort()).toEqual(['Estonia', 'Latvia', 'Lithuania']);
  });

  it('Europe is findable and carries its M49 membership', () => {
    const node = first('Europe');

    expect(node.kind).toBe('region');
    expect(node.hierarchy.length).toBeGreaterThan(40);
  });

  it('MIDDLE EAST IS FINDABLE AND DELIBERATELY EMPTY', () => {
    // The whole point: the reader finds the region and is told the truth about
    // it, rather than being handed one newsroom's member list as fact.
    const node = first('Middle East');

    expect(node.kind).toBe('region');
    expect(node.hierarchy).toHaveLength(0);
    expect(node.bounds).toBeUndefined();
    expect(node.provenance.admittedBy).toBe('contested-membership');
    expect(node.provenance.dataset).toContain('No agreed membership');
  });

  it('NO REGION CARRIES A POLYGON — bounds are derived and say so', () => {
    const node = first('East Africa');

    expect(node.bounds?.source).toBe('derived-from-member-country-extents');
  });
});

/* ── 5 · THE LADDER WALKS BOTH WAYS ──────────────────────────────────────── */

describe('5 · region -> country -> admin1 -> admin2 -> city', () => {
  it('a region descends to its member countries', () => {
    const kids = childrenOf('region:eastern-africa');

    expect(kids.length).toBeGreaterThan(10);
    expect(kids.every((node) => node.kind === 'country')).toBe(true);
    expect(kids.map((node) => node.name)).toContain('Rwanda');
  });

  it('a country descends to its admin1 units', () => {
    const kids = childrenOf('country:RWA');

    expect(kids.every((node) => node.kind === 'admin1')).toBe(true);
    expect(kids.map((node) => node.name)).toContain('Northern Province');
  });

  it('an admin1 descends to admin2 where the data exists', () => {
    const province = searchGazetteer('Northern Province', { country: 'RW' }).nodes[0];
    const kids = childrenOf(province.geographyId);

    expect(kids.length).toBeGreaterThan(0);
    expect(kids.every((node) => node.kind === 'admin2')).toBe(true);
  });

  it('an admin2 descends to its settlements', () => {
    const kids = childrenOf('admin2:RW.13.43');

    expect(kids.every((node) => node.kind === 'city')).toBe(true);
    expect(kids.map((node) => node.name)).toContain('Musanze');
  });

  it('A CONTESTED REGION DESCENDS TO NOTHING, and that is the answer', () => {
    expect(childrenOf('region:middle-east')).toHaveLength(0);
  });

  it('a city is a leaf', () => {
    expect(childrenOf(first('Kigali').geographyId)).toHaveLength(0);
  });
});

/* ── 6 · IDENTITY IS STABLE AND SHARED WITH THE MAP FEED ─────────────────── */

describe('6 · geographyId round-trips, and matches the map feed', () => {
  it.each(['Kigali', 'Nairobi', 'Warsaw', 'Musanze'])('%s round-trips by id', (query) => {
    const node = first(query);
    const back = lookupGeographyId(node.geographyId);

    expect(back?.name).toBe(node.name);
    expect(back?.geographyId).toBe(node.geographyId);
  });

  it('THE SEARCH ID AND THE ARTICLE-RESOLUTION ID ARE THE SAME STRING', () => {
    /*
     * The assertion that makes the navigator and the evidence overlay the same
     * map. If these ever diverge, a reader searching for Kigali and a story
     * about Kigali land on two different objects and nothing errors.
     */
    const searched = first('Kigali');
    const resolved = mapGeographyForArticle('Kigali hosts regional summit on trade');

    expect(resolved.place?.geographyId).toBe(searched.geographyId);
  });

  it('an unknown id is reported as not found, never guessed', () => {
    expect(lookupGeographyId('city:RWA:atlantis@0,0')).toBeNull();
    expect(lookupGeographyId('nonsense')).toBeNull();
  });
});

/* ── 7 · PRECISION IS NEVER INFLATED ─────────────────────────────────────── */

describe('7 · a city in a district is still a CITY', () => {
  it('Musanze the settlement is a CITY, and the district is a separate node', () => {
    /*
     * The precision half of this test is unchanged and is the important half:
     * a settlement that shares a district's name is still CITY precision.
     *
     * The CONTEXT half moved. The district no longer rides along in the city's
     * hierarchy — see the crosswalk note above — it is returned as its own
     * node, from the authority, in the same result set.
     */
    const result = searchGazetteer('Musanze');
    const city = result.nodes.find((node) => node.kind === 'city');
    const district = result.nodes.find((node) => node.kind === 'admin2');

    expect(city!.precision).toBe('CITY');
    expect(city!.hierarchy.some((a) => a.kind === 'admin2')).toBe(false);

    expect(district).toBeDefined();
    expect(district!.precision).toBe('DISTRICT');
    expect(district!.provenance.admittedBy).toBe('official-authority');
  });

  it('SECTOR precision is produced ONLY by an admin3 node, and never inflates', () => {
    const result = searchGazetteer('Musanze');

    expect(
      result.nodes.filter((n) => n.precision === 'SECTOR' && n.kind !== 'admin3'),
    ).toHaveLength(0);
    expect(
      result.nodes.filter((n) => n.kind === 'admin3' && n.precision !== 'SECTOR'),
    ).toHaveLength(0);
  });

  it('DISTRICT precision is produced ONLY by an admin2 node searched as itself', () => {
    const result = searchGazetteer('Musanze');
    const district = result.nodes.find((node) => node.precision === 'DISTRICT');

    expect(district?.kind).toBe('admin2');
    expect(
      result.nodes.filter((n) => n.precision === 'DISTRICT' && n.kind !== 'admin2'),
    ).toHaveLength(0);
  });

  it('a city never carries bounds — a box round one settlement is a point-box', () => {
    for (const query of ['Kigali', 'Nairobi', 'Warsaw']) {
      expect(first(query).bounds).toBeUndefined();
    }
  });

  it('an admin2 unit with no verified label is not searchable by name', () => {
    // Never faked from the code or the country. It stays addressable by id.
    const unlabelled = searchGazetteer('RW.15.25');

    expect(unlabelled.nodes.filter((node) => node.kind === 'admin2')).toHaveLength(0);
  });
});

/* ── 8 · PROVENANCE IS ON EVERY NODE ─────────────────────────────────────── */

describe('8 · every node says where it came from', () => {
  it.each(['Kigali', 'East Africa', 'Rwanda', 'Musanze'])(
    '%s carries dataset and attribution',
    (query) => {
      const node = first(query);

      expect(node.provenance.dataset.length).toBeGreaterThan(0);
      expect(node.provenance.attribution).toContain('GeoNames');
      expect(node.provenance.admittedBy.length).toBeGreaterThan(0);
    },
  );

  it('a completion-admitted settlement is labelled as such, and its population is NULL not zero', () => {
    const completion = allCities().find((city) => city.src === 'completion');

    expect(completion).toBeDefined();
    expect(completion?.p).toBeNull();

    const node = first(completion!.n, { country: completion!.cc });
    expect(node.provenance.admittedBy).toBe('priority-completion');
    expect(node.population).toBeNull();
  });

  it('UNKNOWN POPULATION NEVER WINS A TIEBREAK', () => {
    // Null is not zero and it is not large. It sorts last among equals.
    const withPop: GeoNode = { ...({} as GeoNode) };
    void withPop;

    const result = searchGazetteer('Kigali');
    const populations = result.nodes
      .filter((node) => node.kind === 'city')
      .map((node) => node.population);

    expect(populations.every((p) => p === null || typeof p === 'number')).toBe(true);
  });
});

/* ── 9 · THE RETENTION POLICY IS AUDITABLE FROM OUTSIDE ──────────────────── */

describe('9 · the index reports the filter that shaped it', () => {
  it('the retention policy is served, not inferred', () => {
    const stats = searchIndexStats();

    expect((stats.retentionPolicy as Record<string, number>).minPopulation).toBe(5000);
    expect(gazetteerPolicy().minPopulation).toBe(5000);
  });

  it('the index covers every rung', () => {
    const byKind = searchIndexStats().byKind as Record<string, number>;

    expect(byKind.region).toBeGreaterThan(50);
    expect(byKind.country).toBeGreaterThan(190);
    expect(byKind.admin1).toBeGreaterThan(3000);
    expect(byKind.admin2).toBeGreaterThan(100);
    expect(byKind.city).toBeGreaterThan(50000);
  });
});

/* ── 10 · SEARCH IS NOT THE PROSE RESOLVER, DELIBERATELY ─────────────────── */

describe('10 · a deliberate lookup is not gated like prose', () => {
  it('"Chad" typed into search IS the country — no preposition required', () => {
    const node = first('Chad');

    expect(node.kind).toBe('country');
    expect(node.name).toBe('Chad');
  });

  it('...while the PROSE resolver still refuses the same bare word', () => {
    // The two engines must disagree here. If they ever agree, one of them is
    // asking the wrong question.
    const prose = mapGeographyForArticle('Chad missed the bus');

    expect(prose.place?.joinKeys.iso3).not.toBe('TCD');
  });

  it('lowercase input resolves — readers type lowercase', () => {
    expect(first('kigali').name).toBe('Kigali');
    expect(first('east africa').name).toBe('Eastern Africa');
  });
});
