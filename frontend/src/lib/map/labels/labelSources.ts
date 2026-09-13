import { COUNTRIES, getLocalizedCountryName, type LanguageCode } from '@globalnews-ai/shared';
import { sourceLanguageFor } from '@/lib/i18n/sourceLanguage';
import { computeFeatureBounds, getCountryFeatureCollection, type CountryFeature } from '@/lib/map/countryGeometry';
import { type LabelCandidate, countryLabelVisible, estimateLabelBox } from './labelPlacement';
import { REFERENCE_PLACE_SEEDS } from './referencePlaces';
import { DESIGN_LABEL } from '@/lib/map/spatial/designRenderTokens';

/**
 * SPATIAL M2 — WHAT THE MAP IS ALLOWED TO NAME.
 *
 * Six reference label classes, from Part I §F's hierarchy and the Design
 * reference's own map: countries, continents, water bodies and — added under
 * PO ruling D-2 — lakes, rivers and cities. Evidence
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
  /**
   * The camera's canonical centre longitude and the viewport width in CSS
   * pixels. PO ruling B: together they decide, in geographic space, whether a
   * feature is inside the world the reader is looking at. Optional so an
   * un-updated consumer degrades to its previous behaviour rather than to a
   * blank map.
   */
  readonly centerLon?: number;
  readonly centerLat?: number;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
}

/**
 * Type sizes and tracking, from the Design prototype's own `.lbl` rules.
 *
 * C907 §5 — READ FROM `DESIGN_LABEL` RATHER THAN RESTATED. This table used to
 * carry its own numbers and claim the same provenance, and three of them had
 * drifted from it: country 10.5 against the rule's 11, continent 13 against
 * 13.5, city 9/.06 against 9.5/.08. A second hand-written copy of a value is a
 * second place for it to drift, which is precisely the defect §5 exists to
 * close — so there is now one copy, in the token module, and this is a view of
 * it.
 *
 * The DENSITY CONTRACT IS UNTOUCHED. Class floors, per-class caps, the
 * geographic viewport guard, governed-identity dedup and collision priority
 * are all unchanged; only the box each candidate measures changes, and it
 * changes in the safe direction — slightly larger type yields slightly FEWER
 * surviving labels, never more.
 */
export const LABEL_TYPE = {
  country: { size: DESIGN_LABEL.country.size, tracking: DESIGN_LABEL.country.tracking },
  continent: { size: DESIGN_LABEL.continent.size, tracking: DESIGN_LABEL.continent.tracking },
  water: { size: DESIGN_LABEL.water.size, tracking: DESIGN_LABEL.water.tracking },
  evidence: { size: DESIGN_LABEL.evidence.size, tracking: DESIGN_LABEL.evidence.tracking },
  /*
    D-2. A lake is water and takes the water treatment one step smaller, so a
    named lake never out-shouts the sea it drains to. A river is smaller again.

    A CITY IS THE ONE MIXED-CASE LABEL ON THE MAP, and it is deliberate: every
    other class is a region, an ocean or a state, and small-caps tracking is
    how the reference reads them. A settlement is a point, it is the densest
    class on the canvas, and upper-casing 1 251 of them would turn a country
    at zoom into a wall. `EvidenceMapCanvas` already carried the rule —
    `label.kind === 'city' ? '' : 'uppercase'` — before there was a city to
    draw.
  */
  lake: { size: DESIGN_LABEL.lake.size, tracking: DESIGN_LABEL.lake.tracking },
  river: { size: DESIGN_LABEL.river.size, tracking: DESIGN_LABEL.river.tracking },
  city: { size: DESIGN_LABEL.city.size, tracking: DESIGN_LABEL.city.tracking },
} as const;

export type ReferenceKind = 'lake' | 'river' | 'city';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REFERENCE LABEL DENSITY — PO RULING B, C906
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The golden screenshots are the density authority, and they are explicit:
 *
 *   WORLD VIEW      continents, oceans and major seas, country names.
 *                   NO river wall. NO city wall. NO dense lake labels.
 *   REGIONAL        major lakes in view — Kivu, Albert, Edward — and useful
 *                   settlements — Kigali, Kampala, Goma, Bukavu. River labels
 *                   only where one is genuinely useful.
 *
 * These floors are in THIS PRODUCT'S zoom range (MIN_ZOOM 0.6 … MAX_ZOOM 6),
 * which is the scale the golden frames were captured at: the world frame sits
 * near 1.1 and the Rwanda frame at 5.9. So every class floor is above the world
 * view by construction — the world frame cannot show a lake, a city or a river
 * name whatever the upstream data says — and the two classes the Rwanda frame
 * does show clear 5.9 comfortably.
 *
 * Rivers are the strictest because they are the class that failed: a river is a
 * long thin feature whose one label says least about where you are, and the
 * ruling asks for "only genuinely useful river labels" rather than for none.
 */
export const REFERENCE_CLASS_FLOOR: Readonly<Record<ReferenceKind, number>> = {
  lake: 2.6,
  city: 3.4,
  river: 5.2,
};

/**
 * The most labels of each class that may be drawn in one frame.
 *
 * NOT A REPLACEMENT FOR COLLISION, WHICH IS PRESERVED EXACTLY. The greedy grid
 * stops labels overlapping; it has nothing to say about three hundred labels
 * that all fit. The Alpha failure was the second thing, so it needs a second
 * answer, and these numbers are read off the golden Rwanda frame: about nine
 * settlements, five lakes, no rivers.
 */
export const REFERENCE_CLASS_CAP: Readonly<Record<ReferenceKind, number>> = {
  lake: 10,
  city: 24,
  river: 4,
};

/**
 * Is this longitude inside the world the camera can actually see?
 *
 * Computed in DEGREES, from the camera, before any projection. At zoom z one
 * world spans 360 degrees across `512 * 2^z` pixels, so a viewport `w` pixels
 * wide sees `360 * w / (512 * 2^z)` degrees — doubled here, because a label
 * anchored just off the edge may still belong to a feature crossing it, and
 * halving the tolerance would clip legitimate labels at the frame edge.
 *
 * Returns true when the caller supplies no camera, so a consumer that has not
 * been updated keeps its previous behaviour rather than silently losing every
 * label.
 */
export function withinVisibleWorld(
  lon: number,
  lat: number,
  input: Pick<ReferenceLabelInput, 'zoom' | 'centerLon' | 'centerLat' | 'viewportWidth' | 'viewportHeight'>,
): boolean {
  if (
    input.centerLon === undefined ||
    input.centerLat === undefined ||
    input.viewportWidth === undefined ||
    input.viewportHeight === undefined
  ) {
    return true;
  }

  const degreesPerPixel = 360 / (512 * 2 ** input.zoom);

  /*
    HALF the viewport, because the camera sits at its centre — a third bug the
    tests caught. Using the full width as the distance from centre doubled the
    frame, and at Rwanda zoom that reached Nairobi, Kinshasa and Dar es Salaam,
    which then competed for the class caps against the settlements actually on
    screen.

    `EDGE_MARGIN` keeps a little beyond the edge so a label anchored just
    outside is still offered to the collision grid rather than clipped by this
    guard, which has no way to know how wide the text will be.
  */
  const halfWidthDegrees = (degreesPerPixel * input.viewportWidth) / 2;
  const halfHeightDegrees = (degreesPerPixel * input.viewportHeight) / 2;
  const EDGE_MARGIN = 1.2;

  /* Shortest angular distance, so a camera near the antimeridian still works. */
  const dLon = Math.abs(((((lon - input.centerLon + 180) % 360) + 360) % 360) - 180);
  if (dLon > Math.min(180, halfWidthDegrees * EDGE_MARGIN)) return false;

  /*
    LATITUDE MATTERS AS MUCH AS LONGITUDE, AND LEAVING IT OUT WAS A REAL BUG I
    CAUGHT IN TEST. A longitude-only guard admits everything in a pole-to-pole
    strip, so at Rwanda zoom the class caps filled with Cairo, Khartoum, Athens
    and Kyiv — all within ten degrees of longitude, none of them anywhere near
    the frame — and Kampala, Goma and Bukavu never got a slot.

    No Mercator correction is applied: the unprojected span is wider than the
    true one, so this is deliberately over-inclusive. A guard that clipped a
    legitimate edge label would be worse than one that admits a few extra for
    the collision grid to drop.
  */
  const dLat = Math.abs(lat - input.centerLat);

  return dLat <= Math.min(90, halfHeightDegrees * EDGE_MARGIN);
}

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

  /*
    ══ LAKES, RIVERS AND CITIES — PO RULING D-2 ═══════════════════════════════

    THIS FEEDS A SEAM THAT WAS BUILT AND NEVER SUPPLIED. `labelPlacement.ts`
    has declared `lake`, `city` and `river` in `LabelKind` since M2, with
    priorities 3, 4 and 5 sitting between water and continent, and nothing ever
    produced a candidate of those kinds. The empty-canvas defect at country
    zoom is partly that: the map had no vocabulary for anything smaller than a
    country.

    So this adds SOURCES, not a label system. Every candidate below goes
    through the same greedy collision grid, in the same priority order, with
    the same suppression rules. A city that does not fit is dropped by the
    grid, exactly as a country name is.

    REFERENCE, NEVER EVIDENCE. These names describe geography; they carry no
    evidence id, no precision and no provenance, and the grid already gives
    every `evidence` candidate priority 0 — so an evidence caption always wins
    the space over a city name rather than competing with it.
  */
  const drawn: Record<ReferenceKind, number> = { lake: 0, river: 0, city: 0 };

  /*
    ══ THE CAP MUST SEE THE WHOLE FIELD BEFORE IT CHOOSES ════════════════════

    A SECOND BUG I CAUGHT IN TEST. Capping while walking the seed list in file
    order keeps whatever comes first, which is Natural Earth's global ordering
    rather than what matters in THIS frame. Sorting by prominence first means
    the cap keeps a capital over a village wherever the camera is.

    Prominence is the same `weight` the collision grid uses as its tie-break,
    so the two agree about what is important — and the grid is untouched: it
    still receives candidates and still drops what collides.
  */
  const eligible = [...REFERENCE_PLACE_SEEDS].sort(
    (a, b) => (b.weight ?? 20 - b.minZoom) - (a.weight ?? 20 - a.minZoom),
  );

  for (const seed of eligible) {
    /*
      ══ FLOOR 1 · THE PRODUCT'S OWN SCALE, NOT NATURAL EARTH'S ══════════════

      C905 gated on `seed.minZoom` alone, which is Natural Earth's `min_zoom`
      column — a different scale, authored for a different map. Measured on the
      shipped data, rivers carry NE floors of 2–3, so a whole river network
      became eligible barely above the world view and the Alpha screenshots
      filled with ANGARA, ERTIS, ALBERT NILE, BAHR EL JEBEL, LUALABA and SHIRE.

      `REFERENCE_CLASS_FLOOR` is this product's answer to "when is a class worth
      drawing at all", in this product's zoom range, and the two floors are
      combined with `Math.max` so NE can still withhold an obscure feature the
      class floor would have admitted.
    */
    if (input.zoom < Math.max(REFERENCE_CLASS_FLOOR[seed.kind], seed.minZoom)) continue;

    /*
      ══ FLOOR 2 · THE CANONICAL WORLD IS THE ONLY PLACE A LABEL MAY LIVE ════

      Ruling B: "labels outside the current canonical world/camera must not
      project back into the visible overlay."

      This is the failure visible in the Alpha screenshots where the painted
      world sits in one corner and label text covers the rest of the viewport:
      with one painted world, the engine's projection will still return an
      on-screen point for a feature the reader cannot possibly be looking at.
      Screen-space filtering cannot tell those apart, so the test is made in
      GEOGRAPHIC space, before projection, against the camera's own visible
      span. It is engine-independent and therefore cannot be defeated by a
      projection quirk.
    */
    if (!withinVisibleWorld(seed.lon, seed.lat, input)) continue;

    const point = input.project(seed.lon, seed.lat);

    if (point === null) continue;

    /*
      POLISH ONLY WHERE THE SOURCE SUPPLIES IT, NEVER MACHINE-TRANSLATED.

      Natural Earth publishes `name_pl` for lakes and not for populated places.
      A city therefore shows its own name in both languages, which is what an
      atlas does — inventing a Polish exonym for a Rwandan town would be a
      fabricated fact in a product whose whole discipline is not inventing
      facts.
    */
    const text =
      input.language === 'pl' && seed.namePl !== undefined ? seed.namePl : seed.name;

    const type = LABEL_TYPE[seed.kind];
    /*
      The marker travels INSIDE the text so the collision box measures what is
      actually drawn. A glyph added at render time would be a label wider than
      the box the grid reserved for it, and the overlaps would come back.
    */
    const rendered = seed.kind === 'city' ? `${seed.capital === true ? '◇' : '·'} ${text}` : text;

    /*
      ══ FLOOR 3 · A CAP PER CLASS, SO A WALL IS STRUCTURALLY IMPOSSIBLE ═════

      The greedy collision grid already drops what does not fit, and it is
      preserved exactly — but collision only stops labels OVERLAPPING, and the
      Alpha failure was hundreds of non-overlapping labels tiling an empty
      viewport. A cap is the difference between "no two labels collide" and
      "this is a map, not a word list".

      Seeds are emitted in generation order, which is Natural Earth's own
      prominence order within each class, so the cap keeps the most prominent
      members and drops the tail.
    */
    if (drawn[seed.kind] >= REFERENCE_CLASS_CAP[seed.kind]) continue;
    drawn[seed.kind] += 1;

    out.push({
      id: `${seed.kind}:${seed.name}`,
      kind: seed.kind,
      text: rendered,
      x: point.x,
      y: point.y,
      /* Lakes and rivers have no population; their prominence is their zoom floor. */
      weight: seed.weight ?? 20 - seed.minZoom,
      countryIso3: seed.iso3,
      ...estimateLabelBox(rendered, type.size, type.tracking),
    });
  }

  return out;
}
