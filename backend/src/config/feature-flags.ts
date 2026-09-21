/**
 * BETA-SIMPLE-ASK-SAND-1 §10 — feature flags.
 *
 * CONVENTION (not invented here — adopted from the repository's own
 * established pattern, confirmed by inspecting
 * backend/src/modules/signals/providers/provider.tokens.ts and
 * event-registry.provider.ts at baseline main@41428ea):
 *
 *   1. One exported predicate per flag.
 *   2. The predicate takes the RAW env string (`string | undefined`),
 *      never a ConfigService — so it is a pure function, trivially
 *      testable, and callable from a Nest `useFactory`.
 *   3. `raw === 'true'` exactly. Unset, blank, 'TRUE', 'True', '1',
 *      'yes' and 'on' all mean OFF. This is deliberately strict: an
 *      operator who fat-fingers a flag gets the safe state, not a
 *      surprise.
 *
 * WHY THESE LIVE IN ONE FILE, unlike GDELT's (which sit next to the
 * provider they gate): §10 defines a COHERENT SET of flags that gate
 * each other. SAND_CHARGING must never be on when SAND_LEDGER is off;
 * METERED_COMPUTE is meaningless without COMPUTE_CLASSIFICATION. Those
 * are cross-flag invariants, and a cross-flag invariant cannot be
 * enforced by predicates scattered across four modules. Each
 * individual predicate still follows the house pattern exactly.
 *
 * §10's critical default — SAND_CHARGING = OFF — is enforced twice
 * over: once by the `=== 'true'` rule (absence means off), and again
 * by isSandChargingEnabled's dependency gate below.
 */

/** The strict, repository-standard truthiness rule. Exactly the string 'true'. */
function isFlagEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

/**
 * §10 BETA_SIMPLE_HOME — the simplified public Beta entry layer (§15).
 *
 * Frontend-facing, so it is a NEXT_PUBLIC_* variable (matching the
 * existing NEXT_PUBLIC_API_URL convention). The backend still reads it
 * so server-rendered Beta routes and the API agree on one value.
 */
export function isBetaSimpleHomeEnabled(raw: string | undefined): boolean {
  return isFlagEnabled(raw);
}

/** §10 ASK_CONVERSATIONAL_V2 — multi-turn Ask threads (§3). */
export function isAskConversationalV2Enabled(raw: string | undefined): boolean {
  return isFlagEnabled(raw);
}

/**
 * §10 ASK_PERSISTENCE — durable thread/turn storage.
 *
 * GATED: persisting turns is meaningless without the conversational
 * surface that produces them, so this can only be on when
 * ASK_CONVERSATIONAL_V2 is also on. With V2 off, Ask behaves exactly
 * as it does today (stateless single-shot) and writes nothing.
 */
export function isAskPersistenceEnabled(
  raw: string | undefined,
  conversationalV2Raw: string | undefined,
): boolean {
  return isFlagEnabled(raw) && isAskConversationalV2Enabled(conversationalV2Raw);
}

/**
 * §10 COMPUTE_CLASSIFICATION — server-side compute classing (§5).
 *
 * The root of the dependency chain. With this off, no operation is
 * classified, nothing is quoted, and nothing is metered — the product
 * behaves exactly as it does at baseline.
 */
export function isComputeClassificationEnabled(raw: string | undefined): boolean {
  return isFlagEnabled(raw);
}

/**
 * §10 METERED_COMPUTE — quoting and the operation lifecycle (§8/§9/§13).
 *
 * GATED on COMPUTE_CLASSIFICATION: a quote is a price for a CLASS, so
 * metering without classification would have to invent a class, which
 * §5 forbids ("the authoritative compute class is determined
 * server-side" — not fabricated by the metering layer).
 */
export function isMeteredComputeEnabled(
  raw: string | undefined,
  classificationRaw: string | undefined,
): boolean {
  return isFlagEnabled(raw) && isComputeClassificationEnabled(classificationRaw);
}

/**
 * §10/§11 SAND_LEDGER — writing auditable ledger rows.
 *
 * GATED on METERED_COMPUTE: a ledger row records an operation's quote
 * and reservation, and neither exists unless metering is on.
 */
export function isSandLedgerEnabled(
  raw: string | undefined,
  meteredRaw: string | undefined,
  classificationRaw: string | undefined,
): boolean {
  return isFlagEnabled(raw) && isMeteredComputeEnabled(meteredRaw, classificationRaw);
}

/**
 * §10 SAND_CHARGING — **DEFAULT OFF. THE CRITICAL FLAG.**
 *
 * When false (the required default, and the only value this tranche is
 * authorized to ship), the system still:
 *   - classifies compute (§5),
 *   - produces quotes (§9),
 *   - writes ledger rows (§11),
 *   - records cost telemetry (§14),
 * but NEVER mutates a balance. §9: "Commercial charging remains OFF."
 *
 * GATED on SAND_LEDGER: charging without an auditable ledger row would
 * be an unrecorded debit, which §11's "auditable" requirement rules
 * out. So even an operator who sets SAND_CHARGING_ENABLED=true by
 * mistake cannot charge unless the entire chain
 * (COMPUTE_CLASSIFICATION → METERED_COMPUTE → SAND_LEDGER) is
 * deliberately on as well.
 */
export function isSandChargingEnabled(
  raw: string | undefined,
  ledgerRaw: string | undefined,
  meteredRaw: string | undefined,
  classificationRaw: string | undefined,
): boolean {
  return isFlagEnabled(raw) && isSandLedgerEnabled(ledgerRaw, meteredRaw, classificationRaw);
}

/** The exact env variable names this tranche reads. One authority, no string literals elsewhere. */
export const BETA_FEATURE_FLAG_ENV_KEYS = {
  betaSimpleHome: 'NEXT_PUBLIC_BETA_SIMPLE_HOME_ENABLED',
  askConversationalV2: 'ASK_CONVERSATIONAL_V2_ENABLED',
  askPersistence: 'ASK_PERSISTENCE_ENABLED',
  computeClassification: 'COMPUTE_CLASSIFICATION_ENABLED',
  meteredCompute: 'METERED_COMPUTE_ENABLED',
  sandLedger: 'SAND_LEDGER_ENABLED',
  sandCharging: 'SAND_CHARGING_ENABLED',
} as const;

/** The resolved state of every §10 flag, after all dependency gates. */
export interface BetaFeatureFlags {
  betaSimpleHome: boolean;
  askConversationalV2: boolean;
  askPersistence: boolean;
  computeClassification: boolean;
  meteredCompute: boolean;
  sandLedger: boolean;
  sandCharging: boolean;
}

/** Raw env strings, exactly as ConfigService hands them over. */
export interface BetaFeatureFlagEnv {
  betaSimpleHome?: string;
  askConversationalV2?: string;
  askPersistence?: string;
  computeClassification?: string;
  meteredCompute?: string;
  sandLedger?: string;
  sandCharging?: string;
}

/**
 * Resolves every §10 flag in one place, applying the dependency gates
 * above exactly once.
 *
 * This is the function the Nest provider factory calls. Nothing else
 * in the codebase should call the individual predicates — they are
 * exported for direct unit testing of each gate in isolation.
 */
export function resolveBetaFeatureFlags(env: BetaFeatureFlagEnv): BetaFeatureFlags {
  const computeClassification = isComputeClassificationEnabled(env.computeClassification);
  const askConversationalV2 = isAskConversationalV2Enabled(env.askConversationalV2);

  return {
    betaSimpleHome: isBetaSimpleHomeEnabled(env.betaSimpleHome),
    askConversationalV2,
    askPersistence: isAskPersistenceEnabled(env.askPersistence, env.askConversationalV2),
    computeClassification,
    meteredCompute: isMeteredComputeEnabled(env.meteredCompute, env.computeClassification),
    sandLedger: isSandLedgerEnabled(env.sandLedger, env.meteredCompute, env.computeClassification),
    sandCharging: isSandChargingEnabled(
      env.sandCharging,
      env.sandLedger,
      env.meteredCompute,
      env.computeClassification,
    ),
  };
}
