/**
 * PART IV v1.2 R2 — ENTITLEMENT VALUES COME FROM CONFIGURATION, NEVER FROM CODE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE HARD-CODED TABLE HAD TO GO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * R2's closing line is unambiguous: "ENTITLEMENT VALUES ARE NOT REQUIREMENTS.
 * Implementations must read entitlement values from configuration and NEVER
 * HARD-CODE THEM." Its open-decisions list keeps all nine of them open —
 * commercial economics, watch counts, cadences, history allowances, AI
 * allowances, institutional limits, and the free-tier one-Watch question, which
 * is "proposed as indefinite and real rather than a trial; NOT YET CTO-APPROVED".
 *
 * An earlier cut of this work shipped a `PLACEHOLDER_TIER_LIMITS` table —
 * FREE: 1 watch, 2 chain links, 7 days — labelled as illustrative. Labelling is
 * not the same as not hard-coding: the numbers were still in the bundle, still
 * rendered, and a label is exactly how a placeholder becomes a commitment
 * nobody agreed to. The table is deleted rather than annotated.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT REPLACES IT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A configuration READ that currently returns nothing, and surfaces that render
 * an honest capability state when it does. There is no default, no fallback
 * figure and no "assume free tier" — those are the same invention wearing a
 * different name.
 *
 * When commercial economics are approved, the values arrive through this one
 * function and every surface follows without learning a new shape.
 */

export type EntitlementLimit = number | 'UNLIMITED';

export interface EntitlementConfig {
  readonly watches: EntitlementLimit;
  readonly chainLinks: EntitlementLimit;
  readonly historyDays: EntitlementLimit;
  readonly cadenceLabel: string;
  /** Deep-analysis allowance: used and total, for §10's stated meter. */
  readonly actionsUsed: number;
  readonly actionsTotal: number;
  readonly resetsLabel: string;
}

/**
 * The configured entitlement, or `null` when none is configured.
 *
 * `null` IS A FIRST-CLASS ANSWER and the only one this build can give. It is
 * deliberately not an empty object with zeros: zero watches and no watches
 * configured are different claims, and a surface must be able to tell them
 * apart to say something true.
 *
 * Read from `NEXT_PUBLIC_GN_ENTITLEMENT` as JSON so a deployment can supply it
 * without a code change. A malformed value yields `null` and the honest state,
 * never a partially-invented one.
 */
export function entitlementConfig(): EntitlementConfig | null {
  const raw = process.env.NEXT_PUBLIC_GN_ENTITLEMENT;

  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const value = parsed as Partial<EntitlementConfig>;

    /*
      EVERY FIELD OR NONE. A half-configured entitlement would let one surface
      state a cadence while another could not state a limit, and the reader would
      have no way to tell which numbers were real.
    */
    if (
      value.watches === undefined ||
      value.chainLinks === undefined ||
      value.historyDays === undefined ||
      typeof value.cadenceLabel !== 'string' ||
      typeof value.actionsUsed !== 'number' ||
      typeof value.actionsTotal !== 'number' ||
      typeof value.resetsLabel !== 'string'
    ) {
      return null;
    }

    return value as EntitlementConfig;
  } catch {
    return null;
  }
}

/** True when the product can state a commercial figure at all. */
export function hasEntitlementConfig(): boolean {
  return entitlementConfig() !== null;
}
