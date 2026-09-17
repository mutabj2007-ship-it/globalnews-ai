import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { CURRENT_EXPECTED_PWA_GENERATION } from './pwaGenerationTestAuthority';

/**
 * D7 — THE SUPPORT OFFLINE SENTENCE, AND THE GENERATION THAT DELIVERS IT.
 *
 * Two files carry this change and neither is optional.
 *
 *   frontend/public/offline.html   the approved sentence, once per locale block
 *   frontend/public/sw.js          gna-pwa-v5 -> gna-pwa-v6
 *
 * WHY THE VERSION IS PART OF A COPY CHANGE. /offline.html is PRECACHE_URLS[0].
 * An installed client holds it inside `gna-pwa-v5-precache`, install() populates
 * a generation exactly once, and documentNetworkOnly() serves the copy out of
 * that bucket. If VERSION does not move, the browser byte-compares /sw.js, finds
 * it unchanged, runs no update, and every already-installed reader keeps the OLD
 * sentence forever — while offline.html on the origin, and therefore the PA
 * fingerprint, has moved. The change would look shipped and would not be. That
 * is D-PWA-PA-1, and S3 is the assertion that makes forgetting it fail loudly.
 *
 * HOW THE COPY IS PINNED. Not by substring. Each sentence is compared by SHA-256
 * over its whitespace-normalised text, against the hash of the bytes Claude L and
 * Claude F approved. A substring assertion passes on an em dash silently replaced
 * by a hyphen, and on a Polish diacritic lost to an editor's encoding; a hash does
 * not. The hashes below are the contract, and mutation M9 exists to prove they
 * bite.
 *
 * HOW THE BLOCKS ARE READ. With a depth-aware tag scanner, never a regex. A regex
 * for `<div data-language="en"...>` stops at the first `>` it meets, which inside
 * this document is not necessarily the end of the tag — that exact instrument
 * defect produced a false accusation in a sibling lane this month, and there is no
 * reason to repeat it here.
 *
 * ABSENCE IS MEASURED AGAINST MARKUP, NEVER AGAINST DOCUMENTATION. offline.html
 * is one of the two most heavily commented files in this repository and its prose
 * necessarily names the things it forbids. Every absence assertion below runs on
 * comment-stripped, script-stripped markup, for the same reason the accepted
 * serviceWorkerContract suite does.
 */

const publicDir = join(__dirname, '..', '..', '..', 'public');
const offlinePath = join(publicDir, 'offline.html');
const swPath = join(publicDir, 'sw.js');

const offlineSource = readFileSync(offlinePath, 'utf-8');
const swSource = readFileSync(swPath, 'utf-8');

function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, ' ');
}
function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

const offlineMarkup = stripHtmlComments(offlineSource);
const offlineMarkupNoScript = offlineMarkup.replace(/<script[\s\S]*?<\/script>/g, ' ');
const swCode = stripJsComments(swSource);

/** Collapse every whitespace run to one space and trim — the form the hashes are over. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The approved D7 copy, by hash.
 *   EN  Claude F, verified by Claude L, 138 chars / 140 UTF-8 bytes
 *   PL  Claude L,                        144 chars / 153 UTF-8 bytes
 * Source: L-SUPPORT-SEVEN-LOCALE-COPY-AUTHORITY-1, row D7.offline.supportSentence,
 * status IMPLEMENTATION AUTHORITY. fr/de/es/pt/ar are STAGED and deliberately
 * absent — see the language inventory test at the end.
 */
const APPROVED_SUPPORT_SENTENCE: Record<string, string> = {
  en: '5ecd4aa0a9c7b14cd3746df605cf087f7b6e8c262646fa37c9104a52ce2c7134',
  pl: '501d442d5b37059e44c641f08cdb1b344c19d61073212dc48f6f65ef23b980d5',
};

/**
 * Enumerated literally, so a mutation cannot empty the expectation along with
 * the source.
 *
 * B5-B — FIVE ON THIS LINEAGE, NOT THREE. C55's worker named three because
 * C55's next.config.mjs rewrote only /api/*. The sealed candidate additionally
 * rewrites /news/:path* and /geo/:path*, two same-origin families C55 never
 * had, so Δ4 was RE-DERIVED against this tree's own rewrite set rather than
 * copied. Copying would have left this lineage's two newest families protected
 * by default-deny alone — exactly the condition naming /api/ was meant to end.
 */
const EXPECTED_NEVER_HANDLED = ['/_next/image', '/sw.js', '/api/', '/news/', '/geo/'];
const EXPECTED_PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
];
const EXPECTED_CACHE_FIRST = ['/_next/static/'];
const EXPECTED_SWR = ['/images/'];

const PROVENANCE_LABELS = [
  'LIVE · Powered by GNews',
  'CACHED · Previously retrieved reporting',
  'DEMO MODE · Sample content only',
  'NO REPORTING AVAILABLE',
  'DATA STATUS UNKNOWN',
];

/** Depth-aware: walks tags, so an attribute containing '>' cannot end the element early. */
function readLocaleBlock(markup: string, locale: string): string | null {
  const open = new RegExp(`<div[^>]*data-language="${locale}"`);
  const start = markup.search(open);
  if (start === -1) return null;
  let index = start;
  let depth = 0;
  const tag = /<\/?div\b/g;
  tag.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(markup)) !== null) {
    depth += match[0] === '</div' ? -1 : 1;
    if (depth === 0) {
      index = match.index + '</div>'.length;
      return markup.slice(start, index);
    }
  }
  return null;
}

/** The text of the dedicated Support note inside one block, or null if there is none. */
function supportNoteText(block: string): string | null {
  const m = block.match(/<p[^>]*data-support-note[^>]*>([\s\S]*?)<\/p>/);
  return m ? normalise(m[1]) : null;
}

/** Every `const NAME = [ ... ];` array in the worker, as normalised source text. */
function arrayLiteral(name: string): string | null {
  const m = swCode.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  return m ? normalise(m[1]) : null;
}
function arrayMembers(name: string): string[] {
  const raw = arrayLiteral(name);
  if (raw === null) return [];
  return (raw.match(/'([^']*)'/g) ?? []).map((s) => s.slice(1, -1));
}

const EN_BLOCK = readLocaleBlock(offlineMarkupNoScript, 'en');
const PL_BLOCK = readLocaleBlock(offlineMarkupNoScript, 'pl');

/* ────────────────────────────────────────────────────────────────────────────
   GROUP A — the patch. These MUST fail against the untouched C51 preimage.
   ──────────────────────────────────────────────────────────────────────────── */

describe('D7 GROUP A — the approved Support sentence reaches both locale blocks', () => {
  it('S1 · the en block carries the approved EN sentence, by hash, in its own element', () => {
    expect(EN_BLOCK).not.toBeNull();
    const text = supportNoteText(EN_BLOCK as string);
    expect(text).not.toBeNull();
    expect(sha256(text as string)).toBe(APPROVED_SUPPORT_SENTENCE.en);
  });

  it('S2 · the pl block carries the approved PL sentence, by hash, in its own element', () => {
    /*
      Asserted per block, never over the whole file. A whole-file `includes`
      passes with the pl block empty, which is precisely the defect F's
      acceptance contract names.
    */
    expect(PL_BLOCK).not.toBeNull();
    const text = supportNoteText(PL_BLOCK as string);
    expect(text).not.toBeNull();
    expect(sha256(text as string)).toBe(APPROVED_SUPPORT_SENTENCE.pl);
  });
});

describe('D7 PATCH CONSEQUENCE — the generation that delivers the new page', () => {
  it('S3 · VERSION is the expected generation, and both buckets still derive from it', () => {
    /*
      NOT a preservation guard. This is the consequence of the patch: it fails
      on the preimage by design, because the preimage is v5 and correct at v5.
      It is classified as a consequence in the spec and reported as one.
    */
    const version = (swCode.match(/const VERSION = '([^']+)';/) as RegExpMatchArray)[1];
    expect(version).toBe(CURRENT_EXPECTED_PWA_GENERATION);
    expect(swCode).toContain("const PRECACHE = VERSION + '-precache';");
    expect(swCode).toContain("const RUNTIME = VERSION + '-runtime';");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   GROUP B — preservation. These MUST pass before AND after.
   ──────────────────────────────────────────────────────────────────────────── */

describe('D7 GROUP B — the offline page keeps its language integrity', () => {
  it('S4 · no English Support sentence leaks into the pl block', () => {
    /*
      The failure this catches is not "a typo". Putting English prose in the pl
      block is exactly the defect MAIN-LANG-MEASURE-1 removed: a document whose
      lang attribute stops describing what it renders. Checked positively —
      whatever the pl block's Support note says, it is NOT the English one.
    */
    expect(PL_BLOCK).not.toBeNull();
    const text = supportNoteText(PL_BLOCK as string);
    if (text !== null) {
      expect(sha256(text)).not.toBe(APPROVED_SUPPORT_SENTENCE.en);
      expect(text).not.toContain('Support requests need a connection');
    }
    expect(PL_BLOCK as string).not.toContain('Try again');
  });

  it('S5 · NEVER_HANDLED_PREFIXES is exactly the five accepted entries', () => {
    expect(arrayMembers('NEVER_HANDLED_PREFIXES')).toEqual(EXPECTED_NEVER_HANDLED);

    /* /api/ — excluded because it is AUTHENTICATED. */
    expect(arrayMembers('NEVER_HANDLED_PREFIXES')).toContain('/api/');

    /*
      /news/ and /geo/ — excluded for a DIFFERENT reason, and the distinction
      matters because it is the one a later reader is most likely to collapse.
      Neither carries a session, so the authentication argument does not apply.
      They are excluded because THEY ARE REPORTING: caching either stores
      reporting and lets it be replayed as current, which is the same rule that
      keeps every HTML document out of the precache.
    */
    expect(arrayMembers('NEVER_HANDLED_PREFIXES')).toContain('/news/');
    expect(arrayMembers('NEVER_HANDLED_PREFIXES')).toContain('/geo/');
  });

  it('S6 · the never-handled check runs BEFORE the navigate branch and before every allowlist', () => {
    /*
      Membership is not enough. If this check moved below the navigate branch,
      /api/ would still be "in the list" and an authenticated navigation would
      already have been handled by the time it was consulted. Ordering is the
      property that makes account data structurally unreachable.
    */
    const listener = swCode.slice(swCode.indexOf("self.addEventListener('fetch'"));
    const never = listener.indexOf('NEVER_HANDLED_PREFIXES');
    const navigate = listener.indexOf("request.mode === 'navigate'");
    const precache = listener.indexOf('PRECACHE_PATHS.has');
    const cacheFirst = listener.indexOf('CACHE_FIRST_PREFIXES');
    const swr = listener.indexOf('STALE_WHILE_REVALIDATE_PREFIXES');
    for (const later of [navigate, precache, cacheFirst, swr]) {
      expect(later).toBeGreaterThan(-1);
      expect(never).toBeLessThan(later);
    }
  });

  it('S7 · all four allowlists are unchanged — no widening, no tiles', () => {
    expect(arrayMembers('PRECACHE_URLS')).toEqual(EXPECTED_PRECACHE_URLS);
    expect(arrayMembers('CACHE_FIRST_PREFIXES')).toEqual(EXPECTED_CACHE_FIRST);
    expect(arrayMembers('STALE_WHILE_REVALIDATE_PREFIXES')).toEqual(EXPECTED_SWR);
    expect(arrayLiteral('CACHE_FIRST_PREFIXES')).not.toContain('tile');
    expect(arrayLiteral('STALE_WHILE_REVALIDATE_PREFIXES')).not.toContain('tile');
    expect(swCode).not.toContain('/tiles/');
  });

  it('S8 · the caching decision is a function of the path alone — no response, no record, no class', () => {
    /*
      This is the guard whose absence is invisible. Every other failure here
      leaves a cache entry somebody can find; this one looks like a thoughtful
      optimisation. A worker that cached ordinary records and skipped protected
      ones would write a per-record protection map onto the reader's disk — the
      presence-and-absence pattern IS the disclosure, with no coordinate read.
      So: no response object may be consulted while ROUTING, and isCacheable —
      which does read a response — may be called only from the two write paths.
    */
    const listenerStart = swCode.indexOf("self.addEventListener('fetch'");
    const listener = swCode.slice(listenerStart);
    const body = listener.slice(0, listener.indexOf('\n});') + 1);
    expect(body).not.toContain('response');
    expect(body).not.toContain('isCacheable');
    /*
      isCacheable is the ONLY place a response is inspected, and it is reached
      only from the two cache-write paths — never from routing. One definition,
      exactly two call sites, both guarding a cache.put.
    */
    expect(swCode.match(/function isCacheable\(/g) ?? []).toHaveLength(1);
    expect(swCode.match(/if \(isCacheable\(response\)\)/g) ?? []).toHaveLength(2);
    for (const word of ['reveal', 'unmask', 'showLocation', 'protected', 'sensitive']) {
      expect(body.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('S9 · the offline page still shows no reporting and claims no data state', () => {
    expect(offlineMarkupNoScript).not.toContain('<article');
    expect(offlineMarkupNoScript).not.toContain('<img');
    expect(offlineMarkupNoScript).not.toMatch(/<h[23]/);
    for (const label of PROVENANCE_LABELS) {
      expect(offlineMarkupNoScript).not.toContain(label);
    }
  });

  it('S10 · the offline page still fetches nothing and links nowhere', () => {
    /*
      Also the reason the CONDITIONAL Support knowledge entry was not added:
      F's condition was "only if the offline page points at it", and this
      assertion is why the page cannot. A reader who cannot reach Support
      cannot follow a link to a Support answer either.
    */
    expect(offlineMarkupNoScript).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(offlineMarkupNoScript).not.toContain('<link');
    expect(offlineMarkupNoScript).not.toContain('src=');
    expect(offlineMarkupNoScript).not.toContain('<a ');
  });

  it('S11 · the existing pinned prose is untouched in both locales', () => {
    expect(offlineMarkupNoScript).toContain('connectivity problem on this device');
    expect(offlineMarkupNoScript).toContain('not a statement about world events');
    expect(offlineMarkupNoScript).toContain('problem z połączeniem na tym urządzeniu');
    expect(offlineMarkupNoScript).toContain('does not store news for offline reading');
    expect(offlineMarkupNoScript).toContain('nie przechowuje wiadomości do czytania');
  });

  it('S12 · the fallback locale is still DECLARED by attribute, exactly once', () => {
    /*
      Counted on the MARKUP only. The inline script also names the attribute, in
      its selector and in the assertion around it, so a whole-file count measures
      the documentation of the rule rather than the rule.
    */
    expect(offlineMarkupNoScript.match(/data-offline-fallback/g) ?? []).toHaveLength(1);
    expect(offlineMarkupNoScript).toMatch(/data-language="en" data-offline-fallback/);
    /* and the script still reads the attribute rather than an index */
    expect(offlineSource).toContain('[data-offline-fallback][data-language]');
  });

  it('S13 · the seven-locale NOTICE catalogue is untouched by this change', () => {
    /*
      The page ships two locales; the notice ships seven. D7 changes the page
      and must leave the notice exactly where it was — that separation is the
      whole reason fr/de/es/pt/ar keep a notice they can read while the page
      stays English.
    */
    const catalogue = (offlineSource.match(/var NOTICE_CATALOGUE = \{[\s\S]*?\n {8}\};/) as RegExpMatchArray)[0];
    const locales = (catalogue.match(/^\s{10}([a-z]{2}):/gm) ?? []).map((s) => s.trim().replace(':', ''));
    expect(locales.sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'pl', 'pt']);
    expect(sha256(normalise(catalogue))).toBe(
      'aff9ccc28311127ed07c9664fb7bf9f1da4bb6952aa0b1dd87c4c9f5c68b70b5',
    );
  });

  it('S14 · /offline.html is still precached first, and is the only cache read in the document path', () => {
    expect(arrayMembers('PRECACHE_URLS')[0]).toBe('/offline.html');
    const doc = swCode.slice(swCode.indexOf('async function documentNetworkOnly'));
    const body = doc.slice(0, doc.indexOf('\n}') + 1);
    expect(body).toContain("cache.match('/offline.html')");
    expect(body.match(/cache\.match\(/g) ?? []).toHaveLength(1);
    expect(body).not.toContain('cache.put');
  });

  it('S15 · POSITIVE CONTROL — the block scanner finds real blocks, so S1/S2 cannot pass vacuously', () => {
    /*
      A sweep that finds nothing proves nothing. If the scanner silently
      returned null for both blocks, S1 and S2 would be asserting about
      emptiness. This locates both blocks by their EXISTING prose, which is
      true before and after the patch.
    */
    expect(EN_BLOCK).not.toBeNull();
    expect(PL_BLOCK).not.toBeNull();
    expect(EN_BLOCK as string).toContain('You are offline');
    expect(PL_BLOCK as string).toContain('Jesteś offline');
    expect(EN_BLOCK as string).toContain('data-retry');
    expect(PL_BLOCK as string).toContain('data-retry');
    /* and the two blocks are distinct regions, not one over-long match */
    expect((EN_BLOCK as string).length).toBeLessThan(offlineMarkupNoScript.length / 2);
    expect(EN_BLOCK as string).not.toContain('Jesteś offline');
  });

  it('S16 · language inventory — the page ships exactly en and pl, and no staged locale leaked in', () => {
    const blocks = Array.from(
      offlineMarkupNoScript.matchAll(/data-language="([a-z-]+)"/g),
      (m) => m[1],
    ).sort();
    expect(blocks).toEqual(['en', 'pl']);
    for (const staged of ['Support-Anfragen', 'demandes d', 'solicitudes de soporte', 'pedidos de suporte']) {
      expect(offlineMarkupNoScript).not.toContain(staged);
    }
  });
});
