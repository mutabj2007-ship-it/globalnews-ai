import {
  ASK_MODEL_MAX_ATTEMPTS,
  COMPUTE_CONTROL_KNOBS,
  pendingProductOwnerKnobs,
  resolveComputeControlsConfig,
} from './compute-controls.config';
import {
  canonicalNetworkKey,
  clientIpScope,
  dayBucket,
  hourBucket,
  withDeadline,
} from './compute-scopes';

/** Gate B knobs and scope keys — pure, no database (F 06, F 01 L-3/L-4, F 02 R-1, T-5). */
describe('F 06 knobs', () => {
  it('ships conservative defaults and marks the Product-Owner-owned ones', () => {
    const cfg = resolveComputeControlsConfig(() => undefined);
    expect(cfg.concurrentPerAccount).toBe(2);
    expect(cfg.concurrentPerIpPrefix).toBe(1);
    expect(cfg.breakerMinSamples).toBe(20);
    expect(cfg.breakerTripRatio).toBe(0.5);
    expect(cfg.flagCacheMs).toBe(5000);
    expect(pendingProductOwnerKnobs(() => undefined)).toEqual(
      expect.arrayContaining([
        'ASK_UNITS_PER_REQUEST_MAX',
        'ASK_GLOBAL_UNITS_PER_HOUR',
        'ASK_CONCURRENT_GLOBAL',
      ]),
    );
  });

  it('a malformed value falls back to the conservative default — never to unlimited', () => {
    for (const bad of ['', ' ', '-1', '1e9', 'Infinity', 'NaN', '12abc', '0x10', '3.5']) {
      const cfg = resolveComputeControlsConfig((n) =>
        n === 'ASK_GLOBAL_UNITS_PER_HOUR' ? bad : undefined,
      );
      expect(cfg.globalUnitsPerHour).toBe(COMPUTE_CONTROL_KNOBS.ASK_GLOBAL_UNITS_PER_HOUR[1]);
    }
    expect(
      resolveComputeControlsConfig((n) => (n === 'ASK_BREAKER_TRIP_RATIO' ? '1.5' : undefined))
        .breakerTripRatio,
    ).toBe(0.5);
    expect(
      resolveComputeControlsConfig((n) => (n === 'ASK_GLOBAL_UNITS_PER_HOUR' ? '42' : undefined))
        .globalUnitsPerHour,
    ).toBe(42);
  });

  it('R-1: the model is attempted once, and that is a constant, not a knob', () => {
    expect(ASK_MODEL_MAX_ATTEMPTS).toBe(1);
    expect(Object.keys(COMPUTE_CONTROL_KNOBS)).not.toContain('ASK_MODEL_MAX_ATTEMPTS');
  });
});

describe('F 01 L-3/L-4 — server-resolved IP scope', () => {
  it('IPv4 by address; IPv4-mapped IPv6 as its IPv4; IPv6 by /64 prefix', () => {
    /* TRUST R1 (CTO §6) — the canonical network key is unchanged; the SCOPE is its keyed pseudonym. */
    expect(canonicalNetworkKey('203.0.113.7')).toBe('v4:203.0.113.7');
    expect(canonicalNetworkKey('::ffff:203.0.113.7')).toBe('v4:203.0.113.7');
    expect(canonicalNetworkKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('v6:2001:db8:1:2::/64');
    expect(clientIpScope('::ffff:203.0.113.7')).toBe(clientIpScope('203.0.113.7'));
    expect(clientIpScope('203.0.113.7')).toMatch(/^ip:h:[0-9a-f]{32}$/);
    expect(clientIpScope('203.0.113.7')).not.toContain('203');
    expect(clientIpScope('2001:db8:1:2::1')).toBe(clientIpScope('2001:db8:1:2:ffff::9')); // same /64
    expect(clientIpScope('2001:db8:1:3::1')).not.toBe(clientIpScope('2001:db8:1:2::1'));
  });

  it('anything unparseable shares one bucket (can only be refused sooner)', () => {
    expect(clientIpScope(undefined)).toBe('ip:unknown');
    expect(clientIpScope('not-an-ip')).toBe('ip:unknown');
    expect(clientIpScope('10.0.0.1, 10.0.0.2')).toBe('ip:unknown');
  });

  it('hour and UTC-day buckets', () => {
    const t = new Date(Date.UTC(2031, 5, 7, 13, 45, 12));
    expect(hourBucket(t).toISOString()).toBe('2031-06-07T13:00:00.000Z');
    expect(dayBucket(t).toISOString()).toBe('2031-06-07T00:00:00.000Z');
  });

  it('T-5: withDeadline rejects a hung promise', async () => {
    await expect(withDeadline(new Promise(() => undefined), 20, 'x')).rejects.toThrow(
      'CONTROL_STORE_DEADLINE:x',
    );
    await expect(withDeadline(Promise.resolve(7), 20, 'x')).resolves.toBe(7);
  });
});
