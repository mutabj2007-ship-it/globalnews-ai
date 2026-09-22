import { createHash } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

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
  ]);
}
export function validatePlan(plan: AskPlan, request?: Readonly<AskRequest>): void {
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
    !(Date.parse(plan.validUntil) > Date.now())
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
