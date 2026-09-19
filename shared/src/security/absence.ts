/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-11 — THE SECURITY ABSENCE VOCABULARY. FIVE MEMBERS, CLOSED, NO DEFAULT.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * AUTHORITY. `MAIN-SECURITY-PARTIX-FINAL-VISUAL-AUTHORITY-R1`
 * (`6f63613d2c31c41a679e299b36f178989f99de18e0d7711c73b6fa07c812d7b3`), file
 * `02-N11-ABSENCE-VOCABULARY.md` and `manifest/ABSENCE-VOCABULARY.tsv`. Every member, every
 * reader label and every admissibility rule below is Main's, transcribed. Nothing here is
 * this lane's judgement.
 *
 * WHY IT LIVES HERE AND NOT IN THE FRONTEND. Main's zone authority says it in one line:
 * *"Must not declare the absence union locally — it has one home,
 * `shared/src/security/absence.ts`."* A reader-facing absence vocabulary that lived beside
 * the component that renders it would be re-declared by the next surface that needed it,
 * and the two copies would agree only by discipline. This is that home.
 *
 * THE FILE IS NEW. The accepted Security module at `integration/alpha-convergence-2`
 * `3db5a09` carries `index.ts`, `lifecycle.ts` and two specs, and none of them declares
 * these five tokens — they are a PRESENTATION vocabulary and the landed module is a data
 * and assessment-honesty contract. Main ruled the path; this file is that ruling applied,
 * and it adds nothing Main did not rule.
 *
 * ── THE ONE RULE THAT ORDERS ALL FIVE ─────────────────────────────────────
 *
 * *"The fallback must always represent the most ignorant state, never the most
 * reassuring."* Every one of these tokens says something different about what we know, and
 * they are NOT interchangeable degradations of each other. Degrading toward a stronger
 * claim is the A-24 collapse E1 named: in a security product, **silence renders as safety**,
 * which is the most dangerous failure available.
 *
 * So there is no default. A caller that cannot establish a stronger state gets
 * `SEC_NOT_ASSESSED`, and it gets it by asking rather than by omission.
 */

/**
 * The five, in order of increasing epistemic strength.
 *
 * ORDER IS MEANING HERE. `SEC_NOT_ASSESSED` claims least; `SEC_ASSESSED_NO_QUALIFYING_INCIDENT`
 * claims most, and is the only one of the five that is a POSITIVE finding. A degradation may
 * only ever move DOWN this list.
 */
export const SECURITY_ABSENCE_STATES = [
  'SEC_NOT_ASSESSED',
  'SEC_COVERAGE_GAP',
  'SEC_EVIDENCE_WITHHELD',
  'SEC_NO_VERIFIED_EVIDENCE',
  'SEC_ASSESSED_NO_QUALIFYING_INCIDENT',
] as const;

export type SecurityAbsenceState = (typeof SECURITY_ABSENCE_STATES)[number];

/**
 * THE FALLBACK. Not a default — a named floor.
 *
 * The distinction is not pedantry. A default is what you get when nobody decided; a floor is
 * what you get when nobody COULD decide, and it is chosen to be the least reassuring member
 * rather than the most convenient one. `SEC_NOT_ASSESSED` asserts that nothing has been
 * assessed, which is true whatever the world is doing.
 */
export const SECURITY_ABSENCE_FALLBACK: SecurityAbsenceState = 'SEC_NOT_ASSESSED';

/**
 * Main's reader labels, verbatim.
 *
 * THE FIRST ONE CARRIES ITS OWN DISCLAIMER, AND THAT IS THE POINT OF N-11.
 * *"Not assessed. This is not a statement that conditions are safe."* The second sentence is
 * the whole zone: without it, a reader completes the first one themselves, and completes it
 * as reassurance. Main marks it `N-11 load-bearing … resident non-dismissible … survives
 * every reduction incl PEEK 152 and 390px.`
 *
 * `SEC_ASSESSED_NO_QUALIFYING_INCIDENT` carries two placeholders BY DESIGN. It is admissible
 * *"AND ONLY WHEN it names when checked what reviewed and sources adequate"* — so a caller
 * that cannot fill them cannot render it, and the template makes that structural rather than
 * a matter of care.
 */
export const SECURITY_ABSENCE_LABELS: Readonly<Record<SecurityAbsenceState, string>> = {
  SEC_NOT_ASSESSED: 'Not assessed. This is not a statement that conditions are safe.',
  SEC_COVERAGE_GAP: 'Coverage unavailable for this scope.',
  SEC_EVIDENCE_WITHHELD: 'Evidence exists and is not shown here.',
  SEC_NO_VERIFIED_EVIDENCE: 'Assessed. No evidence met the evidentiary floor.',
  SEC_ASSESSED_NO_QUALIFYING_INCIDENT:
    'Checked {when}. Reviewed {what}. No qualifying incident. Sources adequate - not a coverage gap.',
};

/**
 * What each member ASSERTS — Main's column, carried so it can be cited rather than recalled.
 */
export const SECURITY_ABSENCE_ASSERTS: Readonly<Record<SecurityAbsenceState, string>> = {
  SEC_NOT_ASSESSED: 'nothing has been assessed',
  SEC_COVERAGE_GAP: 'we cannot see',
  SEC_EVIDENCE_WITHHELD: 'something exists and is not displayable',
  SEC_NO_VERIFIED_EVIDENCE: 'evidence was examined and none qualified',
  SEC_ASSESSED_NO_QUALIFYING_INCIDENT: 'a POSITIVE finding',
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
  SEC_NOT_ASSESSED: true,
  SEC_COVERAGE_GAP: false,
  SEC_EVIDENCE_WITHHELD: false,
  SEC_NO_VERIFIED_EVIDENCE: false,
  SEC_ASSESSED_NO_QUALIFYING_INCIDENT: false,
};

/**
 * `NO_MATERIAL_CHANGE` IS NOT A MEMBER, AND THE EXCLUSION IS LOAD-BEARING.
 *
 * Main: *"a CHANGE STATE from the shared seven — did it move, not do we know … Rendering a
 * coverage gap as NO_MATERIAL_CHANGE is the exact A-24 collapse."* The two answer different
 * questions, and substituting one for the other converts "we did not look" into "we looked
 * and nothing happened".
 *
 * The constant exists so a guard can assert the exclusion against a name rather than against
 * a comment.
 */
export const SECURITY_ABSENCE_FORBIDDEN_CHANGE_STATE = 'NO_MATERIAL_CHANGE' as const;

export function isSecurityAbsenceState(value: string): value is SecurityAbsenceState {
  return (SECURITY_ABSENCE_STATES as readonly string[]).includes(value);
}

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
