/**
 * ════════════════════════════════════════════════════════════════════════════
 * M08 · THE DOMAIN-NEUTRAL ABSENCE VOCABULARY — ONE HOME, NO TWINS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED for `shared/src/observation/absence.ts`.
 * Nothing lands without authorization. No provider. No activation. No deployment.
 *
 * AUTHORITY
 *   MAIN-SHARED-ABSENCE-M08-CLOSEOUT-R1, resolving the collision Main filed as M08 in
 *   `MAIN-ENERGY-PARTXI-E1-L-CLOSEOUT-R2` §4 — between Main's own Security authority
 *   (which ruled the path `shared/src/security/absence.ts`) and Main's own Energy
 *   reconciliation (which ruled *"land ONCE, domain-neutral; do not land SEC_* then ENE_*
 *   absence twins"*).
 *
 * ── WHAT WAS MEASURED ─────────────────────────────────────────────────────
 *
 *   OBSERVATION_ABSENCE_STATES / SHARED_ABSENCE_STATES / DOMAIN_ABSENCE_STATES .... 0 commits
 *   POSITIVE CONTROL  SECURITY_ABSENCE_STATES ...................................... 1 commit
 *   POSITIVE CONTROL  SPATIAL_PRECISION_LADDER ..................................... 2 commits
 *   absence.ts files EVER ADDED, at any path, on any ref ...... exactly ONE:
 *       shared/src/security/absence.ts
 *
 * **The domain-neutral union has never been written.** The `SEC_*` half landed and the
 * neutral half did not, which is precisely the asymmetry that made M08 a collision rather
 * than a duplicate: there are not two authorities, there is one authority at the wrong
 * altitude.
 *
 * ── THE RESOLUTION, IN ONE LINE ───────────────────────────────────────────
 *
 * **Security's semantics are not weakened and its file is not deleted.** Four of its five
 * members are domain-neutral and become aliases of the members declared here; one is
 * neutral in SHAPE but domain-specific in DENOTATION and stays Security's; and two members
 * this contract adds have no Security counterpart at all.
 *
 * Nothing is duplicated, because an alias is not a copy: `SEC_COVERAGE_GAP` becomes a name
 * FOR `COVERAGE_GAP`, not a second declaration of it.
 */

/**
 * THE SEVEN, ORDERED BY WHAT THEY CLAIM — WEAKEST CLAIM FIRST.
 *
 * ORDER IS MEANING, and it is the same discipline the landed Security file states:
 * *"they are NOT interchangeable degradations of each other."* A degradation may only ever
 * move DOWN this list, toward claiming less.
 *
 * `ASSESSED_NOTHING_QUALIFIED` is the only POSITIVE finding and it is last, because it is
 * the only member a reader could act on as reassurance — and therefore the only one that
 * must be unreachable without evidence. See `admitAssessedNothingQualified`.
 */
export const OBSERVATION_ABSENCE_STATES = [
  /** We have not looked. Claims nothing about the world. */
  'NOT_ASSESSED',
  /** No source is wired for this scope at all. INTERNAL — see `readerAbsence`. */
  'SOURCE_NOT_CONNECTED',
  /** A wired source did not answer this time. INTERNAL — see `readerAbsence`. */
  'SOURCE_TEMPORARILY_UNAVAILABLE',
  /** We cannot see this scope: the coverage itself is missing. */
  'COVERAGE_GAP',
  /** Something exists and is not displayable here. INTERNAL — see `readerAbsence`. */
  'EVIDENCE_WITHHELD',
  /** Evidence was examined and none met the evidentiary floor. */
  'NO_QUALIFYING_EVIDENCE',
  /** POSITIVE: checked, coverage adequate, and nothing qualified. Admissibility-gated. */
  'ASSESSED_NOTHING_QUALIFIED',
] as const;

export type ObservationAbsenceState = (typeof OBSERVATION_ABSENCE_STATES)[number];

/**
 * WHAT EACH MEMBER ASSERTS ABOUT THE WORLD. Neutral, and therefore shared.
 *
 * Note what is NOT here: reader LABELS. Those are each domain's own text in its own
 * language, and hoisting them would make English an authority — the mistake M01 was
 * resolved to avoid. Security keeps `SECURITY_ABSENCE_LABELS`; Energy will have its own.
 * **This module carries no reader-facing string at all.**
 */
export const OBSERVATION_ABSENCE_ASSERTS: Readonly<Record<ObservationAbsenceState, string>> = {
  NOT_ASSESSED: 'nothing has been assessed',
  SOURCE_NOT_CONNECTED: 'no source is wired for this scope',
  SOURCE_TEMPORARILY_UNAVAILABLE: 'a wired source did not answer',
  COVERAGE_GAP: 'we cannot see',
  EVIDENCE_WITHHELD: 'something exists and is not displayable',
  NO_QUALIFYING_EVIDENCE: 'evidence was examined and none qualified',
  ASSESSED_NOTHING_QUALIFIED: 'a POSITIVE finding: checked, coverage adequate, nothing qualified',
};

/**
 * THE FLOOR. Not a default — a named floor.
 *
 * *"A default is what you get when nobody decided; a floor is what you get when nobody
 * COULD decide, and it is chosen to be the least reassuring member rather than the most
 * convenient one."* The landed Security file's words, reused because they are right.
 *
 * There is deliberately NO default export, no `?? ` fallback anywhere in this file, and no
 * accessor that answers for "no state". A caller with nothing to pass passes this, which is
 * a decision it has to write down.
 *
 * IT IS DECLARED AS A LITERAL, NOT AS THE WIDE UNION, AND THAT IS LOAD-BEARING.
 * Typed `ObservationAbsenceState`, the floor could later be changed to a member a consuming
 * domain does not have, and every alias built on it would break at a distance. Typed as the
 * literal, a domain can prove ITS fallback IS this one — Security's does — and a change here
 * is a type error at every consumer rather than a runtime surprise. The compiler caught this
 * while the compatibility shim was first written, which is the only reason it is not a wide
 * type today.
 */
export const OBSERVATION_ABSENCE_FLOOR = 'NOT_ASSESSED' as const satisfies ObservationAbsenceState;

/**
 * SILENCE MUST NOT IMPLY NORMAL, SAFE, STABLE, NO OUTAGE OR NO EVENT.
 *
 * Carried as data so a guard asserts against a name rather than a comment, and so a reviewer
 * can see the list the contract is being held to.
 */
export const ABSENCE_MUST_NOT_IMPLY: readonly string[] = [
  'normal',
  'safe',
  'stable',
  'no outage',
  'no event',
] as const;

/**
 * The single member that could be read as reassurance, named so a guard can find it.
 *
 * Every other member claims ignorance of some kind. This one claims knowledge, which is why
 * it is the only one with an admissibility gate.
 */
export const ONLY_REASSURING_ABSENCE_STATE = 'ASSESSED_NOTHING_QUALIFIED' as const satisfies ObservationAbsenceState;

/** The evidence a positive finding must name. Without all three it is not admissible. */
export interface AssessedNothingQualifiedEvidence {
  /** When the check happened. */
  readonly checkedAt: string;
  /** What was reviewed — the domain's own words for its subject. */
  readonly reviewed: string;
  /** Whether coverage was adequate. `false` means this is a COVERAGE_GAP, not a finding. */
  readonly sourcesAdequate: boolean;
}

/**
 * THE ONLY WAY TO REACH THE REASSURING MEMBER.
 *
 * A caller that cannot supply the evidence does not get the finding — it gets the FLOOR, and
 * it gets it **by asking rather than by omission**. This is what stops silence implying
 * safety: the reassuring state is not merely discouraged, it is unreachable without
 * naming when the check happened, what was reviewed, and that coverage was adequate.
 *
 * Degradation goes to the FLOOR and not to `NO_QUALIFYING_EVIDENCE`, because *"we checked
 * and found nothing admissible"* is a STRONGER claim than *"we did not check"* — and the
 * difference is exactly the one a reader would act on. Security states this rule and it is
 * reused verbatim.
 */
export function admitAssessedNothingQualified(
  evidence: Partial<AssessedNothingQualifiedEvidence>,
): ObservationAbsenceState {
  const complete =
    typeof evidence.checkedAt === 'string' &&
    evidence.checkedAt.trim().length > 0 &&
    typeof evidence.reviewed === 'string' &&
    evidence.reviewed.trim().length > 0 &&
    evidence.sourcesAdequate === true;
  return complete ? ONLY_REASSURING_ABSENCE_STATE : OBSERVATION_ABSENCE_FLOOR;
}

export function isObservationAbsenceState(value: string): value is ObservationAbsenceState {
  return (OBSERVATION_ABSENCE_STATES as readonly string[]).includes(value);
}

/**
 * Degradation, in the one direction it may travel: toward claiming less.
 *
 * Returns `null` rather than a boolean-ish guess when the target claims MORE than the
 * source — a caller must not be able to launder a weak state into a strong one by passing
 * it through a function named "degrade".
 */
export function degradeTo(
  from: ObservationAbsenceState,
  to: ObservationAbsenceState,
): ObservationAbsenceState | null {
  const a = OBSERVATION_ABSENCE_STATES.indexOf(from);
  const b = OBSERVATION_ABSENCE_STATES.indexOf(to);
  return b <= a ? to : null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE READER PROJECTION — DELIBERATELY LOSSY, AND THAT IS THE POINT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * E1's accepted disclosure rules, applied here rather than left to each surface:
 *
 *   D-1  a security withholding must not be DISTINGUISHABLE from an ordinary absence.
 *        A distinguishable withhold is an ORACLE: it names precisely the set you were
 *        protecting, and it names it to everyone.
 *   D-3  `COVERAGE_GAP` must be reachable for BENIGN reasons on the same surface. A state
 *        whose only members are sensitive is a security label wearing a neutral name.
 *   D-4  the canonical member survives INTERNALLY so telemetry keeps a distinction the
 *        reader does not get — and must not be reachable from the reader's payload.
 *
 * So the canonical union above is the INTERNAL vocabulary: complete and fully
 * distinguishable. What a reader sees is this projection, and it is **non-injective on
 * purpose.** A lossless projection would let a reader invert it and recover the withhold.
 */

export type ReaderAbsenceState = 'NOT_ASSESSED' | 'COVERAGE_GAP' | 'ASSESSED_NOTHING_QUALIFIED';

/** Members that must NEVER reach a reader as themselves. */
export const INTERNAL_ONLY_ABSENCE_STATES: readonly ObservationAbsenceState[] = [
  'EVIDENCE_WITHHELD',
  'SOURCE_NOT_CONNECTED',
  'SOURCE_TEMPORARILY_UNAVAILABLE',
] as const;

export function readerAbsence(state: ObservationAbsenceState): ReaderAbsenceState {
  switch (state) {
    case 'EVIDENCE_WITHHELD':
    case 'SOURCE_NOT_CONNECTED':
    case 'SOURCE_TEMPORARILY_UNAVAILABLE':
    case 'COVERAGE_GAP':
    case 'NO_QUALIFYING_EVIDENCE':
      return 'COVERAGE_GAP';
    case 'ASSESSED_NOTHING_QUALIFIED':
      return 'ASSESSED_NOTHING_QUALIFIED';
    case 'NOT_ASSESSED':
      return 'NOT_ASSESSED';
  }
}

/**
 * ENTITLEMENT IS NOT ABSENCE, AND IT IS EXCLUDED DELIBERATELY.
 *
 * Part XI renders a violet `UNAVAILABLE · LICENSED`. It is tempting to add it here and it
 * must not be added: it answers *"may we"*, not *"do we know"*. `MAIN-ENERGY-PARTXI-E1-L-
 * CLOSEOUT-R2` §B separated rights from exposure precisely so a licence could not move a
 * security gate, and folding entitlement back into the absence union would re-collapse the
 * axis that separation opened.
 *
 * A rights-blocked series carries `rights: RIGHTS_BLOCKED` on its disclosure record. Its
 * absence state, if it has one, is a separate fact about what we know.
 */
export const ENTITLEMENT_IS_NOT_AN_ABSENCE_STATE = true as const;

/**
 * `NO_MATERIAL_CHANGE` IS NOT A MEMBER, AND THE EXCLUSION IS LOAD-BEARING.
 *
 * It is a CHANGE state — *did it move* — not an absence state — *do we know*. The landed
 * Security file already refuses it by name, and `MAIN-TIMELINE-CHRONOLOGY-CANONICAL-R1` §D
 * gave change its own two-axis model. Rendering a coverage gap as `NO_MATERIAL_CHANGE`
 * converts *"we did not look"* into *"we looked and nothing happened"*: the A-24 collapse.
 *
 * The constant exists so a guard can assert the exclusion against a name.
 */
export const ABSENCE_FORBIDDEN_CHANGE_STATE = 'NO_MATERIAL_CHANGE' as const;
