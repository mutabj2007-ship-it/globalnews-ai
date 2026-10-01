import { isReusableStoredPayload } from './stored-result-reuse';

describe('CURRENT REPORTING STORED-RESULT REUSE R1 — which stored answers may be replayed', () => {
  it.each(['REFERENCE_BACKGROUND', 'COMPUTED_RESULT'])(
    '%s is time-independent: replayable',
    (state) => {
      expect(isReusableStoredPayload({ answer: { state }, aiExecuted: true })).toBe(true);
    },
  );

  it.each([
    'CURRENT_REPORTING',
    'CURRENTLY_VERIFIED',
    'PARTIAL',
    'INSUFFICIENT',
    'CLARIFICATION_REQUIRED',
    'CAPABILITY_UNAVAILABLE',
    'RETAINED_RECORD',
  ])('%s is an observation of a moment (or a no-answer): never replayed', (state) => {
    expect(isReusableStoredPayload({ answer: { state }, aiExecuted: false })).toBe(false);
  });

  it('the Production artifact (INSUFFICIENT, live provider rate-limited) is not replayable', () => {
    expect(
      isReusableStoredPayload({
        aiExecuted: false,
        checkedAt: '2026-10-01T02:59:00.000Z',
        route: { terminalState: 'EXECUTABLE' },
        answer: { state: 'INSUFFICIENT', missingRoles: ['REPORTING'] },
      }),
    ).toBe(false);
  });

  it.each([
    ['null', null],
    ['a string', 'prose'],
    ['no answer', { language: 'en' }],
    ['a prose answer', { answer: 'Generated prose' }],
    ['an answer without a state', { answer: {} }],
    ['a non-string state', { answer: { state: 1 } }],
  ])('an unreadable payload (%s) fails closed: never replayed', (_label, payload) => {
    expect(isReusableStoredPayload(payload)).toBe(false);
  });
});
