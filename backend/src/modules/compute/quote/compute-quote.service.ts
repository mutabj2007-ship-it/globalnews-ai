import { Injectable } from '@nestjs/common';
import type { ComputeOperationKind, SandQuote, StoredResultIdentity } from '@globalnews-ai/shared';
import { BetaFeatureFlagsService } from '../flags/beta-feature-flags.service';
import { EntitlementService } from '../entitlement/entitlement.service';
import { SandPricingService } from '../pricing/sand-pricing.service';
import { StoredResultService } from '../stored-result/stored-result.service';
import {
  ComputeOperationService,
  type OperationOwner,
} from '../operation/compute-operation.service';
import {
  classifyCompute,
  type ComputeClassificationInput,
} from '../classification/classify-compute.util';

/**
 * BETA-SIMPLE-ASK-SAND-1 §9 — PRE-EXECUTION QUOTE.
 *
 * The orchestration seam §6 and §9 describe, in order:
 *
 *   REQUEST
 *     → is there an adequate stored result?          (§6)
 *         yes → STORED, 0 Sand, nothing to confirm
 *         no  → classify                             (§5)
 *               → price                              (§8)
 *               → resolve entitlement                (§7/§19)
 *               → create/reuse the operation row     (§12)
 *               → return a quote                     (§9)
 *
 * The order is the design. The stored-result check runs BEFORE
 * classification, not after, because §6 says the stored check comes
 * "before expensive AI execution" and because a stored hit makes
 * classification moot — there is no work left to classify. Doing it
 * the other way round would still be correct but would compute a
 * class and a price we then discard, and would make it far easier for
 * a later change to accidentally charge for a replay.
 *
 * This service NEVER executes anything. It classifies, prices and
 * records. Execution is the caller's job, after confirmation where
 * §9 requires it.
 */

export interface QuoteRequest {
  owner: OperationOwner;
  kind: ComputeOperationKind;
  /** §6 — the identity used to look for an existing stored result. */
  identity: StoredResultIdentity;
  /** §5 — the deterministic planning signals, minus the stored-result flag this service supplies. */
  signals: Omit<ComputeClassificationInput, 'kind' | 'storedResultAvailable'>;
  /** §12 — the client-supplied idempotency key. */
  clientIdempotencyKey: string;
  /** True when the caller's fair-use quota for the resulting class is exhausted. */
  quotaExhausted?: boolean;
}

export interface QuoteResult {
  quote: SandQuote;
  /** §12 — true when this quote reuses an operation that already existed. */
  reused: boolean;
  /** Present when a stored result satisfies the request. */
  storedResultId?: string;
}

@Injectable()
export class ComputeQuoteService {
  constructor(
    private readonly flags: BetaFeatureFlagsService,
    private readonly pricing: SandPricingService,
    private readonly entitlement: EntitlementService,
    private readonly storedResults: StoredResultService,
    private readonly operations: ComputeOperationService,
  ) {}

  /**
   * Produces a quote for one operation, creating (or reusing) its
   * ComputeOperation row.
   */
  async quote(request: QuoteRequest): Promise<QuoteResult> {
    // §6 — stored-result-first. Runs before anything is classified or
    // priced.
    const stored = await this.storedResults.find(request.identity);
    const storedResultAvailable = stored !== null;

    // §5 — the authoritative, server-side classification. Note that
    // `storedResultAvailable` is supplied by THIS service from a real
    // database lookup; a client cannot assert it.
    const classification = classifyCompute({
      ...request.signals,
      kind: request.kind,
      storedResultAvailable,
    });

    const { computeClass } = classification;

    /**
     * §16 defence in depth. The classifier already caps a
     * category-view at CONTEXTUAL, and SandPricingService already
     * prices CONTEXTUAL at 0. This third check means a category click
     * could not produce a non-zero quote even if both of those were
     * changed — the rule the Product Owner stated most firmly
     * ("minimize every click that runs AI quota") does not rest on a
     * single line of code.
     */
    const neverMetered = this.pricing.isNeverMeteredKind(request.kind);

    const tier = this.entitlement.resolveTier();
    const entitlementState = neverMetered
      ? 'included'
      : this.entitlement.resolveState({
          computeClass,
          tier,
          storedResultAvailable,
          quotaExhausted: request.quotaExhausted,
        });

    const quotedSand =
      neverMetered || storedResultAvailable ? 0 : this.pricing.priceFor(computeClass);

    /**
     * §9 — confirmation is required when the CLASS says so AND there
     * is genuinely new work to do. A stored replay never asks for
     * confirmation, because there is nothing to confirm: it costs
     * nothing and runs nothing. §7: "Sand is not… a charge for
     * reopening stored analysis."
     */
    const requiresConfirmation =
      !storedResultAvailable && !neverMetered && classification.requiresConfirmation;

    const ttlSeconds = this.pricing.quoteTtlSeconds();

    // §12 — one row per logical submission, created here at quote
    // time so the confirm step has something stable to refer to.
    const { operation, reused } = await this.operations.createOrReuse({
      owner: request.owner,
      kind: request.kind,
      computeClass,
      quotedSand,
      requiresConfirmation,
      entitlementState,
      clientIdempotencyKey: request.clientIdempotencyKey,
      quoteTtlSeconds: ttlSeconds,
      storedResultId: stored?.id,
    });

    /**
     * When the operation was reused, the EXISTING row is
     * authoritative for price, class and confirmation — not this
     * request's freshly-computed values. Re-quoting a confirmed
     * operation at a new price is precisely the double-charge-shaped
     * bug §12 exists to prevent, and it would also let a caller
     * re-roll a classification they did not like by resubmitting.
     */
    const quote: SandQuote = {
      operationId: operation.id,
      kind: request.kind,
      computeClass: reused ? (operation.computeClass as SandQuote['computeClass']) : computeClass,
      quotedSand: reused ? operation.quotedSand : quotedSand,
      requiresConfirmation: reused ? operation.requiresConfirmation : requiresConfirmation,
      entitlementState: reused
        ? (operation.entitlementState as SandQuote['entitlementState'])
        : entitlementState,
      storedResultAvailable,
      resultId: stored?.id,
      label: this.pricing.labelFor(
        reused ? (operation.computeClass as SandQuote['computeClass']) : computeClass,
      ),
      rationale: classification.rationale,
      expiresAt: (
        operation.quoteExpiresAt ?? new Date(Date.now() + ttlSeconds * 1000)
      ).toISOString(),
      // §10 — reported truthfully so the UI can say "this will not be
      // charged during Beta" rather than implying a debit that will
      // never happen.
      chargingEnabled: this.flags.get().sandCharging,
    };

    return { quote, reused, storedResultId: stored?.id };
  }
}
