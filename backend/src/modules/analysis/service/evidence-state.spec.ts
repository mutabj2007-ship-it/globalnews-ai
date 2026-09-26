import { resolveEvidenceState } from '@globalnews-ai/shared';

/** ASK/SEARCH R1 CLOSURE — the one derivation of the evidence-state fact. */
describe('resolveEvidenceState', () => {
  it.each([
    [{ dataMode: 'live' }, 3, 'live'],
    [{ dataMode: 'cached', fallbackReason: 'no-live-results' }, 2, 'retained'],
    [{ dataMode: 'live', outcome: 'RETAINED_ONLY' }, 2, 'retained'],
    [
      { dataMode: 'cached', fallbackReason: 'provider-error', outcome: 'RETAINED_ONLY' },
      2,
      'degraded-fallback',
    ],
    [{ dataMode: 'live', outcome: 'PROVIDER_UNAVAILABLE' }, 0, 'degraded-fallback'],
    [{ dataMode: 'live', outcome: 'PROVIDER_RATE_LIMITED' }, 0, 'degraded-fallback'],
    [{ dataMode: 'unavailable', fallbackReason: 'provider-error' }, 0, 'degraded-fallback'],
    [{ dataMode: 'unavailable', fallbackReason: 'no-live-results' }, 0, 'no-relevant-evidence'],
    [{ dataMode: 'live' }, 0, 'no-relevant-evidence'],
    [{ dataMode: 'unavailable', outcome: 'NO_RELEVANT_EVIDENCE' }, 0, 'no-relevant-evidence'],
  ] as const)('%j with %d articles → %s', (context, count, expected) => {
    expect(resolveEvidenceState(context as never, count)).toBe(expected);
  });
});
