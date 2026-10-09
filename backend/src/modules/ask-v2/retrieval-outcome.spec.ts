import { OBSERVED_RETRIEVAL_OUTCOMES } from '../ask-observability/ask-observation.contract';
import { observedRetrievalOf } from './retrieval-outcome';

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

  it('no retrieval context → null (retrieval never ran), and every code is in the governed set', () => {
    expect(observedRetrievalOf(null).retrievalOutcome).toBeNull();
    for (const code of ['MATCHED', 'PARTIAL', 'PARTIAL_NO_MATCH', 'RETAINED_ONLY', 'ALL_FILTERED', 'COMPLETED_NO_MATCH', 'PROVIDER_FAILED']) {
      expect(OBSERVED_RETRIEVAL_OUTCOMES.has(code)).toBe(true);
    }
  });
});
