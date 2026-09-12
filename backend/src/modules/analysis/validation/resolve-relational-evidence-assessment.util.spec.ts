import type { RelationalEvidenceAssessment } from '@globalnews-ai/shared';
import {
  resolveRelationalEvidenceAssessments,
  resolveRelationalSupport,
} from './resolve-relational-evidence-assessment.util';

function makeMaps(
  overrides: {
    evidenceMap?: Record<string, string>;
    evidenceTextMap?: Record<string, string>;
  } = {},
) {
  const evidenceMap = new Map(
    Object.entries(overrides.evidenceMap ?? { S1: 'real-article-1', S2: 'real-article-2' }),
  );
  const evidenceTextMap = new Map(
    Object.entries(
      overrides.evidenceTextMap ?? {
        S1: 'climate change is reducing maize yields',
        S2: 'agricultural emissions contribute to climate change',
      },
    ),
  );
  return { evidenceMap, evidenceTextMap };
}

describe('resolveRelationalEvidenceAssessments (Milestone #40)', () => {
  it('accepts a valid assessment', () => {
    const { evidenceMap, evidenceTextMap } = makeMaps();
    const { assessmentsById, allValidatedAssessments } = resolveRelationalEvidenceAssessments(
      [
        {
          assessmentId: 'R1',
          evidenceId: 'S1',
          excerpt: 'climate change is reducing maize yields',
          direction: 'requested-direction',
        },
      ],
      evidenceMap,
      evidenceTextMap,
    );
    expect(allValidatedAssessments).toEqual([
      {
        articleId: 'real-article-1',
        excerpt: 'climate change is reducing maize yields',
        direction: 'requested-direction',
      },
    ]);
    expect(assessmentsById.get('R1')).toEqual(allValidatedAssessments[0]);
  });

  it('rejects an invalid direction enum value', () => {
    const { evidenceMap, evidenceTextMap } = makeMaps();
    const { allValidatedAssessments } = resolveRelationalEvidenceAssessments(
      [
        {
          assessmentId: 'R1',
          evidenceId: 'S1',
          excerpt: 'climate change is reducing maize yields',
          direction: 'causal-proof',
        },
      ],
      evidenceMap,
      evidenceTextMap,
    );
    expect(allValidatedAssessments).toEqual([]);
  });

  it('rejects an unresolvable (unknown) evidenceId', () => {
    const { evidenceMap, evidenceTextMap } = makeMaps();
    const { allValidatedAssessments } = resolveRelationalEvidenceAssessments(
      [
        {
          assessmentId: 'R1',
          evidenceId: 'S99',
          excerpt: 'climate change is reducing maize yields',
          direction: 'requested-direction',
        },
      ],
      evidenceMap,
      evidenceTextMap,
    );
    expect(allValidatedAssessments).toEqual([]);
  });

  it('rejects a fabricated evidenceId the same way as an unknown one', () => {
    const { evidenceMap, evidenceTextMap } = makeMaps();
    const { allValidatedAssessments } = resolveRelationalEvidenceAssessments(
      [
        {
          assessmentId: 'R1',
          evidenceId: 'FABRICATED',
          excerpt: 'anything',
          direction: 'requested-direction',
        },
      ],
      evidenceMap,
      evidenceTextMap,
    );
    expect(allValidatedAssessments).toEqual([]);
  });

  it('rejects an excerpt that does not actually occur in the supplied evidence text', () => {
    const { evidenceMap, evidenceTextMap } = makeMaps();
    const { allValidatedAssessments } = resolveRelationalEvidenceAssessments(
      [
        {
          assessmentId: 'R1',
          evidenceId: 'S1',
          excerpt: 'a sentence that was never actually in the article',
          direction: 'requested-direction',
        },
      ],
      evidenceMap,
      evidenceTextMap,
    );
    expect(allValidatedAssessments).toEqual([]);
  });

  describe('duplicate assessmentId fail-closed regressions (correction round)', () => {
    it('A. R1 = valid, R1 = valid -> R1 absent from trusted map', () => {
      const { evidenceMap, evidenceTextMap } = makeMaps();
      const { assessmentsById, allValidatedAssessments } = resolveRelationalEvidenceAssessments(
        [
          {
            assessmentId: 'R1',
            evidenceId: 'S1',
            excerpt: 'climate change is reducing maize yields',
            direction: 'requested-direction',
          },
          {
            assessmentId: 'R1',
            evidenceId: 'S2',
            excerpt: 'agricultural emissions contribute to climate change',
            direction: 'reverse-direction',
          },
        ],
        evidenceMap,
        evidenceTextMap,
      );
      expect(assessmentsById.has('R1')).toBe(false);
      expect(allValidatedAssessments).toEqual([]);
    });

    it('B. R1 = valid, R1 = malformed evidenceId -> R1 absent from trusted map (the valid occurrence is NOT rescued)', () => {
      const { evidenceMap, evidenceTextMap } = makeMaps();
      const { assessmentsById, allValidatedAssessments } = resolveRelationalEvidenceAssessments(
        [
          {
            assessmentId: 'R1',
            evidenceId: 'S1',
            excerpt: 'climate change is reducing maize yields',
            direction: 'requested-direction',
          },
          {
            assessmentId: 'R1',
            evidenceId: 'S99',
            excerpt: 'anything',
            direction: 'reverse-direction',
          },
        ],
        evidenceMap,
        evidenceTextMap,
      );
      expect(assessmentsById.has('R1')).toBe(false);
      expect(allValidatedAssessments).toEqual([]);
    });

    it('C. R1 = valid, R1 = invalid direction -> R1 absent from trusted map (the valid occurrence is NOT rescued)', () => {
      const { evidenceMap, evidenceTextMap } = makeMaps();
      const { assessmentsById, allValidatedAssessments } = resolveRelationalEvidenceAssessments(
        [
          {
            assessmentId: 'R1',
            evidenceId: 'S1',
            excerpt: 'climate change is reducing maize yields',
            direction: 'requested-direction',
          },
          {
            assessmentId: 'R1',
            evidenceId: 'S2',
            excerpt: 'agricultural emissions contribute to climate change',
            direction: 'causal-proof',
          },
        ],
        evidenceMap,
        evidenceTextMap,
      );
      expect(assessmentsById.has('R1')).toBe(false);
      expect(allValidatedAssessments).toEqual([]);
    });

    it('D. R1 = malformed, R1 = malformed -> R1 absent from trusted map', () => {
      const { evidenceMap, evidenceTextMap } = makeMaps();
      const { assessmentsById, allValidatedAssessments } = resolveRelationalEvidenceAssessments(
        [
          { assessmentId: 'R1', evidenceId: 'S99', excerpt: 'x', direction: 'bogus' },
          { assessmentId: 'R1', evidenceId: 'S98', excerpt: 'y', direction: 'also-bogus' },
        ],
        evidenceMap,
        evidenceTextMap,
      );
      expect(assessmentsById.has('R1')).toBe(false);
      expect(allValidatedAssessments).toEqual([]);
    });

    it('E. a claim referencing an ambiguous R1 (from case B/C) still survives as an ordinary M31-grounded claim, with relationalSupport omitted', () => {
      const { evidenceMap, evidenceTextMap } = makeMaps();
      const { assessmentsById } = resolveRelationalEvidenceAssessments(
        [
          {
            assessmentId: 'R1',
            evidenceId: 'S1',
            excerpt: 'climate change is reducing maize yields',
            direction: 'requested-direction',
          },
          {
            assessmentId: 'R1',
            evidenceId: 'S99',
            excerpt: 'anything',
            direction: 'reverse-direction',
          },
        ],
        evidenceMap,
        evidenceTextMap,
      );
      // The claim's own M31 grounding is entirely separate from this
      // resolver — this test only proves the relational linkage itself
      // yields nothing for the ambiguous ID, not that the claim survives
      // (that's proven at the validateAnalysisResult integration level).
      const support = resolveRelationalSupport(['R1'], assessmentsById, ['real-article-1']);
      expect(support).toBeUndefined();
    });

    it('F. R1 ambiguous + R2 valid and unique -> claim referencing ["R1","R2"] ignores R1, still gets relationalSupport from R2 alone', () => {
      const { evidenceMap, evidenceTextMap } = makeMaps();
      const { assessmentsById } = resolveRelationalEvidenceAssessments(
        [
          {
            assessmentId: 'R1',
            evidenceId: 'S1',
            excerpt: 'climate change is reducing maize yields',
            direction: 'requested-direction',
          },
          {
            assessmentId: 'R1',
            evidenceId: 'S1',
            excerpt: 'climate change is reducing maize yields',
            direction: 'requested-direction',
          },
          {
            assessmentId: 'R2',
            evidenceId: 'S2',
            excerpt: 'agricultural emissions contribute to climate change',
            direction: 'reverse-direction',
          },
        ],
        evidenceMap,
        evidenceTextMap,
      );
      expect(assessmentsById.has('R1')).toBe(false);
      expect(assessmentsById.has('R2')).toBe(true);

      const support = resolveRelationalSupport(['R1', 'R2'], assessmentsById, [
        'real-article-1',
        'real-article-2',
      ]);
      expect(support).toEqual({
        direction: 'reverse-direction',
        assessments: [
          {
            articleId: 'real-article-2',
            excerpt: 'agricultural emissions contribute to climate change',
            direction: 'reverse-direction',
          },
        ],
      });
    });
  });

  it('a non-array candidate produces empty results without throwing', () => {
    const { evidenceMap, evidenceTextMap } = makeMaps();
    const { assessmentsById, allValidatedAssessments } = resolveRelationalEvidenceAssessments(
      undefined,
      evidenceMap,
      evidenceTextMap,
    );
    expect(assessmentsById.size).toBe(0);
    expect(allValidatedAssessments).toEqual([]);
  });

  it('never exposes an assessmentId or evidenceId anywhere in the validated output', () => {
    const { evidenceMap, evidenceTextMap } = makeMaps();
    const { allValidatedAssessments } = resolveRelationalEvidenceAssessments(
      [
        {
          assessmentId: 'R1',
          evidenceId: 'S1',
          excerpt: 'climate change is reducing maize yields',
          direction: 'requested-direction',
        },
      ],
      evidenceMap,
      evidenceTextMap,
    );
    const serialized = JSON.stringify(allValidatedAssessments);
    expect(serialized).not.toMatch(/"R1"/);
    expect(serialized).not.toMatch(/"S1"/);
  });
});

describe('resolveRelationalSupport (Milestone #40)', () => {
  const requestedAssessment: RelationalEvidenceAssessment = {
    articleId: 'real-article-1',
    excerpt: 'climate change is reducing maize yields',
    direction: 'requested-direction',
  };
  const reverseAssessment: RelationalEvidenceAssessment = {
    articleId: 'real-article-1',
    excerpt: 'agricultural emissions contribute to climate change',
    direction: 'reverse-direction',
  };
  const assessmentsById = new Map([
    ['R1', requestedAssessment],
    ['R2', reverseAssessment],
  ]);

  it('unknown R-id is safely ignored, relationalSupport omitted if nothing else resolves', () => {
    const result = resolveRelationalSupport(['R99'], assessmentsById, ['real-article-1']);
    expect(result).toBeUndefined();
  });

  it("an assessment whose article is outside the claim's own sourceArticleIds cannot attach", () => {
    const result = resolveRelationalSupport(['R1'], assessmentsById, ['some-other-article']);
    expect(result).toBeUndefined();
  });

  it('no relationshipAssessmentIds at all -> relationalSupport omitted (never manufactured)', () => {
    expect(
      resolveRelationalSupport(undefined, assessmentsById, ['real-article-1']),
    ).toBeUndefined();
    expect(resolveRelationalSupport(null, assessmentsById, ['real-article-1'])).toBeUndefined();
    expect(resolveRelationalSupport([], assessmentsById, ['real-article-1'])).toBeUndefined();
  });

  it('requested-only -> direction "requested-direction"', () => {
    const result = resolveRelationalSupport(['R1'], assessmentsById, ['real-article-1']);
    expect(result).toEqual({
      direction: 'requested-direction',
      assessments: [requestedAssessment],
    });
  });

  it('reverse-only -> direction "reverse-direction"', () => {
    const result = resolveRelationalSupport(['R2'], assessmentsById, ['real-article-1']);
    expect(result).toEqual({ direction: 'reverse-direction', assessments: [reverseAssessment] });
  });

  it('bidirectional-only -> direction "bidirectional"', () => {
    const map = new Map([
      ['R3', { articleId: 'a', excerpt: 'x', direction: 'bidirectional' as const }],
    ]);
    const result = resolveRelationalSupport(['R3'], map, ['a']);
    expect(result?.direction).toBe('bidirectional');
  });

  it('association-only-only -> direction "association-only"', () => {
    const map = new Map([
      ['R3', { articleId: 'a', excerpt: 'x', direction: 'association-only' as const }],
    ]);
    const result = resolveRelationalSupport(['R3'], map, ['a']);
    expect(result?.direction).toBe('association-only');
  });

  it('unclear-only -> direction "unclear"', () => {
    const map = new Map([['R3', { articleId: 'a', excerpt: 'x', direction: 'unclear' as const }]]);
    const result = resolveRelationalSupport(['R3'], map, ['a']);
    expect(result?.direction).toBe('unclear');
  });

  it('non-substantive-only -> direction "non-substantive"', () => {
    const map = new Map([
      ['R3', { articleId: 'a', excerpt: 'x', direction: 'non-substantive' as const }],
    ]);
    const result = resolveRelationalSupport(['R3'], map, ['a']);
    expect(result?.direction).toBe('non-substantive');
  });

  it('requested + requested (same direction twice, distinct assessments) -> "requested-direction"', () => {
    const map = new Map([
      ['R1', requestedAssessment],
      [
        'R3',
        {
          articleId: 'real-article-1',
          excerpt: 'another requested excerpt',
          direction: 'requested-direction' as const,
        },
      ],
    ]);
    const result = resolveRelationalSupport(['R1', 'R3'], map, ['real-article-1']);
    expect(result?.direction).toBe('requested-direction');
    expect(result?.assessments).toHaveLength(2);
  });

  it('requested + reverse -> "mixed"', () => {
    const result = resolveRelationalSupport(['R1', 'R2'], assessmentsById, ['real-article-1']);
    expect(result?.direction).toBe('mixed');
    expect(result?.assessments).toEqual([requestedAssessment, reverseAssessment]);
  });

  it('requested + association-only -> "mixed"', () => {
    const map = new Map([
      ['R1', requestedAssessment],
      ['R3', { articleId: 'real-article-1', excerpt: 'x', direction: 'association-only' as const }],
    ]);
    const result = resolveRelationalSupport(['R1', 'R3'], map, ['real-article-1']);
    expect(result?.direction).toBe('mixed');
  });

  it('reverse + unclear -> "mixed"', () => {
    const map = new Map([
      ['R2', reverseAssessment],
      ['R3', { articleId: 'real-article-1', excerpt: 'x', direction: 'unclear' as const }],
    ]);
    const result = resolveRelationalSupport(['R2', 'R3'], map, ['real-article-1']);
    expect(result?.direction).toBe('mixed');
  });

  it('a claim referencing an ambiguous (duplicate-invalidated) assessmentId gets no relationalSupport from it, without affecting anything else', () => {
    // Simulates the post-dedup state: R1 never made it into assessmentsById
    // because it was ambiguous at the top-level resolution step.
    const emptyMap = new Map<string, RelationalEvidenceAssessment>();
    const result = resolveRelationalSupport(['R1'], emptyMap, ['real-article-1']);
    expect(result).toBeUndefined();
  });

  it("CASE 9 REGRESSION: claim referencing only R1 gets requested-direction and ONLY R1's excerpt, never inheriting R2 merely because both share an article", () => {
    const claimA = resolveRelationalSupport(['R1'], assessmentsById, ['real-article-1']);
    expect(claimA).toEqual({
      direction: 'requested-direction',
      assessments: [requestedAssessment],
    });
    expect(claimA?.assessments).toHaveLength(1);
  });

  it("CASE 9 REGRESSION: claim referencing only R2 gets reverse-direction and ONLY R2's excerpt, on the SAME article as R1", () => {
    const claimB = resolveRelationalSupport(['R2'], assessmentsById, ['real-article-1']);
    expect(claimB).toEqual({ direction: 'reverse-direction', assessments: [reverseAssessment] });
    expect(claimB?.assessments).toHaveLength(1);
  });

  it('CASE 9 REGRESSION: claim referencing both R1 and R2 gets "mixed" with both exact validated excerpts', () => {
    const claimC = resolveRelationalSupport(['R1', 'R2'], assessmentsById, ['real-article-1']);
    expect(claimC?.direction).toBe('mixed');
    expect(claimC?.assessments).toEqual([requestedAssessment, reverseAssessment]);
  });

  it('a claim citing the same assessmentId twice contributes it only once', () => {
    const result = resolveRelationalSupport(['R1', 'R1'], assessmentsById, ['real-article-1']);
    expect(result?.assessments).toHaveLength(1);
  });

  it('never exposes an assessmentId anywhere in the resolved RelationalSupport', () => {
    const result = resolveRelationalSupport(['R1'], assessmentsById, ['real-article-1']);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/"R1"/);
  });
});
