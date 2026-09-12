import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * RWANDA — THE OFFICIAL ADMINISTRATIVE AUTHORITY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE REPLACES, AND WHY REPLACEMENT RATHER THAN MERGE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Until this module, Rwanda's administrative identity in this product came from
 * GeoNames by way of `gazetteer.v1.json`: 21 of 30 districts, every one of them
 * labelled with `labelSource: 'derived-from-principal-settlement'` — that is,
 * named after a town rather than after the district. Five of those labels were
 * patched at read time by `admin-name-corrections.ts`, two more were known to be
 * wrong and deliberately left alone because no verifiable name existed. No
 * sector data existed at all.
 *
 * That was an honest account of a bad situation, and it is now superseded. The
 * National Institute of Statistics of Rwanda publishes the administrative
 * divisions as open data, and G retrieved and verified them:
 *
 *     5 provinces · 30 districts · 416 sectors · full parentage · 0 rejects
 *
 * The receiving contract is explicit that this REPLACES rather than layers:
 * NISR is Rwanda's administrative authority and GeoNames is not. GeoNames
 * remains entirely valid for what it is good at — settlements, place search,
 * gazetteer roles — and is no longer consulted for the question "what are
 * Rwanda's districts called".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTHORITY IS DECLARED, NEVER INFERRED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `authority: 'NISR'` is a field on every record, written here, read by
 * consumers. It is NOT inferred from the filename, from the module path, from
 * the shape of an identifier, or from which function returned the record. A
 * consumer that wants to know where a name came from reads the field; there is
 * no code path in which a record acquires NISR authority by sitting in this
 * file. That is the receiving contract's rule 7 expressed as a shape rather
 * than as a comment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CODE SPACES ARE INCOMPATIBLE AND MUST NEVER BE JOINED BY COINCIDENCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NISR numbers provinces 1–5, with 1 = City of Kigali.
 * GeoNames numbers Rwanda's admin1 11–15, with 12 = Kigali.
 *
 * Both are small integers, both identify Rwandan provinces, and they agree
 * about nothing. A join on numeric equality would silently attach Kigali's
 * records to the Southern Province and no error would ever fire. So every
 * identifier this module emits is NAMESPACED — `nisr:district:55`, never `55` —
 * and `GEONAMES_CROSSWALK` is the only sanctioned bridge. It is empty, and
 * empty is a true statement: no verified crosswalk has been established. A
 * consumer needing one must build it explicitly and declare its basis, not
 * derive it from arithmetic.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE SOURCE DEFECT, NORMALISED IN THE OPEN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NISR's district layer spells province 5 "Estern Province"; its sector layer
 * spells the same province "Eastern Province". G carried both verbatim and
 * flagged the disagreement rather than picking.
 *
 * This module resolves it, and records the resolution: `canonicalName` is
 * "Eastern Province", `rawSourceName` keeps "Estern Province", and
 * `normalisationBasis` says which layer supplied which and why the sector
 * layer won. Nothing is silently mutated — the source value survives in the
 * record, so an auditor comparing this product to NISR's own download can see
 * exactly one difference and exactly why.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BOUNDARY GEOMETRY IS A SEPARATE CARRIER AND IS NOT HERE YET
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Administrative identity and administrative geometry are two different
 * coverages and this module reports them separately. Identity is complete:
 * 30/30 and 416/416. Geometry is absent: 0/30 and 0/416.
 *
 * The polygons exist on the NISR layers and are NOT in this product. They are
 * not approximated, not derived, not substituted by a bounding box. When they
 * land they land in `boundaryGeometry` — a carrier of their own, never in
 * `ext`, because every `ext` in this codebase is a settlement-derived camera
 * box that the boundary-join contract forbids drawing as a border. A consumer
 * must be able to tell a real boundary from a derived box by reading the
 * record, which is impossible if they share a field.
 */

/* ── 1 · THE AUTHORITY ITSELF ───────────────────────────────────────────── */

/**
 * The authority token. A string literal type rather than a string, so a record
 * claiming a different authority is a compile error rather than a typo.
 */
export type AdministrativeAuthority = 'NISR';

export const NISR: AdministrativeAuthority = 'NISR';

/**
 * Everything a consumer needs to answer "where did this come from and what am
 * I allowed to do with it" without leaving the record.
 */
export interface AuthorityProvenance {
  readonly authority: AdministrativeAuthority;
  readonly authorityName: string;
  /** The dataset, named as the publisher names it. */
  readonly sourceDataset: string;
  /** The specific service layer the rows came off. */
  readonly sourceLayer: string;
  /**
   * The CONTENT vintage: when the boundaries themselves were established.
   *
   * Three different questions live near each other here and a single `vintage`
   * field would collapse them: when the boundaries were drawn (this), when the
   * publisher loaded the layer (`publishedAt`), and when we fetched it
   * (`retrieved`). They are 2022, 2024 and 2026 respectively, and a consumer
   * asking "how old is this data" means the first.
   */
  readonly vintage: string;
  /**
   * When the publisher loaded the layer, measured from the layer's own date
   * fields rather than assumed: MIN(created_date) == MAX(last_edited_date),
   * i.e. loaded once and not edited since.
   */
  readonly publishedAt: string;
  readonly retrieved: string;
  readonly licence: string;
  readonly commercialUse: 'permitted' | 'prohibited' | 'conditional';
  /** The exact string a surface must display. Not paraphrasable. */
  readonly attribution: string;
}

/**
 * THE ATTRIBUTION STRING, VERBATIM.
 *
 * CC BY 4.0 makes attribution a condition of the licence, not a courtesy. This
 * is the exact text the rights determination requires, and it must reach a
 * user-visible surface wherever Rwandan administrative names or boundaries are
 * shown. Reworded attribution is not attribution.
 */
export const NISR_ATTRIBUTION =
  'Administrative boundary data: National Institute of Statistics of Rwanda (NISR), 2022. Licensed CC BY 4.0.';

const DISTRICT_LAYER =
  'https://services5.arcgis.com/deNm5epdmeZgcm16/arcgis/rest/services/Distrct_Boundary/FeatureServer/0';

const SECTOR_LAYER =
  'https://services5.arcgis.com/deNm5epdmeZgcm16/arcgis/rest/services/Sector_Boundary_2022/FeatureServer/1';

export const NISR_DISTRICT_PROVENANCE: AuthorityProvenance = {
  authority: NISR,
  authorityName: 'National Institute of Statistics of Rwanda (NISR)',
  sourceDataset: 'Distrct_Boundary (NISR_Publisher, ArcGIS Online org deNm5epdmeZgcm16)',
  sourceLayer: DISTRICT_LAYER,
  vintage: '2022 (NISR district boundaries produced 2006, updated 2022)',
  publishedAt: '2024-09-03T09:20:26.660Z',
  retrieved: '2026-09-12',
  licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  commercialUse: 'permitted',
  attribution: NISR_ATTRIBUTION,
};

export const NISR_SECTOR_PROVENANCE: AuthorityProvenance = {
  authority: NISR,
  authorityName: 'National Institute of Statistics of Rwanda (NISR)',
  sourceDataset: 'Sector_Boundary_2022 (NISR_Publisher, ArcGIS Online org deNm5epdmeZgcm16)',
  sourceLayer: SECTOR_LAYER,
  /*
   * CONTENT vintage, as the service itself states it: boundaries established
   * from the 2002 census, refined by 2012 census mapping, updated during 2022
   * census fieldwork. `publishedAt` is a different fact — the layer was loaded
   * once on 2024-09-03 and not edited since, measured from
   * MIN(created_date) == MAX(last_edited_date).
   */
  vintage: '2022 (NISR 2022 census fieldwork; district boundaries produced 2006, updated 2022)',
  publishedAt: '2024-09-03T09:20:26.660Z',
  retrieved: '2026-09-12',
  licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  commercialUse: 'permitted',
  attribution: NISR_ATTRIBUTION,
};

/**
 * The one rights question that could not be closed from the retrieval
 * environment, recorded rather than smoothed over.
 *
 * The licence instrument was read at the corporate host. The GIS host's copy at
 * the same path presents a self-signed certificate and was NOT read, because
 * bypassing certificate verification to read a licence is not a way to
 * establish a licence. The receiving contract classifies this as documentation
 * and retrieval debt rather than an integration blocker: the terms were
 * obtained, from the publisher, at a normal path.
 */
export const NISR_RIGHTS_GAP = {
  id: 'GAP-RETRIEVAL/TLS',
  instrumentRead: 'https://www.statistics.gov.rw/terms-use',
  instrumentNotRead: 'https://gis.statistics.gov.rw/terms-use',
  reason: 'self-signed TLS certificate; not bypassed',
  classification: 'documentation-and-retrieval-debt' as const,
  blocksIntegration: false,
  closedBy: 'One reading of the GIS host copy from a normal network path.',
} as const;

/* ── 2 · IDENTIFIERS ────────────────────────────────────────────────────── */

/**
 * A namespaced external identifier.
 *
 * The namespace is not decoration. `55` is a NISR district id and also a
 * plausible GeoNames fragment, a population figure and an array index;
 * `nisr:district:55` is a NISR district id and nothing else. Every identity
 * this module hands out is built here so that none of them can be a bare
 * number by accident.
 */
export type NisrExternalId = `nisr:${'province' | 'district' | 'sector'}:${string}`;

export function nisrProvinceId(provinceId: string): NisrExternalId {
  return `nisr:province:${provinceId}`;
}

export function nisrDistrictId(districtId: string): NisrExternalId {
  return `nisr:district:${districtId}`;
}

export function nisrSectorId(sectorId: string): NisrExternalId {
  return `nisr:sector:${sectorId}`;
}

/**
 * THE ONLY SANCTIONED BRIDGE BETWEEN THE TWO CODE SPACES, AND IT IS EMPTY.
 *
 * An entry here is a claim that a specific NISR unit and a specific GeoNames
 * unit are the same real place, established by a stated basis — a name match
 * that was checked, a boundary intersection that was computed, a published
 * concordance that was read. Not by the two ids looking similar.
 *
 * It is empty because no such work has been authorised or done. Empty is the
 * honest state and it is load-bearing: `assertNoImplicitJoin` refuses any pair
 * that is not listed, so a consumer cannot fall back to numeric matching when
 * the lookup misses.
 */
export interface GeoNamesCrosswalkEntry {
  readonly nisrId: NisrExternalId;
  /** GeoNames admin code, e.g. "RW.15.24". */
  readonly geonamesCode: string;
  /** How this equivalence was established. Never "the ids matched". */
  readonly basis: string;
}

/**
 * THE PROVINCE CROSSWALK — FIVE ROWS, AND WHY EACH ONE IS A CHECKED CLAIM.
 *
 * Authorised by the receiving contract: "Where cross-system reconciliation is
 * needed, use an explicit crosswalk." It IS needed — without it a reader cannot
 * drill from a Rwandan province to its districts, because the province in the
 * navigation tree is a GeoNames admin1 row and the districts are NISR rows.
 *
 * THE BASIS IS CANONICAL NAME EQUALITY, CARRIED BESIDE ISO 3166-2. It is not
 * id arithmetic, and the difference is not academic — here is what arithmetic
 * would have produced:
 *
 *     NISR 1 (City of Kigali)  ->  GeoNames a1 11  =  EASTERN PROVINCE
 *     NISR 5 (Eastern)         ->  GeoNames a1 15  =  SOUTHERN PROVINCE
 *
 * Every row wrong, no error raised, a whole country's evidence silently
 * misfiled. The two sequences are both 1..5 in shape and share not one member.
 *
 * NOTE WHICH NAME DOES THE MATCHING. Province 5 matches on `canonicalName`
 * ("Eastern Province"), because its `rawSourceName` is the source defect
 * "Estern Province" and would match nothing. That is the normalisation earning
 * its place: without it this row could not be established at all.
 *
 * `verifyGeonamesCrosswalk` re-proves all five against both artifacts at test
 * time, so a row invented here — or one whose GeoNames record is later renamed
 * — fails the suite rather than shipping as geography.
 */
export const GEONAMES_CROSSWALK: readonly GeoNamesCrosswalkEntry[] = [
  {
    nisrId: 'nisr:province:1',
    geonamesCode: 'RW-01',
    basis: 'Canonical province name equality: NISR "City of Kigali" = ISO 3166-2 RW-01, the GeoNames admin1 record spelled "Kigali". Kigali is a province-level city rather than a province, and both sources treat it as the first-level unit.',
  },
  {
    nisrId: 'nisr:province:2',
    geonamesCode: 'RW-05',
    basis: 'Canonical province name equality: NISR "Southern Province" = the GeoNames admin1 record named "Southern Province", ISO 3166-2 RW-05.',
  },
  {
    nisrId: 'nisr:province:3',
    geonamesCode: 'RW-04',
    basis: 'Canonical province name equality: NISR "Western Province" = the GeoNames admin1 record named "Western Province", ISO 3166-2 RW-04.',
  },
  {
    nisrId: 'nisr:province:4',
    geonamesCode: 'RW-03',
    basis: 'Canonical province name equality: NISR "Northern Province" = the GeoNames admin1 record named "Northern Province", ISO 3166-2 RW-03.',
  },
  {
    nisrId: 'nisr:province:5',
    geonamesCode: 'RW-02',
    basis: 'Canonical province name equality: NISR canonicalName "Eastern Province" = the GeoNames admin1 record named "Eastern Province", ISO 3166-2 RW-02. Matched on canonicalName, NOT on the district layer\'s rawSourceName "Estern Province", which matches nothing.',
  },
];

/**
 * What a crosswalk row claims, re-provable against the two artifacts.
 *
 * Same technique as `verifyAdminNameCorrections`: each row asserts things the
 * data can confirm or refute on its own, and the companion spec fails on any
 * one of them.
 */
export interface CrosswalkVerification {
  readonly nisrId: NisrExternalId;
  readonly geonamesCode: string;
  /** The NISR province exists. */
  readonly nisrUnitExists: boolean;
  /** The canonical names agree. */
  readonly nameMatches: boolean;
  /** The claim is not numeric coincidence — recorded so a test can assert it. */
  readonly isNumericCoincidence: boolean;
}

export function verifyGeonamesCrosswalk(
  geonamesProvinces: readonly { readonly iso: string | null; readonly n: string }[],
): readonly CrosswalkVerification[] {
  const provinceById = new Map(nisrProvinces().map((province) => [province.externalId, province]));

  return GEONAMES_CROSSWALK.map((entry) => {
    const province = provinceById.get(entry.nisrId);
    const geonames = geonamesProvinces.find((row) => row.iso === entry.geonamesCode);
    const canonical = province?.name.canonicalName ?? '';

    return {
      nisrId: entry.nisrId,
      geonamesCode: entry.geonamesCode,
      nisrUnitExists: province !== undefined,
      /*
       * "Kigali" and "City of Kigali" are the same unit under two spellings, so
       * containment rather than equality — and containment in the direction
       * that cannot accidentally match a different province.
       */
      nameMatches:
        geonames !== undefined &&
        (canonical === geonames.n ||
          canonical.includes(geonames.n) ||
          geonames.n.includes(canonical)),
      isNumericCoincidence: false,
    };
  });
}

/** The GeoNames ISO 3166-2 code for a NISR province, or undefined. Never a guess. */
export function geonamesCodeForProvince(provinceId: string): string | undefined {
  return assertNoImplicitJoin(nisrProvinceId(provinceId));
}

/** The NISR province id for an ISO 3166-2 code, or undefined. Never a guess. */
export function provinceIdForGeonamesCode(geonamesCode: string): string | undefined {
  const entry = GEONAMES_CROSSWALK.find((row) => row.geonamesCode === geonamesCode);

  return entry ? entry.nisrId.slice('nisr:province:'.length) : undefined;
}

/**
 * Refuses a join that no crosswalk entry supports.
 *
 * Returns the GeoNames code when one is declared and `undefined` otherwise —
 * never a guess. The name is imperative because the intended reading is "this
 * call is the thing standing between you and a silent numeric join".
 */
export function assertNoImplicitJoin(nisrId: NisrExternalId): string | undefined {
  return GEONAMES_CROSSWALK.find((entry) => entry.nisrId === nisrId)?.geonamesCode;
}

/* ── 3 · NAME NORMALISATION, IN THE OPEN ────────────────────────────────── */

/**
 * A name as this product presents it, beside the name the source actually
 * carried.
 *
 * Equal in the ordinary case. Different exactly once, for province 5, and the
 * difference carries its own basis string so it can be audited without reading
 * this file.
 */
export interface NormalisedName {
  /** What this product presents. */
  readonly canonicalName: string;
  /** What the source layer carried, verbatim, including defects. */
  readonly rawSourceName: string;
  /** Null when the two agree. */
  readonly normalisationBasis: string | null;
}

const EASTERN_PROVINCE_BASIS =
  "NISR source defect: the district layer spells this province 'Estern Province' and the sector layer " +
  "spells it 'Eastern Province'. Both are NISR, and they disagree. The sector layer's spelling is taken as " +
  'canonical because it is the correct English form of the province\'s published name and it is the spelling ' +
  'NISR uses in the larger of the two layers. The district layer\'s value is preserved verbatim in ' +
  'rawSourceName; no source file is edited.';

function normaliseProvinceName(rawSourceName: string): NormalisedName {
  if (rawSourceName === 'Estern Province') {
    return {
      canonicalName: 'Eastern Province',
      rawSourceName,
      normalisationBasis: EASTERN_PROVINCE_BASIS,
    };
  }

  return { canonicalName: rawSourceName, rawSourceName, normalisationBasis: null };
}

/* ── 4 · BOUNDARY GEOMETRY — A CARRIER OF ITS OWN ───────────────────────── */

/**
 * WHY THIS IS NOT `ext`, STATED WHERE SOMEONE WOULD BE TEMPTED.
 *
 * `DerivedExtent` — the `ext` field on every gazetteer unit — is a bounding box
 * computed from the settlements inside a unit. It carries
 * `source: 'derived-from-settlements'` and the boundary-join contract forbids
 * rendering it as a border or using it for point-in-polygon, because it is a
 * camera aid that happens to be rectangle-shaped.
 *
 * An official NISR administrative boundary is a different class of object with
 * different permissions. If the two shared a field, a consumer could not tell
 * them apart, and the prohibition on drawing derived extents as borders would
 * become unenforceable the moment one real polygon landed beside them. So
 * boundaries get `boundaryGeometry`, with their own authority and their own
 * data identity, and `ext` keeps meaning exactly what it has always meant.
 */
export interface BoundaryGeometryRef {
  readonly authority: AdministrativeAuthority;
  readonly sourceLayer: string;
  readonly vintage: string;
  readonly geometryType: 'Polygon' | 'MultiPolygon';
  readonly crs: 'EPSG:4326';
  /** sha256 of the geometry artifact. The DATA manifest's join key. */
  readonly sha256: string;
  readonly featureCount: number;
}

/**
 * The state of boundary geometry in this candidate: declared, specified, and
 * ABSENT.
 *
 * This is not a placeholder that will quietly start returning approximations.
 * `refs` is empty and `features` is 0, and the coverage reporter reads those
 * numbers rather than a flag, so there is no way to report geometry coverage
 * that is not backed by counted features.
 */
export interface BoundaryGeometryCoverage {
  readonly rung: 'ADMIN2' | 'ADMIN3';
  readonly expectedFeatures: number;
  readonly presentFeatures: number;
  readonly refs: readonly BoundaryGeometryRef[];
  readonly status: 'PRESENT' | 'PENDING';
  readonly reason: string;
}

const GEOMETRY_PENDING_REASON =
  'Polygon geometry is published on both NISR layers and is NOT carried by this candidate. It was not ' +
  'retrieved: the integration environment\'s egress policy denies services5.arcgis.com (CONNECT 403), and no ' +
  'substitute was used — no bounding box, no centroid, no simplification, no third-party redistribution. ' +
  'The exact reproducible query and the five acceptance checks are held in the accepted pack at ' +
  'docs/02-GEOMETRY-FETCH.md. Until those checks pass against real features, this rung has administrative ' +
  'IDENTITY and no BOUNDARY COVERAGE, and the two are reported separately.';

export const RWANDA_BOUNDARY_GEOMETRY: readonly BoundaryGeometryCoverage[] = [
  {
    rung: 'ADMIN2',
    expectedFeatures: 30,
    presentFeatures: 0,
    refs: [],
    status: 'PENDING',
    reason: GEOMETRY_PENDING_REASON,
  },
  {
    rung: 'ADMIN3',
    expectedFeatures: 416,
    presentFeatures: 0,
    refs: [],
    status: 'PENDING',
    reason: GEOMETRY_PENDING_REASON,
  },
];

/* ── 4b · THE LAKE KIVU INVARIANT ───────────────────────────────────────── */

/**
 * THE 416 SECTORS DO NOT TILE RWANDA, AND THAT IS THE SOURCE BEING CORRECT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MEASUREMENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * G measured both NISR layers server-side. The national envelopes are
 * byte-identical, so the two layers agree about Rwanda's outer boundary. The
 * areas are not:
 *
 *     district layer   2.0579937641646318 sq deg
 *     sector   layer   1.9758821532915576 sq deg
 *     gap              0.0821116108730742   (3.99%)
 *
 * Five districts account for the entire gap to within 3.5e-17 — floating-point
 * noise — and they are exactly Rwanda's Lake Kivu shore: Karongi, Rutsiro,
 * Rubavu, Rusizi, Nyamasheke. Every district tested away from Kivu matches to
 * full double precision, INCLUDING two with large inland lakes (Rwamagana on
 * Muhazi, Kayonza on Ihema/Mugesera). So inland water is inside its sectors and
 * only Kivu is not.
 *
 *     district polygons INCLUDE Rwanda's Lake Kivu waters
 *     sector   polygons EXCLUDE them
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CONSEQUENCE, WHICH IS A RESOLVER RULE AND NOT A DATA PROBLEM
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A coordinate on Lake Kivu is inside a DISTRICT and inside NO SECTOR. Both
 * answers are correct simultaneously. A sector-level point-in-polygon resolver
 * must therefore be able to return NO SECTOR as a SUCCESSFUL result, not as a
 * failure to be recovered from.
 *
 * The four recoveries that must never happen, named so that adding one means
 * deleting a line that forbids it:
 *
 *   - nearest-shore sector      the water is not in that sector
 *   - inferred sector           from the district, from a centroid, from anything
 *   - fallback sector           a default, a first-in-list, a parent's first child
 *   - artificial tiling         extending sector polygons across the lake
 *
 * And the fifth, which is worse than any of them: "repairing" the source. The
 * licence condition is that integrity is respected, and the geometry is not
 * wrong. Rwanda's sectors genuinely do not administer the lake surface.
 */
export const LAKE_KIVU_DISTRICT_IDS: readonly string[] = ['31', '32', '33', '36', '37'];

export const LAKE_KIVU_DISTRICT_NAMES: readonly string[] = [
  'Karongi',
  'Rutsiro',
  'Rubavu',
  'Rusizi',
  'Nyamasheke',
];

/**
 * The measured area gap, carried so a regression can assert against a number
 * rather than against a memory of one.
 */
export const SECTOR_TILING_GAP = {
  districtAreaSqDeg: 2.0579937641646318,
  sectorAreaSqDeg: 1.9758821532915576,
  gapSqDeg: 0.0821116108730742,
  gapPctOfDistricts: 3.99,
  attributableTo: 'Lake Kivu',
  sectorsTileRwanda: false,
} as const;

/**
 * THE RESULT TYPE THAT MAKES "NO SECTOR" SAYABLE.
 *
 * A resolver returning `NisrSector | null` would be ambiguous — null could mean
 * "outside Rwanda", "lookup failed", or "genuinely no sector here", and a caller
 * with no way to tell them apart is a caller that will eventually pick a
 * nearest match. So the outcome is a tagged union and each arm is a different
 * statement.
 */
export type SectorResolution =
  | { readonly outcome: 'SECTOR'; readonly sector: NisrSector }
  | {
      /**
       * Inside Rwanda, inside a district, and inside no sector. A CORRECT and
       * COMPLETE answer, not an error.
       */
      readonly outcome: 'NO_SECTOR';
      readonly districtExternalId: NisrExternalId | null;
      readonly reason: string;
    }
  | { readonly outcome: 'OUTSIDE_RWANDA' }
  | {
      /** Geometry is not held, so no point-in-polygon answer is possible at all. */
      readonly outcome: 'GEOMETRY_UNAVAILABLE';
      readonly reason: string;
    };

export const NO_SECTOR_LAKE_KIVU_REASON =
  'This coordinate lies inside a Rwandan district and inside no sector. NISR district polygons include ' +
  'Lake Kivu; NISR sector polygons exclude it, because Rwanda\'s sectors do not administer the lake ' +
  'surface. NO SECTOR is the correct and complete answer. A nearest-shore, inferred, fallback or tiled ' +
  'sector would be a fabricated administrative claim about a point on open water.';

/**
 * Refuses the recovery, as a function rather than as a rule someone remembers.
 *
 * Any code path tempted to substitute a sector for a NO_SECTOR result has to
 * call this and get its own result back unchanged, or delete the call. It is
 * the same technique as `assertNavigationDoesNotRaiseEvidence`: the parameter a
 * caller might act on is accepted and demonstrably not read.
 */
export function assertNoSectorIsNotRecovered(
  resolution: SectorResolution,
  nearestCandidate: NisrSector | undefined,
): SectorResolution {
  /*
   * Accepted and deliberately not read. That is the entire statement: a nearest
   * candidate may exist, may be computable, and may not change the answer.
   */
  void nearestCandidate;

  return resolution;
}

/* ── 5 · THE RECORDS ────────────────────────────────────────────────────── */

export interface NisrProvince {
  readonly externalId: NisrExternalId;
  readonly provinceId: string;
  readonly name: NormalisedName;
  readonly districts: number;
  readonly sectors: number;
  readonly authority: AdministrativeAuthority;
  readonly provenance: AuthorityProvenance;
}

export interface NisrDistrict {
  readonly externalId: NisrExternalId;
  readonly districtId: string;
  readonly name: NormalisedName;
  /** Parent, as a namespaced id. Never a bare number. */
  readonly parentExternalId: NisrExternalId;
  readonly provinceId: string;
  readonly sectors: number;
  readonly authority: AdministrativeAuthority;
  readonly provenance: AuthorityProvenance;
  /** Null until real polygons land. Never a derived extent. */
  readonly boundaryGeometry: BoundaryGeometryRef | null;
}

export interface NisrSector {
  readonly externalId: NisrExternalId;
  readonly sectorId: string;
  readonly name: NormalisedName;
  readonly parentExternalId: NisrExternalId;
  readonly districtId: string;
  readonly provinceId: string;
  readonly authority: AdministrativeAuthority;
  readonly provenance: AuthorityProvenance;
  readonly boundaryGeometry: BoundaryGeometryRef | null;
}

interface RawArtifact {
  readonly schema: string;
  readonly attribution: string;
  readonly counts: {
    readonly provinces: number;
    readonly districts: number;
    readonly sectors: number;
    readonly orphan_districts: number;
    readonly orphan_sectors: number;
    readonly duplicate_external_ids: number;
    readonly null_parents: number;
    readonly invalid_geometry: number;
  };
  readonly vintage: {
    readonly content: string;
    readonly publication_iso: string;
  };
  readonly geometry: {
    readonly available_at_source: boolean;
    readonly included_in_this_package: boolean;
    readonly invalid_geometry_count: number;
  };
  readonly provinces: readonly {
    readonly province_id: string;
    readonly name_sector_layer: string;
    readonly name_district_layer: string;
    readonly districts: number;
    readonly sectors: number;
  }[];
  readonly districts: readonly {
    readonly district_id: string;
    readonly district: string;
    readonly province_id: string;
    readonly province_district_layer: string;
    readonly sectors: number;
  }[];
  readonly sectors: readonly {
    readonly sector_id: string;
    readonly sector: string;
    readonly district_id: string;
    readonly province_id: string;
  }[];
}

let artifact: RawArtifact | undefined;

function load(): RawArtifact {
  if (artifact) return artifact;

  /*
   * Resolved relative to this module so it behaves identically under ts-jest
   * from src and from dist in the compiled build, matching `geo-gazetteer.ts`.
   * A missing artifact fails loudly: an empty Rwanda reads exactly like a
   * Rwanda with no districts, which is the misreading this whole module exists
   * to prevent.
   */
  const path = join(__dirname, 'data', 'rwanda-nisr-admin.v1.json');

  artifact = JSON.parse(readFileSync(path, 'utf8')) as RawArtifact;

  return artifact;
}

let provinces: readonly NisrProvince[] | undefined;
let districts: readonly NisrDistrict[] | undefined;
let sectors: readonly NisrSector[] | undefined;

export function nisrProvinces(): readonly NisrProvince[] {
  if (provinces) return provinces;

  provinces = load().provinces.map((row) => ({
    externalId: nisrProvinceId(row.province_id),
    provinceId: row.province_id,
    /*
     * The sector layer's spelling is the canonical input here, and the district
     * layer's is what gets preserved when they disagree — which is why the raw
     * value handed to the normaliser is the DISTRICT layer's. For the four
     * provinces where both layers agree the two strings are identical and the
     * basis is null.
     */
    name: normaliseProvinceName(row.name_district_layer),
    districts: row.districts,
    sectors: row.sectors,
    authority: NISR,
    provenance: NISR_DISTRICT_PROVENANCE,
  }));

  return provinces;
}

export function nisrDistricts(): readonly NisrDistrict[] {
  if (districts) return districts;

  districts = load().districts.map((row) => ({
    externalId: nisrDistrictId(row.district_id),
    districtId: row.district_id,
    /* District names carry no known source defect; both fields agree. */
    name: { canonicalName: row.district, rawSourceName: row.district, normalisationBasis: null },
    parentExternalId: nisrProvinceId(row.province_id),
    provinceId: row.province_id,
    sectors: row.sectors,
    authority: NISR,
    provenance: NISR_DISTRICT_PROVENANCE,
    boundaryGeometry: null,
  }));

  return districts;
}

export function nisrSectors(): readonly NisrSector[] {
  if (sectors) return sectors;

  sectors = load().sectors.map((row) => ({
    externalId: nisrSectorId(row.sector_id),
    sectorId: row.sector_id,
    name: { canonicalName: row.sector, rawSourceName: row.sector, normalisationBasis: null },
    parentExternalId: nisrDistrictId(row.district_id),
    districtId: row.district_id,
    provinceId: row.province_id,
    authority: NISR,
    provenance: NISR_SECTOR_PROVENANCE,
    boundaryGeometry: null,
  }));

  return sectors;
}

export function nisrDistrictsOfProvince(provinceId: string): readonly NisrDistrict[] {
  return nisrDistricts().filter((district) => district.provinceId === provinceId);
}

export function nisrSectorsOfDistrict(districtId: string): readonly NisrSector[] {
  return nisrSectors().filter((sector) => sector.districtId === districtId);
}

/* ── 6 · COVERAGE, IN TWO DIMENSIONS ────────────────────────────────────── */

/**
 * Administrative IDENTITY coverage: how many units this product can name.
 *
 * Deliberately separate from geometry. The receiving contract's rule 8 is
 * explicit that identity coverage must not be reduced because geometry is
 * pending, and that boundary coverage must not be claimed before polygons are
 * verified. Two functions, two answers, no way to report one as the other.
 */
export interface IdentityCoverage {
  readonly iso2: 'RW';
  readonly rung: 'ADMIN1' | 'ADMIN2' | 'ADMIN3';
  readonly publishedUnits: number;
  readonly carriedUnits: number;
  readonly labelsAreAuthoritative: boolean;
  readonly authority: AdministrativeAuthority;
  readonly labelSource: string;
  readonly isCoverageGap: boolean;
}

export function rwandaIdentityCoverage(): readonly IdentityCoverage[] {
  const counts = load().counts;

  const row = (
    rung: 'ADMIN1' | 'ADMIN2' | 'ADMIN3',
    published: number,
    carried: number,
  ): IdentityCoverage => ({
    iso2: 'RW',
    rung,
    publishedUnits: published,
    carriedUnits: carried,
    labelsAreAuthoritative: true,
    authority: NISR,
    labelSource: 'NISR official administrative divisions, 2022',
    /*
     * Derived from the counts rather than asserted, so a truncated artifact
     * reports a gap instead of inheriting a hardcoded `false`.
     */
    isCoverageGap: carried < published,
  });

  return [
    row('ADMIN1', 5, counts.provinces),
    row('ADMIN2', 30, counts.districts),
    row('ADMIN3', 416, counts.sectors),
  ];
}

export function rwandaBoundaryGeometryCoverage(): readonly BoundaryGeometryCoverage[] {
  return RWANDA_BOUNDARY_GEOMETRY;
}

/**
 * WHAT THE OLD AUTHORITY SAID, KEPT AS HISTORY AND NOT AS STATE.
 *
 * The receiving contract permits the superseded measurements to survive in
 * audit and history, and forbids them from being the active authority. So they
 * live here, in a frozen record with `active: false`, reachable by an auditor
 * asking "what did this product claim before?" and reachable by nothing that
 * answers "what are Rwanda's districts".
 */
export const RWANDA_SUPERSEDED_AUTHORITY = {
  active: false,
  supersededBy: NISR,
  supersededOn: '2026-09-12',
  priorAuthority: 'GeoNames (via gazetteer.v1.json)',
  priorMeasurements: {
    admin2PublishedUnits: 30,
    admin2CarriedUnits: 21,
    admin2LabelsAuthoritative: 0,
    admin2LabelSource: 'derived-from-principal-settlement',
    admin2ReadTimeCorrections: 5,
    admin3CarriedUnits: 0,
  },
  note:
    'Retained for audit only. These numbers describe what this product carried before the NISR pack was ' +
    'accepted; they are not a description of Rwanda and must never be served as coverage. The five read-time ' +
    'name corrections they refer to are superseded by authoritative NISR district names.',
} as const;
