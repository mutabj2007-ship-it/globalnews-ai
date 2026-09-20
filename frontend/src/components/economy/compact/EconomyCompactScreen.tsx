'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ReturnControl } from '@/components/navigation/ReturnControl';
import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { AttentionRow, EconomySubject, Series } from '@/lib/economy/types';
import { EconomyFigure, FigureAxesLine } from '../FigureTags';
import { IntelligenceStatement, CorridorPanel } from '../Substrate';
import { Triad } from '../Triad';
import { CompetingReadings, EconomyTimeline, WatchConfiguration } from '../DrawerContents';
import { orderByAttentionRank } from '../AttentionQueue';
import { figureSemantics } from '@/lib/economy/economyAdapters';
import { assessmentChangeState, seriesId, seriesName } from '@/lib/economy/types';
import { ECON_INK, ECON_LINE, ECON_MONO, ECON_SANS, ECON_SURFACE } from '../econTokens';
import {
  COMPACT_HIT_TARGET_PX, COMPACT_REFERENCE_PX, DEV_ECONOMY_AI_CONFIG, SPATIAL_CAPABILITY, DEV_WATCH_RUNTIME,
  ECONOMY_SHEET_DETENTS, ECONOMY_DATA_CAPABILITY, meteredActionCost,
} from '@/lib/economy/economyConfig';
import type {
  EconomyAiConfig, EconomyDataCapability, SpatialCapability, WatchRuntimeCapability,
} from '@/lib/economy/economyConfig';
import { FixtureBanner, NoObservationData, observationMode } from '../DataAvailability';
import { GeographyKeys, PeriodContext, QuietTriad } from '../QuietFrame';

/**
 * ECON-UI-1 — THE COMPACT ECONOMY SURFACE (375–430px, reference 390px).
 *
 * NOT A SCALED DESKTOP. The desktop's side-by-side substrate and queue become a vertical
 * order, and that order is the contract:
 *
 *   assessment → horizontal indicator rail → attention feed
 *
 * DATA FIRST, GEOGRAPHY WHEN IT BROUGHT YOU HERE. Default compact entry is data and
 * attention. When Economy is entered from a Spatial or corridor object the originating
 * geographic context is PRESERVED and may lead (M9) — which is why `enteredFrom` is a
 * prop rather than something inferred from the subject kind.
 */

/**
 * ECONOMY DISCLOSURE SHEET detents.
 *
 * These are ECONOMY's own sheet detents, per the activation ruling — this lane does NOT
 * touch the shared Spatial map sheet contract. Values come from configuration, where the
 * declared rule (PEEK ≈ 180px, HALF ≈ 55%) governs over the illustrative board frames.
 */
export type SheetDetent = 'PEEK' | 'HALF' | 'FULL';

export type CompactSurface =
  | { kind: 'NONE' }
  | { kind: 'ASK_AI'; detent: 'PEEK' }
  | { kind: 'INSPECT'; detent: 'HALF' }
  | { kind: 'WATCH'; detent: 'FULL' }
  | { kind: 'COMPETING'; detent: 'FULL' }
  | { kind: 'TIMELINE'; detent: 'FULL' };

export interface EconomyCompactProps {
  subject: EconomySubject;
  locale: EconomyLocale;
  /**
   * Compact frame width. OMIT IT IN PRODUCTION — the frame measures itself. A pinned value
   * is a test harness for a specific point in the 375–430 band.
   */
  frameWidth?: number;
  /** M9: geography leads when a Spatial or corridor object brought the reader here. */
  enteredFrom?: 'SPATIAL' | 'CORRIDOR' | null;
  ai?: EconomyAiConfig;
  spatial?: SpatialCapability;
  /** ECON-DATA-1. Same measured default as desktop; the honest state is not desktop-only. */
  data?: EconomyDataCapability;
  watchRuntime?: WatchRuntimeCapability;
  initialSurface?: CompactSurface;
  competing?: Parameters<typeof CompetingReadings>[0]['set'];
  timeline?: Parameters<typeof EconomyTimeline>[0]['entries'];
  onRequestWorkspace?: (actionId: string) => void;
}

export function EconomyCompactScreen({
  subject, locale, frameWidth, enteredFrom = null,
  ai = DEV_ECONOMY_AI_CONFIG,
  spatial = SPATIAL_CAPABILITY,
  data = ECONOMY_DATA_CAPABILITY,
  watchRuntime = DEV_WATCH_RUNTIME,
  initialSurface = { kind: 'NONE' },
  competing, timeline, onRequestWorkspace,
}: EconomyCompactProps): JSX.Element {
  const t = economyStrings(locale);

  /* Self-measurement, for the same reason the desktop frame measures itself. */
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
  const effectiveWidth = frameWidth ?? measuredWidth ?? COMPACT_REFERENCE_PX;

  const mode = observationMode(data);
  /* ECON-UI-ASSESSMENT-R1: read the state through the accessor; null means none may be asserted. */
  const changeState = assessmentChangeState(subject.assessment);
  const showFigures = mode !== 'NO_SOURCE';
  const [selectedId, setSelectedId] = useState<string | undefined>(subject.primarySeries ? seriesId(subject.primarySeries) : undefined);
  /** ONE surface. Sheets REPLACE rather than stack; there is no array to push to. */
  const [surface, setSurface] = useState<CompactSurface>(initialSurface);

  const open = useCallback((s: CompactSurface) => setSurface(s), []);
  const close = useCallback(() => setSurface({ kind: 'NONE' }), []);
  const geographyLeads = enteredFrom !== null && subject.corridor !== null;

  return (
    <div
      data-econ="economy-compact"
      ref={frameRef}
      data-frame-width={effectiveWidth}
      data-frame-width-source={frameWidth === undefined ? 'measured' : 'pinned'}
      data-entered-from={enteredFrom ?? 'DIRECT'}
      data-geography-leads={geographyLeads ? 'true' : 'false'}
      data-observation-mode={mode}
      dir="ltr"
      style={{
        /*
          The frame fills the compact viewport. It is NOT capped at a pinned width: a cap
          wider than the real frame overflows at 375, and a cap narrower than it leaves a
          dead margin at 430. The band is validated by measurement, not by a max-width.
        */
        width: '100%', height: '100%',
        background: ECON_SURFACE.ground, color: ECON_INK.primary, fontFamily: ECON_SANS,
        display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden',
      }}
    >
      {mode === 'FIXTURE' && <FixtureBanner locale={locale} />}

      {/* 1 · ASSESSMENT — always first in the vertical order */}
      <header
        data-econ="compact-state-header"
        style={{ flex: '0 0 auto', padding: '14px', borderBottom: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel, display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* ALPHA FINAL DATA-FED CONVERGENCE R2 — HOST B: leading item of the EXISTING top micro-line. No row is added; this line already renders at its own height. */}
            <ReturnControl language={locale} variant="microline" iconOnly />
            <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 19px)', fontWeight: 600, color: ECON_INK.primary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{subject.name}</span>
          </div>
          {showFigures && changeState ? (
            <span
              data-econ="change-state"
              data-change-state={changeState}
              style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.inverted, background: ECON_LINE.accentLine, padding: '3px 7px' }}
            >
              {t.changeState[changeState]}
            </span>
          ) : (
            <span
              data-econ="assessment-unavailable"
              style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label, border: `1px solid ${ECON_LINE.border}`, padding: '3px 7px' }}
            >
              {t.noObservationTitle}
            </span>
          )}
        </div>
        {/*
          THE WITHHELD BRANCH PRINTS NOTHING — the same correction as the desktop header,
          and it matters more at 390px. The sentence is 24 words; it was the header, and it
          was repeated verbatim by the resident note two hundred pixels below. On a phone
          that is a third of the first screenful spent saying one thing twice.
        */}
        {showFigures ? (
          <IntelligenceStatement text={subject.assessment.statement} sizePx={17} />
        ) : (
          <span data-econ="assessment-withheld" hidden />
        )}
      </header>

      {/*
        M9 — geography leads ONLY when a Spatial or corridor object brought the reader
        here. It is placed above the rail in that case and is absent otherwise; the rest
        of the order is unchanged either way.
      */}
      {geographyLeads && subject.corridor && (
        <div data-econ="compact-geography" style={{ flex: '0 0 auto', height: '224px', borderBottom: `1px solid ${ECON_LINE.structure}` }}>
          <CorridorPanel
            corridor={subject.corridor} capability={spatial.corridorRendering}
            locale={locale} observationsAvailable={showFigures}
          />
        </div>
      )}

      {/*
        2 · HORIZONTAL INDICATOR RAIL — RESIDENT IN BOTH VALUE STATES.

        This used to be REPLACED by the no-observation panel when no source was connected,
        and the reason given was a real one: *"a scrollable rail of empty cells still reads
        as 'the data is here, somewhere' on a 390px frame."* On a phone that risk is larger
        than on desktop, and it is why the answer here is different from simply keeping the
        rail.

        THE ANSWER IS THE NOTE DIRECTLY BENEATH IT, NOT THE RAIL ALONE. The rail carries the
        six series this surface reports with the absent glyph in each cell — `EconomyFigure`
        renders a GAP slot as an em-dash with no axes line, so no cell claims a release
        status, a value kind or a freshness — and the sentence that states why sits
        immediately below, inside the same bordered region, where a reader reaches it in the
        same glance rather than by scrolling.

        The Product Owner's ruling is what permits the rail to stay: the intended final
        compact dashboard has to be inspectable, and a compact frame whose primary region is
        a paragraph is not that dashboard. Nothing here is a squeezed desktop — the desktop
        frame has no horizontal rail, and this one keeps its own vertical order:
        assessment → rail → attention.
      */}
      <div
        data-econ="compact-indicator-rail"
        style={{ flex: '0 0 auto', borderBottom: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel, padding: '12px 0 12px 14px', overflowX: 'auto' }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {subject.indicators.map((s: Series) => {
            const active = seriesId(s) === selectedId;
            const o = s.latest;
            return (
              <button
                key={seriesId(s)}
                type="button"
                data-econ="compact-indicator-cell"
                aria-pressed={active}
                onClick={() => setSelectedId(seriesId(s))}
                style={{
                  flex: '0 0 106px', boxSizing: 'border-box', padding: '9px 10px',
                  minHeight: `${COMPACT_HIT_TARGET_PX}px`,
                  display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'start', cursor: 'pointer',
                  border: `1px solid ${active ? ECON_LINE.emphasis : ECON_LINE.border}`,
                  background: active ? ECON_SURFACE.selected : ECON_SURFACE.raised,
                }}
              >
                <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
                  {s.shortLabel}
                </span>
                <EconomyFigure slot={o} sizePx={17} />
                {/*
                  Tags survive the squeeze: value kind and freshness collapse, the RELEASE
                  STATUS stays on the figure.
                */}
                {figureSemantics(o) && (
                  <FigureAxesLine axes={figureSemantics(o)!} locale={locale} sizePx={8} collapse />
                )}
              </button>
            );
          })}
        </div>
        {!showFigures && (
          <div data-econ="compact-absence" style={{ padding: '12px 14px 0 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <NoObservationData locale={locale} subjectName={subject.name} />
            {/*
              Regions D and E, compact. `geo` and `freq` are pinned dimensions of the series
              identity, not properties of an observation, so they are honest at 390px for the
              same reason they are honest at 1512px — and the geography distinction is the one
              thing a narrow frame must not collapse.
            */}
            <GeographyKeys locale={locale} />
            <PeriodContext locale={locale} />
          </div>
        )}
      </div>

      {/* 3 · ATTENTION FEED */}
      <div data-econ="compact-attention" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
            {t.attentionTitle}
          </span>
          <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
            attentionRank
          </span>
        </div>
        {/*
          THE SAME ABSENT GLYPH THE DESKTOP RAIL CARRIES, for the same reason and with more
          force at 390px: the attention feed is the LAST region in the compact order, so an
          empty one is several hundred pixels of nothing at the bottom of the scroll. A9 is
          untouched — no row, no rank, no ordering is invented — the region simply states
          its own emptiness instead of leaving a reader to decide whether it failed.
        */}
        {subject.attention.length === 0 && (
          <div data-econ="compact-attention-empty" style={{ padding: '12px 14px' }}>
            <span
              data-econ="figure-absent"
              aria-label={t.noObservationTitle}
              style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 14px)', color: ECON_INK.reduced }}
            >
              —
            </span>
          </div>
        )}
        {orderByAttentionRank(subject.attention).map((r: AttentionRow, i) => (
          <button
            key={r.id}
            type="button"
            data-econ="compact-attention-row"
            onClick={() => open({ kind: 'INSPECT', detent: 'HALF' })}
            style={{
              padding: '12px 14px', borderTop: `1px solid ${ECON_LINE.hairline}`,
              borderLeft: i === 0 ? `2px solid ${ECON_LINE.accentLine}` : '2px solid transparent',
              background: i === 0 ? ECON_SURFACE.panel : 'transparent',
              display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'start',
              minHeight: `${COMPACT_HIT_TARGET_PX}px`, cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.09em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.secondary, border: `1px solid ${ECON_LINE.emphasis}`, padding: '2px 6px' }}>
                {t.changeState[r.changeState]}
              </span>
              <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', color: ECON_INK.label }}>{r.ageLabel}</span>
            </span>
            <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 14px)', lineHeight: 'var(--ar-lh, 1.45)' }}>{r.headline}</span>
            <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', color: ECON_INK.label }}>{r.provenance}</span>
          </button>
        ))}
      </div>

      {/* bottom bar — every control clears the 44px hit target */}
      <nav
        data-econ="compact-tab-bar"
        style={{ flex: '0 0 auto', height: '56px', borderTop: `1px solid ${ECON_LINE.structure}`, background: ECON_SURFACE.panel, display: 'flex' }}
      >
        {[
          { id: 'economy', label: t.nav, active: true, act: () => close() },
          { id: 'watch', label: t.watchTitle, active: false, act: () => open({ kind: 'WATCH', detent: 'FULL' }) },
          { id: 'timeline', label: t.timelineTitle, active: false, act: () => open({ kind: 'TIMELINE', detent: 'FULL' }) },
          { id: 'ask', label: t.askAiTitle, active: false, act: () => open({ kind: 'ASK_AI', detent: 'PEEK' }) },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={tab.act}
            style={{
              flex: 1, minHeight: `${COMPACT_HIT_TARGET_PX}px`, cursor: 'pointer', background: 'none',
              fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase',
              color: tab.active ? ECON_INK.primary : ECON_INK.reduced,
              borderTop: tab.active ? `2px solid ${ECON_LINE.accentLine}` : '2px solid transparent',
              border: 'none', borderTopWidth: '2px', borderTopStyle: 'solid',
              borderTopColor: tab.active ? ECON_LINE.accentLine : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {surface.kind !== 'NONE' && (
        <EconomySheet detent={surface.detent} title={sheetTitle(surface, t)} locale={locale} onClose={close}>
          {surface.kind === 'ASK_AI' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <p style={{ margin: 0, fontSize: 'max(var(--ar-fs-min, 0px), 13px)', lineHeight: 'var(--ar-lh, 1.6)', color: ECON_INK.secondary }}>
                {subject.name} · {showFigures ? subject.assessment.statement : t.noObservationBody}
              </p>
              {/* Opening costs nothing. Asking is the metered act. */}
              <span data-econ="ask-ai-free" style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
                {t.askAiOpeningFree}
              </span>
            </div>
          )}
          {/*
            ECON-DATA-1 — the triad is three OBSERVATION cells. The sheet used to replace
            them with the absence panel, on the reasoning that an empty actual/expected/
            previous frame reads as a load failure rather than an absent source. It renders
            the final triad geometry now, with the note kept beside it so the reason is
            never inferred: `QuietTriad` draws no axes line, no release chip and no surprise
            cell, so nothing on it claims an observation was formed and failed to arrive.
          */}
          {surface.kind === 'INSPECT' && (
            showFigures && subject.primarySeries?.triad ? (
              <Triad triad={subject.primarySeries.triad} locale={locale} cellBasisPx={100} showSurprise={false} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <QuietTriad locale={locale} cellBasisPx={100} />
                <PeriodContext locale={locale} />
                <NoObservationData locale={locale} subjectName={subject.primarySeries ? seriesName(subject.primarySeries) : subject.name} />
              </div>
            )
          )}
          {surface.kind === 'WATCH' && <WatchConfiguration scope={subject.watch} locale={locale} runtime={watchRuntime} />}
          {surface.kind === 'COMPETING' && competing && <CompetingReadings set={competing} locale={locale} ai={ai} />}
          {surface.kind === 'TIMELINE' && timeline && <EconomyTimeline entries={timeline} />}
        </EconomySheet>
      )}
    </div>
  );
}

function sheetTitle(s: CompactSurface, t: ReturnType<typeof economyStrings>): string {
  switch (s.kind) {
    case 'ASK_AI': return t.askAiTitle;
    case 'INSPECT': return t.seriesLabel;
    case 'WATCH': return t.watchConfigTitle;
    case 'COMPETING': return t.competingReadingsTitle;
    case 'TIMELINE': return t.timelineTitle;
    default: return '';
  }
}

/**
 * ECONOMY DISCLOSURE SHEET.
 *
 * ONE AT A TIME. A peek may PROMOTE to half or full; it never spawns a second sheet, and
 * this component cannot express one — the parent holds a single surface value.
 */
export function EconomySheet({
  detent, title, locale, onClose, children,
}: {
  detent: SheetDetent;
  title: string;
  locale: EconomyLocale;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  const t = economyStrings(locale);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const height =
    detent === 'PEEK' ? `${ECONOMY_SHEET_DETENTS.peekPx}px`
      : detent === 'HALF' ? `${ECONOMY_SHEET_DETENTS.halfPercent}%`
        : '100%';

  return (
    <div
      ref={ref}
      data-econ="economy-sheet"
      data-detent={detent}
      role="dialog"
      aria-label={title}
      style={{
        position: 'absolute', insetInline: 0, bottom: 0, height,
        background: ECON_SURFACE.panel, borderTop: `1px solid ${ECON_LINE.emphasis}`,
        display: 'flex', flexDirection: 'column', zIndex: 20,
      }}
    >
      <div style={{ flex: '0 0 auto', padding: '10px 0 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <span aria-hidden="true" style={{ width: '40px', height: '4px', background: ECON_LINE.emphasis }} />
        <div style={{ width: '100%', padding: '0 14px', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.drawerClose}
            style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 11px)', color: ECON_INK.label, background: 'none', border: 'none', cursor: 'pointer', minHeight: `${COMPACT_HIT_TARGET_PX}px`, minWidth: `${COMPACT_HIT_TARGET_PX}px` }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
        {children}
      </div>
    </div>
  );
}
