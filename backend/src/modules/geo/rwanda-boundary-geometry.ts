import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LAKE_KIVU_DISTRICT_IDS,
  RWANDA_BOUNDARY_GEOMETRY,
  NISR,
  NISR_ATTRIBUTION,
  NISR_DISTRICT_PROVENANCE,
  NISR_SECTOR_PROVENANCE,
  SECTOR_TILING_GAP,
  nisrDistricts,
  nisrSectors,
  type NisrDistrict,
  type NisrSector,
  type AdministrativeAuthority,
  type BoundaryGeometryCoverage,
  type BoundaryGeometryRef,
} from './rwanda-nisr.authority';

/**
 * RWANDA BOUNDARY GEOMETRY — THE IMPORT PATH, COMPLETE AND WAITING FOR BYTES.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE IS, AND WHY IT EXISTS BEFORE THE DATA DOES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Rwanda's administrative IDENTITY is complete and active — 30/30 districts and
 * 416/416 sectors under NISR authority. Its administrative GEOMETRY is not
 * here: the official polygons are published, and this build environment's
 * egress policy denies the host that serves them.
 *
 * That is a byte-transport problem. It is NOT a design problem, and the
 * difference matters, because the two fail in opposite directions. A missing
 * design gets discovered late, by a reader looking at a wrong map. A missing
 * file gets discovered immediately, by a loader that finds nothing.
 *
 * So the entire import path is built, wired and tested here against fixtures,
 * and the only thing outstanding is the two files. When they are dropped into
 * `data/`, this module picks them up, validates them against every acceptance
 * check, and Rwanda's boundary coverage flips from PENDING to PRESENT —
 * WITH NO CODE CHANGE. If they never arrive, coverage stays PENDING and says
 * so. Neither state requires anyone to remember anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR REFUSALS, BUILT IN RATHER THAN DOCUMENTED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. NEVER `ext`. Boundaries land in `boundaryGeometry` and nothing else.
 *      Every `ext` in this codebase is a settlement-derived camera box that the
 *      boundary-join contract forbids drawing as a border. If the two shared a
 *      field, that prohibition would become unenforceable the moment one real
 *      polygon landed beside them. `assertNotDerivedExtent` refuses the
 *      substitution at the type level AND at runtime.
 *
 *   2. NEVER a bbox or a centroid standing in for a polygon. A rectangle is a
 *      camera aid. Accepting one here would mean drawing a five-point box and
 *      calling it a district boundary.
 *
 *   3. NEVER a partial import. If any check rejects, NOTHING is attached and
 *      coverage stays PENDING. Half a country's boundaries is a map that is
 *      confidently wrong in the places it is missing.
 *
 *   4. NEVER a repair. Not a snap, not a simplify, not a reprojection, not a
 *      ring reorder, and above all not a "fix" for the Lake Kivu gap. The
 *      licence condition is that integrity is respected, and the geometry is
 *      not wrong.
 */

/* ── 1 · THE GEOJSON SHAPE, MINIMALLY TYPED ─────────────────────────────── */

export type BoundaryGeometryType = 'Polygon' | 'MultiPolygon';

export interface BoundaryGeometry {
  readonly type: BoundaryGeometryType;
  /** Nested coordinate arrays. Depth varies by type; walked, never indexed blindly. */
  readonly coordinates: unknown;
}

export interface BoundaryFeature {
  readonly type: 'Feature';
  readonly geometry: BoundaryGeometry | null;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface BoundaryFeatureCollection {
  readonly type: 'FeatureCollection';
  readonly features: readonly BoundaryFeature[];
  readonly crs?: unknown;
}

export type BoundaryRung = 'ADMIN2' | 'ADMIN3';

/* ── 2 · THE ACCEPTANCE CONTRACT ────────────────────────────────────────── */

/**
 * Every threshold the import enforces, in one place, as data.
 *
 * These are MEASURED values from the accepted attribute pack and G's
 * server-side geometry verification — not tuning knobs. A check that fails is
 * a finding about the source, never a number to loosen.
 */
export const BOUNDARY_ACCEPTANCE = {
  expectedFeatures: { ADMIN2: 30, ADMIN3: 416 } as const,
  idField: { ADMIN2: 'district_id', ADMIN3: 'sector_id' } as const,
  /** Rwanda's true envelope, from G's `returnExtentOnly` measurement, plus a margin. */
  envelope: { lonMin: 28.8, lonMax: 30.95, latMin: -2.95, latMax: -1.0 },
  crs: 'EPSG:4326' as const,
  /**
   * A polygon whose outer ring is exactly five points MIGHT be a real
   * quadrilateral, but in this pipeline it is overwhelmingly likely to be a
   * bounding box someone substituted for a boundary. Flagged, and rejected
   * when it matches its own bbox corner-for-corner — see `looksLikeBoundingBox`.
   */
  bboxRingPointCount: 5,
} as const;

/* ── 3 · FINDINGS ───────────────────────────────────────────────────────── */

export type BoundaryFindingCode =
  | 'COUNT'
  | 'NULL-GEOM'
  | 'GEOM-TYPE'
  | 'ENVELOPE'
  | 'CRS'
  | 'DUPLICATE'
  | 'ORPHAN'
  | 'CODE-SHAPE'
  | 'ID-MISMATCH'
  | 'DERIVED-EXTENT'
  | 'KIVU-INVARIANT'
  | 'MANIFEST';

export interface BoundaryFinding {
  readonly code: BoundaryFindingCode;
  readonly message: string;
}

export interface BoundaryImportResult {
  readonly rung: BoundaryRung;
  readonly accepted: boolean;
  readonly featureCount: number;
  readonly expectedFeatures: number;
  readonly geometryTypes: readonly string[];
  readonly rejects: readonly BoundaryFinding[];
  readonly flags: readonly BoundaryFinding[];
}

/* ── 4 · GEOMETRY WALKING ───────────────────────────────────────────────── */

/** Yields every [lon, lat] pair at any nesting depth. */
export function* boundaryCoordinates(geometry: BoundaryGeometry): Generator<readonly number[]> {
  const walk = function* (node: unknown): Generator<readonly number[]> {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number') {
      yield node as readonly number[];

      return;
    }
    for (const child of node) yield* walk(child);
  };

  yield* walk(geometry.coordinates);
}

/** The outer rings of a Polygon or MultiPolygon, without assuming which it is. */
function outerRings(geometry: BoundaryGeometry): readonly (readonly number[])[][] {
  const coords = geometry.coordinates;
  if (!Array.isArray(coords)) return [];

  if (geometry.type === 'Polygon') {
    return Array.isArray(coords[0]) ? [coords[0] as (readonly number[])[]] : [];
  }

  return coords
    .map((polygon) => (Array.isArray(polygon) ? (polygon[0] as (readonly number[])[]) : undefined))
    .filter((ring): ring is (readonly number[])[] => Array.isArray(ring));
}

/**
 * REFUSAL 2, AS A PREDICATE.
 *
 * True when a ring is a five-point closed rectangle whose corners are exactly
 * its own bounding box — which is what a `DerivedExtent` looks like when
 * someone serialises one as a polygon. A genuine administrative boundary is
 * never this shape; Rwandan districts are not rectangles.
 */
export function looksLikeBoundingBox(ring: readonly (readonly number[])[]): boolean {
  if (ring.length !== BOUNDARY_ACCEPTANCE.bboxRingPointCount) return false;

  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);

  /* Every vertex sits on a corner of the bbox: the definition of a box. */
  return ring.every(
    (p) => (p[0] === lonMin || p[0] === lonMax) && (p[1] === latMin || p[1] === latMax),
  );
}

/**
 * REFUSAL 1 AND 2 TOGETHER, AS A NAMED GUARD.
 *
 * Returns the findings rather than throwing, so an import reports everything
 * wrong with a file in one pass instead of one problem per run.
 */
export function assertNotDerivedExtent(
  rung: BoundaryRung,
  features: readonly BoundaryFeature[],
): readonly BoundaryFinding[] {
  let boxes = 0;

  for (const feature of features) {
    if (!feature.geometry) continue;
    for (const ring of outerRings(feature.geometry)) {
      if (looksLikeBoundingBox(ring)) boxes += 1;
    }
  }

  if (boxes === 0) return [];

  return [
    {
      code: 'DERIVED-EXTENT',
      message:
        `${rung}: ${boxes} ring(s) are five-point rectangles identical to their own bounding box. ` +
        'A bounding box is a settlement-derived camera aid, not an administrative boundary, and it ' +
        'belongs in `ext` — which this carrier is deliberately separate from. Nothing was imported.',
    },
  ];
}

/* ── 5 · THE IMPORT ─────────────────────────────────────────────────────── */

/**
 * Validate one layer. Attaches nothing — it decides whether attaching is safe.
 *
 * Every check from the accepted DATA manifest §3 is here, and each returns a
 * finding naming the rung, so a caller reading the result does not have to know
 * which file it came from.
 */
export function importBoundaryLayer(
  rung: BoundaryRung,
  collection: BoundaryFeatureCollection | undefined,
): BoundaryImportResult {
  const expected = BOUNDARY_ACCEPTANCE.expectedFeatures[rung];
  const rejects: BoundaryFinding[] = [];
  const flags: BoundaryFinding[] = [];

  if (!collection || !Array.isArray(collection.features)) {
    return {
      rung,
      accepted: false,
      featureCount: 0,
      expectedFeatures: expected,
      geometryTypes: [],
      rejects: [
        { code: 'COUNT', message: `${rung}: no feature collection supplied (0 of ${expected}).` },
      ],
      flags,
    };
  }

  const features = collection.features;
  const types = new Set<string>();

  /* CHECK 1 — exact feature count. Not "at least"; exact. */
  if (features.length !== expected) {
    rejects.push({
      code: 'COUNT',
      message: `${rung}: ${features.length} features, expected exactly ${expected}.`,
    });
  }

  /* CHECK 2 — geometry present and of an areal type. */
  let nullGeometry = 0;
  let wrongType = 0;

  for (const feature of features) {
    if (!feature.geometry || feature.geometry.coordinates === undefined) {
      nullGeometry += 1;
      continue;
    }
    types.add(feature.geometry.type);
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
      wrongType += 1;
    }
  }

  if (nullGeometry > 0) {
    rejects.push({ code: 'NULL-GEOM', message: `${rung}: ${nullGeometry} features with null geometry.` });
  }
  if (wrongType > 0) {
    rejects.push({
      code: 'GEOM-TYPE',
      message: `${rung}: ${wrongType} features are not Polygon or MultiPolygon. A sector is an AREA.`,
    });
  }

  /* CHECK 3 — WGS84, and inside Rwanda. Outside is a reject, never a clamp. */
  if (collection.crs !== undefined && !JSON.stringify(collection.crs).includes('4326')) {
    rejects.push({
      code: 'CRS',
      message: `${rung}: crs is ${JSON.stringify(collection.crs)}, expected ${BOUNDARY_ACCEPTANCE.crs}.`,
    });
  }

  const { lonMin, lonMax, latMin, latMax } = BOUNDARY_ACCEPTANCE.envelope;
  let strayed = 0;

  for (const feature of features) {
    if (!feature.geometry) continue;
    for (const [lon, lat] of boundaryCoordinates(feature.geometry)) {
      if (lon < lonMin || lon > lonMax || lat < latMin || lat > latMax) {
        strayed += 1;
        break;
      }
    }
  }

  if (strayed > 0) {
    rejects.push({
      code: 'ENVELOPE',
      message: `${rung}: ${strayed} features carry coordinates outside Rwanda's envelope. A reject, not a fix.`,
    });
  }

  /* REFUSAL 2 — no bounding box masquerading as a boundary. */
  rejects.push(...assertNotDerivedExtent(rung, features));

  /* CHECK 4 — ids: present, unique, and exactly the accepted identity set. */
  const idField = BOUNDARY_ACCEPTANCE.idField[rung];
  const ids = features.map((f) => String(f.properties?.[idField] ?? ''));

  if (ids.some((id) => id === '')) {
    rejects.push({ code: 'ID-MISMATCH', message: `${rung}: some features carry no ${idField}.` });
  }

  if (new Set(ids).size !== ids.length) {
    rejects.push({
      code: 'DUPLICATE',
      message: `${rung}: ${ids.length - new Set(ids).size} duplicate ${idField} values.`,
    });
  }

  /*
   * THE IDENTITY SET IS THE AUTHORITY'S, NOT THE FILE'S.
   *
   * The accepted attribute pack decides which 30 districts and which 416
   * sectors exist. Geometry may only describe those; it may not introduce a
   * unit, and it may not omit one. This is the check that makes the geometry
   * file subordinate to the identity data rather than a second opinion on it.
   */
  const known = new Set(
    rung === 'ADMIN2'
      ? nisrDistricts().map((d) => d.districtId)
      : nisrSectors().map((s) => s.sectorId),
  );
  const unknown = ids.filter((id) => id !== '' && !known.has(id));
  const missing = [...known].filter((id) => !ids.includes(id));

  if (unknown.length > 0) {
    rejects.push({
      code: 'ORPHAN',
      message: `${rung}: ${unknown.length} geometry features name a unit the authority does not have (${unknown.slice(0, 5).join(', ')}).`,
    });
  }
  if (missing.length > 0) {
    rejects.push({
      code: 'ID-MISMATCH',
      message: `${rung}: ${missing.length} authority units have no geometry (${missing.slice(0, 5).join(', ')}).`,
    });
  }

  /* CHECK 5 — self-describing codes survive the round trip. */
  if (rung === 'ADMIN3') {
    const badPrefix = features.filter((f) => {
      const sectorId = String(f.properties?.sector_id ?? '');
      const districtId = String(f.properties?.district_id ?? '');

      return sectorId !== '' && districtId !== '' && !sectorId.startsWith(districtId);
    }).length;

    if (badPrefix > 0) {
      rejects.push({
        code: 'CODE-SHAPE',
        message: `${rung}: ${badPrefix} sector ids are not prefixed by their district id.`,
      });
    }
  }

  return {
    rung,
    accepted: rejects.length === 0,
    featureCount: features.length,
    expectedFeatures: expected,
    geometryTypes: [...types],
    rejects,
    flags,
  };
}

/* ── 6 · THE LAKE KIVU INVARIANT, AT IMPORT TIME ────────────────────────── */

export interface KivuInvariantResult {
  readonly holds: boolean;
  readonly shortDistrictIds: readonly string[];
  readonly expectedShortDistrictIds: readonly string[];
  readonly findings: readonly BoundaryFinding[];
}

/**
 * THE SECTORS MUST NOT TILE RWANDA, AND THE IMPORT REQUIRES THAT.
 *
 * This is the one check that fails if the data looks TOO tidy. G measured that
 * exactly five districts — Rwanda's Lake Kivu shore — account for the whole
 * district/sector area gap, to within floating-point noise, and that every
 * district away from Kivu is an exact dissolve of its sectors including two
 * with large inland lakes.
 *
 * If that gap disappears, someone has tiled the lake. If a sixth district is
 * short, the source has changed shape and a district would silently inherit
 * lake semantics it has not earned. Both are rejects.
 *
 * Detection is RELATIVE (a proportion of the district's own area), so it is
 * scale-free and survives a change of `geometryPrecision` — unlike an absolute
 * area threshold, which would quietly start failing at a different precision.
 */
export function checkLakeKivuInvariant(
  districts: BoundaryFeatureCollection | undefined,
  sectors: BoundaryFeatureCollection | undefined,
  areaOf: (feature: BoundaryFeature) => number,
): KivuInvariantResult {
  const expectedShort = [...LAKE_KIVU_DISTRICT_IDS].sort();

  if (!districts || !sectors) {
    return {
      holds: false,
      shortDistrictIds: [],
      expectedShortDistrictIds: expectedShort,
      findings: [
        {
          code: 'KIVU-INVARIANT',
          message: 'Both layers are required to evaluate the Lake Kivu invariant; one is absent.',
        },
      ],
    };
  }

  const districtArea = new Map<string, number>();
  for (const feature of districts.features) {
    districtArea.set(String(feature.properties?.district_id ?? ''), areaOf(feature));
  }

  const sectorAreaByDistrict = new Map<string, number>();
  for (const feature of sectors.features) {
    const id = String(feature.properties?.district_id ?? '');
    sectorAreaByDistrict.set(id, (sectorAreaByDistrict.get(id) ?? 0) + areaOf(feature));
  }

  const short: string[] = [];

  for (const [id, area] of districtArea) {
    if (area <= 0) continue;
    const fromSectors = sectorAreaByDistrict.get(id) ?? 0;
    if ((area - fromSectors) / area > 0.001) short.push(id);
  }

  short.sort();

  const holds = JSON.stringify(short) === JSON.stringify(expectedShort);

  return {
    holds,
    shortDistrictIds: short,
    expectedShortDistrictIds: expectedShort,
    findings: holds
      ? []
      : [
          {
            code: 'KIVU-INVARIANT',
            message:
              `Districts short of their sectors are [${short.join(', ') || 'none'}], expected exactly ` +
              `[${expectedShort.join(', ')}] — Rwanda's Lake Kivu shore. District polygons include the ` +
              'lake and sector polygons exclude it; if that gap is absent the lake has been tiled, and ' +
              'if a different district is short the source has changed shape. Neither is repaired here.',
          },
        ],
  };
}

/**
 * The rule the resolver must obey, restated where an importer can see it.
 *
 * A point on Lake Kivu is inside a district and inside NO sector. That is a
 * successful, complete answer — see `SectorResolution` and
 * `assertNoSectorIsNotRecovered` in the authority module, which make "no
 * sector" sayable and refuse the four recoveries by name.
 */
export const SECTORS_DO_NOT_TILE_RWANDA = SECTOR_TILING_GAP.sectorsTileRwanda === false;

/* ── 7 · THE DATA MANIFEST VALIDATION CONTRACT ──────────────────────────── */

/**
 * WHY A MANIFEST IS BINDING RATHER THAN DECORATIVE.
 *
 * A `.geojson` is invisible to all three promotion fingerprints — C scans
 * `.ts/.tsx/.mjs/.json` under the source roots, PA scans `frontend/public`, SC
 * scans `scripts`. So boundary geometry could change completely without moving
 * C, PA or SC by one digit. The manifest is the half of candidate identity that
 * covers it, and a geometry file with no manifest row is a file nobody can
 * prove anything about.
 */
export interface BoundaryDataManifestEntry {
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly featureCount: number;
  readonly geometryType: string;
  readonly authority: AdministrativeAuthority;
  readonly sourceLayer: string;
  readonly vintage: string;
  readonly licence: string;
  readonly attribution: string;
}

export function validateBoundaryDataManifest(
  rung: BoundaryRung,
  entry: BoundaryDataManifestEntry | undefined,
): readonly BoundaryFinding[] {
  const findings: BoundaryFinding[] = [];

  if (!entry) {
    return [
      {
        code: 'MANIFEST',
        message: `${rung}: no DATA manifest entry. Geometry is invisible to C/PA/SC, so a file without a manifest row has no declared identity at all.`,
      },
    ];
  }

  if (!/^[0-9a-f]{64}$/.test(entry.sha256)) {
    findings.push({ code: 'MANIFEST', message: `${rung}: sha256 is not a 64-character hex digest.` });
  }

  if (entry.featureCount !== BOUNDARY_ACCEPTANCE.expectedFeatures[rung]) {
    findings.push({
      code: 'MANIFEST',
      message: `${rung}: manifest declares ${entry.featureCount} features, contract requires ${BOUNDARY_ACCEPTANCE.expectedFeatures[rung]}.`,
    });
  }

  if (entry.authority !== NISR) {
    findings.push({ code: 'MANIFEST', message: `${rung}: authority must be declared as ${NISR}.` });
  }

  if (!entry.licence.includes('CC BY 4.0')) {
    findings.push({ code: 'MANIFEST', message: `${rung}: licence must record CC BY 4.0.` });
  }

  /*
   * Attribution is a LICENCE CONDITION, not a courtesy, and a reworded version
   * is not attribution. Compared exactly.
   */
  if (entry.attribution !== NISR_ATTRIBUTION) {
    findings.push({
      code: 'MANIFEST',
      message: `${rung}: attribution must be the exact required string, verbatim.`,
    });
  }

  if (!entry.vintage.includes('2022')) {
    findings.push({ code: 'MANIFEST', message: `${rung}: vintage must record the 2022 content vintage.` });
  }

  return findings;
}

/* ── 8 · THE LOADER — WIRED, AND CURRENTLY FINDING NOTHING ──────────────── */

export const BOUNDARY_FILES: Readonly<Record<BoundaryRung, string>> = {
  ADMIN2: 'rwanda-boundary-districts.geojson',
  ADMIN3: 'rwanda-boundary-sectors.geojson',
};

function sha256Of(file: string): string {
  const path = join(__dirname, 'data', file);

  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : '';
}

function readCollection(file: string): BoundaryFeatureCollection | undefined {
  const path = join(__dirname, 'data', file);

  /*
   * ABSENT IS A NORMAL STATE, NOT AN ERROR. Today both files are absent and
   * coverage is PENDING. A malformed file, by contrast, IS an error and must
   * not be swallowed into the same "absent" answer — a parse failure is
   * reported as a reject rather than degrading silently to no geometry.
   */
  if (!existsSync(path)) return undefined;

  return JSON.parse(readFileSync(path, 'utf8')) as BoundaryFeatureCollection;
}

export interface BoundaryLoadState {
  readonly present: boolean;
  readonly rung: BoundaryRung;
  readonly file: string;
  readonly result: BoundaryImportResult;
  readonly ref: BoundaryGeometryRef | null;
}

/**
 * Load and validate one rung's boundary file, if it is there.
 *
 * ALL-OR-NOTHING: `ref` is non-null only when every check passed. A file that
 * is present but rejected yields `present: true, ref: null` — which is a
 * different and more useful statement than "absent", and it is why those two
 * are separate fields.
 */
const loadCache = new Map<BoundaryRung, BoundaryLoadState>();

export function loadBoundaryLayer(rung: BoundaryRung): BoundaryLoadState {
  const cached = loadCache.get(rung);
  if (cached) return cached;

  const state = loadBoundaryLayerUncached(rung);
  loadCache.set(rung, state);

  return state;
}

function loadBoundaryLayerUncached(rung: BoundaryRung): BoundaryLoadState {
  const file = BOUNDARY_FILES[rung];
  let collection: BoundaryFeatureCollection | undefined;
  let parseReject: BoundaryFinding | undefined;

  try {
    collection = readCollection(file);
  } catch (error) {
    parseReject = {
      code: 'MANIFEST',
      message: `${rung}: ${file} is present but could not be parsed as JSON — ${(error as Error).message}`,
    };
  }

  if (parseReject) {
    return {
      present: true,
      rung,
      file,
      result: {
        rung,
        accepted: false,
        featureCount: 0,
        expectedFeatures: BOUNDARY_ACCEPTANCE.expectedFeatures[rung],
        geometryTypes: [],
        rejects: [parseReject],
        flags: [],
      },
      ref: null,
    };
  }

  const result = importBoundaryLayer(rung, collection);

  if (!collection || !result.accepted) {
    return { present: collection !== undefined, rung, file, result, ref: null };
  }

  const provenance = rung === 'ADMIN2' ? NISR_DISTRICT_PROVENANCE : NISR_SECTOR_PROVENANCE;

  return {
    present: true,
    rung,
    file,
    result,
    ref: {
      authority: NISR,
      sourceLayer: provenance.sourceLayer,
      vintage: provenance.vintage,
      geometryType: result.geometryTypes.includes('MultiPolygon') ? 'MultiPolygon' : 'Polygon',
      crs: 'EPSG:4326',
      /*
       * THE DIGEST OF THE BYTES ACTUALLY LOADED.
       *
       * Computed from the file on disk rather than copied from the manifest, so
       * the two are INDEPENDENT statements that a spec can compare. If someone
       * swaps the file, this value moves and the manifest does not, and the
       * comparison fails — which is the whole point of declaring a digest.
       */
      sha256: sha256Of(file),
      featureCount: result.featureCount,
    },
  };
}

/** Both rungs, for a caller that wants the whole picture in one call. */
export function loadRwandaBoundaryGeometry(): readonly BoundaryLoadState[] {
  return [loadBoundaryLayer('ADMIN2'), loadBoundaryLayer('ADMIN3')];
}

/**
 * THE HANDOFF, STATED AS A VALUE.
 *
 * True exactly while the bytes are the only thing outstanding. Everything else
 * — the carrier, the checks, the Kivu invariant, the manifest contract, the
 * loader — is complete and exercised by spec. A reader asking "what is left?"
 * gets one answer instead of a paragraph.
 */
export function boundaryGeometryAwaitingBytesOnly(): boolean {
  return loadRwandaBoundaryGeometry().every((state) => !state.present);
}

/**
 * THE LIVE COVERAGE ANSWER — derived from the loader, not declared.
 *
 * `RWANDA_BOUNDARY_GEOMETRY` in the authority module is the static PENDING
 * declaration and the source of the expected counts and the reason text. This
 * function is what a surface should actually ask, because it reports what is on
 * disk RIGHT NOW: PENDING while the files are absent, PRESENT the moment two
 * valid files land, and PENDING-with-a-reason if a file is present but rejected.
 *
 * That last case is the one worth having. A rejected file is not the same as no
 * file, and a coverage reporter that collapsed them would let a broken import
 * look like an import that never happened.
 *
 * It lives here rather than in the authority module because the loader depends
 * on the authority for its identity set; putting this there would close an
 * import cycle.
 */
export function rwandaBoundaryCoverageResolved(): readonly BoundaryGeometryCoverage[] {
  const states = new Map(loadRwandaBoundaryGeometry().map((state) => [state.rung, state]));

  return RWANDA_BOUNDARY_GEOMETRY.map((declared) => {
    const state = states.get(declared.rung as BoundaryRung);

    if (!state || !state.present) return declared;

    if (!state.ref) {
      return {
        ...declared,
        status: 'PENDING' as const,
        presentFeatures: 0,
        refs: [],
        reason:
          `${declared.rung}: ${state.file} is present and was REJECTED, so nothing was imported. ` +
          state.result.rejects.map((finding) => `[${finding.code}] ${finding.message}`).join(' ') +
          ' Boundary coverage stays PENDING: a partial or unverified import is worse than none, ' +
          'because a map is confidently wrong exactly where it is missing.',
      };
    }

    return {
      ...declared,
      status: 'PRESENT' as const,
      presentFeatures: state.result.featureCount,
      refs: [state.ref],
      reason:
        `${declared.rung}: ${state.result.featureCount} official ${state.ref.geometryType} features ` +
        `imported from ${state.file} under ${NISR} authority, every acceptance check passed. ` +
        'Boundaries are carried in boundaryGeometry and never in ext.',
    };
  });
}

/* ── 9 · RECORD-LEVEL ATTACHMENT ────────────────────────────────────────── */

/**
 * The authority's records, with verified boundary geometry attached.
 *
 * WHY THIS IS A SEPARATE FUNCTION RATHER THAN A CHANGE TO `nisrDistricts()`.
 *
 * The authority module owns identity and must not depend on geometry — the
 * import direction is deliberate and it is what keeps the two coverages
 * genuinely independent. Identity is complete whether or not a polygon exists;
 * inverting that dependency would make a geometry failure look like an identity
 * failure, which is exactly the collapse the two-dimensional coverage rule
 * exists to prevent.
 *
 * So geometry is attached HERE, by the module that validated it, and a consumer
 * that wants boundaries asks for them by name.
 *
 * `boundaryGeometry` is non-null only when every acceptance check passed for
 * that rung. There is no partial state: a rejected file leaves every record
 * exactly as the authority produced it, with `boundaryGeometry: null`.
 */
export function nisrDistrictsWithGeometry(): readonly NisrDistrict[] {
  const ref = loadBoundaryLayer('ADMIN2').ref;

  return ref ? nisrDistricts().map((district) => ({ ...district, boundaryGeometry: ref })) : nisrDistricts();
}

export function nisrSectorsWithGeometry(): readonly NisrSector[] {
  const ref = loadBoundaryLayer('ADMIN3').ref;

  return ref ? nisrSectors().map((sector) => ({ ...sector, boundaryGeometry: ref })) : nisrSectors();
}

/**
 * The geometry half of the DATA manifest, measured from what is on disk.
 *
 * A candidate declaration copies these values; a spec compares them against the
 * declaration. Two independent statements about the same bytes.
 */
export function rwandaGeometryDataIdentity(): readonly {
  readonly rung: BoundaryRung;
  readonly file: string;
  readonly sha256: string;
  readonly featureCount: number;
  readonly geometryTypes: readonly string[];
  readonly accepted: boolean;
}[] {
  return (['ADMIN2', 'ADMIN3'] as const).map((rung) => {
    const state = loadBoundaryLayer(rung);

    return {
      rung,
      file: state.file,
      sha256: state.ref?.sha256 ?? sha256Of(state.file),
      featureCount: state.result.featureCount,
      geometryTypes: state.result.geometryTypes,
      accepted: state.result.accepted,
    };
  });
}
