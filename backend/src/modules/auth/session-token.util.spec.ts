import { generateCsrfToken, generateRawSessionToken, hashSessionToken } from './session-token.util';

describe('session-token.util (Milestone #57)', () => {
  it('generates a 256-bit raw session token (64 hex characters)', () => {
    const token = generateRawSessionToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never generates the same raw token twice', () => {
    const a = generateRawSessionToken();
    const b = generateRawSessionToken();
    expect(a).not.toBe(b);
  });

  it('hashes deterministically \u2014 the same raw token always hashes to the same value', () => {
    const token = generateRawSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('the hash never equals the raw token it was derived from', () => {
    const token = generateRawSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it('different raw tokens hash to different values', () => {
    const a = generateRawSessionToken();
    const b = generateRawSessionToken();
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
  });

  it('generates a 128-bit CSRF token (32 hex characters), independent of session token generation', () => {
    const csrf = generateCsrfToken();
    const session = generateRawSessionToken();
    expect(csrf).toHaveLength(32);
    expect(csrf).toMatch(/^[0-9a-f]{32}$/);
    expect(csrf).not.toBe(session);
  });

  it('never generates the same CSRF token twice', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});
