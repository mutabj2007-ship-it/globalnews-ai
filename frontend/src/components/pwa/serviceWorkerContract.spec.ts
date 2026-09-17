import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * PWA-2 — SERVICE WORKER / OFFLINE CONTRACT.
 *
 * Source-reading structural tests, the convention already used by
 * legalPages.spec.ts and footerNavHud.spec.ts. Jest cannot install a service
 * worker, so these do not prove runtime behaviour — DevTools and the device
 * matrix do that. What they DO prove is that the file cannot silently acquire
 * the properties that would make it dangerous.
 *
 * Every assertion here is a named failure mode, not a style check:
 *
 *   §1  the cache surface stays default-deny
 *   §2  no HTML, news, analysis or session response can enter a cache
 *   §3  the update path cannot trap a user on a stale worker
 *   §4  the offline page shows no reporting and claims no data state
 *   §5  the registrar cannot alter the rendered document
 *
 * §2 is the one that matters. If it ever fails, stale reporting can be
 * presented as live, which is the single outcome this whole workstream exists
 * to prevent.
 */

const pwaDir = __dirname;
const frontendDir = join(pwaDir, '..', '..', '..');
const publicDir = join(frontendDir, 'public');

const swPath = join(publicDir, 'sw.js');
const offlinePath = join(publicDir, 'offline.html');
const registrarPath = join(pwaDir, 'ServiceWorkerRegistrar.tsx');
const nextConfigPath = join(frontendDir, 'next.config.mjs');

const swSource = readFileSync(swPath, 'utf-8');
const offlineSource = readFileSync(offlinePath, 'utf-8');
const registrarSource = readFileSync(registrarPath, 'utf-8');
const nextConfigSource = readFileSync(nextConfigPath, 'utf-8');

/**
 * Comment-stripped view of a source file.
 *
 * sw.js and offline.html are the two most heavily documented files in this
 * change, and their comments necessarily NAME the things they forbid —
 * '/analysis', '/users/', 'Set-Cookie', 'LIVE · Powered by GNews'. A raw grep
 * for those strings would fail on the documentation that exists to explain why
 * they are absent from the code.
 *
 * This is the same false-positive class M66.10B recorded when its own doc
 * comments tripped three of its checkers, and it is duplicated in
 * pwaContract.spec.ts rather than shared, because specs in this repository are
 * self-contained source readers and a shared test-util module would be a new
 * pattern introduced for four dozen lines.
 *
 * String-aware, so a `//` or `/*` inside a literal is not mistaken for a
 * comment opener.
 */
function stripJsComments(source: string): string {
  let out = '';
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (char === '\\') {
        out += char + (next ?? '');
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      out += char;
      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      out += ' ';
      continue;
    }

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
      out += ' ';
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/** Strips HTML comments so offline.html's own documentation is not searched. */
function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, ' ');
}

const swCode = stripJsComments(swSource);
const registrarCode = stripJsComments(registrarSource);
const nextConfigCode = stripJsComments(nextConfigSource);
const offlineMarkup = stripHtmlComments(offlineSource);
const offlineMarkupNoScript = offlineMarkup.replace(/<script[\s\S]*?<\/script>/g, ' ');

/**
 * D-ALPHA A-2 — the EXECUTABLE body of offline.html's inline script.
 *
 * The existing `offlineMarkup` strips HTML comments but leaves the script's own
 * JS comments intact, and A-2's documentation necessarily names the very APIs
 * it forbids: it says, in prose, "No setInterval, no setTimeout, no fetch". A
 * raw grep for those strings therefore finds them and passes a test that should
 * have failed — the same false-positive class M66.10B recorded, the one that
 * produced the I3 `void:` regression, and the one that made an earlier
 * assertion in this lane count `preload: false` five times instead of three.
 * Absence is only meaningful when measured against code.
 */
const offlineScriptCode = stripJsComments(
  (offlineSource.match(/<script>([\s\S]*?)<\/script>/) ?? ['', ''])[1],
);

/**
 * The account route families next.config.mjs rewrites onto THIS origin.
 *
 * Read out of next.config.mjs rather than hardcoded, deliberately: a seventh
 * family added there must fail the tests below rather than slip past a list
 * that nobody remembered to update.
 */
const REWRITTEN_ACCOUNT_FAMILIES = [
  ...nextConfigCode.matchAll(/source: '\/api\/([a-z]+)\/:path\*'/g),
].map((match) => match[1]);

/** The four provenance labels, verbatim from dictionaries/en.ts. */
const PROVENANCE_LABELS = [
  'LIVE · Powered by GNews',
  'CACHED · Previously retrieved reporting',
  'DEMO MODE · Sample content only',
  'NO REPORTING AVAILABLE',
  'DATA STATUS UNKNOWN',
];

describe('PWA-2 §1 — the cache surface is default-deny', () => {
  it('sw.js exists at the public root so its scope can be /', () => {
    expect(existsSync(swPath)).toBe(true);
  });

  it('ignores every non-GET request', () => {
    expect(swCode).toMatch(/request\.method !== 'GET'\s*\)\s*return/);
  });

  it('ignores every cross-origin request — which is the entire backend API', () => {
    expect(swCode).toMatch(/url\.origin !== self\.location\.origin\s*\)\s*return/);
  });

  it('ignores range requests', () => {
    expect(swCode).toMatch(/request\.headers\.has\('range'\)\s*\)\s*return/);
  });

  it('the allowlist is literal prefixes, not patterns', () => {
    expect(swCode).toContain("const CACHE_FIRST_PREFIXES = ['/_next/static/'];");
    expect(swCode).toContain("const STALE_WHILE_REVALIDATE_PREFIXES = ['/images/'];");
    // A regular expression in an allowlist is how an allowlist stops being one:
    // it turns a list a reviewer can read into a language they have to
    // interpret. Matching is done with indexOf against literals, nothing else.
    expect(swCode).not.toContain('new RegExp(');
    expect(swCode).toContain('function matchesPrefix(pathname, prefixes)');
  });

  it('excludes /_next/image — a first-party URL that proxies provider imagery', () => {
    expect(swCode).toContain("'/_next/image'");
    expect(swCode).toMatch(/NEVER_HANDLED_PREFIXES/);
  });

  it('excludes /sw.js itself from handling', () => {
    expect(swCode).toMatch(/NEVER_HANDLED_PREFIXES = \[[^\]]*'\/sw\.js'/);
  });
});

describe('PWA-2 §2 — nothing that could go stale or leak can be cached', () => {
  it('never names a news, analysis or account path in any CACHING rule', () => {
    /*
      ══ B5-B · SCOPED TO THE ALLOWLISTS, WHICH IS WHAT IT ALWAYS MEANT ══════

      C55's version asserted these strings appeared NOWHERE in sw.js, and on
      C55's lineage that was equivalent to the rule it states — "the allowlist
      does not name them either" — because /news/ was on another origin and
      naming it anywhere would have been meaningless.

      ON THIS LINEAGE THE TWO COME APART. next.config.mjs rewrites /news/:path*
      and /geo/:path* to the backend, so they ARE same-origin here, and the
      correct protection is to name them in the NEVER-HANDLED DENYLIST. A
      file-wide "not.toContain" would therefore forbid the very fix that closes
      the gap — it would pass only on a worker that had left them unnamed.

      So the assertion now tests what it says: these paths appear in no CACHING
      rule. The companion assertion below proves they appear in the denylist,
      which a file-wide ban could never distinguish from absence.
    */
    /*
      `swCode` is already comment-stripped, so this span is exactly the three
      allowlists — PRECACHE_URLS, CACHE_FIRST_PREFIXES and
      STALE_WHILE_REVALIDATE_PREFIXES — and stops BEFORE the denylist. Ending it
      at PRECACHE_PATHS instead would swallow NEVER_HANDLED_PREFIXES and make
      this assertion contradict the one below.
    */
    const allowlists = swCode.slice(
      swCode.indexOf('const PRECACHE_URLS'),
      swCode.indexOf('const NEVER_HANDLED_PREFIXES'),
    );

    expect(allowlists.length).toBeGreaterThan(0);
    expect(allowlists).toContain('CACHE_FIRST_PREFIXES');
    expect(allowlists).toContain('STALE_WHILE_REVALIDATE_PREFIXES');
    expect(allowlists).not.toContain('NEVER_HANDLED');

    for (const path of ['/analysis', '/news/', '/users/', '/auth/', 'top-headlines']) {
      expect(allowlists).not.toContain(path);
    }
  });

  it('and names the reporting families in the denylist, where absence is not enough', () => {
    /*
      THE POSITIVE HALF. Without it the test above passes on a worker that
      simply never heard of /news/ — which is the pre-B5 state, and the whole
      thing being corrected.
    */
    const denylist = swCode.slice(
      swCode.indexOf('const NEVER_HANDLED_PREFIXES'),
      swCode.indexOf('const PRECACHE_PATHS'),
    );

    for (const path of ['/api/', '/news/', '/geo/']) {
      expect(denylist).toContain(path);
    }
  });

  it('precaches no HTML route', () => {
    const precacheBlock = swCode.slice(
      swCode.indexOf('const PRECACHE_URLS'),
      swCode.indexOf('const CACHE_FIRST_PREFIXES'),
    );
    for (const route of ['/map', '/search', '/history', '/workspace', '/privacy', '/terms', '/source-policy']) {
      expect(precacheBlock).not.toContain(`'${route}'`);
    }
    // The document root is the most dangerous single entry: on this
    // application the homepage document CONTAINS the headlines and the badge.
    expect(precacheBlock).not.toMatch(/['"]\/['"]/);
    expect(precacheBlock).toContain("'/offline.html'");
  });

  it('serves documents from the network only, with no cache read', () => {
    const handler = swCode.slice(swCode.indexOf('async function documentNetworkOnly'));
    const body = handler.slice(0, handler.indexOf('self.addEventListener'));
    expect(body).toContain('return await fetch(request)');
    // The only cache read permitted in the document path is the offline page.
    expect(body).toContain("cache.match('/offline.html')");
    expect(body).not.toContain('caches.match(request)');
  });

  it('falls back to the offline page on transport failure, never on an HTTP status', () => {
    const handler = swCode.slice(
      swCode.indexOf('async function documentNetworkOnly'),
      swCode.indexOf("self.addEventListener('install'"),
    );
    // A status check here would replace the application's own honest
    // "Live headlines are temporarily unavailable" surface with a generic
    // offline page whenever the backend hiccuped — which would be a lie.
    expect(handler).not.toMatch(/response\.status/);
    expect(handler).not.toMatch(/response\.ok/);
    expect(handler).toContain('catch');
  });

  it('does not use Set-Cookie as a security control', () => {
    // Set-Cookie is a forbidden response-header name: headers.get('Set-Cookie')
    // returns null on any response a worker can observe. A check on it would
    // read as a control while enforcing nothing.
    expect(swCode).not.toContain('Set-Cookie');
    expect(swCode).not.toContain('set-cookie');
  });

  it('keeps the observable header checks as real, secondary guards', () => {
    expect(swCode).toContain("response.type !== 'basic'");
    expect(swCode).toMatch(/cacheControl\.indexOf\('private'\)/);
    expect(swCode).toMatch(/cacheControl\.indexOf\('no-store'\)/);
    expect(swCode).toMatch(/vary\.indexOf\('cookie'\)/);
  });

  it('every cache write goes through isCacheable', () => {
    const writes = swCode.match(/cache\.put\(/g) ?? [];
    const guards = swCode.match(/if \(isCacheable\(response\)\)/g) ?? [];
    expect(writes.length).toBeGreaterThan(0);
    expect(guards.length).toBe(writes.length);
  });
});

describe('PWA-2 §3 — update behaviour cannot strand a user', () => {
  it('takes over within one navigation', () => {
    expect(swCode).toContain('self.skipWaiting()');
    expect(swCode).toContain('self.clients.claim()');
  });

  it('deletes every cache bucket that is not the current version', () => {
    expect(swCode).toMatch(/caches\.keys\(\)/);
    expect(swCode).toMatch(/caches\.delete\(name\)/);
    expect(swCode).toMatch(/const VERSION = '[a-z0-9-]+'/);
  });

  it('next.config.mjs stops /sw.js from being cached by any intermediary', () => {
    expect(nextConfigCode).toMatch(/source: '\/sw\.js'/);
    expect(nextConfigCode).toMatch(/no-cache/);
    expect(nextConfigCode).toMatch(/Service-Worker-Allowed/);
  });

  it('next.config.mjs serves the manifest with the correct content type', () => {
    expect(nextConfigCode).toMatch(/source: '\/manifest\.webmanifest'/);
    expect(nextConfigCode).toContain('application/manifest+json');
  });

  it('next.config.mjs leaves the pre-existing image configuration untouched', () => {
    expect(nextConfigCode).toContain('remotePatterns');
    expect(nextConfigCode).toMatch(/hostname: '\*\*'/);
    expect(nextConfigCode).toContain('reactStrictMode: true');
  });
});

describe('PWA-2 §4 — the offline page is honest', () => {
  it('exists and is precached', () => {
    expect(existsSync(offlinePath)).toBe(true);
    expect(swCode).toContain("'/offline.html'");
  });

  it('shows no reporting of any kind', () => {
    expect(offlineMarkupNoScript).not.toContain('<article');
    expect(offlineMarkupNoScript).not.toContain('<img');
    expect(offlineMarkupNoScript).not.toMatch(/<h[23]/);
  });

  it('claims none of the four provenance states', () => {
    for (const label of PROVENANCE_LABELS) {
      expect(offlineMarkupNoScript).not.toContain(label);
    }
    expect(offlineMarkupNoScript).not.toContain('DataModeLabel');
  });

  it('distinguishes connectivity from a statement about world events', () => {
    expect(offlineMarkupNoScript).toContain('connectivity problem on this device');
    expect(offlineMarkupNoScript).toContain('not a statement about world events');
    expect(offlineMarkupNoScript).toContain('problem z połączeniem na tym urządzeniu');
  });

  it('fetches nothing — it has to work with the network down', () => {
    expect(offlineMarkupNoScript).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(offlineMarkupNoScript).not.toContain('<link');
    expect(offlineMarkupNoScript).not.toContain('src=');
  });

  it('resolves language with the same parse and the same default as the app', () => {
    expect(offlineSource).toContain("'globalnews-ai-language'");
    // LANG-UI-7 — ACTIVE is DERIVED from the data-language blocks the document
    // actually contains, so the list cannot claim a locale that was never written.
    expect(offlineSource).toMatch(/var ACTIVE = \(function \(\) \{/);
    /*
      LANG-OFFLINE-PWA-1 — THIS ASSERTION USED TO PIN THE DEFECT.
      It previously required `document.documentElement.dir = DIRECTION[requested]`,
      which is exactly the line MAIN-LANG-MEASURE-1 measured as wrong: metadata
      taken from the REQUESTED locale while the content fell back to a block that
      exists. A test that pins a defect makes the defect load-bearing, so the
      expectation moves with the fix rather than being deleted.

      `lang` and `dir` now derive from the EFFECTIVE content locale, the fallback
      locale is DECLARED in the markup rather than taken from an array index, and
      the notice element carries its own language. The behavioural proof lives in
      offlineLocaleIntegrity.spec.ts, which executes this script instead of
      grepping it. These static assertions exist so the lines cannot be reverted
      quietly.
    */
    expect(offlineScriptCode).toMatch(
      /document\.documentElement\.lang = effectiveContentLocale;/,
    );
    expect(offlineScriptCode).toMatch(
      /document\.documentElement\.dir = DIRECTION\[effectiveContentLocale\]/,
    );
    // The fallback locale is read from a declaration, not from ACTIVE[0].
    expect(offlineMarkup).toMatch(/data-language="en" data-offline-fallback/);
    expect(offlineScriptCode).toMatch(/\[data-offline-fallback\]\[data-language\]/);
    // The notice declares the language it is actually written in.
    expect(offlineScriptCode).toMatch(/note\.setAttribute\('lang', noticeLocale\)/);
    // And the defective forms must not survive anywhere in the executable body.
    expect(offlineScriptCode).not.toMatch(/documentElement\.lang = requestedDisplayLocale/);
    expect(offlineScriptCode).not.toMatch(/documentElement\.dir = DIRECTION\[requestedDisplayLocale\]/);
    expect(offlineSource).toMatch(/return value && DIRECTION\[value\] \? value : 'en'/);
    // With JavaScript off, English shows — the same default every route applies.
    expect(offlineMarkupNoScript).toMatch(/<html lang="en">/);
    expect(offlineMarkupNoScript).toMatch(/data-language="pl" hidden/);
  });

  it('offers a retry rather than stranding the user', () => {
    expect(offlineMarkupNoScript).toContain('data-retry');
    expect(offlineSource).toContain('window.location.reload()');
  });
});

describe('PWA-2 §5 — the registrar cannot alter the rendered document', () => {
  it('is a client component that renders nothing', () => {
    expect(registrarSource).toMatch(/^'use client';/);
    expect(registrarCode).toContain('): null {');
    expect(registrarCode).toContain('return null;');
    // No JSX at all — nothing to insert into the Claude Design tree.
    expect(registrarCode).not.toMatch(/<[A-Za-z]/);
  });

  it('registers only in production, and only at the app scope', () => {
    expect(registrarCode).toMatch(/process\.env\.NODE_ENV !== 'production'/);
    expect(registrarCode).toMatch(/navigator\.serviceWorker\.register\('\/sw\.js', \{ scope: '\/' \}\)/);
  });

  it('defers registration past page load', () => {
    expect(registrarCode).toMatch(/addEventListener\('load', register/);
  });

  it('guards feature detection before touching the API', () => {
    expect(registrarCode).toContain("'serviceWorker' in navigator");
  });
});


/**
 * D-ALPHA — THE ACCOUNT BOUNDARY AND THE OFFLINE PAGE'S RECOVERY.
 *
 * WHY THIS SECTION EXISTS. The M-ALPHA-AUTH repair in next.config.mjs moved six
 * authenticated route families onto this origin so a SameSite=Lax session
 * cookie could be first-party. That repair is right. Its side effect on THIS
 * lane is that two of the three guards which used to keep those responses out
 * of Cache Storage stopped applying — the same-origin check, and isCacheable()'s
 * `type !== 'basic'` rejection — while the header half of isCacheable() was
 * already inert against them, because helmet 7.2.0 sets no Cache-Control and
 * backend/src sets neither Cache-Control nor Vary.
 *
 * So these tests do not merely assert that /api/ is absent from the allowlists.
 * They assert that it is NAMED as never handled, and that the never-handled
 * check runs FIRST. Absence is a fact about today; precedence is a property.
 */
describe('D-ALPHA §6 — /api/ is structurally outside the worker', () => {
  it('names /api/ as never handled, rather than relying on default deny', () => {
    expect(swCode).toMatch(/NEVER_HANDLED_PREFIXES = \[[^\]]*'\/api\/'/);
  });

  it('checks never-handled BEFORE the navigate branch and before every allowlist', () => {
    /*
      Precedence is the property under test, not membership. If the
      NEVER_HANDLED test ever moved below the navigate branch, /api/auth/**
      navigations would be intercepted again and sign-in would depend on this
      file; if it moved below the allowlists, a widened allowlist could win.
    */
    const neverHandled = swCode.indexOf('matchesPrefix(url.pathname, NEVER_HANDLED_PREFIXES)');
    const navigate = swCode.indexOf("request.mode === 'navigate'");
    const precache = swCode.indexOf('PRECACHE_PATHS.has(url.pathname)');
    const cacheFirst = swCode.indexOf('matchesPrefix(url.pathname, CACHE_FIRST_PREFIXES)');
    const staleWhile = swCode.indexOf('matchesPrefix(url.pathname, STALE_WHILE_REVALIDATE_PREFIXES)');

    expect(neverHandled).toBeGreaterThan(-1);
    for (const later of [navigate, precache, cacheFirst, staleWhile]) {
      expect(later).toBeGreaterThan(neverHandled);
    }
  });

  it('covers every account family next.config.mjs currently rewrites', () => {
    /*
      Six families at D-ALPHA; SEVEN as of MAIN-C2 Stage 1, which added
      `/api/analysis`. This test exists to force exactly this review when that
      happens, and the review was done: NO CHANGE TO sw.js IS REQUIRED.

      The worker excludes by PREFIX, not by family — `NEVER_HANDLED_PREFIXES`
      contains `'/api/'`, tested above, and is checked before the navigate
      branch and before every allowlist. `/api/analysis/**` is therefore already
      outside the worker by the same structural rule that covers the other six,
      with nothing new to add and no new way in.

      That matters more for analysis than for the rest: it is a POST carrying a
      session cookie and a CSRF echo, and a worker that cached or replayed it
      would be replaying an authenticated, expensive request. It does not,
      because the prefix rule is checked first.

      `sw.js` is D-owned and is NOT modified by MAIN-C2. Only this enumeration
      moves, which is the decision this guard was built to demand.
    */
    expect(REWRITTEN_ACCOUNT_FAMILIES.sort()).toEqual([
      'admin',
      'analysis',
      'auth',
      'follows',
      'history',
      'support',
      'users',
    ]);

    // Every one of them is a strict extension of the '/api/' prefix, so the
    // single never-handled entry covers all of them and any future sibling.
    for (const family of REWRITTEN_ACCOUNT_FAMILIES) {
      expect(`/api/${family}/`.startsWith('/api/')).toBe(true);
    }
  });

  it('lets no /api prefix into any cache strategy or the precache', () => {
    /*
      The inverse of the first test, so widening is caught from both sides.
      PRECACHE_URLS is checked as well: a precached /api path would be fetched
      and stored at install time, before any fetch handler runs at all.
    */
    for (const list of [
      'CACHE_FIRST_PREFIXES',
      'STALE_WHILE_REVALIDATE_PREFIXES',
      'PRECACHE_URLS',
    ]) {
      const start = swCode.indexOf(`const ${list} = [`);
      expect(start).toBeGreaterThan(-1);
      const body = swCode.slice(start, swCode.indexOf('];', start));
      expect(body).not.toContain('/api');
    }
  });

  it('does not lean on isCacheable() to protect the account routes', () => {
    /*
      RECORDED SO IT CANNOT BE MISREAD. isCacheable() is defence in depth and,
      against /api/**, it is currently no defence at all: those responses carry
      no Cache-Control and no Vary, and are type 'basic' now that they are
      same-origin, so every condition in it passes. The boundary is the
      never-handled entry above. This assertion pins the two header checks as
      still present — they are load-bearing elsewhere, notably against a dev
      server on this origin — while the comment stops a future reviewer
      mistaking them for protection they do not provide here.
    */
    expect(swCode).toMatch(/cacheControl\.indexOf\('no-store'\)/);
    expect(swCode).toMatch(/cacheControl\.indexOf\('private'\)/);
    expect(swCode).toMatch(/vary\.indexOf\('cookie'\)/);

    // And the account boundary is NOT expressed as a header check anywhere.
    const neverHandledLine = swCode.match(/const NEVER_HANDLED_PREFIXES = \[[^\]]*\];/);
    expect(neverHandledLine).not.toBeNull();
    expect(neverHandledLine?.[0]).toContain("'/api/'");
  });
});

describe('D-ALPHA §7 — the offline page recovers on its own', () => {
  it('retries on a genuine online event', () => {
    expect(offlineScriptCode).toMatch(/addEventListener\('online',\s*retry\)/);
  });

  it('retries on return to the foreground, but only when connectivity allows', () => {
    /*
      Returning to the page is not itself evidence of connectivity, so this path
      is gated. navigator.onLine is consulted ONLY to decide whether a retry is
      worth attempting — never to tell the reader anything — and only `false` is
      treated as decisive, because `false` is the one value a browser reports
      reliably.
    */
    expect(offlineScriptCode).toContain("addEventListener('visibilitychange'");
    expect(offlineScriptCode).toMatch(/!document\.hidden/);
    expect(offlineScriptCode).toMatch(/navigator\.onLine === false/);
    expect(offlineScriptCode).not.toMatch(/navigator\.onLine === true/);
  });

  it('keeps the manual retry control', () => {
    // The button stays the primary route off this page; recovery only removes
    // the case where the reader has to notice it.
    expect(offlineMarkupNoScript).toContain('data-retry');
    expect(offlineScriptCode).toMatch(/\[data-retry\]/);
    expect(offlineScriptCode).toMatch(/addEventListener\('click',\s*retry\)/);
  });

  it('introduces no polling and no network request of its own', () => {
    /*
      Measured on the comment-stripped script: A-2's own documentation names
      every one of these APIs in prose while forbidding them.
    */
    for (const forbidden of [
      'setInterval',
      'setTimeout',
      'requestAnimationFrame',
      'fetch(',
      'XMLHttpRequest',
      'EventSource',
      'WebSocket',
    ]) {
      expect(offlineScriptCode).not.toContain(forbidden);
    }
  });
});

describe('D-ALPHA §8 — the cache version moved', () => {
  it('is not the version the previous release shipped', () => {
    /*
      Weak as tests go, and deliberately kept. sw.js was byte-identical from
      21 August through the Alpha baseline, so install/activate never re-ran and
      Cache Storage was never reset on an installed client. Both corrections in
      this package are invisible to such a client unless this string changes.
      The assertion converts that from something invisible into a decision
      somebody has to make on purpose.
    */
    const version = swCode.match(/const VERSION = '([^']+)';/);
    expect(version).not.toBeNull();
    expect(version?.[1]).not.toBe('gna-pwa-v1');
    expect(version?.[1]).toMatch(/^gna-pwa-v\d+$/);
  });

  it('derives both bucket names from that one constant', () => {
    // So a bump can never reset one bucket and leave the other behind.
    expect(swCode).toContain("const PRECACHE = VERSION + '-precache';");
    expect(swCode).toContain("const RUNTIME = VERSION + '-runtime';");
  });
});
