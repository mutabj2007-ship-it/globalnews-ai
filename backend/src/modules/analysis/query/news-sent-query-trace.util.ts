/**
 * ════════════════════════════════════════════════════════════════════════════
 * A4 · WHAT WAS ACTUALLY SENT — A FACT, NOT AN ESTIMATE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED: live operation `3a3eb693-a669-4609-b912-e17483fd6124` recorded
 * `retrievalTrace.queryVariants: []` on a generic retrieval that DID call a
 * provider once (`providerCalls: 1`, `seen: 0`). So the stored trace could not
 * say what was searched, and the A1 defect had to be reconstructed offline
 * before anyone could name it. The planned/event/compound paths already
 * collect their sent queries; the ordinary generic path records nothing
 * because `plannedTrace` is undefined there.
 *
 * AN EMPTY TRACE IS NOT A SEARCH THAT NEVER HAPPENED. That conflation is the
 * whole problem: one empty array stood for "nothing was attempted", "the
 * provider returned nothing" and "the provider failed", which are three
 * different findings with three different owners.
 *
 * ── THE ONE RULE THIS MODULE ENFORCES ───────────────────────────────────────
 *
 * A QUERY STRING IS PRESENT ONLY WHEN IT WAS ACTUALLY DISPATCHED. Every
 * constructor below is shaped so that a skipped, ineligible or unavailable
 * attempt CANNOT carry a query, and an attempt that was dispatched MUST carry
 * one. That is why these are functions rather than an interface anyone can
 * fill in: a record that claims a string was sent when the provider was never
 * called is worse than no record, because it would be believed.
 *
 * ── WHAT IS NEVER RECORDED ──────────────────────────────────────────────────
 *
 * No API key, token, session, auth header, user identifier, raw provider
 * payload or article body. The ONLY free text is the sanitized provider query
 * — the string the provider already received — truncated to a bound. A
 * `credential-shaped` guard refuses anything that looks like a secret rather
 * than trusting the caller, because this record is written to storage and read
 * by people.
 */

/** Which attempt on the generic path this record describes. */
export const SENT_QUERY_ROLES = ['PRIMARY', 'FALLBACK'] as const;
export type SentQueryRole = (typeof SENT_QUERY_ROLES)[number];

export const SENT_QUERY_OUTCOMES = [
  /** Dispatched; the provider answered with candidates. */
  'SENT_RESULTS',
  /** Dispatched; the provider answered, with zero candidates. A real answer. */
  'SENT_ZERO_RESULTS',
  /** Dispatched; the provider failed, timed out or rate-limited. NOT a zero. */
  'SENT_PROVIDER_FAILED',
  /** Never dispatched: no lexical query survived derivation. */
  'SKIPPED_NO_QUERY',
  /** Never dispatched: the provider or lane was ineligible or unavailable. */
  'SKIPPED_PROVIDER_INELIGIBLE',
  /** Never dispatched: retained evidence was used in place of a live call. */
  'SKIPPED_RETAINED_SUBSTITUTED',
] as const;
export type SentQueryOutcome = (typeof SENT_QUERY_OUTCOMES)[number];

/** The outcomes that mean bytes left the process. */
const DISPATCHED: readonly SentQueryOutcome[] = [
  'SENT_RESULTS',
  'SENT_ZERO_RESULTS',
  'SENT_PROVIDER_FAILED',
];

export function outcomeMeansDispatched(outcome: SentQueryOutcome): boolean {
  return DISPATCHED.includes(outcome);
}

/** Bounded, so a trace cannot grow without limit in storage. */
export const SENT_QUERY_MAX_LENGTH = 200;
export const SENT_QUERY_MAX_ATTEMPTS = 2;

export interface SentQueryAttempt {
  readonly role: SentQueryRole;
  readonly outcome: SentQueryOutcome;
  /**
   * The sanitized string the provider received, or `null` when nothing was
   * dispatched. NEVER a reconstruction of what might have been sent.
   */
  readonly query: string | null;
  /** The provider lane, e.g. 'gnews'. An identifier, never a credential. */
  readonly lane: string | null;
}

/**
 * Patterns that must never reach a stored trace.
 *
 * Checked rather than assumed. A provider query is reader text and should
 * contain none of this; if it does, something upstream has gone wrong and the
 * right response is to record that the query was withheld, not to store it.
 */
const CREDENTIAL_SHAPED = [
  /\b(?:api[_-]?key|apikey|token|secret|bearer|authorization|password|passwd|session)\b/i,
  /\b[A-Za-z0-9_-]{32,}\b/,
  /https?:\/\/\S*[?&](?:key|token|apikey|access_token)=/i,
];

export const WITHHELD_QUERY = '[withheld: credential-shaped]';

/** Sanitize a dispatched query for storage: bounded, single-line, secret-free. */
export function sanitizeSentQuery(query: string): string {
  const flat = query.replace(/\s+/g, ' ').trim();

  for (const pattern of CREDENTIAL_SHAPED) {
    if (pattern.test(flat)) return WITHHELD_QUERY;
  }

  return flat.length <= SENT_QUERY_MAX_LENGTH ? flat : flat.slice(0, SENT_QUERY_MAX_LENGTH);
}

/**
 * Record an attempt that WAS dispatched.
 *
 * The outcome is narrowed to the dispatched set at the type level, so a caller
 * cannot use this constructor to describe something it skipped.
 */
export function recordDispatched(
  role: SentQueryRole,
  query: string,
  outcome: 'SENT_RESULTS' | 'SENT_ZERO_RESULTS' | 'SENT_PROVIDER_FAILED',
  lane: string | null = null,
): SentQueryAttempt {
  return Object.freeze({ role, outcome, query: sanitizeSentQuery(query), lane });
}

/**
 * Record an attempt that was NOT dispatched.
 *
 * `query` IS ABSENT FROM THIS SIGNATURE ENTIRELY. There is no argument to pass
 * one, so "skipped but here is what we would have sent" is not expressible —
 * which is the A4 ruling ("a query variant must not claim it was sent if the
 * provider was skipped") enforced by the shape instead of by a reviewer.
 */
export function recordSkipped(
  role: SentQueryRole,
  outcome: 'SKIPPED_NO_QUERY' | 'SKIPPED_PROVIDER_INELIGIBLE' | 'SKIPPED_RETAINED_SUBSTITUTED',
  lane: string | null = null,
): SentQueryAttempt {
  return Object.freeze({ role, outcome, query: null, lane });
}

/**
 * Assemble the bounded trace for one generic retrieval.
 *
 * Order is PRIMARY then FALLBACK, and at most `SENT_QUERY_MAX_ATTEMPTS`
 * entries survive, matching the existing no-retry-on-provider-failure budget:
 * this record cannot imply more provider calls than the path is allowed.
 */
export function buildSentQueryTrace(
  attempts: readonly SentQueryAttempt[],
): readonly SentQueryAttempt[] {
  const primary = attempts.filter((a) => a.role === 'PRIMARY').slice(0, 1);
  const fallback = attempts.filter((a) => a.role === 'FALLBACK').slice(0, 1);

  return Object.freeze([...primary, ...fallback].slice(0, SENT_QUERY_MAX_ATTEMPTS));
}

/**
 * The strings that were genuinely dispatched, for the existing
 * `retrievalTrace.queryVariants` field.
 *
 * SKIPPED ATTEMPTS CONTRIBUTE NOTHING. So `queryVariants` keeps meaning
 * exactly "what we sent" — an empty array now means "we sent nothing", which
 * is a statement rather than the absence of one, and the companion attempts
 * say WHY.
 */
export function sentQueryVariants(attempts: readonly SentQueryAttempt[]): readonly string[] {
  return Object.freeze(
    buildSentQueryTrace(attempts)
      .filter((a) => outcomeMeansDispatched(a.outcome) && a.query !== null)
      .map((a) => a.query as string),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE FALLBACK DECISION — R2 RULING, AS ONE FUNCTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "A second search is permitted only when the primary provider actually
 *  completed successfully but yielded no relevant candidates; a distinct,
 *  meaningful, provider-safe fallback exists; and the budget permits it. Never
 *  issue another search because the provider was rate-limited, timed out, was
 *  unavailable or refused the request. If primary and fallback are identical,
 *  do not send the same query twice."
 *
 * Expressed as a decision rather than prose so the condition is checked in one
 * place and the reason is recorded either way. The caller still owns the
 * dispatch; this owns the ruling.
 */
export const FALLBACK_DECISIONS = [
  'FALLBACK_PERMITTED',
  /** The primary did not complete — a failure is never a reason to search again. */
  'FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE',
  /** The primary found candidates, so there is nothing to fall back from. */
  'FALLBACK_REFUSED_PRIMARY_HAD_CANDIDATES',
  /** No distinct provider-safe fallback string exists. */
  'FALLBACK_REFUSED_NO_QUERY',
  /** The fallback equals the primary; sending it twice buys nothing. */
  'FALLBACK_REFUSED_IDENTICAL_TO_PRIMARY',
  /** The provider-call budget is already spent. */
  'FALLBACK_REFUSED_BUDGET_SPENT',
] as const;
export type FallbackDecision = (typeof FALLBACK_DECISIONS)[number];

export interface FallbackDecisionInput {
  /** The exact string the primary attempt sent, or undefined if none was sent. */
  readonly primarySent: string | undefined;
  readonly primaryOutcome: SentQueryOutcome;
  readonly primaryCandidateCount: number;
  /** The candidate fallback string, or undefined when none could be derived. */
  readonly fallbackQuery: string | undefined;
  readonly budgetRemaining: number;
}

/**
 * Decide whether the bounded second search may go out.
 *
 * ORDER IS DELIBERATE: the completion check runs FIRST, so a rate-limited or
 * timed-out primary can never reach the later conditions. That is the one the
 * ruling is emphatic about, and putting it first means no combination of the
 * others can smuggle a retry past it.
 */
export function decideFallback(input: FallbackDecisionInput): FallbackDecision {
  if (!outcomeMeansDispatched(input.primaryOutcome)) {
    return 'FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE';
  }
  if (input.primaryOutcome === 'SENT_PROVIDER_FAILED') {
    return 'FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE';
  }
  if (input.primaryCandidateCount > 0) return 'FALLBACK_REFUSED_PRIMARY_HAD_CANDIDATES';
  if (input.fallbackQuery === undefined || input.fallbackQuery.trim().length === 0) {
    return 'FALLBACK_REFUSED_NO_QUERY';
  }
  if (input.primarySent !== undefined && input.fallbackQuery === input.primarySent) {
    return 'FALLBACK_REFUSED_IDENTICAL_TO_PRIMARY';
  }
  if (input.budgetRemaining <= 0) return 'FALLBACK_REFUSED_BUDGET_SPENT';

  return 'FALLBACK_PERMITTED';
}

/** The skip reason to record for a refused fallback. */
export function skipOutcomeForRefusedFallback(decision: FallbackDecision): SentQueryOutcome {
  return decision === 'FALLBACK_REFUSED_NO_QUERY' ||
    decision === 'FALLBACK_REFUSED_IDENTICAL_TO_PRIMARY'
    ? 'SKIPPED_NO_QUERY'
    : 'SKIPPED_PROVIDER_INELIGIBLE';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PER-LANE OUTCOMES — R2, INTAKE §6
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE CONFLATION, MEASURED ON A LIVE OPERATION. `3a3eb693` stored:
 *
 *   lanes.attempted  = ["gnews", "gdelt-doc"]
 *   lanes.succeeded  = ["gnews"]
 *   lanes.unavailable= [{ "gdelt-doc", "timeout" }]
 *   outcome          = PROVIDER_FAILED
 *   candidatesSeen   = 0
 *
 * Both of the earlier readings were partly right and both were misleading.
 * GNews ANSWERED, with nothing. GDELT TIMED OUT. The aggregate was stamped
 * `PROVIDER_FAILED` because one lane failed — so a GNews zero was reported as
 * a GNews failure, and A1's query defect was hidden behind someone else's
 * timeout.
 *
 * R1's trace reproduced this exactly: one attempt, the AGGREGATE outcome, and
 * the lane names joined into a single string (`gnews+gdelt-doc`). That is the
 * same loss of information in a new field, which is worse than not adding the
 * field — it looks like a fix.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * An attempt records ONE ENTRY PER LANE, each with its own outcome and its own
 * failure reason. The aggregate is DERIVED and never replaces the per-lane
 * facts, so "which lane answered with what" is always recoverable.
 */

export const LANE_OUTCOMES = [
  'LANE_RETURNED_CANDIDATES',
  /** The lane answered. Zero is an answer, not a failure. */
  'LANE_RETURNED_ZERO',
  'LANE_FAILED',
  'LANE_RATE_LIMITED',
  'LANE_TIMED_OUT',
  'LANE_UNAVAILABLE',
  'LANE_SKIPPED',
] as const;
export type LaneOutcome = (typeof LANE_OUTCOMES)[number];

export interface LaneResult {
  readonly lane: string;
  readonly outcome: LaneOutcome;
  /** Candidates this lane returned. Null when it did not answer. */
  readonly candidates: number | null;
  /** The lane's own reason, e.g. 'timeout'. Never a secret, never a payload. */
  readonly reason: string | null;
}

const LANE_ANSWERED: readonly LaneOutcome[] = ['LANE_RETURNED_CANDIDATES', 'LANE_RETURNED_ZERO'];

export function laneAnswered(outcome: LaneOutcome): boolean {
  return LANE_ANSWERED.includes(outcome);
}

export function recordLane(
  lane: string,
  outcome: LaneOutcome,
  candidates: number | null = null,
  reason: string | null = null,
): LaneResult {
  return Object.freeze({
    lane,
    outcome,
    candidates: laneAnswered(outcome) ? (candidates ?? 0) : null,
    reason: reason === null ? null : sanitizeSentQuery(reason),
  });
}

export const RETRIEVAL_OUTCOMES = [
  'RETRIEVAL_CANDIDATES',
  /** EVERY lane that ran answered, and the total was zero. A real answer. */
  'RETRIEVAL_ZERO_ALL_LANES_ANSWERED',
  /**
   * Some lanes answered and some did not. Coverage is PARTIAL — and this is
   * the state live op `3a3eb693` was actually in.
   */
  'RETRIEVAL_PARTIAL_SOME_LANES_UNAVAILABLE',
  /** No lane answered at all. */
  'RETRIEVAL_NO_LANE_ANSWERED',
  'RETRIEVAL_NOT_ATTEMPTED',
] as const;
export type RetrievalOutcome = (typeof RETRIEVAL_OUTCOMES)[number];

/**
 * Derive the aggregate from the per-lane facts.
 *
 * `RETRIEVAL_ZERO_ALL_LANES_ANSWERED` REQUIRES THAT EVERY LANE ANSWERED, which
 * is the distinction the old aggregate could not make: with GNews at zero and
 * GDELT timed out the answer is PARTIAL, not "no news" and not "provider
 * failed". A reader owed an honest coverage statement needs that difference,
 * and so does whoever is deciding whether A1 is still the open defect.
 */
export function deriveRetrievalOutcome(lanes: readonly LaneResult[]): RetrievalOutcome {
  if (lanes.length === 0) return 'RETRIEVAL_NOT_ATTEMPTED';

  const ran = lanes.filter((l) => l.outcome !== 'LANE_SKIPPED');

  if (ran.length === 0) return 'RETRIEVAL_NOT_ATTEMPTED';

  const answered = ran.filter((l) => laneAnswered(l.outcome));

  if (answered.length === 0) return 'RETRIEVAL_NO_LANE_ANSWERED';
  if (answered.some((l) => (l.candidates ?? 0) > 0)) return 'RETRIEVAL_CANDIDATES';
  if (answered.length < ran.length) return 'RETRIEVAL_PARTIAL_SOME_LANES_UNAVAILABLE';

  return 'RETRIEVAL_ZERO_ALL_LANES_ANSWERED';
}

/**
 * Was the PRIMARY genuinely complete for the purpose of the fallback ruling?
 *
 * A fallback is permitted only after a primary that COMPLETED and found
 * nothing. With a lane still unavailable the retrieval is partial, not a
 * completed empty search, so a second query would be issued on the strength of
 * someone else's timeout — which the ruling forbids.
 */
export function primaryCompletedEmpty(lanes: readonly LaneResult[]): boolean {
  return deriveRetrievalOutcome(lanes) === 'RETRIEVAL_ZERO_ALL_LANES_ANSWERED';
}
