import type {
  AgreementPoint,
  DifferenceItem,
  RelationalEvidenceAssessment,
  SourcedClaim,
  TimelineEvent,
} from '@globalnews-ai/shared';
import { buildRelationalComposition } from './build-relational-composition.util';

function assessment(
  articleId: string,
  direction: RelationalEvidenceAssessment['direction'],
  excerpt = 'excerpt',
): RelationalEvidenceAssessment {
  return { articleId, excerpt, direction };
}

function claim(
  text: string,
  relationalSupport?: SourcedClaim['relationalSupport'],
): SourcedClaim {
  return { claim: text, sourceArticleIds: [], ...(relationalSupport ? { relationalSupport } : {}) };
}

const X = 'climate change';
const Y = 'agriculture';

describe('buildRelationalComposition (Milestone #41)', () => {
  // ---- A–M matrix ----

  it('A. zero requested-direction supporting articles -> unsupported / insufficient', () => {
    const result = buildRelationalComposition(X, Y, [], [], [], []);
    expect(result.directionalEligibility).toBe('unsupported');
    expect(result.evidenceSufficiency).toBe('insufficient');
  });

  it('B. one distinct requested-direction article -> supported / limited', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('limited');
  });

  it('C. two+ distinct requested-direction articles -> supported / adequate', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('a2', 'requested-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('adequate');
  });

  it('D. requested support + reverse evidence -> supported / limited (forced)', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('a2', 'requested-direction')] }),
      claim('c3', { direction: 'reverse-direction', assessments: [assessment('a3', 'reverse-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('limited');
  });

  it('E. requested support + mixed evidence -> supported / limited (forced)', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('a2', 'requested-direction')] }),
      claim('c3', {
        direction: 'mixed',
        assessments: [assessment('a3', 'requested-direction'), assessment('a3', 'reverse-direction')],
      }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.evidenceSufficiency).toBe('limited');
  });

  it('F. requested support + association-only (no reverse/mixed) -> per article-count rule, not downgraded', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('a2', 'requested-direction')] }),
      claim('c3', { direction: 'association-only', assessments: [assessment('a3', 'association-only')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('adequate');
  });

  it('G. requested support + unclear/non-substantive only -> per article-count rule, not downgraded', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'unclear', assessments: [assessment('a2', 'unclear')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('limited'); // only 1 distinct requested article
  });

  it('H. bidirectional support from one article -> supported / limited (no automatic upgrade)', () => {
    const keyFacts = [
      claim('c1', { direction: 'bidirectional', assessments: [assessment('a1', 'bidirectional')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('limited');
  });

  it('I. bidirectional support from two distinct articles -> supported / adequate', () => {
    const keyFacts = [
      claim('c1', { direction: 'bidirectional', assessments: [assessment('a1', 'bidirectional')] }),
      claim('c2', { direction: 'bidirectional', assessments: [assessment('a2', 'bidirectional')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('adequate');
  });

  it('J. reverse-only evidence -> unsupported / insufficient', () => {
    const keyFacts = [
      claim('c1', { direction: 'reverse-direction', assessments: [assessment('a1', 'reverse-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('unsupported');
    expect(result.evidenceSufficiency).toBe('insufficient');
    expect(result.reverseClaims).toHaveLength(1);
  });

  it('K. association-only evidence only -> unsupported / insufficient', () => {
    const keyFacts = [
      claim('c1', { direction: 'association-only', assessments: [assessment('a1', 'association-only')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('unsupported');
    expect(result.evidenceSufficiency).toBe('insufficient');
  });

  it('L. mixed-only evidence -> unsupported / insufficient', () => {
    const keyFacts = [
      claim('c1', {
        direction: 'mixed',
        assessments: [assessment('a1', 'requested-direction'), assessment('a1', 'reverse-direction')],
      }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('unsupported');
    expect(result.evidenceSufficiency).toBe('insufficient');
    expect(result.mixedClaims).toHaveLength(1);
  });

  it('M. no relational evidence at all -> unsupported / insufficient', () => {
    const keyFacts = [claim('plain fact')]; // no relationalSupport at all
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('unsupported');
    expect(result.evidenceSufficiency).toBe('insufficient');
  });

  // ---- Mandatory numbered tests ----

  it('1. two claims from the SAME article count as ONE supporting article', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('same-article', 'requested-direction')] }),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('same-article', 'requested-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.evidenceSufficiency).toBe('limited'); // only 1 distinct article, not 2
  });

  it('2. claims from two distinct articleIds count as TWO', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('article-a', 'requested-direction')] }),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('article-b', 'requested-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.evidenceSufficiency).toBe('adequate');
  });

  it('3. mixed with an underlying requested-direction assessment remains mixed and contributes ZERO eligibility', () => {
    const keyFacts = [
      claim('c1', {
        direction: 'mixed',
        assessments: [assessment('a1', 'requested-direction'), assessment('a2', 'reverse-direction')],
      }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('unsupported');
    expect(result.supportingClaims).toHaveLength(0);
    expect(result.mixedClaims).toHaveLength(1);
  });

  it('4. requested-direction + separate mixed claim -> supported + limited', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', {
        direction: 'mixed',
        assessments: [assessment('a2', 'requested-direction'), assessment('a3', 'reverse-direction')],
      }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('limited');
  });

  it('5. requested-direction + reverse -> supported + limited', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'reverse-direction', assessments: [assessment('a2', 'reverse-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('limited');
  });

  it('6. bidirectional from one article -> supported + limited', () => {
    const keyFacts = [
      claim('c1', { direction: 'bidirectional', assessments: [assessment('a1', 'bidirectional')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('supported');
    expect(result.evidenceSufficiency).toBe('limited');
  });

  it('7. bidirectional from two articles -> supported + adequate (no reverse/mixed contradiction)', () => {
    const keyFacts = [
      claim('c1', { direction: 'bidirectional', assessments: [assessment('a1', 'bidirectional')] }),
      claim('c2', { direction: 'bidirectional', assessments: [assessment('a2', 'bidirectional')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.evidenceSufficiency).toBe('adequate');
  });

  it('9. relational request with zero relationalSupport data -> unsupported + insufficient (mock-shaped)', () => {
    const keyFacts = [claim('a plain generated fact with no relational support')];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.directionalEligibility).toBe('unsupported');
    expect(result.evidenceSufficiency).toBe('insufficient');
    expect(result.summary).toBe('Available reporting does not provide enough validated evidence to establish the requested relationship.');
  });

  it('10. ClaimReference indexes correspond exactly to the FINAL VALIDATED arrays passed in', () => {
    const keyFacts = [
      claim('irrelevant, no support'),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.supportingClaims).toEqual([{ section: 'keyFacts', index: 1 }]);
  });

  it('12. differences.positions and timeline are scanned with correct section/index attribution', () => {
    const differences: DifferenceItem[] = [
      {
        topic: 't',
        positions: [
          { description: 'p0', sourceArticleIds: [] },
          {
            description: 'p1',
            sourceArticleIds: [],
            relationalSupport: { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] },
          },
        ],
      },
    ];
    const timeline: TimelineEvent[] = [
      {
        timestamp: new Date().toISOString(),
        event: 'e0',
        sourceArticleIds: [],
        relationalSupport: { direction: 'reverse-direction', assessments: [assessment('a2', 'reverse-direction')] },
      },
    ];
    const result = buildRelationalComposition(X, Y, [], [], differences, timeline);
    expect(result.supportingClaims).toEqual([{ section: 'differences', index: 1 }]);
    expect(result.reverseClaims).toEqual([{ section: 'timeline', index: 0 }]);
  });

  it('agreements are scanned identically to keyFacts', () => {
    const agreements: AgreementPoint[] = [
      { point: 'p0', sourceArticleIds: [] },
      {
        point: 'p1',
        sourceArticleIds: [],
        relationalSupport: { direction: 'association-only', assessments: [assessment('a1', 'association-only')] },
      },
    ];
    const result = buildRelationalComposition(X, Y, [], agreements, [], []);
    expect(result.associationOnlyClaims).toEqual([{ section: 'agreements', index: 1 }]);
  });

  it('summary uses "multiple distinct articles" wording, never "sources"', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'requested-direction', assessments: [assessment('a2', 'requested-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.summary).toContain('multiple distinct articles');
    expect(result.summary).not.toContain('sources');
  });

  it('reverse/association-only/mixed/unclear claims are never discarded even when supportingClaims is also non-empty', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
      claim('c2', { direction: 'reverse-direction', assessments: [assessment('a2', 'reverse-direction')] }),
      claim('c3', { direction: 'association-only', assessments: [assessment('a3', 'association-only')] }),
      claim('c4', { direction: 'unclear', assessments: [assessment('a4', 'unclear')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.reverseClaims).toHaveLength(1);
    expect(result.associationOnlyClaims).toHaveLength(1);
    expect(result.unclearOrNonSubstantiveClaims).toHaveLength(1);
  });

  it('summary never contains causal language ("caused", "resulted from")', () => {
    const keyFacts = [
      claim('c1', { direction: 'requested-direction', assessments: [assessment('a1', 'requested-direction')] }),
    ];
    const result = buildRelationalComposition(X, Y, keyFacts, [], [], []);
    expect(result.summary).not.toMatch(/\bcause[sd]?\b|\bresulted from\b/i);
  });
});
