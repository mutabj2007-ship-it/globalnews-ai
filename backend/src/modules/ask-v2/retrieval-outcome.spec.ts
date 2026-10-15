import { OBSERVED_RETRIEVAL_OUTCOMES } from '../ask-observability/ask-observation.contract';
import { observedRetrievalOf, retrievalIncomplete } from './retrieval-outcome';

describe('REASON TO RETURN R1 · §5 — retrieval outcome codes (FJ-1)', () => {
  const trace = (seen: number, admitted: number, lanesUnavailable: unknown[] = []) => ({
    queryVariants: [],
    timeWindow: null,
    languages: [],
    lanesAttempted: [],
    lanesSucceeded: [],
    lanesUnavailable,
    candidatesSeen: seen,
    candidatesAdmitted: admitted,
    independentClusters: 0,
  });

  it('every source failed → PROVIDER_FAILED (absence not established)', () => {
    expect(
      observedRetrievalOf({
        articles: [],
        retrievalContext: { dataMode: 'unavailable', providers: [], providerFailures: [{ providerId: 'gnews' }] },
      }).retrievalOutcome,
    ).toBe('PROVIDER_FAILED');
    expect(
      observedRetrievalOf({ articles: [], retrievalContext: { outcome: 'PROVIDER_RATE_LIMITED', providers: [] } })
        .retrievalOutcome,
    ).toBe('PROVIDER_FAILED');
  });

  it('candidates returned but all removed by the gate → ALL_FILTERED, with the counts', () => {
    expect(
      observedRetrievalOf({
        articles: [],
        retrievalContext: { dataMode: 'live', providers: ['gnews'], retrievalTrace: trace(14, 0) },
      }),
    ).toEqual({ retrievalOutcome: 'ALL_FILTERED', candidatesSeen: 14, candidatesAdmitted: 0 });
  });

  it('search completed, nothing returned → COMPLETED_NO_MATCH', () => {
    expect(
      observedRetrievalOf({
        articles: [],
        retrievalContext: { dataMode: 'live', providers: ['gnews'], retrievalTrace: trace(0, 0) },
      }).retrievalOutcome,
    ).toBe('COMPLETED_NO_MATCH');
  });

  it('one source answered, another failed → PARTIAL / PARTIAL_NO_MATCH', () => {
    const ctx = {
      dataMode: 'live',
      providers: ['gnews'],
      providerFailures: [{ providerId: 'gdelt-doc', kind: 'TIMEOUT' }],
    };
    expect(observedRetrievalOf({ articles: [{}], retrievalContext: ctx }).retrievalOutcome).toBe('PARTIAL');
    expect(observedRetrievalOf({ articles: [], retrievalContext: ctx }).retrievalOutcome).toBe('PARTIAL_NO_MATCH');
  });

  it('admitted reporting → MATCHED; retained-only → RETAINED_ONLY', () => {
    expect(
      observedRetrievalOf({ articles: [{}, {}], retrievalContext: { dataMode: 'live', providers: ['gnews'] } }),
    ).toEqual({ retrievalOutcome: 'MATCHED', candidatesSeen: null, candidatesAdmitted: 2 });
    expect(
      observedRetrievalOf({ articles: [{}], retrievalContext: { dataMode: 'cached', providers: [] } })
        .retrievalOutcome,
    ).toBe('RETAINED_ONLY');
  });

  /* BETA-ASK-005 / G R76-F1 (CTO R80, R96) — the reader's period excluded every returned report */
  describe('BETA-ASK-005 — a completed search whose reports all fell outside the reader period', () => {
    const windowed = (excludedOutsideWindow: number, extra: Record<string, unknown> = {}) => ({
      articles: [],
      retrievalContext: {
        dataMode: 'live',
        providers: ['gnews'],
        reportingWindow: { excludedOutsideWindow },
        retrievalTrace: trace(0, 0),
        ...extra,
      },
    });

    it('everything outside the window → ALL_FILTERED, never COMPLETED_NO_MATCH; no count is invented', () => {
      expect(observedRetrievalOf(windowed(2))).toEqual({
        retrievalOutcome: 'ALL_FILTERED',
        candidatesSeen: 0,
        candidatesAdmitted: 0,
      });
    });

    it('NEGATIVE: a window that excluded nothing, on a genuinely empty search, stays COMPLETED_NO_MATCH', () => {
      expect(observedRetrievalOf(windowed(0)).retrievalOutcome).toBe('COMPLETED_NO_MATCH');
    });

    it('NEGATIVE: no stated window → unchanged COMPLETED_NO_MATCH (nothing about a period is claimed)', () => {
      const r = windowed(0);
      delete (r.retrievalContext as { reportingWindow?: unknown }).reportingWindow;
      expect(observedRetrievalOf(r).retrievalOutcome).toBe('COMPLETED_NO_MATCH');
    });

    it('PRECEDENCE: rights-withheld stays RIGHTS_WITHHELD, never a window claim', () => {
      expect(observedRetrievalOf(windowed(3, { rightsExcluded: { count: 1 } })).retrievalOutcome).toBe(
        'RIGHTS_WITHHELD',
      );
    });

    it('PRECEDENCE: a partial outage stays PARTIAL_NO_MATCH; every source failed stays PROVIDER_FAILED', () => {
      expect(
        observedRetrievalOf(windowed(3, { providerFailures: [{ providerId: 'gdelt-doc', kind: 'TIMEOUT' }] }))
          .retrievalOutcome,
      ).toBe('PARTIAL_NO_MATCH');
      expect(
        observedRetrievalOf(
          windowed(3, { providers: [], dataMode: 'unavailable', providerFailures: [{ providerId: 'gnews' }] }),
        ).retrievalOutcome,
      ).toBe('PROVIDER_FAILED');
    });

    it('PRECEDENCE: admitted in-window reporting stays MATCHED (mixed dates)', () => {
      expect(observedRetrievalOf({ ...windowed(2), articles: [{}] }).retrievalOutcome).toBe('MATCHED');
    });

    /* E1 R96 W-2 — exclusions whose rights state could not be evaluated: no period-specific reason */
    it('W-2: unevaluated exclusions → no typed outcome (never ALL_FILTERED, never COMPLETED_NO_MATCH) and the search reads incomplete', () => {
      const r = windowed(0, { reportingWindow: { excludedOutsideWindow: 0, exclusionsUnevaluated: true } });
      expect(observedRetrievalOf(r).retrievalOutcome).toBeNull();
      expect(retrievalIncomplete(r)).toBe(true);
      /* with an admissible period exclusion as well, still no period-specific claim */
      const both = windowed(2, { reportingWindow: { excludedOutsideWindow: 2, exclusionsUnevaluated: true } });
      expect(observedRetrievalOf(both).retrievalOutcome).toBeNull();
    });

    it('W-2 NEGATIVE: an established rights withholding stays RIGHTS_WITHHELD (not invented, not hidden)', () => {
      const r = windowed(0, {
        rightsExcluded: { count: 1 },
        reportingWindow: { excludedOutsideWindow: 0, exclusionsUnevaluated: true },
      });
      expect(observedRetrievalOf(r).retrievalOutcome).toBe('RIGHTS_WITHHELD');
    });

    it('W-2 NEGATIVE: admitted reporting is unaffected by unevaluated exclusions', () => {
      const r = { ...windowed(0, { reportingWindow: { excludedOutsideWindow: 0, exclusionsUnevaluated: true } }), articles: [{}] };
      expect(observedRetrievalOf(r).retrievalOutcome).toBe('MATCHED');
      expect(retrievalIncomplete(r)).toBe(false);
    });

    it('PRECEDENCE: no provider was asked → no search outcome at all', () => {
      expect(observedRetrievalOf(windowed(2, { retrievalAttempted: false })).retrievalOutcome).toBeNull();
    });
  });

  it('no retrieval context → null (retrieval never ran), and every code is in the governed set', () => {
    expect(observedRetrievalOf(null).retrievalOutcome).toBeNull();
    for (const code of ['MATCHED', 'PARTIAL', 'PARTIAL_NO_MATCH', 'RETAINED_ONLY', 'ALL_FILTERED', 'COMPLETED_NO_MATCH', 'PROVIDER_FAILED']) {
      expect(OBSERVED_RETRIEVAL_OUTCOMES.has(code)).toBe(true);
    }
  });
});
