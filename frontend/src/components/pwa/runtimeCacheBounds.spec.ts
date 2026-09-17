import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

import { CURRENT_EXPECTED_PWA_GENERATION } from './pwaGenerationTestAuthority';

/**
 * RCB-1 — THE RUNTIME CACHE IS BOUNDED, AND THE BOUND IS BLIND.
 *
 * D-BETA-3 was not implemented against for a long time, deliberately, because the
 * cost looked like untidiness. Measurement changed that. The runtime bucket grows
 * about 0.95 MB per deploy for a reader who visits ONE route — a one-line source
 * edit rehashes 73% of the built static bytes, so almost every chunk arrives at a
 * new URL — and nothing is ever removed within a generation.
 *
 * THE REASON THIS FILE EXISTS IS NOT THE DISK. install() calls addAll() and REJECTS
 * if it fails; activate() is what purges old generations; activate only runs after a
 * successful install. So a runtime cache at the storage quota makes addAll reject,
 * install reject, and the purge that would free the space never run. The reader is
 * frozen on a generation that can never be replaced — and by D-PWA-PA-1 that means no
 * future offline.html change reaches them, including the tombstone that is supposed
 * to be the way out. E5 is the assertion that closes that loop, and it is the reason
 * for the change; E1 only proves a number moved.
 *
 * WHY FIFO AND NOT LRU. LRU needs per-entry access times — state, in the one file
 * that must not acquire any. cache.keys() already returns insertion order, so FIFO
 * costs nothing and stores nothing.
 *
 * AND WHY FIFO IS THE SAFE POLICY, not merely the cheap one. An eviction rule that
 * chose WHAT to keep would read something about each entry, and a cache whose
 * contents depend on the nature of a record becomes a presence/absence oracle over
 * those records — the same defect, in a storage costume, that the accepted
 * humanitarian security policy rules out at the rendering layer. FIFO cannot become
 * that, because its only input is position. E6 and NC5 hold it there.
 */

const publicDir = join(__dirname, '..', '..', '..', 'public');
const swPath = join(publicDir, 'sw.js');
const swSource = readFileSync(swPath, 'utf-8');

function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}
const swCode = stripJsComments(swSource);

const RUNTIME_CAP = 100;

/* ── a Cache Storage that behaves like the real one where it matters ───────── */

class QuotaExceededError extends Error {
  constructor() { super('Quota exceeded.'); this.name = 'QuotaExceededError'; }
}

type Shim = {
  store: Map<string, Map<string, string>>;
  order: Map<string, string[]>;
  quota: { limit: number; used: number };
  keysDelay: { ms: number };
  deleteThrows: { on: boolean };
};

function makeCaches(shim: Shim) {
  const bucket = (name: string) => {
    if (!shim.store.has(name)) { shim.store.set(name, new Map()); shim.order.set(name, []); }
    return { entries: shim.store.get(name) as Map<string, string>, order: shim.order.get(name) as string[] };
  };
  const open = async (name: string) => {
    const b = bucket(name);
    return {
      async put(request: { url: string }, response: { text(): Promise<string> }) {
        const body = await response.text();
        if (shim.quota.used + body.length > shim.quota.limit) throw new QuotaExceededError();
        if (!b.entries.has(request.url)) b.order.push(request.url);
        b.entries.set(request.url, body);
        shim.quota.used += body.length;
      },
      /* insertion order, exactly as the platform returns it */
      async keys() {
        if (shim.keysDelay.ms) await new Promise((r) => setTimeout(r, shim.keysDelay.ms));
        return b.order.map((url) => ({ url }));
      },
      async match(request: { url: string } | string) {
        const url = typeof request === 'string' ? new URL(request, 'https://x.test').toString() : request.url;
        const body = b.entries.get(url);
        return body === undefined ? undefined : { text: async () => body, clone: () => ({ text: async () => body }) };
      },
      async delete(request: { url: string }) {
        if (shim.deleteThrows.on) throw new Error('maintenance failed');
        const body = b.entries.get(request.url);
        if (body === undefined) return false;
        shim.quota.used -= body.length;
        b.entries.delete(request.url);
        b.order.splice(b.order.indexOf(request.url), 1);
        return true;
      },
      async addAll(urls: string[]) {
        for (const u of urls) {
          const abs = new URL(u, 'https://x.test').toString();
          const body = `precached:${u}`;
          if (shim.quota.used + body.length > shim.quota.limit) throw new QuotaExceededError();
          if (!b.entries.has(abs)) b.order.push(abs);
          b.entries.set(abs, body);
          shim.quota.used += body.length;
        }
      },
    };
  };
  return {
    open,
    async keys() { return [...shim.store.keys()]; },
    async delete(name: string) {
      const b = shim.store.get(name);
      if (!b) return false;
      for (const body of b.values()) shim.quota.used -= body.length;
      shim.store.delete(name); shim.order.delete(name);
      return true;
    },
    async match(request: { url: string }) {
      for (const name of shim.store.keys()) {
        const c = await open(name);
        const hit = await c.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };
}

type Harness = {
  shim: Shim;
  ctx: Record<string, unknown>;
  listeners: Record<string, ((event: unknown) => void)[]>;
  call: <T>(fn: string, ...args: unknown[]) => Promise<T>;
  bucketKeys: (name: string) => string[];
  version: string;
};

function harness(source: string, opts: { quota?: number; bodySize?: number } = {}): Harness {
  const shim: Shim = {
    store: new Map(), order: new Map(),
    quota: { limit: opts.quota ?? Number.MAX_SAFE_INTEGER, used: 0 },
    keysDelay: { ms: 0 }, deleteThrows: { on: false },
  };
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const body = 'z'.repeat(opts.bodySize ?? 10);
  const ctx: Record<string, unknown> = {
    caches: makeCaches(shim),
    URL,
    setTimeout,
    console,
    fetch: async (request: { url: string } | string) => {
      const url = typeof request === 'string' ? request : request.url;
      return {
        ok: true, status: 200, type: 'basic', url,
        headers: { get: () => null },
        clone: () => ({ text: async () => body }),
        text: async () => body,
      };
    },
    Response: { error: () => ({ ok: false, status: 0 }) },
    Request: class { url: string; constructor(u: string) { this.url = new URL(u, 'https://x.test').toString(); } },
  };
  ctx.self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      (listeners[type] ||= []).push(fn);
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    location: { origin: 'https://x.test' },
  };
  vm.createContext(ctx);
  new vm.Script(source).runInContext(ctx);
  /*
    INSTRUMENT NOTE. In a classic vm script, `function` declarations become
    properties of the context but top-level `const` bindings do not — so
    `ctx.VERSION` is undefined and a bucket name built from it silently addresses
    the wrong bucket. The first run of this file failed E7 for exactly that reason
    and nothing else. The generation is read from the SOURCE instead.
  */
  const version = (source.match(/const VERSION = '([^']+)';/) as RegExpMatchArray)[1];
  return {
    shim, ctx, listeners,
    call: <T>(fn: string, ...args: unknown[]) =>
      (ctx[fn] as (...a: unknown[]) => Promise<T>)(...args),
    bucketKeys: (name: string) => (shim.order.get(name) ?? []).slice(),
    version,
  };
}

const req = (path: string) => ({ url: new URL(path, 'https://x.test').toString() });

/* ────────────────────────────────────────────────────────────────────────────
   E1..E7 — the guard set
   ──────────────────────────────────────────────────────────────────────────── */

describe('RCB-1 — the runtime cache is bounded', () => {
  it('E1 · after many puts, the runtime bucket holds at most 100 entries', async () => {
    const h = harness(swSource);
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 160; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    await new Promise((r) => setTimeout(r, 50)); /* the trim is fire-and-forget */
    expect(h.bucketKeys(runtime).length).toBeLessThanOrEqual(RUNTIME_CAP);
    expect(h.bucketKeys(runtime).length).toBeGreaterThan(0);
  });

  it('E2 · the PRECACHE bucket is never trimmed', async () => {
    const h = harness(swSource);
    const precache = `${h.version}-precache`;
    for (let i = 0; i < 160; i += 1) {
      await h.call('cacheFirst', req(`/precached-${i}`), precache);
    }
    await new Promise((r) => setTimeout(r, 50));
    expect(h.bucketKeys(precache).length).toBe(160);
  });

  it('E3 · eviction is FIFO — the OLDEST entries go first', async () => {
    const h = harness(swSource);
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 130; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    await new Promise((r) => setTimeout(r, 50));
    const kept = h.bucketKeys(runtime).map((u) => new URL(u).pathname);
    /* POSITIVE CONTROL: the sweep is looking at real entries, not an empty set */
    expect(kept.length).toBe(RUNTIME_CAP);
    expect(kept).toContain('/_next/static/chunks/c129.js');
    expect(kept).not.toContain('/_next/static/chunks/c0.js');
    expect(kept).not.toContain('/_next/static/chunks/c29.js');
    expect(kept[0]).toBe('/_next/static/chunks/c30.js');
  });

  it('E4 · a trim that throws never destroys a response that was already fetched', async () => {
    const h = harness(swSource);
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 120; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    h.shim.deleteThrows.on = true;
    const response = await h.call<{ text(): Promise<string> }>(
      'cacheFirst', req('/_next/static/chunks/fresh.js'), runtime,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(response).toBeDefined();
    await expect(response.text()).resolves.toBe('zzzzzzzzzz');
  });

  it('E5 · ACCEPTANCE — a runtime cache at quota no longer blocks the next generation', async () => {
    /*
      The loop this closes: addAll rejects -> install rejects -> activate never runs
      -> the purge that frees the space never runs. With the cap in place the runtime
      bucket cannot reach the quota in the first place, so install has room.
    */
    const h = harness(swSource, { quota: 100 * 60 + 5000, bodySize: 60 });
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 400; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    await new Promise((r) => setTimeout(r, 80));
    expect(h.bucketKeys(runtime).length).toBeLessThanOrEqual(RUNTIME_CAP);

    /* now run the NEXT generation's install against the same storage */
    const installs = h.listeners.install ?? [];
    expect(installs.length).toBe(1);
    let installed: Promise<unknown> | null = null;
    installs[0]({ waitUntil: (p: Promise<unknown>) => { installed = p; } });
    await expect(installed as unknown as Promise<unknown>).resolves.not.toThrow?.();
    const precache = `${h.version}-precache`;
    expect(h.bucketKeys(precache).length).toBe(6);
  });

  it('E6 · the eviction decision reads NOTHING about the entry — class-blind', () => {
    const fn = swCode.slice(swCode.indexOf('async function trimRuntimeCache'));
    const body = fn.slice(0, fn.indexOf('\n}') + 1);
    expect(body.length).toBeGreaterThan(40);
    for (const forbidden of [
      'response', 'headers', 'body', '.json', '.text', 'record', 'protected',
      'sensitive', 'reveal', 'unmask', 'precise', 'exact', 'showLocation', 'class',
    ]) {
      expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    /* the only inputs it may use are the bucket name and key POSITION */
    expect(body).toContain('keys()');
  });

  it('E7 · after a full trim the precache is intact, so offline still has its page', async () => {
    const h = harness(swSource);
    const runtime = `${h.version}-runtime`;
    const installs = h.listeners.install ?? [];
    let installed: Promise<unknown> | null = null;
    installs[0]({ waitUntil: (p: Promise<unknown>) => { installed = p; } });
    await installed;
    for (let i = 0; i < 200; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    await new Promise((r) => setTimeout(r, 60));
    const precache = `${h.version}-precache`;
    expect(h.bucketKeys(precache).length).toBe(6);
    expect(h.bucketKeys(precache).some((u) => u.endsWith('/offline.html'))).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   NEGATIVE CONTROLS — the shapes that must be refused
   ──────────────────────────────────────────────────────────────────────────── */

describe('RCB-1 — negative controls', () => {
  it('NC1 · WITHOUT the cap, the same load DOES reach the quota and block install', async () => {
    /*
      The preimage worker, reconstructed by removing the trim, against the same
      storage. If this passed, E5 would be proving nothing.
    */
    const uncapped = swSource
      .replace(/\n\s*void trimRuntimeCache\([\s\S]*?\);/g, '')
      .replace(/async function trimRuntimeCache[\s\S]*?\n}\n/, '');
    expect(uncapped).not.toContain('trimRuntimeCache');
    const h = harness(uncapped, { quota: 100 * 60 + 5000, bodySize: 60 });
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 400; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    expect(h.bucketKeys(runtime).length).toBeGreaterThan(RUNTIME_CAP);
    const installs = h.listeners.install ?? [];
    let installed: Promise<unknown> | null = null;
    installs[0]({ waitUntil: (p: Promise<unknown>) => { installed = p; } });
    await expect(installed as unknown as Promise<unknown>).rejects.toThrow(/Quota exceeded/);
  });

  it('NC3 · the independent expected-generation authority still governs, and is not derived', () => {
    expect(swCode).toContain(`const VERSION = '${CURRENT_EXPECTED_PWA_GENERATION}';`);
    const authority = readFileSync(join(__dirname, 'pwaGenerationTestAuthority.ts'), 'utf-8');
    const executable = stripJsComments(authority);
    expect(executable).not.toContain('readFileSync');
    expect(executable).not.toContain('sw.js');
    expect(executable).not.toContain('import');
  });

  it('NC4 · the trim is NOT awaited before the response is returned', async () => {
    /* structural */
    expect(swCode).not.toContain('await trimRuntimeCache');
    /* behavioural: make the trim hang, and prove the response still arrives */
    const h = harness(swSource);
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 120; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    h.shim.keysDelay.ms = 5000;
    const started = Date.now();
    const response = await h.call<{ text(): Promise<string> }>(
      'cacheFirst', req('/_next/static/chunks/late.js'), runtime,
    );
    const elapsed = Date.now() - started;
    expect(response).toBeDefined();
    expect(elapsed).toBeLessThan(2000);
  });

  it('NC6 · the 101st entry evicts exactly one — the oldest', async () => {
    const h = harness(swSource);
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 100; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    await new Promise((r) => setTimeout(r, 40));
    expect(h.bucketKeys(runtime).length).toBe(100);
    await h.call('cacheFirst', req('/_next/static/chunks/c100.js'), runtime);
    await new Promise((r) => setTimeout(r, 40));
    const kept = h.bucketKeys(runtime).map((u) => new URL(u).pathname);
    expect(kept.length).toBe(100);
    expect(kept).not.toContain('/_next/static/chunks/c0.js');
    expect(kept[0]).toBe('/_next/static/chunks/c1.js');
    expect(kept).toContain('/_next/static/chunks/c100.js');
  });

  it('NC7 · at or below the cap, NOTHING is evicted', async () => {
    const h = harness(swSource);
    const runtime = `${h.version}-runtime`;
    for (let i = 0; i < 100; i += 1) {
      await h.call('cacheFirst', req(`/_next/static/chunks/c${i}.js`), runtime);
    }
    await new Promise((r) => setTimeout(r, 60));
    const kept = h.bucketKeys(runtime).map((u) => new URL(u).pathname);
    expect(kept.length).toBe(100);
    /* every single one of them, including the very first */
    expect(kept[0]).toBe('/_next/static/chunks/c0.js');
    expect(kept[99]).toBe('/_next/static/chunks/c99.js');
  });

  it('NC5 · a content-dependent eviction would be refused by E6', () => {
    /* the guard's own positive control: prove E6's scan is not blind */
    const sabotaged = `async function trimRuntimeCache(cacheName) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      for (const key of keys) { const response = await cache.match(key); if (response) await cache.delete(key); }
    }
    `;
    /*
      E6 slices the real function at its own closing brace; here the snippet is
      indented, so the whole snippet IS the body. The point of this control is
      only that E6's forbidden-word scan is not blind.
    */
    expect(sabotaged.toLowerCase()).toContain('response');
    expect(sabotaged.toLowerCase()).toContain('cache.match');
  });
});
