/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE COVERAGE DECLARATION — AUTHORED, BECAUSE IT CANNOT BE DERIVED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA-SECURITY-EVIDENCE-R1.
 *
 * ── WHY THIS FILE SITS AT THE MODULE ROOT AND NOT IN A `coverage/` FOLDER ─
 *
 * It was written as `security/coverage/security-coverage.declaration.ts` and `git add`
 * SILENTLY DID NOT STAGE IT: `.gitignore` line 35 is `coverage/`, which exists for jest's
 * `coverageDirectory` and matches a directory of that name at any depth.
 *
 * The file would have been absent from the commit while every local test kept passing, and
 * the build would have broken for the next person to clone. `candidate-integrity.spec.ts` is
 * the guard that catches this class of omission, and it is what surfaced it.
 *
 * Moving the file was preferred to adding a `!` negation to `.gitignore`: the ignore rule is
 * repository-wide and correct, and editing it to accommodate a directory name this lane
 * chose would leave the same trap for the next module that picks the same word.
 *
 * A-24 is the mandatory shared platform requirement whose failure mode Part IX stated in
 * five words: *"Silence would masquerade as safety."* The declaration below is the field
 * the accepted contract says *"G proved cannot be derived and must be AUTHORED"*, and this
 * file is where it is authored for the one source this lane has.
 *
 * ── WHAT THE ONE SOURCE IS ────────────────────────────────────────────────
 *
 * `retained-news-corpus` — the articles this deployment already retrieved and persisted.
 * It is declared as a registry id rather than a hostname, per `SourceQueryRecord.sourceId`,
 * and it is ONE source even though several providers fill it: the corpus is what Security
 * queries, and the provider that put a row there is the corpus's business, not Security's.
 *
 * ── THE SHAPE OF THE ANSWER: ONE AXIS COVERED, FOUR DECLARED GAPS ─────────
 *
 * This is the whole honest result of the lane, and it matches what Part IX measured
 * independently: *"G measured that EVERY P0 subject has a permanent coverage gap on CAUSE,
 * ACTOR, POSTURE and SEVERITY."*
 *
 *   OCCURRENCE  the corpus CAN establish that something was reported to have happened,
 *               at a place and a time. `expectedSourceSet: [CORPUS]`.
 *   CAUSE       *"established by a named authority. Never inferred from occurrence."*
 *   ACTOR       *"Never inferred from cause."*
 *   POSTURE     *"a declared, dated, scoped, expiring state issued by an external
 *               authority"* — a newspaper reporting a curfew is not the authority issuing
 *               one, and carries neither scope nor expiry.
 *   SEVERITY    `SEVERITY_IS_NEVER_IMPORTED_PREGRADED = true`.
 *
 * The four carry `expectedSourceSet: []`, and the accepted contract is explicit that this
 * is the right spelling rather than a shortcut: *"AN EMPTY SET IS A DECLARED COVERAGE GAP,
 * NOT A PASS. It is the honest and common case."*
 *
 * Each of the four also carries a `KnownExclusion` that STATES WHY, even though
 * `axisCoverageState` returns `GAP_DECLARED` on the empty set before it ever looks at
 * exclusions. The redundancy is deliberate: a reviewer reading the declaration learns what
 * the corpus structurally cannot see, and *"it is by definition not in the data."*
 *
 * ── WHAT IS DELIBERATELY NOT DECLARED HERE ────────────────────────────────
 *
 * NO `window`. Coverage of a window is not coverage of all time, and this lane's read does
 * bound its query by age — but the bound is a REQUEST parameter chosen by the caller, not a
 * property of the corpus's coverage. Writing the caller's `maxAgeMinutes` into the
 * declaration would make a narrow question look like a narrow source.
 */

import type {
  AxisCoverageDeclaration,
  CoverageDeclaration,
  KnownExclusion,
  SecurityCoverageAxis,
  SecurityCoverageLimitation,
  SourceQueryOutcome,
  SourceQueryRecord,
} from '@globalnews-ai/shared';
import { assertCoverageDeclarationIsComplete } from '@globalnews-ai/shared';

/** The corpus's registry id. One name, used by the declaration and by every outcome record. */
export const RETAINED_NEWS_CORPUS_SOURCE_ID = 'retained-news-corpus';

/** Who authored the declaration. *"A declaration with no author is not a declaration."* */
export const SECURITY_COVERAGE_DECLARED_BY = 'BETA-SECURITY-EVIDENCE-R1';

/**
 * WHEN IT WAS AUTHORED — a fixed constant, never `new Date()`.
 *
 * `declaredAt` records when a HUMAN authored this coverage judgement. Reading the clock
 * would restate the moment of each request as the moment the judgement was made, which
 * would make a declaration that has never been reviewed look freshly reviewed on every
 * page load. That is the same defect `vintageProvenance` exists to prevent one layer down.
 */
export const SECURITY_COVERAGE_DECLARED_AT = '2026-09-22T00:00:00.000Z';

/**
 * The PARTIAL limitations this surface reports to a reader. See
 * `SECURITY_COVERAGE_LIMITATIONS` for why they are codes and why they are not exclusions.
 *
 * Every member of the shared union is listed, because every member is true of this lane. It
 * is spelled out rather than spread from the union so that adding a member to the
 * vocabulary does not silently assert it of this producer.
 */
export const SECURITY_RETAINED_CORPUS_LIMITATIONS: readonly SecurityCoverageLimitation[] = [
  'RETAINED_CORPUS_ENGLISH_LEXICON_ONLY',
  'NO_OCCURRENCE_TIME_IN_RETAINED_EVIDENCE',
  'GEOGRAPHY_PRECISION_COUNTRY_ONLY',
  'SINGLE_PUBLISHER_PER_OBSERVATION_NO_CORROBORATION',
  'UNRESOLVED_OWNERSHIP_OCCURRENCES_WITHHELD',
];

/**
 * WHAT THE CORPUS STRUCTURALLY CANNOT SEE, PER AXIS.
 *
 * `establishedBy` names where each exclusion was learned, because — as the accepted
 * contract puts it — it is *"AUTHORED BECAUSE IT IS NOT IN-BAND"*: the corpus returns an
 * empty result for a cause query that is indistinguishable from a cause query that found
 * nothing.
 */
const AXIS_EXCLUSIONS: Readonly<Record<SecurityCoverageAxis, string | null>> = {
  OCCURRENCE: null,
  CAUSE:
    'A retained news record reports that something happened; it does not carry a cause ' +
    'established by a named authority. Cause is never inferred from occurrence.',
  ACTOR:
    'A retained news record may name a suspect or an organisation in prose, and prose is ' +
    'not an actor attribution. Actor is never inferred from cause, and this lane parses no ' +
    'entity out of a headline.',
  POSTURE:
    'A posture is a declared, dated, scoped, expiring state issued by an external ' +
    'authority. A publisher reporting that a curfew exists issues none, and carries ' +
    'neither the scope nor the expiry that would make it one.',
  SEVERITY:
    'Severity is never imported pre-graded from a source, and nothing in this lane grades ' +
    'one locally. The shared ladder stays unselected.',
};

function axisDeclaration(axis: SecurityCoverageAxis): AxisCoverageDeclaration {
  const excludes = AXIS_EXCLUSIONS[axis];

  if (excludes === null) {
    return {
      axis,
      expectedSourceSet: [RETAINED_NEWS_CORPUS_SOURCE_ID],
      knownExclusions: [],
    };
  }

  const exclusion: KnownExclusion = {
    sourceId: RETAINED_NEWS_CORPUS_SOURCE_ID,
    excludes,
    axes: [axis],
    establishedBy: `${SECURITY_COVERAGE_DECLARED_BY}, from the accepted Part IX axis definitions`,
  };

  return {
    /*
      THE EMPTY SET IS THE DECLARATION. `axisCoverageState` returns GAP_DECLARED on it
      before exclusions are consulted, so the exclusion below changes no state — it is
      carried so a reviewer reading the declaration learns the reason rather than inferring
      it from an empty array.
    */
    axis,
    expectedSourceSet: [],
    knownExclusions: [exclusion],
  };
}

/**
 * THE DECLARATION FOR ONE GEOGRAPHY.
 *
 * It is built per geography rather than held as one global constant because
 * `CoverageDeclaration` is dimensioned by subject × axis × geography and the contract
 * refuses to let that be flattened. The AXES are identical for every geography today, and
 * that is a fact about this lane's single source rather than a shortcut: the shape stays
 * per-geography so a later source with real regional variation needs no change here.
 *
 * It self-checks. `assertCoverageDeclarationIsComplete` refuses a declaration that omits or
 * duplicates an axis, and calling it here means a mistake in this file fails at
 * construction rather than reaching an assessment that would fail `SEC-ASSESS-3` with a
 * less obvious message.
 */
export function securityCoverageDeclaration(
  geographyId: string,
  axes: readonly SecurityCoverageAxis[],
): CoverageDeclaration {
  const declaration: CoverageDeclaration = {
    subjectId: geographyId,
    geographyId,
    axes: axes.map(axisDeclaration),
    declaredBy: SECURITY_COVERAGE_DECLARED_BY,
    declaredAt: SECURITY_COVERAGE_DECLARED_AT,
  };
  assertCoverageDeclarationIsComplete(declaration);
  return declaration;
}

/**
 * WHAT THE ONE QUERY AGAINST THE CORPUS ACTUALLY DID.
 *
 * ══ THE DISTINCTION THIS FUNCTION EXISTS FOR ══
 *
 * `SUCCESS` and `NO_RESULTS` are BOTH complete answers and both permit the OCCURRENCE axis
 * to reach `ESTABLISHED`. `SOURCE_UNAVAILABLE` does not, and the difference is the entire
 * point of the accepted vocabulary:
 *
 *   the corpus answered, with rows        SUCCESS               presence
 *   the corpus answered, with no rows     NO_RESULTS            THE ONLY absence-establishing
 *                                                              outcome in the contract
 *   the read threw                        SOURCE_UNAVAILABLE    establishes nothing
 *
 * A database error spelled `NO_RESULTS` would render as "nothing happened in this country
 * this week." It is the exact failure the accepted union was built from observed sources to
 * prevent, and it is why this function takes a THREE-way input and not a row count.
 *
 * NO HTTP STATUS, AND NONE IS ACCEPTED. `OUTCOME_IS_NEVER_DERIVED_FROM_HTTP_STATUS = true`;
 * this reads a local database and has no status to be tempted by.
 */
export function retainedCorpusOutcome(
  read: { readonly succeeded: boolean; readonly rowCount: number },
  attemptedAt: string,
  queryParameters: Readonly<Record<string, string>>,
): SourceQueryRecord {
  if (!read.succeeded) {
    const outcome: SourceQueryOutcome = 'SOURCE_UNAVAILABLE';
    return {
      sourceId: RETAINED_NEWS_CORPUS_SOURCE_ID,
      outcome,
      attemptedAt,
      queryParameters,
      outcomeDetail:
        'The retained-corpus read did not complete. The corpus is expected to answer later, ' +
        'and this outcome establishes nothing about whether anything happened.',
    };
  }

  const outcome: SourceQueryOutcome = read.rowCount > 0 ? 'SUCCESS' : 'NO_RESULTS';
  return {
    sourceId: RETAINED_NEWS_CORPUS_SOURCE_ID,
    outcome,
    attemptedAt,
    queryParameters,
    /*
      `outcomeDetail` is *"Required when the outcome is not complete"*. Both of these ARE
      complete, so it is omitted rather than filled with a restatement of the outcome — a
      detail that adds nothing is a field a reader learns to ignore.
    */
  };
}
