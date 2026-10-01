import { NextResponse, type NextRequest } from 'next/server';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { routeGateDecision } from '@/lib/routing/standaloneRouteGate';

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
  /* Explicit static read: the one variable, through the one predicate. */
  const standalone = standaloneAskRoot({ GNA_PUBLIC_ROOT: process.env.GNA_PUBLIC_ROOT });
  if (routeGateDecision(standalone, request.nextUrl.pathname) === 'PASS') {
    return NextResponse.next();
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
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};
