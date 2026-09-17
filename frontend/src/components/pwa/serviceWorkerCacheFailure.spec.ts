import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

import { CURRENT_EXPECTED_PWA_GENERATION } from './pwaGenerationTestAuthority';

/**
 * D-BETA-1 / D-BETA-2 — CACHE-WRITE FAILURE MUST NOT DESTROY A GOOD RESPONSE.
 *
 * D-PWA-BETA-RESILIENCE-1 proved two defects by execution:
 *
 *   D-BETA-1  cacheFirst awaits `cache.put` inside the promise handed to
 *             respondWith with no try/catch, so a QuotaExceededError rejects a
 *             response the network had already returned. On that arm the request
 *             is a /_next/static/ chunk — a failed script, i.e. a broken page.
 *   D-BETA-2  staleWhileRevalidate's `.catch(() => undefined)` swallows that same
 *             quota error, the network branch resolves to undefined, and the
 *             function then throws Error('offline and not cached') — a FALSE
 *             DIAGNOSIS, while the device is online and the network answered.
 *
 * WHY THIS FILE EXECUTES THE WORKER INSTEAD OF READING IT. Neither defect is
 * visible in the source. A static assertion would pin a string and prove
 * nothing — the failure mode LANG-OFFLINE-PWA-1 had to correct, where a spec
 * asserted the defective line and made it load-bearing. So sw.js is run
 * VERBATIM here, and what is asserted is what a caller receives.
 *
 * WHAT IS SUPPLIED. Only the browser's side: a Cache Storage with an ENFORCED
 * byte quota that throws a real QuotaExceededError, a fetch that can be failed
 * globally or per-URL, and the lifecycle dispatcher. Nothing in sw.js is stubbed.
 */

const publicDir = join(__dirname, '..', '..', '..', 'public');
const swSource = readFileSync(join(publicDir, 'sw.js'), 'utf-8');
const offlineSource = readFileSync(join(publicDir, 'offline.html'), 'utf-8');

const ORIGIN = 'https://app.globalnews.example';

class QuotaExceededError extends Error {
  constructor() {
    super('Quota exceeded.');
    this.name = 'QuotaExceededError';
  }
}

interface Rec { body: Buffer; status: number; headers: Record<string, string> }

interface Harness {
  dispatch(type: string, event?: Record<string, unknown>): Promise<{
    response?: Response; error?: unknown; lifecycleRejected: string[];
  }>;
  buckets(): Promise<string[]>;
  entryCount(): number;
  matchAll(url: string): Promise<Response | undefined>;
  setQuota(bytes: number): void;
  setNetwork(up: boolean): void;
  failUrl(path: string): void;
  storedBytes(): number;
  /** Boot a DIFFERENT worker source against the SAME Cache Storage, as a real
   *  upgrade does: the store is origin-scoped and outlives a worker generation. */
  reboot(source: string): Harness;
}

/** Build a browser environment around the given worker source. */
function harness(
  source: string,
  opts: { bodies?: Record<string, string>; store?: Map<string, Map<string, Rec>> } = {},
): Harness {
  const store = opts.store ?? new Map<string, Map<string, Rec>>();
  let quota = Number.POSITIVE_INFINITY;
  let stored = 0;
  let networkUp = true;
  const failing = new Set<string>();
  const bodies: Record<string, string> = {
    '/offline.html': offlineSource,
    '/manifest.webmanifest': '{}',
    '/icons/icon-192.png': 'png',
    '/icons/icon-512.png': 'png',
    '/icons/icon-192-maskable.png': 'png',
    '/icons/icon-512-maskable.png': 'png',
    ...(opts.bodies ?? {}),
  };

  const keyOf = (r: unknown): string => {
    const u = typeof r === 'string' ? r : (r as { url: string }).url;
    return new URL(u, ORIGIN).href;
  };
  const mk = (rec: Rec): Response => {
    const res = new Response(new Uint8Array(rec.body), { status: rec.status, headers: rec.headers });
    Object.defineProperty(res, 'type', { value: 'basic' });
    return res;
  };

  function cacheFor(name: string) {
    const m = store.get(name) as Map<string, Rec>;
    const self_ = {
      async put(request: unknown, response: Response) {
        const buf = Buffer.from(await response.arrayBuffer());
        if (stored + buf.length > quota) throw new QuotaExceededError();
        const k = keyOf(request);
        if (m.has(k)) stored -= (m.get(k) as Rec).body.length;
        m.set(k, { body: buf, status: response.status,
          headers: Object.fromEntries(response.headers.entries()) });
        stored += buf.length;
      },
      async match(request: unknown) { const r = m.get(keyOf(request)); return r ? mk(r) : undefined; },
      async addAll(urls: string[]) {
        for (const u of urls) {
          const resp = await sandboxFetch(new URL(u, ORIGIN).href);
          if (!resp.ok) throw new Error(`addAll failed for ${u}`);
          await self_.put(new URL(u, ORIGIN).href, resp);
        }
      },
    };
    return self_;
  }

  const caches = {
    async open(name: string) { if (!store.has(name)) store.set(name, new Map()); return cacheFor(name); },
    async keys() { return [...store.keys()]; },
    async delete(name: string) {
      const m = store.get(name);
      if (m) for (const v of m.values()) stored -= v.body.length;
      return store.delete(name);
    },
    async match(request: unknown) {
      for (const n of store.keys()) {
        const r = (store.get(n) as Map<string, Rec>).get(keyOf(request));
        if (r) return mk(r);
      }
      return undefined;
    },
  };

  async function sandboxFetch(input: unknown): Promise<Response> {
    const url = typeof input === 'string' ? input : (input as { url: string }).url;
    const path = new URL(url).pathname;
    if (!networkUp || failing.has(path)) throw new TypeError('Failed to fetch');
    const body = bodies[path] ?? 'x'.repeat(4096);
    const res = new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    Object.defineProperty(res, 'type', { value: 'basic' });
    return res;
  }

  const listeners: Record<string, Array<(e: unknown) => unknown>> = {};
  const selfObj = {
    addEventListener: (t: string, fn: (e: unknown) => unknown) => { (listeners[t] ||= []).push(fn); },
    location: { origin: ORIGIN },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  runInContext(source, createContext({
    self: selfObj, caches, fetch: sandboxFetch,
    Response, Request, Headers, URL, console, Promise, Set, Map, Error, TypeError,
  }), { filename: 'sw.js' });

  return {
    async dispatch(type, event = {}) {
      const waits: Array<Promise<unknown>> = [];
      const e: Record<string, unknown> = { ...event,
        waitUntil: (p: Promise<unknown>) => { waits.push(p); },
        respondWith(p: Promise<Response>) { (this as Record<string, unknown>)._r = p; } };
      for (const fn of (listeners[type] ?? [])) await fn(e);
      const settled = await Promise.allSettled(waits);
      let response: Response | undefined;
      let error: unknown;
      if (e._r) { try { response = await (e._r as Promise<Response>); } catch (err) { error = err; } }
      return {
        response, error,
        lifecycleRejected: settled.filter(s => s.status === 'rejected')
          .map(s => String(((s as PromiseRejectedResult).reason as Error)?.name ?? 'rejected')),
      };
    },
    async buckets() { return [...store.keys()].sort(); },
    entryCount() { return [...store.values()].reduce((a, m) => a + m.size, 0); },
    async matchAll(url: string) { return caches.match(url); },
    setQuota(b: number) { quota = b; },
    setNetwork(up: boolean) { networkUp = up; },
    failUrl(p: string) { failing.add(p); },
    storedBytes() { return stored; },
    reboot(nextSource: string) { return harness(nextSource, { bodies: opts.bodies, store }); },
  };
}

const CHUNK = '/_next/static/chunks/route-9f8e7d.js';
const IMAGE = '/images/trending-ai-chip.jpg';
const request = (url: string, mode = 'no-cors') =>
  ({ method: 'GET', mode, url: `${ORIGIN}${url}`, headers: new Headers() });
const navigation = () =>
  ({ method: 'GET', mode: 'navigate', url: `${ORIGIN}/`, headers: new Headers({ accept: 'text/html' }) });

/** An installed, activated worker with the shell precached. */
async function installed(source = swSource, bodies?: Record<string, string>) {
  const h = harness(source, { bodies });
  await h.dispatch('install');
  await h.dispatch('activate');
  return h;
}

/* ================================================================== *
 * GROUP A — THE TWO DEFECTS. These MUST fail against the pre-patch    *
 * bytes; a Group A test that passes before implementation is a broken *
 * test, not a head start.                                             *
 * ================================================================== */
describe('GROUP A · D-BETA-1 — a cache write failure must not destroy a delivered response', () => {
  it('T1 · cacheFirst: quota exhausted, network 200 → the response is still delivered', async () => {
    const h = await installed(swSource, { [CHUNK]: 'CHUNK-BODY-1234' });
    h.setQuota(h.storedBytes() + 4);                       // room for 4 bytes; the chunk is larger
    const { response, error } = await h.dispatch('fetch', { request: request(CHUNK) });
    expect(error).toBeUndefined();
    expect(response).toBeDefined();
    expect((response as Response).status).toBe(200);
  });

  it('T2 · cacheFirst: the delivered body is exactly what the network returned', async () => {
    const h = await installed(swSource, { [CHUNK]: 'CHUNK-BODY-1234' });
    h.setQuota(h.storedBytes() + 4);
    const { response, error } = await h.dispatch('fetch', { request: request(CHUNK) });
    expect(error).toBeUndefined();
    // Guards the plausible wrong fix: catching the failure but returning
    // undefined, or a clone whose body has already been consumed.
    await expect((response as Response).text()).resolves.toBe('CHUNK-BODY-1234');
  });

  it('T3 · cacheFirst: after a failed put, nothing is left half-stored', async () => {
    const h = await installed(swSource, { [CHUNK]: 'CHUNK-BODY-1234' });
    const before = h.entryCount();
    h.setQuota(h.storedBytes() + 4);
    await h.dispatch('fetch', { request: request(CHUNK) });
    expect(h.entryCount()).toBe(before);
    await expect(h.matchAll(`${ORIGIN}${CHUNK}`)).resolves.toBeUndefined();
  });
});

describe('GROUP A · D-BETA-2 — a cache failure must never be reported as a network failure', () => {
  it('T4 · SWR: quota exhausted, network 200, nothing cached → the response is delivered', async () => {
    const h = await installed(swSource, { [IMAGE]: 'IMAGE-BODY-5678' });
    h.setQuota(h.storedBytes() + 4);
    const { response, error } = await h.dispatch('fetch', { request: request(IMAGE) });
    // Pre-patch this rejects with Error('offline and not cached') while the
    // device is online and the network answered — the false diagnosis.
    expect(error).toBeUndefined();
    expect(response).toBeDefined();
    await expect((response as Response).text()).resolves.toBe('IMAGE-BODY-5678');
  });
});

/* ================================================================== *
 * GROUP B — PRESERVATION. Passes before and after. If any of these    *
 * changes state across the patch, the patch is wrong.                 *
 * ================================================================== */
describe('GROUP B · preservation', () => {
  it('T5 · SWR: a cached copy is returned and a quota failure during revalidation never surfaces', async () => {
    /* REGRESSION GUARD, declared as one: this passes pre-patch because the
       cached branch returns before the write failure is awaited. It is not
       evidence that the fix works — T4 is. */
    const h = await installed(swSource, { [IMAGE]: 'FRESH' });
    await h.dispatch('fetch', { request: request(IMAGE) });   // warm the cache
    h.setQuota(h.storedBytes());                              // no room for any further write
    const { response, error } = await h.dispatch('fetch', { request: request(IMAGE) });
    expect(error).toBeUndefined();
    await expect((response as Response).text()).resolves.toBe('FRESH');
  });

  it('T6 · SWR: a GENUINE transport failure with nothing cached still says "offline and not cached"', async () => {
    /* The message must stay TRUE. The patch does not reword it; it removes the
       one case in which it was reachable while false. */
    const h = await installed();
    h.setNetwork(false);
    const { response, error } = await h.dispatch('fetch', { request: request(IMAGE) });
    expect(response).toBeUndefined();
    expect((error as Error).message).toBe('offline and not cached');
  });

  it('T7 · cacheFirst: a genuine transport failure still rejects', async () => {
    const h = await installed();
    h.setNetwork(false);
    const { response, error } = await h.dispatch('fetch', { request: request(CHUNK) });
    expect(response).toBeUndefined();
    expect(error).toBeDefined();
  });

  it('T8 · install: a quota failure during addAll still REJECTS, so the previous worker keeps serving', async () => {
    const h = harness(swSource);
    h.setQuota(64);                                          // far too small for the shell
    const r = await h.dispatch('install');
    expect(r.lifecycleRejected).toContain('QuotaExceededError');
    expect(h.entryCount()).toBe(0);
  });

  it('T9 · activate: every non-current generation is still purged', async () => {
    /* A real upgrade, not a simulation of one: three historical generations are
       installed in turn against ONE origin-scoped store, then the current worker
       activates over them. Cache Storage outlives a worker generation, which is
       the only reason this test means anything. */
    const current = (swSource.match(/const VERSION = '([^']+)';/) as RegExpMatchArray)[1];
    let h = harness(swSource.replace(`const VERSION = '${current}';`, "const VERSION = 'gna-pwa-v1';"));
    await h.dispatch('install'); await h.dispatch('activate');

    for (const g of ['gna-pwa-v2', 'gna-pwa-v3']) {
      h = h.reboot(swSource.replace(`const VERSION = '${current}';`, `const VERSION = '${g}';`));
      await h.dispatch('install'); await h.dispatch('activate');
    }
    // Seed a stale bucket that activate must also remove.
    const stale = h.reboot(swSource.replace(`const VERSION = '${current}';`, "const VERSION = 'gna-pwa-vOLD';"));
    await stale.dispatch('install');
    expect((await stale.buckets()).some(b => b.startsWith('gna-pwa-vOLD'))).toBe(true);

    const now = stale.reboot(swSource);
    await now.dispatch('install'); await now.dispatch('activate');
    const after = await now.buckets();
    expect(after.length).toBeGreaterThan(0);
    expect(after.every(b => b.startsWith(current))).toBe(true);
    expect(after.some(b => b.startsWith('gna-pwa-vOLD'))).toBe(false);
  });

  it('T10 · navigation: offline still serves offline.html, byte-identical', async () => {
    const h = await installed();
    h.setNetwork(false);
    const { response, error } = await h.dispatch('fetch', { request: navigation() });
    expect(error).toBeUndefined();
    await expect((response as Response).text()).resolves.toBe(offlineSource);
  });

  it('T11 · default deny preserved for every excluded family', async () => {
    const h = await installed();
    const paths = ['/api/ask/stream', '/api/watch/subscriptions', '/api/economy/indicators',
      '/api/market/quotes', '/api/politics/events', '/api/security/incidents',
      '/ask/stream', '/_next/image', '/_next/data/build/x.json', '/tiles/3/4/5.pbf'];
    for (const p of paths) {
      const before = h.entryCount();
      const { response, error } = await h.dispatch('fetch', { request: request(p) });
      expect(response).toBeUndefined();          // not handled
      expect(error).toBeUndefined();
      expect(h.entryCount()).toBe(before);       // and nothing stored
    }
  });

  it('T12 · PRECACHE_URLS is unchanged — six entries, same order, no tiles, no dictionary', () => {
    const list = (swSource.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/) as RegExpMatchArray)[1];
    expect([...list.matchAll(/'([^']+)'/g)].map(m => m[1])).toEqual([
      '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png',
      '/icons/icon-512.png', '/icons/icon-192-maskable.png', '/icons/icon-512-maskable.png',
    ]);
    expect(swSource).not.toContain("'/tiles/");
    expect((swSource.match(/const CACHE_FIRST_PREFIXES = \[([\s\S]*?)\];/) as RegExpMatchArray)[1])
      .toContain("'/_next/static/'");
  });

  it('T13 · the cache generation is the expected one and both buckets derive from it', () => {
    /* Numbered in Group B but it is a PATCH CONSEQUENCE: it cannot pass before
       the version literal moves, and is reported as failing in the pre-edit run.

       The expected value is the SHARED TEST-SIDE AUTHORITY, not a literal pinned
       here. It was 'gna-pwa-v5' when this lane wrote it, and stayed pinned there
       after D7 legitimately moved production to v6 — so this assertion failed
       while the twelve hardening tests beside it still passed. The authority is
       stated independently of sw.js on purpose: comparing sw.js to itself would
       pass for any value, including a generation that was never bumped. */
    const version = (swSource.match(/const VERSION = '([^']+)';/) as RegExpMatchArray)[1];
    expect(version).toBe(CURRENT_EXPECTED_PWA_GENERATION);
    expect(swSource).toContain("const PRECACHE = VERSION + '-precache';");
    expect(swSource).toContain("const RUNTIME = VERSION + '-runtime';");
  });
});
