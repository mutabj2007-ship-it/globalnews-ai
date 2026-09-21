import { Injectable } from '@nestjs/common';
import type { ComputeClass, EntitlementState, EntitlementTier } from '@globalnews-ai/shared';
import { SandPricingService } from '../pricing/sand-pricing.service';

/**
 * BETA-SIMPLE-ASK-SAND-1 §7/§19 — what a caller is allowed to do.
 *
 * §19 is the governing instruction here, and it is a restraint, not a
 * paywall spec:
 *
 *   "Do not implement Professional as 'all useful information is
 *    locked.' … Reading stored public intelligence should remain
 *    generous."
 *
 * So this service is deliberately permissive. A guest can read stored
 * intelligence, open the map, see evidence, and ask ordinary
 * questions. The only thing it gates is genuinely expensive compute.
 *
 * §7's tiers are preserved exactly:
 *   FREE         = KNOW
 *   PROFESSIONAL = FOLLOW
 *   SAND         = INVESTIGATE / COMPUTE
 *
 * NOT IMPLEMENTED HERE, on purpose (§34): there is no tier lookup
 * against a subscription record, because no subscription model exists
 * in this repository — inspection at baseline main@41428ea found User,
 * UserIdentity, Session and SearchHistoryEntry, and no billing or
 * entitlement table of any kind. Inventing one would be the
 * "institutional billing / tier pages" scope §34 explicitly defers.
 * Until one exists, tier resolution is the honest minimum: a
 * signed-out caller is FREE, a signed-in caller is FREE. The seam is
 * `resolveTier`, and it is the single place that changes when a real
 * subscription record lands.
 */
@Injectable()
export class EntitlementService {
  constructor(private readonly pricing: SandPricingService) {}

  /**
   * The caller's tier.
   *
   * Returns FREE for everyone today. This is a truthful placeholder,
   * not a stub that pretends: there is no data source in this
   * repository that could say otherwise, and returning an optimistic
   * PROFESSIONAL would silently grant capabilities nobody has paid
   * for.
   */
  resolveTier(_caller: { userId?: string }): EntitlementTier {
    return 'FREE';
  }

  /**
   * §8 `entitlementState` — what happens if this caller runs this
   * class right now.
   *
   * The logic reads as the product rule it encodes:
   *
   *   - anything structurally free (STORED, CONTEXTUAL) is `included`
   *     for everyone, always — §7 says plainly that Sand is not a
   *     charge for reading, for evidence, or for reopening stored
   *     analysis;
   *   - an ordinary fresh Ask is `included`, because §5 puts it under
   *     quota/fair-use rather than Sand, and §20 shows ordinary Ask as
   *     a non-priced path;
   *   - genuinely expensive classes are `metered`.
   *
   * `quota-exhausted` and `not-entitled` are part of the contract and
   * are returned by the quota check below; they are not produced here,
   * because whether you have quota left is a different question from
   * whether your tier permits the class at all.
   */
  resolveState(input: {
    computeClass: ComputeClass;
    tier: EntitlementTier;
    /** True when a stored result will satisfy the request with no new execution. */
    storedResultAvailable: boolean;
    /** True when the caller's fair-use quota for this class is exhausted. */
    quotaExhausted?: boolean;
  }): EntitlementState {
    // §6 — a stored replay is free at point of use whatever the class
    // originally was. Checked first so a Deep Analysis result reopened
    // later never reports as `metered`.
    if (input.storedResultAvailable) return 'included';

    if (this.pricing.isStructurallyFree(input.computeClass)) return 'included';

    if (input.computeClass === 'FRESH_BOUNDED') {
      // §5 — quota, not Sand, governs the ordinary Ask.
      return input.quotaExhausted ? 'quota-exhausted' : 'included';
    }

    // DEEP_ANALYSIS and RESEARCH_REPORT. Reported as metered even
    // while SAND_CHARGING is off, because §9 requires the quote to be
    // shown and confirmed regardless; the charging flag governs
    // settlement, not disclosure.
    return 'metered';
  }

  /**
   * Whether an operation in this state may proceed to execution.
   *
   * `metered` is permitted here because §9's flow is
   * quote → confirm → execute: a metered operation the user has
   * confirmed is allowed to run. Confirmation is checked by the
   * caller, which holds the operation row; this method only answers
   * the entitlement half of the question.
   */
  mayExecute(state: EntitlementState): boolean {
    return state === 'included' || state === 'metered';
  }
}
