import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from './apiBase';

/**
 * Milestone R2 - behavioural regression coverage for execution-context
 * aware backend base URL resolution.
 *
 * These are behavioural tests, not source-text locks: each one calls
 * `resolveApiBaseUrl()` under a specific combination of execution
 * context and environment variables and asserts the URL actually
 * returned.
 *
 * The jest environment for this workspace is `node`, so `window` is
 * genuinely absent by default - that IS the server execution context.
 * The browser context is simulated by defining `globalThis.window` for
 * the duration of a single assertion, which is exactly the condition
 * `resolveApiBaseUrl()` discriminates on.
 */

type MutableGlobal = { window?: unknown };

const INTERNAL_URL = 'http://backend:4000';
const PUBLIC_URL = 'http://localhost:4000';

describe('Milestone R2 - resolveApiBaseUrl()', () => {
  const originalEnv = { ...process.env };

  function setEnv(vars: { internal?: string; publicUrl?: string }): void {
    delete process.env.SERVER_INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    if (vars.internal !== undefined) {
      process.env.SERVER_INTERNAL_API_URL = vars.internal;
    }
    if (vars.publicUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = vars.publicUrl;
    }
  }

  function inBrowserContext<T>(run: () => T): T {
    (globalThis as MutableGlobal).window = {};
    try {
      return run();
    } finally {
      delete (globalThis as MutableGlobal).window;
    }
  }

  afterEach(() => {
    process.env = { ...originalEnv };
    delete (globalThis as MutableGlobal).window;
  });

  describe('server execution context', () => {
    it('returns SERVER_INTERNAL_API_URL when it is set', () => {
      expect(typeof window).toBe('undefined');
      setEnv({ internal: INTERNAL_URL, publicUrl: PUBLIC_URL });

      expect(resolveApiBaseUrl()).toBe(INTERNAL_URL);
    });

    it('falls back to NEXT_PUBLIC_API_URL when SERVER_INTERNAL_API_URL is unset', () => {
      expect(typeof window).toBe('undefined');
      setEnv({ publicUrl: 'https://api.example.test' });

      expect(resolveApiBaseUrl()).toBe('https://api.example.test');
    });
  });

  describe('browser execution context', () => {
    it('returns NEXT_PUBLIC_API_URL even when SERVER_INTERNAL_API_URL is also set', () => {
      setEnv({ internal: INTERNAL_URL, publicUrl: PUBLIC_URL });

      inBrowserContext(() => {
        expect(resolveApiBaseUrl()).toBe(PUBLIC_URL);
      });
    });

    it('never returns the Docker-internal backend hostname, which no browser can resolve', () => {
      setEnv({ internal: INTERNAL_URL, publicUrl: PUBLIC_URL });

      inBrowserContext(() => {
        const resolved = resolveApiBaseUrl();
        expect(resolved).not.toBe(INTERNAL_URL);
        expect(resolved).not.toContain('backend');
      });
    });
  });

  describe('neither variable set', () => {
    it('falls back to http://localhost:4000 on the server', () => {
      expect(typeof window).toBe('undefined');
      setEnv({});

      expect(resolveApiBaseUrl()).toBe('http://localhost:4000');
      expect(resolveApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
    });

    it('falls back to http://localhost:4000 in the browser', () => {
      setEnv({});

      inBrowserContext(() => {
        expect(resolveApiBaseUrl()).toBe('http://localhost:4000');
        expect(resolveApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
      });
    });
  });
});
