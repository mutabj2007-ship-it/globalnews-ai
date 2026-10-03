import { solveComputation, type ComputationResult } from './computation/deterministic-computation';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  AnalysisApiResponse,
  MultiStoryAction,
  SelectedStoryRef,
} from '@globalnews-ai/shared';
import { findCountryByIso3 } from '@globalnews-ai/shared';
import { NewsService } from '../news/news.service';
import { readCompanionIntent, servesIntent, type CompanionIntent } from './companion-relevance';
import { withDeadline } from '../compute-controls/compute-scopes';
import { AnalysisService } from '../analysis/service/analysis.service';
import { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import { ANALYSIS_PROVIDER } from '../analysis/providers/provider.tokens';
import {
  GENERAL_BACKGROUND_PROVIDER,
  GENERAL_BACKGROUND_MAX_COMPLETION_TOKENS,
} from '../analysis/providers/general-background.provider';
import type { AnalysisProvider, GeneralBackgroundProvider } from '../analysis/interfaces';
import {
  CircuitBreakerService,
  type BreakerOutcome,
} from '../compute-controls/circuit-breaker.service';
import {
  ComputeMeterService,
  type GuestComputeScope,
} from '../compute-controls/compute-meter.service';
import { GuestSessionService } from './guest/guest-session.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import { ASK_MODEL_MAX_ATTEMPTS } from '../compute-controls/compute-controls.config';
import { SpecialistClaimRegistry } from '../specialist/specialist-claim.registry';
import {
  routeAskR2,
  missingSeams,
  type AskR2Route,
  type AskRouteContext,
} from '../ask-router/ask-r2-route';
import { DECISION_OBJECTIVE_CANDIDATES } from '../ask-router/decision-support';
import {
  completionCeilingFor,
  FALLBACK_SEMANTIC_JOB,
  JOB_CLASSIFIER_MAX_TOKENS,
  JOB_CLASSIFIER_SYSTEM,
  jobClassifierUserMessage,
  jobRulesFor,
  parseSemanticJob,
  type SemanticJob,
} from './job-execution';
import {
  artifactIdentity,
  artifactPromptBlock,
  splitArtifact,
  type ConversationArtifact,
} from './conversation/conversation-artifact';
import {
  answerStateBeforeExecution,
  deriveAnswerState,
  requiredRolesOf,
} from '../ask-router/answer-state';
import { readContinuationEllipsis } from '../analysis/anchor/continuation-ellipsis.util';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import { planChips, withRelationshipScope, type PlanChips } from '../ask-router/plan-chips';
import type { PlannerDeps } from '../ask-router/frozen-c/src/planner';
import type { RoutingPlan, VerificationOutcome } from '../ask-router/frozen-c/src/ports';
import {
  AskSpecialistReadCoordinator,
  type AskContributionSet,
} from '../ask-intelligence/ask-specialist-read.coordinator';
import {
  deterministicGovernedSelection,
  explicitOfficialUnavailable,
  governedPrompt,
  governedRecordBasis,
} from '../ask-intelligence/governed-answer';
import { selectContributors } from '../ask-intelligence/contributor-selection';
import {
  corroborateCurrentStatus,
  corroborationTargetOf,
  type CorroborationResult,
} from './current-status-corroboration';
import {
  AskExecutionRefused,
  classifyCompute,
  hashIdentity,
  type AskExecutionPort,
  type AskPlan,
  type AskRequest,
  type ExecutionResult,
} from './ask-compute.contract';
import { askRequestContext, type AskRequestContext } from './ask-request-context';
import { contextIdentityToken, type ResolvedAskContext } from './context/resolved-ask-context';
import { isSameHeadline } from '../news/identity/headline-identity.util';
import { AskObservationService } from '../ask-observability/ask-observation.service';
import {
  newAskObservationDraft,
  type AskObservationDraft,
} from '../ask-observability/ask-observation.contract';

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

/** TRUST R1 — retained reporting listed beside a place-background answer (listed, not analysed). */
export interface RecentReporting {
  readonly country: string;
  /** CTO P0 · Defect E — the reader's task the listed items serve (labels the block). */
  readonly topic?: CompanionIntent;
  readonly status: 'LISTED' | 'NONE_RETAINED' | 'UNAVAILABLE';
  readonly windowDays: number;
  readonly items: readonly {
    readonly title: string;
    readonly url: string;
    readonly sourceName: string;
    readonly publishedAt: string;
  }[];
}
const RECENT_REPORTING_LIMIT = 5;
/** CTO P0 · Defect E — retained candidates read to find up to 5 TASK-relevant items (DB only). */
const COMPANION_CANDIDATE_POOL = 30;
const RECENT_REPORTING_DAYS = 14;
const RECENT_REPORTING_DEADLINE_MS = 2500;
/** A publication time this far ahead of the server clock is tolerated (provider clock skew). */
const RECENT_REPORTING_CLOCK_SKEW_MS = 5 * 60 * 1000;

/** How long a prepared plan (and so its stored result) stays valid. */
const PLAN_VALIDITY_MS = 15 * 60 * 1000;

/**
 * Frozen C routing inputs for one Ask V2 request. Explicit Send IS the compute consent.
 * GATE H: the request instant (for a HISTORICAL period) and whether the caller holds a
 * verified account identity (frozen B7: a personal question is IDENTITY_REQUIRED without
 * one) are server-held facts of THIS request, never read from the question or the client.
 */
function routeFor(
  request: Readonly<AskRequest>,
  baseDeps: PlannerDeps,
  /** CTO R4 — the bounded semantic classifier's verdict for an UNRESOLVED question. */
  semanticJob?: SemanticJob,
): AskR2Route {
  const who = askRequestContext.getStore();
  /*
    ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — COMPUTATION is a bound capability for
    THIS request only when the deterministic engine can solve it from the reader's own values
    (frozen C's injectable capability map; the frozen default stays NO_EXECUTOR otherwise). A
    recognised formula with missing inputs is bound too, so the reader is asked for exactly them.
  */
  const deps: PlannerDeps =
    solveComputation(request.question) !== undefined
      ? { ...baseDeps, capabilities: { ...baseDeps.capabilities, COMPUTATION: 'BOUND' } }
      : baseDeps;
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
      /* ASK R3 CONTINUITY — frozen C already reads conversationSubject from it. */
      ...(who?.priorQuestion ? { priorQuestion: who.priorQuestion } : {}),
      /* UNIFIED INTELLIGENCE BINDING R2B — THIS turn's server-resolved context, through the
         landed seams only (frozen C and its eligibility rules are untouched). */
      ...routeContextOf(request.context, request.question),
      /* CTO R4 — this conversation's earlier work (memory, never scope or evidence) */
      ...(request.priorArtifact === undefined
        ? {}
        : { priorWork: { kind: request.priorArtifact.kind, label: request.priorArtifact.label } }),
      ...(semanticJob === undefined
        ? {}
        : {
            semanticJob: {
              job: semanticJob.job,
              needsCurrentEvidence: semanticJob.needsCurrentEvidence,
            },
          }),
    },
    deps,
  );
}

/**
 * UNIFIED INTELLIGENCE BINDING R2B — resolved context → the landed AskRouteContext seams.
 *
 *   STORY      hasResolvedArticleAnchor = true, and storyAnchorCountry = the stored article's
 *              own governed country when it has one (STORY_ANCHOR → precedence ARTICLE_ANCHOR).
 *   GEOGRAPHY  mapContextCountry = ISO3 (MAP_GEOGRAPHY_CONTEXT, the weakest rung).
 *
 * `articleRefs` is deliberately NOT set for a single story. In frozen C a non-empty
 * `selection.articleRefs` is the multi-story SELECTION rank, which sits ABOVE typed geography in
 * DECLARED_PRECEDENCE (and carries a SELECTION constraint): a single anchored story would then
 * outrank a place the reader typed, reversing the landed rule that typed scope outranks an
 * inherited story. Selection is R2D's contract; ARTICLE_ANCHOR is the single-story rung.
 */
export function routeContextOf(
  context: ResolvedAskContext | undefined,
  /** R2E — this turn's question, to recognise the anchored story's own headline. */
  question?: string,
): Pick<
  AskRouteContext,
  | 'hasResolvedArticleAnchor'
  | 'storyAnchorCountry'
  | 'mapContextCountry'
  | 'articleRefs'
  | 'questionIsStoryHeadline'
> {
  if (context === undefined) return {};
  /* R2F — a dashboard record's country is INHERITED context (the weakest rank): a place the
     reader types still outranks it, exactly as with a Map country. */
  if (context.kind === 'MODULE') {
    return context.countryIso3 === undefined ? {} : { mapContextCountry: context.countryIso3 };
  }
  /* R2D — a SELECTION is frozen C's own multi-story transport (the SELECTION rank). */
  if (context.kind === 'SELECTION') {
    return { articleRefs: context.stories.map((story) => story.articleRef) };
  }
  if (context.kind === 'STORY') {
    return {
      hasResolvedArticleAnchor: true,
      ...(context.countryIso3 === undefined ? {} : { storyAnchorCountry: context.countryIso3 }),
      /* R2E — the server-resolved title (never client text) decides it. */
      ...(isSameHeadline(question, context.storyContext.title)
        ? { questionIsStoryHeadline: true }
        : {}),
    };
  }
  return { mapContextCountry: context.countryIso3 };
}

/**
 * GATE H — the ONE evidence role this executor can supply. The landed analysis path
 * retrieves reporting; it cannot read an official artifact, a specialist assessment, a
 * personal library, a file or a computation. A plan that REQUIRES any of those is not run
 * against reporting instead: that would be the silent substitution frozen C forbids.
 */
export const EXECUTOR_SUPPLIES: ReadonlySet<string> = new Set([
  'REPORTING',
  /*
    INTELLIGENCE BINDING R1 — SPECIALIST is now a role this executor genuinely supplies: a bound
    specialist leg (CONFLICT, whose callable read seam is AskSpecialistReadCoordinator) is READ,
    and its governed observations are counted into the one answer derivation. OFFICIAL is still
    not supplied (no official reader exists) — news is never relabelled as official evidence.
  */
  'SPECIALIST',
]);

const NO_CONTRIBUTIONS: AskContributionSet = { considered: [], contributions: [] };

/** Governed specialist items obtained — the Conflict leg's observations, nothing else. */
export function specialistItemsOf(set: AskContributionSet): number {
  return set.contributions
    .filter((c) => c.contributorId === 'CONFLICT' && c.status === 'USED')
    .reduce((n, c) => n + c.observations.length, 0);
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK CURRENT REPORTING FINAL CLOSURE R1 (M1) — THIS EXECUTOR'S VERIFICATION VERDICT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frozen C carries a CURRENT_STATUS verification contract on every current-status plan and,
 * by design, leaves the outcome to the executor ("a planner cannot know whether two
 * independent fresh sources will agree — that is an execution-time fact"). deriveAnswerState
 * (the ONE sufficiency derivation) reads that outcome from `obtained.verification`. This
 * executor never supplied it, so the decision was an absent argument rather than a verdict.
 *
 * It now returns one of frozen C's own outcomes, and only one it can truthfully establish:
 *
 *   CURRENTLY_VERIFIED                      never — it requires current OFFICIAL evidence
 *                                           from a bound official executor, and this
 *                                           executor supplies REPORTING only (above). News
 *                                           articles are never relabelled as OFFICIAL.
 *   CURRENT_REPORTING_PARTIAL_VERIFICATION  ONLY when the deterministic corroboration seam
 *                                           (current-status-corroboration.ts, CURRENT STATUS
 *                                           CORROBORATION R1) established the fact: at least
 *                                           two independent, fresh, trustworthy-timestamped
 *                                           reports extracting the SAME canonical fact — and
 *                                           only where the plan admits the outcome. A model
 *                                           saying sources agree is never this fact (CTO
 *                                           ruling); generated agreements, key facts, summary
 *                                           statements and model-selected citations are not
 *                                           read here at all.
 *   INSUFFICIENT_EVIDENCE                   otherwise — frozen C's honest end of the ladder,
 *                                           always admissible.
 *
 * A plan with no verification contract gets no verdict (undefined), so every other path
 * (reporting, background, clarification) is derived exactly as before.
 */
export function executorVerificationOutcome(
  plan: RoutingPlan,
  corroboration: CorroborationResult | null = null,
): VerificationOutcome | undefined {
  if (plan.verification === null) return undefined;
  if (
    corroboration?.corroborated === true &&
    corroboration.qualifyingReports >= plan.verification.minIndependentFreshSources &&
    plan.verification.admissibleOutcomes.includes('CURRENT_REPORTING_PARTIAL_VERIFICATION')
  ) {
    return 'CURRENT_REPORTING_PARTIAL_VERIFICATION';
  }
  return 'INSUFFICIENT_EVIDENCE';
}

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

/**
 * UNIFIED INTELLIGENCE BINDING R2C — an INHERITED context chip (the Map country, the story
 * anchor's country) states "applied" only when the reporting analysis actually used that context
 * (AnalysisService stamps `geographyContextUsed` / `storyContextUsed`). A background, computed,
 * governed-record or early-terminal answer ran no retrieval at all, so an inherited place it
 * carried was available but NOT applied — and is shown so, never credited as the scope.
 * DOWNGRADE ONLY: a chip never gains "applied" here, and typed / declared / entity geography
 * is untouched. A context-free answer has no inherited chip, so its chips are byte-identical.
 */
export function truthfulInheritedChips(
  chips: PlanChips,
  analysis: AnalysisApiResponse | null,
): PlanChips {
  if (chips.kind !== 'SCOPED') return chips;
  const used = analysis?.retrievalContext;
  const inherited = (source: string): boolean | null =>
    source === 'MAP_GEOGRAPHY_CONTEXT'
      ? used?.geographyContextUsed === true
      : source === 'STORY_ANCHOR'
        ? used?.storyContextUsed === true
        : null;
  if (!chips.chips.some((c) => c.kind === 'GEOGRAPHY' && inherited(c.source) !== null)) {
    return chips;
  }
  return {
    kind: 'SCOPED',
    chips: chips.chips.map((c) => {
      const usedIt = c.kind === 'GEOGRAPHY' ? inherited(c.source) : null;
      return usedIt === false && c.applied ? { ...c, applied: false } : c;
    }),
  };
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

export function planRevision(
  request: Readonly<AskRequest>,
  route: AskR2Route,
  /* ASK R3 CONTINUITY — the same words after a different prior question are a different
     request: the revision (and so the stored-result fingerprint) must differ. Omitted when
     absent, so every first-turn revision is byte-identical to before. */
  priorQuestion?: string | null,
): string {
  return hashIdentity([
    ASK_R2_ADAPTER_VERSION,
    request.question,
    request.language,
    request.intent,
    routeSignature(route),
    ...(priorQuestion ? [`prior:${priorQuestion}`] : []),
    /* UNIFIED INTELLIGENCE BINDING R2B — the canonical context identity, pinned EXPLICITLY (not
       left to whatever the route happens to reflect). Omitted when absent: byte-identical. */
    ...(request.context === undefined ? [] : [contextIdentityToken(request.context)]),
    /* R3 §23 — the conversation's constraints change what is executed. Omitted when absent. */
    ...(request.conversation?.officialSourcesOnly === true ? ['conversation:official-only'] : []),
    ...(request.conversation?.constraintOnly === true ? ['conversation:constraint-only'] : []),
    /* CTO R4 — the answer builds on this conversation's earlier work. Omitted when absent. */
    ...(request.priorArtifact === undefined
      ? []
      : [`artifact:${artifactIdentity(request.priorArtifact)}`]),
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

/**
 * ASK GENERAL BACKGROUND EXECUTION R1 — estimated units for one background call. No
 * articles are ever sent (that is the whole point), so this is deliberately far smaller
 * than `estimateUnits`: the system prompt plus the question, and a small bounded output.
 */
export function estimateBackgroundUnits(
  questionChars: number,
  outputWeight: number,
  /** CTO R4 — a deep analysis or a plan reserves for its larger ceiling. */
  maxCompletionTokens: number = GENERAL_BACKGROUND_MAX_COMPLETION_TOKENS,
): number {
  const SYSTEM_PROMPT_CHAR_ESTIMATE = 1600;
  const promptChars = SYSTEM_PROMPT_CHAR_ESTIMATE + questionChars;
  return Math.ceil(promptChars / 4) + outputWeight * maxCompletionTokens;
}

/** CTO R4 — the semantic job classifier: a short prompt and a tiny JSON answer. */
export function estimateClassifierUnits(questionChars: number, outputWeight: number): number {
  return Math.ceil((1200 + questionChars) / 4) + outputWeight * JOB_CLASSIFIER_MAX_TOKENS;
}

/** CTO R4 — the outcome of the bounded semantic classification of an UNRESOLVED question. */
interface ClassifierRun {
  readonly verdict: SemanticJob;
  /** model calls it made (0 when no classifier is available) */
  readonly calls: number;
  /** SEMANTIC: the classifier decided; FALLBACK: none available / it failed → reasoning, never news */
  readonly source: 'SEMANTIC' | 'FALLBACK';
}

@Injectable()
export class AskR2ExecutionAdapter implements AskExecutionPort {
  private readonly logger = new Logger(AskR2ExecutionAdapter.name);
  private readonly deps: PlannerDeps;

  constructor(
    private readonly analysis: AnalysisService,
    @Inject(ANALYSIS_PROVIDER) private readonly provider: AnalysisProvider,
    @Inject(GENERAL_BACKGROUND_PROVIDER) private readonly background: GeneralBackgroundProvider,
    private readonly meter: ComputeMeterService,
    private readonly breaker: CircuitBreakerService,
    private readonly switches: OperationalSwitchService,
    private readonly analysisConfig: AnalysisConfigService,
    specialists: SpecialistClaimRegistry,
    private readonly observations: AskObservationService,
    private readonly intelligence: AskSpecialistReadCoordinator,
    /* ASK GUEST TRIAL R3 — optional so every existing construction is unchanged; a guest
       request without it is refused (fail closed). */
    @Optional() private readonly guests?: GuestSessionService,
    /* TRUST R1 — optional retained-reporting read for place-background answers (no provider call). */
    @Optional() private readonly news?: NewsService,
  ) {
    this.deps = {
      /*
        INTELLIGENCE BINDING R1 — "bound" is a MEASURED fact handed in by the coordinator that
        owns the callable read seam, never a default. Registered and bound are still separate:
        a registered specialist without a seam stays unbound.
      */
      specialistRegistry: landedSpecialistRegistryPort(
        () => specialists.registeredDomains(),
        intelligence.boundSpecialistDomains(),
      ),
    };
  }

  /**
   * ASK GUEST TRIAL R3 — a guest adds its scopes INSIDE every existing control. Invalid guest
   * settings fail closed for the guest only (checked again here, before any spend).
   *
   * UNIFIED INTELLIGENCE BINDING R2A.1 — the ONE construction of the guest resource scope, used
   * by every metered execution (Reporting and Background), so a guest's AI work is bounded by
   * the same pool, session-units and session-concurrency controls whichever path answers it.
   * Built only from the server-held request context and GuestSessionService's config; an
   * account request has no guest scope.
   */
  private async resolveGuestComputeScope(
    who: AskRequestContext,
  ): Promise<GuestComputeScope | undefined> {
    if (who.guestSessionId == null) return undefined;
    if (this.guests === undefined) throw new AskExecutionRefused('GUEST_TRIAL_NOT_CONFIGURED');
    const trial = this.guests.trialConfig();
    if (!trial.valid) throw new AskExecutionRefused('GUEST_TRIAL_NOT_CONFIGURED');
    if (!(await this.switches.isEnabled('ASK_GUEST_TRIAL_ENABLED'))) {
      throw new AskExecutionRefused('GUEST_TRIAL_UNAVAILABLE');
    }
    return {
      sessionId: who.guestSessionId,
      unitsPerSession: trial.limits.unitsPerSession,
      poolUnitsPerHour: trial.limits.poolUnitsPerHour,
      poolUnitsPerDay: trial.limits.poolUnitsPerDay,
      concurrentPerSession: trial.limits.concurrentPerSession,
    };
  }

  /**
   * THE ONE CALL SITE of the approved analysis path. Every execution (Reporting, and the R2D
   * Selection) makes at most ONE call, through here; its output is stored as a display payload
   * and nothing it returns is executed, fetched or used as an identity.
   */
  private analyze(
    ...args: Parameters<AnalysisService['analyzeNews']>
  ): ReturnType<AnalysisService['analyzeNews']> {
    return this.analysis.analyzeNews(...args);
  }

  /** The governed reads for this route — local, bounded, isolated; never rejects. */
  private async readIntelligence(
    route: AskR2Route,
    context?: ResolvedAskContext,
  ): Promise<AskContributionSet> {
    const set = await this.intelligence.read(route).catch((error: unknown) => {
      this.logger.warn(`ask intelligence read failed: ${(error as Error)?.message ?? 'unknown'}`);
      return NO_CONTRIBUTIONS;
    });
    if (context?.kind !== 'MODULE') return set;
    /* UNIFIED INTELLIGENCE BINDING R2F — the record the reader pinned on a dashboard, through the
       SAME governed channel: it replaces a text-keyed contribution from the same contributor
       (the reader named the exact record), never adds a second channel. */
    const pinned = await this.intelligence.readPinned({
      module: context.module,
      observationKey: context.observationKey,
      countryIso3: context.countryIso3 ?? null,
      district: context.district ?? null,
    });
    return {
      considered: [
        ...set.considered.filter((c) => c.contributorId !== pinned.contributorId),
        {
          contributorId: pinned.contributorId,
          domain: pinned.domain,
          applicability: pinned.applicability,
          scope: {
            countryIso3: context.countryIso3 ?? null,
            district: context.district ?? null,
            place: null,
          },
        },
      ],
      contributions: [
        ...set.contributions.filter((c) => c.contributorId !== pinned.contributorId),
        pinned,
      ],
    };
  }

  /** Bounded observability of contributor use: ids and a count only — never content. */
  private observeContributions(set: AskContributionSet, draft: AskObservationDraft): void {
    draft.contributorsConsidered = set.considered.map((c) => c.contributorId);
    draft.contributorsUsed = set.contributions
      .filter((c) => c.status === 'USED')
      .map((c) => c.contributorId);
    draft.contributorsDegraded = set.contributions
      .filter(
        (c) => c.status === 'DEGRADED' || c.status === 'NOT_ASSESSED' || c.status === 'REFUSED',
      )
      .map((c) => c.contributorId);
    draft.contributorItemCount = set.contributions
      .filter((c) => c.status === 'USED' && c.contributorId !== 'GEOGRAPHY')
      .reduce((n, c) => n + c.observations.length, 0);
  }

  async prepare(request: Readonly<AskRequest>): Promise<AskPlan> {
    const route = routeFor(request, this.deps);
    const missing = missingSeams(route);
    if (missing.length > 0)
      throw new AskExecutionRefused(`ASK_R2_SEAM_MISSING:${missing.join(',')}`);
    const revision = planRevision(request, route, askRequestContext.getStore()?.priorQuestion);
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

  /**
   * ADMIN ASK INTELLIGENCE OBSERVABILITY R1 — THE ONE EMIT POINT.
   *
   * The execution logic is untouched and lives in `executeInner`; this wrapper only times
   * it, names the outcome, and records ONE observation however the attempt ended — the
   * zero-AI terminals that return, and the control refusals that throw. One emit point is
   * what makes "one explicit Ask produces at most one observation" true by construction
   * rather than by remembering to call a recorder on every branch; the unique constraint
   * on `operationId` then makes it true across replicas as well.
   *
   * `prepare` is NOT instrumented, deliberately: it runs on every quote, produces no
   * answer and spends nothing, so counting it would inflate every figure on the screen.
   *
   * THE RECORD CANNOT CHANGE WHAT THE READER GETS. It is bounded by its own deadline,
   * swallows its own failures, and is awaited only after the result or the error is
   * already decided — so no answer is lost, refused or altered by a measurement.
   */
  async execute(
    request: Readonly<AskRequest>,
    plan: Readonly<AskPlan>,
    operationId: string,
  ): Promise<ExecutionResult> {
    const draft = newAskObservationDraft(ASK_R2_ADAPTER_VERSION, request.language);
    const startedAt = Date.now();
    try {
      return await this.executeInner(request, plan, operationId, draft);
    } catch (error) {
      /* The same naming the service applies to the operation's failureCode (Gate E). */
      draft.failureCode =
        error instanceof AskExecutionRefused && /^[A-Z0-9_:.-]{1,120}$/i.test(error.code)
          ? error.code
          : 'EXECUTION_FAILED';
      throw error;
    } finally {
      draft.latencyMs = Date.now() - startedAt;
      draft.computeClass = classifyCompute(request, plan, false);
      await this.observations.record({ operationId, ...draft });
    }
  }

  private async executeInner(
    request: Readonly<AskRequest>,
    plan: Readonly<AskPlan>,
    operationId: string,
    draft: AskObservationDraft,
  ): Promise<ExecutionResult> {
    let route = routeFor(request, this.deps);
    this.observeRoute(route, draft);
    const priorQuestion = askRequestContext.getStore()?.priorQuestion ?? null;
    if (planRevision(request, route, priorQuestion) !== plan.revision) {
      throw new AskExecutionRefused('ASK_PLAN_REVISION_MISMATCH');
    }

    /* UNIFIED INTELLIGENCE BINDING R2D — a SELECTION is executed as the selection (see
       executeSelection), never re-classified from its product-generated action label. */
    if (request.context?.kind === 'SELECTION') {
      return this.executeSelection(request, plan, route, operationId, draft, {
        action: request.context.action,
        stories: request.context.stories.map((story) => ({
          articleRef: story.articleRef,
          url: story.url,
        })),
      });
    }

    /*
      CONVERSATIONAL INTELLIGENCE JOURNEY R3 — two answers that need no model, decided on the
      service's own conversation reading and the route before anything is spent:
        · §23 a turn that only states a preference or constraint ("Only official sources.",
          "I prefer nature.") with no job to serve is NOTED: the conversation carries it and the
          reader is asked what they want to know. Zero AI, no provider, no meter.
        · §12 / §24 a decision with no objective ("Which economy is best?") is answered with the
          question it depends on — best for what? — with the usual objectives offered.
    */
    if (request.conversation?.constraintOnly === true && request.continuation === undefined) {
      return this.result(
        plan,
        route,
        operationId,
        this.observeAnswer(
          { state: 'CLARIFICATION_REQUIRED', basis: 'CONSTRAINT_NOTED', missingRoles: [] },
          draft,
        ),
        null,
        false,
      );
    }
    if (route.knowledgeRequirement === 'DECISION_SUPPORT' && route.decisionObjective === null) {
      return this.result(
        plan,
        route,
        operationId,
        this.observeAnswer(
          {
            state: 'CLARIFICATION_REQUIRED',
            basis: 'DECISION_OBJECTIVE_MISSING',
            missingRoles: [],
            candidates: [...DECISION_OBJECTIVE_CANDIDATES],
          },
          draft,
        ),
        null,
        false,
      );
    }

    /* 2 · a terminal that needs no model answers with ZERO AI. */
    const early = answerStateBeforeExecution(route.plan);
    if (early !== null && early.state !== 'REFERENCE_BACKGROUND') {
      return this.result(plan, route, operationId, this.observeAnswer(early, draft), null, false);
    }
    /*
      ALPHA ENABLEMENT R1 (MC-070) — "And Kenya?" continues nothing: an Ask R2 request
      carries no earlier question, so there is no subject to inherit. It is not searched as
      "Kenya news" (an answer to a question the reader did not ask); the reader is asked
      what they want to know, with the place they named kept as the candidate. 0 AI, no
      control touched.
    */
    /* CTO CHECKPOINT 5 §5 — MC-070 UPDATED. A continuation whose earlier subject is portable never
       reaches here as an ellipsis: AskV2Service composes it from the reader's own earlier question
       (conversation/cross-country-continuation.ts — "How is Madagascar's economy doing?" → "And in
       Kenya?" is answered as "How is Kenya's economy doing?", disclosed on the answer). What still
       arrives here as a bare ellipsis has NO portable subject (no earlier turn, "Who was Napoleon?",
       a comparison, several places, its own story/module context): it keeps asking, with copy that
       never claims there is no earlier question. */
    const continuation = readContinuationEllipsis(request.question);
    if (continuation !== null) {
      return this.result(
        plan,
        route,
        operationId,
        this.observeAnswer(
          {
            state: 'CLARIFICATION_REQUIRED',
            basis: 'NO_PRIOR_SUBJECT',
            missingRoles: [],
            candidates: [...continuation.candidates],
          },
          draft,
        ),
        null,
        false,
      );
    }
    /*
      ASK INTELLIGENCE BINDING LIVE ACCEPTANCE REPAIR R1 (A) — two governed answers that need
      no model, decided on the plan and the reader's own request before anything is spent:
        · an explicit request for the OFFICIAL figure of a status the plan already marks
          OFFICIAL_VERIFICATION_UNAVAILABLE is answered with that truth (zero AI) — reporting is
          never offered where the reader asked for the official source;
        · a question whose whole answer IS a governed retained record (a named district's
          Imihigo result, Rwanda's CPI, the procurement snapshot for a background-only plan)
          is answered from that record, zero model and zero provider calls.
    */
    if (explicitOfficialUnavailable(route)) {
      return this.result(
        plan,
        route,
        operationId,
        this.observeAnswer(
          {
            state: 'CAPABILITY_UNAVAILABLE',
            basis: 'OFFICIAL_SOURCE_UNAVAILABLE',
            missingRoles: ['OFFICIAL'],
          },
          draft,
        ),
        null,
        false,
      );
    }
    if (deterministicGovernedSelection(route, selectContributors(route)) !== null) {
      return this.executeGovernedRecord(plan, route, operationId, draft, request.context);
    }
    /*
      R3 §23 — "Only official sources." holds for the conversation. Governed official records
      were answered above; news reporting is not an official source, so a turn that would need it
      is told so (zero AI) instead of silently answered from news. Background / advisory answers
      cite nothing and stay labelled as general guidance.
    */
    if (
      request.conversation?.officialSourcesOnly === true &&
      requiredRolesOf(route.plan).includes('REPORTING')
    ) {
      return this.result(
        plan,
        route,
        operationId,
        this.observeAnswer(
          {
            state: 'CAPABILITY_UNAVAILABLE',
            basis: 'OFFICIAL_SOURCE_UNAVAILABLE',
            missingRoles: ['OFFICIAL'],
          },
          draft,
        ),
        null,
        false,
      );
    }

    /*
      ASK GENERAL BACKGROUND EXECUTION R1 — a REFERENCE_BACKGROUND_ONLY plan requires no
      evidence at all (frozen C: `required.length === 0`), so it is never routed into the
      news-retrieval analysis path below — that would either burn an irrelevant Reporting
      search or mislabel a coincidental result as background (the proven defect this round
      closes). One ZERO-Reporting-call model answer, still behind every existing control.
    */
    if (early !== null && early.state === 'REFERENCE_BACKGROUND') {
      return this.executeBackground(request, plan, route, operationId, draft);
    }

    /* ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — a computation is answered by the
       deterministic engine: zero model calls, zero provider calls, no meter. */
    if (requiredRolesOf(route.plan).includes('COMPUTED')) {
      return this.executeComputation(request, plan, route, operationId, draft);
    }

    const unsupplied = requiredRolesOf(route.plan).filter((r) => !EXECUTOR_SUPPLIES.has(r));
    if (unsupplied.length > 0) {
      return this.result(
        plan,
        route,
        operationId,
        this.observeAnswer(
          {
            state: 'CAPABILITY_UNAVAILABLE',
            basis: 'EXECUTOR_NOT_WIRED',
            missingRoles: unsupplied,
          },
          draft,
        ),
        null,
        false,
      );
    }

    /*
      CTO R4 — UNKNOWN NEVER MEANS NEWS. An UNRESOLVED question (no governed form; nothing about it
      asks for current evidence) is classified by the bounded semantic classifier BEFORE any news
      provider is spent, behind the same controls. Reasoning → the background provider answers;
      current evidence → the reporting path below; no classifier / a failure → reasoning, never
      news. The plan revision was checked on the deterministic route above.
    */
    if (route.job.source === 'UNRESOLVED') {
      const semantic = await this.classifyUnresolved(request, draft);
      const resolved = routeFor(request, this.deps, semantic.verdict);
      if (resolved.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY')
        return this.executeBackground(
          request,
          plan,
          resolved,
          operationId,
          draft,
          undefined,
          semantic,
        );
      route = resolved;
    }

    /* 3 · controls, in order, each failing closed. */
    draft.askR2Enabled = await this.switches.isEnabled('ASK_R2_ENABLED');
    if (!draft.askR2Enabled) throw new AskExecutionRefused('ASK_R2_DISABLED');
    draft.askPublicComputeEnabled = await this.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED');
    if (!draft.askPublicComputeEnabled) {
      throw new AskExecutionRefused('ASK_PUBLIC_COMPUTE_DISABLED');
    }
    const who = askRequestContext.getStore();
    if (who === undefined) throw new AskExecutionRefused('ASK_REQUEST_CONTEXT_MISSING');

    const provider = this.provider.id;
    draft.providerId = provider;
    const permit = await this.breaker.permit(provider);
    if (!permit.allowed) throw new AskExecutionRefused(`CIRCUIT_${permit.state}`);

    const analysisConfig = this.analysisConfig.get();
    const guest = await this.resolveGuestComputeScope(who);
    const reservation = await this.meter.reserve({
      accountId: who.accountId,
      ipScope: who.ipScope,
      ...(guest === undefined ? {} : { guest }),
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

    /* INTELLIGENCE BINDING R1 — the governed reads: local retained reads, zero model calls, zero
       provider calls, isolated from the answer's outcome. LIVE ACCEPTANCE REPAIR R1 (B): they
       complete (bounded) BEFORE the one analysis call, so their status, scope, time basis and
       disclosures bind the answer's prose instead of sitting beside it. */
    const contributions = await this.readIntelligence(route, request.context);
    const governed = governedPrompt(contributions);

    /* 4 · ONE call to the approved analysis path, one model attempt at most. */
    let usage: { promptTokens: number; completionTokens: number } | null = null;
    let outcome: BreakerOutcome = 'FAILURE';
    let response: AnalysisApiResponse | null = null;
    let noEvidence = false;
    try {
      /* One call to the approved path. Counted before it is made, so a call that throws
         is still a call that happened — the number an operator needs is attempts. */
      draft.providerCallCount = 1;
      response = await this.analyze(
        request.question,
        request.language,
        /* R2B — the SERVER-RESOLVED story (built from the retained row), never client text. */
        request.context?.kind === 'STORY' ? request.context.storyContext : undefined,
        /* ASK R3 CONTINUITY — the landed path routes a follow-up by the PRIOR USER question
           (never the prior AI answer); the model still receives this turn's own question. */
        who.priorQuestion ?? undefined,
        /* selection — R2D. */
        undefined,
        /* R2B — the SERVER-RESOLVED geography (ISO3 + registry name), never client text. */
        request.context?.kind === 'GEOGRAPHY' ? request.context.geographyContext : undefined,
        {
          maxModelAttempts: ASK_MODEL_MAX_ATTEMPTS,
          usageSink: (u) => {
            usage = { promptTokens: u.promptTokens, completionTokens: u.completionTokens };
          },
          ...(governed.rules === '' ? {} : { governed }),
          /* BETA-ASK-005 — the router's bounded publication window (server request instant). */
          ...(route.reportingWindow === null
            ? {}
            : {
                reportingWindow: {
                  statedPeriod: route.reportingWindow.statedPeriod,
                  from: route.reportingWindow.from,
                  to: route.reportingWindow.to,
                },
              }),
          /* PUBLIC BETA HARDENING R1B — an open-ended world-headlines request is retrieved as
             headlines. A plain Ask only: deep / report work keeps its own path. */
          ...(route.broadHeadlines && request.intent === 'ask' ? { broadHeadlines: true } : {}),
          /* R3 §14 / PO-02 — only reports about the relationship itself are evidence for it. */
          ...(route.relationship === null
            ? {}
            : {
                relationship: {
                  countries: [...route.relationship.countries],
                  relations: [...route.relationship.relations],
                },
              }),
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
      /* The breaker's OWN verdict, recorded where it is decided. A REFUSAL here is the
         landed no-evidence answer, which is not a provider failure and must never be
         counted as one. */
      draft.breakerOutcome = noEvidence ? 'REFUSAL' : outcome;
    }
    /*
      CONVERSATIONAL INTELLIGENCE JOURNEY R3 §6–§7 — PARTIAL ANSWERS SURVIVE. A question with a
      STABLE explanatory part and a current part (MIXED_REFERENCE_CURRENT: "Explain how central
      banks set rates, and what did the NBP decide this week?") lost its whole answer when the
      reporting provider failed or found nothing. Provider availability decides only the evidence
      class that needs it: the stable part is answered by the background provider (one bounded
      call, behind every control) and the current part is NAMED as not verified right now.
    */
    if (
      route.knowledgeRequirement === 'MIXED_REFERENCE_CURRENT' &&
      (noEvidence || outcome !== 'SUCCESS' || response === null)
    ) {
      return this.executeBackground(
        request,
        plan,
        route,
        operationId,
        draft,
        noEvidence ? 'NO_EVIDENCE' : 'UNAVAILABLE',
      );
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
        this.observeAnswer(
          {
            state: 'CLARIFICATION_REQUIRED',
            basis: `LANDED_${landed.clarificationReason ?? 'CLARIFICATION'}`,
            missingRoles: [],
            candidates: [...(landed.clarificationCandidates ?? [])],
          },
          draft,
        ),
        response,
        false,
      );
    }
    /* 7 · the §7 answer state — the one derivation. */
    /*
      CURRENT STATUS CORROBORATION R1 — a current-status plan is decided on the deterministic
      corroboration of the admitted reporting, and the count the derivation compares against
      frozen C's minimum is the number of independent fresh AGREEING reports — never the raw
      number of articles. Every other plan is derived exactly as before.
    */
    const corroboration =
      route.plan.verification === null
        ? null
        : corroborateCurrentStatus({
            target: corroborationTargetOf(route),
            articles: response.articles,
            now: new Date(),
            statedPeriod: route.readerStatedPeriod,
            minIndependentReports: route.plan.verification.minIndependentFreshSources,
          });
    const verification = executorVerificationOutcome(route.plan, corroboration);
    const specialistItems = specialistItemsOf(contributions);
    this.observeContributions(contributions, draft);
    const answer = deriveAnswerState(route.plan, {
      items: {
        REPORTING:
          corroboration === null ? response.articles.length : corroboration.qualifyingReports,
        SPECIALIST: specialistItems,
      },
      producedAnswer: response.analysis !== null,
      ...(verification === undefined ? {} : { verification }),
    });
    /* AI executed = the analysis path produced a model answer (the usage sink is metering only). */
    const aiExecuted = response.analysis !== null;
    draft.aiExecuted = aiExecuted;
    draft.modelInvocationCount = aiExecuted ? 1 : 0;
    draft.reportingItemCount = response.articles.length;
    draft.evidenceRolesObtained = [
      ...(response.articles.length > 0 ? ['REPORTING'] : []),
      ...(specialistItems > 0 ? ['SPECIALIST'] : []),
    ];
    const measured = usage as { promptTokens: number; completionTokens: number } | null;
    if (measured !== null) {
      draft.promptTokens = measured.promptTokens;
      draft.completionTokens = measured.completionTokens;
    }
    return this.result(
      plan,
      route,
      operationId,
      this.observeAnswer(answer, draft),
      response,
      aiExecuted,
      null,
      corroboration === null || verification === undefined
        ? null
        : {
            outcome: verification,
            reason: corroboration.reason,
            family: corroboration.family,
            reports: corroboration.qualifyingReports,
            asOf: corroboration.asOf,
            fact:
              corroboration.fact === null || !corroboration.corroborated
                ? null
                : { family: corroboration.fact.family, value: corroboration.fact.value },
          },
      contributions,
    );
  }

  /**
   * The routing axes, copied out of the envelope and the plan — never derived again.
   *
   * WHAT IS DELIBERATELY NOT COPIED, AND WHY EACH ONE IS NOT:
   *   `topic.readerTerms`      the reader's own words. Presence only.
   *   `time.statedPeriod`      the reader's own phrase. Presence only.
   *   `placeSpansOf(route)`    the reader's matched place text. Not read here at all.
   *   `clarification.observed` / `.candidate`   may carry a publisher or a reader value.
   *                            Only the CODE travels.
   * A boolean and a code cannot be re-read as a question, which is the whole reason they
   * are the shapes chosen.
   */
  private observeRoute(route: AskR2Route, draft: AskObservationDraft): void {
    const envelope = route.envelope;
    const plan = route.plan;
    draft.questionClass = plan.questionClass;
    draft.queryIntent = envelope.classifiers.queryIntent;
    draft.terminalState = plan.terminalState;
    draft.refusalCodes = [...plan.refusals];
    draft.disclosureCodes = [...plan.disclosures];
    draft.clarificationCodes = plan.clarification.map((cause) => cause.code);
    draft.questionLanguage = envelope.language.questionLanguage;
    draft.languageClassification = envelope.language.classification;
    draft.normalizationStatus = route.outcome.status;
    draft.geographyCodes = envelope.geography.candidates.map((candidate) => candidate.value);
    draft.geographySources = [
      ...new Set(envelope.geography.candidates.map((candidate) => candidate.source)),
    ];
    draft.geographyPrecision = envelope.geography.producibleCeiling;
    draft.scopedBy = plan.scopedBy;
    draft.domains = [...envelope.domains.domains];
    draft.topicPresent = envelope.topic.readerTerms.length > 0;
    draft.temporalRequirement = envelope.time.requirement;
    draft.statedPeriodPresent = envelope.time.statedPeriod !== null;
    draft.evidenceRolesRequested = requiredRolesOf(plan);
    draft.identityState = envelope.identity.state;
  }

  /**
   * The answer decision, recorded at the moment it is decided, and returned unchanged.
   *
   * It returns its argument so every call site reads `this.observeAnswer(decision, draft)`
   * in the position the decision already occupied: there is no branch where a decision is
   * produced and the observation is taken from somewhere else.
   */
  private observeAnswer<T extends AnswerDecision>(answer: T, draft: AskObservationDraft): T {
    draft.answerState = answer.state;
    draft.answerBasis = answer.basis;
    draft.evidenceRolesMissing = [...answer.missingRoles];
    draft.clarificationRequired = answer.state === 'CLARIFICATION_REQUIRED';
    draft.capabilityUnavailable = answer.state === 'CAPABILITY_UNAVAILABLE';
    return answer;
  }

  /**
   * ASK GENERAL BACKGROUND EXECUTION R1 — the executor for a `REFERENCE_BACKGROUND_ONLY`
   * plan. Mirrors `execute()`'s steps 3 and 5 (every control, in the same order, each
   * failing closed; settlement on actual units) exactly, and replaces step 4's news
   * retrieval + analysis call with ONE call to the dedicated background provider — 0
   * Reporting/GNews calls, 0 fabricated citations. Never reached unless frozen C has
   * already decided no evidence class is required (§4.7/§7 of the accepted contract);
   * every other terminal keeps the existing analysis path untouched.
   *
   * STANDALONE PUBLIC BETA CONVERGENCE R1 (A × F) — it writes the SAME observation fields,
   * at the same moments, as the Reporting path: switch reads, provider, the one call, the
   * breaker's verdict, AI/model counts, tokens and the answer decision. `execute()` still
   * records the single observation. Model background is never evidence, so
   * `evidenceRolesObtained` stays [] and `reportingItemCount` is 0 (not null: Reporting was
   * decided against, not unreached). No background text reaches the draft.
   */
  /**
   * UNIFIED INTELLIGENCE BINDING R2D — the My Intelligence SELECTION, executed by the canonical
   * engine through AnalysisService's EXISTING selection branch (its evidence is exactly the
   * server-verified selected stories; no provider retrieval). The action label ("Compare the
   * selected stories") is product-generated text, not a reader-typed question: it is NOT
   * re-classified by the general router (which reads "compare …" without named members as a
   * clarification and "explain …" as background — both would answer something other than the
   * selection). frozen C is untouched; its plan still pins the identity (revision, fingerprint).
   *
   * Every control is the reporting path's, in the same order: switches, server-held request
   * context, breaker permit, the guest resource scope (R2A.1), the meter reservation, ONE model
   * attempt, settlement on actual units and the breaker record. Stored reuse stays governed by the
   * answer state (CURRENT_REPORTING is never replayed).
   */
  private async executeSelection(
    request: Readonly<AskRequest>,
    plan: Readonly<AskPlan>,
    route: AskR2Route,
    operationId: string,
    draft: AskObservationDraft,
    selection: { readonly action: MultiStoryAction; readonly stories: readonly SelectedStoryRef[] },
  ): Promise<ExecutionResult> {
    draft.askR2Enabled = await this.switches.isEnabled('ASK_R2_ENABLED');
    if (!draft.askR2Enabled) throw new AskExecutionRefused('ASK_R2_DISABLED');
    draft.askPublicComputeEnabled = await this.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED');
    if (!draft.askPublicComputeEnabled) {
      throw new AskExecutionRefused('ASK_PUBLIC_COMPUTE_DISABLED');
    }
    const who = askRequestContext.getStore();
    if (who === undefined) throw new AskExecutionRefused('ASK_REQUEST_CONTEXT_MISSING');

    const provider = this.provider.id;
    draft.providerId = provider;
    const permit = await this.breaker.permit(provider);
    if (!permit.allowed) throw new AskExecutionRefused(`CIRCUIT_${permit.state}`);

    const guest = await this.resolveGuestComputeScope(who);
    const reservation = await this.meter.reserve({
      accountId: who.accountId,
      ipScope: who.ipScope,
      ...(guest === undefined ? {} : { guest }),
      provider,
      estimatedUnits: estimateUnits(
        request.question.length,
        this.analysisConfig.get(),
        this.meter.config.outputWeight,
      ),
    });
    if (!reservation.admitted) {
      await this.breaker.record(provider, 'REFUSAL', permit.trial);
      throw new AskExecutionRefused(`BUDGET_${reservation.kind}:${reservation.control}`);
    }

    let usage: { promptTokens: number; completionTokens: number } | null = null;
    let outcome: BreakerOutcome = 'FAILURE';
    let response: AnalysisApiResponse | null = null;
    let noEvidence = false;
    try {
      draft.providerCallCount = 1;
      response = await this.analyze(
        request.question,
        request.language,
        undefined,
        /* A selection replaces the conversation context (the landed selection branch). */
        undefined,
        { action: selection.action, stories: [...selection.stories] },
        undefined,
        {
          maxModelAttempts: ASK_MODEL_MAX_ATTEMPTS,
          usageSink: (u) => {
            usage = { promptTokens: u.promptTokens, completionTokens: u.completionTokens };
          },
        },
      );
      noEvidence = response.analysis === null && response.articles.length === 0;
      outcome = noEvidence
        ? 'REFUSAL'
        : response.analysis === null && response.analysisError !== undefined
          ? 'FAILURE'
          : 'SUCCESS';
    } catch (error) {
      outcome = /timeout|deadline/i.test((error as Error)?.message ?? '') ? 'TIMEOUT' : 'FAILURE';
    } finally {
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
      draft.breakerOutcome = noEvidence ? 'REFUSAL' : outcome;
    }
    if ((outcome !== 'SUCCESS' && !noEvidence) || response === null) {
      throw new AskExecutionRefused(`MODEL_${outcome}`);
    }

    const produced = response.analysis !== null;
    const answer: AnswerDecision = produced
      ? { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] }
      : {
          state: 'INSUFFICIENT',
          basis: 'NO_REQUIRED_EVIDENCE_OBTAINED',
          missingRoles: ['REPORTING'],
        };
    draft.aiExecuted = produced;
    draft.modelInvocationCount = produced ? 1 : 0;
    draft.reportingItemCount = response.articles.length;
    draft.evidenceRolesObtained = response.articles.length > 0 ? ['REPORTING'] : [];
    const usedNow = usage as { promptTokens: number; completionTokens: number } | null;
    if (usedNow !== null) {
      draft.promptTokens = usedNow.promptTokens;
      draft.completionTokens = usedNow.completionTokens;
    }
    /* The displayed route is the selection the reader ran — never the general classifier's
       reading of the action label. Chips still come from the plan's own constraints. */
    const selectionRoute: AskR2Route = {
      ...route,
      plan: {
        ...route.plan,
        questionClass: 'CURRENT_REPORTING',
        terminalState: 'EXECUTABLE',
        scopedBy: 'SELECTION',
        refusals: [],
        clarification: [],
      },
    };
    return this.result(
      plan,
      selectionRoute,
      operationId,
      this.observeAnswer(answer, draft),
      response,
      produced,
    );
  }

  /**
   * CTO R4 — classify an UNRESOLVED question with ONE bounded structured completion (closed schema,
   * temperature 0, a tiny ceiling) behind the same switches, breaker and meter as every model call.
   * It never answers, searches or states a fact. No classifier, an open breaker, a failure or a
   * malformed verdict all FALL BACK to stable reasoning — never to news.
   */
  private async classifyUnresolved(
    request: Readonly<AskRequest>,
    draft: AskObservationDraft,
  ): Promise<ClassifierRun> {
    const fallback: ClassifierRun = {
      verdict: FALLBACK_SEMANTIC_JOB,
      calls: 0,
      source: 'FALLBACK',
    };
    const complete = this.background.completeStructured?.bind(this.background);
    if (complete === undefined) return fallback;
    draft.askR2Enabled = await this.switches.isEnabled('ASK_R2_ENABLED');
    if (!draft.askR2Enabled) throw new AskExecutionRefused('ASK_R2_DISABLED');
    draft.askPublicComputeEnabled = await this.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED');
    if (!draft.askPublicComputeEnabled)
      throw new AskExecutionRefused('ASK_PUBLIC_COMPUTE_DISABLED');
    const who = askRequestContext.getStore();
    if (who === undefined) throw new AskExecutionRefused('ASK_REQUEST_CONTEXT_MISSING');
    const provider = this.background.id;
    const permit = await this.breaker.permit(provider);
    /* the reasoning answer would meet the same open breaker and refuse there, truthfully */
    if (!permit.allowed) return fallback;
    const guest = await this.resolveGuestComputeScope(who);
    const reservation = await this.meter.reserve({
      accountId: who.accountId,
      ipScope: who.ipScope,
      ...(guest === undefined ? {} : { guest }),
      provider,
      estimatedUnits: estimateClassifierUnits(
        request.question.length,
        this.meter.config.outputWeight,
      ),
    });
    if (!reservation.admitted) {
      await this.breaker.record(provider, 'REFUSAL', permit.trial);
      throw new AskExecutionRefused(`BUDGET_${reservation.kind}:${reservation.control}`);
    }
    let usage: { promptTokens: number; completionTokens: number } | null = null;
    let outcome: BreakerOutcome = 'FAILURE';
    let verdict: SemanticJob | null = null;
    try {
      const raw = await complete({
        system: JOB_CLASSIFIER_SYSTEM,
        user: jobClassifierUserMessage(request.question, request.language, request.priorArtifact),
        maxCompletionTokens: JOB_CLASSIFIER_MAX_TOKENS,
        usageSink: (u) => {
          usage = { promptTokens: u.promptTokens, completionTokens: u.completionTokens };
        },
      });
      verdict = parseSemanticJob(raw);
      outcome = 'SUCCESS';
    } catch (error) {
      outcome = /timeout|timed out|deadline/i.test((error as Error)?.message ?? '')
        ? 'TIMEOUT'
        : 'FAILURE';
    } finally {
      const used = usage as { promptTokens: number; completionTokens: number } | null;
      await this.meter.settle(
        reservation.reservationId,
        used === null
          ? null
          : used.promptTokens + this.meter.config.outputWeight * used.completionTokens,
        outcome,
      );
      await this.breaker.record(provider, outcome, permit.trial);
    }
    return verdict === null ? { ...fallback, calls: 1 } : { verdict, calls: 1, source: 'SEMANTIC' };
  }

  private async executeBackground(
    request: Readonly<AskRequest>,
    plan: Readonly<AskPlan>,
    route: AskR2Route,
    operationId: string,
    draft: AskObservationDraft,
    /** R3 §6 — the reporting part of a mixed question failed (UNAVAILABLE) or found nothing. */
    partialCurrent?: 'UNAVAILABLE' | 'NO_EVIDENCE',
    /** CTO R4 — the semantic classification that preceded this answer (UNRESOLVED questions). */
    semantic?: ClassifierRun,
  ): Promise<ExecutionResult> {
    /* CTO R4 — the job's rules, the conversation's earlier work and the answer's ceiling */
    const ceiling = completionCeilingFor(route.job);
    const horizon = route.job.temporal.find((t) => t.role === 'PLAN_HORIZON')?.days;
    const jobRules = jobRulesFor(route.job, request.priorArtifact !== undefined, horizon);
    /* 3 · controls, in order, each failing closed — identical to the reporting path. */
    draft.askR2Enabled = await this.switches.isEnabled('ASK_R2_ENABLED');
    if (!draft.askR2Enabled) throw new AskExecutionRefused('ASK_R2_DISABLED');
    draft.askPublicComputeEnabled = await this.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED');
    if (!draft.askPublicComputeEnabled) {
      throw new AskExecutionRefused('ASK_PUBLIC_COMPUTE_DISABLED');
    }
    const who = askRequestContext.getStore();
    if (who === undefined) throw new AskExecutionRefused('ASK_REQUEST_CONTEXT_MISSING');

    const provider = this.background.id;
    draft.providerId = provider;
    draft.reportingItemCount = 0;
    const permit = await this.breaker.permit(provider);
    if (!permit.allowed) throw new AskExecutionRefused(`CIRCUIT_${permit.state}`);

    /* R2A.1 — the same guest scope as Reporting, in the same place (after the breaker permit,
       before the reservation): a guest's background answer is bounded by its pool, session
       units and session concurrency too. */
    const guest = await this.resolveGuestComputeScope(who);
    const reservation = await this.meter.reserve({
      accountId: who.accountId,
      ipScope: who.ipScope,
      ...(guest === undefined ? {} : { guest }),
      provider,
      estimatedUnits: estimateBackgroundUnits(
        request.question.length,
        this.meter.config.outputWeight,
        ceiling,
      ),
    });
    if (!reservation.admitted) {
      await this.breaker.record(provider, 'REFUSAL', permit.trial);
      throw new AskExecutionRefused(`BUDGET_${reservation.kind}:${reservation.control}`);
    }

    /* INTELLIGENCE BINDING R1 — governed reads (after every control has passed): local, zero
       model, zero provider. LIVE ACCEPTANCE REPAIR R1 (B): read first, so the one background
       call is bound by them. */
    const contributions = await this.readIntelligence(route, request.context);
    const governed = governedPrompt(contributions);

    /* 4 · ONE call to the dedicated background provider. No articles, no retrieval. */
    let usage: { promptTokens: number; completionTokens: number } | null = null;
    let outcome: BreakerOutcome = 'FAILURE';
    let text: string | null = null;
    /* The provider judged the question unanswerable from background alone — a legitimate
       governed outcome (frozen C's own freshness/safety boundary), never a provider fault:
       mirrors the reporting path's `noEvidence` in shape and in meter/breaker treatment. */
    let declined = false;
    let artifact: ConversationArtifact | null = null;
    try {
      /* Counted before it is made, as on the Reporting path: attempts are what an operator needs.
         A partial answer (R3 §6) already made the reporting attempt: this is the second call. */
      draft.providerCallCount = partialCurrent === undefined ? 1 : 2;
      const out = await this.background.answerBackground({
        question: request.question,
        responseLanguage: request.language,
        maxModelAttempts: ASK_MODEL_MAX_ATTEMPTS,
        usageSink: (u) => {
          usage = { promptTokens: u.promptTokens, completionTokens: u.completionTokens };
        },
        ...(governed.rules === '' ? {} : { governed }),
        /* TRUST & CONVERSATIONAL EXPERIENCE R1 — a follow-up keeps the reader's own prior question. */
        ...(who.priorQuestion ? { priorQuestion: who.priorQuestion } : {}),
        /* CTO R4 — trusted job rules; the earlier work as delimited data; the job's ceiling */
        ...(jobRules === '' ? {} : { jobRules }),
        ...(request.priorArtifact === undefined
          ? {}
          : { priorWork: artifactPromptBlock(request.priorArtifact) }),
        ...(ceiling === GENERAL_BACKGROUND_MAX_COMPLETION_TOKENS
          ? {}
          : { maxCompletionTokens: ceiling }),
      });
      /* CTO R4 — the artifact comes back in the SAME call; it is split off before the reader sees it */
      if (out.text === null) text = null;
      else {
        const split = splitArtifact(out.text);
        text = split.text;
        artifact = split.artifact;
      }
      declined = text === null;
      outcome = declined ? 'REFUSAL' : 'SUCCESS';
    } catch (error) {
      /* A+H QUALIFICATION R1 — classify on the provider's TYPED reason. The provider's own
         attempt timeout says "timed out", which the message pattern alone never matched,
         so a real timeout was recorded as FAILURE in the breaker and the meter. */
      outcome =
        (error as { failureReason?: unknown })?.failureReason === 'provider-timeout' ||
        /timeout|timed out|deadline/i.test((error as Error)?.message ?? '')
          ? 'TIMEOUT'
          : 'FAILURE';
    } finally {
      /* 5 · settle on actual units (null keeps the estimate — the safe direction). */
      const used = usage as { promptTokens: number; completionTokens: number } | null;
      const actual =
        used !== null
          ? used.promptTokens + this.meter.config.outputWeight * used.completionTokens
          : declined
            ? 0
            : null;
      await this.meter.settle(
        reservation.reservationId,
        actual,
        declined ? 'NO_EVIDENCE' : outcome,
      );
      await this.breaker.record(provider, outcome, permit.trial);
      /* The breaker's own verdict, where it is decided (a decline is REFUSAL, not a fault). */
      draft.breakerOutcome = outcome;
    }
    if (outcome !== 'SUCCESS' && !declined) {
      throw new AskExecutionRefused(`MODEL_${outcome}`);
    }

    /* 7 · the §7 answer state — the one derivation, unchanged. A decline (text === null)
       is `producedAnswer: false`, which `deriveAnswerState` already maps to the truthful
       CAPABILITY_UNAVAILABLE / missingRoles: ['REFERENCE'] state — never a fabricated
       background answer, and never a silent pretend-success. */
    this.observeContributions(contributions, draft);
    /* R3 §6 — a partial answer is the supported STABLE part (non-citable background) with the
       reporting role it still lacks named; a decline is the same truthful unavailability. */
    const answer: AnswerDecision =
      partialCurrent !== undefined && !declined
        ? {
            state: 'REFERENCE_BACKGROUND',
            basis: `PARTIAL_CURRENT_${partialCurrent}`,
            missingRoles: ['REPORTING'],
          }
        : deriveAnswerState(route.plan, { items: {}, producedAnswer: !declined });
    /* The model WAS invoked on a decline (it answered with the decline token), so the
       invocation is counted; `aiExecuted` means an answer was produced, as on Reporting. */
    draft.aiExecuted = !declined;
    /* CTO R4 — the semantic classifier, when it ran, is a model invocation of this Ask too */
    draft.modelInvocationCount = 1 + (semantic?.calls ?? 0);
    draft.evidenceRolesObtained = [];
    const measured = usage as { promptTokens: number; completionTokens: number } | null;
    if (measured !== null) {
      draft.promptTokens = measured.promptTokens;
      draft.completionTokens = measured.completionTokens;
    }
    return this.result(
      plan,
      route,
      operationId,
      this.observeAnswer(answer, draft),
      null,
      !declined,
      text,
      null,
      contributions,
      null,
      await this.recentReportingFor(route),
      partialCurrent ?? null,
      {
        artifact: declined ? null : artifact,
        artifactUsed: request.priorArtifact ?? null,
        classifier: semantic ?? null,
      },
    );
  }

  /**
   * TRUST & CONVERSATIONAL EXPERIENCE R1 — MIXED BACKGROUND + CURRENT DEVELOPMENTS.
   * A place-background answer (history, travel preparation, "tell me about") is general knowledge;
   * current developments are listed BESIDE it from RETAINED reporting about the same place: no
   * provider call, no second model call, no analysis — dated headlines with their publishers,
   * stated as "listed, not analysed". Its absence is said, never silently dropped.
   */
  private async recentReportingFor(route: AskR2Route): Promise<RecentReporting | null> {
    if (route.knowledgeRequirement !== 'PLACE_REFERENCE') return null;
    /*
      CTO P0 · DEFECT E — companion reporting must serve the reader's TASK (companion-relevance.ts):
      no task that current material serves (a history question) → no block; an item qualifies only
      if its OWN text shows the task (travel notices for a travel question, economic reporting for
      an economy question…), never by country + recency alone. Zero qualifying → no block, never
      padding. A failed read for a task-relevant question is still SAID (UNAVAILABLE, §13). The
      background answer is unchanged either way. Deterministic: no model, no provider call.
    */
    const intent = readCompanionIntent(
      route.envelope.rawQuestion,
      route.envelope.language.questionLanguage ?? 'en',
    );
    if (intent === null) return null;
    const iso3 = route.envelope.geography.candidates.find(
      (c) => c.source === 'TYPED_GEOGRAPHY' || c.source === 'ENTITY_GEOGRAPHY',
    )?.value;
    const country = iso3 === undefined ? undefined : findCountryByIso3(iso3);
    if (country === undefined) return null;
    if (this.news === undefined)
      return {
        country: country.iso3,
        topic: intent,
        status: 'UNAVAILABLE',
        windowDays: RECENT_REPORTING_DAYS,
        items: [],
      };
    try {
      const articles = await withDeadline(
        /* The retained-country relation (ArticleCountry) is keyed by ISO3, as every other
           reader passes it (country news, My Intelligence, security). Found live on Alpha:
           ISO2 matched nothing, so every mixed answer said "none retained" untruthfully. */
        this.news.findRetainedByCountry(
          country.iso3,
          COMPANION_CANDIDATE_POOL,
          RECENT_REPORTING_DAYS * 24 * 60,
        ),
        RECENT_REPORTING_DEADLINE_MS,
        'ask-recent-reporting',
      );
      /* CTO checkpoint 3 §13 — checked again at this boundary, never trusted from the read:
         the article's OWN stored country must be the place asked about (absent = unknown =
         not listed), and its publication time must lie inside the window (a stale, future or
         unparseable time is never presented as recent). */
      const now = Date.now();
      const oldest = now - RECENT_REPORTING_DAYS * 24 * 60 * 60 * 1000;
      const recent = articles.filter((a) => {
        const t = Date.parse(a.publishedAt);
        return (
          a.countryCode === country.iso2 &&
          Number.isFinite(t) &&
          t >= oldest &&
          t <= now + RECENT_REPORTING_CLOCK_SKEW_MS &&
          servesIntent(a, intent)
        );
      });
      const items = recent.slice(0, RECENT_REPORTING_LIMIT).map((a) => ({
        title: a.title,
        url: a.url,
        sourceName: a.sourceName,
        publishedAt: a.publishedAt,
      }));
      if (items.length === 0) return null;
      return {
        country: country.iso3,
        topic: intent,
        status: 'LISTED',
        windowDays: RECENT_REPORTING_DAYS,
        items,
      };
    } catch {
      /* a task-relevant question whose check failed is TOLD so (§13) — absence is not claimed */
      return {
        country: country.iso3,
        topic: intent,
        status: 'UNAVAILABLE',
        windowDays: RECENT_REPORTING_DAYS,
        items: [],
      };
    }
  }

  /**
   * ASK INTELLIGENCE BINDING LIVE ACCEPTANCE REPAIR R1 (A) — the retained-record answer.
   *
   * The Ask switches and the server-held request context still gate it exactly as they gate
   * every other execution. The breaker and the compute meter are not consulted because nothing
   * they govern happens: no provider call, no model call, no units. The answer is the governed
   * record (or its truthful absence), handed back in the same one payload and recorded as the
   * same one observation.
   */
  private async executeGovernedRecord(
    plan: Readonly<AskPlan>,
    route: AskR2Route,
    operationId: string,
    draft: AskObservationDraft,
    /* R2F — a pinned dashboard record is read here too (never silently dropped). */
    context?: ResolvedAskContext,
  ): Promise<ExecutionResult> {
    draft.askR2Enabled = await this.switches.isEnabled('ASK_R2_ENABLED');
    if (!draft.askR2Enabled) throw new AskExecutionRefused('ASK_R2_DISABLED');
    draft.askPublicComputeEnabled = await this.switches.isEnabled('ASK_PUBLIC_COMPUTE_ENABLED');
    if (!draft.askPublicComputeEnabled) {
      throw new AskExecutionRefused('ASK_PUBLIC_COMPUTE_DISABLED');
    }
    if (askRequestContext.getStore() === undefined) {
      throw new AskExecutionRefused('ASK_REQUEST_CONTEXT_MISSING');
    }
    draft.providerCallCount = 0;
    draft.reportingItemCount = 0;
    const contributions = await this.readIntelligence(route, context);
    this.observeContributions(contributions, draft);
    const basis = governedRecordBasis(contributions);
    const answer: AnswerDecision =
      basis === 'GOVERNED_RECORD_UNAVAILABLE'
        ? { state: 'CAPABILITY_UNAVAILABLE', basis, missingRoles: [] }
        : { state: 'RETAINED_RECORD', basis, missingRoles: [] };
    draft.aiExecuted = false;
    draft.modelInvocationCount = 0;
    draft.evidenceRolesObtained = [];
    return this.result(
      plan,
      route,
      operationId,
      this.observeAnswer(answer, draft),
      null,
      false,
      null,
      null,
      contributions,
    );
  }

  /**
   * ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — the deterministic result, or (when a
   * required input is missing) a clarification naming exactly what is missing. Nothing is
   * assumed, no model or provider is called, and nothing is metered.
   */
  private executeComputation(
    request: Readonly<AskRequest>,
    plan: Readonly<AskPlan>,
    route: AskR2Route,
    operationId: string,
    draft: AskObservationDraft,
  ): ExecutionResult {
    const outcome = solveComputation(request.question);
    if (outcome?.status === 'SOLVED') {
      return this.result(
        plan,
        route,
        operationId,
        this.observeAnswer(
          { state: 'COMPUTED_RESULT', basis: 'DETERMINISTIC_COMPUTATION', missingRoles: [] },
          draft,
        ),
        null,
        false,
        null,
        null,
        NO_CONTRIBUTIONS,
        outcome.result,
      );
    }
    return this.result(
      plan,
      route,
      operationId,
      this.observeAnswer(
        {
          state: 'CLARIFICATION_REQUIRED',
          basis: 'COMPUTATION_INPUTS_MISSING',
          missingRoles: [],
          candidates: outcome?.status === 'MISSING_INPUTS' ? [...outcome.missing] : [],
        },
        draft,
      ),
      null,
      false,
    );
  }

  private result(
    plan: Readonly<AskPlan>,
    route: AskR2Route,
    operationId: string,
    answer: AnswerDecision,
    analysis: AnalysisApiResponse | null,
    aiExecuted: boolean,
    backgroundText: string | null = null,
    /**
     * CURRENT STATUS CORROBORATION R1 — present only for a current-status plan: the frozen
     * outcome the executor returned, the deterministic reason, the number of independent
     * agreeing reports and the as-of time of the freshest of them (never model time).
     */
    verification: {
      readonly outcome: VerificationOutcome;
      readonly reason: string;
      readonly family: string | null;
      readonly reports: number;
      readonly asOf: string | null;
      readonly fact: { readonly family: string; readonly value: string | number } | null;
    } | null = null,
    /**
     * INTELLIGENCE BINDING R1 — the governed contributions considered for this answer, each
     * with its status, provenance and time basis. Absent (null) when none applied.
     */
    intelligence: AskContributionSet = NO_CONTRIBUTIONS,
    /** ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — the deterministic computation. */
    computation: ComputationResult | null = null,
    /** TRUST R1 — retained recent reporting listed beside a place-background answer. */
    recentReporting: RecentReporting | null = null,
    /** R3 §6 — the current part of a mixed question could not be verified (it is named). */
    partialCurrent: 'UNAVAILABLE' | 'NO_EVIDENCE' | null = null,
    /** CTO R4 — conversation memory produced / used by this answer and the classifier run. */
    r4: {
      readonly artifact: ConversationArtifact | null;
      readonly artifactUsed:
        (ConversationArtifact & { readonly sourceOperationId?: string }) | null;
      readonly classifier: ClassifierRun | null;
    } | null = null,
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
        chips: withRelationshipScope(
          truthfulInheritedChips(
            planChips(route.envelope, route.plan, placeSpansOf(route), route.reportingWindow),
            analysis,
          ),
          /* R3 L-4 — a relationship answer is scoped to both sides, from the route's authority */
          route.relationship,
        ),
        answer,
        /* When the answer was decided — the freshness line's time when no analysis ran. */
        checkedAt: new Date().toISOString(),
        aiExecuted,
        modelPriorCitable: false,
        analysis,
        /* ASK GENERAL BACKGROUND EXECUTION R1 — additive. Non-citable, non-sourced model
           background text (never present alongside a non-null `analysis`). */
        background: backgroundText === null ? null : { text: backgroundText },
        /* CTO P0 — advice is GENERAL GUIDANCE from model reasoning, never current sourced research;
           a mixed question names the part that needs current sourced evidence. */
        ...(route.knowledgeRequirement === 'ADVISORY' ||
        route.knowledgeRequirement === 'MIXED_ADVISORY_CURRENT' ||
        (route.knowledgeRequirement === 'DECISION_SUPPORT' && route.decisionObjective !== null)
          ? {
              guidance: {
                kind: route.knowledgeRequirement,
                currentEvidenceNeeded: route.currentEvidenceNeeded,
                /* R3 §12 — the objective the decision was weighed against */
                ...(route.decisionObjective === null ? {} : { objective: route.decisionObjective }),
              },
            }
          : {}),
        /* R3 §14 — the two-sided scope of a relationship question (both countries, the relation) */
        ...(route.relationship === null ? {} : { relationship: route.relationship }),
        /* CTO R4 — conceptual / conversational work done by reasoning is labelled as such (zero
           sources is normal here, never INSUFFICIENT) */
        ...(backgroundText !== null &&
        partialCurrent === null &&
        route.knowledgeRequirement !== 'ADVISORY' &&
        route.knowledgeRequirement !== 'MIXED_ADVISORY_CURRENT' &&
        route.knowledgeRequirement !== 'DECISION_SUPPORT' &&
        route.job.basis !== 'KNOWLEDGE' &&
        route.job.job !== null
          ? {
              guidance: {
                kind:
                  route.job.job === 'PLANNING' || route.job.job === 'TRANSFORMATION'
                    ? 'CONVERSATION_WORK'
                    : 'CONCEPTUAL_ANALYSIS',
                currentEvidenceNeeded: [],
              },
            }
          : {}),
        /* CTO R4 — this answer's conversation memory (model reasoning; never evidence) */
        ...(r4?.artifact == null ? {} : { artifact: r4.artifact }),
        /* CTO R4 §21 — the job diagnostics (CTO / Admin; not rendered to readers) */
        diagnostics: {
          job: {
            job: route.job.job,
            source: r4?.classifier?.source ?? route.job.source,
            basis: route.job.basis,
            depth: route.job.depth,
            freshness: route.job.freshness,
            evidence: route.job.evidence,
            transformation: route.job.transformation,
            discourseReference: route.job.discourseReference,
            temporal: route.job.temporal,
            reason: route.job.reason,
            classifierCalls: r4?.classifier?.calls ?? 0,
            artifactUsed:
              r4?.artifactUsed == null
                ? null
                : {
                    kind: r4.artifactUsed.kind,
                    label: r4.artifactUsed.label,
                    sourceOperationId: r4.artifactUsed.sourceOperationId ?? null,
                  },
            artifactProduced:
              r4?.artifact == null ? null : { kind: r4.artifact.kind, label: r4.artifact.label },
          },
        },
        ...(computation === null ? {} : { computation }),
        ...(recentReporting === null ? {} : { recentReporting }),
        /* R3 §6 — the stable part was answered; the current part is named, never filled in */
        ...(partialCurrent === null
          ? {}
          : {
              guidance: {
                kind: 'MIXED_REFERENCE_CURRENT',
                currentEvidenceNeeded: route.currentEvidenceNeeded,
                currentPart: partialCurrent,
              },
            }),
        verification,
        intelligence:
          intelligence.considered.length === 0
            ? null
            : {
                considered: intelligence.considered.map((c) => c.contributorId),
                contributions: intelligence.contributions,
              },
      }),
      evidenceRevision: plan.revision,
      validUntil: plan.validUntil,
    };
  }
}
