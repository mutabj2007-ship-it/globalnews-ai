/**
 * OFFICIAL-DATA SNAPSHOT — R2 AMENDMENT.
 *
 * This file is a DELTA over `MAIN-OFFICIAL-DATA-SNAPSHOT-RETENTION-R1`'s
 * `official-data-snapshot.ts.PROPOSED`. It amends SR-1 and SR-16, and adds the
 * admission model E1 requires. Everything R1 states that is not named here stands
 * unchanged — SR-2 … SR-15, SR-17 … SR-22, the four models, the seal, the store
 * interface and the retention policy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE COLLISION, AND WHY IT WAS A COLLISION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * R1 · SR-1: "the lowercase-hex SHA-256 of the exact bytes as received, BEFORE any
 *             parsing, application-layer decompression, re-encoding or normalisation".
 *
 * E1 · §3:   "gzip is not deterministic ... store the DECODED bytes, record
 *             contentEncoding as received, and hash the decoded bytes."
 *
 * Note that SR-1's own sentence contains both readings. "before any APPLICATION-LAYER
 * decompression" excludes only `Content-Type`-level compression and would leave
 * `Content-Encoding` removal inside the boundary; "the exact bytes as received"
 * excludes both. One sentence, two readings, and E1 and Claude Code would each have
 * been reading it correctly. AN AMBIGUITY THAT TWO CAREFUL READERS RESOLVE
 * DIFFERENTLY IS A DEFECT WHATEVER THE AUTHOR INTENDED, so R2 does not argue about
 * which reading was meant. It draws the line explicitly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULING · SNAP-R2-1 — ONE CONTENT IDENTITY, AND IT IS THE DECODED BYTES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * E1 is right, and the reason is stronger than the one E1 gave.
 *
 * E1's reason: gzip is nondeterministic, so a wire hash is a weaker anchor.
 *
 * THE REASON THAT DECIDES IT: under wire-byte identity, SR-4 and SR-5 ARE UNSOUND.
 * SR-4 says identical bytes deduplicate to one payload; SR-5 says different bytes are
 * a new snapshot. Both were written assuming bytes == content. Under
 * `Content-Encoding: gzip` that assumption fails in the dangerous direction: a
 * publisher that changes zlib version or compression level re-serves IDENTICAL DATA
 * under a NEW ADDRESS. That is a FALSE EDITION CHANGE — and this whole contract
 * exists because G measured one Eurostat dataset serving three editions in a session.
 * A retention layer that manufactures spurious edition changes is worse than no
 * edition detection at all, because the spurious ones look exactly like the real ones.
 *
 * SO: `contentAddress = sha256(decoded bytes)`, where DECODED means transport
 * `Content-Encoding` removal AND NOTHING ELSE. No parsing. No re-encoding. No charset
 * transcoding. No whitespace handling. No JSON canonicalisation.
 *
 * SNAP-R2-2 — THE COLLISION'S BLAST RADIUS IS THE GZIP PATH AND NOTHING ELSE.
 * Under `Content-Encoding: identity` the decoded bytes ARE the wire bytes, so R1 and
 * R2 produce the same address for the same capture. Every `identity` capture already
 * taken under R1 keeps its address. This is worth stating because it is the
 * difference between an amendment and a migration.
 *
 * SNAP-R2-3 — TRANSPORT EVIDENCE IS RECORDED AND IS NOT AN IDENTITY.
 * `contentEncoding` as received and `wireByteLength` are recorded. They are free, and
 * the wire length is the only way to notice a transport-layer surprise later.
 *
 * AND THERE IS NO WIRE DIGEST. This is a ruling, not an omission. A hash over bytes
 * the store does not retain CAN NEVER BE RE-VERIFIED — the store would be recording a
 * claim it has permanently disabled itself from checking. R1's entire no-forge
 * property (SR-11) rests on the store computing the address from bytes IT HOLDS;
 * a digest over discarded bytes is the exact inverse of that property wearing its
 * clothes. Nothing that cannot be re-derived is admitted as evidence here.
 *
 * SNAP-R2-4 — THE PARSER/STORE BOUNDARY GETS CLEANER, NOT MURKIER.
 * Under R1 a parser handed "the exact bytes as received" would have had to decompress
 * them, which puts a transport concern inside a semantics component. Under R2 the
 * store owns transport decode and the parser receives bytes it can parse. SR-14 is
 * unchanged in wording and stronger in effect.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · CAPTURE OUTCOME AND ADMISSIBILITY — TWO FIELDS, NEITHER INFERABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * E1 · S-1/S-2/S-3. "A snapshot is evidence of WHAT WAS RECEIVED. An observation
 * requires evidence of WHAT WAS MEANT. A failed capture is excellent evidence of the
 * first and no evidence at all of the second."
 *
 * SNAP-R2-5 — `captureOutcome` IS R1's `SnapshotCompleteness`, NOT A SECOND COLUMN.
 * E1 named the field and gave it one value, `RECEIVED`. R1 already carries a field
 * that records "bytes are stored, whatever they turned out to be", with a richer
 * domain, already landed and already tested by Claude Code. Adding a second field
 * beside it would record one fact under two names — the defect ruling SNAP-R-2 was
 * written to prevent. The pair (completeness, admissibility) satisfies E1's structural
 * requirement exactly: neither is inferable from the other, because a COMPLETE capture
 * can be REFUSED for host mismatch and a TRUNCATED capture is always REFUSED.
 */

/*
  ── ADAPTATION 1 OF 2 AT PROMOTION, AND IT IS SNAP-R2-5 APPLIED TO ITSELF ────

  The proposal declared this as its own literal union. Landing it that way would put
  the SAME three values in two places — `SNAPSHOT_COMPLETENESS_STATES` in the R1
  contract and `SNAPSHOT_CAPTURE_OUTCOMES` here — which is exactly the "one fact
  under two names" defect the paragraph above refuses, in its own words:
  *"`captureOutcome` IS R1's `SnapshotCompleteness`, NOT A SECOND COLUMN."* The
  ruling is about the column and it is true of the vocabulary for the same reason:
  two literal unions drift, and nothing notices.

  So E1's NAME is provided as an ALIAS of the accepted R1 vocabulary. One
  declaration, one source of truth, and a reader looking for E1's field name still
  finds it. No value moved.
*/
export { SNAPSHOT_COMPLETENESS_STATES as SNAPSHOT_CAPTURE_OUTCOMES } from './snapshot';
export type { SnapshotCompleteness as SnapshotCaptureOutcome } from './snapshot';

// A re-export publishes the name; it does not bring it into this file's scope. The
// admission record below refers to it, so it is imported as well.
import type { SnapshotCompleteness as SnapshotCaptureOutcome } from './snapshot';

export const SNAPSHOT_ADMISSIBILITIES = ['REFUSED', 'ADMITTED'] as const;
export type SnapshotAdmissibility = (typeof SNAPSHOT_ADMISSIBILITIES)[number];

/** S-1 · the default is REFUSED, and it is a constant rather than a convention. */
export const DEFAULT_ADMISSIBILITY: SnapshotAdmissibility = 'REFUSED';

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · REFUSAL KEYS, EACH CLASSIFIED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * E1 · S-5. G measured the Eurostat dataset-code lifecycle as three states, two of
 * which are HTTP 200, and recorded that "404 must never enter the cooldown path": a
 * permanent configuration error on a retry loop reports as a transient provider
 * outage. So every key carries its class, and only TRANSIENT may retry.
 */

export const SNAPSHOT_REFUSAL_KEYS = [
  'PROVENANCE_HOST_MISMATCH',
  'STATUS_NOT_OK',
  'MEDIA_TYPE_NOT_ALLOWED',
  'CHARSET_NOT_ALLOWED',
  'ENCODING_NOT_ALLOWED',
  'SIZE_EXCEEDED',
  'DECOMPRESSION_BOUND_EXCEEDED',
  'BODY_NOT_JSON_SHAPED',
  'ARCHIVE_NOT_ALLOWED',
  'PARSE_FAILED',
  'ENVELOPE_NOT_RECOGNISED',
  'SECRET_DETECTED',
  'PROVIDER_NOT_ALLOWLISTED',
] as const;

export type SnapshotRefusalKey = (typeof SNAPSHOT_REFUSAL_KEYS)[number];

export const REFUSAL_CLASSES = ['PERMANENT', 'TRANSIENT'] as const;
export type RefusalClass = (typeof REFUSAL_CLASSES)[number];

/**
 * DERIVED FROM ONE TABLE, so a key cannot be added without being classified.
 *
 * `STATUS_NOT_OK` is the only key whose class depends on the response, and it is the
 * one G measured the failure on: 404 is PERMANENT, 503 is TRANSIENT. It is therefore
 * classified by a function of the status rather than by a constant, and the constant
 * table marks it so a reader sees why it is different.
 */
const REFUSAL_CLASS_BY_KEY: Readonly<Record<SnapshotRefusalKey, RefusalClass | 'BY_STATUS'>> =
  Object.freeze({
    PROVENANCE_HOST_MISMATCH: 'PERMANENT',
    STATUS_NOT_OK: 'BY_STATUS',
    MEDIA_TYPE_NOT_ALLOWED: 'PERMANENT',
    CHARSET_NOT_ALLOWED: 'PERMANENT',
    ENCODING_NOT_ALLOWED: 'PERMANENT',
    SIZE_EXCEEDED: 'PERMANENT',
    DECOMPRESSION_BOUND_EXCEEDED: 'PERMANENT',
    BODY_NOT_JSON_SHAPED: 'TRANSIENT',
    ARCHIVE_NOT_ALLOWED: 'PERMANENT',
    PARSE_FAILED: 'PERMANENT',
    ENVELOPE_NOT_RECOGNISED: 'PERMANENT',
    SECRET_DETECTED: 'PERMANENT',
    PROVIDER_NOT_ALLOWLISTED: 'PERMANENT',
  });

/**
 * `BODY_NOT_JSON_SHAPED` is TRANSIENT on purpose and it is the one row worth arguing
 * about. E1 gives it its own key precisely because "a portal error page, a WAF
 * interstitial and a captive portal are operational conditions, not parse failures" —
 * and operational conditions clear. `PARSE_FAILED` is PERMANENT because malformed
 * JSON from the same request will be malformed again.
 */
export function refusalClassFor(key: SnapshotRefusalKey, httpStatus?: number): RefusalClass {
  const c = REFUSAL_CLASS_BY_KEY[key];
  if (c !== 'BY_STATUS') return c;
  if (httpStatus === undefined) {
    throw new Error('SNAP-R2-CLASS-1: STATUS_NOT_OK cannot be classified without the status.');
  }
  return httpStatus >= 500 || httpStatus === 408 || httpStatus === 429 ? 'TRANSIENT' : 'PERMANENT';
}

export function refusalMayRetry(key: SnapshotRefusalKey, httpStatus?: number): boolean {
  return refusalClassFor(key, httpStatus) === 'TRANSIENT';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2.1 · R2-SEC-B · THE CLASS IS DERIVED, NOT MERELY DECLARED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ADDED AT E1's R2 SECURITY RE-REVIEW, ITEM B, AND THE FINDING IS EXACT.
 *
 * `refusalClassFor()` above has always said SECRET_DETECTED is PERMANENT. But the
 * record carries `refusalClass` as a SEPARATE FIELD that a writer supplies, and
 * nothing compared the two. So this was representable:
 *
 *     { refusalKey: 'SECRET_DETECTED', refusalClass: 'TRANSIENT' }
 *
 * — a capture refused BECAUSE IT LEAKED A CREDENTIAL, marked retryable. A retry loop
 * would then re-send a request already known to have exposed a secret, against the
 * same endpoint, on a schedule. The table said the right thing and nothing enforced it.
 *
 * THE FIX IS TO STOP THE FIELD BEING INDEPENDENT. The class is now checked against
 * the one the table derives, for EVERY key — not only the security ones, because a
 * mismatch is a defect wherever it occurs and a rule with exceptions is a rule people
 * learn the exceptions to.
 *
 * The security subset gets a second, absolute guard beneath it, because "equal to the
 * derived value" is a consistency property and "never retryable" is a safety one. If
 * the table were ever edited, the first would still pass and the second would not.
 */

/**
 * Refusals whose cause is a SECURITY condition rather than an operational one.
 *
 * These may never be retried on the same request, whatever the table says and whatever
 * a caller supplies. Changing that requires a separately governed remediation that
 * changes the REQUEST — rotating the credential that leaked, or correcting the host —
 * and a remediated request is a new capture, not a retry of this one.
 */
export const SECURITY_REFUSAL_KEYS: readonly SnapshotRefusalKey[] = [
  'SECRET_DETECTED',
  'PROVENANCE_HOST_MISMATCH',
  'DECOMPRESSION_BOUND_EXCEEDED',
  'ARCHIVE_NOT_ALLOWED',
  'ENCODING_NOT_ALLOWED',
];

export function refusalIsSecurityClass(key: SnapshotRefusalKey): boolean {
  return SECURITY_REFUSAL_KEYS.includes(key);
}

/**
 * R2-SEC-B · the structural invariant. Called by `assertAdmissionRecordIsCoherent`,
 * so there is no path that records a refusal without it.
 */
export function assertRefusalClassIsLawful(
  key: SnapshotRefusalKey,
  declaredClass: RefusalClass,
  httpStatus?: number,
): void {
  if (refusalIsSecurityClass(key) && declaredClass !== 'PERMANENT') {
    throw new Error(
      `SNAP-R2-SEC-B-1: '${key}' is a SECURITY refusal and is never retryable. Recording it as ` +
        `${declaredClass} would licence re-sending a request already known to be unsafe — for ` +
        `SECRET_DETECTED, one known to have exposed a credential. A remediation that changes the ` +
        `request produces a NEW capture; it does not make this one retryable.`,
    );
  }

  // STATUS_NOT_OK is the one key whose class depends on the response, so it can only be
  // checked when the status is known. Skipping it here is deliberate and narrow: the
  // security guard above has already run, and STATUS_NOT_OK is not a security key.
  if (key === 'STATUS_NOT_OK' && httpStatus === undefined) return;

  const derived = refusalClassFor(key, httpStatus);

  if (declaredClass !== derived) {
    throw new Error(
      `SNAP-R2-SEC-B-2: '${key}' is classified ${derived} by the contract's own table, and this ` +
        `record declares ${declaredClass}. The class is derived, not chosen: a field that can ` +
        `disagree with the table it is supposed to reflect will eventually disagree.`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE ALPHA ALLOWLIST — ONE TYPE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * E1 · §1. `application/json`, charset absent or utf-8. A risk list is not an
 * authorisation: `text/csv` and `application/xml` appear in the brief's risk list and
 * neither implementation-ready provider requires them, so neither is admitted.
 *
 * ADDING A MEDIA TYPE IS AN AMENDMENT WITH ITS OWN PER-TYPE ROW, NOT A CONFIG CHANGE,
 * because each new type brings its own parser and its own differentials. That is why
 * this is a frozen constant in the contract and not a settings value.
 */
export const ALPHA_ADMITTED_MEDIA_TYPES = ['application/json'] as const;
export const ALPHA_ADMITTED_CHARSETS = ['utf-8'] as const;
export const ALPHA_ADMITTED_CONTENT_ENCODINGS = ['identity', 'gzip'] as const;
export type AdmittedContentEncoding = (typeof ALPHA_ADMITTED_CONTENT_ENCODINGS)[number];

export const SNAPSHOT_WIRE_BYTE_CAP = 4 * 1024 * 1024;
export const SNAPSHOT_DECODED_BYTE_CAP = 8 * 1024 * 1024;
export const SNAPSHOT_MAX_COMPRESSION_RATIO = 20;

/**
 * Media type compared CASE-INSENSITIVELY with parameters PARSED, never string-matched.
 * E1's T-2 is the test: `application/JSON` and `application/json ; charset=UTF-8` are
 * both admissible, and a string comparison fails both.
 */
export function mediaTypeIsAdmitted(contentTypeHeader: string): boolean {
  const [rawType, ...params] = contentTypeHeader.split(';');
  const type = rawType.trim().toLowerCase();
  if (!ALPHA_ADMITTED_MEDIA_TYPES.includes(type as (typeof ALPHA_ADMITTED_MEDIA_TYPES)[number])) {
    return false;
  }
  for (const p of params) {
    const [k, v] = p.split('=');
    if (k === undefined || v === undefined) return false;
    if (k.trim().toLowerCase() !== 'charset') continue;
    const charset = v.trim().toLowerCase().replace(/^"|"$/g, '');
    if (!ALPHA_ADMITTED_CHARSETS.includes(charset as (typeof ALPHA_ADMITTED_CHARSETS)[number])) {
      return false;
    }
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE LEADING-BYTE SNIFF — IT EXISTS ONLY TO REFUSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * E1 · §4.3. Content sniffing may never widen an accept. Used in one direction only.
 *
 * "An HTML error page served as application/json with HTTP 200 is the single most
 * common way official data silently becomes wrong", and steps 3, 8 and 10 each catch
 * it independently — the declared type, the shape and the envelope are three
 * different claims and a provider can get any one of them wrong on its own.
 */
/**
 * R2-SEC-C · ONE OFFSET, USED FOR EVERY CHECK.
 *
 * E1's R2 re-review, item C. The original skipped leading whitespace into `i` and then
 * checked the JSON character at `i` — but the gzip and ZIP magic at INDEX 0. Two
 * offsets in one function, and the gap between them was exploitable:
 *
 *     " \x1f\x8b…"   gzip magic behind one space
 *
 * At index 0 that is a space, so the gzip arm did not fire. It fell through to the
 * JSON check, which refused it as BODY_NOT_JSON_SHAPED — AND THAT KEY IS TRANSIENT.
 * A body that should have been refused PERMANENTLY as ENCODING_NOT_ALLOWED was
 * instead refused RETRYABLY, so the fetch would be repeated on a schedule.
 *
 * The misclassification mattered more than the miss: this function only ever refuses,
 * so neither answer admits anything. What differed was the RETRY SEMANTICS, which is
 * item B's territory reached through item C's bug.
 *
 * ── WHAT IS NORMALISED, AND WHAT IS EMPHATICALLY NOT ──────────────────────
 *
 * Only the four JSON-permitted whitespace bytes are skipped, and only to compute an
 * OFFSET. The retained payload is never rewritten, never re-encoded and never trimmed:
 * `decoded` is read, and the bytes stored are the bytes received. Normalising the
 * artefact would break SR-1's content address for no gain.
 *
 * The BOM is still REFUSED rather than skipped, which is the same distinction: a BOM
 * is content, and content that should not be there is a refusal, not something to
 * quietly step over.
 */
export function sniffRefusal(decoded: Uint8Array): SnapshotRefusalKey | null {
  let i = 0;
  while (
    i < decoded.length &&
    (decoded[i] === 0x20 || decoded[i] === 0x09 || decoded[i] === 0x0a || decoded[i] === 0x0d)
  ) {
    i += 1;
  }

  if (i >= decoded.length) return 'BODY_NOT_JSON_SHAPED';

  // Every magic-byte test now reads from the SAME offset the JSON test uses.
  if (decoded[i] === 0x1f && decoded[i + 1] === 0x8b) return 'ENCODING_NOT_ALLOWED'; // gzip within gzip
  if (
    decoded[i] === 0x50 &&
    decoded[i + 1] === 0x4b &&
    decoded[i + 2] === 0x03 &&
    decoded[i + 3] === 0x04
  ) {
    return 'ARCHIVE_NOT_ALLOWED';
  }
  if (decoded[i] === 0xef && decoded[i + 1] === 0xbb && decoded[i + 2] === 0xbf) {
    return 'BODY_NOT_JSON_SHAPED'; // BOM refused, never stripped
  }

  const c = decoded[i];
  if (c !== 0x7b /* { */ && c !== 0x5b /* [ */) return 'BODY_NOT_JSON_SHAPED';
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · THE ADMISSION RECORD
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface SnapshotTransportEvidence {
  /** As received. SNAP-R2-3 — evidence, never identity. */
  readonly contentEncoding: AdmittedContentEncoding;
  /** Octets on the wire, before decode. The decoded length lives on the payload. */
  readonly wireByteLength: number;
}

/**
 * P-4 · a parser upgrade changes meaning without changing bytes, and without the
 * version that change is undetectable after the fact. P-5 · the hash is over the
 * bytes, the meaning is over the parse, and both are recorded and bound.
 */
export interface SnapshotParseRecord {
  readonly parserId: string;
  readonly parserVersion: string;
  readonly parsedAt: string;
}

export interface SnapshotAdmissionRecord {
  readonly captureOutcome: SnapshotCaptureOutcome;
  readonly admissibility: SnapshotAdmissibility;
  /** Present exactly when `admissibility` is REFUSED. */
  readonly refusalKey?: SnapshotRefusalKey;
  readonly refusalClass?: RefusalClass;
  readonly transport: SnapshotTransportEvidence;
  /** Present exactly when `admissibility` is ADMITTED — nothing else parses. */
  readonly parse?: SnapshotParseRecord;
}

/**
 * SNAP-R2-6 · QUARANTINE PRODUCES NO PAYLOAD AND NO ADDRESS.
 *
 * E1 · C-3, and it is the one that collides with retention: provider error bodies
 * frequently echo the request, including our own API key, so the very thing R1's SR-8
 * permits us to retain for audit is a place our own credentials come to rest — in a
 * table nobody thinks of as secret-bearing.
 *
 * The scan runs BEFORE any byte is committed, and a hit writes a metadata-only row.
 * There is no `contentAddress`, because an address is the address OF RETAINED BYTES
 * and there are none — and because an address over bytes we discarded is exactly the
 * unverifiable claim SNAP-R2-3 refuses for the wire digest, with the added hazard
 * that the hash of a body containing a known secret is itself a confirmation oracle.
 *
 * R1's `contentAddress?: SnapshotContentAddress` is already optional, so this needs
 * no new field — only the rule, and a retention class that says which absence it is.
 */
/*
  ── ADAPTATION 2 OF 2 AT PROMOTION ──────────────────────────────────────────

  Same reasoning as the capture-outcome alias. R1 already declares
  `SNAPSHOT_RETENTION_CLASSES` and `assertCollectable()` reads it; re-declaring the
  list here with one extra member would leave TWO retention vocabularies, and the
  one `assertCollectable` consults would be the one WITHOUT the quarantine class.

  So the fifth member is added to the R1 declaration — which is what "gains one
  value" means — and this module re-exports it. `assertCollectable()` therefore sees
  the quarantine class without being touched, and there is exactly one list.
*/
export { SNAPSHOT_RETENTION_CLASSES } from './snapshot';
export type { SnapshotRetentionClass } from './snapshot';

/**
 * A-24, applied to four different absences. "Collected under policy P", "the
 * publisher's terms forbade retention", "a secret was found in the body" and "there is
 * no snapshot" are four distinguishable facts, and collapsing any two of them loses
 * the one a later reader actually needs.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · PUBLISHABILITY — ONE PREDICATE, NOT TWO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SNAP-R2-7. R1's `assertRetrievalIsPublishable()` checked status, address,
 * emptiness and completeness. E1's gate checks all four AND seven more, AND is
 * enforced by the database. Keeping both would leave two publishability predicates
 * that can disagree — and the one in application code is the one that gets edited.
 *
 * So R1's individual checks MOVE INTO the gate as ordered refusal steps, and the
 * predicate becomes a statement about the gate's verdict and nothing else. One
 * predicate, one place, and the database has the last word.
 */
export function retrievalIsPublishable(admission: SnapshotAdmissionRecord): boolean {
  return admission.admissibility === 'ADMITTED';
}

export function assertRetrievalIsPublishable(admission: SnapshotAdmissionRecord): void {
  if (!retrievalIsPublishable(admission)) {
    throw new Error(
      `SNAPSHOT_NOT_ADMITTED: admissibility is ${admission.admissibility}` +
        (admission.refusalKey === undefined ? '' : ` (${admission.refusalKey})`) +
        '. Only an ADMITTED capture may stand behind a published figure, and the database ' +
        'enforces it independently of this check.',
    );
  }
}

/**
 * SNAP-R2-8 · THE RECORD IS INTERNALLY CONSISTENT, OR IT IS REFUSED.
 *
 * Every field pairing that could silently disagree is checked here rather than left
 * to the writer, because the writer is where the disagreement gets introduced.
 */
export function assertAdmissionRecordIsCoherent(
  a: SnapshotAdmissionRecord,
  httpStatus?: number,
): void {
  if (a.admissibility === 'REFUSED') {
    if (a.refusalKey === undefined || a.refusalClass === undefined) {
      throw new Error(
        'SNAP-R2-COH-1: a refusal states its key and its class. An unexplained refusal cannot be ' +
          'classified, and an unclassified refusal cannot be safely retried or safely not retried.',
      );
    }
    if (a.parse !== undefined) {
      throw new Error(
        'SNAP-R2-COH-2: a refused capture was not parsed. P-1 — parse once, after the gate.',
      );
    }

    // R2-SEC-B · and the class it states must be the class the contract derives.
    // Without this the two fields are independent, and SECRET_DETECTED could be
    // recorded TRANSIENT — licensing a retry of a request known to have leaked.
    assertRefusalClassIsLawful(a.refusalKey, a.refusalClass, httpStatus);

    return;
  }
  if (a.refusalKey !== undefined || a.refusalClass !== undefined) {
    throw new Error('SNAP-R2-COH-3: an admitted capture carries no refusal key.');
  }
  if (a.captureOutcome !== 'COMPLETE') {
    throw new Error(
      `SNAP-R2-COH-4: captureOutcome '${a.captureOutcome}' cannot be ADMITTED. TRUNCATED exists ` +
        'because the byte cap aborts mid-stream, and a capped response must never be mistaken for ' +
        'a short dataset.',
    );
  }
  if (a.parse === undefined) {
    throw new Error(
      'SNAP-R2-COH-5: an admitted capture records the parser that admitted it. P-4 — without the ' +
        'version, a parser upgrade changes meaning undetectably.',
    );
  }
}
