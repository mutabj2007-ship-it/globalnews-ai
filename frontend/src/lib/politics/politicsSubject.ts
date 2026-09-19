import {
  POLITICS_EPISTEMIC_STATES, POLITICS_POLL_FIELDS, POLITICS_SUBJECT_TYPES,
  type PoliticsEpistemicState, type PoliticsPollField, type PoliticsSubjectType,
} from './politicsDomain';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE UNBOUND POLITICS SUBJECT — STRUCTURE WITHOUT A SINGLE OBSERVATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * This module contains NO political fact. Not a party, not a candidate, not an institution,
 * not a jurisdiction, not a date, not a number, not an event. It is the SHAPE of a Politics
 * surface — the three subject types Part VIII requests, the fields a poll must carry, the
 * seven epistemic states — so a reader can see what this dashboard will report before it
 * reports anything.
 *
 * It follows the accepted precedent exactly. Economy's `PRODUCTION_SHAPED_SUBJECT` states
 * its own rule in a sentence worth reusing: *"the labels are generic economic indicator
 * names, not any country's published figures."* The Politics equivalent is stricter, because
 * a plausible political label is a claim in a way a plausible indicator label is not — `CPI`
 * names a statistic, `Civic Platform` names a party. So every label here is a TYPE NAME from
 * R01 and nothing else.
 *
 * ── THE SCOPE IS UNBOUND, AND THE FRAME MUST SAY SO ───────────────────────
 *
 * The activation is explicit: *"do not imply a country/region is bound when the runtime
 * subject is unbound."* Economy's preview names Poland as a PLANNED presentation scope
 * because Main's contract pins `geo=PL` as the Alpha series identity. **Politics has no
 * such pin.** G-POLITICS-DATA-SOURCE-1 measured the seven observation classes and found
 * zero data-ready, with the one unblocked source — European Parliament Open Data — waiting
 * on the structured-observation seam. Naming a country here would be choosing a jurisdiction
 * no contract has chosen.
 *
 * So `jurisdiction` is UNBOUND, and the precision pair says exactly what §8 requires: the
 * precision of a figure that does not exist is not a coarse precision, it is no precision.
 */

/** The absent-figure glyph. Not a zero, never formatted, never a placeholder number. */
export const POLITICS_ABSENT = '—';

export interface PoliticsScope {
  /** UNBOUND until a contract binds one. Never a country name chosen by this lane. */
  readonly jurisdictionBound: false;
  /**
   * §8 — two separate facts, and neither is invented.
   *
   * `precision` is what a figure carries; with no figure there is none. `ceiling` is the
   * finest precision the deployment may show for a jurisdiction; with no jurisdiction bound
   * there is nothing to state a ceiling for. Both are `null`, and the frame renders the
   * absent glyph rather than a coarse rung that would read as a measured limit.
   */
  readonly precision: null;
  readonly precisionCeiling: null;
}

export const POLITICS_UNBOUND_SCOPE: PoliticsScope = {
  jurisdictionBound: false,
  precision: null,
  precisionCeiling: null,
};

/**
 * A subject-type slot: the NAME of a thing this surface reports, with nothing in it.
 *
 * `count` is deliberately absent rather than `0`. Zero elections is a measured claim about
 * a jurisdiction; no observation source is a statement about us. The activation's own list
 * forbids *"fake protest counts"*, and a `0` that a reader reads as a count is that.
 */
export interface PoliticsSubjectSlot {
  readonly subjectType: PoliticsSubjectType;
  /** Always null on this frame. A slot with a subject would carry an observation. */
  readonly bound: null;
}

export const POLITICS_SUBJECT_SLOTS: readonly PoliticsSubjectSlot[] =
  POLITICS_SUBJECT_TYPES.map((subjectType) => ({ subjectType, bound: null }));

/**
 * The poll artifact's disclosure fields, all unbound.
 *
 * R09 rules the empty polling state a DESIGNED state, and this is what makes it worth
 * designing: it shows a reader the ten things that will travel with any number, before any
 * number exists. D-04 bounds what may ever be drawn from them — *"where method, geography or
 * question differ, no trend line is drawn"* — so there is no series, no comparison and no
 * aggregate here, and no field from which one could be derived.
 */
export interface PoliticsPollSlot {
  readonly field: PoliticsPollField;
  readonly value: null;
}

export const POLITICS_POLL_SLOTS: readonly PoliticsPollSlot[] =
  POLITICS_POLL_FIELDS.map((field) => ({ field, value: null }));

/**
 * The seven epistemic states, each with no artifact behind it.
 *
 * §6 requires them to *"stay visibly distinct"*, and an empty surface is where they are
 * most likely to be quietly merged into two or three. Rendering all seven unbound is the
 * cheapest way to prove the distinction survives into the implementation — and it shows the
 * Product Owner the trust vocabulary the product will speak.
 */
export interface PoliticsSourceClassSlot {
  readonly state: PoliticsEpistemicState;
  readonly artifactCount: null;
}

export const POLITICS_SOURCE_CLASS_SLOTS: readonly PoliticsSourceClassSlot[] =
  POLITICS_EPISTEMIC_STATES.map((state) => ({ state, artifactCount: null }));

/**
 * The four axes, unbound, kept apart by construction.
 *
 * §5 forbids merging political status, lifecycle event, change state and confidence into a
 * single chip. They are four fields here rather than one `state` string for exactly that
 * reason — a merge would have to be written deliberately rather than happening by default.
 */
export interface PoliticsAxes {
  readonly subjectType: null;
  readonly lifecycleEvent: null;
  readonly changeState: null;
  readonly confidence: null;
}

export const POLITICS_UNBOUND_AXES: PoliticsAxes = {
  subjectType: null,
  lifecycleEvent: null,
  changeState: null,
  confidence: null,
};

/**
 * THE ASSESSMENT, AND WHY THERE IS NO SENTENCE HERE.
 *
 * Phase 1 §4 puts a *"current assessment line"* in the header, and Economy's accepted
 * production subject carries a presentation-only sentence in the same slot. Politics does
 * not, and the difference is deliberate: an Economy sentence with no figures asserts nothing
 * about any economy, while ANY sentence in a political assessment slot is read as a reading
 * of a political situation. §4 of the activation forbids *"emotionally loaded political
 * characterizations"* and *"speculation about motives"*; the safest sentence is none.
 *
 * The slot is rendered with the absent glyph and the header's own unavailable label, which
 * says what is true: no assessment has been issued.
 */
export const POLITICS_ASSESSMENT_ISSUED = false;
