import { createHash } from 'node:crypto';
import { clientIpScope } from './compute-scopes';
import { rateLimitIdentifier } from './rate-limit-identifier';

/** TRUST R1 (CTO §6) — guest limits never persist the raw address. */
describe('pseudonymous rate-limit identifier', () => {
  const env = { OAUTH_FLOW_SECRET: 'test-secret' } as NodeJS.ProcessEnv;
  const day = new Date('2026-10-03T10:00:00Z');

  it('is stable within a UTC day (the limit window) and rotates across days', () => {
    expect(rateLimitIdentifier('v4:203.0.113.7', day, env)).toBe(
      rateLimitIdentifier('v4:203.0.113.7', new Date('2026-10-03T23:59:59Z'), env),
    );
    expect(rateLimitIdentifier('v4:203.0.113.7', day, env)).not.toBe(
      rateLimitIdentifier('v4:203.0.113.7', new Date('2026-10-04T00:00:00Z'), env),
    );
  });

  it('is keyed: a different secret gives a different identifier, and it is not a plain hash', () => {
    const id = rateLimitIdentifier('v4:203.0.113.7', day, env);
    expect(id).not.toBe(
      rateLimitIdentifier('v4:203.0.113.7', day, {
        OAUTH_FLOW_SECRET: 'other',
      } as NodeJS.ProcessEnv),
    );
    for (const plain of ['203.0.113.7', 'v4:203.0.113.7']) {
      expect(createHash('sha256').update(plain).digest('hex').slice(0, 32)).not.toBe(id);
    }
  });

  it('the dedicated secret takes precedence over the derived one', () => {
    expect(
      rateLimitIdentifier('v4:1.2.3.4', day, { ...env, ASK_RATE_LIMIT_ID_SECRET: 'dedicated' }),
    ).not.toBe(rateLimitIdentifier('v4:1.2.3.4', day, env));
  });

  it('different networks stay distinct; an IPv6 /64 is one network', () => {
    expect(clientIpScope('203.0.113.7', day)).not.toBe(clientIpScope('203.0.113.8', day));
    expect(clientIpScope('2001:db8:1:2::1', day)).toBe(clientIpScope('2001:db8:1:2:ffff::9', day));
    expect(clientIpScope('2001:db8:1:2::1', day)).not.toMatch(/2001|db8/);
  });
});
