/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 — CONTEXT PRODUCER CLOSURE R1 · THE CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Three producers and one derivation, closing the gaps the frozen router names:
 *
 *   A  office-geography      a current-office construction naming a country
 *   B  reader-topic          BF-08  `topic.readerTerms` has no producer
 *   C  stated-period         BF-09  `time.statedPeriod` has no producer
 *   D  effective-context     the chip reads what scoped the answer
 *
 * WHAT THIS IS NOT, STATED FIRST BECAUSE FOUR PROHIBITIONS BIND THIS ROUND:
 *
 *   NOT a seventh classifier.  A classifier answers "what kind of question is
 *     this". None of these does. Each produces ONE FIELD of the Envelope from
 *     the reader's own words, and nothing routes on any of them — the precedence
 *     table decides, exactly as it does today.
 *   NOT a DTO change.  Every producer is SERVER-SIDE and PURE. Nothing here is
 *     transmitted, and nothing here may be supplied by a caller. Main's rule:
 *     "A caller may supply evidence; a caller may never supply a verdict."
 *   NOT a taxonomy merge.  `AnalyticalDomain` is untouched — this file does not
 *     import it. `NewsCategory` is READ as a vocabulary; the two never meet.
 *   NOT an architecture change.  `TYPED_GEOGRAPHY` stays rank 6 and gains no
 *     sibling. Producer A makes rank 6 *reachable* for a construction it could
 *     not previously see; it does not add a rank, reorder one, or create one.
 *
 * ZERO AI. ZERO NETWORK. ZERO CLOCK. ZERO I/O. Pure functions, total, never
 * throwing. The clock omission is load-bearing and §C explains why.
 */

import type { NewsCategory } from '@globalnews-ai/shared';

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · PROVENANCE — EVERY PRODUCER SAYS WHERE ITS VALUE CAME FROM
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mirrors the frozen router's own `requirednessSource: 'DECLARED' | 'DEFAULTED'`
 * discipline, and for the same stated reason: without it, an integration that
 * never supplies an axis takes a branch silently.
 *
 * `STATED` is the only value that means the reader said it. There is deliberately
 * no `INFERRED_HIGH_CONFIDENCE` or similar: a confidence score on a provenance
 * is how "we guessed" becomes "we know".
 */
export const PRODUCER_PROVENANCES = ['STATED', 'INTERPRETED', 'ABSENT'] as const;
export type ProducerProvenance = (typeof PRODUCER_PROVENANCES)[number];

/**
 * THE ONE RULE EVERY PRODUCER HERE OBEYS, AND THE ONE A REVIEWER SHOULD CHECK
 * FIRST: every value a producer emits as the reader's own is a SPAN OF WHAT THE
 * READER WROTE. Not a normalisation, not a synonym, not a resolved form.
 *
 * `assertIsSpanOf` is exported so a spec can hold it, and so the rule is one
 * function rather than a sentence repeated in four files.
 */
export function isSpanOf(candidate: string, normalizedQuery: string): boolean {
  if (candidate.length === 0) return false;
  return normalizedQuery.includes(candidate);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · A · OFFICE GEOGRAPHY
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The construction recognised, named so a reviewer can refuse a different one.
 * `OFFICE_OF_COUNTRY` is the only member today. It is a discriminated field
 * rather than a boolean because the next construction (if one is ever ruled in)
 * must be distinguishable in the evidence, not merged into "we matched something".
 */
export const OFFICE_CONSTRUCTIONS = ['OFFICE_OF_COUNTRY'] as const;
export type OfficeConstruction = (typeof OFFICE_CONSTRUCTIONS)[number];

export interface OfficeGeographyCandidate {
  /** ISO code as the landed resolver returned it. Never re-derived here. */
  readonly countryCode: string;
  /** The office noun the reader wrote, verbatim. */
  readonly officeTerm: string;
  /** The country span the reader wrote, verbatim. */
  readonly countryTerm: string;
  readonly construction: OfficeConstruction;
  /**
   * RANK 6. Not a new rank, not rank 5.5, not its own source.
   * The brief's requirement, held as a literal type so a widening is a
   * compile error rather than a diff nobody reads.
   */
  readonly scopeSource: 'TYPED_GEOGRAPHY';
  readonly provenance: 'STATED';
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · B · READER TOPIC
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `readerTerms` is the frozen router's field name (BF-08). The brief calls the
 * same thing `topicTerms`. THE ROUTER'S NAME WINS and the alias is recorded here
 * rather than in a comment nobody greps, because two names for one field is how
 * an integration binds the wrong one.
 */
export const TOPIC_FIELD_ALIASES = { topicTerms: 'readerTerms' } as const;

export interface ReaderTopic {
  /**
   * The category the reader NAMED, from the landed `NewsCategory` union.
   * ABSENT when they named none — never `'world'`. See the producer's §2.
   */
  readonly newsCategory?: NewsCategory;
  /** The category word the reader wrote, verbatim, when one was found. */
  readonly categoryTerm?: string;
  /** The reader's own topical words, each a span of the question. */
  readonly readerTerms: readonly string[];
  readonly provenance: ProducerProvenance;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · C · STATED PERIOD
 * ══════════════════════════════════════════════════════════════════════════ */

export const PERIOD_PRECISIONS = [
  'DAY',            // "yesterday", "on 3 March 2026"
  'WEEK',           // "this week", "last week"
  'MONTH',          // "this month", "in March 2026"
  'YEAR',           // "in 2026"
  'RANGE',          // "between 1 and 7 March 2026"
] as const;
export type PeriodPrecision = (typeof PERIOD_PRECISIONS)[number];

/**
 * Whether the period is anchored to an absolute date the reader gave, or to the
 * moment the question is asked.
 *
 * THIS DISTINCTION IS THE WHOLE REASON THERE IS NO CLOCK IN THIS FILE.
 * "yesterday" is not a date. It is a date *function* whose argument is the
 * instant of asking, and that instant belongs to the request, not to a pure
 * producer. Resolving it here would (a) make the producer untestable without
 * freezing time, and (b) bake an answer's meaning into a field that is supposed
 * to record what the reader said.
 */
export const PERIOD_ANCHORS = ['ABSOLUTE', 'RELATIVE_TO_ASK'] as const;
export type PeriodAnchor = (typeof PERIOD_ANCHORS)[number];

export const PERIOD_BOUNDS = ['CLOSED_PAST', 'OPEN_RECENT', 'POINT_IN_TIME', 'UNBOUNDED'] as const;
export type PeriodBound = (typeof PERIOD_BOUNDS)[number];

export interface StatedPeriod {
  /**
   * VERBATIM, AT THE READER'S OWN PRECISION. "this week" stays "this week".
   * The same ruling as `SnapshotRetrieval.referencePeriod` and as the NISR CPI
   * parser's refusal to widen a stated period: THE STORAGE TYPE MUST NEVER BE
   * MORE PRECISE THAN THE FACT.
   */
  readonly statedPeriod: string;
  readonly precision: PeriodPrecision;
  readonly anchor: PeriodAnchor;
  readonly bound: PeriodBound;
  readonly provenance: 'STATED';
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · D · EFFECTIVE CONTEXT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The three states, as the landed service already stamps them. A chip that
 * cannot tell these apart is the defect this closes.
 */
export const CONTEXT_EFFECTS = [
  'USED',              // the server says it scoped retrieval
  'PRESENT_UNUSED',    // eligible, and outranked — the reader's selection still stands
  'NOT_ELIGIBLE',      // never in contention: something more specific outranked it
  'ABSENT',            // the reader never supplied it
] as const;
export type ContextEffect = (typeof CONTEXT_EFFECTS)[number];

export interface EffectiveContextReading {
  readonly story: ContextEffect;
  readonly mapGeography: ContextEffect;
  /** True only when NOTHING scoped the answer. A positive claim, never a floor. */
  readonly globalScopeIsHonest: boolean;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 6 · COMPATIBILITY WITH THE FROZEN ROUTER
 * ══════════════════════════════════════════════════════════════════════════ */

/** Closed by this round. The router's own blocker ids. */
export const ROUTER_BLOCKERS_CLOSED = ['BF-08', 'BF-09'] as const;

/**
 * NOT closed, and the distinction matters more than it looks.
 *
 * A PRODUCER lets a constraint be CARRIED. An EXECUTOR lets it be USED.
 * Closing BF-08 does not give topic an executor, so the router's
 * `CAPABILITY_UNAVAILABLE` for a topic-only question stays correct — but its
 * `CONSTRAINT_UNTRANSPORTABLE` refusal must no longer be emitted, because the
 * constraint now transports.
 *
 * Probe `SC-4` asserts the four absent-executor rows land on
 * `CAPABILITY_UNAVAILABLE`. THAT PROBE STILL PASSES. Row
 * `W1-topic-only-nothing-left-to-broaden` keeps its terminal and loses one of
 * its two refusal codes. Stated here so the integration expects it.
 */
export const ROUTER_ROWS_AFFECTED = [
  {
    row: 'W1-topic-only-nothing-left-to-broaden',
    terminalUnchanged: 'CAPABILITY_UNAVAILABLE',
    refusalRemoved: 'CONSTRAINT_UNTRANSPORTABLE',
    refusalRetained: 'MODEL_PRIOR_FORBIDDEN',
    why: 'the topic axis now has a producer, so the constraint transports; it still has no executor',
  },
] as const;
