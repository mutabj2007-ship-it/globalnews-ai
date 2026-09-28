'use client';

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { EvidenceMapCanvas } from '@/components/map/shell/EvidenceMapCanvas';
import { SourceCard } from '@/components/map/shell/SourceCard';
import { FollowControl } from '@/components/map/shell/FollowControl';
import type { CountryFeature } from '@/lib/map/countryGeometry';
import type { SelectionDetail } from '@/components/map/shell/GlobalMapShell';
import type { FollowRelationship } from '@/components/map/shell/EvidenceSelectionCard';
import {
  cameraAvailability,
  cameraReducer,
  initialCameraSession,
  type CameraIntent,
} from '@/lib/map/camera/cameraIntents';
import type { CameraState } from '@/lib/map/camera/cameraState';
import { selectionFitRequestFor, useSelectionCamera } from '@/lib/map/camera/useSelectionCamera';
import {
  EMPTY_EVIDENCE_SET,
  type EvidenceSet,
  geographyTotals,
} from '@/lib/map/evidence/evidenceModel';
import type { MapSelection } from '@/lib/map/state/mapState';
import type { PlaceResult } from '@/lib/map/search/placeSearch';
import { regionMayFrame, REGIONAL_EVIDENCE_SCOPE } from '@/lib/map/region/regionSelection';
import { useResolvedRegion } from '@/lib/map/region/useResolvedRegion';
import { RegionIdentityCard } from '@/components/map/shell/RegionIdentityCard';
import {
  MobileBottomSheet,
  MIN_TOUCH_PX,
  SPATIAL_DETENTS,
  type SheetStop,
} from './MobileBottomSheet';
import { MobilePlaceSearch } from './MobilePlaceSearch';
import { useMapWorkspace } from './useMapWorkspace';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import { BAND_AVAILABLE } from '@/lib/map/spatial/controlBands';
import { WatchCta } from '@/components/map/shell/monetization/WatchCta';
import { WatchComposer } from '@/components/map/shell/monetization/WatchComposer';
import { ActivationPanel } from '@/components/map/shell/monetization/ActivationPanel';
import { Watchboard } from '@/components/map/shell/monetization/Watchboard';
import { AssessmentTimeline } from '@/components/map/shell/monetization/AssessmentTimeline';
import {
  DEFAULT_SENSITIVITY,
  watchCapability,
  type WatchSensitivity,
} from '@/lib/map/monetization/watchModel';
import { watchCtaStage } from '@/lib/map/monetization/watchCtaLadder';
import { WATCH_RUNTIME_ACTIVE } from '@/lib/map/monetization/watchRuntimeGate';
import { loadActionIsOffered } from '@/lib/map/retrieval/countryReadRequest';
import type { CountryReadPresentation } from '@/lib/map/retrieval/countryReadPresentation';
import { ChangeStrip } from '@/components/map/shell/monetization/ChangeStrip';
import { ActionDeck, type DeckAction } from '@/components/map/shell/monetization/ActionDeck';
import { AnalysisCostPrompt } from '@/components/map/shell/monetization/AnalysisCostPrompt';
import { AnalysisWorkspace } from '@/components/map/shell/monetization/AnalysisWorkspace';
import {
  NO_SURFACES,
  closeSurface,
  isOpen,
  openSurface,
  type OpenSurfaces,
  type SurfaceId,
} from '@/lib/map/monetization/surfaceClass';

/**
 * PART IV v1.2 R2 §16.2 — THE PERMANENT COMPACT HUD BUDGET, AS CONSTANTS.
 *
 *   TOP BAR       52px   search + watchboard icon only
 *   CHANGE STRIP  30px   one line, never wraps
 *   TOTAL         82px   HARD CAP
 *
 * Exported so the guard can add them rather than trusting a comment, and so a
 * third permanent row cannot be introduced without the sum failing.
 */
export const TOP_BAR_PX = 52;
export const CHANGE_STRIP_PX = 30;
export const PERMANENT_HUD_PX = TOP_BAR_PX + CHANGE_STRIP_PX;

/**
 * MOBILE SPATIAL MVP — THE PHONE COMPOSITION.
 *
 * This is NOT the desktop shell at a smaller width. The desktop shell is a
 * three-column grid — 52 px control rail, map, 372 px intelligence rail — and
 * none of those three survive contact with a 375 px screen. What survives is
 * the CONTRACTS: the same evidence model, the same camera reducer, the same
 * search, the same selection, the same story cards. Only the composition is new.
 *
 *   the map          full-bleed, the whole screen, behind everything
 *   search           one field across the top, because on a phone finding a
 *                    place is the first thing and there is no room to hide it
 *   zoom             two 44 px buttons, bottom right, above the sheet
 *   intelligence     a bottom sheet at PEEK / HALF / FULL
 *
 * ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────
 *
 * The breadcrumb rail, the layer rail, the readout, the scale bar, the legend
 * and the selection callout. Each is a desktop affordance that would cost more
 * screen than it returns on a phone, and the callout in particular is
 * explicitly FULL/MODAL only — Part I says the mobile bottom sheet at PEEK IS
 * the callout. This shell honours that rather than adding a floating panel over
 * a phone-sized map.
 *
 * ── ROTATION AND PITCH ────────────────────────────────────────────────────
 *
 * Out of scope for this MVP and actively disabled by the canvas, so a two-
 * finger twist zooms without tilting the world into a projection nobody asked
 * for. Pinch zoom and drag pan come from the engine.
 */

export interface MobileSpatialShellProps {
  readonly language: LanguageCode;
  readonly initialCamera?: CameraState;
  readonly initialCameraRestored?: boolean;
  readonly onCameraChange?: (camera: CameraState) => void;
  readonly selection?: MapSelection | null;
  readonly onSelectionChange?: (selection: MapSelection | null) => void;
  readonly onSelectCountry?: (feature: CountryFeature) => void;
  readonly onOpenAnalysis?: (selection: MapSelection) => void;
  readonly onOpenSources?: (selection: MapSelection) => void;
  readonly evidenceSet?: EvidenceSet;
  readonly selectedIso3?: string | null;
  readonly displayName?: string | null;
  readonly follow?: FollowRelationship;
  readonly selectionDetail?: SelectionDetail;
  readonly countryStoryCounts?: Record<string, number>;
  /**
   * MAP R1 — the explicit country read, passed in rather than re-derived.
   *
   * The owner already builds this from Main's own state machine; a second
   * derivation here would be a second rule to keep in step. Optional, so the
   * legacy composition and every existing caller render exactly as before.
   */
  readonly countryRead?: CountryReadPresentation;
}

export function MobileSpatialShell({
  language,
  initialCamera,
  initialCameraRestored = false,
  onCameraChange,
  selection = null,
  onSelectionChange,
  onSelectCountry,
  onOpenAnalysis,
  onOpenSources,
  evidenceSet = EMPTY_EVIDENCE_SET,
  selectedIso3 = null,
  displayName = null,
  follow,
  selectionDetail,
  countryStoryCounts,
  countryRead,
}: MobileSpatialShellProps): JSX.Element {
  const dictionary = getDictionary(language);
  const spatial = dictionary.map.spatial;
  const shell = dictionary.map.shell;
  const mobile = spatial.mobile;

  const [session, dispatch] = useReducer(
    cameraReducer,
    initialCamera ?? undefined,
    initialCameraSession,
  );
  const [engineMinZoom, setEngineMinZoom] = useState<number | undefined>(undefined);
  const [stop, setStop] = useState<SheetStop>('PEEK');

  /*
    ══ H-C907 DEFECT A · THE PHONE NOW FRAMES THE COUNTRY IT SELECTED ═══════

    MEASURED ON THE RAILWAY ALPHA, AFG AND ZWE: selection succeeded, identity,
    counts and story cards updated, and the map stayed at the world camera.
    This shell already had the reducer, the `fitBounds` wiring into
    `EvidenceMapCanvas` and the `initialCameraRestored` prop — everything
    except the transition that turns a selected ISO3 into a camera.

    IT IS THE DESKTOP POLICY, NOT A SECOND ONE. `useSelectionCamera` is the
    accepted `GlobalMapShell` implementation lifted out verbatim, so explicit
    `cam=` restore still wins at mount, deselection still moves nothing, the
    antimeridian exceptions still commit directly, and a bounds target is still
    measured by the engine against the REAL viewport before it is committed —
    which is what makes the framing correct at 375 px rather than at some
    assumed width.

    AND IT IS ORIGIN-BLIND. The hook watches the `selectedIso3` PROP, so search
    result, map tap, URL-restored country and any parent selection update all
    frame identically. Nothing below needs to remember to call it.
  */
  const commitCamera = useCallback((resolved: CameraState) => {
    dispatch({ kind: 'commit', camera: resolved });
  }, []);

  const { pendingBounds, onBoundsResolved, focusBounds } = useSelectionCamera({
    selectedIso3,
    initialCameraRestored,
    commitCamera,
  });

  /*
    ══ R2 · THE MAP IS FULL-BLEED AND THE SHEET IS DRAWN OVER IT ════════════

    MEASURED after R1: the camera was committed and the country was framed —
    into the middle of the CANVAS, which on this shell extends underneath the
    sheet. At 375x844 only 18% of Afghanistan's height and 2% of Luxembourg's
    fell inside the visible map pane.

    So the canvas is told which of its edges are covered, and it adds that to
    the accepted fit padding. Read at RESOLVE time through a callback rather
    than passed as a value: the current detent is what is covering the map at
    the moment the fit happens, and a value prop would either be stale or make
    the fit a render dependency.

    `PERMANENT_HUD_PX` on top is the 82px hard cap this shell already declares.
  */
  /*
    ══ MAP MOBILE INTERACTION R1 · ONE AVAILABLE-WORKSPACE MODEL ════════════

    Raw-viewport arithmetic is retired. The sheet height, mapFractionAt, this
    camera fit inset and the zoom anchor all read the SAME layout, derived from

        A = visualViewportHeight − PERMANENT_HUD_PX (82: top bar + Change
            Strip) − visible bottom-nav block

    R1 FINAL CORRECTION — the Change Strip is permanent chrome and does not
    count toward the ≥26% unobstructed-map floor. The existing HUD authority
    below is passed in, so there is still exactly one 82.

    (lib/map/spatial/mapWorkspace). The bottom nav is visible at PEEK and HALF
    and hidden at FULL and while the keyboard is open, and its visibility is
    derived in the same computation as A — so a FULL transition settles as
    nav leaves layout → A recomputes → sheet and camera settle, with no refit
    from the old nav-visible geometry.

    The fit reads the layout through a ref at RESOLVE time, for the reason
    R2 gave: what covers the map is what is covering it when the fit happens.
  */
  const navHostRef = useRef<HTMLDivElement>(null);
  const workspace = useMapWorkspace(stop, navHostRef, SPATIAL_DETENTS, PERMANENT_HUD_PX);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const fitInset = useCallback(() => {
    const current = workspaceRef.current;

    if (current.workspacePx <= 0) return { top: PERMANENT_HUD_PX };

    return { top: current.fitInset.top, bottom: current.fitInset.bottom };
  }, []);

  const availability = useMemo(
    () => cameraAvailability(session, engineMinZoom),
    [session, engineMinZoom],
  );

  const totals = useMemo(() => geographyTotals(evidenceSet.records), [evidenceSet.records]);
  /*
    ══ PART IV §16 · MOBILE. LAYERS ARE ASSIGNED TO DETENTS, NOT INVENTED ═══

    "Below 860px the approved three-detent bottom sheet carries every layer.
    NOTHING NEW IS INVENTED; layers are assigned to detents."

      PEEK   identity · ceiling · evidence count · mint watch dot · state chip
      HALF   assessment · WATCH (primary, full width, 44px) · Ask and Follow as
             icon buttons · run record
      FULL   composer · timeline · action deck · sources

    "Watch is the primary at HALF. Ask and Follow become icon buttons —
    DELIBERATE, so the cheap action is not the easiest."

    The watchboard is a top-bar icon opening a FULL-SCREEN SHEET, never an
    overlay on the map — a phone has no room for a drawer beside a map, and an
    overlay would take the map away without saying so.
  */
  /*
    ══ R2 §16.4 · REPLACEMENT SURFACES TAKE OVER THE SHEET ═════════════════

    CORRECTED FROM MY v1.1 BUILD, which mounted an `absolute inset-0` panel over
    the bottom sheet. That is a SHEET OVER A SHEET, which §16.3 forbids by name,
    and it also hid the map entirely — R2 requires the map to hold at least 26%
    of the viewport in every state.

    A REPLACEMENT now swaps the sheet's CONTENT and restores the subject when it
    closes. One sheet, one surface at a time, and the map keeps its share.

    `OpenSurfaces` is keyed by class, so a second REPLACEMENT is unrepresentable
    rather than merely discouraged — the same enforcement the desktop shell uses.
  */
  const [surfaces, setSurfaces] = useState<OpenSurfaces>(NO_SURFACES);
  const [workspaceAction, setWorkspaceAction] = useState<string | null>(null);
  const [costPromptAction, setCostPromptAction] = useState<string | null>(null);

  const openSheetSurface = useCallback((surface: SurfaceId) => {
    setSurfaces((was) => openSurface(was, surface));
    /* A REPLACEMENT needs the room: it opens the sheet to FULL. */
    setStop('FULL');
  }, []);

  const closeSheetSurface = useCallback(
    (surface: SurfaceId) => setSurfaces((was) => closeSurface(was, surface)),
    [],
  );

  /* What the sheet is currently showing, at most one REPLACEMENT. */
  const sheetSurface: SurfaceId | null = isOpen(surfaces, 'watchComposer')
    ? 'watchComposer'
    : isOpen(surfaces, 'watchboard')
      ? 'watchboard'
      : isOpen(surfaces, 'assessmentTimeline')
        ? 'assessmentTimeline'
        : null;
  const [watchTopics, setWatchTopics] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [watchSensitivity, setWatchSensitivity] = useState<WatchSensitivity>(DEFAULT_SENSITIVITY);

  const capability = watchCapability(follow !== undefined && follow !== null);

  /*
    UNKNOWN[], SO A BACKEND HONESTY STATE CANNOT BECOME A CHIP. G's audit draws
    the line: NO_BASELINE and EVIDENCE_UNAVAILABLE are facts about the pipeline,
    not about the world, and `summariseChange` drops anything that is not one of
    the seven display states. Empty today; the gate is real and proved.
  */
  const changeStates: readonly unknown[] = [];

  /* §10's actions and their stated costs. Tier locks ghost; nothing invokes. */
  const deckActions: readonly DeckAction[] = [
    { id: 'explain-change', cost: 1, tier: null },
    { id: 'summarise-30d', cost: 1, tier: null },
    { id: 'compare-regions', cost: 2, tier: null },
    { id: 'explain-watch', cost: 1, tier: null, requiresWatch: true },
    { id: 'what-next', cost: 1, tier: null },
    { id: 'business-impact', cost: 2, tier: 'PROFESSIONAL' },
    { id: 'humanitarian-impact', cost: 2, tier: 'PROFESSIONAL' },
    { id: 'cross-border', cost: 3, tier: 'INSTITUTIONAL' },
  ];

  const chosenAction = deckActions.find((a) => a.id === costPromptAction) ?? null;

  /*
    RSC-1 leaves regional Watch scoping unsettled, so a REGION selection is not
    a Watch subject and the chain stays empty — the mobile mirror of the desktop
    shell's gate. An empty chain renders no composer subject and no CTA.
  */
  const watchChain =
    selection === null || selection === undefined || selection.kind === 'REGION'
      ? []
      : [
          {
            id: selection.id,
            kind: 'PLACE' as const,
            label: displayName ?? selection.id,
            /* The selection's own level — see the desktop shell's note. */
            ceiling: selection.kind,
            countryIso3: selectedIso3 ?? undefined,
          },
        ];

  /*
    ══ §6.1a ON A PHONE, AS R2 §16.1 ASSIGNS IT TO DETENTS ═════════════════

    There is no hover, so stage 1 never occurs: a subject is either unselected
    or selected.

      PEEK  →  SELECTED    "quiet mint glyph (CTA stage 2)"          §16.1 B
      HALF  →  UNDERSTOOD  "Watch at CTA stage 4: filled mint,       §16.1 C
                            sole primary"

    CORRECTED FROM MY FIRST CUT, which passed an empty signal set and therefore
    could never leave OPENED — measured at 390x620: stage stayed OPENED at HALF
    and `solePrimary` stayed false, so stage 4 was unreachable on compact.

    THE DETENT IS THE SIGNAL, and that is not a shortcut. §16.1 C is titled
    "UNDERSTOOD — HALF" and says stage 4 is reached "only here": on a phone,
    opening the sheet to HALF IS reading the assessment, because the assessment
    is what HALF contains. The desktop equivalent — scrolling the body, opening a
    source — has no meaning on a surface where the gesture that reveals the text
    is the same gesture that opens the detent.
  */
  const watchStage = watchCtaStage({
    /* RSC-1 leaves regional Watch scoping unsettled — the ladder never starts. */
    selected: selection !== null && selection !== undefined && selection.kind !== 'REGION',
    cardOpen: stop !== 'PEEK',
    signals: stop === 'PEEK' ? new Set() : new Set(['ASSESSMENT_SCROLLED' as const]),
  });

  const selectedTotal = totals.find((total) => total.geographyId === selectedIso3);

  const onIntent = useCallback((intent: CameraIntent) => dispatch(intent), []);
  const onGesture = useCallback((camera: CameraState) => dispatch({ kind: 'gesture', camera }), []);

  /* The route owns the camera in the URL exactly as it does on desktop. */
  const camera = session.camera;

  useMemo(() => {
    onCameraChange?.(camera);
  }, [camera, onCameraChange]);

  /* RSC-1 — the same hook the desktop shell uses. One implementation, two shells. */
  const { region, adopt: adoptRegion } = useResolvedRegion(selection);

  const onSearchResult = useCallback(
    (result: PlaceResult) => {
      /*
        THE SAME RULE AS THE DESKTOP SHELL, INCLUDING M16: a country result
        selects; anything else moves the camera and CLEARS an incompatible
        country selection rather than leaving the sheet describing a place the
        user has navigated away from.
      */
      if (result.kind === 'COUNTRY' && result.countryIso3) {
        onSelectionChange?.({ kind: 'COUNTRY', id: result.countryIso3 });
        /* R2 — the country sheet is read at PEEK; see `onSelectFromMap`. */

        return;
      }

      /*
        ── RSC-1 ON A PHONE — THE SAME FIVE STEPS, PLUS A DETENT ────────────

        Identical transition to the desktop shell, and the ONE mobile addition
        is the detent: a region commit opens the sheet to HALF, because the
        answer to "what did I just select?" is entirely in the sheet here.
        There is no rail beside the map to carry it, and leaving the sheet at
        PEEK would reproduce the very defect this contract exists to correct —
        the camera moving while nothing says what was selected.

        The camera is still CONDITIONAL. A region with no published extent
        selects, opens the sheet, and does not move the map.
      */
      const committed = result.region;

      if (committed !== undefined) {
        onSelectionChange?.({ kind: 'REGION', id: committed.geographyId });
        adoptRegion(committed);
        setStop('HALF');

        if (regionMayFrame(committed) && committed.extent !== null) {
          focusBounds(committed.extent);
        }

        return;
      }

      if (selection !== null && selection !== undefined) onSelectionChange?.(null);
      if (result.bounds) focusBounds(result.bounds);
    },
    [onSelectionChange, selection, adoptRegion, focusBounds],
  );

  const onSelectFromMap = useCallback(
    (feature: CountryFeature) => {
      onSelectCountry?.(feature);
      /*
        MAP / SPATIAL VISUAL CONVERGENCE R2 — the sheet no longer climbs on a
        tap. PEEK now carries identity, reporting state, Follow and the one
        primary action, so a selection is answered without covering the map
        the reader just tapped. The reader raises it; Load raises it to HALF.
      */
    },
    [onSelectCountry],
  );

  /*
    ══ MAP / SPATIAL VISUAL CONVERGENCE R2 · THE PHONE READS WHAT WAS LOADED ══

    MEASURED: after an explicit Load the desktop rail listed the retrieved
    reporting, and the phone sheet listed nothing — it read only the retained
    corpus in `selectionDetail`, never the `countryRead` presentation it was
    already handed. So a reader pressed Load, spent a governed read, and was
    shown the same empty sheet.

    The phone now reads exactly what the desktop card reads: the explicit read
    when it has settled, and otherwise the retained corpus. No new request and
    no new state — only the presentation the owner already builds.
  */
  const readSettled =
    countryRead !== undefined && (countryRead.state === 'READY' || countryRead.state === 'READY_NO_COVERAGE');
  const loadedItems = readSettled ? (countryRead?.items ?? []) : null;
  const items = loadedItems !== null && loadedItems.length > 0 ? loadedItems : (selectionDetail?.items ?? []);
  const provider = (readSettled ? countryRead?.providerStatus : undefined) ?? selectionDetail?.providerStatus;
  const coverage = (readSettled ? countryRead?.coverage : undefined) ?? selectionDetail?.coverage;
  const identity = selectionDetail?.identity;
  const hasSelection = selectedIso3 !== null && displayName !== null;
  /* Retrieved counts once the reader has loaded; retained totals before. */
  const reportCount = loadedItems !== null ? loadedItems.length : (selectedTotal?.reportCount ?? 0);
  const sourceCount =
    loadedItems !== null ? (coverage?.publisherCount ?? null) : (selectedTotal?.publisherCount ?? null);
  const newCount = selectedTotal?.newSinceLastVisit ?? 0;

  const storiesRef = useRef<HTMLElement | null>(null);

  /*
    Load is the explicit read, and the reader is shown its answer at HALF. The
    country was framed for the sheet it was selected under; raising the sheet
    re-frames it through the SAME policy (the country's own fit target, read at
    resolve time against the new detent) so it stays above the sheet.
  */
  const onLoadCountry = useCallback(() => {
    countryRead?.onLoad();
    if (stop !== 'PEEK') return;
    setStop('HALF');
    const fit = selectionFitRequestFor(selectedIso3);
    if (fit.kind === 'bounds') focusBounds(fit.bounds);
  }, [countryRead, stop, selectedIso3, focusBounds]);

  /*
    SOURCES OPENS THE SOURCES. The route's `onOpenSources` scrolls the DESKTOP
    rail's retained block, which the phone does not render, so on a phone the
    control did nothing at all. Here it opens the sheet to FULL and brings the
    retained set into view — a presentation move, no request.
  */
  const openSources = useCallback(() => {
    setStop('FULL');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => storiesRef.current?.scrollIntoView({ block: 'start' }));
    });
  }, []);

  /*
    DESIGN v1.6 — the camera pair on the idle UI ramp.

    Same reasoning as the desktop buttons: these are the controls a reader
    touches most, and the passive ink left them the dimmest things in the new
    interaction layer. Border weight rises to v1.6's .38 so the button reads as
    a surface rather than as a glyph floating on the map — which matters more on
    a phone, where there is no hover to reveal an edge and the only way to
    discover a control is to see it.

    `active:` rather than `hover:` throughout: a touch surface has no hover
    state, and expressing the pressed feedback as hover would leave the button
    with no response at all under a finger.
  */
  const zoomButton =
    'flex items-center justify-center border border-[rgba(126,166,186,.38)] bg-sp-panel/90 text-[19px] text-sp-ui-hover outline-none backdrop-blur-[6px] transition-[color,background-color,border-color] duration-[140ms] active:bg-sp-cyan/[0.14] active:text-sp-cyan disabled:opacity-[.35] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan';

  /*
    ══ R2 §16.1 STATE H2 · A FULL TRANSITION, TAKEN BEFORE THE MAP RENDERS ═══

    "Full transition, NOT A SHEET, because the map is no longer the subject."
    Returning early is what makes that literal: the map shell is not mounted
    behind it, so the workspace cannot be mistaken for a layer over the map.

    Both return paths land on the SUBJECT AT HALF with sheet state intact —
    `stop` is untouched here, so the sheet is exactly as the reader left it.
  */
  if (workspaceAction !== null) {
    const actionNames: Readonly<Record<string, string>> = spatial.monetization.deck.actions;

    return (
      <AnalysisWorkspace
        actionLabel={actionNames[workspaceAction] ?? workspaceAction}
        subjectLabel={displayName ?? mobile.noSelection}
        labels={spatial.monetization.workspace}
        onReturn={() => {
          setWorkspaceAction(null);
          setStop('HALF');
        }}
      />
    );
  }

  return (
    <section
      data-gn="mobile-spatial-shell"
      /*
        ASK R2 INTEGRATION R1 · D25 11 "Map → Ask → Map" — the documented probe the D25
        acceptance harness reads (PA-11): the five values Close must restore. Derived from
        this shell's own state only; nothing here is written back.
      */
      data-map-state={JSON.stringify({
        selectedCountry: selectedIso3,
        cameraCentre: camera.center,
        zoom: camera.zoom,
        mode: Object.values(surfaces).find((s) => s !== undefined) ?? 'MAP',
        layers: Object.values(surfaces).filter((s) => s !== undefined),
        sheetDetent: stop,
      })}
      aria-label={mobile.shellLabel}
      className="relative h-[100dvh] w-full overflow-hidden bg-sp-bg"
    >
      {/* THE MAP IS THE SCREEN. Everything else sits over it. */}
      <div className="absolute inset-0">
        <EvidenceMapCanvas
          camera={camera}
          origin={session.origin}
          density="full"
          onGesture={onGesture}
          onMinZoomChange={setEngineMinZoom}
          onSelectCountry={onSelectFromMap}
          selectedIso3={selectedIso3}
          countryStoryCounts={countryStoryCounts}
          evidenceRecords={evidenceSet.records}
          fitBounds={pendingBounds}
          onBoundsResolved={onBoundsResolved}
          fitInset={fitInset}
          language={language}
          /*
            MOBILE-SPATIAL-LABELS — the reference label layer needs its names.

            MEASURED: `EvidenceMapCanvas` computes its own label candidates, but
            `recomputeLabels` opens with

                if (map === null || labelNames === undefined) { setLabels([]); return; }

            and `labelNames` is OPTIONAL. `GlobalMapShell` supplies it; this
            composition did not, so every mobile width rendered ZERO label nodes
            — not dropped by the collision grid, never produced at all. Desktop
            placed 11 of 11 at 1360x900 while 834x1112, 390x844 and 375x844 each
            placed none.

            This is the SAME dictionary object the desktop shell reads, so the
            two cannot drift: place names come from the accepted catalogue and
            from nowhere else. No placement rule, budget or precision changes
            here — the layer simply receives what it was always waiting for.
          */
          labelNames={{ continents: spatial.continents, waters: spatial.waters, territories: spatial.territories }}
          ariaLabel={mobile.mapLabel}
          interactionHint={mobile.mapHint}
        />
      </div>

      {/*
        THE OVERLAY LAYER IS TRANSPARENT TO THE POINTER, and only real controls
        take it back — the same rule PO-3 established on desktop, which matters
        more here: a transparent island over a phone map swallows the drag that
        IS the map.
      */}
      {/*
        ══ PART IV v1.2 R2 §16.2 · THE PERMANENT HUD BUDGET ═══════════════════

        TOP BAR      52px   search + watchboard icon only
        CHANGE STRIP 30px   one line, truncates by priority, never wraps
        TOTAL        82px   HARD CAP

        "Nothing else may become permanent. New capability arrives as a sheet, a
        popup or a workspace, and LEAVES AGAIN."

        RECONCILING THE ROUTE EXIT. C-O accepted the GLOBALNEWS AI mark as this
        route's minimal exit affordance, and R2 says the top bar carries search
        and the watchboard icon. Both hold, because the mark joins the SAME 52px
        row rather than adding a second one: an exit is not new capability, and
        a phone with no way back is worse than one with a compact mark. The
        treatment is unchanged — same dot, same tracking — and nothing else was
        added beside it.

        THE BUDGET IS ENFORCED BY CONSTANTS, NOT BY EYE. `TOP_BAR_PX` and
        `CHANGE_STRIP_PX` are exported and asserted, so a later row cannot be
        added without the sum failing its guard.
      */}
      <div
        data-gn="mobile-hud"
        className="pointer-events-none absolute inset-x-0 top-0 z-30 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto"
      >
        <div
          data-gn="mobile-top-bar"
          data-gn-surface-class="PERSISTENT"
          style={{ height: TOP_BAR_PX }}
          className="flex items-center gap-[8px] px-[10px]"
        >
          <a
            data-gn="mobile-brand"
            href="/"
            aria-label={`${spatial.topBar.brand} \u2014 ${spatial.topBar.brandHome}`}
            style={{ minHeight: MIN_TOUCH_PX, minWidth: MIN_TOUCH_PX }}
            className="flex shrink-0 items-center justify-center rounded-[3px] border border-[rgba(126,166,186,.38)] bg-sp-panel/85 px-[9px] backdrop-blur-[6px]"
          >
            <span
              aria-hidden="true"
              className="h-[7px] w-[7px] rounded-full bg-sp-cyan shadow-[0_0_10px_#3ad6e6]"
            />
          </a>

          <div className="min-w-0 flex-1">
            <MobilePlaceSearch
              totals={totals}
              onSelectResult={onSearchResult}
              labels={spatial.search}
              countryNames={undefined}
              regionNames={undefined}
            />
          </div>

          {/*
            §16.3 — THE WATCHBOARD ICON IS THE ONLY ALERT AFFORDANCE. No toasts,
            no banners over the map. The count is amber because an unread alert
            is attention; mint would say a watch is RUNNING, which is a different
            fact.
          */}
          <button
            type="button"
            data-gn="mobile-watchboard"
            aria-label={spatial.monetization.watchboard.title}
            onClick={() => openSheetSurface('watchboard')}
            style={{ minHeight: MIN_TOUCH_PX, minWidth: MIN_TOUCH_PX }}
            className="flex shrink-0 items-center justify-center rounded-[3px] border border-[rgba(126,166,186,.38)] bg-sp-panel/85 text-sp-ui-idle backdrop-blur-[6px]"
          >
            <span
              aria-hidden="true"
              className="block h-[13px] w-[13px] rounded-full border-[1.5px] border-current"
            >
              <span className="mt-[3px] ml-[3px] block h-[4px] w-[4px] rounded-full bg-current" />
            </span>
          </button>
        </div>

        {/*
          §16A mobile column: "own line under the top bar; truncates by
          priority". One line, 30px, and it never wraps — a strip that grew a
          row when the world got busy would move the map because the news moved.
        */}
        <div
          data-gn="mobile-change-strip"
          data-gn-surface-class="PERSISTENT"
          style={{ height: CHANGE_STRIP_PX }}
          className="flex items-center overflow-hidden px-[10px]"
        >
          <ChangeStrip
            states={changeStates}
            zoom={camera.zoom}
            labels={spatial.monetization.changeStrip}
          />
        </div>
      </div>

      {/*
        THE ZOOM PAIR IS ANCHORED TO THE SHEET STOP AND REMOVED AT FULL — the
        measured repair from the Mobile Spatial MVP, unchanged here: at FULL the
        map is 101px tall and a control floating over it is unreachable.
      */}
      {stop !== 'FULL' && (
      <div
        data-gn="mobile-zoom"
        role="group"
        aria-label={shell.controlsLabel}
        style={{ bottom: workspace.zoomBottomPx }}
        className="pointer-events-none absolute right-[10px] z-30 flex flex-col gap-[8px] transition-[bottom] duration-200 ease-out [&_button]:pointer-events-auto"
      >
        <button
          type="button"
          data-gn="mobile-zoom-in"
          aria-label={shell.zoomIn}
          disabled={!availability.canZoomIn}
          onClick={() => onIntent({ kind: 'zoom-in' })}
          style={{ width: MIN_TOUCH_PX, height: MIN_TOUCH_PX }}
          className={zoomButton}
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          data-gn="mobile-zoom-out"
          aria-label={shell.zoomOut}
          disabled={!availability.canZoomOut}
          onClick={() => onIntent({ kind: 'zoom-out' })}
          style={{ width: MIN_TOUCH_PX, height: MIN_TOUCH_PX }}
          className={zoomButton}
        >
          <span aria-hidden="true">&minus;</span>
        </button>
      </div>
      )}

      {/*
        ══ MAP / SPATIAL VISUAL CONVERGENCE R2 · ASK ABOUT THIS COUNTRY ═══════

        Map R1 "Ask on the Map": with a country selected the Ask entry is a chip
        that rides the sheet's top edge on the right, where the thumb is — not
        a global launcher parked over the map. It sits on the zoom pair's row
        and to its left, so the two never share a pixel; at FULL the zoom pair
        is gone and the chip takes the corner.

        IT OPENS; IT DOES NOT ASK. `openGlobalAsk()` is the same document event
        every in-place Ask entry dispatches: the dock opens with the country as
        its published geography context and nothing is sent until Send.
      */}
      {hasSelection && selection?.kind === 'COUNTRY' && sheetSurface === null && (
        <button
          type="button"
          data-gn="mobile-ask-about"
          onClick={() => openGlobalAsk()}
          style={{ bottom: workspace.zoomBottomPx, right: stop === 'FULL' ? 10 : 10 + MIN_TOUCH_PX + 8, minHeight: MIN_TOUCH_PX }}
          className="absolute z-30 flex max-w-[calc(100%-82px)] items-center gap-[8px] rounded-full border border-[#3c2f7a] bg-[linear-gradient(105deg,#2b1f6e,#1a2a6e)] px-[14px] text-[13.5px] font-semibold text-[#ece8ff] shadow-[0_6px_20px_rgba(0,0,0,.35)] transition-[bottom,right] duration-200 ease-out active:brightness-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#a78bfa]"
        >
          <span aria-hidden="true" className="font-gn-mono text-[11px] text-[#a78bfa]">◆</span>
          <span className="truncate">{mobile.askAbout.replace('{country}', displayName ?? '')}</span>
        </button>
      )}

      <MobileBottomSheet
        stop={stop}
        onStopChange={setStop}
        workspaceHeight={workspace.workspacePx}
        bottomOffset={workspace.sheetBottomPx}
        overlapHandle
        labels={{
          sheetLabel: mobile.sheetLabel,
          handleLabel: mobile.handleLabel,
          stops: mobile.stops,
        }}
      >
        {/*
          ══ R2 §16.4 · A REPLACEMENT TAKES OVER THE SHEET AND RESTORES IT ═════

          One surface at a time, in the sheet the reader already has, with the
          map still above it. Closing returns to the subject — "restores what it
          replaced on close" — so nothing composed or read is lost, and there is
          never a second sheet.
        */}
        {sheetSurface !== null ? (
          <div data-gn="mobile-sheet-surface" data-gn-surface={sheetSurface} data-gn-surface-class="REPLACEMENT">
            <div className="mb-[12px] flex items-center justify-between gap-[10px] border-b border-sp-line pb-[9px]">
              <h3 className="font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-2">
                {sheetSurface === 'watchComposer'
                  ? spatial.monetization.composer.title
                  : sheetSurface === 'watchboard'
                    ? spatial.monetization.watchboard.title
                    : spatial.monetization.timeline.title}
              </h3>
              <button
                type="button"
                data-gn="mobile-surface-close"
                aria-label={spatial.monetization.drawerClose}
                onClick={() => closeSheetSurface(sheetSurface)}
                style={{ minHeight: MIN_TOUCH_PX, minWidth: MIN_TOUCH_PX }}
                className="flex items-center justify-center rounded-[2px] border border-sp-line-2 font-gn-mono text-[15px] leading-none text-sp-ui-idle"
              >
                ×
              </button>
            </div>

            {/*
              STATE D — QUICK WATCH ACTIVATION. §16.1: "Composer and confirm are
              ONE SURFACE on mobile... No route change." So the composer and the
              activation panel render together, in order, in this one sheet
              surface — reviewing scrolls rather than navigates, and there is no
              second sheet and no route to return from.
            */}
            {sheetSurface === 'watchComposer' && (
              <div data-gn="mobile-quick-activation" className="flex flex-col gap-[18px]">
                <WatchComposer
                  chain={watchChain}
                  capability={capability}
                  labels={spatial.monetization.composer}
                  topics={['supply', 'pricing', 'logistics', 'policy', 'security', 'infrastructure']}
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
                  onReview={(sensitivity) => setWatchSensitivity(sensitivity)}
                />

                <div
                  data-gn="mobile-activation"
                  data-gn-surface-class="TEMPORARY"
                  className="border-t border-sp-line pt-[16px] [&_[data-gn='activation-sentence']]:text-[17px]"
                >
                  <ActivationPanel
                    chain={watchChain}
                    sensitivity={watchSensitivity}
                    sensitivityLabel={spatial.monetization.composer.sensitivities[watchSensitivity]}
                    capability={capability}
                    labels={spatial.monetization.activation}
                    signInHref="/account/sign-in?next=%2Fmap"
                    onFollowInstead={
                      follow === null || follow === undefined
                        ? undefined
                        : () => {
                            follow.onFollow(follow.countryIso3);
                            closeSheetSurface('watchComposer');
                          }
                    }
                    onDismiss={() => closeSheetSurface('watchComposer')}
                  />
                </div>
              </div>
            )}

            {/* STATE F — WATCHBOARD, grouped by subject rather than by record. */}
            {sheetSurface === 'watchboard' && (
              <Watchboard
                entries={[]}
                capability={capability}
                labels={spatial.monetization.watchboard}
                onSelectSubject={undefined}
              />
            )}

            {/* STATE G — TIMELINE, newest first so the current state is above the fold. */}
            {sheetSurface === 'assessmentTimeline' && (
              <AssessmentTimeline
                entries={[]}
                withheldCount={0}
                capability={capability}
                labels={spatial.monetization.timeline}
                order="NEWEST_FIRST"
              />
            )}
          </div>
        ) : selection?.kind === 'REGION' ? (
          /*
            RSC-1 STEP 5 ON A PHONE — THE SHEET IS THE RAIL.

            Placed BEFORE the `!hasSelection` branch, and that order is the whole
            correction: `hasSelection` is derived from `selectedIso3`, which a
            region does not have, so without this the sheet would have said
            "nothing selected" over a camera that had just flown to Eastern
            Africa. That is the exact defect RSC-1 was written to make
            impossible, wearing a phone's clothes.

            The same component as the desktop rail. A region's card is identity,
            definition and refusals — none of it size-dependent — so a mobile
            variant would be two places to keep one set of refusals honest.
          */
          <div data-gn="mobile-region" data-gn-evidence-scope={REGIONAL_EVIDENCE_SCOPE}>
            <RegionIdentityCard
              region={region}
              geographyId={selection.id}
              labels={spatial.region}
              onClearSelection={onSelectionChange ? () => onSelectionChange(null) : undefined}
            />
          </div>
        ) : !hasSelection ? (
          <p data-gn="mobile-sheet-empty" className="pt-[6px] text-[12.5px] leading-[1.5] text-sp-ink-2">
            {mobile.noSelection}
          </p>
        ) : (
          <>
            {/*
              ══ MAP / SPATIAL VISUAL CONVERGENCE R2 · THE COUNTRY SHEET ═══════

              MEASURED on the Product Owner's iPhone: selecting Iraq turned the
              page into a stack of full-width slabs — Follow, Load, Open
              Analysis, Open Sources, Deep Analysis, How This Changed, Clear —
              with the map reduced to a header illustration. Every action was
              real; the hierarchy was not.

              The sheet now reads in the order a reader needs it:

                PEEK   identity · reporting state · Follow · ONE primary
                HALF   what was retrieved (or an intentional "not loaded")
                FULL   the whole retained set, the deck and the timeline

              and it is designed to be read at PEEK, so a selection no longer
              pushes the sheet up (see `onSelectFromMap`): the map stays the
              surface and the country is identified without covering it.

              Nothing here spends. Load is the only control that retrieves, it
              is the same governed `countryRead.onLoad`, and it is still never
              wired to selection.
            */}
            <header data-gn="mobile-sheet-identity" className="flex items-start gap-[8px]">
              <div className="min-w-0 flex-1 pt-[1px]">
                <h2 className="truncate text-[18px] font-semibold leading-[22px] text-sp-ink">{displayName}</h2>
                <p className="mt-[2px] truncate font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3">
                  {identity?.iso3}
                  {identity?.region ? ` · ${identity.region}` : ''}
                </p>
              </div>

              {/* Follow — one compact, free personalization control. Follow ≠ Watch. */}
              {follow && (
                <div className="relative z-10 shrink-0">
                  <FollowControl
                    compact
                    geographyId={follow.countryIso3}
                    geographyLabel={displayName}
                    isWatched={follow.isFollowed}
                    isPending={follow.isPending}
                    hasFailed={follow.hasFailed}
                    labels={{ ...spatial.card.follow, follow: spatial.card.actions.follow }}
                    onToggle={(id, next) => (next ? follow.onFollow(id) : follow.onUnfollow(id))}
                  />
                </div>
              )}

              {/* Clear is quiet: a 44px glyph, never a full-width slab. */}
              <button
                type="button"
                data-gn="mobile-clear-selection"
                aria-label={mobile.clearSelection}
                title={mobile.clearSelection}
                onClick={() => onSelectionChange?.(null)}
                style={{ minHeight: MIN_TOUCH_PX, minWidth: MIN_TOUCH_PX }}
                className="relative z-10 flex shrink-0 items-center justify-center rounded-[2px] font-gn-mono text-[17px] leading-none text-sp-ink-3 outline-none transition-colors active:text-sp-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sp-cyan"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            {/*
              THE REPORTING STATE, ONE LINE. The same three truthful values the
              slab showed — reports, distinct publishers (or an em dash when
              nobody counted them), new since the last visit — and, once the
              reader has loaded the country, the counts of what was retrieved.
              Zero is shown as zero: an empty country is a fact, not a gap.
            */}
            <p
              data-gn="mobile-sheet-counts"
              data-gn-counts-basis={loadedItems !== null ? 'retrieved' : 'retained'}
              className="mt-[3px] truncate font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ink-2"
            >
              <b className="font-semibold text-sp-cyan">{reportCount}</b> {spatial.card.reports}
              <span className="text-sp-ink-3"> · </span>
              <b className="font-semibold text-sp-cyan">{sourceCount ?? '—'}</b> {spatial.card.sources}
              <span className="text-sp-ink-3"> · </span>
              <b className="font-semibold text-sp-cyan">{newCount}</b> {mobile.newShort}
            </p>

            {/*
              STATE B — THE QUIET MINT GLYPH AT PEEK, still gated. Watch is
              dormant (`WATCH_RUNTIME_ACTIVE` is false), so nothing renders; the
              ladder is untouched and returns unchanged when the runtime lands.
            */}
            {stop === 'PEEK' && WATCH_RUNTIME_ACTIVE && (
              <div data-gn="mobile-peek-watch" className="mt-[10px]">
                <WatchCta
                  stage={watchStage}
                  labels={spatial.monetization.watch}
                  onOpenComposer={() => openSheetSurface('watchComposer')}
                />
              </div>
            )}

            {/* ── THE ONE PRIMARY, OR THE CONTEXTUAL NAVIGATION ──────────── */}
            <div data-gn="mobile-sheet-actions" className="mt-[9px] flex flex-col gap-[8px]">
              {WATCH_RUNTIME_ACTIVE && stop !== 'PEEK' && (
                <WatchCta
                  stage={watchStage}
                  labels={spatial.monetization.watch}
                  onOpenComposer={() => openSheetSurface('watchComposer')}
                />
              )}

              {/*
                Before anything is retrieved there is exactly ONE primary: Load.
                While it runs the same control says so and cannot be pressed
                twice. After it, Load steps back to a quiet "Retrieve again"
                beside the navigation it made meaningful.
              */}
              {countryRead && !readSettled && (loadActionIsOffered(countryRead.state) || countryRead.state === 'LOADING') && (
                <button
                  type="button"
                  data-gn="mobile-action-load-country"
                  data-gn-state={countryRead.state}
                  disabled={countryRead.state === 'LOADING'}
                  onClick={onLoadCountry}
                  style={{ minHeight: MIN_TOUCH_PX }}
                  className="w-full cursor-pointer rounded-[2px] border border-sp-cyan bg-sp-cyan px-[8px] font-gn-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-sp-cyan-on transition-colors hover:bg-sp-cyan-hover disabled:cursor-progress disabled:border-sp-cyan/45 disabled:bg-sp-cyan/[0.14] disabled:text-sp-cyan"
                >
                  {countryRead.state === 'LOADING' ? spatial.card.countryRead.loading : spatial.card.countryRead.load}
                </button>
              )}

              {/*
                CONTEXTUAL NAVIGATION — one compact row, never three slabs. It
                appears once there is something to navigate: retrieved or
                retained reporting. Analysis hands the country to the Analysis
                Workspace (the existing route; it is where analysis is spent),
                Sources opens the retained set, and Retrieve again re-runs the
                same governed read.
              */}
              {(readSettled || items.length > 0) && (
                <nav data-gn="mobile-sheet-nav" aria-label={spatial.card.countryRead.heading} className="grid grid-cols-[1fr_1fr_auto] gap-[6px]">
                  <button
                    type="button"
                    data-gn="mobile-action-analysis"
                    disabled={!onOpenAnalysis || selection === null}
                    onClick={() => selection && onOpenAnalysis?.(selection)}
                    style={{ minHeight: MIN_TOUCH_PX }}
                    className="truncate rounded-[2px] border border-sp-cyan/45 bg-sp-cyan/[0.12] px-[8px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-cyan disabled:opacity-[.35]"
                  >
                    {spatial.card.actions.openAnalysis} <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    type="button"
                    data-gn="mobile-action-sources"
                    disabled={items.length === 0}
                    onClick={openSources}
                    style={{ minHeight: MIN_TOUCH_PX }}
                    className={`truncate rounded-[2px] px-[8px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] disabled:opacity-[.35] ${BAND_AVAILABLE}`}
                  >
                    {spatial.card.sources} · {items.length}
                  </button>
                  {countryRead && readSettled && loadActionIsOffered(countryRead.state) && (
                    <button
                      type="button"
                      data-gn="mobile-action-load-country"
                      data-gn-state={countryRead.state}
                      aria-label={spatial.card.countryRead.reload}
                      title={spatial.card.countryRead.reload}
                      onClick={onLoadCountry}
                      style={{ minHeight: MIN_TOUCH_PX, minWidth: MIN_TOUCH_PX }}
                      className="flex items-center justify-center rounded-[2px] border border-sp-line-2 font-gn-mono text-[15px] leading-none text-sp-ui-idle transition-colors active:text-sp-cyan"
                    >
                      <span aria-hidden="true">↻</span>
                    </button>
                  )}
                </nav>
              )}
            </div>

            {stop !== 'PEEK' && (
              <p data-gn="mobile-staging-note" className="mt-[8px] text-[11.5px] leading-[1.45] text-sp-ink-3">
                {mobile.stagingNote}
              </p>
            )}

            {/*
              ── HALF · WHAT THE READ SAID ─────────────────────────────────────

              An unloaded or failed country is shown as INTENTIONALLY unavailable:
              a bordered statement of what is (not) known and why, in the
              governed words — never an empty list pretending to be a result.
            */}
            {stop !== 'PEEK' && countryRead && countryRead.state !== 'READY' && countryRead.state !== 'UNSELECTED' && (
              <p
                data-gn="mobile-country-read-state"
                data-gn-state={countryRead.state}
                className="mt-[12px] rounded-[2px] border border-dashed border-sp-line-2 px-[10px] py-[9px] text-[12px] leading-[1.45] text-sp-ink-2"
                {...(countryRead.state === 'LOADING' || countryRead.state === 'FAILED'
                  ? { role: 'status' as const, 'aria-live': 'polite' as const }
                  : {})}
              >
                <span className="mb-[3px] block font-gn-mono text-[8.5px] uppercase tracking-[0.14em] text-sp-ink-3">
                  {spatial.card.countryRead.heading}
                </span>
                {countryRead.state === 'FAILED'
                  ? spatial.card.countryRead.failed
                  : countryRead.state === 'READY_NO_COVERAGE'
                    ? spatial.card.countryRead.noCoverage
                    : countryRead.state === 'LOADING'
                      ? spatial.card.countryRead.loading
                      : spatial.card.countryRead.notLoaded}
              </p>
            )}

            {stop !== 'PEEK' && (provider || coverage) && (
              <p
                data-gn="mobile-sheet-provider"
                className="mt-[12px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-2"
              >
                {provider
                  ? `${spatial.card.provider[provider.condition === 'LIVE' ? 'live' : provider.condition === 'DELAYED' ? 'delayed' : 'none']}${provider.providerName ? ` · ${provider.providerName}` : ''}`
                  : ''}
                {provider && coverage ? ' · ' : ''}
                {coverage ? spatial.card.coverage.bands[coverage.band] : ''}
              </p>
            )}

            {/* ── HALF shows the newest; FULL shows the retained set ────── */}
            {stop !== 'PEEK' && items.length > 0 && (
              <section
                ref={storiesRef}
                data-gn="mobile-sheet-stories"
                /*
                  R2 — every control on the phone sheet meets the 44px floor. The
                  shared card keeps its dense desktop/Conflict sizes; only here, on
                  a touch surface, its open, Ask and bookmark controls grow to 44.
                */
                className="mt-[12px] scroll-mt-[8px] [&_[data-gn=source-ask]]:h-11 [&_[data-gn=source-open]]:h-11 [&_[data-gn=source-open]]:w-11 [&_button[aria-pressed]]:h-11 [&_button[aria-pressed]]:w-11"
              >
                <h3 className="mb-[8px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
                  {spatial.card.retainedHeading}
                  <span className="float-right">
                    {stop === 'FULL' ? items.length : Math.min(items.length, 3)} / {items.length}
                  </span>
                </h3>

                {(stop === 'FULL' ? items : items.slice(0, 3)).map((item) => (
                  <SourceCard
                    key={item.id}
                    item={item}
                    selected={item.id === selectionDetail?.selectedItemId}
                    language={language}
                    labels={{
                      categories: spatial.card.categories,
                      levels: spatial.card.levels,
                      openSource: spatial.card.openSource,
                      askAbout: spatial.card.askAbout,
                      askAiShort: spatial.card.askAiShort,
                      seenPrefix: spatial.card.coverage.seenPrefix,
                      publishedPrefix: spatial.card.coverage.publishedPrefix,
                    }}
                    onSelect={selectionDetail?.onSelectItem}
                    onOpenSource={selectionDetail?.onOpenSource}
                  />
                ))}
              </section>
            )}

            {/*
              ── FULL · THE TAIL THE PHONE ONLY SHOWS WHEN ASKED ────────────

              §16.1 assigns the action deck to FULL. It is TEMPORARY, collapsed
              by default, and confirms ONE action at a time through the cost
              prompt, whose Run stays disabled until the monetized deep-analysis
              entitlement contract exists. The timeline is one quiet line that
              opens a full-detent surface.
            */}
            {stop === 'FULL' && (
              <div className="mt-[16px] flex flex-col gap-[8px] border-t border-sp-line pt-[12px]">
                {costPromptAction === null && (
                  <div data-gn="mobile-action-deck" data-gn-surface-class="TEMPORARY">
                    <ActionDeck
                      actions={deckActions}
                      labels={spatial.monetization.deck}
                      hasWatch={false}
                      onChooseAction={(id) => setCostPromptAction(id)}
                    />
                  </div>
                )}

                {chosenAction !== null && (
                  <div className="rounded-[3px] border border-sp-line-2 bg-sp-panel-2 p-[12px]">
                    <AnalysisCostPrompt
                      actionLabel={
                        (spatial.monetization.deck.actions as Readonly<Record<string, string>>)[
                          chosenAction.id
                        ] ?? chosenAction.id
                      }
                      cost={chosenAction.cost}
                      labels={spatial.monetization.costPrompt}
                      onCancel={() => setCostPromptAction(null)}
                      /* NO `onRun` — see the entitlement note above. */
                    />
                  </div>
                )}

                <button
                  type="button"
                  data-gn="mobile-timeline-strip"
                  onClick={() => openSheetSurface('assessmentTimeline')}
                  style={{ minHeight: MIN_TOUCH_PX }}
                  className="flex w-full items-center justify-between gap-[8px] rounded-[2px] border border-[rgba(126,166,186,.14)] bg-[rgba(126,166,186,.045)] px-[10px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ui-idle"
                >
                  <span>{spatial.monetization.timeline.title}</span>
                  <span className="text-sp-ink-3">{spatial.monetization.timeline.openLabel}</span>
                </button>
              </div>
            )}
          </>
        )}
      </MobileBottomSheet>

      {/*
        ══ MAP MOBILE INTERACTION R1 · THE PHONE BOTTOM NAVIGATION ON /map ══

        The product's one phone bottom nav, mounted here with the ruled
        visibility: PEEK visible, HALF visible, FULL hidden, keyboard open
        hidden — and restored symmetrically on the way back down. `hidden`
        takes it out of rendering entirely, and the workspace model measures its
        real height (safe area included) while it is shown. The sheet sits on
        top of it (sheetBottomPx), never underneath.
      */}
      <div
        ref={navHostRef}
        data-gn="map-bottom-nav"
        data-gn-nav-visible={workspace.navVisible ? 'true' : 'false'}
        hidden={!workspace.navVisible}
      >
        <MobileBottomNav language={language} intelligenceHref="/#intelligence-modules" />
      </div>

      {/*
        ── PART IV §16 · MOBILE SUSTAINED SURFACES ──────────────────────────

        "The watchboard becomes a top-bar icon with an amber count and opens as
        a FULL-SCREEN SHEET, NEVER AS AN OVERLAY ON THE MAP." The same reasoning
        covers the composer, the activation panel and the timeline: a phone has
        no room for a drawer beside a map, and a translucent overlay would take
        the map away without admitting it. A full sheet is honest about where
        the reader is, and it has a way back.

        The activation panel is the one place mobile type goes UP, not down —
        §16 sets its assignment sentence at 17px, because that sentence is the
        whole argument for the transaction.
      */}
    </section>
  );
}
