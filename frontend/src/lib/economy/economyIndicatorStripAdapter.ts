import type { IndicatorStrip, ObservedIndicator } from '@/lib/specialist/indicatorStrip';
import { figureIsObservation, figureObservation, figureUnit } from './economyAdapters';
import type { Direction, Series } from './types';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B4-A — ECONOMY ONTO THE SHARED INDICATOR STRIP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Economy-local `IndicatorStrip.tsx` is NOT recovered. The shared
 * `ObservedIndicatorStrip` is the endpoint, and this is the only thing that
 * stands between them: a pure mapping from Economy's `Series` onto the
 * platform's `ObservedIndicator`.
 *
 * ── WHY AN ADAPTER AND NOT A SHARED ECONOMY TYPE ─────────────────────────
 *
 * §21 forbids a domain's vocabulary leaking into a shared component — that is
 * how a `CandidateCard` gets built. `Series` carries `model`, `triad`,
 * `history` and a `FigureSlot` union that only Economy has any use for. The
 * shared component must never learn any of it, so the translation happens here,
 * in the domain, and the platform keeps a vocabulary every domain can satisfy.
 *
 * ── ECON-DATA-1 IS THE LOAD-BEARING CASE ─────────────────────────────────
 *
 * The Economy-local strip took `observationsAvailable` and, when false, kept the
 * cell's LABEL while withholding the figure, the direction arrow and the axes
 * line — because "the arrow describes a movement between observations; with no
 * observations there is no movement to describe, and an arrow beside a dash
 * would invent one."
 *
 * That behaviour is preserved exactly, and it maps onto the platform without a
 * new concept: a withheld figure becomes `value: ''`, and the direction becomes
 * `UNKNOWN` — the member the shared vocabulary already has for "no direction is
 * asserted", and the one the Economy-local vocabulary lacked and had to
 * suppress by hand.
 *
 * With `OFFICIAL_SOURCES` empty this is not an edge case. It is the state every
 * Economy indicator is in today, which is why it is mapped rather than deferred.
 */

/** Economy's three-value presentation direction onto the platform's four. */
const DIRECTION: Readonly<Record<Direction, ObservedIndicator['direction']>> = {
  UP: 'RISING',
  DOWN: 'FALLING',
  FLAT: 'FLAT',
};

export interface EconomyStripInput {
  readonly series: readonly Series[];
  /**
   * ECON-DATA-1. False when this deployment has no observation producer at all —
   * which is its current state. Structure is still real and still reported; the
   * figures are not.
   */
  readonly observationsAvailable: boolean;
  readonly window: string;
}

/**
 * One Economy series as a platform indicator.
 *
 * NOTHING IS SYNTHESISED. Every field is copied or withheld; no value is
 * formatted into existence, no direction is guessed, and no magnitude basis is
 * offered, because Part VI asks for no magnitude bar and inventing a basis is
 * how a bar that means nothing gets drawn.
 */
function toIndicator(series: Series, input: EconomyStripInput): ObservedIndicator {
  const slot = series.latest;
  const observed = input.observationsAvailable && figureIsObservation(slot);
  const observation = observed ? figureObservation(slot) : null;

  return {
    indicatorId: series.model.seriesId,
    label: series.shortLabel,
    /*
      A WITHHELD FIGURE IS EMPTY, NOT A DASH OR A ZERO. The surface decides how
      to render an absence; a placeholder chosen here would travel into every
      consumer as if it were data.
    */
    value: observation === null ? '' : String(observation.value),
    unit: observation === null ? undefined : figureUnit(slot, series.model.unit),
    /*
      NO MAGNITUDE BASIS. Part VI does not specify a magnitude bar, and
      `magnitudeFraction` returns null without a basis — so the shared cell
      draws no bar rather than one measured against an invented maximum. The
      bar's presence for Economy is an open design question
      (ECONOMY-STRIP-MAGNITUDE-BAR-1), not something to settle by supplying a
      basis here.
    */
    direction: observed ? DIRECTION[series.direction] : 'UNKNOWN',
    window: input.window,
    observedAt: observation === null ? null : observation.vintage,
    provenanceRef: [],
  };
}

/**
 * The strip, ready for `ObservedIndicatorStrip`.
 *
 * The caller supplies `visibleCount` from its own breakpoint table; this does
 * NOT slice, because deciding how many cells a width affords is a layout
 * question and hiding the rest silently is the defect being removed.
 */
export function economyIndicatorStrip(input: EconomyStripInput): IndicatorStrip {
  return {
    domain: 'ECONOMY',
    indicators: input.series.map((series) => toIndicator(series, input)),
  };
}
