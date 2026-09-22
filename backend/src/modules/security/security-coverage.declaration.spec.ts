import {
  assertCoverageDeclarationIsComplete,
  axisCoverageState,
  axisPermitsAssertion,
  outcomeEstablishesAbsence,
  outcomeIsComplete,
  OUTCOMES_ESTABLISHING_ABSENCE,
  SECURITY_COVERAGE_AXES,
  SECURITY_COVERAGE_LIMITATIONS,
  type SecurityCoverageAxis,
} from '@globalnews-ai/shared';
import {
  RETAINED_NEWS_CORPUS_SOURCE_ID,
  retainedCorpusOutcome,
  SECURITY_COVERAGE_DECLARED_AT,
  SECURITY_COVERAGE_DECLARED_BY,
  SECURITY_RETAINED_CORPUS_LIMITATIONS,
  securityCoverageDeclaration,
} from './security-coverage.declaration';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-24 — ONE AXIS COVERED, FOUR DECLARED GAPS, AND NO SILENCE ANYWHERE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "Silence would masquerade as safety." The failure this file guards against is the one that
 * looks like an improvement: a future change that widens `expectedSourceSet` on CAUSE, ACTOR,
 * POSTURE or SEVERITY would make the surface look far more capable and would be asserting
 * coverage that does not exist.
 *
 * The other guarded failure is the `catch` block. A database error must never be spelled as
 * the one outcome that establishes absence, and `retainedCorpusOutcome` is the single place
 * that decision is made.
 */

const QUERY = { geographyId: 'RW', maxAgeMinutes: '1440' };
const ATTEMPTED_AT = '2026-09-22T10:00:00.000Z';

describe('the declaration — authored, complete, and honest about four axes', () => {
  const declaration = securityCoverageDeclaration('RW', SECURITY_COVERAGE_AXES);

  it('declares every accepted axis exactly once — an omitted axis is silence', () => {
    expect(() => assertCoverageDeclarationIsComplete(declaration)).not.toThrow();
    expect(declaration.axes).toHaveLength(SECURITY_COVERAGE_AXES.length);

    for (const axis of SECURITY_COVERAGE_AXES) {
      expect(declaration.axes.filter((a) => a.axis === axis)).toHaveLength(1);
    }
  });

  it('names its author and its authoring date — a declaration with no author is not one', () => {
    expect(declaration.declaredBy).toBe(SECURITY_COVERAGE_DECLARED_BY);
    expect(declaration.declaredBy.trim().length).toBeGreaterThan(0);
    // A FIXED constant, not the clock: a judgement nobody has reviewed must not look
    // freshly reviewed on every page load.
    expect(declaration.declaredAt).toBe(SECURITY_COVERAGE_DECLARED_AT);
    expect(SECURITY_COVERAGE_DECLARED_AT).toBe('2026-09-22T00:00:00.000Z');
  });

  it('expects the retained corpus on OCCURRENCE and nothing at all on the other four', () => {
    const occurrence = declaration.axes.find((a) => a.axis === 'OCCURRENCE');
    expect(occurrence?.expectedSourceSet).toEqual([RETAINED_NEWS_CORPUS_SOURCE_ID]);

    for (const axis of ['CAUSE', 'ACTOR', 'POSTURE', 'SEVERITY'] as SecurityCoverageAxis[]) {
      const entry = declaration.axes.find((a) => a.axis === axis);
      // AN EMPTY SET IS A DECLARED COVERAGE GAP, NOT A PASS.
      expect(entry?.expectedSourceSet).toEqual([]);
      // And it states WHY, because the exclusion is by definition not in the data.
      expect(entry?.knownExclusions).toHaveLength(1);
      expect(entry?.knownExclusions[0]?.excludes.trim().length).toBeGreaterThan(0);
      expect(entry?.knownExclusions[0]?.establishedBy.trim().length).toBeGreaterThan(0);
    }
  });

  it('does not write the caller window into the declaration', () => {
    // The window bounds what is RETURNED; the declaration states what the source can SEE.
    // A narrow question must not make a source look narrow.
    expect(declaration.window).toBeUndefined();
  });

  it('is dimensioned per geography rather than held as one global constant', () => {
    const kenya = securityCoverageDeclaration('KE', SECURITY_COVERAGE_AXES);
    expect(kenya.geographyId).toBe('KE');
    expect(kenya.subjectId).toBe('KE');
    expect(declaration.geographyId).toBe('RW');
  });

  it('refuses a declaration that omits an axis — the positive control on the guard', () => {
    expect(() =>
      securityCoverageDeclaration('RW', ['OCCURRENCE', 'CAUSE', 'ACTOR', 'POSTURE']),
    ).toThrow(/SEC-COV-1/);
  });
});

describe('the derived coverage state — the four gaps can never permit an assertion', () => {
  const declaration = securityCoverageDeclaration('RW', SECURITY_COVERAGE_AXES);

  it('reaches ESTABLISHED on OCCURRENCE when the corpus answered completely', () => {
    const success = retainedCorpusOutcome({ succeeded: true, rowCount: 3 }, ATTEMPTED_AT, QUERY);
    expect(axisCoverageState(declaration, 'OCCURRENCE', [success])).toBe('ESTABLISHED');
    expect(axisPermitsAssertion('ESTABLISHED')).toBe(true);
  });

  it('reaches ESTABLISHED on OCCURRENCE when the corpus answered completely with no rows', () => {
    // NO_RESULTS is a COMPLETE answer. "We looked and found nothing" is establishable;
    // "we could not look" is not, and they must not share a state.
    const empty = retainedCorpusOutcome({ succeeded: true, rowCount: 0 }, ATTEMPTED_AT, QUERY);
    expect(axisCoverageState(declaration, 'OCCURRENCE', [empty])).toBe('ESTABLISHED');
  });

  it('falls to UNESTABLISHED on OCCURRENCE when the read did not complete', () => {
    const failed = retainedCorpusOutcome({ succeeded: false, rowCount: 0 }, ATTEMPTED_AT, QUERY);
    expect(axisCoverageState(declaration, 'OCCURRENCE', [failed])).toBe('UNESTABLISHED');
    expect(axisPermitsAssertion('UNESTABLISHED')).toBe(false);
  });

  it('falls to UNESTABLISHED on OCCURRENCE when no outcome was recorded at all', () => {
    // The anti-optimism rule: a query nobody recorded is a query nobody can prove ran.
    expect(axisCoverageState(declaration, 'OCCURRENCE', [])).toBe('UNESTABLISHED');
  });

  it.each(['CAUSE', 'ACTOR', 'POSTURE', 'SEVERITY'] as SecurityCoverageAxis[])(
    'holds %s at GAP_DECLARED however well the corpus answered',
    (axis) => {
      const success = retainedCorpusOutcome({ succeeded: true, rowCount: 50 }, ATTEMPTED_AT, QUERY);
      const state = axisCoverageState(declaration, axis, [success]);

      expect(state).toBe('GAP_DECLARED');
      expect(axisPermitsAssertion(state)).toBe(false);
    },
  );
});

describe('retainedCorpusOutcome — the three-way, and the one outcome that establishes absence', () => {
  it('spells a completed read with rows as SUCCESS', () => {
    const outcome = retainedCorpusOutcome({ succeeded: true, rowCount: 2 }, ATTEMPTED_AT, QUERY);
    expect(outcome.outcome).toBe('SUCCESS');
    expect(outcomeIsComplete(outcome.outcome)).toBe(true);
    // SUCCESS establishes PRESENCE of what it returned, and deliberately not absence.
    expect(outcomeEstablishesAbsence(outcome.outcome)).toBe(false);
  });

  it('spells a completed read with no rows as NO_RESULTS — the only absence-establishing outcome', () => {
    const outcome = retainedCorpusOutcome({ succeeded: true, rowCount: 0 }, ATTEMPTED_AT, QUERY);
    expect(outcome.outcome).toBe('NO_RESULTS');
    expect(outcomeEstablishesAbsence(outcome.outcome)).toBe(true);
    expect(OUTCOMES_ESTABLISHING_ABSENCE).toEqual(['NO_RESULTS']);
  });

  /**
   * ══ THE REGRESSION THIS FUNCTION EXISTS TO PREVENT ══
   *
   * A dropped database connection rendered as "nothing happened in this country this week".
   */
  it('NEVER spells a failed read as an absence', () => {
    const outcome = retainedCorpusOutcome({ succeeded: false, rowCount: 0 }, ATTEMPTED_AT, QUERY);

    expect(outcome.outcome).toBe('SOURCE_UNAVAILABLE');
    expect(outcomeEstablishesAbsence(outcome.outcome)).toBe(false);
    expect(outcomeIsComplete(outcome.outcome)).toBe(false);
    // An incomplete outcome must say which failure it was, in words.
    expect(outcome.outcomeDetail?.trim().length).toBeGreaterThan(0);
  });

  it('does not spell a failed read as an absence even if rows were somehow counted', () => {
    const outcome = retainedCorpusOutcome({ succeeded: false, rowCount: 7 }, ATTEMPTED_AT, QUERY);
    expect(outcome.outcome).toBe('SOURCE_UNAVAILABLE');
  });

  it('echoes the query back beside its result, and names the source by registry id', () => {
    const outcome = retainedCorpusOutcome({ succeeded: true, rowCount: 1 }, ATTEMPTED_AT, QUERY);

    expect(outcome.sourceId).toBe(RETAINED_NEWS_CORPUS_SOURCE_ID);
    // Never a bare hostname.
    expect(outcome.sourceId).not.toMatch(/\./);
    expect(outcome.queryParameters).toEqual(QUERY);
    expect(outcome.attemptedAt).toBe(ATTEMPTED_AT);
  });

  it('omits outcomeDetail on a complete outcome rather than restating it', () => {
    expect(
      retainedCorpusOutcome({ succeeded: true, rowCount: 1 }, ATTEMPTED_AT, QUERY).outcomeDetail,
    ).toBeUndefined();
    expect(
      retainedCorpusOutcome({ succeeded: true, rowCount: 0 }, ATTEMPTED_AT, QUERY).outcomeDetail,
    ).toBeUndefined();
  });

  it('accepts no HTTP status anywhere — the outcome is never derived from one', () => {
    // `OUTCOME_IS_NEVER_DERIVED_FROM_HTTP_STATUS`. The signature is the guarantee: there is
    // nowhere to pass a 200 from an empty ArcGIS shell.
    expect(retainedCorpusOutcome.length).toBe(3);
  });
});

describe('the partial limitations — reported as codes, and all of them claimed', () => {
  it('states every limitation the shared vocabulary declares', () => {
    expect([...SECURITY_RETAINED_CORPUS_LIMITATIONS].sort()).toEqual(
      [...SECURITY_COVERAGE_LIMITATIONS].sort(),
    );
  });

  it('is non-empty — a surface that states nothing it cannot see looks complete', () => {
    expect(SECURITY_RETAINED_CORPUS_LIMITATIONS.length).toBeGreaterThan(0);
  });

  it('carries codes and not reader prose', () => {
    for (const code of SECURITY_RETAINED_CORPUS_LIMITATIONS) {
      // SCREAMING_SNAKE_CASE, language-neutral. The frontend renders it in its own languages.
      expect(code).toMatch(/^[A-Z0-9_]+$/);
      expect(code).not.toMatch(/\s/);
    }
  });

  it('names the English-lexicon gap, which is the one a reader would otherwise never learn', () => {
    expect(SECURITY_RETAINED_CORPUS_LIMITATIONS).toContain('RETAINED_CORPUS_ENGLISH_LEXICON_ONLY');
    expect(SECURITY_RETAINED_CORPUS_LIMITATIONS).toContain(
      'NO_OCCURRENCE_TIME_IN_RETAINED_EVIDENCE',
    );
    expect(SECURITY_RETAINED_CORPUS_LIMITATIONS).toContain(
      'UNRESOLVED_OWNERSHIP_OCCURRENCES_WITHHELD',
    );
  });
});
