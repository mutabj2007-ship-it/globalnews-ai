import type { WatchTrigger } from './types';
import type { EconomyCorridorCapability, EconomyObservationAvailability } from '@globalnews-ai/shared';
import { economyHasObservationSource } from '@globalnews-ai/shared';

/**
 * ECON-UI-1 — CONFIGURATION, NOT CONSTANTS.
 *
 * DESIGN-ECON-1 is explicit and repeats it on every board footer: "Cost, allowance,
 * counts, cadence and limits are configuration-driven, not production constants." Every
 * number the Phase 2 frames display for AI cost, remaining allowance, Watch counts,
 * cadence, history and entitlement limits is ILLUSTRATIVE.
 *
 * So this module holds no literal from the design frames as a product value. It defines
 * the SHAPE the configuration must have and a development default, and every component
 * reads it from here rather than printing a number of its own. A guard asserts that no
 * Economy component hard-codes a sand amount.
 */

export interface MeteredActionConfig {
  readonly id: string;
  /**
   * The configured cost, in sand. Rendered in the label AND on the button — never the
   * word METERED (AI Cost Map, standing constraint 4).
   */
  readonly sandCost: number;
}

export interface EconomyAiConfig {
  /** Remaining allowance for the current entitlement window. Configuration-driven. */
  readonly remainingSand: number;
  readonly meteredActions: readonly MeteredActionConfig[];
}

export interface EconomyBreakpointConfig {
  readonly minWidth: number;
  readonly gutterPx: number;
  readonly indicatorCells: number;
  /** Series window in months. More of the SAME object, never more panels. */
  readonly seriesWindowMonths: number;
}

/**
 * Wide-screen behaviour, from the Phase 2 responsive proof.
 *
 * The attention rail is FIXED at 372px from 1360 upward and is deliberately absent from
 * this table — it is not a breakpoint-varying value, and putting it here would invite one.
 * Surplus width goes to the substrate, the map, a longer window and breathing room.
 */
export const ECONOMY_BREAKPOINTS: readonly EconomyBreakpointConfig[] = [
  { minWidth: 1360, gutterPx: 24, indicatorCells: 6, seriesWindowMonths: 12 },
  { minWidth: 1512, gutterPx: 40, indicatorCells: 7, seriesWindowMonths: 18 },
  { minWidth: 1920, gutterPx: 64, indicatorCells: 7, seriesWindowMonths: 24 },
] as const;

/** The attention rail never scales and never becomes a second substrate. */
export const ATTENTION_RAIL_PX = 372;

/** The dashboard caps here; beyond it the frame centres. No ultra-wide stretch. */
export const ECONOMY_PAGE_CAP_PX = 1920;

/** Indicator cells grow to this and then stop; surplus goes to the mini-map. */
export const INDICATOR_CELL_MAX_PX = 200;

/** Intelligence statement measure. Never runs the frame width. */
export const STATEMENT_MAX_CH = 44;

/** Explanatory prose measure, at every breakpoint including 1920. */
export const PROSE_MAX_CH = 78;

/** Anchored HUD width band. One at a time, never a resident sidebar. */
export const HUD_MIN_PX = 280;
export const HUD_MAX_PX = 360;

/**
 * Compact sheet detents. Treated here as ECONOMY DISCLOSURE SHEET detents — this lane
 * does NOT modify the shared Spatial map sheet contract.
 *
 * The boards render 230px for peek and 56% for half while their own rule cards declare
 * "~180px" and "~55%". The declared rule governs: the frames are illustrative and the
 * activation brief states PEEK ≈ 180px, HALF ≈ 55%.
 */
export const ECONOMY_SHEET_DETENTS = {
  peekPx: 180,
  halfPercent: 55,
} as const;

/** Compact validity band and reference frame. */
export const COMPACT_MIN_PX = 375;
export const COMPACT_REFERENCE_PX = 390;
export const COMPACT_MAX_PX = 430;

/** Hit target floor on every compact control. */
export const COMPACT_HIT_TARGET_PX = 44;

/**
 * Development default. A deployment supplies the real values; nothing here is a product
 * fact. The costs differ per action because the design shows different labels per action,
 * not because these particular numbers mean anything.
 */
export const DEV_ECONOMY_AI_CONFIG: EconomyAiConfig = {
  remainingSand: 12,
  meteredActions: [
    { id: 'DRIVER_DECOMPOSITION', sandCost: 3 },
    { id: 'COMPARE_COUNTRIES', sandCost: 3 },
    { id: 'SECTOR_IMPLICATION', sandCost: 3 },
    { id: 'TWELVE_MONTH_SUMMARY', sandCost: 2 },
    { id: 'COMPARE_FORECASTS', sandCost: 4 },
    { id: 'CROSS_DOMAIN_EFFECTS', sandCost: 4 },
  ],
};

export function meteredActionCost(config: EconomyAiConfig, id: string): number | null {
  return config.meteredActions.find((a) => a.id === id)?.sandCost ?? null;
}

/**
 * DEP-3 — Watch lifecycle triggers.
 *
 * NEW_RELEASE and REVISED are lifecycle triggers the shared Watch runtime must accept.
 * Economy must NOT build a local monitor, so when the runtime cannot yet receive them the
 * binding is DISABLED rather than emulated: the UI still shows what would be monitored,
 * and says plainly that the binding is not active. A disabled truthful control is better
 * than an Economy-local alert subsystem that appears to work.
 */
export interface WatchRuntimeCapability {
  readonly acceptsLifecycleTriggers: boolean;
  readonly supportedTriggers: readonly WatchTrigger[];
}

export const DEV_WATCH_RUNTIME: WatchRuntimeCapability = {
  acceptsLifecycleTriggers: false,
  supportedTriggers: [],
};

/**
 * DEP-4 / COL-3 — Corridor rendering capability. NOW MEASURED, NO LONGER ASSUMED.
 *
 * ECON-DATA-1 measured the shared producer surface and returned a verdict:
 *
 *     ROUTE GEOMETRY = ENDPOINT_ONLY
 *
 * There is no continuous route geometry producer. The design-approved DEGRADED corridor
 * mode is therefore the CURRENT PRODUCTION-SHAPED DEFAULT, not a placeholder waiting to
 * be upgraded at render time.
 *
 * The two branches remain ALTERNATIVES, never a split view. `ROUTE_GEOMETRY` is retained
 * as a capability-gated branch so the component is ready if a producer later exposes real
 * geometry — retaining the branch is explicitly permitted, resolving to it today is not.
 *
 * Four things that are NOT evidence that route geometry exists, and none of which may
 * flip this value:
 *   - MapLibre being able to draw a line between two coordinates;
 *   - the vocabulary tokens ROUTE, CORRIDOR or TRADE_LANE appearing in data;
 *   - a frontend `type: 'line'` layer used for polygon outlines;
 *   - two endpoints being present, which is precisely the ENDPOINT_ONLY case.
 */
/**
 * ECON-UI-CONTRACT-ADAPT-1 (§7.6) — the capability type is the shared one now.
 * `ROUTE_GEOMETRY` was H's spelling of what the contract calls `ROUTE_SUPPORTED`; only the
 * sibling member's NAME changed. THE VALUE IN USE IS UNCHANGED: ENDPOINT_ONLY, as ECON-DATA-1
 * measured. Retaining the supported branch is still permitted; resolving to it is not.
 */
export type CorridorRenderCapability = EconomyCorridorCapability;

export interface SpatialCapability {
  readonly corridorRendering: CorridorRenderCapability;
}

/**
 * The measured capability. Consumed by every corridor surface; nothing computes it.
 */
export const SPATIAL_CAPABILITY: SpatialCapability = {
  corridorRendering: 'ENDPOINT_ONLY',
};

/**
 * ECON-DATA-1 — NUMERIC OBSERVATION AVAILABILITY.
 *
 * The measured verdict is that NO CURRENT NUMERIC ECONOMIC TIME-SERIES PRODUCER EXISTS.
 * There are no live CPI, GDP, policy-rate, debt or trade observations to consume.
 *
 * The consequence for this lane is a rule, not a workaround: where no observation source
 * exists the production-shaped UI renders an honest UNAVAILABLE / NO OBSERVATION DATA
 * state. It does not fabricate values, and it does not promote the design's illustrative
 * Rwanda / Kenya / Poland figures onto a production path to fill the space.
 *
 * `FIXTURE` is a separate, explicitly-named mode. It exists so the surface is reachable
 * and testable, it is never the production default, and every surface rendered under it
 * declares itself as fixture data on screen.
 */
/**
 * ECON-UI-CONTRACT-ADAPT-1 (§7.7) — bound to the shared availability type. The members are
 * identical, so no value moves; the declaration simply stops being a second one.
 */
export type ObservationAvailability = EconomyObservationAvailability;

export interface EconomyDataCapability {
  readonly numericObservations: ObservationAvailability;
}

/**
 * The production-shaped default. Changing this to OBSERVED requires a real producer,
 * measured — not a fixture module and not a design frame.
 */
export const ECONOMY_DATA_CAPABILITY: EconomyDataCapability = {
  numericObservations: 'NO_OBSERVATION_SOURCE',
};

/** Explicitly-named demo mode. Never assigned to ECONOMY_DATA_CAPABILITY. */
export const FIXTURE_DATA_CAPABILITY: EconomyDataCapability = {
  numericObservations: 'FIXTURE',
};

/** True only when real observations back the frame. Fixtures are not observations. */
export function hasObservationSource(c: EconomyDataCapability): boolean {
  // Delegates to the contract's own predicate rather than re-testing the member here.
  return economyHasObservationSource(c.numericObservations);
}
