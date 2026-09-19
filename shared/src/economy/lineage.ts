/**
 * ════════════════════════════════════════════════════════════════════════════
 * ECONOMY OBSERVATION LINEAGE — PROMOTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-ECONOMY-LINEAGE-PROMOTION-CL1-R1. Home: `shared/src/economy/lineage.ts`.
 *
 * Supersedes `economy-lineage.ts.PROPOSED`
 * (sha256 2a549c9b9969a0cbf61c10169c052365cf2419235b6a7b75d6c11793696c2271), which said
 * "PROPOSAL. NOT PROMOTED." Three things changed between proposal and promotion, and each
 * is a measurement rather than a preference:
 *
 * 1 · ECON-CL-1 · `time` IS AN AXIS, NOT AN IDENTITY DIMENSION.
 *     The proposal required EVERY declared dimension pinned, and Eurostat declares `time`
 *     among them. Ruled, derived from the accepted Economy model — see §1a.
 *
 * 2 · THE RETRIEVAL SNAPSHOT IS NOT ECONOMY'S TO DECLARE.
 *     The proposal was validated against `beta/canonical-recovery-r1` (f36695ae), which
 *     carries NO `shared/src/official-data` at all. That subtree has since landed on the
 *     active lineage and already declares `OfficialDataRetrieval` — carrying every field
 *     `EconomyRetrievalSnapshot` declared, with better types. Promoting the Economy copy
 *     would have forked Snapshot R2. It is deleted; the lineage now REFERENCES the
 *     accepted retrieval. See §3.
 *
 * 3 · THE VINTAGE BASIS IS DERIVED, NOT DECLARED.
 *     `OfficialDataRetrieval` carries `publisherReleasedAt` and `publisherChangedAt`
 *     separately, so which basis applies is a fact about the retrieval rather than a
 *     claim an adapter makes about it. See §4.
 *
 * WHAT DID NOT CHANGE: the upstream series reference, the pinning rule, the
 * length-prefixed injective key, the "omitted dimension is a rejection, not a wildcard"
 * clause, and the rule that `requestUrl` is never an identity input.
 *
 * 4 · ECON-CL-2 · THE PIN SET IS AN EQUALITY, NOT A LOWER BOUND.  (R3)
 *     R2 checked `declared ⊆ pinned` and never `pinned ⊆ declared`, so an adapter could
 *     add an UNDECLARED pin — `lastTimePeriod=1` being the obvious one — and mint a
 *     second stable key for the same real series. Found by G and reproduced on R2's own
 *     delivered bytes. See §7a.
 */

import type { OfficialDataRetrieval } from '../official-data/snapshot';
import type { SourceProvenance } from '../source-provenance';
import { ECONOMY_KEY_ENCODING_VERSION } from './index';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · PINNED DIMENSIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * One publisher dimension, pinned to one value. Both sides are the PUBLISHER'S OWN
 * spellings — `s_adj` / `SA`, not a normalised local vocabulary. Translating a
 * publisher's codes into ours here would make the tuple untraceable back to the request
 * that produced it, which is the whole point of holding it.
 */
export interface EconomyDimensionPin {
  /** The publisher's dimension key, verbatim. e.g. 'freq', 's_adj', 'unit', 'geo'. */
  readonly key: string;
  /** The publisher's dimension value, verbatim. e.g. 'M', 'SA', 'PC_M12', 'PL'. */
  readonly value: string;
}

/**
 * Every SERIES-DEFINING dimension the dataset declares, each pinned. Not a filter, not a
 * subset.
 *
 * An adapter that cannot pin a series-defining dimension MUST NOT default it, omit it, or
 * record a wildcard: it must fail, because a series whose adjustment is implicit is a
 * series whose identity is a guess.
 */
export type EconomyPinnedDimensions = readonly EconomyDimensionPin[];

/* ═══════════════════════════════════════════════════════════════════════════
 * 1a · ECON-CL-1 — THE OBSERVATION AXIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G reported this rather than working around it: Eurostat declares `time` among a
 * dataset's dimensions, and the proposal required every declared dimension pinned.
 * Neither available pin is admissible —
 *
 *   • pin `time` to a literal period and the SERIES identity changes every month;
 *   • pin it to the selector actually sent (`lastTimePeriod=1`) and the pin records a
 *     REQUEST PARAMETER as though it were a publisher's dimension value.
 *
 * THE RULING IS DERIVED FROM THE ACCEPTED ECONOMY MODEL, not from the shape of the
 * problem. `shared/src/economy/index.ts` — accepted, and byte-identical on both lineages —
 * already answers it three times over:
 *
 *   • It declares `EconomySeries` and `EconomyPeriod` as SEPARATE TYPES. The series and
 *     the period were never one thing in this model.
 *
 *   • It states observation identity as "Series + Period + vintage". If `time` were
 *     pinned into the series reference, Period would already be inside Series, and the
 *     accepted triple would carry the period twice — once inside the series key and once
 *     beside it.
 *
 *   • It states: "Two observations sharing (seriesId, periodId) and differing in vintage
 *     are BOTH TRUE". That sentence is only satisfiable if ONE SERIES SPANS MANY PERIODS.
 *     Pinning `time` makes a seriesId vary with the period, so no two observations could
 *     ever share a seriesId at different periods — and the accepted REVISION SEMANTICS
 *     become inexpressible. This is the decisive one: pinning the axis does not merely
 *     churn identity, it removes the model's ability to say a figure was revised.
 *
 * So: DATASET + PINNED NON-TEMPORAL DIMENSIONS → the upstream series identity, stable
 * across observation periods. OBSERVATION PERIOD → `EconomyObservation.periodId`, where
 * the accepted model already put it.
 *
 * WHY THE LIST IS SHORT, AND WHY IT MUST STAY SHORT. The two ways to be wrong here are
 * not symmetric:
 *
 *   • A time axis MISSING from this list fails LOUDLY — the adapter is told the dimension
 *     is unpinned and stops. Somebody then rules on it.
 *   • A series-defining dimension WRONGLY on this list is silently dropped from identity,
 *     and two different series collide with nothing thrown.
 *
 * The second is the one that cannot be detected afterwards, so this list carries only
 * spellings that have been MEASURED on a real publisher's declared dimension list. `time`
 * is Eurostat's, measured on six datasets in
 * `G-ECONOMY-ALPHA-PRODUCER-CONVERGENCE-R2`. SDMX's `TIME_PERIOD` is NOT here: it is
 * plausible and unmeasured, and a plausible-but-unmeasured entry is exactly how the
 * refusal vocabulary was got wrong once already. An ECB adapter will fail loudly on its
 * first run, which is the correct cost.
 */
export const ECONOMY_OBSERVATION_AXIS_KEYS: readonly string[] = Object.freeze([
  /** Eurostat. Measured on prc_hicp_minr, namq_10_gdp, une_rt_m, gov_10q_ggdebt,
   *  irt_lt_mcby_m and ert_bil_eur_m. */
  'time',
]);

/**
 * DIAGNOSTIC ONLY, AND NOT A DECISION. Spellings that are probably an observation axis,
 * used to make an unpinned-dimension refusal self-explaining. Nothing branches on this:
 * a key here is still refused until it is ruled onto `ECONOMY_OBSERVATION_AXIS_KEYS`.
 */
const LIKELY_AXIS_SPELLINGS: readonly string[] = Object.freeze([
  'time',
  'time_period',
  'timeperiod',
  'period',
  'obs_time',
  'date',
]);

/** The keys a series identity must pin: the publisher's declared list, minus the axis. */
export function economySeriesDefiningKeys(
  declaredKeys: readonly string[],
): readonly string[] {
  return declaredKeys.filter((k) => !ECONOMY_OBSERVATION_AXIS_KEYS.includes(k));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE UPSTREAM SERIES REFERENCE
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * WHERE THE NUMBER CAME FROM UPSTREAM — subordinate to, and never a substitute for,
 * `SourceProvenance`.
 */
export interface EconomyUpstreamSeriesRef {
  /**
   * The provider, as the source registry names it. The SAME value as
   * `SourceProvenance.providerId` — carried here so the reference is self-contained for
   * keying, and REQUIRED to equal it (see `assertLineageAgreesWithProvenance`).
   */
  readonly providerId: string;

  /**
   * The publisher's own dataset / table / dataflow code, verbatim.
   * Eurostat `prc_hicp_manr`; ECB dataflow `ICP`; GUS BDL variable id. NEVER a URL,
   * never a human title, never a local alias.
   */
  readonly datasetCode: string;

  /**
   * The publisher's dataset version, WHERE THE PUBLISHER DECLARES ONE.
   *
   * ABSENT rather than guessed. Eurostat declares none — its database always holds the
   * latest version with no documentation of past versions — and inventing one would make
   * an unversioned source look reproducible.
   */
  readonly datasetVersion?: string;

  /** Every SERIES-DEFINING dimension the dataset declares, pinned. Never the axis. */
  readonly dimensions: EconomyPinnedDimensions;

  /**
   * Retained so a human can follow it. DELIBERATELY NOT AN IDENTITY INPUT and
   * deliberately not parsed by anything. If a consumer needs a dimension, it reads
   * `dimensions`.
   */
  readonly requestUrl?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE RETRIEVAL — REFERENCED, NOT REDECLARED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The proposal declared `EconomyRetrievalSnapshot` with six fields. It was written
 * against a lineage that had no `shared/src/official-data`; that subtree has since landed
 * and `OfficialDataRetrieval` carries every one of them:
 *
 *   snapshotId       → retrievalId
 *   retrievedAt      → retrievedAt
 *   contentSha256    → contentAddress    (BRANDED `SnapshotContentAddress`, not a string)
 *   byteLength       → byteLength
 *   mediaType        → mediaType
 *   payloadRetention → rights.payloadRetentionPermitted + completeness
 *
 * AND THE DUPLICATE HAD ALREADY PRODUCED A FALSE FIELD IN ITS FIRST CONSUMER. Measured in
 * `G-ECONOMY-ALPHA-PRODUCER-CONVERGENCE-R2`: the producer, holding a real
 * `OfficialDataRetrieval`, copied four fields across and supplied two as literals —
 * `mediaType: 'application/json'` and `payloadRetention: 'RETAINED'` — where the proposal's
 * own docblock said "the media type the publisher returned, verbatim. Not inferred from an
 * extension." It was not inferred from an extension; it was not read at all. That is what a
 * parallel record does to the record it parallels, and it happened on the first attempt.
 *
 * The same lane also set `publisherReleasedAt` from Eurostat's `UPDATE_DATA` — a
 * CHANGED-AT value in a RELEASED-AT field — a conflation the accepted retrieval cannot
 * express, because it carries the two separately.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE VINTAGE BASIS — DERIVED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `EconomyObservation.vintage` is REQUIRED and means "when the publisher issued this
 * reading". Most official sources cannot supply one, so an adapter must put something
 * there, and this axis is what stops that something from silently becoming a publisher's
 * revision history.
 *
 * In the proposal the basis was DECLARED by the adapter and checked for consistency. It is
 * now DERIVED from the retrieval, because the accepted retrieval already carries the two
 * timestamps the answer depends on. An adapter can no longer overstate it: there is no
 * field in which to write the wrong answer.
 *
 * DUPLICATION, REPORTED NOT FORKED — ECON-R-1, still open. `shared/src/market/index.ts`
 * declares `VINTAGE_PROVENANCE_KINDS` with these identical three members. Market imports
 * FROM Economy, so Economy cannot import from Market without a cycle; promoting one
 * declaration to a third home is a separate ruling and is not taken here. The members stay
 * identical ON PURPOSE so that promotion is a move, not a migration.
 */
export const ECONOMY_VINTAGE_BASES = [
  /** The publisher stated this vintage. The only basis that makes `vintage` literally true. */
  'PUBLISHER_VINTAGE',
  /** The publisher stated when it last changed, and that is what `vintage` carries. */
  'PUBLISHER_CHANGED_AT',
  /** The publisher stated nothing; `vintage` is OUR retrieval moment. Must be visible as such. */
  'INGEST_SNAPSHOT',
] as const;

export type EconomyVintageBasis = (typeof ECONOMY_VINTAGE_BASES)[number];

/**
 * Which basis this retrieval supports. Precedence is strongest-claim-first, and it is the
 * only precedence that is honest: a publisher that states a release timestamp has told us
 * the vintage, and one that states only a change timestamp has told us less.
 */
export function economyVintageBasisOf(
  retrieval: Pick<OfficialDataRetrieval, 'publisherReleasedAt' | 'publisherChangedAt'>,
): EconomyVintageBasis {
  if (retrieval.publisherReleasedAt !== undefined) return 'PUBLISHER_VINTAGE';
  if (retrieval.publisherChangedAt !== undefined) return 'PUBLISHER_CHANGED_AT';
  return 'INGEST_SNAPSHOT';
}

/**
 * The timestamp `EconomyObservation.vintage` must carry, for the basis this retrieval
 * supports. Returned rather than assembled by the caller so the value and the basis cannot
 * disagree.
 */
export function economyVintageOf(
  retrieval: Pick<
    OfficialDataRetrieval,
    'publisherReleasedAt' | 'publisherChangedAt' | 'retrievedAt'
  >,
): string {
  return retrieval.publisherReleasedAt ?? retrieval.publisherChangedAt ?? retrieval.retrievedAt;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · THE LINEAGE RECORD
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Carried BESIDE `SourceProvenance` on an observation, never instead of it.
 *
 * An `EconomyObservation` that has a `lineage` has BOTH: `provenance` answers who
 * published it and in what role; `lineage` answers which series it is and which retrieval
 * proves it. Neither is derivable from the other.
 */
export interface EconomyObservationLineage {
  readonly upstream: EconomyUpstreamSeriesRef;
  /**
   * The accepted official-data retrieval this figure came from. NOT an Economy-local
   * description of it — see §3.
   */
  readonly retrieval: OfficialDataRetrieval;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · IDENTITY — DERIVED, INJECTIVE, MINTING NOTHING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The same length-prefixed encoding the accepted Economy contract already uses, and for
 * the accepted reason: a delimiter-joined key built from caller-supplied strings collides
 * as soon as one part can contain the delimiter, and the collision is invisible — nothing
 * throws, one row simply wins.
 */

function lengthPrefixed(parts: readonly string[]): string {
  return parts.map((p) => `${p.length}:${p}`).join('');
}

/** Canonical order: by publisher key, ascending, byte-wise. Assembly order never matters. */
export function canonicalDimensions(
  dimensions: EconomyPinnedDimensions,
): EconomyPinnedDimensions {
  return [...dimensions].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * THE UPSTREAM SERIES KEY. Two series differing only in one pinned dimension — `s_adj=SA`
 * against `s_adj=NSA` — produce DIFFERENT keys, which is the requirement this whole file
 * exists to satisfy.
 *
 * ECON-CL-1's dual, and the property that makes the key a SERIES key rather than a reading
 * key: the same series observed in two periods produces the SAME key. Nothing about the
 * observation period reaches this function, because nothing about it reaches `dimensions`.
 *
 * `requestUrl` is not an input. Neither is `datasetVersion` when absent.
 *
 * THIS FUNCTION IS TOTAL, AND THAT IS DELIBERATE — it keys whatever it is handed, so it
 * cannot be the gate. `assertDimensionsArePinned` is, and ECON-CL-2 is the demonstration
 * of why the gate has to be an EQUALITY: a ref carrying one extra pin keys perfectly
 * happily, stably, and to a different series than the one it names.
 */
export function economyUpstreamSeriesKey(ref: EconomyUpstreamSeriesRef): string {
  const dims = canonicalDimensions(ref.dimensions).flatMap((d) => [d.key, d.value]);
  return `${ECONOMY_KEY_ENCODING_VERSION}:up:${lengthPrefixed([
    ref.providerId,
    ref.datasetCode,
    ref.datasetVersion ?? '',
    ...dims,
  ])}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7 · THE ASSERTIONS — REFUSALS, NOT WARNINGS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * An omitted dimension is a REJECTION, never a wildcard — and an observation axis is
 * neither omitted nor pinned, it is NOT A DIMENSION OF THE SERIES.
 *
 * `declaredKeys` is the publisher's own dimension list for the dataset, PASSED VERBATIM.
 * Callers do not pre-filter it: the axis subtraction happens here, in one place, so that
 * "which keys define a series" is a property of the contract rather than a convention each
 * adapter reimplements. An adapter that filtered its own list would be an adapter that
 * could filter one key too many.
 *
 * ── ECON-CL-2 · THE RULE IS SET EQUALITY ──────────────────────────────────
 *
 *     keys(ref.dimensions)  ==  declaredKeys  −  ECONOMY_OBSERVATION_AXIS_KEYS
 *
 * NO FEWER AND NO EXTRAS. R2 enforced only the left-to-right half, and G found what the
 * other half costs: a ref that pins everything declared AND `lastTimePeriod=1` passed
 * every check and produced a SECOND STABLE KEY for the same provider, dataset and real
 * series. Two keys for one series is the identity failure this file exists to prevent,
 * arrived at from the opposite direction to the one R1 guarded.
 *
 * AN EXTRA PIN FAILS LOUDLY AND IS NEVER DROPPED. Silently discarding it would make the
 * key correct and the adapter still wrong — and the next reader would find a producer
 * assembling a tuple the contract quietly ignores, which is worse than a refusal because
 * nothing says so.
 */
export function assertDimensionsArePinned(
  ref: EconomyUpstreamSeriesRef,
  declaredKeys: readonly string[],
): void {
  /* ECON-CL-1, the half that makes the rule enforceable rather than permissive: pinning
     the axis is REFUSED. Allowing it to be omitted would let one adapter pin it anyway
     and produce a per-period "series", which is the defect this ruling exists to close. */
  const pinnedAxis = ref.dimensions.filter((d) =>
    ECONOMY_OBSERVATION_AXIS_KEYS.includes(d.key),
  );
  if (pinnedAxis.length > 0) {
    throw new Error(
      `ECONOMY_LINEAGE_AXIS_PINNED_AS_DIMENSION: ${ref.datasetCode} pins ` +
        `[${pinnedAxis.map((d) => d.key).join(', ')}], which is an OBSERVATION AXIS. ` +
        `The period belongs to EconomyObservation.periodId; a series that carries it is a ` +
        `series whose identity changes every period, and the accepted revision semantics ` +
        `require one series to span many periods.`,
    );
  }

  const required = economySeriesDefiningKeys(declaredKeys);
  const pinned = new Set(ref.dimensions.map((d) => d.key));
  const missing = required.filter((k) => !pinned.has(k));
  if (missing.length > 0) {
    const suspected = missing.filter((k) => LIKELY_AXIS_SPELLINGS.includes(k.toLowerCase()));
    throw new Error(
      `ECONOMY_LINEAGE_DIMENSION_NOT_PINNED: ${ref.datasetCode} leaves [${missing.join(', ')}] unpinned. ` +
        `An unpinned dimension is a series whose identity is a guess; pin it or fail.` +
        (suspected.length > 0
          ? ` If [${suspected.join(', ')}] is an observation axis rather than a series ` +
            `dimension, it must be RULED onto ECONOMY_OBSERVATION_AXIS_KEYS — this ` +
            `refusal will not be quieted by an adapter deciding that for itself.`
          : ''),
    );
  }

  const empty = ref.dimensions.filter((d) => d.key === '' || d.value === '');
  if (empty.length > 0) {
    throw new Error(
      `ECONOMY_LINEAGE_EMPTY_DIMENSION: ${ref.datasetCode} carries an empty key or value. ` +
        `An empty pin is an omitted pin wearing a different hat.`,
    );
  }
  const seen = new Set<string>();
  for (const d of ref.dimensions) {
    if (seen.has(d.key)) {
      throw new Error(
        `ECONOMY_LINEAGE_DUPLICATE_DIMENSION: ${ref.datasetCode} pins '${d.key}' twice.`,
      );
    }
    seen.add(d.key);
  }

  /* ECON-CL-2, and it runs LAST on purpose: every refusal R2 could raise still fires with
     the same code on the same input, so this is an addition rather than a reordering. An
     empty-keyed pin is still an EMPTY_DIMENSION rather than an undeclared one, which is
     the more precise of the two true statements. */
  const allowed = new Set(required);
  const undeclared = ref.dimensions.map((d) => d.key).filter((k) => !allowed.has(k));
  if (undeclared.length > 0) {
    throw new Error(
      `ECONOMY_LINEAGE_DIMENSION_NOT_DECLARED: ${ref.datasetCode} pins ` +
        `[${undeclared.join(', ')}], which the publisher does not declare as a dimension ` +
        `of this dataset. The series-defining set is exactly [${required.join(', ')}]. ` +
        `An undeclared pin is not ignored and not dropped: it would mint a second stable ` +
        `key for one real series, and a request selector is not a dimension — it belongs ` +
        `in the request, and requestUrl is never an identity input.`,
    );
  }
}

/**
 * The lineage and the provenance must agree about the provider. They are two records of
 * one retrieval; disagreeing about who it was from means one of them is about a different
 * fetch.
 */
export function assertLineageAgreesWithProvenance(
  lineage: EconomyObservationLineage,
  provenance: SourceProvenance,
): void {
  if (provenance.providerId !== undefined && provenance.providerId !== lineage.upstream.providerId) {
    throw new Error(
      `ECONOMY_LINEAGE_PROVIDER_DISAGREEMENT: provenance says '${provenance.providerId}', ` +
        `lineage says '${lineage.upstream.providerId}'.`,
    );
  }
  if (lineage.retrieval.request.providerId !== lineage.upstream.providerId) {
    throw new Error(
      `ECONOMY_LINEAGE_RETRIEVAL_PROVIDER_DISAGREEMENT: the retrieval was made from ` +
        `'${lineage.retrieval.request.providerId}' and the series claims ` +
        `'${lineage.upstream.providerId}'.`,
    );
  }
}

/**
 * A vintage that is OURS must say so.
 *
 * The basis is derived, so this no longer checks an adapter's claim against a field — it
 * checks that the retrieval can support ANY honest basis at all, which is the residual
 * question once the claim is gone.
 */
export function assertVintageBasisIsHonest(lineage: EconomyObservationLineage): void {
  const basis = economyVintageBasisOf(lineage.retrieval);
  if (basis === 'INGEST_SNAPSHOT' && lineage.retrieval.retrievedAt === '') {
    throw new Error(
      `ECONOMY_LINEAGE_VINTAGE_UNSUPPORTED: the publisher stated no timestamp and the ` +
        `retrieval carries no retrievedAt, so 'vintage' would be empty. A figure with no ` +
        `honest vintage is not publishable.`,
    );
  }
}

/**
 * A retrieval that proves nothing is not evidence.
 *
 * The heavy lifting is the official-data spine's: the content address is branded and
 * `assertPayloadMatchesItsAddress` governs it. What Economy adds is the ONE condition that
 * is Economy's own — a figure may only be published from a retrieval whose bytes were
 * actually addressed, because an unaddressed retrieval cannot be re-proved later.
 */
export function assertRetrievalIsProvable(retrieval: OfficialDataRetrieval): void {
  if (retrieval.contentAddress === undefined) {
    throw new Error(
      'ECONOMY_LINEAGE_RETRIEVAL_NOT_ADDRESSED: a figure may only be published from a ' +
        'retrieval whose bytes were content-addressed. Without the address the citation ' +
        'cannot be re-proved.',
    );
  }
  if (retrieval.completeness !== 'COMPLETE') {
    throw new Error(
      `ECONOMY_LINEAGE_RETRIEVAL_INCOMPLETE: completeness is '${retrieval.completeness}'. ` +
        'A partial capture may be retained and inspected; it may not supply a figure.',
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 · WHAT A PUBLISHABLE OBSERVATION IS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The single predicate the route-activation contract depends on. It is deliberately not a
 * score, a percentage or a readiness level: an observation either satisfies every clause
 * above or it is not publishable.
 */
export function economyObservationIsPublishable(
  lineage: EconomyObservationLineage | undefined,
  provenance: SourceProvenance,
  declaredKeys: readonly string[],
): boolean {
  if (lineage === undefined) return false;
  try {
    assertDimensionsArePinned(lineage.upstream, declaredKeys);
    assertLineageAgreesWithProvenance(lineage, provenance);
    assertVintageBasisIsHonest(lineage);
    assertRetrievalIsProvable(lineage.retrieval);
    return true;
  } catch {
    return false;
  }
}
