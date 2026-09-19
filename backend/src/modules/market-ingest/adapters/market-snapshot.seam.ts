import {
  SNAPSHOT_PUBLISHABLE_COMPLETENESS,
  refusalIsSecurityClass,
  refusalMayRetry,
  retrievalIsPublishable,
  type OfficialDataRequestParameter,
  type OfficialDataRetrieval,
  type OfficialDataSnapshotStore,
  type SnapshotAdmissionRecord,
} from '@globalnews-ai/shared';

import { TransportFailure, ValidationFailure } from '../market-ingest.scheduler';

import type { PermittedProvider } from '../market-provider-registry';
import type { MarketHttpRequest, MarketHttpResponse } from './market-transport.port';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SNAPSHOT BINDING — ONE SEAM ONTO THE ACCEPTED SNAPSHOT ARCHITECTURE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-MARKET-PROVIDER-CONVERGENCE-R3.
 *
 * ── A CORRECTION THIS LANE MADE AGAINST ITSELF ────────────────────────────
 *
 * The first draft of this file declared its own `MarketSnapshotPort`, its own retention
 * request shape and its own address format. That was a SECOND SNAPSHOT ARCHITECTURE, and
 * the accepted one already exists: `OfficialDataSnapshotStore` (SR-1 … SR-22) in
 * `@globalnews-ai/shared`, implemented by `PostgresOfficialDataSnapshotStore` over the
 * `SnapshotPayload` / `SnapshotRetrieval` / `SnapshotPin` / `SnapshotTombstone` models.
 *
 * It was found by looking, not by being told, and it is exactly what "no duplicate
 * snapshot architecture" forbids. The draft was discarded.
 *
 * ── WHAT THIS FILE IS NOW ─────────────────────────────────────────────────
 *
 * A BINDING, not a design. It declares no interface of its own:
 *
 *   - `MarketSnapshotRetainPort` is `Pick<OfficialDataSnapshotStore, 'retain'>` — a
 *     PROJECTION of the accepted port, so an adapter can be handed only what it needs
 *     and a test double stays small. It is not a second contract; it cannot drift from
 *     the accepted one because it IS the accepted one, narrowed.
 *   - `retainMarketResponse` builds the accepted `retain` input from a Market HTTP
 *     exchange. That is all it does.
 *   - THE STORE COMPUTES THE ADDRESS. Nothing here mints one, because the accepted
 *     contract makes the caller's inability to supply an address half of its no-forge
 *     property.
 *
 * ── WHAT IS PROVISIONAL, AND WHAT IS NOT ──────────────────────────────────
 *
 * The ARCHITECTURE is accepted and is not provisional. THE BINDING is, because Main's
 * Snapshot Contract R2 is still in flight and may change what a retention means for a
 * published figure. So this lane prepares, validates and tests snapshot-backed writes and
 * refuses to declare one final — `assertSnapshotBackedWriteIsNotFinal` enforces that, and
 * `SNAPSHOT_SEAM_STATUS` is the single constant R2 has to move.
 */

export const SNAPSHOT_SEAM_STATUS = 'PROVISIONAL_PENDING_MAIN_SNAPSHOT_R2' as const;
export type SnapshotSeamStatus = typeof SNAPSHOT_SEAM_STATUS;

/**
 * A projection of the accepted store, NOT a new port. Widening this to the full
 * `OfficialDataSnapshotStore` is a one-word change and needs no adapter to move.
 */
export type MarketSnapshotRetainPort = Pick<OfficialDataSnapshotStore, 'retain'>;

export class SnapshotNotFinal extends Error {}

/**
 * A snapshot-backed write may be PREPARED and TESTED while the binding is provisional; it
 * may not be declared final. Enforced rather than described.
 */
export function assertSnapshotBackedWriteIsNotFinal(claimedFinal: boolean): void {
  if (claimedFinal && SNAPSHOT_SEAM_STATUS === 'PROVISIONAL_PENDING_MAIN_SNAPSHOT_R2') {
    throw new SnapshotNotFinal(
      'a snapshot-backed observation write cannot be declared final while the snapshot binding is ' +
        `${SNAPSHOT_SEAM_STATUS}. Main's Snapshot Contract R2 owns that transition.`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE ADMISSION SEAM — A TYPED HOLE, NOT A CLASSIFIER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Snapshot R2 makes `SnapshotAdmissionRecord` REQUIRED on the canonical
 * `OfficialDataSnapshotStore.retain()` port. A Market adapter therefore cannot retain
 * anything without a verdict — which is correct, and is why this lane does not
 * manufacture one.
 *
 * ── WHY THIS IS AN INTERFACE AND NOT AN IMPLEMENTATION ────────────────────
 *
 * Searched, and reported rather than filled: there is NO canonical callable evaluator
 * anywhere in `shared/src` or `backend/src` that PRODUCES a `SnapshotAdmissionRecord`.
 * The module exports the vocabulary and the predicates that CONSUME a verdict
 * (`retrievalIsPublishable`, `assertAdmissionRecordIsCoherent`, `refusalMayRetry`) and
 * the ingredients a producer would use (`sniffRefusal`, `mediaTypeIsAdmitted`, the
 * caps) — and the only callers of those ingredients in the whole repository are
 * assertions inside the Snapshot store's own spec.
 *
 * Two structural reasons a Market adapter must not compose them into a verdict:
 *
 *   1. `transport.contentEncoding` and `transport.wireByteLength` are properties of
 *      THE OCTETS ON THE WIRE, BEFORE DECODE. An adapter is handed a decoded body and
 *      has never seen them. Any value it supplied would be invented.
 *   2. An ADMITTED record requires `parse { parserId, parserVersion, parsedAt }` — a
 *      claim about WHO parsed the bytes and with WHICH parser version. An adapter
 *      asserting that about itself is the parser vouching for the parser.
 *
 * So the evaluator is declared here as the shape the canonical path must satisfy, and
 * NOTHING IN THIS PACKAGE IMPLEMENTS IT. The absence is structural: a caller that has
 * no canonical evaluator cannot construct an adapter, because the constructor requires
 * one and the type has no default.
 */

/** What the canonical evaluator sees. Named for what a wire-level path actually holds. */
export interface SnapshotAdmissionSubject {
  readonly providerId: string;
  /**
   * WIDENED BY ALPHA-OFFICIAL-DATA-CANONICAL-ADMISSION-R1 — widened, not redesigned.
   *
   * The canonical evaluator resolves the approved parser from the SERVER-OWNED registry,
   * keyed on provider + endpoint + media type, so it cannot reach a binding without
   * knowing which endpoint was asked. The adapter already holds this value — Eurostat's
   * dataset code, TED's `notices/search` — so supplying it invents nothing, which is the
   * test this seam applies to every field on it.
   *
   * REQUIRED rather than optional, deliberately. Optional would mean "resolve the parser
   * without knowing the endpoint", and the only way to do that is a fallback parser —
   * which §3 forbids in the same breath as it requires the registry.
   */
  readonly endpointId: string;
  /**
   * The URL the response ACTUALLY came from, after every redirect.
   *
   * E1 · §4.1 step 1: if the final host is not the configured provider host then the
   * bytes did not come from the approved provider, and "a body that is perfectly
   * well-formed JSON from the wrong host is the most dangerous admissible-looking
   * capture there is". Only something that performed the fetch knows where it ended up.
   */
  readonly finalUrl: string;
  readonly httpStatus: number;
  /** The `Content-Type` header verbatim, unparsed. */
  readonly contentTypeHeader: string;
  /** The `Content-Encoding` header verbatim, unparsed. */
  readonly contentEncodingHeader: string;
  /** Octets on the wire, BEFORE decode. An adapter does not have these. */
  readonly wireBytes: Uint8Array;
}

/**
 * THE MISSING SEAM, TYPED.
 *
 * Implemented by the approved Snapshot/E1 admission path and by nothing here. When that
 * path is exposed, it satisfies this and no adapter changes.
 */
export interface CanonicalAdmissionEvaluator {
  evaluate(subject: SnapshotAdmissionSubject): Promise<SnapshotAdmissionRecord>;
}

/**
 * Translate a canonical REFUSED verdict into the scheduler's own failure vocabulary,
 * using the CANONICAL predicates and no local judgement.
 *
 * ── THE CLAUSE THAT MATTERS MOST ──────────────────────────────────────────
 *
 * A SECURITY refusal must never become retryable merely because Market acquisition
 * happens to retry. `refusalIsSecurityClass` is checked FIRST and wins outright, before
 * `refusalMayRetry` is even consulted — so a security key can never be routed onto the
 * retry path by a transient HTTP status that happens to accompany it.
 *
 * `SECRET_DETECTED` is the worked example: retrying it re-fetches a body that contains
 * our own credential, which is the opposite of what a refusal is for.
 */
export function admissionRefusalToFailure(
  admission: SnapshotAdmissionRecord,
  httpStatus: number,
): Error {
  const key = admission.refusalKey;

  if (key === undefined) {
    return new ValidationFailure(
      'SNAPSHOT_REFUSED with no refusal key: the verdict is incoherent and is not retried',
    );
  }

  if (refusalIsSecurityClass(key)) {
    return new ValidationFailure(
      `SNAPSHOT_REFUSED (${key}): a security-class refusal is TERMINAL and is never retried, ` +
        "whatever the HTTP status or the adapter's retry policy",
    );
  }

  /*
    THE RECORD IS THE AUTHORITY, NOT A RE-DERIVATION.

    `refusalClass` is set by the canonical evaluator, which saw the wire. Recomputing it
    here from the HTTP status we happen to hold would create a SECOND classifier that can
    disagree with the first — and the one in application code is the one that gets edited.
    The snapshot module makes exactly this argument about publishability; it applies to
    the refusal class too.

    Caught by a test: an evaluator recording TRANSIENT for a body-level refusal on an
    HTTP 200 was re-derived here as PERMANENT, and the two verdicts silently disagreed.

    `refusalClassFor` is consulted ONLY when the record carries no class — an absence the
    store's own coherence check does not forbid.
  */
  const declaredClass = admission.refusalClass;
  const mayRetry =
    declaredClass === undefined ? refusalMayRetry(key, httpStatus) : declaredClass === 'TRANSIENT';

  return mayRetry
    ? new TransportFailure(
        `SNAPSHOT_REFUSED (${key}): ${declaredClass ?? 'derived'} — may be retried`,
        httpStatus,
      )
    : new ValidationFailure(
        `SNAPSHOT_REFUSED (${key}): ${declaredClass ?? 'derived'} — not retried`,
      );
}

/**
 * The one place a Market adapter turns a verdict into an outcome.
 *
 * ADMITTED -> the caller may retain and may build observations.
 * REFUSED  -> throws, so NO publishable Market observation is ever produced.
 */
export function assertAdmittedForMarketObservation(
  admission: SnapshotAdmissionRecord,
  httpStatus: number,
): void {
  if (!retrievalIsPublishable(admission)) {
    throw admissionRefusalToFailure(admission, httpStatus);
  }
}

export interface MarketRetentionInput {
  readonly provider: PermittedProvider;
  readonly endpointId: string;
  readonly request: MarketHttpRequest;
  readonly response: MarketHttpResponse;
  readonly retrievalId: string;
  readonly requestedAt: string;
  readonly retrievedAt: string;
  /** Publisher edition annotations, VERBATIM AND OPAQUE. Eurostat's UPDATE_DATA lives here. */
  readonly editionAnnotations: Readonly<Record<string, string>>;
  /**
   * REQUIRED. The canonical verdict, produced by the approved admission path.
   *
   * There is no default and no optional marker: omitting it does not compile, which is
   * the negative control this seam is built around. Snapshot R2 made the field required
   * on `retain()`; this makes it required one layer earlier, where a caller can still
   * be told where to get one.
   */
  readonly admission: SnapshotAdmissionRecord;
}

/**
 * Build the accepted retention input from a Market exchange and hand it to the store.
 *
 * The rights state is taken from the provider's OWN record — the grade and the citable
 * instrument the registry already resolved — so what is frozen with the bytes is the
 * rights position that was true at retrieval time, not whatever the registry says later.
 */
export async function retainMarketResponse(
  port: MarketSnapshotRetainPort,
  input: MarketRetentionInput,
): Promise<OfficialDataRetrieval> {
  const parameters: OfficialDataRequestParameter[] = Object.keys(input.request.query)
    .sort()
    .map((key) => ({ key, value: input.request.query[key] as string }));

  return port.retain({
    retrievalId: input.retrievalId,
    request: {
      providerId: input.provider.providerId,
      endpointId: input.endpointId,
      requestPath: new URL(input.request.url).pathname,
      parameters,
      requestedAt: input.requestedAt,
    },
    retrievedAt: input.retrievedAt,
    httpStatus: input.response.status,
    mediaType: input.response.contentType,
    bytes: new TextEncoder().encode(input.response.body),
    // Only COMPLETE may stand behind a published observation. A truncated or failed body
    // is retained so the failure itself is evidenced, never so a figure can rest on it.
    completeness: SNAPSHOT_PUBLISHABLE_COMPLETENESS,
    // Passed through UNMODIFIED. This function does not read it, does not default it
    // and does not repair it — the store's own `assertAdmissionRecordIsCoherent` is the
    // authority on whether the verdict holds together.
    admission: input.admission,
    rights: {
      grade: input.provider.rights.rightsClass,
      instrumentRef: input.provider.rights.instrument,
      // Eurostat's own record states retention is MANDATORY because it does not version;
      // TED's carries no retention prohibition. Neither forbids holding the bytes.
      payloadRetentionPermitted: true,
    },
    editionAnnotations: input.editionAnnotations,
  });
}
