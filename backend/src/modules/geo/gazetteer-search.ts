import { COUNTRIES, resolveCountryByAnyIdentifier, type CountryMeta } from '@globalnews-ai/shared';
import {
  GAZETTEER_ATTRIBUTION,
  allAdmin2,
  allCities,
  allExonyms,
  allRegions,
  countryExtent,
  gazetteerPolicy,
  gazetteerProvenance,
  regionFor,
  type DerivedExtent,
  type GazetteerAdmin2,
  type GazetteerCity,
  type GazetteerRegion,
} from './geo-gazetteer';
import { foldGeographyIdSegment, foldPlaceName } from './geo-normalize.util';
import { cleanSourceName } from './source-name-suffix';
import {
  ADMIN_NAME_CORRECTIONS,
  admin2Coverage,
  adminNameCorrectionFor,
} from './admin-name-corrections';
import {
  NISR,
  NISR_DISTRICT_PROVENANCE,
  NISR_SECTOR_PROVENANCE,
  nisrDistricts,
  nisrSectors,
  provinceIdForGeonamesCode,
  rwandaIdentityCoverage,
  type NisrDistrict,
  type NisrSector,
} from './rwanda-nisr.authority';
import { rwandaBoundaryCoverageResolved } from './rwanda-boundary-geometry';
import {
  allSupranationalRegions,
  membersOf,
  regionExtent,
  type SupranationalRegion,
} from './supranational-membership';

/**
 * THE DEEP GEOGRAPHIC NAVIGATOR — GAZETTEER SEARCH.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS MISSING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `GET /geo/gazetteer` served COUNTS. It could tell a caller that 51,057
 * settlements exist and not one of their names. Every other geographic surface
 * in the product resolves geography INCIDENTALLY — from a query, from an
 * article's text — and none of them answers the question a navigator asks,
 * which is simply: WHAT PLACES ARE THERE, AND WHERE DO THEY SIT?
 *
 * This is that lookup, over the whole ladder:
 *
 *     region -> country -> admin1 -> admin2 -> city
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT SEARCHES. IT DOES NOT INTERPRET.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This module has NO preposition gate, NO casing test, NO context requirement,
 * and it must never grow one. Those gates exist in `geo-resolver` because
 * resolving PROSE is a question about evidence — "Chad missed the bus" must not
 * become a camera over N'Djamena.
 *
 * A NAVIGATOR SEARCH IS NOT PROSE. A reader who types "Chad" into a place
 * search means the country, and applying an evidence gate to a deliberate
 * lookup would refuse the user's own explicit intent. The two callers ask
 * different questions and get different engines. What they SHARE is the
 * gazetteer, the fold, the identity scheme and the refusal to invent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT WILL NOT DO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   - It never invents a place. Absent from the gazetteer means absent from
 *     the results, with the reason stated.
 *   - It never invents a boundary. `bounds` is always the same DERIVED EXTENT
 *     object the rest of the system uses, carrying its own source string.
 *   - It never resolves ambiguity by picking. Aberdeen returns Aberdeen twice,
 *     with `ambiguous: true`, and the caller decides.
 *   - It never claims DISTRICT precision for a city. A city that SITS IN a
 *     district carries the district in its hierarchy as context; only a
 *     district searched as itself is a DISTRICT node.
 */

export type GeoNodeKind = 'region' | 'country' | 'admin1' | 'admin2' | 'admin3' | 'city';

/**
 * Design specification vocabulary. REGION is SUPRANATIONAL — above the country
 * — which is the sense the specification uses and the opposite of the everyday
 * "region means province" reading. DISTRICT is admin2.
 */
export type GeoNodePrecision =
  | 'REGION'
  | 'COUNTRY'
  | 'PROVINCE'
  | 'DISTRICT'
  | 'SECTOR'
  | 'CITY';

/** How the query text met this node. Ranked in this order. */
export type GeoMatchKind = 'EXACT' | 'ALIAS' | 'EXONYM' | 'PREFIX';

export interface GeoAncestor {
  readonly geographyId: string;
  readonly kind: GeoNodeKind;
  readonly name: string;
  /** ISO 3166-2 for admin1, GeoNames code for admin2, ISO3 for country. */
  readonly code?: string;
}

/**
 * WHERE THIS RECORD CAME FROM, ON THE WIRE.
 *
 * Provenance is not decoration here. Two settlements in the same response can
 * come from different datasets admitted under different rules — the priority
 * current-name completion has no population field at all — and a consumer
 * deciding how much to trust a record needs to see which.
 */
export interface GeoNodeProvenance {
  /** The dataset this record was admitted from. */
  readonly dataset: string;
  /** GeoNames feature code (PPLC, PPLA, PPLX…) where the record carries one. */
  readonly featureCode?: string;
  /** The rule that admitted it. */
  readonly admittedBy:
    | 'gazetteer'
    | 'priority-completion'
    | 'exonym-index'
    | 'iso3166-2'
    | 'derived-admin2'
    | 'un-m49'
    | 'political-union'
    /*
     * Renamed from 'contested-vocabulary' per Part IV v1.2 §14.1: CONTESTED is
     * already taken by locationProvenance, and a region whose MEMBERSHIP is
     * disputed is a different claim about a different thing.
     */
    | 'contested-membership'
    /*
     * Admitted from a named official administrative authority — NISR for
     * Rwanda. Distinct from 'derived-admin2', which means the opposite: a unit
     * whose label was inferred from a settlement. A consumer must be able to
     * tell an official district name from a derived one by reading the record.
     */
    | 'official-authority';
  /** For admin2 labels, which are derived and may be absent. */
  readonly labelSource?: string;
  /**
   * Why an administrative name differs from the artifact's derived label.
   * Present only on a node whose `labelSource` is 'current-name-corrected'.
   */
  readonly adminNameBasis?: string;
  /** CC BY 4.0 obligation. Present on every node. */
  readonly attribution: string;
}

export interface GeoNode {
  readonly geographyId: string;
  readonly kind: GeoNodeKind;
  readonly precision: GeoNodePrecision;
  /** Canonical name as the source spells it. NEVER derived, never rewritten. */
  readonly name: string;
  /**
   * R-GEO-NAME-SUFFIX — THE LABEL TO SHOW AND TO SEARCH BY.
   *
   * Equal to `name` for everything except the 113 admin1 records whose source
   * spelling ends in their OWN country — "Bari, Somalia" becomes "Bari".
   * "Fontana, Gozo" is deliberately NOT one of them; see source-name-suffix.ts
   * for the rule and the eight names it refuses to touch.
   *
   * ADDITIVE. `name` stays exactly what the source published and remains the
   * provenance answer, so a consumer that needs the source string still has it
   * and nothing was rewritten to produce this one.
   */
  readonly searchLabel: string;
  /** Verified other names. Never invented, never transliterated on the fly. */
  readonly aliases: readonly string[];
  /** The surface form the query actually matched. */
  readonly matchedOn: string;
  readonly matchKind: GeoMatchKind;
  /** Ancestors, coarsest first: region(s), country, admin1, admin2. */
  readonly hierarchy: readonly GeoAncestor[];
  /** [lon, lat]. Present for cities and for any node with a derived centroid. */
  readonly center?: readonly [number, number];
  /**
   * A DERIVED EXTENT AND NEVER A BORDER. Absent for cities, which are points.
   * Carries its own `source` saying what it was derived from.
   */
  readonly bounds?: DerivedExtent;
  /** Null means UNKNOWN and is not zero — see the gazetteer's note on `p`. */
  readonly population?: number | null;
  readonly provenance: GeoNodeProvenance;
}

export type GeoSearchRefusal =
  'QUERY_TOO_SHORT' | 'NO_MATCH_IN_GAZETTEER' | 'REGION_MEMBERSHIP_UNDEFINED';

export interface GeoSearchResponse {
  readonly query: string;
  readonly matched: boolean;
  /** True when more than one node matched at the SAME strength. */
  readonly ambiguous: boolean;
  readonly nodes: readonly GeoNode[];
  readonly totalMatches: number;
  /** Present only when `matched` is false. */
  readonly reason?: GeoSearchRefusal;
  readonly attribution: string;
}

export interface GeoSearchOptions {
  /** Restrict to one country. ISO2, ISO3 or a country name. */
  readonly country?: string;
  /** Restrict to one rung of the ladder. */
  readonly kind?: GeoNodeKind;
  /** Default 20, hard ceiling 100. */
  readonly limit?: number;
}

const MIN_QUERY_CHARS = 2;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/* ───────────────────────────── IDENTITY ────────────────────────────────── */

/**
 * IDENTITY MATCHES `map-feed.contract.ts` EXACTLY, and that is load-bearing.
 *
 * A node found through search and the same place resolved from an article must
 * carry the SAME `geographyId`, or the map cannot tell that the thing the
 * reader searched for is the thing the evidence is about. The city form
 * includes the point for the same reason it does there: 71 settlement names in
 * this gazetteer are duplicated within one country, so name plus country is not
 * unique and would silently merge two different towns.
 */
function cityId(city: GazetteerCity, country: CountryMeta): string {
  return `city:${country.iso3}:${foldGeographyIdSegment(city.n)}@${city.lat},${city.lon}`;
}

function admin1Id(region: GazetteerRegion, country: CountryMeta): string {
  return region.iso ? `admin1:${region.iso}` : `admin1:${country.iso3}:${region.a1}`;
}

function admin2Id(unit: GazetteerAdmin2): string {
  return `admin2:${unit.code}`;
}

function countryId(country: CountryMeta): string {
  return `country:${country.iso3}`;
}

/* ──────────────────────────── THE INDEX ────────────────────────────────── */

interface IndexEntry {
  readonly form: string;
  readonly kind: GeoNodeKind;
  readonly matchKind: GeoMatchKind;
  readonly city?: GazetteerCity;
  readonly region?: GazetteerRegion;
  readonly admin2?: GazetteerAdmin2;
  readonly nisrDistrict?: NisrDistrict;
  readonly nisrSector?: NisrSector;
  readonly country?: CountryMeta;
  readonly supranational?: SupranationalRegion;
}

let entries: IndexEntry[] | undefined;
let byForm: Map<string, IndexEntry[]> | undefined;
let sortedForms: string[] | undefined;

function buildIndex(): void {
  if (entries && byForm && sortedForms) return;

  const built: IndexEntry[] = [];
  const push = (entry: IndexEntry): void => {
    if (entry.form.length > 0) built.push(entry);
  };

  for (const region of allSupranationalRegions()) {
    push({
      form: foldPlaceName(region.name),
      kind: 'region',
      matchKind: 'EXACT',
      supranational: region,
    });
    for (const alias of region.aliases) {
      push({
        form: foldPlaceName(alias),
        kind: 'region',
        matchKind: 'ALIAS',
        supranational: region,
      });
    }
  }

  for (const country of COUNTRIES) {
    push({ form: foldPlaceName(country.name), kind: 'country', matchKind: 'EXACT', country });
    push({ form: foldPlaceName(country.iso2), kind: 'country', matchKind: 'ALIAS', country });
    push({ form: foldPlaceName(country.iso3), kind: 'country', matchKind: 'ALIAS', country });
  }

  for (const region of allRegions()) {
    push({ form: foldPlaceName(region.n), kind: 'admin1', matchKind: 'EXACT', region });
    for (const alias of region.al) {
      push({ form: foldPlaceName(alias), kind: 'admin1', matchKind: 'ALIAS', region });
    }
  }

  for (const unit of allAdmin2()) {
    /*
     * AN AUTHORITATIVE COUNTRY'S DISTRICTS DO NOT COME FROM HERE.
     *
     * Rwanda's administrative units are NISR's, and they are pushed below. The
     * GeoNames rows for Rwanda stay out of the administrative index entirely
     * rather than being merged with, ranked against or reconciled to the
     * official ones — the two code spaces have no sanctioned join, so any
     * co-existence in one list would be decided by name collision, which is the
     * failure mode this replacement exists to remove.
     */
    if (hasAuthoritativeAdministrativeSource(unit.cc)) continue;

    /*
     * A NULL LABEL IS NOT SEARCHABLE, AND MUST NOT BE FAKED.
     *
     * The build script leaves `label` null when no member settlement could be
     * verified. Deriving a name for it here — from the code, from the country,
     * from anything — would put a place name into search that no source ever
     * published. The unit stays addressable by its code and out of the name
     * index, which is the honest half.
     */
    if (unit.label)
      push({ form: foldPlaceName(unit.label), kind: 'admin2', matchKind: 'EXACT', admin2: unit });

    /*
     * BOTH NAMES REACH THE UNIT. A reader who types the current district name
     * finds it, and a reader who types the historic settlement name — which is
     * what most existing text and every older map still says — finds it too.
     * Correcting the presented name must not make the old name unfindable, or
     * the fix would trade one gap for another.
     */
    const correction = adminNameCorrectionFor(unit.code);
    if (correction) {
      push({
        form: foldPlaceName(correction.currentAdminName),
        kind: 'admin2',
        matchKind: 'EXACT',
        admin2: unit,
      });
    }
  }

  /*
   * THE OFFICIAL RWANDAN LADDER: 30 districts and 416 sectors, from NISR.
   *
   * Names are the published administrative names, so no alias edge is needed to
   * make them findable and none is invented. A district whose historic
   * settlement name differs — Kibungo for Ngoma, Butare for Huye — is still
   * findable by that settlement name, because the SETTLEMENT is still in the
   * gazetteer under its own name as a city. That is the correct outcome: the
   * town and the district are two different places and each answers to its own
   * name.
   */
  for (const district of nisrDistricts()) {
    push({
      form: foldPlaceName(district.name.canonicalName),
      kind: 'admin2',
      matchKind: 'EXACT',
      nisrDistrict: district,
    });
  }

  for (const sector of nisrSectors()) {
    push({
      form: foldPlaceName(sector.name.canonicalName),
      kind: 'admin3',
      matchKind: 'EXACT',
      nisrSector: sector,
    });
  }

  for (const city of allCities()) {
    push({ form: foldPlaceName(city.n), kind: 'city', matchKind: 'EXACT', city });
  }

  /*
   * EXONYMS ARE ALIAS EDGES, NOT PLACES. "rubavu" points at the record spelled
   * "Gisenyi"; the node returned is Gisenyi, flagged as reached by exonym, so
   * the reader sees the canonical name rather than believing the alias is the
   * gazetteer's spelling.
   */
  const cityByNameCc = new Map<string, GazetteerCity>();
  for (const city of allCities()) {
    const key = `${foldPlaceName(city.n)}|${city.cc}`;
    const existing = cityByNameCc.get(key);
    if (!existing || (city.p ?? 0) > (existing.p ?? 0)) cityByNameCc.set(key, city);
  }
  for (const exonym of allExonyms()) {
    const target = cityByNameCc.get(`${foldPlaceName(exonym.n)}|${exonym.cc}`);
    if (target) push({ form: exonym.x, kind: 'city', matchKind: 'EXONYM', city: target });
  }

  const grouped = new Map<string, IndexEntry[]>();
  for (const entry of built) {
    const bucket = grouped.get(entry.form);
    if (bucket) bucket.push(entry);
    else grouped.set(entry.form, [entry]);
  }

  entries = built;
  byForm = grouped;
  sortedForms = [...grouped.keys()].sort();
}

/* ────────────────────────── NODE CONSTRUCTION ──────────────────────────── */

function countryOf(cc: string): CountryMeta | undefined {
  return resolveCountryByAnyIdentifier(cc) ?? undefined;
}

const attribution = (): string => GAZETTEER_ATTRIBUTION();

function regionsContaining(iso3: string): GeoAncestor[] {
  return allSupranationalRegions()
    .filter((region) => region.members.includes(iso3))
    .map((region) => ({
      geographyId: region.geographyId,
      kind: 'region' as const,
      name: region.name,
    }));
}

function countryAncestor(country: CountryMeta): GeoAncestor {
  return {
    geographyId: countryId(country),
    kind: 'country',
    name: country.name,
    code: country.iso3,
  };
}

function toCountryNode(country: CountryMeta, matchedOn: string, matchKind: GeoMatchKind): GeoNode {
  const extent = countryExtent(country.iso2);

  return {
    geographyId: countryId(country),
    kind: 'country',
    precision: 'COUNTRY',
    name: country.name,
    // A country's own name cannot end in its own name, so there is nothing to
    // derive; stated explicitly rather than left to a helper that would be a
    // no-op, so the field is never silently absent.
    searchLabel: country.name,
    aliases: [country.iso2, country.iso3],
    matchedOn,
    matchKind,
    hierarchy: regionsContaining(country.iso3),
    center: extent ? extent.centroid : undefined,
    bounds: extent ?? undefined,
    provenance: {
      dataset: 'shared/COUNTRIES (ISO 3166-1)',
      admittedBy: 'gazetteer',
      attribution: attribution(),
    },
  };
}

function toAdmin1Node(
  region: GazetteerRegion,
  matchedOn: string,
  matchKind: GeoMatchKind,
): GeoNode | null {
  const country = countryOf(region.cc);
  if (!country) return null;

  return {
    geographyId: admin1Id(region, country),
    kind: 'admin1',
    precision: 'PROVINCE',
    name: region.n,
    searchLabel: cleanSourceName(region.n, country.name).searchLabel,
    aliases: region.al,
    matchedOn,
    matchKind,
    hierarchy: [...regionsContaining(country.iso3), countryAncestor(country)],
    center: region.ext ? region.ext.centroid : undefined,
    bounds: region.ext ?? undefined,
    provenance: {
      dataset: 'iso3166-2-db@2.3.11',
      admittedBy: 'iso3166-2',
      attribution: attribution(),
    },
  };
}

function toAdmin2Node(
  unit: GazetteerAdmin2,
  matchedOn: string,
  matchKind: GeoMatchKind,
): GeoNode | null {
  const country = countryOf(unit.cc);
  if (!country || !unit.label) return null;

  const parent = regionFor(unit.cc, unit.a1);
  const hierarchy: GeoAncestor[] = [...regionsContaining(country.iso3), countryAncestor(country)];

  if (parent) {
    hierarchy.push({
      geographyId: admin1Id(parent, country),
      kind: 'admin1',
      name: parent.n,
      code: parent.iso ?? undefined,
    });
  }

  /*
   * THE SINGLE CHOKEPOINT FOR THE REPLACEMENT.
   *
   * Gating the index build alone was not enough. `lookupGeographyId` and
   * `childrenOf` reach this function by id WITHOUT going through the index, so
   * a saved selection, a shared link or a watch entry could still resurrect a
   * settlement-derived Rwandan district after it had been retired from search.
   * The refusal belongs where the node is CONSTRUCTED, so every path inherits
   * it and no future caller has to remember.
   *
   * The unit is untouched in the artifact and still counted by
   * `admin2Coverage()`. It simply is not an administrative node in a country
   * that has an authority.
   */
  if (hasAuthoritativeAdministrativeSource(unit.cc)) return null;

  /*
   * THE SETTLEMENT KEEPS ITS NAME; THE DISTRICT GETS ITS OWN.
   *
   * `unit.label` is the principal settlement's name, which for the corrected
   * Rwandan units is the pre-2006 town name. The DISTRICT is presented under
   * its current administrative name and keeps the settlement-derived name as an
   * alias. The settlement node is untouched by any of this — a city named
   * Kibungo is still a city named Kibungo, with its own id and coordinates.
   */
  const correction = adminNameCorrectionFor(unit.code);
  const displayName = correction ? correction.currentAdminName : unit.label;
  const aliases = correction ? [correction.settlementName] : [];

  return {
    geographyId: admin2Id(unit),
    kind: 'admin2',
    /*
     * A DISTRICT SEARCHED AS ITSELF IS A DISTRICT, and this is the ONLY place
     * DISTRICT precision is produced. The standing ruling — "do not fabricate
     * DISTRICT when the data does not support it" — was about a CITY inheriting
     * its district's precision, which still never happens: a city node carries
     * the district as an ANCESTOR and keeps CITY precision.
     */
    precision: 'DISTRICT',
    name: displayName,
    // admin2 labels are derived from a principal settlement and carry no
    // country suffix in this build; the rule is applied anyway so a future
    // build cannot reintroduce one behind this field's back.
    searchLabel: cleanSourceName(displayName, country.name).searchLabel,
    aliases,
    matchedOn,
    matchKind,
    hierarchy,
    center: unit.ext ? unit.ext.centroid : undefined,
    bounds: unit.ext ?? undefined,
    provenance: {
      dataset: 'cities.json@1.1.61 (GeoNames-derived)',
      admittedBy: 'derived-admin2',
      /*
       * PROVENANCE SAYS THE NAME WAS CORRECTED. This is what makes it a
       * declared act rather than a silent rewrite: a consumer can see that the
       * served name is not the artifact's derived one, and why.
       */
      labelSource: correction ? 'current-name-corrected' : unit.labelSource,
      adminNameBasis: correction?.basis,
      attribution: attribution(),
    },
  };
}

/**
 * COUNTRIES WHOSE ADMINISTRATIVE UNITS COME FROM AN OFFICIAL AUTHORITY.
 *
 * For a country in this set, the GeoNames-derived `admin2` rows in
 * `gazetteer.v1.json` are NOT this product's administrative database and are
 * not served as administrative nodes. They remain in the artifact and remain
 * entirely valid for what they are — a settlement-derived grouping used by
 * place search — which is exactly the split the receiving contract draws:
 * GeoNames keeps settlements, place search and gazetteer roles, and stops being
 * the Rwanda admin DB.
 *
 * This is a REPLACEMENT and not a merge. The two sources are never combined
 * into one list, never reconciled by name, and never joined by id arithmetic;
 * for a country in this set exactly one of them answers "what are the
 * districts", and it is the authority.
 */
const AUTHORITATIVE_ADMIN_COUNTRIES: ReadonlySet<string> = new Set(['RW']);

export function hasAuthoritativeAdministrativeSource(cc: string | undefined): boolean {
  return AUTHORITATIVE_ADMIN_COUNTRIES.has((cc ?? '').toUpperCase());
}

function nisrDistrictGeographyId(district: NisrDistrict): string {
  return `admin2:RW:nisr:${district.districtId}`;
}

function nisrSectorGeographyId(sector: NisrSector): string {
  return `admin3:RW:nisr:${sector.sectorId}`;
}

function rwandaAncestors(): GeoAncestor[] {
  const country = countryOf('RW');

  return country ? [...regionsContaining(country.iso3), countryAncestor(country)] : [];
}

/**
 * A Rwandan DISTRICT, from NISR.
 *
 * `center` and `bounds` are absent, and that is the geometry coverage gap
 * showing through rather than a defect. NISR's boundary polygons are not held
 * by this candidate, and the alternative — borrowing the settlement-derived
 * `ext` of a GeoNames unit that happens to share a name — would be exactly the
 * implicit join the contract forbids AND would present a camera box as a
 * district's extent.
 */
function toNisrDistrictNode(
  district: NisrDistrict,
  matchedOn: string,
  matchKind: GeoMatchKind,
): GeoNode {
  return {
    geographyId: nisrDistrictGeographyId(district),
    kind: 'admin2',
    precision: 'DISTRICT',
    name: district.name.canonicalName,
    searchLabel: district.name.canonicalName,
    aliases: [],
    matchedOn,
    matchKind,
    hierarchy: rwandaAncestors(),
    provenance: {
      dataset: NISR_DISTRICT_PROVENANCE.sourceDataset,
      admittedBy: 'official-authority',
      labelSource: `${NISR} official administrative divisions`,
      attribution: NISR_DISTRICT_PROVENANCE.attribution,
    },
  };
}

/**
 * A Rwandan SECTOR, from NISR. The first ADMIN3 node this product has ever
 * served, and the first node to carry SECTOR precision.
 *
 * SECTOR IS AN AREA. No `center` is emitted even though one could be computed
 * later from a polygon, because a centroid on this node would be read as a
 * point location by every surface that draws points.
 */
function toNisrSectorNode(
  sector: NisrSector,
  matchedOn: string,
  matchKind: GeoMatchKind,
): GeoNode {
  const parent = nisrDistricts().find((district) => district.districtId === sector.districtId);
  const hierarchy = rwandaAncestors();

  if (parent) {
    hierarchy.push({
      geographyId: nisrDistrictGeographyId(parent),
      kind: 'admin2',
      name: parent.name.canonicalName,
      code: parent.externalId,
    });
  }

  return {
    geographyId: nisrSectorGeographyId(sector),
    kind: 'admin3',
    precision: 'SECTOR',
    name: sector.name.canonicalName,
    searchLabel: sector.name.canonicalName,
    aliases: [],
    matchedOn,
    matchKind,
    hierarchy,
    provenance: {
      dataset: NISR_SECTOR_PROVENANCE.sourceDataset,
      admittedBy: 'official-authority',
      labelSource: `${NISR} official administrative divisions`,
      attribution: NISR_SECTOR_PROVENANCE.attribution,
    },
  };
}

function toCityNode(
  city: GazetteerCity,
  matchedOn: string,
  matchKind: GeoMatchKind,
): GeoNode | null {
  const country = countryOf(city.cc);
  if (!country) return null;

  const hierarchy: GeoAncestor[] = [...regionsContaining(country.iso3), countryAncestor(country)];
  const parent = regionFor(city.cc, city.a1);

  if (parent) {
    hierarchy.push({
      geographyId: admin1Id(parent, country),
      kind: 'admin1',
      name: parent.n,
      code: parent.iso ?? undefined,
    });
  }

  /*
   * A CITY IN AN AUTHORITATIVE COUNTRY GETS NO DISTRICT ANCESTOR, AND THAT IS
   * THE HONEST ANSWER RATHER THAN THE CONVENIENT ONE.
   *
   * The GeoNames admin2 row this city sits in is no longer Rwanda's district —
   * NISR's is — and there is no verified crosswalk between a GeoNames admin2
   * unit and a NISR district. There is a PROVINCE crosswalk, established on
   * canonical names and re-proved at test time, and it does not extend to
   * districts: 30 NISR districts against 21 GeoNames units whose labels are
   * settlement names is not a join anyone has checked.
   *
   * So the breadcrumb for a Rwandan city is Country -> Province -> City, with
   * the district rung absent. The alternative would be to keep showing a
   * settlement-derived name in a district slot, which is the precise defect
   * this replacement retires. A missing rung is visibly missing; a wrong one
   * reads as correct.
   *
   * REPORTED, NOT WORKED AROUND: closing this needs an authorised
   * district-level crosswalk, which is a data decision and not a code one.
   */
  if (city.a1 && city.a2 && !hasAuthoritativeAdministrativeSource(city.cc)) {
    const unit = allAdmin2().find(
      (candidate) => candidate.code === `${city.cc}.${city.a1}.${city.a2}`,
    );
    if (unit) {
      const districtCorrection = adminNameCorrectionFor(unit.code);
      hierarchy.push({
        geographyId: admin2Id(unit),
        kind: 'admin2',
        // The ancestor is the DISTRICT, so it carries the district's name.
        name: districtCorrection?.currentAdminName ?? unit.label ?? unit.code,
        code: unit.code,
      });
    }
  }

  return {
    geographyId: cityId(city, country),
    kind: 'city',
    precision: 'CITY',
    name: city.n,
    /*
     * G-GEO-14 — APPLIED TO CITIES, AND ONE CITY IS ACTUALLY AFFECTED.
     *
     * This comment previously said no shipped city name is country-suffixed.
     * THAT WAS WRONG, and it was wrong because the measurement behind it split
     * on the FIRST comma while the rule splits on the LAST one, which is the
     * correct reading of a trailing disambiguator. Ten city names contain a
     * comma; under the rule as implemented, exactly one qualifies:
     *
     *     "Villa Presidente Frei, Ñuñoa, Santiago, Chile"
     *          -> "Villa Presidente Frei, Ñuñoa, Santiago"
     *
     * The code was already right — the correction here is to the sentence.
     *
     * THIS IS THE ONE PLACE A LABEL CHANGE COULD HAVE MOVED AN IDENTIFIER,
     * because CITY ids are built from the name where admin1 ids come from the
     * ISO 3166-2 code. It does not: `geographyId` is built from `name`, which is
     * untouched, and `city:CHL:villa-presidente-frei-nunoa-santiago-chile@...`
     * is asserted unchanged in source-name-suffix.spec.ts.
     *
     * The rule stays data-driven rather than a list, so a future gazetteer build
     * introducing more is handled without another package.
     */
    searchLabel: cleanSourceName(city.n, country.name).searchLabel,
    aliases: allExonyms()
      .filter(
        (exonym) => exonym.cc === city.cc && foldPlaceName(exonym.n) === foldPlaceName(city.n),
      )
      .map((exonym) => exonym.x),
    matchedOn,
    matchKind,
    hierarchy,
    center: [city.lon, city.lat],
    /*
     * NO BOUNDS FOR A CITY. A box around one settlement is a degenerate
     * point-box, and emitting it would invite a fit that zooms to street level
     * — a precision claim the record does not hold. Same rule as the map feed.
     */
    population: city.p,
    provenance: {
      dataset:
        city.src === 'completion'
          ? 'cities.json@1.1.61 (GeoNames-derived) — priority current-name completion'
          : 'all-the-cities@3.1.0 (GeoNames-derived)',
      featureCode: city.fc,
      admittedBy: city.src === 'completion' ? 'priority-completion' : 'gazetteer',
      attribution: attribution(),
    },
  };
}

function toRegionNode(
  region: SupranationalRegion,
  matchedOn: string,
  matchKind: GeoMatchKind,
): GeoNode {
  const extent = regionExtent(region);

  return {
    geographyId: region.geographyId,
    kind: 'region',
    precision: 'REGION',
    name: region.name,
    // A supranational region belongs to no country, so no country suffix can
    // apply and none is derived.
    searchLabel: region.name,
    aliases: region.aliases,
    matchedOn,
    matchKind,
    /*
     * A SUPRANATIONAL REGION'S "HIERARCHY" IS ITS MEMBERSHIP, DOWNWARD. It has
     * no ancestor. Members are listed as country ancestors so one shape serves
     * both directions; `membership` semantics are carried by `precision:
     * REGION` plus the provenance basis.
     */
    hierarchy: membersOf(region).map(countryAncestor),
    center: extent ? extent.centroid : undefined,
    bounds: extent ?? undefined,
    provenance: {
      dataset: region.source,
      admittedBy:
        region.basis === 'UN_M49'
          ? 'un-m49'
          : region.basis === 'POLITICAL_UNION'
            ? 'political-union'
            : 'contested-membership',
      attribution: attribution(),
    },
  };
}

function toNode(entry: IndexEntry, matchedOn: string, matchKind: GeoMatchKind): GeoNode | null {
  if (entry.supranational) return toRegionNode(entry.supranational, matchedOn, matchKind);
  if (entry.country) return toCountryNode(entry.country, matchedOn, matchKind);
  if (entry.region) return toAdmin1Node(entry.region, matchedOn, matchKind);
  if (entry.nisrDistrict) return toNisrDistrictNode(entry.nisrDistrict, matchedOn, matchKind);
  if (entry.nisrSector) return toNisrSectorNode(entry.nisrSector, matchedOn, matchKind);
  if (entry.admin2) return toAdmin2Node(entry.admin2, matchedOn, matchKind);
  if (entry.city) return toCityNode(entry.city, matchedOn, matchKind);

  return null;
}

/* ─────────────────────────────── RANKING ───────────────────────────────── */

const MATCH_RANK: Record<GeoMatchKind, number> = { EXACT: 0, ALIAS: 1, EXONYM: 2, PREFIX: 3 };
/*
 * THE SETTLEMENT COMES BEFORE THE UNIT NAMED AFTER IT.
 *
 * "Kigali" is three nodes: a city, the province around it, and the district
 * around that. They are not three answers — they are one place at three rungs,
 * and the reader who typed it meant the city. Coarsest-first would have handed
 * back the province.
 *
 * This is not a guess about intent, it is how the data was built: an admin2
 * `label` is DERIVED from that unit's principal settlement
 * (`labelSource: 'derived-from-principal-settlement'`). The settlement is the
 * source of the name and the unit is the derivative, so the settlement ranks
 * first and the unit is one row below it, reachable and clearly labelled with
 * its own precision.
 *
 * Country and region sit above everything because nothing else is ever named
 * exactly "Rwanda" or "East Africa" — verified, for regions, by the membership
 * suite's no-shadowing assertions.
 */
const KIND_RANK: Record<GeoNodeKind, number> = {
  country: 0,
  region: 1,
  city: 2,
  admin1: 3,
  admin2: 4,
  /*
   * Below admin2, for the same reason admin2 sits below admin1: when a name is
   * ambiguous across rungs the coarser, more commonly meant unit is offered
   * first. A reader typing a sector name that is also a district name almost
   * always means the district.
   */
  admin3: 5,
};

function compareNodes(a: GeoNode, b: GeoNode): number {
  const byMatch = MATCH_RANK[a.matchKind] - MATCH_RANK[b.matchKind];
  if (byMatch !== 0) return byMatch;

  const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (byKind !== 0) return byKind;

  /*
   * POPULATION BREAKS A TIE, AND NULL NEVER WINS ONE. Null means UNKNOWN — the
   * completion source carries no population field — and letting unknown sort as
   * zero would push every completion record to the bottom as though it were
   * uninhabited. Unknown sorts last among equals and is never promoted.
   */
  const pa = a.population ?? -1;
  const pb = b.population ?? -1;
  if (pa !== pb) return pb - pa;

  return a.name.localeCompare(b.name);
}

/* ─────────────────────────────── SEARCH ────────────────────────────────── */

export function searchGazetteer(query: string, options: GeoSearchOptions = {}): GeoSearchResponse {
  const raw = query.trim();
  const folded = foldPlaceName(raw);
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (folded.length < MIN_QUERY_CHARS) {
    return {
      query: raw,
      matched: false,
      ambiguous: false,
      nodes: [],
      totalMatches: 0,
      reason: 'QUERY_TOO_SHORT',
      attribution: attribution(),
    };
  }

  buildIndex();

  const restrictTo = options.country ? countryOf(options.country) : undefined;
  const seen = new Set<string>();
  const collected: GeoNode[] = [];

  const admit = (entry: IndexEntry, matchKind: GeoMatchKind): void => {
    const node = toNode(entry, entry.form, matchKind);
    if (!node) return;
    if (seen.has(node.geographyId)) return;
    if (options.kind && node.kind !== options.kind) return;

    if (restrictTo) {
      const inCountry =
        node.geographyId.includes(restrictTo.iso3) ||
        node.hierarchy.some((ancestor) => ancestor.code === restrictTo.iso3);
      if (!inCountry) return;
    }

    seen.add(node.geographyId);
    collected.push(node);
  };

  for (const entry of byForm?.get(folded) ?? []) admit(entry, entry.matchKind);

  const exactCount = collected.length;

  /*
   * PREFIX SEARCH IS THE TYPEAHEAD, AND IT NEVER OUTRANKS AN EXACT MATCH.
   *
   * Binary search over the sorted form list, walking forward while the prefix
   * holds. It runs only when there is room left under the limit, so a query
   * with a good exact answer does no prefix work at all.
   */
  if (collected.length < limit && sortedForms) {
    let low = 0;
    let high = sortedForms.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (sortedForms[mid] < folded) low = mid + 1;
      else high = mid;
    }

    for (let i = low; i < sortedForms.length; i += 1) {
      const form = sortedForms[i];
      if (!form.startsWith(folded)) break;
      if (form === folded) continue;

      for (const entry of byForm?.get(form) ?? []) {
        admit({ ...entry, form }, 'PREFIX');
      }

      // Enough raw candidates to rank well without scanning a whole letter.
      if (collected.length >= limit * 5) break;
    }
  }

  if (collected.length === 0) {
    return {
      query: raw,
      matched: false,
      ambiguous: false,
      nodes: [],
      totalMatches: 0,
      reason: 'NO_MATCH_IN_GAZETTEER',
      attribution: attribution(),
    };
  }

  collected.sort(compareNodes);

  /*
   * AMBIGUITY IS A CONTEST BETWEEN DIFFERENT PLACES — NOT A LADDER.
   *
   * "Kigali" matches three nodes exactly: the city, its province, its district.
   * Counting that as ambiguous would tell the caller to ask the reader which
   * Kigali they meant, when there is only one Kigali and the three rows are
   * three zoom levels of it. "Aberdeen" matches two settlements in two
   * countries, which is a genuine contest the caller must resolve.
   *
   * So ambiguity is declared when the exact matches contain either two nodes of
   * the SAME rung — two cities, two provinces — or nodes in more than one
   * country. A ladder through one place in one country is not ambiguous.
   *
   * Prefix hits never count: a hundred places starting with "san" is a
   * typeahead, not a contest.
   */
  const exactNodes = collected.filter((node) => node.matchKind !== 'PREFIX');
  const kindCounts = new Map<GeoNodeKind, number>();
  const countries = new Set<string>();

  for (const node of exactNodes) {
    kindCounts.set(node.kind, (kindCounts.get(node.kind) ?? 0) + 1);
    const owner = node.hierarchy.find((ancestor) => ancestor.kind === 'country');
    countries.add(owner?.code ?? node.geographyId);
  }

  const ambiguous =
    exactCount > 1 && ([...kindCounts.values()].some((n) => n > 1) || countries.size > 1);

  return {
    query: raw,
    matched: true,
    ambiguous,
    nodes: collected.slice(0, limit),
    totalMatches: collected.length,
    attribution: attribution(),
  };
}

/**
 * Resolve one `geographyId` back to its node, for a caller holding a selection.
 *
 * WHY THIS EXISTS SEPARATELY FROM SEARCH. A map selection, a watch entry and a
 * shared link all carry an ID and no name. Re-searching the name to recover the
 * node is how two different places with the same name get silently swapped.
 */
export function lookupGeographyId(geographyId: string): GeoNode | null {
  buildIndex();

  if (geographyId.startsWith('region:')) {
    const region = allSupranationalRegions().find(
      (candidate) => candidate.geographyId === geographyId,
    );

    return region ? toRegionNode(region, region.name, 'EXACT') : null;
  }

  if (geographyId.startsWith('country:')) {
    const country = countryOf(geographyId.slice('country:'.length));

    return country ? toCountryNode(country, country.name, 'EXACT') : null;
  }

  /*
   * NISR IDS ARE CHECKED FIRST AND MATCHED EXACTLY.
   *
   * `admin2:RW:nisr:55` must never fall through to the GeoNames branch below,
   * where `allAdmin2().find` would compare it against codes like `RW.15.24` and
   * return null — a silent "place not found" for a district this product
   * definitely has.
   */
  if (geographyId.startsWith('admin2:RW:nisr:')) {
    const id = geographyId.slice('admin2:RW:nisr:'.length);
    const district = nisrDistricts().find((candidate) => candidate.districtId === id);

    return district ? toNisrDistrictNode(district, district.name.canonicalName, 'EXACT') : null;
  }

  if (geographyId.startsWith('admin3:RW:nisr:')) {
    const id = geographyId.slice('admin3:RW:nisr:'.length);
    const sector = nisrSectors().find((candidate) => candidate.sectorId === id);

    return sector ? toNisrSectorNode(sector, sector.name.canonicalName, 'EXACT') : null;
  }

  if (geographyId.startsWith('admin2:')) {
    const unit = allAdmin2().find((candidate) => admin2Id(candidate) === geographyId);

    return unit
      ? toAdmin2Node(
          unit,
          adminNameCorrectionFor(unit.code)?.currentAdminName ?? unit.label ?? unit.code,
          'EXACT',
        )
      : null;
  }

  if (geographyId.startsWith('admin1:')) {
    for (const region of allRegions()) {
      const country = countryOf(region.cc);
      if (country && admin1Id(region, country) === geographyId) {
        return toAdmin1Node(region, region.n, 'EXACT');
      }
    }

    return null;
  }

  if (geographyId.startsWith('city:')) {
    for (const city of allCities()) {
      const country = countryOf(city.cc);
      if (country && cityId(city, country) === geographyId) {
        return toCityNode(city, city.n, 'EXACT');
      }
    }

    return null;
  }

  return null;
}

/**
 * The children of a node, one rung down the ladder.
 *
 * region -> member countries | country -> admin1 | admin1 -> admin2 or cities |
 * admin2 -> cities | city -> nothing.
 */
export function childrenOf(geographyId: string, limit = 200): readonly GeoNode[] {
  buildIndex();

  const capped = Math.min(Math.max(limit, 1), 1000);

  if (geographyId.startsWith('region:')) {
    const region = allSupranationalRegions().find((c) => c.geographyId === geographyId);
    if (!region) return [];

    return membersOf(region).map((country) => toCountryNode(country, country.name, 'EXACT'));
  }

  if (geographyId.startsWith('country:')) {
    const country = countryOf(geographyId.slice('country:'.length));
    if (!country) return [];

    return allRegions()
      .filter((region) => region.cc === country.iso2)
      .map((region) => toAdmin1Node(region, region.n, 'EXACT'))
      .filter((node): node is GeoNode => node !== null)
      .slice(0, capped);
  }

  if (geographyId.startsWith('admin1:')) {
    for (const region of allRegions()) {
      const country = countryOf(region.cc);
      if (!country || admin1Id(region, country) !== geographyId) continue;

      /*
       * AN AUTHORITATIVE COUNTRY DRILLS THROUGH THE CROSSWALK, NOT THROUGH THE
       * ARTIFACT.
       *
       * The province in this tree is a GeoNames admin1 row; its districts are
       * NISR rows. They are joined by the declared five-row province crosswalk
       * and by nothing else — no id arithmetic, no name matching invented here.
       * A province with no crosswalk row returns no districts rather than
       * guessing, which is why this reads the province id back out of the
       * crosswalk instead of deriving it.
       */
      if (hasAuthoritativeAdministrativeSource(region.cc)) {
        const provinceId = region.iso ? provinceIdForGeonamesCode(region.iso) : undefined;
        if (!provinceId) return [];

        return nisrDistricts()
          .filter((district) => district.provinceId === provinceId)
          .map((district) => toNisrDistrictNode(district, district.name.canonicalName, 'EXACT'))
          .slice(0, capped);
      }

      const units = allAdmin2()
        .filter((unit) => unit.cc === region.cc && unit.a1 === region.a1)
        .map((unit) => toAdmin2Node(unit, unit.label ?? unit.code, 'EXACT'))
        .filter((node): node is GeoNode => node !== null);

      if (units.length > 0) return units.slice(0, capped);

      return allCities()
        .filter((city) => city.cc === region.cc && city.a1 === region.a1)
        .map((city) => toCityNode(city, city.n, 'EXACT'))
        .filter((node): node is GeoNode => node !== null)
        .sort(compareNodes)
        .slice(0, capped);
    }

    return [];
  }

  /*
   * A DISTRICT'S CHILDREN ARE ITS SECTORS. This is the first drill-down in the
   * product that reaches ADMIN3, and it is a pure parent-id traversal on one
   * authority — no join, no crosswalk, no ambiguity.
   */
  if (geographyId.startsWith('admin2:RW:nisr:')) {
    const id = geographyId.slice('admin2:RW:nisr:'.length);

    return nisrSectors()
      .filter((sector) => sector.districtId === id)
      .map((sector) => toNisrSectorNode(sector, sector.name.canonicalName, 'EXACT'))
      .slice(0, capped);
  }

  /*
   * A SECTOR IS A LEAF. Rwanda's ladder continues to Cell and Village, and this
   * product has no rung for either, so the honest answer is an empty list
   * rather than the sector's cities — which would silently present settlements
   * as if they were the next administrative rung down.
   */
  if (geographyId.startsWith('admin3:')) return [];

  if (geographyId.startsWith('admin2:')) {
    const code = geographyId.slice('admin2:'.length);
    const unit = allAdmin2().find((candidate) => candidate.code === code);
    if (!unit) return [];

    return allCities()
      .filter((city) => city.cc === unit.cc && city.a1 === unit.a1 && city.a2 === unit.a2)
      .map((city) => toCityNode(city, city.n, 'EXACT'))
      .filter((node): node is GeoNode => node !== null)
      .sort(compareNodes)
      .slice(0, capped);
  }

  return [];
}

/** What the index actually holds, for the audit surface. */
export function searchIndexStats(): Record<string, unknown> {
  buildIndex();

  const byKind: Record<string, number> = {};
  for (const entry of entries ?? []) byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;

  return {
    surfaceForms: sortedForms?.length ?? 0,
    indexEntries: entries?.length ?? 0,
    byKind,
    builtFrom: gazetteerProvenance(),
    retentionPolicy: gazetteerPolicy(),
    /*
     * SECOND-LEVEL COVERAGE IS REPORTED, NOT LEFT TO BE INFERRED.
     *
     * This is the GeoNames-derived count and it is no longer Rwanda's district
     * count — Rwanda is served from NISR and its GeoNames admin2 rows are not
     * in the administrative index at all. The count stays because it is still
     * the truth for every other country.
     */
    admin2Coverage: admin2Coverage(),
    adminNameCorrections: ADMIN_NAME_CORRECTIONS.length,
    /*
     * TWO DIMENSIONS, TWO ANSWERS, ON THE WIRE.
     *
     * Administrative IDENTITY coverage and BOUNDARY GEOMETRY coverage are
     * different facts and a consumer must not be able to read one as the other.
     * Rwanda is 30/30 and 416/416 on identity and 0/30 and 0/416 on geometry,
     * and both halves are served.
     */
    authoritativeAdminCountries: [...AUTHORITATIVE_ADMIN_COUNTRIES],
    rwandaIdentityCoverage: rwandaIdentityCoverage(),
    /*
     * RESOLVED, not declared. This reads what is actually on disk: PENDING
     * while the official polygon files are absent, PRESENT the moment two valid
     * files land, and PENDING-with-a-reason if a file is present but rejected.
     * A surface asking this question gets today's answer, not a constant.
     */
    rwandaBoundaryGeometryCoverage: rwandaBoundaryCoverageResolved(),
  };
}
