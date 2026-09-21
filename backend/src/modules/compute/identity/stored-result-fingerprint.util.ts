import { createHash } from 'node:crypto';
import type { StoredResultIdentity } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §6 — canonical stored-result identity.
 *
 * §6 lists the dimensions a cache/result identity "should consider":
 * normalized task, subject/situation, evidence revision, geography,
 * time window, language, analysis type, and model contract where
 * materially necessary. This file turns that list into one
 * deterministic string.
 *
 * RELATIONSHIP TO THE EXISTING CACHE KEY — important, and deliberate.
 *
 * AnalysisService already computes
 *   `${requestedLanguage}:${normalizedQuery.toLowerCase()}${storyAnchor}`
 * for its process-local TTL cache, and analysisApi.ts computes the same
 * key on the frontend for in-flight dedup. That key is NOT replaced,
 * renamed or re-derived here — it keeps governing the in-memory cache
 * exactly as it does today, so M45/M47/M51's proven behavior is
 * untouched.
 *
 * This fingerprint is a SECOND, WIDER identity for a DURABLE store,
 * and it exists because the in-memory key structurally cannot satisfy
 * §6 or §12:
 *
 *   - it is lost on process restart, so "reopening a stored result"
 *     after a deploy would re-run the AI (§6 violation, §30 test);
 *   - it is per-replica, so on Railway with >1 instance two users get
 *     two executions of the same question (§12 violation);
 *   - it omits evidence revision, so it either serves stale answers
 *     forever or expires purely on a clock, neither of which is
 *     "adequate stored result".
 *
 * Both keys coexist. The in-memory one is a fast path in front of the
 * durable one.
 */

/**
 * Rendered in place of an absent optional dimension.
 *
 * Absence must be EXPLICIT, never a skipped segment. If an absent
 * field simply produced an empty segment, then
 *   { countryCode: 'RW', subjectId: undefined }
 * and
 *   { countryCode: undefined, subjectId: 'RW' }
 * would serialize identically and collide — two genuinely different
 * questions sharing one stored answer. That is the exact class of bug
 * §6 is trying to prevent, so the sentinel is not cosmetic.
 */
const ABSENT = '\u0000';

/** Field separator. A control character, so it can never occur inside a real value. */
const SEP = '\u001f';

/**
 * Normalizes one dimension into a canonical, comparable form.
 *
 * Lowercasing matches the existing AnalysisService key's own
 * `.toLowerCase()` treatment of the query, so the two identities agree
 * about what "the same question" means.
 */
function segment(value: string | undefined): string {
  if (value === undefined || value === null) return ABSENT;
  const trimmed = value.trim();
  return trimmed.length === 0 ? ABSENT : trimmed.toLowerCase();
}

/**
 * The ordered dimension list. Order is part of the contract: changing
 * it changes every fingerprint, which is a cache-wide invalidation.
 * It is written out explicitly rather than derived from Object.keys()
 * because object key order is an implementation detail and must never
 * silently decide cache identity.
 */
export function buildStoredResultFingerprint(identity: StoredResultIdentity): string {
  const canonical = [
    segment(identity.kind),
    segment(identity.normalizedTask),
    segment(identity.subjectId),
    // Geography is uppercased by convention elsewhere in this
    // repository (ISO alpha-2); segment() lowercases everything
    // uniformly, so 'RW' and 'rw' correctly resolve to one identity.
    segment(identity.countryCode),
    segment(identity.language),
    segment(identity.evidenceRevision),
    segment(identity.timeWindow),
    segment(identity.analysisType),
    segment(identity.modelContract),
  ].join(SEP);

  /**
   * Hashed rather than stored raw for two practical reasons, not for
   * secrecy: a question may be up to 1000 characters (AnalyzeNewsDto's
   * @MaxLength), which is a poor database unique-index key; and a raw
   * key would put verbatim user question text into an index name in
   * logs and query plans. SHA-256 hex is fixed-width and index-friendly.
   *
   * It is NOT a security boundary — a fingerprint is not a secret and
   * is never used for authorization.
   */
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Exposed for tests and for Admin debugging: the pre-hash canonical
 * string, so a fingerprint mismatch can actually be diagnosed instead
 * of being an opaque hex difference.
 */
export function buildStoredResultCanonicalString(identity: StoredResultIdentity): string {
  return [
    segment(identity.kind),
    segment(identity.normalizedTask),
    segment(identity.subjectId),
    segment(identity.countryCode),
    segment(identity.language),
    segment(identity.evidenceRevision),
    segment(identity.timeWindow),
    segment(identity.analysisType),
    segment(identity.modelContract),
  ].join(SEP);
}

/**
 * §12 — the durable idempotency identity for one submitted operation.
 *
 * Distinct from the stored-result fingerprint, and the distinction is
 * the whole of §12:
 *
 *   - the FINGERPRINT answers "has anyone ever computed this?" — it is
 *     shared across users, and a hit means reuse for 0 Sand (§6);
 *   - the IDEMPOTENCY KEY answers "has THIS CALLER already submitted
 *     THIS EXACT SUBMISSION?" — it is per-caller, and a hit means
 *     return the same operation rather than creating a second one.
 *
 * Conflating them would be a real defect: two different users asking
 * the same question share a stored result (correct) but must never
 * share one metered operation row, or one user's failure would release
 * the other's reservation.
 */
export function buildOperationIdempotencyIdentity(input: {
  /** The caller's stable identity: userId when signed in, session key when a guest. */
  ownerKey: string;
  /** The client-supplied idempotency key (§12) — required by AskTurnRequest. */
  clientKey: string;
  kind: string;
}): string {
  const canonical = [segment(input.kind), segment(input.ownerKey), segment(input.clientKey)].join(
    SEP,
  );
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
