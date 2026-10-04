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
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};
