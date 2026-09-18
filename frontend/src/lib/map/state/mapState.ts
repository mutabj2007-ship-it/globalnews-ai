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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT E — WHY A MODE CANNOT ANSWER, NOT MERELY THAT IT CANNOT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Placeholder semantics must distinguish NOT BUILT / NOT CONNECTED
 * / NO DATA FOR THIS GEOGRAPHY / TIER RESTRICTED / TEMPORARILY UNAVAILABLE. Do
 * not collapse every condition into 'No data yet.'"*
 *
 * `modeAvailability` above answers a BOOLEAN question — can this mode answer? —
 * and four modes shared one word, "Unavailable", for four different reasons.
 * That is the same class of flattening the availability model was written to
 * prevent: it told the reader a capability was absent while saying nothing about
 * whether it was coming, broken, empty here, or gated.
 *
 * THE FIVE REASONS ARE NOT INTERCHANGEABLE, and the difference is what a reader
 * actually needs:
 *
 *   NOT_BUILT              the capability does not exist yet. Nothing the reader
 *                          does will produce an answer, today or after a retry.
 *   NOT_CONNECTED          the capability EXISTS and renders elsewhere in the
 *                          product, but this surface is not wired to it. The
 *                          answer exists; this door does not open onto it.
 *   NO_DATA_FOR_GEOGRAPHY  the capability works and has nothing for THIS place.
 *                          Another geography would answer.
 *   TIER_RESTRICTED        the capability works and this reader may not reach
 *                          it. Reserved; no mode uses it while the monetization
 *                          contract is under review.
 *   TEMPORARILY_UNAVAILABLE a transient failure. A retry is the right response,
 *                          which is true of none of the others.
 */
export type ModeUnavailableReason =
  | 'NOT_BUILT'
  | 'NOT_CONNECTED'
  | 'NO_DATA_FOR_GEOGRAPHY'
  | 'TIER_RESTRICTED'
  | 'TEMPORARILY_UNAVAILABLE';

/**
 * WHY EACH UNBUILT MODE CANNOT ANSWER, ESTABLISHED FROM THE CODEBASE RATHER
 * THAN ASSUMED.
 *
 *   SITUATIONS  NOT_BUILT. The situation model does not exist. The product
 *               already says so in its own words — see `situationsUnavailable`
 *               in the dictionaries: "the situation model is not built yet, so
 *               this is not 'no situations here' — it is a capability that
 *               cannot answer the question."
 *
 *   WATCH       NOT_CONNECTED. Watch is REAL and reachable: `Watchboard`,
 *               `WatchComposer` and `WatchCta` render in the intelligence rail,
 *               and `/follows/countries` backs them. What does not exist is a
 *               MAP MODE that projects it onto the canvas.
 *
 *   CHANGE      NOT_CONNECTED. `ChangeStrip` renders beside the breadcrumb row
 *               today. Again the capability is present and the mode is not.
 *
 *   SOURCES     NOT_CONNECTED. Retained sources render in the rail through
 *               `SourceCard`. The mode that would map them does not.
 *
 * CALLING ANY OF THE LAST THREE "not built" WOULD BE FALSE, and falser than the
 * generic word it replaces: it would tell a reader a capability they can
 * literally see on the same screen does not exist.
 */
const MODE_UNAVAILABLE_REASONS: Readonly<Partial<Record<MapMode, ModeUnavailableReason>>> = {
  SITUATIONS: 'NOT_BUILT',
  WATCH: 'NOT_CONNECTED',
  CHANGE: 'NOT_CONNECTED',
  SOURCES: 'NOT_CONNECTED',
};

/** The reason a mode cannot answer, or null when it can. */
export function modeUnavailableReason(mode: MapMode): ModeUnavailableReason | null {
  if (modeAvailability(mode) === 'live') return null;

  /*
    A mode that is not live and has no declared reason is a GAP, not a default.
    Returning NOT_BUILT here would quietly invent an explanation for a mode
    someone added without deciding what it is, so the honest answer is the
    transient one — it is the only reason that promises nothing.
  */
  return MODE_UNAVAILABLE_REASONS[mode] ?? 'TEMPORARILY_UNAVAILABLE';
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
/**
 * ══ MAP-SEARCH-CITY-SEMANTIC-SELECTION-1 — CITY JOINS THE UNION ═══════════
 *
 * Checkpoint G refused a city selection, and its reason was sound at the time:
 * "a city is not a selectable evidence geography, and the evidence ceiling is
 * COUNTRY, so Rwanda genuinely IS the evidence geography for a report in
 * Kigali." A reader committing the Kigali row therefore moved the camera and
 * selected nothing — which is exactly what the live inspection measured: a
 * camera jump, `cam=` alone in the URL, and a rail still reading World.
 *
 * THE CTO RULING SUPERSEDES THAT REFUSAL FOR SELECTION ONLY, AND SAYS SO:
 * CITY becomes a selectable semantic/navigation geography, and the evidence
 * ceiling is explicitly NOT superseded.
 *
 * So the three things this product had collapsed into one are now three:
 *
 *     SEMANTIC SELECTION SCOPE     what the reader chose      Kigali CITY
 *     EVIDENCE RESOLUTION CEILING  where evidence resolves    Rwanda COUNTRY
 *     CAMERA STATE                 where the viewport is      lon/lat/zoom
 *
 * Adding CITY here is what stops the first from silently becoming the second.
 * Nothing in this change lowers the ceiling: `EVIDENCE_CEILING_KIND` below
 * states that rule once, so it cannot be re-decided per surface.
 */
export type SelectionKind =
  | 'COUNTRY'
  | 'CITY'
  | 'EVIDENCE'
  | 'SITUATION'
  | 'SOURCE'
  | 'REGION';

/**
 * THE EVIDENCE CEILING, AS ONE EXPORTED FACT.
 *
 * Evidence resolves at COUNTRY and no finer. A CITY selection therefore names
 * where the READER is, never where the EVIDENCE is, and any surface showing
 * evidence while a city is selected must say whose evidence it is showing.
 * Stated once, here, because a ceiling re-derived at each call site is a
 * ceiling that will differ at one of them.
 */
export const EVIDENCE_CEILING_KIND = 'COUNTRY' as const;

/**
 * Geography selections a reader NAVIGATES to, as opposed to evidence records
 * they open. The distinction matters at exactly one place — whether committing
 * the selection may trigger retrieval — and §11 makes it a release gate: a
 * navigation selection must execute no provider.
 */
export const NAVIGATION_SELECTION_KINDS: readonly SelectionKind[] = [
  'COUNTRY',
  'CITY',
  'REGION',
];

/** True when a selection names a place the reader navigated to. */
export function isNavigationSelection(kind: SelectionKind): boolean {
  return NAVIGATION_SELECTION_KINDS.includes(kind);
}

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
