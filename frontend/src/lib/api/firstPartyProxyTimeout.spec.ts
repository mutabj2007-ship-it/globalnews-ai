import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import { parse } from 'url';
import { pathToFileURL } from 'url';
import { ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS } from '@globalnews-ai/shared';

/*
  CTO P0 ALPHA PROXY TIMEOUT R1 — the first-party proxy's deadline, measured on the installed Next.

  Live Alpha db95d4e: POST /api/ask-v2/threads/…/turns → 500 after ~30,028 ms, "Failed to proxy …
  socket hang up", while the backend answered 201 at ~31,071 ms. These tests pin:
    1. the installed implementation: Next 14.2.35 arms each rewrite with
       `proxyTimeout || 30000`, fed from `experimental.proxyTimeout`;
    2. the configuration: an explicit, bounded proxyTimeout that no longer cuts an Ask turn at 30 s;
    3. the mechanism, empirically, with Next's OWN proxyRequest: an upstream slower than the
       proxy's timeout becomes the generic 500 the reader saw; within it, the backend's own
       response (status and body) reaches the browser untouched.
*/
const FRONTEND = join(__dirname, '..', '..', '..');
const REPO_ROOT = join(FRONTEND, '..');
const nextDist = (...p: string[]) =>
  require.resolve(join('next', 'dist', ...p), { paths: [FRONTEND, REPO_ROOT] });

function configuredProxyTimeout(): unknown {
  const href = pathToFileURL(join(FRONTEND, 'next.config.mjs')).href;
  const script = `const mod = await import(${JSON.stringify(href)}); process.stdout.write(JSON.stringify({ t: mod.default.experimental?.proxyTimeout ?? null, named: mod.FIRST_PARTY_PROXY_TIMEOUT_MS ?? null }));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf-8' }));
}

describe('P0 · the installed Next proxy deadline', () => {
  it('Next 14.2.35 defaults a rewrite to 30 s unless experimental.proxyTimeout is set', () => {
    const pkg = JSON.parse(readFileSync(require.resolve('next/package.json', { paths: [FRONTEND, REPO_ROOT] }), 'utf8'));
    expect(pkg.version).toBe('14.2.35');
    const proxy = readFileSync(nextDist('server', 'lib', 'router-utils', 'proxy-request.js'), 'utf8');
    expect(proxy).toContain('proxyTimeout: proxyTimeout === null ? undefined : proxyTimeout || 30000');
    const router = readFileSync(nextDist('server', 'lib', 'router-server.js'), 'utf8');
    expect(router).toMatch(/proxyRequest\)\(req, res, parsedUrl, undefined, [^;]*config\.experimental\.proxyTimeout\)/);
  });

  it('the frontend states a bounded proxyTimeout above the 30 s default and the analysis cutoff', () => {
    const { t, named } = configuredProxyTimeout() as { t: number; named: number };
    expect(t).toBe(120_000);
    expect(named).toBe(t);
    expect(t).toBeGreaterThan(30_000);
    expect(t).toBeGreaterThan(ANALYSIS_FIRST_PARTY_PROXY_CUTOFF_MS);
    /* bounded: inside the backend's RUNNING lease (300 s), so a hung upstream is still cut */
    expect(t).toBeLessThan(300_000);
  });
});

describe("P0 · Next's own proxyRequest, measured", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { proxyRequest } = require(nextDist('server', 'lib', 'router-utils', 'proxy-request.js')) as {
    proxyRequest: (...a: unknown[]) => Promise<unknown>;
  };
  const listen = (handler: http.RequestListener) =>
    new Promise<http.Server>((resolve) => {
      const s = http.createServer(handler);
      s.listen(0, '127.0.0.1', () => resolve(s));
    });
  const port = (s: http.Server) => (s.address() as AddressInfo).port;
  let upstream: http.Server;
  const servers: http.Server[] = [];
  let errorSpy: jest.SpyInstance;
  beforeAll(async () => {
    /* the backend: completes the turn AFTER 600 ms with its own 201 */
    upstream = await listen((req, res) => {
      req.resume();
      setTimeout(() => {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ operationId: 'op-1', status: 'COMPLETED' }));
      }, 600);
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterAll(async () => {
    errorSpy.mockRestore();
    await Promise.all([upstream, ...servers].map((s) => new Promise((r) => s.close(r))));
  });
  const frontend = async (proxyTimeout: number | undefined) => {
    const s = await listen((req, res) => {
      void proxyRequest(req, res, parse(`http://127.0.0.1:${port(upstream)}/ask-v2/threads/t/turns`, true), undefined, undefined, proxyTimeout).catch(
        () => undefined,
      );
    });
    servers.push(s);
    return s;
  };
  const post = (s: http.Server) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: port(s), method: 'POST', path: '/api/ask-v2/threads/t/turns' }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      });
      r.on('error', reject);
      r.end('{}');
    });

  it('a backend slower than the proxy timeout becomes a generic 500 — the live Alpha failure, reproduced', async () => {
    const out = await post(await frontend(300));
    expect(out.status).toBe(500);
    expect(out.body).toBe('Internal Server Error');
    expect(errorSpy.mock.calls.some(([m, e]) => /Failed to proxy/.test(String(m)) && /socket hang up/.test(String(e)))).toBe(true);
  });

  it("within the configured timeout the backend's own 201 and body reach the browser untouched", async () => {
    const out = await post(await frontend(5_000));
    expect(out.status).toBe(201);
    expect(JSON.parse(out.body)).toEqual({ operationId: 'op-1', status: 'COMPLETED' });
  });
});
