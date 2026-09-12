import type {
  AgreementPoint,
  DifferenceItem,
  NewsAnalysisResult,
  RelationalEvidenceAssessment,
  SourcedClaim,
  TimelineEvent,
} from '@globalnews-ai/shared';
import { deriveTrustState } from './derive-trust-state.util';

function claim(
  text: string,
  sourceArticleIds: string[] = [],
  relationalSupport?: SourcedClaim['relationalSupport'],
): SourcedClaim {
  return { claim: text, sourceArticleIds, ...(relationalSupport ? { relationalSupport } : {}) };
}

function assessment(
  articleId: string,
  direction: RelationalEvidenceAssessment['direction'],
): RelationalEvidenceAssessment {
  return { articleId, excerpt: 'x', direction };
}

type RC = NonNullable<NewsAnalysisResult['relationalComposition']>;

function relationalComposition(overrides: Partial<RC>): RC {
  return {
    directionalEligibility: 'unsupported',
    evidenceSufficiency: 'insufficient',
    summary: 'x',
    supportingClaims: [],
    reverseClaims: [],
    associationOnlyClaims: [],
    mixedClaims: [],
    unclearOrNonSubstantiveClaims: [],
    ...overrides,
  };
}

describe('deriveTrustState (Milestone #42)', () => {
  describe('A. mock hard override', () => {
    it('mock-ai + 0 articles -> insufficient / [mock-execution]', () => {
      const result = deriveTrustState('mock-ai', [], [], [], [], 0, undefined);
      expect(result.level).toBe('insufficient');
      expect(result.reasons).toEqual(['mock-execution']);
    });

    it('mock-ai + 1 article -> insufficient / [mock-execution]', () => {
      const result = deriveTrustState('mock-ai', [claim('c1', ['a1'])], [], [], [], 0, undefined);
      expect(result.level).toBe('insufficient');
      expect(result.reasons).toEqual(['mock-execution']);
    });

    it('mock-ai + 5 distinct grounded articles -> insufficient / [mock-execution]', () => {
      const keyFacts = [
        claim('c1', ['a1']),
        claim('c2', ['a2']),
        claim('c3', ['a3']),
        claim('c4', ['a4']),
        claim('c5', ['a5']),
      ];
      const result = deriveTrustState('mock-ai', keyFacts, [], [], [], 0, undefined);
      expect(result.level).toBe('insufficient');
      expect(result.reasons).toEqual(['mock-execution']);
      // Metrics still accurately reflect the structure, per the spec's
      // "IMPORTANT IMPLEMENTATION CLARIFICATION" — just don't influence level.
      expect(result.distinctSourceArticleCount).toBe(5);
    });

    it('mock-ai + relationalComposition that would otherwise qualify HIGH -> still insufficient / [mock-execution]', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        supportingClaims: [
          { section: 'keyFacts', index: 0 },
          { section: 'keyFacts', index: 1 },
        ],
      });
      const keyFacts = [
        claim('c1', ['a1'], {
          direction: 'requested-direction',
          assessments: [assessment('a1', 'requested-direction')],
        }),
        claim('c2', ['a2'], {
          direction: 'requested-direction',
          assessments: [assessment('a2', 'requested-direction')],
        }),
      ];
      const result = deriveTrustState('mock-ai', keyFacts, [], [], [], 0, rc);
      expect(result.level).toBe('insufficient');
      expect(result.reasons).toEqual(['mock-execution']);
    });
  });

  describe('B. non-relational live', () => {
    it('0 distinct articles -> insufficient', () => {
      const result = deriveTrustState('live-ai', [], [], [], [], 0, undefined);
      expect(result.level).toBe('insufficient');
      expect(result.reasons).toContain('no-grounded-evidence');
    });

    it('1 distinct article -> limited', () => {
      const result = deriveTrustState('live-ai', [claim('c1', ['a1'])], [], [], [], 0, undefined);
      expect(result.level).toBe('limited');
      expect(result.reasons).toContain('single-distinct-article');
    });

    it('2 distinct articles -> moderate', () => {
      const result = deriveTrustState(
        'live-ai',
        [claim('c1', ['a1']), claim('c2', ['a2'])],
        [],
        [],
        [],
        0,
        undefined,
      );
      expect(result.level).toBe('moderate');
      expect(result.reasons).toContain('multiple-distinct-articles');
    });

    it('5 distinct articles -> moderate (HIGH is impossible)', () => {
      const keyFacts = [1, 2, 3, 4, 5].map((n) => claim(`c${n}`, [`a${n}`]));
      const result = deriveTrustState('live-ai', keyFacts, [], [], [], 0, undefined);
      expect(result.level).toBe('moderate');
      expect(result.level).not.toBe('high');
    });
  });

  describe('C. distinct counting', () => {
    it('3 claims using the same article ID -> distinctSourceArticleCount = 1', () => {
      const keyFacts = [claim('c1', ['same']), claim('c2', ['same']), claim('c3', ['same'])];
      const result = deriveTrustState('live-ai', keyFacts, [], [], [], 0, undefined);
      expect(result.distinctSourceArticleCount).toBe(1);
    });

    it('claims across two distinct IDs -> distinctSourceArticleCount = 2', () => {
      const keyFacts = [claim('c1', ['a']), claim('c2', ['b'])];
      const result = deriveTrustState('live-ai', keyFacts, [], [], [], 0, undefined);
      expect(result.distinctSourceArticleCount).toBe(2);
    });

    it('same article ID repeated across keyFacts + agreements + timeline -> counted once', () => {
      const keyFacts = [claim('c1', ['same'])];
      const agreements: AgreementPoint[] = [{ point: 'p1', sourceArticleIds: ['same'] }];
      const timeline: TimelineEvent[] = [
        { timestamp: new Date().toISOString(), event: 'e1', sourceArticleIds: ['same'] },
      ];
      const result = deriveTrustState('live-ai', keyFacts, agreements, [], timeline, 0, undefined);
      expect(result.distinctSourceArticleCount).toBe(1);
    });
  });

  describe('D. uncertainties', () => {
    it('uncertaintyCount is accurately populated', () => {
      const result = deriveTrustState(
        'live-ai',
        [claim('c1', ['a1', 'a2'])],
        [],
        [],
        [],
        3,
        undefined,
      );
      expect(result.uncertaintyCount).toBe(3);
    });

    it('uncertaintyCount > 0 does NOT independently downgrade level', () => {
      const keyFacts = [claim('c1', ['a1']), claim('c2', ['a2'])];
      const withUncertainty = deriveTrustState('live-ai', keyFacts, [], [], [], 5, undefined);
      const without = deriveTrustState('live-ai', keyFacts, [], [], [], 0, undefined);
      expect(withUncertainty.level).toBe(without.level);
      expect(withUncertainty.level).toBe('moderate');
      expect(withUncertainty.reasons).toContain('uncertainties-reported');
    });
  });

  describe('E. differences', () => {
    it('differenceTopicCount is accurately populated', () => {
      const differences: DifferenceItem[] = [
        { topic: 't1', positions: [] },
        { topic: 't2', positions: [] },
      ];
      const result = deriveTrustState(
        'live-ai',
        [claim('c1', ['a1'])],
        [],
        differences,
        [],
        0,
        undefined,
      );
      expect(result.differenceTopicCount).toBe(2);
    });

    it('differences > 0 do NOT independently downgrade level or imply contradiction (non-relational)', () => {
      const keyFacts = [claim('c1', ['a1']), claim('c2', ['a2'])];
      const differences: DifferenceItem[] = [{ topic: 't1', positions: [] }];
      const withDifferences = deriveTrustState(
        'live-ai',
        keyFacts,
        [],
        differences,
        [],
        0,
        undefined,
      );
      const without = deriveTrustState('live-ai', keyFacts, [], [], [], 0, undefined);
      expect(withDifferences.level).toBe(without.level);
      expect(withDifferences.level).toBe('moderate');
      expect(withDifferences.relationalContradictionPresent).toBeUndefined();
      expect(withDifferences.reasons).toContain('differences-reported');
    });
  });

  describe('F. live relational', () => {
    it('unsupported -> insufficient', () => {
      const rc = relationalComposition({
        directionalEligibility: 'unsupported',
        evidenceSufficiency: 'insufficient',
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.level).toBe('insufficient');
      expect(result.reasons).toContain('requested-direction-unsupported');
    });

    it('adequate / no reverse or mixed -> high', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.level).toBe('high');
      expect(result.reasons).toEqual(['relational-support-adequate']);
    });

    it('adequate + reverse -> moderate', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        reverseClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.level).toBe('moderate');
      expect(result.reasons).toContain('relational-support-adequate');
      expect(result.reasons).toContain('reverse-evidence-present');
    });

    it('adequate + mixed -> moderate', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        mixedClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.level).toBe('moderate');
      expect(result.reasons).toContain('mixed-evidence-present');
    });

    it('limited -> limited', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'limited',
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.level).toBe('limited');
      expect(result.reasons).toContain('relational-support-limited');
    });

    it('association-only without requested-direction support -> insufficient (via M41 unsupported state)', () => {
      const rc = relationalComposition({
        directionalEligibility: 'unsupported',
        evidenceSufficiency: 'insufficient',
        associationOnlyClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.level).toBe('insufficient');
    });
  });

  describe('G. relational contradiction', () => {
    it('reverse claims present -> relationalContradictionPresent = true', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        reverseClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.relationalContradictionPresent).toBe(true);
    });

    it('mixed claims present -> relationalContradictionPresent = true', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        mixedClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.relationalContradictionPresent).toBe(true);
    });

    it('association-only claims alone -> relationalContradictionPresent = false', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        associationOnlyClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.relationalContradictionPresent).toBe(false);
    });

    it('unclear/non-substantive claims alone -> relationalContradictionPresent = false', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        unclearOrNonSubstantiveClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const result = deriveTrustState('live-ai', [], [], [], [], 0, rc);
      expect(result.relationalContradictionPresent).toBe(false);
    });
  });

  describe('H. reason codes', () => {
    it('no duplicate reason codes', () => {
      const rc = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        reverseClaims: [{ section: 'keyFacts', index: 0 }],
        mixedClaims: [{ section: 'keyFacts', index: 1 }],
      });
      const result = deriveTrustState(
        'live-ai',
        [],
        [],
        [{ topic: 't', positions: [] }],
        [],
        2,
        rc,
      );
      expect(new Set(result.reasons).size).toBe(result.reasons.length);
    });

    it('uncertainties-reported only when uncertaintyCount > 0', () => {
      const withNone = deriveTrustState('live-ai', [claim('c1', ['a1'])], [], [], [], 0, undefined);
      const withSome = deriveTrustState('live-ai', [claim('c1', ['a1'])], [], [], [], 1, undefined);
      expect(withNone.reasons).not.toContain('uncertainties-reported');
      expect(withSome.reasons).toContain('uncertainties-reported');
    });

    it('differences-reported only when differenceTopicCount > 0', () => {
      const withNone = deriveTrustState('live-ai', [claim('c1', ['a1'])], [], [], [], 0, undefined);
      const withSome = deriveTrustState(
        'live-ai',
        [claim('c1', ['a1'])],
        [],
        [{ topic: 't', positions: [] }],
        [],
        0,
        undefined,
      );
      expect(withNone.reasons).not.toContain('differences-reported');
      expect(withSome.reasons).toContain('differences-reported');
    });

    it('reverse-evidence-present only when reverseClaims non-empty', () => {
      const withReverse = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        reverseClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const without = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
      });
      expect(deriveTrustState('live-ai', [], [], [], [], 0, withReverse).reasons).toContain(
        'reverse-evidence-present',
      );
      expect(deriveTrustState('live-ai', [], [], [], [], 0, without).reasons).not.toContain(
        'reverse-evidence-present',
      );
    });

    it('mixed-evidence-present only when mixedClaims non-empty', () => {
      const withMixed = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
        mixedClaims: [{ section: 'keyFacts', index: 0 }],
      });
      const without = relationalComposition({
        directionalEligibility: 'supported',
        evidenceSufficiency: 'adequate',
      });
      expect(deriveTrustState('live-ai', [], [], [], [], 0, withMixed).reasons).toContain(
        'mixed-evidence-present',
      );
      expect(deriveTrustState('live-ai', [], [], [], [], 0, without).reasons).not.toContain(
        'mixed-evidence-present',
      );
    });
  });

  describe('I. model overconfidence is structurally irrelevant', () => {
    it('deriveTrustState never receives or reads analysis.confidence at all — insufficient evidence stays insufficient regardless', () => {
      // deriveTrustState's signature has no confidence parameter at all —
      // this test documents that guarantee by construction: there is no
      // way to pass a "confidence: high, score: 95" value into this
      // function even if a caller wanted to.
      const result = deriveTrustState('live-ai', [], [], [], [], 0, undefined);
      expect(result.level).toBe('insufficient');
    });
  });

  describe('J. required field', () => {
    it('every call returns a well-formed TrustState with all required numeric fields present', () => {
      const result = deriveTrustState('live-ai', [claim('c1', ['a1'])], [], [], [], 0, undefined);
      expect(typeof result.distinctSourceArticleCount).toBe('number');
      expect(typeof result.differenceTopicCount).toBe('number');
      expect(typeof result.uncertaintyCount).toBe('number');
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(typeof result.level).toBe('string');
    });
  });
});
