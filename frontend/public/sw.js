/*
 * GlobalNews AI — service worker.
 *
 * =====================================================================
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * =====================================================================
 *
 * Stale reporting must never be presented as live reporting.
 *
 * That rule has a specific consequence here, which is not the usual PWA
 * shape and is deliberate:
 *
 *   THE HOMEPAGE DOCUMENT *IS* THE NEWS.
 *
 * getHomeFeed() runs inside a Server Component. The browser never issues
 * the headlines request — it asks for an HTML document and receives one
 * with the headlines, and the LIVE / CACHED / DEMO / UNAVAILABLE badge,
 * already rendered into it. A cached document is therefore a cached
 * front page wearing whatever badge was true at the moment it was
 * stored. A document captured while dataMode === 'live' would, a week
 * later, still say "LIVE · Powered by GNews" above week-old headlines.
 *
 * Every route is also dynamic: the root layout reads the language cookie
 * in generateMetadata() and in RootLayout, so a cached document would
 * additionally freeze <html lang>, the tab title and every localized
 * string at capture time.
 *
 * So: HTML documents and RSC payloads are NETWORK ONLY, always. The only
 * thing that is ever served from cache in place of a document is
 * /offline.html, and only when the network transport itself fails.
 *
 * =====================================================================
 * THE SECURITY BOUNDARY
 * =====================================================================
 *
 *   DEFAULT DENY
 *   + EXPLICIT STATIC ALLOWLIST
 *   + NO DYNAMIC / API / AUTH PATH IN THAT ALLOWLIST
 *
 * The fetch handler returns WITHOUT calling respondWith() unless a
 * request matches a literal prefix listed below. Anything unmatched is
 * left entirely alone and behaves exactly as it would with no service
 * worker installed.
 *
 * The backend API lives on a different origin (NEXT_PUBLIC_API_URL), so
 * the same-origin check alone already excludes every news, analysis and
 * session request. The allowlist excludes them a second time by simply
 * never naming them. Cross-origin requests from a controlled client DO
 * fire this handler — that is exactly why the origin check is the first
 * thing after the method check, and why it returns rather than filters.
 *
 * WHAT IS DELIBERATELY *NOT* USED AS A SECURITY CONTROL.
 * There is no check on a `Set-Cookie` response header anywhere in this
 * file. `Set-Cookie` is a forbidden response-header name: for any
 * response a service worker can observe, headers.get('Set-Cookie')
 * returns null no matter what the server sent. A guard built on it would
 * read as a control while enforcing nothing, which is worse than no
 * guard at all because it invites the next reviewer to look less hard.
 * The observable header checks in isCacheable() below are defence in
 * depth only — the boundary is the allowlist.
 */

/*
 * D-ALPHA — the version is 'v2' because the two corrections below are BOTH
 * invisible to an already-installed client unless this string changes.
 *
 * `sw.js` had not changed a byte since 21 August, so the browser's byte
 * comparison of the fetched script against the installed one always matched
 * and install/activate never re-ran on any client that already had the worker.
 * Cache Storage was therefore never reset, and the six precached files — one
 * of which is offline.html, which A-2 edits — were frozen at whatever a client
 * fetched on its first visit. Changing this literal changes the script's bytes,
 * which is the whole mechanism: the browser installs, activates, deletes every
 * bucket that is not gna-pwa-v2-*, and re-precaches the shell from this
 * deployment.
 */
const VERSION = 'gna-pwa-v7';
const PRECACHE = VERSION + '-precache';
const RUNTIME = VERSION + '-runtime';

/*
  RCB-1 — THE RUNTIME BUCKET IS BOUNDED. THE PRECACHE IS NOT.

  D-BETA-3 was left unimplemented for a long time because the cost looked like
  untidiness: dead content-hashed chunks accumulating until the next generation
  purge. Measurement in a real browser changed that, and the reason for this cap
  is not disk.

  install() calls cache.addAll(PRECACHE_URLS) and REJECTS if it fails, so that a
  half-precached generation never activates. activate() is what purges the old
  generation. activate only runs after a successful install. So a runtime bucket
  that has reached the storage quota closes a loop:

      addAll rejects -> install rejects -> activate never runs
        -> the purge that would free the space never runs -> repeat

  The reader is then frozen on a generation that can never be replaced, and by
  D-PWA-PA-1 that means no future offline.html reaches them — including the
  tombstone, which is itself published as a new worker. Measured: 0.95 MB per
  deploy for a reader who visits ONE route, because a one-line source edit
  rehashes about three quarters of the built static bytes.

  WHY A COUNT AND NOT A BYTE BUDGET. With gzip negotiated, as a browser actually
  asks, the chunks arrive with no Content-Length, so a byte budget would have to
  read every stored entry back to size it — a full-body read per maintenance
  pass, in this file. 100 entries is about 3.2 MB at the measured mean.

  WHY FIFO AND NOT LRU. LRU needs per-entry access times, which is state, in the
  one file that must not acquire any. cache.keys() already returns insertion
  order, so FIFO costs nothing and stores nothing.
*/
const RUNTIME_MAX_ENTRIES = 100;

/*
 * Precached at install. Small, versioned by the cache name, and — this
 * is the load-bearing property — CONTAINS NO HTML ROUTE. /offline.html
 * is not a route; it is a static page that renders no reporting.
 */
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
];

/*
 * THE ALLOWLIST. Literal prefixes. No patterns, no wildcards, no regular
 * expressions — a reviewer must be able to read this and know exactly
 * what can be stored.
 *
 * /_next/static/ is content-hashed and immutable by construction: a new
 * build emits new URLs, so a cache hit can never be stale. It also holds
 * the self-hosted next/font files, which is why no font origin appears
 * anywhere in this application.
 */
const CACHE_FIRST_PREFIXES = ['/_next/static/'];

/*
 * /images/ holds seven decorative placeholder JPEGs shipped with the
 * app. They are not hashed, so they get stale-while-revalidate rather
 * than cache-first. They are NOT news imagery — article photographs
 * arrive through /_next/image, which is excluded below.
 */
const STALE_WHILE_REVALIDATE_PREFIXES = ['/images/'];

/*
 * Same-origin, but never handled.
 *
 * /_next/image is a first-party URL that proxies arbitrary third-party
 * bytes — the wildcard remotePatterns in next.config.mjs exists because
 * news providers serve article images from an unbounded set of domains.
 * Caching it would be caching news photography. It is news content
 * wearing a first-party URL.
 *
 * /sw.js must never be served from a cache or the update path can trap a
 * user on an old worker forever.
 *
 * /api/ IS THE ACCOUNT BOUNDARY, AND IT IS LISTED HERE RATHER THAN LEFT TO
 * DEFAULT DENY. next.config.mjs rewrites six authenticated route families —
 * auth, users, history, follows, support, admin — onto THIS origin's /api
 * path, so that a SameSite=Lax session cookie is first-party. That repair is
 * correct and this file does not touch it. But it removed two of the three
 * things that used to stand between those responses and Cache Storage:
 *
 *   - the same-origin check no longer fires, because they ARE same-origin now;
 *   - isCacheable()'s `type !== 'basic'` rejection no longer fires, for the
 *     same reason.
 *
 * AND THE HEADER HALF OF isCacheable() IS ALREADY INERT AGAINST THEM. Measured
 * at this commit: helmet 7.2.0's default set contains no Cache-Control, and
 * neither Cache-Control nor Vary is set anywhere in backend/src. Those
 * responses arrive with no Cache-Control, no Vary and type 'basic', so every
 * condition in isCacheable() passes. Widening the allowlist by one prefix was
 * enough to cache and replay /api/users/me and /api/admin/users — one line, in
 * this file, with no second guard behind it.
 *
 * Listing /api/ here is not the same as it merely failing to match a prefix.
 * This check runs BEFORE the navigate branch and before every allowlist, so:
 *
 *   - caching account, history, follows, support or admin data stops being one
 *     careless edit away and becomes structurally unreachable;
 *   - AUTHENTICATION NAVIGATIONS BYPASS THIS WORKER ENTIRELY. accountSignInUrl()
 *     renders <a href="/api/auth/google?returnTo=…">, which is a same-origin
 *     top-level navigation and was therefore being handled by
 *     documentNetworkOnly(). Sign-in must not depend on this file: it should
 *     not acquire an offline-page substitution, an opaque-redirect hop, or a
 *     dependency on how Next's rewrite proxy reports an unreachable backend.
 *
 * A reviewer adding offline support later reads a line that says these paths
 * are off limits, instead of inferring it from an absence.
 */
/*
 * ── B5-B · Δ4 RE-DERIVED AGAINST THIS LINEAGE'S OWN REWRITE SET ───────────
 *
 * /news/ AND /geo/ ARE HERE FOR A DIFFERENT REASON THAN /api/, and the two
 * reasons are recorded separately so a later reader can tell which prefix is
 * here for which rule rather than inferring one from the other.
 *
 *   /api/   is excluded because it is AUTHENTICATED. A per-user response must
 *           never be stored. (The reasoning above.)
 *
 *   /news/  and /geo/ carry NO SESSION, so the authentication argument does not
 *   /geo/   apply to them at all. They are excluded because THEY ARE REPORTING:
 *           /news/ is news JSON and /geo/map-feed is news-derived geography.
 *           Caching either stores reporting and lets it be REPLAYED AS CURRENT
 *           — the one rule this file exists to enforce, and the same reason no
 *           HTML document is ever cached.
 *
 * Both families are same-origin and are rewritten to the backend by
 * next.config.mjs (sources /news/:path* and /geo/:path*), so without naming
 * them here they would be protected by default-deny alone.
 *
 * ── AND WHY THE LICENSING BOUNDARY IS ALREADY CLOSED ──────────────────────
 *
 * '/_next/image' is the only same-origin path that can return a PUBLISHER's
 * image: Next's optimizer proxies an external URL through this origin, which
 * would otherwise make third-party evidence imagery look like a first-party
 * asset to this file. It is never handled, so that cannot happen.
 *
 * '/images/' below is stale-while-revalidate, and that remains correct: it
 * holds only this product's own bundled static files. Article and evidence
 * imagery arrives from the publisher's own origin, which this worker never
 * touches because the fetch handler leaves cross-origin requests alone.
 */
const NEVER_HANDLED_PREFIXES = ['/_next/image', '/sw.js', '/api/', '/news/', '/geo/'];

const PRECACHE_PATHS = new Set(PRECACHE_URLS);

function matchesPrefix(pathname, prefixes) {
  for (let index = 0; index < prefixes.length; index += 1) {
    if (pathname === prefixes[index] || pathname.indexOf(prefixes[index]) === 0) {
      return true;
    }
  }
  return false;
}

/*
 * Defence in depth ONLY. Every one of these headers is genuinely
 * observable on a same-origin basic response, unlike Set-Cookie. None of
 * them is the boundary; the allowlist is. They exist so that if a future
 * edit widens the allowlist by mistake, a response that is obviously
 * per-user still does not get stored.
 */
function isCacheable(response) {
  if (!response || !response.ok) return false;
  if (response.type !== 'basic') return false;

  const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase();
  if (cacheControl.indexOf('private') !== -1) return false;
  if (cacheControl.indexOf('no-store') !== -1) return false;

  const vary = (response.headers.get('Vary') || '').toLowerCase();
  if (vary.indexOf('cookie') !== -1) return false;

  return true;
}

/*
  FIFO maintenance for the runtime bucket, and NOTHING ELSE.

  This function's only inputs are the bucket name and the POSITION of a key. It
  does not open a stored entry, read a header, or look at a path beyond the
  bucket it was handed. That is deliberate and it is the security property, not
  a simplification: an eviction rule that chose WHAT to keep would make the set
  of stored entries depend on the nature of what was fetched, and a cache whose
  contents vary with the nature of a record is a presence/absence oracle over
  those records. Coarsening at the rendering layer would succeed and the storage
  metadata would defeat it. FIFO cannot become that, because position is all it
  knows.

  It is also entirely swallowed. Maintenance runs after a response has already
  been handed back, and a failure here must be invisible to the reader — the
  same rule the D-BETA-1 and D-BETA-2 guards established for the write itself.
*/
async function trimRuntimeCache(cacheName) {
  if (cacheName !== RUNTIME) return;
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let over = keys.length - RUNTIME_MAX_ENTRIES;
    let index = 0;
    while (over > 0 && index < keys.length) {
      await cache.delete(keys[index]);
      index += 1;
      over -= 1;
    }
  } catch (error) {
    /* Maintenance is best effort. The reader has already been served. */
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    /*
      D-BETA-1 — A CACHE WRITE FAILURE MUST NOT DESTROY A DELIVERED RESPONSE.

      This whole function runs inside the promise handed to respondWith, so an
      uncaught rejection here IS the user's answer. Before this guard, a
      QuotaExceededError from cache.put rejected a response the network had
      already returned in full. On this arm the request is a /_next/static/
      chunk, so the visible result was a failed script or stylesheet — a broken
      page caused by a storage problem, not a network one.

      The cache is an optimisation. The response is the product. When the two
      disagree, the response wins.

      Deliberately NOT done here: no purge, no retry, no telemetry. RCB-1 added
      a bound on the runtime bucket, and it is deliberately NOT in this catch —
      a failed write is not the moment to run maintenance, and putting policy
      inside an error handler puts it where nobody would look for it. The trim
      is invoked below, after a write that SUCCEEDED, and is not awaited.
    */
    try {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      void trimRuntimeCache(cacheName);
    } catch (error) {
      /* Storage refused. Nothing is stored — a failed put writes no partial
         entry — and the response continues to the caller untouched. */
    }
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) {
        /*
          D-BETA-2 — A CACHE FAILURE MUST NEVER BE REPORTED AS A NETWORK FAILURE.

          The outer .catch below exists for GENUINE transport failure and turns
          it into `undefined`, which the tail of this function reports as
          'offline and not cached'. Before this guard, a QuotaExceededError from
          cache.put fell into that same .catch — so a reader whose device was
          ONLINE, whose request the network had ANSWERED, was told they were
          offline. That is not merely a failure; it is a false diagnosis, and it
          is the one thing this file exists to never do.

          Catching the write here keeps the two causes apart: a storage problem
          returns the response, a transport problem still reaches the .catch.

          The message below is NOT reworded. It was reachable in a case where it
          was false; this removes that case, and it becomes true again.
        */
        try {
          const cache = await caches.open(cacheName);
          await cache.put(request, response.clone());
          void trimRuntimeCache(cacheName);
        } catch (error) {
          /* Storage refused. The response is still good, so return it. */
        }
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) return cached;

  const response = await network;
  if (response) return response;
  throw new Error('offline and not cached');
}

/*
 * Documents: network only, with /offline.html substituted ONLY when the
 * network transport itself fails.
 *
 * The distinction matters and is the whole reason this is a try/catch
 * around fetch() rather than a status check. If the server is reachable
 * and answers — including with a 5xx, or with a page whose feed came
 * back empty — the real response is returned untouched, so the
 * application's own honest "Live headlines are temporarily unavailable"
 * surfaces still do their job. /offline.html appears only when there is
 * no network at all, which is the one thing those surfaces cannot say.
 */
async function documentNetworkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(PRECACHE);
    const offline = await cache.match('/offline.html');
    if (offline) return offline;
    return Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

/*
 * UPDATE BEHAVIOUR.
 *
 * skipWaiting() + clients.claim() means a new worker takes over within
 * one navigation instead of waiting for every tab to close. That is
 * normally risky, because an immediate takeover can mix build-N HTML
 * with build-N+1 assets.
 *
 * It is safe HERE precisely because no HTML is ever cached: the document
 * always comes from the network and therefore always matches the current
 * deployment. Combined with the no-cache header on /sw.js in
 * next.config.mjs, the longest a user can be stranded on an old worker
 * is a single navigation. No update banner, no "reload to update"
 * prompt, no user-visible mechanism is needed.
 *
 * Every cache bucket not belonging to the current VERSION is deleted, so
 * a version bump is also a full cache reset.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== PRECACHE && name !== RUNTIME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  // Everything on another origin — which is the entire backend API, and
  // therefore every headline, every analysis and every session request —
  // is left completely alone.
  if (url.origin !== self.location.origin) return;

  if (matchesPrefix(url.pathname, NEVER_HANDLED_PREFIXES)) return;

  if (request.mode === 'navigate') {
    event.respondWith(documentNetworkOnly(request));
    return;
  }

  // RSC payloads carry the same server-rendered content as the documents,
  // in a different envelope. Network only, and no fallback: a failed RSC
  // request must surface as a failure, not as an offline page injected
  // into a running application.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return;
  if (url.pathname.indexOf('/_next/data/') === 0) return;

  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(cacheFirst(request, PRECACHE));
    return;
  }

  if (matchesPrefix(url.pathname, CACHE_FIRST_PREFIXES)) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  if (matchesPrefix(url.pathname, STALE_WHILE_REVALIDATE_PREFIXES)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }

  // DEFAULT DENY. Unmatched requests are not handled at all.
});
