/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE B — PUBLIC ASK CONTROL KNOBS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authority: F `06-CONSTANTS-AND-KNOBS` (CK-0: every value in ONE place, imported).
 *
 * `PO` rows are the Product Owner's number. F CK-2: "a missing number is not a reason to
 * ship without the mechanism" — each ships with the CONSERVATIVE default below, clearly
 * marked, and configuration sets the ruled value. Units are provider tokens weighted per
 * F 01 L-12 (`units = input + ASK_OUTPUT_WEIGHT × output`).
 *
 * A malformed value falls back to its conservative default (never to "unlimited"), and a
 * value is only ever an integer ≥ 0 (a ratio in (0,1]). The model attempt count is NOT a
 * knob (F 02 R-1): it is `ASK_MODEL_MAX_ATTEMPTS = 1`, a constant.
 */

export const ASK_MODEL_MAX_ATTEMPTS = 1 as const;

export interface ComputeControlsConfig {
  /* meter and spend (F 01 §3–4) */
  readonly unitsPerRequestMax: number; // PO
  readonly globalUnitsPerHour: number; // PO
  readonly globalUnitsPerDay: number; // PO
  readonly providerUnitsPerHour: number; // PO
  readonly accountUnitsPerDay: number; // PO
  readonly newAccountUnitsPerDay: number; // ≈ ¼ account
  readonly newAccountAgeH: number;
  readonly ipUnitsPerDay: number; // PO
  readonly outputWeight: number;
  readonly reservationTtlS: number;
  /* concurrency (F 01 §7) */
  readonly concurrentGlobal: number; // PO
  readonly concurrentPerAccount: number;
  readonly concurrentPerIpPrefix: number;
  /* breaker (F 02 §10) */
  readonly breakerWindowS: number;
  readonly breakerMinSamples: number;
  readonly breakerTripRatio: number;
  readonly breakerCooldownS: number;
  readonly breakerCooldownMaxS: number;
  readonly breakerTrialCalls: number;
  readonly breakerTrialSuccesses: number;
  readonly breakerCacheMs: number;
  /* switches (F 03 KS-4) and store deadline (F 02 T-5) */
  readonly flagCacheMs: number;
  readonly storeDeadlineMs: number;
}

/** Env name → [field, conservative default, PO-owned?]. */
export const COMPUTE_CONTROL_KNOBS = {
  ASK_UNITS_PER_REQUEST_MAX: ['unitsPerRequestMax', 12_000, true],
  ASK_GLOBAL_UNITS_PER_HOUR: ['globalUnitsPerHour', 300_000, true],
  ASK_GLOBAL_UNITS_PER_DAY: ['globalUnitsPerDay', 1_500_000, true],
  ASK_PROVIDER_UNITS_PER_HOUR: ['providerUnitsPerHour', 300_000, true],
  ASK_ACCOUNT_UNITS_PER_DAY: ['accountUnitsPerDay', 60_000, true],
  ASK_NEW_ACCOUNT_UNITS_PER_DAY: ['newAccountUnitsPerDay', 15_000, false],
  ASK_NEW_ACCOUNT_AGE_H: ['newAccountAgeH', 48, false],
  ASK_IP_UNITS_PER_DAY: ['ipUnitsPerDay', 30_000, true],
  ASK_OUTPUT_WEIGHT: ['outputWeight', 4, false],
  ASK_RESERVATION_TTL_S: ['reservationTtlS', 120, false],
  ASK_CONCURRENT_GLOBAL: ['concurrentGlobal', 4, true],
  ASK_CONCURRENT_PER_ACCOUNT: ['concurrentPerAccount', 2, false],
  ASK_CONCURRENT_PER_IP_PREFIX: ['concurrentPerIpPrefix', 1, false],
  ASK_BREAKER_WINDOW_S: ['breakerWindowS', 60, false],
  ASK_BREAKER_MIN_SAMPLES: ['breakerMinSamples', 20, false],
  ASK_BREAKER_TRIP_RATIO: ['breakerTripRatio', 0.5, false],
  ASK_BREAKER_COOLDOWN_S: ['breakerCooldownS', 30, false],
  ASK_BREAKER_COOLDOWN_MAX_S: ['breakerCooldownMaxS', 600, false],
  ASK_BREAKER_TRIAL_CALLS: ['breakerTrialCalls', 2, false],
  ASK_BREAKER_TRIAL_SUCCESSES: ['breakerTrialSuccesses', 2, false],
  ASK_BREAKER_CACHE_MS: ['breakerCacheMs', 1000, false],
  ASK_FLAG_CACHE_MS: ['flagCacheMs', 5000, false],
  ASK_CONTROL_STORE_DEADLINE_MS: ['storeDeadlineMs', 2000, false],
} as const satisfies Record<string, readonly [keyof ComputeControlsConfig, number, boolean]>;

function parseKnob(raw: string | undefined, fallback: number, ratio: boolean): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return fallback;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return fallback;
  if (ratio) return value > 0 && value <= 1 ? value : fallback;
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function resolveComputeControlsConfig(
  get: (name: string) => string | undefined,
): ComputeControlsConfig {
  const out: Record<string, number> = {};
  for (const [env, [field, fallback]] of Object.entries(COMPUTE_CONTROL_KNOBS)) {
    out[field] = parseKnob(get(env), fallback, field === 'breakerTripRatio');
  }
  return out as unknown as ComputeControlsConfig;
}

/** Which knobs are still on their Product-Owner-pending default (for the admin/startup view). */
export function pendingProductOwnerKnobs(get: (name: string) => string | undefined): string[] {
  return Object.entries(COMPUTE_CONTROL_KNOBS)
    .filter(([env, [, , po]]) => po && get(env) === undefined)
    .map(([env]) => env);
}
