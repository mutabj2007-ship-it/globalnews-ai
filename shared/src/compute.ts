/**
 * BETA-SIMPLE-ASK-SAND-1 §5/§8/§9/§13/§14 — compute classification,
 * metered-operation and Sand contracts.
 *
 * This file is TYPES AND PURE CONSTANTS ONLY. It deliberately contains
 * no pricing table, no classification logic and no ledger behavior:
 *
 * - Pricing lives in exactly one place, server-side
 *   (backend/src/modules/compute/pricing/sand-pricing.service.ts), per
 *   §8's "one backend/config authority must own pricing". Putting a
 *   price map in `shared` would publish it to the frontend bundle and
 *   invite a React component to do its own arithmetic — exactly what
 *   §8 forbids.
 * - Classification lives in
 *   backend/src/modules/compute/classification/classify-compute.util.ts,
 *   per §5's "authoritative compute class is determined server-side,
 *   never merely by which frontend button was clicked".
 *
 * What the frontend legitimately needs — and all it gets — is the
 * vocabulary to READ a server-issued quote and render it.
 */

/**
 * §5 — the canonical compute classification.
 *
 * There was no pre-existing naming in this repository for this concept
 * (confirmed by inspection: no compute/tier/metering vocabulary exists
 * anywhere in `shared`, `backend` or `frontend` at baseline
 * main@41428ea), so §5's proposed model is adopted verbatim as the
 * canonical one.
 *
 * Ordering note: the union is written cheapest-first, and
 * COMPUTE_CLASS_ORDER below makes that ordering a real, testable value
 * rather than a comment. Several rules ("never downgrade below what
 * retrieval actually required", "requiresConfirmation at or above
 * DEEP_ANALYSIS") are comparisons, and they must not be re-derived
 * independently in three places.
 */
export type ComputeClass =
  /** Already-computed assessment/result replayed as-is. Incremental AI cost: 0. */
  | 'STORED'
  /** Explanation assembled mainly from stored structured intelligence. Sand: 0 initially. */
  | 'CONTEXTUAL'
  /** Ordinary fresh Ask requiring bounded retrieval + synthesis. Governed by quota/fair use. */
  | 'FRESH_BOUNDED'
  /** Substantial multi-source, multi-country, historical or cross-domain computation. */
  | 'DEEP_ANALYSIS'
  /** Large, long-running synthesis/report workload. */
  | 'RESEARCH_REPORT';

/** Cheapest-first canonical ordering. Index into this to compare two classes. */
export const COMPUTE_CLASS_ORDER: readonly ComputeClass[] = [
  'STORED',
  'CONTEXTUAL',
  'FRESH_BOUNDED',
  'DEEP_ANALYSIS',
  'RESEARCH_REPORT',
] as const;

/**
 * True when `a` is at least as expensive as `b`.
 *
 * Pure comparison over COMPUTE_CLASS_ORDER — no pricing knowledge, so
 * it is safe to ship to the frontend and safe to use before a quote
 * exists.
 */
export function isAtLeastAsExpensive(a: ComputeClass, b: ComputeClass): boolean {
  return COMPUTE_CLASS_ORDER.indexOf(a) >= COMPUTE_CLASS_ORDER.indexOf(b);
}

/**
 * §9 — the threshold at and above which an operation must be quoted and
 * explicitly confirmed before it runs.
 *
 * Expressed as a single named constant rather than repeated
 * `=== 'DEEP_ANALYSIS' || === 'RESEARCH_REPORT'` checks, so the policy
 * has one definition. §20's "a clever prompt must not bypass compute
 * classification" is enforced by the classifier, not here; this
 * constant only says what happens once a class has been decided.
 */
export const CONFIRMATION_REQUIRED_AT_OR_ABOVE: ComputeClass = 'DEEP_ANALYSIS';

/** Whether a compute class requires an explicit pre-execution user confirmation (§9). */
export function requiresConfirmationFor(computeClass: ComputeClass): boolean {
  return isAtLeastAsExpensive(computeClass, CONFIRMATION_REQUIRED_AT_OR_ABOVE);
}

/**
 * §7 — the three product tiers, preserved exactly as the contract
 * states them.
 *
 *   FREE         = KNOW
 *   PROFESSIONAL = FOLLOW
 *   SAND         = INVESTIGATE / COMPUTE
 *
 * Sand is NOT a fourth subscription tier layered on top; it is metered
 * compute available within the product. §19's boundary is a separate
 * concern (what Professional unlocks) and is not encoded here.
 */
export type EntitlementTier = 'FREE' | 'PROFESSIONAL' | 'SAND';

/**
 * §8 `entitlementState` — what the CURRENT caller is actually allowed
 * to do with the operation just quoted, as decided server-side.
 *
 * Distinct from EntitlementTier: the tier is who you are, the state is
 * what happens if you press the button right now.
 */
export type EntitlementState =
  /** Free at point of use for this caller — stored/contextual reuse, or within fair-use quota. */
  | 'included'
  /** Would consume metered Sand. With charging OFF this is still reported truthfully, then blocked at execution. */
  | 'metered'
  /** Caller's fair-use quota for this class is exhausted. */
  | 'quota-exhausted'
  /** Caller's tier does not permit this compute class at all. */
  | 'not-entitled';

/**
 * §13 — the metered-operation lifecycle.
 *
 *   QUOTED → RESERVED → RUNNING → COMPLETED
 *                          ↓
 *                        FAILED → RESERVATION_RELEASED
 *
 * RESERVATION_RELEASED is a terminal state distinct from FAILED on
 * purpose: §13 requires that "a failed computation must never silently
 * consume the eventual user's Sand", and the only way to PROVE the
 * release happened is for it to be an observable state of its own,
 * rather than an attribute quietly flipped on a FAILED row.
 */
export type ComputeOperationStatus =
  | 'QUOTED'
  | 'RESERVED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RESERVATION_RELEASED';

/** Terminal states — an operation in one of these will never change again. */
export const TERMINAL_OPERATION_STATUSES: readonly ComputeOperationStatus[] = [
  'COMPLETED',
  'FAILED',
  'RESERVATION_RELEASED',
] as const;

export function isTerminalOperationStatus(status: ComputeOperationStatus): boolean {
  return TERMINAL_OPERATION_STATUSES.includes(status);
}

/**
 * The legal successor states for each status. Exported so the
 * transition rule is data the ledger service and its tests share,
 * rather than an `if` ladder duplicated in both.
 */
export const ALLOWED_OPERATION_TRANSITIONS: Readonly<
  Record<ComputeOperationStatus, readonly ComputeOperationStatus[]>
> = {
  QUOTED: ['RESERVED', 'FAILED'],
  RESERVED: ['RUNNING', 'RESERVATION_RELEASED', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['RESERVATION_RELEASED'],
  RESERVATION_RELEASED: [],
} as const;

export function canTransition(
  from: ComputeOperationStatus,
  to: ComputeOperationStatus,
): boolean {
  return ALLOWED_OPERATION_TRANSITIONS[from].includes(to);
}

/**
 * §5 — the kinds of work this product meters. Kept deliberately small
 * and product-shaped (not one entry per internal function), because
 * this value is persisted on every ledger row and must stay readable
 * in an audit years from now.
 */
export type ComputeOperationKind =
  /** A single Ask turn (§3), whatever class it classifies to. */
  | 'ask-turn'
  /** An explicit Deep Analysis invocation (§9). */
  | 'deep-analysis'
  /** A long-running report synthesis (§5 RESEARCH_REPORT). */
  | 'research-report'
  /** Rendering a simple public category view (§16/§17) — must classify STORED/CONTEXTUAL. */
  | 'category-view';

/**
 * §6 — the dimensions that together identify "the same computation".
 *
 * This is the durable, cross-process generalization of the in-memory
 * cache key AnalysisService already uses
 * (`${requestedLanguage}:${normalizedQuery.toLowerCase()}${storyAnchor}`).
 * That existing key is NOT replaced — it still governs the process-local
 * TTL cache — but it cannot satisfy §6 on its own: it is lost on restart
 * and unshared across Railway replicas.
 *
 * Every field is part of the identity. A null/undefined field is a
 * meaningful part of the identity too (see buildStoredResultFingerprint
 * on the backend, which renders absence explicitly rather than skipping
 * the segment — otherwise `{country: 'RW', subject: undefined}` and
 * `{country: undefined, subject: 'RW'}` could collide).
 */
export interface StoredResultIdentity {
  /** The deterministically-normalized question/task text. */
  normalizedTask: string;
  /** Operation kind — an ask-turn and a category-view for the same text are not the same result. */
  kind: ComputeOperationKind;
  /** Subject/situation anchor (e.g. a story/article id), when the request carries one. */
  subjectId?: string;
  /** ISO alpha-2 geography, uppercase, when the request is geography-anchored. */
  countryCode?: string;
  /** Response language. Two languages are genuinely different results. */
  language: string;
  /**
   * Evidence revision — bumped when the underlying evidence corpus this
   * result was built from has moved on. This is what stops §6's
   * "do not regenerate just because the user revisited a route" from
   * decaying into "serve a stale answer forever".
   */
  evidenceRevision: string;
  /** Time window, when the request is bounded to one (e.g. '7d'). */
  timeWindow?: string;
  /** Analysis type/domain, when the request selects one. */
  analysisType?: string;
  /**
   * Model contract identity — included only when a model difference
   * would materially change the result. §6: "model contract where
   * materially necessary".
   */
  modelContract?: string;
}

/**
 * §8 — the canonical server-side metered-operation contract.
 *
 * Field names follow §8's own list, adapted to this repository's
 * camelCase TypeScript conventions.
 */
export interface MeteredOperation {
  operationId: string;
  kind: ComputeOperationKind;
  computeClass: ComputeClass;
  /** Sand quoted before execution. Always an integer. 0 for STORED/CONTEXTUAL. */
  quotedSand: number;
  requiresConfirmation: boolean;
  entitlementState: EntitlementState;
  /** §12 — the stable key that makes re-submitting this operation a no-op. */
  idempotencyKey: string;
  /** Present once a result exists; the handle by which the result is replayed for 0 Sand. */
  resultId?: string;
  executionStatus: ComputeOperationStatus;
  createdAt: string;
  completedAt?: string;
}

/**
 * §9 — what the server returns when the UI asks "what would this cost?".
 *
 * A quote is a PROMISE ABOUT A CLASSIFICATION, not a reservation. It
 * carries `operationId` so the subsequent confirm/execute call refers
 * to this exact quoted operation rather than re-submitting a request
 * the server would have to classify a second time (and might classify
 * differently if evidence moved in between).
 */
export interface SandQuote {
  operationId: string;
  kind: ComputeOperationKind;
  computeClass: ComputeClass;
  quotedSand: number;
  requiresConfirmation: boolean;
  entitlementState: EntitlementState;
  /**
   * §6 — true when an adequate stored result already exists, in which
   * case quotedSand is 0 and executing simply replays it.
   */
  storedResultAvailable: boolean;
  /** Present when storedResultAvailable is true. */
  resultId?: string;
  /**
   * Human-readable label for the UI's quote panel, e.g. "Deep Analysis".
   * Server-supplied so the price and its label can never drift apart in
   * a component.
   */
  label: string;
  /**
   * Why this class was chosen. Surfaced in Admin/telemetry and useful
   * in a UI tooltip; never a raw prompt or provider message.
   */
  rationale: readonly string[];
  /** Quotes are short-lived; re-quote after this instant. */
  expiresAt: string;
  /**
   * §10 — the value of SAND_CHARGING at quote time. When false (the
   * required default), a `metered` quote is still produced and shown,
   * but execution will refuse to mutate any balance.
   */
  chargingEnabled: boolean;
}

/**
 * §14 — private/Admin-side cost telemetry for one AI/retrieval
 * operation.
 *
 * This is NOT the Sand price shown to users, and nothing in this
 * interface is ever rendered on a public surface. Its purpose is
 * stated in §14: Beta usage must tell us what operations actually cost
 * before commercial Sand economics are set.
 *
 * Every field except the identity/duration trio is optional because
 * §14 says "when available" — a mock provider reports no tokens, a
 * stored-result replay makes no provider request, and inventing zeros
 * for those would silently corrupt the very cost baseline this exists
 * to establish. Absent means "not reported", never "zero".
 */
export interface ComputeCostTelemetry {
  operationId: string;
  kind: ComputeOperationKind;
  computeClass: ComputeClass;
  /** Wall-clock duration of the whole operation, in milliseconds. */
  durationMs: number;
  /** True when the operation was satisfied without new expensive execution. */
  storedResultReused: boolean;
  /** Process-local TTL cache outcome, when the operation consulted it. */
  cacheHit?: boolean;

  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Number of retrieval round-trips (news/signal provider searches). */
  retrievalCalls?: number;
  /** Number of upstream provider HTTP requests. */
  providerRequests?: number;
  /** Number of evidence items (articles) the operation actually used. */
  evidenceCount?: number;
  /** Coarse failure classification when the operation did not succeed. */
  failureType?: string;
  /**
   * Actual or estimated provider cost in USD micro-dollars (1e-6 USD),
   * when derivable. Integer micro-dollars rather than a float: this
   * value is summed across many rows in Admin reporting, and floating
   * point accumulation error in a cost baseline is not acceptable.
   */
  estimatedCostMicroUsd?: number;
}

/**
 * §11 — one auditable movement in the minimal Sand ledger.
 *
 * "Minimal" is deliberate, per §11's own instruction not to build a
 * full financial wallet: there is no balance top-up, no purchase, no
 * currency conversion and no payment reference anywhere in this type.
 * This is compute accounting, not payment processing.
 */
export type SandLedgerEntryType =
  /** A quote was issued. Moves nothing; recorded so a quote is auditable even if never executed. */
  | 'QUOTE'
  /** Sand set aside for an operation about to run. */
  | 'RESERVE'
  /** A reservation converted into a final charge on completion. */
  | 'SETTLE'
  /** A reservation returned in full because the operation failed or was abandoned (§13). */
  | 'RELEASE';

export interface SandLedgerEntry {
  id: string;
  operationId: string;
  entryType: SandLedgerEntryType;
  /** Account this entry belongs to; absent for an anonymous/guest operation. */
  userId?: string;
  /** Anonymous/guest operations are attributed to a session identity instead. */
  sessionKey?: string;
  /** The quoted amount at the time the operation was created. */
  quotedSand: number;
  /** Amount reserved by this entry. 0 for QUOTE and SETTLE/RELEASE rows. */
  reservedSand: number;
  /** Final amount actually consumed. Only non-zero on SETTLE. */
  finalSand: number;
  status: ComputeOperationStatus;
  /** The result this entry's operation produced, when it produced one. */
  resultId?: string;
  createdAt: string;
}

/**
 * §12 — what a caller gets back when it re-submits an operation it has
 * already submitted.
 *
 * `reused: true` is the whole point: the caller cannot distinguish a
 * genuine first execution from a replay by looking at the result, so
 * the envelope has to say so explicitly for the behavior to be
 * testable and for telemetry to stay honest.
 */
export interface IdempotentOperationEnvelope<T> {
  operationId: string;
  idempotencyKey: string;
  reused: boolean;
  executionStatus: ComputeOperationStatus;
  result: T | null;
}
