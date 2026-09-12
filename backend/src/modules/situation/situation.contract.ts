/**
 * SITUATION MEMORY — S1-R2. THE VOCABULARY, IN ONE PLACE.
 *
 * No database access and no framework dependency, so the rules can be read —
 * and tested — without a database standing behind them.
 *
 * WHAT R2 CHANGED. S1 modelled a situation's identity as its key. G's ratified
 * contract establishes that the key is a coarse PARTITION and that several
 * distinct situations legitimately share one. Identity is therefore a TRIPLE —
 * partition, key version, and an assign-once discriminator — and everything in
 * this file that used to say "key" now says which of those it means.
 */

/**
 * THE STATE OF ONE SNAPSHOT, RELATIVE TO THE SNAPSHOT BEFORE IT.
 *
 * Deliberately NOT the presentation vocabulary. What a user is shown is H-owned
 * and may be narrower, differently worded, or suppressed entirely; what is
 * STORED here is only what the evidence supports.
 *
 * FIRST_OBSERVATION  the first completed analysis for this situation. Nothing
 *                    to compare against, so no change claim and no stability
 *                    claim. ONE SNAPSHOT NEVER PROVES STABLE.
 * MATERIAL_CHANGE    a later, comparable analysis whose dimension VALUES differ.
 * STABLE             a later, comparable analysis whose values are identical.
 *                    All three conditions required, each checked separately.
 * INCOMPARABLE       a previous snapshot exists but cannot be set against this
 *                    one — different dimension SET, or not strictly later.
 */
export type SituationSnapshotState =
  | 'FIRST_OBSERVATION'
  | 'MATERIAL_CHANGE'
  | 'STABLE'
  | 'INCOMPARABLE';

export const SITUATION_SNAPSHOT_STATES: readonly SituationSnapshotState[] = [
  'FIRST_OBSERVATION',
  'MATERIAL_CHANGE',
  'STABLE',
  'INCOMPARABLE',
] as const;

/**
 * A DIMENSION VALUE, AND NOTHING ELSE.
 *
 * Dimensions carry the VALUES an analysis produced — the things comparable
 * between two runs — and never the prose. Prose belongs to the response and to
 * whatever cache serves it. Storing it here would make every re-run "different"
 * for reasons that have nothing to do with the subject having changed, which is
 * exactly the false positive the store exists to avoid.
 */
export type SituationDimensionValue = string | number | boolean | null;
export type SituationDimensions = Readonly<Record<string, SituationDimensionValue>>;

/** A dimension value is a label, a code, a count or a flag. Longer is a sentence. */
export const MAX_DIMENSION_VALUE_LENGTH = 120;
export const MAX_DIMENSION_COUNT = 64;

export class InvalidSituationDimensionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSituationDimensionsError';
  }
}

/**
 * Validate on the way IN, so an unusable snapshot is never written. Throwing
 * fails the append; truncating or dropping the offending dimension would write
 * a snapshot that silently disagrees with the analysis it claims to record, and
 * every later comparison against it would be wrong.
 */
export function assertComparableDimensions(dimensions: SituationDimensions): void {
  const keys = Object.keys(dimensions);

  if (keys.length === 0) {
    throw new InvalidSituationDimensionsError(
      'A snapshot with no dimensions cannot be compared to anything. Refusing to write it.',
    );
  }
  if (keys.length > MAX_DIMENSION_COUNT) {
    throw new InvalidSituationDimensionsError(
      `A snapshot carries ${keys.length} dimensions, over the ceiling of ${MAX_DIMENSION_COUNT}.`,
    );
  }

  for (const key of keys) {
    if (key.trim().length === 0) {
      throw new InvalidSituationDimensionsError('A dimension name may not be blank.');
    }
    const value = dimensions[key];
    if (typeof value === 'string' && value.length > MAX_DIMENSION_VALUE_LENGTH) {
      throw new InvalidSituationDimensionsError(
        `Dimension "${key}" is ${value.length} characters, over the ceiling of ` +
          `${MAX_DIMENSION_VALUE_LENGTH}. Dimensions carry VALUES, never prose.`,
      );
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new InvalidSituationDimensionsError(
        `Dimension "${key}" is not a finite number. NaN and Infinity are not storable values.`,
      );
    }
  }
}

/**
 * WHAT THE TWO TIMESTAMPS CAN HONESTLY SUPPORT AT READ TIME.
 *
 * NEVER_ANALYSED                   lastAnalysedAt is NULL. NULL MEANS NEVER —
 *                                  not "unknown", not "a long time ago".
 * ANALYSED_SINCE_REFERENCE         a completed analysis strictly after the point.
 * NOT_RE_ANALYSED_SINCE_REFERENCE  a completed analysis at or before it. The only
 *                                  shape that supports "not re-analysed since you
 *                                  last saw it".
 * INSUFFICIENT_EVIDENCE            no usable reference point. Returned rather
 *                                  than defaulting to the reassuring answer.
 */
export type SituationReAnalysisEvidence =
  | 'NEVER_ANALYSED'
  | 'ANALYSED_SINCE_REFERENCE'
  | 'NOT_RE_ANALYSED_SINCE_REFERENCE'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * ONE OBSERVATION — an article that has already been through the existing
 * pipeline. This is what G's `deriveSituationKey` consumes, and what tier 2
 * scores. The fields are the ones Main can honestly supply; the DERIVATION from
 * them is G's and is never performed here.
 */
export interface SituationObservation {
  /** The article's URL. The observation's identity, and a safe key. */
  readonly url: string;
  readonly title: string;
  readonly summary: string;
  /** When the article was observed. Not when the row is written. */
  readonly observedAt: Date;
  /** ISO-3166 alpha-2 where the evidence supports one, else null. */
  readonly countryCode: string | null;
}

/**
 * A SITUATION'S IDENTITY, AS G'S CONTRACT DEFINES IT.
 *
 * THE PARTITION IS NOT THE IDENTITY. `sit:v1:RWA` holds every Rwandan
 * situation; what separates them is the discriminator, and the discriminator is
 * assigned once and never recomputed.
 */
export interface SituationIdentity {
  /** G's tier-1 bucket key, `sit:v1:<sorted ISO3 scope, or 'world'>`. */
  readonly partitionKey: string;
  /** G's SITUATION_KEY_VERSION at the moment of assignment. */
  readonly keyVersion: string;
  /** Assign-once. Opaque. Never derived from a changing member set. */
  readonly discriminator: string;
  /** The rule under which the discriminator was assigned. */
  readonly discriminatorBasis: string;
}

/** One cluster of the same story across publishers, as recorded in a snapshot. */
export interface SituationClusterInput {
  /** G-owned derivation. Main stores it and enforces uniqueness within the snapshot. */
  readonly clusterKey: string;
  /**
   * ARTICLE URLs, NOT ARTICLE IDs. `NewsArticle.id` is derived from a 32-bit
   * rolling hash and shared/src/news.ts documents it as unsafe as a key.
   */
  readonly articleUrls: readonly string[];
  /**
   * DISTINCT PUBLISHERS behind those articles, as counted by the caller. Stored
   * rather than recomputed because publisher identity is G-owned (C2-5) and
   * this layer must not re-derive it and get a different answer.
   */
  readonly publisherCount: number;
}

/** One completed, request-triggered analysis, as offered to the store. */
export interface CompletedAnalysisRecord {
  /**
   * THE RESOLVED IDENTITY. Supplied by the caller, never derived here — because
   * deriving it means deciding tier-2 attachment, and tier 2 is shadow-only.
   */
  readonly identity: SituationIdentity;
  /** The observation this analysis was triggered by. */
  readonly observation: SituationObservation;
  /** When the analysis COMPLETED. Not when the request arrived. */
  readonly analysedAt: Date;
  /** Comparable values only. See assertComparableDimensions. */
  readonly dimensions: SituationDimensions;
  readonly clusters: readonly SituationClusterInput[];
  /**
   * OPTIONAL TRACE to the AnalysisRun telemetry row. A POINTER, NOT A FOREIGN
   * KEY — see situation.repository.ts.
   */
  readonly analysisRunId?: string | null;
}
