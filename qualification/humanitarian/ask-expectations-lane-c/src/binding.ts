/**
 * FINAL SPECIALIST REGISTRATION PREDICATE — Contract 4 R2.
 *
 * "Bind only when reader-safe retained data exists AND E1 reader-clears the source."
 *
 * Two conjuncts, and the AND is the whole point: either alone has shipped a leak somewhere.
 * Data without clearance discloses un-cleared source material; clearance without data registers
 * a capability that answers nothing.
 */

import type { AvailabilityState, HumRefusalCode } from './ports.js';

/* ------------------------------------------------------------------ *
 * E1's clearance vocabulary — consumed, not invented
 * ------------------------------------------------------------------ */

/**
 * `CONTRACT 2` requires E1 to return exactly one of these per source. This union is E1's, held
 * here as a documented fixture; if E1 lands different spellings this is the single place to change.
 */
export type E1SourceClearance =
  | 'CLEARED_FOR_DEV_CAPTURE'
  | 'CLEARED_FOR_ALPHA_RUNTIME'
  | 'NOT_CLEARED'
  | 'CREDENTIAL_REQUIRED'
  | 'RIGHTS_CONFIRMATION_REQUIRED'
  | 'PROTECTION_AUTHORITY_REQUIRED';

const CLEARANCE_EXHAUSTIVE: Record<E1SourceClearance, true> = {
  CLEARED_FOR_DEV_CAPTURE: true,
  CLEARED_FOR_ALPHA_RUNTIME: true,
  NOT_CLEARED: true,
  CREDENTIAL_REQUIRED: true,
  RIGHTS_CONFIRMATION_REQUIRED: true,
  PROTECTION_AUTHORITY_REQUIRED: true,
};
export const E1_CLEARANCES: readonly E1SourceClearance[] = Object.keys(
  CLEARANCE_EXHAUSTIVE,
) as E1SourceClearance[];

/**
 * **READER CLEARANCE IS NARROWER THAN CLEARANCE, AND CONFLATING THEM IS THE BUG THIS FUNCTION
 * EXISTS TO PREVENT.**
 *
 * `CLEARED_FOR_DEV_CAPTURE` permits CAPTURE. It does not permit disclosure to a reader, and an
 * Ask answer is disclosure to a reader — on the public Standalone surface, no less. Treating
 * "cleared" as one idea would bind the tool on a dev-capture clearance and publish material E1
 * cleared only for a developer's database.
 *
 * So exactly one value reader-clears a source. Probe BP-2 asserts that, and mutation MU-31
 * admits `CLEARED_FOR_DEV_CAPTURE` and must be caught.
 */
export function readerClears(c: E1SourceClearance): boolean {
  return c === 'CLEARED_FOR_ALPHA_RUNTIME';
}

/* ------------------------------------------------------------------ *
 * The predicate
 * ------------------------------------------------------------------ */

export interface BindingPredicateInputs {
  /**
   * Reader-SAFE retained data, not merely retained data: rows that survive the disclosure
   * partition. A store holding only protected rows does not satisfy this.
   */
  readonly readerSafeRetainedDataExists: boolean;
  /** E1's ruling for the source behind that data. */
  readonly clearance: E1SourceClearance;
  /** A real governed bound store, as distinct from a stub that answers. */
  readonly governed: boolean;
}

export type BindingRefusalReason =
  | 'NOT_GOVERNED'
  | 'NO_READER_SAFE_RETAINED_DATA'
  | 'SOURCE_NOT_READER_CLEARED';

export interface SpecialistBinding {
  readonly domainId: 'HUMANITARIAN';
  readonly registered: boolean;
  readonly bound: boolean;
  readonly availability: AvailabilityState;
  /** Every failed conjunct, not just the first. An operator needs the whole list. */
  readonly refusedBecause: readonly BindingRefusalReason[];
  readonly refusal: HumRefusalCode | null;
  /**
   * The FROZEN Ask terminal when Humanitarian is unavailable. Ruled for R2: this stays
   * `CAPABILITY_UNAVAILABLE`. Lane C does not emit `PLAN_NOT_SATISFIABLE` and does not reopen
   * that question — see SPECIALIST-BINDING.md §5.
   */
  readonly askTerminal: 'CAPABILITY_UNAVAILABLE' | null;
}

export function resolveSpecialistBinding(i: BindingPredicateInputs): SpecialistBinding {
  const refused: BindingRefusalReason[] = [];
  if (!i.governed) refused.push('NOT_GOVERNED');
  if (!i.readerSafeRetainedDataExists) refused.push('NO_READER_SAFE_RETAINED_DATA');
  if (!readerClears(i.clearance)) refused.push('SOURCE_NOT_READER_CLEARED');

  if (refused.length > 0) {
    return {
      domainId: 'HUMANITARIAN',
      registered: false,
      bound: false,
      availability: i.governed ? 'NO_DATA_FOR_GEOGRAPHY' : 'NOT_CONNECTED',
      refusedBecause: refused,
      refusal: i.governed ? 'NO_DATA_FOR_GEOGRAPHY' : 'SPECIALIST_NOT_BOUND',
      askTerminal: 'CAPABILITY_UNAVAILABLE',
    };
  }

  return {
    domainId: 'HUMANITARIAN',
    registered: true,
    bound: true,
    availability: 'AVAILABLE',
    refusedBecause: [],
    refusal: null,
    askTerminal: null,
  };
}

/**
 * E1's measured R2 source matrix (`E1-HUMANITARIAN-READER-CLEARANCE-R2`, base `58f80fd4`,
 * HEAD `340182c`). Carried verbatim, not guessed.
 *
 * | source | R2 verdict | reader-cleared |
 * |---|---|---|
 * | GDACS | `RIGHTS_CONFIRMATION_REQUIRED` (was `CLEARED_FOR_DEV_CAPTURE` in R1) | no |
 * | ReliefWeb | `CREDENTIAL_REQUIRED` | no |
 * | Copernicus EMS | `PROTECTION_AUTHORITY_REQUIRED` | no |
 *
 * **No source is `CLEARED_FOR_ALPHA_RUNTIME`; `READER_CLEARED_SOURCE_IDS` is `[]`.**
 */
export const E1_MEASURED_MATRIX_R2: Readonly<Record<string, E1SourceClearance>> = {
  GDACS: 'RIGHTS_CONFIRMATION_REQUIRED',
  RELIEFWEB: 'CREDENTIAL_REQUIRED',
  COPERNICUS_EMS: 'PROTECTION_AUTHORITY_REQUIRED',
};

/** Probe BP-6: E1's matrix contains no reader-cleared source. */
export function readerClearedSourceIds(
  matrix: Readonly<Record<string, E1SourceClearance>> = E1_MEASURED_MATRIX_R2,
): readonly string[] {
  return Object.keys(matrix).filter((k) => readerClears(matrix[k] as E1SourceClearance)).sort();
}

/**
 * Today's measured inputs.
 *
 * CORRECTED IN R2 from `NOT_CLEARED` to GDACS's actual verdict. R1 named the wrong gate: the
 * conclusion (not registered) was right, but `NOT_CLEARED` hid WHICH authority stands in the way.
 * `RIGHTS_CONFIRMATION_REQUIRED` names it — rights, not protection, not credentials — and that is
 * the difference between a question for the Product Owner and a question for an engineer.
 *
 * `readerSafeRetainedDataExists: false` — `HumanitarianRetainedRead.observations` is typed
 * `readonly never[]` and `NO_RETAINED_CAPTURE_APPROVAL` means nothing can be admitted.
 * `governed: false` — no DB binding, producer uncommitted, `gx14-authority-store.sql` unapplied.
 *
 * All three conjuncts fail. The tool is **not registered**, and that is the truthful answer.
 */
export const MEASURED_INPUTS_TODAY: BindingPredicateInputs = {
  readerSafeRetainedDataExists: false,
  clearance: 'RIGHTS_CONFIRMATION_REQUIRED',
  governed: false,
};
