import type { SpecialistDomainId } from '@/lib/specialist/specialistDomain';

/**
 * SHARED · INDICATORS — OBSERVED INDICATOR STRIP.
 *
 *     promoted   Part V §14 — "change state says something moved; it cannot say
 *                a trend is building across counted evidence"
 *     contract   Shared Specialist Addendum §15
 *     matrix     Part V §15 — "7-cell strip" · desktop · ZERO AI · rail section
 *
 * "OBSERVED VALUES WITH THEIR OWN WINDOWS · NEVER A COMPOSITE SCORE."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A GENUINE COLLISION BETWEEN THE TWO AUTHORITIES, RESOLVED BY PRECEDENCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The Addendum's shared contract says `strip: indicators[1..5]` and states
 * "Maximum five indicators. A sixth means the wrong five were chosen."
 *
 * Part V says seven, three times over: §06 publishes "the complete permitted
 * set" of seven observed indicators; §15's matrix specifies a "7-CELL STRIP";
 * and the HUD expression the Addendum ITSELF quotes back is "4 of 7 indicators
 * rising · 30-day window". The Addendum's own domain row for Conflict repeats
 * the seven.
 *
 * The authority README settles which one governs, and it anticipated this
 * exact case:
 *
 *     1. Part V v1.0 R2 §15 implementation matrix wins over any prose,
 *        including this package.
 *     2. Disagreement on a SHARED component: Part V wins and this package
 *        is wrong.
 *
 * So the platform default is five and the cap is a REGISTERED PER-DOMAIN
 * VALUE, with Conflict registered at seven under §15. The Addendum's reasoning
 * survives as the default: a domain asking for a sixth should be made to
 * justify it, which is what an explicit registration is. Reported to Main as a
 * documentation collision rather than silently absorbed.
 */

/** The Addendum's default. A domain above this must be registered explicitly. */
export const INDICATOR_SOFT_MAX = 5;

/**
 * Registered exceptions, each citing the authority that grants it.
 *
 * CONFLICT = 7 by Part V §15's "7-cell strip" and §06's complete permitted set.
 * No other domain is registered, so Election and Delivery get five.
 */
export const INDICATOR_MAX_BY_DOMAIN: Readonly<Partial<Record<SpecialistDomainId, number>>> = {
  CONFLICT: 7,
};

export function indicatorMaxFor(domain: SpecialistDomainId): number {
  return INDICATOR_MAX_BY_DOMAIN[domain] ?? INDICATOR_SOFT_MAX;
}

/**
 * Direction is a DIRECTION, never a magnitude and never a prediction.
 *
 * Part V §05's four-rung ladder puts the indicator at rung 3 — observed signal,
 * current assessment, escalation indicator — with rung 4, scenario/forecast,
 * "deferred until the analytical architecture supports it honestly. Not
 * designed, not stubbed, not simulated in this pass."
 *
 * There is therefore no `FORECAST`, no `PROJECTED` and no confidence-weighted
 * direction in this union, and no field anywhere in the strip that a forecast
 * could be written into.
 */
export type IndicatorDirection = 'RISING' | 'FALLING' | 'FLAT' | 'UNKNOWN';

export interface ObservedIndicator {
  readonly indicatorId: string;
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  /**
   * What the 3px magnitude bar is scaled against.
   *
   * §15: "scaled against a DECLARED BASIS, never against the other indicators
   * in the strip." Scaling against siblings would turn seven independent
   * observations into a ranking, which is the composite score by another route.
   */
  readonly magnitudeBasis?: { readonly max: number; readonly of: number; readonly label: string };
  readonly direction: IndicatorDirection;
  /** Each indicator owns its OWN window. The strip has none. */
  readonly window: string;
  readonly observedAt: string | null;
  readonly comparisonRef?: string;
  readonly provenanceRef: readonly string[];
}

export interface IndicatorStrip {
  readonly domain: SpecialistDomainId;
  readonly indicators: readonly ObservedIndicator[];
}

/**
 * The strip is valid when it is within its domain's registered cap and carries
 * at least one indicator. An over-length strip is REFUSED rather than
 * truncated: dropping the tail would silently change which observations the
 * reader is told about.
 */
export function stripIsValid(strip: IndicatorStrip): boolean {
  const max = indicatorMaxFor(strip.domain);

  return strip.indicators.length >= 1 && strip.indicators.length <= max;
}

/**
 * "N of M rising", the only summary the platform will produce.
 *
 * A COUNT, NOT A SCORE. §15: the strip "never sums, weights or averages" its
 * indicators, and §21 forbids "a composite risk, performance or election
 * score". Counting how many members of a set share a direction states a fact
 * about the set; combining their magnitudes would state a fact about the world
 * that nobody measured.
 */
export function risingCount(strip: IndicatorStrip): { readonly rising: number; readonly total: number } {
  return {
    rising: strip.indicators.filter((i) => i.direction === 'RISING').length,
    total: strip.indicators.length,
  };
}

/**
 * §15: "Every value carries an observation time. A stale indicator is DIMMED
 * WITH ITS AGE, NEVER DROPPED."
 *
 * Dropping is the tempting behaviour and the wrong one — a reader counting six
 * cells where the HUD says seven has been told the world changed when only our
 * reporting did.
 */
export function indicatorIsStale(indicator: ObservedIndicator, nowMs: number, staleAfterMs: number): boolean {
  if (indicator.observedAt === null) return true;

  const t = Date.parse(indicator.observedAt);

  return !Number.isFinite(t) || nowMs - t > staleAfterMs;
}

/**
 * The magnitude bar's width fraction, or `null` when no basis was declared.
 *
 * `null` renders NO BAR. A bar with an undeclared basis is a picture of a
 * number nobody can check.
 */
export function magnitudeFraction(indicator: ObservedIndicator): number | null {
  const basis = indicator.magnitudeBasis;

  if (basis === undefined || !Number.isFinite(basis.max) || basis.max <= 0) return null;

  return Math.max(0, Math.min(1, basis.of / basis.max));
}
