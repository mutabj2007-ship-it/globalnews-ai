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
