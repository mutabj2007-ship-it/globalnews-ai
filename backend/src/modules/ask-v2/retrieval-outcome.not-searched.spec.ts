import { observedRetrievalOf, retrievalNotPermitted } from './retrieval-outcome';

/**
 * CTO #95 6372269751 (PO live test, Alpha 9aac59a, Kenya economy): every provider refused by Gate A,
 * plus lanes that are merely NOT CONFIGURED. Nothing was searched, so the stored outcome is
 * NOT_PERMITTED — never PROVIDER_FAILED and never a search that found 0 matching reports.
 */
const response = (lanesUnavailable: Array<{ lane: string; reason: string }>) =>
  ({
    articles: [],
    retrievalContext: {
      dataMode: 'unavailable',
      providers: [],
      fallbackReason: 'provider-error',
      providerFailures: [
        { providerId: 'gnews', kind: 'rights-not-cleared' },
        { providerId: 'gdelt-doc', kind: 'rights-not-cleared' },
      ],
      retrievalTrace: {
        lanesAttempted: [],
        lanesSucceeded: [],
        lanesUnavailable,
        candidatesSeen: 0,
        candidatesAdmitted: 0,
        independentClusters: 0,
      },
    },
  }) as never;

describe('NOT SEARCHED — a not-configured lane never turns a rights refusal into a failed search', () => {
  it('all refused + not-configured social and feed lanes → NOT_PERMITTED', () => {
    const r = response([
      { lane: 'gnews', reason: 'rights-not-cleared' },
      { lane: 'gdelt-doc', reason: 'rights-not-cleared' },
      { lane: 'x', reason: 'not-configured' },
      { lane: 'rss-feeds', reason: 'not-configured' },
    ]);
    expect(observedRetrievalOf(r).retrievalOutcome).toBe('NOT_PERMITTED');
    expect(retrievalNotPermitted(r)).toBe(true);
  });

  it('a genuine outage beside the refusal stays PROVIDER_FAILED', () => {
    const r = response([
      { lane: 'gnews', reason: 'rights-not-cleared' },
      { lane: 'gdelt-doc', reason: 'rate-limited' },
    ]);
    expect(observedRetrievalOf(r).retrievalOutcome).toBe('PROVIDER_FAILED');
  });
});
