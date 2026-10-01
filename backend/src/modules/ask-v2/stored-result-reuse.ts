/**
 * CURRENT REPORTING STORED-RESULT REUSE R1 — which stored answers a NEW explicit Send may replay.
 *
 * Production 2026-10-01: "Any global news can you share?" settled INSUFFICIENT ("Live reporting
 * is temporarily unavailable. Please try again in a moment.") while GNews was rate-limited. The
 * reader asked again 15 minutes later and was handed the same stored artifact (checkedAt
 * unchanged, no retrieval) because any unexpired StoredResult with the same fingerprint was
 * replayed. A current-reporting answer is an observation of a moment; asking again is a new
 * observation attempt, and a degraded answer that tells the reader to retry must be retryable.
 *
 * Only answers that do not depend on when they were produced are replayed: stable reference
 * background and a deterministic computation over the reader's own stated values. Everything
 * else — current / verified / partial reporting, INSUFFICIENT, clarifications, unavailable
 * capabilities, retained records and any payload whose state cannot be read — runs fresh under
 * the normal quota, breaker and provider-cooldown controls. Reopening an existing operation
 * (GET /operations/:id) never comes here: it stays a display-only read.
 */
const REUSABLE_ANSWER_STATES: ReadonlySet<string> = new Set([
  'REFERENCE_BACKGROUND',
  /* ASK TECHNICAL / SCIENTIFIC REASONING R1 — identical inputs give the identical result. */
  'COMPUTED_RESULT',
]);

export function isReusableStoredPayload(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object') return false;
  const answer = (payload as { answer?: { state?: unknown } }).answer;
  if (answer === undefined || answer === null || typeof answer !== 'object') return false;
  return typeof answer.state === 'string' && REUSABLE_ANSWER_STATES.has(answer.state);
}
