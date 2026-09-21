'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  COUNTRIES,
  type LanguageCode,
  type NewsCategory,
} from '@globalnews-ai/shared';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';
import type {
  CategoryCount,
  CoverageState,
  ProviderStatus,
  RetainedItem,
} from '@/lib/map/selection/selectionIntelligence';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { WORLD_MAP_DENSITY, type GeometryDensity } from '@/lib/map/density';
import {
  cameraAvailability,
  cameraReducer,
  initialCameraSession,
  type CameraIntent,
} from '@/lib/map/camera/cameraIntents';
import { WORLD_CAMERA, type Bounds, type CameraState } from '@/lib/map/camera/cameraState';
import { useSelectionCamera } from '@/lib/map/camera/useSelectionCamera';
import type { CountryFeature } from '@/lib/map/countryGeometry';
import type { HoveredCountry } from '@/components/map/WorldMap';
import {
  type MapDensity,
  type MapMode,
  type MapPeriod,
  type MapSelection,
  hudProfile,
} from '@/lib/map/state/mapState';
import {
  EMPTY_EVIDENCE_SET,
  type EvidenceGeography,
  type EvidenceSet,
  evidenceTotals,
  geographyTotals,
  qualifyingRecords,
} from '@/lib/map/evidence/evidenceModel';
import { type DisplayPrecision, isFinerThan } from '@/lib/map/spatial/precisionModel';
import { defaultLayerState } from '@/lib/map/layers/layerRegistry';
import { validationStates, type JumpTarget } from '@/lib/map/navigation/breadcrumbs';
import type { PlaceResult } from '@/lib/map/search/placeSearch';
import { regionMayFrame, REGIONAL_EVIDENCE_SCOPE } from '@/lib/map/region/regionSelection';
import { useResolvedRegion } from '@/lib/map/region/useResolvedRegion';
import { useResolvedCity } from '@/lib/map/geography/useResolvedCity';
import { localisedGovernedRegion } from '@/lib/map/region/governedRegionLabel';
import { CityIdentityCard } from './CityIdentityCard';
import { RegionIdentityCard } from '@/components/map/shell/RegionIdentityCard';
import { EvidenceMapCanvas } from './EvidenceMapCanvas';
import { SelectionCallout, CALLOUT_WIDTH, CALLOUT_MAX_HEIGHT } from './SelectionCallout';
import {
  CALLOUT_MIN_VIEWPORT_WIDTH,
  placeCallout,
  selectionAnchorFor,
} from '@/lib/map/selection/calloutPlacement';
import { MapCameraControls } from './MapCameraControls';
import { PrecisionBanner } from './PrecisionBanner';
import { MapHudTopBar } from './MapHudTopBar';
import { ModeSwitcher } from './ModeSwitcher';
import { LayerToggleRail } from './LayerToggleRail';
import { MapLanguageControl } from './MapLanguageControl';
import { rememberMapStateForSignIn } from '@/lib/map/state/signInReturnState';
import { MapControlCluster } from './d1/MapControlCluster';
import { GlobeLocator } from './d1/GlobeLocator';
import { LayersControl } from './d1/LayersControl';
import { ThreeDControl } from './d1/ThreeDControl';
import { boundsFromCamera } from '@/lib/map/d1/globeLocatorGeometry';
import { readBasemapConfiguration } from '@/lib/map/basemap/basemapSource';
import { EvidenceLegend } from './EvidenceLegend';
import { PlaceSearch } from './PlaceSearch';
import { BreadcrumbZoomNavigator } from './BreadcrumbZoomNavigator';
import {
  cityParentIso3,
  scopeForJumpTarget,
  type GeographyScope,
} from '@/lib/map/navigation/geographyScope';
import { IntelligenceRightRail } from './IntelligenceRightRail';
import { EvidenceSelectionCard, type FollowRelationship } from './EvidenceSelectionCard';
import { ContextSummaryPanel } from './ContextSummaryPanel';
import type { AttentionQueue } from '@/lib/specialist/attentionQueue';
import type { CountryReadPresentation } from '@/lib/map/retrieval/countryReadPresentation';
import { selectionForPlaceResult } from '@/lib/map/geography/semanticGeography';
import { MapReadout, MapScaleBar } from './MapReadout';
import { RailDrawer } from './monetization/RailDrawer';
import { WatchComposer } from './monetization/WatchComposer';
import { ActivationPanel } from './monetization/ActivationPanel';
import { Watchboard } from './monetization/Watchboard';
import { AssessmentTimeline } from './monetization/AssessmentTimeline';
import { ChangeStrip } from './monetization/ChangeStrip';
import { ActionDeck, type DeckAction } from './monetization/ActionDeck';
import {
  DEFAULT_SENSITIVITY,
  watchCapability,
  type WatchSensitivity,
} from '@/lib/map/monetization/watchModel';
import { WATCH_RUNTIME_ACTIVE } from '@/lib/map/monetization/watchRuntimeGate';
import {
  NO_SURFACES,
  closeSurface,
  isOpen,
  openSurface,
  type OpenSurfaces,
  type SurfaceId,
} from '@/lib/map/monetization/surfaceClass';
import {
  promote,
  watchCtaStage,
  type UnderstandingSignal,
} from '@/lib/map/monetization/watchCtaLadder';
import { accountSignInUrl } from '@/lib/api/accountBase';
/* CHECKPOINT F — the product's ONE language persistence path, reused. */
import { persistLanguageSelection } from '@/lib/i18n/languages';
/* MAP-DISPLAY-NAME-CENTRALISATION — the one reader-facing place-name path. */
import { localisedCountryName } from '@/lib/map/geography/displayName';

/*
  The same released sign-in path the accepted anonymous Follow state already
  uses. Consent happens off this origin, so no local identifier is minted as a
  stand-in and nothing in Auth is touched.
*/
const FOLLOW_RETURN_DESTINATION = '/map';

/*
  PART IV §6.3's monitored topics. A CLOSED LIST, because a topic narrows what
  COUNTS as a change and a free-text field would let a reader define a change
  the assessment cannot detect. These are the specification's own examples.
*/
const WATCH_TOPICS: readonly string[] = [
  'supply',
  'pricing',
  'logistics',
  'policy',
  'security',
  'infrastructure',
];

/**
 * SPATIAL M1a / M2 — THE GLOBAL MAP SHELL.
 *
 * Part II §2: "Owns the engine instance, the state store and the density
 * profile; MOUNTS EVERY OTHER COMPONENT."
 *
 * ── THE ARCHITECTURE, UNCHANGED SINCE M1a AND LOAD-BEARING ────────────────
 *
 * ONE OWNER, ONE REDUCER. Nothing else in the shell holds a camera. The canvas
 * receives one as a prop and reports gestures back; controls dispatch intents
 * and read availability; search and breadcrumbs emit targets that become
 * intents here. There is no second path by which the view can change, which is
 * the property Previous View depends on.
 *
 * ── WHAT M2 ADDS: THE DENSITY PROFILE DERIVES THE HUD ─────────────────────
 *
 * Part II §8 question 3 is the whole reason eight surfaces can share this
 * component without becoming eight clones:
 *
 *     "Surfaces do not choose their own controls; they declare a DENSITY and
 *      an evidence SCOPE, and the shell DERIVES the HUD."
 *
 * So there is no `showLegend` prop, no `withSearch`, no per-control boolean a
 * caller could set. `hudProfile(density)` is consulted once and every mount
 * decision reads from it. Adding a surface means adding a row to that table,
 * not adding a flag here — and a surface CANNOT quietly acquire a control the
 * spec did not give it.
 *
 * ── AND WHAT IT STILL REFUSES TO DO ───────────────────────────────────────
 *
 * MODE AND PERIOD NEVER MOVE THE CAMERA. Part I §C: "Mode switching never
 * moves the camera ... The user's position in the world is theirs, not the
 * mode's." Neither `onModeChange` nor `onPeriodChange` dispatches a camera
 * intent, and the effects below do not depend on either value.
 *
 * THE HERO IS NOT IN SCOPE. Part II §9 freezes it at file and route level;
 * nothing here imports from the Hero directory and the Hero imports nothing
 * from here.
 */

export interface GlobalMapShellProps {
  readonly language: LanguageCode;
  /**
   * MAIN-CONFLICT-D1-DOMAIN-BIND-R1 §2 — the attention queue for
   * `ContextSummaryPanel`, decided by the caller's bind and passed straight
   * through.
   *
   * THE SHELL DOES NOT BIND, AND MUST NOT. Which domain the reader asked for
   * is a URL fact, and this component deliberately does not read the URL — the
   * same rule `initialCamera` above states for the camera. So the caller binds
   * and hands the result down; the shell stays a renderer.
   *
   * OPTIONAL, DEFAULTING TO `null`, WHICH IS COUNTRY'S OWN CONFIGURATION. Every
   * existing caller that passes nothing keeps exactly today's behaviour, which
   * is why this is additive rather than a change to the frozen panel: §4 of the
   * bind authority records that this prop is the only difference across all 35
   * D1 components, and that the panel already declares, defaults and gates it.
   */
  readonly contextQueue?: AttentionQueue | null;
  /**
   * The explicit country read — state, action, and the blocks a completed read
   * populates.
   *
   * THE SHELL DOES NOT RETRIEVE, AND MUST NOT. Which country the reader chose
   * is a selection fact and whether they asked for it is an interaction fact;
   * both belong to the route that owns the URL and the state. This component
   * receives a result and an action to call, exactly as it does for the camera
   * and the context queue.
   *
   * Optional, so a host with no read to show — and every existing caller —
   * renders precisely today's card.
   */
  readonly countryRead?: CountryReadPresentation;
  /**
   * The camera to open with — decoded from the URL by the caller, which owns
   * routing. The shell does not read `window.location`: a component that
   * reaches for the URL itself cannot be server-rendered or tested.
   */
  readonly initialCamera?: CameraState;
  /** Called when the camera settles, so the caller can write it to the URL. */
  readonly onCameraChange?: (camera: CameraState) => void;
  /**
   * SURFACE DENSITY — the spec's own control, and the only one.
   *
   * FULL is the World Map's reference implementation; PANEL is Analysis;
   * MODAL is Expanded Evidence; EMBED is Today; MINI is a thumbnail. See the
   * note above: this is what a surface declares INSTEAD of a control list.
   */
  readonly surfaceDensity?: MapDensity;
  /** Geometry detail budget. Unrelated to precision — a rendering budget only. */
  readonly density?: GeometryDensity;

  /** Evidence the surface has loaded. Scope is declared on the set itself. */
  readonly evidenceSet?: EvidenceSet;
  /** Geography the surface QUERIED and retained nothing for. Never inferred. */
  readonly noEvidenceGeography?: readonly EvidenceGeography[];
  /** The finest level this deployment holds geometry for. */
  readonly availableGeometry?: DisplayPrecision;

  readonly mode?: MapMode;
  readonly onModeChange?: (mode: MapMode) => void;
  /** Part II §1 — Watch pins the switcher with a visible reason. */
  readonly pinnedModeReason?: string | null;
  readonly period?: MapPeriod;
  readonly onPeriodChange?: (period: MapPeriod) => void;

  readonly selection?: MapSelection | null;
  readonly onSelectionChange?: (selection: MapSelection | null) => void;

  /**
   * WATCHED GEOGRAPHY — THE OVERLAY, NOT THE ACTION.
   *
   * Used for WATCH-mode filtering, amber edge treatment and the "watching"
   * status shown against an evidence geography. It says WHICH places the user
   * follows; it is not the control that changes that, and it is deliberately a
   * plain set so it cannot be mistaken for one.
   */
  readonly watch?: ReadonlySet<string>;
  /**
   * THE FOLLOW/UNFOLLOW RELATIONSHIP for the current selection.
   *
   * `null` — the default — is the accepted signed-out contract: a visitor the
   * follows contract cannot speak for gets no control, rather than one that
   * would fail on click or fake a success. The route owns the single
   * `useCountryFollows()` instance and hands the relationship down, so the
   * card and the country panel beneath it can never disagree.
   */
  readonly follow?: FollowRelationship | null;
  readonly onOpenAnalysis?: (selection: MapSelection) => void;
  readonly onOpenSources?: (selection: MapSelection) => void;

  /*
    M1a.1 — WORLD MAP INTERACTION PARITY, PASSED THROUGH.

    The shell does not own the country selection: `MapPageClient` does, and it
    owned it before M1a too. Threading these through rather than lifting them
    keeps the route as the single owner of country state, which is what makes
    flag OFF and flag ON the same application with a different map.
  */
  readonly countryStoryCounts?: Record<string, number>;
  readonly selectedIso3?: string | null;
  readonly onHoverCountry?: (hover: HoveredCountry | null) => void;
  readonly onSelectCountry?: (feature: CountryFeature) => void;
  /**
   * M1a.1 CAMERA RESTORE — WAS `initialCamera` READ FROM AN EXPLICIT `cam=`?
   *
   * THE DEFECT THIS EXISTS TO FIX. On a fresh mount of `?country=USA&cam=...`
   * the URL camera was restored and then immediately overwritten: the
   * selection-fit effect saw a selected country it had never seen before —
   * `lastSelectionRef` starts null — treated it as a NEW selection, and
   * committed the country fit on top of the camera the user had explicitly
   * asked for. The country survived; the camera did not.
   *
   * WHY THE CALLER IS THE AUTHORITY. Only the caller parses the URL, so only
   * the caller knows whether `CAMERA_QUERY_KEY` was actually PRESENT. The
   * shell cannot recover that: an explicit `?cam=1.1/12/20` and no `cam=` at
   * all produce the same `initialCamera`, so any check inside the shell would
   * have to compare against `WORLD_CAMERA` — which would silently break the
   * one case where a user deliberately linked to the world view alongside a
   * country. This is a fact about the URL, not about the camera's value, and
   * it is passed as one rather than inferred.
   */
  readonly initialCameraRestored?: boolean;
  /**
   * ACCEPTED DETAIL SURFACES, HOSTED INSIDE THE INTELLIGENCE RAIL.
   *
   * Part II §2 gives the rail one job — host the context panel or the
   * selection card — and Part II §5 puts it inside the same viewport as the
   * map. The route's accepted country panel (articles, imagery, Follow/Watch,
   * Open Analysis) belongs in that viewport too, and it belongs BELOW the
   * evidence card rather than in a page column beside the workspace.
   *
   * Passed as a slot rather than imported, because the shell must not know
   * what an article is. The panel arrives already built by the route that owns
   * it, unmodified — which is how its accepted behaviour is preserved rather
   * than reimplemented.
   */
  readonly railDetail?: React.ReactNode;
  /**
   * ── DESIGN REVISION 1.2 · THE SELECTED-COUNTRY BLOCKS ────────────────────
   *
   * Blocks 01, 02, 05, 06, 09 and 10 of Part I §E, supplied by the route.
   *
   * PASSED AS DATA, NOT AS A SLOT. `railDetail` above is a ReactNode because
   * the shell must not know what an article is; these are the opposite case —
   * Design specifies the card's own blocks, so the CARD renders them and the
   * route supplies the values. A slot here would have let two surfaces draw
   * the same block two different ways.
   */
  readonly selectionDetail?: SelectionDetail;
  readonly children?: React.ReactNode;
}

/** The route-supplied inputs for Design revision 1.2's card blocks. */
export interface SelectionDetail {
  readonly identity?: { readonly iso3: string; readonly region?: string };
  readonly providerStatus?: ProviderStatus;
  readonly coverage?: CoverageState;
  readonly categories?: readonly CategoryCount[];
  readonly cardFilters?: ReadonlySet<NewsCategory>;
  readonly onToggleCategory?: (category: NewsCategory) => void;
  readonly onClearCategories?: () => void;
  readonly items?: readonly RetainedItem[];
  readonly selectedItemId?: string | null;
  readonly onSelectItem?: (id: string) => void;
  readonly onOpenSource?: (id: string) => void;
  readonly onAskAbout?: (id: string) => void;
  readonly topics?: readonly string[];
}

/**
 * PO-3 — A HUD ISLAND IS A POSITIONING BOX, NOT A SURFACE.
 *
 * The box itself must never take a click: it is transparent, it is sized by
 * layout rather than by its ink, and everything it does not cover is map the
 * user expects to drag. Only genuinely operable descendants take the pointer
 * back — buttons, links and form controls. Static chrome inside an island
 * (readout figures, the scale bar, banner prose) stays transparent, so the map
 * can be dragged straight through it.
 *
 * Exported so the interaction guard asserts the SHIPPED string rather than a
 * copy of it that could drift.
 */
export const HUD_ISLAND =
  'pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto ' +
  '[&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_textarea]:pointer-events-auto';

export function GlobalMapShell({
  language,
  /* Country's own configuration is the default, so an omitted prop is today. */
  contextQueue = null,
  countryRead,
  selectionDetail,
  initialCamera = WORLD_CAMERA,
  onCameraChange,
  surfaceDensity = 'FULL',
  density = WORLD_MAP_DENSITY,
  evidenceSet = EMPTY_EVIDENCE_SET,
  noEvidenceGeography = [],
  availableGeometry = 'COUNTRY',
  mode = 'WORLD',
  onModeChange,
  pinnedModeReason = null,
  period = '24H',
  onPeriodChange,
  selection = null,
  onSelectionChange,
  watch = new Set<string>(),
  follow = null,
  onOpenAnalysis,
  onOpenSources,
  countryStoryCounts,
  selectedIso3 = null,
  onHoverCountry,
  onSelectCountry,
  initialCameraRestored = false,
  railDetail,
  children,
}: GlobalMapShellProps): JSX.Element {
  const t = getDictionary(language).map;
  const shell = t.shell;
  const spatial = t.spatial;

  /*
    CHECKPOINT F — router.refresh() is what makes a language change take effect.

    This route resolves the language in a Server Component from the cookie, so
    re-rendering against the freshly written cookie is the whole mechanism —
    the same one NavBar.handleLanguageChange has always used. Nothing here holds
    language state of its own.
  */
  const router = useRouter();

  /* THE HUD IS DERIVED, NEVER PASSED. See the note above. */
  const hud = hudProfile(surfaceDensity);

  const [session, dispatch] = useReducer(cameraReducer, initialCamera, initialCameraSession);

  /*
    ── CHECKPOINT A · THE EXPLICIT VIEW SCOPE ───────────────────────────────

    CTO ruling: *"explicit user geography selection is authoritative; camera
    state must not redefine it."*

    This is the SELECTED INTELLIGENCE GEOGRAPHY as the ladder must describe it,
    and it is deliberately NOT a `MapSelection`: a continent or a subregion
    makes no evidence claim, so putting one in `selection` would hand the rail
    an aggregate RSC-1 refuses. Keeping the two apart is the distinction the
    ruling asks for, expressed as two pieces of state rather than one overloaded
    one.

    It is CLEARED BY A USER GESTURE, and that is the "when appropriate" the
    ruling preserves: once the reader drags away from the place they chose, they
    are navigating freely and camera context is the honest answer again. It is
    NOT cleared by Previous View or a control move, so walking back out of a
    jump restores the scope that belongs to the view being restored.
  */
  const [viewScope, setViewScope] = useState<GeographyScope | null>(null);

  /*
    ── RESET WORLD HAS TWO PROMISES, AND BOTH MUST REACH THE ROUTE ──────────

    Part I §C: "Reset world returns to the global view AND CLEARS THE
    SELECTION." The reducer clears its own opaque selection token, but the
    SELECTION ITSELF lives on the route — `MapPageClient` owns it, as it has
    since before M1a. The browser run caught the consequence: after Reset
    World the camera returned to the world and `sel=country:RWA` stayed in the
    URL with the card still open, so one button delivered one of its two
    promises.

    Intercepted here rather than inside the reducer, because the reducer must
    not know what a selection means — see `CameraSnapshot`.
  */
  const onIntent = useCallback(
    (intent: CameraIntent) => {
      if (intent.kind === 'reset-world') {
        onSelectionChange?.(null);
        /* Part I §C: Reset World clears the selection. A scope is a selection. */
        setViewScope(null);
      }

      dispatch(intent);
    },
    [onSelectionChange],
  );
  /*
    ── A2 LIFECYCLE CORRECTION · PANNING IS NOT DESELECTING ─────────────────

    CTO ruling: *"Do not clear explicit geography selection merely because the
    user pans or zooms the camera. AFRICA, EAST AFRICA, COUNTRY and CITY
    selections must survive ordinary camera manipulation."*

    An earlier revision of this file cleared the scope here, on the reasoning
    that dragging away from a place is leaving it. That was wrong, and the
    reason it was wrong is worth keeping: it confused MOVING THE VIEW with
    CHANGING THE SUBJECT. Examining the neighbourhood of a selected geography is
    the most ordinary thing a reader does on a map, and it is not a request to
    stop looking at that geography. Clearing on gesture made the explicit
    selection survive only until the reader touched the map.

    The scope is now cleared ONLY by a semantically explicit transition:
    another geography selection (handled by precedence in `ladderScope`), or
    Reset World, which is this product's declared "unselected map" action.
  */
  const onGesture = useCallback(
    (camera: CameraState) => dispatch({ kind: 'gesture', camera }),
    [],
  );

  /*
    PO-1/PO-3 — THE ENGINE'S REAL ZOOM FLOOR.

    With world copies off the renderer will not zoom out past the point where
    one world still covers the canvas, and that point is a function of the
    canvas size, so only the canvas can measure it. Until it reports one,
    MIN_ZOOM stands and first paint behaves exactly as before. Without this the
    zoom-out button stayed lit at Z 1.0 and did nothing on every press.
  */
  const [engineMinZoom, setEngineMinZoom] = useState<number | undefined>(undefined);

  const availability = useMemo(
    () => cameraAvailability(session, engineMinZoom),
    [session, engineMinZoom],
  );

  /* Layer state. Persisted per user by the caller; defaults are registry-driven. */
  const [layers, setLayers] = useState<Record<string, boolean>>(() => defaultLayerState());
  const [legendOpen, setLegendOpen] = useState(true);

  const onToggleLayer = useCallback((layerId: string, next: boolean) => {
    setLayers((current) => ({ ...current, [layerId]: next }));
  }, []);

  /*
    ── WHICH RECORDS QUALIFY, AND WHAT THEY TOTAL ───────────────────────────

    Recomputed from mode and period, and NOTHING ELSE reads the camera. That
    is Part I §C's rule as a dependency array: changing the mode changes which
    records qualify and cannot reach the camera, because the camera is not an
    input to any of it.
  */
  const records = useMemo(
    () => qualifyingRecords(evidenceSet, mode, period, watch),
    [evidenceSet, mode, period, watch],
  );
  const totals = useMemo(() => geographyTotals(records), [records]);
  const overall = useMemo(() => evidenceTotals(records), [records]);

  /*
    A REGION SELECTION IS NOT AN EVIDENCE GEOGRAPHY, SO IT LOOKS UP NOTHING.

    RSC-1: a region selection makes no evidence claim. Without this branch the
    lookup would run `totals.find(t => t.geographyId === 'region:eastern-africa')`
    — which returns undefined today, and would start returning a MEMBER's total
    the moment an id scheme brought the two namespaces near each other. Refusing
    by kind is the version of this that cannot drift.
  */
  const selectedTotal = useMemo(
    () =>
      selection === null || selection.kind === 'REGION'
        ? undefined
        : totals.find((total) => total.geographyId === selection.id),
    [selection, totals],
  );

  /*
    RSC-1 — THE RESOLVED REGION. One hook, shared with the mobile shell, so the
    id-to-identity relationship has exactly one implementation. `adopt` is the
    search-commit path: the node is already in hand, so nothing is requested.
  */
  const { region, adopt: adoptRegion } = useResolvedRegion(selection);
  /*
    MAP-SEARCH-CITY/REGION-RIGHT-RAIL. The same shape as the region hook above,
    for the same reason: a committed row adopts what it already holds, and only
    a cold restore from `sel=city:…` costs a lookup.
  */
  const { city } = useResolvedCity(selection);

  /*
    Publish the camera upward, but never on the first render: emitting the
    initial camera would make the caller write a URL parameter the user never
    asked for, on a page they only opened.
  */
  const publishedRef = useRef(false);
  useEffect(() => {
    if (!publishedRef.current) {
      publishedRef.current = true;

      return;
    }

    onCameraChange?.(session.camera);
  }, [session.camera, onCameraChange]);

  /*
    THE REDUCER IS TOLD ABOUT THE SELECTION, SO A FUTURE PUSH CAN RECORD IT.

    Design Part I §C: Previous View pops a history "including the selection
    that was active". The reducer stores an opaque token and never resolves it
    — see `CameraSnapshot` — so this effect is the only place the two models
    meet, and it moves no camera.
  */
  const selectionToken = selection === null ? (selectedIso3 ?? null) : selection.id;

  /*
    ── CHECKPOINT A · THE SCOPE THE LADDER ACTUALLY DESCRIBES ───────────────

    PRECEDENCE, AND WHY IT IS THIS WAY ROUND:

      1  a COUNTRY selection, from ANY path — map click, search, context panel
         or a validation-state jump. This is the strongest statement the reader
         can make about geography, so nothing may override it. It is read from
         `selection` rather than from the jump, so that a country CLICKED on
         the map names itself on the ladder too, not only a country jumped to.
      2  `selectedIso3`, the same fact arriving by the other route channel.
      3  the explicit view scope from a CONTINENT / SUBREGION / CITY jump.
      4  null — free navigation, and ONLY here may the camera name the place.

    A REGION selection deliberately falls through to case 3. Its id is the
    canonical geographyId namespace (`region:eastern-africa`), which is not the
    declared-product-region namespace (`region:east-africa`), and inventing a
    mapping between them is exactly the inference this checkpoint removes.
  */
  const ladderScope = useMemo<GeographyScope | null>(() => {
    const countryScope: GeographyScope | null =
      selection !== null && selection.kind === 'COUNTRY'
        ? { rung: 'COUNTRY', id: selection.id }
        : selection === null && typeof selectedIso3 === 'string' && selectedIso3.length > 0
          ? { rung: 'COUNTRY', id: selectedIso3 }
          : null;

    /*
      A CITY REFINES A COMPATIBLE COUNTRY — IT DOES NOT COMPETE WITH IT.

      `onJump` deliberately does NOT clear a country selection when moving to
      the city rung, because Kigali sits inside Rwanda and clearing Rwanda would
      destroy a correct, compatible state. Precedence has to honour that: if the
      country selection were allowed to win here, jumping to Kigali while Rwanda
      is selected would collapse the CITY identity back into its parent — the
      exact failure the ruling asks to be proven against.

      The compatibility test is the city's DECLARED parent from the gazetteer,
      never the camera. An incompatible pair (Kigali scoped while Poland is
      selected) is a genuine conflict, and there the explicit country selection
      wins, because it is the more recent deliberate statement about subject.
    */
    if (viewScope !== null && viewScope.rung === 'CITY') {
      const parent = cityParentIso3(viewScope.id);

      if (countryScope === null || parent === countryScope.id) return viewScope;
    }

    return countryScope ?? viewScope;
  }, [selection, selectedIso3, viewScope]);

  useEffect(() => {
    dispatch({ kind: 'selection', selection: selectionToken });
  }, [selectionToken]);

  /*
    M1a.1 — SELECTING A COUNTRY IS A CAMERA INTENT, NOT A MAP CALL.

    The legacy map called `fitBounds` directly on the engine, so choosing a
    country moved the view WITHOUT the camera history knowing, and nothing
    could undo it. Here the selection produces a camera the reducer commits
    like any other move, so Previous View walks back out of a selection the
    same way it walks back out of a zoom.

    Deselection does NOT move the camera. Clearing a country is not a request
    to go somewhere, and yanking the view back to the world would lose the
    place the reader was looking at.

    SEEDED, NOT null, WHEN THE CAMERA CAME FROM THE URL. A ref initialiser runs
    once, so this is the whole M1a.1 camera-restore fix: when the mount camera
    was explicitly restored from `cam=`, the country already selected at mount
    is recorded as ALREADY SEEN, and the effect below returns on its first run
    instead of committing a fit over the restored camera.
  */
  /*
    H-C907 — THIS POLICY NOW LIVES IN `useSelectionCamera`, UNCHANGED.

    Every rule described above still holds and is still the desktop behaviour;
    it has simply stopped being desktop-only. `MobileSpatialShell` had all of
    this machinery and none of this transition, so a phone selected a country
    and never framed it. Moving the accepted implementation into one hook is
    what makes the two shells share a camera policy instead of drifting into
    two — and a bounds focus still goes to the ENGINE to be measured against
    the real viewport, then comes back as an exact camera we commit, so the
    framing matches the legacy `fitBounds` precisely. One history entry either
    way.
  */
  const commitCamera = useCallback((camera: CameraState) => {
    dispatch({ kind: 'commit', camera });
  }, []);

  const { pendingBounds, onBoundsResolved } = useSelectionCamera({
    selectedIso3,
    initialCameraRestored,
    commitCamera,
  });

  /*
    ── RESET EVIDENCE — Part I §C's second promise ──────────────────────────

    "Keeps the selection and fits the bounds of all evidence visible in the
    current mode and period." So it fits from `records`, which is already
    mode- and period-filtered, and it dispatches no selection change.

    Disabled when nothing qualifies. An enabled button that frames nothing
    would imply evidence exists off-screen — the "absence of evidence is
    absence of the event" failure attached to a control.
  */
  const evidenceBounds = useMemo<Bounds | null>(() => {
    const points = records
      .map((record) => record.geography.point)
      .filter((point): point is readonly [number, number] => point !== undefined);

    if (points.length === 0) return null;

    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);

    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  }, [records]);

  const onResetEvidence = useCallback(() => {
    if (evidenceBounds === null) return;

    dispatch({ kind: 'focus-bounds', bounds: evidenceBounds });
  }, [evidenceBounds]);

  const onJump = useCallback(
    (target: JumpTarget) => {
      /*
        CHECKPOINT A — RECORD WHAT WAS CHOSEN, BEFORE ANYTHING MOVES.
        `scopeForJumpTarget` reads the EXISTING target; no jump definition is
        modified, per the CTO ruling that the bounds-only AFRICA and EAST
        AFRICA entries are correct as they stand.
      */
      setViewScope(scopeForJumpTarget(target));

      /*
        ══ C911-V2 — A JUMP MOVES THE CAMERA *AND* THE SELECTION ═══════════

        MEASURED IN PRODUCTION. Selecting RWANDA from JUMP TO VALIDATION STATE
        changed the URL, the camera and the country highlight, and the
        intelligence rail went on saying "World view" over Poland's evidence.
        No Rwanda evidence ever loaded.

        THE CAUSE WAS HERE, AND IT WAS ONE LINE. This callback dispatched
        `focus-bounds` and nothing else, so a jump could only ever move a
        camera. Every other selection path — a map click, a search result, the
        context panel — goes through `onSelectionChange`, which is what
        actually resolves the country, clears the card filters and triggers the
        retrieval that fills the rail. The jump path was the one entry point
        that never joined it.

        THIS IS THE M16 DEFECT, ONE ROUTE LATER. M16 fixed exactly this shape
        for a search REGION result — "selects nothing" had been implemented as
        "changes nothing", leaving the previous country behind. The same repair
        is applied here, in the same two branches and for the same reasons.

        A COUNTRY TARGET SELECTS, AND DOES NOT ALSO FOCUS. The selection-fit
        effect frames a selected country through `selectionCameraFor`, which
        carries the accepted antimeridian exceptions and is resolved against
        the real viewport. Dispatching `focus-bounds` as well would produce
        TWO camera commits and TWO history entries for one click, and Previous
        View would land on an intermediate frame nobody saw — the precise
        regression the search path documents immediately below.

        A TARGET ABOVE COUNTRY SCALE CLEARS AN INCOMPATIBLE SELECTION. Jumping
        to East Africa while Poland is selected must not leave the rail
        describing Poland. Clearing is not a new selection: `null` is the same
        signal `reset-world` already sends.

        THE CITY RUNG IS DELIBERATELY UNTOUCHED. Kigali sits INSIDE Rwanda, so
        clearing a Rwanda selection to move to Kigali would destroy a
        compatible, correct state. A city is not a selectable evidence
        geography either, so it selects nothing and simply focuses — exactly
        what it did before this correction.
      */
      if (target.rung === 'COUNTRY' && target.countryIso3) {
        onSelectionChange?.({ kind: 'COUNTRY', id: target.countryIso3 });

        return;
      }

      /*
        ══ MAP-REGION-STATE-PRESENTATION-1 — EAST AFRICA ESTABLISHES SCOPE ═══

        MEASURED LIVE: the camera flew to East Africa, the chip read EAST
        AFRICA, and the right rail went on reading "Widok świata" with `cam=`
        alone in the URL. The jump was a camera command and nothing else,
        because the target carried bounds and no identity.

        It now carries one — `regionId`, bound to the DECLARED product region
        `region:east-africa` and refused by `assertGovernedJumpRegions` if it
        ever names anything ungoverned. So the jump SELECTS, the single URL
        writer upstream serialises `sel=region:east-africa`, and a reload
        restores the scope rather than a bare viewport.

        THE CAMERA STILL MOVES, AND STILL ONLY ONCE. `focus-bounds` below is
        unchanged and remains the only camera commit on this path, so Previous
        View keeps landing on a frame the reader actually saw. Camera state and
        semantic scope are now two facts instead of one.
      */
      if (target.regionId !== undefined) {
        onSelectionChange?.({ kind: 'REGION', id: target.regionId });
        dispatch({ kind: 'focus-bounds', bounds: target.bounds });

        return;
      }

      if (target.rung !== 'CITY' && selection !== null && selection !== undefined) {
        onSelectionChange?.(null);
      }

      /* Part II §3: "Search and breadcrumbs call focus." */
      dispatch({ kind: 'focus-bounds', bounds: target.bounds });
    },
    [onSelectionChange, selection],
  );

  const onSelectSearchResult = useCallback(
    (result: PlaceResult) => {
      /*
        Part I §C: "Selecting a country result FLIES AND THEN SELECTS." A
        region result flies and selects nothing — a supranational region is not
        a selectable evidence geography, and pretending otherwise would open a
        card for a place the precision model refuses to draw.

        ── ONE MOVE PER ACTION, AND THE BROWSER RUN IS WHY ──────────────────

        My first cut dispatched `focus-bounds` here AND changed the selection.
        Changing the selection fires the selection-fit effect below, so one
        click produced TWO camera commits and TWO history entries — and
        Previous View then landed on an intermediate camera the user had never
        seen. The probe caught it: after a search-select, back went to a zoom
        6 frame that was never on screen.

        So a COUNTRY result selects and lets the selection-fit effect frame it.
        That path is also the better one: it uses `selectionCameraFor`, which
        carries the accepted antimeridian exceptions and is resolved against
        the real viewport by the engine. Only a result with NO selection to
        make — a region — focuses directly, because nothing else will move it.
      */
      if (result.kind === 'COUNTRY' && result.countryIso3) {
        onSelectionChange?.({ kind: 'COUNTRY', id: result.countryIso3 });

        return;
      }

      /*
        ── M16 — A REGION MOVES THE CAMERA, SO IT MUST NOT LEAVE A COUNTRY
              BEHIND ─────────────────────────────────────────────────────────

        The paragraph above is still true: a supranational region is not a
        selectable evidence geography, and this repair does not make one. What
        it was missing is that "selects nothing" was implemented as "changes
        nothing" — the branch focused and returned, and whatever country was
        selected before stayed selected.

        Measured on the integrated build: select Canada, then commit the
        "East Africa" result. The camera flew to 3.15S 35.40E; the rail and the
        callout went on describing CAN; and the URL still read
        `country=CAN&sel=country%3ACAN` beside a camera over Tanzania. Every
        surface that answers "what am I looking at?" disagreed with the map.

        So the region commit now CLEARS the incompatible selection first. That
        is a clearing, not a new selection: `null` is the same signal
        `reset-world` already sends, the route's own handler drops
        `selectedCountry`, the card filters and the selected item with it, and
        the URL effect stops writing `country=` and `sel=` because there is no
        longer a country to write.

        ONE CAMERA COMMIT, STILL. The selection-fit effect returns early when
        there is no selected ISO-3, so clearing cannot move the camera; the
        `focus-bounds` below remains the only move, and Previous View still
        lands on a frame the user actually saw.

        Cleared only when something IS selected, so committing a region from
        the world view stays a pure camera move and churns no state.

        What this deliberately does NOT do: invent a regional polygon,
        aggregate member-country evidence, or add a selection kind. The region
        remains unselected — the rail simply stops claiming a country that the
        user has navigated away from.

        ── RSC-1 HAS NOW LANDED, AND THE PARAGRAPH ABOVE IS SUPERSEDED ───────

        Main's contract arrived and says exactly what the last line predicted:
        "The shell may no longer represent a region by moving the camera and
        leaving `selection` null, which is what C8 does." So the clearing below
        is no longer the whole story — it is STEP 1 of a five-step transition,
        and the interim's own words ("the region remains unselected") are now
        false by design.

        THE TRANSITION, IN RSC-1'S ORDER:

          1  CLEAR the incompatible country selection
          2  SET the region selection
          3  CAMERA, conditionally — one `focus-bounds` if a derived extent
             exists, EMIT NOTHING if it does not
          4  URL — handled by the single writer upstream, from the selection
          5  RAIL — the regional card, from the resolved region

        Steps 1 and 2 are ONE call. `onSelectionChange` replaces the selection
        rather than clearing and re-setting it, so no render ever sees the
        cleared intermediate and no second history entry is written.

        ── AND A ROW WITHOUT AN IDENTITY IS STILL JUST A CAMERA MOVE ─────────

        `result.region` is present only on navigator rows. A local jump-target
        row — `{ id: 'eastAfrica' }` over a hard-coded box — has none, and falls
        through to the clearing-plus-focus path it has always taken. That is
        deliberate: minting `region:east-africa` from a label key would invent a
        region G does not hold (RSC-1's alias trap), and "East Africa" is in
        fact an ALIAS of `region:eastern-africa`, which only G can resolve.
      */
      const committed = result.region;

      if (committed !== undefined) {
        onSelectionChange?.({ kind: 'REGION', id: committed.geographyId });
        adoptRegion(committed);

        /*
          STEP 3. An unmoved camera is a correct outcome — RSC-1 — and for a
          region with no agreed membership it is the ONLY correct outcome: G
          publishes no bounds for one, and flying anywhere would assert an
          extent nobody published, in the most persuasive medium this product
          has.
        */
        if (regionMayFrame(committed) && committed.extent !== null) {
          dispatch({ kind: 'focus-bounds', bounds: committed.extent });
        }

        return;
      }

      /*
        ══ CHECKPOINT G — TWO ROUTES TO KIGALI, OPPOSITE BEHAVIOUR ═══════════

        The breadcrumb jump path already states the rule, and states it as
        settled:

            "THE CITY RUNG IS DELIBERATELY UNTOUCHED. Kigali sits INSIDE
             Rwanda, so clearing a Rwanda selection to move to Kigali would
             destroy a compatible, correct state."

        This path did the opposite. It cleared UNCONDITIONALLY, so committing
        the Kigali row from search destroyed a Rwanda selection that the same
        move from the breadcrumb row preserves. The right rail went blank and
        the evidence state was discarded, for a navigation that had gone
        somewhere strictly inside what was already selected.

        THE CLEARING IS NOW WHAT IT ALWAYS CLAIMED TO BE: the removal of an
        INCOMPATIBLE selection. A result that lies inside the selected country
        is compatible, so the selection stands, the rail keeps describing the
        evidence geography, and only the camera moves.

        CONTAINMENT IS READ FROM PUBLISHED FIELDS. `countryIso3` comes from G's
        own hierarchy via `navigatorCountryIso3`; nothing is parsed out of a
        geographyId and no containment is inferred from a bounding box.

        WHY THIS DOES NOT MAKE CITY AND REGION THE SAME THING. It does not
        select the city — a city is not a selectable evidence geography, and the
        evidence ceiling is COUNTRY, so Rwanda genuinely IS the evidence
        geography for a report in Kigali. What distinguishes the two rows is
        what honestly differs: their identity in the list, their context line,
        and where the camera lands. Nothing is invented to make them look more
        different than the data is.

        A supranational region carries no `countryIso3`, so it is never
        contained, and the M16 clearing it exists for is untouched.
      */
      /*
        ══ MAP-SEARCH-CITY/REGION-SEMANTIC-SELECTION-1 ══════════════════════

        CHECKPOINT G's PARAGRAPH ABOVE IS SUPERSEDED FOR SELECTION, AND ONLY
        FOR SELECTION. It reads: "It does not select the city — a city is not a
        selectable evidence geography, and the evidence ceiling is COUNTRY, so
        Rwanda genuinely IS the evidence geography for a report in Kigali."

        The second half of that sentence is STILL TRUE and is not touched here.
        The first half is what the CTO ruling reverses: CITY becomes a
        selectable semantic/navigation geography, because "what the reader
        chose" and "where evidence resolves" are two facts and the product was
        storing only the second.

        MEASURED LIVE, both rows: camera jumped (PASS), dropdown closed (PASS),
        URL carried `cam=` alone, right rail read World, no semantic identity.
        The cause was that neither row produced a selection at all —
        `result.region` is populated only for SUPRANATIONAL nodes, so the
        admin-1 "Kigali REGION" row fell through here exactly as the city row
        did, despite being displayed as REGION.

        `selectionForPlaceResult` is now the one place that decision is made,
        so CITY and REGION cannot be patched independently and drift.

        WHAT THIS DOES NOT DO: it does not lower the evidence ceiling, does not
        aggregate anything, and does not fabricate city-level evidence. A CITY
        selection names Kigali; the rail names Rwanda as the evidence geography
        beside it.
      */
      const semantic = selectionForPlaceResult(result);

      if (semantic !== undefined && semantic !== null) {
        onSelectionChange?.(semantic);

        if (result.bounds) dispatch({ kind: 'focus-bounds', bounds: result.bounds });

        return;
      }

      const containedInSelection =
        selection?.kind === 'COUNTRY' &&
        result.countryIso3 !== undefined &&
        result.countryIso3 === selection.id;

      if (selection !== null && selection !== undefined && !containedInSelection) {
        onSelectionChange?.(null);
      }

      if (result.bounds) dispatch({ kind: 'focus-bounds', bounds: result.bounds });
    },
    [onSelectionChange, selection, adoptRegion],
  );

  /**
   * KEYBOARD.
   *
   * Handled on the shell's own container rather than on `window`, so the map
   * only takes keys when the map has focus — a global listener would steal
   * arrow keys from the country search field beside it.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      /*
        A key pressed inside a text field belongs to the field. Without this,
        typing "0" into place search resets the camera to the world view and
        Backspace walks the map history instead of deleting a character.
      */
      const target = event.target as HTMLElement | null;

      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const intent = ((): CameraIntent | null => {
        switch (event.key) {
          case '+':
          case '=':
            return { kind: 'zoom-in' };
          case '-':
          case '_':
            return { kind: 'zoom-out' };
          case '0':
            return { kind: 'reset-world' };
          case 'Backspace':
            return { kind: 'previous-view' };
          case 'ArrowLeft':
            return { kind: 'pan', dx: -1, dy: 0 };
          case 'ArrowRight':
            return { kind: 'pan', dx: 1, dy: 0 };
          case 'ArrowUp':
            return { kind: 'pan', dx: 0, dy: 1 };
          case 'ArrowDown':
            return { kind: 'pan', dx: 0, dy: -1 };
          default:
            return null;
        }
      })();

      if (intent === null) return;

      /*
       * Only prevent the default for keys we actually consumed, so Tab, typing
       * and browser shortcuts still work while the map has focus.
       */
      event.preventDefault();

      /*
        THROUGH `onIntent`, NOT `dispatch`. Pressing 0 is Reset World, and
        Reset World clears the selection as well as the camera — a keyboard
        path that called the reducer directly would deliver one of the
        button's two promises and not the other, which is precisely the defect
        the browser run found on the button itself.
      */
      onIntent(intent);
    },
    [onIntent],
  );

  const selectedProvenance: LocationProvenance | undefined = undefined;

  /*
    ══ THE SHELL'S COUNTRY-NAME FALLBACK CHAIN, WRITTEN ONCE ════════════════

    MAP-DISPLAY-NAME-CENTRALISATION. Four places on this surface needed "the
    reader's name for this ISO-3", and all four had written their own version
    of it against the English-only registry.

    `localisedCountryName` supplies no fallback on purpose, so the chain is
    stated here — localised name, then the registry's English, then nothing —
    and each call site decides what "nothing" means for it. The rail falls back
    to the id because a title must render something; the city and region cards
    fall back to the ISO-3 they were given.
  */
  const countryNameFor = useCallback(
    (iso3: string): string | null =>
      localisedCountryName(iso3, language) ??
      COUNTRIES.find((country) => country.iso3 === iso3)?.name ??
      null,
    [language],
  );

  /*
    ── THE CARD SHOWS A NAME, NOT AN IDENTIFIER ─────────────────────────────

    Found by the browser run: selecting a country with no retained evidence
    produced a card headed "RWA". `selectedTotal` is undefined in exactly that
    case — there are no records to carry a display name — so the fallback was
    the raw selection id.

    That is worse than cosmetic on the surface where it happened. The
    no-evidence card is the one that has to read as a SENTENCE about a place;
    "RWA — no retained evidence for this area" reads as a system message about
    a key. The registry already holds the name, in the reader's language.
  */
  const selectionName =
    selectedTotal?.displayName ??
    (selection === null
      ? ''
      : /*
          A REGION'S NAME COMES FROM G, NOT FROM THE COUNTRY TABLE.

          Without this branch the chain fell through to `selection.id` and the
          rail read `region:eastern-africa` — the identifier as a title, which
          is the same defect the country fallback was written to fix, one
          namespace over. `region?.name` is the resolved node's own name; the
          id remains only while nothing has resolved, and the regional card
          renders that case as an identifier rather than as a name.
        */
        selection.kind === 'REGION'
        ? (region?.name ?? selection.id)
        : /*
            ══ THE NAME IS RESOLVED IN ONE PLACE — MAP-DISPLAY-NAME-CENTRALISATION

            This read `COUNTRIES.find(...)?.name`, and the comment above it
            claimed "the registry already holds the name, in the reader's
            language". IT DOES NOT. `COUNTRIES` is English-only — `name:
            'Kenya'`, `region: 'Africa'` — so a Polish reader met "Kenya" here,
            "Kenya" in the callout and "Kenya" beside a city, from four copies
            of this same line.

            `localisedCountryName` is now the one place that ISO-3 to
            reader-facing-name bridge is written. It applies NO fallback of its
            own, so this surface keeps the two it already had: the registry
            name, then the id for a code the registry does not hold.
          */
          (countryNameFor(selection.id) ?? selection.id));

  /*
    ══ THE SELECTION CALLOUT ════════════════════════════════════════════════

    Design's callout amendment. Three pieces of state, and only one of them is
    the callout's own:

      `calloutDismissed`  THE ONE PIECE THE AMENDMENT ALLOWS. Held here rather
                          than inside the component so it can be keyed to the
                          selection — a new selection is a new callout, and a
                          card dismissed for Rwanda must not stay dismissed when
                          the reader clicks Kenya.
      `calloutAnchorPx`   the projected pixel position the canvas reports. Not
                          business state: it is derived from the camera, and it
                          is re-derived on every frame.
      `calloutViewport`   the canvas region's own size, measured from the DOM.

    THE SELECTION ITSELF IS NOT DUPLICATED. `selection`, `selectedTotal`,
    `follow` and the three action handlers are the SAME values the right rail is
    given, a few lines below. That is what makes "a Follow action from the
    callout must update the right rail in the same frame, and vice versa" true
    by construction: there is one relationship object and one set of handlers,
    so there is nothing to keep in sync.
  */
  /*
    ══ PART IV — MONETIZATION SURFACE STATE ═══════════════════════════════

    ONE `drawer` VALUE, NOT FOUR BOOLEANS. §2.2 caps permanent rail content at
    one viewport and requires every new capability to REPLACE rail content or
    open OVER it — so at most one drawer may be open at a time, and a union
    makes two-at-once unrepresentable rather than merely discouraged.

    The composed chain, topics and sensitivity live here because the composer is
    a DRAWER: it unmounts on close, and state held inside it would lose the
    reader's work every time they glanced at the map. Nothing is persisted
    beyond this session — there is no watch service to persist to, and the
    composer says so on its own face.
  */
  const [surfaces, setSurfaces] = useState<OpenSurfaces>(NO_SURFACES);

  /*
    ONE OPENER, SO THE EXCLUSIVITY RULE CANNOT BE FORGOTTEN. §16.4: "Two
    surfaces of the same kind are never open at once." `openSurface` closes
    whatever else of that class was open, and `OpenSurfaces` is keyed BY CLASS,
    so two of a kind is unrepresentable rather than merely discouraged.
  */
  const open = useCallback(
    (surface: SurfaceId) => setSurfaces((was) => openSurface(was, surface)),
    [],
  );
  const close = useCallback(
    (surface: SurfaceId) => setSurfaces((was) => closeSurface(was, surface)),
    [],
  );
  const [watchTopics, setWatchTopics] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [watchSensitivity, setWatchSensitivity] = useState<WatchSensitivity>(DEFAULT_SENSITIVITY);

  const [calloutDismissedFor, setCalloutDismissedFor] = useState<string | null>(null);
  const [calloutAnchorPx, setCalloutAnchorPx] = useState<{ x: number; y: number } | null>(null);
  const [calloutViewport, setCalloutViewport] = useState({ width: 0, height: 0 });
  const canvasRegionRef = useRef<HTMLDivElement | null>(null);

  /*
    DESIGN'S BREAKPOINT, MEASURED RATHER THAN ASSUMED.

    "Visible at desktop widths >= 861px; suppressed below 861px." A media query
    rather than a Tailwind class because the placement maths must also stop
    running below the breakpoint — a class would hide the element and keep
    projecting an anchor for it on every camera frame.

    Starts FALSE and is set after mount, so server rendering never emits a
    callout whose visibility it cannot know.
  */
  const [wideEnoughForCallout, setWideEnoughForCallout] = useState(false);

  /*
    ══ WHAT THE PRODUCT CAN HONESTLY DO RIGHT NOW ═════════════════════════

    Read once, here, and handed to every monetization surface. `follow !== null`
    is the only signed-in signal this shell already holds — the accepted Follow
    relationship is present for an account and null for an anonymous reader —
    so no new auth surface is introduced and nothing in Auth is touched.

    `canActivate` is the literal `false`: no watch service, no entitlement
    service, no payment path. The surfaces render honest preview and sign-in
    states off this one value, and when a backend lands, `watchCapability`
    changes and they follow without learning anything new.
  */
  const capability = useMemo(() => watchCapability(follow !== null), [follow]);

  /*
    ══ PART IV §6.1a · THE CTA STAGE, DERIVED AND NEVER STORED ═════════════

    "A filled mint button against a name the user has not yet read is an ASK,
    not an offer." So prominence is a function of the READER'S attention, and
    deriving it means there is no "current stage" that something forgot to
    update.

    UNDERSTANDING SIGNALS THIS SHELL CAN HONESTLY OBSERVE: opening a source is
    one of §6.1a's five, and the rail already knows when it happens. The other
    four need surfaces that do not exist here yet — an Ask, a scroll observer on
    the assessment body, a dwell timer, and arrival from a watchboard entry — and
    inventing them would promote the control on evidence nobody gathered.

    Demotion does not occur within a session, which is why the set only grows.
  */
  const [understanding, setUnderstanding] = useState<ReadonlySet<UnderstandingSignal>>(
    () => new Set<UnderstandingSignal>(),
  );

  /**
   * WHETHER THE READER HAS AN OPEN ASSESSMENT IN FRONT OF THEM.
   *
   * One expression, used by both the Watch CTA ladder and the sand compute
   * control, because Part V gates them on the same fact and two spellings of one
   * condition is how they drift apart.
   */
  const assessmentIsOpen =
    selection !== null &&
    selection.kind !== 'REGION' &&
    selectionDetail !== undefined &&
    selectionDetail !== null;

  const watchStage = useMemo(
    () =>
      watchCtaStage({
        /*
          RSC-1 lists "Watch scoping to a region" among the things it does NOT
          settle, so a REGION selection is not a Watch subject and the ladder
          never starts. Not a disabled CTA — an absent one: a control the
          product cannot honour is not drawn. The regional card says so in
          words instead.
        */
        selected: selection !== null && selection.kind !== 'REGION',
        /*
          THE RAIL CARD IS THE OPENED STATE. A selection with detail behind it
          is a card the reader can read; a selection with only a callout is
          stage 2, recognisable but not yet opened.
        */
        cardOpen: assessmentIsOpen,
        signals: understanding,
      }),
    [selection, assessmentIsOpen, understanding],
  );

  /*
    THE COMPOSED CHAIN. One link today, because the map can name exactly one
    subject at a time and §6.2's longer chains need subject kinds — situations,
    issues, actors, routes — that no surface can currently produce. A second
    fabricated link would be an invented subject.
  */
  const watchChain = useMemo(
    () =>
      selection === null
        ? []
        : [
            {
              id: selection.id,
              kind: 'PLACE' as const,
              /* The name the rail already resolved — one source, not a second lookup. */
              label: selectionName,
              /*
                THE LEVEL COMES FROM THE SELECTION, NOT FROM A CONSTANT.

                The map can name a country today, so this resolves to COUNTRY —
                but it resolves rather than asserts. When G's navigator supplies
                deeper subjects (Rwanda's Sector, Kenya's Ward, an EU region) the
                selection carries its own level and this line already renders it.

                §6.2 keeps the ceiling PER LINK precisely so a later finer
                subject does not lift a coarser one beside it.
              */
              ceiling: selection.kind,
              /* Published, never parsed out of the opaque geography id. */
              countryIso3: selectedTotal?.countryIso3,
            },
          ],
    [selection, selectionName],
  );

  /*
    CHANGE STATES IN VIEW — AND THE TYPE IS `unknown` ON PURPOSE.

    No change-detection service exists, so this is empty and the strip renders
    nothing rather than a fabricated aggregate.

    When G's derivation lands it will produce its own honesty states —
    NO_BASELINE, EVIDENCE_UNAVAILABLE — alongside the seven display states, and
    those must never reach a chip or a ring. Typing this as `unknown` forces
    every value through `displayableChangeState`, so a pipeline state becomes NO
    MARK rather than a mark the reader would read as a fact about the world.

    FINAL CONNECTED-STATE WIRING WAITS FOR MAIN-CONVERGED G TYPES. This is
    presentation support: the gate exists and is proved, and nothing production
    is fabricated behind it.
  */
  const changeStates = useMemo<readonly unknown[]>(() => [], []);

  /* §10's action list, with its stated costs and tier locks. */
  const deckActions = useMemo<readonly DeckAction[]>(
    () => [
      { id: 'explain-change', cost: 1, tier: null },
      { id: 'summarise-30d', cost: 1, tier: null },
      { id: 'compare-regions', cost: 2, tier: null },
      { id: 'explain-watch', cost: 1, tier: null, requiresWatch: true },
      { id: 'what-next', cost: 1, tier: null },
      { id: 'business-impact', cost: 2, tier: 'PROFESSIONAL' },
      { id: 'humanitarian-impact', cost: 2, tier: 'PROFESSIONAL' },
      { id: 'cross-border', cost: 3, tier: 'INSTITUTIONAL' },
    ],
    [],
  );


  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${CALLOUT_MIN_VIEWPORT_WIDTH}px)`);
    const apply = (): void => setWideEnoughForCallout(query.matches);

    apply();
    query.addEventListener('change', apply);

    return () => query.removeEventListener('change', apply);
  }, []);

  /* The canvas region's box, which is the space the callout is placed inside. */
  useEffect(() => {
    const node = canvasRegionRef.current;

    if (node === null) return;

    const measure = (): void =>
      setCalloutViewport({ width: node.clientWidth, height: node.clientHeight });

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  /*
    ANCHORED TO A SELECTED GEOGRAPHY, AND A REGION HAS NONE.

    RSC-1 draws no regional highlight, and `selectionAnchorFor` resolves against
    country geometry — handed `region:eastern-africa` it finds nothing, and had
    it ever found something, a floating card over one arbitrary member country
    would read as "this IS the region". Refused by kind, not left to the lookup.
  */
  const calloutAnchor = useMemo(
    () =>
      selection === null || selection.kind === 'REGION'
        ? null
        : selectionAnchorFor(selection.id),
    [selection],
  );

  /*
    "Clearing selection dismisses it." Expressed as a KEY rather than as an
    effect that writes state: the dismissal is remembered against the geography
    it was made for, so changing or clearing the selection reveals the callout
    again without anything having to remember to reset a flag.
  */
  const calloutVisible =
    hud.rightRail &&
    wideEnoughForCallout &&
    selection !== null &&
    selection.kind !== 'REGION' &&
    calloutDismissedFor !== selection.id &&
    calloutViewport.width > 0;

  /*
    THE CARD'S REAL HEIGHT, MEASURED.

    `CALLOUT_MAX_HEIGHT` is a ceiling, not a size: a no-evidence country's
    callout is roughly half of it. Centring against the ceiling would push short
    cards visibly above their anchor, so the rendered box is observed and the
    ceiling is only the first-frame fallback.
  */
  const [calloutHeight, setCalloutHeight] = useState(CALLOUT_MAX_HEIGHT);

  const measureCallout = useCallback((node: HTMLElement | null) => {
    if (node === null) return;

    setCalloutHeight(node.getBoundingClientRect().height || CALLOUT_MAX_HEIGHT);
  }, []);

  const calloutPlacement = placeCallout(
    calloutAnchorPx,
    { width: CALLOUT_WIDTH, height: calloutHeight },
    calloutViewport,
  );

  /*
   * CONFLICT DOMAIN SELECTION SEMANTICS — COUNTRY/CITY IS SCOPE, NOT A
   * CONFLICT SUBJECT.
   *
   * The accepted Conflict contract says the attention queue is replaced only
   * by a SELECTED CONFLICT SUBJECT. Today the map has no ConflictObservation
   * event subject at all; a geographic country/city selection therefore cannot
   * satisfy that mount condition. The previous generic branch nevertheless
   * swapped in EvidenceSelectionCard, which is Country Intelligence and exposed
   * "Load Country Intelligence" under a Conflict URL. That was the measured
   * Alpha defect.
   *
   * A non-null specialist queue is the structural signal that this shell is
   * bound to Conflict. Until a real Conflict subject type exists, ordinary
   * geography selections keep the Conflict queue. REGION retains its dedicated
   * RegionIdentityCard because that card describes scope and makes no Country
   * Intelligence retrieval claim.
   */
  const keepSpecialistQueueForGeography =
    contextQueue !== null && selection !== null && selection.kind !== 'REGION';

  const rail = hud.rightRail ? (
    <IntelligenceRightRail label={spatial.railLabel}>
      {selection === null || keepSpecialistQueueForGeography ? (
        <ContextSummaryPanel
          mode={mode}
          period={period}
          totals={overall}
          ranked={totals}
          noEvidence={noEvidenceGeography}
          watch={watch}
          /*
            MAIN-CONFLICT-D1-DOMAIN-BIND-R1 §4 — "as today, receiving one prop".
            The panel already declares `queue`, already defaults it to `null`
            and already gates every specialist row behind `queue !== null`, so
            passing it here adds no branch and changes no layout.
          */
          queue={contextQueue}
          onSelectGeography={(geographyId) =>
            onSelectionChange?.({ kind: 'COUNTRY', id: geographyId })
          }
          /*
            PO GOLDEN-FRAME CORRECTION — JUMP TO VALIDATION STATE.

            The rail's jump block, its heading and its labels were all built
            and shipped; the shell simply never handed it any targets, so the
            section rendered nothing. This is the wiring, not a new feature.

            `validationStates()` is the four states the deployment is actually
            validated against, which is what the golden frame shows. The
            breadcrumb row keeps the full navigation set — the two controls
            answer different questions and now say so.
          */
          jumpTargets={validationStates()}
          onJump={onJump}
          labels={spatial.context}
        />
      ) : selection.kind === 'CITY' ? (
        /*
          THE CITY CARD — the reader's scope and the evidence ceiling, side by
          side. Placed BEFORE the region branch only because the kinds are
          disjoint and this reads in selection order; neither can shadow the
          other.
        */
        <CityIdentityCard
          city={city}
          geographyId={selection.id}
          /* One bridge, same as the rail title and the region card. */
          countryName={
            city?.countryIso3 ? (countryNameFor(city.countryIso3) ?? undefined) : undefined
          }
          /*
            ONE VOCABULARY FOR ONE PRECISION. The kind token beside the evidence
            country is the SAME string the search dropdown badges a country row
            with. Composed here rather than duplicated into `spatial.city`, so
            there is no second copy of the word to translate differently.
          */
          labels={{
            ...spatial.city,
            evidenceCeilingKindLabel: spatial.search.kinds.COUNTRY,
          }}
          onClearSelection={onSelectionChange ? () => onSelectionChange(null) : undefined}
        />
      ) : selection.kind === 'REGION' ? (
        /*
          RSC-1 STEP 5 — THE RAIL SWITCHES TO REGIONAL SCOPE.

          A separate card, not a configured `EvidenceSelectionCard`. That card's
          whole vocabulary — a total, a verification split, a follow
          relationship, a period — answers "what is retained HERE?", and a region
          has no honest answer to it. See `RegionIdentityCard`'s header for what
          the measured wrong version rendered.
        */
        <RegionIdentityCard
          /*
            MAP-PL-ACTIVE-REGION-LABEL-1 — THE NAME COMES FROM THE DICTIONARY.

            `region.name` is the DECLARATION's label, which is data in one
            language. For a governed product region the reader-facing name lives
            in the breadcrumb targets, already localised, and that is what is
            shown. A region G resolved keeps G's published name, which is the
            correct behaviour for a gazetteer node.
          */
          region={localisedGovernedRegion(
            region,
            selection.id,
            spatial.breadcrumbs.targets,
          )
          }
          geographyId={selection.id}
          /*
            THE EVIDENCE COUNTRY FOR A SUBNATIONAL REGION, resolved exactly as
            the city branch above resolves it — same registry, same fallback to
            the code when the registry does not hold it. One name, one place.
            `withinCountryIso3` is null for every supranational region, so this
            is `undefined` there and the card renders the regional wording.
          */
          withinCountryName={
            region?.withinCountryIso3
              ? (countryNameFor(region.withinCountryIso3) ?? region.withinCountryIso3)
              : undefined
          }
          labels={spatial.region}
          onClearSelection={onSelectionChange ? () => onSelectionChange(null) : undefined}
        />
      ) : (
        <EvidenceSelectionCard
          displayName={selectionName}
          total={selectedTotal}
          period={period}
          availableGeometry={availableGeometry}
          provenance={selectedProvenance}
          follow={follow}
          /*
            ── THE EXPLICIT COUNTRY READ, FORWARDED WHOLE ────────────────────

            This branch is the COUNTRY branch — CITY and REGION are handled
            above and `null` below — which is precisely the scope a country
            read is authorised for. Forwarding it here rather than at the top
            of the rail is what keeps a country action out of the city, region
            and no-selection cards without anyone having to remember to.

            The five data blocks are spread rather than named one by one
            because they ARE the card's own props, unchanged: this adds no new
            rendering vocabulary, it fills in blocks Design Revision 1.2
            already specified and the card already renders.
          */
          countryReadState={countryRead?.state}
          onLoadCountry={countryRead?.onLoad}
          providerStatus={countryRead?.providerStatus}
          coverage={countryRead?.coverage}
          categories={countryRead?.categories}
          items={countryRead?.items}
          topics={countryRead?.topics}
          /*
            PART IV — the Watch block. Supplied only where the rail renders, so
            the callout and every other consumer of this card is untouched.
          */
          /* WATCH RUNTIME GATE — omitted entirely rather than passed disabled.
             The rail's own comment already says this block is "supplied only
             where the rail renders", so withholding it is the mechanism the
             component was built for, and no disabled control is left behind
             for a reader to press. */
          watch={
            WATCH_RUNTIME_ACTIVE
              ? {
                  stage: watchStage,
                  labels: spatial.monetization.watch,
                  timelineLabels: spatial.monetization.timeline,
                  onOpenComposer: () => open('watchComposer'),
                  onOpenTimeline: () => open('assessmentTimeline'),
                  /* No transition-history service exists, so the strip counts nothing. */
                  timelineCount: 0,
                }
              : undefined
          }
          language={language}
          onFocus={onResetEvidence}
          onOpenAnalysis={onOpenAnalysis ? () => onOpenAnalysis(selection) : undefined}
          /*
            §6.1a — OPENING A SOURCE IS ONE OF THE FIVE UNDERSTANDING SIGNALS,
            and it is the one this shell can observe honestly today. Promotion
            is monotonic: the set only grows, because demotion does not occur
            within a session.
          */
          onOpenSources={
            onOpenSources
              ? () => {
                  setUnderstanding((was) => promote(was, 'SOURCE_OPENED'));
                  onOpenSources(selection);
                }
              : undefined
          }
          /*
            r1.4 block 12 - the selection tail. It reuses the shell's OWN clearing
            signal, the same `null` that `reset-world` and the region search commit
            already send, so there is one way to leave a selection and not three.
          */
          onClearSelection={onSelectionChange ? () => onSelectionChange(null) : undefined}
          onWidenPeriod={onPeriodChange ? () => onPeriodChange('30D') : undefined}
          {...(selectionDetail ?? {})}
          labels={spatial.card}
        />
      )}

      {railDetail && (
        <div data-gn="rail-detail" className="mt-3 border-t border-gn-line-structural pt-3">
          {railDetail}
        </div>
      )}
    </IntelligenceRightRail>
  ) : null;

  return (
    /*
      ══ THE DESIGN REFERENCE'S OWN GRID ══════════════════════════════════════

      The prototype declares it exactly once:

          grid-template-rows: 44px 1fr
          grid-template-columns: 52px 1fr 372px
          grid-template-areas: "top top top" / "rail map panel"

      Reproduced here rather than approximated. The consequences are the ones
      the CTO's ruling names: the LAYER/CONTROL HUD is a 52 px iconographic rail
      against the LEFT edge of the map; the CONTEXTUAL INTELLIGENCE rail is
      372 px on the RIGHT; and the map is the dominant surface between them,
      taking every pixel the two rails do not.

      Neither rail is a page column and neither is positioned over the canvas —
      they are grid areas, so no legacy container can move them and they cannot
      collide.
    */
    <section
      data-gn="global-map-shell"
      data-gn-density={density}
      data-gn-surface-density={surfaceDensity}
      data-gn-mode={mode}
      data-gn-period={period}
      /*
        RSC-1 — THE ACTIVE REGIONAL STATE, OBSERVABLE ON THE SHELL ITSELF.

        There is no regional highlight to look at (RSC-1 forbids one for every
        type, the EU included), so "active state" has to be carried somewhere a
        stylesheet and a probe can both read. These attributes are that place:
        absent when no region is selected, and never written from a label.

        `data-gn-evidence-scope` states the scope RSC-1 fixes at
        REGIONAL_NO_CLAIM — the value does not vary, and it is emitted anyway so
        that the surface asserts its scope rather than leaving it inferred.
      */
      data-gn-region={selection?.kind === 'REGION' ? selection.id : undefined}
      data-gn-region-type={selection?.kind === 'REGION' ? (region?.regionType ?? 'UNRESOLVED') : undefined}
      data-gn-evidence-scope={selection?.kind === 'REGION' ? REGIONAL_EVIDENCE_SCOPE : undefined}
      aria-label={shell.regionLabel}
      className="grid h-full w-full overflow-hidden bg-sp-bg text-sp-ink"
      style={{
        gridTemplateRows: hud.modeSwitcher || hud.search ? '44px 1fr' : '1fr',
        gridTemplateColumns: `${hud.layerRail ? '52px ' : ''}1fr${hud.rightRail ? ' 372px' : ''}`,
      }}
      onKeyDown={onKeyDown}
    >
      {(hud.modeSwitcher || hud.search || hud.periodChips) && (
        <div className="col-span-full">
          <MapHudTopBar
            labels={spatial.topBar}
            /*
              CHECKPOINT F — the map's EN/PL control.

              Persistence is THE SAME ONE PATH the NavBar uses:
              persistLanguageSelection() writes the cookie this route's Server
              Component already reads, and router.refresh() re-renders against
              it. No second mechanism, and no language state held here — the
              cookie remains the single source of truth.
            */
            languageSlot={
              <MapLanguageControl
                value={language}
                label={spatial.topBar.languageGroup}
                onChange={(next) => {
                  persistLanguageSelection(next);
                  router.refresh();
                }}
              />
            }
            period={period}
            onPeriodChange={(next) => onPeriodChange?.(next)}
            showPeriodChips={hud.periodChips}
            modeSlot={
              hud.modeSwitcher ? (
                <ModeSwitcher
                  active={mode}
                  onModeChange={(next) => onModeChange?.(next)}
                  pinnedReason={pinnedModeReason}
                  labels={spatial.modes}
                />
              ) : undefined
            }
            searchSlot={
              hud.search ? (
                <PlaceSearch
                  totals={totals}
                  onSelectResult={onSelectSearchResult}
                  labels={spatial.search}
                  regionNames={spatial.breadcrumbs.targets}
                />
              ) : undefined
            }
          />
        </div>
      )}

      {/*
        ── LEFT: THE CONTROL / LAYER HUD ─────────────────────────────────────
        52 px, iconographic, against the map's left edge. Owns overlay and
        map-display functions only — evidence, sources, watch, situations,
        water, labels, grid — and never contextual intelligence, which is the
        right rail's job.
      */}
      {hud.layerRail && (
        <div
          data-gn="map-layer-rail-column"
          className="z-30 flex h-full w-[52px] flex-col items-center gap-[4px] overflow-y-auto border-r border-sp-line bg-sp-rail py-[10px]"
        >
          <LayerToggleRail
            mode={mode}
            zoom={session.camera.zoom}
            state={layers}
            onToggle={onToggleLayer}
            labels={spatial.layers}
            orientation="vertical"
            /*
              PART IV §14.5 — the fifth icon. `unread` is 0 because no alert
              service exists: a fabricated count would be an invented delivery,
              and §8.3's 9+ cap has nothing to cap yet.
            */
            /* WATCH RUNTIME GATE — the fifth icon is withheld, not greyed. */
            watchboard={
              WATCH_RUNTIME_ACTIVE
                ? {
                    label: spatial.monetization.watchboard.title,
                    unread: 0,
                    onOpen: () => open('watchboard'),
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* ── CENTRE: THE MAP, DOMINANT ──────────────────────────────────────── */}
      <div
        ref={canvasRegionRef}
        data-gn="map-canvas-region"
        className="relative min-w-0 overflow-hidden bg-sp-ocean"
      >
        <EvidenceMapCanvas
          camera={session.camera}
          origin={session.origin}
          onGesture={onGesture}
          density={density}
          ariaLabel={shell.canvasLabel}
          interactionHint={shell.interactionHint}
          countryStoryCounts={countryStoryCounts}
          selectedIso3={selectedIso3}
          noEvidenceGeography={noEvidenceGeography}
          onHoverCountry={onHoverCountry}
          onSelectCountry={onSelectCountry}
          onMinZoomChange={setEngineMinZoom}
          fitBounds={pendingBounds}
          onBoundsResolved={onBoundsResolved}
          evidenceRecords={records}
          layers={layers}
          watch={watch}
          interactive={hud.interactive}
          capturesWheel={hud.capturesWheel}
          language={language}
          labelNames={{ continents: spatial.continents, waters: spatial.waters, territories: spatial.territories }}
          calloutAnchor={calloutVisible ? calloutAnchor : null}
          onCalloutAnchorChange={setCalloutAnchorPx}
        />

        {/*
          ── D1 §3d · THE LOWER-LEFT CONTROL CLUSTER ────────────────────────

          "The lower-left cluster carries the globe locator …, then Layers and
          3D as separate controls. The globe locator is not the 3D toggle …
          Zoom and layer-visibility controls stay top-right."

          It is mounted INSIDE the canvas region, which is `relative`, so the
          cluster is positioned against the map itself rather than against a
          container that includes either rail — the same reasoning the selection
          callout below already follows.

          `MapControlCluster` reads the ORDER from `LOWER_LEFT_CLUSTER` rather
          than restating it, so the contract and the composition cannot drift.

          THE 3D CONTROL'S AVAILABILITY IS DERIVED, NOT ASSUMED. Ruling 3 allows
          a halo over a topographic underlay, so 3D is legitimate — but there is
          nothing to render in three dimensions without a terrain source, and
          the basemap boundary is the one place that knows whether a provider is
          configured. With none configured the control is UNAVAILABLE with that
          reason attached, which is a different statement from OFF.
        */}
        {/*
          ── R3 · THE HUD PROFILE IS AUTHORITATIVE IN THE DOM, NOT ONLY IN
          THE TABLE ───────────────────────────────────────────────────────

          This cluster mounted UNCONDITIONALLY. `mapState.ts` says surfaces
          "declare a density and an evidence scope, and the shell DERIVES
          the HUD" — but two mounts in this file were never asked. The
          consequence was measured in the Analysis EMBED: a Globe/Layers/3D
          cluster and a zoom stack rendered inside a 263px rail, colliding
          with the attribution and with each other, and every one of them
          dead because EMBED is `interactive: false`.

          `hud.interactive` IS THE RIGHT QUESTION, and it is minimal:
          this cluster is a set of CONTROLS, and a surface that declares
          itself non-interactive has no business rendering one. Only MINI
          and EMBED declare `interactive: false`; PANEL, FULL and MODAL are
          all `true`, so their DOM is unchanged — FULL included, which is
          why this is a gate rather than a redesign.
        */}
        {/*
          ══ THE LOWER-LEFT CORNER IS ONE COLUMN — MAP-LAYERS-EVIDENCE-GRAMMAR-
             COLLISION-1 ══════════════════════════════════════════════════════

          It used to be three islands pinned to the same bottom edge at 16px,
          104px and 128px, each growing upward. The layers panel is taller than
          112px, so it grew through the scale bar and the legend, and the
          legend's z-20 drew over it — which is the collision the live
          inspection reported.

          `flex-col-reverse` keeps the SHIPPED visual order exactly: the
          control cluster stays nearest the bottom edge, the scale bar sits
          above it, the legend above that. Nothing is re-ordered, nothing moves
          corner, and the panels can no longer overlap because they are now
          siblings in a flow rather than three things racing the same edge.

          ONE DELIBERATE 4px CHANGE, DECLARED: the legend and scale bar were
          inset `left-[12px]` while the cluster was `left-4` (16px). A single
          column has one inset, and 16px is the one that keeps the cluster where
          it has always been.

          `items-start` so a narrow panel does not stretch, and
          `max-h`/`overflow-y-auto` so the column can never run off the top of a
          short viewport — which is what keeps compact viable and keeps the map
          visible behind it.
        */}
        <div
          data-gn="map-lower-left-stack"
          data-gn-hud-reserve
          className={`${HUD_ISLAND} absolute bottom-4 left-4 z-20 flex max-h-[calc(100%-96px)] flex-col-reverse items-start gap-2 overflow-y-auto`}
        >
        {hud.interactive && (
        <MapControlCluster
          positioned={false}
          label={shell.lowerLeftControlsLabel}
          globeLocator={
            <GlobeLocator
              bounds={boundsFromCamera(
                session.camera.center,
                session.camera.zoom,
                /* The SAME measured region the callout is projected into —
                   `calloutViewport` is the canvas region's own clientWidth /
                   clientHeight, kept current by a ResizeObserver above. Reusing
                   it means the locator and the callout can never disagree about
                   how big the map is. */
                calloutViewport.width,
                calloutViewport.height,
              )}
              label={shell.globeLocator}
              homeLabel={shell.goGlobal}
              onGoGlobal={() => onIntent({ kind: 'reset-world' })}
            />
          }
          layers={
            <LayersControl
              state={layers}
              /*
                ══ THE MISSING RENDER CONNECTION — MAP-GRID-CONTROL-1 AND
                   MAP-COUNTRY-EVIDENCE-LAYER-TOGGLE-1, ONE CAUSE ═══════════

                MEASURED LIVE: SIATKA WSPÓŁRZĘDNYCH did nothing, and DOWODY
                KRAJOWE stayed OFF however many times it was clicked.

                `LayersControl.onToggle` is OPTIONAL, and this call site never
                passed it. The component then renders
                `onClick={live && onToggle ? … : undefined}` — so every LIVE row
                in this panel was an enabled-looking button, carrying
                `aria-pressed`, wired to nothing. Not a disabled control and not
                a gated capability: an interactive-looking control with no
                handler, which is exactly the "dead handler / missing render
                connection" case the ruling asks to be told apart from a genuine
                dependency.

                IT IS NOT DUPLICATE STATE, AND THAT SHAPES THE FIX. There has
                only ever been ONE layer state — `layers`, held here and already
                passed to this panel for display. The left rail has always
                written to it through `onToggleLayer`. The panel could read and
                could not write. Passing the SAME callback is what makes the two
                controls one canonical state rather than two kept in step.

                THE CAPABILITIES ARE REAL, so nothing here is faked. `graticule`
                is generated client-side with no dataset and no request;
                `countryEvidence` is backed by `/geo/map-feed`. Layers that are
                NOT built stay disabled by `live` and keep their status badge.
              */
              onToggle={onToggleLayer}
              /* R2-B §8 — so the GRID row can say when it is out of scale. */
              zoom={session.camera.zoom}
              labels={{
                title: shell.layersTitle,
                layers: spatial.layers.layers,
                outOfScale: shell.layerOutOfScale,
                status: {
                  LIVE: shell.layerStatusLive,
                  GATED: shell.layerStatusGated,
                  NOT_IMPLEMENTED: shell.layerStatusNotImplemented,
                  FAILED_MEASUREMENT: shell.layerStatusUnmeasured,
                },
              }}
            />
          }
          threeD={
            <ThreeDControl
              enabled={false}
              available={readBasemapConfiguration().styleUrl !== null}
              unavailableReason={shell.threeDUnavailable}
              label={shell.threeD}
            />
          }
        />
        )}

        {/*
          THE SCALE BAR AND THE LEGEND JOIN THE SAME COLUMN.

          They are written AFTER the cluster in source order and `flex-col-reverse`
          renders them ABOVE it, which is exactly where they have always been
          drawn. Their own `absolute bottom-[104px] / bottom-[128px] left-[12px]`
          anchors are gone: a flow needs no anchors, and those two numbers were
          the collision.
        */}
        {hud.scaleBar && (
          <div data-gn="map-scale-island">
            <MapScaleBar camera={session.camera} />
          </div>
        )}

        {hud.legend && (
          <div data-gn="map-legend-island">
            <EvidenceLegend labels={spatial.legend} open={legendOpen} onToggle={setLegendOpen} />
          </div>
        )}
        </div>

        {/*
          THE SELECTION CALLOUT — inside the canvas region, so it is placed in
          the same pixel space the anchor is projected into and can never be
          positioned relative to a container that includes either rail.
        */}
        {calloutVisible && selection !== null && (
          <SelectionCallout
            geographyId={selection.id}
            displayName={selectionName}
            identity={selectionDetail?.identity}
            /*
              ══ A COMPACT ANCHOR, NOT A SECOND ACTION SURFACE ══════════════

              R2-B §5. The rail beside this is presenting the SAME selected
              geography — that is not a coincidence here, it is the render
              condition: `calloutVisible` requires `hud.rightRail`, and the
              rail renders whatever `selection` holds. So the ruling's
              condition is always met and the anchor is always compact.

              WHAT IS NO LONGER PASSED IS THE POINT. No `total`, no
              `providerStatus`, no `coverage`, no `follow`, and none of the
              three action handlers. The rail keeps every one of them and
              remains the authoritative detailed/action surface; the anchor
              cannot render an action it is not given a handler for, and cannot
              be given one without this call changing.
            */
            continents={spatial.card.continents}
            placement={calloutPlacement}
            measureRef={measureCallout}
            calloutLabels={spatial.callout}
            /*
              SELECTION-LOCAL DISMISSAL. One key, not a preference: closing the
              anchor hides it for THIS geography, and selecting another shows
              that one's. Nothing is persisted and no settings contract exists.
            */
            onDismiss={() => setCalloutDismissedFor(selection.id)}
          />
        )}

        {/*
          MAP HUD CHROME — absolutely positioned against the CANVAS, at the
          reference's own offsets. Each element is its own island so the gaps
          between them stay draggable map.

          ── PO-3 — WHY THESE ISLANDS ARE `pointer-events-none` ──────────────

          They used to be `pointer-events-auto`, which reads correctly until you
          measure the boxes. An island is a POSITIONING BOX: it is sized by its
          layout, not by the ink inside it. Sampling every 8px across the canvas
          at 1440x900 measured 19% OF THE MAP SURFACE — about 162,000 px² —
          taking the click instead of the map, nearly all of it fully
          transparent:

            top-left island   823x58  around a 494x58 breadcrumb  (18,931 px²)
            bottom-right      300x210 around a 125x171 control set (41,763 px²)
            readout           127x48  whose CONTENT already declares
                              pointer-events:none, defeated by its own wrapper
            scale bar         191x14  the same

          A user dragging the map through that region gets nothing, and a click
          meant for a country lands on a transparent div. That is the reported
          "controls not responding reliably" — the controls were fine; the
          space around them was eating the input.

          `HUD_ISLAND` therefore makes each box transparent to the pointer and
          re-arms only what is actually operable: buttons, links and form
          controls. Nothing moves, nothing is restyled, every control keeps its
          own hit area, and static chrome — the readout, the scale bar, the
          precision banner's prose — stops standing between the reader and the
          map. `data-gn-hud-reserve` is untouched: the label placer still reads
          these rectangles to keep country labels out from under the HUD.
        */}
        {/*
          ══ THE TOP ROW IS TWO ISLANDS THAT MUST NOT MEET ═══════════════════

          MAP-UPPER-LEFT-OVERLAP. The trail capped itself at 60% of the canvas
          and the stack opposite caps at 46%. Nothing reconciled the two, and
          106% does not fit in 100%:

              FULL at a 1440 viewport   52px layer rail + 372px right rail
                                        leaves a 1016px CANVAS
              trail, at its cap         610px
              stack, at its cap         467px
              gutters                    24px
              required                 1101px      OVERLAP 85px

          It is worse in Polish, where the jump targets are longer words, and
          it is worse again on a compact viewport, because BOTH caps are
          percentages and shrink together while the chips inside them do not.

          THE FIX IS TO MAKE THE TWO CAPS COMPLEMENTARY RATHER THAN TO SHRINK
          ONE. 54% and 46% are the whole canvas, so each cap subtracts half of
          the 36px that the two gutters and a 12px separation need:

              left   calc(54% - 18px)
              right  calc(46% - 18px)
              sum    100% - 36px, inside a 100% - 24px box

          That leaves a 12px gap AT EVERY WIDTH rather than at the one width
          someone checked, which is what makes it a fix and not a tuning.

          THE TRAIL WRAPS INTO THE SPACE IT HAS. It has always been
          `flex-wrap`; it simply never had a boundary to wrap against. Chips
          are `whitespace-nowrap` individually, so a narrow canvas produces
          more rows rather than a broken word.
        */}
        {hud.breadcrumbs && (
          <div
            data-gn-hud-reserve
            data-gn="map-upper-left-island"
            className={`${HUD_ISLAND} absolute left-[12px] top-[12px] z-20 max-w-[calc(54%-18px)]`}
          >
            <BreadcrumbZoomNavigator
              camera={session.camera}
              scope={ladderScope}
              onJump={onJump}
              labels={spatial.breadcrumbs}
            />
          </div>
        )}

        {/*
          ── PART IV §7 · THE CHANGE STRIP ──────────────────────────────────

          "Top of the map canvas, BESIDE THE BREADCRUMB TRAIL, right-aligned."
          It shares the breadcrumbs' row and is right-aligned within the space
          the trail leaves, which is why it is a separate absolutely-positioned
          island rather than a child of the trail: the trail wraps, and a strip
          inside it would wrap with it. §2.2 requires this line never to become
          two.

          It is inside a `data-gn-hud-reserve` island so the label placer keeps
          country names out from under it, and it carries no pointer events of
          its own — a readout that swallowed a drag would be the PO-3 defect
          returning by another route.
        */}
        {/*
          ── ONE TOP-RIGHT STACK, BECAUSE I PUT TWO ISLANDS IN ONE SLOT ──────

          MEASURED IN THE BROWSER at 1440x900: the change strip and the map
          readout were BOTH `absolute right-[12px] top-[12px]`, and overlapped by
          120 x 13 px — "Rings hidden at this scale" printed through "Z 1.1".

          Mine. The R2 tranche added the change-strip island into a corner the
          v1.7 readout already occupied, and two absolutely-positioned boxes at
          identical coordinates cannot avoid each other however their contents
          change.

          They are now ONE island that FLOWS: the strip keeps the top of the
          corner, as §2.2 requires of the line that shares the breadcrumb row,
          and the readout sits beneath it. Flow, not a second offset, is the
          fix — an offset would have to be recomputed every time either box
          changed height, and the strip's height depends on its content.

          The strip keeps its own `pointer-events-none`: a readout that swallowed
          a drag is the PO-3 defect by another route. `hud.readout` still gates
          the readout, so a density that shows no readout renders the strip alone
          and the stack simply has one child.
        */}
        {/*
          ── R3 · THE THIRD UNCONDITIONAL MOUNT, FOUND BY MEASURING ────────

          Not in the CTO's R2 list, because R2's 52px box was too small to
          show it. Measured in the rendered EMBED at 263x104: this island
          printed "Rings hidden at this scale" at x=130 in a 261px box, so
          it both leaked HUD text into a non-interactive surface AND ran
          155px wide from x=130 — past the right edge of the map itself.

          THE GATE IS `hud.interactive`, NOT `hud.readout`. `hud.readout`
          would have been the narrower-looking answer and it is the wrong
          one: PANEL declares `readout: false`, so gating on it would strip
          the change strip from PANEL too, which is a surface this round is
          not authorised to touch. `interactive` is true for PANEL, FULL and
          MODAL and false for MINI and EMBED — the same partition the two
          corrections above use, so this removes the island from exactly the
          two densities that declare themselves pictures and from no other.
          `hud.readout` still gates the readout INSIDE it, unchanged.

          It belongs behind that gate on its own terms as well: the strip
          reports what the CURRENT ZOOM is hiding, which is a sentence only
          a reader who can zoom can act on.
        */}
        {hud.interactive && (
        <div
          data-gn-hud-reserve
          data-gn="map-upper-right-stack"
          /*
            THE OTHER HALF OF THE PAIR — see the upper-left island's comment.
            46% was already the intent; the `- 18px` is this island's share of
            the two gutters plus the 12px separation, so the two caps can be
            added up and shown to fit.
          */
          className={`${HUD_ISLAND} absolute right-[12px] top-[12px] z-20 flex max-w-[calc(46%-18px)] flex-col items-end gap-[6px]`}
        >
          <div className="pointer-events-none w-full">
            <ChangeStrip
              states={changeStates}
              zoom={session.camera.zoom}
              labels={spatial.monetization.changeStrip}
            />
          </div>

          {hud.readout && (
            <MapReadout camera={session.camera} mode={mode} period={period} labels={spatial.readout} />
          )}
        </div>
        )}

        

        {/*
          ── R3 · TWO BOTTOM ISLANDS CANNOT SHARE A 261px ROW ───────────────

          MEASURED in the rendered EMBED at 263x104: the banner occupied
          x 13..262 / y 24..91 and the attribution x 1..250 / y 46..91 — an
          overlap of 10,665px², with the licence text printed through the
          trust statement. The CTO's R2 list requires "no overlapping
          attribution/HUD text", and this is why it happened: the banner is
          bottom-LEFT and the attribution bottom-RIGHT, each about 249px
          wide, in a map 261px wide. At that width the corners are the same
          corner, and no amount of re-offsetting separates them.

          THE FIX IS FLOW, NOT A NEW OFFSET — the same correction the
          top-right island already carries a note about. Where the surface
          is non-interactive the bottom HUD is ONE COLUMN: trust statement,
          then licence line beneath it. Two boxes in a flex column cannot
          overlap at any width or in any language, so this does not have to
          be re-measured for Polish, and it cannot regress when a label
          changes length.

          INTERACTIVE DENSITIES ARE NOT TOUCHED. PANEL, FULL and MODAL keep
          the bottom-right island with the deck, the camera controls and the
          attribution exactly where they were — those surfaces are wide
          enough for two corners to be two corners.
        */}
        {(hud.precisionBanner || !hud.interactive) && (
          <div
            data-gn-hud-reserve
            className={`${HUD_ISLAND} absolute bottom-[12px] left-[12px] z-20 ${
              hud.interactive ? '' : 'right-[12px] flex flex-col items-start gap-[6px]'
            }`}
          >
            {hud.precisionBanner && (
            <PrecisionBanner
              precision={selectedTotal?.finestPrecision}
              provenance={selectedProvenance}
              zoom={session.camera.zoom}
              availableGeometry={availableGeometry}
              drawnCoarser={
                selectedTotal !== undefined &&
                isFinerThan(selectedTotal.finestPrecision, availableGeometry)
              }
              labels={spatial.banner}
            />
            )}
            {/*
              R3 · THE LICENCE LINE, IN THE COLUMN RATHER THAN THE OPPOSITE
              CORNER. Same element, same text, same CC BY 4.0 obligation —
              only its parent differs, and only where the surface is a
              picture. It keeps `text-left` here because a right-aligned
              line under a left-aligned banner reads as a second island
              again.
            */}
            {!hud.interactive && (
              <p
                data-gn="map-attribution"
                className="pointer-events-none max-w-full text-left font-gn-mono text-[8px] leading-[1.4] text-sp-ink-3/70"
              >
                {spatial.attribution}
              </p>
            )}
          </div>
        )}

        {/*
          ── PART IV §10 · THE ACTION DECK ──────────────────────────────────

          "Bottom-right of the map", collapsed, opening on click and never on
          hover. It sits ABOVE the camera controls in the same corner column so
          the two never compete for the same pixels, and it is the only place in
          the product carrying sand — normal navigation, selection, hover and
          the intelligence card spend nothing and must never carry it.
        */}
        {/*
          ── §16A · THE WATCHBOARD OPENS FROM THE LEFT RAIL, OVER THE MAP ───

          CORRECTED FROM MY v1.1 BUILD, where it opened over the RIGHT rail. The
          §16A desktop column is explicit: "drawer over the map FROM THE LEFT
          RAIL", and the trigger is the left rail's own icon.

          The direction is not decoration. The right rail is about the SELECTED
          SUBJECT; the watchboard is about every subject the reader monitors, and
          opening it over the selection would replace the thing it is not about
          while hiding the thing it is. Opening from the left — the map-control
          side — leaves the selected subject in place beside it.

          It is REPLACEMENT class, so opening it closes any other REPLACEMENT
          surface, and the map stays live and pannable to its right.
        */}
        {WATCH_RUNTIME_ACTIVE && isOpen(surfaces, 'watchboard') && (
          <div
            data-gn="watchboard-drawer"
            data-gn-surface-class="REPLACEMENT"
            role="dialog"
            aria-modal="false"
            aria-label={spatial.monetization.watchboard.title}
            className="absolute inset-y-0 left-0 z-30 flex w-[340px] max-w-[86%] flex-col border-r border-sp-line-2 bg-sp-panel"
          >
            <header className="flex shrink-0 items-center justify-between gap-[10px] border-b border-sp-line px-[14px] py-[11px]">
              <h2 className="font-gn-mono text-[10px] uppercase tracking-[0.16em] text-sp-ink-2">
                {spatial.monetization.watchboard.title}
              </h2>
              <button
                type="button"
                data-gn="watchboard-close"
                aria-label={spatial.monetization.drawerClose}
                onClick={() => close('watchboard')}
                className="flex h-[28px] w-[28px] items-center justify-center rounded-[2px] border border-sp-line-2 font-gn-mono text-[12px] leading-none text-sp-ui-idle outline-none transition-colors hover:border-sp-cyan/45 hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-sp-cyan"
              >
                ×
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[14px] py-[12px]">
              <Watchboard
                entries={[]}
                capability={capability}
                labels={spatial.monetization.watchboard}
                onSelectSubject={undefined}
              />
            </div>
          </div>
        )}

        <div
          data-gn-hud-reserve
          className={`${HUD_ISLAND} absolute bottom-[12px] right-[12px] z-20 flex flex-col items-end gap-[6px]`}
        >
          {/*
            ── NO SAND BEFORE A SELECTION — Part V §07.1, MEASURED AND WRONG ───

            §07.1, on the no-selection frame, verbatim: "There is not one sand
            compute control on this frame apart from the account quota readout.
            Arriving, filtering and reading cost nothing. SAND APPEARS ONLY AFTER
            AN OBJECT IS SELECTED and only on explicit compute." §07.2 tightens
            it further: "DEEP ANALYSIS APPEARS ONLY AFTER THE USER HAS READ THE
            ASSESSMENT."

            MEASURED IN THE BROWSER: the sand `Deep analysis` toggle rendered
            ENABLED on the world view with `selection === null`, and opened the
            deck. Mine, from the R2 tranche — the deck was placed in the
            bottom-right island unconditionally.

            Gated here on the SAME `cardOpen` notion the Watch CTA ladder already
            uses, rather than on a second bespoke condition: a selection whose
            card is actually open is an object the reader can have read. That
            satisfies §07.1 exactly and is a strict subset of §07.2 — if Design
            wants the stricter "assessment read" gate, the `understanding` set is
            already computed above and this becomes a one-line change.
          */}
          {assessmentIsOpen && (
            <ActionDeck
              actions={deckActions}
              labels={spatial.monetization.deck}
              hasWatch={false}
            />
          )}
          {/*
            ── R3 · SAME CORRECTION, SAME REASONING ────────────────────────

            This stack is zoom in/out, Previous view, Reset evidence and
            Reset world. EMBED declares all four false and this mounted
            them anyway; the file was already consulting the profile one
            line down (`hud.resetEvidence ? … : undefined`), so the shape
            of the answer was here — it just had not been asked of the
            mount.

            THE CONDITION IS EXACT RATHER THAN APPROXIMATE. Across the five
            densities these four flags move together: MINI and EMBED have
            all four false, PANEL, FULL and MODAL have all four true. So
            "mount when any is enabled" mounts precisely the same component
            for every density that had it before — FULL's DOM is untouched
            — and removes it only where nothing inside it was ever live.
          */}
          {(hud.zoomControls || hud.resetWorld || hud.resetEvidence || hud.previousView) && (
          <MapCameraControls
            availability={availability}
            onIntent={onIntent}
            onResetEvidence={hud.resetEvidence ? onResetEvidence : undefined}
            canResetEvidence={evidenceBounds !== null}
            labels={{
              group: shell.controlsLabel,
              resetWorld: shell.resetWorld,
              resetEvidence: spatial.resetEvidence,
              previousView: shell.previousView,
              zoomIn: shell.zoomIn,
              zoomOut: shell.zoomOut,
            }}
          />
          )}
          {/*
            ATTRIBUTION IS A LICENCE OBLIGATION, NOT A NICETY. G's §8: GeoNames
            is CC BY 4.0, which REQUIRES attribution wherever the data is
            presented. Diagnostic register, permanent, not dismissible.

            R3 · STILL UNCONDITIONAL AS AN OBLIGATION, RELOCATED AS A BOX.
            The condition here is not "whether to attribute" — it is "which
            island this surface's attribution lives in". Non-interactive
            densities render the identical element inside the bottom-left
            HUD column above, which is the only arrangement that fits a
            261px map. Exactly one `map-attribution` renders at every
            density, and a spec asserts that.
          */}
          {hud.interactive && (
          <p
            data-gn="map-attribution"
            className="pointer-events-none max-w-[300px] text-right font-gn-mono text-[8px] leading-[1.4] text-sp-ink-3/70"
          >
            {spatial.attribution}
          </p>
          )}
        </div>

        {children}
      </div>

      {/*
        ── RIGHT: THE CONTEXTUAL INTELLIGENCE RAIL ───────────────────────────
        372 px, full height, scrolling independently of the map. Contextual
        intelligence only — evidence geography, counts, precision and
        provenance, watch STATUS and the follow ACTION, retained reporting and
        the record's actions. No map-display controls: those are the left rail's.
      */}
      {rail && (
        /*
          ── THE RAIL, AND THE DRAWER THAT COVERS IT ────────────────────────

          `relative` is new and is what makes §2.2 structural: the drawer is
          `absolute inset-0` inside this box, so it occupies EXACTLY the rail's
          372 px and can never widen the column, overlap the map or become a
          modal. The rail itself stays mounted underneath — closing a drawer is
          a genuine return to a card that kept its scroll position and its
          state, not a rebuild.
        */
        <div
          data-gn="map-rail-holder"
          className="relative z-30 flex h-full w-[372px] flex-col overflow-y-auto border-l border-sp-line bg-sp-panel"
        >
          {rail}

          {/*
            ── PART IV §2.2 · SUSTAINED SURFACES OPEN OVER THE RAIL ─────────

            Composer, activation, watchboard and timeline are all MINUTES-long
            tasks where the reader needs the map beside them, so all four use
            the drawer container rather than the popup or the workspace. At most
            one is open at a time — the `drawer` union makes two unrepresentable
            — and none of them lengthens the column.
          */}
          <RailDrawer
            /* WATCH RUNTIME GATE — cannot open while no Watch runtime serves it. */
            open={WATCH_RUNTIME_ACTIVE && isOpen(surfaces, 'watchComposer')}
            surface="composer"
            title={spatial.monetization.composer.title}
            closeLabel={spatial.monetization.drawerClose}
            onClose={() => setSurfaces(NO_SURFACES)}
          >
            <WatchComposer
              chain={watchChain}
              capability={capability}
              labels={spatial.monetization.composer}
              topics={WATCH_TOPICS}
              selectedTopics={watchTopics}
              onToggleTopic={(topic) =>
                setWatchTopics((was) => {
                  const next = new Set(was);

                  if (next.has(topic)) next.delete(topic);
                  else next.add(topic);

                  return next;
                })
              }
              onRemoveLink={() => onSelectionChange?.(null)}
              onReview={(sensitivity) => {
                setWatchSensitivity(sensitivity);
                open('activation');
              }}
            />
          </RailDrawer>

          <RailDrawer
            open={isOpen(surfaces, 'activation')}
            surface="activation"
            title={spatial.monetization.activation.title}
            closeLabel={spatial.monetization.drawerClose}
            onClose={() => setSurfaces(NO_SURFACES)}
          >
            <ActivationPanel
              chain={watchChain}
              sensitivity={watchSensitivity}
              sensitivityLabel={spatial.monetization.composer.sensitivities[watchSensitivity]}
              capability={capability}
              labels={spatial.monetization.activation}
              signInHref={accountSignInUrl(FOLLOW_RETURN_DESTINATION)}
              /* CHECKPOINT I — the state stays in the browser; see signInReturnState.ts. */
              onSignIn={() => rememberMapStateForSignIn(window.location.search)}
              /*
                THE ONE THING ON THAT PANEL THAT WORKS. Follow is shipped and
                free; it is offered only when the account actually holds the
                relationship, so the button never appears where pressing it
                would do nothing.
              */
              onFollowInstead={
                follow === null ? undefined : () => {
                  follow.onFollow(follow.countryIso3);
                  setSurfaces(NO_SURFACES);
                }
              }
              onDismiss={() => close('activation')}
            />
          </RailDrawer>

          <RailDrawer
            open={isOpen(surfaces, 'assessmentTimeline')}
            surface="timeline"
            title={spatial.monetization.timeline.title}
            closeLabel={spatial.monetization.drawerClose}
            onClose={() => setSurfaces(NO_SURFACES)}
          >
            <AssessmentTimeline
              entries={[]}
              withheldCount={0}
              capability={capability}
              labels={spatial.monetization.timeline}
              /* §16A desktop: oldest-first, so the arc reads as a narrative. */
              order="OLDEST_FIRST"
            />
          </RailDrawer>
        </div>
      )}
    </section>
  );
}
