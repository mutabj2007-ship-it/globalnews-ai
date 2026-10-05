import { accountFetch } from './accountFetch';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE 2 · T5 PART B — THE GUEST PRIVACY CLIENT (status policy + "delete my guest data now")
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A separate, NON-protected client so the privacy and cookies pages (and, later, the Ask
 * composer through protected-file patch P-5/P-1) can read the guest data policy and delete the
 * caller's own guest data without editing the H+R4-protected `askV2Api.ts`. Same transport as
 * that client: `accountFetch` (credentials included; it echoes the readable CSRF cookie as
 * `X-CSRF-Token` on mutations). The forget call also carries the non-simple
 * `X-Requested-With: globalnews-ask` header the backend requires (a cross-site form cannot).
 *
 * Reads never mint a guest session (backend contract, R3 + T5 I9). Nothing here calls a
 * provider or a model.
 */

/** The configured guest data policy (`GET /ask-v2/guest/status` → `policy`). */
export interface GuestDataPolicy {
  readonly allowance: number;
  readonly sessionLifetimeH: number;
  readonly purgeGraceH: number;
  readonly sweepIntervalS: number;
}

/** The parts of the guest status this client reads. Server-authoritative; mirrored only. */
export interface GuestPrivacyStatus {
  readonly signedIn: boolean;
  readonly available: boolean;
  readonly policy?: GuestDataPolicy;
  readonly session?: { readonly expiresAt: string; readonly purgeAfter?: string } | null;
  readonly allowance?: number;
  readonly remaining?: number;
  readonly committed?: number;
  readonly reserved?: number;
  readonly state?: 'OPEN' | 'EXHAUSTED' | 'COOLDOWN' | 'ATTEMPTS_EXHAUSTED';
  readonly cooldownUntil?: string | null;
}

export type GuestPrivacyOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      /** UNAVAILABLE = Ask V2 off (404 on every guest route); NETWORK = no answer. */
      readonly reason: 'UNAVAILABLE' | 'NETWORK' | 'REFUSED';
      readonly status?: number;
      readonly code?: string;
    };

export interface GuestForgetResult {
  readonly forgotten: true;
  /** false when this browser had no live guest data (the call is idempotent). */
  readonly deleted: boolean;
}

export const GUEST_STATUS_PATH = '/ask-v2/guest/status';
export const GUEST_FORGET_PATH = '/ask-v2/guest/forget';
const GUEST_WRITE_HEADERS = { 'X-Requested-With': 'globalnews-ask' } as const;

type Fetcher = typeof accountFetch;

async function call<T>(
  fetcher: Fetcher,
  path: string,
  method: 'GET' | 'POST',
): Promise<GuestPrivacyOutcome<T>> {
  let response: Response;
  try {
    response = await fetcher(
      path,
      method === 'GET' ? { method } : { method, body: {}, headers: GUEST_WRITE_HEADERS },
    );
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
  if (response.status === 404) return { ok: false, reason: 'UNAVAILABLE', status: 404 };
  if (!response.ok) {
    let code: string | undefined;
    try {
      const body = (await response.json()) as { code?: unknown };
      if (typeof body?.code === 'string' && /^[A-Z_]{3,60}$/.test(body.code)) code = body.code;
    } catch {
      /* no body */
    }
    return {
      ok: false,
      reason: 'REFUSED',
      status: response.status,
      ...(code === undefined ? {} : { code }),
    };
  }
  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, reason: 'REFUSED', status: response.status };
  }
}

/** A client bound to a fetcher (injectable for tests). */
export function createGuestPrivacyApi(fetcher: Fetcher = accountFetch) {
  return {
    /** One read. Never mints a guest session. */
    status: () => call<GuestPrivacyStatus>(fetcher, GUEST_STATUS_PATH, 'GET'),
    /** Delete THIS browser's guest data now (idempotent). */
    forget: () => call<GuestForgetResult>(fetcher, GUEST_FORGET_PATH, 'POST'),
  };
}

export type GuestPrivacyApi = ReturnType<typeof createGuestPrivacyApi>;

export const guestPrivacyApi: GuestPrivacyApi = createGuestPrivacyApi();
