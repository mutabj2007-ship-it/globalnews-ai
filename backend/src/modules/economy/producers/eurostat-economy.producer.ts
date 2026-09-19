import {
  JsonNumericTokenMalformed,
  classifyJsonNumericToken,
  economyValueOrRefusal,
  type ClassifiedNumericToken,
  resolveParserBinding,
  type EconomyFigureGapReason,
  type EconomyObservation,
  type OfficialDataSnapshotStore,
  type OfficialDataTransport,
  type OfficialDataTransportEvidence,
  type SnapshotAdmissionRecord,
  type SourceProvenance,
} from '@globalnews-ai/shared';

import type { CanonicalOfficialDataAdmissionEvaluator } from '@globalnews-ai/shared';

import {
  assertDimensionsArePinned,
  assertLineageAgreesWithProvenance,
  assertRetrievalIsProvable,
  assertVintageBasisIsHonest,
  economyObservationIsPublishable,
  economyVintageOf,
  type EconomyObservationLineage,
  type EconomyUpstreamSeriesRef,
} from '@globalnews-ai/shared';

import {
  ALPHA_SERIES,
  CLOSED_DATASETS,
  type AlphaSeriesDeclaration,
} from './eurostat-economy.series';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EUROSTAT ECONOMY PRODUCER — ON THE CANONICAL PATH, AND ONLY IT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-ECONOMY-ALPHA-PRODUCER-CONVERGENCE-R2.
 *
 *     provider request -> canonical transport -> canonical admission evaluator
 *       -> retained admitted snapshot -> parser -> Economy observation lineage
 *
 * Every one of those is the ACCEPTED shared component, injected. There is no
 * producer-local admission evaluator, no producer-local snapshot architecture, no
 * hard-coded `ADMITTED`, and no second parser: `resolveParserBinding` is the server-owned
 * table and this module cannot widen what it is allowed to fetch.
 *
 * ── AND IT PUBLISHES NOTHING TODAY ────────────────────────────────────────
 *
 * The lane verdict is HOLD, for a reason this file cannot fix: no admitted bytes exist
 * for any eligible series. The D-2 capture run captured three responses — an
 * unemployment query that returned `value: {}`, the CLOSED HICP predecessor, and a 404
 * control — and egress to the publisher is refused at CONNECT. This producer is
 * therefore complete, tested against the bytes that DO exist, and waiting on a capture.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · ACTIVATION AND RIGHTS
 * ══════════════════════════════════════════════════════════════════════════ */

export const EUROSTAT_PROVIDER_ID = 'EUROSTAT';
export const ECONOMY_PRODUCER_ENABLED = false as const;

/**
 * The rights state carried, not widened. Eurostat's reuse policy is the citable
 * instrument; the grade is the one the rights lane recorded.
 */
export const EUROSTAT_RIGHTS = Object.freeze({
  grade: 'E-5',
  instrumentRef:
    'Commission Decision 2011/833/EU on the reuse of Commission documents, as applied by ' +
    'the Eurostat copyright/licence policy notice. Recorded in G-ECONOMY-RIGHTS-TRANSPORT-R7.',
  payloadRetentionPermitted: true,
});

export class EconomyProducerNotActivated extends Error {}

export function assertProducerActivationPermitted(): never {
  throw new EconomyProducerNotActivated(
    'ECON-PRODUCER-NOT-ACTIVATED: this producer is implemented and disabled. Route activation ' +
      'is governed by the seven E-conditions of the Economy route-activation contract, and ' +
      'E-1 (at least one publishable observation) does not hold.',
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · WHAT THE PRODUCER RETURNS
 * ══════════════════════════════════════════════════════════════════════════ */

/** Why a cell has no figure. A reason is mandatory — an unexplained blank is forbidden. */
export interface EconomyCellGap {
  readonly kind: 'GAP';
  readonly seriesId: string;
  /** The accepted shared gap reason. Never a producer-local word. */
  readonly reason: EconomyFigureGapReason;
  /** The classified detail an operator needs. Never shown as prose to a reader. */
  readonly detail: string;
}

export interface EconomyCellObservation {
  readonly kind: 'OBSERVATION';
  readonly observation: EconomyObservation;
  readonly lineage: EconomyObservationLineage;
  /** Proven by the contract's own predicate, never asserted by this module. */
  readonly publishable: boolean;
}

export type EconomyProducedCell = EconomyCellObservation | EconomyCellGap;

export interface EconomyProducerResult {
  readonly cells: readonly EconomyProducedCell[];
  /** One entry per upstream request actually dispatched. Used to prove no fan-out. */
  readonly requestsDispatched: readonly string[];
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE PORTS — ALL CANONICAL, ALL INJECTED
 * ══════════════════════════════════════════════════════════════════════════ */

export interface EconomyProducerPorts {
  readonly transport: OfficialDataTransport;
  readonly evaluator: CanonicalOfficialDataAdmissionEvaluator;
  /** The narrowed canonical seam. The producer may retain and nothing else. */
  readonly snapshots: Pick<OfficialDataSnapshotStore, 'retain'>;
  readonly now: () => string;
  readonly signal: AbortSignal;
}

const EUROSTAT_BASE_PATH = '/eurostat/api/dissemination/statistics/1.0/data';

function requestQuery(series: AlphaSeriesDeclaration): Readonly<Record<string, string>> {
  const query: Record<string, string> = { format: 'JSON', lang: 'EN' };
  for (const pin of series.dimensions) query[pin.key] = pin.value;
  // Deterministic: no timestamp, no nonce, no client-generated id.
  query['lastTimePeriod'] = '1';
  return Object.freeze(query);
}

function requestUrl(series: AlphaSeriesDeclaration): string {
  const q = requestQuery(series);
  const search = Object.keys(q)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(q[k] as string)}`)
    .join('&');
  return `https://ec.europa.eu${EUROSTAT_BASE_PATH}/${series.datasetCode}?${search}`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · JSON-STAT READING — THE DOMAIN PARSE, AFTER ADMISSION
 * ══════════════════════════════════════════════════════════════════════════ */

interface JsonStatDataset {
  readonly value?: Record<string, unknown>;
  readonly dimension?: Record<string, unknown>;
  readonly id?: readonly string[];
  readonly updated?: string;
  readonly label?: string;
  readonly extension?: Record<string, unknown>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The period labels the publisher itself declared, in its own index order. */
/**
 * A STRING IN THE VALUE SLOT IS TWO DIFFERENT FACTS, AND THEY MUST NOT BE CONFLATED.
 *
 * After the parse-boundary delta, a string reaching this producer is USUALLY a numeral the
 * classifier preserved as characters — `12345678901234567890`, `1e400`. But the strict
 * parser passes ordinary JSON STRINGS through untouched too, so a publisher cell holding
 * `"not a number"` also arrives as a string.
 *
 * `classifyJsonNumericToken` throws `ECON-NUM-1` on a non-literal, and it is right to:
 * Main's rule is that a malformed NUMERIC TOKEN is a caller defect and classifying it
 * would hide which. But an ordinary string in a value slot is not a malformed numeric
 * token at all — it is a publisher cell that is not a number, and there is already a code
 * for exactly that.
 *
 * Landing §1.3's snippet unguarded let that throw escape `produceSeriesCell`, which does
 * not gap one cell — it aborts the whole set, so one odd cell in one series would take the
 * other three rows down with it. Measured by EA-10, not predicted.
 *
 * So: a non-literal string resolves to `null`, which `economyValueOrRefusal` reports as
 * `ECON-VALUE-NOT-NUMERIC` — the honest code. The distinction Main protects is kept, since
 * nothing here classifies a malformed token; it declines to treat a non-numeral as one.
 *
 * REPORTED TO MAIN as an integration finding against §1.3.
 */
function classifyRetainedToken(token: string): ClassifiedNumericToken | null {
  try {
    return classifyJsonNumericToken(token);
  } catch (error) {
    if (error instanceof JsonNumericTokenMalformed) return null;
    throw error;
  }
}

function timePeriods(dataset: JsonStatDataset): readonly string[] {
  const time = dataset.dimension?.['time'];
  if (!isRecord(time)) return [];
  const category = time['category'];
  if (!isRecord(category)) return [];
  const index = category['index'];
  if (!isRecord(index)) return [];
  return Object.keys(index).sort(
    (a, b) => Number(index[a] ?? 0) - Number(index[b] ?? 0),
  );
}

/**
 * The publisher's own update timestamp — the ONLY honest basis for a Eurostat vintage.
 *
 * Eurostat does not version past data: a revision overwrites in place and no prior
 * vintage is retrievable. `UPDATE_DATA` says when the dataset last changed, which is
 * `PUBLISHER_CHANGED_AT` and not `PUBLISHER_VINTAGE`. Claiming the stronger basis would
 * render our ingestion schedule as the publisher's revision history.
 */
/**
 * The publisher's own edition annotations, VERBATIM AND UNINTERPRETED.
 *
 * `UPDATE_DATA`, `OBS_COUNT`, `OBS_PERIOD_OVERALL_LATEST`, `DOI`. The snapshot store
 * records them and never reads them; which edition is newer is provider semantics, and
 * F-1 measured why that matters — Eurostat served three editions of one series within
 * fifteen minutes, with different values for the same periods, and `OBS_COUNT` was NOT
 * monotonic across them. `UPDATE_DATA` is the only ordering key, and it is stored here
 * so a later reader can order editions without re-fetching anything.
 */
function editionAnnotations(dataset: JsonStatDataset): Readonly<Record<string, string>> {
  const extension = dataset.extension;
  if (!isRecord(extension)) return {};
  const annotation = extension['annotation'];
  if (!Array.isArray(annotation)) return {};

  const out: Record<string, string> = {};
  for (const entry of annotation) {
    if (!isRecord(entry)) continue;
    const type = entry['type'];
    const title = entry['title'];
    if (typeof type === 'string' && type !== '' && typeof title === 'string') {
      out[type] = title;
    }
  }
  return Object.freeze(out);
}

function publisherChangedAt(dataset: JsonStatDataset): string | undefined {
  const declared = dataset.updated;
  return typeof declared === 'string' && declared !== '' ? declared : undefined;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · THE PRODUCE PATH
 * ══════════════════════════════════════════════════════════════════════════ */

const gap = (
  seriesId: string,
  reason: EconomyFigureGapReason,
  detail: string,
): EconomyCellGap => ({ kind: 'GAP', seriesId, reason, detail });

/**
 * Produce one cell for one declared series.
 *
 * ONE REQUEST PER SERIES, AT MOST. There is no retry, no second edition probe and no
 * fallback dataset: the reconciliation measured Eurostat serving three different
 * editions of one series within fifteen minutes, and "ask again until a better number
 * arrives" is how that becomes a silent data-selection policy.
 */
export async function produceSeriesCell(
  series: AlphaSeriesDeclaration,
  ports: EconomyProducerPorts,
): Promise<{ readonly cell: EconomyProducedCell; readonly dispatched: readonly string[] }> {
  // A blocked row never reaches the network. The blocker is not a retrieval problem.
  if (series.alphaState === 'BLOCKED') {
    return {
      cell: gap(series.seriesId, 'NO_PRODUCER', series.blockedBy ?? 'ECON-BLOCK-UNSTATED'),
      dispatched: [],
    };
  }

  const closed = CLOSED_DATASETS[series.datasetCode];
  if (closed !== undefined) {
    return {
      cell: gap(series.seriesId, 'DISCONTINUED', `ECON-CLOSED-DATASET: ${closed}`),
      dispatched: [],
    };
  }

  const url = requestUrl(series);
  const requestedAt = ports.now();

  let evidence: OfficialDataTransportEvidence;
  try {
    evidence = await ports.transport.fetch(
      {
        providerId: EUROSTAT_PROVIDER_ID,
        endpointId: series.datasetCode,
        url,
        accept: 'application/json',
        query: requestQuery(series),
      },
      ports.signal,
    );
  } catch (error) {
    return {
      cell: gap(
        series.seriesId,
        'NO_PRODUCER',
        `ECON-TRANSPORT-FAILED: ${error instanceof Error ? error.name : 'unknown'}`,
      ),
      dispatched: [url],
    };
  }

  // THE ONLY ADMISSION AUTHORITY. No local verdict is formed anywhere in this module.
  const outcome = ports.evaluator.evaluate(evidence);
  const admission: SnapshotAdmissionRecord = outcome.admission;

  if (admission.admissibility !== 'ADMITTED' || outcome.retainableBytes === undefined) {
    return {
      cell: gap(
        series.seriesId,
        'NO_PRODUCER',
        `ECON-NOT-ADMITTED: ${admission.refusalKey ?? 'REFUSED'}`,
      ),
      dispatched: [url],
    };
  }

  /*
    The governed parser table decides what may read these bytes — not this module, and
    not the shape of the body. It is resolved BEFORE retention so the publisher's own
    edition annotations can be stored with the capture rather than inferred later.
  */
  const binding = resolveParserBinding(
    EUROSTAT_PROVIDER_ID,
    series.datasetCode,
    evidence.contentTypeHeader,
  );
  if (binding === null) {
    return {
      cell: gap(series.seriesId, 'NO_PRODUCER', 'ECON-NO-AUTHORISED-PARSER'),
      dispatched: [url],
    };
  }

  const parsed = outcome.parsed;
  const envelope = binding.assertEnvelope(parsed);
  if (envelope !== true) {
    return {
      cell: gap(series.seriesId, 'NO_PRODUCER', `ECON-ENVELOPE-REFUSED: ${envelope}`),
      dispatched: [url],
    };
  }

  const dataset = parsed as JsonStatDataset;

  /* The publisher's own change timestamp, read before retention so it can be stored
     with the capture rather than reconstructed from it afterwards. */
  const changedAt = publisherChangedAt(dataset);

  // The admitted capture is retained through the canonical store, with the real verdict.
  const retrieval = await ports.snapshots.retain({
    retrievalId: `eco:${series.datasetCode}:${requestedAt}`,
    request: {
      providerId: EUROSTAT_PROVIDER_ID,
      endpointId: series.datasetCode,
      requestPath: `${EUROSTAT_BASE_PATH}/${series.datasetCode}`,
      parameters: Object.entries(requestQuery(series)).map(([key, value]) => ({ key, value })),
      requestedAt,
    },
    retrievedAt: evidence.retrievedAt,
    httpStatus: evidence.httpStatus,
    mediaType: 'application/json',
    bytes: outcome.retainableBytes,
    completeness: 'COMPLETE',
    rights: EUROSTAT_RIGHTS,
    editionAnnotations: editionAnnotations(dataset),
    /*
      `UPDATE_DATA` IS A CHANGED-AT, AND IT GOES IN THE CHANGED-AT FIELD.

      R2 wrote it into `publisherReleasedAt`, which said the publisher had told us when it
      RELEASED the figure when it had only told us when the dataset last CHANGED. The
      accepted retrieval carries the two separately, so the value goes where it belongs and
      the vintage basis follows on its own — there is no longer a field in which to write
      the wrong answer.
    */
    ...(changedAt === undefined ? {} : { publisherChangedAt: changedAt }),
    admission,
  });

  /*
    A RETENTION THAT PRODUCED NO ADDRESS IS NOT EVIDENCE. The store returns the content
    address only when bytes were actually stored; without one there is nothing for a
    citation to be re-proved against, and the honest answer is a gap.
  */
  const contentAddress = retrieval.contentAddress;
  if (contentAddress === undefined) {
    return {
      cell: gap(series.seriesId, 'NO_PRODUCER', 'ECON-SNAPSHOT-NOT-RETAINED'),
      dispatched: [url],
    };
  }

  const values = dataset.value ?? {};
  const periods = timePeriods(dataset);

  /*
    C-12 · AN ABSENT CELL IS A GAP, NEVER A ZERO.

    A 200 with `value: {}` is a real and common Eurostat state — a correctly delivered,
    correctly shaped response that carries no observation. It is a DOMAIN gap, not an
    admission failure, which is why the envelope assertion deliberately admits it and
    the refusal happens here instead.
  */
  const keys = Object.keys(values);
  if (keys.length === 0 || periods.length === 0) {
    return {
      cell: gap(
        series.seriesId,
        'WITHHELD',
        'ECON-EMPTY-VALUE: the publisher returned a well-formed response carrying no ' +
          'observation for this tuple. Rendered as a gap; never as zero.',
      ),
      dispatched: [url],
    };
  }

  /*
    C-6 · THE DATASET-LEVEL LATEST PERIOD IS NOT THE SERIES LATEST.

    The period is read from the index position the VALUE occupies, never from the
    dataset's own newest declared period: `une_rt_m` declares 2026-08 while Poland's last
    value is 2026-07, and labelling that number August is a fabricated timestamp on a
    correct figure.
  */
  const lastKey = keys[keys.length - 1] as string;
  const raw = values[lastKey];
  /*
    ECON-NUMERIC-LEXICAL-SEAM-1 — THE CANONICAL CLASSIFIER DECIDES, NOT THIS MODULE.

    The old test was `typeof raw !== 'number' || !Number.isFinite(raw)`, and it answered
    one question with one code. Three unlike facts collapsed onto `ECON-VALUE-NOT-FINITE`:
    a value a double carries exactly but spells differently (`1.0`), a value a double
    cannot carry (a 20-digit integer), and a value that is not finite at all (`1e400`).
    Only the third was ever what that code said.

    THIS MODULE PERFORMS NO NUMERIC COERCION. There is no `Number(...)` here and there
    must not be: after the parser delta, a `PRECISION_SENSITIVE` or `NOT_FINITE_AS_DOUBLE`
    token arrives as a STRING carrying its original characters, and re-deriving its class
    is deterministic and character-identical — so the parse path and this path cannot
    disagree about a token. `economyValueOrRefusal` maps the class to one of three codes.
  */
  const classified =
    typeof raw === 'number'
      ? { token: String(raw), numericClass: 'EXACT_AS_DOUBLE' as const, value: raw }
      : typeof raw === 'string'
        ? classifyRetainedToken(raw)
        : null;
  const resolved = economyValueOrRefusal(classified);
  if (!resolved.ok) {
    return {
      cell: gap(series.seriesId, 'WITHHELD', resolved.code),
      dispatched: [url],
    };
  }
  const value = resolved.value;
  const periodId = periods[Number(lastKey)] ?? periods[periods.length - 1] as string;


  const upstream: EconomyUpstreamSeriesRef = {
    providerId: EUROSTAT_PROVIDER_ID,
    datasetCode: series.datasetCode,
    // datasetVersion ABSENT — Eurostat declares none, and inventing one would make an
    // unversioned source look reproducible.
    dimensions: series.dimensions,
    requestUrl: url,
  };

  /*
    The publisher's declared list, passed VERBATIM. ECON-CL-1 is ruled: the contract
    subtracts the observation axis itself and REFUSES a ref that pins one, so a producer
    that filtered its own list could only ever filter one key too many.
  */
  assertDimensionsArePinned(upstream, series.declaredDimensionKeys);

  /*
    THE RETRIEVAL ITSELF, NOT A DESCRIPTION OF IT.

    R2 built an Economy-local snapshot beside the retrieval it already held, and supplied
    two of its fields as literals — `mediaType: 'application/json'` and
    `payloadRetention: 'RETAINED'`. Main reproduced the consequence: a snapshot claiming
    `application/json` beside a retrieval saying `text/csv`, and claiming RETAINED beside
    rights that forbid retention. That is not carelessness; it is what re-describing a
    record you already hold inevitably produces. The second structure is gone.
  */
  const lineage: EconomyObservationLineage = { upstream, retrieval };

  assertVintageBasisIsHonest(lineage);
  assertRetrievalIsProvable(lineage.retrieval);

  const provenance: SourceProvenance = {
    /* A structured public dataset — statistics and indicators — which is what the
       platform's own vocabulary calls PUBLIC_DATA. Not OFFICIAL_SOURCE: that is an
       institution publishing about itself, and Eurostat publishing Poland's HICP is a
       statistical agency publishing a dataset about a member state. */
    sourceType: 'PUBLIC_DATA',
    providerId: EUROSTAT_PROVIDER_ID,
    institution: 'Eurostat',
    jurisdiction: 'EU',
    sourceUrl: url,
    retrievedAt: evidence.retrievedAt,
    authorityClass: 'OFFICIAL_STATISTICS',
  };

  assertLineageAgreesWithProvenance(lineage, provenance);

  const observation: EconomyObservation = {
    seriesId: series.seriesId,
    periodId,
    /* Returned by the contract so the value and its basis cannot disagree. */
    vintage: economyVintageOf(retrieval),
    /*
      The value the CLASSIFIER resolved, never the raw slot. `raw` may be a string here —
      that is the whole shape of the seam — and publishing it would put characters into a
      numeric field. `resolved.value` is non-null exactly when the class is
      EXACT_AS_DOUBLE, so this is the only value the contract permits to be published.
    */
    value,
    unit: series.unit,
    semantics: {
      releaseStatus: 'FINAL',
      valueKind: 'ACTUAL',
      /*
        UNDETERMINED, AND IT STAYS THAT WAY. Freshness is judged against the publisher's
        STATED cadence; Eurostat states none for any row in the Alpha matrix, so no row
        can honestly be called FRESH or STALE. Frequency is not cadence.
      */
      freshness: 'UNDETERMINED',
    },
    provenance,
  };

  return {
    cell: {
      kind: 'OBSERVATION',
      observation,
      lineage,
      publishable: economyObservationIsPublishable(
        lineage,
        provenance,
        series.declaredDimensionKeys,
      ),
    },
    dispatched: [url],
  };
}

/**
 * Produce every declared Alpha cell.
 *
 * SEQUENTIAL AND AT MOST ONE REQUEST PER SERIES. `requestsDispatched` is returned so a
 * test can assert the count rather than trust the shape of the loop, and a blocked or
 * closed row contributes none.
 */
export async function produceAlphaSet(
  ports: EconomyProducerPorts,
  series: readonly AlphaSeriesDeclaration[] = ALPHA_SERIES,
): Promise<EconomyProducerResult> {
  const cells: EconomyProducedCell[] = [];
  const requestsDispatched: string[] = [];

  for (const declaration of series) {
    const { cell, dispatched } = await produceSeriesCell(declaration, ports);
    cells.push(cell);
    requestsDispatched.push(...dispatched);
  }

  return { cells, requestsDispatched };
}
