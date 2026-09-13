import { randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Milestone #57 — the ephemeral, single-use payload correlating one
 * in-progress OAuth attempt: the state (CSRF protection for the OAuth
 * handshake itself), the PKCE code_verifier, the OIDC nonce (replay
 * protection for the returned ID token), and an explicit expiration.
 * Carried entirely in a short-lived httpOnly cookie — never readable
 * by frontend JavaScript, and never sent anywhere except back to this
 * same backend on the callback request.
 */
export interface OAuthFlowState {
  state: string;
  codeVerifier: string;
  nonce: string;
  expiresAt: number;
  /**
   * M-ALPHA-AUTH — the validated relative application path to return the user
   * to after a successful callback, or undefined for the existing homepage
   * default.
   *
   * IT LIVES HERE, AND NOWHERE ELSE, FOR ONE REASON: this payload is already
   * HMAC-SHA256 authenticated and already httpOnly, so a destination carried
   * inside it inherits both properties for free. The alternatives were all
   * worse. The `state` query parameter is attacker-visible and
   * attacker-editable. A second cookie would need its own integrity story. A
   * URL parameter on the callback would be editable by whoever holds the
   * browser at exactly the moment the user is most inclined to trust the
   * result.
   *
   * OPTIONAL, and old values stay readable: `decodeOAuthFlowState` treats a
   * payload without this field as a payload with no destination, so a flow
   * started before a deploy and completed after it still signs the user in and
   * simply lands them on the homepage. It never invents a destination.
   *
   * ALREADY VALIDATED BEFORE IT GETS HERE (see return-destination.util.ts), and
   * validated AGAIN on the way out. This field being signed proves it was not
   * edited in transit; it does not prove it was safe when written, so the exit
   * gate does not take its presence here as permission.
   */
  returnTo?: string;
}

/** Milestone #57 — the flow-state cookie lives only long enough for a real user to complete the Google consent screen. */
const FLOW_STATE_TTL_MS = 5 * 60 * 1000;

/**
 * Milestone #57 security correction — the dedicated secret used to
 * HMAC-authenticate the encoded flow-state. Deliberately a separate
 * environment variable from OAUTH_CLIENT_SECRET: that value is
 * Google's own credential (a genuinely different trust boundary —
 * proves this backend's identity TO Google), while this one only ever
 * needs to authenticate a value this backend generated for itself a
 * few minutes earlier. Coupling the two would mean rotating either
 * secret for its own reason forces an unrelated change to the other.
 */
function getFlowStateSecret(): string {
  return process.env.OAUTH_FLOW_SECRET ?? '';
}

/**
 * PKCE S256: the code_challenge sent in the initial authorization
 * request is the base64url-encoded SHA-256 hash of the code_verifier
 * that will later be sent in the token exchange — Google verifies the
 * hash relationship itself; this function only computes the
 * challenge, it never verifies anything (verification happens
 * server-side at Google, not in this codebase).
 */
export function deriveCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Milestone #57 — generates a fresh state/PKCE-verifier/nonce triple
 * for one authorization attempt. Each value is independently random
 * (crypto.randomBytes) — state, the PKCE verifier, and the OIDC nonce
 * are three separate security properties (CSRF-for-the-handshake,
 * authorization-code-injection defense, and ID-token replay
 * protection respectively) and must never be derived from one another.
 */
export function createOAuthFlowState(returnTo?: string): OAuthFlowState {
  const flowState: OAuthFlowState = {
    state: randomBytes(32).toString('base64url'),
    codeVerifier: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    expiresAt: Date.now() + FLOW_STATE_TTL_MS,
  };

  /*
    M-ALPHA-AUTH — the field is OMITTED rather than set to undefined when there
    is no destination, so the encoded JSON of a destination-less flow is
    byte-identical to what this function produced before this change. That keeps
    the common case's payload exactly as it was and makes the presence of the
    key in an encoded value meaningful.
  */
  if (returnTo !== undefined) {
    flowState.returnTo = returnTo;
  }

  return flowState;
}

/**
 * Milestone #57 security correction — this internal value is never
 * presented to any third party as a trusted assertion (unlike the
 * Google ID token, which IS cryptographically verified via
 * jose/JWKS). Its job is "let us read back exactly what we ourselves
 * generated a few minutes ago" — but HttpOnly alone does NOT provide
 * that guarantee. HttpOnly is a confidentiality control: it prevents
 * frontend JavaScript (same-origin or cross-origin) from READING the
 * cookie. It provides no integrity guarantee at all — nothing stops a
 * party able to otherwise inject or overwrite a cookie value (a
 * network-position actor, a malicious browser extension with
 * cookie-store access, cookie-tossing from a sibling subdomain, or a
 * hand-crafted request) from substituting a well-formed but
 * attacker-chosen state/codeVerifier/nonce — and auth.service.ts
 * trusts those exact fields directly during callback processing (the
 * state comparison, the token exchange, and ID-token nonce
 * verification). Confidentiality and integrity are separate
 * properties; HttpOnly only ever provided the former for this cookie.
 *
 * The payload is therefore now HMAC-SHA256 authenticated using a
 * dedicated secret (OAUTH_FLOW_SECRET) before it is ever trusted —
 * see decodeOAuthFlowState. Format: base64url(JSON) + '.' +
 * base64url(HMAC-SHA256 of that same base64url(JSON) string).
 */
export function encodeOAuthFlowState(flowState: OAuthFlowState): string {
  const payload = Buffer.from(JSON.stringify(flowState), 'utf-8').toString('base64url');
  const signature = createHmac('sha256', getFlowStateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Milestone #57 security correction — verifies the HMAC signature
 * BEFORE any JSON parsing or field trust occurs (per explicit
 * requirement: never parse or trust flow-state JSON before MAC
 * verification). Buffer lengths are checked before calling
 * timingSafeEqual — that function throws (rather than returning
 * false) when given two buffers of different lengths, so a
 * malformed/wrong-length signature is handled by the length check,
 * not by catching an exception from timingSafeEqual itself, keeping
 * "never throws" true for every caller of this function without
 * relying on a broad try/catch to paper over that specific case.
 *
 * Returns null (never throws) for a missing, malformed, tampered, or
 * expired value — including the OLD unsigned base64url(JSON) format,
 * which this function now rejects outright (a legacy value has no
 * '.' separator at all, so the initial split-into-two-parts check
 * alone already excludes it). Every caller must treat null as "no
 * valid in-progress OAuth attempt" and fail the callback closed,
 * never fall back to a default/skip-verification path.
 */
export function decodeOAuthFlowState(encoded: string | undefined): OAuthFlowState | null {
  if (!encoded) return null;

  const parts = encoded.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  let expectedSignatureBuffer: Buffer;
  let receivedSignatureBuffer: Buffer;

  try {
    expectedSignatureBuffer = createHmac('sha256', getFlowStateSecret()).update(payload).digest();
    receivedSignatureBuffer = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }

  if (expectedSignatureBuffer.length !== receivedSignatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    ) as Partial<OAuthFlowState>;

    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.codeVerifier !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }

    if (Date.now() > parsed.expiresAt) return null;

    /*
      M-ALPHA-AUTH — returnTo is carried through only when it is present AND a
      string. A payload whose returnTo is a number, an object or null decodes to
      a flow state with NO destination rather than being rejected outright: the
      signature already proved this backend wrote the value, so the sign-in
      itself is legitimate and refusing it would lock a real user out over a
      field that only decides where they land. It falls back to the homepage
      default, which is the safe direction.
    */
    const decoded: OAuthFlowState = {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
      nonce: parsed.nonce,
      expiresAt: parsed.expiresAt,
    };

    if (typeof parsed.returnTo === 'string') {
      decoded.returnTo = parsed.returnTo;
    }

    return decoded;
  } catch {
    return null;
  }
}
