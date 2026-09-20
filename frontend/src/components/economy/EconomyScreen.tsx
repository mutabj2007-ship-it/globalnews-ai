'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { AttentionRow, EconomySubject, Series } from '@/lib/economy/types';
import type { RetainedObservation } from '@/lib/economy/economyObservationRead';
import { figureIsObservation } from '@/lib/economy/economyAdapters';
import { seriesId, seriesName } from '@/lib/economy/types';
import {
  ATTENTION_RAIL_PX, ECONOMY_BREAKPOINTS, ECONOMY_PAGE_CAP_PX,
  DEV_ECONOMY_AI_CONFIG, SPATIAL_CAPABILITY, DEV_WATCH_RUNTIME, ECONOMY_DATA_CAPABILITY,
  meteredActionCost,
} from '@/lib/economy/economyConfig';
import type {
  EconomyAiConfig, EconomyDataCapability, SpatialCapability, WatchRuntimeCapability,
} from '@/lib/economy/economyConfig';
import {
  FixtureBanner, NoObservationData, ObservationAbsenceDetail, observationMode,
} from './DataAvailability';
import {
  GeographyKeys, PeriodContext, ProvenanceLine, QuietPlot, QuietStatement, QuietTriad,
} from './QuietFrame';
import { EconomicStateHeader } from './EconomicStateHeader';
import { AttentionQueue } from './AttentionQueue';
/*
  B4-A — THE SHARED STRIP IS THE ENDPOINT.

  This imported the Economy-local `./IndicatorStrip`, which was not recovered:
  §21 forbids a domain copy of a shared component, and canonical had built one
  before the platform existed. The four behaviours that copy genuinely had —
  the width-derived cell count, per-cell selection, the magnitude question and
  the direction vocabulary — were migrated into the shared component and its
  configuration rather than re-landed here.

  `economyIndicatorStrip` translates Economy's `Series` into the platform's
  `ObservedIndicator`, so the shared component never learns an Economy word.
*/
import { ObservedIndicatorStrip } from '@/components/specialist/ObservedIndicatorStrip';
import { economyIndicatorStrip } from '@/lib/economy/economyIndicatorStripAdapter';
import { INDICATOR_CELL_MAX_PX } from '@/lib/economy/economyConfig';
import { AnchoredHud } from './AnchoredHud';
import { EconomyDrawer, DRAWER_WIDTH_PX } from './EconomyDrawer';
import type { DrawerKind } from './EconomyDrawer';
import {
  CompetingReadings, EconomyTimeline, PolicyEventDetail, RevisionTrack,
  TransmissionChain, WatchConfiguration,
} from './DrawerContents';
import { CorridorPanel, IntelligenceStatement, MiniMap, SeriesChart, Triad } from './Substrate';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SANS, ECON_SURFACE } from './econTokens';
import { ObservedIdentityContext } from './ObservedIdentityContext';

/**
 * ECON-UI-1 — THE DESKTOP ECONOMY SURFACE.
 *
 * ONE FRAME, MANY STATES. The fourteen Phase 2 desktop states are not fourteen screens:
 * they are this frame with a different substrate, a different open disclosure surface, or
 * a different subject. "The substrate switches; the frame does not."
 *
 * FIRST-VIEWPORT ZONING. Every resident region answers exactly one of the five questions,
 * and a region that answers none is not resident:
 *
 *   economic state header  Q3  what is the current economic assessment
 *   primary substrate      —   the subject itself
 *   attention queue        Q1+Q2  what changed · which indicators deserve attention
 *   indicator strip        Q2  5–7 maximum
 *   policy & release lane  Q4  what policy or event relates to the change
 *   watch & next step      Q5  what to inspect or Watch next
 *
 * Evidence, timeline, relationships and sources are REACHABLE, NOT RESIDENT. Extra width
 * is not permission to make them resident — see the breakpoint table, which grants a
 * longer window, one more indicator cell and more map area, and nothing else.
 *
 * ZERO-AI: nothing in this component invokes a metered action. Selection, range change,
 * substrate switching, drawer opening and HUD opening are all local state.
 */
export interface EconomyScreenProps {
  subject: EconomySubject;
  locale: EconomyLocale;
  /**
   * Frame width. Drives gutters, indicator cell count and the series window — nothing else.
   *
   * OMIT IT IN PRODUCTION. When omitted the frame MEASURES ITSELF and the breakpoint table
   * follows the real width, which is what the responsive rulings actually require. Passing
   * a number pins the frame, which is what a deterministic test wants; a pinned frame that
   * disagrees with the viewport is a test harness, not a layout.
   */
  frameWidth?: number;
  ai?: EconomyAiConfig;
  spatial?: SpatialCapability;
  /**
   * ECON-DATA-1 — observation availability. Defaults to the MEASURED production-shaped
   * capability, which is NO_OBSERVATION_SOURCE. A caller must name FIXTURE explicitly to
   * put fixture figures on screen; no code path arrives there by omission.
   */
  data?: EconomyDataCapability;
  watchRuntime?: WatchRuntimeCapability;
  /** Deterministic initial surface, so every Phase 2 state is directly reachable in a test. */
  initialDrawer?: DrawerKind | null;
  initialHudOpen?: boolean;
  revisionVintages?: Parameters<typeof RevisionTrack>[0]['vintages'];
  revisionEffects?: Parameters<typeof RevisionTrack>[0]['assessmentEffects'];
  competing?: Parameters<typeof CompetingReadings>[0]['set'];
  chain?: Parameters<typeof TransmissionChain>[0]['links'];
  timeline?: Parameters<typeof EconomyTimeline>[0]['entries'];
  onRequestWorkspace?: (actionId: string) => void;
  /** The one retained observation backing this preview, for truthful source disclosure. */
  retainedObservation?: RetainedObservation;
}

/** The breakpoint row for a width. Never interpolated — these are rulings, not a curve. */
export function breakpointFor(width: number) {
  let row = ECONOMY_BREAKPOINTS[0]!;
  for (const b of ECONOMY_BREAKPOINTS) if (width >= b.minWidth) row = b;
  return row;
}

export function EconomyScreen({
  subject, locale, frameWidth,
  ai = DEV_ECONOMY_AI_CONFIG,
  spatial = SPATIAL_CAPABILITY,
  data = ECONOMY_DATA_CAPABILITY,
  watchRuntime = DEV_WATCH_RUNTIME,
  initialDrawer = null,
  initialHudOpen = false,
  revisionVintages, revisionEffects, competing, chain, timeline,
  onRequestWorkspace, retainedObservation,
}: EconomyScreenProps): JSX.Element {
  const t = economyStrings(locale);

  /*
    SELF-MEASUREMENT. The frame's own width — after the 1920 cap — is what the breakpoint
    table reads, not the window and not a prop guess. Above the cap the frame stops at
    1920 and centres, so the measured value stops at 1920 too and no ultra-wide row is
    ever needed.

    The measured element's WIDTH is not affected by anything the breakpoint row changes:
    the row changes inner padding, cell count and window length. So there is no feedback
    loop between the measurement and what it drives.
  */
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  useEffect(() => {
    if (frameWidth !== undefined) return;
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = (): void => setMeasuredWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frameWidth]);

  /** Pinned width wins; otherwise the measurement; otherwise the narrowest row. */
  const effectiveWidth = frameWidth ?? measuredWidth ?? ECONOMY_BREAKPOINTS[0]!.minWidth;
  const bp = useMemo(() => breakpointFor(effectiveWidth), [effectiveWidth]);
  const mode = observationMode(data);
  /** Fixture figures are figures. They are shown, and the frame declares itself. */
  const showFigures = mode !== 'NO_SOURCE';

  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | undefined>(
    subject.primarySeries ? seriesId(subject.primarySeries) : undefined,
  );
  const [selectedAttentionId, setSelectedAttentionId] = useState<string | undefined>(undefined);
  /** ONE drawer. There is no stack; opening another replaces this value. */
  const [drawer, setDrawer] = useState<DrawerKind | null>(initialDrawer);
  /** ONE hud. Same reason. */
  const [hudOpen, setHudOpen] = useState(initialHudOpen);

  const selectIndicator = useCallback((s: Series) => {
    // Selection only. No metered call, no fetch, no analysis.
    setSelectedIndicatorId(seriesId(s));
  }, []);
  const selectAttention = useCallback((r: AttentionRow) => setSelectedAttentionId(r.id), []);
  const openDrawer = useCallback((k: DrawerKind) => {
    setDrawer(k);
    // A drawer replaces the secondary region; a HUD may not survive beside it.
    setHudOpen(false);
  }, []);

  const primary = subject.primarySeries;
  const observedIndicatorCount = subject.indicators.filter((series) => figureIsObservation(series.latest)).length;
  const hasRevisionTrack = (revisionVintages?.length ?? 0) > 0 && revisionEffects !== undefined;
  const hasCompetingReadings = competing !== undefined;
  const hasTransmissionChain = (chain?.length ?? 0) > 0;
  const hasTimeline = (timeline?.length ?? 0) > 0;
  const hasPolicyEvent = subject.policyLane.length > 0;
  const watchAvailable = watchRuntime.acceptsLifecycleTriggers;
  const analysisAvailable = showFigures && onRequestWorkspace !== undefined;
  const drawerWidth = drawer ? DRAWER_WIDTH_PX[drawer] : ATTENTION_RAIL_PX;

  const triadExplanation =
    primary?.triad && figureIsObservation(primary.triad.actual)
      ? 'Actual is the retained official observation. Expected and previous values are not retained, so no surprise or comparative assessment is shown.'
      : 'No observation triad is available for this subject.';

  const microLabel = {
    fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))',
    textTransform: 'uppercase' as const, color: ECON_INK.label,
  };

  return (
    <div
      ref={frameRef}
      data-econ="economy-screen"
      data-frame-width={effectiveWidth}
      data-frame-width-source={frameWidth === undefined ? 'measured' : 'pinned'}
      data-gutter={bp.gutterPx}
      data-indicator-cells={bp.indicatorCells}
      data-window-months={bp.seriesWindowMonths}
      data-substrate={subject.substrate}
      data-observation-mode={mode}
      dir="ltr"
      style={{
        // Page caps at 1920 and centres beyond it. No ultra-wide stretch.
        width: '100%', maxWidth: `${ECONOMY_PAGE_CAP_PX}px`, marginInline: 'auto',
        minHeight: '100%', background: ECON_SURFACE.ground, color: ECON_INK.primary,
        fontFamily: ECON_SANS, display: 'flex', flexDirection: 'column',
        // no horizontal overflow at any width
        overflowX: 'hidden',
      }}
    >
      {mode === 'FIXTURE' && <FixtureBanner locale={locale} />}
      <EconomicStateHeader
        subject={subject} locale={locale} gutterPx={bp.gutterPx}
        observationsAvailable={showFigures}
      />

      <div
        data-econ="body-grid"
        style={{
          flex: '1 1 auto', minHeight: 0, display: 'grid',
          gridTemplateColumns: `minmax(0, 1fr) ${drawerWidth}px`,
          gap: '1px', background: ECON_LINE.structure,
        }}
      >
        {/* ---- PRIMARY SUBSTRATE. Absorbs all remaining width as 1fr. ---- */}
        <div
          data-econ="substrate"
          style={{ background: ECON_SURFACE.ground, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
        >
          <div style={{ flex: '1 1 auto', padding: `18px ${bp.gutterPx}px`, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, minWidth: 0 }}>
            {subject.substrate === 'MAP_DOMINANT' && subject.corridor ? (
              <>
                {showFigures ? (
                  <IntelligenceStatement text={subject.assessment.statement} />
                ) : (
                  <QuietStatement locale={locale} />
                )}
                <div style={{ display: 'flex', gap: '1px', background: ECON_LINE.structure, flex: '1 1 auto', minHeight: 0 }}>
                  <CorridorPanel
                    corridor={subject.corridor} capability={spatial.corridorRendering}
                    locale={locale} observationsAvailable={showFigures}
                  />
                </div>
              </>
            ) : (
              /*
                ONE COMPOSITION, TWO VALUE STATES — NOT TWO LAYOUTS.

                This branch used to fork into a populated frame and a no-observation panel
                that REPLACED it, so the dashboard the Product Owner is asked to approve
                existed only on the fixture route. It is now the same region in both
                states: the same caption row, the same statement slot at the same size and
                measure, the same triad geometry, the same plot well. Only the figure is
                withheld, and the note beside it says why.

                Regions D and E — the governed geography keys and the period/frequency
                context — are resident in BOTH states, because `geo` and `freq` are pinned
                dimensions of the series identity rather than properties of an observation.
                A reader can see which geography a figure would belong to before one exists,
                and that is the whole point of the distinction the contract draws.
              */
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={microLabel}>{t.seriesLabel} · {primary ? seriesName(primary) : subject.name}</span>
                  <span style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)' }}>{bp.seriesWindowMonths}M window</span>
                </div>
                {showFigures ? (
                  <IntelligenceStatement text={subject.assessment.statement} sizePx={hudOpen ? 22 : 24} />
                ) : (
                  <QuietStatement locale={locale} sizePx={hudOpen ? 22 : 24} />
                )}
                {showFigures ? (
                  primary?.triad && (
                    <Triad
                      triad={primary.triad} locale={locale}
                      selected={hudOpen} showSurprise={!hudOpen}
                      cellBasisPx={effectiveWidth >= 1512 ? 150 : 130}
                    />
                  )
                ) : (
                  <QuietTriad locale={locale} cellBasisPx={effectiveWidth >= 1512 ? 150 : 130} />
                )}
                {showFigures ? (
                  primary && <SeriesChart series={primary} windowMonths={bp.seriesWindowMonths} locale={locale} />
                ) : (
                  <QuietPlot
                    locale={locale}
                    caption={primary ? seriesName(primary) : subject.name}
                    windowMonths={bp.seriesWindowMonths}
                  />
                )}
                {mode === 'OBSERVED' && primary ? (
                  <ObservedIdentityContext
                    series={primary}
                    onOpenSources={() => openDrawer('SOURCES')}
                  />
                ) : (
                  <div
                    data-econ="identity-context"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 28px', alignItems: 'flex-end', minWidth: 0 }}
                  >
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}><GeographyKeys locale={locale} /></div>
                    <PeriodContext locale={locale} />
                    <ProvenanceLine locale={locale} onOpenSources={() => openDrawer('SOURCES')} />
                  </div>
                )}
                {!showFigures && <NoObservationData locale={locale} subjectName={subject.name} />}
              </>
            )}
          </div>

          {/* ---- indicator strip + mini-map ---- */}
          <div
            style={{
              flex: '0 0 auto', borderTop: `1px solid ${ECON_LINE.structure}`,
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1px', background: ECON_LINE.structure,
            }}
          >
            <div style={{ background: ECON_SURFACE.panel, padding: `13px ${bp.gutterPx}px`, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
              {/*
                THE HEADING WAS PRINTED TWICE. This span rendered `Indicators`, and the
                shared strip renders `labels.heading` — the same string — in its own
                `<header>` immediately below. One region, one name; the strip's own heading
                is the one that keeps the rising count beside it, so this outer copy goes.
              */}
              <ObservedIndicatorStrip
                strip={economyIndicatorStrip({
                  series: subject.indicators,
                  /*
                    ECON-DATA-1 — with no observation producer the structure is
                    still reported and the figures are withheld. The adapter
                    turns that into `UNKNOWN` directions and empty values, so no
                    arrow describes a movement that was never observed.
                  */
                  observationsAvailable: showFigures,
                  /*
                    THE WINDOW IS THE PERIOD A CELL'S FIGURE BELONGS TO, and it was being fed
                    the section heading — so every cell read `CPI` over `Indicators ·`, which
                    is not a period and is not anything. With no observation there is no
                    period, so the cell carries the absent glyph here too.
                  */
                  window: showFigures ? `${bp.seriesWindowMonths}M` : '—',
                })}
                labels={{
                  heading: t.indicatorsTitle,
                  /*
                    `0/6 RISING` IS A CLAIM, AND WITH NO OBSERVATIONS IT IS A FALSE ONE.

                    The template is domain-supplied, and the shared component fills it from
                    `risingCount(strip)`. Fed a strip of absent figures it renders `0/6`,
                    which a reader parses as *none of the six is rising* — a statement about
                    six economies that nothing measured. The count is a fact about a SET OF
                    OBSERVATIONS; with no observations the set is empty and the honest
                    rendering of a count over nothing is the absent glyph.

                    The template returns the moment figures do, because `showFigures` is the
                    same flag that decides whether the cells carry values at all.
                  */
                  risingOf: mode === 'OBSERVED' ? `OBSERVED ${observedIndicatorCount}/${subject.indicators.length}` : showFigures ? '{rising}/{total}' : '—',
                  showAll: t.miniMapExpand,
                  noneObserved: t.noObservationTitle,
                  staleSuffix: '',
                  directions: { RISING: '↑', FALLING: '↓', FLAT: '→', UNKNOWN: '·' },
                  indicators: {},
                }}
                nowMs={0}
                variant="FULL_WIDTH"
                /*
                  THE RESPONSIVE CONTRACT, NOT A RAISED CONSTANT. Part VI is six
                  cells at 1360 and seven at 1512+; `bp.indicatorCells` is that
                  table's own answer for this width, clamped by the shared
                  component into Economy's ratified ceiling of seven.
                */
                visibleCount={bp.indicatorCells}
                /*
                  "Cells grow to this and then stop; surplus goes to the
                  mini-map." Without the cap the cells absorb the spare width and
                  the 300px map column beside them never gets it.
                */
                cellMaxPx={INDICATOR_CELL_MAX_PX}
                selectedIndicatorId={selectedIndicatorId}
                onSelectIndicator={(indicator) => {
                  const series = subject.indicators.find(
                    (s) => s.model.seriesId === indicator.indicatorId,
                  );

                  if (series !== undefined) selectIndicator(series);
                }}
              />
            </div>
            <MiniMap locale={locale} />
          </div>
        </div>

        {/* ---- SECONDARY REGION: the attention queue, OR the drawer that replaces it ---- */}
        {drawer === null ? (
          /*
            THE COLUMN CARRIES ITS OWN FILL.

            Without it the grid's 1px `ECON_LINE.structure` background showed through
            wherever this column's content stopped short of the row height — a pale block
            several hundred pixels tall under the Watch region, which reads as an unpainted
            panel rather than as a structural rule. The rule is 1px everywhere it belongs;
            this is the surface it separates.
          */
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: ECON_SURFACE.ground }}>
            <AttentionQueue
              rows={subject.attention} locale={locale}
              selectedId={selectedAttentionId} onSelect={selectAttention}
              railPx={ATTENTION_RAIL_PX}
              emptyMessage="No attention ranking has been formed — no assessment producer is active."
            />
            <WatchAndNextStep
              subject={subject} locale={locale}
              watchAvailable={watchAvailable}
              timelineAvailable={hasTimeline}
              chainAvailable={hasTransmissionChain}
              onOpenWatch={() => openDrawer('WATCH_CONFIG')}
              onOpenTimeline={() => openDrawer('TIMELINE')}
              onOpenChain={() => openDrawer('TRANSMISSION_CHAIN')}
            />
          </div>
        ) : (
          <EconomyDrawer
            title={drawerTitle(drawer, t)}
            locale={locale}
            onClose={() => setDrawer(null)}
          >
            {drawer === 'REVISION_TRACK' && (
              hasRevisionTrack && revisionVintages && revisionEffects ? (
                <RevisionTrack vintages={revisionVintages} locale={locale} assessmentEffects={revisionEffects} />
              ) : <UnavailableDrawerMessage text="No revision history is retained for this series yet." />
            )}
            {drawer === 'COMPETING_READINGS' && (
              competing
                ? <CompetingReadings set={competing} locale={locale} ai={ai} onCompare={() => onRequestWorkspace?.('COMPARE_FORECASTS')} />
                : <UnavailableDrawerMessage text="No competing reading set is retained for this observation." />
            )}
            {drawer === 'TRANSMISSION_CHAIN' && (chain && chain.length > 0 ? <TransmissionChain links={chain} locale={locale} /> : <UnavailableDrawerMessage text="No economic relationship chain has been formed from retained evidence." />)}
            {drawer === 'WATCH_CONFIG' && <WatchConfiguration scope={subject.watch} locale={locale} runtime={watchRuntime} />}
            {drawer === 'TIMELINE' && (timeline && timeline.length > 0 ? <EconomyTimeline entries={timeline} /> : <UnavailableDrawerMessage text="No economy timeline has been formed for this subject yet." />)}
            {drawer === 'POLICY_EVENT' && (subject.policyLane.length > 0 ? <PolicyEventDetail events={subject.policyLane} locale={locale} /> : <UnavailableDrawerMessage text="No policy event is retained for this observation." />)}
            {/*
              The two paragraphs that used to sit on the first viewport. R08's model is
              that sustained explanation is a drawer, and this is the drawer the zoning
              model already named.
            */}
            {drawer === 'SOURCES' && (
              retainedObservation
                ? <RetainedSourceDetails observation={retainedObservation} />
                : <div style={{ padding: '16px 18px' }}><ObservationAbsenceDetail locale={locale} /></div>
            )}
          </EconomyDrawer>
        )}
      </div>

      {/* ---- the anchored HUD, one at a time, never a resident sidebar ---- */}
      {hudOpen && (
        <div style={{ position: 'absolute', insetInlineEnd: `${ATTENTION_RAIL_PX + 24}px`, insetBlockStart: '160px', zIndex: 10 }}>
          <AnchoredHud
            title={t.hudTitle}
            body={triadExplanation}
            locale={locale}
            onDismiss={() => setHudOpen(false)}
            footNotes={['Anchored beside triad', 'No stacking · no metered action']}
          />
        </div>
      )}

      {/* ---- policy & release lane (Q4) + the deliberate metered handoff (state 06) ---- */}
      <EconomyFooterLane
        subject={subject} locale={locale} ai={ai} gutterPx={bp.gutterPx}
        observationsAvailable={showFigures}
        triadAvailable={primary?.triad !== null && primary?.triad !== undefined}
        revisionAvailable={hasRevisionTrack}
        competingAvailable={hasCompetingReadings}
        policyAvailable={hasPolicyEvent}
        analysisAvailable={analysisAvailable}
        onOpenPolicy={() => openDrawer('POLICY_EVENT')}
        onOpenHud={() => setHudOpen(true)}
        onOpenRevision={() => openDrawer('REVISION_TRACK')}
        onOpenCompeting={() => openDrawer('COMPETING_READINGS')}
        onRequestWorkspace={onRequestWorkspace}
      />
    </div>
  );
}


function UnavailableDrawerMessage({ text }: { readonly text: string }): JSX.Element {
  return (
    <div style={{ padding: '16px 18px', fontSize: 'max(var(--ar-fs-min, 0px), 12px)', lineHeight: 'var(--ar-lh, 1.6)', color: ECON_INK.label }}>
      {text}
    </div>
  );
}

function RetainedSourceDetails({ observation }: { readonly observation: RetainedObservation }): JSX.Element {
  const p = observation.provenance;
  const row = (label: string, value: string) => (
    <div key={label} style={{ display: 'grid', gridTemplateColumns: '116px 1fr', gap: '10px', paddingBlock: '7px', borderBottom: `1px solid ${ECON_LINE.hairline}` }}>
      <span style={{ fontFamily: ECON_MONO, fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase', color: ECON_INK.label }}>{label}</span>
      <span style={{ fontSize: '12px', lineHeight: '1.5', color: ECON_INK.secondary, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
  return (
    <div data-econ="retained-source-details" style={{ padding: '16px 18px' }}>
      {row('Source', p.institution)}
      {row('Jurisdiction', p.jurisdiction)}
      {row('Reference period', p.referencePeriod)}
      {row('Published', p.publicationDateStated)}
      {row('Retrieved', p.retrievedAt)}
      {row('Licence', p.licence)}
      {row('Index base', p.basePeriod)}
      {row('Language', p.sourceLanguage)}
      {row('Artifact', `sha256 ${p.contentAddress}`)}
      {row('Parser', `${p.parserId} ${p.parserVersion}`)}
      {row('Extractor', `${p.extractorId} ${p.extractorVersion}`)}
    </div>
  );
}

function drawerTitle(kind: DrawerKind, t: ReturnType<typeof economyStrings>): string {
  switch (kind) {
    case 'REVISION_TRACK': return t.revisionTrackTitle;
    case 'COMPETING_READINGS': return t.competingReadingsTitle;
    case 'TRANSMISSION_CHAIN': return t.chainTitle;
    case 'WATCH_CONFIG': return t.watchConfigTitle;
    case 'TIMELINE': return t.timelineTitle;
    case 'SOURCES': return t.sharedObservationBase;
    default: return t.watchNextStep;
  }
}

/** Watch & next step (Q5). What is monitored, including checked-no-change. */
function WatchAndNextStep({
  subject, locale, watchAvailable, timelineAvailable, chainAvailable,
  onOpenWatch, onOpenTimeline, onOpenChain,
}: {
  subject: EconomySubject;
  locale: EconomyLocale;
  watchAvailable: boolean;
  timelineAvailable: boolean;
  chainAvailable: boolean;
  onOpenWatch: () => void;
  onOpenTimeline: () => void;
  onOpenChain: () => void;
}): JSX.Element {
  const t = economyStrings(locale);
  const enabled = subject.watch.members.filter((m) => m.enabled);
  const action = {
    fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase' as const,
    color: ECON_INK.secondary, border: `1px solid ${ECON_LINE.border}`, background: 'transparent',
    padding: '7px 9px', cursor: 'pointer',
  };
  return (
    <div
      data-econ="watch-next-step"
      style={{
        flex: '0 0 auto', borderTop: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel,
        padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
          {t.watchNextStep}
        </span>
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
          {enabled.length} watched
        </span>
      </div>
      {/* Decomposed, always. Never one aggregate economy value. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {enabled.map((m) => (
          <span key={m.subjectId} style={{ fontSize: 'max(var(--ar-fs-min, 0px), 12px)', color: ECON_INK.secondary }}>{m.label}</span>
        ))}
      </div>
      <div style={{ paddingTop: '9px', borderTop: `1px solid ${ECON_LINE.hairline}`, display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
        <button type="button" style={{ ...action, ...(!watchAvailable ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={!watchAvailable} title={watchAvailable ? undefined : 'Shared Watch lifecycle binding is not active.'} onClick={onOpenWatch}>{t.watchTitle}</button>
        <button type="button" style={{ ...action, ...(!timelineAvailable ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={!timelineAvailable} title={timelineAvailable ? undefined : 'No timeline is retained yet.'} onClick={onOpenTimeline}>{t.timelineTitle}</button>
        <button type="button" style={{ ...action, ...(!chainAvailable ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={!chainAvailable} title={chainAvailable ? undefined : 'No relationship chain is retained yet.'} onClick={onOpenChain}>{t.chainTitle}</button>
      </div>
    </div>
  );
}

/**
 * Policy & release lane (Q4) and the Workspace handoff (state 06).
 *
 * The handoff is the ONLY place in the desktop surface that can reach a metered action,
 * it is a deliberate button, and it prints the CONFIGURED cost and the remaining
 * allowance before it runs — never the word METERED and never a literal.
 */
function EconomyFooterLane({
  subject, locale, ai, gutterPx, observationsAvailable,
  triadAvailable, revisionAvailable, competingAvailable, policyAvailable, analysisAvailable,
  onOpenPolicy, onOpenHud, onOpenRevision, onOpenCompeting, onRequestWorkspace,
}: {
  subject: EconomySubject;
  locale: EconomyLocale;
  ai: EconomyAiConfig;
  gutterPx: number;
  /**
   * ECON-DATA-1. Three of these controls open observation-derived surfaces: the HUD
   * explains the triad, the revision track walks vintages of an observation, and competing
   * readings compare forecast observations against a shared observation base. With no
   * observation source they lead nowhere, so they are DISABLED and say why — a disabled
   * truthful control beats a live control onto an invented surface.
   *
   * The policy event is a LIFECYCLE EVENT, not an observation, so it stays reachable.
   *
   * The metered action is disabled for the same reason and for a second one: spending a
   * reader's allowance to analyse figures that do not exist is not a degraded experience,
   * it is a charge for nothing.
   */
  observationsAvailable: boolean;
  triadAvailable: boolean;
  revisionAvailable: boolean;
  competingAvailable: boolean;
  policyAvailable: boolean;
  analysisAvailable: boolean;
  onOpenPolicy: () => void;
  onOpenHud: () => void;
  onOpenRevision: () => void;
  onOpenCompeting: () => void;
  onRequestWorkspace?: (actionId: string) => void;
}): JSX.Element {
  const t = economyStrings(locale);
  const cost = meteredActionCost(ai, 'DRIVER_DECOMPOSITION');
  const disabledStyle = { opacity: 0.45, cursor: 'not-allowed' as const };
  const action = {
    fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase' as const,
    color: ECON_INK.secondary, border: `1px solid ${ECON_LINE.border}`, background: 'transparent',
    padding: '7px 9px', cursor: 'pointer',
  };
  return (
    <div
      data-econ="policy-lane"
      style={{
        flex: '0 0 auto', borderTop: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel,
        padding: `13px ${gutterPx}px`, display: 'flex', flexWrap: 'wrap', gap: '14px',
        alignItems: 'center', justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
          Policy &amp; release
        </span>
        {subject.policyLane.map((e) => (
          <span key={e.id} style={{ fontSize: 'max(var(--ar-fs-min, 0px), 12px)', color: ECON_INK.secondary }}>{e.label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', alignItems: 'center' }}>
        <button type="button" style={{ ...action, ...(!triadAvailable ? disabledStyle : {}) }} disabled={!triadAvailable} title={triadAvailable ? undefined : 'No observation triad is available.'} onClick={onOpenHud}>Explain triad</button>
        <button type="button" style={{ ...action, ...(!revisionAvailable ? disabledStyle : {}) }} disabled={!revisionAvailable} title={revisionAvailable ? undefined : 'No revision history is retained yet.'} onClick={onOpenRevision}>Revisions</button>
        <button type="button" style={{ ...action, ...(!competingAvailable ? disabledStyle : {}) }} disabled={!competingAvailable} title={competingAvailable ? undefined : 'No competing reading set is retained yet.'} onClick={onOpenCompeting}>Competing readings</button>
        <button type="button" style={{ ...action, ...(!policyAvailable ? disabledStyle : {}) }} disabled={!policyAvailable} title={policyAvailable ? undefined : 'No policy event is retained for this observation.'} onClick={onOpenPolicy}>Policy event</button>
        {cost !== null && (
          <button
            type="button"
            data-econ="metered-action"
            data-sand-cost={cost}
            data-gated={analysisAvailable ? 'false' : 'true'}
            disabled={!analysisAvailable}
            title={analysisAvailable ? undefined : observationsAvailable ? 'Analysis workspace handoff is not connected on this preview.' : t.noObservationBody}
            onClick={() => onRequestWorkspace?.('DRIVER_DECOMPOSITION')}
            style={{ ...action, color: ECON_INK.primary, border: `1px solid ${ECON_LINE.emphasis}`, background: ECON_SURFACE.selected, ...(!analysisAvailable ? disabledStyle : {}) }}
          >
            Run analysis · {cost} sand · {t.remainingAllowance} {ai.remainingSand}
          </button>
        )}
      </div>
    </div>
  );
}
