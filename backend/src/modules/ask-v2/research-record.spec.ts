import { researchRecordOf } from './research-record';

/* ASK R3 RESEARCH ACTIVITY R1 — the stored research record, pure. */
const ctx = (over: Record<string, unknown>) => ({ dataMode: 'live', providers: ['gnews', 'rss-feeds'], ...over });
const trace = (attempted: string[], succeeded: string[], unavailable: Array<[string, string]> = [], seen = 0) => ({
  lanesAttempted: attempted,
  lanesSucceeded: succeeded,
  lanesUnavailable: unavailable.map(([lane, reason]) => ({ lane, reason })),
  candidatesSeen: seen,
  candidatesAdmitted: 0,
});

describe('researchRecordOf — performed / outcome / lanes, from the stored retrieval facts', () => {
  it('no retrieval response: no research performed', () => {
    expect(researchRecordOf(null)).toMatchObject({ schema: 'ask-research/1', performed: false, outcome: null, reused: false });
    expect(researchRecordOf({ articles: [], retrievalContext: null }).performed).toBe(false);
  });

  it('evidence found: MATCHED, lanes answered', () => {
    const r = researchRecordOf({ articles: [{}, {}], retrievalContext: ctx({ retrievalTrace: trace(['gnews', 'rss-feeds'], ['gnews', 'rss-feeds'], [], 9) }) });
    expect(r).toMatchObject({ performed: true, outcome: 'MATCHED', candidatesSeen: 9 });
    expect(r.lanes).toEqual({ attempted: ['gnews', 'rss-feeds'], succeeded: ['gnews', 'rss-feeds'], unavailable: [] });
  });

  it('zero matching articles: the search COMPLETED with no match (performed, not failed)', () => {
    const r = researchRecordOf({ articles: [], retrievalContext: ctx({ retrievalTrace: trace(['gnews'], ['gnews']) }) });
    expect(r).toMatchObject({ performed: true, outcome: 'COMPLETED_NO_MATCH' });
  });

  it('candidates seen but all rejected as not relevant: ALL_FILTERED', () => {
    const r = researchRecordOf({ articles: [], retrievalContext: ctx({ retrievalTrace: trace(['gnews'], ['gnews'], [], 14) }) });
    expect(r.outcome).toBe('ALL_FILTERED');
  });

  it('some sources unreachable: PARTIAL_NO_MATCH, with the lane and its reason', () => {
    const r = researchRecordOf({ articles: [], retrievalContext: ctx({ providers: ['gnews'], retrievalTrace: trace(['gnews', 'gdelt-doc'], ['gnews'], [['gdelt-doc', 'timeout']]) }) });
    expect(r.outcome).toBe('PARTIAL_NO_MATCH');
    expect(r.lanes.unavailable).toEqual([{ lane: 'gdelt-doc', reason: 'timeout' }]);
    expect(r.lanes.succeeded).toEqual(['gnews']);
  });

  it('provider outage: PROVIDER_FAILED; a failed lane is never counted as answered', () => {
    const r = researchRecordOf({
      articles: [],
      retrievalContext: { dataMode: 'unavailable', providers: [], fallbackReason: 'provider-error', providerFailures: [{ providerId: 'gnews', kind: 'rate-limited' }] },
    });
    expect(r).toMatchObject({ performed: true, outcome: 'PROVIDER_FAILED' });
    expect(r.lanes.succeeded).toEqual([]);
    expect(r.lanes.unavailable).toEqual([{ lane: 'gnews', reason: 'rate-limited' }]);
  });

  it('a follow-up that re-read the earlier evidence: reused, no new search', () => {
    const r = researchRecordOf({ articles: [{}], retrievalContext: ctx({}) }, { reused: true });
    expect(r).toMatchObject({ performed: false, reused: true, outcome: null });
  });

  it('the landed path asked the reader before searching: no research performed', () => {
    expect(researchRecordOf({ articles: [], retrievalContext: { retrievalOutcome: 'CLARIFICATION_REQUIRED' } }).performed).toBe(false);
  });

  it('ids, codes and counts only', () => {
    const r = researchRecordOf({ articles: [{ title: 'secret' }], retrievalContext: ctx({ retrievalTrace: trace(['gnews'], ['gnews']) }) });
    expect(JSON.stringify(r)).not.toMatch(/secret|query|question/);
  });
});
