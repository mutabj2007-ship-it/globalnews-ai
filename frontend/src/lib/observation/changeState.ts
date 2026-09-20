/**
 * ════════════════════════════════════════════════════════════════════════════
 * M01 — THE SHARED CHANGE-STATE VOCABULARY. TWO AXES, BOTH REQUIRED.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED for `shared/src/observation/change-state.ts` — **domain-neutral, lands ONCE.**
 * Nothing lands without authorization. No provider. No activation. No deployment.
 *
 * AUTHORITY
 *   MAIN-ENERGY-PARTXI-E1-L-CLOSEOUT-R2 §D, resolving M01, on the Product Owner's
 *   instruction: *"Prefer a semantic state model over an English phrase stored as authority."*
 *   Measured input: `L-ENERGY-PARTXI-MULTILINGUAL-R1` L03-F3.
 *
 * ── THE MEASURED PROBLEM ──────────────────────────────────────────────────
 *
 * L measured that `RESTORED · CAUSE OPEN` cannot be said truthfully in Polish inside the
 * frozen 27-character `row.state` budget. The shortest faithful Polish is 29 characters
 * (203px against 190px); the natural one is 31 (217px). **Every Polish form that fits drops
 * `OPEN`** — the half that says the cause has not been assessed. Dropping it asserts a
 * resolution the assessment has not made, which is the one rule that outranks the others:
 * *silence must never imply normal operations.*
 *
 * ── WHY SHORTENING WAS THE WRONG QUESTION ─────────────────────────────────
 *
 * `RESTORED · CAUSE OPEN` is not one state. It is **two independent facts printed with a
 * separator**, and the separator is doing work no type was enforcing:
 *
 *     service state   the observable condition moved, and to what      RESTORED
 *     cause state     what we know about WHY                           CAUSE OPEN
 *
 * They vary independently. A disruption can be observed with its cause already assessed; a
 * restoration can stand with its cause open for weeks. **Storing the pair as one English
 * string made a two-dimensional fact one-dimensional, and then asked a translator to fit the
 * collapse into a budget sized for one dimension.** No vocabulary of strings solves that,
 * in any language. The 27-character ceiling was never the defect; it was where the defect
 * became visible, and Polish was simply the first language to arrive.
 *
 * This is the A-24 collapse the landed `shared/src/security/absence.ts` already names in its
 * own domain: *"they are NOT interchangeable degradations of each other."* Here two
 * DISTINGUISHABLE FACTS were collapsed into one token. Same failure, other axis.
 *
 * ── THE RESOLUTION, AND WHY IT CANNOT BE FORGOTTEN ────────────────────────
 *
 * A change state is a RECORD OF TWO REQUIRED FIELDS. Not a string, not a union of phrases.
 *
 *   - Neither field is optional and neither has a default, so a producer cannot emit a
 *     service state without resolving its cause axis. **Dropping `CAUSE OPEN` stops being
 *     forbidden and becomes unrepresentable** — the enforcement-by-absence this programme
 *     uses everywhere else.
 *   - The two axes render as TWO ELEMENTS. Each is measured against the budget on its own,
 *     and both fit in EN and PL (`measurements/FIT-M01.txt`, controls M-1 and M-4).
 *     Truncation of one cannot consume the other, which is what §F requires structurally
 *     rather than by CSS care.
 *   - The `·` is revealed as a COMPOSITION OPERATOR, not a character in a label. That is
 *     also the fix for L04-F2: a separator that is its own element can sit inside the bidi
 *     isolation boundary, instead of floating between two unisolated runs.
 *
 * ── LANGUAGE IS NOT AUTHORITY HERE ────────────────────────────────────────
 *
 * This file exports TOKENS. It exports no English. The EN labels live in the label registry
 * beside the PL ones and neither is privileged — which is the Product Owner's instruction
 * taken literally, and it is what stops the next locale from re-opening M01.
 */

/**
 * AXIS 1 — did the observable condition move, and to what?
 *
 * Ordered from least to most eventful. Order is not severity and must not be read as
 * severity: `RESTORED` follows a disruption and is the least alarming member, not the most.
 */
export const CHANGE_SERVICE_STATES = [
  'NO_MATERIAL_CHANGE',
  'DISRUPTION_OBSERVED',
  'SUPPLY_IMPACT_OBSERVED',
  'SUPPLY_IMPACT_REVISED',
  'RESTORED',
] as const;

export type ChangeServiceState = (typeof CHANGE_SERVICE_STATES)[number];

/**
 * AXIS 2 — what do we know about WHY?
 *
 * `CAUSE_NOT_ASSESSED` is the floor and it is not the same as `CAUSE_OPEN`.
 *   NOT_ASSESSED  we have not looked at the cause
 *   OPEN          we have looked and it is unresolved
 *   ASSESSED      we have looked and it is resolved
 * Collapsing the first two would convert *"we did not look"* into *"we looked and found it
 * unresolved"* — the same A-24 collapse the Security absence vocabulary refuses.
 */
export const CHANGE_CAUSE_STATES = [
  'CAUSE_NOT_ASSESSED',
  'CAUSE_OPEN',
  'CAUSE_ASSESSED',
] as const;

export type ChangeCauseState = (typeof CHANGE_CAUSE_STATES)[number];

/**
 * THE CHANGE STATE. Both fields required. No defaults anywhere in this file.
 *
 * There is deliberately no `DEFAULT_CHANGE_STATE` and no single-argument constructor. A
 * caller that cannot establish a cause passes `CAUSE_NOT_ASSESSED` **by asking rather than by
 * omission** — the construction the landed absence vocabulary uses for its own floor, reused.
 */
export interface ChangeState {
  readonly service: ChangeServiceState;
  readonly cause: ChangeCauseState;
}

/** The floor: claims the least on both axes. A floor, not a default — it must be passed. */
export const CHANGE_STATE_FLOOR: ChangeState = {
  service: 'NO_MATERIAL_CHANGE',
  cause: 'CAUSE_NOT_ASSESSED',
};

/**
 * The seven placeholder phrases Part XI froze, decomposed onto the two axes.
 *
 * Carried as DATA so the migration is checkable rather than remembered, and so a reviewer can
 * see that no phrase was dropped. `ASSESSMENT UNCHANGED` and `CAUSE ASSESSED` were never
 * service-axis events at all — which is visible here and was not visible before.
 */
export const PART_XI_PLACEHOLDER_DECOMPOSITION: Readonly<Record<string, ChangeState>> = {
  'NO MATERIAL CHANGE':     { service: 'NO_MATERIAL_CHANGE',     cause: 'CAUSE_NOT_ASSESSED' },
  'DISRUPTION OBSERVED':    { service: 'DISRUPTION_OBSERVED',    cause: 'CAUSE_NOT_ASSESSED' },
  'SUPPLY IMPACT OBSERVED': { service: 'SUPPLY_IMPACT_OBSERVED', cause: 'CAUSE_NOT_ASSESSED' },
  'SUPPLY IMPACT REVISED':  { service: 'SUPPLY_IMPACT_REVISED',  cause: 'CAUSE_NOT_ASSESSED' },
  'RESTORED · CAUSE OPEN':  { service: 'RESTORED',               cause: 'CAUSE_OPEN' },
  'CAUSE ASSESSED':         { service: 'NO_MATERIAL_CHANGE',     cause: 'CAUSE_ASSESSED' },
  'ASSESSMENT UNCHANGED':   { service: 'NO_MATERIAL_CHANGE',     cause: 'CAUSE_NOT_ASSESSED' },
};

/** A locale's labels. BOTH maps are required — a locale cannot ship one axis. */
export interface ChangeStateLabels {
  readonly service: Readonly<Record<ChangeServiceState, string>>;
  readonly cause: Readonly<Record<ChangeCauseState, string>>;
}

/**
 * Renders a change state as TWO tokens, always two, in axis order.
 *
 * The return type is a fixed-length tuple rather than `string[]` or a joined string. That is
 * the enforcement: a caller cannot receive one token and believe it has the whole state, and
 * a renderer cannot join them into a single truncatable string without doing so visibly.
 *
 * **It does not join them and it never will.** Joining is a presentation decision that
 * belongs to the surface, under the §F rule that the cause element does not shrink.
 */
export function changeStateTokens(
  state: ChangeState,
  labels: ChangeStateLabels,
): readonly [service: string, cause: string] {
  return [labels.service[state.service], labels.cause[state.cause]];
}

/**
 * Whether the cause axis carries an UNRESOLVED claim that a surface may never drop.
 *
 * Exported so §F's layout rule can be asserted against a function rather than against a
 * comment: an element whose `mustNotTruncate` is true is laid out `flex:none`.
 */
export function causeMustBeShown(state: ChangeState): boolean {
  return state.cause === 'CAUSE_OPEN';
}
