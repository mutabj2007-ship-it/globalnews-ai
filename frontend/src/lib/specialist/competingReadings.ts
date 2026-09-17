/**
 * SHARED · DISAGREEMENT — COMPETING READINGS BLOCK.
 *
 *     promoted   Part V §14 — "DISPUTED marks that a dispute exists; it does
 *                not carry two incompatible figures with their bases"
 *     contract   Shared Specialist Addendum §15
 *     rule       Part V §24 — incompatible estimates are NEVER silently averaged
 *
 * "TWO OR MORE CREDIBLE READINGS HELD OPEN · NEVER RESOLVED BY THE UI."
 *
 * ── WHY THE ARITHMETIC IS ABSENT RATHER THAN FORBIDDEN ────────────────────
 *
 * §15: "No averaging, no midpoint, no range synthesised across readings, no
 * default winner." §21 repeats it as a build prohibition. The obvious
 * implementation of that is a comment saying so; the implementation here is
 * that there is NO FUNCTION IN THIS MODULE THAT TAKES TWO READINGS AND RETURNS
 * A NUMBER. A midpoint cannot be added later without adding the first such
 * function, which a guard asserts does not exist.
 *
 * Part V's measured case is the reason: 180,000 registered arrivals against a
 * 260,000–310,000 survey estimate. The midpoint of those is not a worse
 * estimate — it is a figure that counts a population nobody counted, presented
 * with the authority of arithmetic.
 */

/** The UI may never set this. Only an authority ruling moves it off UNRESOLVED. */
export type ResolutionStatus = 'UNRESOLVED' | 'RULED';

export type ReadingSourceClass = 'OFFICIAL' | 'INDEPENDENT' | 'SELF_REPORTED' | 'EVIDENCE_BACKED';

export interface Reading {
  readonly readingId: string;
  readonly label: string;
  readonly value: string;
  /** Present when the reading is itself a range. NEVER synthesised across readings. */
  readonly valueRange?: string;
  readonly basis: string;
  /** Usually the actual point of difference — §15 says so explicitly. */
  readonly countingRule: string;
  readonly sourceClass: ReadingSourceClass;
  readonly sourceCount: number;
  readonly observedAt: string;
  readonly precision?: string;
  readonly provenanceRef: readonly string[];
}

export interface CompetingReadingsBlock {
  readonly subjectRef: string;
  readonly disputedField: string;
  readonly unit?: string;
  readonly readings: readonly Reading[];
  /**
   * REQUIRED. §15: "An agreed facts line is required, so a dispute over one
   * field does not discredit the whole object."
   *
   * An empty array is a valid value and renders the absence honestly; the field
   * being optional is what would let a surface quietly omit it.
   */
  readonly agreedFacts: readonly string[];
  readonly resolutionStatus: ResolutionStatus;
}

/** A block needs at least two readings; one reading is not a disagreement. */
export function blockIsValid(block: CompetingReadingsBlock): boolean {
  return block.readings.length >= 2;
}

/**
 * Whether every reading states what §15 requires of it.
 *
 * Basis AND counting rule, on every reading. A reading missing its counting
 * rule looks like a competing number when it may be a compatible one measured
 * differently, and the reader has no way to tell.
 */
export function readingsAreAccountable(block: CompetingReadingsBlock): boolean {
  return block.readings.every(
    (r) => r.basis.trim().length > 0 && r.countingRule.trim().length > 0 && r.sourceCount > 0,
  );
}

/**
 * DISPUTED IS HUELESS — HATCH ONLY.
 *
 * Part V §7.3, verbatim: it "must not read as severity, nor as provenance
 * CONTESTED-SOURCE, both of which are also present on this object". §15
 * generalises it: "Presentation is hueless hatch in every domain. It must not
 * read as severity, as OFF TRACK, or as a contested source."
 *
 * Exported as a constant so no consumer spells a colour here. Part IV's compact
 * rule coarsens the hatch to 3px rather than tinting it.
 */
export const DISPUTED_PRESENTATION = 'HUELESS_HATCH' as const;
export const DISPUTED_HATCH_PX = { desktop: 2, compact: 3 } as const;

/**
 * The HUD state slot for a disputed object.
 *
 * §15: "The HUD state slot shows the DISAGREEMENT, never one side of it." So
 * this returns the disputed field, not a value — there is no parameter through
 * which a winning reading could be passed.
 */
export function hudStateForDispute(block: CompetingReadingsBlock): string {
  return block.disputedField;
}
