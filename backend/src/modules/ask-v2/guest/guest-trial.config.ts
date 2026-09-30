import type { ComputeControlsConfig } from '../../compute-controls/compute-controls.config';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GUEST TRIAL R3 — GUEST SETTINGS: EXPLICIT, STRICT, FAIL-CLOSED FOR GUESTS ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling D1. The visible allowance is THREE completed substantive answers (a product
 * decision, therefore a constant, not a knob). Every SPENDING-related guest setting has NO
 * source default: when any is missing, malformed, out of range, or would make the advertised
 * third answer impossible inside the existing outer ceilings, the guest configuration is
 * INVALID and guest EXECUTION is refused with GUEST_TRIAL_NOT_CONFIGURED. The signed-in path
 * never reads this and is never affected by it.
 *
 * Lifetime settings (session, claim, sweep) are not spending and have conservative defaults;
 * the session lifetime is capped at an ABSOLUTE 7 days (D2).
 *
 * No value here is an approved live number. Live values are proposed in the implementation
 * package's single enablement manifest and are applied only on Product Owner approval.
 */

export const GUEST_ANSWER_ALLOWANCE = 3;
export const GUEST_SESSION_MAX_LIFETIME_H = 168;

export interface GuestTrialLimits {
  /** Executions that may have spent provider work (committed + no-answer + failed), lifetime. */
  readonly attemptsPerSession: number;
  /** Model units a session may consume over its lifetime. */
  readonly unitsPerSession: number;
  /** Aggregate model units ALL guests together may consume, per UTC hour / day. */
  readonly poolUnitsPerHour: number;
  readonly poolUnitsPerDay: number;
  /** Guest sessions issued per trusted IP scope (IPv4 address or IPv6 /64) per UTC day. */
  readonly sessionsPerIpScopePerDay: number;
  /** Guest executions per trusted IP scope per UTC day (independent of cookies). */
  readonly executionsPerIpScopePerDay: number;
  /**
   * Guest executions per UTC day, ALL guests together. A no-answer result spends 0 model units
   * yet still calls news providers, so the model-unit pool alone cannot bound provider calls.
   */
  readonly executionsPerDay: number;
  /** Concurrent model reservations per guest session. */
  readonly concurrentPerSession: number;
  /** Consecutive no-answer/failed results that open a cooldown, and its length. */
  readonly cooldownAfterNoAnswer: number;
  readonly cooldownSeconds: number;
}

export interface GuestTrialLifetimes {
  readonly sessionLifetimeH: number;
  readonly claimTtlS: number;
  readonly sweepIntervalS: number;
  readonly sweepBatch: number;
  /** Physical deletion runs this long AFTER logical expiry (a claim in flight is never cut). */
  readonly purgeGraceH: number;
}

export type GuestTrialConfig =
  | {
      readonly valid: true;
      readonly limits: GuestTrialLimits;
      readonly lifetimes: GuestTrialLifetimes;
    }
  | {
      readonly valid: false;
      readonly problems: readonly string[];
      readonly lifetimes: GuestTrialLifetimes;
    };

const SPENDING_KNOBS = {
  ASK_GUEST_ATTEMPTS_PER_SESSION: 'attemptsPerSession',
  ASK_GUEST_UNITS_PER_SESSION: 'unitsPerSession',
  ASK_GUEST_POOL_UNITS_PER_HOUR: 'poolUnitsPerHour',
  ASK_GUEST_POOL_UNITS_PER_DAY: 'poolUnitsPerDay',
  ASK_GUEST_SESSIONS_PER_IP_DAY: 'sessionsPerIpScopePerDay',
  ASK_GUEST_EXECUTIONS_PER_IP_DAY: 'executionsPerIpScopePerDay',
  ASK_GUEST_EXECUTIONS_PER_DAY: 'executionsPerDay',
  ASK_GUEST_CONCURRENT_PER_SESSION: 'concurrentPerSession',
  ASK_GUEST_COOLDOWN_AFTER_NO_ANSWER: 'cooldownAfterNoAnswer',
  ASK_GUEST_COOLDOWN_S: 'cooldownSeconds',
} as const satisfies Record<string, keyof GuestTrialLimits>;

const LIFETIME_KNOBS: Record<string, [keyof GuestTrialLifetimes, number, number, number]> = {
  /* name: [field, default, min, max] */
  ASK_GUEST_SESSION_LIFETIME_H: ['sessionLifetimeH', 168, 1, GUEST_SESSION_MAX_LIFETIME_H],
  ASK_GUEST_CLAIM_TTL_S: ['claimTtlS', 600, 60, 900],
  ASK_GUEST_SWEEP_INTERVAL_S: ['sweepIntervalS', 900, 60, 3600],
  ASK_GUEST_SWEEP_BATCH: ['sweepBatch', 200, 10, 1000],
  ASK_GUEST_PURGE_GRACE_H: ['purgeGraceH', 24, 1, 72],
};

/** A strict positive integer: digits only, no sign, no decimal, no whitespace padding. */
function strictInt(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d{1,12}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export function resolveGuestTrialLifetimes(
  get: (name: string) => string | undefined,
): GuestTrialLifetimes {
  const out: Record<string, number> = {};
  for (const [env, [field, fallback, min, max]] of Object.entries(LIFETIME_KNOBS)) {
    const value = strictInt(get(env));
    out[field] = value !== null && value >= min && value <= max ? value : fallback;
  }
  return out as unknown as GuestTrialLifetimes;
}

/**
 * Resolve and validate against the EXISTING outer controls (`outer`), so an enabled guest
 * configuration can never make the advertised third answer impossible under idle conditions,
 * and can never exceed what the whole service is allowed.
 */
export function resolveGuestTrialConfig(
  get: (name: string) => string | undefined,
  outer: Pick<
    ComputeControlsConfig,
    | 'unitsPerRequestMax'
    | 'globalUnitsPerHour'
    | 'globalUnitsPerDay'
    | 'providerUnitsPerHour'
    | 'ipUnitsPerDay'
    | 'concurrentGlobal'
  >,
): GuestTrialConfig {
  const lifetimes = resolveGuestTrialLifetimes(get);
  const problems: string[] = [];
  const limits: Record<string, number> = {};

  for (const [env, field] of Object.entries(SPENDING_KNOBS)) {
    const value = strictInt(get(env));
    if (value === null) problems.push(`${env} missing or not a strict integer`);
    else if (value === 0 && field !== 'cooldownSeconds') problems.push(`${env} must be > 0`);
    else limits[field] = value;
  }
  if (problems.length > 0) return { valid: false, problems, lifetimes };

  const l = limits as unknown as GuestTrialLimits;
  const perRequest = outer.unitsPerRequestMax;
  const need = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  /* The advertised journey must fit: three full-size reservations inside the session and pool. */
  need(l.attemptsPerSession >= GUEST_ANSWER_ALLOWANCE, 'attempts per session < 3');
  need(
    l.unitsPerSession >= GUEST_ANSWER_ALLOWANCE * perRequest,
    `units per session < 3 × per-request max (${GUEST_ANSWER_ALLOWANCE * perRequest})`,
  );
  need(l.poolUnitsPerHour >= perRequest, 'guest pool/hour < one full request');
  need(l.poolUnitsPerDay >= l.poolUnitsPerHour, 'guest pool/day < guest pool/hour');
  need(l.executionsPerIpScopePerDay >= GUEST_ANSWER_ALLOWANCE, 'executions per IP scope/day < 3');
  need(l.executionsPerDay >= GUEST_ANSWER_ALLOWANCE, 'guest executions/day < 3');
  need(
    l.concurrentPerSession >= 1 && l.concurrentPerSession <= 2,
    'concurrent per session ∉ [1,2]',
  );
  need(l.cooldownAfterNoAnswer >= 2, 'cooldown threshold < 2');
  need(l.cooldownSeconds <= 3600, 'cooldown longer than 1 hour');
  /* Inside, never above, the whole-service ceilings. */
  need(l.poolUnitsPerHour <= outer.globalUnitsPerHour, 'guest pool/hour exceeds global/hour');
  need(l.poolUnitsPerHour <= outer.providerUnitsPerHour, 'guest pool/hour exceeds provider/hour');
  need(l.poolUnitsPerDay <= outer.globalUnitsPerDay, 'guest pool/day exceeds global/day');
  need(l.unitsPerSession <= outer.ipUnitsPerDay, 'units per session exceeds the IP/day ceiling');
  need(l.concurrentPerSession <= outer.concurrentGlobal, 'session concurrency exceeds global');

  return problems.length > 0
    ? { valid: false, problems, lifetimes }
    : { valid: true, limits: l, lifetimes };
}
