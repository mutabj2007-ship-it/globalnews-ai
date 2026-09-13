import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * D4 — THE ROLLBACK TOMBSTONE CONTRACT.
 *
 * `public/sw-tombstone.js` is the standby worker used to retire the released
 * service worker. It is never registered; rollback is a file copy over
 * `public/sw.js` followed by a redeploy.
 *
 * Because it is only ever exercised during an incident, it is the one file in
 * this lane that nobody will notice has rotted. These assertions are therefore
 * not style checks — each one pins a property that, if lost, would turn the
 * rollback path into a second incident:
 *
 *   §1  it is inert while it sits here, and the real worker is untouched
 *   §2  it intercepts nothing and stores nothing
 *   §3  it actually removes, unregisters and releases its clients
 *   §4  it cannot quietly grow into a second real worker
 *
 * The absence assertions run against a COMMENT-STRIPPED view of the source.
 * The tombstone's own header explains why an empty fetch handler would not be
 * equivalent to no handler, and therefore names the very API it must not call.
 * A raw grep would fail on that explanation — the same false-positive class
 * M66.10B recorded, and the class that produced the I3 `void:` regression. The
 * helper is duplicated from serviceWorkerContract.spec.ts rather than shared,
 * because specs in this repository are self-contained source readers.
 */

const pwaDir = __dirname;
const frontendDir = join(pwaDir, '..', '..', '..');
const publicDir = join(frontendDir, 'public');

const tombstonePath = join(publicDir, 'sw-tombstone.js');
const realWorkerPath = join(publicDir, 'sw.js');
const registrarPath = join(pwaDir, 'ServiceWorkerRegistrar.tsx');

const tombstoneSource = readFileSync(tombstonePath, 'utf-8');
const realWorkerSource = readFileSync(realWorkerPath, 'utf-8');
const registrarSource = readFileSync(registrarPath, 'utf-8');

/** String-aware comment stripper: a `//` inside a literal is not a comment. */
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

const tombstoneCode = stripJsComments(tombstoneSource);

describe('D4 §1 — the tombstone is inert, and the real worker is untouched', () => {
  it('exists at public/sw-tombstone.js', () => {
    expect(existsSync(tombstonePath)).toBe(true);
  });

  it('is a separate file from the production worker', () => {
    // Requirement 7: a rollback artifact only. If these two ever became the
    // same bytes, the production deployment would be shipping the tombstone.
    expect(existsSync(realWorkerPath)).toBe(true);
    expect(tombstoneSource).not.toBe(realWorkerSource);
  });

  it('public/sw.js is still the real worker', () => {
    // The tombstone's defining property is the ABSENCE of a fetch handler.
    // That only means anything while the file it replaces still has one.
    expect(stripJsComments(realWorkerSource)).toContain("self.addEventListener('fetch'");
  });

  it('nothing registers it', () => {
    expect(registrarSource).toContain("navigator.serviceWorker.register('/sw.js', { scope: '/' })");
    expect(registrarSource).not.toContain('sw-tombstone');
  });
});

describe('D4 §2 — it intercepts nothing and stores nothing', () => {
  it('declares no fetch handler at all', () => {
    // Requirement 1. Not an empty handler — none. An empty handler would still
    // route every request through this worker thread.
    expect(tombstoneCode).not.toContain("addEventListener('fetch'");
    expect(tombstoneCode).not.toContain('respondWith');
  });

  it('opens no cache', () => {
    // Requirement 2.
    expect(tombstoneCode).not.toContain('caches.open(');
    expect(tombstoneCode).not.toContain('caches.match(');
  });

  it('writes nothing to any cache', () => {
    // Requirement 3: it can only remove.
    expect(tombstoneCode).not.toContain('.put(');
    expect(tombstoneCode).not.toContain('.addAll(');
    expect(tombstoneCode).not.toContain('.add(');
  });

  it('names no application path — it has no allowlist to get wrong', () => {
    for (const path of ['/_next/', '/images/', '/icons/', '/offline.html', '/analysis', '/news/', '/users/', '/auth/']) {
      expect(tombstoneCode).not.toContain(path);
    }
  });
});

describe('D4 §3 — it removes, unregisters and releases its clients', () => {
  it('takes over on the first update check', () => {
    expect(tombstoneCode).toContain("self.addEventListener('install'");
    expect(tombstoneCode).toContain('self.skipWaiting()');
  });

  it('deletes every cache bucket, with no filter and no version constant', () => {
    // Requirement 4. A prefix filter written against today's VERSION would
    // silently miss buckets left behind by any other version, and a rollback
    // that leaves buckets behind is not a rollback.
    expect(tombstoneCode).toContain('await caches.keys()');
    expect(tombstoneCode).toContain('caches.delete(name)');
    expect(tombstoneCode).not.toMatch(/VERSION/);
    expect(tombstoneCode).not.toMatch(/gna-pwa/);
    expect(tombstoneCode).not.toMatch(/\.filter\(/);
    expect(tombstoneCode).not.toMatch(/startsWith\(/);
  });

  it('unregisters itself', () => {
    // Requirement 5.
    expect(tombstoneCode).toContain('self.registration.unregister()');
  });

  it('navigates controlled windows off the retired worker', () => {
    // Requirement 6.
    expect(tombstoneCode).toContain("self.clients.matchAll({ type: 'window' })");
    expect(tombstoneCode).toContain('client.navigate(client.url)');
  });

  it('does all of it inside activate, held open by waitUntil', () => {
    // Without waitUntil the worker can be terminated mid-teardown, leaving a
    // half-cleared origin and a registration that survives.
    expect(tombstoneCode).toContain("self.addEventListener('activate'");
    expect(tombstoneCode).toContain('event.waitUntil(');
  });
});

describe('D4 §4 — it cannot quietly grow into a second real worker', () => {
  it('is a handful of lines of executable code', () => {
    // Measured on the comment-stripped source, so documentation can grow
    // freely while behaviour cannot. The tombstone is ~600 bytes of code; the
    // ceiling leaves room to breathe and none to add a caching strategy.
    const executableBytes = Buffer.byteLength(tombstoneCode.replace(/\s+/g, ' ').trim(), 'utf-8');
    expect(executableBytes).toBeLessThan(1200);
  });

  it('registers exactly two lifecycle listeners and no others', () => {
    const listeners = tombstoneCode.match(/self\.addEventListener\('(\w+)'/g) ?? [];
    expect(listeners).toHaveLength(2);
    expect(listeners).toEqual([
      "self.addEventListener('install'",
      "self.addEventListener('activate'",
    ]);
  });
});
