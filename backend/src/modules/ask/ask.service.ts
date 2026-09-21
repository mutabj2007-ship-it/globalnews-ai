import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  isTerminalOperationStatus,
  normalizeQuery,
  resolveCountryByAnyIdentifier,
  type AnalysisApiResponse,
  type AskContext,
  type AskThreadWithTurns,
  type AskTurn,
  type AskTurnResponse,
  type AskTurnStatus,
  type ComputeCostTelemetry,
  type SandQuote,
  type LanguageCode,
  type StoredResultIdentity,
} from '@globalnews-ai/shared';
import { AnalysisService } from '../analysis/service/analysis.service';
import { BetaFeatureFlagsService } from '../compute/flags/beta-feature-flags.service';
import { ComputeQuoteService } from '../compute/quote/compute-quote.service';
import { StoredResultService } from '../compute/stored-result/stored-result.service';
import {
  ComputeOperationService,
  type OperationOwner,
} from '../compute/operation/compute-operation.service';
import { EntitlementService } from '../compute/entitlement/entitlement.service';
import { AskThreadService } from './thread/ask-thread.service';
import { EvidenceRevisionService } from './evidence/evidence-revision.service';
import { deriveAskSignals } from './signals/derive-ask-signals.util';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — Ask AI Conversational V2.
 *
 * Implements §3's flow exactly:
 *
 *   QUESTION
 *     → resolve user/context
 *     → check stored intelligence/result
 *         ├── adequate → reuse
 *         └── insufficient → bounded retrieval → evidence → synthesis
 *     → answer + evidence/citations
 *
 * WHAT THIS SERVICE DOES NOT DO, deliberately:
 *
 * It does not reimplement retrieval, prompting, validation, trust
 * scoring or citation handling. It calls AnalysisService.analyzeNews()
 * — the existing, proven path — and returns its AnalysisApiResponse
 * unchanged as the turn's answer. §25 forbids redesigning retrieval,
 * and §26 protects the Analysis Workspace, Executive Brief, source
 * cards and Sources Dock, all of which read that exact contract. A
 * second synthesis path would put those at risk for no benefit.
 *
 * What this service adds around that call is: conversation identity,
 * stored-result-first, classification, quoting, confirmation,
 * idempotency, the reservation lifecycle, and cost telemetry.
 */

/**
 * How long a successfully-computed Ask answer stays reusable, beyond
 * evidence-revision invalidation.
 *
 * Long, because evidence revision — not a clock — is the primary
 * freshness mechanism (see EvidenceRevisionService). This TTL exists
 * only as a backstop against a corpus that stops ingesting entirely,
 * in which case the revision would stop advancing and a result could
 * otherwise be reused indefinitely.
 */
const STORED_ANSWER_TTL_SECONDS = 24 * 60 * 60;

/** Maps an AnalysisApiResponse onto the §3 turn-status vocabulary. */
function deriveTurnStatus(response: AnalysisApiResponse): AskTurnStatus {
  switch (response.provenance.status) {
    case 'success':
      return 'answered';
    case 'not-attempted':
      // §3 "no-report state": retrieval produced nothing to analyze.
      return 'no-evidence';
    case 'validation-rejected':
      // §3 "structurally invalid response state".
      return 'invalid-response';
    case 'failed':
      // §3 distinguishes "provider failure" from "analysis failure".
      // The existing AnalysisFailureReason taxonomy already draws that
      // line: provider-* reasons are the provider failing, everything
      // else is analysis failing after the provider answered.
      return response.provenance.failureReason?.startsWith('provider-')
        ? 'provider-failed'
        : 'analysis-failed';
  }
}

export interface AddTurnInput {
  owner: OperationOwner;
  threadId?: string;
  question: string;
  language: LanguageCode;
  context?: AskContext;
  idempotencyKey: string;
  confirmedOperationId?: string;
}

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly threads: AskThreadService,
    private readonly quotes: ComputeQuoteService,
    private readonly operations: ComputeOperationService,
    private readonly storedResults: StoredResultService,
    private readonly entitlement: EntitlementService,
    private readonly evidenceRevision: EvidenceRevisionService,
    private readonly flags: BetaFeatureFlagsService,
  ) {}

  /** §3 — the caller's conversations. */
  async listThreads(owner: OperationOwner) {
    return this.threads.listThreads(owner);
  }

  /** §3 — reopen a conversation. Reading a thread runs no AI and costs nothing. */
  async getThread(threadId: string, owner: OperationOwner): Promise<AskThreadWithTurns> {
    return this.threads.getThread(threadId, owner);
  }

  /**
   * §3 — adds one turn to a conversation, creating the thread if this
   * is the first turn.
   */
  async addTurn(input: AddTurnInput): Promise<AskTurnResponse> {
    const startedAt = Date.now();

    if (!this.flags.get().askConversationalV2) {
      throw new BadRequestException('Conversational Ask is not enabled');
    }

    const { originalQuery, normalizedQuery } = normalizeQuery(input.question);
    if (normalizedQuery.trim().length < 2) {
      throw new BadRequestException('Question is too short');
    }

    // §4 — geography from context wins over free-text detection, the
    // same priority AnalysisService itself already applies for
    // storyContext.countryCode (M51 Phase B). Resolving it here keeps
    // the evidence revision scoped to the geography actually in play.
    const resolvedCountry = input.context?.countryCode
      ? resolveCountryByAnyIdentifier(input.context.countryCode)
      : undefined;

    const evidenceRevision = await this.evidenceRevision.currentRevision(resolvedCountry?.iso2);

    const identity: StoredResultIdentity = {
      kind: 'ask-turn',
      normalizedTask: normalizedQuery,
      subjectId: input.context?.subjectId,
      countryCode: resolvedCountry?.iso2,
      language: input.language,
      evidenceRevision,
      timeWindow: input.context?.timeWindow,
      analysisType: input.context?.module,
    };

    const signals = deriveAskSignals({
      normalizedQuestion: normalizedQuery,
      context: input.context,
    });

    // §5/§6/§9 — classify, price and record, in one place.
    const { quote, storedResultId, reused } = await this.quotes.quote({
      owner: input.owner,
      kind: 'ask-turn',
      identity,
      signals,
      clientIdempotencyKey: input.idempotencyKey,
    });

    /**
     * §12 — DUPLICATE SUBMISSION REPLAY.
     *
     * This check must come BEFORE any turn is appended, and before
     * any lifecycle transition is attempted.
     *
     * §12 states the required behavior literally:
     *
     *     same idempotency key
     *            ↓
     *     existing operation/result
     *            ↓
     *          reuse
     *
     *     not:  run twice / charge twice
     *
     * A retried submission reuses the operation row, which by then is
     * already in a terminal state. Two things would go wrong without
     * this branch, and both did before it existed:
     *
     *   1. the lifecycle would be re-driven from COMPLETED, which the
     *      state machine correctly refuses — turning a benign browser
     *      retry into a 409 for the user;
     *   2. a second pair of turns would be appended, so a double
     *      click would visibly duplicate the exchange in the
     *      conversation.
     *
     * Instead the original exchange is returned verbatim. Note that a
     * terminal FAILED operation also replays its failure rather than
     * silently retrying: the same idempotency key means the same
     * logical operation, so it must yield the same outcome. A caller
     * that genuinely wants to try again sends a new key — which is
     * the standard contract for an idempotency key, and the only one
     * that keeps "never charged twice" true.
     */
    if (reused) {
      const existing = await this.operations.findById(quote.operationId);
      if (existing && isTerminalOperationStatus(existing.executionStatus)) {
        const replayed = await this.replayCompletedOperation({
          input,
          quote,
          operationStatus: existing.executionStatus,
          storedResultId: existing.storedResultId ?? undefined,
        });
        if (replayed) return replayed;
      }
    }

    const thread =
      input.threadId ??
      (
        await this.threads.createThread({
          owner: input.owner,
          firstQuestion: originalQuery,
          language: input.language,
          context: input.context,
        })
      ).id;

    const userTurn = await this.threads.appendTurn({
      threadId: thread,
      role: 'user',
      status: 'answered',
      question: originalQuery,
    });

    /**
     * §9 — CONFIRMATION GATE.
     *
     * Checked BEFORE any reservation or execution. A request that
     * needs confirmation and has not been confirmed returns the quote
     * and runs nothing — no retrieval, no provider call, no Sand
     * reserved. §20's "clever prompt must not bypass classification"
     * holds here because `quote.computeClass` was computed
     * server-side from deterministic signals, and the only thing the
     * client can send is `confirmedOperationId`, which must MATCH the
     * operation the server itself just quoted.
     */
    const isConfirmed = input.confirmedOperationId === quote.operationId;

    if (quote.requiresConfirmation && !isConfirmed) {
      const assistantTurn = await this.threads.appendTurn({
        threadId: thread,
        role: 'assistant',
        status: 'awaiting-confirmation',
        computeClass: quote.computeClass,
        operationId: quote.operationId,
      });

      return {
        threadId: thread,
        userTurn,
        assistantTurn,
        quote,
        entitlementState: quote.entitlementState,
        reused: false,
      };
    }

    // §7/§19 — entitlement. Checked after confirmation so a caller
    // who is not entitled is told so rather than being shown a price
    // they could never pay.
    if (!this.entitlement.mayExecute(quote.entitlementState)) {
      const assistantTurn = await this.threads.appendTurn({
        threadId: thread,
        role: 'assistant',
        status: 'blocked',
        computeClass: quote.computeClass,
        operationId: quote.operationId,
      });

      return {
        threadId: thread,
        userTurn,
        assistantTurn,
        quote,
        entitlementState: quote.entitlementState,
        reused: false,
      };
    }

    /**
     * §6/§30 — STORED RESULT REPLAY.
     *
     * "Reopening stored result triggers no new expensive execution."
     * This branch returns before AnalysisService is touched, so the
     * claim is structural: there is no code path from here to a
     * provider call.
     */
    if (storedResultId) {
      return this.replayStoredResult({
        input,
        threadId: thread,
        userTurn,
        storedResultId,
        quote,
        startedAt,
      });
    }

    return this.executeFresh({ input, threadId: thread, userTurn, identity, quote, startedAt });
  }

  /**
   * §12 — returns the exchange an already-terminal operation produced.
   *
   * Returns null when the original exchange cannot be recovered (Ask
   * persistence is off, so no turns were ever written). In that case
   * the caller falls through and computes normally — which is the
   * right trade: with persistence off there is no durable record to
   * be idempotent against, and returning nothing at all would be
   * worse than recomputing.
   */
  private async replayCompletedOperation(args: {
    input: AddTurnInput;
    quote: SandQuote;
    operationStatus: string;
    storedResultId?: string;
  }): Promise<AskTurnResponse | null> {
    const { input, quote, storedResultId } = args;

    const exchange = await this.threads.findExchangeByOperationId(quote.operationId);
    if (!exchange) return null;

    // Re-record the reuse so §31's cache-hit rate counts a replayed
    // duplicate as the saved execution it genuinely is.
    if (storedResultId) {
      await this.storedResults.recordReuse(storedResultId);
    }

    this.logger.debug(
      `Replaying operation ${quote.operationId} for a duplicate submission; nothing re-executed.`,
    );

    return {
      threadId: exchange.assistantTurn.threadId,
      userTurn: exchange.userTurn ?? {
        id: `${exchange.assistantTurn.id}-user`,
        threadId: exchange.assistantTurn.threadId,
        sequence: Math.max(exchange.assistantTurn.sequence - 1, 1),
        role: 'user',
        question: input.question,
        status: 'answered',
        createdAt: exchange.assistantTurn.createdAt,
      },
      assistantTurn: exchange.assistantTurn,
      entitlementState: quote.entitlementState,
      reused: true,
    };
  }

  /** §6 — replays a stored answer. Costs zero new Sand and makes no provider call. */
  private async replayStoredResult(args: {
    input: AddTurnInput;
    threadId: string;
    userTurn: AskTurn;
    storedResultId: string;
    quote: SandQuote;
    startedAt: number;
  }): Promise<AskTurnResponse> {
    const { input, threadId, userTurn, storedResultId, quote, startedAt } = args;

    const stored = await this.storedResults.findById<AnalysisApiResponse>(storedResultId);

    if (!stored) {
      // The row vanished between the quote and this read (an eviction,
      // an operator deletion). Falling through to a fresh execution is
      // correct — the user must get an answer — but the quote's
      // `quotedSand: 0` was issued on the premise of reuse, so honoring
      // it means this fresh execution is free. That is the right way
      // round: the user is never charged more than they were quoted.
      this.logger.warn(
        `Stored result ${storedResultId} disappeared after quoting; computing fresh at the quoted price.`,
      );
      return this.executeFresh({
        input,
        threadId,
        userTurn,
        identity: undefined,
        quote,
        startedAt,
      });
    }

    await this.storedResults.recordReuse(storedResultId);

    // The operation still walks its full lifecycle, so a replay is as
    // auditable as an execution — the ledger shows a completed
    // operation at 0 Sand rather than no record at all.
    await this.operations.reserve(quote.operationId, input.owner);
    await this.operations.markRunning(quote.operationId);
    await this.operations.complete(quote.operationId, input.owner, storedResultId);

    const telemetry: ComputeCostTelemetry = {
      operationId: quote.operationId,
      kind: 'ask-turn',
      computeClass: quote.computeClass,
      durationMs: Date.now() - startedAt,
      storedResultReused: true,
      cacheHit: true,
      // §14 — no provider fields. A replay made no provider call, and
      // recording zeros would corrupt the cost baseline.
    };
    await this.operations.recordTelemetry(quote.operationId, telemetry);

    const answer: AnalysisApiResponse = {
      ...stored.payload,
      // The envelope must reflect THIS caller's own question, exactly
      // as AnalysisService's own cache-hit path already does.
      query: input.question,
      provenance: { ...stored.payload.provenance, cached: true },
    };

    const assistantTurn = await this.threads.appendTurn({
      threadId,
      role: 'assistant',
      status: deriveTurnStatus(answer),
      answer,
      computeClass: quote.computeClass,
      storedResultReused: true,
      operationId: quote.operationId,
    });

    return {
      threadId,
      userTurn,
      assistantTurn,
      telemetry,
      entitlementState: quote.entitlementState,
      reused: true,
    };
  }

  /** §3 — bounded retrieval, evidence, synthesis, via the existing AnalysisService. */
  private async executeFresh(args: {
    input: AddTurnInput;
    threadId: string;
    userTurn: AskTurn;
    identity?: StoredResultIdentity;
    quote: SandQuote;
    startedAt: number;
  }): Promise<AskTurnResponse> {
    const { input, threadId, userTurn, identity, quote, startedAt } = args;

    await this.operations.reserve(quote.operationId, input.owner);
    await this.operations.markRunning(quote.operationId);

    let answer: AnalysisApiResponse;

    try {
      /**
       * §4 — the conversation's geography/subject is threaded into
       * retrieval as a StoryContext, reusing AnalysisService's own
       * existing M51 Phase B anchoring rather than inventing a second
       * mechanism. `title` is required by StoryContext, and the
       * subject label — falling back to the question itself — is the
       * truthful value for it.
       */
      const storyContext = input.context?.countryCode
        ? {
            title: input.context.subjectLabel ?? input.question,
            articleId: input.context.subjectId,
            countryCode: input.context.countryCode,
          }
        : undefined;

      answer = await this.analysisService.analyzeNews(input.question, input.language, storyContext);
    } catch (error) {
      /**
       * §13 — an exception escaping AnalysisService must release the
       * reservation. failAndRelease does both transitions and writes
       * the RELEASE row in one call, so there is no path where an
       * unhandled error leaves Sand reserved.
       */
      const failureType = error instanceof Error ? error.name : 'unknown';
      await this.operations.failAndRelease(quote.operationId, input.owner, failureType);
      await this.operations.recordTelemetry(quote.operationId, {
        durationMs: Date.now() - startedAt,
        storedResultReused: false,
        failureType,
      });

      const assistantTurn = await this.threads.appendTurn({
        threadId,
        role: 'assistant',
        status: 'provider-failed',
        computeClass: quote.computeClass,
        operationId: quote.operationId,
      });

      return {
        threadId,
        userTurn,
        assistantTurn,
        entitlementState: quote.entitlementState,
        reused: false,
      };
    }

    const status = deriveTurnStatus(answer);
    const succeeded = status === 'answered';

    /**
     * §6 — only a genuine success is stored for reuse.
     *
     * Caching a failure would replay a transient provider blip as
     * "the answer" for a full day. The existing AnalysisService
     * already draws this same distinction with its much shorter
     * FAILURE_CACHE_TTL_SECONDS; the durable store simply declines to
     * persist non-successes at all, because unlike a 15-second
     * in-memory entry, a durable one would outlive the incident.
     */
    let storedResultId: string | null = null;
    if (succeeded && identity) {
      storedResultId = await this.storedResults.store({
        identity,
        computeClass: quote.computeClass,
        payload: answer,
        ttlSeconds: STORED_ANSWER_TTL_SECONDS,
      });
    }

    /**
     * §13 — a non-success completes the operation as a FAILURE and
     * releases the reservation, rather than settling it. A "no
     * evidence found" or a provider timeout is not something anyone
     * should pay for, and §13 says so directly.
     */
    if (succeeded) {
      await this.operations.complete(quote.operationId, input.owner, storedResultId ?? undefined);
    } else {
      await this.operations.failAndRelease(
        quote.operationId,
        input.owner,
        answer.provenance.failureReason ?? answer.provenance.status,
      );
    }

    const telemetry: ComputeCostTelemetry = {
      operationId: quote.operationId,
      kind: 'ask-turn',
      computeClass: quote.computeClass,
      durationMs: Date.now() - startedAt,
      storedResultReused: false,
      cacheHit: answer.provenance.cached,
      provider: answer.provenance.provider,
      model: answer.provenance.model,
      inputTokens: answer.provenance.tokenUsage?.promptTokens,
      outputTokens: answer.provenance.tokenUsage?.completionTokens,
      evidenceCount: answer.articles.length,
      failureType: succeeded ? undefined : answer.provenance.failureReason,
    };
    await this.operations.recordTelemetry(quote.operationId, telemetry);

    const assistantTurn = await this.threads.appendTurn({
      threadId,
      role: 'assistant',
      status,
      answer,
      computeClass: quote.computeClass,
      storedResultReused: false,
      operationId: quote.operationId,
    });

    return {
      threadId,
      userTurn,
      assistantTurn,
      telemetry,
      entitlementState: quote.entitlementState,
      reused: false,
    };
  }
}
