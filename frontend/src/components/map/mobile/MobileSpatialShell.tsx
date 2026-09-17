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
import { useSelectionCamera } from '@/lib/map/camera/useSelectionCamera';
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
  FULL_FRACTION,
  HALF_FRACTION,
  MIN_TOUCH_PX,
  PEEK_HEIGHT_PX,
  type SheetStop,
} from './MobileBottomSheet';
import { MobilePlaceSearch } from './MobilePlaceSearch';
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
  const stopRef = useRef<SheetStop>(stop);
  stopRef.current = stop;

  const fitInset = useCallback(() => {
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;

    if (viewportHeight <= 0) return { top: PERMANENT_HUD_PX };

    const current = stopRef.current;
    const sheet =
      current === 'PEEK'
        ? PEEK_HEIGHT_PX
        : current === 'HALF'
          ? Math.floor(viewportHeight * HALF_FRACTION)
          : Math.floor(viewportHeight * FULL_FRACTION);

    return { top: PERMANENT_HUD_PX, bottom: sheet };
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
        setStop('HALF');

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
      /* A tap on a country is a request to read about it: meet it half way. */
      setStop((current) => (current === 'PEEK' ? 'HALF' : current));
    },
    [onSelectCountry],
  );

  const items = selectionDetail?.items ?? [];
  const provider = selectionDetail?.providerStatus;
  const coverage = selectionDetail?.coverage;
  const identity = selectionDetail?.identity;
  const hasSelection = selectedIso3 !== null && displayName !== null;

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
        style={{ bottom: stop === 'PEEK' ? PEEK_HEIGHT_PX + 16 : `calc(${HALF_FRACTION * 100}dvh + 16px)` }}
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

      <MobileBottomSheet
        stop={stop}
        onStopChange={setStop}
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
            {/* ── PEEK · who, how much, what state ─────────────────────── */}
            <header data-gn="mobile-sheet-identity" className="pt-[2px]">
              <h2 className="text-[19px] font-semibold leading-tight text-sp-ink">{displayName}</h2>
              <p className="mt-[3px] font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ink-3">
                {identity?.iso3}
                {identity?.region ? ` · ${identity.region}` : ''}
              </p>
            </header>

            <div
              data-gn="mobile-sheet-counts"
              className="mt-[10px] grid grid-cols-3 gap-px border-y border-sp-line bg-sp-line"
            >
              {[
                [selectedTotal?.reportCount ?? 0, spatial.card.reports],
                /*
                  CHECKPOINT H — `?? 0` was the worst of the three fallbacks: it
                  asserted that zero outlets reported, for a geography whose
                  publishers simply were not counted. Distinct publishers, or
                  an em dash.
                */
                [selectedTotal?.publisherCount ?? null, spatial.card.sources],
                [selectedTotal?.newSinceLastVisit ?? 0, spatial.card.newSince],
              ].map(([value, label]) => (
                <div key={String(label)} className="bg-sp-panel px-[8px] py-[8px]">
                  <b className="block font-gn-mono text-[17px] leading-none text-sp-cyan">{value}</b>
                  <span className="mt-[4px] block font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-ink-3">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {provider && (
              <p
                data-gn="mobile-sheet-provider"
                className="mt-[9px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-2"
              >
                {spatial.card.provider[provider.condition === 'LIVE' ? 'live' : provider.condition === 'DELAYED' ? 'delayed' : 'none']}
                {provider.providerName ? ` · ${provider.providerName}` : ''}
              </p>
            )}

            {/*
              STATE B — THE QUIET MINT GLYPH AT PEEK. §16.1 B lists it beside
              identity, precision, provenance, evidence count and the state chip.

              It is the SAME control as the primary at HALF, in its stage-2
              treatment: §6.1a gives stage 2 its own shape deliberately —
              "recognisable, not loud" — so the glyph and the button are one
              ladder, not two controls. Only one is ever mounted.
            */}
            {stop === 'PEEK' && (
              <div data-gn="mobile-peek-watch" className="mt-[10px]">
                <WatchCta
                  stage={watchStage}
                  labels={spatial.monetization.watch}
                  onOpenComposer={() => openSheetSurface('watchComposer')}
                />
              </div>
            )}

            {/* ── HALF · the actions, then the newest reporting ─────────── */}
            {stop !== 'PEEK' && (
              <div data-gn="mobile-sheet-actions" className="mt-[12px] flex flex-col gap-[8px]">
                {/*
                  §16 — WATCH IS THE PRIMARY AT HALF, full width, 44px minimum,
                  and it sits ABOVE Follow. The ordering is the point: the
                  standing assignment first, the feed filter beneath it, so the
                  two never read as variants of one control.
                */}
                <WatchCta
                  stage={watchStage}
                  labels={spatial.monetization.watch}
                  onOpenComposer={() => openSheetSurface('watchComposer')}
                />

                {follow && (
                  <FollowControl
                    geographyId={follow.countryIso3}
                    geographyLabel={displayName}
                    isWatched={follow.isFollowed}
                    isPending={follow.isPending}
                    hasFailed={follow.hasFailed}
                    labels={spatial.card.follow}
                    onToggle={(id, next) => (next ? follow.onFollow(id) : follow.onUnfollow(id))}
                  />
                )}

                {/*
                  §16 — THE TIMELINE IS A FULL-DETENT SURFACE. One line here,
                  opening a full sheet; never an expansion inside the sheet,
                  which would make the detent heights meaningless.
                */}
                {/*
                  ══ R2 §16.1 STATES H1 · H2 · THE DECK AND THE COST GATE ══════

                  §16.1 assigns the action deck to FULL. It is TEMPORARY —
                  collapsed by default, dismissing to the previous state with
                  nothing spent — and on compact it confirms ONE ACTION AT A
                  TIME: choosing one opens the cost prompt rather than running
                  it, because a list of eight priced controls on a 390px screen
                  is a place to mis-tap, and a mis-tap that spends compute is the
                  one mistake this gate exists to prevent.
                */}
                {stop === 'FULL' && costPromptAction === null && (
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
                      /*
                        NO `onRun`. GlobalNewsAI HAS an Analysis system; what
                        is missing is the MONETIZED DEEP ANALYSIS ACTIVATION
                        AND ENTITLEMENT CONTRACT, so no paid Run may be
                        started from here. The Run control renders disabled and
                        says that exact reason. Wiring it to a handler that
                        opened the workspace would spend nothing but would
                        claim an analysis had started.
                      */
                    />
                  </div>
                )}

                {stop === 'FULL' && (
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
                )}

                <div className="grid grid-cols-2 gap-[8px]">
                  <button
                    type="button"
                    data-gn="mobile-action-analysis"
                    disabled={!onOpenAnalysis || selection === null}
                    onClick={() => selection && onOpenAnalysis?.(selection)}
                    style={{ minHeight: MIN_TOUCH_PX }}
                    className="border border-sp-cyan/45 bg-sp-cyan/[0.14] px-[10px] font-gn-mono text-[10px] uppercase tracking-[0.12em] text-sp-cyan disabled:opacity-[.35]"
                  >
                    {spatial.card.actions.openAnalysis}
                  </button>
                  <button
                    type="button"
                    data-gn="mobile-action-sources"
                    disabled={!onOpenSources || selection === null}
                    onClick={() => selection && onOpenSources?.(selection)}
                    style={{ minHeight: MIN_TOUCH_PX }}
                    /* v1.6 AVAILABLE — a working action, readable before it is touched. */
                    className={`px-[10px] font-gn-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-[.35] ${BAND_AVAILABLE}`}
                  >
                    {spatial.card.actions.openSources}
                  </button>
                </div>
              </div>
            )}

            {stop !== 'PEEK' && coverage && (
              <p
                data-gn="mobile-sheet-coverage"
                className="mt-[12px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-2"
              >
                {spatial.card.coverage.bands[coverage.band]}
                {coverage.publisherCount > 0
                  ? ` · ${coverage.publisherCount} ${spatial.card.coverage.publishers}`
                  : ''}
              </p>
            )}

            {/* ── HALF shows the newest; FULL shows the retained set ────── */}
            {stop !== 'PEEK' && items.length > 0 && (
              <section data-gn="mobile-sheet-stories" className="mt-[14px]">
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

            {/* ── FULL · the tail the phone only shows when asked ───────── */}
            {stop === 'FULL' && (
              <button
                type="button"
                data-gn="mobile-clear-selection"
                onClick={() => onSelectionChange?.(null)}
                style={{ minHeight: MIN_TOUCH_PX }}
                /* v1.6 AVAILABLE. It was on the disabled ink and looked inert. */
                className={`mt-[14px] w-full px-[10px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] ${BAND_AVAILABLE}`}
              >
                {mobile.clearSelection}
              </button>
            )}
          </>
        )}
      </MobileBottomSheet>

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
