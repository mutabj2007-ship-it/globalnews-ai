/**
 * DISCLOSURE GUARD — Contract 4 R2.
 *
 * Requirement: prove that INTERNAL_ONLY / protected / withheld evidence cannot enter
 *   1. model context      2. sources rail        3. durable contribution
 *   4. StoredResult       5. Saved / Recent
 *
 * THE GUARD IS A PARTITION, NOT A FILTER AT EACH SINK. Every sink payload is built from the
 * `releasable` partition only, and the `withheld` partition is never passed to a sink
 * constructor at all. Five independent filters would be five places to forget one; one
 * partition with five projections over it means a sink cannot see what it was never handed.
 *
 * Proven by CANARY rather than by inspecting a boolean: every non-reader-safe claim carries a
 * unique token, each of the five sink payloads is serialised, and probe DG-1 asserts the token
 * appears in none of them. A canary survives refactoring that a structural assertion would not.
 */

import type { SourcedHumClaim } from './ports.js';

/* ------------------------------------------------------------------ *
 * Classes and sinks
 * ------------------------------------------------------------------ */

/**
 * Only `READER_SAFE` may reach any sink. The other three are kept distinct rather than collapsed
 * into one "blocked" word, because the AUDIT channel must be able to say which rule applied —
 * and because collapsing them is how a later edit silently re-admits one of them.
 */
export type DisclosureClass =
  | 'READER_SAFE'
  /** Operational/internal annotation never intended for a reader. */
  | 'INTERNAL_ONLY'
  /** Protected location or population; E1's protected-geometry authority governs it. */
  | 'PROTECTED_LOCATION'
  /** Admitted but withheld by a standing policy decision. */
  | 'WITHHELD';

export type DisclosureSink =
  | 'MODEL_CONTEXT'
  | 'SOURCES_RAIL'
  | 'DURABLE_CONTRIBUTION'
  | 'STORED_RESULT'
  | 'SAVED_RECENT';

export const DISCLOSURE_SINKS: readonly DisclosureSink[] = [
  'MODEL_CONTEXT',
  'SOURCES_RAIL',
  'DURABLE_CONTRIBUTION',
  'STORED_RESULT',
  'SAVED_RECENT',
];

const DISCLOSURE_EXHAUSTIVE: Record<DisclosureClass, true> = {
  READER_SAFE: true,
  INTERNAL_ONLY: true,
  PROTECTED_LOCATION: true,
  WITHHELD: true,
};
export const DISCLOSURE_CLASSES: readonly DisclosureClass[] = Object.keys(
  DISCLOSURE_EXHAUSTIVE,
) as DisclosureClass[];

/**
 * The single admission rule. Deliberately NOT a per-sink table: a table invites a future row
 * that admits INTERNAL_ONLY to one sink "because it is only internal", and the five sinks are
 * not independent — the stored result is reopened into Saved/Recent and quoted back into model
 * context, so admitting to one is admitting to all.
 */
export function admissibleToSink(cls: DisclosureClass): boolean {
  return cls === 'READER_SAFE';
}

/* ------------------------------------------------------------------ *
 * Classified evidence
 * ------------------------------------------------------------------ */

export interface ClassifiedClaim {
  readonly claim: SourcedHumClaim;
  readonly disclosure: DisclosureClass;
}

export interface DisclosurePartition {
  readonly releasable: readonly SourcedHumClaim[];
  /**
   * Counts only, by class. **No identifiers, no text, no geography, no severity.** This is the
   * audit channel and it is NOT a sink: probe DG-4 asserts it never reaches a sink payload.
   */
  readonly withheldCountsByClass: Readonly<Record<DisclosureClass, number>>;
  readonly withheldTotal: number;
}

export function partitionByDisclosure(
  classified: readonly ClassifiedClaim[],
): DisclosurePartition {
  const releasable: SourcedHumClaim[] = [];
  const counts: Record<DisclosureClass, number> = {
    READER_SAFE: 0,
    INTERNAL_ONLY: 0,
    PROTECTED_LOCATION: 0,
    WITHHELD: 0,
  };

  for (const c of classified) {
    if (admissibleToSink(c.disclosure)) releasable.push(c.claim);
    else counts[c.disclosure] += 1;
  }

  const withheldTotal = DISCLOSURE_CLASSES.filter((k) => k !== 'READER_SAFE').reduce(
    (n, k) => n + counts[k],
    0,
  );
  return { releasable, withheldCountsByClass: counts, withheldTotal };
}

/* ------------------------------------------------------------------ *
 * Sink projections — each built from `releasable` ONLY
 * ------------------------------------------------------------------ */

export interface SinkPayloads {
  /** What may be placed in the model prompt. Claim text plus source refs, nothing else. */
  readonly MODEL_CONTEXT: readonly { readonly claim: string; readonly scope: string }[];
  /** What may be rendered in the Sources rail. References only. */
  readonly SOURCES_RAIL: readonly { readonly articleRef: string; readonly countryIso3: string }[];
  /** What may contribute to the durable plan. Reference identity only, no prose. */
  readonly DURABLE_CONTRIBUTION: readonly string[];
  /** What may be persisted in the StoredResult payload. */
  readonly STORED_RESULT: readonly { readonly claim: string; readonly sources: readonly string[] }[];
  /** What a Saved/Recent entry may carry. Deliberately the thinnest projection. */
  readonly SAVED_RECENT: readonly string[];
}

export function projectToSinks(partition: DisclosurePartition): SinkPayloads {
  const ok = partition.releasable;
  return {
    MODEL_CONTEXT: ok.map((c) => ({ claim: c.claim, scope: c.scope })),
    SOURCES_RAIL: ok.flatMap((c) =>
      c.sources.map((s) => ({ articleRef: s.articleRef, countryIso3: s.countryIso3 })),
    ),
    DURABLE_CONTRIBUTION: ok.flatMap((c) => c.sources.map((s) => s.articleRef)).sort(),
    STORED_RESULT: ok.map((c) => ({ claim: c.claim, sources: c.sources.map((s) => s.articleRef) })),
    SAVED_RECENT: ok.flatMap((c) => c.sources.map((s) => s.articleRef)).sort(),
  };
}

/* ------------------------------------------------------------------ *
 * The byte-identity consequence, stated rather than hidden
 * ------------------------------------------------------------------ */

/**
 * **THE ONE PLACE READER-FACING PRECISION IS DELIBERATELY TRADED FOR NON-DISCLOSURE, AND IT
 * NEEDS E1 RATIFICATION.**
 *
 * E1's accepted rule is byte-identity between a protected aggregation and an ordinary one. If
 * every matching claim is withheld, a reader-facing signal saying so would break that identity:
 * "2 records withheld for Location X" discloses that something protected exists at X, which is
 * the precise inference the rule exists to prevent.
 *
 * So this guard emits **no reader-facing signal derived from withheld content** — not a count,
 * not a boolean, not a class name. The audit channel keeps the truth.
 *
 * **The cost, named:** a situation whose every record is withheld becomes indistinguishable to a
 * reader from one with no records. That is the fail-closed direction, and it is the correct
 * default, but it does mean the reader-facing output is less informative than the data. The five
 * accepted absence states contain **no member meaning "present but not disclosable"**, so there
 * is nowhere truthful to put it. `RULING REQUIRED` — see DISCLOSURE-GUARD.md §4.
 */
export const WITHHELD_SIGNAL_IS_READER_FACING = false;

/** True when the guard removed everything, so the caller must not report AVAILABLE. */
export function everythingWithheld(partition: DisclosurePartition): boolean {
  return partition.releasable.length === 0 && partition.withheldTotal > 0;
}
