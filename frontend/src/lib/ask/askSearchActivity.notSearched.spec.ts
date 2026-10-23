import type { AskR2Payload } from '@/lib/api/askV2Api';
import { searchActivityOf } from './askSearchActivity';

/**
 * E1 ADDENDUM-15 OBS-A — the third predicate (askSearchActivity.refusedOnly, which renders the Ask
 * shell's "not searched" line) measured on the same shapes as notSearchedTruth.spec.ts.
 */
const payload = (ctx: Record<string, unknown>): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: { terminalState: 'EXECUTABLE' },
    answer: { state: 'INSUFFICIENT', basis: 'x', missingRoles: [] },
    analysis: {
      articles: [],
      retrievalContext: {
        dataMode: 'unavailable',
        retrievalTrace: { candidatesSeen: 0, lanesUnavailable: [] },
        ...ctx,
      },
    },
  }) as never;

const searchStatus = (p: AskR2Payload) => searchActivityOf(p)?.steps[0];

describe('Ask research activity — NOT SEARCHED is never a failed or empty search', () => {
  it('all providers refused + not-configured lanes → not-searched', () => {
    const p = payload({
      providers: [],
      providerFailures: [
        { providerId: 'gnews', kind: 'rights-not-cleared' },
        { providerId: 'gdelt-doc', kind: 'rights-not-cleared' },
      ],
      retrievalTrace: {
        candidatesSeen: 0,
        lanesUnavailable: [
          { lane: 'x', reason: 'not-configured' },
          { lane: 'rss-feeds', reason: 'not-configured' },
        ],
      },
    });
    expect(searchStatus(p)).toMatchObject({ kind: 'SEARCH', status: 'not-searched' });
  });

  it('a listed provider only not-configured + the other refused → not-searched (OBS-1)', () => {
    const p = payload({
      outcome: 'PROVIDER_UNAVAILABLE',
      providers: ['gnews', 'gdelt-doc'],
      providerFailures: [
        { providerId: 'gnews', kind: 'not-configured' },
        { providerId: 'gdelt-doc', kind: 'rights-not-cleared' },
      ],
    });
    expect(searchStatus(p)).toMatchObject({ status: 'not-searched' });
  });

  it('only not-configured (no rights refusal) is NOT reported as not-searched-for-rights', () => {
    const p = payload({
      providers: [],
      providerFailures: [{ providerId: 'gnews', kind: 'not-configured' }],
    });
    expect(searchStatus(p)?.status).not.toBe('not-searched');
  });

  it('a genuine outage beside a refusal stays a failure', () => {
    const p = payload({
      providers: [],
      providerFailures: [
        { providerId: 'gnews', kind: 'rights-not-cleared' },
        { providerId: 'gdelt-doc', kind: 'rate-limited' },
      ],
    });
    expect(searchStatus(p)).toMatchObject({ status: 'failed' });
  });
});
