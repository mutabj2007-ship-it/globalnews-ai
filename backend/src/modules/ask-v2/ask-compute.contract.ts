import { createHash } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  contextIdentity,
  isResolvedAskContext,
  sameContextIdentity,
  type ResolvedAskContext,
} from './context/resolved-ask-context';
import type { PriorArtifact } from './conversation/conversation-artifact';

export const SAND_CHARGING_ENABLED = false as const;
export const ASK_EXECUTION_PORT = Symbol('ASK_EXECUTION_PORT');
export type Language = 'en' | 'pl';
export type Intent = 'ask' | 'deep-analysis' | 'research-report';
export type ComputeClass =
  'STORED' | 'CONTEXTUAL' | 'FRESH_BOUNDED' | 'DEEP_ANALYSIS' | 'RESEARCH_REPORT';
export interface AskRequest {
  question: string;
  language: Language;
  intent: Intent;
  /**
   * UNIFIED INTELLIGENCE BINDING R2B — the SERVER-RESOLVED context of THIS turn (never client
   * text). Absent for a context-free turn, whose identity is byte-identical to before.
   */
  context?: ResolvedAskContext;
  /**
   * CTO CHECKPOINT 5 §5 — present when the reader's turn was a cross-country continuation ("And in
   * Kenya?") composed from their own earlier question: `question` is then the composed question
   * the engine answers, and this records the reader's own words and the earlier question it came
   * from (disclosed on the answer). Absent for every other turn.
   */
  continuation?: {
    readonly readerQuestion: string;
    readonly fromQuestion: string;
    /** R3 — CROSS_COUNTRY ("And in Kenya?") or JOB_CONTEXT (the trip / decision / relationship
     *  the reader is working on). Absent means CROSS_COUNTRY (checkpoint 5 payloads). */
    readonly kind?: 'CROSS_COUNTRY' | 'JOB_CONTEXT';
  };
  /**
   * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — the governed conversation state of a context-free
   * turn (conversation/conversation-state.ts), derived by the service from the reader's OWN earlier
   * questions in this owner-verified thread. Never client input. `officialSourcesOnly` and
   * `constraintOnly` change what is executed (and so the plan revision); `trace` is diagnostics.
   */
  /**
   * CTO R4 — this conversation's most recent earlier WORK (a validated ConversationArtifact the
   * assistant's own reasoning produced on an earlier turn), read by the service from durable
   * stored answers in this owner-verified thread. Memory for resolving references; never
   * evidence, scope or a preference. Absent when the thread holds none.
   */
  priorArtifact?: PriorArtifact;
  conversation?: {
    readonly officialSourcesOnly: boolean;
    /** The turn only stated a preference / constraint ("Only official sources.") — no job. */
    readonly constraintOnly: boolean;
    readonly trace: {
      readonly job: string;
      readonly ownJob: string;
      readonly carried: readonly string[];
      readonly overridden: readonly string[];
      readonly reset: boolean;
      readonly composed: string | null;
      /** L-2 — the portable subject after this turn (built only from the reader's words). */
      readonly subject?: string | null;
    };
    /**
     * CTO R4 fifth pass / semantic IR §9 — the newest objective the READER stated in this thread:
     * the criterion (`text`), its turn, and — when stated — the preferred / dispreferred value, the
     * constraints and the decision target. The reader's words only, never model prose.
     */
    readonly objective?: {
      readonly text: string;
      readonly sourceTurn: number;
      readonly prefer?: string | null;
      readonly over?: string | null;
      readonly constraints?: readonly string[];
      readonly target?: string | null;
      readonly inherited?: boolean;
    };
    /** CTO R4 semantic IR §17 — the newest options the reader named (bounded, their words). */
    readonly choiceSet?: readonly string[];
    /** the 0-based ordinal of this reader turn in the bounded thread */
    readonly turnIndex?: number;
  };
}

/** Produced by a CTO-owned, local/read-only planner. No provider call in prepare.
 * revision/scope/contract must cover all materially relevant retrieval dimensions,
 * including authoritative story identity, geography, window and coverage policy.
 * The planner must not promote caller context or generated prose to evidence.
 */
export interface AskPlan {
  revision: string;
  scope: string;
  contract: string;
  executionKey: string;
  validUntil: string;
  contextual: boolean;
  deepRequested: boolean;
  reportRequested: boolean;
  countryCount: number;
  domainCount: number;
  timeWindowDays: number;
}
/**
 * UNIFIED INTELLIGENCE BINDING R2B — the plan AS PERSISTED in ComputeOperation.plan (Json): the
 * port's plan plus, for a context-bearing turn, the resolved context, so execute restores it
 * without re-reading client input. Set by AskV2Service from its own resolution, never from the
 * port; omitted when absent (a context-free plan is exactly an AskPlan).
 */
export type PersistedAskPlan = AskPlan & { context?: ResolvedAskContext };
export interface ExecutionResult {
  succeeded: boolean;
  // JSON display artifact, validated by the adapter under the current response contract.
  payloadJson: string;
  evidenceRevision: string;
  validUntil: string;
}
export interface AskExecutionPort {
  prepare(request: Readonly<AskRequest>): Promise<AskPlan>;
  execute(
    request: Readonly<AskRequest>,
    plan: Readonly<AskPlan>,
    operationId: string,
  ): Promise<ExecutionResult>;
}

/**
 * ASK R2 INTEGRATION R1 · GATE E — a CONTROL refused the execution (switch off, breaker
 * open, budget exhausted, plan revision changed, model failed). Thrown, never returned as
 * success, so no StoredResult is written; AskV2Service records `code` as the failureCode.
 */
export class AskExecutionRefused extends ServiceUnavailableException {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AskExecutionRefused';
  }
}

/** Explicit HOLD. Binding an adapter is CTO integration work, not a retrieval rewrite. */
export const UNWIRED_ASK_EXECUTION_PORT: AskExecutionPort = {
  async prepare() {
    throw new ServiceUnavailableException('ASK_EXECUTION_PORT_NOT_BOUND');
  },
  async execute() {
    throw new ServiceUnavailableException('ASK_EXECUTION_PORT_NOT_BOUND');
  },
};

// Design fixtures only. No price environment override and no balance writer.
export const SAND_QUOTES: Readonly<Record<ComputeClass, number>> = {
  STORED: 0,
  CONTEXTUAL: 0,
  FRESH_BOUNDED: 0,
  DEEP_ANALYSIS: 24,
  RESEARCH_REPORT: 120,
};

/** Confirmation is a work-class boundary, independent of fixture price or charging flags. */
export function requiresExplicitAcceptance(computeClass: string): boolean {
  // Unknown persisted classes must never gain the ordinary execution shortcut.
  return !['STORED', 'CONTEXTUAL', 'FRESH_BOUNDED'].includes(computeClass);
}

export function classifyCompute(request: AskRequest, plan: AskPlan, stored: boolean): ComputeClass {
  if (stored) return 'STORED';
  if (request.intent === 'research-report' || plan.reportRequested) return 'RESEARCH_REPORT';
  if (plan.contextual) return 'CONTEXTUAL';
  if (
    request.intent === 'deep-analysis' ||
    plan.deepRequested ||
    plan.countryCount >= 3 ||
    plan.domainCount >= 3 ||
    plan.timeWindowDays >= 180 ||
    [plan.countryCount > 1, plan.domainCount > 1, plan.timeWindowDays >= 90].filter(Boolean)
      .length >= 2
  ) {
    return 'DEEP_ANALYSIS';
  }
  return 'FRESH_BOUNDED';
}

// JSON tuples preserve boundaries and case-sensitive opaque IDs; no sentinel collisions.
export function hashIdentity(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function fingerprint(request: AskRequest, plan: AskPlan): string {
  return hashIdentity([
    'ask-v2-r1',
    request.question,
    request.language,
    request.intent,
    plan.revision,
    plan.scope,
    plan.contract,
    plan.executionKey,
    plan.contextual,
    plan.deepRequested,
    plan.reportRequested,
    plan.countryCount,
    plan.domainCount,
    plan.timeWindowDays,
    /* R2B — the resolved context identity, appended ONLY when present: a context-free
       fingerprint is byte-identical to before, so existing stored results stay reachable. */
    ...(request.context === undefined ? [] : [['context', ...contextIdentity(request.context)]]),
  ]);
}
export function validatePlan(plan: PersistedAskPlan, request?: Readonly<AskRequest>): void {
  if (
    !plan ||
    ![plan.revision, plan.scope, plan.contract, plan.executionKey].every(
      (v) => typeof v === 'string' && v.length > 0 && v.length <= 2000,
    ) ||
    typeof plan.contextual !== 'boolean' ||
    typeof plan.deepRequested !== 'boolean' ||
    typeof plan.reportRequested !== 'boolean' ||
    // Wide stored coverage is compatible with contextual work; requiring fresh
    // deep/report execution at the same time is not.
    (plan.contextual &&
      (plan.deepRequested ||
        plan.reportRequested ||
        (request !== undefined && request.intent !== 'ask'))) ||
    ![plan.countryCount, plan.domainCount, plan.timeWindowDays].every(
      (v) => Number.isInteger(v) && v >= 0,
    ) ||
    !(Date.parse(plan.validUntil) > Date.now()) ||
    /* R2B — a persisted context must be exactly a valid server-resolved context, and it must be
       the context of the request it is validated against. Unknown/corrupt → fail closed. */
    (plan.context !== undefined &&
      (!isResolvedAskContext(plan.context) ||
        (request !== undefined && !sameContextIdentity(plan.context, request.context))))
  ) {
    throw new ServiceUnavailableException('ASK_PLAN_INVALID');
  }
}
export function safeReturnPath(path?: string): string | null {
  if (path === undefined) return null;
  // Navigation metadata only. Strict local paths, no encoded delimiters or controls.
  if (
    typeof path !== 'string' ||
    path.length > 500 ||
    !/^\/(?!\/)[a-zA-Z0-9/_?=&.\-]*$/.test(path)
  ) {
    throw new BadRequestException('Invalid return path');
  }
  return path;
}
export function returnLabel(language: Language): string {
  return language === 'pl' ? 'Wróć' : 'Back';
}
