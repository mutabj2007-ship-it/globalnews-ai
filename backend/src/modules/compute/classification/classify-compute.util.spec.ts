import type { ComputeClass, ComputeOperationKind } from '@globalnews-ai/shared';
import {
  DEEP_ANALYSIS_COUNTRY_THRESHOLD,
  DEEP_ANALYSIS_DOMAIN_THRESHOLD,
  DEEP_ANALYSIS_TIME_WINDOW_DAYS,
  classifyCompute,
  reconcileClassAfterExecution,
  type ComputeClassificationInput,
} from './classify-compute.util';

/** An ordinary, unremarkable single-country Ask turn. The neutral starting point. */
function ordinaryAsk(overrides: Partial<ComputeClassificationInput> = {}): ComputeClassificationInput {
  return {
    kind: 'ask-turn',
    storedResultAvailable: false,
    contextualOnly: false,
    countryCount: 1,
    domainCount: 1,
    ...overrides,
  };
}

describe('BETA-SIMPLE-ASK-SAND-1 §5 classifyCompute', () => {
  describe('§6 stored-result-first dominates everything', () => {
    it('classifies STORED regardless of how expensive the request otherwise looks', () => {
      const result = classifyCompute(
        ordinaryAsk({
          storedResultAvailable: true,
          countryCount: 12,
          domainCount: 5,
          requestedTimeWindowDays: 3650,
          explicitDeepAnalysisRequest: true,
          explicitReportRequest: true,
        }),
      );

      expect(result.computeClass).toBe('STORED');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.rationale).toEqual(['stored-result-available']);
    });

    it('never asks for confirmation to replay a stored result', () => {
      expect(
        classifyCompute(ordinaryAsk({ storedResultAvailable: true })).requiresConfirmation,
      ).toBe(false);
    });
  });

  describe('§16 a category click must not trigger expensive synthesis', () => {
    it('caps a category view at CONTEXTUAL even with every expansion signal tripped', () => {
      const result = classifyCompute({
        kind: 'category-view',
        storedResultAvailable: false,
        contextualOnly: false,
        countryCount: 40,
        domainCount: 5,
        requestedTimeWindowDays: 3650,
        explicitDeepAnalysisRequest: true,
        explicitReportRequest: true,
      });

      expect(result.computeClass).toBe('CONTEXTUAL');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.rationale).toContain('kind-ceiling:category-view:CONTEXTUAL');
    });
  });

  describe('§5 CONTEXTUAL', () => {
    it('classifies a contextual-only request as CONTEXTUAL, for free', () => {
      const result = classifyCompute(ordinaryAsk({ contextualOnly: true }));
      expect(result.computeClass).toBe('CONTEXTUAL');
      expect(result.requiresConfirmation).toBe(false);
    });

    it('does not let a wide country count escalate a contextual answer', () => {
      const result = classifyCompute(
        ordinaryAsk({ contextualOnly: true, countryCount: 30, domainCount: 4 }),
      );
      expect(result.computeClass).toBe('CONTEXTUAL');
    });
  });

  describe('§5 FRESH_BOUNDED — the ordinary case', () => {
    it('classifies a plain single-country, single-domain Ask as FRESH_BOUNDED', () => {
      const result = classifyCompute(ordinaryAsk());
      expect(result.computeClass).toBe('FRESH_BOUNDED');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.rationale).toContain('baseline:ask-turn');
    });

    it('keeps a two-country comparison bounded — comparison is reading, not investigation', () => {
      const result = classifyCompute(ordinaryAsk({ countryCount: 2 }));
      expect(result.computeClass).toBe('FRESH_BOUNDED');
    });
  });

  describe('§20 the backend decides Deep Analysis, even through ordinary Ask', () => {
    it('escalates on country count alone, with no explicit request', () => {
      const result = classifyCompute(
        ordinaryAsk({ countryCount: DEEP_ANALYSIS_COUNTRY_THRESHOLD }),
      );
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
      expect(result.requiresConfirmation).toBe(true);
      expect(result.rationale).toContain(`multi-country:${DEEP_ANALYSIS_COUNTRY_THRESHOLD}`);
    });

    it('escalates on domain count alone', () => {
      const result = classifyCompute(ordinaryAsk({ domainCount: DEEP_ANALYSIS_DOMAIN_THRESHOLD }));
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
      expect(result.rationale).toContain(`cross-domain:${DEEP_ANALYSIS_DOMAIN_THRESHOLD}`);
    });

    it('escalates on a long historical window alone', () => {
      const result = classifyCompute(
        ordinaryAsk({ requestedTimeWindowDays: DEEP_ANALYSIS_TIME_WINDOW_DAYS }),
      );
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
    });

    it('escalates on combined soft signals that individually trip nothing', () => {
      const input = ordinaryAsk({
        countryCount: DEEP_ANALYSIS_COUNTRY_THRESHOLD - 1,
        domainCount: DEEP_ANALYSIS_DOMAIN_THRESHOLD - 1,
      });

      // Each signal on its own stays bounded...
      expect(
        classifyCompute(ordinaryAsk({ countryCount: DEEP_ANALYSIS_COUNTRY_THRESHOLD - 1 }))
          .computeClass,
      ).toBe('FRESH_BOUNDED');
      expect(
        classifyCompute(ordinaryAsk({ domainCount: DEEP_ANALYSIS_DOMAIN_THRESHOLD - 1 }))
          .computeClass,
      ).toBe('FRESH_BOUNDED');

      // ...but together they are Deep Analysis.
      const result = classifyCompute(input);
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
      expect(result.rationale.some((r) => r.startsWith('combined-expansion-signals'))).toBe(true);
    });

    it('honors an explicit Deep Analysis request', () => {
      const result = classifyCompute(ordinaryAsk({ explicitDeepAnalysisRequest: true }));
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
      expect(result.rationale).toContain('explicit-deep-analysis-request');
    });

    it('cannot be talked DOWN — there is no input that lowers a tripped threshold', () => {
      // The only client-influenced field is explicitDeepAnalysisRequest.
      // Setting it false must not rescue an otherwise-expensive request.
      const result = classifyCompute(
        ordinaryAsk({ countryCount: 8, explicitDeepAnalysisRequest: false }),
      );
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
    });
  });

  describe('§5 RESEARCH_REPORT', () => {
    it('classifies an explicit report request as RESEARCH_REPORT', () => {
      const result = classifyCompute(ordinaryAsk({ explicitReportRequest: true }));
      expect(result.computeClass).toBe('RESEARCH_REPORT');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('outranks the Deep Analysis expansion rules', () => {
      const result = classifyCompute(
        ordinaryAsk({ explicitReportRequest: true, countryCount: 9, domainCount: 5 }),
      );
      expect(result.computeClass).toBe('RESEARCH_REPORT');
    });
  });

  describe('operation-kind baselines', () => {
    it.each<[ComputeOperationKind, ComputeClass]>([
      ['ask-turn', 'FRESH_BOUNDED'],
      ['deep-analysis', 'DEEP_ANALYSIS'],
      ['research-report', 'RESEARCH_REPORT'],
      ['category-view', 'CONTEXTUAL'],
    ])('%s baselines to %s for an otherwise neutral request', (kind, expected) => {
      const result = classifyCompute({
        kind,
        storedResultAvailable: false,
        contextualOnly: false,
        countryCount: 1,
        domainCount: 1,
      });
      expect(result.computeClass).toBe(expected);
    });
  });

  describe('§9 confirmation threshold', () => {
    it('requires confirmation at or above DEEP_ANALYSIS, and never below', () => {
      expect(classifyCompute(ordinaryAsk({ storedResultAvailable: true })).requiresConfirmation).toBe(false);
      expect(classifyCompute(ordinaryAsk({ contextualOnly: true })).requiresConfirmation).toBe(false);
      expect(classifyCompute(ordinaryAsk()).requiresConfirmation).toBe(false);
      expect(classifyCompute(ordinaryAsk({ countryCount: 5 })).requiresConfirmation).toBe(true);
      expect(classifyCompute(ordinaryAsk({ explicitReportRequest: true })).requiresConfirmation).toBe(true);
    });
  });

  describe('determinism', () => {
    it('returns an identical classification for an identical input', () => {
      const input = ordinaryAsk({ countryCount: 4, domainCount: 2, requestedTimeWindowDays: 30 });
      expect(classifyCompute(input)).toEqual(classifyCompute(input));
    });
  });
});

describe('§5 reconcileClassAfterExecution', () => {
  it('raises the recorded class when execution turned out more expensive', () => {
    expect(reconcileClassAfterExecution('FRESH_BOUNDED', 'DEEP_ANALYSIS')).toBe('DEEP_ANALYSIS');
  });

  it('never lowers the recorded class below what was quoted', () => {
    expect(reconcileClassAfterExecution('DEEP_ANALYSIS', 'FRESH_BOUNDED')).toBe('DEEP_ANALYSIS');
    expect(reconcileClassAfterExecution('DEEP_ANALYSIS', 'STORED')).toBe('DEEP_ANALYSIS');
  });

  it('is a no-op when the two agree', () => {
    expect(reconcileClassAfterExecution('RESEARCH_REPORT', 'RESEARCH_REPORT')).toBe(
      'RESEARCH_REPORT',
    );
  });
});
