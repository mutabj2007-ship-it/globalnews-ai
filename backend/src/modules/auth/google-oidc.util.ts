import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUER = 'https://accounts.google.com';

/**
 * Milestone #57 — the JWKS set is fetched lazily and cached internally
 * by jose itself (createRemoteJWKSet's own built-in caching/refresh
 * behavior) — created once at module load, reused across every
 * verification call, never re-fetched per request.
 */
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export interface GoogleAuthUrlParams {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

/**
 * Milestone #57 — builds the full Google authorization-request URL.
 * response_type=code (authorization-code flow, never implicit).
 * code_challenge_method=S256 (PKCE, never 'plain'). scope is the
 * minimum needed to obtain an ID token with email/profile claims —
 * never requests any broader Google API access this product doesn't
 * use.
 */
export function buildGoogleAuthUrl(params: GoogleAuthUrlParams): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export interface GoogleTokenExchangeParams {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOidcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleOidcError';
  }
}

/**
 * Milestone #57 — exchanges the authorization code for tokens via a
 * plain server-to-server POST (Node 20's built-in fetch — no new HTTP
 * client dependency). Includes code_verifier so Google can complete
 * the PKCE check on its own side. Never logs the response body (which
 * contains the id_token and, transiently, the access_token) — only a
 * generic failure message on a non-2xx response, matching this
 * codebase's existing error-classification discipline (never surface
 * raw upstream error detail).
 */
export async function exchangeGoogleAuthorizationCode(
  params: GoogleTokenExchangeParams,
): Promise<{ idToken: string }> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: params.codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    throw new GoogleOidcError('Failed to exchange authorization code with Google.');
  }

  const body = (await response.json()) as { id_token?: unknown };

  if (typeof body.id_token !== 'string' || body.id_token.length === 0) {
    throw new GoogleOidcError('Google token response did not include an id_token.');
  }

  return { idToken: body.id_token };
}

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
}

/**
 * Milestone #57 — the production trust boundary for Google identity.
 * Local verification via jose against Google's published JWKS
 * (createRemoteJWKSet) — never Google's tokeninfo endpoint. jwtVerify
 * itself checks the signature, `iss`, `aud`, and `exp` when given
 * those options (jose's own well-audited implementation — this
 * function never hand-writes signature verification or any
 * cryptographic primitive). The OIDC `nonce` claim is NOT something
 * jose verifies on its own — checked explicitly against the nonce
 * this same backend generated and stored in the flow-state cookie for
 * this exact attempt, which is the sole defense against a replayed ID
 * token being presented for a different, unrelated login attempt.
 * Any failure — bad signature, wrong audience, wrong issuer, expired,
 * or nonce mismatch — throws; the caller must treat every one of
 * these identically: reject the callback closed, never proceed with a
 * partially-verified identity.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId: string,
  expectedNonce: string,
): Promise<VerifiedGoogleIdentity> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: GOOGLE_ISSUER,
    audience: expectedClientId,
  });

  if (payload.nonce !== expectedNonce) {
    throw new GoogleOidcError('ID token nonce did not match the expected value for this authentication attempt.');
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new GoogleOidcError('ID token did not include a subject claim.');
  }

  if (typeof payload.email !== 'string' || payload.email.length === 0) {
    throw new GoogleOidcError('ID token did not include an email claim.');
  }

  return { subject: payload.sub, email: payload.email };
}
