import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';

import {
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  parseHumanitarianRetainedRead,
  HUMANITARIAN_RETAINED_READ_KINDS,
  HUMANITARIAN_READ_MAX_ROWS,
  OBSERVATION_ABSENCE_STATES,
  ONLY_REASSURING_ABSENCE_STATE,
  ABSENCE_MUST_NOT_IMPLY,
} from '@globalnews-ai/shared';

import { humanitarianReadLabel, humanitarianReadExplanation } from '@/lib/humanitarian/humanitarianReadLabel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN PWA / RESILIENCE R1 — THE GUARD, NOT A CACHE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS FILE ADDS NO CACHING, AND IS THE DELIVERABLE ANYWAY.
 *
 * The order permits caching "safe public retained Humanitarian GET responses IF
 * compatible with the current PWA architecture". Measured, it is not compatible, and
 * there is nothing retained to cache. FIVE independent mechanisms already prevent a
 * Humanitarian response from reaching a cache, and this file asserts each one so that
 * today's safety stops being an accident:
 *
 *   1. THE READ IS SERVER-SIDE ONLY. `readHumanitarianObservations` returns an absence
 *      when `window` exists, so the browser never issues the request at all. There is no
 *      client-side Humanitarian fetch for a service worker to intercept.
 *   2. THE SERVER SAYS NO-STORE. The controller sets `Cache-Control: no-store`.
 *   3. `isCacheable` REFUSES no-store, `private`, and any non-`basic` response.
 *   4. THERE IS NO SAME-ORIGIN REWRITE for `/humanitarian`, so the request is
 *      cross-origin and the fetch handler returns before touching it.
 *   5. THE PAYLOAD CANNOT CARRY REPORTING. `HumanitarianRetainedRead.observations` is
 *      typed `readonly never[]`.
 *
 * E1's accepted security authority names the reason this matters:
 * **"D-6 ordering … today's safety is an artefact of nothing being built."** An artefact
 * is not a guarantee. These assertions convert it into one, so that the first engineer who
 * wires a real retained reader has to pass them rather than discover them.
 *
 * WHAT WOULD HAVE BEEN WRONG TO BUILD. Caching the Humanitarian read would mean overriding
 * an explicit server `no-store` from the client — the client deciding it knows better than
 * the backend's own read contract, which the order forbids in the same breath. And it would
 * cache an ABSENCE: replaying `NOT_ASSESSED` offline risks it being read as
 * `ASSESSED_NOTHING_QUALIFIED`, the one reassuring state, which `humanitarianReadAbsence`
 * throws rather than produce.
 */

const repoRoot = join(__dirname, '..', '..', '..', '..');
const frontendRoot = join(__dirname, '..', '..', '..');

const swSource = readFileSync(join(frontendRoot, 'public', 'sw.js'), 'utf-8');
const offlineSource = readFileSync(join(frontendRoot, 'public', 'offline.html'), 'utf-8');
const nextConfigSource = readFileSync(join(frontendRoot, 'next.config.mjs'), 'utf-8');
const readSource = readFileSync(join(frontendRoot, 'src', 'lib', 'humanitarian', 'humanitarianRead.ts'), 'utf-8');

const backendReadPath = join(repoRoot, 'backend', 'src', 'modules', 'humanitarian', 'humanitarian-read.module.ts');

/** Prose must never satisfy an assertion — the same treatment the neighbouring specs apply. */
function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const swCode = stripJsComments(swSource);

/* ══ A · THE ARCHITECTURE THAT MAKES CACHING UNREACHABLE ═══════════════════ */

describe('HUM-PWA-R1 · A · why a Humanitarian response cannot reach a cache', () => {
  it('A1 · the read is server-side only, so the browser never issues it', () => {
    expect(readSource).toContain("typeof window !== 'undefined'");
    expect(readSource).toMatch(/typeof window !== 'undefined'\)\s*return humanitarianReadAbsence\('NOT_ASSESSED'\)/);
    /* And it reads our backend only — never a provider URL. */
    expect(readSource).toContain('/humanitarian/observations');
    expect(readSource).not.toMatch(/https?:\/\/(?!localhost)/);
  });

  it('A2 · the server declares no-store on the read', () => {
    /* Asserted against the real controller. If the backend tree is absent the test fails
       rather than skipping: a guard that disappears with its subject is not a guard. */
    expect(existsSync(backendReadPath)).toBe(true);
    const controller = readFileSync(backendReadPath, 'utf-8');
    expect(controller).toMatch(/@Header\('Cache-Control',\s*'no-store'\)/);
    expect(controller).toMatch(/@Get\('observations'\)/);
  });

  it('A3 · isCacheable refuses no-store, private and non-basic responses', () => {
    expect(swCode).toMatch(/cacheControl\.indexOf\('no-store'\) !== -1\) return false/);
    expect(swCode).toMatch(/cacheControl\.indexOf\('private'\) !== -1\) return false/);
    expect(swCode).toMatch(/response\.type !== 'basic'\) return false/);
    expect(swCode).toMatch(/vary\.indexOf\('cookie'\) !== -1\) return false/);
  });

  it('A4 · no rewrite makes /humanitarian same-origin, so the worker leaves it alone', () => {
    const rewrites = nextConfigSource.slice(
      nextConfigSource.indexOf('async rewrites()'),
      nextConfigSource.indexOf('async headers()') > -1
        ? nextConfigSource.indexOf('async headers()')
        : nextConfigSource.length,
    );
    expect(rewrites.length).toBeGreaterThan(0);
    expect(rewrites).not.toContain('/humanitarian');
    /* Positive control: the families that ARE same-origin are named there, so the
       assertion above is reading the right span rather than an empty one. */
    expect(rewrites).toContain('/news/:path*');
    expect(rewrites).toContain('/geo/:path*');
    /* And cross-origin is returned before any handling. */
    expect(swCode).toMatch(/url\.origin !== self\.location\.origin\)\s*return/);
  });

  /*
    R2 CORRECTION. In R1 this assertion was titled "the read contract is structurally incapable of
    carrying reporting" and checked that `observations` was `readonly never[]`. **That is no longer
    true.** Main+A's convergence landed a three-kind union in which `RETAINED` carries
    `readonly HumanitarianRetainedRecord[]`, and the old text still matched because two of the three
    members retain `never[]` — so the assertion went on passing while its justification expired.

    A green test asserting something false is worse than a failing one, so the claim is restated to
    what is actually true, and the no-cache ruling is re-grounded on the ENDPOINT rather than on the
    type. The contract-level properties of the new union belong to A/Main and are covered by
    `shared/src/humanitarian/retained-read.convergence.spec.ts`; they are deliberately not restated
    here.
  */
  it('A5 · the contract CAN now carry retained records, so the ruling rests on the endpoint', () => {
    expect([...HUMANITARIAN_RETAINED_READ_KINDS]).toEqual([
      'UNAVAILABLE',
      'NO_RETAINED_EVIDENCE',
      'RETAINED',
    ]);

    /* An empty store is a fact about our store, not a finding — and not an absence. */
    expect(humanitarianRetainedRead([], () => true)).toEqual({
      kind: 'NO_RETAINED_EVIDENCE',
      observations: [],
    });

    /* THE RULING TRIGGER (re-grounded by convergence, CTO "close the final two gaps"). The endpoint
       now reads the ONE retained corpus, which answers an absence while E1 reader-clears no source
       — so nothing retained is servable today — and EVERY read route still forbids storing what it
       answers, so the no-cache ruling holds on A1–A4 alone once E1 does clear a source. */
    const controller = readFileSync(backendReadPath, 'utf-8');
    expect(controller).toMatch(/return this\.corpus\.readerRead\(\)/);
    expect(controller.match(/@Get\(/g)).toHaveLength(2);
    expect(controller.match(/@Header\('Cache-Control',\s*'no-store'\)/g)).toHaveLength(2);
    const corpus = readFileSync(join(dirname(backendReadPath), 'humanitarian-retained-corpus.ts'), 'utf-8');
    expect(corpus).toMatch(
      /if \(!anySourceReaderCleared\(\)\) return humanitarianReadAbsence\('NOT_ASSESSED'\)/,
    );
    const e1 = readFileSync(join(dirname(backendReadPath), 'reader-clearance.ruling.ts'), 'utf-8');
    expect(e1).toMatch(/READER_CLEARED_SOURCE_IDS: readonly string\[\] = Object\.freeze\(\[\]\)/);
  });
});

/* ══ B · THE SEVEN TESTS THE ORDER NAMES ══════════════════════════════════ */

describe('HUM-PWA-R1 · B · the seven required tests', () => {
  it('B1 · offline reopen — the document is network-only and falls back to a page that reports nothing', () => {
    const handler = swCode.slice(
      swCode.indexOf('async function documentNetworkOnly'),
      swCode.indexOf('self.addEventListener(\'install\''),
    );
    expect(handler).toContain('return await fetch(request)');
    expect(handler).toContain("cache.match('/offline.html')");
    /* No cache read of the document itself — offline must not replay a reporting page. */
    expect(handler).not.toContain('caches.match(request)');

    /* No HTML route is precached, so no Humanitarian page can be served from a bucket. */
    const precache = swCode.slice(swCode.indexOf('const PRECACHE_URLS'), swCode.indexOf('const CACHE_FIRST_PREFIXES'));
    expect(precache).toContain("'/offline.html'");
    expect(precache).not.toContain('/humanitarian');
    expect(precache).not.toMatch(/['"]\/['"]/);

    /* And the fallback page carries no retained reporting of its own. */
    expect(offlineSource).not.toMatch(/humanitarian/i);
    expect(offlineSource).not.toMatch(/observation/i);
  });

  it('B2 · stale retained — no allowlist can hold a Humanitarian response', () => {
    const allowlists = swCode.slice(
      swCode.indexOf('const PRECACHE_URLS'),
      swCode.indexOf('const NEVER_HANDLED_PREFIXES'),
    );
    expect(allowlists.length).toBeGreaterThan(0);
    for (const token of ['/humanitarian', '/api/', 'observations']) {
      expect(allowlists).not.toContain(token);
    }
    /* Positive control — the span really is the allowlists. */
    expect(allowlists).toContain('CACHE_FIRST_PREFIXES');
    expect(allowlists).toContain('STALE_WHILE_REVALIDATE_PREFIXES');
  });

  it('B3 · reconnect — nothing revalidates a Humanitarian read, because nothing stored one', () => {
    const swr = swCode.slice(swCode.indexOf('const STALE_WHILE_REVALIDATE_PREFIXES'));
    expect(swCode).toContain("const STALE_WHILE_REVALIDATE_PREFIXES = ['/images/'];");
    expect(swr).not.toContain('/humanitarian');
    /* RSC payloads are network-only with NO fallback, so a reconnecting client cannot be
       handed a stale payload inside a running application. */
    expect(swCode).toMatch(/request\.headers\.get\('RSC'\) === '1'/);
    expect(swCode).toMatch(/url\.pathname\.indexOf\('\/_next\/data\/'\) === 0\) return/);
  });

  it('B4 · cache version upgrade — buckets derive from the generation and others are deleted', () => {
    expect(swCode).toMatch(/const VERSION = '[a-z0-9-]+'/);
    expect(swCode).toContain("const PRECACHE = VERSION + '-precache';");
    expect(swCode).toContain("const RUNTIME = VERSION + '-runtime';");
    expect(swCode).toMatch(/names\.filter\(\(name\) => name !== PRECACHE && name !== RUNTIME\)\.map\(\(name\) => caches\.delete\(name\)\)/);
    /* Bounded and deterministically evicted — FIFO over cache.keys() insertion order. */
    expect(swCode).toMatch(/const RUNTIME_MAX_ENTRIES = \d+;/);
    expect(swCode).toMatch(/keys\.length - RUNTIME_MAX_ENTRIES/);
    /* No Humanitarian bucket exists to upgrade. */
    expect(swCode).not.toMatch(/humanitarian/i);
  });

  it('B5 · no Ask POST caching — a non-GET is structurally unreachable', () => {
    expect(swCode).toMatch(/request\.method !== 'GET'\)\s*return/);
    const denylist = swCode.slice(
      swCode.indexOf('const NEVER_HANDLED_PREFIXES'),
      swCode.indexOf('const PRECACHE_PATHS'),
    );
    expect(denylist).toContain("'/api/'");
    /* Ask V2 lives under /api/, so the denylist covers it by construction. */
    expect(nextConfigSource).toContain("source: '/api/ask-v2/:path*'");
    expect(nextConfigSource).toContain("source: '/api/analysis/:path*'");
  });

  it('B6 · no admin or auth caching', () => {
    const denylist = swCode.slice(
      swCode.indexOf('const NEVER_HANDLED_PREFIXES'),
      swCode.indexOf('const PRECACHE_PATHS'),
    );
    expect(denylist).toContain("'/api/'");
    /* Both families are under /api/, so one denylist entry covers them. Asserted here so a
       future rewrite that moved them OUT of /api/ fails this test. */
    expect(nextConfigSource).toContain("source: '/api/admin/:path*'");
    expect(nextConfigSource).toContain("source: '/api/auth/:path*'");
    expect(nextConfigSource).toContain("source: '/api/users/:path*'");
    /* Belt and braces: a credentialed response is refused even if it reached isCacheable. */
    expect(swCode).toMatch(/vary\.indexOf\('cookie'\)/);
    expect(swCode).toMatch(/cacheControl\.indexOf\('private'\)/);
  });

  it('B7 · no stale-as-current label — the reassuring state is unreachable without evidence', () => {
    /* Behavioural. The one state a reader could act on as reassurance cannot be produced
       by the Humanitarian absence helper at all. */
    expect(ONLY_REASSURING_ABSENCE_STATE).toBe('ASSESSED_NOTHING_QUALIFIED');
    expect(() =>
      humanitarianReadAbsence('ASSESSED_NOTHING_QUALIFIED' as never),
    ).toThrow();

    /* A fabricated "success" payload is refused by the parser, so a cached or replayed
       body cannot smuggle observations past the admission gate. */
    expect(parseHumanitarianRetainedRead({
      kind: 'OK', absence: 'NOT_ASSESSED', observations: [{ id: 'x' }],
    })).toBeNull();
    expect(parseHumanitarianRetainedRead({
      kind: 'UNAVAILABLE', absence: 'NOT_ASSESSED', observations: [{ id: 'x' }],
    })).toBeNull();
    expect(parseHumanitarianRetainedRead({
      kind: 'UNAVAILABLE', absence: 'ASSESSED_NOTHING_QUALIFIED', observations: [],
    })).toBeNull();

    /* An offline/failed read degrades to a weaker claim, never to reassurance. */
    const offlineRead = humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
    expect(offlineRead.kind).toBe('UNAVAILABLE');
    expect(offlineRead.observations).toEqual([]);
    expect(offlineRead.absence).not.toBe('ASSESSED_NOTHING_QUALIFIED');

    /* And no reader label implies normality. */
    for (const locale of ['en', 'pl'] as const) {
      for (const state of ['NOT_ASSESSED', 'COVERAGE_GAP'] as const) {
        const read = humanitarianReadAbsence(state === 'NOT_ASSESSED' ? 'NOT_ASSESSED' : 'COVERAGE_GAP');
        const text = `${humanitarianReadLabel(read, locale)} ${humanitarianReadExplanation(read, locale)}`.toLowerCase();
        for (const forbidden of ABSENCE_MUST_NOT_IMPLY) {
          expect(text).not.toContain(forbidden);
        }
        expect(text).not.toContain('verified');
        expect(text).not.toContain('current as of');
      }
    }
  });
});

/* ══ C · MONOTONIC DEGRADATION — THE RULE AN OFFLINE READ MUST OBEY ═══════ */

describe('HUM-PWA-R1 · C · a degradation may only claim less', () => {
  it('C1 · the absence vocabulary is ordered weakest-claim-first, reassurance last', () => {
    expect(OBSERVATION_ABSENCE_STATES[0]).toBe('NOT_ASSESSED');
    expect(OBSERVATION_ABSENCE_STATES[OBSERVATION_ABSENCE_STATES.length - 1]).toBe(
      ONLY_REASSURING_ABSENCE_STATE,
    );
    /* An offline read is a degradation, so its state must sit at or before the online one
       in this list. SOURCE_TEMPORARILY_UNAVAILABLE must therefore precede the reassuring
       member — the property that makes "offline claims less" checkable rather than stylistic. */
    expect(OBSERVATION_ABSENCE_STATES.indexOf('SOURCE_TEMPORARILY_UNAVAILABLE')).toBeLessThan(
      OBSERVATION_ABSENCE_STATES.indexOf(ONLY_REASSURING_ABSENCE_STATE),
    );
    expect(OBSERVATION_ABSENCE_STATES.indexOf('NOT_ASSESSED')).toBeLessThan(
      OBSERVATION_ABSENCE_STATES.indexOf('COVERAGE_GAP'),
    );
  });

  it('C2 · silence must not imply normality, and the list is carried as data', () => {
    expect(ABSENCE_MUST_NOT_IMPLY).toEqual(
      expect.arrayContaining(['normal', 'safe', 'stable', 'no outage', 'no event']),
    );
  });
});

/* ══ D · R2 · WHAT ANY FUTURE CACHE MUST OBEY ═════════════════════════════ */

describe('HUM-PWA-R2 · D · cache-side obligations created by the new contract', () => {
  /*
    These are the obligations the convergence contract places on a CACHE specifically. The contract's
    own properties are A/Main's and are tested in their convergence spec; what is asserted here is
    that this lane has introduced no mechanism that could violate them, and that the primitives a
    future policy must use exist.
  */

  it('D1 · no row-level Humanitarian store exists, so a read cannot be thinned by a cache', () => {
    /*
      HUM-READ-5 refuses a WHOLE read rather than dropping a non-admissible row — "a read is never
      silently thinned". A cache that stored or evicted individual rows would re-introduce exactly
      the thinning the contract forbids, and an offline gap shaped like the protected set is the
      disclosure E1 named. The worker's eviction operates on whole cache entries, never on rows.
    */
    expect(swCode).not.toMatch(/humanitarian/i);
    expect(swCode).toMatch(/keys\.length - RUNTIME_MAX_ENTRIES/);
    /* FIFO over cache.keys() — whole responses, in insertion order. No per-row structure exists. */
    expect(swCode).toMatch(/const RUNTIME_MAX_ENTRIES = \d+;/);
  });

  it('D2 · a stored payload would be untrusted input, and the fail-closed parser exists for it', () => {
    /*
      The contract re-validates a RETAINED payload because it crossed a network boundary. Device
      storage is also a boundary — and a weaker one. Any future cache must re-parse on read-back and
      must never trust stored bytes. Asserted here: the gate exists and fails closed.
    */
    expect(parseHumanitarianRetainedRead({ kind: 'RETAINED', observations: [] })).toBeNull();
    expect(parseHumanitarianRetainedRead({ kind: 'RETAINED' })).toBeNull();
    expect(parseHumanitarianRetainedRead({ kind: 'NO_RETAINED_EVIDENCE', observations: [{}] })).toBeNull();
    expect(parseHumanitarianRetainedRead({ kind: 'SOMETHING_NEW', observations: [] })).toBeNull();
  });

  it('D3 · the payload row bound exists and is the input to any storage bound', () => {
    expect(HUMANITARIAN_READ_MAX_ROWS).toBe(200);
    expect(typeof HUMANITARIAN_READ_MAX_ROWS).toBe('number');
  });

  it('D4 · neither NO_RETAINED_EVIDENCE nor RETAINED can be reached by a cached absence', () => {
    /*
      The dangerous offline replay is not a stale record — it is a stale EMPTINESS.
      `NO_RETAINED_EVIDENCE` reads like a definitive "nothing is happening" answer, which is exactly
      what the contract's own comment forbids. An absence read can never be promoted into it.
    */
    const absence = humanitarianReadAbsence('NOT_ASSESSED');
    expect(absence.kind).toBe('UNAVAILABLE');
    expect(absence.kind).not.toBe('NO_RETAINED_EVIDENCE');
    expect(absence.kind).not.toBe('RETAINED');
    /* And the reassuring absence state remains unreachable from the Humanitarian helper. */
    expect(() => humanitarianReadAbsence('ASSESSED_NOTHING_QUALIFIED' as never)).toThrow();
  });
});
