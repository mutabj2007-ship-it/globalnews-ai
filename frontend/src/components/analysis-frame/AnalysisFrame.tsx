'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { buildAnalysisWorkspaceModel } from '../search/analysisDimensions';
import type { PrimaryDimensionKey } from '../search/analysisDimensions';
import { buildDimensionClaims } from '../search/analysisClaims';
import { AnalysisModeBadge } from '../search/AnalysisModeBadge';
import { useIsomorphicLayoutEffect } from '@/lib/hooks/useIsomorphicLayoutEffect';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { BriefRow, BRIEF_TITLE_ID } from './BriefRow';
import { CentreViewport, CENTRE_VIEWPORT_ID } from './CentreViewport';
import { DimensionPanel, DIMENSION_HEADING_ID } from './DimensionPanel';
import { IndexColumn } from './IndexColumn';
import { LocationDetail } from './LocationDetail';
import { LocationTop } from './LocationTop';
import { SourcesDock } from './SourcesDock';
import { SourcesReporting } from './SourcesReporting';
import { splitSynthesisParagraphs } from './briefModel';
import { buildBriefModel, buildBriefTelemetry } from './briefModel';
import { resolveFrameEvidence, type FrameEvidenceState } from './analysisFrameState';
import { TrustSummaryLine } from './TrustSummaryLine';
import { buildEvidenceGeography } from './evidenceGeography';
import { buildRelationalEvidence } from './relationalEvidence';
import { resolveLocationImage } from './locationAssets';
import { buildGeographicEvidenceState } from './geographicEvidenceState';
import {
  COMMAND_BAR_HEIGHT, frameHeightFor, framedHeightFor, opensCompressed, resolveColumns,
  resolveCompressed, resolveTracks, shouldClearForcedExpansion, type DockState,
} from './frameGeometry';

/**
 * P-01 — the Persistent Analysis Frame.
 *
 * THE ONLY COMPONENT THAT KNOWS THE FRAME'S DIMENSIONS (§2.3). Rows 1
 * and 3 are explicit pixel tracks; row 2 is `minmax(0,1fr)`. The centre's
 * height is therefore WHATEVER THE FRAME HAS LEFT — which is what makes
 * "expanding the dock reduces the centre" (F-6) fall out of the layout
 * rather than needing to be computed, and why no other track's offset
 * can move when the dock changes size.
 *
 * SCROLL OWNERSHIP (F-4, §5). `html` and `body` are set to
 * `overflow:hidden` for as long as this frame is mounted, and restored
 * on unmount. The page never scrolls. Every panel is `overflow:hidden`
 * with its own interior scroll where its content can exceed its track,
 * so no panel can push another. `scrollIntoView` is never called
 * anywhere in this directory.
 *
 * THE CENTRE'S SCROLL POSITION SURVIVES A TRACK RESIZE (§4.2). Read
 * before the change, restored in the same commit after it — a growing
 * brief must not move the claim being read.
 *
 * GEOGRAPHY. Column 3 is a pure function of `model.geography`, which
 * `resolveGeography()` derives from the retrieval context alone. Neither
 * `response.query` nor `normalizedQuery` is passed into it. See
 * RULING 1 and PAF test 15.
 */
type FrameStrings = ReturnType<typeof getDictionary>['analysisFrame'];

/* R4 — one entry per state, so a new state cannot silently reuse another
   state's sentence. `populated` never reaches these tables: the frame only
   consults them when there is no analysis to render. */
const STATE_HEADING: Readonly<Record<FrameEvidenceState, (t: FrameStrings) => string>> = {
  populated: (t) => t.stateAnalysisFailed,
  'no-question': (t) => t.stateNoQuestion,
  'no-evidence': (t) => t.stateNoEvidence,
  'provider-unavailable': (t) => t.stateProviderUnavailable,
  'analysis-failed': (t) => t.stateAnalysisFailed,
  'clarification-required': (t) => t.stateClarificationRequired,
};

const STATE_BODY: Readonly<Record<FrameEvidenceState, (t: FrameStrings) => string>> = {
  populated: (t) => t.analysisUnavailableExplanation,
  'no-question': (t) => t.stateNoQuestionBody,
  'no-evidence': (t) => t.stateNoEvidenceBody,
  'provider-unavailable': (t) => t.stateProviderUnavailableBody,
  'analysis-failed': (t) => t.analysisUnavailableExplanation,
  'clarification-required': (t) => t.stateClarificationRequiredBody,
};

export interface AnalysisFrameProps {
  response: AnalysisApiResponse;
  language?: LanguageCode;
  /**
   * §4.1 — `activeDimension` is linkable, so the frame accepts the
   * dimension it should open on. The route reads it from `?d=`; a spec
   * passes it directly.
   */
  initialDimension?: PrimaryDimensionKey;
  /** Test seam only. Defaults to the real window. */
  initialViewport?: { width: number; height: number };
  /**
   * Test seam only — the dock state the frame OPENS in. The user still
   * toggles it at runtime; this only decides the first paint, so that a
   * spec (and the screenshot harness) can evidence the expanded dock
   * without a DOM to click in. Defaults to `compact`, which is the
   * behaviour every other caller gets.
   */
  initialDock?: DockState;
  /** R1 ruling 7 — the page-level Back control. Absent = not rendered. */
  onBack?: () => void;
  onOpenRecord?: () => void;
  /**
   * PO C904 review, correction 2. Called INSTEAD of expanding the dock in
   * place, when the frame has measured that it cannot give the expanded cards
   * their height without destroying the reader. Absent means the frame has no
   * destination to offer and falls back to expanding in place.
   */
  onOpenSources?: () => void;
}

export function AnalysisFrame({
  response,
  language = 'en',
  initialDimension = 'brief',
  initialViewport,
  initialDock = 'compact',
  onBack,
  onOpenRecord,
  onOpenSources,
}: AnalysisFrameProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;

  const model = useMemo(() => buildAnalysisWorkspaceModel(response), [response]);
  /* R4 — why the analysis is absent, and what the records themselves say
     about geography. Both are pure derivations over the response; neither
     asks the backend for anything new. */
  const evidence = useMemo(() => resolveFrameEvidence(response, true), [response]);

  /*
   * R4.1 — the countries the retained reporting supports, aggregated from
   * the articles themselves rather than from the retrieval target. Built
   * once here and handed down, so the rail and the map cannot disagree
   * about what the evidence says.
   */
  const evidenceGeography = useMemo(() => buildEvidenceGeography(response), [response]);

  /*
   * R4.2 — relational evidence, grouped by articleId. Derived from the
   * response already fetched; this adds no request and no second analysis
   * state. Empty when the response carries none, which keeps the dock
   * byte-identical to R4.1 for every non-relational query.
   */
  const relational = useMemo(() => buildRelationalEvidence(response), [response]);

  /*
   * ── ALPHA CLOSURE: AN EMPTY IMAGE BOX MUST NOT COST THE BEST SPACE ───
   *
   * Row 1 column 3 is a 148px image surface. When no verified asset
   * exists for the resolved place — which is the ordinary case, since the
   * registry is small — it rendered a hatched placeholder reading
   * "NO VERIFIED LOCATION IMAGE", a caption, and nothing else, directly
   * above the evidence map. The real Australia analysis spent the top of
   * the rail saying it had no picture.
   *
   * So the decision is made HERE, at the grid, not inside the panel: with
   * no asset the location column becomes ONE cell spanning both rows, a
   * one-line truthful indicator replaces the box, and Evidence Geography
   * moves up into the space. With an asset, nothing changes.
   *
   * No imagery is fabricated in either branch, and the evidence map is
   * never replaced by decoration.
   */
  const locationImage = useMemo(() => {
    const geo = buildGeographicEvidenceState(response.retrievalContext);
    return {
      decision: resolveLocationImage({
        precision: geo.evidencePrecision,
        resolvedPlace: geo.evidenceCountryName,
      }),
      place: geo.evidenceCountryName,
    };
  }, [response]);
  const hasLocationImage = locationImage.decision.kind === 'asset';
  /* Null when geography is unresolved: there is then no place to name, and
     the indicator is suppressed entirely rather than left blank. */
  const locationPlaceName = locationImage.decision.kind === 'no-verified-asset'
    ? locationImage.place
    : null;
  const brief = useMemo(() => buildBriefModel(response), [response]);
  const telemetry = useMemo(
    () => buildBriefTelemetry(response, model.insufficientEvidence.totalCount),
    [response, model.insufficientEvidence.totalCount],
  );

  const [viewport, setViewport] = useState(
    initialViewport ?? { width: 1440, height: 900 },
  );
  const columns = resolveColumns(viewport.width);
  /*
    The bounded frame measures itself against the chrome it actually sits
    under (NavBar + command bar). The phone column has no bounded frame,
    so it keeps the specification's own `window - 48` and nothing about
    its behaviour moves.
  */
  const frameHeight = columns.frameApplies
    ? framedHeightFor(viewport.height, viewport.width)
    : frameHeightFor(viewport.height);

  const [activeDimension, setActiveDimension] = useState<PrimaryDimensionKey>(initialDimension);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dock, setDock] = useState<DockState>(initialDock);
  const [userForcedExpanded, setUserForcedExpanded] = useState(false);
  const [centreScrollTop, setCentreScrollTop] = useState(0);
  const [bandWidth, setBandWidth] = useState(900);
  const [highlightedArticleId, setHighlightedArticleId] = useState<string | null>(null);

  /*
   * R4.1 §6 — the active evidence country, derived from the selection
   * contract that ALREADY exists rather than a new one.
   *
   * `highlightedArticleId` is set by `onOpenSource`, which the dock and
   * the claim rows already call. Mapping it to a country is a lookup in
   * the model's own `articleIds`, so selecting a source highlights the
   * country that source supports without a refetch, without a second
   * analysis state, and without moving the reader off the claim.
   *
   * Null whenever the highlighted article resolved to no country — a
   * selection cannot manufacture geography the article does not have.
   */
  const activeEvidenceIso3 = useMemo(() => {
    if (highlightedArticleId === null) return null;
    const owner = evidenceGeography.countries.find((c) =>
      c.articleIds.includes(highlightedArticleId),
    );
    return owner?.iso3 ?? null;
  }, [highlightedArticleId, evidenceGeography]);

  /*
   * ── R4 §4 · COMPRESSION RESTORED, AND STILL EXEMPT ON THE PHONE ──────
   *
   * R1 ruling 10 dropped compression because ruling 1 had removed the
   * centre scroller that feeds it. The scroller is back (§2), so the
   * signal exists again and `resolveCompressed` — which was never
   * modified, only stopped being consulted — is wired to it once more.
   * Both causes, scroll position and constrained height, resolve through
   * that ONE function, so they cannot disagree (§4.2).
   *
   * THE PHONE STAYS EXEMPT, and that is not a concession. R4 §9 hands
   * widths below the frame to `08-MOBILE-TABLET`, and the compressed
   * tier truncates the headline to one ellipsised line by design; every
   * ordinary phone meets the height condition (375x844 gives a 796px
   * frame against the 852px threshold), so keying compression to
   * `frameApplies` is what keeps the finding that produced the R1 note
   * true rather than reversing it.
   *
   * `prevCompressed` exists only for §4.2's 30/60 hysteresis band, which
   * is defined in terms of the flag's previous value. It is adjusted
   * during render — React's documented pattern for state derived from
   * props with memory — rather than in an effect, so the band never
   * renders one frame behind the scroll that moved it.
   */
  const [prevCompressed, setPrevCompressed] = useState(() => opensCompressed(frameHeight));
  const compressed = columns.frameApplies
    ? resolveCompressed({
        centreScrollTop,
        userForcedExpanded,
        frameHeight,
        previousCompressed: prevCompressed,
      })
    : false;
  if (compressed !== prevCompressed) setPrevCompressed(compressed);

  const centreRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);
  const dockScrollRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<string>(activeDimension);
  const pendingScrollTop = useRef<number | null>(null);

  /*
   * ── H-ALPHA-1: THE DOCUMENT LOCK IS GONE ────────────────────────────
   *
   * R4's F-4 held `html` and `body` at `overflow:hidden` for as long as
   * this component was mounted, so that the frame owned every scroll.
   * Measured consequence on the live Alpha: a 600px wheel gesture over
   * the brief moved nothing — centre 0, frame 0, window 0 — at 375, 430,
   * 768 and 1440 alike, and the shell overhung the viewport by exactly
   * one NavBar (53px phone, 63px desktop), clipping 22px off the Sources
   * Dock at 375x844 and 768x800 with no gesture able to reach it.
   *
   * GN-ALPHA-UX-DESIGN-HANDOFF-R1 ruling 1 removes the lock for Surface
   * B. The page scrolls the way every other page does. Nothing replaces
   * this effect, because the correct amount of scroll machinery on a
   * document is none.
   *
   * SURFACE B IS THE ONLY CONSUMER — verified, not assumed:
   * `AnalysisFrameSurface` is mounted at exactly one call site
   * (`SearchPageClient.tsx`), and `frameGeometry.ts` is imported by this
   * file and its own specs and nothing else. Today/Watch has its own
   * `todayWorkspaceGeometry.ts` and is untouched by this change.
   */

  useEffect(() => {
    if (initialViewport !== undefined) return;
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [initialViewport]);

  /* 03 §2a / W-01 — measure the BAND's own border-box width. Never
     `viewport − column` (the column varies by breakpoint) and never
     `contentRect` (it excludes the 52px of padding and would fire every
     threshold one step early). */
  useEffect(() => {
    const node = bandRef.current;
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setBandWidth(node.getBoundingClientRect().width);
    });
    observer.observe(node);
    setBandWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  /* One flag, two causes (§4.2). */

  const onCentreScroll = useCallback((scrollTop: number) => {
    // Track heights are about to change; remember where the reader is.
    pendingScrollTop.current = scrollTop;
    setCentreScrollTop(scrollTop);
    if (shouldClearForcedExpansion(scrollTop)) setUserForcedExpanded(false);
  }, []);

  /* §4.2 — restore the centre's scroll position in the same commit as
     the track resize, so a growing brief never moves the claim being
     read. */
  /* R4 §9 — `useIsomorphicLayoutEffect` IS `useLayoutEffect` in the
     browser, so the pre-paint timing this restore depends on is
     unchanged. Only the server, where no layout phase exists and neither
     hook runs a body, takes the `useEffect` branch. That satisfies "no
     React server-render warning from useLayoutEffect" without touching
     scroll-restoration behaviour. */
  useIsomorphicLayoutEffect(() => {
    const node = centreRef.current;
    const target = pendingScrollTop.current;
    if (node !== null && target !== null && node.scrollTop !== target) {
      node.scrollTop = target;
    }
  }, [compressed, dock]);

  const tracks = resolveTracks({ frameHeight, compressed, dock });

  const entries = useMemo(
    () => buildDimensionClaims(response, activeDimension),
    [response, activeDimension],
  );

  const dimensionModel = model.dimensions.find((d) => d.key === activeDimension) ?? model.dimensions[0];

  const onSelectDimension = useCallback((key: PrimaryDimensionKey) => {
    setActiveDimension(key);
    headingRef.current = key;
    // §4.4 — the centre is REPLACED. Reset its scroll, preserve
    // `compressed`, `dock` and the whole right column.
    pendingScrollTop.current = 0;
    if (centreRef.current !== null) centreRef.current.scrollTop = 0;
    setCentreScrollTop(0);
    window.setTimeout(() => {
      document.getElementById(DIMENSION_HEADING_ID)?.focus();
    }, 0);
  }, []);

  const onOpenSource = useCallback((articleId: string) => {
    // §6 — expand the dock, bring the source into view by assigning
    // scrollTop, and highlight it. THE CLAIM DOES NOT MOVE, and focus
    // stays on the marker: nothing here calls focus().
    setDock('expanded');
    setHighlightedArticleId(articleId);
    window.setTimeout(() => {
      const container = dockScrollRef.current;
      const card = container?.querySelector<HTMLElement>(`[data-article-id="${articleId}"]`);
      if (container !== null && container !== undefined && card !== null && card !== undefined) {
        container.scrollTop = card.offsetTop - container.offsetTop;
      }
    }, 0);
    window.setTimeout(() => setHighlightedArticleId(null), 1200);
  }, []);

  /*
   * ── XS: THE PHONE COLUMN ─────────────────────────────────────────────
   *
   * THE DEFECT THIS CLOSES. `resolveColumns()` has always reported
   * `frameApplies: false` below 768px, with BOTH track widths null - its
   * own comment says "XS hands off to the mobile model; the frame does
   * not apply". Nothing read that flag. The template below had two
   * branches for three states, so XS fell into the desktop one and
   * interpolated the nulls, emitting the literal invalid declaration
   *
   *     grid-template-columns: nullpx minmax(0,1fr) nullpx
   *
   * A browser discards an invalid declaration but keeps the children's
   * own `grid-column` values, so it invented three implicit columns of
   * about 125px each. Measured at 375x844 before this repair:
   * `124.656px 124.672px 125.672px`. The desktop frame was not surviving
   * at phone width - it had already collapsed, and the three-column
   * wreckage was what reached the reader.
   *
   * `frameGeometry.ts` is NOT modified. It has returned the right answer
   * since it was written; this is the consumer that never listened.
   */
  const isPhone = !columns.frameApplies;

  /*
   * ── R4 §2 · THE DOCUMENT LOCK, AND WHY IT IS SCOPED ──────────────────
   *
   * `12-FOUR-SIDED-FRAME-GEOMETRY` §2 opens with
   * `html, body { height:100%; overflow:hidden }` — "the page never
   * scrolls". Product-Owner decision 4 authorises restoring it.
   *
   * It is applied by the frame and ONLY while the frame is in force, so
   * the phone column, every other route, and this component's own
   * unmount all get the document back exactly as they left it. The
   * previous values are captured rather than assumed empty, because a
   * route that had set its own would otherwise be cleared by us.
   *
   * This is the assertion the old invariant at `frameInvariants` :81
   * forbade. It is amended, not deleted: the thing that test protected —
   * that no region can trap the reader's scroll with no gesture able to
   * reach the content — is now protected by arithmetic instead. The
   * frame is `calc(100dvh - navbar)`, so there is no overhang to clip.
   */
  useEffect(() => {
    if (isPhone) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
    };
  }, [isPhone]);

  const gridTemplateColumns = columns.indexIsChipRow
    ? `minmax(0,1fr) ${columns.rightWidth}px`
    : `${columns.indexWidth}px minmax(0,1fr) ${columns.rightWidth}px`;

  /*
   * Track wrappers bound their content on the desktop grid, because a
   * fixed row must never be pushed by what is inside it. In the phone
   * column the opposite is true: every section takes its natural height
   * and the COLUMN scrolls, so the same wrappers must not clip.
   */
  /*
    A1 ADDENDUM B — THE RECORD'S SIZE, DERIVED ONCE.

    The Complete Analysis Record holds the retained reporting and its
    per-source provenance, so its size is the number of sources it can
    show. Used by the control's label, by its accessible name and by the
    passive existence line, so the three can never disagree.
  */
  const recordItemCount = model.sourceSupport.length;

  const trackClass = (desktop: string, phone: string): string => (isPhone ? phone : desktop);

  /*
   * The dock is a REGION, not a row, so that the phone layout can keep it
   * pinned below the reading column while the desktop grid keeps it as
   * row 3. Identical element, identical props, rendered in exactly one of
   * two places — never both, which a test asserts by counting it.
   *
   * On the phone it sits OUTSIDE the scroller: evidence is the anchor of
   * this screen, and an anchor that scrolls away is not one. Its height
   * is the same `tracks.dockHeight` the grid would have given it, so the
   * compact default and the 48px thumbnails are untouched.
   */
  const dockRegion = (
    <div
      data-paf="dock-track"
      /* R1 RULING 11 IS NOT REVERSED — the dock stays HORIZONTAL and is
         never stacked. What R4 §5 restores is its BOUNDS, not its shape:
         on the desktop grid it is row 3 at `tracks.dockHeight`, so
         expanding it takes space from the CENTRE and never from the page.
         On the phone it remains an ordinary last section at its natural
         height, below the reading column, outside any scroller.

         `min-w-0 overflow-hidden` is still HORIZONTAL containment and
         still load-bearing for the reason it was added: the card row is
         `overflow-x-auto` by design, and without this it sized the track
         to its content and pushed the page sideways — measured
         scrollWidth 490 against a 375 viewport in Polish. */
      className="min-w-0 shrink-0 overflow-hidden"
      style={
        isPhone
          ? undefined
          : { gridColumn: columns.indexIsChipRow ? '1 / 3' : '1 / 4', gridRow: '3', minHeight: 0 }
      }
    >
      {/*
        H-ALPHA-VISUAL-1 ITEM A — the reading path now carries the
        IMAGE-LED section. `SourcesDock` is NOT deleted: it is still the
        forensic/provenance view under the Complete Analysis Record,
        which is exactly what the authorization preserves it for. Its
        `dock` state and scroll ref remain wired for that destination.
      */}
      {/*
        ══ PO C904 REVIEW — THE INNER SCROLLBAR IS GONE, WITH NO CARVE-OUT ══

        This wrapper carried `overflow-y-auto` unconditionally on desktop. That
        was the scrollbar the Product Owner rejected: with the expanded dock
        capped below the height of its own cards, the only way to reach the
        source imagery was to scroll inside the dock.

        C904 removed it for ordinary viewports and KEPT it for very short ones.
        The review rejected that too, and rightly — a narrowed version of the
        rejected behaviour is still the rejected behaviour. There is now no
        case in which this region scrolls vertically:

          fits      -> the dock grows to the height the cards need, in place
          does not  -> `onExpand` opens the dedicated Sources destination

        `overflow-hidden` is HORIZONTAL containment and still load-bearing for
        the reason it was added: the card row is `overflow-x-auto` by design,
        and without this the track sized to its content and pushed the page
        sideways — measured scrollWidth 490 against a 375 viewport in Polish.
      */}
      <div
        data-paf-dock-fits={tracks.dockFitsContent}
        className={isPhone ? undefined : 'h-full min-h-0 overflow-hidden'}
      >
      <SourcesReporting
        sources={model.sourceSupport}
        highlightedArticleId={highlightedArticleId}
        relational={relational}
        language={language}
        /*
          DESIGN-C2 LOCK 2 is the DESKTOP navigation model. The section is
          given the frame's own measured width so its position readout is
          ABSENT from a phone's DOM rather than merely hidden in it —
          R1 RULING 1 forbids an "n OF m" basis anywhere on that surface.
        */
        initialViewportWidth={viewport.width}
        /*
          ══ PO C904 REVIEW, CORRECTION 2 — WHERE "EXPAND" GOES ═════════════

          The ruling's sequence is COMPACT -> explicit expand -> EXPANDED ->
          explicit collapse -> reading space restored, with no vertical
          scrollbar inside the Sources region at any point.

          On any frame that can hold the expanded cards, that sequence happens
          right here: the dock grows to fit and the centre yields. The measured
          exception is a frame too short for both, and there the ruling names
          the answer — the dedicated destination. So the SAME control leads to
          the same outcome by the only route the viewport allows, rather than
          silently degrading into the scroller that was rejected.
        */
        onExpand={() => {
          if (!tracks.dockFitsContent && onOpenSources !== undefined) {
            onOpenSources();
            return;
          }

          setDock('expanded');
        }}
        /*
          ── WHY THIS IS STILL `false`, AND WHAT IT COSTS ────────────────

          R3's collapse rule — "where insufficient vertical space exists,
          collapse to a labelled control and count rather than shrinking
          cards" — now has an imposed height to guard again, so applying
          `sourcesMustCollapse(tracks.dockHeight, …)` was the obvious move.
          MEASURED, IT REVERSES AN ACCEPTED CORRECTION: the compact track
          is 168px, a desktop card section is 34 + 300 = 334px, so the
          predicate is true at every ordinary viewport and the dock
          renders as a control with NO source imagery at all. The alpha
          closure raised this track to 168 precisely so that "compact
          means small, not hidden", and `sourcesReportingR3` asserts the
          images are present — it caught this immediately.

          So the strip stays, and the TRACK bounds it instead. R4 §5 says
          a compact dock clips its overflow.

          SUPERSEDED IN PART BY THE C904 REVIEW: the interior used to be
          given `overflow-y-auto` rather than `hidden`, because the one
          failure this frame must never reproduce is content that exists
          and cannot be reached — 22px of this same dock was unreachable
          at 375x844 before R1 ruling 1. That concern is now answered
          WITHOUT a scroller: content the dock cannot show is reached by
          the dedicated Sources destination, which the expand control
          opens whenever `dockFitsContent` is false. Nothing is
          unreachable and nothing scrolls vertically inside the dock.

          NAMED AS A DESIGN COLLISION RATHER THAN SOLVED BY A NEW NUMBER:
          R4 §5's compact dock is 78px of chips, the accepted C2 dock is a
          300px card strip, and 168px is the height the document model
          chose for it. Which of the three governs the bounded compact
          track is a Design decision and is reported, not invented.
        */
        collapsed={false}
      />
      </div>
    </div>
  );

  return (
    <div
      data-paf="shell"
      /*
       * ── R4 §2 · A VIEWPORT BOX AGAIN — BUT THE RIGHT ONE ────────────
       *
       * THE OLD BUG IS NOT BEING REINTRODUCED. It was `height:100vh` on a
       * shell that starts BELOW the NavBar, so the box was always exactly
       * one header taller than the space it had — measured +53px at
       * 375/430/768 and +63px at 1440 — and the overhang was clipped with
       * no gesture able to reach it. That is height arithmetic, not
       * geometry, and R1 ruling 1 discarded the frame to fix it.
       *
       * The correction is the arithmetic: `calc(100dvh - navbar)`.
       * `NavBar` renders a `h-[52px]` bar below the `cd-header` breakpoint
       * and a `h-[62px]` one at and above it, so the two subtrahends are
       * the two heights NavBar actually has — `navBarHeightContract.spec.ts`
       * asserts them against NavBar's own source so they cannot drift —
       * and the `cd-header:` variant switches between them in CSS. No
       * measurement, no magic number, and nothing to be wrong on the first
       * paint.
       *
       * `100dvh`, not `100vh`: on mobile browsers the dynamic unit tracks
       * the retracting toolbar, which is the other half of how the old box
       * overhung its space.
       *
       * The phone keeps the document (§9), including the safe-area bottom
       * padding, which a bounded frame must not have — inset padding
       * inside a fixed box steals height from the centre instead of
       * clearing chrome.
       */
      className={
        isPhone
          ? 'flex min-h-screen flex-col bg-[#05080d]'
          : 'flex h-[calc(100dvh-52px)] cd-header:h-[calc(100dvh-62px)] flex-col overflow-hidden bg-[#05080d]'
      }
      style={isPhone ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' } : undefined}
    >
      <div className="sr-only">
        <a href={`#${CENTRE_VIEWPORT_ID}`} data-paf="skip-analysis">{t.skipToAnalysis}</a>
        <a href="#gn-paf-location" data-paf="skip-location">{t.skipToLocationContext}</a>
      </div>

      <header
        data-paf="command-bar"
        role="banner"
        /* `min-w-0` + a truncating label: in Polish the Back word, the
           workspace label and the mode badge together exceed 375px, and
           without this the command bar — not the analysis — was what
           pushed the page sideways. Measured: shell scrollWidth 490. */
        className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2"
      >
        {/*
          R1 RULING 7 — A REAL BACK CONTROL.

          Measured on the live Alpha: NO back affordance existed on this
          surface at any viewport. The only "← ANALYSIS WORKSPACE" button
          lives INSIDE the Complete Record and Evidence Library
          destinations, so a reader who had reached the workspace had
          nothing on screen to leave with.

          44x44 is the FLOOR, declared in px rather than inherited, so a
          later type change cannot quietly shrink the hit area below it.
        */}
        {onBack === undefined ? null : (
          <button
            type="button"
            data-paf="workspace-back"
            onClick={onBack}
            className="-ml-2 flex min-h-[44px] min-w-[44px] items-center gap-[6px] rounded-[8px] px-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#a9bccf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
          >
            <span aria-hidden="true">←</span>
            {t.backLabel}
          </button>
        )}

        <span className="min-w-0 truncate font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.18em] text-[#54687f]">
          {dict.analysisWorkspace.workspaceLabel}
        </span>

        {/*
          R4 — LIVE-VS-MOCK LABELLING IS PERSISTENT, NOT DISCLOSED.

          The pre-R4 /search rendered AnalysisModeBadge unconditionally,
          in BOTH the analyzed and the not-analyzed branch, so execution
          mode was never something a reader had to go looking for.
          `m52aHardening.spec.ts` pins that as an invariant: the single
          source of live-vs-mock labelling is "never bypassed".

          When the frame became the default presentation the badge was
          reachable only inside Complete Record — one control away from a
          reader who had no reason to press it. A mock-mode analysis
          would then have read exactly like a live one. That is a
          truthfulness regression, not a layout question, so the badge is
          restored to a region §3.A makes permanent rather than to the
          disclosure.

          It is the SAME component, not a second label: one source of
          this claim, as the invariant requires.
        */}
        <div className="ml-auto shrink-0">
          <AnalysisModeBadge
            provenance={response.provenance}
            language={language}
            sizeClass="text-[12px] md:text-[11px]"
          />
        </div>
      </header>

      {/*
        ── R1 RULING 2: THE READER'S OWN QUESTION, VERBATIM ──────────────

        Measured on the live Alpha: the question was on screen at NO
        viewport, in NEITHER the success nor the zero-report state. The
        early return in `SearchPageClient` hands off to this frame and
        skips the only heading that carried it, and what replaced it was
        `analysis.headline` — the AI's sentence, not the user's.

        Rendered in FULL, never truncated: ruling 6 asks Edit to preserve
        the complete query, so the page must not be where it gets cut.

        WHY THIS DOES NOT BREAK RULING 1. That ruling forbids
        `response.query` reaching the LOCATION COLUMN, because a query
        must never be promoted into resolved geography — see this file's
        own header and PAF test 15. This is the document's title band; it
        carries no geographic claim, and `resolveGeography` still receives
        nothing but the retrieval context. `geoPrecisionFrame.spec.ts`
        continues to assert that, unchanged.
      */}
      <section
        data-paf="analysis-question"
        aria-label={dict.yourQuestion}
        className="shrink-0 border-b border-[#101923] px-4 pb-3 pt-1 md:px-5"
      >
        <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.16em] text-[#67e8f9]">
          {dict.yourQuestion}
        </p>
        {/*
          ── DESIGN-C2 LOCK 4, C2-18: "The question is the h1 and is 20px."

          IT WAS A <p>, AND THE <h1> WAS THE AI's HEADLINE. That inverted
          the document: the reader's own words were secondary markup while
          a generated sentence was the page title. The lock corrects the
          semantics as well as the size, so the thesis title in `BriefRow`
          drops to <h2> in the same change and the surface still has
          exactly one <h1>. Four of this lane's own specs pinned
          <h1 data-paf="thesis-title">; they are retargeted, and the
          supersession is declared in the CTO report rather than applied
          quietly.

          Phone carries the locked 20px/1.30/600. Desktop keeps its
          released 15px — Lock 4 is a PHONE scale and does not restate
          desktop, so nothing above 768 moves.
        */}
        <h1
          data-paf="analysis-question-text"
          className="mt-[6px] font-gn-sans text-[20px] font-semibold leading-[1.30] text-[#d5e1ee] md:text-[15px] md:font-normal md:leading-[1.45]"
        >
          {response.query}
        </h1>
      </section>

      {/*
        ── THE READING COLUMN / GRID (R1 RULINGS 1-3) ────────────────────

        No `100vh`, no clipping, no internal vertical scroller, and no
        fixed row template. Rows size to their content and the DOCUMENT
        scrolls, so the wheel works wherever the cursor happens to be —
        the defect testers described as "frozen" was that it did not.

        The phone keeps one full-width column. Desktop keeps the approved
        multi-column composition for the brief, index, reader and
        geography; only the row heights stop being pinned.

        My earlier XS repair made this element a bounded scroller under
        the previous ruling. R1 supersedes that half; the part that still
        matters — obeying `frameApplies`, so no `nullpx` template is ever
        emitted and the browser never invents three implicit columns — is
        unchanged and still asserted.
      */}
      <div
        data-paf="frame"
        data-layout={isPhone ? 'phone-column' : 'grid'}
        data-frame-applies={columns.frameApplies ? 'true' : 'false'}
        className={isPhone ? 'flex min-w-0 flex-col' : 'grid min-h-0 min-w-0 flex-1 overflow-hidden'}
        style={
          isPhone
            ? undefined
            : {
                gridTemplateColumns,
                /*
                  R4 §2 — rows 1 and 3 are explicit pixel tracks, row 2 is
                  `minmax(0,1fr)`. THE CENTRE'S HEIGHT IS NEVER ASSIGNED:
                  it is whatever the frame has left, which is the whole
                  mechanism behind "expanding the dock reduces the centre"
                  (F-6). `frameGeometry.resolveTracks` already decided both
                  pixel values and already clamps the dock so the centre
                  keeps its 240px floor — this is the consumer that stopped
                  reading it, not arithmetic being written twice.
                */
                gridTemplateRows: `${tracks.briefHeight}px minmax(0,1fr) ${tracks.dockHeight}px`,
              }
        }
      >
        {/* ROW 1 — brief spans index + centre; location sits beside it. */}
        <div
          ref={bandRef}
          data-paf="brief-track"
          /* R4 §2 — "every panel is `overflow:hidden` ... no panel can
             push another". On the phone column the opposite is required,
             so the containment is conditional rather than absolute. */
          className={isPhone ? 'shrink-0' : 'min-h-0 shrink-0 overflow-hidden'}
          style={isPhone ? undefined : { gridColumn: columns.indexIsChipRow ? '1 / 2' : '1 / 3', gridRow: '1' }}
        >
          {/*
            XS TAKES THE FULL BRIEF TIER, WHATEVER THE VIEWPORT HEIGHT.

            `compressed` is decided by height alone - `opensCompressed`
            is `frameHeight < 852`, and 375x844 gives 796 - so every
            ordinary phone opened the COMPRESSED tier, whose title is
            `truncate` by design (a single ellipsised line). That is
            correct on a short laptop, where the brief is a header band
            above a wide reader. On a phone the brief IS the top of the
            reading path, and a clipped headline is the first thing the
            reader sees.

            `BriefRow` is unmodified: it already renders a wrapping
            `<h1>` in its full tier. Only which tier the frame asks for
            changes, and only below 768px.
          */}
          <BriefRow
            brief={brief}
            telemetry={telemetry}
            evidenceMeter={model.evidenceMeter}
            /* LOCK 6 — the band carries it on desktop only; on phone it sits
               below the answer's first paragraph and nowhere else. */
            showTrustSummary={!isPhone}
            compressed={isPhone ? false : compressed}
            bandWidth={bandWidth}
            onToggleFull={() => setUserForcedExpanded((forced) => !forced)}
            language={language}
            recordItemCount={recordItemCount}
          />
        </div>

        {hasLocationImage ? (
          <aside
            id="gn-paf-location"
            data-paf="location-top"
            role="complementary"
            aria-label={t.locationRegion}
            className={
            isPhone
              ? 'min-w-0 shrink-0 border-t border-[#101923]'
              : 'min-w-0 shrink-0 border-l border-[#101923]'
          }
            style={isPhone ? undefined : { gridColumn: columns.indexIsChipRow ? '2' : '3', gridRow: '1', minHeight: 0, overflow: 'hidden' }}
          >
            <LocationTop retrievalContext={response.retrievalContext} compressed={compressed} language={language} />
          </aside>
        ) : null}

        {/* ROW 2 — index | centre | location detail */}
        {columns.indexIsChipRow || isPhone ? null : (
          <div
            /* §4 — the index is the one member that NEVER compresses, so
               it is also the one whose own interior must scroll rather
               than clip: "shrinking navigation to buy reading space
               trades away the one thing that lets the user leave". */
            className="min-h-0 min-w-0 overflow-y-auto"
            style={{ gridColumn: '1', gridRow: '2' }}
          >
            <IndexColumn
              dimensions={model.dimensions}
              activeDimension={activeDimension}
              onSelect={onSelectDimension}
              panelId={CENTRE_VIEWPORT_ID}
              focusedIndex={focusedIndex}
              onFocusedIndexChange={setFocusedIndex}
              language={language}
              onOpenRecord={onOpenRecord}
              recordItemCount={recordItemCount}
            />
          </div>
        )}

        <div
          /*
            `min-w-0` is load-bearing, not decoration. The Analysis Index
            renders as a horizontally scrolling chip row on the phone; its
            own container is `overflow-x-auto`, but a flex/grid CHILD
            defaults to `min-width:auto`, so before this the row sized
            this track to its content and pushed the whole PAGE sideways —
            measured scrollWidth 490 against a 375 viewport in Polish,
            whose chip labels ("Niewystarczające dowody") reach the edge
            first while English fitted by luck.

            Deliberately NOT `overflow-x-hidden`: per CSS, an element with
            one axis hidden computes the other axis to `auto`, which would
            manufacture exactly the nested vertical scroller R1 ruling 1
            forbids. `min-w-0` contains the row without touching the block
            axis at all.
          */
          className={isPhone ? 'flex min-w-0 flex-col' : 'flex min-h-0 min-w-0 flex-col overflow-hidden'}
          style={isPhone ? undefined : { gridColumn: columns.indexIsChipRow ? '1' : '2', gridRow: '2' }}
        >
          {/*
            R4 §7 — THE INDEX AT S, WHICH WAS RENDERING AS NOTHING.

            `resolveColumns()` has always reported `indexIsChipRow: true`
            at S, and `IndexColumn` has always accepted `variant="mobile"`
            to render exactly that chip row — but the frame branched on
            the flag to `null` and never rendered the alternative. So
            between 768px and 1071px the Analysis Index simply was not on
            the page.

            That was not only a navigation loss. The Complete Record
            control lives at the foot of this component, so at those
            widths the entire long-form record — and with it
            `analysis.confidence`, entities and topics, the full trust
            reasons and `sourceEntities` — had no reachable entry point
            at all. R4 §4 requires those to stay accessible at EVERY
            width, and §7 permits the index to become "tabs, drawers, or
            bounded docks" but never to be removed.

            The chip row sits above the centre and is `shrink-0`, so the
            centre remains the scrolling region (§6) and the pinned row
            heights in `frameGeometry` are untouched.

            `r4Responsive.spec.ts` now asserts the index and the record
            entry at all four §7 widths, which is what would have caught
            this: the preservation suite only ever ran at 1440.
          */}
          {columns.indexIsChipRow || isPhone ? (
            /*
              `overflow-x-clip`, not `overflow-x-hidden`. The chip row is
              horizontally scrollable inside `IndexColumn` (not a file this
              package may edit), and once the surface became a document its
              content sized this track and pushed the PAGE sideways —
              scrollWidth 490 against 375 in Polish, where the labels are
              longest. `clip` contains the inline axis WITHOUT forcing the
              block axis to `auto`, which is what `hidden` would do and
              what would manufacture the nested vertical scroller R1
              ruling 1 forbids. A test asserts that count stays at zero.
            */
            <div className="min-w-0 max-w-full shrink-0 overflow-x-clip border-b border-[#101923]">
              <IndexColumn
                dimensions={model.dimensions}
                activeDimension={activeDimension}
                onSelect={onSelectDimension}
                panelId={CENTRE_VIEWPORT_ID}
                focusedIndex={focusedIndex}
                onFocusedIndexChange={setFocusedIndex}
                variant="mobile"
                language={language}
                onOpenRecord={onOpenRecord}
                recordItemCount={recordItemCount}
              />
            </div>
          ) : null}

          <CentreViewport
            ref={centreRef}
            onScroll={onCentreScroll}
            labelledBy={DIMENSION_HEADING_ID}
            language={language}
            bounded={!isPhone}
          >
            {model.analysisUnavailable ? (
              /* R4 — FOUR REASONS, FOUR SENTENCES. Before R4 every absent
                 analysis rendered "RETRIEVAL SUCCEEDED · the retrieved
                 reporting below is unaffected", which is true only when
                 articles actually survived. A zero-article response said it
                 too, claiming a success that had not happened and pointing
                 at reporting that was not there. `resolveFrameEvidence`
                 reads `provenance.status` and `retrievalContext.dataMode`,
                 which the backend already distinguishes. */
              <section
                data-paf="analysis-unavailable"
                data-evidence-state={evidence.state}
                className="px-6 py-6"
              >
                {/*
                  ── MAIN-C2 HANDOFF, WIRED HERE AS AUTHORIZED ─────────────

                  Main resolved and tested the AI-provider-unavailable vs
                  answer-unusable distinction and shipped the EN/PL copy for
                  it, but the rendered sentence is chosen by the two
                  exhaustive tables above — this file, under active H work —
                  so Main left the value computed, correct and INERT rather
                  than crossing into it. This is that wiring.

                  The two are separated because a reader ACTS on them
                  differently: an unreachable provider is worth retrying, an
                  answer that failed validation is not. `stateAnalysisFailed`
                  stays the heading for the unusable case and the tables stay
                  the fallback for every path this does not cover, so nothing
                  regresses where the kind is null.
                */}
                <h2 id={DIMENSION_HEADING_ID} tabIndex={-1} className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#e0a33d]">
                  {evidence.analysisFailureKind === 'ai-provider-unavailable'
                    ? t.stateAiProviderUnavailable
                    : STATE_HEADING[evidence.state](t)}
                </h2>
                <p data-paf="analysis-unavailable-body" className="mt-3 max-w-[70ch] font-gn-sans text-[14px] leading-[1.6] text-[#d5e1ee]">
                  {evidence.analysisFailureKind === 'ai-provider-unavailable'
                    ? t.stateAiProviderUnavailableBody
                    : evidence.analysisFailureKind === 'ai-response-unusable'
                      ? t.stateAiResponseUnusableBody
                      : STATE_BODY[evidence.state](t)}
                </p>
              </section>
            ) : (
              <DimensionPanel
                key={activeDimension}
                dimension={dimensionModel}
                entries={entries}
                onOpenSource={onOpenSource}
                language={language}
                /*
                  DESIGN-C2 LOCK 6 — on phone the trust summary sits BELOW the
                  answer. For the Executive Brief that is immediately after
                  the first paragraph, inline below. For every other dimension
                  there is no "first paragraph" to sit under, so it takes the
                  panel's foot — still below the answer, never above it, and
                  never absent from a surface that has one.
                */
                footer={
                  isPhone && activeDimension !== 'brief' ? (
                    <TrustSummaryLine
                      meter={model.evidenceMeter}
                      telemetry={telemetry}
                      language={language}
                      placement="reading"
                      className="mt-5"
                    />
                  ) : undefined
                }
              >
                {activeDimension === 'brief' && brief.briefWithheld ? (
                  /*
                    ══════════════════════════════════════════════════════════
                    C907 CORRECTION 3 — THE BRIEF WAS REFUSED, AND SAYS SO
                    ══════════════════════════════════════════════════════════

                    `brief.paragraph` is the empty string here, because the
                    backend withheld the non-compliant summary rather than
                    transmitting it (see brief-fail-closed.util.ts). Without
                    this branch the synthesis block below would render a
                    single empty <p> — a silent gap where an answer should be,
                    which is the one outcome the ruling's "truthful
                    structured-analysis degradation state" rules out.

                    THE REST OF THE FRAME IS UNTOUCHED. Every other dimension,
                    the evidence meter, the telemetry row and the trust
                    summary all keep rendering the validated record. Only the
                    brief dimension states its own absence.
                  */
                  <div data-paf="brief-withheld" className="mt-3 flex max-w-[70ch] flex-col gap-[0.6em]">
                    <p className="font-gn-mono text-[11px] uppercase tracking-[0.08em] text-[#f0b866]">
                      {t.briefWithheldHeading}
                    </p>
                    <p className="font-gn-sans text-[16px] leading-[1.6] text-[#d5e1ee] md:text-[15px] md:leading-[1.65]">
                      {t.briefWithheldBody}
                    </p>
                    {/*
                      The backend's own measured statement of the defect,
                      verbatim. It names counts the reader can check against
                      the telemetry row; it is never presented as the brief.
                    */}
                    {brief.briefWithheldReason !== null ? (
                      <p className="font-gn-sans text-[13px] leading-[1.55] text-[#93a6b8]">
                        {brief.briefWithheldReason}
                      </p>
                    ) : null}
                    {isPhone ? (
                      <TrustSummaryLine
                        meter={model.evidenceMeter}
                        telemetry={telemetry}
                        language={language}
                        placement="reading"
                      />
                    ) : null}
                  </div>
                ) : activeDimension === 'brief' ? (
                  /*
                    ── H-ALPHA-VISUAL-1 H-2 — THE FULL SYNTHESIS, READABLE ──

                    The Executive Brief is the sole home of the complete
                    summary, and Main's evidence-proportional synthesis
                    produces MULTIPLE PARAGRAPHS for 3-5 and 6+ report
                    reports. A single <p> would have run them together
                    into one unbroken slab, which is a different way of
                    making a long synthesis unreadable.

                    So the verbatim string is SPLIT ON BLANK LINES for
                    layout only. Nothing is re-summarised, nothing is
                    sliced, nothing is reordered, and no clamp is applied
                    at any viewport — `splitSynthesisParagraphs` is a pure
                    function and the specs prove the rejoined output is
                    the input.

                    DESIGN-C2 LOCK 4 — C2-17: the answer body is EXACTLY
                    16px with leading >=1.6 on phone, and paragraphs are
                    spaced 1.1em rather than a fixed 12px. Desktop keeps
                    its released 15px/1.65.
                  */
                  <div data-paf="brief-synthesis" className="mt-3 flex max-w-[70ch] flex-col gap-[1.1em] md:gap-3">
                    {splitSynthesisParagraphs(brief.paragraph).map((para, i) => (
                      <Fragment key={i}>
                        <p
                          data-paf="brief-synthesis-paragraph"
                          className="font-gn-sans text-[16px] leading-[1.6] text-[#d5e1ee] md:text-[15px] md:leading-[1.65]"
                        >
                          {para}
                        </p>
                        {/*
                          DESIGN-C2 LOCK 6 / C2-26 — the trust summary's rect
                          top must be BELOW the first paragraph's rect bottom
                          on phone. This is that position, expressed as DOM
                          order rather than as a measurement to hope for. It
                          renders once, after paragraph index 0, and only on
                          phone; desktop keeps it in the band.
                        */}
                        {isPhone && i === 0 ? (
                          <TrustSummaryLine
                            meter={model.evidenceMeter}
                            telemetry={telemetry}
                            language={language}
                            placement="reading"
                          />
                        ) : null}
                      </Fragment>
                    ))}
                  </div>
                ) : undefined}
              </DimensionPanel>
            )}
          </CentreViewport>
        </div>

        <aside
          /* With no verified image the row-1 cell is not rendered, so this
             cell becomes the skip-link target and spans both rows. */
          id={hasLocationImage ? undefined : 'gn-paf-location'}
          data-paf="location-detail-track"
          role="complementary"
          aria-label={t.locationRegion}
          /*
            BLOCK, NOT FLEX — the screenshot is what caught this.
            `LocationDetail`'s own root is `min-h-0 flex-1 overflow-auto`.
            Inside an auto-height FLEX column that resolves to
            `flex: 1 1 0%`, so the section collapsed to an 81px sliver
            with the map gone, while every width measurement still said
            "full width, present". As a block it takes its natural
            height. Now that the whole surface is a document this applies
            at every width, not only on the phone.
          */
          className={
            isPhone
              ? 'min-w-0 shrink-0 border-t border-[#101923]'
              : 'flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-l border-[#101923]'
          }
          style={
            isPhone
              ? undefined
              : {
                  gridColumn: columns.indexIsChipRow ? '2' : '3',
                  gridRow: hasLocationImage ? '2' : '1 / 3',
                }
          }
        >
          {/*
            The one line that replaced a 148px hatched box.

            It carries the SAME two statements the box made — the location
            context and that no verified image exists — so nothing the
            reader was told is lost; only the empty space is. It keeps the
            `location-top` region marker, because this IS the location
            column's top content when the image collapses, and it sits
            above `location-detail` so the region's reading order is
            unchanged.

            The marker itself persists even when geography is UNRESOLVED
            and there is no place to name — PAF-1 requires the location
            surface to survive that state, and the pre-alpha `LocationTop`
            did exactly this: it rendered its container with the image
            suppressed inside. Only the TEXT is conditional, because a
            chip reading "LOCATION CONTEXT ·" with nothing after it would
            be worse than no chip at all.
          */}
          {hasLocationImage ? null : (
            <div
              data-paf="location-top"
              data-variant="collapsed"
              className={
                locationPlaceName === null
                  ? 'flex-shrink-0'
                  : 'flex-shrink-0 border-b border-[#101923] px-4 pb-[6px] pt-2'
              }
            >
              {locationPlaceName === null ? null : (
                <p className="flex items-baseline gap-[6px] truncate font-gn-mono text-[12px] md:text-[11px] uppercase leading-[1.5] tracking-[0.12em] text-[#54687f]">
                  <span aria-hidden="true" className="inline-block h-[4px] w-[4px] shrink-0 translate-y-[-1px] rounded-full bg-[#3a4a5d]" />
                  <span className="min-w-0 truncate">
                    {t.locationContextChip} · {locationPlaceName}
                    <span className="text-[#4a5c73]"> · {t.noVerifiedLocationImage}</span>
                  </span>
                </p>
              )}
            </div>
          )}

          <LocationDetail
            retrievalContext={response.retrievalContext}
            evidence={evidenceGeography}
            activeIso3={activeEvidenceIso3}
            insufficientEvidence={model.insufficientEvidence}
            compressed={compressed}
            dense={dock === 'expanded'}
            language={language}
          />
        </aside>

        {isPhone ? null : dockRegion}
      </div>

      {isPhone ? dockRegion : null}
    </div>
  );
}

export { BRIEF_TITLE_ID, CENTRE_VIEWPORT_ID };
