/**
 * ════════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC EVIDENCE BY INTERCEPTION — C907 R2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT THIS REPLACES. `cases.ts` asked for determinism with
 * `fixture=golden-world` and friends. Nothing in the product reads that
 * parameter — grep returns no consumer — so every "deterministic" capture was
 * in fact taken against the live evidence feed. A comparison against a golden
 * threshold, fed by whatever the world was doing that minute, measures noise.
 *
 * THE RULING PREFERS TEST-HARNESS INTERCEPTION OVER PRODUCTION FIXTURE HOOKS,
 * and so does the evidence: a `fixture=` branch is a code path that ships to
 * users and can be reached in production by typing it into the URL bar. This
 * file pins the data from OUTSIDE the product instead. The application keeps no
 * test-only behaviour and loses no bytes.
 *
 * ── IT FAILS CLOSED, AND THAT IS THE WHOLE DESIGN ───────────────────────────
 *
 * Every request leaving the page for the API is matched against the pinned
 * fixture store by pathname. A request with NO pinned fixture is ABORTED and
 * recorded, and the test then fails naming the exact path.
 *
 * It would have been easier to let unknown requests through to the real
 * backend. That is precisely the failure being corrected: a harness that falls
 * back to live data is non-deterministic exactly when a fixture is missing,
 * which is when you least want it to be. Failing closed means the first run in
 * a Playwright-capable environment ENUMERATES the endpoints that still need
 * pinning, rather than quietly producing a green frame built from live news.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = join(HERE, 'fixtures');

/** `/geo/map-feed` ⇄ `geo__map-feed.json`. A flat, greppable, reviewable name. */
export const fixtureFileFor = (pathname) =>
  `${pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '__') || 'root'}.json`;

/**
 * Candidate filenames for a pathname, most specific first.
 *
 * Parameterised routes are real: `/news/country/RWA` and `/news/country/KEN`
 * are the same contract with a different key, and the protected frames select
 * different countries. Pinning one file per ISO3 would mean a fixture set that
 * silently depends on which countries the cases happen to name today.
 *
 * So a trailing segment may be matched by an `ANY` file — `news__country__ANY.json`
 * answers any `/news/country/:iso3`. The EXACT file always wins, so a frame that
 * needs a specific country's payload can still have one. Nothing broader than a
 * single trailing segment is wildcarded: `ANY` is a parameter, not a catch-all.
 */
export function fixtureCandidatesFor(pathname) {
  const exact = fixtureFileFor(pathname);
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (segments.length < 2) return [exact];
  return [exact, `${segments.slice(0, -1).join('__')}__ANY.json`];
}

export function loadFixtures() {
  if (!existsSync(FIXTURE_DIR)) return new Map();
  const map = new Map();
  for (const entry of readdirSync(FIXTURE_DIR)) {
    if (!entry.endsWith('.json') || entry.startsWith('_')) continue;
    map.set(entry, JSON.parse(readFileSync(join(FIXTURE_DIR, entry), 'utf8')));
  }
  return map;
}

/**
 * Install the pinned-evidence router on a Playwright page.
 *
 * @returns {{ missing: string[], served: string[] }} live arrays the caller
 *          asserts on after the capture. `missing` non-empty ⇒ the frame was
 *          NOT deterministic and the test must fail.
 */
export async function installPinnedEvidence(page) {
  const fixtures = loadFixtures();
  const missing = [];
  const served = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    /* Same-origin app traffic — documents, JS, CSS, fonts, map tiles served by
       the app itself — is not evidence and is left alone. */
    const isApiCall =
      /\/(geo|news|analysis|follows|users|auth|watch|situation)(\/|$)/.test(url.pathname) ||
      url.pathname.startsWith('/api/');

    if (!isApiCall) {
      await route.continue();
      return;
    }

    const file = fixtureCandidatesFor(url.pathname).find((candidate) => fixtures.has(candidate));

    if (file === undefined) {
      if (!missing.includes(url.pathname)) missing.push(url.pathname);
      /* Aborted, never passed through: an unpinned request must not become
         live data behind the gate's back. */
      await route.abort('blockedbyclient');
      return;
    }

    if (!served.includes(url.pathname)) served.push(url.pathname);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(fixtures.get(file)),
    });
  });

  return { missing, served };
}
