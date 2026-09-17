'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { AttentionRow, EconomySubject, Series } from '@/lib/economy/types';
import { seriesId, seriesName } from '@/lib/economy/types';
import {
  ATTENTION_RAIL_PX, ECONOMY_BREAKPOINTS, ECONOMY_PAGE_CAP_PX,
  DEV_ECONOMY_AI_CONFIG, SPATIAL_CAPABILITY, DEV_WATCH_RUNTIME, ECONOMY_DATA_CAPABILITY,
  meteredActionCost,
} from '@/lib/economy/economyConfig';
import type {
  EconomyAiConfig, EconomyDataCapability, SpatialCapability, WatchRuntimeCapability,
} from '@/lib/economy/economyConfig';
import { FixtureBanner, NoObservationData, observationMode } from './DataAvailability';
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
  onRequestWorkspace,
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
  const drawerWidth = drawer ? DRAWER_WIDTH_PX[drawer] : ATTENTION_RAIL_PX;

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
                  <NoObservationData locale={locale} subjectName={subject.name} />
                )}
                <div style={{ display: 'flex', gap: '1px', background: ECON_LINE.structure, flex: '1 1 auto', minHeight: 0 }}>
                  <CorridorPanel
                    corridor={subject.corridor} capability={spatial.corridorRendering}
                    locale={locale} observationsAvailable={showFigures}
                  />
                </div>
              </>
            ) : !showFigures ? (
              <NoObservationData
                locale={locale}
                subjectName={subject.name}
                seriesNames={subject.indicators.slice(0, bp.indicatorCells).map((s) => s.shortLabel)}
              />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={microLabel}>{t.seriesLabel} · {primary ? seriesName(primary) : subject.name}</span>
                  <span style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)' }}>{bp.seriesWindowMonths}M window</span>
                </div>
                <IntelligenceStatement text={subject.assessment.statement} sizePx={hudOpen ? 22 : 24} />
                {primary?.triad && (
                  <Triad
                    triad={primary.triad} locale={locale}
                    selected={hudOpen} showSurprise={!hudOpen}
                    cellBasisPx={effectiveWidth >= 1512 ? 150 : 130}
                  />
                )}
                {primary && <SeriesChart series={primary} windowMonths={bp.seriesWindowMonths} locale={locale} />}
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
              <span style={{ ...microLabel, fontSize: 'max(var(--ar-fs-min, 0px), 9px)' }}>{t.indicatorsTitle}</span>
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
                  window: t.indicatorsTitle,
                })}
                labels={{
                  heading: t.indicatorsTitle,
                  risingOf: '{rising}/{total}',
                  showAll: t.miniMapExpand,
                  noneObserved: t.indicatorsTitle,
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
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <AttentionQueue
              rows={subject.attention} locale={locale}
              selectedId={selectedAttentionId} onSelect={selectAttention}
              railPx={ATTENTION_RAIL_PX}
            />
            <WatchAndNextStep
              subject={subject} locale={locale}
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
            {drawer === 'REVISION_TRACK' && revisionVintages && revisionEffects && (
              <RevisionTrack vintages={revisionVintages} locale={locale} assessmentEffects={revisionEffects} />
            )}
            {drawer === 'COMPETING_READINGS' && competing && (
              <CompetingReadings set={competing} locale={locale} ai={ai} onCompare={() => onRequestWorkspace?.('COMPARE_FORECASTS')} />
            )}
            {drawer === 'TRANSMISSION_CHAIN' && chain && <TransmissionChain links={chain} locale={locale} />}
            {drawer === 'WATCH_CONFIG' && <WatchConfiguration scope={subject.watch} locale={locale} runtime={watchRuntime} />}
            {drawer === 'TIMELINE' && timeline && <EconomyTimeline entries={timeline} />}
            {drawer === 'POLICY_EVENT' && <PolicyEventDetail events={subject.policyLane} locale={locale} />}
          </EconomyDrawer>
        )}
      </div>

      {/* ---- the anchored HUD, one at a time, never a resident sidebar ---- */}
      {hudOpen && (
        <div style={{ position: 'absolute', insetInlineEnd: `${ATTENTION_RAIL_PX + 24}px`, insetBlockStart: '160px', zIndex: 10 }}>
          <AnchoredHud
            title={t.hudTitle}
            body="Actual is the first publication for this period and revision is expected. Expected is a derived consensus benchmark, not an observation, so it carries no release status."
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
        onOpenPolicy={() => openDrawer('POLICY_EVENT')}
        onOpenHud={() => setHudOpen(true)}
        onOpenRevision={() => openDrawer('REVISION_TRACK')}
        onOpenCompeting={() => openDrawer('COMPETING_READINGS')}
        onRequestWorkspace={onRequestWorkspace}
      />
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
    default: return t.watchNextStep;
  }
}

/** Watch & next step (Q5). What is monitored, including checked-no-change. */
function WatchAndNextStep({
  subject, locale, onOpenWatch, onOpenTimeline, onOpenChain,
}: {
  subject: EconomySubject;
  locale: EconomyLocale;
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
        <button type="button" style={action} onClick={onOpenWatch}>{t.watchTitle}</button>
        <button type="button" style={action} onClick={onOpenTimeline}>{t.timelineTitle}</button>
        <button type="button" style={action} onClick={onOpenChain}>{t.chainTitle}</button>
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
  onOpenPolicy: () => void;
  onOpenHud: () => void;
  onOpenRevision: () => void;
  onOpenCompeting: () => void;
  onRequestWorkspace?: (actionId: string) => void;
}): JSX.Element {
  const t = economyStrings(locale);
  const cost = meteredActionCost(ai, 'DRIVER_DECOMPOSITION');
  const gatedTitle = observationsAvailable ? undefined : t.noObservationBody;
  const gated = observationsAvailable ? {} : { opacity: 0.45, cursor: 'not-allowed' as const };
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
        <button type="button" style={{ ...action, ...gated }} disabled={!observationsAvailable} title={gatedTitle} onClick={onOpenHud}>Explain triad</button>
        <button type="button" style={{ ...action, ...gated }} disabled={!observationsAvailable} title={gatedTitle} onClick={onOpenRevision}>Revisions</button>
        <button type="button" style={{ ...action, ...gated }} disabled={!observationsAvailable} title={gatedTitle} onClick={onOpenCompeting}>Competing readings</button>
        <button type="button" style={action} onClick={onOpenPolicy}>Policy event</button>
        {cost !== null && (
          <button
            type="button"
            data-econ="metered-action"
            data-sand-cost={cost}
            data-gated={observationsAvailable ? 'false' : 'true'}
            disabled={!observationsAvailable}
            title={gatedTitle}
            onClick={() => onRequestWorkspace?.('DRIVER_DECOMPOSITION')}
            style={{ ...action, color: ECON_INK.primary, border: `1px solid ${ECON_LINE.emphasis}`, background: ECON_SURFACE.selected, ...gated }}
          >
            Run analysis · {cost} sand · {t.remainingAllowance} {ai.remainingSand}
          </button>
        )}
      </div>
    </div>
  );
}
