'use client';

import {
  indicatorIsStale,
  indicatorMaxFor,
  magnitudeFraction,
  risingCount,
  stripIsValid,
  type IndicatorStrip,
  type ObservedIndicator,
} from '@/lib/specialist/indicatorStrip';

/**
 * SHARED · INDICATORS — observed values with their own windows, never a score.
 * Addendum §15 · Part V §15 matrix ("7-cell strip") · Part V §06.
 *
 * ── WHAT THIS COMPONENT REFUSES TO DO ─────────────────────────────────────
 *
 * It does not sum, weight or average. It does not scale one indicator against
 * another — each 3px bar is measured against its OWN declared basis, so the
 * bars are not comparable and are not laid out as if they were. It renders no
 * composite, no index, no traffic light and no gauge (§21).
 *
 * And it is "NEVER RENDERED AS A CARD GRID, AT ANY WIDTH" (§15). The compact
 * variant is the same strip at full width, not a two-up grid — a grid turns
 * seven independent observations into a scoreboard, which is the composite
 * score arriving through layout instead of arithmetic.
 *
 * ── STALE IS DIMMED, NEVER DROPPED ────────────────────────────────────────
 *
 * A strip that hides its stale members tells the reader the world has fewer
 * moving parts than it has. The cell stays, at reduced opacity, carrying its
 * age.
 */

export interface IndicatorStripLabels {
  readonly heading: string;
  readonly risingOf: string;
  readonly showAll: string;
  readonly noneObserved: string;
  readonly staleSuffix: string;
  readonly directions: Readonly<Record<'RISING' | 'FALLING' | 'FLAT' | 'UNKNOWN', string>>;
  /** Per-indicator display labels, keyed by indicatorId. Domain-supplied. */
  readonly indicators: Readonly<Record<string, string>>;
}

export interface ObservedIndicatorStripProps {
  readonly strip: IndicatorStrip;
  readonly labels: IndicatorStripLabels;
  /** ISO now, injected so the render is deterministic under test. */
  readonly nowMs: number;
  readonly staleAfterMs?: number;
  readonly onShowAll?: () => void;
  readonly variant?: 'RAIL' | 'FULL_WIDTH';
}

const ARROW: Readonly<Record<ObservedIndicator['direction'], string>> = {
  RISING: '↑',
  FALLING: '↓',
  FLAT: '→',
  UNKNOWN: '·',
};

export function ObservedIndicatorStrip({
  strip,
  labels,
  nowMs,
  staleAfterMs = 1000 * 60 * 60 * 24 * 30,
  onShowAll,
  variant = 'RAIL',
}: ObservedIndicatorStripProps): JSX.Element {
  /*
    AN OVER-LENGTH STRIP IS REFUSED, NOT TRUNCATED. Silently dropping the tail
    would change which observations the reader is told about while looking
    exactly like a correct render.
  */
  if (!stripIsValid(strip)) {
    return (
      <p data-gn="indicator-strip-unavailable" className="text-[12px] leading-[1.5] text-sp-ink-2">
        {labels.noneObserved}
      </p>
    );
  }

  const { rising, total } = risingCount(strip);

  return (
    <section data-gn="indicator-strip" data-gn-domain={strip.domain} data-gn-cells={total}>
      <header className="mb-[8px] flex items-baseline justify-between gap-[8px]">
        <h3 className="font-gn-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-sp-ink-3">
          {labels.heading}
        </h3>
        {/* A COUNT, NOT A SCORE. "4 of 7 rising" states a fact about the set. */}
        <span data-gn="indicator-rising" className="font-gn-mono text-[10px] tracking-[0.1em] text-sp-ink-2">
          {labels.risingOf.replace('{rising}', String(rising)).replace('{total}', String(total))}
        </span>
      </header>

      <ul
        data-gn="indicator-cells"
        data-gn-variant={variant}
        className={
          /* One strip, one row, scrolling if it must. NEVER a card grid. */
          'flex gap-px overflow-x-auto ' + (variant === 'FULL_WIDTH' ? 'w-full' : '')
        }
      >
        {strip.indicators.map((indicator) => {
          const stale = indicatorIsStale(indicator, nowMs, staleAfterMs);
          const fraction = magnitudeFraction(indicator);

          return (
            <li
              key={indicator.indicatorId}
              data-gn="indicator-cell"
              data-gn-indicator={indicator.indicatorId}
              data-gn-direction={indicator.direction}
              data-gn-stale={stale ? 'true' : 'false'}
              title={`${labels.indicators[indicator.indicatorId] ?? indicator.label} · ${indicator.window}`}
              className={
                'min-w-0 flex-1 bg-sp-panel px-[6px] py-[6px] ' + (stale ? 'opacity-50' : '')
              }
            >
              <p className="flex items-baseline gap-[3px] text-[11px] leading-none text-sp-ink">
                <span aria-hidden="true" className="text-sp-ink-2">
                  {ARROW[indicator.direction]}
                </span>
                <span data-gn="indicator-value" className="truncate">
                  {indicator.value}
                </span>
              </p>
              {/*
                3px MAGNITUDE BAR, SCALED AGAINST ITS OWN DECLARED BASIS.
                Absent basis renders NO BAR rather than a full or empty one —
                a bar nobody can check is a picture of a number.
              */}
              {fraction !== null && (
                <div aria-hidden="true" className="mt-[5px] h-[3px] w-full bg-[rgba(126,166,186,.12)]">
                  <div
                    data-gn="indicator-magnitude"
                    style={{ width: `${Math.round(fraction * 100)}%` }}
                    className="h-full bg-[rgba(126,166,186,.5)]"
                  />
                </div>
              )}
              <p className="mt-[4px] truncate font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-3">
                {labels.indicators[indicator.indicatorId] ?? indicator.label}
              </p>
              {/* EACH INDICATOR OWNS ITS OWN WINDOW. The strip has none. */}
              <p className="truncate font-gn-mono text-[8.5px] tracking-[0.08em] text-sp-ink-3">
                {stale ? `${indicator.window} · ${labels.staleSuffix}` : indicator.window}
              </p>
            </li>
          );
        })}
      </ul>

      {onShowAll && (
        <button
          type="button"
          data-gn="indicator-show-all"
          onClick={onShowAll}
          className="mt-[8px] min-h-[44px] w-full text-start font-gn-mono text-[9.5px] uppercase tracking-[0.14em] text-sp-ui-idle hover:text-sp-ui-hover"
        >
          {labels.showAll} →
        </button>
      )}

      {/* Stated, so the cap is legible on the surface it governs. */}
      <span className="sr-only" data-gn="indicator-cap">
        {indicatorMaxFor(strip.domain)}
      </span>
    </section>
  );
}
