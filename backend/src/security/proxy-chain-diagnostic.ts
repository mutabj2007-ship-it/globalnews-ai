import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * E1-C2 / Q-6 — ONE LINE, ONCE, TO SETTLE A QUESTION NOTHING ELSE CAN ANSWER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT IS UNKNOWN, AND WHY IT CANNOT BE LOOKED UP. Whether a trusting form of
 * TRUST_PROXY yields a real per-visitor address here depends on what the edge
 * in front of this deployment does to X-Forwarded-For. Railway's edge-networking
 * documentation does not mention the header at all, and its staff have described
 * the behaviour two incompatible ways in public support threads: one says the
 * edge APPENDS and the rightmost entry is the client, another says it STRIPS and
 * the first entry is. Express resolves only from the right and has no expression
 * for "leftmost", so the difference decides whether the setting can be used.
 *
 * A dashboard can show what the EDGE saw. Nothing outside this process can show
 * what THIS process received. Hence one line, from the deployment itself.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT IT LOGS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Counts and indices. Nothing else. No address appears in the output, in any
 * form, from any source — not the forwarded chain, not the socket peer, not
 * X-Real-IP, not a truncation or a hash of any of them. A hash would still be a
 * per-visitor identifier and is not a loophole.
 *
 * The CTO ruling authorised chain length and resolver position, and this emits
 * exactly those. A boolean for whether X-Real-IP was present would answer a
 * second question — Railway states it now protects that header from client
 * spoofing — and it is NOT included, because it is not what was authorised. It
 * is one field away if asked for.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * HOW THE POSITION IS DERIVED WITHOUT LOOKING AT A VALUE
 *
 * Express exposes `req.ips`: the TRUSTED tail of the forwarded chain, in
 * left-to-right order, with `req.ip` being its first element. So the arithmetic
 * is all that is needed, and it never touches an address:
 *
 *     forwardedEntries  = entries in the raw X-Forwarded-For header
 *     trustedEntries    = req.ips.length
 *     resolvedFromRight = trustedEntries - 1        (0 = the rightmost entry)
 *     resolvedFromLeft  = forwardedEntries - trustedEntries
 *
 * Verified against a live Express matrix (E1-R2 evidence, 04-express-resolution):
 * with chain [forged, edge] and trust proxy 1, req.ips is one entry long, so
 * resolvedFromLeft is 1 and resolvedFromRight is 0 — Express chose the edge.
 * With trust proxy 2 the same chain yields resolvedFromLeft 0: it chose the
 * forgery. Those two numbers are the whole finding, and neither is an address.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY IT SAMPLES TWO PATH CLASSES AND NOT ONE
 *
 * The first version took ONE sample, from the proxied families only, on the
 * reasoning that a single sample cannot say which ingress it came from and a
 * health check would waste it.
 *
 * The confirmed Alpha topology made that insufficient. This deployment has TWO
 * live ingress paths, not one:
 *
 *   browser -> edge -> Next frontend -> (railway.internal) -> backend
 *       the first-party families (seven at C29 — see PROXIED_FAMILY_PREFIXES)
 *   browser -> edge -> backend
 *       news, because NEXT_PUBLIC_API_URL names the backend's own public origin
 *       and newsApi.ts calls it directly through resolveApiBaseUrl()
 *
 * ANALYSIS MOVED BETWEEN THESE TWO GROUPS AND THIS COMMENT USED TO NAME IT IN
 * THE WRONG ONE. It is now proxied — see PROXIED_FAMILY_PREFIXES below for the
 * measurement and the reason. News is what is left in the direct group, which
 * is why the `other` sample is still worth taking.
 *
 * The OAuth callback belongs to the FIRST group, not this one: the accepted
 * Option-3 architecture resolves it from PUBLIC_OAUTH_CALLBACK_BASE, which is
 * <FRONTEND>/api, so Google returns the browser through the frontend proxy and
 * the request reaches this backend as /auth/google/callback. That places it in
 * the proxied-family class, which is where isProxiedFamilyPath already puts it.
 *
 * `trust proxy` is ONE setting and has to be correct for BOTH. A hop count that
 * suits one chain length and not the other is wrong wherever it does not suit,
 * and one sample cannot detect that. So this emits at most one line PER PATH
 * CLASS — two lines per process, hard capped, never more.
 *
 * HONEST ABOUT WHAT THE LABEL MEANS. `pathClass` is derived from the request
 * PATH, not from the network. A family path is what the frontend proxies and
 * an other path is what browsers call directly, so in practice the label tracks
 * the ingress — but the backend's public origin means anyone may call a family
 * path directly, and this label would not notice. It is a strong hint, not a
 * measurement, and it is named `pathClass` rather than `ingress` for that
 * reason.
 *
 * READ IT ALONGSIDE THE OTHER QUESTION IT ANSWERS. SERVER_INTERNAL_API_URL is
 * confirmed as http://backend.railway.internal:4000, so the proxied hop stays
 * on private networking and does not re-enter the edge. A family-path count
 * ABOVE 1 would contradict that and should be treated as the finding.
 */

/**
 * The first-party proxy families, as BACKEND path prefixes — one entry per
 * `rewrites` source in frontend/next.config.mjs, which is the only thing that
 * decides whether a request reached this process through the frontend.
 *
 * `/analysis` WAS MISSING AND THAT WAS A DEFECT, NOT AN OMISSION OF SCOPE.
 * When this file was written the frontend proxied six families and analysis
 * called the backend origin directly, so classifying `/analysis` as `other`
 * was correct. next.config.mjs now rewrites `/api/analysis/:path*`, and
 * frontend/src/lib/api/analysisApi.ts reaches it through
 * `resolveAccountApiBase()` — the first-party prefix. Proxied analysis traffic
 * was therefore being labelled `other`, the label that means "did NOT traverse
 * the frontend", and the sample taken under it could not be read as evidence
 * about the direct path.
 *
 * KEEP THIS LIST EQUAL TO THE REWRITE SOURCES. It is duplicated knowledge, and
 * the drift above is what duplicated knowledge does. There is no automatic pin
 * here on purpose — a backend spec that reads frontend/next.config.mjs fails
 * whenever the backend is tested without the frontend present, and a gate that
 * cannot run is worse than one that is checked by hand. E1 has proposed a
 * pinning option separately; until it is ruled, this comment is the pin.
 */
const PROXIED_FAMILY_PREFIXES = Object.freeze([
  '/analysis',
  '/auth',
  '/users',
  '/history',
  '/follows',
  '/support',
  '/admin',
]);

/** Which of the two live ingress paths this sample most likely came from. */
export type ProxyChainPathClass = 'proxied-family' | 'other';

export interface ProxyChainObservation {
  /** Entries in the raw X-Forwarded-For header. 0 when the header is absent. */
  forwardedEntries: number;
  /** Entries Express actually trusted. 0 when it fell back to the socket peer. */
  trustedEntries: number;
  /** Index of the chosen entry counted from the LEFT, or -1 for the socket peer. */
  resolvedFromLeft: number;
  /** Index of the chosen entry counted from the RIGHT, or -1 for the socket peer. */
  resolvedFromRight: number;
}

/**
 * Entries in an X-Forwarded-For header value.
 *
 * Node hands this over as a string, or as an array when the header arrived more
 * than once; both shapes are counted the same way. Empty segments — a trailing
 * comma, a doubled separator — are discarded rather than counted, because a
 * count that a stray comma can inflate would be worse than no count at all.
 */
export function countForwardedEntries(header: unknown): number {
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (typeof raw !== 'string') return 0;

  return raw.split(',').filter((entry) => entry.trim().length > 0).length;
}

/**
 * The observation, from counts alone.
 *
 * `trustedEntries` is clamped to `forwardedEntries`: the two are read from
 * different places and a future Express could conceivably disagree with the raw
 * header. Reporting a negative index would look like a finding rather than an
 * inconsistency, so the clamp keeps the output honest.
 */
export function describeProxyChain(header: unknown, trustedChain: unknown): ProxyChainObservation {
  const forwardedEntries = countForwardedEntries(header);
  const trusted = Array.isArray(trustedChain) ? trustedChain.length : 0;
  const trustedEntries = Math.min(trusted, forwardedEntries);

  if (trustedEntries === 0) {
    return { forwardedEntries, trustedEntries: 0, resolvedFromLeft: -1, resolvedFromRight: -1 };
  }

  return {
    forwardedEntries,
    trustedEntries,
    resolvedFromLeft: forwardedEntries - trustedEntries,
    resolvedFromRight: trustedEntries - 1,
  };
}

/** One line. A path class, four counts, and a source. No addresses — see the header. */
export function formatProxyChainObservation(
  observation: ProxyChainObservation,
  pathClass: ProxyChainPathClass,
): string {
  const source = observation.trustedEntries === 0 ? 'socket-peer' : 'forwarded-header';

  return (
    'PROXY CHAIN (one sample per path class, no addresses recorded): ' +
    `pathClass=${pathClass} ` +
    `forwardedEntries=${observation.forwardedEntries} ` +
    `trustedEntries=${observation.trustedEntries} ` +
    `resolvedFromLeft=${observation.resolvedFromLeft} ` +
    `resolvedFromRight=${observation.resolvedFromRight} ` +
    `source=${source}`
  );
}

export function isProxiedFamilyPath(path: unknown): boolean {
  if (typeof path !== 'string') return false;

  return PROXIED_FAMILY_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );
}

/**
 * Builds the middleware. A FACTORY rather than a module-level flag so each
 * instance owns its own "already emitted" state — main.ts calls it once, and a
 * test can build as many independent instances as it has cases.
 *
 * Every failure mode ends the same way: call next(). This observes; it must
 * never be able to affect a response, and a diagnostic that can take the site
 * down is worse than the uncertainty it was added to remove.
 */
export function createProxyChainDiagnostic(
  logger: Pick<Logger, 'log'> = new Logger('ProxyChainDiagnostic'),
): (request: Request, response: Response, next: NextFunction) => void {
  const pending = new Set<ProxyChainPathClass>(['proxied-family', 'other']);

  return function proxyChainDiagnostic(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    // The common case once both classes are sampled: one size check, then out
    // of the way for the rest of the process's life.
    if (pending.size === 0) {
      next();
      return;
    }

    try {
      const pathClass: ProxyChainPathClass = isProxiedFamilyPath(request.path)
        ? 'proxied-family'
        : 'other';

      if (pending.delete(pathClass)) {
        logger.log(
          formatProxyChainObservation(
            describeProxyChain(request.headers['x-forwarded-for'], request.ips),
            pathClass,
          ),
        );
      }
    } catch {
      // Deliberately silent, and deliberately latched on BOTH classes. If
      // deriving the counts threw, retrying on every subsequent request would
      // turn one unusable sample into an unbounded stream of them.
      pending.clear();
    }

    next();
  };
}
