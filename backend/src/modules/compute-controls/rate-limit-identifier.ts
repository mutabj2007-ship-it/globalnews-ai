import { createHmac, randomBytes } from 'node:crypto';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — PSEUDONYMOUS RATE-LIMIT IDENTIFIER (CTO ruling §6)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Guest limits were keyed by the RAW client IP (`ip:v4:<address>`), persisted in ComputeMeter
 * and ComputeReservation.charges with no deletion. The meter needs only "the same network,
 * within this limit window" — never the address itself. So the address is replaced by a keyed
 * HMAC-SHA256 pseudonym:
 *
 *   rootKey  = HMAC-SHA256(secret, "gna-rate-limit-id:v1")      secret is server-side only
 *   dayKey   = HMAC-SHA256(rootKey, "<UTC day YYYY-MM-DD>")       rotates every UTC day
 *   id       = HMAC-SHA256(dayKey, "<canonical address or /64>")  first 128 bits, hex
 *
 * - CANONICAL INPUT: IPv4 as dotted quad (IPv4-mapped IPv6 unwrapped), IPv6 as its /64 prefix
 *   (compute-scopes.ts decides the canonical form, exactly as before).
 * - BOUNDED ROTATION: the key changes every UTC day, so identifiers from different days cannot be
 *   linked. Every guest limit window is an hour or a UTC day, so a rotation never splits a window.
 * - NOT REVERSIBLE WITHOUT THE SECRET: a plain or unsalted SHA of an address could be reversed by
 *   enumerating the IPv4 space; a keyed HMAC cannot be without the server secret.
 * - SECRET: `ASK_RATE_LIMIT_ID_SECRET` when set; otherwise derived (domain-separated) from the
 *   existing server secret `OAUTH_FLOW_SECRET`, so no new deployment variable is required. With
 *   neither, a per-process random key is used: still never the raw address, at the cost of counts
 *   restarting when the process restarts (stated, and only possible in a misconfigured deploy).
 */
const PROCESS_FALLBACK_KEY = randomBytes(32);
const ID_HEX_LENGTH = 32;

function rootKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const secret = env.ASK_RATE_LIMIT_ID_SECRET || env.OAUTH_FLOW_SECRET;
  const base = secret ? Buffer.from(secret, 'utf8') : PROCESS_FALLBACK_KEY;
  return createHmac('sha256', base).update('gna-rate-limit-id:v1').digest();
}

export function utcDayLabel(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The pseudonym for a canonical network key on the UTC day of `now`. */
export function rateLimitIdentifier(
  canonical: string,
  now: Date,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dayKey = createHmac('sha256', rootKey(env)).update(utcDayLabel(now)).digest();
  return createHmac('sha256', dayKey).update(canonical).digest('hex').slice(0, ID_HEX_LENGTH);
}
