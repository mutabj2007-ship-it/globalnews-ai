import type { RegionSelection } from '@/lib/map/region/regionSelection';
import type { ConflictWatchScope } from '@/lib/map/conflict/conflictDomain';

/**
 * WHAT CONFLICT INTELLIGENCE CAN ACTUALLY DO ON C12 — AND WHAT IT MUST SAY
 * WHEN IT CANNOT.
 *
 *     baseline  C12  2C97F41429B00658D2B2CEBFBC782A61AA18DB455F6CC22BBF6874330B45C6F7
 *
 * The Design package is explicit that "ALL DATA ILLUSTRATIVE. Every place
 * assessment, figure, actor label, count and timing in this package is MOCK
 * DATA for design review." The CTO's authorization repeats it: no fabricated
 * production data.
 *
 * So this module is where the gap between a drawn surface and a live one is
 * made explicit, once, instead of being decided component by component.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE watchScopeable QUESTION, AND WHY IT IS A HOLD RATHER THAN A NO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Main's three-way collision review, §4, verbatim: "`watchScopeable` as a
 * function of a selected definition is 2F, NOT 2C, so authoritative C12 carries
 * no way to answer 'is this rung watch-scopeable for this user and this
 * licence'."
 *
 * The CTO's instruction follows from that: "Where C12 cannot answer
 * `watchScopeable` for a selected contested definition, render an honest
 * unavailable/HOLD state. DO NOT INFER SUPPORT."
 *
 * HOLD and UNSUPPORTED are therefore different values, and the difference
 * matters to a reader:
 *
 *   HOLD         we cannot currently answer whether this is watchable.
 *   UNSUPPORTED  we can answer, and the answer is no.
 *
 * Collapsing HOLD into UNSUPPORTED would state a fact the platform does not
 * hold; collapsing it into AVAILABLE would offer a control that cannot work.
 * Both are inferences, and both are forbidden.
 */

export type WatchScopeAvailability = 'AVAILABLE' | 'HOLD' | 'UNSUPPORTED';

export interface WatchScopeVerdict {
  readonly availability: WatchScopeAvailability;
  /** The exact reason, for the surface to render. Never a generic failure. */
  readonly reason:
    | 'NO_BACKEND'
    | 'PREDICATE_NOT_IN_BASELINE'
    | 'CONTESTED_DEFINITION_UNRESOLVED'
    | 'REGION_SCOPE_UNSETTLED'
    | 'AVAILABLE';
}

/**
 * Whether the Watch service can scope to this conflict subject.
 *
 * Every branch returns HOLD or UNSUPPORTED today, and that is the correct
 * output for C12 rather than a placeholder: the Watch activation contract is
 * unconfigured (Part IV work, unchanged), and the scope predicate is 2F.
 *
 * The function is written as the full decision anyway — with the region
 * argument it will need — so that when 2F lands the change is a returned value,
 * not a new call site in every surface.
 */
export function conflictWatchScopeAvailability(
  scope: ConflictWatchScope,
  region: RegionSelection | null,
): WatchScopeVerdict {
  /*
    A CONTESTED REGION FIRST. RSC-1 types it OPERATIONAL — "in common use,
    membership disputed" — and leaves regional Watch scoping among the things it
    explicitly does NOT settle. With no definition chosen there is not even a
    member set to scope to, and `def=` is inert until G lands attributed
    definitions (G-REG-3). Answering "yes" here would scope a Watch to a
    membership nobody has agreed.
  */
  if (
    region !== null &&
    (region.regionType === 'OPERATIONAL' || region.regionType === 'UNDEFINED')
  ) {
    return {
      availability: 'HOLD',
      reason:
        region.definitionId === null
          ? 'CONTESTED_DEFINITION_UNRESOLVED'
          : 'PREDICATE_NOT_IN_BASELINE',
    };
  }

  /*
    A REGION OF ANY TYPE. RSC-1: "Watch scoping to a region" is unsettled, so
    even a closed, published membership has no scope contract yet.
  */
  if (region !== null) {
    return { availability: 'HOLD', reason: 'REGION_SCOPE_UNSETTLED' };
  }

  /*
    EVERY OTHER SCOPE. The predicate that would answer this is 2F and is not in
    the authoritative baseline — Main's §4. HOLD, not UNSUPPORTED: we are not
    saying no, we are saying we cannot answer.
  */
  void scope;

  return { availability: 'HOLD', reason: 'PREDICATE_NOT_IN_BASELINE' };
}

/**
 * Whether any live conflict intelligence exists to render.
 *
 * There is no conflict assessment service in C12. The surfaces are built and
 * tested against real component contracts; what they have no source for is
 * CONTENT. This returns the honest state rather than letting each surface
 * decide, and it is deliberately not configurable from an environment variable:
 * a flag that could turn illustrative data on in a build is the mechanism by
 * which mock data ships.
 */
export type ConflictDataState = 'LIVE' | 'NO_SERVICE';

export function conflictDataState(
  objects: readonly unknown[] | null | undefined,
): ConflictDataState {
  return Array.isArray(objects) && objects.length > 0 ? 'LIVE' : 'NO_SERVICE';
}

/**
 * The metered boundary. §06's AI cost map and §15's matrix agree: fifteen of the
 * sixteen components are ZERO user AI, and only Deep Analysis is metered.
 *
 * Expressed as a closed list so a guard can assert that no other conflict
 * surface acquires a cost. "Any user-metered model call during map browsing,
 * scope change, candidate reading or KPI display" is on §21's do-not-build list.
 */
export const CONFLICT_METERED_COMPONENTS: readonly string[] = ['DeepAnalysis'];

export function componentIsMetered(component: string): boolean {
  return CONFLICT_METERED_COMPONENTS.includes(component);
}
