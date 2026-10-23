import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { rightsRefusedOnly } from './evidenceDisplay';

/**
 * CTO #95 6372269751 (23 Oct, PO live test on Alpha 9aac59a) — "What are the latest economic
 * developments in Kenya…": every news provider was refused by Gate A (rights-skip, nothing searched),
 * yet the answer metadata read "0 matching reports". A lane that is merely NOT CONFIGURED (a social
 * lane, the switched-off feed lane) was also listed, and its reason broke the all-refused predicate.
 * Not configured is also "not searched": it must never turn a rights refusal into a completed search.
 */
const ctx = (over: Partial<AnalysisRetrievalContext>): AnalysisRetrievalContext =>
  ({ dataMode: 'live', providers: ['gnews', 'gdelt-doc'], ...over }) as AnalysisRetrievalContext;

describe('NOT SEARCHED is never "0 matching reports"', () => {
  it('every provider refused for rights + a not-configured lane → rights-refused (not searched)', () => {
    const c = ctx({
      providerFailures: [
        { providerId: 'gnews', kind: 'rights-not-cleared' },
        { providerId: 'gdelt-doc', kind: 'rights-not-cleared' },
      ],
      retrievalTrace: {
        lanesAttempted: [],
        lanesSucceeded: [],
        lanesUnavailable: [
          { lane: 'gnews', reason: 'rights-not-cleared' },
          { lane: 'gdelt-doc', reason: 'rights-not-cleared' },
          { lane: 'x', reason: 'not-configured' },
          { lane: 'rss-feeds', reason: 'not-configured' },
        ],
        candidatesSeen: 0,
        candidatesAdmitted: 0,
        independentClusters: 0,
      },
    } as never);
    expect(rightsRefusedOnly(c, 0)).toBe(true);
  });

  it('only not-configured lanes (no rights refusal) is not a RIGHTS refusal', () => {
    const c = ctx({
      providers: [],
      retrievalTrace: {
        lanesAttempted: [],
        lanesSucceeded: [],
        lanesUnavailable: [{ lane: 'x', reason: 'not-configured' }],
        candidatesSeen: 0,
        candidatesAdmitted: 0,
        independentClusters: 0,
      },
    } as never);
    expect(rightsRefusedOnly(c, 0)).toBe(false);
  });

  it('a real outage beside a refusal stays an outage (never hidden as "not searched")', () => {
    const c = ctx({
      providerFailures: [
        { providerId: 'gnews', kind: 'rights-not-cleared' },
        { providerId: 'gdelt-doc', kind: 'rate-limited' },
      ],
    } as never);
    expect(rightsRefusedOnly(c, 0)).toBe(false);
  });

  it('a lane that answered means a search ran', () => {
    const c = ctx({
      providerFailures: [{ providerId: 'gnews', kind: 'rights-not-cleared' }],
      retrievalTrace: {
        lanesAttempted: ['rss-feeds'],
        lanesSucceeded: ['rss-feeds'],
        lanesUnavailable: [{ lane: 'gnews', reason: 'rights-not-cleared' }],
        candidatesSeen: 0,
        candidatesAdmitted: 0,
        independentClusters: 0,
      },
    } as never);
    expect(rightsRefusedOnly(c, 0)).toBe(false);
  });
});
