import type {
  SituationDimensions,
  SituationReAnalysisEvidence,
  SituationSnapshotState,
} from './situation.contract';

/**
 * SITUATION MEMORY — S1. THE STATE RULES, ISOLATED FROM THE DATABASE.
 *
 * Every function here is pure. That is deliberate: these are the rules the
 * CTO ruled on directly, and they need to be readable and testable without
 * a schema, a client or a connection standing in front of them.
 *
 * THE RULING, VERBATIM:
 *
 *   "One snapshot NEVER proves STABLE. STABLE requires a later completed
 *    analysis comparable to an earlier snapshot and no material change.
 *    NOT RE-ANALYSED requires enough temporal evidence to establish that
 *    the subject has not been analysed since the relevant seen/reference
 *    point. Do not infer either from article counts."
 *
 * Each clause of that ruling is a separate guard below, in the order the
 * ruling states them, so a future reader can check the code against the
 * sentence rather than against a paraphrase of it.
 */

/** The comparison inputs taken from the snapshot immediately preceding this one. */
export interface PreviousSnapshotEvidence {
  readonly analysedAt: Date;
  readonly dimensions: SituationDimensions;
}

export interface NextSnapshotEvidence {
  readonly analysedAt: Date;
  readonly dimensions: SituationDimensions;
}

/**
 * Are two dimension maps COMPARABLE — that is, did the two analyses
 * measure the same things?
 *
 * If one run produced dimensions {a, b} and the next produced {a, c}, then
 * "b disappeared" and "c appeared" are facts about the ANALYSIS, not about
 * the subject. Declaring MATERIAL_CHANGE from that would report a change
 * in our own measurement as a change in the world.
 */
export function dimensionsAreComparable(
  previous: SituationDimensions,
  next: SituationDimensions,
): boolean {
  const previousKeys = Object.keys(previous).sort();
  const nextKeys = Object.keys(next).sort();

  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return previousKeys.every((key, index) => key === nextKeys[index]);
}

/**
 * Do two COMPARABLE dimension maps carry the same values?
 *
 * Only ever called after `dimensionsAreComparable`, so the key sets are
 * known to be identical and a value-by-value walk is sufficient.
 */
export function dimensionValuesAreIdentical(
  previous: SituationDimensions,
  next: SituationDimensions,
): boolean {
  return Object.keys(previous).every((key) => Object.is(previous[key], next[key]));
}

/**
 * THE STATE OF THE SNAPSHOT ABOUT TO BE WRITTEN.
 *
 * NOTE WHAT IS NOT A PARAMETER: article counts, publisher counts, cluster
 * counts. The ruling forbids inferring state from them and the way to
 * honour that is to make them unavailable to this function rather than to
 * remember not to use them. A story picked up by ten more outlets
 * overnight has not changed; it has been reported more.
 */
export function deriveSnapshotState(
  previous: PreviousSnapshotEvidence | null,
  next: NextSnapshotEvidence,
): SituationSnapshotState {
  // CLAUSE 1 — "One snapshot NEVER proves STABLE."
  // With nothing behind it, this analysis is an observation and not yet
  // evidence of anything over time.
  if (previous === null) {
    return 'FIRST_OBSERVATION';
  }

  // CLAUSE 2 — "STABLE requires a LATER completed analysis".
  // Strictly later. Two analyses bearing the same instant cannot be
  // ordered, so neither stability nor change is provable between them.
  if (next.analysedAt.getTime() <= previous.analysedAt.getTime()) {
    return 'INCOMPARABLE';
  }

  // CLAUSE 3 — "COMPARABLE to an earlier snapshot".
  if (!dimensionsAreComparable(previous.dimensions, next.dimensions)) {
    return 'INCOMPARABLE';
  }

  // CLAUSE 4 — "and NO MATERIAL CHANGE".
  return dimensionValuesAreIdentical(previous.dimensions, next.dimensions)
    ? 'STABLE'
    : 'MATERIAL_CHANGE';
}

/**
 * WHAT THE TIMESTAMPS SUPPORT AT READ TIME.
 *
 * `lastAnalysedAt` is the ONLY input. Not the snapshot count, not the
 * article count, not `lastRetrievedAt` — retrieving articles about a
 * subject is not analysing it, and the two columns exist separately for
 * exactly that reason.
 *
 * @param lastAnalysedAt the situation's stored value. NULL MEANS NEVER.
 * @param reference      the seen/reference point the claim is relative to.
 */
export function classifyReAnalysisEvidence(
  lastAnalysedAt: Date | null,
  reference: Date | null | undefined,
): SituationReAnalysisEvidence {
  // NULL MEANS NEVER, and it is its own answer. It is neither
  // "not re-analysed since you looked" (which implies we once did) nor
  // unknown.
  if (lastAnalysedAt === null) {
    return 'NEVER_ANALYSED';
  }

  // "NOT RE-ANALYSED requires ENOUGH TEMPORAL EVIDENCE." Without a usable
  // reference point there is no evidence, and the honest answer says so
  // rather than defaulting to the reassuring one.
  if (
    reference === null ||
    reference === undefined ||
    Number.isNaN(reference.getTime()) ||
    Number.isNaN(lastAnalysedAt.getTime())
  ) {
    return 'INSUFFICIENT_EVIDENCE';
  }

  return lastAnalysedAt.getTime() > reference.getTime()
    ? 'ANALYSED_SINCE_REFERENCE'
    : 'NOT_RE_ANALYSED_SINCE_REFERENCE';
}
