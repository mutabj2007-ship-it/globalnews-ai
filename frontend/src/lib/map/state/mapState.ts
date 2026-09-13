/**
 * SPATIAL M2 — THE MAP STATE MODEL, FROM DESIGN PART II §3.
 *
 * One store per shell instance. Camera, mode, period and selection are
 * URL-serialisable; everything else is ephemeral.
 *
 * THE RULE THAT KEEPS THE PRODUCT COHERENT, quoted from the spec because it is
 * the reason this module is separate from the camera module:
 *
 *     "State changes never imply camera changes except through the four
 *      explicit camera intents."
 *
 * So nothing in this file returns a camera, takes a camera, or has a field
 * that a renderer could mistake for one. Changing the mode cannot move the
 * map, because the type that carries the mode has no way to say where to look.
 */

/** Part II §3. WORLD and EVIDENCE are live at M2; the rest arrive at M5. */
export type MapMode = 'WORLD' | 'EVIDENCE' | 'SITUATIONS' | 'WATCH' | 'CHANGE' | 'SOURCES';

export const MAP_MODES: readonly MapMode[] = [
  'WORLD',
  'EVIDENCE',
  'SITUATIONS',
  'WATCH',
  'CHANGE',
  'SOURCES',
];

/** The modes M2 actually ships. Part II §6: "mode switcher (WORLD / EVIDENCE live)". */
export const LIVE_MAP_MODES: readonly MapMode[] = ['WORLD', 'EVIDENCE'];

/**
 * Part II §6, M5 acceptance: "a mode with no data is UNAVAILABLE rather than
 * empty." A mode the platform cannot answer in is disabled with a stated
 * reason, never presented as a working mode that happens to show nothing —
 * that is the same class of lie as an empty world.
 */
export type ModeAvailability = 'live' | 'beta' | 'unavailable';

export function modeAvailability(mode: MapMode): ModeAvailability {
  return LIVE_MAP_MODES.includes(mode) ? 'live' : 'unavailable';
}

/** Part II §3. A closed range is a user-chosen window. */
export type MapPeriod = 'NOW' | '24H' | '7D' | '30D';

export const MAP_PERIODS: readonly MapPeriod[] = ['NOW', '24H', '7D', '30D'];

/** How many hours back a period reaches. NOW is the live edge. */
export const PERIOD_HOURS: Readonly<Record<MapPeriod, number>> = {
  NOW: 1,
  '24H': 24,
  '7D': 24 * 7,
  '30D': 24 * 30,
};

/** Part II §1 / §3. Set by the surface, immutable for that surface's lifetime. */
export type MapDensity = 'MINI' | 'EMBED' | 'PANEL' | 'FULL' | 'MODAL';

/**
 * WHICH HUD ELEMENTS A DENSITY MOUNTS.
 *
 * Part II §8 question 3 is the whole architecture in one sentence: "Surfaces do
 * not choose their own controls; they declare a density and an evidence scope,
 * and the shell DERIVES the HUD." So this table is the only place a surface's
 * control set is decided, and no component may take a boolean prop that lets a
 * caller override it — that is how eight surfaces become eight clones.
 *
 * Read straight off the §1 surface table, column by column.
 */
export interface HudProfile {
  readonly modeSwitcher: boolean;
  readonly periodChips: boolean;
  readonly layerRail: boolean;
  readonly search: boolean;
  readonly legend: boolean;
  readonly breadcrumbs: boolean;
  readonly scaleBar: boolean;
  readonly readout: boolean;
  readonly rightRail: boolean;
  readonly zoomControls: boolean;
  readonly resetWorld: boolean;
  readonly resetEvidence: boolean;
  readonly previousView: boolean;
  /** Part II §2: "mandatory on every interactive surface". */
  readonly precisionBanner: boolean;
  readonly interactive: boolean;
  /** EMBED must never capture wheel events — the page has to keep scrolling. */
  readonly capturesWheel: boolean;
  readonly expandAction: boolean;
}

const HUD: Readonly<Record<MapDensity, HudProfile>> = {
  MINI: {
    modeSwitcher: false, periodChips: false, layerRail: false, search: false,
    legend: false, breadcrumbs: false, scaleBar: false, readout: false,
    rightRail: false, zoomControls: false, resetWorld: false, resetEvidence: false,
    previousView: false, precisionBanner: false, interactive: false,
    capturesWheel: false, expandAction: true,
  },
  EMBED: {
    modeSwitcher: false, periodChips: false, layerRail: false, search: false,
    legend: false, breadcrumbs: false, scaleBar: false, readout: false,
    rightRail: false, zoomControls: false, resetWorld: false, resetEvidence: false,
    previousView: false, precisionBanner: true, interactive: false,
    capturesWheel: false, expandAction: true,
  },
  PANEL: {
    modeSwitcher: false, periodChips: false, layerRail: false, search: false,
    legend: false, breadcrumbs: false, scaleBar: false, readout: false,
    rightRail: true, zoomControls: true, resetWorld: true, resetEvidence: true,
    previousView: true, precisionBanner: true, interactive: true,
    capturesWheel: true, expandAction: true,
  },
  FULL: {
    modeSwitcher: true, periodChips: true, layerRail: true, search: true,
    legend: true, breadcrumbs: true, scaleBar: true, readout: true,
    rightRail: true, zoomControls: true, resetWorld: true, resetEvidence: true,
    previousView: true, precisionBanner: true, interactive: true,
    capturesWheel: true, expandAction: false,
  },
  MODAL: {
    modeSwitcher: false, periodChips: true, layerRail: true, search: true,
    legend: true, breadcrumbs: true, scaleBar: true, readout: true,
    rightRail: true, zoomControls: true, resetWorld: true, resetEvidence: true,
    previousView: true, precisionBanner: true, interactive: true,
    capturesWheel: true, expandAction: false,
  },
};

export function hudProfile(density: MapDensity): HudProfile {
  return HUD[density] ?? HUD.PANEL;
}

/**
 * Part II §3. What the selection IS, so a renderer never guesses from an id.
 *
 * ── RSC-1 — `REGION` IS A FIRST-CLASS SELECTION KIND ──────────────────────
 *
 * Main's contract: "The shell may no longer represent a region by moving the
 * camera and leaving `selection` null, which is what C8 does." So REGION joins
 * the union rather than being modelled as an absence.
 *
 * One asymmetry, observed by Main and deliberately NOT changed here: `id` for
 * COUNTRY is a bare ISO3, while for REGION it is G's canonical geographyId
 * (`region:eastern-africa`). Changing that touches surfaces beyond RSC-1, so
 * every consumer branches on `kind` — which it must do anyway.
 */
export type SelectionKind = 'COUNTRY' | 'EVIDENCE' | 'SITUATION' | 'SOURCE' | 'REGION';

export interface MapSelection {
  readonly kind: SelectionKind;
  readonly id: string;
  readonly geographyId?: string;
  readonly recordId?: string;
  /**
   * RSC-1.1. REGION only, and `undefined` means NO DEFINITION IS ASSERTED —
   * never "the default one". A definition may not be pre-selected, defaulted,
   * remembered or inferred from locale.
   */
  readonly definitionId?: string;
}

export interface MapHover {
  readonly kind: SelectionKind;
  readonly id: string;
}

/** Part II §3. Scope is declared by the surface, not inferred from contents. */
export type EvidenceScope = 'GLOBAL' | 'QUESTION' | 'WATCHLIST';

export function selectionsEqual(a: MapSelection | null, b: MapSelection | null): boolean {
  if (a === null || b === null) return a === b;

  /*
    RSC-1.1: choosing a definition REFINES the same selection — `kind` and `id`
    are unchanged — but it changes what the product claims about membership, and
    it changes the URL. So it is compared here: two selections that assert
    different definitions are not the same state, even though they name the same
    region. Leaving it out would make `def=` silently unwritable.
  */
  return a.kind === b.kind && a.id === b.id && a.definitionId === b.definitionId;
}
