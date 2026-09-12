import { COUNTRIES, type CountryMeta } from '@globalnews-ai/shared';
import { SUPRANATIONAL_REGIONS } from './supranational-regions';
import { countryExtent, type DerivedExtent } from './geo-gazetteer';
import { foldGeographyIdSegment, foldPlaceName } from './geo-normalize.util';

/**
 * SUPRANATIONAL REGIONS — FROM REFUSAL-ONLY TO SEARCHABLE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS ADDS, AND WHAT IT REFUSES TO ADD
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `supranational-regions.ts` holds ~70 region NAMES and resolves none of them.
 * That was the honest half of the answer while no membership dataset existed:
 * recognise the phrase, refuse the resolution. It stays exactly as it is — this
 * file imports that list rather than restating it, so the two cannot drift.
 *
 * The Navigator now needs these regions to be SEARCHABLE — a reader typing
 * "East Africa" should land somewhere real. This file supplies the missing
 * half where, and ONLY where, an authoritative published definition exists.
 *
 * THREE THINGS THIS FILE WILL NOT DO:
 *
 *   1. IT DOES NOT INVENT A POLYGON. There is no region border here, no
 *      coastline, no simplified outline, no hand-drawn ring. Where bounds are
 *      emitted at all they are a BOUNDING BOX over the DERIVED EXTENTS of the
 *      member countries — the same `DerivedExtent` object, with the same
 *      "this is a camera target, not a border" contract, that the gazetteer
 *      already produces for countries and admin1 units. The source string says
 *      so on every one.
 *
 *   2. IT DOES NOT INVENT MEMBERSHIP. A region gets a member list only when a
 *      published standard defines one. Everything else is marked and served as
 *      having no defined membership, which is a fact about the world, not a
 *      gap in this file.
 *
 *   3. IT DOES NOT RESOLVE CONTESTED REGIONS TO A MEMBER SET. "Middle East"
 *      has no agreed membership — the sets used by the UN, the US State
 *      Department, and most newsrooms genuinely disagree about Egypt, Turkey,
 *      Iran, Afghanistan and the Maghreb. Picking one and serving it as fact
 *      would be exactly the confident-and-wrong failure this whole geographic
 *      foundation exists to remove. It is served as CONTESTED, searchable,
 *      identified, with no members and no bounds.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY MEMBERSHIP IS ENCODED BY ISO3 AND VERIFIED BY TEST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A hand-written country list is a data assertion, and data assertions in this
 * codebase are held to build-time verification — the exonym table is, the
 * supranational shadowing set is. The companion spec asserts that every ISO3
 * named here exists in `COUNTRIES`, that no country appears in two mutually
 * exclusive M49 subregions, and that the M49 subregions of a continent cover
 * every country `COUNTRIES` places on that continent. A typo, a phantom code
 * or an omission fails the suite rather than shipping as geography.
 */

/**
 * HOW A REGION'S MEMBER LIST WAS ARRIVED AT. Served on the wire, because a
 * consumer deciding whether to trust a member set needs to know where it came
 * from, and "the backend said so" is not a provenance.
 */
export type MembershipBasis =
  /** UN Statistics Division M49 standard geographic regions. */
  | 'UN_M49'
  /** Membership defined by a treaty organisation's own published member list. */
  | 'POLITICAL_UNION'
  /**
   * The name is in common journalistic use and has NO agreed membership.
   * Served with no members and no bounds, on purpose.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT CALLED 'CONTESTED'
   * ─────────────────────────────────────────────────────────────────────────
   *
   * Part IV v1.2 §14.1 rules that CONTESTED is already taken and that claims
   * about different things "cannot share a token". Two meanings were already
   * in play:
   *
   *   locationProvenance CONTESTED  the LOCATION was reached from disagreeing
   *                                 sources. User copy: CONTESTED-SOURCE.
   *   change state       DISPUTED   the ASSESSMENT is disputed. (Renamed from
   *                                 CONTESTED by §14.1 for exactly this reason.)
   *
   * This value was a THIRD claim about a FOURTH thing — the region's MEMBERSHIP
   * DEFINITION is disputed between authorities — wearing the same token. It is
   * now `CONTESTED_MEMBERSHIP`, which cannot be confused with either.
   *
   * The provenance enum is UNCHANGED. Nothing in this rename touches
   * `locationProvenance`.
   */
  | 'CONTESTED_MEMBERSHIP'
  /**
   * A real region name for which this file has not yet encoded a definition.
   * Distinct from CONTESTED: a definition may well exist, it is simply not
   * here. Also served with no members and no bounds.
   */
  | 'UNDEFINED';

export interface SupranationalRegion {
  /** Stable identity. `region:` + the folded canonical name. */
  readonly geographyId: string;
  /** Canonical display name. */
  readonly name: string;
  /** Other names that search must match. Never a country or settlement name. */
  readonly aliases: readonly string[];
  readonly basis: MembershipBasis;
  /** A citable statement of where the membership came from. Never empty. */
  readonly source: string;
  /** ISO 3166-1 alpha-3 members. EMPTY for CONTESTED and UNDEFINED. */
  readonly members: readonly string[];
}

/*
 * UN M49, THE SUBREGIONS. Encoded by ISO3 against the country set this product
 * actually holds. The companion spec proves the continental partitions are
 * complete and disjoint against `COUNTRIES`, so these lists are checked data
 * rather than remembered data.
 */
const M49 = 'UN Statistics Division, Standard Country or Area Codes for Statistical Use (M49)';

const AFRICA_NORTH = ['DZA', 'EGY', 'LBY', 'MAR', 'SDN', 'TUN'];
const AFRICA_EAST = [
  'BDI',
  'COM',
  'DJI',
  'ERI',
  'ETH',
  'KEN',
  /* Restored with the COUNTRIES row it depends on. Adding it to only one of
   * the two fails the partition assertion below, which is the intent. */
  'MDG',
  'MWI',
  'MUS',
  'MOZ',
  'RWA',
  'SYC',
  'SOM',
  'SSD',
  'UGA',
  'TZA',
  'ZMB',
  'ZWE',
];
const AFRICA_MIDDLE = ['AGO', 'CMR', 'CAF', 'TCD', 'COG', 'COD', 'GNQ', 'GAB', 'STP'];
const AFRICA_SOUTH = ['BWA', 'SWZ', 'LSO', 'NAM', 'ZAF'];
const AFRICA_WEST = [
  'BEN',
  'BFA',
  'CPV',
  'CIV',
  'GMB',
  'GHA',
  'GIN',
  'GNB',
  'LBR',
  'MLI',
  'MRT',
  'NER',
  'NGA',
  'SEN',
  'SLE',
  'TGO',
];

const EUROPE_EAST = ['BLR', 'BGR', 'CZE', 'HUN', 'POL', 'MDA', 'ROU', 'RUS', 'SVK', 'UKR'];
const EUROPE_NORTH = ['DNK', 'EST', 'FIN', 'ISL', 'IRL', 'LVA', 'LTU', 'NOR', 'SWE', 'GBR'];
const EUROPE_SOUTH = [
  'ALB',
  'AND',
  'BIH',
  'HRV',
  'GRC',
  'ITA',
  'MLT',
  'MNE',
  'MKD',
  'PRT',
  'SMR',
  'SRB',
  'SVN',
  'ESP',
  'VAT',
];
const EUROPE_WEST = ['AUT', 'BEL', 'FRA', 'DEU', 'LIE', 'LUX', 'MCO', 'NLD', 'CHE'];

const ASIA_CENTRAL = ['KAZ', 'KGZ', 'TJK', 'TKM', 'UZB'];
const ASIA_EAST = ['CHN', 'PRK', 'JPN', 'MNG', 'KOR', 'TWN'];
const ASIA_SOUTH = ['AFG', 'BGD', 'BTN', 'IND', 'IRN', 'MDV', 'NPL', 'PAK', 'LKA'];
const ASIA_SOUTHEAST = [
  'BRN',
  'KHM',
  'IDN',
  'LAO',
  'MYS',
  'MMR',
  'PHL',
  'SGP',
  'THA',
  'TLS',
  'VNM',
];
const ASIA_WEST = [
  'ARM',
  'AZE',
  'BHR',
  'CYP',
  'GEO',
  'IRQ',
  'ISR',
  'JOR',
  'KWT',
  'LBN',
  'OMN',
  'PSE',
  'QAT',
  'SAU',
  'SYR',
  'TUR',
  'ARE',
  'YEM',
];

/*
 * Treaty organisations. Membership here is the organisation's OWN published
 * member list, which is a fact with an owner rather than a geographic opinion.
 */
/*
 * EAC — EIGHT PARTNER STATES, NOT SEVEN.
 *
 * The EAC's own overview reads "a regional intergovernmental organisation of
 * eight (8) Partner States". Somalia was absent here, and the omission was not
 * cosmetic: it is the difference between Somalia being a member country of a
 * region the product can navigate and Somalia being outside it. H confirmed the
 * defect live in the running product, which resolved EAC as INSTITUTIONAL with
 * seven members.
 *
 * SOMALIA'S ACCESSION HAS THREE DATES AND A SINGLE `joined` FIELD WOULD
 * MISREPRESENT ALL THREE, so none is stored here and the three are recorded
 * instead, verified against EAC press releases:
 *
 *   24 Nov 2023  23rd Ordinary Summit, Arusha — resolves to admit
 *   15 Dec 2023  Treaty of Accession signed, Entebbe
 *    4 Mar 2024  instrument of ratification deposited — MEMBERSHIP TAKES EFFECT
 *
 * The deposit date is the operative one. Articles from the intervening window
 * are the ones a single date would misdate, which is why the distinction is
 * written down rather than resolved to a number.
 *
 * NO NEW DATA WAS NEEDED FOR THIS. 'SOM' was already in the country registry,
 * and the shipped gazetteer already carries Somalia's 18 admin1 units with
 * complete ISO 3166-2 coverage and 45 settlements — the same shape as Kenya and
 * Tanzania. The member list was the only thing standing between Somalia and the
 * treatment its seven partner states already get.
 */
const EAC = ['BDI', 'COD', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA'];
const EU = [
  'AUT',
  'BEL',
  'BGR',
  'HRV',
  'CYP',
  'CZE',
  'DNK',
  'EST',
  'FIN',
  'FRA',
  'DEU',
  'GRC',
  'HUN',
  'IRL',
  'ITA',
  'LVA',
  'LTU',
  'LUX',
  'MLT',
  'NLD',
  'POL',
  'PRT',
  'ROU',
  'SVK',
  'SVN',
  'ESP',
  'SWE',
];
/** The three Baltic states. Not a treaty body, but an undisputed closed set. */
const BALTIC = ['EST', 'LVA', 'LTU'];
/** Nordic Council members that are sovereign states. */
const NORDIC = ['DNK', 'FIN', 'ISL', 'NOR', 'SWE'];

/**
 * WHERE M49 AND THIS PRODUCT'S OWN COUNTRY TABLE DISAGREE ABOUT A CONTINENT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This set exists because the verification suite FOUND a disagreement rather
 * than because anyone anticipated one, and the shape of the fix matters:
 *
 *   M49 places CYPRUS in Western Asia.
 *   `shared/COUNTRIES` places Cyprus in Europe.
 *
 * Neither is wrong. M49 is a statistical standard with a geographic rule;
 * `COUNTRIES.region` is a coarse routing bucket that follows the country's
 * political and institutional alignment, and Cyprus is an EU member state. Two
 * authorities, two correct answers, one country.
 *
 * THE FIX IS NOT TO MOVE CYPRUS. Moving it into Southern Europe to satisfy the
 * partition test would silently corrupt an M49 list — the member set would no
 * longer be the thing its `source` field claims it is, which is the precise
 * failure mode this file's provenance fields exist to prevent.
 *
 * So the divergence is DECLARED, exactly as `ACKNOWLEDGED_SUBDIVISION_SHADOWING`
 * declares a knowing collision. The partition test subtracts what is declared
 * here and still fails on anything undeclared, so the next disagreement cannot
 * arrive unnoticed.
 */
export const M49_CONTINENT_DIVERGENCE: readonly {
  readonly iso3: string;
  readonly m49Subregion: string;
  readonly countriesTableRegion: string;
  readonly reason: string;
}[] = [
  {
    iso3: 'CYP',
    m49Subregion: 'Western Asia',
    countriesTableRegion: 'Europe',
    reason:
      'M49 assigns Cyprus to Western Asia on geographic grounds; the product country table assigns it to Europe on institutional grounds (EU member state). Both are defensible; the M49 list is kept M49-accurate.',
  },
];

interface Definition {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly basis: MembershipBasis;
  readonly source: string;
  readonly members: readonly string[];
}

const DEFINITIONS: readonly Definition[] = [
  // ── Africa ────────────────────────────────────────────────────────────────
  {
    name: 'Eastern Africa',
    aliases: ['East Africa'],
    basis: 'UN_M49',
    source: M49,
    members: AFRICA_EAST,
  },
  {
    name: 'Western Africa',
    aliases: ['West Africa'],
    basis: 'UN_M49',
    source: M49,
    members: AFRICA_WEST,
  },
  {
    name: 'Northern Africa',
    aliases: ['North Africa'],
    basis: 'UN_M49',
    source: M49,
    members: AFRICA_NORTH,
  },
  {
    name: 'Middle Africa',
    aliases: ['Central Africa'],
    basis: 'UN_M49',
    source: M49,
    members: AFRICA_MIDDLE,
  },
  { name: 'Southern Africa', aliases: [], basis: 'UN_M49', source: M49, members: AFRICA_SOUTH },
  {
    name: 'Sub-Saharan Africa',
    aliases: [],
    basis: 'UN_M49',
    source: M49,
    members: [...AFRICA_EAST, ...AFRICA_MIDDLE, ...AFRICA_SOUTH, ...AFRICA_WEST],
  },
  {
    name: 'East African Community',
    aliases: ['EAC'],
    basis: 'POLITICAL_UNION',
    source: 'East African Community, published member states',
    members: EAC,
  },

  // ── Europe ────────────────────────────────────────────────────────────────
  { name: 'Eastern Europe', aliases: [], basis: 'UN_M49', source: M49, members: EUROPE_EAST },
  { name: 'Northern Europe', aliases: [], basis: 'UN_M49', source: M49, members: EUROPE_NORTH },
  { name: 'Southern Europe', aliases: [], basis: 'UN_M49', source: M49, members: EUROPE_SOUTH },
  { name: 'Western Europe', aliases: [], basis: 'UN_M49', source: M49, members: EUROPE_WEST },
  {
    name: 'Europe',
    aliases: [],
    basis: 'UN_M49',
    source: M49,
    members: [...EUROPE_EAST, ...EUROPE_NORTH, ...EUROPE_SOUTH, ...EUROPE_WEST],
  },
  {
    name: 'European Union',
    aliases: ['EU'],
    basis: 'POLITICAL_UNION',
    source: 'European Union, published member states',
    members: EU,
  },
  {
    name: 'Baltic states',
    aliases: ['Baltic region', 'Baltics'],
    basis: 'POLITICAL_UNION',
    source: 'Estonia, Latvia and Lithuania — undisputed closed set',
    members: BALTIC,
  },
  {
    name: 'Nordic countries',
    aliases: ['Nordics'],
    basis: 'POLITICAL_UNION',
    source: 'Nordic Council, sovereign member states',
    members: NORDIC,
  },

  // ── Asia ──────────────────────────────────────────────────────────────────
  { name: 'Central Asia', aliases: [], basis: 'UN_M49', source: M49, members: ASIA_CENTRAL },
  {
    name: 'East Asia',
    aliases: ['Eastern Asia'],
    basis: 'UN_M49',
    source: M49,
    members: ASIA_EAST,
  },
  {
    name: 'South Asia',
    aliases: ['Southern Asia'],
    basis: 'UN_M49',
    source: M49,
    members: ASIA_SOUTH,
  },
  {
    name: 'Southeast Asia',
    aliases: ['South-East Asia', 'South-Eastern Asia'],
    basis: 'UN_M49',
    source: M49,
    members: ASIA_SOUTHEAST,
  },
  { name: 'Western Asia', aliases: [], basis: 'UN_M49', source: M49, members: ASIA_WEST },

  // ── Contested: named, searchable, and deliberately unresolved ─────────────
  /*
   * EVERY ONE OF THESE IS A REGION A READER WILL PLAUSIBLY TYPE, and every one
   * has no membership that a newsroom, the UN and a foreign ministry would all
   * sign. They are searchable — the reader finds the region and is told what it
   * is — and they carry no members and no bounds, which is the true answer.
   */
  {
    name: 'Middle East',
    aliases: ['Near East'],
    basis: 'CONTESTED_MEMBERSHIP',
    source:
      'No agreed membership. UN M49 has no "Middle East"; usage disagrees over Egypt, Turkey, Iran, Afghanistan and the Maghreb.',
    members: [],
  },
  {
    name: 'Sahel',
    aliases: [],
    basis: 'CONTESTED_MEMBERSHIP',
    source:
      'A climatic belt, not a political set; membership varies by source between 5 and 12 states.',
    members: [],
  },
  {
    name: 'Horn of Africa',
    aliases: [],
    basis: 'CONTESTED_MEMBERSHIP',
    source:
      'Core four (DJI, ERI, ETH, SOM) is common; wider usage adds Kenya, Sudan, South Sudan and Uganda.',
    members: [],
  },
  {
    name: 'Balkans',
    aliases: ['Western Balkans'],
    basis: 'CONTESTED_MEMBERSHIP',
    source:
      'Membership disputed for Slovenia, Croatia, Romania, Greece and Turkey depending on source.',
    members: [],
  },
  {
    name: 'Great Lakes region',
    aliases: [],
    basis: 'CONTESTED_MEMBERSHIP',
    source:
      'Usage varies between the ICGLR membership and a narrower Burundi/DRC/Rwanda/Uganda core.',
    members: [],
  },
  {
    name: 'Gulf states',
    aliases: ['Persian Gulf', 'Arabian Peninsula'],
    basis: 'CONTESTED_MEMBERSHIP',
    source:
      'GCC membership, littoral-state membership and peninsular membership are three different sets.',
    members: [],
  },
  {
    /*
     * `aliases: ['Global North']` WAS WRONG IN THE ONE DIRECTION THAT MATTERS.
     *
     * An alias is another NAME FOR THE SAME THING. Global North is not another
     * name for the Global South; it is, on most readings, its complement. The
     * entry therefore did not merely mislabel a synonym — it made a search for
     * "Global North" resolve to the Global South, which is to answer a question
     * with its opposite and present that as a match.
     *
     * AND IT WAS SUPPRESSING THE ENTRY THAT SHOULD HAVE EXISTED. This is the
     * half that is only visible from build(): 'Global North' is already in the
     * refusal vocabulary in supranational-regions.ts, and build() promotes every
     * name in that vocabulary which no definition CLAIMS into an UNDEFINED
     * region — findable, and claiming nothing it has not earned. The alias put
     * 'Global North' into `claimed`, so that promotion was skipped and the name
     * had no region of its own to be found as.
     *
     * So removing the alias does not leave a hole. It releases the name, and
     * 'Global North' now enters as UNDEFINED in its own right. Measured:
     *
     *   before   "Global North" -> the Global South region     (its opposite)
     *   after    "Global North" -> the Global North region     (UNDEFINED,
     *                              no members, no bounds, and a source string
     *                              saying no membership definition is encoded)
     *
     * A defined Global North may be added later on its own merits, as a
     * CONTESTED_MEMBERSHIP region with its own source. Never as an alias of
     * this one.
     */
    name: 'Global South',
    aliases: [],
    basis: 'CONTESTED_MEMBERSHIP',
    source: 'An analytical category with no membership list of record.',
    members: [],
  },
];

let index: Map<string, SupranationalRegion> | undefined;
let ordered: SupranationalRegion[] | undefined;

function idFor(name: string): string {
  return `region:${foldGeographyIdSegment(name)}`;
}

function build(): void {
  if (index && ordered) return;

  const byId = new Map<string, SupranationalRegion>();
  const list: SupranationalRegion[] = [];

  for (const def of DEFINITIONS) {
    const region: SupranationalRegion = {
      geographyId: idFor(def.name),
      name: def.name,
      aliases: def.aliases,
      basis: def.basis,
      source: def.source,
      members: def.members,
    };
    byId.set(region.geographyId, region);
    list.push(region);
  }

  /*
   * EVERY NAME IN THE REFUSAL VOCABULARY IS SEARCHABLE, defined or not.
   *
   * This is the join that keeps the two files honest. A region already known
   * well enough to be REFUSED must also be known well enough to be FOUND —
   * otherwise search silently holds a smaller world than the resolver does, and
   * a reader typing a phrase the resolver recognises gets nothing back. Names
   * not covered by a definition above enter as UNDEFINED: identified, findable,
   * and carrying nothing they have not earned.
   */
  const claimed = new Set<string>();
  for (const region of list) {
    claimed.add(foldPlaceName(region.name));
    for (const alias of region.aliases) claimed.add(foldPlaceName(alias));
  }

  for (const name of SUPRANATIONAL_REGIONS) {
    if (claimed.has(foldPlaceName(name))) continue;

    const region: SupranationalRegion = {
      geographyId: idFor(name),
      name,
      aliases: [],
      basis: 'UNDEFINED',
      source: 'Recognised region name; no membership definition encoded.',
      members: [],
    };
    if (!byId.has(region.geographyId)) {
      byId.set(region.geographyId, region);
      list.push(region);
    }
  }

  index = byId;
  ordered = list;
}

export function allSupranationalRegions(): readonly SupranationalRegion[] {
  build();

  return ordered as SupranationalRegion[];
}

export function supranationalById(geographyId: string): SupranationalRegion | undefined {
  build();

  return index?.get(geographyId);
}

/** Every searchable surface form of a region: its name and each alias, folded. */
export function supranationalSurfaceForms(): ReadonlyMap<string, SupranationalRegion> {
  build();

  const forms = new Map<string, SupranationalRegion>();
  for (const region of ordered as SupranationalRegion[]) {
    forms.set(foldPlaceName(region.name), region);
    for (const alias of region.aliases) forms.set(foldPlaceName(alias), region);
  }

  return forms;
}

export function membersOf(region: SupranationalRegion): readonly CountryMeta[] {
  const wanted = new Set(region.members);

  return COUNTRIES.filter((country) => wanted.has(country.iso3));
}

/**
 * A CAMERA TARGET FOR A REGION, DERIVED AND LABELLED AS SUCH.
 *
 * This is a union of the member countries' own derived extents — themselves
 * bounding boxes over settlements, never borders. It is emitted ONLY when
 * membership is defined; a CONTESTED or UNDEFINED region gets null, because a
 * box around an unagreed set of countries is an unagreed box.
 *
 * THE ANTIMERIDIAN IS NOT GUESSED AT. If any member spans it, or if the union
 * is wider than 180 degrees of longitude, the flag is set and the consumer must
 * not fit the box naively — the same contract the gazetteer's own extents carry.
 */
export function regionExtent(region: SupranationalRegion): DerivedExtent | null {
  if (region.members.length === 0) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  let members = 0;
  let antimeridian = false;

  for (const iso3 of region.members) {
    const country = COUNTRIES.find((candidate) => candidate.iso3 === iso3);
    if (!country) continue;

    const extent = countryExtent(country.iso2);
    if (!extent) continue;

    members += 1;
    if (extent.antimeridian) antimeridian = true;

    const [aMinLon, aMinLat, aMaxLon, aMaxLat] = extent.bbox;
    minLon = Math.min(minLon, aMinLon);
    minLat = Math.min(minLat, aMinLat);
    maxLon = Math.max(maxLon, aMaxLon);
    maxLat = Math.max(maxLat, aMaxLat);
  }

  if (members === 0) return null;

  if (maxLon - minLon > 180) antimeridian = true;

  return {
    bbox: [minLon, minLat, maxLon, maxLat],
    centroid: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
    members,
    antimeridian,
    source: 'derived-from-member-country-extents',
  };
}
