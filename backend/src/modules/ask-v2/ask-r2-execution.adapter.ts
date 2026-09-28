import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisService } from '../analysis/service/analysis.service';
import { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { ANALYSIS_PROVIDER } from '../analysis/providers/provider.tokens';
import type { AnalysisProvider } from '../analysis/interfaces';
import {
  CircuitBreakerService,
  type BreakerOutcome,
} from '../compute-controls/circuit-breaker.service';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import { ASK_MODEL_MAX_ATTEMPTS } from '../compute-controls/compute-controls.config';
import { SpecialistClaimRegistry } from '../specialist/specialist-claim.registry';
import { routeAskR2, missingSeams, type AskR2Route } from '../ask-router/ask-r2-route';
import {
  answerStateBeforeExecution,
  deriveAnswerState,
  requiredRolesOf,
} from '../ask-router/answer-state';
import { readContinuationEllipsis } from '../analysis/anchor/continuation-ellipsis.util';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import { planChips } from '../ask-router/plan-chips';
import type { PlannerDeps } from '../ask-router/frozen-c/src/planner';
import {
  AskExecutionRefused,
  hashIdentity,
  type AskExecutionPort,
  type AskPlan,
  type AskRequest,
  type ExecutionResult,
} from './ask-compute.contract';
import { askRequestContext } from './ask-request-context';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE E — THE EXECUTION ADAPTER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The one binding of the landed `ASK_EXECUTION_PORT` (contract §8: "Wire existing
 * ASK_EXECUTION_PORT to the approved path, no second provider framework"). Ask V2 keeps
 * everything it already owns — thread, quote, explicit acceptance for deep/report work,
 * reservation, the durable RUNNING claim that is committed BEFORE the external call, lease
 * expiry, StoredResult, ownership. This adapter adds only:
 *
 *   prepare   frozen C, through the integrated route. PURE: no provider, no model, no
 *             network, no clock read beyond the plan's validity window.
 *   execute   1  re-route (pure) and require the same revision the quote was made on;
 *             2  a terminal that needs no model — clarification, broadening, capability
 *                unavailable, identity — returns its deterministic answer with ZERO AI;
 *                a plan that REQUIRES evidence this executor cannot supply (anything but
 *                reporting) is CAPABILITY_UNAVAILABLE / EXECUTOR_NOT_WIRED, ZERO AI (GATE H);
 *             3  otherwise, in this order, each failing CLOSED with a named control:
 *                  ASK_R2_ENABLED and ASK_PUBLIC_COMPUTE_ENABLED (two-key switches, F 03)
 *                  the server-held request context (account + IP scope) must exist
 *                  the shared circuit breaker (F 02)
 *                  the atomic compute-meter reservation (F 01: global first, then
 *                  provider, account, IP, concurrency)
 *             4  ONE call to the landed analysis path (`AnalysisService.analyzeNews`, the
 *                approved provider architecture) with `maxModelAttempts =
 *                ASK_MODEL_MAX_ATTEMPTS` (1) and a usage sink;
 *             5  settle the reservation on ACTUAL units, record the breaker outcome;
 *             6  a landed clarification (e.g. an ambiguous country) is returned as the
 *                reader's question, with its candidates (GATE H);
 *             7  derive the §7 answer state (the one derivation) and return a display
 *                artifact.
 *
 * A refusal is THROWN as `AskExecutionRefused(code)`, never returned as a success: a
 * returned success becomes a StoredResult that would be reused after the control lifts.
 * The service records `code` as the operation's failureCode.
 *
 * Sand stays off (`SAND_CHARGING_ENABLED` is a `false` literal); nothing here reads or
 * writes a balance. `ASK_V2_ENABLED` alone activates no AI: step 3 needs both switches,
 * and both default OFF.
 */

export const ASK_R2_ADAPTER_VERSION = 'ask-r2-adapter/1';
export const ASK_R2_PAYLOAD_SCHEMA = 'ask-r2-result/1';

/** How long a prepared plan (and so its stored result) stays valid. */
const PLAN_VALIDITY_MS = 15 * 60 * 1000;

/**
 * Frozen C routing inputs for one Ask V2 request. Explicit Send IS the compute consent.
 * GATE H: the request instant (for a HISTORICAL period) and whether the caller holds a
 * verified account identity (frozen B7: a personal question is IDENTITY_REQUIRED without
 * one) are server-held facts of THIS request, never read from the question or the client.
 */
function routeFor(request: Readonly<AskRequest>, deps: PlannerDeps): AskR2Route {
  const who = askRequestContext.getStore();
  return routeAskR2(
    {
      originalQuestion: request.question,
      sourceLanguage: request.language,
      normalizationLanguage: request.language,
      displayLanguage: request.language,
      origin: 'ASK',
    },
    {
      computeConsent: 'GRANTED',
      requestInstant: new Date().toISOString(),
      ...(who === undefined ? {} : { identityVerified: who.accountId !== null }),
    },
    deps,
  );
}

/**
 * GATE H — the ONE evidence role this executor can supply. The landed analysis path
 * retrieves reporting; it cannot read an official artifact, a specialist assessment, a
 * personal library, a file or a computation. A plan that REQUIRES any of those is not run
 * against reporting instead: that would be the silent substitution frozen C forbids.
 */
const EXECUTOR_SUPPLIES: ReadonlySet<string> = new Set(['REPORTING']);

interface AnswerDecision {
  readonly state: string;
  readonly basis: string;
  readonly missingRoles: readonly string[];
  /** A landed clarification's candidates (e.g. COD/COG), codes only. */
  readonly candidates?: readonly string[];
}

/** Everything about the route that could change what is retrieved or answered. */
function routeSignature(route: AskR2Route): unknown[] {
  const e = route.envelope;
  const p = route.plan;
  return [
    route.outcome.status,
    e.language.questionLanguage,
    e.geography.candidates.map((c) => `${c.source}:${c.value}:${c.precision}`),
    e.domains.domains,
    e.topic.readerTerms,
    e.time.statedPeriod,
    e.time.requirement,
    e.currentStatus.requested,
    e.classifiers.queryIntent,
    p.questionClass,
    p.terminalState,
    p.scopedBy,
    p.evidenceRequests.map((r) => `${r.evidenceClass}:${r.required}`),
    p.refusals,
    p.disclosures,
  ];
}

/** ISO3 → the reader's own words for the place, from the qualified reading. */
function placeSpansOf(route: AskR2Route): Record<string, string> {
  if (route.outcome.status === 'NOT_READ') return {};
  const spans: Record<string, string> = {};
  for (const g of route.outcome.reading.geography) {
    if (g.matchedText !== undefined && spans[g.value] === undefined) spans[g.value] = g.matchedText;
  }
  return spans;
}

export function planRevision(request: Readonly<AskRequest>, route: AskR2Route): string {
  return hashIdentity([
    ASK_R2_ADAPTER_VERSION,
    request.question,
    request.language,
    request.intent,
    routeSignature(route),
  ]);
}

/** Estimated units for one analysis call (F 01 L-12: input + outputWeight × output). */
export function estimateUnits(
  questionChars: number,
  analysis: { maxArticles: number; maxArticleChars: number; maxCompletionTokens: number },
  outputWeight: number,
): number {
  const promptChars = analysis.maxArticles * analysis.maxArticleChars + questionChars + 6000;
  return Math.ceil(promptChars / 4) + outputWeight * analysis.maxCompletionTokens;
}

@Injectable()
export class AskR2ExecutionAdapter implements AskExecutionPort {
  private readonly logger = new Logger(AskR2ExecutionAdapter.name);
  private readonly deps: PlannerDeps;

  constructor(
    private readonly analysis: AnalysisService,
    @Inject(ANALYSIS_PROVIDER) private readonly provider: AnalysisProvider,
    private readonly meter: ComputeMeterService,
    private readonly breaker: CircuitBreakerService,
    private readonly switches: OperationalSwitchService,
    private readonly analysisConfig: AnalysisConfigService,
    specialists: SpecialistClaimRegistry,
  ) {
    this.deps = {
      specialistRegistry: landedSpecialistRegistryPort(() => specialists.registeredDomains()),
    };
  }

  async prepare(request: Readonly<AskRequest>): Promise<AskPlan> {
    const route = routeFor(request, this.deps);
    const missing = missingSeams(route);
    if (missing.length > 0)
      throw new AskExecutionRefused(`ASK_R2_SEAM_MISSING:${missing.join(',')}`);
    const revision = planRevision(request, route);
    const typedPlaces = route.envelope.geography.candidates.filter(
      (c) => c.source !== 'MAP_GEOGRAPHY_CONTEXT',
    );
    return {
      revision,
      scope: JSON.stringify({
        scopedBy: route.plan.scopedBy,
        geography: typedPlaces.map((c) => `${c.source}:${c.value}`),
        domains: route.envelope.domains.domains,
        statedPeriod: route.envelope.time.statedPeriod,
      }),
      contract: `${ASK_R2_ADAPTER_VERSION}:${route.plan.questionClass}:${route.plan.terminalState}`,
      executionKey: hashIdentity([revision, 'execute']),
      validUntil: new Date(Date.now() + PLAN_VALIDITY_MS).toISOString(),
      contextual: false,
      deepRequested: request.intent === 'deep-analysis',
      reportRequested: request.intent === 'research-report',
      countryCount: new Set(typedPlaces.map((c) => c.value)).size,
      domainCount: route.envelope.domains.domains.length,
      /* A stated period is text at the reader's precision; no clock converts it here. */
      timeWindowDays: 0,
    };
  }

  async execute(
    request: Readonly<AskRequest>,
    plan: Readonly<AskPlan>,
    operationId: string,
  ): Promise<ExecutionResult> {
    const route = routeFor(request, this.deps);
    if (planRevision(request, route) !== plan.revision) {
      throw new AskExecutionRefused('ASK_PLAN_REVISION_MISMATCH');
    }

    /* 2 · a terminal that needs no model answers with ZERO AI. */
    const early = answerStateBeforeExecution(route.plan);
    if (early !== null && early.state !== 'REFERENCE_BACKGROUND') {
      return this.result(plan, route, operationId, early, null, false);
    }
    /*
      ALPHA ENABLEMENT R1 (MC-070) — "And Kenya?" continues nothing: an Ask R2 request
      carries no earlier question, so there is no subject to inherit. It is not searched as
      "Kenya news" (an answer to a question the reader did not ask); the reader is asked
      what they want to know, with the place they named kept as the candidate. 0 AI, no
      control touched.
    */
    const continuation = readContinuationEllipsis(request.question);
    if (continuation !== null) {
      return this.result(
        plan,
        route,
        operationId,
        {
          state: 'CLARIFICATION_REQUIRED',
          basis: 'NO_PRIOR_SUBJECT',
          missingRoles: [],
          candidates: [...continuation.candidates],
        },
        null,
        false,
      );
    }
    const unsupplied = requiredRolesOf(route.plan).filter((r) => !EXECUTOR_SUPPLIES.has(r));
    if (unsupplied.length > 0) {
      return this.result(
        plan,
        route,
        operationId,
        { state: 'CAPABILITY_UNAVAILABLE', basis: 'EXECUTOR_NOT_WIRED', missingRoles: unsupplied },
        null,
        false,
      );
    }

    /* 3 · controls, in order, each failing closed. */
    if (!(await this.switches.isEnabled('ASK_R2_ENABLED')))
      throw new AskExecutionRefused('ASK_R2_DISABLED');
    if (!(await this.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED'))) {
      throw new AskExecutionRefused('ASK_PUBLIC_COMPUTE_DISABLED');
    }
    const who = askRequestContext.getStore();
    if (who === undefined) throw new AskExecutionRefused('ASK_REQUEST_CONTEXT_MISSING');

    const provider = this.provider.id;
    const permit = await this.breaker.permit(provider);
    if (!permit.allowed) throw new AskExecutionRefused(`CIRCUIT_${permit.state}`);

    const analysisConfig = this.analysisConfig.get();
    const reservation = await this.meter.reserve({
      accountId: who.accountId,
      ipScope: who.ipScope,
      provider,
      estimatedUnits: estimateUnits(
        request.question.length,
        analysisConfig,
        this.meter.config.outputWeight,
      ),
    });
    if (!reservation.admitted) {
      await this.breaker.record(provider, 'REFUSAL', permit.trial);
      throw new AskExecutionRefused(`BUDGET_${reservation.kind}:${reservation.control}`);
    }

    /* 4 · ONE call to the approved analysis path, one model attempt at most. */
    let usage: { promptTokens: number; completionTokens: number } | null = null;
    let outcome: BreakerOutcome = 'FAILURE';
    let response: AnalysisApiResponse | null = null;
    let noEvidence = false;
    try {
      response = await this.analysis.analyzeNews(
        request.question,
        request.language,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          maxModelAttempts: ASK_MODEL_MAX_ATTEMPTS,
          usageSink: (u) => {
            usage = { promptTokens: u.promptTokens, completionTokens: u.completionTokens };
          },
        },
      );
      /* The landed path's no-evidence answer (0 articles, "no AI call was made") is not a
         provider failure: the breaker is told nothing happened. A null analysis WITH
         retrieved articles is the provider-failure path. */
      noEvidence = response.analysis === null && response.articles.length === 0;
      outcome = noEvidence
        ? 'REFUSAL'
        : response.analysis === null && response.analysisError !== undefined
          ? 'FAILURE'
          : 'SUCCESS';
    } catch (error) {
      outcome = /timeout|deadline/i.test((error as Error)?.message ?? '') ? 'TIMEOUT' : 'FAILURE';
    } finally {
      /* 5 · settle on actual units (null keeps the estimate — the safe direction). */
      const used = usage as { promptTokens: number; completionTokens: number } | null;
      const actual =
        used !== null
          ? used.promptTokens + this.meter.config.outputWeight * used.completionTokens
          : noEvidence
            ? 0
            : null;
      await this.meter.settle(
        reservation.reservationId,
        actual,
        noEvidence ? 'NO_EVIDENCE' : outcome,
      );
      await this.breaker.record(provider, outcome, permit.trial);
    }
    if ((outcome !== 'SUCCESS' && !noEvidence) || response === null) {
      throw new AskExecutionRefused(`MODEL_${outcome}`);
    }

    /* 6 · the landed path ASKED the reader (e.g. a bare "Congo", Main MC-069): its own
       clarification, with its candidates, and no model call was made. */
    const landed = response.retrievalContext;
    if (landed?.retrievalOutcome === 'CLARIFICATION_REQUIRED') {
      return this.result(
        plan,
        route,
        operationId,
        {
          state: 'CLARIFICATION_REQUIRED',
          basis: `LANDED_${landed.clarificationReason ?? 'CLARIFICATION'}`,
          missingRoles: [],
          candidates: [...(landed.clarificationCandidates ?? [])],
        },
        response,
        false,
      );
    }
    /* 7 · the §7 answer state — the one derivation. */
    const answer = deriveAnswerState(route.plan, {
      items: { REPORTING: response.articles.length },
      producedAnswer: response.analysis !== null,
    });
    /* AI executed = the analysis path produced a model answer (the usage sink is metering only). */
    return this.result(plan, route, operationId, answer, response, response.analysis !== null);
  }

  private result(
    plan: Readonly<AskPlan>,
    route: AskR2Route,
    operationId: string,
    answer: AnswerDecision,
    analysis: AnalysisApiResponse | null,
    aiExecuted: boolean,
  ): ExecutionResult {
    this.logger.log(
      `ask-r2 operation=${operationId} class=${route.plan.questionClass} terminal=${route.plan.terminalState} ` +
        `normalization=${route.outcome.status} language=${route.envelope.language.questionLanguage} ` +
        `answer=${answer.state} aiExecuted=${aiExecuted}`,
    );
    return {
      succeeded: true,
      payloadJson: JSON.stringify({
        schema: ASK_R2_PAYLOAD_SCHEMA,
        route: {
          questionClass: route.plan.questionClass,
          terminalState: route.plan.terminalState,
          scopedBy: route.plan.scopedBy,
          refusals: route.plan.refusals,
          disclosures: route.plan.disclosures,
          clarification: route.plan.clarification.map((c) => c.code),
          normalization: route.outcome.status,
          questionLanguage: route.envelope.language.questionLanguage,
          /* MC-055 — which personal library the question is about (wording only). */
          personalScope:
            route.envelope.personal.scope === 'SAVED_STORIES' ||
            route.envelope.personal.scope === 'INTERESTS'
              ? route.envelope.personal.scope
              : null,
        },
        /* D25 05: chips from the effective server plan only, in the order asked. */
        chips: planChips(route.envelope, route.plan, placeSpansOf(route)),
        answer,
        /* When the answer was decided — the freshness line's time when no analysis ran. */
        checkedAt: new Date().toISOString(),
        aiExecuted,
        modelPriorCitable: false,
        analysis,
      }),
      evidenceRevision: plan.revision,
      validUntil: plan.validUntil,
    };
  }
}
