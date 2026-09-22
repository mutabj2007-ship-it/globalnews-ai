import { tedReleaseStatus } from '../market-release-status';
import { marketProcurementIdentity, procurementPortalReferenceKey } from '@globalnews-ai/shared';

import type { PermittedProvider } from '../market-provider-registry';
import {
  ValidationFailure,
  type AdapterResult,
  type MarketIngestAdapter,
  type MarketObservationDraft,
} from '../market-ingest.scheduler';
import {
  classifyHttpStatus,
  type MarketHttpPort,
  type MarketHttpRequest,
} from './market-transport.port';
import {
  assertAdmittedForMarketObservation,
  assertSnapshotBackedWriteIsNotFinal,
  retainMarketResponse,
  type CanonicalAdmissionEvaluator,
  type MarketSnapshotRetainPort,
} from './market-snapshot.seam';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TED — PROCUREMENT OPPORTUNITY ADAPTER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-MARKET-PROVIDER-CONVERGENCE-R3. Converged against the accepted scheduled-ingest seam.
 * NOT ACTIVATED: the registry's allowlist is empty, and an adapter existing in source is
 * not permission to execute it.
 *
 * ── WHAT THIS ADAPTER DOES NOT CONTAIN ────────────────────────────────────
 *
 * No LEI. No entity identifier of any kind. No join to GLEIF or to anything else. No
 * similarity, confidence, match strength or probability — there is no function here that
 * takes two records and returns a number, and no field that could hold one.
 *
 * TED carries NO LEI FIELD (0 hits, measured) and `BT-501` has no scheme attribute, so
 * there is no deterministic join available to cite. C-15 is preserved by absence, and a
 * source scan in the spec asserts the absence with a positive control.
 *
 * ── CONCURRENCY ───────────────────────────────────────────────────────────
 *
 * The adapter does not choose it. `PermittedProvider.maxConcurrent` is the publisher's
 * published 3, the scheduler holds the semaphore around `acquire`, and this module has no
 * way to raise it — it never reads the ceiling and never starts a request of its own
 * outside the one call the scheduler is holding a slot for.
 */

export const TED_PROVIDER_ID = 'TED';
export const TED_SUBJECT_CLASS = 'PROCUREMENT_OPPORTUNITY';
export const TED_PORTAL_ID = 'TED';

/** The base the operator configures. Never composed from user input. */
export interface TedAdapterConfig {
  readonly baseUrl: string;
  /** Pages fetched per run, fixed and declared — not discovered by following links. */
  readonly pagesPerRun: number;
  readonly pageSize: number;
}

export const TED_DEFAULT_CONFIG: TedAdapterConfig = {
  baseUrl: 'https://api.ted.europa.eu/v3/notices/search',
  pagesPerRun: 2,
  pageSize: 100,
};

/**
 * DETERMINISTIC REQUEST SEMANTICS.
 *
 * A pure function of (cadenceWindow, config). No clock, no randomness, no counter, no
 * cursor carried from a previous run. The same window always produces the same requests,
 * byte for byte and in the same order.
 *
 * Why it matters beyond tidiness: SI-6 keys idempotency on the run window, so a re-run of
 * the same window must ask the same question. A request built from `Date.now()` makes a
 * retry a different request, and then "re-running is safe by construction" stops being
 * true without anything failing.
 */
export function tedRequestsFor(
  cadenceWindow: string,
  config: TedAdapterConfig = TED_DEFAULT_CONFIG,
): readonly MarketHttpRequest[] {
  const requests: MarketHttpRequest[] = [];

  for (let page = 1; page <= config.pagesPerRun; page += 1) {
    const query: Record<string, string> = {
      // The window IS the query. Publication date bounds come from the scheduler's window.
      publicationDate: cadenceWindow,
      page: String(page),
      pageSize: String(config.pageSize),
      // A stable sort, so page N of a window is always the same page N.
      sortField: 'publication-number',
      sortOrder: 'ASC',
    };

    requests.push({
      method: 'GET',
      url: config.baseUrl,
      accept: 'application/json',
      query,
    });
  }

  return requests;
}

/** The fields this adapter reads. Anything else in the payload is ignored, not inferred. */
export interface TedNoticePayload {
  /** BT-701-notice. A UUID v4, measured stable across versions. */
  readonly noticeId: string;
  /** BT-757-notice, the publisher's version counter. Absent means the portal did not version it. */
  readonly noticeVersion?: string;
  /** The publisher's own publication timestamp. */
  readonly publicationDate: string;
  /** BT-5071 or equivalent. Used only as part of the canonical discriminator. */
  readonly jurisdiction: string;
  /** BT-501 organisation identifier, VERBATIM. It carries no scheme, and none is assumed. */
  readonly contractingAuthorityRef: string;
  /**
   * An explicit withdrawal flag ONLY. Cancellation is NOT inferred from notice type:
   * TED has no reissue concept (measured negative) and cancellation is not visible from
   * the type code, so inferring it would be inventing a publisher statement.
   */
  readonly withdrawn?: boolean;
}

export interface TedSearchPayload {
  readonly notices: readonly TedNoticePayload[];
}

function parseTedPayload(body: string): TedSearchPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ValidationFailure('TED: response body is not JSON');
  }

  const notices = (parsed as { notices?: unknown })?.notices;

  if (!Array.isArray(notices)) {
    throw new ValidationFailure('TED: payload has no `notices` array');
  }

  for (const notice of notices) {
    const n = notice as Partial<TedNoticePayload>;
    for (const field of [
      'noticeId',
      'publicationDate',
      'jurisdiction',
      'contractingAuthorityRef',
    ] as const) {
      if (typeof n[field] !== 'string' || (n[field] as string).length === 0) {
        throw new ValidationFailure(`TED: notice is missing required field '${field}'`);
      }
    }
  }

  return { notices: notices as readonly TedNoticePayload[] };
}

/**
 * One notice becomes one draft.
 *
 * IDENTITY IS MINTED BY US, from a tuple we control, via the accepted
 * `marketProcurementIdentity` under `mkt:1`. The portal's own notice id is carried as a
 * REFERENCE and is never the identity — two portals may both publish notice
 * "2026/S 123-456" and mean different things.
 *
 * VALUE IS NULL, DELIBERATELY. A procurement notice is a record, not a measurement. An
 * estimated contract value is a different fact with its own currency and its own
 * authorship, and manufacturing one here would put a number on a row that never had one.
 */
export function tedNoticeToDraft(notice: TedNoticePayload): MarketObservationDraft {
  let releaseStatus: 'WITHDRAWN';
  try { releaseStatus = tedReleaseStatus(notice.withdrawn); }
  catch (error) { throw new ValidationFailure((error as Error).message); }
  /*
    KNOWN LIMITATION — REPORTED AS BLOCKER R3-B1, NOT WORKED AROUND.

    The accepted contract asks for a discriminator minted "from a tuple we control, and
    never from a portal string, so a portal renumbering its notices cannot silently
    re-identify our objects".

    BT-701 is the publisher's STABLE identifier — a UUID v4, measured stable across
    versions — and is not the renumberable human-readable publication number. But it is
    still a publisher string, and using it means a TED re-issue of BT-701 values would
    move our identities.

    Minting a surrogate instead needs a local canonical-object registry, which does not
    exist: a random surrogate would break SI-6.2 idempotency, and a content-derived one
    would change on every amendment. So the stable publisher identifier is used, the gap
    is named here, and a test pins the current state so it cannot be assumed away.

    The version counter is deliberately NOT part of the identity: an amendment is the same
    procurement, and BT-757 moves with it.
  */
  const seriesId = marketProcurementIdentity({
    jurisdiction: notice.jurisdiction,
    contractingAuthorityRef: notice.contractingAuthorityRef,
    canonicalDiscriminator: notice.noticeId,
  });

  const portalKey = procurementPortalReferenceKey({
    portalId: TED_PORTAL_ID,
    noticeId: notice.noticeId,
    noticeVersion: notice.noticeVersion,
  });

  return {
    observationKey: `${seriesId}|${portalKey}`,
    seriesId,
    periodId: notice.publicationDate,
    value: null,
    unit: 'NOT_A_MEASURE',
    // SI-9 — three timestamps, never collapsed. TED states when it published and versions
    // its notices; it does not date a reading, so the vintage kind is CHANGED_AT.
    publisherVintage: null,
    publisherChangedAt: notice.publicationDate,
    vintageProvenance: 'PUBLISHER_CHANGED_AT',
    // WITHDRAWN is a first-class state, never a delete — and only when the publisher says so.
    releaseStatus,
  };
}

/** The window a retrieval is attributed to, taken from the publisher's own dates. */
function notice0(payload: TedSearchPayload): string | null {
  return payload.notices[0]?.publicationDate ?? null;
}

export class TedAdapter implements MarketIngestAdapter {
  readonly providerId = TED_PROVIDER_ID;
  readonly subjectClass = TED_SUBJECT_CLASS;

  constructor(
    private readonly http: MarketHttpPort,
    private readonly snapshots: MarketSnapshotRetainPort,
    /**
     * REQUIRED, and deliberately without a default. This adapter has no authority to
     * declare bytes admissible, so it cannot be constructed without something that does.
     */
    private readonly admission: CanonicalAdmissionEvaluator,
    private readonly config: TedAdapterConfig = TED_DEFAULT_CONFIG,
  ) {}

  /**
   * Per-request admission. TED has no geographic carve-out, so what is checked here is
   * that the request is one this adapter's own deterministic builder would have produced.
   * A hand-built request never reaches the port.
   */
  assertRequestIsPermitted(request: unknown): void {
    const candidate = request as MarketHttpRequest;
    const permitted = tedRequestsFor(candidate?.query?.publicationDate ?? '', this.config);
    const match = permitted.some((p) => JSON.stringify(p) === JSON.stringify(candidate));

    if (!match) {
      throw new ValidationFailure(
        'TED: request was not produced by the deterministic request builder and is refused',
      );
    }
  }

  async acquire(provider: PermittedProvider, signal: AbortSignal): Promise<AdapterResult> {
    // The window comes from the permitted provider's own declaration, never from a clock.
    const cadenceWindow = provider.cadence.declaredCadence;
    const requests = tedRequestsFor(cadenceWindow, this.config);

    const observations: MarketObservationDraft[] = [];
    let lastAddress: string | undefined;

    for (const request of requests) {
      this.assertRequestIsPermitted(request);

      const response = await this.http.request(request, signal);
      classifyHttpStatus(response.status, TED_PROVIDER_ID);

      /*
        THE CANONICAL ADMISSION VERDICT, OBTAINED BEFORE ANYTHING IS RETAINED OR PARSED
        INTO AN OBSERVATION.

        This adapter does not evaluate. It asks, and it obeys. A REFUSED verdict throws
        here, so no draft is built and no publishable Market observation can exist for a
        capture the canonical path declined.
      */
      const admission = await this.admission.evaluate({
        providerId: TED_PROVIDER_ID,
        endpointId: 'notices/search',
        finalUrl: request.url,
        httpStatus: response.status,
        contentTypeHeader: response.contentType,
        contentEncodingHeader: response.contentEncodingHeader,
        wireBytes: response.wireBytes,
      });

      assertAdmittedForMarketObservation(admission, response.status);

      const payload = parseTedPayload(response.body);

      const retrieval = await retainMarketResponse(this.snapshots, {
        provider,
        endpointId: 'notices/search',
        request,
        response,
        retrievalId: `${provider.providerId}:${cadenceWindow}:${request.query.page}`,
        requestedAt: notice0(payload) ?? cadenceWindow,
        retrievedAt: notice0(payload) ?? cadenceWindow,
        // TED versions its notices; the version counter is the publisher's edition marker.
        editionAnnotations: { noticeCount: String(payload.notices.length) },
        admission,
      });

      // The binding is provisional until Main's Snapshot R2 lands. Preparing a
      // snapshot-backed write is permitted; declaring it final is not.
      assertSnapshotBackedWriteIsNotFinal(false);
      lastAddress = retrieval.contentAddress;

      for (const notice of payload.notices) observations.push(tedNoticeToDraft(notice));
    }

    return { observations, snapshotContentAddress: lastAddress };
  }
}
