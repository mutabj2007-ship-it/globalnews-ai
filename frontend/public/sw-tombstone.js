/*
 * GlobalNews AI — SERVICE WORKER TOMBSTONE.
 *
 * =====================================================================
 * THIS FILE IS A ROLLBACK ARTIFACT. IT IS NOT THE PRODUCTION WORKER.
 * =====================================================================
 *
 * It is never registered. Nothing imports it, nothing links it, and
 * `ServiceWorkerRegistrar` registers `/sw.js` and only `/sw.js`. Sitting
 * here it is completely inert: a service-worker script does nothing at
 * all unless a registration points at it.
 *
 * It exists so that retiring the released worker is a file copy rather
 * than code written under pressure:
 *
 *     cp frontend/public/sw-tombstone.js frontend/public/sw.js
 *     <redeploy>
 *
 * WHY A TOMBSTONE AND NOT `git revert`. The service worker is the only
 * artifact in the PWA change set that persists on users' machines after
 * a deploy is rolled back. Reverting removes `/sw.js` from the origin —
 * it does not reach into a browser that already holds the worker, and it
 * makes the URL 404. Some browsers drop a registration whose script 404s
 * during an update check; that is not uniform across browsers and must
 * not be the plan. A 200 carrying this script is deterministic.
 *
 * THE FOUR PROPERTIES THAT MAKE IT SAFE
 *
 * 1. NO FETCH HANDLER AT ALL. Not an empty one — none. From the instant
 *    this installs, every request goes straight to the network, before
 *    `unregister()` has even resolved. That is what makes the retirement
 *    immediate rather than merely eventual. An empty handler that called
 *    `respondWith` would still route traffic through this thread.
 *
 * 2. IT OPENS NO CACHE AND STORES NOTHING. There is no cache read, no
 *    cache write, and no allowlist. It can only remove.
 *
 * 3. `skipWaiting()` ON INSTALL, so it takes over on the first update
 *    check instead of waiting for every window to close. Combined with
 *    the `no-cache` header `next.config.mjs` sets on `/sw.js`, the window
 *    in which a user can still be on the retired worker is one
 *    navigation.
 *
 * 4. EVERY CACHE BUCKET IS DELETED — deliberately unfiltered, with no
 *    version prefix and no `VERSION` constant. A rollback that leaves
 *    buckets behind is not a rollback, and a filter written against
 *    `gna-pwa-v1-` would silently miss buckets left by any other version.
 *    This origin serves one application, so "everything" and "ours" are
 *    the same set.
 *
 * Deploy it at the same `/sw.js` path and keep the file there for at
 * least 30 days before restoring or removing it: a user who has not
 * visited in that window still holds the retired worker and has not yet
 * been handed this one.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        await caches.delete(name);
      }

      await self.registration.unregister();

      // Push every controlled window off this worker now, rather than
      // leaving it controlled until whenever the user next navigates.
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        client.navigate(client.url);
      }
    })(),
  );
});
