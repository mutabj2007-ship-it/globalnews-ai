import type { PermittedProvider } from '../market-provider-registry';
import {
  ValidationFailure,
  type AdapterResult,
  type MarketIngestAdapter,
  type MarketObservationDraft,
} from '../market-ingest.scheduler';
import { assertComextRequestIsPermitted, type ComextRequest } from '../eurostat-comext-carveouts';
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
 * EUROSTAT MARKET SERIES — CORRIDOR (COMEXT) ADAPTER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-MARKET-PROVIDER-CONVERGENCE-R3. NOT ACTIVATED.
 *
 * ── THE CARVE-OUTS ARE NOT RE-IMPLEMENTED HERE ────────────────────────────
 *
 * This adapter IMPORTS `assertComextRequestIsPermitted` from the accepted carve-out module
 * and calls it. It declares no exclusion list of its own, holds no country codes and knows
 * nothing about Switzerland, Liechtenstein or Austria.
 *
 * That is deliberate and it is the thing the integration test proves: `carveOutEnforcement`
 * is exposed as a property so a test can assert **referential identity** with the accepted
 * function — `toBe`, not `toEqual`. A second copy of the rule that agreed with the first
 * today would be free to drift tomorrow, and the drift would be invisible, because both
 * copies would still pass their own tests.
 *
 * The semantics are consumed exactly as accepted: exclusions key on `reporter`, never on
 * `partner`; Switzerland and Liechtenstein are excluded as DECLARING countries at every
 * product level; Austria is excluded at CN8 only, so shorter CN levels remain permitted.
 * Nothing here rewrites any of that.
 */

export const EUROSTAT_PROVIDER_ID = 'EUROSTAT';
export const EUROSTAT_CORRIDOR_SUBJECT_CLASS = 'CORRIDOR';

export interface EurostatComextSeriesSpec {
  readonly datasetCode: string;
  readonly request: ComextRequest;
}

export interface EurostatAdapterConfig {
  readonly baseUrl: string;
  /** The approved Market series this adapter is configured to acquire. Nothing discovers more. */
  readonly series: readonly EurostatComextSeriesSpec[];
}

/**
 * DETERMINISTIC REQUEST SEMANTICS — a pure function of the series spec.
 *
 * The pinned dimension tuple IS the query. Every dimension the dataset declares is pinned,
 * because an omitted dimension is a rejection rather than a wildcard.
 */
export function comextHttpRequest(
  spec: EurostatComextSeriesSpec,
  baseUrl: string,
): MarketHttpRequest {
  const r = spec.request;

  return {
    method: 'GET',
    url: `${baseUrl}/${spec.datasetCode}`,
    accept: 'application/json',
    query: {
      format: 'JSON',
      lang: 'EN',
      freq: r.freq,
      reporter: r.reporter,
      partner: r.partner,
      product: r.product,
      flow: r.flow,
      indicators: r.indicators,
    },
  };
}

/** The JSON-stat fields this adapter reads. */
export interface EurostatJsonStatPayload {
  readonly extension?: { readonly annotation?: readonly { type?: string; title?: string }[] };
  readonly dimension?: {
    readonly time?: { readonly category?: { readonly index?: Record<string, number> } };
  };
  readonly value?: Record<string, number>;
}

function annotation(payload: EurostatJsonStatPayload, type: string): string | null {
  const found = payload.extension?.annotation?.find((a) => a.type === type);
  return typeof found?.title === 'string' ? found.title : null;
}

function parseEurostatPayload(body: string): EurostatJsonStatPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ValidationFailure('EUROSTAT: response body is not JSON');
  }

  const payload = parsed as EurostatJsonStatPayload;

  if (payload?.dimension?.time?.category?.index === undefined) {
    throw new ValidationFailure('EUROSTAT: payload declares no time dimension');
  }

  /*
    SI-11 and the accepted Eurostat rule: an empty `value` object is a FAILURE, not an
    empty result. A retired dataset code returns HTTP 200 with `value: {}` and never
    errors, so a tolerant parser records "no data for this series" when the truth is
    "this series is gone".
  */
  if (payload.value === undefined) {
    throw new ValidationFailure('EUROSTAT: payload has no `value` object at all');
  }

  return payload;
}

/**
 * The edition fingerprint IS the provider's own freshness statement.
 *
 * SCHEDULER SUCCESS IS NOT FRESH MARKET EVIDENCE. A run that completes at 04:00 says
 * nothing about when Eurostat last changed the data; `UPDATE_DATA` says that, and it is
 * the only thing this adapter will put in a vintage field.
 */
export function eurostatDraftsFor(
  payload: EurostatJsonStatPayload,
  seriesId: string,
): readonly MarketObservationDraft[] {
  const updateData = annotation(payload, 'UPDATE_DATA');
  const index = payload.dimension?.time?.category?.index ?? {};
  const periods = Object.keys(index).sort((a, b) => (index[a] ?? 0) - (index[b] ?? 0));
  const values = payload.value ?? {};
  const drafts: MarketObservationDraft[] = [];

  for (const periodId of periods) {
    const raw = values[String(index[periodId])];
    // An absent cell is a GAP, never a zero. It is carried with a null value, not dropped,
    // so a hole in a series stays visible instead of closing up.
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;

    drafts.push({
      observationKey: `${seriesId}|${periodId}`,
      seriesId,
      periodId,
      value,
      unit: 'PUBLISHER_STATED',
      publisherVintage: null,
      publisherChangedAt: updateData,
      vintageProvenance: 'PUBLISHER_CHANGED_AT',
      releaseStatus: 'FINAL',
    });
  }

  return drafts;
}

export class EurostatMarketAdapter implements MarketIngestAdapter {
  readonly providerId = EUROSTAT_PROVIDER_ID;
  readonly subjectClass = EUROSTAT_CORRIDOR_SUBJECT_CLASS;

  /**
   * THE ACCEPTED ENFORCEMENT FUNCTION ITSELF, not a copy and not a wrapper.
   * The integration test asserts referential identity against the module's export.
   */
  readonly carveOutEnforcement = assertComextRequestIsPermitted;

  constructor(
    private readonly http: MarketHttpPort,
    private readonly snapshots: MarketSnapshotRetainPort,
    /**
     * REQUIRED, and deliberately without a default. This adapter has no authority to
     * declare bytes admissible, so it cannot be constructed without something that does.
     */
    private readonly admission: CanonicalAdmissionEvaluator,
    private readonly config: EurostatAdapterConfig,
  ) {}

  /** Per-request rights. The scheduler treats a throw here as RIGHTS_REFUSED and never retries it. */
  assertRequestIsPermitted(request: unknown): void {
    this.carveOutEnforcement(request as ComextRequest);
  }

  async acquire(provider: PermittedProvider, signal: AbortSignal): Promise<AdapterResult> {
    const observations: MarketObservationDraft[] = [];
    let lastAddress: string | undefined;

    for (const spec of this.config.series) {
      /*
        THE CARVE-OUT IS CHECKED BEFORE THE PORT IS TOUCHED.

        Not after the response, not while normalising — before. A refused series must not
        produce a request, because the refusal is about whether we may hold the data at
        all, and a fetch we then discard has already held it.
      */
      this.assertRequestIsPermitted(spec.request);

      const httpRequest = comextHttpRequest(spec, this.config.baseUrl);
      const response = await this.http.request(httpRequest, signal);
      classifyHttpStatus(response.status, EUROSTAT_PROVIDER_ID);

      // Canonical admission first. A refusal ends the run here, before a single
      // observation is normalised — a refused capture must produce nothing publishable.
      const admission = await this.admission.evaluate({
        providerId: EUROSTAT_PROVIDER_ID,
        endpointId: spec.datasetCode,
        finalUrl: httpRequest.url,
        httpStatus: response.status,
        contentTypeHeader: response.contentType,
        contentEncodingHeader: response.contentEncodingHeader,
        wireBytes: response.wireBytes,
      });

      assertAdmittedForMarketObservation(admission, response.status);

      const payload = parseEurostatPayload(response.body);

      /*
        The publisher's edition annotations are stored VERBATIM AND OPAQUE. For Eurostat
        this is where UPDATE_DATA, OBS_COUNT, OBS_PERIOD_OVERALL_LATEST and DOI live, and
        which edition is newer is provider semantics that the platform never interprets.
      */
      const editionAnnotations: Record<string, string> = {};
      for (const a of payload.extension?.annotation ?? []) {
        if (typeof a.type === 'string' && typeof a.title === 'string') {
          editionAnnotations[a.type] = a.title;
        }
      }

      const updateData = annotation(payload, 'UPDATE_DATA') ?? '';

      const retrieval = await retainMarketResponse(this.snapshots, {
        provider,
        endpointId: spec.datasetCode,
        request: httpRequest,
        response,
        retrievalId: `${provider.providerId}:${comextSeriesId(spec)}`,
        requestedAt: updateData,
        retrievedAt: updateData,
        editionAnnotations,
        admission,
      });

      /*
        Eurostat's own rights record states that snapshot retention is MANDATORY, because
        Eurostat does not version past data and a cited figure cannot be re-proved from the
        publisher. The retention happens here; declaring the resulting write final does not,
        and cannot, while Main's Snapshot R2 is pending.
      */
      assertSnapshotBackedWriteIsNotFinal(false);
      lastAddress = retrieval.contentAddress;

      const seriesId = comextSeriesId(spec);
      observations.push(...eurostatDraftsFor(payload, seriesId));
    }

    return { observations, snapshotContentAddress: lastAddress };
  }
}

/**
 * The series identity, length-prefixed under `eco:1`.
 *
 * Comext keys on six parts whose `product` values are digit strings of MIXED LENGTH and
 * whose `indicators` values CONTAIN UNDERSCORES — the exact collision shape the accepted
 * encoding exists to fix. A delimiter-joined key would collide silently: nothing throws,
 * one series simply wins.
 */
export function comextSeriesId(spec: EurostatComextSeriesSpec): string {
  const r = spec.request;
  const parts = [spec.datasetCode, r.freq, r.reporter, r.partner, r.product, r.flow, r.indicators];
  return `eco:1:${parts.map((p) => `${p.length}:${p}`).join('')}`;
}
