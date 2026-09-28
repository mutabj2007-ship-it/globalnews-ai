/**
 * ASK R2 CORE ROUTER — ENTRY POINT
 *
 * One pure function. No I/O, no network, no provider, no model call, no clock, no
 * randomness. Given the same input it returns the same output, which is what makes the
 * evaluation corpus meaningful.
 */

import type { AskQuestionEnvelope, RoutingPlan } from './ports.js';
import { buildEnvelope, type EnvelopeSource } from './envelope.js';
import { plan, type PlannerDeps } from './planner.js';

export interface RouteResult {
  readonly envelope: AskQuestionEnvelope;
  readonly plan: RoutingPlan;
}

export function route(source: EnvelopeSource, deps: PlannerDeps): RouteResult {
  const envelope = buildEnvelope(source);
  return { envelope, plan: plan(envelope, deps) };
}

export * from './ports.js';
export { buildEnvelope } from './envelope.js';
export { deriveQuestionClass } from './classify.js';
export { plan } from './planner.js';
export { CAPABILITY_MAP } from './registry.js';
export type { EnvelopeSource } from './envelope.js';
export type { PlannerDeps } from './planner.js';
