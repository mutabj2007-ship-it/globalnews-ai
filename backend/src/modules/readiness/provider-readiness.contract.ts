import type { ProviderHealthStatus } from '@globalnews-ai/shared';

/**
 * PROVIDER READINESS — TELLING THE TRUTH ABOUT WHY A PROVIDER IS NOT SERVING.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT, IN THE EXISTING CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `ProviderHealthState` is `'ok' | 'degraded' | 'down'`. Three states, and
 * neither of the two that actually matter for an operator is among them:
 *
 *   A DELIBERATELY DISABLED PROVIDER IS REPORTED AS DOWN. GDELT is off by
 *   configuration - a decision, not a failure - and the health surface calls it
 *   `down`, which is the word for "it broke". An operator reading that dashboard
 *   is told there is an outage when there is a setting.
 *
 *   A NEVER-POPULATED COUNTER IS REPORTED AS ZERO. `requestCount`,
 *   `recordsRetrieved` and `duplicatesRemoved` are optional and unpopulated by
 *   most providers. Rendered as 0 they read as "this provider did nothing",
 *   which is a claim. The truth is "nobody counted".
 *
 * Both are the same class of error the CTO already ruled on for Admin health:
 * DO NOT LABEL INTENTIONALLY DISABLED PROVIDERS AS OPERATIONALLY DOWN, AND DO
 * NOT LABEL UNUSED COUNTERS AS ZERO WHEN THEY ARE UNKNOWN.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE IS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A pure derivation from what the pipeline already knows, into a state union
 * that can express the truth. It reads configuration and an existing
 * ProviderHealthStatus and returns a readiness record. It performs no I/O, calls
 * no provider, and changes no provider behaviour.
 *
 * THE `shared/` CHANGE IS NOT MADE HERE. Widening `ProviderHealthState` itself
 * is a shared-contract change and therefore Claude Main's to converge, under the
 * collision rule. This module defines the target union locally and is packaged
 * with a handoff note; it does not edit shared/.
 */

/**
 * The five states an operator actually needs to tell apart.
 *
 * The distinction that matters most is DISABLED versus DOWN. One is a decision
 * and needs no action; the other is a fault and needs one. Collapsing them
 * means every dashboard is either crying wolf or hiding a real outage.
 */
export type ProviderReadinessState =
  /** Configured, reachable, serving. */
  | 'OK'
  /** Configured and serving, but impaired - rate limited, slow, partial. */
  | 'DEGRADED'
  /** Configured and EXPECTED to serve, but failing. A fault. Page someone. */
  | 'DOWN'
  /** Deliberately switched off by configuration. NOT a fault. Not an outage. */
  | 'DISABLED'
  /** Configured but never exercised, so no claim can honestly be made. */
  | 'UNKNOWN';

/**
 * Why a provider is in the state it is in. Machine-readable so a dashboard can
 * style it and an alert rule can filter on it, rather than parsing prose.
 */
export type ProviderReadinessReason =
  | 'SERVING'
  | 'RATE_LIMITED'
  | 'PARTIAL_FAILURE'
  | 'REQUEST_FAILED'
  | 'AUTH_FAILED'
  | 'DISABLED_BY_CONFIG'
  | 'MISSING_CREDENTIAL'
  | 'NEVER_EXERCISED';

/**
 * A counter that can honestly say it does not know.
 *
 * `undefined` from a provider means "not counted", and that is DIFFERENT from
 * zero. This type forces the difference to survive all the way to the surface
 * instead of being flattened by a `?? 0` somewhere in a mapper.
 */
export type CountedOrUnknown =
  { readonly known: true; readonly value: number } | { readonly known: false };

export function counted(value: number | undefined): CountedOrUnknown {
  return value === undefined ? { known: false } : { known: true, value };
}

export interface ProviderReadiness {
  readonly providerId: string;
  readonly displayName: string;
  readonly state: ProviderReadinessState;
  readonly reason: ProviderReadinessReason;
  /** Diagnostic prose. Never the basis for a decision. */
  readonly detail: string;
  /** 'primary' providers are always called; 'fallback' only when primaries yield nothing. */
  readonly tier: 'primary' | 'fallback';
  /** Whether configuration currently permits this provider to be called at all. */
  readonly enabledByConfig: boolean;
  /** The env var an operator changes to enable it. Named so the fix is obvious. */
  readonly configKey?: string;
  /** True when this provider is synthetic and must never serve product acceptance. */
  readonly isMock: boolean;
  readonly checkedAt?: string;
  readonly counters: {
    readonly requests: CountedOrUnknown;
    readonly failures: CountedOrUnknown;
    readonly recordsRetrieved: CountedOrUnknown;
    readonly recordsAccepted: CountedOrUnknown;
  };
  readonly lastSuccessAt?: string;
  readonly lastLatencyMs?: number;
}

export interface ProviderReadinessInput {
  readonly providerId: string;
  readonly displayName: string;
  readonly tier: 'primary' | 'fallback';
  readonly isMock: boolean;
  /** Configuration says this provider may be called. */
  readonly enabledByConfig: boolean;
  readonly configKey?: string;
  /** True when the provider needs a credential and one is present. */
  readonly credentialPresent?: boolean;
  /** The provider's own health report, when one has ever been taken. */
  readonly health?: ProviderHealthStatus;
}

/**
 * DERIVES READINESS. Pure.
 *
 * PRECEDENCE IS THE WHOLE DESIGN, and it runs configuration-first:
 *
 *   1. DISABLED BY CONFIG WINS OVER EVERYTHING. A provider that is switched off
 *      cannot be "down" - nothing tried to reach it. Reporting a health result
 *      for a provider nobody called would be reporting a stale fact as current.
 *   2. A MISSING CREDENTIAL IS ALSO NOT AN OUTAGE. It is a configuration gap,
 *      and it is actionable by a different person than an outage is.
 *   3. NEVER EXERCISED IS UNKNOWN. Absent health is not health.
 *   4. Only then is the provider's own health consulted.
 */
export function deriveProviderReadiness(input: ProviderReadinessInput): ProviderReadiness {
  const base = {
    providerId: input.providerId,
    displayName: input.displayName,
    tier: input.tier,
    enabledByConfig: input.enabledByConfig,
    configKey: input.configKey,
    isMock: input.isMock,
    checkedAt: input.health?.checkedAt,
    counters: {
      requests: counted(input.health?.requestCount),
      failures: counted(input.health?.failureCount),
      recordsRetrieved: counted(input.health?.recordsRetrieved),
      recordsAccepted: counted(input.health?.recordsAccepted),
    },
    lastSuccessAt: input.health?.lastSuccessAt,
    lastLatencyMs: input.health?.lastLatencyMs,
  };

  if (!input.enabledByConfig) {
    return {
      ...base,
      state: 'DISABLED',
      reason: 'DISABLED_BY_CONFIG',
      detail:
        `${input.displayName} is switched off by configuration` +
        (input.configKey ? ` (${input.configKey})` : '') +
        '. This is a setting, not an outage, and no request was attempted.',
    };
  }

  if (input.credentialPresent === false) {
    return {
      ...base,
      state: 'DISABLED',
      reason: 'MISSING_CREDENTIAL',
      detail:
        `${input.displayName} is enabled but has no credential` +
        (input.configKey ? ` (${input.configKey})` : '') +
        '. A configuration gap, not a fault in the provider.',
    };
  }

  if (!input.health) {
    return {
      ...base,
      state: 'UNKNOWN',
      reason: 'NEVER_EXERCISED',
      detail:
        `${input.displayName} is enabled but has not been exercised since start. ` +
        'No claim about its health is possible, and none is made.',
    };
  }

  switch (input.health.status) {
    case 'ok':
      return { ...base, state: 'OK', reason: 'SERVING', detail: input.health.message ?? 'serving' };

    case 'degraded':
      return {
        ...base,
        state: 'DEGRADED',
        reason: input.health.rateLimitState === 'throttled' ? 'RATE_LIMITED' : 'PARTIAL_FAILURE',
        detail: input.health.message ?? 'serving with impairment',
      };

    default:
      return {
        ...base,
        state: 'DOWN',
        reason: 'REQUEST_FAILED',
        detail: input.health.message ?? 'enabled and expected to serve, but failing',
      };
  }
}

/**
 * ACCEPTANCE GATE — NO SILENT MOCK PROVIDER.
 *
 * THE FAILURE THIS PREVENTS. The mock provider exists so the product runs with
 * no credentials. That is right for development and CATASTROPHIC for acceptance:
 * a reviewer signs off on a feed of synthetic articles believing it is real
 * reporting, and nothing on the surface says otherwise.
 *
 * `assertNoSilentMock` is deliberately loud. It returns the violation rather
 * than a boolean, so a caller cannot accidentally discard the reason, and it
 * treats a mock that is merely PRESENT as a violation - not only one that
 * served - because a mock that is registered will serve the moment the real
 * providers have a bad minute.
 */
export interface AcceptanceVerdict {
  readonly acceptable: boolean;
  readonly violations: readonly string[];
  readonly servingProviderIds: readonly string[];
}

export function assertNoSilentMock(providers: readonly ProviderReadiness[]): AcceptanceVerdict {
  const violations: string[] = [];

  for (const provider of providers) {
    if (provider.isMock && provider.enabledByConfig) {
      violations.push(
        `${provider.providerId} is a MOCK provider and is enabled. Product acceptance must not ` +
          'run against synthetic articles.',
      );
    }
  }

  const serving = providers.filter(
    (provider) => !provider.isMock && (provider.state === 'OK' || provider.state === 'DEGRADED'),
  );

  if (serving.length === 0) {
    violations.push(
      'No real provider is serving. Acceptance cannot pass on an empty or synthetic feed.',
    );
  }

  return {
    acceptable: violations.length === 0,
    violations,
    servingProviderIds: serving.map((provider) => provider.providerId),
  };
}

/**
 * Does the fallback tier exist and can it actually be consulted?
 *
 * MEASURED IN THE ALPHA-RC TRACE: with GDELT off the fallback set is EMPTY, so
 * both the tier escalation in `callAllProviders` and the G-ALPHA-1 D1
 * post-relevance rescue are silent no-ops. The system has a rescue path that
 * cannot fire, and nothing on any surface says so. This reports it.
 */
export interface FallbackReadiness {
  readonly hasFallbackTier: boolean;
  readonly fallbackProviderIds: readonly string[];
  readonly usable: boolean;
  readonly detail: string;
}

export function describeFallback(providers: readonly ProviderReadiness[]): FallbackReadiness {
  const fallbacks = providers.filter((provider) => provider.tier === 'fallback');
  const usable = fallbacks.filter(
    (provider) => provider.state === 'OK' || provider.state === 'DEGRADED',
  );

  return {
    hasFallbackTier: fallbacks.length > 0,
    fallbackProviderIds: fallbacks.map((provider) => provider.providerId),
    usable: usable.length > 0,
    detail:
      fallbacks.length === 0
        ? 'No fallback provider is registered. Tier escalation and the post-relevance rescue are ' +
          'both no-ops - a rescue path exists in the code that cannot fire.'
        : usable.length === 0
          ? `Fallback tier is registered (${fallbacks.map((p) => p.providerId).join(', ')}) but no ` +
            'member is serving, so escalation will not recover anything.'
          : `Fallback tier usable: ${usable.map((p) => p.providerId).join(', ')}.`,
  };
}
