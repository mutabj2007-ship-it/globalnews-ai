import { isServerExecutionContext } from './apiBase';

/**
 * Milestone B-1 - server-only preservation of the visitor's client address
 * across the SSR hop.
 *
 * WHY THIS EXISTS. The homepage is server-rendered: page.tsx awaits
 * getHomeFeed(), which fetches GET /news/top-headlines from inside the
 * FRONTEND container (Milestone R2 points that hop at SERVER_INTERNAL_API_URL,
 * i.e. http://backend:4000 on the private container network). The backend
 * therefore sees the frontend container's address as req.ip for every visitor
 * on earth, and @nestjs/throttler - whose default tracker is req.ip - gives
 * them all one shared rate-limit bucket.
 *
 * R2's private hop also means that request never traverses the edge proxy, so
 * it carries no X-Forwarded-For of its own. The visitor's identity exists on
 * that hop only if this module deliberately forwards it.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It never SYNTHESISES a client address. It forwards the X-Forwarded-For the
 * edge proxy already produced, verbatim, or it forwards nothing at all. In
 * particular it never falls back to X-Real-IP, Client-IP or Forwarded: those
 * are client-settable, and treating one as a client address would hand every
 * visitor the ability to mint a fresh throttle identity per request - the exact
 * attack the backend's bounded TRUST_PROXY setting exists to prevent.
 *
 * Forwarding a header is only half of the contract. The backend decides whether
 * to BELIEVE it, via TRUST_PROXY (backend/src/security/trusted-proxy.config.ts).
 * With TRUST_PROXY unset the header is ignored entirely and behaviour is
 * unchanged, which is why this module is safe to ship ahead of any topology
 * decision.
 * ────────────────────────────────────────────────────────────────────────
 */

/** The one header forwarded, lower-cased. Nothing else is ever added. */
export const FORWARDED_FOR_HEADER = 'x-forwarded-for';

/**
 * Reads one incoming request header by name. Modelled on the Headers.get()
 * contract (a missing header is null) so the real next/headers store satisfies
 * it directly, and so the pure logic below is testable without a Next.js
 * request scope.
 */
export type IncomingHeaderReader = (name: string) => string | null | undefined;

/**
 * The pure decision, extracted so both boundaries can be tested exhaustively:
 * which headers - if any - this process should add to an outbound server-side
 * backend request.
 *
 * Returns the forwarded chain verbatim when the edge proxy supplied one, and an
 * empty object in every other case. An empty object is the honest answer to
 * "who is the visitor?" when nothing trustworthy said so.
 */
export function forwardedHeadersFrom(read: IncomingHeaderReader): Record<string, string> {
  let incoming: string | null | undefined;

  try {
    incoming = read(FORWARDED_FOR_HEADER);
  } catch {
    // A header store that throws is indistinguishable from one that has
    // nothing to say. Never let it break a render.
    return {};
  }

  if (typeof incoming !== 'string') {
    return {};
  }

  const trimmed = incoming.trim();

  if (trimmed.length === 0) {
    return {};
  }

  // Verbatim. Never re-ordered, never appended to, never rewritten: the
  // backend's hop-count or allowlist arithmetic is performed against the chain
  // the edge proxy actually produced, and altering it here would silently
  // change the address the backend resolves.
  return { [FORWARDED_FOR_HEADER]: trimmed };
}

/**
 * Resolves the headers to forward for the CURRENT execution context.
 *
 * Browser: always {}. Browser-issued requests carry the visitor's real source
 * address at the TCP layer; adding a forwarded header there would let page
 * JavaScript claim to be someone else.
 *
 * Server: reads the incoming request via next/headers. That import is dynamic
 * and inside the server branch precisely so it is never reachable from
 * browser-executed code, mirroring how apiBase.ts confines
 * SERVER_INTERNAL_API_URL to the same branch.
 *
 * headers() throws outside a request scope - during a static prerender, for
 * example - so the whole thing degrades to {} rather than failing a build. The
 * homepage is already dynamically rendered (page.tsx calls cookies()), so this
 * adds no rendering penalty to the path that matters.
 */
export async function resolveForwardedClientHeaders(): Promise<Record<string, string>> {
  if (!isServerExecutionContext()) {
    return {};
  }

  try {
    const { headers } = await import('next/headers');
    const store = headers();
    return forwardedHeadersFrom((name) => store.get(name));
  } catch {
    return {};
  }
}
