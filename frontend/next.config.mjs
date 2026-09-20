/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Live news providers (GNews and any future real provider) serve
    // article images from an unbounded, provider-controlled set of
    // domains — there is no fixed list to whitelist. A wildcard
    // remotePattern is the officially recommended approach for this
    // case instead of hand-maintaining a domain allowlist.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  /**
   * M-ALPHA-AUTH — the first-party account path. THIS IS THE REPAIR.
   *
   * THE DEFECT. The live deployment served the app from
   * frontend-production-....up.railway.app and every authenticated request went
   * to backend-production-....up.railway.app. `up.railway.app` is on the Public
   * Suffix List, so those two hosts are DIFFERENT SITES, and a SameSite=Lax
   * cookie is never attached to a cross-site subresource request. The session
   * cookie was set correctly, stored correctly, and then withheld by the browser
   * on every fetch the frontend made — so GET /users/me was permanently 401, the
   * header could never stop saying "Sign In", and Follow, History, Support and
   * Admin were all unreachable behind the same one cookie. The CSRF
   * double-submit was broken by the same split: `gna_csrf` was set on the
   * backend origin and read with `document.cookie` on the frontend origin, which
   * is impossible.
   *
   * THE FIX IS TO REMOVE THE CROSS-SITE CONDITION, NOT TO LOOSEN THE COOKIE.
   * These rewrites put the authenticated surfaces behind this origin's own /api
   * path. The browser then only ever talks to ONE host for anything carrying a
   * session, the cookie is first-party, SameSite=Lax works as designed, and the
   * CSRF cookie becomes readable by the code that has to echo it — all without
   * a third-party cookie, which Safari and Firefox block by default and which
   * would therefore have left every iPhone user signed out.
   *
   * SEVEN AUTHENTICATED /api FAMILIES, AND NOT ONE MORE (CTO requirement 1).
   * Every route behind RequireAuthGuard is here: auth, users, history, follows,
   * support, admin — plus analysis, argued below.
   *
   * E1-N-1 — THE COUNT IS ABOUT THE AUTHENTICATED CLASS, NOT THE ARRAY LENGTH.
   * The rewrites() array now also carries PUBLIC, non-/api families, and the
   * first one (/news) is an eighth ARRAY ENTRY. It is not an eighth AUTHENTICATED
   * family, and the invariant this sentence protects is the authenticated count.
   *
   * The distinction has to be explicit because the sentence exists precisely to
   * stop an eighth, and E1 already corrected this same drift once — six to seven
   * at M-7. Letting an array element blur the class again would prove that
   * correction cosmetic. So, stated as two separate contracts:
   *
   *   A. AUTHENTICATED /api families — EXACTLY SEVEN, enumerated above. Behind
   *      RequireAuthGuard (or, for analysis, the tier guard). They receive the
   *      /api/:path* private-cache headers.
   *   B. PUBLIC non-/api families — enumerated separately at their own entry
   *      below. Session-blind, publicly cacheable, and deliberately OUTSIDE the
   *      /api/:path* header block.
   *
   * accountProxy.spec.ts asserts both classes separately, so neither can absorb
   * the other by accident.
   *
   * E1-M-7 — THE COUNT WAS WRONG AND IS CORRECTED HERE. The sentence above was
   * written when there were six entries and was left standing when analysis was
   * added below, so the file described six families and shipped seven. The
   * six named are still exactly the RequireAuthGuard set; analysis is the
   * seventh and is proxied for the tier and Retry-After reasons argued
   * immediately below, not because a guard demands it. Counting them is the
   * only way a reader can tell a deliberate seventh from an accidental one.
   *
   * MAIN-C2 STAGE 1 — ANALYSIS IS NOW PROXIED. THE PARAGRAPH THIS REPLACES SAID
   * IT NEVER SHOULD BE, SO THE REVERSAL IS ARGUED RATHER THAN QUIETLY MADE.
   *
   * M-ALPHA-AUTH reasoned that analysis "carries no cookie, needs none" and that
   * a proxy hop bought nothing. The first half turned out to be false in a way
   * that mattered. `AnalysisRateLimitGuard` resolves an AUTHENTICATED tier from
   * `gna_session` plus the CSRF echo — 30 requests per window instead of 5 — and
   * the direct, cross-site call could never deliver either: `up.railway.app` is
   * a public suffix, so a SameSite=Lax cookie is not attached to a cross-site
   * subresource request, and a document cannot read a cookie set on another
   * origin. Every signed-in caller was silently served the anonymous ceiling,
   * and the product told them signing in would raise it.
   *
   * The same hop also makes `Retry-After` readable. The guard has always set it;
   * CORS hid it, so the UI could only offer a range instead of a real time.
   *
   * The cost the old paragraph feared is real but small, and it was measured
   * rather than assumed: the proxy adds one private-network hop
   * (SERVER_INTERNAL_API_URL = backend.railway.internal), not a public one.
   *
   * ANONYMOUS ANALYSIS DOES NOT REGRESS, AND THAT WAS THE THING TO CHECK. A
   * visitor with no cookies sends none, the guard resolves them anonymous, and
   * they are served exactly as before. What changes for them is only that
   * `req.ip` now arrives via one more hop — see the trust-proxy note below.
   *
   * TRUST PROXY, MEASURED. Next 14 forwards an inbound `X-Forwarded-For`
   * UNCHANGED on a rewrite; it does not append its own peer. Verified against
   * this repository's own Next version with an echo server: an inbound
   * `X-Forwarded-For: 203.0.113.9` arrived at the destination as exactly
   * `203.0.113.9`, with the socket peer being the Next process. Express's
   * numeric `trust proxy` counts from the RIGHT, so `TRUST_PROXY=1` continues to
   * yield the real client address on this path exactly as it does on the direct
   * paths. E1's accepted architecture needs no change to accommodate this proxy.
   *
   * The public news routes remain unproxied: they carry no cookie and gain
   * nothing. `newsApi.ts` is unchanged.
   *
   * DESTINATION PRECEDENCE. Evaluated in the Next SERVER runtime, so it uses the
   * same precedence `resolveApiBaseUrl()` already uses for its server branch:
   * SERVER_INTERNAL_API_URL, then NEXT_PUBLIC_API_URL, then the local default.
   * SERVER_INTERNAL_API_URL exists precisely because the server-side runtime
   * lives inside the frontend container, where the public URL may not be the
   * right way to reach the backend. This file cannot import that TypeScript
   * module, so the precedence is restated here and pinned by
   * accountProxy.spec.ts, which loads THIS FILE and compares the two.
   */
  async rewrites() {
    const backendOrigin =
      process.env.SERVER_INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000';

    return [
      { source: '/api/analysis/:path*', destination: `${backendOrigin}/analysis/:path*` },
      { source: '/api/auth/:path*', destination: `${backendOrigin}/auth/:path*` },
      { source: '/api/users/:path*', destination: `${backendOrigin}/users/:path*` },
      { source: '/api/history/:path*', destination: `${backendOrigin}/history/:path*` },
      { source: '/api/follows/:path*', destination: `${backendOrigin}/follows/:path*` },
      { source: '/api/support/:path*', destination: `${backendOrigin}/support/:path*` },
      { source: '/api/admin/:path*', destination: `${backendOrigin}/admin/:path*` },

      /*
        PUBLIC NEWS — THE EIGHTH FAMILY THAT IS DELIBERATELY NOT AN /api FAMILY.

        The seven above are the authenticated set, and the count is a stated
        contract ("SEVEN FAMILIES, AND NOT ONE MORE"). This entry does not join
        them and does not change that number.

        WHY IT EXISTS. newsApi.ts and countryApi.ts already issue SAME-ORIGIN
        RELATIVE requests: with NEXT_PUBLIC_API_URL unset, Next inlines an empty
        string, `?? 'http://localhost:4000'` never fires, and the clients request
        `/news/...` on this origin. Measured on the deployed alpha: /news/country
        and /news/top-headlines both returned 404 served by NEXT — no
        X-Request-Id, so the backend never saw them. The clients were already
        correct; the rewrite was simply missing.

        WHY IT MUST STAY OUTSIDE /api. Two reasons, and both matter. It would
        make the authenticated count eight and break the stated contract. And
        /news is PUBLIC, cacheable data with no session: putting it behind the
        /api/:path* header block would mark public responses `private,
        no-store`, which is a performance regression dressed as a privacy fix.
        The backend agrees by construction — AUTHENTICATED_API_FAMILIES omits
        /news, and authenticated-cache-headers.spec.ts asserts that omission.

        This also removes the last reason anyone might set NEXT_PUBLIC_API_URL
        to a production backend from an alpha frontend.
      */
      { source: '/news/:path*', destination: `${backendOrigin}/news/:path*` },

      /*
        PUBLIC GEO — THE SECOND PUBLIC FAMILY, AND THE COUNT THAT MATTERS.

        E1-GEO-PUBLIC-REWRITE-REVIEW-1: SAFE TO ADD under G-1 … G-8. Like
        `/news` this is DELIBERATELY NOT AN `/api` FAMILY — the authenticated
        set above stays at SEVEN, and `/api/geo` is explicitly not added.
        Neither class may absorb the other.

        WHY IT IS NEEDED AT ALL. `geoNavigatorApi` and `mapFeedApi` issue
        SAME-ORIGIN RELATIVE requests: with `NEXT_PUBLIC_API_URL` unset Next
        inlines an empty string, so the browser asks this origin for
        `/geo/...`. Without this line that is a Next page route and returns
        404 — which is exactly what live Alpha measured on `/geo/map-feed`.

        G-8 SEQUENCING: `GeoModule` is registered in `backend/src/app.module.ts`
        FIRST. A rewrite to an unregistered route is still a 404 and is not
        integration.

        G-2: the public cache classification is applied BACKEND-side, because
        Next's `headers()` does not reach a rewritten response.
      */
      { source: '/geo/:path*', destination: `${backendOrigin}/geo/:path*` },

      /*
        ECONOMY — A PUBLIC FAMILY, AND NOT AN EIGHTH AUTHENTICATED ONE.

        The invariant above is about the AUTHENTICATED class — "SEVEN AUTHENTICATED
        /api FAMILIES, AND NOT ONE MORE" — and E1-N-1 already records that the array
        also carries public, non-`/api` families and that an extra array entry is not
        an extra authenticated family. This is the third public one, beside `/news`
        and `/geo`: no cookie, no CSRF token, no session, nothing behind
        RequireAuthGuard.

        WHY A REWRITE RATHER THAN AN ABSOLUTE URL IN THE READER: it is what keeps the
        reader's request unable to leave this deployment, which is the property the
        accepted network guard protects. The reader holds a relative path and cannot
        point anywhere else.

        G-8 SEQUENCING, as `/geo` records it: `EconomyModule` is registered in
        `backend/src/app.module.ts` FIRST. A rewrite to an unregistered route is a 404
        and is not integration.
      */
      { source: '/economy/:path*', destination: `${backendOrigin}/economy/:path*` },
      { source: '/conflict/:path*', destination: `${backendOrigin}/conflict/:path*` },
    ];
  },

  /**
   * PWA — two response headers, both load-bearing.
   *
   * /sw.js must never be cached by a browser, a proxy or a CDN. If an
   * intermediary pins an old service worker, users are stranded on it and the
   * update path this application relies on (skipWaiting + clients.claim, see
   * public/sw.js) can never run. `Service-Worker-Allowed: /` states the scope
   * explicitly rather than depending on the script's own path.
   *
   * /manifest.webmanifest needs `application/manifest+json`. Static-file
   * content-type resolution varies by host and a wrong type can make a browser
   * reject the manifest outright — which fails installability silently, with no
   * console error worth the name.
   *
   * Nothing above this block changes: reactStrictMode and the wildcard
   * remotePatterns are exactly as they were.
   */
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
      /*
        E1-M-4 — THE PROXY MOVED AUTHENTICATED JSON ONTO A STATIC-ASSET ORIGIN,
        AND NEITHER END WAS SAYING ANYTHING ABOUT CACHING IT.

        Before the rewrites above, /users/me and /follows/countries were fetched
        straight from the backend origin, where nothing between the browser and
        Nest had any reason to cache them. They are now served from THIS origin —
        the one whose whole job is serving immutable /_next/static assets, and
        which sits behind an edge tuned for exactly that. An intermediary that
        decided to cache a 200 from /api/users/me would serve one signed-in
        user's identity to the next visitor.

        `private` forbids any shared cache from storing it at all; `no-store`
        forbids even the browser's own disk cache, so a session response cannot
        be recovered from a shared machine after sign-out. `Vary: Cookie` is the
        belt to that braces: if some intermediary ignores the directives anyway,
        it is at least told that the response depends on the cookie, so two
        different sessions cannot collapse onto one cache entry.

        This is stated by us rather than inherited: the Railway edge's default
        for a proxied 200 is not documented, and a default is not a guarantee.
        The rehearsal measures the header actually returned, before and after,
        rather than trusting this block to have taken effect.
      */
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Vary', value: 'Cookie' },
        ],
      },
    ];
  },
};

export default nextConfig;
