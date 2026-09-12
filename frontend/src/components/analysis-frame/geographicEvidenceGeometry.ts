import {
  getCountryFeatureCollection,
  computeFeatureBounds,
  type CountryFeature,
} from '@/lib/map/countryGeometry';
import { geometryToPathD, projectPoint } from '@/lib/geo/equirectangularProjection';

/**
 * PAF-R1.2 (P0) — real country geometry for the persistent rail.
 *
 * WHY THIS EXISTS. R1 shipped a schematic grid and a dot, because H2D had
 * established that "nothing in the payload contains a coordinate" and the
 * handoff specified a certainty device rather than a pin. That reasoning
 * skipped a step: no *coordinate* does not mean no *geometry*. The payload
 * carries `countryCode`, and this repository already ships real Natural
 * Earth 1:110m admin-0 polygons keyed by ISO — locally, with no provider
 * and no network.
 *
 * EVERYTHING HERE IS EXISTING INFRASTRUCTURE:
 *   getCountryFeatureCollection()  lib/map/countryGeometry.ts
 *   computeFeatureBounds()         lib/map/countryGeometry.ts
 *   geometryToPathD/projectPoint   lib/geo/equirectangularProjection.ts
 * No new dependency, no interactive map library, no tiles, no `/map`
 * change. The spec asserts that against this file's source text, so no
 * library name is written here.
 *
 * HOW THE COUNTRY-SCALE VIEW IS OBTAINED WITHOUT NEW PROJECTION MATHS.
 * Geometry is projected into one large WORLD viewport by the existing
 * equirectangular helper, and the SVG `viewBox` is then cropped to the
 * focus country's projected bounds. SVG is vector, so cropping magnifies
 * without resolution loss and `equirectangularProjection.ts` is untouched.
 *
 * NO DECIMATION FOR THE FOCUS COUNTRY. At 1:110m Rwanda is thirteen
 * coordinate points; `geometryToPathD`'s default `keepEvery: 3` would
 * reduce that to five and destroy the shape. The focus country is drawn at
 * `keepEvery: 1`. Context countries may be decimated — they are context.
 */

/** Large enough that a small country still has vector detail after cropping. */
export const WORLD = { width: 3600, height: 1800 } as const;

/** Degrees of padding around the focus country, in projected units (10/deg). */
const CONTEXT_PADDING_UNITS = 60;

const FOCUS_KEEP_EVERY = 1;
const CONTEXT_KEEP_EVERY = 2;

export interface ProjectedBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FocusGeometry {
  /** SVG path for the country the EVIDENCE supports. Never empty when present. */
  readonly focusPath: string;
  /** Neighbouring countries, for orientation only. */
  readonly contextPaths: readonly string[];
  readonly viewBox: string;
  /**
   * Bounding-box centre of the focus country, in viewBox units.
   *
   * THIS IS A LABEL ANCHOR, NOT AN EVENT LOCATION. It is derived from the
   * country polygon and nothing else. No coordinate for a city, a story or
   * an event exists anywhere in the analysis contract, and none is invented
   * here — see `geographicEvidence.spec.ts`.
   */
  readonly anchorX: number;
  readonly anchorY: number;
  /** Coordinate points actually drawn. Exposed so a test can prove detail. */
  readonly focusPointCount: number;
  readonly contextCountryCount: number;
}

function projectBounds(feature: CountryFeature): ProjectedBox | null {
  const bounds = computeFeatureBounds(feature);
  if (bounds === null) return null;

  const [[west, south], [east, north]] = bounds;
  const [x1, y1] = projectPoint([west, north], WORLD);
  const [x2, y2] = projectPoint([east, south], WORLD);

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function countPoints(feature: CountryFeature): number {
  let total = 0;
  const visit = (node: unknown): void => {
    if (Array.isArray(node) && typeof node[0] === 'number') {
      total += 1;
      return;
    }
    if (Array.isArray(node)) node.forEach(visit);
  };
  visit((feature.geometry as { coordinates?: unknown }).coordinates);
  return total;
}

function intersects(a: ProjectedBox, b: ProjectedBox): boolean {
  return !(
    b.x + b.width < a.x ||
    b.x > a.x + a.width ||
    b.y + b.height < a.y ||
    b.y > a.y + a.height
  );
}

/**
 * Expands the focus box to the container's aspect ratio so the country is
 * never distorted and the frame is never letterboxed — the box grows, the
 * geometry does not stretch.
 */
function fitToAspect(box: ProjectedBox, aspect: number): ProjectedBox {
  const currentAspect = box.width / box.height;
  if (currentAspect === aspect) return box;

  if (currentAspect < aspect) {
    const width = box.height * aspect;
    return { ...box, x: box.x - (width - box.width) / 2, width };
  }
  const height = box.width / aspect;
  return { ...box, y: box.y - (height - box.height) / 2, height };
}

/**
 * Builds the rail's geometry for one ISO 3166-1 alpha-3 country.
 *
 * Returns null when the code resolves to no polygon — a real state (a
 * micro-state absent from the 1:110m dataset), reported rather than
 * substituted.
 */
export function buildFocusGeometry(iso3: string | null, aspect: number): FocusGeometry | null {
  if (iso3 === null || iso3.length === 0) return null;

  const collection = getCountryFeatureCollection();
  const target = iso3.toUpperCase();

  const focus = collection.features.find((f) => f.properties.country?.iso3 === target);
  if (focus === undefined) return null;

  const focusBox = projectBounds(focus);
  if (focusBox === null) return null;

  const padded: ProjectedBox = {
    x: focusBox.x - CONTEXT_PADDING_UNITS,
    y: focusBox.y - CONTEXT_PADDING_UNITS,
    width: focusBox.width + CONTEXT_PADDING_UNITS * 2,
    height: focusBox.height + CONTEXT_PADDING_UNITS * 2,
  };
  const view = fitToAspect(padded, aspect);

  const contextPaths: string[] = [];
  for (const feature of collection.features) {
    if (feature.properties.country?.iso3 === target) continue;
    const box = projectBounds(feature);
    if (box === null || !intersects(view, box)) continue;
    const d = geometryToPathD(
      feature.geometry as never,
      WORLD,
      CONTEXT_KEEP_EVERY,
    );
    if (d.length > 0) contextPaths.push(d);
  }

  return {
    focusPath: geometryToPathD(focus.geometry as never, WORLD, FOCUS_KEEP_EVERY),
    contextPaths,
    viewBox: `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`,
    anchorX: focusBox.x + focusBox.width / 2,
    anchorY: focusBox.y + focusBox.height / 2,
    focusPointCount: countPoints(focus),
    contextCountryCount: contextPaths.length,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   R4.1 — THE MULTI-COUNTRY EVIDENCE MAP
   ══════════════════════════════════════════════════════════════════════

   `buildFocusGeometry` above draws ONE country, because the rail's model
   at the time carried one: `retrievalContext.countryCode`. The evidence
   map draws the set of countries the retained reporting supports, which
   may be none, one, or several.

   This is an addition, not a rewrite. It uses the same primitives
   (`getCountryFeatureCollection`, `computeFeatureBounds`,
   `geometryToPathD`) and the same private helpers as the focus builder,
   so there is exactly one projection implementation in this lane and the
   crop-the-viewBox technique documented above is unchanged.

   THE QUERY TARGET IS NOT AN EVIDENCE SHAPE. It is returned separately
   and carries no fill, so the map cannot show the country a question
   asked about as though the reporting supported it.                     */

export interface EvidenceMapGeometry {
  /** One entry per country the EVIDENCE supports. Filled on screen. */
  readonly evidencePaths: readonly {
    readonly iso3: string;
    readonly d: string;
    readonly anchorX: number;
    readonly anchorY: number;
    readonly pointCount: number;
  }[];
  /**
   * The query target's outline, present ONLY when it is not itself an
   * evidence country. Never filled — see the header.
   */
  readonly targetPath: { readonly iso3: string; readonly d: string } | null;
  /** Surrounding countries, for orientation only. */
  readonly contextPaths: readonly string[];
  /**
   * H-C2 RUNTIME CORRECTION C3 — THE SAME CONTEXT COUNTRIES, WITH THE TWO
   * THINGS THIS FUNCTION ALREADY COMPUTED AND THEN THREW AWAY.
   *
   * `contextPaths` above is retained UNCHANGED so `EvidenceMap` — the rail's
   * compact canvas — is not touched by this correction at all. This is the
   * additive companion the expanded surface reads.
   *
   * WHAT IS NEW HERE IS NOTHING. `projectBounds(f)` was already called for
   * every context feature, to decide whether it intersects the view, and
   * `f.properties.country` has carried the curated ISO/name metadata since
   * `countryGeometry.ts` was written — 166 of the 177 features in the bundled
   * 1:110m set join to a name. Both were discarded a line later. No dataset
   * is added, no field is invented, and no geometry is loaded that was not
   * already being drawn.
   */
  readonly contextCountries: readonly ContextCountry[];
  readonly viewBox: string;
  readonly drawnCountryCount: number;
}

/**
 * A neighbouring country, as REFERENCE. It is deliberately impossible to
 * render this as evidence: it carries no precision, no citation count and no
 * basis — the three things an evidence label is required to state.
 */
export interface ContextCountry {
  readonly d: string;
  /** '' when the feature has no curated metadata. Such a country is DRAWN and NOT NAMED. */
  readonly iso2: string;
  readonly iso3: string;
  /** Canonical English name. Localised at render time; never invented. */
  readonly name: string;
  /**
   * Bounding-box centre, in viewBox units. A LABEL ANCHOR AND NOTHING ELSE —
   * the identical distinction `FocusGeometry.anchorX` documents. It is derived
   * from the country polygon; no city, story or event coordinate exists in the
   * analysis contract and none is implied by placing a country's name at the
   * middle of its own outline.
   */
  readonly labelX: number;
  readonly labelY: number;
  /** Projected width of the polygon — the room its label has to fit in. */
  readonly boxWidth: number;
}

/** Union of two projected boxes. */
function union(a: ProjectedBox, b: ProjectedBox): ProjectedBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * @param evidenceIso3  countries the EVIDENCE supports — filled.
 * @param targetIso3    the query target — outlined only, and only when it
 *                      is not already an evidence country.
 * @param aspect        width / height of the SVG box.
 *
 * Returns null when there is nothing honest to draw: no evidence country
 * and no target. An empty state must never fall back to a world map with
 * arbitrary countries highlighted.
 */
export function buildEvidenceMapGeometry(
  evidenceIso3: readonly string[],
  targetIso3: string | null,
  aspect: number,
): EvidenceMapGeometry | null {
  const collection = getCountryFeatureCollection();
  const wanted = evidenceIso3.map((c) => c.toUpperCase()).filter((c) => c.length > 0);
  const target = targetIso3 === null ? null : targetIso3.toUpperCase();

  const evidenceFeatures: CountryFeature[] = [];
  for (const iso3 of wanted) {
    const f = collection.features.find((c) => c.properties.country?.iso3 === iso3);
    if (f !== undefined) evidenceFeatures.push(f);
  }

  const targetIsEvidence = target !== null && wanted.includes(target);
  const targetFeature =
    target === null || targetIsEvidence
      ? undefined
      : collection.features.find((c) => c.properties.country?.iso3 === target);

  if (evidenceFeatures.length === 0 && targetFeature === undefined) return null;

  // The view must contain every shape we intend to draw, evidence and
  // target alike — otherwise a disagreement between them would be
  // resolved by cropping one of them off screen.
  let extent: ProjectedBox | null = null;
  for (const f of [...evidenceFeatures, ...(targetFeature ? [targetFeature] : [])]) {
    const box = projectBounds(f);
    if (box === null) continue;
    extent = extent === null ? box : union(extent, box);
  }
  if (extent === null) return null;

  const padded: ProjectedBox = {
    x: extent.x - CONTEXT_PADDING_UNITS,
    y: extent.y - CONTEXT_PADDING_UNITS,
    width: extent.width + CONTEXT_PADDING_UNITS * 2,
    height: extent.height + CONTEXT_PADDING_UNITS * 2,
  };
  const view = fitToAspect(padded, aspect);

  const drawn = new Set<string>([
    ...evidenceFeatures.map((f) => f.properties.country?.iso3 ?? ''),
    ...(targetFeature ? [targetFeature.properties.country?.iso3 ?? ''] : []),
  ]);

  const contextPaths: string[] = [];
  const contextCountries: ContextCountry[] = [];
  for (const f of collection.features) {
    const iso3 = f.properties.country?.iso3;
    if (iso3 !== undefined && drawn.has(iso3)) continue;
    const box = projectBounds(f);
    if (box === null || !intersects(view, box)) continue;
    const d = geometryToPathD(f.geometry as never, WORLD, CONTEXT_KEEP_EVERY);
    if (d.length === 0) continue;
    contextPaths.push(d);
    contextCountries.push({
      d,
      iso2: f.properties.country?.iso2 ?? '',
      iso3: iso3 ?? '',
      name: f.properties.country?.name ?? '',
      labelX: box.x + box.width / 2,
      labelY: box.y + box.height / 2,
      boxWidth: box.width,
    });
  }

  const evidencePaths = evidenceFeatures.map((f) => {
    const box = projectBounds(f);
    return {
      iso3: f.properties.country?.iso3 ?? '',
      // Evidence countries are never decimated — see the header note on
      // small countries losing their shape at keepEvery > 1.
      d: geometryToPathD(f.geometry as never, WORLD, FOCUS_KEEP_EVERY),
      anchorX: box === null ? 0 : box.x + box.width / 2,
      anchorY: box === null ? 0 : box.y + box.height / 2,
      pointCount: countPoints(f),
    };
  });

  return {
    evidencePaths,
    contextCountries,
    targetPath:
      targetFeature === undefined
        ? null
        : {
            iso3: targetFeature.properties.country?.iso3 ?? '',
            d: geometryToPathD(targetFeature.geometry as never, WORLD, FOCUS_KEEP_EVERY),
          },
    contextPaths,
    viewBox: `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`,
    drawnCountryCount: evidencePaths.length + (targetFeature === undefined ? 0 : 1),
  };
}
