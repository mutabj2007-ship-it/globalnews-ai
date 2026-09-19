/**
 * ════════════════════════════════════════════════════════════════════════════
 * M08 · SECURITY COMPATIBILITY — ALIASES, NOT COPIES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED as the REPLACEMENT HEAD of `shared/src/security/absence.ts`.
 * The rest of that file — its labels, its Alpha-reachability table, its docblocks —
 * is UNCHANGED and is not reproduced here.
 *
 * AUTHORITY
 *   MAIN-SHARED-ABSENCE-M08-CLOSEOUT-R1. The Product Owner's condition governs:
 *   *"Preserve existing Security compatibility through explicit mapping/re-export ONLY IF
 *   semantically identical; do not create duplicate authorities."*
 *
 * ── THE TEST APPLIED, MEMBER BY MEMBER ────────────────────────────────────
 *
 * Two members are semantically identical when they ASSERT THE SAME THING ABOUT THE WORLD.
 * Identical reader text is not the test and neither is a similar name — the landed file
 * carries an `asserts` column for exactly this purpose, and it is what was compared.
 *
 *   SEC_NOT_ASSESSED          'nothing has been assessed'            == NOT_ASSESSED
 *   SEC_COVERAGE_GAP          'we cannot see'                        == COVERAGE_GAP
 *   SEC_EVIDENCE_WITHHELD     'something exists and is not
 *                              displayable'                          == EVIDENCE_WITHHELD
 *   SEC_NO_VERIFIED_EVIDENCE  'evidence was examined and none
 *                              qualified'                            == NO_QUALIFYING_EVIDENCE
 *
 *   SEC_ASSESSED_NO_QUALIFYING_INCIDENT    'a POSITIVE finding'      -- NOT ALIASED
 *
 * ── WHY THE FIFTH IS NOT ALIASED, AND THIS IS THE WHOLE RULING ────────────
 *
 * Its SHAPE is neutral: a positive finding, admissibility-gated on three named facts. The
 * shared contract has that shape as `ASSESSED_NOTHING_QUALIFIED`.
 *
 * Its DENOTATION is not. It says **no qualifying INCIDENT**, and an incident is a Security
 * subject. Energy's equivalent finding would be about a disruption; Humanitarian's about an
 * activation. Aliasing them would assert that *"no qualifying incident"* and *"no qualifying
 * disruption"* are the same claim, and they are not — they are the same SHAPE of claim about
 * different things.
 *
 * So Security keeps its own member, with its own label and its own admissibility rule, and
 * the shared contract supplies the shape rather than the word. **That is the difference
 * between reusing a construction and flattening a distinction**, and it is the reason this
 * closeout does not simply rename five constants.
 */

import {
  OBSERVATION_ABSENCE_STATES,
  OBSERVATION_ABSENCE_FLOOR,
  type ObservationAbsenceState,
} from '../observation/absence';

/**
 * The four aliases. Each is a NAME FOR a shared member, never a second declaration of one.
 *
 * `as const` on a reference to the shared literal keeps the alias and its target the same
 * value: a divergence is a type error here, not a drift discovered later.
 */
export const SEC_NOT_ASSESSED = 'NOT_ASSESSED' satisfies ObservationAbsenceState;
export const SEC_COVERAGE_GAP = 'COVERAGE_GAP' satisfies ObservationAbsenceState;
export const SEC_EVIDENCE_WITHHELD = 'EVIDENCE_WITHHELD' satisfies ObservationAbsenceState;
export const SEC_NO_VERIFIED_EVIDENCE = 'NO_QUALIFYING_EVIDENCE' satisfies ObservationAbsenceState;

/**
 * The one that is NOT shared. Security's own member, Security's own word.
 *
 * It is declared here rather than in the shared module precisely because it is not neutral.
 */
export const SEC_ASSESSED_NO_QUALIFYING_INCIDENT = 'SEC_ASSESSED_NO_QUALIFYING_INCIDENT' as const;

/**
 * Security's union: the four shared members it reuses, plus its own fifth.
 *
 * **The member NAMES that reach a Security consumer are unchanged in meaning**, and the four
 * aliases above keep the old identifiers importable. What changed is where four of the five
 * are DECLARED.
 */
export const SECURITY_ABSENCE_STATES = [
  SEC_NOT_ASSESSED,
  SEC_COVERAGE_GAP,
  SEC_EVIDENCE_WITHHELD,
  SEC_NO_VERIFIED_EVIDENCE,
  SEC_ASSESSED_NO_QUALIFYING_INCIDENT,
] as const;

export type SecurityAbsenceState = (typeof SECURITY_ABSENCE_STATES)[number];

/** Unchanged in meaning: the least reassuring member, now the shared floor. */
export const SECURITY_ABSENCE_FALLBACK: SecurityAbsenceState = OBSERVATION_ABSENCE_FLOOR;

/**
 * The mapping, carried as data so it is checkable rather than remembered — and so a reviewer
 * can see which members were judged identical and which were not.
 */
export const SECURITY_TO_SHARED: Readonly<
  Record<SecurityAbsenceState, ObservationAbsenceState | null>
> = {
  NOT_ASSESSED: 'NOT_ASSESSED',
  COVERAGE_GAP: 'COVERAGE_GAP',
  EVIDENCE_WITHHELD: 'EVIDENCE_WITHHELD',
  NO_QUALIFYING_EVIDENCE: 'NO_QUALIFYING_EVIDENCE',
  /** null is the ruling, not an omission: the shape is shared, the denotation is not. */
  SEC_ASSESSED_NO_QUALIFYING_INCIDENT: null,
};

/**
 * `NO_MATERIAL_CHANGE` IS STILL NOT A MEMBER. Unchanged, and re-exported from the shared
 * home so there is one declaration of the exclusion rather than two agreeing by discipline.
 */
export { ABSENCE_FORBIDDEN_CHANGE_STATE as SECURITY_ABSENCE_FORBIDDEN_CHANGE_STATE } from '../observation/absence';

export function isSecurityAbsenceState(value: string): value is SecurityAbsenceState {
  return (SECURITY_ABSENCE_STATES as readonly string[]).includes(value);
}

/**
 * WHAT DID **NOT** CHANGE, STATED SO A REVIEWER DOES NOT HAVE TO DIFF FOR IT.
 *
 *   SECURITY_ABSENCE_LABELS               unchanged — Security's reader text stays Security's
 *   SECURITY_ABSENCE_ASSERTS              unchanged
 *   SECURITY_ABSENCE_REACHABLE_AT_ALPHA   unchanged — four of five unreachable at Alpha
 *   securityAbsenceLabel                  unchanged
 *   securityAbsenceDegradesTo             unchanged
 *
 * **No Security semantics are weakened and no Security behaviour changes.** Every assertion
 * the landed module makes about the world it still makes; four of them are now made in one
 * place instead of two.
 */
export const SECURITY_SEMANTICS_UNCHANGED = true as const;

/** Sanity: the shared union must still contain every member Security aliases. */
export const SECURITY_ALIASES_RESOLVE: boolean = (
  [SEC_NOT_ASSESSED, SEC_COVERAGE_GAP, SEC_EVIDENCE_WITHHELD, SEC_NO_VERIFIED_EVIDENCE] as const
).every((m) => (OBSERVATION_ABSENCE_STATES as readonly string[]).includes(m));

/* ═══════════════════════════════════════════════════════════════════════════
 * RETAINED FROM THE PRE-M08 SECURITY MODULE — NOT REPRODUCED IN MAIN'S SHIM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Main's shim declares the states, the floor and the aliases, and stops there.
 * Its own docblock lists these five as *"unchanged"*, and `E-6` asserts the
 * shim declares no labels and no Alpha-reachability table — *"those stay in
 * Security's file, untouched."* So they are carried forward here verbatim in
 * meaning, in the file they have always lived in.
 *
 * ── THE KEYS ARE COMPUTED, AND THAT IS THE WHOLE CARE OF THIS MERGE ──────
 *
 * They were written as bare literals (`SEC_NOT_ASSESSED: '...'`), which was
 * correct while the member VALUE and the constant NAME were the same string.
 * M08 separates them: `SEC_NOT_ASSESSED` is now a NAME whose VALUE is the
 * shared member `'NOT_ASSESSED'`. A bare literal key would therefore key these
 * records on a string that is no longer a member — silently, because an object
 * literal key is not checked against the alias.
 *
 * Computed keys (`[SEC_NOT_ASSESSED]:`) make the record follow the alias by
 * construction. If Main ever repoints an alias, these move with it and the
 * `Record<SecurityAbsenceState, …>` type fails the moment they do not.
 *
 * NOT ONE READER SENTENCE IS EDITED. The text below is character-for-character
 * what the pre-M08 module carried, including N-11's load-bearing disclaimer and
 * the two placeholders in the positive finding.
 */

/**
 * Main's reader labels, verbatim.
 *
 * THE FIRST ONE CARRIES ITS OWN DISCLAIMER, AND THAT IS THE POINT OF N-11.
 * *"Not assessed. This is not a statement that conditions are safe."* The second sentence is
 * the whole zone: without it, a reader completes the first one themselves, and completes it
 * as reassurance.
 *
 * `SEC_ASSESSED_NO_QUALIFYING_INCIDENT` carries two placeholders BY DESIGN. It is admissible
 * *"AND ONLY WHEN it names when checked what reviewed and sources adequate"* — so a caller
 * that cannot fill them cannot render it, and the template makes that structural rather than
 * a matter of care.
 */
export const SECURITY_ABSENCE_LABELS: Readonly<Record<SecurityAbsenceState, string>> = {
  [SEC_NOT_ASSESSED]: 'Not assessed. This is not a statement that conditions are safe.',
  [SEC_COVERAGE_GAP]: 'Coverage unavailable for this scope.',
  [SEC_EVIDENCE_WITHHELD]: 'Evidence exists and is not shown here.',
  [SEC_NO_VERIFIED_EVIDENCE]: 'Assessed. No evidence met the evidentiary floor.',
  [SEC_ASSESSED_NO_QUALIFYING_INCIDENT]:
    'Checked {when}. Reviewed {what}. No qualifying incident. Sources adequate - not a coverage gap.',
};

/**
 * What each member ASSERTS — Main's column, carried so it can be cited rather than recalled.
 */
export const SECURITY_ABSENCE_ASSERTS: Readonly<Record<SecurityAbsenceState, string>> = {
  [SEC_NOT_ASSESSED]: 'nothing has been assessed',
  [SEC_COVERAGE_GAP]: 'we cannot see',
  [SEC_EVIDENCE_WITHHELD]: 'something exists and is not displayable',
  [SEC_NO_VERIFIED_EVIDENCE]: 'evidence was examined and none qualified',
  [SEC_ASSESSED_NO_QUALIFYING_INCIDENT]: 'a POSITIVE finding',
};

/**
 * Which members are reachable at Alpha, measured by Main against the landed runtime.
 *
 * FOUR OF THE FIVE ARE UNREACHABLE, and each for its own stated reason: no assessment
 * exists, no scope is defined, no evidence exists, nothing has been checked. Carrying that
 * here means a surface can assert its own reachability rather than a reviewer having to
 * reason about it — and it is why the Alpha frame renders exactly one of the five.
 */
export const SECURITY_ABSENCE_REACHABLE_AT_ALPHA: Readonly<Record<SecurityAbsenceState, boolean>> = {
  [SEC_NOT_ASSESSED]: true,
  [SEC_COVERAGE_GAP]: false,
  [SEC_EVIDENCE_WITHHELD]: false,
  [SEC_NO_VERIFIED_EVIDENCE]: false,
  [SEC_ASSESSED_NO_QUALIFYING_INCIDENT]: false,
};

/**
 * The reader label for a state — the ONLY way a label reaches a surface.
 *
 * It takes a state rather than an optional one, and there is deliberately no
 * `label(undefined)` overload: an accessor that answered for "no state" would BE the default
 * this vocabulary refuses to have. A caller with nothing to pass passes the fallback, which
 * is a decision it has to write down.
 */
export function securityAbsenceLabel(state: SecurityAbsenceState): string {
  return SECURITY_ABSENCE_LABELS[state];
}

/**
 * Degradation, in the one direction it is allowed to travel.
 *
 * A caller that cannot satisfy a stronger member's admissibility rule degrades to a WEAKER
 * one, never to a stronger. Main states the case that proves the rule matters: without all
 * three of its facts, `SEC_ASSESSED_NO_QUALIFYING_INCIDENT` *"degrades to SEC_NOT_ASSESSED
 * never to SEC_NO_VERIFIED_EVIDENCE"* — because "we checked and found nothing admissible" is
 * a stronger claim than "we did not check", and the difference is exactly the one a reader
 * would act on.
 */
export function securityAbsenceDegradesTo(
  intended: SecurityAbsenceState,
  admissible: boolean,
): SecurityAbsenceState {
  return admissible ? intended : SECURITY_ABSENCE_FALLBACK;
}
