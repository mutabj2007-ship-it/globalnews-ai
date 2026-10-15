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
];

/**
 * The path as the proxy would match it, made bypass-resistant: percent-decoded (repeatedly, bounded),
 * backslashes as slashes, duplicate slashes collapsed, dot segments resolved, lower-cased (the
 * comparison only — a case variant is either the same route or no route), trailing slash removed.
 */
export function normaliseLockdownPath(pathname: string): string {
  let p = pathname;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(p);
      if (next === p) break;
      p = next;
    } catch {
      break;
    }
  }
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
  return LOCKED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export const LOCKDOWN_CODE = 'SOURCE_RIGHTS_MAINTENANCE' as const;

export const LOCKDOWN_BODY = {
  statusCode: 503,
  code: LOCKDOWN_CODE,
  message:
    'This service is temporarily unavailable while source-use rights maintenance is in progress. Nothing was searched or run.',
} as const;
