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

const VERSION = 'gna-pwa-v1';
const PRECACHE = VERSION + '-precache';
const RUNTIME = VERSION + '-runtime';

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
 */
const NEVER_HANDLED_PREFIXES = ['/_next/image', '/sw.js'];

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

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
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
