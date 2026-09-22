/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SECURITY READ MODEL — WHAT A READER IS ALLOWED TO BE TOLD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA-SECURITY-EVIDENCE-R1. The wire shape of the read-only Security API, declared
 * in `shared` because the backend writes it and the frontend reads it, and a second
 * copy of the shape would be a second answer to one question.
 *
 * ── THIS IS A PROJECTION, AND IT IS LOSSY ON PURPOSE ──────────────────────
 *
 * `observation/absence.ts` states the rule this file exists to obey:
 *
 *   D-1  a security withholding must not be DISTINGUISHABLE from an ordinary absence.
 *   D-4  the canonical member survives INTERNALLY so telemetry keeps a distinction the
 *        reader does not get — and must not be reachable from the reader's payload.
 *
 * So `absence` below is typed `ReaderAbsenceState` — the THREE — and never
 * `ObservationAbsenceState`, the seven. A backend that wanted to send the seven would
 * have to change this type, which is the point: *"A lossless projection would let a
 * reader invert it and recover the withhold."*
 *
 * ── AND WHY THE ABSENCE IS NULLABLE RATHER THAN DEFAULTED ─────────────────
 *
 * `absence: null` means there is content — observations were returned and the reader is
 * looking at them. It is NOT a fourth absence state and it is not "fine": a reader that
 * received observations does not also need to be told which kind of nothing it got.
 *
 * There is deliberately no `?? NOT_ASSESSED` anywhere a consumer could write, because
 * the absence vocabulary refuses to have a default: *"A caller with nothing to pass
 * passes this, which is a decision it has to write down."*
 *
 * ── WHAT IS NOT ON THE WIRE, AND WHY EACH ONE IS ABSENT ───────────────────
 *
 *   no severity            `SEVERITY_IS_NEVER_IMPORTED_PREGRADED = true`
 *   no cause, no actor     never inferred from occurrence, never from cause
 *   no posture             a newspaper issues none
 *   no change state value  `changeState` is null at this foundation, and the reason says
 *                          why — `NO_MATERIAL_CHANGE` requires EVERY axis ESTABLISHED
 *   no natural person      PO-1: permitted on no reader surface at all. There is no
 *                          field, no slot and no dash where a person would go.
 *   no count of zero       the arrays are arrays; a surface that renders `0` is a surface
 *                          making a claim, and that rule lives with the surface
 */

import type { ReaderAbsenceState } from '../observation/absence';
import type { AxisCoverageState, SecurityCoverageAxis } from './index';
import type { SecurityIncidentClaim, SecurityObservationGeography } from './observation';

/**
 * WHAT THIS SURFACE STRUCTURALLY CANNOT SEE — AS CODES, NEVER AS PROSE.
 *
 * ── WHY CODES ─────────────────────────────────────────────────────────────
 *
 * `TrustReason` already set this rule in this codebase — *"stable, language-neutral codes
 * — never backend-authored English prose"* — and `observation/absence.ts` holds the line
 * harder still: *"This module carries no reader-facing string at all"*, because hoisting
 * labels *"would make English an authority"*. Turning a code into a sentence a reader sees
 * is the frontend's job, in the frontend's two languages.
 *
 * ── WHY THESE ARE NOT `KnownExclusion`s ───────────────────────────────────
 *
 * They were tried there first, and the accepted shape cannot carry them. A
 * `KnownExclusion` is TOTAL per source × axis × geography: `axisCoverageState` removes an
 * excluded source from the axis's universe, so declaring "the corpus cannot read Polish"
 * against OCCURRENCE would return `GAP_BY_EXCLUSION` and zero an axis the corpus does in
 * fact cover for every English record. A PARTIAL limitation has no home in the accepted
 * coverage vocabulary.
 *
 * So the total exclusions stay where Part IX put them — on the declaration — and the
 * PARTIAL ones are reported here, to the reader, rather than absorbed into silence. That
 * the accepted contract has no partial-exclusion shape is recorded as a finding for Main,
 * not worked around by mis-declaring a total one.
 */
export const SECURITY_COVERAGE_LIMITATIONS = [
  /**
   * The admission lexicon is English. A Polish record of a violent incident matches
   * nothing and is retained without ever becoming a candidate. Authoring the Polish terms
   * is L's: a mistranslation behind a Security claim is worse than a stated gap.
   */
  'RETAINED_CORPUS_ENGLISH_LEXICON_ONLY',
  /**
   * No observation carries `occurredAt`. A retained record states when it was PUBLISHED,
   * and a publication date is not an occurrence time. Nothing on this surface says when
   * the reported thing happened.
   */
  'NO_OCCURRENCE_TIME_IN_RETAINED_EVIDENCE',
  /**
   * Geography is COUNTRY and nothing finer. The corpus attributes an article to a country;
   * it does not locate the incident within it.
   */
  'GEOGRAPHY_PRECISION_COUNTRY_ONLY',
  /**
   * Each observation rests on ONE publisher. `SEC-NOTIFY-5` requires a second, distinct
   * source class before cause or actor may be asserted — and this surface asserts neither,
   * so nothing here is corroborated and nothing here claims to be.
   */
  'SINGLE_PUBLISHER_PER_OBSERVATION_NO_CORROBORATION',
  /**
   * An incident whose armed-actor character the evidence does not state is left unowned
   * rather than taken by Security. Those occurrences are absent from this surface, and
   * their absence is a deliberate ownership refusal, not a gap in retrieval.
   */
  'UNRESOLVED_OWNERSHIP_OCCURRENCES_WITHHELD',
] as const;

export type SecurityCoverageLimitation = (typeof SECURITY_COVERAGE_LIMITATIONS)[number];

/**
 * ONE AXIS, AS A READER IS TOLD ABOUT IT.
 *
 * Both fields are carried because Part IX's own header renders three axis statements side
 * by side, and a coverage state without its finding is not a statement a reader can read.
 *
 * `finding` is null wherever `coverageState` is not `ESTABLISHED`, and `absenceReason` is
 * then required — the `SEC-ASSESS-4` and `SEC-ASSESS-5` rules, carried onto the wire so
 * the surface cannot receive a shape the assessment guard would have refused.
 */
export interface SecurityAxisReadModel {
  readonly axis: SecurityCoverageAxis;
  readonly coverageState: AxisCoverageState;
  /** NULL unless the axis is ESTABLISHED. Null is not a degraded "nothing happened". */
  readonly finding: string | null;
  /** REQUIRED when `finding` is null: which kind of nothing this is. */
  readonly absenceReason?: string;
}

/**
 * ONE OBSERVATION, AS A READER IS TOLD ABOUT IT.
 *
 * The provenance fields are FLAT and REQUIRED rather than a nested optional bag. A reader
 * surface's whole job here is to attribute the claim, and an optional `sourceName` is a
 * surface that renders an unattributed allegation whenever a producer forgets.
 */
export interface SecurityObservationReadModel {
  readonly observationKey: string;
  readonly observationKind: string;
  readonly claim: SecurityIncidentClaim;
  readonly geography: SecurityObservationGeography;

  /** WHO SAID IT. Never absent — an unattributed claim is not displayable. */
  readonly sourceName: string;
  /** WHERE IT IS PUBLISHED. The record's own address, as published. */
  readonly sourceUrl: string;
  /** The registry's class for the publisher, present only where the registry knows it. */
  readonly authorityClass?: string;
  /** What role the record plays as evidence. `REPORTING` for retained journalism. */
  readonly evidenceRole: string;

  /**
   * THE THREE TEMPORAL AXES, NEVER COLLAPSED.
   *
   * `occurredAt` is absent here at this foundation and that absence is load-bearing: a
   * publication date is not an occurrence time, and *"Absent is not 'the publication
   * date'."* A surface that wants to say when something happened has nothing to say.
   */
  readonly occurredAt?: string;
  readonly publisherVintage?: string;
  readonly retrievedAt: string;
  /** WHICH of the three the record is actually carrying. Bound at write, never inferred. */
  readonly temporalBasis: string;

  /** The revision chain's position. Append-only; a retraction is a state, not a delete. */
  readonly revisionOrdinal: number;
}

/**
 * THE RESPONSE.
 *
 * It carries its own coverage, so the question *"could you actually see this?"* is
 * answerable from the response alone and never has to be reconstructed from logs — the
 * same property `SecurityAssessment` was given for the same reason.
 */
export interface SecurityReadResponse {
  readonly geographyId: string;
  readonly geographyName: string;

  /** Provenance-backed observations. An empty array is a complete and honest answer. */
  readonly observations: readonly SecurityObservationReadModel[];

  /** One entry per declared axis. An omitted axis is the silence the contract refuses. */
  readonly coverage: readonly SecurityAxisReadModel[];

  /**
   * The PARTIAL limitations, as codes. Non-empty at this foundation, and required rather
   * than optional: a surface that could receive this field absent is a surface that renders
   * a complete-looking picture whenever a producer forgets to state what it cannot see.
   */
  readonly limitations: readonly SecurityCoverageLimitation[];

  /**
   * The reader projection of the internal absence state, or NULL when observations were
   * returned. Three members, never seven. See the docblock above.
   */
  readonly absence: ReaderAbsenceState | null;

  /**
   * ALWAYS NULL AT THIS FOUNDATION, AND STATED RATHER THAN OMITTED.
   *
   * `NO_MATERIAL_CHANGE` may be asserted only when EVERY axis is `ESTABLISHED`, and four
   * of the five are declared permanent gaps. Every other member of the closed seven
   * describes a movement relative to a prior assessment, and this foundation retains no
   * prior assessment to move from. The honest answer is the null; `changeStateReason` is
   * what makes it legible.
   */
  readonly changeState: null;
  readonly changeStateReason: string;

  /** Who formed it. No producer, no assessment. */
  readonly producedBy: string;
  readonly assessedAt: string;
  readonly generatedAt: string;
}
