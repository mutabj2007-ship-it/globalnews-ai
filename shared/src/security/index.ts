/*
 * ═══════════════════════════════════════════════════════════════════════════════
 * SECURITY PLATFORM CONTRACT — MAIN-SECURITY-PLATFORM-1-R1 (CANDIDATE, PLAN B)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * A SHARED/PLATFORM CONTRACT CANDIDATE. Not an implementation. No provider, no UI,
 * no runtime. Nothing here activates a Security surface, and nothing here may be
 * read as declaring a Security runtime active.
 *
 * CANONICAL AT AUTHORING — C41, measured, not assumed:
 *   C  1025  1AA86BC07AB65F2E019960DC6BE13A7127F25FC23AD5DF99A16B7F9491F2F02D
 *   PA   15  516657BCA997670DE50CF9D94DAAE9EDA2CFC644E6982C301516B84A36DFF8C0
 *   SC    5  6EF7EB8B2FFC93F444C57F198CAA3EFBA0A1E5AB8F07B442E202C30E7C939C6D
 *
 * R1 REBASES R0 FROM C40 ONTO C41 AND CLOSES E1's CANDIDATE-REVIEW FINDINGS.
 * R0 was 93139d1d…4131 / 45,747 B, reviewed by E1 as PASS WITH CONDITIONS with
 * two blocking findings (E-2, E-4) and seven non-blocking. R1 closes E-1 … E-5,
 * E-7, E-8 and E-9, records E-6 as belonging to producer activation, and
 * PRESERVES A-24 CLOSED, B-4's core pipeline, M-2 CLOSED and S-1 OPEN.
 *
 * EVIDENCE THIS CONTRACT IS DERIVED FROM — every identity measured by Main:
 *   MAIN-SECURITY-V1-AUDIT.zip                 47,272 B  0c1cc11e…6686
 *   E1-SECURITY-DESIGN-1-REVIEW.zip            21,439 B  cc6e05e4…d5885
 *   GlobalNewsAI-G-SECURITY-CAP-1.zip          37,848 B  b7acaa35…95d3
 *   GlobalNewsAI-G-SECURITY-P0-SCHEMA-1.zip    90,695 B  722842a5…617e
 *   GlobalNewsAI-G-SECURITY-GAP-SOURCE-1.zip   58,168 B  e545a4ff…82cc
 *   GlobalNewsAI-G-SECURITY-SOURCE-CLOSURE-1.zip 45,414 B  9906c2e5…9d12
 *   E1-SECURITY-PLATFORM-CANDIDATE-REVIEW-1.zip  20,576 B  51ce5e22…a04d
 *
 * WHAT THIS CONTRACT IS FOR, IN ONE SENTENCE.
 *
 *   Part IX reasons superbly about single objects and does not yet reason about
 *   people or aggregates; the platform can distinguish "we looked and nothing
 *   changed" from "we could not look" for ONE subject over ONE story set, and
 *   cannot do it per source, per axis or per geography. This contract closes both
 *   gaps and refuses, structurally, to let either one be closed by a default.
 *
 * THE GOVERNING RULE OF THE WHOLE FILE:
 *
 *   NO DATA MAY EVER BECOME SAFETY.
 *
 *   Not by a boolean, not by an optimistic default, not by an absent field, not
 *   by an HTTP 200, not by an empty array, and not by a downstream consumer
 *   filling in a missing axis. Every predicate below is written so that the
 *   FAILURE to establish something is a distinct, named, non-silent outcome —
 *   never the same value as establishing its negation.
 *
 * REUSE, NOT REINVENTION. This file imports the platform's existing vocabulary and
 * adds none of its own where one exists:
 *   · `SourceProvenance`, `SourceType`, `EvidenceRole` from `../sourceModel`
 *   · `OfficialSourceClass`                             from `../officialSources`
 *   · `WatchChangeState`                                from `../watch`
 * There is no Security provenance type, no Security source class, no Security
 * change-state vocabulary and no Security severity ladder in this file, and their
 * absence is deliberate and load-bearing.
 *
 * WHAT IS NOT HERE, AND WHY.
 *   · No `EXPOSES` / `DEPENDS_ON` edge production. §5 gates the join; it does not
 *     build the graph. 0 of Part IX's 7 edge types exist in canonical today.
 *   · No provider, adapter, credential, endpoint or feed.
 *   · No Security Situation constructor. G measured that no source produces one
 *     and none will; a Situation is bootstrapped editorially (§8).
 *   · No severity mapping. No source publishes a value that maps onto the shared
 *     ladder and none may be made to.
 */

import type { OfficialSourceClass } from '../officialSources';
/*
  CONVERGENCE · BLOCKER A — REPOINTED AT THE SPLIT SOURCE MODEL, NOT AT A RECREATED ONE.

  This module was authored at `integration/alpha-convergence-2` `3db5a09`, where a single
  `../sourceModel` owned all three of these names. THIS lineage split that authority:

      EvidenceRole      ->  ../source-provenance   (declared at line 62)
      SourceProvenance  ->  ../source-provenance   (declared at line 81)
      SourceType        ->  ../source-type         (declared at line 32)

  The import is therefore repointed at the two current owners. `sourceModel` was
  deliberately NOT recreated: re-introducing it would stand a second module in front of the
  split authority and give each of these names two plausible homes — the identity problem
  the split already solved.

  Nothing else in this file changed. The names, their meanings and every use below are the
  accepted `3db5a09` bytes.
*/
import type { EvidenceRole, SourceProvenance } from '../source-provenance';
import type { SourceType } from '../source-type';
import type { WatchChangeState } from '../watch';

export const SECURITY_DOMAIN_ID = 'SECURITY' as const;

/** The canonical authority this candidate was authored against. Measured, never assumed. */
export const SECURITY_CONTRACT_CANONICAL_AT_AUTHORING = {
  c: { count: 1025, fingerprint: '1AA86BC07AB65F2E019960DC6BE13A7127F25FC23AD5DF99A16B7F9491F2F02D' },
  pa: { count: 15, fingerprint: '516657BCA997670DE50CF9D94DAAE9EDA2CFC644E6982C301516B84A36DFF8C0' },
  sc: { count: 5, fingerprint: '6EF7EB8B2FFC93F444C57F198CAA3EFBA0A1E5AB8F07B442E202C30E7C939C6D' },
} as const;

/**
 * Re-exported so a consumer of this contract cannot reach for a Security-local
 * substitute without noticing that the platform already owns the vocabulary.
 */
export type { EvidenceRole, OfficialSourceClass, SourceProvenance, SourceType, WatchChangeState };

/* ═══════════════════════════════════════════════════════════════════════════════
 * §1 · A-24 — THE COVERAGE CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * A-24 was elevated at Gate A to a MANDATORY SHARED PLATFORM REQUIREMENT with the
 * failure mode stated by Part IX itself: "Silence would masquerade as safety."
 *
 * WHY THE PLATFORM'S EXISTING PRIMITIVES ARE NOT ENOUGH. Main measured all three
 * on C40 and none can carry this:
 *
 *   `RetrievalOutcome` (sourceModel.ts) already separates "they answered and
 *   nothing matched" from "it could not run" — but it is ONE VALUE PER QUESTION,
 *   not per source, and it has NO REFUSAL STATES. G observed a UCDP 401 and a
 *   rate limit against live P0 sources; under that union a 401 must be spelled
 *   `NO_MATCHING_EVIDENCE`, which renders as "nothing happened in Poland this week."
 *
 *   `WatchDerivationState` (watch.ts) states this contract's thesis in the
 *   platform's own words — "A backend that cannot tell 'we looked and nothing
 *   changed' from 'we could not look' cannot honour that sentence" — but it has
 *   ONE BUCKET (`EVIDENCE_UNAVAILABLE`) for every failure mode, it is PER SUBJECT
 *   and story-set shaped, and it has NO AXIS AND NO GEOGRAPHY.
 *
 *   `WatchChangeState` is "fixed here and closed to extension". It is REUSED
 *   below and NEVER extended.
 *
 * THE DECISIVE GAP IS DIMENSIONALITY. For a Polish energy asset, OCCURRENCE is
 * covered by ENTSO-E while CAUSE, ACTOR, POSTURE and SEVERITY are covered by
 * NOTHING. Coverage varies BY AXIS FOR THE SAME SUBJECT. A per-subject state
 * cannot say so, so today such a subject would derive NO_CHANGE across the whole
 * subject — silence rendering as safety, on the very primitive built to prevent it.
 */

/**
 * THE AXES. An assessment is not one statement; it is one statement per axis, and
 * the axes are covered independently.
 *
 * OCCURRENCE, CAUSE and ACTOR are Part IX's three independent evidence axes and
 * MUST NOT be collapsed: the design's own seven-day worked Timeline shows an
 * occurrence confirmed on day 1 with the actor still unattributed on day 7.
 * POSTURE and SEVERITY are added because G measured them as separately, and
 * permanently, uncovered.
 *
 * CLOSED for Security. A sixth Security axis would be a platform decision, not a
 * local one — the same rule the programme applies to a ninth kind of decision.
 */
export type SecurityCoverageAxis =
  /** That something happened, at a place and time. */
  | 'OCCURRENCE'
  /** Why it happened, established by a named authority. Never inferred from occurrence. */
  | 'CAUSE'
  /** Who is responsible. Never inferred from cause. */
  | 'ACTOR'
  /** A declared, dated, scoped, expiring state issued by an external authority. */
  | 'POSTURE'
  /** Where it sits on the shared ladder. Never imported pre-graded from a source. */
  | 'SEVERITY';

export const SECURITY_COVERAGE_AXES: readonly SecurityCoverageAxis[] = [
  'OCCURRENCE',
  'CAUSE',
  'ACTOR',
  'POSTURE',
  'SEVERITY',
];

/**
 * WHAT ONE SOURCE'S ONE QUERY ACTUALLY DID.
 *
 * NOT A BOOLEAN, and the reason is empirical rather than theoretical. Every member
 * below except `SUCCESS` and `NO_RESULTS` was OBSERVED against a real source
 * during the G lanes, and every one of them presents to a naive consumer as
 * "nothing found":
 *
 *   AUTH_FAILED          UCDP now requires a token; unauthenticated calls return 401
 *   RATE_LIMITED         observed against a P0 source in SECURITY-P0-SCHEMA-1
 *   TRUNCATED            ENTSOG returns 100 rows by default under a 60-second query
 *                        ceiling and says nothing about the rest
 *   DEFUNCT              opendata.go.ke returns HTTP 200 from an empty ArcGIS shell,
 *                        so a naive liveness check reports it healthy; Meteoalarm's
 *                        legacy RSS was sunset on 2026-01-14 and still resolves
 *   UNREACHABLE_STANDING TLS certificate-chain failures across six Kenyan government
 *                        domains — a source that can NEVER be polled by a standard
 *                        client is a standing condition, not a transient one
 *
 * `NOT_ATTEMPTED` is not a failure and must never be spelled as one. It is a
 * COVERAGE DECISION, and conflating it with a failure is how a deliberate scope
 * limit becomes an invisible outage.
 */
export type SourceQueryOutcome =
  /** The source answered and the answer is complete. Establishes PRESENCE of what it returned. */
  | 'SUCCESS'
  /** The source answered COMPLETELY and nothing matched. THE ONLY OUTCOME THAT ESTABLISHES ABSENCE. */
  | 'NO_RESULTS'
  /** The source answered, and the answer is known to be incomplete. Establishes nothing either way. */
  | 'TRUNCATED'
  /** Credentials were rejected. */
  | 'AUTH_FAILED'
  /** Throttled. */
  | 'RATE_LIMITED'
  /** Transient failure — the source is expected to answer later. */
  | 'SOURCE_UNAVAILABLE'
  /** The source resolves but is no longer maintained, or answers from an empty shell. */
  | 'DEFUNCT'
  /** The source cannot be polled by a standard client at all. A standing condition. */
  | 'UNREACHABLE_STANDING'
  /** Deliberately not queried. A coverage decision, never a failure. */
  | 'NOT_ATTEMPTED';

export const SOURCE_QUERY_OUTCOMES: readonly SourceQueryOutcome[] = [
  'SUCCESS',
  'NO_RESULTS',
  'TRUNCATED',
  'AUTH_FAILED',
  'RATE_LIMITED',
  'SOURCE_UNAVAILABLE',
  'DEFUNCT',
  'UNREACHABLE_STANDING',
  'NOT_ATTEMPTED',
];

/**
 * THE SINGLE MOST IMPORTANT LINE IN THIS FILE.
 *
 * Exactly ONE outcome establishes that a thing did not happen. Everything else is
 * the ABSENCE OF EVIDENCE, which is not evidence of absence and must never be
 * rendered as one.
 *
 * `SUCCESS` is deliberately NOT here: a successful query that returned records
 * establishes PRESENCE. A successful query that returned no records is, by
 * definition, `NO_RESULTS`.
 */
export const OUTCOMES_ESTABLISHING_ABSENCE: readonly SourceQueryOutcome[] = ['NO_RESULTS'];

export function outcomeEstablishesAbsence(outcome: SourceQueryOutcome): boolean {
  return OUTCOMES_ESTABLISHING_ABSENCE.indexOf(outcome) !== -1;
}

/**
 * An outcome that ANSWERED — completely, one way or the other. `TRUNCATED` is not
 * here, and that is the whole point of `TRUNCATED` existing.
 */
export function outcomeIsComplete(outcome: SourceQueryOutcome): boolean {
  return outcome === 'SUCCESS' || outcome === 'NO_RESULTS';
}

/**
 * NO FUNCTION IN THIS CONTRACT ACCEPTS AN HTTP STATUS CODE, AND THAT IS THE
 * GUARANTEE.
 *
 * `opendata.go.ke` returns HTTP 200 from an empty ArcGIS shell with no catalogue.
 * Meteoalarm's sunset RSS still resolves. Any function that derived an outcome
 * from a status code would classify both as healthy. The adapter must decide the
 * outcome from the RESPONSE CONTENT and its own knowledge of the source, and this
 * contract deliberately gives it nowhere to shortcut.
 */
export const OUTCOME_IS_NEVER_DERIVED_FROM_HTTP_STATUS = true as const;

/** One source, one query, one outcome. `outcome` is required — there is no default. */
export interface SourceQueryRecord {
  /** The registry id of the source queried. Never a bare hostname. */
  readonly sourceId: string;
  /** Required. There is no default and no optional spelling. */
  readonly outcome: SourceQueryOutcome;
  /** ISO-8601. When the attempt was made — not when it last succeeded. */
  readonly attemptedAt: string;
  /**
   * The query as issued, echoed back beside its result. Adopted from IODA's
   * response envelope, the only source in either G lane that returns the query
   * alongside the answer. Where a source does not provide it, the adapter
   * synthesises it, so the accounting is uniform rather than per-source.
   */
  readonly queryParameters?: Readonly<Record<string, string>>;
  /** Required when the outcome is not complete: says which failure it was, in words. */
  readonly outcomeDetail?: string;
}

/**
 * WHAT A SOURCE STRUCTURALLY CANNOT SEE, AUTHORED BECAUSE IT IS NOT IN-BAND.
 *
 * THE EMPIRICAL PROOF THAT THIS FIELD CANNOT BE DERIVED. G measured five
 * independent sources with five different structural exclusions, and NOT ONE of
 * them is announced in the data:
 *
 *   FEWS NET dropped Somalia, Afghanistan and Yemen in August 2026 — announced in
 *     the press; the API simply omits the countries.
 *   NDMA classifies 23 ASAL counties; Kenya's other ~24 are not classified at all.
 *   DesInventar Rwanda holds 2016 only.
 *   CISA KEV has no geographic dimension at all, so "no KEV activity in Kenya" is
 *     not a statement KEV can make.
 *   ENTSO-E publishes no cause, no actor, no severity and no posture, ever.
 *
 * Every one returns an empty result INDISTINGUISHABLE from `NO_MATERIAL_CHANGE`.
 */
export interface KnownExclusion {
  /** The source this exclusion belongs to. */
  readonly sourceId: string;
  /** What the source cannot see, in the author's words. Never generated. */
  readonly excludes: string;
  /** Optional narrowing: the exclusion applies only to these geographies. */
  readonly geographyIds?: readonly string[];
  /** Optional narrowing: the exclusion applies only to these axes. */
  readonly axes?: readonly SecurityCoverageAxis[];
  /** Where the exclusion was learned, since it is by definition not in the data. */
  readonly establishedBy: string;
}

/** One axis of one subject's coverage, as AUTHORED. Never derived from a query. */
export interface AxisCoverageDeclaration {
  readonly axis: SecurityCoverageAxis;
  /**
   * The sources expected to cover this axis for this subject and geography.
   *
   * AN EMPTY SET IS A DECLARED COVERAGE GAP, NOT A PASS. It is the honest and
   * common case: G measured that EVERY P0 subject has a permanent coverage gap on
   * CAUSE, ACTOR, POSTURE and SEVERITY.
   */
  readonly expectedSourceSet: readonly string[];
  /** Authored per source. See `KnownExclusion`. */
  readonly knownExclusions: readonly KnownExclusion[];
}

/** Optional temporal bound. Coverage of a window is not coverage of all time. */
export interface CoverageWindow {
  readonly fromIso: string;
  readonly toIso: string;
}

/**
 * COVERAGE IS DIMENSIONED BY SUBJECT × AXIS × GEOGRAPHY, AND BY WINDOW WHERE
 * REQUIRED. This is the field G proved cannot be derived and must be AUTHORED.
 */
export interface CoverageDeclaration {
  readonly subjectId: string;
  readonly geographyId: string;
  readonly window?: CoverageWindow;
  /**
   * One entry per axis. `assertCoverageDeclarationIsComplete` refuses a
   * declaration that omits an axis, because an omitted axis is exactly the
   * silence this contract exists to prevent.
   */
  readonly axes: readonly AxisCoverageDeclaration[];
  /** Who authored it. A declaration with no author is not a declaration. */
  readonly declaredBy: string;
  readonly declaredAt: string;
}

/**
 * WHAT MAY HONESTLY BE SAID ABOUT ONE AXIS, ONCE THE QUERIES HAVE RUN.
 *
 * There is no `COVERED` member and no boolean. `ESTABLISHED` is the ONLY value
 * that permits an assertion, and reaching it requires that every expected source
 * answered COMPLETELY.
 */
export type AxisCoverageState =
  /** Every expected source answered completely. An assertion on this axis is permitted. */
  | 'ESTABLISHED'
  /** No source is expected to cover this axis at all. Permanent, declared, honest. */
  | 'GAP_DECLARED'
  /** A declared exclusion removes this subject/geography/axis from the source's universe. */
  | 'GAP_BY_EXCLUSION'
  /** Sources were expected and at least one did not answer completely. NOT a gap, and NOT a finding. */
  | 'UNESTABLISHED';

export const AXIS_COVERAGE_STATES: readonly AxisCoverageState[] = [
  'ESTABLISHED',
  'GAP_DECLARED',
  'GAP_BY_EXCLUSION',
  'UNESTABLISHED',
];

/** The one state that permits an assertion. Kept as a named constant so a mutation can bite it. */
export const AXIS_STATE_PERMITTING_ASSERTION: AxisCoverageState = 'ESTABLISHED';

export function axisPermitsAssertion(state: AxisCoverageState): boolean {
  return state === AXIS_STATE_PERMITTING_ASSERTION;
}

function exclusionApplies(
  exclusion: KnownExclusion,
  axis: SecurityCoverageAxis,
  geographyId: string,
): boolean {
  if (exclusion.axes !== undefined && exclusion.axes.indexOf(axis) === -1) return false;
  if (exclusion.geographyIds !== undefined && exclusion.geographyIds.indexOf(geographyId) === -1) {
    return false;
  }
  return true;
}

/**
 * DERIVE ONE AXIS'S COVERAGE STATE.
 *
 * THE ORDER OF THESE BRANCHES IS THE CONTRACT.
 *
 *   1. No expected source             -> GAP_DECLARED
 *   2. Every expected source excluded -> GAP_BY_EXCLUSION
 *   3. Any expected source missing from `outcomes`, or answering incompletely
 *                                     -> UNESTABLISHED
 *   4. Only then                      -> ESTABLISHED
 *
 * A SOURCE WITH NO RECORD IN `outcomes` IS `UNESTABLISHED`, NEVER `ESTABLISHED`.
 * That is the anti-optimism rule: a query nobody recorded is a query nobody can
 * prove ran, and the absence of a record must never read as a clean result.
 */
export function axisCoverageState(
  declaration: CoverageDeclaration,
  axis: SecurityCoverageAxis,
  outcomes: readonly SourceQueryRecord[],
): AxisCoverageState {
  const entry = declaration.axes.filter((a) => a.axis === axis)[0];
  if (entry === undefined) return 'UNESTABLISHED';

  if (entry.expectedSourceSet.length === 0) return 'GAP_DECLARED';

  const notExcluded = entry.expectedSourceSet.filter((sourceId) => {
    const excludedHere = entry.knownExclusions.filter(
      (x) => x.sourceId === sourceId && exclusionApplies(x, axis, declaration.geographyId),
    );
    return excludedHere.length === 0;
  });
  if (notExcluded.length === 0) return 'GAP_BY_EXCLUSION';

  for (const sourceId of notExcluded) {
    const record = outcomes.filter((o) => o.sourceId === sourceId)[0];
    if (record === undefined) return 'UNESTABLISHED';
    if (!outcomeIsComplete(record.outcome)) return 'UNESTABLISHED';
  }
  return 'ESTABLISHED';
}

/** A declaration that omits an axis is refused. An omitted axis is silence. */
export function assertCoverageDeclarationIsComplete(declaration: CoverageDeclaration): void {
  if (declaration.declaredBy.trim().length === 0) {
    throw new Error(
      'SEC-COV-0: a coverage declaration must name its author. It is authored, never derived.',
    );
  }
  for (const axis of SECURITY_COVERAGE_AXES) {
    const present = declaration.axes.filter((a) => a.axis === axis).length;
    if (present === 0) {
      throw new Error(
        `SEC-COV-1: coverage declaration omits axis ${axis}. Every axis must be declared, ` +
          'including — especially — the ones nothing covers. An omitted axis is the silence ' +
          'this contract exists to prevent.',
      );
    }
    if (present > 1) {
      throw new Error(`SEC-COV-1b: coverage declaration declares axis ${axis} more than once.`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * §2 · ASSESSMENT — NO EVIDENCE MUST NOT MANUFACTURE A SUBSTANTIVE STATE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The platform already settled this once, in Economy, and the reasoning is quoted
 * here rather than re-derived:
 *
 *   "`INSUFFICIENT_EVIDENCE` is not a state: it is the ABSENCE of one, so
 *    `changeState` is nullable and `changeStateReason` explains the null. That is
 *    the same shape the platform already uses in `WatchChangeStateMapping`,
 *    rather than a new idea."   — shared/src/economy/index.ts, accepted at C38
 *
 * SECURITY REUSES THE SHAPE AND DOES NOT TOUCH ECONOMY. The accepted Economy
 * contract is not edited, not generalised and not imported from. Whether the two
 * should later share one generic primitive is a real question and it is recorded
 * in §8 as a Main follow-up — it is not answered by editing an accepted contract
 * to make a new one convenient.
 *
 * `WatchChangeState` is reused unmodified and is NEVER extended: watch.ts declares
 * the seven "fixed here and closed to extension".
 */

/** What one axis actually found, once its coverage state permits an answer at all. */
export interface AxisFinding {
  readonly axis: SecurityCoverageAxis;
  readonly coverageState: AxisCoverageState;
  /**
   * NULL whenever the axis does not permit an assertion — and null is not a
   * degraded form of "nothing happened". `absenceReason` says which it was.
   */
  readonly finding: string | null;
  /** REQUIRED when `finding` is null. */
  readonly absenceReason?: string;
}

/**
 * A Security assessment over one subject.
 *
 * It carries its own coverage declaration and its own per-source outcomes, so the
 * question "could you actually see this?" is answerable from the assessment alone
 * and never has to be reconstructed from logs.
 */
export interface SecurityAssessment {
  readonly subjectId: string;
  readonly assessedAt: string;
  /** Identifier of the producer that formed it. No producer, no assessment. */
  readonly producedBy: string;
  readonly coverage: CoverageDeclaration;
  /** One record per source actually queried. */
  readonly outcomes: readonly SourceQueryRecord[];
  /** One finding per declared axis. */
  readonly axisFindings: readonly AxisFinding[];
  /**
   * NULL when no state may honestly be asserted. Not a gap to be defaulted later.
   * Reused from the platform's closed seven — never extended.
   */
  readonly changeState: WatchChangeState | null;
  /** REQUIRED when `changeState` is null. */
  readonly changeStateReason?: string;
}

/**
 * THE STATE THAT MAY NOT BE MANUFACTURED.
 *
 * `NO_MATERIAL_CHANGE` is the platform's way of saying "we looked, and nothing
 * changed" — Part IV calls it "displayed as a RESULT, never as absence… This line
 * is what the user is paying for." In a Security product it is also the single
 * most dangerous sentence available, because a reader hears SAFE.
 *
 * It may therefore be asserted only when EVERY axis is `ESTABLISHED`. A declared
 * permanent gap does not qualify: a subject whose CAUSE and ACTOR nothing covers
 * has not been found unchanged on cause and actor — it has not been looked at.
 */
export const CHANGE_STATE_REQUIRING_FULL_COVERAGE: WatchChangeState = 'NO_MATERIAL_CHANGE';

/**
 * THE CENTRAL GUARD. An assessment that cannot pass this is not publishable, and
 * the failure modes are named so a caller cannot mistake one for another.
 */
export function assertAssessmentIsHonest(assessment: SecurityAssessment): void {
  if (assessment.producedBy.trim().length === 0) {
    throw new Error('SEC-ASSESS-1: an assessment must name its producer.');
  }
  assertCoverageDeclarationIsComplete(assessment.coverage);

  for (const axis of SECURITY_COVERAGE_AXES) {
    const findings = assessment.axisFindings.filter((f) => f.axis === axis);
    if (findings.length === 0) {
      throw new Error(
        `SEC-ASSESS-2: assessment carries no finding for axis ${axis}. A missing axis is ` +
          'not an absence of news; it is an absence of an answer, and it must be stated.',
      );
    }
    if (findings.length > 1) {
      throw new Error(`SEC-ASSESS-2b: assessment carries more than one finding for axis ${axis}.`);
    }
  }

  for (const finding of assessment.axisFindings) {
    const derived = axisCoverageState(assessment.coverage, finding.axis, assessment.outcomes);
    if (derived !== finding.coverageState) {
      throw new Error(
        `SEC-ASSESS-3: axis ${finding.axis} claims coverage state ${finding.coverageState}, ` +
          `but its declaration and outcomes support ${derived}. Coverage is derived from what ` +
          'the sources actually did, never asserted alongside it.',
      );
    }
    if (!axisPermitsAssertion(finding.coverageState) && finding.finding !== null) {
      throw new Error(
        `SEC-ASSESS-4: axis ${finding.axis} asserts a finding while its coverage state is ` +
          `${finding.coverageState}. Only ${AXIS_STATE_PERMITTING_ASSERTION} permits an assertion. ` +
          'No downstream inference may populate an axis its evidence does not reach.',
      );
    }
    if (finding.finding === null && (finding.absenceReason ?? '').trim().length === 0) {
      throw new Error(
        `SEC-ASSESS-5: axis ${finding.axis} has no finding and no absence reason. A null ` +
          'finding must always say which kind of nothing it is.',
      );
    }
  }

  if (assessment.changeState === CHANGE_STATE_REQUIRING_FULL_COVERAGE) {
    const unestablished = assessment.axisFindings.filter(
      (f) => !axisPermitsAssertion(f.coverageState),
    );
    if (unestablished.length > 0) {
      const axes = unestablished.map((f) => `${f.axis}:${f.coverageState}`).join(', ');
      throw new Error(
        `SEC-ASSESS-6: ${CHANGE_STATE_REQUIRING_FULL_COVERAGE} asserted while these axes are ` +
          `not established — ${axes}. NO DATA MAY NEVER BECOME SAFETY. Use a null change ` +
          'state with a reason instead.',
      );
    }
  }

  if (assessment.changeState === null && (assessment.changeStateReason ?? '').trim().length === 0) {
    throw new Error(
      'SEC-ASSESS-7: a null change state must carry the reason it is null. The null is the ' +
        'honest answer; the reason is what makes it legible.',
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * §3 · B-1 — HIGH-CONSEQUENCE CLAIMS ABOUT IDENTIFIABLE NATURAL PERSONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * E1's principal finding: the protection for named private individuals appears
 * EXACTLY ONCE in Part IX's 32 files, as a "Must not become" note, with no
 * field-level expression, no structural absence and no gate — in the design's
 * highest-consequence claim class. Main corroborated the count independently.
 *
 * Main's own measurement sharpened it: of the six Politics→Security link
 * categories in Part VIII R10 §18, five have a Part IX treatment and one does not
 * appear at all — POLITICAL ASSASSINATION ATTEMPTS, 0 occurrences of
 * `assassinat`, `targeted killing`, `protected person` or `public figure`. It is
 * the only one of the six whose subject is a named natural person. S-1 and B-1
 * are the same hole seen from two sides (§8).
 *
 * And G measured the scale: every sanctions source names natural persons with
 * dates of birth, places of birth, passport and national identity numbers and
 * addresses. The publishing regulation is the Council's or the UK's lawful basis
 * for processing — NOT AUTOMATICALLY OURS.
 *
 * THE DESIGN'S OWN TECHNIQUE IS THE RIGHT ONE. Part IX has no `attributedActor`
 * field anywhere, so disagreement CANNOT be flattened into one. This section
 * applies the same method: make the wrong thing UNREPRESENTABLE rather than
 * forbidden.
 */

export type HighConsequenceClaimType =
  | 'DETENTION'
  | 'CHARGE'
  | 'INTIMIDATION'
  | 'SECURITY_CONDUCT'
  | 'ACTOR_ATTRIBUTION'
  | 'CYBER_ACTOR_STATUS';

export const HIGH_CONSEQUENCE_CLAIM_TYPES: readonly HighConsequenceClaimType[] = [
  'DETENTION',
  'CHARGE',
  'INTIMIDATION',
  'SECURITY_CONDUCT',
  'ACTOR_ATTRIBUTION',
  'CYBER_ACTOR_STATUS',
];

/**
 * THE STANDING LADDER, as G measured it across the sanctions, judicial, CSIRT and
 * research estate. This is not a trust score and must never be rendered as one;
 * it is a statement about WHAT KIND OF THING each instrument is.
 */
export type ClaimStandingInstrument =
  /** A finding of fact, within the record's own scope. */
  | 'COURT_JUDGMENT'
  /** An administrative determination — rebuttable and annullable. */
  | 'SANCTIONS_LISTING'
  /** An allegation. */
  | 'INDICTMENT'
  /** Official political attribution with no legal effect on the named party. */
  | 'STATE_DECLARATION'
  /** Assessed, typically hedged. */
  | 'CSIRT_ADVISORY'
  /** A research cluster label with no claimant and no confidence. */
  | 'RESEARCH_CLUSTER_LABEL'
  /** A coder assignment in an event dataset. */
  | 'DATASET_CODER_ASSIGNMENT';

export const CLAIM_STANDING_INSTRUMENTS: readonly ClaimStandingInstrument[] = [
  'COURT_JUDGMENT',
  'SANCTIONS_LISTING',
  'INDICTMENT',
  'STATE_DECLARATION',
  'CSIRT_ADVISORY',
  'RESEARCH_CLUSTER_LABEL',
  'DATASET_CODER_ASSIGNMENT',
];

/**
 * EXACTLY ONE INSTRUMENT MAY ESTABLISH THAT A NAMED NATURAL PERSON IS CULPABLE,
 * and only within its own record's scope.
 *
 * A sanctions listing is an administrative determination that can be annulled on
 * appeal. An indictment is an allegation. A state declaration has no legal effect
 * on the person named. A CSIRT advisory is hedged by its own authors — CERT
 * Polska's own wording models it: a campaign "can be associated with the APT28
 * activity set" on the basis of "technical indicators and similarity to attacks
 * described in the past". That is an assessment about a LABEL, not a finding
 * about a person.
 */
export const INSTRUMENTS_ESTABLISHING_CULPABILITY: readonly ClaimStandingInstrument[] = [
  'COURT_JUDGMENT',
];

export function instrumentEstablishesCulpability(instrument: ClaimStandingInstrument): boolean {
  return INSTRUMENTS_ESTABLISHING_CULPABILITY.indexOf(instrument) !== -1;
}

/*
 * ─── R1 · E-1 — THE ADMISSIBILITY MATRIX, NOT TWO CELLS OF IT ────────────────
 *
 * E1 measured the residual precisely: in R0 the culpability rule fired only for
 * ACTOR_ATTRIBUTION and CYBER_ACTOR_STATUS, so a DETENTION or a CHARGE against a
 * named natural person was displayable on a RESEARCH_CLUSTER_LABEL — an
 * instrument this contract's own docblock describes as having no claimant and no
 * confidence — or on a DATASET_CODER_ASSIGNMENT.
 *
 * E1's diagnosis is the one worth keeping: "the method is right and the coverage
 * is one step short of the method." B-1's method is an admissibility matrix; R0
 * applied it to two cells instead of the grid. R1 applies it to the grid.
 *
 * THE PRINCIPLE, STATED ONCE. A high-consequence claim about an identifiable
 * natural person is admissible only on an instrument capable of establishing the
 * KIND of thing the claim asserts:
 *
 *   culpability          -> a finding of fact. COURT_JUDGMENT alone.
 *   investigative status -> a judicial or prosecutorial act. Court or indictment.
 *   conduct or threat     -> an official record. Court, indictment, or a state
 *                            declaration where the state is the reporting authority.
 *
 * AND THREE INSTRUMENTS ADMIT NOTHING ABOUT A NATURAL PERSON, EVER:
 *
 *   RESEARCH_CLUSTER_LABEL     a label with no claimant and no confidence
 *   DATASET_CODER_ASSIGNMENT   a coder's assignment, not a finding
 *   CSIRT_ADVISORY             assessed and hedged by its own authors — CERT
 *                              Polska's own wording is an assessment about a
 *                              LABEL, not a finding about a person
 *
 * SANCTIONS_LISTING admits none of the six either. It can establish that a person
 * IS LISTED — which is not one of these six claim types — and it is a rebuttable
 * administrative determination that can be annulled on appeal.
 */
export const CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS: Readonly<
  Record<HighConsequenceClaimType, readonly ClaimStandingInstrument[]>
> = {
  ACTOR_ATTRIBUTION: ['COURT_JUDGMENT'],
  CYBER_ACTOR_STATUS: ['COURT_JUDGMENT'],
  DETENTION: ['COURT_JUDGMENT', 'INDICTMENT'],
  CHARGE: ['COURT_JUDGMENT', 'INDICTMENT'],
  SECURITY_CONDUCT: ['COURT_JUDGMENT', 'INDICTMENT'],
  INTIMIDATION: ['COURT_JUDGMENT', 'INDICTMENT', 'STATE_DECLARATION'],
};

/** Instruments that may carry no high-consequence claim about a natural person at all. */
export const INSTRUMENTS_ADMITTING_NO_PERSON_CLAIM: readonly ClaimStandingInstrument[] = [
  'SANCTIONS_LISTING',
  'CSIRT_ADVISORY',
  'RESEARCH_CLUSTER_LABEL',
  'DATASET_CODER_ASSIGNMENT',
];

export function instrumentAdmitsClaimType(
  instrument: ClaimStandingInstrument,
  claimType: HighConsequenceClaimType,
): boolean {
  return CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS[claimType].indexOf(instrument) !== -1;
}

/**
 * HOW THE PERSON WAS IDENTIFIED. `AI_SIMILARITY` and `ASSOCIATION_INFERENCE` are
 * MEMBERS OF THIS UNION ON PURPOSE — a refused basis that cannot be named cannot
 * be refused, and a mutation that swaps a permitted basis for a refused one must
 * bite.
 */
export type IdentityBasis =
  /** An authoritative record names the person, with a stable identifier. */
  | 'DETERMINISTIC_RECORD'
  /** An explicit correction or amendment chain from the publisher. */
  | 'PUBLISHER_CORRECTION_CHAIN'
  /** A stable shared external identifier. */
  | 'SHARED_EXTERNAL_IDENTIFIER'
  /** REFUSED. Named so it can be refused. */
  | 'AI_SIMILARITY'
  /** REFUSED. Named so it can be refused. */
  | 'ASSOCIATION_INFERENCE'
  /** REFUSED. Named so it can be refused. */
  | 'NAME_STRING_MATCH';

export const IDENTITY_BASES_PERMITTED: readonly IdentityBasis[] = [
  'DETERMINISTIC_RECORD',
  'PUBLISHER_CORRECTION_CHAIN',
  'SHARED_EXTERNAL_IDENTIFIER',
];

export const IDENTITY_BASES_REFUSED: readonly IdentityBasis[] = [
  'AI_SIMILARITY',
  'ASSOCIATION_INFERENCE',
  'NAME_STRING_MATCH',
];

/**
 * FIELDS DROPPED AT THE SEAM, NEVER STORED.
 *
 * G's position, adopted: identity-document numbers, dates of birth and addresses
 * serve no purpose in a security-intelligence surface and their retention is the
 * entire risk. This is the same seam-level discipline applied to ATT&CK's
 * `x_mitre_contributors` — which carries names of individual security researchers
 * — at considerably greater scale.
 *
 * NO SANCTIONS INGESTION PROCEEDS WITHOUT A DATA-PROTECTION ASSESSMENT COMPLETED
 * FIRST, AND THIS DROP LIST DECIDED BEFORE INGESTION RATHER THAN AFTER.
 */
export const PERSON_FIELDS_DROPPED_AT_SEAM: readonly string[] = [
  'dateOfBirth',
  'placeOfBirth',
  'passportNumber',
  'nationalIdentityNumber',
  'address',
  'postcode',
  'phone',
  'email',
  'taxNumber',
  'socialSecurityNumber',
  'x_mitre_contributors',
];

/**
 * R1 · A FIELD-LEVEL DROP LIST IS NECESSARY AND NOT SUFFICIENT.
 *
 * G's B-5 measured the thing that makes this hard: the two fields the product
 * MOST NEEDS are prose. `UKStatementofReasons` and `OtherInformation` carry the
 * REASON for a designation — they cannot be dropped without losing the point of
 * the record — and they cannot be controlled field by field. The UK guide
 * documents `OtherInformation` as possibly carrying "details of family", and
 * observed statements of reasons NAME THIRD PARTIES WHO ARE NOT THEMSELVES
 * DESIGNATED.
 *
 * So the control cannot be a drop list alone. It is an ADMISSION AND DISPLAY
 * rule: free-text sanctions fields are QUOTED SOURCE MATERIAL with a named
 * publisher — displayed as the authority's own words, never re-narrated, and
 * NEVER MINED to build records about the third parties named inside them.
 *
 * The middle tier matters too, and for a reason that cuts the other way:
 * retaining nationality and YEAR OF BIRTH ALONE — never a full date, never an
 * identifier number — answers the genuine countervailing risk of MISIDENTIFYING
 * AN INNOCENT NAMESAKE. Dropping every distinguishing field is not automatically
 * the safer choice.
 */
export const FREE_TEXT_FIELDS_ARE_NOT_FIELD_CONTROLLABLE: readonly string[] = [
  'UKStatementofReasons',
  'OtherInformation',
];

export const FREE_TEXT_ADMISSION_RULE: string =
  'quoted source material with a named publisher: displayed as the authority own words, never ' +
  're-narrated, never mined to build records about third parties named inside them';

/** Retained deliberately, to distinguish an innocent namesake. Never a full date of birth. */
export const PERSON_FIELDS_REDUCED_NOT_DROPPED: readonly string[] = ['nationality', 'yearOfBirth'];

/**
 * A claim about an identifiable natural person.
 *
 * `subjectIsNaturalPerson` is a literal `true` rather than a boolean, so the type
 * itself cannot be reached by accident: a caller must state it. There is no
 * inference from a name field, and no code path in this contract sets it.
 */
export interface NaturalPersonClaim {
  readonly subjectIsNaturalPerson: true;
  readonly claimType: HighConsequenceClaimType;
  readonly instrument: ClaimStandingInstrument;
  /** WHO made the claim. Never empty — an unattributed claim about a person is not displayable. */
  readonly claimantId: string;
  /** The record's own scope. A claim may never be shown wider than the record that carries it. */
  readonly recordScope: string;
  readonly identityBasis: IdentityBasis;
  readonly provenance: SourceProvenance;
  /** ISO-8601 of the underlying record, not of our retrieval. */
  readonly recordDatedAt: string;
  /**
   * Other subjects this claim touches. Present so the association refusal below is
   * expressible; carrying edges NEVER strengthens the claim.
   */
  readonly relatedSubjectIds?: readonly string[];
}

/**
 * TWO SEPARATE QUESTIONS, DELIBERATELY NOT ONE.
 *
 * The Master CTO's instruction is the design rule: the contract must distinguish
 * IDENTITY IS KNOWN from CLAIM IS SUFFICIENTLY EVIDENCED FOR PUBLIC DISPLAY.
 * They are returned as two independent fields of one verdict so that no caller can
 * satisfy one and read it as the other, and so a single boolean can never stand in
 * for both.
 *
 * SHARED IDENTITY IS NOT EVIDENTIARY PERMISSION. Part IX resolves actors as facets
 * on shared Entity identity — which is correct, and which says NOTHING about
 * whether a damaging claim about that entity may be displayed.
 */
export interface PersonClaimVerdict {
  readonly identityIsKnown: boolean;
  readonly claimIsSufficientlyEvidenced: boolean;
  readonly displayable: boolean;
  /** Always populated on refusal. Every refusal says which rule refused it. */
  readonly reasons: readonly string[];
}

export function identityIsKnown(claim: NaturalPersonClaim): boolean {
  return IDENTITY_BASES_PERMITTED.indexOf(claim.identityBasis) !== -1;
}

/**
 * MAY THIS CLAIM ABOUT A NAMED NATURAL PERSON BE DISPLAYED ON A PUBLIC SECURITY
 * SURFACE?
 *
 * `displayable` is the CONJUNCTION of two independent tests, and it is computed
 * here rather than by a caller so the two can never drift apart.
 */
export function evaluateNaturalPersonClaim(claim: NaturalPersonClaim): PersonClaimVerdict {
  const reasons: string[] = [];

  const known = identityIsKnown(claim);
  if (!known) {
    reasons.push(
      `SEC-PERSON-1: identity basis ${claim.identityBasis} is refused. AI similarity, ` +
        'association inference and bare name matching never identify a natural person.',
    );
  }

  let evidenced = true;

  if (claim.claimantId.trim().length === 0) {
    evidenced = false;
    reasons.push(
      'SEC-PERSON-2: no claimant. Every attribution sentence names its claimant; no claimant, no display.',
    );
  }

  if (claim.recordScope.trim().length === 0) {
    evidenced = false;
    reasons.push(
      'SEC-PERSON-3: no record scope. A claim may never be displayed more widely than the ' +
        "record that carries it — 'anything beyond the record's own scope' is what a court " +
        'record explicitly cannot establish.',
    );
  }

  /*
    R1 · E-1. THE MATRIX, APPLIED TO EVERY CLAIM TYPE — not only the two that
    assert culpability. In R0 this branch was guarded by an explicit test for
    ACTOR_ATTRIBUTION and CYBER_ACTOR_STATUS, which left DETENTION, CHARGE,
    INTIMIDATION and SECURITY_CONDUCT displayable on every instrument.
  */
  if (!instrumentAdmitsClaimType(claim.instrument, claim.claimType)) {
    evidenced = false;
    if (claim.claimType === 'ACTOR_ATTRIBUTION' || claim.claimType === 'CYBER_ACTOR_STATUS') {
      reasons.push(
        `SEC-PERSON-4: ${claim.claimType} about a natural person requires an instrument that ` +
          `establishes culpability. ${claim.instrument} does not — a sanctions listing is a ` +
          'rebuttable administrative determination, an indictment is an allegation, a state ' +
          'declaration has no legal effect on the person named, a CSIRT advisory is assessed, ' +
          'and a research cluster label has no claimant at all.',
      );
    } else {
      reasons.push(
        `SEC-PERSON-6: ${claim.claimType} about a natural person is not admissible on ` +
          `${claim.instrument}. Admissible instruments for this claim type are ` +
          `${CLAIM_TYPE_ADMISSIBLE_INSTRUMENTS[claim.claimType].join(', ')}. A research cluster ` +
          'label, a coder assignment, a hedged advisory and a rebuttable administrative ' +
          'determination cannot carry a detention, a charge, an intimidation or a security-conduct ' +
          'allegation about a named person.',
      );
    }
  }

  if (
    claim.identityBasis === 'ASSOCIATION_INFERENCE' ||
    (claim.relatedSubjectIds !== undefined &&
      claim.relatedSubjectIds.length > 0 &&
      claim.instrument === 'DATASET_CODER_ASSIGNMENT')
  ) {
    evidenced = false;
    reasons.push(
      'SEC-PERSON-5: guilt by association. An edge to another subject is not evidence about ' +
        'this person, and an aggregate of edges asserts nothing that no single edge asserts.',
    );
  }

  return {
    identityIsKnown: known,
    claimIsSufficientlyEvidenced: evidenced,
    displayable: known && evidenced,
    reasons,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * §4 · B-2 — RECORD PERMANENCE, PROMINENCE AND ALERT ELIGIBILITY ARE THREE THINGS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Part IX is right that "a withdrawn claim keeps its record with standing
 * WITHDRAWN" and "nothing is deleted from the history". E1's finding is that it
 * pairs those with no expiry, no review cadence and no display rule keyed on age —
 * so one UNVERIFIED CLAIM naming an actor persists on a subject's Timeline
 * indefinitely, correctly labelled and equally permanent whether it was
 * corroborated or quietly abandoned.
 *
 * The design already has the right instinct for freshness — every artifact carries
 * its own cadence and a STALE condition — and applies it to EVIDENCE but never to
 * ALLEGATIONS.
 *
 * THE FIX IS NOT DELETION. It is that these are three independent properties and
 * the design currently has one:
 *
 *   RECORD PERMANENCE   always PERMANENT. Nothing is deleted, ever.
 *   PROMINENCE          may decay from CURRENT to HISTORICAL with age.
 *   ALERT ELIGIBILITY   may be lost entirely.
 */

export type ClaimStanding =
  | 'VERIFIED'
  | 'OFFICIAL_POSITION'
  | 'DISPUTED'
  | 'UNVERIFIED_CLAIM'
  | 'SUSPECTED'
  | 'WITHDRAWN'
  | 'SUPERSEDED';

/** ALWAYS. There is deliberately no second member and no function that changes it. */
export type RecordPermanence = 'PERMANENT';

export type ClaimProminence =
  /** May appear on a subject surface as part of the current picture. */
  | 'CURRENT'
  /** Remains in the record and in history; no longer part of the current picture. */
  | 'HISTORICAL';

export type ClaimAlertEligibility = 'ELIGIBLE' | 'INELIGIBLE';

/**
 * Which standings decay with age.
 *
 * A court judgment does not become less true because it is old. An uncorroborated
 * allegation does not become more true because it is old, and the Timeline's
 * permanence must not be mistaken for endorsement.
 */
export const STANDINGS_SUBJECT_TO_PROMINENCE_DECAY: readonly ClaimStanding[] = [
  'UNVERIFIED_CLAIM',
  'SUSPECTED',
];

/*
 * ─── R1 · E-2 and E-8 — A REPLACED READING IS NOT A CURRENT ONE ──────────────
 *
 * E1 measured the defect exactly, and it is the kind that is obvious only once
 * someone looks: R0 decayed UNVERIFIED_CLAIM and SUSPECTED, and made WITHDRAWN
 * alert-INELIGIBLE by a ternary — leaving SUPERSEDED, which sits two lines below
 * WITHDRAWN in the same union, at CURRENT prominence and ALERT-ELIGIBLE AT ANY
 * AGE. A reading the platform has itself replaced could drive a notification.
 * WITHDRAWN was thought of and named; SUPERSEDED was not.
 *
 * E-8 is the same shape: WITHDRAWN held CURRENT prominence, so a withdrawn
 * allegation and a live corroborated one shared one prominence value.
 *
 * BOTH CLOSE WITHOUT A NEW PROMINENCE MEMBER, because HISTORICAL already means
 * exactly what is needed: "remains in the record and in history; no longer part
 * of the current picture." Part IX requires withdrawn and superseded readings to
 * stay VISIBLE with their standing marked, and HISTORICAL does not hide anything
 * — it removes it from the current picture, which is the honest place for a
 * reading that has been withdrawn or replaced.
 *
 * AGE AND CORROBORATION ARE IRRELEVANT HERE. A superseded reading is not made
 * current by being recent, and not rehabilitated by a second source class: it has
 * been replaced. So this check runs BEFORE the decay logic, not inside it.
 *
 * THE RECORD IS UNTOUCHED. recordPermanence stays PERMANENT in every branch.
 */
export const STANDINGS_NEVER_CURRENT: readonly ClaimStanding[] = ['WITHDRAWN', 'SUPERSEDED'];

export function standingIsNeverCurrent(standing: ClaimStanding): boolean {
  return STANDINGS_NEVER_CURRENT.indexOf(standing) !== -1;
}

/**
 * The review interval is SECURITY-SPECIFIC POLICY, not a shared constant: the
 * half-life of a security allegation is not the half-life of a market rumour. The
 * PRIMITIVE below is shared; this number is Security's and is a Product Owner
 * decision (PO-2). It is expressed as a required input rather than a default so
 * that no caller can silently inherit a number nobody chose.
 */
export interface ProminencePolicy {
  /** Days after which an undecayed uncorroborated claim loses CURRENT prominence. */
  readonly reviewIntervalDays: number;
  /** Who set it. A policy with no owner is a default in disguise. */
  readonly setBy: string;
}

export interface ClaimLifecycleState {
  readonly recordPermanence: RecordPermanence;
  readonly prominence: ClaimProminence;
  readonly alertEligibility: ClaimAlertEligibility;
  readonly reason: string;
}

/**
 * `corroboratedBySecondSourceClass` is the design's own campaign-persistence
 * standard — "independent support: corroboration from a source class other than
 * the first claimant" — applied where it matters more.
 */
export interface AgeableClaim {
  readonly claimId: string;
  readonly standing: ClaimStanding;
  /** The date of THIS record. */
  readonly recordDatedAt: string;
  /**
   * R1 · E-3. WHEN THE ALLEGATION WAS FIRST ASSERTED BY ANYONE — which is not the
   * same as when this record carrying it was published.
   *
   * E1 measured the laundering path: R0 ran the clock from `recordDatedAt`, so the
   * same 200-day-old uncorroborated allegation, re-issued today as a new record,
   * returned to CURRENT and ELIGIBLE. Re-publication of old allegations is a
   * normal information-operations technique rather than an exotic one.
   *
   * REQUIRED, with no default and no fallback to `recordDatedAt`. A default would
   * reinstate exactly the hole it closes: every re-publication would silently
   * inherit its own date as the first assertion. A producer that cannot establish
   * the first assertion must say so by failing to construct this value, not by
   * inheriting a convenient one.
   */
  readonly firstAssertedAt: string;
  readonly corroboratedBySecondSourceClass: boolean;
}

function daysBetween(earlierIso: string, laterIso: string): number {
  const earlier = Date.parse(earlierIso);
  const later = Date.parse(laterIso);
  if (Number.isNaN(earlier) || Number.isNaN(later)) {
    throw new Error(
      'SEC-STALE-0: an unparseable timestamp must not be treated as fresh or as stale. ' +
        'Fix the record; do not let Date.parse decide.',
    );
  }
  return (later - earlier) / 86400000;
}

/**
 * THE RECORD IS NEVER TOUCHED. This function returns how a claim should be
 * PRESENTED and whether it may drive an alert. It does not delete, rewrite,
 * redact or reorder anything, and there is no code path in this contract that can.
 */
export function claimLifecycleState(
  claim: AgeableClaim,
  nowIso: string,
  policy: ProminencePolicy,
): ClaimLifecycleState {
  if (policy.setBy.trim().length === 0) {
    throw new Error(
      'SEC-STALE-1: a prominence policy must name who set it. An unowned interval is a default.',
    );
  }

  /*
    R1 · E-2 / E-8. Checked FIRST, and before any age or corroboration logic, because
    neither recency nor a second source class makes a replaced reading current again.
  */
  if (standingIsNeverCurrent(claim.standing)) {
    return {
      recordPermanence: 'PERMANENT',
      prominence: 'HISTORICAL',
      alertEligibility: 'INELIGIBLE',
      reason:
        `standing ${claim.standing} has been withdrawn or replaced: it stays in the record and ` +
        'in history with its standing marked, and it is never part of the current picture and ' +
        'never drives an alert, at any age and with any corroboration',
    };
  }

  const decays = STANDINGS_SUBJECT_TO_PROMINENCE_DECAY.indexOf(claim.standing) !== -1;

  if (!decays) {
    return {
      recordPermanence: 'PERMANENT',
      prominence: 'CURRENT',
      alertEligibility: 'ELIGIBLE',
      reason: `standing ${claim.standing} is not subject to prominence decay`,
    };
  }

  if (claim.corroboratedBySecondSourceClass) {
    return {
      recordPermanence: 'PERMANENT',
      prominence: 'CURRENT',
      alertEligibility: 'ELIGIBLE',
      reason: 'corroborated by a source class other than the first claimant',
    };
  }

  /*
    R1 · E-3. The clock runs from the FIRST assertion, not from this record's date,
    so re-publishing an old allegation cannot return it to the current picture.
  */
  const age = daysBetween(claim.firstAssertedAt, nowIso);
  if (age > policy.reviewIntervalDays) {
    return {
      recordPermanence: 'PERMANENT',
      prominence: 'HISTORICAL',
      alertEligibility: 'INELIGIBLE',
      reason:
        `uncorroborated ${claim.standing} first asserted more than the ` +
        `${policy.reviewIntervalDays}-day review interval ago: it stays in the record and in ` +
        'history, and leaves the current picture. Re-publication does not restart the clock.',
    };
  }

  return {
    recordPermanence: 'PERMANENT',
    prominence: 'CURRENT',
    alertEligibility: 'ELIGIBLE',
    reason: `uncorroborated ${claim.standing} within the review interval`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * §5 · B-3 — AGGREGATE INFRASTRUCTURE, GATED AT THE SEAM
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * E1 (design) and G (measurement) converged on this independently, and the licence
 * converged on it a third time.
 *
 *   E1: every rule in Part IX is a PER-OBJECT rule, so nothing in Part IX is
 *   violated by assembling the edges into "a dependency map of national critical
 *   infrastructure with live exposure annotation".
 *
 *   G: four of five P0 sources contribute nothing to that graph; ENTSO-E is the
 *   only contributor and NO SINGLE ENTSO-E DOCUMENT IS SENSITIVE — every one is
 *   published by a TSO under a transparency regulation. "THE ACCUMULATION IS WHAT
 *   CREATES THE ARTEFACT."
 *
 *   The licence: the ENTSO-E documents naming an INDIVIDUAL GENERATING UNIT
 *   (A76/A77/A80) are exactly the ones outside the free-re-use grant. Plant-level
 *   identification is the line, found twice by two unrelated authorities.
 *
 * WHY THE GATE IS AT ADMISSION AND NOT AT DISPLAY. Every individual record is
 * legitimately public, so THERE IS NO RECORD TO REFUSE. The only refusable thing
 * is THE JOIN, and the join happens at ingestion. A display gate assumes the graph
 * already sits in the store — at which point everyone with store access holds the
 * artefact and the control protects only its rendering.
 *
 * G's warning, adopted verbatim as the reason this section exists now rather than
 * later: "The graph cannot be built at P0 because its vertices do not exist — and
 * THAT ACCIDENT OF SEQUENCING MUST NOT BE MISTAKEN FOR A SAFEGUARD."
 *
 * NOTHING HERE PRODUCES A GRAPH. There is no edge constructor, no traversal and no
 * store. `AGGREGATION_BEARING_RELATIONS` names the relation types the gate is
 * ABOUT; naming them is not creating them, and 0 of them exist in canonical.
 */

export type DisclosureTier =
  | 'PUBLIC_SAFE'
  | 'COARSE_ONLY'
  | 'ACCESS_CONTROL_NEEDED'
  | 'DO_NOT_EXPOSE';

export const DISCLOSURE_TIERS: readonly DisclosureTier[] = [
  'PUBLIC_SAFE',
  'COARSE_ONLY',
  'ACCESS_CONTROL_NEEDED',
  'DO_NOT_EXPOSE',
];

/*
 * ─── R1 · E-4(c) — THE TIER LADDER IS COMPARED ORDINALLY ─────────────────────
 *
 * E1 measured the gap: R0 special-cased ACCESS_CONTROL_NEEDED only, so a join
 * whose result sat at COARSE_ONLY was ADMITTED at full resolution on an
 * authorisation reaching only PUBLIC_SAFE. A lower authorisation tier satisfied a
 * higher disclosure requirement.
 *
 * The ladder is ordered, and the rule is one line: an authorisation satisfies a
 * requirement only when it reaches at least as far.
 */
export const DISCLOSURE_TIER_ORDER: Readonly<Record<DisclosureTier, number>> = {
  PUBLIC_SAFE: 0,
  COARSE_ONLY: 1,
  ACCESS_CONTROL_NEEDED: 2,
  DO_NOT_EXPOSE: 3,
};

/**
 * A LOWER AUTHORISATION TIER NEVER SATISFIES A HIGHER DISCLOSURE REQUIREMENT.
 *
 * `DO_NOT_EXPOSE` is unsatisfiable by construction: it is refused at the seam
 * regardless of authorisation, so no authorisation reaches it and none may be
 * written that does.
 */
export function authorisationSatisfiesTier(
  authorised: DisclosureTier,
  required: DisclosureTier,
): boolean {
  if (required === 'DO_NOT_EXPOSE') return false;
  return DISCLOSURE_TIER_ORDER[authorised] >= DISCLOSURE_TIER_ORDER[required];
}

/*
 * ─── R1 · E-4(b) and E-9 — ALL SEVEN PART IX RELATION TYPES, AUDITED ─────────
 *
 * R0 named two. Part IX declares seven, and E1 measured that a `SPILLOVER_TO`
 * join was ADMITTED unauthorised because it sat outside the list. E-9 added
 * `DISRUPTED` and `REFERENCES_DOMAIN` to the same finding.
 *
 * NO RELATION TYPE IS INVENTED HERE. These are exactly the seven Part IX declares
 * and subordinates to global relation-registry reconciliation, and 0 of the seven
 * exist in canonical today — which is precisely why the perimeter is cheapest to
 * set now and most expensive to retrofit.
 *
 * TWO DISTINCT ARTEFACTS, KEPT APART RATHER THAN LUMPED. Accumulation does not
 * always build the same dangerous thing, and calling both "aggregation" would
 * hide which control is protecting what:
 *
 *   INFRASTRUCTURE   a live-annotated dependency map of critical infrastructure.
 *                    This is E1's B-3 and G's ENTSO-E finding.
 *   ASSOCIATION      a network of who-is-linked-to-whom. This is E1's N-3
 *                    (guilt by association) and N-4 (unbounded POSSIBLY_RELATED
 *                    accumulation) — "thirty edges read as a pattern no edge
 *                    asserts."
 *
 * Both participate in admission. Both are named so a reader can tell which.
 */
export type AggregateArtefactKind = 'INFRASTRUCTURE' | 'ASSOCIATION' | 'NONE';

export const PART_IX_RELATION_TYPES: readonly string[] = [
  'EXPOSES',
  'DEPENDS_ON',
  'DISRUPTED',
  'SPILLOVER_TO',
  'REFERENCES_DOMAIN',
  'ATTRIBUTED_TO',
  'POSSIBLY_RELATED',
];

export const RELATION_AGGREGATE_ARTEFACT: Readonly<Record<string, AggregateArtefactKind>> = {
  /** asset -> asset/zone exposure. The canonical B-3 edge. */
  EXPOSES: 'INFRASTRUCTURE',
  /** asset -> asset dependency. The canonical B-3 edge. */
  DEPENDS_ON: 'INFRASTRUCTURE',
  /** incident -> asset. Joined across documents this is an availability history per asset. */
  DISRUPTED: 'INFRASTRUCTURE',
  /** subject -> subject propagation. Accumulated, a map of what failure reaches what. */
  SPILLOVER_TO: 'INFRASTRUCTURE',
  /** subject -> domain. Accumulated, it reveals which subjects the platform links where. */
  REFERENCES_DOMAIN: 'INFRASTRUCTURE',
  /** claim -> actor. Accumulated, an attribution network about people and groups. */
  ATTRIBUTED_TO: 'ASSOCIATION',
  /** the ABSENCE of authority for a relationship. Accumulated, it still reads as a pattern. */
  POSSIBLY_RELATED: 'ASSOCIATION',
};

/** Every relation whose accumulation builds a sensitive artefact of either kind. */
export const AGGREGATION_BEARING_RELATIONS: readonly string[] = PART_IX_RELATION_TYPES.filter(
  (r) => RELATION_AGGREGATE_ARTEFACT[r] !== 'NONE',
);

/**
 * A request to RETAIN relations derived from source documents.
 *
 * `sourceDocumentIds` is the whole mechanism: one document is a record, more than
 * one is a topology.
 */
export interface AggregationRequest {
  readonly relationType: string;
  readonly sourceDocumentIds: readonly string[];
  /**
   * R1 · E-4(a). HOW MANY RELATIONS THIS RETENTION WOULD KEEP.
   *
   * E1 measured the perimeter gap: R0's mechanism was "more than one document is
   * a topology", so ONE document containing a whole topology was ADMITTED
   * unauthorised. A single operator or ENTSO-E document can BE a topology.
   *
   * THE ARTEFACT IS THE TOPOLOGY, NOT THE DOCUMENT COUNT. Retaining one relation
   * from one document is a record. Retaining more than one relation is a
   * topology, however few documents it arrived in.
   *
   * REQUIRED, with no default. A default of 1 would silently reinstate the hole.
   */
  readonly retainedRelationCount: number;
  /** The tier the resulting retained state would sit in, as classified by the platform. */
  readonly resultingTier: DisclosureTier;
}

/**
 * Authorisation is EXPLICIT and names what it authorises. A blanket authorisation
 * is not expressible here, which is deliberate.
 */
export interface AggregationAuthorisation {
  readonly relationType: string;
  readonly authorisedTier: DisclosureTier;
  readonly authorisedBy: string;
}

export type AggregationVerdict = 'ADMIT' | 'COARSEN' | 'REJECT';

export interface AggregationDecision {
  readonly verdict: AggregationVerdict;
  readonly reason: string;
}

/**
 * RETAINING INDIVIDUAL OUTAGE RECORDS AGAINST A SINGLE ASSET IS NOT AGGREGATION.
 * JOINING THEM INTO A TOPOLOGY IS.
 */
export function isAggregationOperation(request: AggregationRequest): boolean {
  if (AGGREGATION_BEARING_RELATIONS.indexOf(request.relationType) === -1) return false;
  /*
    R1 · E-4(a). EITHER limb makes it a topology: more than one source document
    joined, OR more than one relation retained from however few documents. R0
    tested only the first, and a single document holding a whole dependency map
    walked through the gate.
  */
  return request.sourceDocumentIds.length > 1 || request.retainedRelationCount > 1;
}

/**
 * THE DEFAULT IS REFUSAL.
 *
 * `authorisation` is `undefined` for an unauthorised caller, and an unauthorised
 * aggregation is REJECTED rather than admitted-and-hidden. There is no permissive
 * branch reachable without an authorisation that names the relation type.
 */
export function admitAggregation(
  request: AggregationRequest,
  authorisation?: AggregationAuthorisation,
): AggregationDecision {
  if (request.resultingTier === 'DO_NOT_EXPOSE') {
    return {
      verdict: 'REJECT',
      reason:
        'SEC-AGG-1: DO_NOT_EXPOSE is refused at the seam regardless of authorisation. Shelters, ' +
        'emergency-response asset positions and protected-person locations are absent from ' +
        "Part IX's asset list and must stay absent.",
    };
  }

  if (!isAggregationOperation(request)) {
    return {
      verdict: 'ADMIT',
      reason:
        'not an aggregation operation: one relation retained from one source document is a ' +
        'record, not a topology',
    };
  }

  if (authorisation === undefined) {
    return {
      verdict: 'REJECT',
      reason:
        `SEC-AGG-2: aggregation of ${request.relationType} across ` +
        `${request.sourceDocumentIds.length} source documents requires explicit authorisation ` +
        'naming the retained relation type and its access tier. Absent authorisation is refusal, ' +
        'never admission.',
    };
  }

  if (authorisation.relationType !== request.relationType) {
    return {
      verdict: 'REJECT',
      reason:
        `SEC-AGG-3: authorisation names ${authorisation.relationType}, request is ` +
        `${request.relationType}. An authorisation does not generalise to another relation type.`,
    };
  }

  if (authorisation.authorisedBy.trim().length === 0) {
    return {
      verdict: 'REJECT',
      reason: 'SEC-AGG-4: an authorisation must name who granted it.',
    };
  }

  /*
    R1 · E-4(c). ORDINAL, not a special case for one rung. A lower authorisation
    tier never satisfies a higher disclosure requirement.
  */
  if (!authorisationSatisfiesTier(authorisation.authorisedTier, request.resultingTier)) {
    return {
      verdict: 'COARSEN',
      reason:
        `SEC-AGG-5: the join would produce ${request.resultingTier} state while authorisation ` +
        `reaches only ${authorisation.authorisedTier}. Coarsen before retention, not before display.`,
    };
  }

  return {
    verdict: 'ADMIT',
    reason: `authorised by ${authorisation.authorisedBy} for ${authorisation.authorisedTier}`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * §6 · B-4 — THE ADMISSION PIPELINE. FOUR STAGES, NOT ONE.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * E1's finding in one sentence: SOURCE CLASS IN PART IX GOVERNS DISPLAY, NOT
 * ADMISSION. There is no ingestion-side authority model, so a hostile actor who
 * can get an artifact into the corpus can move a Security Watch. That is the
 * adversarial-injection and source-spoofing gap.
 *
 * Nothing today prevents a single UNVERIFIED CLAIM from a single artifact
 * producing INCIDENT_REPORTED, a NEW change state and a delivered notification —
 * with every honesty marker on the resulting surface CORRECT.
 *
 * The four stages are separated here so that passing one can never be read as
 * passing the next.
 */

export type AdmissionStage = 'SOURCE_ADMISSION' | 'EVIDENCE' | 'ASSESSMENT' | 'NOTIFICATION';

export const ADMISSION_STAGES: readonly AdmissionStage[] = [
  'SOURCE_ADMISSION',
  'EVIDENCE',
  'ASSESSMENT',
  'NOTIFICATION',
];

/** Whether the artifact's own data tier lets it carry anything at all. */
export type ArtifactDataTier = 'OPEN' | 'DELAYED' | 'LICENSED' | 'UNAVAILABLE';

export interface CandidateArtifact {
  readonly artifactId: string;
  readonly provenance: SourceProvenance;
  /** Determined FROM THE ARTIFACT, never from the institution that published it. */
  readonly evidenceRole: EvidenceRole;
  readonly dataTier: ArtifactDataTier;
  /** Empty means anonymous. Anonymous artifacts may enter the record; see below. */
  readonly claimantId: string;
  /** True when the content was produced by model synthesis rather than retrieved. */
  readonly isAiSynthesis: boolean;
}

export interface StageVerdict {
  readonly stage: AdmissionStage;
  readonly permitted: boolean;
  readonly reasons: readonly string[];
}

/**
 * STAGE 1 · SOURCE ADMISSION — may this artifact enter the record at all?
 *
 * Deliberately permissive, and deliberately NOT the same as stage 2. An anonymous
 * artifact MAY enter the record: refusing to store it would lose the fact that it
 * was said, which is itself evidence. What it may not do is become evidence.
 */
export function mayAdmitArtifact(artifact: CandidateArtifact): StageVerdict {
  const reasons: string[] = [];
  let permitted = true;

  if (artifact.artifactId.trim().length === 0) {
    permitted = false;
    reasons.push('SEC-ADMIT-1: an artifact without an identifier cannot be recorded or corrected.');
  }
  if (artifact.isAiSynthesis) {
    permitted = false;
    reasons.push(
      'SEC-ADMIT-2: model synthesis is not an artifact. It has no publisher, no source class ' +
        'and nothing to correct against, and admitting it would make the corpus self-citing.',
    );
  }
  return { stage: 'SOURCE_ADMISSION', permitted, reasons };
}

/**
 * STAGE 2 · EVIDENCE — may this artifact enter the EVIDENCE SET?
 *
 * This is the gate Part IX does not have. It closes E1's N-2: `UNVERIFIED CLAIM`
 * is "shown only with claimant and class attached", and an anonymous claim has no
 * claimant to attach.
 */
export function mayPromoteToEvidence(artifact: CandidateArtifact): StageVerdict {
  const reasons: string[] = [];
  let permitted = true;

  const admission = mayAdmitArtifact(artifact);
  if (!admission.permitted) {
    permitted = false;
    reasons.push('SEC-EVID-0: not admitted to the record; it cannot become evidence.');
  }

  if (artifact.claimantId.trim().length === 0) {
    permitted = false;
    reasons.push(
      'SEC-EVID-1: anonymous. It may remain in the record — the fact that it was said is real — ' +
        'and it must not enter the evidence set, because a claim shown "only with its claimant ' +
        'attached" has no claimant to attach.',
    );
  }

  if (artifact.dataTier === 'UNAVAILABLE') {
    permitted = false;
    reasons.push(
      'SEC-EVID-2: data tier UNAVAILABLE. An allegation can never be more available than its evidence.',
    );
  }

  return { stage: 'EVIDENCE', permitted, reasons };
}

/**
 * STAGE 3 · ASSESSMENT — may an assessment be formed?
 *
 * The shared service forms it, not Security, and the assessment must survive
 * `assertAssessmentIsHonest`. That is where the coverage rules bite, so they are
 * not restated here.
 */
export function mayAssess(
  evidence: readonly CandidateArtifact[],
  assessment: SecurityAssessment,
): StageVerdict {
  const reasons: string[] = [];
  let permitted = true;

  const admitted = evidence.filter((a) => mayPromoteToEvidence(a).permitted);
  if (admitted.length === 0) {
    permitted = false;
    reasons.push(
      'SEC-ASSESS-STAGE-1: no artifact reached the evidence set. An assessment over nothing is ' +
        'not an assessment.',
    );
  }

  try {
    assertAssessmentIsHonest(assessment);
  } catch (error) {
    permitted = false;
    reasons.push(`SEC-ASSESS-STAGE-2: ${(error as Error).message}`);
  }

  return { stage: 'ASSESSMENT', permitted, reasons };
}

/** What is being proposed for delivery. */
export interface NotificationCandidate {
  readonly subjectId: string;
  readonly assessment: SecurityAssessment;
  /** The source classes of the evidence behind it, as classified per artifact. */
  readonly evidenceSourceClasses: readonly OfficialSourceClass[];
  /**
   * R1 · E-5. WHICH AXES THE NOTIFICATION COPY ACTUALLY SPEAKS ABOUT.
   *
   * E1 measured the composition gap: R0's `mayNotify` read only
   * `assessment.changeState` and never inspected `axisFindings`, so an alert
   * ASSERTING A CAUSE could be delivered while the assessment's CAUSE axis was
   * UNESTABLISHED — the assessment honest (its cause finding null with a reason),
   * the notification asserting a cause the assessment declined to state.
   *
   * E1 notes this is the third consecutive contract with this shape: Politics'
   * `editorialOutcome` not consulting `determinationIsAccountable`, Market's
   * `treatmentFor` not consulting `procurementReferenceIsAuthorised`, and this.
   * In each case both functions were individually correct and the one a consumer
   * calls omitted the other's check. R1 composes them.
   *
   * REQUIRED, with no default. An empty array means the notification asserts
   * nothing on any axis, which is a real and permitted case — a bare "this
   * subject moved" — and it must be stated rather than assumed.
   */
  readonly assertedAxes: readonly SecurityCoverageAxis[];
  /** True when the only thing that moved is a POSSIBLY_RELATED edge. */
  readonly onlyMovementIsPossiblyRelatedEdge: boolean;
  /** True when a provider is in a state the contract does not support. */
  readonly restsOnUnsupportedProviderState: boolean;
  /** True when the copy or the trigger came from model synthesis. */
  readonly restsOnAiSynthesis: boolean;
}

/**
 * R1 · E-5. Derived, never carried as its own field.
 *
 * R0 carried `assertsCauseOrActor` as a separate boolean beside the axes, which a
 * caller could set inconsistently with what the copy actually said. Deriving it
 * removes the drift entirely: the second-source-class rule and the axis-coverage
 * rule now read the same input.
 */
export function notificationAssertsCauseOrActor(candidate: NotificationCandidate): boolean {
  return (
    candidate.assertedAxes.indexOf('CAUSE') !== -1 || candidate.assertedAxes.indexOf('ACTOR') !== -1
  );
}

/**
 * STAGE 4 · NOTIFICATION — may this be delivered to a person?
 *
 * THE THREE THINGS THAT CAN NEVER AUTHORISE AN ALERT, stated as the Master CTO
 * stated them and enforced as three separate refusals so that removing one does
 * not silently remove the others:
 *
 *   a source class alone            — class governs what a claim may be SHOWN to
 *                                     establish; it is not admission and it is not
 *                                     corroboration
 *   AI synthesis                    — it has no claimant
 *   an unsupported provider state   — a state the contract does not model is not a
 *                                     finding about the world
 */
export function mayNotify(candidate: NotificationCandidate): StageVerdict {
  const reasons: string[] = [];
  let permitted = true;

  if (candidate.assessment.changeState === null) {
    permitted = false;
    reasons.push(
      'SEC-NOTIFY-1: the assessment asserts no change state. A null state is the honest answer ' +
        'and it is not a notification.',
    );
  }

  if (candidate.restsOnAiSynthesis) {
    permitted = false;
    reasons.push('SEC-NOTIFY-2: AI synthesis cannot authorize an alert.');
  }

  if (candidate.restsOnUnsupportedProviderState) {
    permitted = false;
    reasons.push('SEC-NOTIFY-3: an unsupported provider state cannot authorize an alert.');
  }

  if (candidate.onlyMovementIsPossiblyRelatedEdge) {
    permitted = false;
    reasons.push(
      'SEC-NOTIFY-4: the only movement is a POSSIBLY_RELATED edge. That edge is the ABSENCE of ' +
        'authority for a relationship, not evidence of one.',
    );
  }

  /*
    R1 · E-5. NOTIFICATION AUTHORITY MUST MATCH THE EVIDENCE AXIS THE COPY CLAIMS.
    Occurrence evidence does not authorise a cause or actor notification, and the
    three axes stay independent all the way to delivery.
  */
  for (const axis of candidate.assertedAxes) {
    const finding = candidate.assessment.axisFindings.filter((f) => f.axis === axis)[0];
    if (finding === undefined) {
      permitted = false;
      reasons.push(
        `SEC-NOTIFY-6: the notification asserts on axis ${axis}, and the assessment carries no ` +
          'finding for it. A notification may not speak about an axis the assessment did not answer.',
      );
      continue;
    }
    if (!axisPermitsAssertion(finding.coverageState)) {
      permitted = false;
      reasons.push(
        `SEC-NOTIFY-6: the notification asserts on axis ${axis} while its coverage state is ` +
          `${finding.coverageState}. The assessment declined to state it, and a notification may ` +
          'not assert what the assessment refused. Occurrence evidence never authorises a cause ' +
          'or actor notification.',
      );
    }
  }

  if (notificationAssertsCauseOrActor(candidate)) {
    const distinctClasses: OfficialSourceClass[] = [];
    for (const cls of candidate.evidenceSourceClasses) {
      if (distinctClasses.indexOf(cls) === -1) distinctClasses.push(cls);
    }
    if (distinctClasses.length < 2) {
      permitted = false;
      reasons.push(
        'SEC-NOTIFY-5: an alert asserting cause or actor requires corroboration from a source ' +
          "class OTHER than the first claimant — the design's own campaign-persistence standard, " +
          'applied where it matters more. A source class alone cannot authorize an alert.',
      );
    }
  }

  return { stage: 'NOTIFICATION', permitted, reasons };
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * §7 · M-2 — PROTEST OWNERSHIP. PRODUCT OWNER APPROVED AUTHORITY.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * HOW THIS ITEM AROSE. MAIN-SECURITY-V1-AUDIT measured a direct contradiction
 * between two accepted design authorities on the identical worked specimen both
 * chose — a protest that turns violent. Part VIII's specification said "the moment
 * violence occurs, the violence belongs to Conflict" and its R10 worked case gave
 * Conflict the incident record; Part IX's routing row gave the incident to
 * Security and listed Conflict as correctly absent unless organised armed actors
 * are involved. Main reported the conflict rather than guessing.
 *
 * THE PRODUCT OWNER HAS NOW RULED, AND THIS IS AUTHORITY.
 *
 *   1. POLITICS owns the persistent Protest Campaign and its political lifecycle.
 *   2. SECURITY owns a violent/security incident arising from a protest when
 *      organised armed-hostility criteria are NOT met.
 *   3. CONFLICT owns the incident once organised armed actors/hostilities meet the
 *      accepted Conflict contract.
 *   4. Cross-domain references preserve ONE real-world occurrence with
 *      domain-specific facets.
 *
 * WHAT THIS SECTION IS AND IS NOT. It encodes the MINIMUM cross-domain ownership
 * and reference semantics needed to enforce the ruling. It does not redesign Part
 * IX, does not restate Conflict's criteria, and does not define a Protest
 * Campaign — Politics owns that object and this file must not hold a second copy
 * of it. There is no identity function and no provenance type here: identity and
 * provenance are NOT DUPLICATED, only referenced.
 *
 * PRESERVED DISTINCTION:
 *     Protest Campaign  !=  violent Security incident  !=  Conflict hostility
 */

export type OccurrenceFacetDomain = 'POLITICS' | 'SECURITY' | 'CONFLICT';

export const OCCURRENCE_FACET_DOMAINS: readonly OccurrenceFacetDomain[] = [
  'POLITICS',
  'SECURITY',
  'CONFLICT',
];

/**
 * Whether the accepted Conflict contract's organised armed-hostility criteria are
 * met for this occurrence.
 *
 * `UNDETERMINED` exists because the alternative is a boolean, and a boolean would
 * make "we have not established whether armed actors were involved" identical to
 * "they were not". That is the same error this whole file exists to refuse.
 *
 * WHO DECIDES IT. Conflict's accepted contract does, against its own criteria.
 * Security never assigns this value from its own evidence, and this file provides
 * no function that computes one.
 */
export type ArmedHostilityCriteria = 'MET' | 'NOT_MET' | 'UNDETERMINED';

/**
 * A reference to ONE canonical real-world occurrence.
 *
 * `occurrenceId` is the shared identity. This contract holds a reference to it and
 * NEVER a copy of it: there is no occurrence record type here, no identity
 * function, no provenance field and no assessment of its own. Duplicating any of
 * those is exactly what the ruling forbids.
 */
export interface OccurrenceReference {
  readonly occurrenceId: string;
  readonly facetDomain: OccurrenceFacetDomain;
}

/**
 * WHICH DOMAIN OWNS THE INCIDENT FACET OF A PROTEST-DERIVED OCCURRENCE.
 *
 * Politics is not in the return type, and that is the ruling rather than an
 * omission: Politics owns the PROTEST CAMPAIGN — a persistent subject with a
 * political lifecycle — not the incident.
 *
 * `UNDETERMINED` returns null. An occurrence whose armed-hostility criteria have
 * not been assessed has NO incident owner yet, and must not be routed to Security
 * merely because Conflict has not claimed it. Absence of a Conflict finding is not
 * a Security finding.
 */
export function incidentFacetOwner(
  criteria: ArmedHostilityCriteria,
): 'SECURITY' | 'CONFLICT' | null {
  if (criteria === 'MET') return 'CONFLICT';
  if (criteria === 'NOT_MET') return 'SECURITY';
  return null;
}

/** Why an occurrence has no incident owner yet, so the null is never silent. */
export function incidentFacetOwnerReason(criteria: ArmedHostilityCriteria): string {
  if (criteria === 'MET') {
    return 'M-2(3): organised armed actors/hostilities meet the accepted Conflict contract';
  }
  if (criteria === 'NOT_MET') {
    return 'M-2(2): organised armed-hostility criteria are not met; Security owns the incident';
  }
  return (
    'M-2: armed-hostility criteria UNDETERMINED. No domain owns the incident facet yet. ' +
    "The absence of a Conflict finding is not a Security finding, and Conflict's criteria " +
    'are assessed by Conflict, never inferred here.'
  );
}

/**
 * THE ANTI-DUPLICATION GUARD.
 *
 * The ruling's fourth clause is the one most easily broken by accident: three
 * domains each holding a correct, independently-sourced record of the same event
 * is not three facets, it is three truth records. This refuses that shape.
 */
export function assertSingleOccurrenceAcrossDomains(
  references: readonly OccurrenceReference[],
): void {
  const byOccurrence: Record<string, OccurrenceFacetDomain[]> = {};
  for (const ref of references) {
    if (ref.occurrenceId.trim().length === 0) {
      throw new Error(
        'SEC-M2-0: a facet must reference a canonical occurrence id. A facet with no occurrence ' +
          'is an independent record.',
      );
    }
    const seen = byOccurrence[ref.occurrenceId] ?? [];
    if (seen.indexOf(ref.facetDomain) !== -1) {
      throw new Error(
        `SEC-M2-1: domain ${ref.facetDomain} holds more than one facet of occurrence ` +
          `${ref.occurrenceId}. One occurrence carries at most one facet per domain — ` +
          'references, not restatements.',
      );
    }
    seen.push(ref.facetDomain);
    byOccurrence[ref.occurrenceId] = seen;
  }
}

/**
 * SECURITY AND CONFLICT MAY NOT BOTH OWN THE INCIDENT FACET OF ONE OCCURRENCE.
 *
 * They may both carry a facet — Conflict assessing violence and humanitarian
 * consequence while Security assesses border exposure and posture is exactly the
 * Goma specimen Part IX works, and it is correct. What is refused is both
 * claiming the INCIDENT, which is what clause 3 resolves.
 */
export function assertIncidentFacetIsSingular(
  criteria: ArmedHostilityCriteria,
  claimedBy: readonly ('SECURITY' | 'CONFLICT')[],
): void {
  const owner = incidentFacetOwner(criteria);
  if (owner === null) {
    if (claimedBy.length > 0) {
      throw new Error(
        `SEC-M2-2: the incident facet is claimed by ${claimedBy.join(', ')} while ` +
          `${incidentFacetOwnerReason(criteria)}`,
      );
    }
    return;
  }
  for (const claimant of claimedBy) {
    if (claimant !== owner) {
      throw new Error(
        `SEC-M2-3: ${claimant} claims the incident facet, but ${incidentFacetOwnerReason(criteria)}. ` +
          'Duplicate independent truth records for Politics, Security and Conflict are refused.',
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * §8 · REGISTERS — WHAT IS BLOCKED, WHAT IS OPEN, AND WHAT MUST NOT BE CLAIMED
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Declared as data rather than prose so a test can assert them and a future edit
 * cannot quietly drop one.
 */

/**
 * S-1 IS NOT CLOSED, AND MUST NOT BE CLOSED BY MAPPING FIVE OF SIX.
 *
 * Main censused the six Politics R10 §18 link categories across all 32 Part IX
 * files. Five have a Part IX treatment. `assassinat` appears 0 times, as do
 * `targeted killing`, `protected person`, `public figure` and
 * `attack on a politician` — with a positive control proving the detector reads
 * the package (255 hits for `posture`) and can return a true zero.
 *
 * The missing category is the only one of the six whose subject is a NAMED NATURAL
 * PERSON. Its closure is therefore BOUND TO B-1 (§3) and not to a mapping exercise.
 */
export const S1_LINK_CATEGORY_STATUS: readonly {
  readonly category: string;
  readonly partIxTreatment: 'PRESENT' | 'ABSENT';
  readonly note: string;
}[] = [
  { category: 'election security', partIxTreatment: 'PRESENT', note: 'named Security Situation; routing row for intimidated officials' },
  { category: 'political assassination attempts', partIxTreatment: 'ABSENT', note: 'MEASURED ABSENT — 0 occurrences. Closure bound to B-1.' },
  { category: 'sabotage linked to political process', partIxTreatment: 'PRESENT', note: 'Security owns sabotage; SABOTAGE_CONFIRMED is a lifecycle event' },
  { category: 'hybrid interference', partIxTreatment: 'PRESENT', note: 'object G; shared Campaign primitive' },
  { category: 'intimidation', partIxTreatment: 'PRESENT', note: 'routing row: election officials intimidated' },
  { category: 'threats to institutions', partIxTreatment: 'PRESENT', note: 'facet: threat to institution' },
];

export const S1_STATUS = 'OPEN — five of six mapped; closure bound to B-1' as const;

/**
 * PRODUCER-ACTIVATION BLOCKERS. No Security producer may activate while its
 * blocker stands. This list is not advisory.
 */
/*
 * ─── R1 — U-2 AND S-6 ARE WITHDRAWN. THE CONTRADICTION NEVER EXISTED. ────────
 *
 * R0 carried U-2 as a HARD producer-activation blocker: that ENTSO-E Code Lists
 * v36r0 defined businessType A53 = "Unplanned outage" and A54 = "Planned
 * maintenance", contradicting every client library.
 *
 * G's SOURCE-CLOSURE-1 self-verified the code list and quoted the rows with their
 * neighbours so an offset would be visible:
 *
 *     A53 — Planned maintenance   "Maintenance has been planned for the object in
 *                                  question with a forecast ending date."
 *     A54 — Unplanned outage      "An unplanned outage has occurred on the object
 *                                  in question."
 *
 * A53 IS PLANNED. A54 IS UNPLANNED. The code list agrees with the client
 * libraries and always did, and ENTSO-E's own Manual of Procedures Ref. 06 is
 * normative and says the same. The blocker rested on a row transposition in a
 * single capture, to which a plausible corroborating artifact was then attached —
 * an entsoe-py issue whose own title asserts A53 = planned, i.e. evidence of
 * CONSENSUS read as evidence of dispute.
 *
 * U-2 WITHDRAWN. S-6 WITHDRAWN. PC-1 MET.
 *
 * THE OBSOLETE BLOCKER IS NOT PRESERVED MERELY BECAUSE IT APPEARED IN AN EARLIER
 * ACCEPTED PACKAGE. Carrying it forward would have been the easy and the wrong
 * choice: it would block a producer on a defect that does not exist, and it would
 * teach the next lane that a frozen finding is beyond correction. The safety
 * concern was real but INVERTED — mapping A53 to "unplanned" is the error that
 * would mislabel routine maintenance as a forced outage of critical infrastructure.
 */
export const WITHDRAWN_BLOCKERS: readonly {
  readonly id: string;
  readonly wasRecordedIn: string;
  readonly withdrawnBecause: string;
}[] = [
  {
    id: 'U-2',
    wasRecordedIn: 'GlobalNewsAI-G-SECURITY-P0-SCHEMA-1.zip (722842a5…617e)',
    withdrawnBecause:
      'A53 = Planned maintenance and A54 = Unplanned outage, self-verified against the code ' +
      'list with neighbouring rows and confirmed by the normative Manual of Procedures Ref. 06. ' +
      'The contradiction was a row transposition in one capture. PC-1 is MET.',
  },
  {
    id: 'S-6',
    wasRecordedIn: 'G provider-seam requirements',
    withdrawnBecause: 'the seam requirement existed only to carry U-2.',
  },
];

/**
 * ENTSO-E SEMANTICS, NOW SETTLED. Recorded positively so no later lane
 * re-derives the inverted reading.
 */
export const ENTSOE_BUSINESS_TYPE: Readonly<Record<string, string>> = {
  A53: 'Planned maintenance',
  A54: 'Unplanned outage / forced unavailability',
};

/**
 * PRODUCER-ACTIVATION BLOCKERS. No Security producer may activate while its
 * blocker stands. This list is not advisory.
 *
 * RIGHTS ARE SEPARATE FROM SEMANTIC CORRECTNESS, and U-2's withdrawal moves
 * nothing here: the ENTSO-E rights position is unchanged and still blocks
 * activation.
 */
export const PRODUCER_ACTIVATION_BLOCKERS: readonly {
  readonly id: string;
  readonly blocks: string;
  readonly finding: string;
}[] = [
  {
    id: 'U-2b',
    blocks: 'INFRASTRUCTURE_RESTORED from any ENTSO-E document',
    finding:
      'docStatus A09 Cancelled means the world changed; A13 Withdrawn means the RECORD was ' +
      'wrong. A13 must never produce a restoration event — that would put a false recovery on ' +
      'the Timeline. UNAFFECTED by the U-2 withdrawal: this is a docStatus finding, not a ' +
      'businessType one.',
  },
  {
    id: 'RIGHTS-ENTSOE-A78',
    blocks: 'ENTSO-E A78 redistribution without filtering',
    finding:
      'A78 (Art. 10.1.a/b) is CC BY 4.0 — commercial use and redistribution permitted — subject ' +
      'to measured CARVE-OUTS: Moldova, Turkey, the Interconnexion France-Angleterre and Nemo ' +
      'Link are excluded. Filter by area and interconnector BEFORE redistributing. Attribution ' +
      'stacks two obligations: credit AND indication of any changes, so a normalised record must ' +
      'be marked as changed.',
  },
  {
    id: 'RIGHTS-ENTSOE-A79',
    blocks: 'ENTSO-E A79 offshore grid',
    finding:
      'Art. 10.1.c is NOT covered by the re-use grant — now determined rather than unknown. ' +
      'The sub-letter is load-bearing: 10.1.a/b are open, 10.1.c is not.',
  },
  {
    id: 'RIGHTS-ENTSOE-ASSET',
    blocks: 'ENTSO-E A76 / A77 / A80',
    finding:
      'A80 = generation (15.1.a/b), A77 = production (15.1.c/d), A76 = load (7.1.a/b) — none on ' +
      'the free-re-use list, no grant. These are the documents naming an INDIVIDUAL GENERATING ' +
      'UNIT, so the rights line and the B-3 safety line coincide.',
  },
  {
    id: 'LIC-ATTACK',
    blocks: 'MITRE ATT&CK enablement',
    finding: 'licence UNKNOWN — copyright and trademark asserted in-band. UNKNOWN is not upgraded.',
  },
  {
    id: 'LIC-CERTEU',
    blocks: 'CERT-EU enablement',
    finding: 'licence NOT RETRIEVED. Not established is not permission.',
  },
  {
    id: 'LIC-DESINVENTAR',
    blocks: 'DesInventar Kenya ingestion',
    finding:
      "UNDRR's own terms permit download and copying for the user's PERSONAL, NON-COMMERCIAL " +
      'use, WITHOUT any right to resell or redistribute or to compile or create DERIVATIVE ' +
      'WORKS. This is a restrictive terms basis that was FOUND — it is not "licence not ' +
      'found", and it must not be recorded as an absence. HOLD, reclassified from P1. Closing ' +
      'positive would require a grant from UNDRR and the Kenyan owning institution, or a proven ' +
      'dataset-specific HDX licence that overrides it.',
  },
  {
    id: 'DP-SANCTIONS',
    blocks: 'any sanctions-list ingestion',
    finding:
      'No ingestion without a data-protection assessment completed first and the drop list ' +
      'decided BEFORE ingestion. See PERSON_FIELDS_DROPPED_AT_SEAM and, decisively, ' +
      'FREE_TEXT_FIELDS_ARE_NOT_FIELD_CONTROLLABLE.',
  },
  {
    id: 'REG-ASSET',
    blocks: 'objects B and D, and every asset-scoped Situation',
    finding:
      'No shared asset registry exists. Canonical official-source registry: 4 entries, 0 ' +
      'enabled, 0 ingestion. Geography-scoped Situations are buildable; asset-scoped are not.',
  },
];

/**
 * R1 · CAP — THE SHAPE IS EVIDENCED, THE PRODUCER IS NOT.
 *
 * G verified against live data in two priority geographies that CAP carries the
 * fields object F requires, including `effective` and `expires`, and that Poland's
 * per-entry CAP populates `references` with the superseded identifier. Kenya's
 * feed is in-feed public domain with all six fields populated.
 *
 * AND NO MEASURED PUBLIC FEED CARRIES `category = Security`. The vocabulary
 * exists and Canada's CAP-CP profile elaborates it, but the systems carrying it
 * are gated to authorised distributors. G states the limit precisely: NOT
 * VERIFIED AS ZERO, NOT DEMONSTRATED AS NON-ZERO ANYWHERE.
 *
 * SO: CAP MAY INFORM OBJECT F'S CONTRACT MAPPING, AND THERE IS STILL NO
 * COMPLIANT SECURITY POSTURE PRODUCER. One is not manufactured here.
 */
export const CAP_STATUS = {
  shapeInformsObjectF: true,
  effectiveAndExpiryFieldsVerifiedLive: true,
  securityCategoryFeedFound: false,
  compliantPostureProducerExists: false,
  note: 'not verified as zero, not demonstrated as non-zero anywhere',
} as const;

/**
 * R1 · SEC 8-K ITEM 1.05 — A CANDIDATE WHOSE FIT IS A DEFINITIONAL QUESTION.
 *
 * The strongest new source found across three G lanes. Item 1.05 is not a
 * voluntary disclosure and is by definition material; EDGAR returns the item code
 * as a FIELD rather than a text match, so filtering needs no inference; the
 * licence is settled — SEC material may be copied and further distributed without
 * permission, commercial use included. It establishes OCCURRENCE, MATERIALITY, a
 * NAMED ORGANISATION (CIK-resolved) and a DATE, with zero inference.
 *
 * IT CANNOT ESTABLISH A NAMED SYSTEM, AND NOT BY ACCIDENT: Instruction 4 to Item
 * 1.05 expressly permits withholding specific or technical information about
 * cybersecurity systems, networks and devices.
 *
 * THEREFORE `CYBER_INCIDENT_CONFIRMED` IS NOT PRODUCER-READY. Whether an
 * organisation-level occurrence without a named system satisfies the Part IX
 * event contract is a DEFINITIONAL question about that contract, and this
 * contract does not resolve it in its own favour by inference.
 */
export const CYBER_INCIDENT_SOURCE_STATUS = {
  source: 'US SEC Form 8-K Item 1.05 via the EDGAR full-text search API',
  classification: 'SOURCE_CANDIDATE_DEFINITIONAL_FIT_PENDING',
  establishes: ['OCCURRENCE', 'MATERIALITY', 'NAMED_ORGANISATION', 'DATE'],
  cannotEstablish: ['NAMED_SYSTEM'],
  producerReady: false,
  blockedOn:
    'whether the Part IX CYBER_INCIDENT_CONFIRMED contract permits organisation-level ' +
    'occurrence without named system identity. Definitional, not empirical; not resolved here.',
} as const;

/**
 * R1 · SABOTAGE_CONFIRMED — CLOSED NEGATIVE. DO NOT RE-RESEARCH.
 *
 * Structurally impossible on three independent mechanisms: the structured
 * registers are LEGALLY BARRED from the finding (Reg. (EU) 996/2010 Art. 1
 * investigates "without apportioning blame or liability"; 49 U.S.C. 1131 requires
 * the NTSB to relinquish priority to the FBI); the bodies that CAN make the
 * finding publish prose; and the industry registers refuse the role.
 *
 * The near-miss, PHMSA, is refused because its Part G is labelled "APPARENT
 * CAUSE" and is the OPERATOR's self-selection — and under the Part IX register an
 * operator cannot establish cause. If ever admitted it must be a distinct, lower-
 * standing event, never SABOTAGE_CONFIRMED.
 */
export const SABOTAGE_CONFIRMED_STATUS = {
  producerExists: false,
  closure: 'CLOSED_NEGATIVE',
  doNotReResearch: true,
} as const;

/**
 * MEASURED SOURCE AND DATA LIMITS. Preserved so no later lane re-derives them
 * optimistically. No source research alone closes any of these.
 */
export const SECURITY_DATA_LIMITS = {
  corridorSpatialCapability: 'ENDPOINT_ONLY',
  postureProducerCount: 0,
  sabotageConfirmedProducerCount: 0,
  cyberIncidentConfirmedProducerCount: 0,
  attackKevJoin: 'HARD_NON_JOIN — 0 CVE identifiers across 26,086 ATT&CK objects, measured',
  ucdpShape: 'CONFLICT_SHAPED — produces no Security object, event or posture',
  sharedAssetRegistry: 'ABSENT',
  partIxObjectsProducible: 2,
  partIxObjectsContextOnly: 4,
  partIxObjectsUnreachable: 5,
  lifecycleEventsWithProducer: 2,
  lifecycleEventsTotal: 10,
} as const;

/**
 * SEVERITY IS NOT IMPORTED. No source in either G lane publishes a value that maps
 * onto the shared LOW/MODERATE/HIGH/CRITICAL ladder, and none may be made to:
 * converting an authority's posture into our severity is a forbidden composition.
 * Impact INPUTS — raw counts of consequence — are what the shared severity
 * contract needs, and it must not be handed anything pre-graded.
 */
export const SEVERITY_IS_NEVER_IMPORTED_PREGRADED = true as const;

/**
 * OBJECT A — THE SECURITY SITUATION — IS BOOTSTRAPPED EDITORIALLY.
 *
 * G confirmed across 79 researched sources that no source produces a Situation and
 * none will: every candidate is an artifact, an occurrence or a declared state,
 * and a Situation is the standing subject those three attach to.
 *
 * DERIVING SITUATIONS BY CLUSTERING OCCURRENCES IS REFUSED. It infers a persistent
 * subject from a set of events — the same error class as inferring a Campaign from
 * a KEV boolean, already refused. An editorial Situation with no covering source
 * reads as COVERAGE GAP, which is TRUE; a clustered one reads as coverage, which
 * is FALSE.
 *
 * This contract therefore provides NO Situation constructor and no clustering
 * function, and their absence is the guarantee.
 */
export const SITUATION_BOOTSTRAP = {
  method: 'EDITORIAL',
  scopedBy: ['GEOGRAPHY', 'ASSET'],
  geographyScopedBuildable: true,
  assetScopedBuildable: false,
  assetScopedBlockedBy: 'REG-ASSET',
  clusteringRefused: true,
} as const;

/**
 * OPEN ITEMS THIS CANDIDATE DELIBERATELY DOES NOT RESOLVE. Recorded so they are
 * not lost between lanes and not mistaken for oversights.
 */
export const MAIN_FOLLOW_UP_REGISTER: readonly { readonly id: string; readonly item: string }[] = [
  { id: 'M-1', item: 'Cross-lane register-ID namespace. Part VIII C-01…C-10 and Part IX C-01…C-07 collide; four different S-nn namespaces are in circulation.' },
  { id: 'G-ACTOR-1', item: "WatchSubjectType 'ACTOR' is already shared by Map and Conflict with no discriminator; Politics and Security would be the third and fourth claimants." },
  { id: 'N-7', item: "Security's twelve artifact classes overlap Politics' source classes. One shared register or two domain registers — unanswered by both designs." },
  { id: 'N-9', item: 'SPILLOVER_TO / REFERENCES_DOMAIN point into Market and Economy, which declare no reciprocal acceptance. The join is unowned.' },
  { id: 'N-M1', item: 'Part IX §33 requires verbatim original-language display and names Arabic, with no direction rule. The platform accepted exactly this contract at C40; Security should inherit it rather than specify one.' },
  { id: 'GEN-1', item: 'EconomyAssessment and SecurityAssessment now carry the same nullable-state-plus-reason shape independently. Whether they should share one generic primitive is a real question; it is NOT answered by editing an accepted contract to make a new one convenient.' },
  { id: 'E-6', item: "R1 does NOT close this, and cannot. assertSingleOccurrenceAcrossDomains enforces one-facet-per-domain GIVEN a shared occurrence id; it cannot verify the id was shared, because identity resolution is upstream. One real event carried as two occurrence ids passes. E1's two-path convergence test — produce the specimen through each domain's producer and assert one occurrence — belongs at PRODUCER ACTIVATION, not in a contract. Recorded as an inherent limit, not a defect." },
  { id: 'PO-CYBER-DEF', item: 'Product Owner: does the Part IX CYBER_INCIDENT_CONFIRMED contract permit organisation-level occurrence without named system identity? SEC 8-K Item 1.05 is adoptable the moment it does and never if it does not. Definitional, not empirical.' },
  { id: 'PO-DROPLIST', item: 'Product Owner: is the three-tier sanctions drop list adopted, and the free-text quoted-source display rule with it? The DPIA is a HARD blocker either way.' },
  { id: 'PO-UNDRR', item: 'Product Owner: is a licence request to UNDRR and the Kenyan owning institution authorised? Two cheap human actions could close it — read the HDX Kenya dataset License field in a browser, and email meteoalarm@geosphere.at for the unread redistribution clause.' },
  { id: 'POL-R3', item: 'MAIN-POLITICS-PLATFORM-1-R3-M2 — replace only the superseded Part VIII ownership sentence with the approved M-2 authority, preserving all R2 lifecycle and source-schema corrections. Rebase onto the actual latest canonical first.' },
];
