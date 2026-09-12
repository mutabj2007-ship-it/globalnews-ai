'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCountryFeatureCollection, type CountryFeature } from '@/lib/map/countryGeometry';
import { splitAntimeridianFeatures } from '@/lib/map/antimeridian';
import { COUNTRIES, type CountryMeta } from '@globalnews-ai/shared';
import { SELECTION_FIT_PADDING, SELECTION_MAX_ZOOM, isoToNumeric } from '@/lib/map/coveragePaint';
import type { Bounds } from '@/lib/map/camera/cameraState';
import { haloRadiusExpression } from '@/lib/map/spatial/evidenceHaloRadius';
import type { HoveredCountry } from '@/components/map/WorldMap';
import { WORLD_MAP_DENSITY, densityBudget, type GeometryDensity } from '@/lib/map/density';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_CAMERA,
  type CameraState,
  camerasEqual,
  normaliseCamera,
} from '@/lib/map/camera/cameraState';
import type { EvidenceRecord } from '@/lib/map/evidence/evidenceModel';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';
import { type LabelCandidate, placeLabels } from '@/lib/map/labels/labelPlacement';
import { LABEL_TYPE, referenceLabelCandidates } from '@/lib/map/labels/labelSources';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import {
  countsAsVerified,
  displayPrecisionFor,
  haloRadiusKm,
  markerStyleFor,
  rendersAsPoint,
} from '@/lib/map/spatial/precisionModel';
import { legendToken } from '@/lib/map/spatial/colourGrammar';
import {
  DESIGN_HALO,
  DESIGN_MARKER,
  DESIGN_REFERENCE,
  DESIGN_RIPPLE,
  rgbaParts,
} from '@/lib/map/spatial/designRenderTokens';
import {
  HOVER_PAINT,
  REFERENCE_COLOURS,
  SELECTED_PAINT,
  WATCH_EDGE,
  referenceLineWidth,
  toneForLegendKey,
  toneMatchExpression,
  type CountryTone,
} from '@/lib/map/spatial/spatialCountryPaint';

/**
 * SPATIAL M1a — THE ENGINE WRAPPER.
 *
 * THE ONLY FILE IN THE SHELL THAT KNOWS MAPLIBRE EXISTS. Everything above it
 * — camera state, intents, URL, controls, banner — is engine-free and
 * unit-tested without a browser. That boundary is the deliverable: it is what
 * lets the engine be swapped, wrapped or upgraded without renegotiating what a
 * camera or a precision claim means.
 *
 * IT OWNS NO STATE OF ITS OWN. The camera is a PROP. The canvas never decides
 * where to look; it reports what the user did (`onGesture`) and applies what
 * it is told (`camera`). A component that both owned the camera and animated
 * it would be the one place a view could change without the history knowing,
 * which is exactly what makes "Previous View" untrustworthy in map UIs.
 *
 * WHAT IT DOES NOT DO, AT M1a:
 *   - no PMTiles, no Planetiler, no tile server, no network fetch of any kind;
 *     the style is the existing fully-local one and the data is the existing
 *     `countryGeometry` boundary, exactly as the legacy World Map uses them
 *   - no evidence, no precision, no article data. It draws the world. What may
 *     be ASSERTED about a place is the banner's business, on the other axis
 *   - no Analysis, Expanded Evidence, Watch, Situations or Sources migration
 */

const SOURCE_ID = 'gn-countries';
/*
  LAND IS ITS OWN LAYER, BENEATH THE EVIDENCE FILL.

  The Design reference draws land as a solid `--land` ground with the
  intelligence layer on top. Painting the ground through the evidence
  expression instead would make every country without evidence disappear, so
  the ground is its own layer that no state expression ever touches.

  `coveragePaint` used to drive `FILL_LAYER_ID` here from story counts. It no
  longer paints anything on this surface — Design's extracted tone values do —
  and it remains untouched as the legacy World Map's own paint behind the flag.
*/
const LAND_LAYER_ID = 'gn-countries-land';
const FILL_LAYER_ID = 'gn-countries-fill';
const OUTLINE_LAYER_ID = 'gn-countries-outline';
/* M1a.1 — the hover ring, same treatment and same z-order as the legacy map. */
const HOVER_LAYER_ID = 'gn-countries-hover';
const NO_HOVER = '__none__';

/*
  SPATIAL M2 — THE EVIDENCE OVERLAY.

  Two layers, in this z-order: the precision HALO underneath, the point MARK on
  top. Both are fed from one GeoJSON source built by `evidenceFeatures` below,
  so a record cannot appear as a mark without a halo or vice versa.
*/
/*
  WATCHED GEOGRAPHY IS AMBER, AND IT IS ITS OWN LAYER.

  Part I §E gives amber to "monitored geography ... also the edge illumination
  on watched countries", and the Design reference shows exactly that: Kenya and
  Rwanda carry an amber fill and an amber edge while the DRC, which has evidence
  but is not watched, carries cyan.

  A SEPARATE LAYER RATHER THAN A BRANCH INSIDE `coveragePaint`. That module is
  accepted and pinned by its own spec, and the two states are genuinely
  different claims — cyan says the platform has evidence here, amber says the
  READER asked to be told about here. Overlaying rather than overwriting keeps
  both true and keeps the accepted paint untouched.
*/
/*
  WATCHED GEOGRAPHY IS A STROKE AND A GLOW. `gn-countries-watch-fill` is GONE:
  Design has no watched fill, so there is no layer here to give one an opacity.
*/
const WATCH_GLOW_LAYER_ID = 'gn-countries-watch-glow';
const WATCH_LINE_LAYER_ID = 'gn-countries-watch-line';
const EVIDENCE_LINE_LAYER_ID = 'gn-countries-evidence-line';
const HOVER_FILL_LAYER_ID = 'gn-countries-hover-fill';
const SELECTED_FILL_LAYER_ID = 'gn-countries-selected-fill';
const SELECTED_LINE_LAYER_ID = 'gn-countries-selected-line';

const EVIDENCE_SOURCE_ID = 'gn-evidence';
const HALO_LAYER_ID = 'gn-evidence-halo';
const MARK_LAYER_ID = 'gn-evidence-mark';

/**
 * THE HALO, IN REAL GROUND KILOMETRES.
 *
 * Part I §G: "The precision halo is drawn in REAL GROUND UNITS — 260 km for a
 * country ceiling, 110 km province, 45 km district, 14 km city, 0 for EXACT —
 * SO IT SHRINKS AND GROWS CORRECTLY WITH ZOOM. A country-ceiling record can
 * never render as a point on a street."
 *
 * MapLibre's `circle-radius` is in SCREEN PIXELS, so a fixed value would be
 * exactly the failure the rule forbids: a 260 km claim rendered as a 40 px dot
 * that stays 40 px while the user zooms to a street. The conversion is
 * therefore an expression evaluated per zoom AND per latitude, because Web
 * Mercator's ground resolution varies with both:
 *
 *     metres per pixel = 156543.03392 * cos(latitude) / 2^zoom
 *
 * `['zoom']` and `['get','lat']` are both available inside a paint expression,
 * so the whole conversion happens in the engine at render time rather than
 * being recomputed in React on every camera frame.
 */
/**
 * The evidence source, built from records the shell already filtered by mode
 * and period.
 *
 * ONLY RECORDS THAT MAY BE DRAWN AS A POINT APPEAR HERE. `rendersAsPoint` is
 * true for EXACT and CITY only — Part II §8 q9: "Where interpretation produced
 * a location but no level can be asserted, the record is UNKNOWN / INTERPRETED
 * and is NEVER RENDERED AS A POINT." A country-precision record is expressed
 * by the country fill, not by a dot at a centroid, because a dot at a centroid
 * is a claim about a place inside the country that no record made.
 */
function evidenceFeatures(records: readonly EvidenceRecord[]): GeoJSON.FeatureCollection {
  /*
    ── ONE MARK PER PLACE, NOT ONE PER RECORD ────────────────────────────────

    DEFECT FOUND BY THE LIVE G FEED, AND ONLY BY IT.

    Two Rwandan headlines resolved through G's route to the SAME settlement:
    one STATED ("… in Kigali"), one INTERPRETED ("Kigalli" corrected to Kigali,
    edit distance 1). Both carry the identical `geographyId` and the identical
    coordinate, so the previous one-feature-per-record loop emitted two exactly
    coincident marks — and MapLibre drew them in array order, which put the
    hollow dashed INTERPRETED ring on top of the filled STATED dot.

    The place then READ as interpreted although a source had stated it. That is
    the provenance axis inverted by an accident of iteration order, and no
    fixture could have produced it: it needs two real records agreeing on a
    place and disagreeing on how they got there.

    So records are grouped by `geography.id` — the same key `geographyTotals`
    aggregates on, so the mark and the numbers in the rail cannot describe
    different sets — and each place is drawn once.

    ── AND THE STRONGEST PROVENANCE WINS, DELIBERATELY ──────────────────────

    A hollow dashed mark asserts something specific: that no source stated this
    location. One STATED record makes that assertion FALSE, so a place holding
    any stated record is drawn filled. The interpreted reports are not hidden by
    this — `hasUnverified` and the separate verified count already carry them
    into the selection card, which is where a qualifier belongs. Part II §8 q9
    forbids folding an interpreted record into a verified TOTAL; it does not ask
    a place with real stated evidence to be drawn as though it had none.

    The precision drawn is the FINEST any record at the place asserted, matching
    `geographyTotals.finestPrecision`, so the halo and the rail agree too.
  */
  interface PlaceMark {
    readonly recordId: string;
    readonly point: readonly [number, number];
    precision: DisplayPrecision;
    provenance: LocationProvenance | undefined;
  }

  const byGeography = new Map<string, PlaceMark>();

  for (const record of records) {
    const point = record.geography.point;

    if (point === undefined || !rendersAsPoint(record.precision)) continue;

    const key = record.geography.id;
    const existing = byGeography.get(key);

    if (existing === undefined) {
      byGeography.set(key, {
        recordId: record.id,
        point,
        precision: record.precision,
        provenance: record.provenance,
      });
      continue;
    }

    /* Finest level claimed at this place — never coarser than a record held. */
    if (displayPrecisionFor(record.precision, existing.precision) !== record.precision) {
      existing.precision = record.precision;
    }

    /* Strongest provenance claimed at this place. See the note above. */
    if (countsAsVerified(record.provenance)) existing.provenance = record.provenance;
  }

  const features: GeoJSON.Feature[] = [];

  for (const [geographyId, mark] of byGeography) {
    const radiusKm = haloRadiusKm(mark.precision);
    const style = markerStyleFor(mark.precision, mark.provenance);
    const token = legendToken(style.legendKey);

    features.push({
      type: 'Feature',
      id: mark.recordId,
      geometry: { type: 'Point', coordinates: [mark.point[0], mark.point[1]] },
      properties: {
        recordId: mark.recordId,
        geographyId,
        lat: mark.point[1],
        /* 0 for EXACT, which is a real answer and not a missing one. */
        haloMetres: (radiusKm ?? 0) * 1000,
        stroke: token.stroke,
        fill: token.fill,
        fillOpacity: token.fillOpacity,
        strokeOpacity: token.strokeOpacity,
        /*
          THE HALO'S OWN OPACITIES, from Design's `.halo` rule rather than from
          the country-fill grammar: a precision halo is a different element from
          a country wash and the reference gives it different numbers.
        */
        haloFillOpacity:
          style.legendKey === 'attention'
            ? DESIGN_HALO.fillOpacityAmber
            : DESIGN_HALO.fillOpacityCyan,
        haloStrokeOpacity: rgbaParts(
          style.legendKey === 'attention' ? DESIGN_HALO.strokeAmber : DESIGN_HALO.strokeCyan,
        ).opacity,
        /* Provenance drawn in KIND: hollow marks for interpreted and contested. */
        markFilled: style.filled ? 1 : 0,
        legendKey: style.legendKey,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

const numericToCountry = (numericId: string): CountryMeta | undefined =>
  COUNTRIES.find((country) => country.isoNumeric === numericId);

/**
 * The same fully-local style the existing World Map uses: a background colour
 * and our own layers. No token, no style server, no basemap imagery — so the
 * surface renders identically offline and cannot leak a viewport to a third
 * party.
 */
/*
  `WORLD_TILE_SIZE` LIVED HERE AND IS GONE.

  It was MapLibre's zoom-0 world width, restated so the container-derived zoom
  floor could be computed from it. v1.7 retired that floor — see the
  `transformConstrain` note above — so the constant has no remaining consumer,
  and a constant kept "in case" is how a superseded rule quietly returns.
*/

/**
 * DESIGN v1.7 — THE HORIZONTAL CAMERA CONTRACT, IMPLEMENTED.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TWO SENTENCES THAT LOOKED LIKE A CONTRADICTION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Revision 1.7 requires both of these at once:
 *
 *   "Horizontal panning is free and unclamped … the user may drag left, right,
 *    up, down and diagonally without hitting a wall … Beyond the single world's
 *    edge the user sees ocean field, not another Africa."
 *
 *   "it renders ONE COHERENT WORLD, never repeated copies:
 *    renderWorldCopies = false."
 *
 * On maplibre-gl 4.7.1 those were mutually exclusive through the public API,
 * and the measurement is on record: with copies off the camera clamped so that
 * one world always covered the canvas, which at world view confined it to about
 * ±13.4° and at Z 3.5 stopped it dead at 147.5°E — unable to REACH the
 * antimeridian, let alone cross it. Widening `setMaxBounds` did not relax the
 * constraint; only `renderWorldCopies: true` freed the pan, and that brought
 * back the second Earth the revision forbids.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED IS THE ENGINE, NOT THE ARGUMENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * maplibre-gl 5.24.0 exposes `transformConstrain` — a public, documented map
 * option that REPLACES the transform's built-in clamp with a supplied function.
 * The two requirements stop competing, because the clamp and the world-copy
 * count were never the same decision; 4.7.1 simply had no way to say so.
 *
 *   renderWorldCopies: false   still true, still one painted world
 *   transformConstrain         returns the requested camera almost unchanged
 *
 * NO PRIVATE FIELD IS TOUCHED. This is the option the library documents for
 * exactly this purpose, not a patched `_constrain`, and nothing here reaches
 * into the transform.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT STILL CONSTRAINS, AND WHY THAT IS NOT A WALL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LATITUDE, softly, at ±85°. The revision asks for this by name — "a soft
 * vertical clamp at ±85° latitude" — and it is not a horizontal wall: Mercator
 * has no finite pole, so without a stop the world stretches to infinity under a
 * vertical drag and the map becomes unreadable rather than free.
 *
 * LONGITUDE, NOT AT ALL. The value is returned as given. Past ±180 the camera
 * simply leaves the painted world and the background — the ocean token — is
 * what remains, which is the revision's own "ocean field, not another Africa".
 *
 * ZOOM, NOT AT ALL. The old world-fit floor was the vertical half of the same
 * clamp, and removing it is what makes underzoom below world-fit possible. The
 * design floor `MIN_ZOOM` still applies, because it is a product decision about
 * how small the world may get rather than an engine artefact.
 */
const SOFT_LATITUDE_LIMIT = 85;

/**
 * ── THE LONGITUDE CONTRACT, AS MAIN RULED IT ──────────────────────────────
 *
 * Camera longitude is SIGNED, UNWRAPPED, AND NOT CLAMPED TO ±180. 190 is not
 * the same camera as -170; 540 is not the same camera as 180; 654.918 restores
 * as 654.918. So this returns the longitude it was handed, unchanged, and that
 * one line is the whole horizontal half of the v1.7 contract.
 *
 * ── I GOT THIS WRONG ONCE, AND THE CORRECTION IS WORTH RECORDING ──────────
 *
 * An earlier cut of this file wrapped longitude here. The symptom that led me
 * there was real and measured: six westward drags at Z 2 took the map pane from
 * 26.8% land to 0.3%, and the readout claimed 76.41°W while the screen showed
 * open water. I read that as the camera getting lost and stopped it wrapping.
 *
 * It was the WRONG PLACE. Main located the actual defect in
 * `cameraState.ts` — `normaliseCenter` wrapped longitude into [-180, 180] on
 * every camera that left the module, so the state the product published had
 * been folded while the transform had genuinely travelled. The readout and the
 * view had not "come apart"; one of them was being rewritten. Wrapping here as
 * well hid that by making both wrong in the same way.
 *
 * The ocean past the world's edge is not a bug either. v1.7 asks for it by
 * name — "beyond the single world's edge the user sees ocean field" — and with
 * the state no longer folded, the readout says where the camera actually is
 * while it is out there.
 *
 * ── WHAT IS STILL CONSTRAINED ─────────────────────────────────────────────
 *
 * LATITUDE, softly, at ±85°, which v1.7 specifies by name. Mercator has no
 * finite pole, so without a stop a vertical drag stretches the world to
 * infinity — that is unreadability, not freedom.
 *
 * ZOOM, NOT AT ALL. The container-derived world-fit floor is exactly what
 * "underzoom below world-fit floor" retires. `MIN_ZOOM` still applies as a
 * product decision about how small the world may usefully get.
 *
 * NO PRIVATE FIELD IS TOUCHED. `transformConstrain` is the documented option;
 * `transform._constrain` is never referenced, and a guard asserts it.
 */
const transformConstrain = (
  lngLat: maplibregl.LngLat,
  zoom: number,
): { center: maplibregl.LngLat; zoom: number } => ({
  center: new maplibregl.LngLat(
    /* SIGNED, UNWRAPPED, UNCLAMPED. This line is the contract. */
    lngLat.lng,
    /* The soft vertical clamp v1.7 names, and the only thing constrained here. */
    Math.max(-SOFT_LATITUDE_LIMIT, Math.min(SOFT_LATITUDE_LIMIT, lngLat.lat)),
  ),
  zoom,
});

const LOCAL_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  /*
    `--ocean` from the Design reference's own token block — v1.5 deepened it one
    step, to #040a10, so the lifted land and coastline have headroom above it.
    Read from `DESIGN_REFERENCE` rather than restated, so this and the country
    paint cannot drift apart the way they did before.
  */
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': DESIGN_REFERENCE.ocean } },
  ],
};

export interface EvidenceMapCanvasProps {
  readonly camera: CameraState;
  /*
    M1a.1 — WORLD MAP INTERACTION PARITY.

    Optional, so the canvas is still usable as a plain geographic surface: a
    future consumer that only wants a camera passes none of these and gets
    exactly the M1a behaviour. When they ARE passed, the canvas reproduces the
    accepted World Map's hover, click and coverage encoding.

    The canvas still decides nothing. `countryStoryCounts` and `selectedIso3`
    are applied through `coveragePaint`, which is engine-free and asserted
    against `WorldMap.tsx` itself; hover and click are reported upward exactly
    as the legacy component reports them.
  */
  readonly countryStoryCounts?: Record<string, number>;
  readonly selectedIso3?: string | null;
  /**
   * ── THE SELECTION CALLOUT'S ANCHOR, PROJECTED ────────────────────────────
   *
   * The callout is "anchored beside the selected geography centroid" and must
   * "track the geography while panning/zooming". Only the engine can turn a
   * lon/lat into a pixel, so the canvas reports the projection and the shell
   * decides where the card goes — the same division `recomputeLabels` already
   * uses, and the reason this is a callback rather than a rendered element.
   *
   * `null` means there is no anchor OR it is off screen; the placement module
   * treats both as the parked case.
   */
  /**
   * Countries this session QUERIED that returned nothing.
   *
   * They carry Design's `none` tone — `rgba(74,91,103,.07)` over
   * `rgba(74,91,103,.35)` — which is the prototype's own branch for a record
   * at NONE precision in EVIDENCE mode. Distinct from the rest of the world,
   * which was not looked at and is drawn as bare land.
   */
  readonly noEvidenceGeography?: readonly { readonly countryIso3: string }[];
  readonly calloutAnchor?: readonly [number, number] | null;
  readonly onCalloutAnchorChange?: (point: { x: number; y: number } | null) => void;
  readonly onHoverCountry?: (hover: HoveredCountry | null) => void;
  readonly onSelectCountry?: (feature: CountryFeature) => void;
  /**
   * PO-1 — THE ENGINE'S REAL ZOOM FLOOR, REPORTED UPWARD.
   *
   * With `renderWorldCopies` off the renderer refuses to zoom out past the
   * point where one world still covers the viewport, and that point depends on
   * the canvas size, so only the canvas can know it. Without this the shell's
   * zoom-out button stays lit below the floor and does nothing when pressed.
   */
  readonly onMinZoomChange?: (minZoom: number) => void;
  /*
    M1a.1 — BOUNDS THE ENGINE MUST FRAME, BECAUSE ONLY IT KNOWS THE VIEWPORT.

    `cameraForBounds` in the engine-free core is deliberately approximate: it
    cannot see the container size, so it frames a country slightly wider than
    the legacy map's `fitBounds` did. The browser run showed that as a visible
    difference in how tightly a selected country sits in the frame.

    So the engine RESOLVES the bounds — MapLibre's `cameraForBounds` computes a
    camera without moving anything — and the result is reported back through
    `onBoundsResolved`. The reducer still commits it, so there is still exactly
    one owner of the camera and one history entry. The engine is used only for
    the thing it alone knows, and decides nothing.
  */
  readonly fitBounds?: Bounds | null;
  readonly onBoundsResolved?: (camera: CameraState) => void;
  /**
   * Why the camera changed. A camera the user dragged to must not be animated
   * back at them — they are already looking at it.
   */
  readonly origin: 'initial' | 'control' | 'gesture' | 'url' | 'reset' | 'back';
  readonly onGesture: (camera: CameraState) => void;
  readonly onReady?: () => void;
  readonly onError?: (message: string) => void;
  readonly density?: GeometryDensity;
  readonly ariaLabel: string;
  readonly interactionHint: string;
  /*
    SPATIAL M2 — evidence the shell has already filtered by mode and period.

    The canvas does not filter, rank or decide. It receives records that
    qualify and paints them with the tokens the legend reads from; which
    records qualify is `qualifyingRecords`' answer, computed one layer up,
    where mode and period live.
  */
  readonly evidenceRecords?: readonly EvidenceRecord[];
  readonly layers?: Readonly<Record<string, boolean>>;
  readonly watch?: ReadonlySet<string>;
  readonly language?: LanguageCode;
  /** Copy for the reference label layer. Absent disables it. */
  readonly labelNames?: {
    readonly continents: Readonly<Record<string, string>>;
    readonly waters: Readonly<Record<string, string>>;
    /*
      Geometry-backed places the sovereign-state registry does not carry.
      Optional so every existing caller keeps compiling and rendering exactly
      as before; an absent table simply names no territories.
    */
    readonly territories?: Readonly<Record<string, string>>;
  };
  /** PANEL and above. EMBED and MINI are static frames. */
  readonly interactive?: boolean;
  /** EMBED must never capture the wheel — the page has to keep scrolling. */
  readonly capturesWheel?: boolean;
}

const cameraOf = (map: maplibregl.Map): CameraState => {
  const centre = map.getCenter();

  return normaliseCamera({
    center: [centre.lng, centre.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  });
};

export function EvidenceMapCanvas({
  camera,
  origin,
  onGesture,
  onReady,
  onError,
  density = WORLD_MAP_DENSITY,
  ariaLabel,
  interactionHint,
  countryStoryCounts,
  selectedIso3 = null,
  noEvidenceGeography,
  calloutAnchor = null,
  onCalloutAnchorChange,
  onHoverCountry,
  onSelectCountry,
  onMinZoomChange,
  fitBounds = null,
  onBoundsResolved,
  evidenceRecords = [],
  layers,
  watch,
  language = 'en',
  labelNames,
  interactive = true,
  capturesWheel = true,
}: EvidenceMapCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  /* Paint may only be applied after the layers exist. */
  const [styleReady, setStyleReady] = useState(false);

  /*
   * The gesture callback is held in a ref so the map is created ONCE. Binding
   * a fresh listener on every render would re-enter the engine on each camera
   * update, and re-creating the map would drop the user's view mid-drag.
   */
  const gestureRef = useRef(onGesture);
  gestureRef.current = onGesture;

  /* Same reason as gestureRef: the map is created once, so handlers read latest through refs. */
  const hoverRef = useRef(onHoverCountry);
  hoverRef.current = onHoverCountry;
  const selectRef = useRef(onSelectCountry);
  selectRef.current = onSelectCountry;
  const minZoomRef = useRef(onMinZoomChange);
  minZoomRef.current = onMinZoomChange;
  const boundsResolvedRef = useRef(onBoundsResolved);
  boundsResolvedRef.current = onBoundsResolved;

  /*
    ── v1.4 ITEM 4 · THE CONTAINER-SIZE CAMERA CONTRACT ────────────────────

    "Never derive the initial camera from a 0x0 container. The first valid
     non-zero measurement establishes the world camera. Resize preserves
     geographic centre and zoom. PANEL/EMBED late sizing must not shift the
     world."

    WHERE THIS BITES, MEASURED. `map.cameraForBounds()` resolves a bounds
    request AGAINST THE CONTAINER — that is the whole reason the engine, and
    not the engine-free core, is asked to do it. When the container is 0x0 the
    answer is nonsense, and unlike a purely visual glitch it does not heal,
    because the resolved camera is handed UPWARD into application state and
    into the URL.

    Reproduced on the shipped build: open /map?country=KEN&sel=country:KEN at
    800px wide, where the spatial container is `display:none` and therefore
    0x0 while still mounted. The fit resolved to ZOOM 3.46 and was written to
    `cam=3.46/...`. Widening to 1440 left it at 3.46; the same URL opened
    directly at 1440 gives ZOOM 5.0. Kenya was drawn at a third of its size
    and no resize corrected it.

    So a fit that cannot be derived is DEFERRED rather than guessed, and the
    first valid measurement resolves it.
  */
  const hadValidSizeRef = useRef(false);
  const pendingFitRef = useRef<Bounds | null>(null);
  /*
    A RESIZE IS NOT A PAN. Growing or shrinking the box changes the transform,
    so MapLibre emits `move`/`moveend` for it — and this component reports any
    movement it did not initiate as the user's own gesture. Left alone, a
    container that arrives late therefore PUBLISHES A CAMERA, which is precisely
    what "PANEL/EMBED late sizing must not shift the world" forbids. Measured:
    the deferred Kenya fit was committed correctly and then immediately
    overwritten by a world camera published as a gesture by the resize itself.
  */
  const resizeSettlingRef = useRef(false);
  /* The camera the application currently believes in, for the first-size restore. */
  const latestCameraRef = useRef(camera);
  latestCameraRef.current = camera;

  /** The rendered size of the map surface. `null` when it cannot be measured. */
  const measuredSize = (map: maplibregl.Map): { readonly w: number; readonly h: number } | null => {
    const rect = map.getCanvas().getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return null;

    return { w: rect.width, h: rect.height };
  };

  /**
   * Resolve a bounds request through the ENGINE, which is the only thing that
   * knows the viewport. Returns false when the container cannot be measured,
   * so the caller can defer instead of publishing a camera derived from
   * nothing.
   */
  const resolveFit = (map: maplibregl.Map, bounds: Bounds): boolean => {
    if (measuredSize(map) === null) return false;

    const [west, south, east, north] = bounds;
    const resolved = map.cameraForBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: SELECTION_FIT_PADDING, maxZoom: SELECTION_MAX_ZOOM },
    );

    if (resolved === undefined) return false;

    const centre = resolved.center as { lng: number; lat: number };

    boundsResolvedRef.current?.(
      normaliseCamera({
        center: [centre.lng, centre.lat],
        zoom: resolved.zoom ?? latestCameraRef.current.zoom,
        bearing: 0,
        pitch: 0,
      }),
    );

    return true;
  };
  const resolveFitRef = useRef(resolveFit);
  resolveFitRef.current = resolveFit;

  /*
   * Cameras this component itself applied. `moveend` fires for programmatic
   * moves too, and reporting those back as gestures would push a history entry
   * for a move the user did not make — turning one "Reset World" into two.
   */
  const applyingRef = useRef<CameraState | null>(null);

  const budget = densityBudget(density);

  const handleError = useCallback(
    (message: string) => {
      setFailed(true);
      onError?.(message);
    },
    [onError],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (container === null) return undefined;

    let map: maplibregl.Map;

    try {
      map = new maplibregl.Map({
        container,
        style: LOCAL_STYLE,
        center: [camera.center[0], camera.center[1]],
        zoom: camera.zoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        attributionControl: false,
        /*
         * The shell renders its own controls, which are real buttons with
         * labels, disabled states and keyboard focus. MapLibre's built-in
         * NavigationControl is deliberately NOT added — two zoom controls on
         * one surface is a defect, and the engine's own is the one that cannot
         * be labelled or disabled from our state.
         */
        /*
         * PO-1 — ONE WORLD, NOT A TILING OF WORLDS.
         *
         * MapLibre defaults `renderWorldCopies` to TRUE, which repeats the whole
         * projection horizontally whenever the viewport is wider than one world.
         * One world is 512 * 2^zoom CSS px, so at this shell's MIN_ZOOM of 0.6
         * that is 776px — narrower than the 1016px canvas at 1440x900, and
         * narrower still than the canvas on any larger display at the 1.1 world
         * camera. The measured result is the defect the Product Owner reported:
         * the map drawn several times across the viewport.
         *
         * Design shows ONE world. This is the option that says so.
         */
        renderWorldCopies: false,
        /*
          DESIGN v1.7. Free 2D navigation with ONE painted world — see this
          file's `transformConstrain` note. Declared beside `renderWorldCopies`
          on purpose: they are a pair, and separating them is how a later reader
          concludes that free panning must mean repeated copies.
        */
        transformConstrain,
        keyboard: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: true,
      });
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'The map failed to initialise in this browser.');

      return undefined;
    }

    mapRef.current = map;
    /* Rotation is out of scope at M1a; the camera type carries bearing, nothing produces one. */
    map.touchZoomRotate.disableRotation();

    /*
      PO-1 — KEEP THE CONTROLS AND THE ENGINE TELLING THE SAME STORY.

      One world is 512 * 2^zoom CSS px. With copies off, the renderer clamps
      the camera so that square still covers the canvas, so the true floor is
      log2(max(width, height) / 512) — 0.99 on the 1016x856 canvas at
      1440x900. It is recomputed on resize because it is a function of the
      container, and it is reported upward so the zoom-out control can disable
      itself at the same point the engine stops moving.
    */
    const onMeasured = (): void => {
      const size = measuredSize(map);

      /*
        A 0x0 CONTAINER IS NOT A MEASUREMENT. Nothing is derived from it — not
        the zoom floor, not a fit, not the camera. The engine keeps whatever it
        was constructed with until a real box exists.
      */
      if (size === null) return;

      /*
        ── THE WORLD-FIT FLOOR IS GONE, AND v1.7 IS WHY ────────────────────

        SUPERSEDED. This used to compute log2(max(width, height) / 512) — the
        zoom at which one world exactly covers the canvas — and hand it to
        `setMinZoom`, because with world copies off the 4.x engine clamped there
        anyway and a zoom-out button that stayed lit below a floor it could not
        cross was worse than one that disabled itself honestly.

        `transformConstrain` removes the engine clamp, so there is no longer a
        floor to mirror, and v1.7's acceptance list asks for the opposite
        behaviour by name: "underzoom below world-fit floor". The camera may now
        pull back until the world sits inside the viewport with ocean around it.

        MIN_ZOOM STILL APPLIES, and is a different kind of limit: a product
        decision about how small the world may usefully become, applied at
        construction, not an artefact of how the renderer tiles. It is reported
        upward unchanged so the zoom-out control still disables itself at the
        real end of the range rather than at a container-derived one.
      */
      minZoomRef.current?.(MIN_ZOOM);

      if (hadValidSizeRef.current) {
        /*
          EVERY LATER RESIZE PRESERVES CENTRE AND ZOOM. The zoom floor is
          recomputed because it is a function of the box, but the camera is not
          touched: MapLibre keeps the centre across a resize, and re-applying
          anything here is what would make PANEL/EMBED late sizing shift the
          world. The one exception is the floor itself pushing the camera up,
          which is the engine refusing to show less than one world — the same
          rule the zoom-out control already reports.
        */
        return;
      }

      /*
        ── THE FIRST VALID MEASUREMENT ─────────────────────────────────────

        Everything the engine decided while it had no box was decided against
        nothing, so the camera the application believes in is re-asserted once,
        here. `jumpTo` rather than `easeTo`: this is a correction, not a
        journey, and the user has not seen the wrong frame — the container was
        not on screen.
      */
      hadValidSizeRef.current = true;

      /*
        EXACTLY ONE PROGRAMMATIC MOVE HERE, AND THIS IS WHY.

        `moveend` treats any movement it did not initiate as the user's own and
        reports it upward as a gesture; `applyingRef` is the single token that
        says "this one was mine". Two overlapping programmatic moves therefore
        cannot share it — and the first cut of this repair did exactly that: it
        jumped to the believed camera AND resolved the deferred fit in the same
        synchronous block. The fit's commit re-armed `applyingRef` with the
        Kenya camera before the jump's own `moveend` arrived, that `moveend`
        compared Kenya against the world camera it had just landed on, decided a
        human had panned, and published the WORLD camera as a gesture — which
        overwrote the correct fit. Measured, and the reason this branches.

        A DEFERRED FIT SUPERSEDES THE RESTORE. Its camera is the one the
        application is going to hold, and the sync effect applies it; jumping
        first would only be a frame the user never sees.
      */
      const deferred = pendingFitRef.current;

      if (deferred !== null) {
        pendingFitRef.current = null;
        resolveFitRef.current(map, deferred);

        return;
      }

      /*
        No fit outstanding: re-assert the camera the application believes in, so
        anything the engine clamped while it had no box is discarded. `jumpTo`
        rather than `easeTo` — a correction, not a journey, and the container
        was not on screen for the wrong frame to be seen.
      */
      const believed = normaliseCamera(latestCameraRef.current);

      applyingRef.current = believed;

      map.jumpTo({
        center: [believed.center[0], believed.center[1]],
        zoom: believed.zoom,
        bearing: believed.bearing,
        pitch: believed.pitch,
      });
    };

    onMeasured();
    map.on('resize', () => {
      resizeSettlingRef.current = true;
      onMeasured();
    });

    map.on('load', () => {
      try {
        /*
         * PO-1 — THE SEAM, HANDLED AT THE RENDERER BOUNDARY.
         *
         * Russia and Fiji carry rings that touch both -180 and 180. d3 clips
         * those; MapLibre draws the plane segment between them, which spans
         * every longitude and paints a band across the map. See
         * `antimeridian.ts`. The shared collection is NOT modified — the Hero
         * and the legacy map read it through d3 and are correct today.
         */
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: splitAntimeridianFeatures(getCountryFeatureCollection()),
        });
        /*
          ══ THE PROTOTYPE'S DRAW ORDER, AS A LAYER STACK ═══════════════════

          Its canvas loop assigns `fill` and `stroke` in a cascade and paints
          once; MapLibre paints in layers, so the cascade IS the z-order below.
          Each layer's values come from `designRenderTokens.ts`, extracted from
          that loop verbatim. Nothing in this block names a colour of its own.
        */
        map.addLayer({
          id: LAND_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: { 'fill-color': REFERENCE_COLOURS.land, 'fill-opacity': 1 },
        });
        /*
          EVIDENCE FILL. One `match` over the four tones rather than four
          layers — see `toneMatchExpression`. Transparent until the effect
          below supplies the tones, so a camera-only consumer draws bare land.
        */
        map.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: { 'fill-color': '#3ad6e6', 'fill-opacity': 0 },
        });
        /*
          ADMIN-0 BOUNDARIES — reference slate, ZOOM-RAMPED as the prototype
          ramps them. Beneath every intelligence stroke, so a border never
          draws over the state of the country it bounds.
        */
        map.addLayer({
          id: OUTLINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': REFERENCE_COLOURS.border,
            'line-width': referenceLineWidth('border') as never,
          },
        });
        /*
          EVIDENCE STROKE — the intelligence edge, at the tone's own colour and
          opacity, 1 px. Separate from OUTLINE so the reference border keeps
          its own width and the evidence edge keeps Design's.
        */
        map.addLayer({
          id: EVIDENCE_LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: { 'line-color': '#3ad6e6', 'line-opacity': 0, 'line-width': 1 },
        });

        /*
          ══ MONITORED GEOGRAPHY ════════════════════════════════════════════

          A STROKE AND A GLOW. NO FILL.

          The prototype's watch branch is `stroke = stroke || amber` and there
          is no watched fill anywhere in it. The implementation the CTO
          reviewed carried `fill-opacity: 0.14` amber over every watched
          country — not a stronger version of Design's treatment, but a layer
          Design does not have. It is deleted rather than reduced.

          The glow is the blurred under-line that stands in for the
          prototype's `ctx.shadowBlur = 12`; see `WATCH_EDGE`.
        */
        map.addLayer({
          id: WATCH_GLOW_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          filter: ['in', ['get', 'numericId'], ['literal', []]],
          paint: {
            'line-color': WATCH_EDGE.glowColour,
            'line-opacity': WATCH_EDGE.glowOpacity,
            'line-width': WATCH_EDGE.glowWidth,
            'line-blur': WATCH_EDGE.glowBlur,
          },
        });
        map.addLayer({
          id: WATCH_LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          filter: ['in', ['get', 'numericId'], ['literal', []]],
          paint: {
            'line-color': WATCH_EDGE.strokeColour,
            'line-opacity': WATCH_EDGE.strokeOpacity,
            'line-width': WATCH_EDGE.strokeWidth,
          },
        });

        /*
          HOVER — SLATE, not cyan. `rgba(160,200,215,.7)` at 1 px over a
          `rgba(126,166,186,.07)` wash. The previous 2 px full-opacity cyan
          ring used an intelligence hue for a pointer state, which Part I §E
          forbids: "if a colour is not in the legend it may not appear on the
          map", and hover is not one of the five legend entries.
        */
        map.addLayer({
          id: HOVER_FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          filter: ['==', ['get', 'numericId'], NO_HOVER],
          paint: { 'fill-color': HOVER_PAINT.fillColour, 'fill-opacity': HOVER_PAINT.fillOpacity },
        });
        map.addLayer({
          id: HOVER_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['get', 'numericId'], NO_HOVER],
          paint: {
            'line-color': HOVER_PAINT.strokeColour,
            'line-opacity': HOVER_PAINT.strokeOpacity,
            'line-width': HOVER_PAINT.lineWidth,
          },
        });

        /*
          SELECTION — last, because it is last in the prototype's cascade.
          `rgba(58,214,230,.18)` under a 1.6 px `#8ef0fa` edge. "Selection
          should come from the combined fill + edge + HUD state, not an
          oversized border."
        */
        map.addLayer({
          id: SELECTED_FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          filter: ['==', ['get', 'numericId'], NO_HOVER],
          paint: {
            'fill-color': SELECTED_PAINT.fillColour,
            'fill-opacity': SELECTED_PAINT.fillOpacity,
          },
        });
        map.addLayer({
          id: SELECTED_LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['get', 'numericId'], NO_HOVER],
          paint: {
            'line-color': SELECTED_PAINT.strokeColour,
            'line-width': SELECTED_PAINT.lineWidth,
          },
        });

        map.addSource(EVIDENCE_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: HALO_LAYER_ID,
          type: 'circle',
          source: EVIDENCE_SOURCE_ID,
          paint: {
            /* Ground kilometres, per zoom and per latitude. See the note above. */
            'circle-radius': haloRadiusExpression() as never,
            'circle-color': ['get', 'fill'],
            /*
              DESIGN'S `.halo`, EXTRACTED:
                border: 1px dashed rgba(58,214,230,.35)
                background: radial-gradient(circle, rgba(58,214,230,.07), transparent 70%)

              The fill is 7% (amber 6%) and the ring 35% (amber 30%), carried
              on the feature so the two tones cannot drift apart. MapLibre has
              no dashed circle stroke and no radial gradient on a circle layer;
              the ring is therefore solid at Design's own opacity and the fill
              is flat rather than faded to transparent at 70%. Declared as a
              deviation in the handoff — the values are exact, the two
              gradient/dash effects are not reproducible on this layer type.
            */
            'circle-opacity': ['get', 'haloFillOpacity'],
            'circle-stroke-color': ['get', 'stroke'],
            'circle-stroke-opacity': ['get', 'haloStrokeOpacity'],
            'circle-stroke-width': DESIGN_HALO.strokeWidth,
          },
        });
        map.addLayer({
          id: MARK_LAYER_ID,
          type: 'circle',
          source: EVIDENCE_SOURCE_ID,
          paint: {
            /* `.mk .core { width: 9px }` — a 4.5 px radius, not 4. */
            'circle-radius': DESIGN_MARKER.coreDiameter / 2,
            /*
              HOLLOW FOR INTERPRETED AND CONTESTED. Part I §G requires
              uncertainty to be drawn "differently in KIND — hollow, dashed,
              grey, no pulse — not merely in colour". A zero-opacity fill with
              a visible stroke is a hollow mark; a lighter cyan would not be.
            */
            'circle-opacity': ['case', ['==', ['get', 'markFilled'], 1], 0.9, 0],
            'circle-color': ['get', 'fill'],
            'circle-stroke-color': ['get', 'stroke'],
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 0.95,
          },
        });

        setStyleReady(true);
        onReady?.();
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'World map geometry could not be loaded.');
      }
    });

    map.on('error', (event) => {
      const detail = 'error' in event && event.error instanceof Error ? event.error.message : 'Unknown MapLibre error';
      console.warn('[map-shell] MapLibre error event:', detail);
    });

    map.on('moveend', () => {
      const next = cameraOf(map);

      /*
        Movement caused by the box changing size, not by a hand. It carries no
        intent, so nothing is published and no history entry is pushed.
      */
      if (resizeSettlingRef.current) {
        resizeSettlingRef.current = false;

        return;
      }

      const applying = applyingRef.current;

      if (applying !== null && camerasEqual(applying, next, 1e-3)) {
        applyingRef.current = null;

        return;
      }

      applyingRef.current = null;
      gestureRef.current(next);
    });

    /*
      M1a.1 — HOVER, CLICK AND THE HOVER RING.

      Reproduced from the accepted World Map: pointer cursor only over a
      country we have metadata for, the ring filtered to the hovered feature,
      the hover payload carrying the pointer position the tooltip needs, and a
      click that is IGNORED for geometry we cannot name — a country we cannot
      identify is not a selection, and selecting it would open a panel for
      nothing.
    */
    map.on('mousemove', FILL_LAYER_ID, (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0] as CountryFeature | undefined;

      if (feature === undefined) return;

      const numericId = String(feature.properties.numericId);
      const country = numericToCountry(numericId);

      map.getCanvas().style.cursor = country ? 'pointer' : '';

      if (map.getLayer(HOVER_LAYER_ID)) {
        map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'numericId'], numericId]);
      }

      /*
        THE HOVER WASH DEFERS TO AN EVIDENCE FILL, exactly as the prototype's
        `fill = fill || 'rgba(126,166,186,.07)'` does: a country that already
        carries an evidence tone keeps it, and only bare land picks up the 7%
        slate. The stroke above always applies — the prototype assigns the
        hover STROKE unconditionally.
      */
      if (map.getLayer(HOVER_FILL_LAYER_ID)) {
        map.setFilter(HOVER_FILL_LAYER_ID, [
          '==',
          ['get', 'numericId'],
          tonedRef.current.has(numericId) ? NO_HOVER : numericId,
        ]);
      }

      hoverRef.current?.({ numericId, country, x: event.point.x, y: event.point.y });
    });

    map.on('mouseleave', FILL_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';

      if (map.getLayer(HOVER_LAYER_ID)) {
        map.setFilter(HOVER_LAYER_ID, ['==', ['get', 'numericId'], NO_HOVER]);
      }

      if (map.getLayer(HOVER_FILL_LAYER_ID)) {
        map.setFilter(HOVER_FILL_LAYER_ID, ['==', ['get', 'numericId'], NO_HOVER]);
      }

      hoverRef.current?.(null);
    });

    map.on('click', FILL_LAYER_ID, (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0] as CountryFeature | undefined;

      if (feature === undefined) return;

      const numericId = String(feature.properties.numericId);
      const country = numericToCountry(numericId);

      if (country === undefined) return;

      selectRef.current?.({ ...feature, id: numericId, properties: { numericId, country } });
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
    /*
     * ONCE. The camera in this effect is the INITIAL camera only; every later
     * change is applied by the effect below. Re-running this would destroy and
     * rebuild the engine on every pan.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Apply camera changes that did NOT come from the user's own gesture. */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null || origin === 'gesture') return;

    const target = normaliseCamera(camera);

    if (camerasEqual(cameraOf(map), target, 1e-3)) return;

    applyingRef.current = target;

    const options = {
      center: [target.center[0], target.center[1]] as [number, number],
      zoom: target.zoom,
      bearing: target.bearing,
      pitch: target.pitch,
    };

    /*
      ── INVALID-CAMERA SAFETY, AND WHAT IT DELIBERATELY IS NOT ─────────────

      `normaliseCamera` has already repaired NaN and Infinity toward WORLD, so
      what can still reach the engine is a FINITE longitude of any magnitude —
      which is legitimate under Main's ruling and is exactly what must not be
      clamped.

      If MapLibre's public camera API nonetheless refuses one, the failure mode
      that matters is a map left broken: the engine keeps whatever frame it had,
      the application believes it is somewhere else, and nothing the reader does
      recovers it. So a refusal falls back to the canonical WORLD camera and the
      surface stays usable.

      THIS IS NOT A USER-FACING CLAMP, and the distinction is the whole point.
      It never rewrites a longitude to a nearby one — there is no bound, no
      modulo and no LNG_LIMIT here. It is reached only when the engine itself
      rejects a camera, and its single outcome is WORLD.
    */
    const apply = (): void => {
      /* The first camera is a placement, not a journey — no animation on mount. */
      if (origin === 'initial' || origin === 'url') map.jumpTo(options);
      else map.easeTo({ ...options, duration: 420 });
    };

    try {
      apply();
    } catch {
      applyingRef.current = WORLD_CAMERA;
      map.jumpTo({
        center: [WORLD_CAMERA.center[0], WORLD_CAMERA.center[1]],
        zoom: WORLD_CAMERA.zoom,
        bearing: WORLD_CAMERA.bearing,
        pitch: WORLD_CAMERA.pitch,
      });
    }
  }, [camera, origin]);

  /*
    ══ THE COUNTRY STATE PAINT, FROM DESIGN'S OWN VALUES ════════════════════

    SUPERSEDES `coveragePaint` ON THIS SURFACE ONLY.

    `coveragePaint` is the accepted legacy World Map paint — a story-count wash
    with a 0.05 resting opacity — and it is still exactly what the flag-off
    rollback renders. It is not what Design draws: the reference has four
    discrete tones at fixed opacities and no wash at all, and the CTO's ruling
    is that "Claude Design's actual tokens are the authority."

    So the tone of each country comes from its OWN EVIDENCE RECORDS, through
    the same `legendToken` grammar the legend renders, and the opacities come
    from `designRenderTokens.ts`. `countryStoryCounts` no longer paints
    anything; it is still passed, and still used for the hover tooltip's count.
  */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady) return;
    if (map.getLayer(FILL_LAYER_ID) === undefined) return;

    /*
      ONE TONE PER COUNTRY, AND THE STRONGEST CLAIM WINS.

      A country holding a verified record and an interpreted one is a country
      with verified evidence; drawing it grey because an interpreted record
      exists would let the weaker claim decide the whole geography. The order
      below is the legend's own order of strength.
    */
    const toneByNumericId = new Map<string, CountryTone>();
    const RANK: Readonly<Record<CountryTone, number>> = {
      verified: 3,
      attention: 2,
      unknown: 1,
      none: 0,
    };

    for (const record of evidenceRecords) {
      const numericId = isoToNumeric(record.geography.countryIso3);

      if (numericId.length === 0) continue;

      const tone = toneForLegendKey(
        markerStyleFor(record.precision, record.provenance).legendKey,
      );
      const current = toneByNumericId.get(numericId);

      if (current === undefined || RANK[tone] > RANK[current]) {
        toneByNumericId.set(numericId, tone);
      }
    }

    /* Countries queried this session that returned nothing — the `none` tone. */
    for (const geography of noEvidenceGeography ?? []) {
      const numericId = isoToNumeric(geography.countryIso3);

      if (numericId.length > 0 && !toneByNumericId.has(numericId)) {
        toneByNumericId.set(numericId, 'none');
      }
    }

    const byTone: Record<CountryTone, string[]> = {
      verified: [],
      attention: [],
      unknown: [],
      none: [],
    };

    tonedRef.current = new Set(toneByNumericId.keys());

    for (const [numericId, tone] of toneByNumericId) byTone[tone].push(numericId);

    /*
      ── THE CASCADE REPLACES, IT DOES NOT STACK ────────────────────────────

      The prototype assigns `fill = ...` in each branch, so a selected country
      is painted at .18 and NOT at .18 over its evidence .12. MapLibre layers
      composite instead of replacing, so the selected country is excluded from
      the evidence fill: without this the two add to roughly .28 and produce
      exactly the "heavy opaque fill that dominates the basemap" the ruling
      names. The evidence STROKE is left in place — the prototype's selected
      branch overrides the stroke colour, and the selected line layer above
      already draws over it.
    */
    const selectedNumericId = selectedIso3 === null ? '' : isoToNumeric(selectedIso3);

    if (selectedNumericId.length > 0) {
      for (const tone of Object.keys(byTone) as CountryTone[]) {
        byTone[tone] = byTone[tone].filter((id) => id !== selectedNumericId);
      }
    }

    map.setPaintProperty(
      FILL_LAYER_ID,
      'fill-color',
      toneMatchExpression(byTone, 'fillColour', '#3ad6e6') as never,
    );
    map.setPaintProperty(
      FILL_LAYER_ID,
      'fill-opacity',
      toneMatchExpression(byTone, 'fillOpacity', 0) as never,
    );

    if (map.getLayer(EVIDENCE_LINE_LAYER_ID) !== undefined) {
      map.setPaintProperty(
        EVIDENCE_LINE_LAYER_ID,
        'line-color',
        toneMatchExpression(byTone, 'strokeColour', '#3ad6e6') as never,
      );
      map.setPaintProperty(
        EVIDENCE_LINE_LAYER_ID,
        'line-opacity',
        toneMatchExpression(byTone, 'strokeOpacity', 0) as never,
      );
    }
  }, [evidenceRecords, noEvidenceGeography, selectedIso3, styleReady]);

  /*
    SELECTION — its own two layers, filtered rather than painted, so selecting
    a country changes a filter and not four paint properties.
  */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady) return;

    const numericId = selectedIso3 === null ? NO_HOVER : isoToNumeric(selectedIso3) || NO_HOVER;

    for (const layerId of [SELECTED_FILL_LAYER_ID, SELECTED_LINE_LAYER_ID]) {
      if (map.getLayer(layerId) === undefined) continue;

      map.setFilter(layerId, ['==', ['get', 'numericId'], numericId] as never);
    }
  }, [selectedIso3, styleReady]);

  /*
    SPATIAL M2 — THE EVIDENCE SOURCE FOLLOWS THE QUALIFYING RECORDS.

    `evidenceRecords` arrives already filtered by mode and period, so this
    effect only translates records into features and hands them to the engine.
    No filtering, ranking or precision decision happens here — the canvas
    paints what it is given, which is what keeps a single answer to "which
    records qualify" in `qualifyingRecords`.
  */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady) return;

    const source = map.getSource(EVIDENCE_SOURCE_ID);

    if (source === undefined || !('setData' in source)) return;

    (source as maplibregl.GeoJSONSource).setData(
      evidenceFeatures(evidenceRecords) as never,
    );
  }, [evidenceRecords, styleReady]);

  /*
    THE WATCHED SET REACHES THE ENGINE AS A FILTER, NOT AS NEW DATA.

    `numericId` is the property the country source already carries, so watching
    a country re-filters two existing layers rather than rebuilding a source.
    Unwatching removes it from the filter, which is why the amber disappears in
    the same frame the follow succeeds.

    ── AND IT DEFERS TO AN EVIDENCE STROKE, AS THE PROTOTYPE DOES ───────────

    Its watch branch is `stroke = stroke || amber`: a watched country that
    already carries an evidence stroke KEEPS the evidence stroke. That is
    reproduced by excluding from this filter every country the evidence layer
    is already stroking, so monitoring never overwrites what the evidence says.
  */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady) return;

    const strokedByEvidence = new Set(
      evidenceRecords.map((record) => isoToNumeric(record.geography.countryIso3)),
    );

    const numericIds = [...(watch ?? new Set<string>())]
      .map((iso3) => isoToNumeric(iso3))
      .filter((id) => id.length > 0 && !strokedByEvidence.has(id));

    for (const layerId of [WATCH_GLOW_LAYER_ID, WATCH_LINE_LAYER_ID]) {
      if (map.getLayer(layerId) === undefined) continue;

      map.setFilter(layerId, ['in', ['get', 'numericId'], ['literal', numericIds]] as never);
    }
  }, [watch, evidenceRecords, styleReady]);

  /*
    ── THE REFERENCE LABEL LAYER ────────────────────────────────────────────

    Recomputed on every camera move, as Part I §F requires ("a greedy collision
    grid, RECOMPUTED EVERY FRAME"). Projection is the engine's — it is the only
    thing that knows where a coordinate lands — and everything else is the pure
    placement module, so the rule is testable and the renderer is dumb.

    Held in state rather than written to the DOM directly so React owns the
    nodes; the array is small (tens of labels after collision) and it changes
    only on move.
  */
  const [labels, setLabels] = useState<readonly LabelCandidate[]>([]);

  const recomputeLabels = useCallback(() => {
    const map = mapRef.current;

    if (map === null || labelNames === undefined) {
      setLabels([]);

      return;
    }

    const container = map.getContainer();
    const viewport = { width: container.clientWidth, height: container.clientHeight };

    const candidates = referenceLabelCandidates({
      zoom: map.getZoom(),
      language,
      enabled: layers?.labels !== false,
      continentNames: labelNames.continents,
      waterNames: labelNames.waters,
      territoryNames: labelNames.territories ?? {},
      project: (lon, lat) => {
        const point = map.project([lon, lat]);

        return Number.isFinite(point.x) && Number.isFinite(point.y)
          ? { x: point.x, y: point.y }
          : null;
      },
    });

    /*
      "Country labels are suppressed when an evidence caption for the same
      country is already on screen, so the intelligence layer always wins the
      space." The captions are the evidence records that render as points.
    */
    const suppressCountries = new Set(
      evidenceRecords
        .filter((record) => record.geography.point !== undefined)
        .map((record) => record.geography.countryIso3),
    );

    /*
      The HUD's own boxes, measured from the DOM rather than hard-coded, so
      moving a control moves its exclusion with it and the two can never
      disagree.
    */
    /*
      Queried from the CANVAS REGION, not the engine's own container: the HUD
      islands are siblings of the canvas, one level up. Scoped to the container
      the query matched nothing, so the exclusion silently did nothing and
      "Indian Ocean" kept landing under the Previous View button.
    */
    const hudRoot = container.closest('[data-gn="map-canvas-region"]') ?? container;
    const base = container.getBoundingClientRect();
    const reserved = [...hudRoot.querySelectorAll('[data-gn-hud-reserve]')].map((node) => {
      const rect = node.getBoundingClientRect();

      return {
        x: rect.x - base.x + rect.width / 2,
        y: rect.y - base.y + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    });

    setLabels(placeLabels(candidates, { viewport, suppressCountries, reserved }));

    /*
      The ripple positions ride along on the same recompute, so the rings track
      the camera on exactly the frames the labels do and cannot lag behind them.
    */
    const active: { id: string; x: number; y: number; amber: boolean }[] = [];

    if (layers?.evidencePoints !== false) {
      for (const record of evidenceRecords) {
        const point = record.geography.point;

        if (point === undefined || !rendersAsPoint(record.precision)) continue;

        const style = markerStyleFor(record.precision, record.provenance);

        /* `.mk.unk .ring { display: none }` — see the note above. */
        if ((DESIGN_RIPPLE.suppressedFor as readonly string[]).includes(style.legendKey)) continue;

        const projected = map.project([point[0], point[1]]);

        if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue;
        if (
          projected.x < 0 ||
          projected.y < 0 ||
          projected.x > viewport.width ||
          projected.y > viewport.height
        ) {
          continue;
        }

        active.push({
          id: record.geography.id,
          x: projected.x,
          y: projected.y,
          amber: style.legendKey === 'attention',
        });
      }
    }

    setRipples(active);
  }, [evidenceRecords, labelNames, language, layers?.labels, layers?.evidencePoints]);


  /*
    THE CALLOUT ANCHOR, RECOMPUTED ON EVERY CAMERA FRAME.

    `move` rather than `moveend`, so the card travels WITH the country during a
    drag or a flight instead of jumping to it afterwards. The work is one
    `project()` call per frame, which is the same cost the label overlay already
    pays and orders of magnitude below a re-render of the map.
  */
  /*
    ══ THE 3.2 s EVIDENCE RIPPLE ════════════════════════════════════════════

    Part I §E permits four motions and binds each to a meaning. This is the
    first: "A 3.2 S EVIDENCE RIPPLE ON ACTIVE RECORDS." It is NOT live
    monitoring — monitoring is the static amber edge glow, which is the third
    motion and has no animation at all.

    ── WHY IT IS A DOM OVERLAY AND NOT A MAPLIBRE LAYER ────────────────────

    Because that is what the reference is. The prototype renders its markers as
    absolutely-positioned DOM nodes in `#marks` and gives the ring a real CSS
    `animation: pulse 3.2s ease-out infinite`. A circle layer cannot hold
    keyframes; animating one would mean a `requestAnimationFrame` loop calling
    `setPaintProperty`, which is a second animation system with its own timing,
    its own easing approximation, and no relationship to
    `prefers-reduced-motion`.

    Rendering the ring the way Design renders it gives the exact keyframes, the
    exact easing, and the media query for free.

    ── AND UNCERTAINTY DOES NOT RIPPLE ─────────────────────────────────────

    `.mk.unk .ring { display: none }`. An interpreted, contested or unresolved
    record has no ring in the reference, which is the same sentence Part I §G
    writes as "hollow, dashed, grey, NO PULSE". `DESIGN_RIPPLE.suppressedFor`
    holds the legend keys that get none.
  */
  const [ripples, setRipples] = useState<
    readonly { readonly id: string; readonly x: number; readonly y: number; readonly amber: boolean }[]
  >([]);

  /*
    Which countries currently carry an evidence tone. Held in a ref because the
    hover handlers are bound once on `load` and must not be rebound every time
    the evidence set changes — a rebind would drop the pointer's own state.
  */
  const tonedRef = useRef<Set<string>>(new Set());

  const anchorRef = useRef(onCalloutAnchorChange);
  anchorRef.current = onCalloutAnchorChange;

  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady) return;

    const report = (): void => {
      if (calloutAnchor === null) {
        anchorRef.current?.(null);

        return;
      }

      const point = map.project([calloutAnchor[0], calloutAnchor[1]]);

      anchorRef.current?.(
        Number.isFinite(point.x) && Number.isFinite(point.y)
          ? { x: point.x, y: point.y }
          : null,
      );
    };

    report();
    map.on('move', report);
    map.on('resize', report);

    return () => {
      map.off('move', report);
      map.off('resize', report);
    };
  }, [calloutAnchor, styleReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady) return;

    recomputeLabels();
    map.on('move', recomputeLabels);
    map.on('resize', recomputeLabels);

    return () => {
      map.off('move', recomputeLabels);
      map.off('resize', recomputeLabels);
    };
  }, [recomputeLabels, styleReady]);

  /*
    LAYER VISIBILITY FOLLOWS THE RAIL.

    `layers` is the registry-backed toggle map. A layer that is off is set to
    `visibility: none` rather than having its data removed, so toggling it back
    on is instant and the source is never rebuilt — and, more importantly, an
    off layer keeps its data so the counts a user is reading elsewhere do not
    change when they hide an outline.
  */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady || layers === undefined) return;

    const apply = (layerId: string, on: boolean): void => {
      if (map.getLayer(layerId) === undefined) return;

      map.setLayoutProperty(layerId, 'visibility', on ? 'visible' : 'none');
    };

    apply(OUTLINE_LAYER_ID, layers.admin0 !== false);
    apply(FILL_LAYER_ID, layers.countryEvidence !== false);
    apply(EVIDENCE_LINE_LAYER_ID, layers.countryEvidence !== false);
    apply(WATCH_GLOW_LAYER_ID, layers.watch !== false);
    apply(WATCH_LINE_LAYER_ID, layers.watch !== false);
    apply(HALO_LAYER_ID, layers.evidencePoints !== false);
    apply(MARK_LAYER_ID, layers.evidencePoints !== false);
  }, [layers, styleReady]);

  /*
    DENSITY DECIDES WHETHER THE SURFACE IS AN INSTRUMENT OR A PICTURE.

    Part II §1: EMBED is "non-interactive by default ... NEVER CAPTURES WHEEL
    EVENTS — the page must keep scrolling", and MINI has no controls at all.
    Enforced on the engine's own handlers rather than by an overlay, because an
    overlay that swallows the wheel would also swallow the page's scroll.
  */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null) return;

    const setEnabled = (handler: { enable: () => void; disable: () => void }, on: boolean): void => {
      if (on) handler.enable();
      else handler.disable();
    };

    setEnabled(map.dragPan, interactive);
    setEnabled(map.doubleClickZoom, interactive);
    setEnabled(map.touchZoomRotate, interactive);
    setEnabled(map.keyboard, interactive);
    setEnabled(map.scrollZoom, interactive && capturesWheel);
  }, [interactive, capturesWheel]);

  /*
    Resolve a bounds request into the exact camera the LEGACY fitBounds would
    have produced — same padding, same zoom ceiling — and hand it upward. This
    never moves the map itself; the reducer decides, as always.
  */
  useEffect(() => {
    const map = mapRef.current;

    if (map === null || !styleReady || fitBounds === null) return;

    /*
      DEFER, NEVER GUESS. `cameraForBounds` answers against the container, so
      with no container there is no answer — only a number that looks like one.
      Measured on the shipped build: resolving this against a 0x0 box produced
      zoom 3.46 where the correct answer is 5.0, and because the result is
      published upward it reached application state and the URL and stayed
      there through every later resize.

      The request is held instead, and `onMeasured` resolves it the moment a
      real box exists.
    */
    if (!resolveFitRef.current(map, fitBounds)) pendingFitRef.current = fitBounds;
  }, [fitBounds, styleReady]);

  return (
    <div className="relative h-full w-full" data-gn="map-canvas" data-gn-density={density}>
      <div
        ref={containerRef}
        data-gn="map-canvas-surface"
        className="h-full w-full"
        role="application"
        aria-label={ariaLabel}
        aria-describedby="gn-map-interaction-hint"
      />
      {/*
        The interaction contract, available to a screen reader rather than
        implied by a mouse. `role="application"` tells assistive technology to
        pass keys through, which is only honest if the keys are described.
      */}
      <p id="gn-map-interaction-hint" className="sr-only">
        {interactionHint}
      </p>

      {/*
        THE LABEL LAYER — a DOM overlay, exactly as the Design prototype does
        it, because MapLibre text needs a glyph server and this style is
        deliberately local. Inert to the pointer, so a label never eats a click
        meant for the country under it.
      */}
      {/*
        THE EVIDENCE RIPPLE. `aria-hidden` and pointer-inert: it is the visual
        expression of a record that is already announced by the marker's own
        card, and a ring that ate clicks would make the country under it
        unselectable for 3.2 seconds at a time.
      */}
      <div
        data-gn="map-ripples"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            data-gn="evidence-ripple"
            data-gn-tone={ripple.amber ? 'attention' : 'verified'}
            className="gn-evidence-ripple absolute block -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: DESIGN_RIPPLE.diameter,
              height: DESIGN_RIPPLE.diameter,
              borderWidth: DESIGN_RIPPLE.strokeWidth,
              borderStyle: 'solid',
              borderColor: ripple.amber ? DESIGN_RIPPLE.strokeAmber : DESIGN_RIPPLE.strokeCyan,
            }}
          />
        ))}
      </div>

      <div data-gn="map-labels" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((label) => {
          const type =
            label.kind === 'continent'
              ? LABEL_TYPE.continent
              : label.kind === 'water'
                ? LABEL_TYPE.water
                : LABEL_TYPE.country;

          return (
            <span
              key={label.id}
              data-gn="map-label"
              data-gn-label-kind={label.kind}
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-gn-mono ${
                label.kind === 'water'
                  ? 'italic text-[#4b7f92]'
                  : label.kind === 'continent'
                    ? 'text-[rgba(139,161,174,.55)]'
                    : 'text-[#a8bcc8]'
              } ${label.kind === 'city' ? '' : 'uppercase'}`}
              style={{
                left: label.x,
                top: label.y,
                fontSize: type.size,
                letterSpacing: `${type.tracking}em`,
                textShadow: '0 0 6px #05090d, 0 0 12px #05090d',
              }}
            >
              {label.text}
            </span>
          );
        })}
      </div>

      {failed ? (
        <div
          data-gn="map-canvas-failed"
          className="absolute inset-0 flex items-center justify-center bg-[#080b12] p-4 text-center font-gn-mono text-[12px] uppercase tracking-[0.1em] text-[#4b7f8c]"
        >
          {ariaLabel}
        </div>
      ) : null}
    </div>
  );
}
