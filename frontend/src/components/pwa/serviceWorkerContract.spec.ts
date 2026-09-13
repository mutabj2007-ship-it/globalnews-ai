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
  it('never names a news, analysis or account path in executable code', () => {
    // The origin check already excludes these, because the API is on another
    // origin. This asserts the second, independent guarantee: the allowlist
    // does not name them either, so widening the origin rule alone could not
    // start caching them.
    for (const path of ['/analysis', '/news/', '/users/', '/auth/', 'top-headlines']) {
      expect(swCode).not.toContain(path);
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
    expect(offlineSource).toMatch(/ACTIVE = \['en', 'pl'\]/);
    expect(offlineSource).toMatch(/return value && ACTIVE\.indexOf\(value\) !== -1 \? value : 'en'/);
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
