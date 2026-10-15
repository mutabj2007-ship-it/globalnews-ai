/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R84 (#95) — DORMANT FRONTEND PROXY LOCKDOWN (emergency fallback, OFF by default)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Why it exists: the Alpha backend has NO public domain — it is reachable only through this
 * frontend's first-party proxy (next.config.mjs rewrites). If a rights-containment backend ever had
 * to be reverted to a fail-open build, this gate closes the proxied news / analysis / story / alert /
 * discussion / Ask surfaces AT THE PROXY BOUNDARY, so no third-party material can be reached while
 * the backend is unprotected. It is not a feature and not containment by itself: it is the
 * protective restriction the recovery plan requires BEFORE any such revert (R81 RECOVERY-PLAN).
 *
 * ONE explicit gate: the deployment variable GNA_RIGHTS_LOCKDOWN, read in middleware.
 *   unset / empty / "off"  → OFF (the normal state; every request behaves exactly as before)
 *   "active"               → ACTIVE
 *   ANY other value        → ACTIVE (fail closed: a mistyped activation never leaves it open)
 * Activating it is a Product Owner decision and a deployment (Railway variable with
 * --skip-deploys, then an exact-SHA deploy); nothing in code flips it.
 *
 * While ACTIVE, every method on a locked path gets 503 with a typed code, so the Ask client treats
 * it as a definitive refusal ("nothing was run"), never as a lost response it should replay. The
 * body says why; it never says "no news". Sign-in, account, Settings, history, follows, support,
 * admin, the pages themselves and first-party assets stay usable.
 */

export type RightsLockdownMode = 'OFF' | 'ACTIVE';

export function rightsLockdownMode(raw: string | undefined): RightsLockdownMode {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '' || value === 'off') return 'OFF';
  return 'ACTIVE';
}

/** Path families the lockdown closes (segment-bounded prefixes, after normalisation). */
export const LOCKED_PREFIXES: readonly string[] = [
  '/news',
  '/api/analysis',
  '/api/ask-v2',
  '/api/stories',
  '/api/alerts',
  '/api/discussion',
  /* account-scoped reads that return stored article rows */
  '/api/users/me/saved/stories',
  '/api/users/me/intelligence',
  /* E1 R85 C-2 — proxied data families whose output could not be shown free of third-party article
     material (economy classifies REPORTING_ON_ECONOMY as a NEWS_PROVIDER source class; geo references
     article-shaped fields). Locked rather than assumed clean while the backend is fail-open. */
  '/geo',
  '/economy',
  '/market-data',
  '/conflict-data',
];

/**
 * The path as the proxy would match it, made bypass-resistant: percent-decoded (repeatedly, bounded),
 * backslashes as slashes, duplicate slashes collapsed, dot segments resolved, lower-cased (the
 * comparison only — a case variant is either the same route or no route), trailing slash removed.
 */
/** E1 R85 C-1 — a path the normaliser cannot fully decode is UNCERTAIN, and uncertainty locks. */
const NUL = String.fromCharCode(0);
export const LOCKDOWN_UNDECODABLE = `/${NUL}undecodable`;

export function normaliseLockdownPath(pathname: string): string {
  let p = pathname;
  let settled = false;
  for (let i = 0; i < 4; i += 1) {
    let next: string;
    try {
      next = decodeURIComponent(p);
    } catch {
      /* malformed escape (e.g. "/news%", "/news%zz"): fail CLOSED, never "less normalised" */
      return LOCKDOWN_UNDECODABLE;
    }
    if (next === p) {
      settled = true;
      break;
    }
    p = next;
  }
  /* still changing after the cap (deeper encoding than any real request): fail CLOSED */
  if (!settled) return LOCKDOWN_UNDECODABLE;
  /* a NUL anywhere is never a legitimate route: fail CLOSED */
  if (p.includes(NUL)) return LOCKDOWN_UNDECODABLE;
  p = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return `/${out.join('/')}`.toLowerCase();
}

export function lockdownBlocks(pathname: string): boolean {
  const p = normaliseLockdownPath(pathname);
  if (p === LOCKDOWN_UNDECODABLE) return true;
  return LOCKED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export const LOCKDOWN_CODE = 'SOURCE_RIGHTS_MAINTENANCE' as const;

export const LOCKDOWN_BODY = {
  statusCode: 503,
  code: LOCKDOWN_CODE,
  message:
    'This service is temporarily unavailable while source-use rights maintenance is in progress. Nothing was searched or run.',
} as const;
