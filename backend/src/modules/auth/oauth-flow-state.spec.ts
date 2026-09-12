import {
  createOAuthFlowState,
  decodeOAuthFlowState,
  deriveCodeChallenge,
  encodeOAuthFlowState,
} from './oauth-flow-state';

const TEST_FLOW_SECRET = 'test-oauth-flow-secret-for-spec-only';

describe('oauth-flow-state (Milestone #57)', () => {
  const originalEnv = process.env.OAUTH_FLOW_SECRET;

  beforeEach(() => {
    process.env.OAUTH_FLOW_SECRET = TEST_FLOW_SECRET;
  });

  afterAll(() => {
    process.env.OAUTH_FLOW_SECRET = originalEnv;
  });

  it('generates independently random state, codeVerifier, and nonce', () => {
    const flowState = createOAuthFlowState();
    expect(flowState.state).not.toBe(flowState.codeVerifier);
    expect(flowState.codeVerifier).not.toBe(flowState.nonce);
    expect(flowState.state).not.toBe(flowState.nonce);
  });

  it('never generates the same flow state twice', () => {
    const a = createOAuthFlowState();
    const b = createOAuthFlowState();
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('returns null for a missing cookie value', () => {
    expect(decodeOAuthFlowState(undefined)).toBeNull();
  });

  it('PKCE: derives a deterministic code_challenge for the same verifier', () => {
    const flowState = createOAuthFlowState();
    expect(deriveCodeChallenge(flowState.codeVerifier)).toBe(deriveCodeChallenge(flowState.codeVerifier));
  });

  it('PKCE: the code_challenge differs from the raw verifier and from another verifier\u2019s challenge', () => {
    const a = createOAuthFlowState();
    const b = createOAuthFlowState();
    const challengeA = deriveCodeChallenge(a.codeVerifier);
    expect(challengeA).not.toBe(a.codeVerifier);
    expect(challengeA).not.toBe(deriveCodeChallenge(b.codeVerifier));
  });

  /**
   * Milestone #57 security correction — the flow-state cookie's
   * encoding was previously plain base64url(JSON), with a doc comment
   * incorrectly claiming HttpOnly alone made it tamper-proof. HttpOnly
   * is a confidentiality control (blocks JavaScript reads); it
   * provides no integrity guarantee, and auth.service.ts trusts
   * state/codeVerifier/nonce directly from the decoded value during
   * callback processing. The payload is now HMAC-SHA256 authenticated
   * with a dedicated OAUTH_FLOW_SECRET before any field is trusted.
   */
  describe('HMAC authentication (Milestone #57 security correction)', () => {
    it('a valid, correctly signed flow-state round-trips through encode/decode preserving every field', () => {
      const original = createOAuthFlowState();
      const decoded = decodeOAuthFlowState(encodeOAuthFlowState(original));
      expect(decoded).toEqual(original);
    });

    it('rejects a payload that was tampered with after signing (the signature no longer matches the modified payload)', () => {
      const original = createOAuthFlowState();
      const encoded = encodeOAuthFlowState(original);
      const [, signature] = encoded.split('.');

      const tamperedFlowState = { ...original, state: 'attacker-controlled-state-value' };
      const tamperedPayload = Buffer.from(JSON.stringify(tamperedFlowState), 'utf-8').toString('base64url');

      expect(decodeOAuthFlowState(`${tamperedPayload}.${signature}`)).toBeNull();
    });

    it('rejects a payload whose signature was tampered with, even though the payload itself is untouched', () => {
      const original = createOAuthFlowState();
      const encoded = encodeOAuthFlowState(original);
      const [payload] = encoded.split('.');

      const forgedSignature = Buffer.from('not-the-real-signature-bytes-here').toString('base64url');

      expect(decodeOAuthFlowState(`${payload}.${forgedSignature}`)).toBeNull();
    });

    it('rejects the legacy unsigned base64url(JSON) format outright \u2014 no "." separator means no signature was ever present', () => {
      const original = createOAuthFlowState();
      const legacyUnsignedValue = Buffer.from(JSON.stringify(original), 'utf-8').toString('base64url');

      expect(decodeOAuthFlowState(legacyUnsignedValue)).toBeNull();
    });

    it('rejects a malformed/wrong-length signature WITHOUT throwing \u2014 handled by an explicit length check before timingSafeEqual, which itself throws on mismatched-length buffers', () => {
      const original = createOAuthFlowState();
      const encoded = encodeOAuthFlowState(original);
      const [payload] = encoded.split('.');

      expect(() => decodeOAuthFlowState(`${payload}.short`)).not.toThrow();
      expect(decodeOAuthFlowState(`${payload}.short`)).toBeNull();
    });

    it('rejects other garbage/malformed values without throwing', () => {
      expect(() => decodeOAuthFlowState('not-a-valid-value-at-all')).not.toThrow();
      expect(decodeOAuthFlowState('not-a-valid-value-at-all')).toBeNull();
      expect(decodeOAuthFlowState('too.many.dots.here')).toBeNull();
    });

    it('rejects an otherwise-correctly-signed flow-state that has expired \u2014 signature validity does not override the TTL', () => {
      const expired = { ...createOAuthFlowState(), expiresAt: Date.now() - 1000 };
      expect(decodeOAuthFlowState(encodeOAuthFlowState(expired))).toBeNull();
    });

    it('a value signed with a different secret is rejected \u2014 proves the secret genuinely participates in verification, not just present in the code path', () => {
      const original = createOAuthFlowState();
      const encoded = encodeOAuthFlowState(original);

      process.env.OAUTH_FLOW_SECRET = 'a-completely-different-secret-value';

      expect(decodeOAuthFlowState(encoded)).toBeNull();
    });

    it('PKCE codeVerifier survives the authenticated round-trip unchanged', () => {
      const original = createOAuthFlowState();
      const decoded = decodeOAuthFlowState(encodeOAuthFlowState(original));

      expect(decoded?.codeVerifier).toBe(original.codeVerifier);
      expect(deriveCodeChallenge(decoded!.codeVerifier)).toBe(deriveCodeChallenge(original.codeVerifier));
    });

    it('nonce survives the authenticated round-trip unchanged', () => {
      const original = createOAuthFlowState();
      const decoded = decodeOAuthFlowState(encodeOAuthFlowState(original));

      expect(decoded?.nonce).toBe(original.nonce);
    });
  });
});
