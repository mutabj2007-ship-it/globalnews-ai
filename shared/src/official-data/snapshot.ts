/**
 * ════════════════════════════════════════════════════════════════════════════
 * OFFICIAL-DATA SNAPSHOT RETENTION — THE SHARED PLATFORM CAPABILITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROMOTED at ALPHA-OFFICIAL-DATA-SNAPSHOT-POSTGRES-R1, from
 * MAIN-OFFICIAL-DATA-SNAPSHOT-RETENTION-R1's `contract/official-data-snapshot.ts.PROPOSED`
 * (sha256 7f0370d9…50277), into the home that proposal itself named. STILL: no provider
 * activated, no route, no deployment.
 *
 * THE ONLY EDIT AT PROMOTION IS THIS PARAGRAPH. Not one type, function, constant or
 * assertion moved — proven by a comment-stripped diff against the proposal, which is
 * empty. P-1 is now answered (Postgres `Bytes`, by Product Owner decision) and P-2 is
 * implemented (`SnapshotPayload`, `SnapshotRetrieval`, `SnapshotPin`, `SnapshotTombstone`),
 * so the two sentences this paragraph replaces had become false. Everything else this
 * module says is still exactly true, including that nothing here is served.
 *
 * THE SUBSTRATE IS STILL INVISIBLE FROM HERE, AND THAT IS THE POINT. This module names no
 * database, and `OfficialDataSnapshotStore` in §8 is the seam that keeps the choice
 * replaceable. Eurostat does not know it is backed by Prisma.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * G measured Eurostat serving THREE DIFFERENT EDITIONS of one dataset inside one
 * fifteen-minute session, with the same two periods carrying different values — a 0.3
 * percentage-point difference on Poland's unemployment rate — with no error and no
 * warning. Eurostat also does not version past data.
 *
 * So: A CITED FIGURE CANNOT BE RE-PROVED FROM THE PUBLISHER. It can only be re-proved
 * from bytes we retained. That makes retention CONTRACTUAL rather than prudential, and
 * this module is the shared capability the Economy lineage contract already assumes.
 *
 * ── THE FIVE THINGS IT IS NOT ─────────────────────────────────────────────
 *
 * 1. NOT a web archive. It retains responses from ALLOWLISTED OFFICIAL-DATA PROVIDERS
 *    reached through the accepted safe-fetch order of operations. There is no path here
 *    for an arbitrary URL, and `assertProviderScoped` refuses one.
 * 2. NOT a parser, and NOT provider semantics. It holds bytes and identity. Which
 *    edition is newer, what a dimension means, how a series is keyed — those belong to
 *    the provider module. THE PLATFORM NEVER ORDERS EDITIONS (see §7).
 * 3. NOT a cache. A cache serves the newest and forgets. This keeps every edition it saw,
 *    because a superseded edition is the evidence behind an already-published figure.
 * 4. NOT a provenance model. `SourceProvenance` answers who published it and in what role
 *    and is composed unchanged elsewhere. This answers WHICH BYTES, and nothing else.
 * 5. NOT public. Nothing here is served. `SNAPSHOT_EXPOSURE` is a constant, not a config.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · CONTENT ADDRESS — IDENTITY IS THE BYTES
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lowercase hex SHA-256 of the exact bytes as received, BEFORE any parsing,
 * decompression-at-the-application-layer, re-encoding or normalisation.
 *
 * Branded so a caller cannot pass an arbitrary string where an address is required.
 */
export type SnapshotContentAddress = string & { readonly __brand: 'SnapshotContentAddress' };

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function snapshotContentAddress(sha256Hex: string): SnapshotContentAddress {
  if (!SHA256_HEX.test(sha256Hex)) {
    throw new Error(
      'SNAPSHOT_ADDRESS_INVALID: expected 64 lowercase hex characters of SHA-256 over the raw bytes.',
    );
  }
  return sha256Hex as SnapshotContentAddress;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · COMPLETENESS — A PARTIAL RESPONSE IS NOT EVIDENCE
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SNAPSHOT_COMPLETENESS_STATES = [
  /** The whole body arrived, within the byte cap and the time budget. */
  'COMPLETE',
  /** The stream was aborted at the cap, or ended short of a declared length. */
  'TRUNCATED',
  /** The transport failed. Retained only so the failure itself is evidenced. */
  'FAILED',
] as const;

export type SnapshotCompleteness = (typeof SNAPSHOT_COMPLETENESS_STATES)[number];

/** Only COMPLETE may stand behind a published observation. Stated once, enforced in §8. */
export const SNAPSHOT_PUBLISHABLE_COMPLETENESS: SnapshotCompleteness = 'COMPLETE';

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · UPSTREAM REQUEST IDENTITY — WHAT WE ASKED FOR, WITHOUT SECRETS
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface OfficialDataRequestParameter {
  readonly key: string;
  readonly value: string;
}

/**
 * WHAT WAS ASKED, as structure rather than as a URL.
 *
 * A URL is not kept as the identity for the same reason it is not a series identity: it
 * invites parsing, and a parameter carried in a query string is not a field anyone agreed
 * to. Parameters are held as pairs so a later reader can see exactly what was pinned.
 */
export interface OfficialDataRequestIdentity {
  /** As the official-source registry names it. Never a hostname. */
  readonly providerId: string;
  /** The provider's own endpoint/dataflow identifier, verbatim. */
  readonly endpointId: string;
  /** Path portion, provider-relative. No scheme, no host, no query. */
  readonly requestPath: string;
  /** Every parameter sent, in the order sent. */
  readonly parameters: readonly OfficialDataRequestParameter[];
  /** ISO-8601. When the request was dispatched. */
  readonly requestedAt: string;
}

/**
 * Parameter names that may never be recorded, because recording them writes a credential
 * into evidence storage that outlives every rotation.
 */
const CREDENTIAL_PARAMETER_NAMES = [
  'apikey', 'api_key', 'key', 'token', 'access_token', 'auth', 'authorization',
  'password', 'secret', 'signature', 'sig', 'sessionid', 'session_id',
];

export function assertRequestCarriesNoCredential(request: OfficialDataRequestIdentity): void {
  for (const p of request.parameters) {
    if (CREDENTIAL_PARAMETER_NAMES.includes(p.key.toLowerCase())) {
      throw new Error(
        `SNAPSHOT_REQUEST_CARRIES_CREDENTIAL: parameter '${p.key}' may not be retained. ` +
          `A credential in an immutable evidence record outlives every rotation.`,
      );
    }
  }
  if (request.requestPath.includes('://') || request.requestPath.includes('?')) {
    throw new Error(
      'SNAPSHOT_REQUEST_PATH_IS_A_URL: requestPath is provider-relative; parameters belong in `parameters`.',
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · RIGHTS STATE, FROZEN AT RETRIEVAL
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The rights position IN FORCE WHEN THE BYTES WERE TAKEN, with the instrument it rests
 * on. Frozen deliberately: a publisher may change terms later, and what mattered for this
 * retrieval is what was true at the time.
 */
export interface SnapshotRightsState {
  /** The lane's rights grade for this provider at retrieval time, e.g. 'E-5'. */
  readonly grade: string;
  /** The citable instrument the grade rests on — a URL or a recorded document reference. */
  readonly instrumentRef: string;
  /**
   * Whether the publisher's terms permit us to RETAIN the bytes.
   * `false` is legitimate and has consequences — see §9.
   */
  readonly payloadRetentionPermitted: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · THE RETRIEVAL RECORD — ONE FETCH, ONE ROW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE CENTRAL DISTINCTION IN THIS MODULE:
 *
 *   a PAYLOAD is addressed by its bytes           — identical bytes are ONE payload
 *   a RETRIEVAL is one act of fetching            — every fetch is its OWN row
 *
 * Fetch the same unchanged dataset twice and you get one payload and two retrievals.
 * Fetch it after the publisher changed it and you get a SECOND payload and a third
 * retrieval. That is how "duplicates deduplicate safely" and "changed payloads create a
 * new snapshot" are the same rule seen from two sides — and it is why the stale-edition
 * anomaly is representable rather than destructive: the older edition is a payload we
 * still hold.
 */
export interface OfficialDataRetrieval {
  /** Caller-supplied, unique per fetch. */
  readonly retrievalId: string;
  readonly request: OfficialDataRequestIdentity;
  /** ISO-8601. When the response completed or failed. */
  readonly retrievedAt: string;
  readonly httpStatus: number;
  /** The media type the publisher returned, parsed from the header. Never inferred. */
  readonly mediaType: string;
  readonly byteLength: number;
  /** Absent only when `completeness` is 'FAILED' and no bytes arrived at all. */
  readonly contentAddress?: SnapshotContentAddress;
  readonly completeness: SnapshotCompleteness;
  readonly rights: SnapshotRightsState;
  /**
   * The publisher's own edition/version annotations, VERBATIM AND OPAQUE.
   *
   * For Eurostat this is where `UPDATE_DATA`, `OBS_COUNT`, `OBS_PERIOD_OVERALL_LATEST`
   * and `DOI` live. The platform stores them and NEVER interprets them: which edition is
   * newer is provider semantics, and G owns those (§7).
   */
  readonly editionAnnotations: Readonly<Record<string, string>>;
  /** Publisher release timestamp, where the publisher supplies one. Absent, never guessed. */
  readonly publisherReleasedAt?: string;
  /** Publisher last-changed timestamp, where supplied. Absent, never guessed. */
  readonly publisherChangedAt?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · THE SEALED PAYLOAD — "NO PARSER CAN CLAIM A HASH IT DID NOT RECEIVE"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The requirement is structural, so the mechanism is structural. `RetainedPayload` carries
 * a UNIQUE SYMBOL that is not exported. A parser cannot write an object literal that
 * satisfies the type, cannot spread one into existence, and cannot mint an address for
 * bytes it invented. ONLY A STORE CAN PRODUCE ONE, and a store produces it only by hashing
 * the bytes it actually holds.
 *
 * A cast can still defeat the type system, so §8 adds a runtime check that the bytes hash
 * to the address they claim. Belt and braces, deliberately: the type stops the accident,
 * the assertion stops the shortcut.
 */
declare const SNAPSHOT_SEAL: unique symbol;

export interface RetainedPayload {
  readonly [SNAPSHOT_SEAL]: true;
  readonly contentAddress: SnapshotContentAddress;
  readonly byteLength: number;
  readonly mediaType: string;
  /** The retained bytes, exactly as received. */
  readonly bytes: Uint8Array;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7 · THE INTEGRATION BOUNDARY — THE PLATFORM NEVER ORDERS EDITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G measured two ordering hypotheses and DISCONFIRMED BOTH: query shape does not select
 * the edition, and `OBS_COUNT` is not monotonic — the 2026-08-25 edition carries FEWER
 * observations than the 2026-07-24 one, because Eurostat withdraws cells as well as adding
 * them. A platform rule inferred from either would have discarded legitimate data.
 *
 * The lesson is not "use UPDATE_DATA". It is that EDITION ORDER IS PROVIDER KNOWLEDGE,
 * measured per provider and revised when measurement says so. The platform therefore
 * declares the comparator's SHAPE and refuses to supply one.
 */
export type EditionOrder = 'ADVANCED' | 'SAME' | 'BEHIND' | 'AMBIGUOUS';

/**
 * Supplied BY A PROVIDER MODULE. The platform calls it and never substitutes a default.
 * `AMBIGUOUS` is a required outcome, not a failure: two annotation sets that cannot be
 * ordered must say so rather than be silently accepted in arrival order.
 */
export type EditionComparator = (
  incoming: Readonly<Record<string, string>>,
  seen: Readonly<Record<string, string>>,
) => EditionOrder;

/**
 * FIRST-SEEN-WINS ON ORDERING. Once an edition has been seen, a response BEHIND it is a
 * stale read: retained as evidence, never allowed to supply values.
 *
 * This deliberately refuses the shape "retry until a preferred number appears".
 */
export function retrievalMaySupplyValues(order: EditionOrder): boolean {
  return order === 'ADVANCED' || order === 'SAME';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 · THE STORE PORT AND ITS GUARANTEES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Substrate-independent ON PURPOSE. Postgres `Bytes`, a mounted volume and an object store
 * all satisfy it, and none of the guarantees below depends on which is chosen.
 */
export interface OfficialDataSnapshotStore {
  /**
   * Hash the bytes, write the payload if its address is new, and record the retrieval.
   *
   * THE STORE COMPUTES THE ADDRESS. A caller may not supply one — that is the other half
   * of the no-forge property.
   */
  retain(input: {
    readonly retrievalId: string;
    readonly request: OfficialDataRequestIdentity;
    readonly retrievedAt: string;
    readonly httpStatus: number;
    readonly mediaType: string;
    readonly bytes: Uint8Array;
    readonly completeness: SnapshotCompleteness;
    readonly rights: SnapshotRightsState;
    readonly editionAnnotations: Readonly<Record<string, string>>;
    readonly publisherReleasedAt?: string;
    readonly publisherChangedAt?: string;
  }): Promise<OfficialDataRetrieval>;

  /** Re-open retained bytes. `null` when the payload was never retained or was collected. */
  open(address: SnapshotContentAddress): Promise<RetainedPayload | null>;

  /** Mark a payload as evidence behind a published figure. A pinned payload is never collected. */
  pin(address: SnapshotContentAddress, reason: SnapshotPinReason): Promise<void>;

  isPinned(address: SnapshotContentAddress): Promise<boolean>;

  /** Every retrieval that produced these bytes, oldest first. */
  retrievalsFor(address: SnapshotContentAddress): Promise<readonly OfficialDataRetrieval[]>;
}

export interface SnapshotPinReason {
  /** What cites it — an observation lineage key, never free text. */
  readonly citedBy: string;
  readonly pinnedAt: string;
}

/**
 * NOTHING HERE IS SERVED. A constant rather than configuration, so making it public is a
 * code change under review rather than an environment variable someone flips.
 */
export const SNAPSHOT_EXPOSURE = 'INTERNAL_ONLY' as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * 9 · THE ASSERTIONS — REFUSALS, NOT WARNINGS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The runtime half of the no-forge property. `computeSha256Hex` is injected so this module
 * stays dependency-free and testable; the store passes its own hasher.
 */
export function assertPayloadMatchesItsAddress(
  payload: RetainedPayload,
  computeSha256Hex: (bytes: Uint8Array) => string,
): void {
  const actual = computeSha256Hex(payload.bytes);
  if (actual !== (payload.contentAddress as string)) {
    throw new Error(
      `SNAPSHOT_ADDRESS_MISMATCH: payload hashes to ${actual} and claims ${payload.contentAddress}.`,
    );
  }
  if (payload.bytes.byteLength !== payload.byteLength) {
    throw new Error('SNAPSHOT_LENGTH_MISMATCH: retained bytes do not match the recorded length.');
  }
}

/** A retrieval is provider-scoped or it does not belong in this store. */
export function assertProviderScoped(
  retrieval: OfficialDataRetrieval,
  allowlistedProviderIds: readonly string[],
): void {
  if (!allowlistedProviderIds.includes(retrieval.request.providerId)) {
    throw new Error(
      `SNAPSHOT_PROVIDER_NOT_ALLOWLISTED: '${retrieval.request.providerId}'. ` +
        `This store is for allowlisted official-data providers, not arbitrary retrieval.`,
    );
  }
}

/**
 * What a retrieval must satisfy before anything derived from it may be published.
 *
 * `payloadRetentionPermitted === false` is NOT an error here — it is a permitted and
 * sometimes required state. But it means the figure cannot be re-proved from our own
 * bytes, and combined with a publisher that does not version, it means the figure cannot
 * be re-proved AT ALL. That consequence is surfaced, never swallowed.
 */
export function assertRetrievalIsPublishable(retrieval: OfficialDataRetrieval): void {
  if (retrieval.completeness !== SNAPSHOT_PUBLISHABLE_COMPLETENESS) {
    throw new Error(
      `SNAPSHOT_NOT_COMPLETE: completeness is '${retrieval.completeness}'. ` +
        `A partial or failed response is not evidence.`,
    );
  }
  if (retrieval.httpStatus < 200 || retrieval.httpStatus >= 300) {
    throw new Error(`SNAPSHOT_NON_SUCCESS_STATUS: ${retrieval.httpStatus}.`);
  }
  if (retrieval.contentAddress === undefined) {
    throw new Error('SNAPSHOT_NO_CONTENT_ADDRESS: nothing was retained to prove this figure.');
  }
  if (retrieval.byteLength <= 0) {
    throw new Error('SNAPSHOT_EMPTY_BODY.');
  }
  assertRequestCarriesNoCredential(retrieval.request);
}

/** True when a cited figure can be re-proved from bytes we hold. */
export function retrievalIsReproducible(retrieval: OfficialDataRetrieval): boolean {
  return (
    retrieval.completeness === 'COMPLETE' &&
    retrieval.contentAddress !== undefined &&
    retrieval.rights.payloadRetentionPermitted
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10 · THE PARSE GATE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A parser receives the SEALED payload and the retrieval together, and gets the address
 * from the payload rather than being asked for one. It cannot parse bytes that were never
 * retained, and it cannot attribute its output to a snapshot it did not read.
 */
export function parseRetained<T>(
  payload: RetainedPayload,
  retrieval: OfficialDataRetrieval,
  parse: (bytes: Uint8Array, address: SnapshotContentAddress) => T,
): T {
  if (retrieval.contentAddress === undefined) {
    throw new Error('SNAPSHOT_PARSE_WITHOUT_ADDRESS: this retrieval retained nothing.');
  }
  if (payload.contentAddress !== retrieval.contentAddress) {
    throw new Error(
      'SNAPSHOT_PARSE_MISMATCH: the payload offered is not the payload this retrieval produced.',
    );
  }
  if (payload.mediaType !== retrieval.mediaType) {
    throw new Error('SNAPSHOT_MEDIA_TYPE_MISMATCH.');
  }
  return parse(payload.bytes, payload.contentAddress);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 11 · RETENTION CLASS — EVIDENCE IS NOT CACHE
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SNAPSHOT_RETENTION_CLASSES = [
  /** Cited by a published figure. NEVER collected, on any policy, at any age. */
  'PINNED',
  /** Retained, not yet cited. Eligible for collection once older than the declared window. */
  'RETAINED',
  /** Collected under policy. The record survives; the bytes do not. */
  'COLLECTED',
  /** Never retained, because the publisher's terms forbid it. */
  'NOT_RETAINED_BY_RIGHTS',
] as const;

export type SnapshotRetentionClass = (typeof SNAPSHOT_RETENTION_CLASSES)[number];

/**
 * A tombstone. COLLECTION REMOVES BYTES, NEVER THE RECORD — so a later reader learns
 * "evidence existed and was collected under policy P on date D", which is a different and
 * far more useful fact than "there is no snapshot".
 */
export interface SnapshotTombstone {
  readonly contentAddress: SnapshotContentAddress;
  readonly byteLength: number;
  readonly mediaType: string;
  readonly collectedAt: string;
  /** The named policy that authorised collection. Never free text. */
  readonly policyId: string;
}

/** Collection is refused for anything a published figure cites. */
export function assertCollectable(
  klass: SnapshotRetentionClass,
  address: SnapshotContentAddress,
): void {
  if (klass === 'PINNED') {
    throw new Error(
      `SNAPSHOT_PINNED_NOT_COLLECTABLE: ${address} is evidence behind a published figure.`,
    );
  }
}
