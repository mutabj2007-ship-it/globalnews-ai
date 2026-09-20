import type { EconomyLocale } from '@/lib/economy/strings';
import { economyStrings } from '@/lib/economy/strings';
import type { Corridor, FigureSlot, Series } from '@/lib/economy/types';
import { seriesName } from '@/lib/economy/types';
import { figureIsObservation, figureObservation, gapReason, slotPeriodLabel } from '@/lib/economy/economyAdapters';
import { Triad } from './Triad';
import { ECON_CHART, ECON_INK, ECON_LINE, ECON_MONO, ECON_SURFACE } from './econTokens';
import { STATEMENT_MAX_CH } from '@/lib/economy/economyConfig';
import type { CorridorRenderCapability } from '@/lib/economy/economyConfig';

/**
 * ECON-UI-1 — THE INTELLIGENCE STATEMENT.
 *
 * Primary. Written FROM the triad and the change state, never a restatement of the value.
 * Capped at 44ch so it does not run the frame width at 1512 or 1920.
 */
export function IntelligenceStatement({ text, sizePx = 24 }: { text: string; sizePx?: number }): JSX.Element {
  return (
    <p
      data-econ="statement"
      style={{
        margin: 0, fontSize: `${sizePx}px`, lineHeight: 'var(--ar-lh, 1.3)', letterSpacing: 'calc(-0.012em * var(--ar-ls-mul, 1))',
        fontWeight: 500, color: ECON_INK.primary, maxWidth: `${STATEMENT_MAX_CH}ch`,
      }}
    >
      {text}
    </p>
  );
}

/**
 * ECON-UI-1 — SERIES CHART. The chart SUPPORTS the statement; it never leads.
 *
 * "A chart never appears merely because data exists" — so this renders only when a series
 * has history, and the window LENGTH comes from the breakpoint table: more of the same
 * object at a wider frame, never a second chart.
 *
 * The bar ramp is a value ladder, not semantic colour. Provisional (PRELIM) bars carry
 * the dotted marker, matching the figure glyph rule.
 */
export function SeriesChart({
  series, windowMonths, locale,
}: {
  series: Series;
  windowMonths: number;
  locale: EconomyLocale;
}): JSX.Element | null {
  const t = economyStrings(locale);
  if (series.history.length === 0) return null;

  const window = series.history.slice(-windowMonths);
  /*
    ECON-UI-CONTRACT-ADAPT-1. The scale is computed over the OBSERVED values only. The old code
    read `o.value ?? 0`, which silently folded an unpublished figure into the axis as a zero and
    could drag the whole scale. A gap contributes no value to the domain; it renders as an
    absent bar instead.
  */
  const values = window.filter(figureIsObservation).map((o) => o.observation.value);
  if (values.length === 0) return null;

  /*
    A single retained period is a point, not a trend. Rendering it as one full-width
    bar makes the eye read a time series that does not exist, so state the limitation
    instead and keep the chart geometry out until a second observed period arrives.
  */
  if (values.length < 2) {
    const only = window.find(figureIsObservation);
    return (
      <div
        data-econ="series-single-period"
        style={{
          minHeight: '96px',
          border: `1px solid ${ECON_LINE.structure}`,
          background: ECON_SURFACE.panel,
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
          {t.seriesLabel} · {seriesName(series)}
        </span>
        <span style={{ fontSize: 'max(var(--ar-fs-min, 0px), 13px)', color: ECON_INK.secondary }}>
          One retained period ({only ? slotPeriodLabel(only) : 'current'}) · trend not available yet
        </span>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <figure
      data-econ="series-chart"
      data-window-months={windowMonths}
      data-bars={window.length}
      style={{
        margin: 0, flex: '1 1 auto', minHeight: '120px', border: `1px solid ${ECON_LINE.structure}`,
        background: ECON_SURFACE.panel, padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
      }}
    >
      <figcaption style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
        {t.seriesLabel} · {seriesName(series)} · {windowMonths}M
      </figcaption>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', minHeight: '80px', flex: '1 1 auto' }}>
        {window.map((slot: FigureSlot, i) => {
          const obs = figureObservation(slot);
          const ratio = obs ? (obs.value - min) / span : 0;
          const tier = Math.min(ECON_CHART.length - 1, Math.floor((i / Math.max(1, window.length - 1)) * ECON_CHART.length));
          const provisional = obs?.semantics.releaseStatus === 'PRELIMINARY';
          const label = slotPeriodLabel(slot);
          return (
            <span
              key={`${label}-${i}`}
              data-econ="chart-bar"
              data-figure-kind={slot.kind}
              data-gap-reason={gapReason(slot) ?? undefined}
              data-provisional={provisional ? 'true' : 'false'}
              title={obs ? `${label} · ${obs.value}${obs.unit}` : `${label} · — (${gapReason(slot)})`}
              style={{
                flex: 1, height: obs ? `${20 + ratio * 80}%` : '4px',
                background: obs ? ECON_CHART[tier] : 'transparent',
                borderBottom: obs ? undefined : `1px dashed ${ECON_INK.reduced}`,
                borderTop: `${i === window.length - 1 ? 2 : 1}px solid ${i === window.length - 1 ? ECON_INK.primary : ECON_LINE.emphasis}`,
                borderLeft: provisional ? `1px dotted ${ECON_INK.label}` : undefined,
                borderRight: provisional ? `1px dotted ${ECON_INK.label}` : undefined,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', color: ECON_INK.label }}>
        <span>{window[0] ? slotPeriodLabel(window[0]) : ''}</span>
        <span>{window[window.length - 1] ? slotPeriodLabel(window[window.length - 1]!) : ''}</span>
      </div>
    </figure>
  );
}

/**
 * ECON-UI-1 — CORRIDOR RENDERING, CAPABILITY-GATED (COL-3 / DEP-4).
 *
 * A and B are ALTERNATIVES, NOT A SPLIT VIEW. The branch is decided by what shared
 * Spatial actually exposes — passed in, never guessed, and defaulting to the degraded
 * branch so a forgotten probe cannot put an invented route on screen.
 *
 * ECONOMY DRAWS NO ROUTE LINE IN THE DEGRADED BRANCH. Not a faint one, not a dashed one:
 * the endpoints and the economic relationship chain carry the meaning instead.
 */
export function CorridorPanel({
  corridor, capability, locale, observationsAvailable = true,
}: {
  corridor: Corridor;
  capability: CorridorRenderCapability;
  locale: EconomyLocale;
  /**
   * ECON-DATA-1 makes two INDEPENDENT rulings, and this panel is where they meet.
   *
   * Geometry: route geometry is ENDPOINT_ONLY. Endpoints and the economic relationship
   * chain are honest structure and are rendered.
   *
   * Figures: there is no numeric time-series producer, so the throughput figure has no
   * source. The corridor's geography survives; its numbers do not.
   */
  observationsAvailable?: boolean;
}): JSX.Element {
  const t = economyStrings(locale);
  const supported = capability === 'ROUTE_SUPPORTED';

  return (
    <div
      data-econ="corridor-panel"
      data-capability={capability}
      style={{ background: ECON_SURFACE.panel, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 auto', minHeight: 0 }}
    >
      <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.1em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.primary }}>
        {supported ? t.corridorRouteSupported : t.corridorDegraded}
      </span>
      <div
        data-econ="corridor-well"
        role="img"
        aria-label={`${corridor.label} — ${supported ? t.corridorRouteSupported : t.corridorDegraded}`}
        style={{
          flex: '1 1 auto', minHeight: '280px', border: `1px solid ${ECON_LINE.structure}`,
          backgroundColor: ECON_SURFACE.ground,
          backgroundImage: `repeating-linear-gradient(135deg, ${ECON_SURFACE.raised} 0 7px, ${ECON_SURFACE.ground} 7px 14px)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '18px',
        }}
      >
        {corridor.endpoints.map((e, i) => (
          <span key={e.role} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '9px', height: '9px', border: `1px solid ${ECON_INK.tertiary}` }} />
            <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 10px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.secondary }}>
              {e.role}
            </span>
            {/* The connector exists ONLY in the supported branch. */}
            {supported && i < corridor.endpoints.length - 1 && (
              <span data-econ="corridor-route" style={{ width: '60px', height: '1px', background: ECON_INK.tertiary }} />
            )}
          </span>
        ))}
      </div>
      <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', color: ECON_INK.label }}>
        {observationsAvailable ? (
          /*
            ECON-UI-CONTRACT-ADAPT-1: the contract's corridor carries no throughput figure —
            a throughput is an OBSERVATION about the corridor, not a property of it, and there
            is no producer for one. The chain length is structural and is honest to state.
          */
          `${corridor.endpoints.length} ENDPOINTS · ${corridor.chain.length} RELATIONSHIP LINKS`
        ) : (
          <span data-econ="corridor-throughput-absent">{t.noObservationTitle.toUpperCase()}</span>
        )}
        {!supported && ' · NO ROUTE GEOMETRY EXPOSED — ENDPOINTS AND RELATIONSHIP CHAIN ONLY (ECON-DATA-1 · ENDPOINT_ONLY)'}
      </span>
    </div>
  );
}

/** Mini-map region. Surplus width goes here; it shows more geography, not more panels. */
export function MiniMap({ locale }: { locale: EconomyLocale }): JSX.Element {
  const t = economyStrings(locale);
  return (
    <div data-econ="mini-map" style={{ background: ECON_SURFACE.panel, padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0 }}>
      <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.08em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
        {t.miniMapTitle}
      </span>
      <div
        style={{
          flex: '1 1 auto', minHeight: '74px', border: `1px solid ${ECON_LINE.structure}`,
          backgroundImage: `repeating-linear-gradient(135deg, ${ECON_SURFACE.selected} 0 6px, ${ECON_SURFACE.panel} 6px 12px)`,
        }}
      />
      <span style={{ fontFamily: ECON_MONO, fontSize: 'max(var(--ar-fs-min, 0px), 9px)', letterSpacing: 'calc(0.07em * var(--ar-ls-mul, 1))', textTransform: 'uppercase', color: ECON_INK.label }}>
        {t.miniMapExpand} →
      </span>
    </div>
  );
}

export { Triad };
