import { NextResponse, type NextRequest } from 'next/server';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { routeGateDecision } from '@/lib/routing/standaloneRouteGate';
import { LOCKDOWN_BODY, lockdownBlocks, rightsLockdownMode } from '@/lib/routing/rightsLockdown';

/*
  The path set the standalone gate has always run on (the former matcher: not /api/…, not /_next/…,
  and no dot anywhere). Kept exactly, so widening the matcher for the lockdown changes nothing about
  the route gate.
*/
function routeGateApplies(pathname: string): boolean {
  const rest = pathname.slice(1);
  return !rest.startsWith('api/') && !rest.startsWith('_next/') && !pathname.includes('.');
}

/**
 * PRODUCTION PLATFORM ROUTE SEPARATION R2I — ONE CENTRAL SERVER-SIDE ROUTE GATE.
 *
 * Runs before any page renders (no client gate). The mode is the SAME predicate `/` uses
 * (`standaloneAskRoot`, GNA_PUBLIC_ROOT): platform passes everything through unchanged; any
 * other value is Standalone, where only the allowlisted public/operational routes are served
 * and every other page is redirected to `/` (temporary 307, query dropped, nothing executed).
 *
 * The decision reads the deployment environment and the request PATH only — never the Host
 * header, the query, cookies, the body or any client state.
 */
export function middleware(request: NextRequest): NextResponse {
  /*
    CTO R84 — DORMANT RIGHTS LOCKDOWN (lib/routing/rightsLockdown.ts). OFF unless the deployment sets
    GNA_RIGHTS_LOCKDOWN. When ACTIVE, every method on a locked proxy path is answered here with a
    typed 503 BEFORE any rewrite reaches the backend; nothing is proxied, nothing is run.
  */
  if (rightsLockdownMode(process.env.GNA_RIGHTS_LOCKDOWN) === 'ACTIVE' && lockdownBlocks(request.nextUrl.pathname)) {
    return NextResponse.json(LOCKDOWN_BODY, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '300', 'X-Rights-Lockdown': 'active' },
    });
  }
  if (!routeGateApplies(request.nextUrl.pathname)) return NextResponse.next();
  /* Explicit static read: the one variable, through the one predicate. */
  const standalone = standaloneAskRoot({ GNA_PUBLIC_ROOT: process.env.GNA_PUBLIC_ROOT });
  if (routeGateDecision(standalone, request.nextUrl.pathname) === 'PASS') {
    /*
      T2 · GLOBAL LANGUAGE FOUNDATION — the request PATH is forwarded to the Server Components as
      a request header so the root layout can resolve the same surface the page renders and set
      `<html lang>` / `<html dir>` from that surface's EFFECTIVE locale. Path only; nothing is
      read from the Host, the query, cookies or the body. The name is pinned against
      `SURFACE_PATH_HEADER` (lib/i18n/documentLocale.server.ts) by surfaceLocale.spec.ts.
    */
    const forwarded = new Headers(request.headers);
    forwarded.set('x-gna-pathname', request.nextUrl.pathname);
    return NextResponse.next({ request: { headers: forwarded } });
  }
  const root = request.nextUrl.clone();
  root.pathname = '/';
  root.search = '';
  root.hash = '';
  return NextResponse.redirect(root, 307);
}

/**
 * Infrastructure is excluded BEFORE the gate: /api (auth, OAuth callback, Ask V2, saved,
 * history, admin proxies), Next internals and any file request. The gate repeats these
 * exemptions (and adds the public proxy families) as defence in depth.
 */
export const config = {
  /* CTO R84 — every request except Next's own static assets, so the lockdown sees /api/…, /news/… and
     every encoded or dotted variant; the route gate itself still runs only where it always did
     (routeGateApplies). */
  matcher: ['/((?!_next/static/|_next/image/).*)'],
};
