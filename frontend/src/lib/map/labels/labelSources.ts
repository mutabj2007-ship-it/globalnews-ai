import { COUNTRIES, getLocalizedCountryName, type LanguageCode } from '@globalnews-ai/shared';
import { sourceLanguageFor } from '@/lib/i18n/sourceLanguage';
import { computeFeatureBounds, getCountryFeatureCollection, type CountryFeature } from '@/lib/map/countryGeometry';
import { type LabelCandidate, countryLabelVisible, estimateLabelBox } from './labelPlacement';

/**
 * SPATIAL M2 — WHAT THE MAP IS ALLOWED TO NAME.
 *
 * Three reference label classes, from Part I §F's hierarchy and the Design
 * reference's own map: countries, continents and water bodies. Evidence
 * captions are produced separately from the evidence set, because they belong
 * to the intelligence layer and outrank all of these.
 *
 * ── EVERY NAME IS REAL AND EVERY NAME IS LOCALISED WHERE WE HAVE ONE ──────
 *
 * Country names come from the shared registry through
 * `getLocalizedCountryName`, so the map reads in the reader's language and
 * never invents a spelling. Continents and oceans are a small fixed table —
 * they are stable, they are not in the registry, and the alternative is
 * deriving a continent's position from the countries currently on screen,
 * which would make the label move as the data changed.
 *
 * ── AND NOTHING HERE NAMES A PLACE WE CANNOT PLACE ────────────────────────
 *
 * A country with no geometry produces no label rather than a label at a
 * guessed position. Geometry is the same `countryGeometry` boundary the fill
 * layer draws from, so a name can never appear where its country is not.
 */

/** Rough centre and a display weight. Positions are stable, not data-derived. */
interface FixedLabel {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly weight: number;
}

/** Continents — ambient orientation, widest tracking, dimmest ink. */
export const CONTINENT_LABELS: readonly FixedLabel[] = [
  { id: 'africa', lon: 20, lat: 2, minZoom: 0.8, maxZoom: 4.6, weight: 90 },
  { id: 'europe', lon: 15, lat: 52, minZoom: 1.1, maxZoom: 4.6, weight: 80 },
  { id: 'asia', lon: 95, lat: 45, minZoom: 0.8, maxZoom: 4.6, weight: 95 },
  { id: 'northAmerica', lon: -100, lat: 45, minZoom: 0.8, maxZoom: 4.6, weight: 88 },
  { id: 'southAmerica', lon: -60, lat: -15, minZoom: 0.8, maxZoom: 4.6, weight: 85 },
  { id: 'oceania', lon: 140, lat: -25, minZoom: 1.1, maxZoom: 4.6, weight: 70 },
];

/** Oceans and major seas — italic, blue-slate, per Part I §F's label hierarchy. */
export const WATER_LABELS: readonly FixedLabel[] = [
  { id: 'atlantic', lon: -30, lat: 15, minZoom: 0.8, maxZoom: 6, weight: 95 },
  { id: 'pacific', lon: -150, lat: 5, minZoom: 0.8, maxZoom: 6, weight: 95 },
  { id: 'indian', lon: 75, lat: -25, minZoom: 0.8, maxZoom: 6, weight: 92 },
  { id: 'arctic', lon: 0, lat: 80, minZoom: 1.2, maxZoom: 6, weight: 70 },
  { id: 'southernOcean', lon: 20, lat: -62, minZoom: 1.2, maxZoom: 6, weight: 70 },
  { id: 'mediterranean', lon: 17, lat: 35.5, minZoom: 3.2, maxZoom: 7.5, weight: 60 },
  { id: 'baltic', lon: 19.5, lat: 57.5, minZoom: 4.2, maxZoom: 8, weight: 50 },
  { id: 'redSea', lon: 38, lat: 20, minZoom: 4, maxZoom: 8, weight: 45 },
  { id: 'blackSea', lon: 34, lat: 43.5, minZoom: 4, maxZoom: 8, weight: 45 },
  { id: 'caribbean', lon: -75, lat: 15, minZoom: 3.6, maxZoom: 8, weight: 45 },
  { id: 'northSea', lon: 3, lat: 56, minZoom: 4.4, maxZoom: 8, weight: 40 },
  { id: 'gulfOfGuinea', lon: 2, lat: 2, minZoom: 4, maxZoom: 8, weight: 40 },
  { id: 'arabianSea', lon: 63, lat: 15, minZoom: 3.8, maxZoom: 8, weight: 45 },
  { id: 'bayOfBengal', lon: 88, lat: 15, minZoom: 3.8, maxZoom: 8, weight: 45 },
  { id: 'southChinaSea', lon: 114, lat: 13, minZoom: 3.8, maxZoom: 8, weight: 45 },
];

/* ══════════════════════════════════════════════════════════════════════════
   WHERE A COUNTRY'S NAME IS ALLOWED TO SIT
   ══════════════════════════════════════════════════════════════════════════

   MEASURED DEFECT. The anchor was `computeFeatureCenter`, which is the midpoint
   of the bounding box of EVERY ring in the feature. For a state with overseas
   territory that box spans the territory too, and the midpoint falls in open
   water. France is the reported case and the numbers are unambiguous:

       FRA, 3 polygons     full-feature bbox midpoint   -22.48, 26.60
                           -> Atlantic Ocean, west of the Western Sahara coast
                           largest-polygon anchor         1.75, 46.75
                           -> central metropolitan France

   It is not only France. Across the 167 countries this layer labels, TWENTY
   produced an anchor OUTSIDE their own polygon: FJI PNG IDN HTI RUS BHS NOR
   FRA CUB GIN ISR ARE LAO VNM HRV SLB NZL PHL MYS JPN.

   NATURAL EARTH LABEL_X / LABEL_Y WOULD BE THE FIRST CHOICE AND ARE NOT HERE.
   Measured on the bundled dataset: `world-atlas/countries-110m` carries 177
   geometry records, and ZERO of them carry LABEL_X or label_x. Using them
   would mean shipping a second, larger dataset — a new data dependency, which
   this lane is not authorised to add. So the second preference applies: a
   mainland / largest-polygon cartographic anchor.

   `computeFeatureCenter` IS DELIBERATELY LEFT ALONE. It is the camera's
   function — `fitBounds` and the fly-to for a selected country want the whole
   feature, overseas territory included. A label wants the mainland. They are
   different questions and they now have different functions.
   ══════════════════════════════════════════════════════════════════════════ */

type Ring = ReadonlyArray<readonly [number, number]>;
type Poly = ReadonlyArray<Ring>;

function polygonsOf(geometry: unknown): readonly Poly[] {
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g?.type === 'Polygon') return [g.coordinates as Poly];
  if (g?.type === 'MultiPolygon') return g.coordinates as readonly Poly[];
  return [];
}

/** Shoelace area in square degrees. Only ever compared against itself. */
function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring and not inside any hole. */
function pointInPolygon(x: number, y: number, poly: Poly): boolean {
  if (poly.length === 0 || !pointInRing(x, y, poly[0])) return false;
  for (let h = 1; h < poly.length; h += 1) if (pointInRing(x, y, poly[h])) return false;
  return true;
}

function bboxOfRing(ring: Ring): [number, number, number, number] {
  let w = Infinity;
  let e = -Infinity;
  let s = Infinity;
  let n = -Infinity;
  for (const [x, y] of ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
}

/*
   A concave country — Norway, Croatia, Vietnam — can have a bbox midpoint that
   is outside its own coastline even when only one polygon is involved. For
   those, the widest INTERIOR span on the horizontal line through the box centre
   is taken instead: it is the cheap, classic label point, it is deterministic,
   and it is guaranteed to be inside by construction.
*/
function widestInteriorSpan(poly: Poly, y: number): number | null {
  const xs: number[] = [];
  for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  if (xs.length < 2) return null;
  xs.sort((a, b) => a - b);

  let bestMid: number | null = null;
  let bestWidth = 0;
  for (let i = 0; i + 1 < xs.length; i += 1) {
    const mid = (xs[i] + xs[i + 1]) / 2;
    const width = xs[i + 1] - xs[i];
    if (width > bestWidth && pointInPolygon(mid, y, poly)) {
      bestWidth = width;
      bestMid = mid;
    }
  }
  return bestMid;
}

/**
 * The cartographic anchor for a country's name: on its mainland, and inside
 * its own coastline.
 *
 * Largest polygon by area, then its bbox midpoint if that sits on land, then
 * the widest interior span through the box centre. Returns null rather than a
 * guess — a name we cannot place is not drawn.
 */
export function countryLabelAnchor(feature: CountryFeature): [number, number] | null {
  const polys = polygonsOf(feature.geometry);
  if (polys.length === 0) return null;

  let largest: Poly | null = null;
  let largestArea = -1;
  for (const poly of polys) {
    if (poly.length === 0) continue;
    const area = ringArea(poly[0]);
    if (area > largestArea) {
      largestArea = area;
      largest = poly;
    }
  }
  if (largest === null) return null;

  const [w, s, e, n] = bboxOfRing(largest[0]);
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;

  if (pointInPolygon(cx, cy, largest)) return [cx, cy];

  const spanX = widestInteriorSpan(largest, cy);
  if (spanX !== null) return [spanX, cy];

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   NAMED TERRITORIES THAT THE COUNTRY REGISTRY DOES NOT CARRY
   ══════════════════════════════════════════════════════════════════════════

   MEASURED DEFECT. Greenland's polygon renders and its name never appears.
   The cause is one line in `countryLabelSeeds`: a label seed requires
   `feature.properties.country?.iso3`, that metadata comes from
   `findCountryByNumeric`, and the shared registry holds 196 SOVEREIGN STATES.
   Greenland is not one, so `findCountryByNumeric('304')` returns null and the
   feature is skipped before any label rule is consulted.

   RULED OUT BY MEASUREMENT, not by reasoning: it is not a rank threshold
   (never reached, and Greenland's box is ~1,442 square degrees, far above any
   tier), not a priority whitelist (none exists for countries), and not
   collision suppression (`suppressCountries` only fires when an evidence
   caption already names the same iso3, and Greenland never becomes a
   candidate at all).

   THE REGISTRY IS NOT EDITED TO FIX A LABEL. `shared/src/countries.ts` is a
   cross-cutting contract about sovereign states; adding a dependency to it so
   a map can draw a word would make a presentation problem into a contract
   change. This table is local to the label layer, which already carries fixed
   tables for continents and oceans, and it names only what was reported.

   WHICH OTHER TERRITORIES SHOULD BE NAMED IS A PRODUCT DECISION, NOT MINE.
   Antarctica, Western Sahara, Falklands/Malvinas and Kosovo all have geometry
   here and none has a registry record; several are contested, and choosing
   what to call them is exactly the kind of judgement this programme keeps out
   of utility functions. Greenland is added because it was measured and
   reported. The rest wait for a ruling.
   ══════════════════════════════════════════════════════════════════════════ */

export interface NamedTerritory {
  /** ISO 3166-1 numeric, as world-atlas ids them. */
  readonly numericId: string;
  /** Key into the map dictionary's `territoryNames` group. */
  readonly nameKey: string;
}

export const NAMED_TERRITORIES: readonly NamedTerritory[] = [
  { numericId: '304', nameKey: 'greenland' },
];

export interface CountryLabelSeed {
  /** Present for a registry country; absent for a named territory. */
  readonly iso3?: string;
  /** Present for a named territory; absent for a registry country. */
  readonly nameKey?: string;
  readonly lon: number;
  readonly lat: number;
  /** Bounding-box area in square degrees — the tier input for Part I §F. */
  readonly area: number;
}

let seeds: readonly CountryLabelSeed[] | null = null;

/**
 * Country label anchors, computed ONCE from the same geometry the map draws.
 *
 * Memoised because the geometry does not change and this walks every polygon;
 * recomputing it per frame is the difference between a label layer and a
 * stutter.
 */
export function countryLabelSeeds(): readonly CountryLabelSeed[] {
  if (seeds !== null) return seeds;

  const out: CountryLabelSeed[] = [];

  const territoryByNumeric = new Map(NAMED_TERRITORIES.map((t) => [t.numericId, t.nameKey]));

  for (const feature of getCountryFeatureCollection().features) {
    const iso3 = feature.properties.country?.iso3;
    /*
      A feature with no registry record is not automatically nameless: a small
      explicit table says which territories may still be named. Everything else
      is still skipped, so the map never invents a name for a shape.
    */
    const nameKey = iso3 === undefined ? territoryByNumeric.get(feature.properties.numericId) : undefined;

    if (iso3 === undefined && nameKey === undefined) continue;

    /*
      THE MAINLAND ANCHOR, not the whole-feature bbox midpoint. The bounds are
      still the WHOLE feature, because the area tier asks "how big is this
      country" and the answer includes its overseas territory.
    */
    const centre = countryLabelAnchor(feature);
    const bounds = computeFeatureBounds(feature);

    if (centre === null || bounds === null) continue;

    const [[west, south], [east, north]] = bounds;
    const width = Math.abs(east - west);

    /*
      An antimeridian-spanning bbox reports a width of nearly 360°, which would
      make Fiji the largest country on Earth and win it a world-view label. The
      area is treated as unknown-small in that case rather than being corrected,
      because a label tier is not worth inventing geometry over.
    */
    const area = width > 180 ? 1 : width * Math.abs(north - south);

    out.push({ iso3, nameKey, lon: centre[0], lat: centre[1], area });
  }

  seeds = out;

  return seeds;
}

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
}

export type Projector = (lon: number, lat: number) => ProjectedPoint | null;

export interface ReferenceLabelInput {
  readonly zoom: number;
  readonly language: LanguageCode;
  readonly project: Projector;
  readonly continentNames: Readonly<Record<string, string>>;
  readonly waterNames: Readonly<Record<string, string>>;
  /** Names for geometry-backed places the sovereign-state registry omits. */
  readonly territoryNames: Readonly<Record<string, string>>;
  /** Off when the LABEL layer is toggled off in the rail. */
  readonly enabled: boolean;
}

/** Type sizes and tracking, from the Design prototype's own `.lbl` rules. */
export const LABEL_TYPE = {
  country: { size: 10.5, tracking: 0.16 },
  continent: { size: 13, tracking: 0.42 },
  water: { size: 9.5, tracking: 0.2 },
  evidence: { size: 9.5, tracking: 0.14 },
} as const;

export function referenceLabelCandidates(input: ReferenceLabelInput): readonly LabelCandidate[] {
  if (!input.enabled) return [];

  const out: LabelCandidate[] = [];

  for (const seed of countryLabelSeeds()) {
    if (!countryLabelVisible(seed.area, input.zoom)) continue;

    const point = input.project(seed.lon, seed.lat);

    if (point === null) continue;

    const meta = seed.iso3 === undefined ? undefined : COUNTRIES.find((country) => country.iso3 === seed.iso3);
    const source = sourceLanguageFor(input.language);
    const text =
      seed.nameKey !== undefined
        ? input.territoryNames[seed.nameKey]
        : ((meta && source ? getLocalizedCountryName(meta.iso2, source) : undefined) ?? meta?.name);

    if (text === undefined) continue;

    const box = estimateLabelBox(text, LABEL_TYPE.country.size, LABEL_TYPE.country.tracking);

    out.push({
      id: `country:${seed.iso3 ?? seed.nameKey ?? 'unknown'}`,
      kind: 'country',
      text,
      x: point.x,
      y: point.y,
      weight: seed.area,
      countryIso3: seed.iso3,
      ...box,
    });
  }

  for (const label of CONTINENT_LABELS) {
    if (input.zoom < label.minZoom || input.zoom > label.maxZoom) continue;

    const point = input.project(label.lon, label.lat);
    const text = input.continentNames[label.id];

    if (point === null || text === undefined) continue;

    out.push({
      id: `continent:${label.id}`,
      kind: 'continent',
      text,
      x: point.x,
      y: point.y,
      weight: label.weight,
      ...estimateLabelBox(text, LABEL_TYPE.continent.size, LABEL_TYPE.continent.tracking),
    });
  }

  for (const label of WATER_LABELS) {
    if (input.zoom < label.minZoom || input.zoom > label.maxZoom) continue;

    const point = input.project(label.lon, label.lat);
    const text = input.waterNames[label.id];

    if (point === null || text === undefined) continue;

    out.push({
      id: `water:${label.id}`,
      kind: 'water',
      text,
      x: point.x,
      y: point.y,
      weight: label.weight,
      ...estimateLabelBox(text, LABEL_TYPE.water.size, LABEL_TYPE.water.tracking),
    });
  }

  return out;
}
