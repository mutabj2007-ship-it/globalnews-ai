import { countsAsGuestAnswer, releaseReasonOf } from './guest-allowance';
import { GUEST_ANSWER_ALLOWANCE, resolveGuestTrialConfig } from './guest-trial.config';
import { ASK_ANSWER_STATES } from '@globalnews-ai/shared';

const OUTER = {
  unitsPerRequestMax: 16000,
  globalUnitsPerHour: 1_000_000,
  globalUnitsPerDay: 5_000_000,
  providerUnitsPerHour: 1_000_000,
  ipUnitsPerDay: 360_000,
  concurrentGlobal: 8,
};
const GOOD: Record<string, string> = {
  ASK_GUEST_ATTEMPTS_PER_SESSION: '8',
  ASK_GUEST_UNITS_PER_SESSION: '48000',
  ASK_GUEST_POOL_UNITS_PER_HOUR: '100000',
  ASK_GUEST_POOL_UNITS_PER_DAY: '500000',
  ASK_GUEST_SESSIONS_PER_IP_DAY: '20',
  ASK_GUEST_EXECUTIONS_PER_IP_DAY: '40',
  ASK_GUEST_EXECUTIONS_PER_DAY: '600',
  ASK_GUEST_CONCURRENT_PER_SESSION: '1',
  ASK_GUEST_COOLDOWN_AFTER_NO_ANSWER: '3',
  ASK_GUEST_COOLDOWN_S: '600',
};
const resolve = (over: Record<string, string | undefined> = {}, outer = OUTER) =>
  resolveGuestTrialConfig(
    (k) => (({ ...GOOD, ...over }) as Record<string, string | undefined>)[k],
    outer,
  );

describe('ASK GUEST TRIAL R3 — D3 counting rule: exhaustive over every answer state', () => {
  it('the allowance is the product decision, three', () => {
    expect(GUEST_ANSWER_ALLOWANCE).toBe(3);
  });

  it.each([
    ['REFERENCE_BACKGROUND', 'REFERENCE', true],
    ['CURRENTLY_VERIFIED', 'OFFICIAL_CURRENT_EVIDENCE', true],
    ['CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED', true],
    ['PARTIAL', 'SOME_REQUIRED_EVIDENCE_MISSING', true],
    ['INSUFFICIENT', 'NO_ANSWER_PRODUCED', false],
    ['INSUFFICIENT', 'NO_REQUIRED_EVIDENCE_OBTAINED', false],
    ['INSUFFICIENT', 'VERIFICATION_NOT_MET', false],
    ['CLARIFICATION_REQUIRED', 'PLAN_BROADENING_OFFERED', false],
    ['CLARIFICATION_REQUIRED', 'LANDED_AMBIGUOUS_COUNTRY', false],
    ['CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE', false],
    ['CAPABILITY_UNAVAILABLE', 'GOVERNED_RECORD_UNAVAILABLE', false],
    ['RETAINED_RECORD', 'GOVERNED_RECORD', true],
    /* CURRENT-REPORTING TRUTH R1 — an AI answer from retained reporting counts, as it did when it
       was labelled CURRENT_REPORTING */
    ['RETAINED_REPORTING', 'RETAINED_REPORTING_ONLY', true],
    ['RETAINED_RECORD', 'GOVERNED_NO_RECORD', false],
  ])('%s / %s → counts=%s', (state, basis, counts) => {
    expect(countsAsGuestAnswer({ answer: { state, basis } })).toBe(counts);
  });

  it('every state in the shared vocabulary has a decided mapping (no silent default drift)', () => {
    const decided = new Set([
      'REFERENCE_BACKGROUND',
      'CURRENTLY_VERIFIED',
      'CURRENT_REPORTING',
      'PARTIAL',
      'INSUFFICIENT',
      'CLARIFICATION_REQUIRED',
      'CAPABILITY_UNAVAILABLE',
      'RETAINED_RECORD',
      'COMPUTED_RESULT',
      'RETAINED_REPORTING',
    ]);
    expect([...ASK_ANSWER_STATES].sort()).toEqual([...decided].sort());
  });

  it.each([
    [null],
    [undefined],
    ['text'],
    [{}],
    [{ answer: null }],
    [{ answer: { state: 7 } }],
    [{ answer: { state: 'SOMETHING_NEW' } }],
  ])('unreadable or unknown payload %p never counts', (payload) => {
    expect(countsAsGuestAnswer(payload)).toBe(false);
  });

  it.each([
    ['QUOTE_EXPIRED', 'REFUSED'],
    ['ASK_PLAN_INVALID', 'REFUSED'],
    ['ASK_PUBLIC_COMPUTE_DISABLED', 'REFUSED'],
    ['ASK_R2_DISABLED', 'REFUSED'],
    ['BUDGET_REFUSED:ip-day', 'REFUSED'],
    ['BUDGET_DEGRADED:guest-pool-hour', 'REFUSED'],
    ['CIRCUIT_OPEN', 'REFUSED'],
    ['GUEST_TRIAL_UNAVAILABLE', 'REFUSED'],
    ['MODEL_FAILURE', 'FAILED'],
    ['MODEL_TIMEOUT', 'FAILED'],
    ['EXECUTION_FAILED', 'FAILED'],
    ['EXECUTION_OUTCOME_UNKNOWN', 'FAILED'],
    ['INVALID_OR_EXPIRED_RESULT', 'FAILED'],
    ['ANYTHING_NEW', 'FAILED'],
  ])('release code %s → %s', (code, reason) => {
    expect(releaseReasonOf(code)).toBe(reason);
  });
});

describe('ASK GUEST TRIAL R3 — D1 guest settings: strict, explicit, fail closed', () => {
  it('a complete, feasible configuration is valid', () => {
    expect(resolve()).toMatchObject({ valid: true });
  });

  it.each(Object.keys(GOOD))('%s missing → invalid (no source default)', (key) => {
    expect(resolve({ [key]: undefined }).valid).toBe(false);
  });

  it.each(['-1', '1.5', ' 8', '8 ', '0x10', 'eight', ''])(
    'a non-strict integer "%s" → invalid',
    (bad) => {
      expect(resolve({ ASK_GUEST_ATTEMPTS_PER_SESSION: bad }).valid).toBe(false);
    },
  );

  it('the advertised third answer must fit: session units < 3 × per-request max → invalid', () => {
    const r = resolve({ ASK_GUEST_UNITS_PER_SESSION: '47999' });
    expect(r.valid).toBe(false);
  });

  it('MEASURED CONFLICT — the release source DEFAULT ip/day ceiling (30,000) cannot hold three answers', () => {
    const r = resolve({}, { ...OUTER, ipUnitsPerDay: 30_000 });
    expect(r.valid).toBe(false);
    expect(r.valid === false && r.problems.join(' ')).toMatch(/IP\/day/);
  });

  it.each([
    ['ASK_GUEST_POOL_UNITS_PER_HOUR', '2000000', /global\/hour|provider\/hour/],
    ['ASK_GUEST_POOL_UNITS_PER_DAY', '9000000', /global\/day/],
    ['ASK_GUEST_ATTEMPTS_PER_SESSION', '2', /attempts/],
    ['ASK_GUEST_EXECUTIONS_PER_IP_DAY', '2', /executions/],
    ['ASK_GUEST_CONCURRENT_PER_SESSION', '3', /concurrent/],
    ['ASK_GUEST_COOLDOWN_S', '7200', /cooldown/],
  ])('%s=%s stays INSIDE the outer controls → invalid', (key, value, message) => {
    const r = resolve({ [key]: value });
    expect(r.valid).toBe(false);
    expect(r.valid === false && r.problems.join(' ')).toMatch(message);
  });

  it('D2 — the session lifetime is ABSOLUTE and capped at 7 days, whatever is configured', () => {
    expect(resolve({ ASK_GUEST_SESSION_LIFETIME_H: '9999' }).lifetimes.sessionLifetimeH).toBe(168);
    expect(resolve({ ASK_GUEST_SESSION_LIFETIME_H: '24' }).lifetimes.sessionLifetimeH).toBe(24);
    expect(resolve().lifetimes.claimTtlS).toBeLessThanOrEqual(900);
  });
});
