import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { NextRequest } from 'next/server';
import { config, middleware } from '@/middleware';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { routeGateDecision, STANDALONE_ALLOWLIST } from './standaloneRouteGate';

/**
 * PRODUCTION PLATFORM ROUTE SEPARATION R2I — the mode matrix, end to end through the REAL
 * middleware function and the REAL compiled matcher (Next's own getMiddlewareMatchers).
 */

const SRC = resolve(__dirname, '..', '..');
const ORIGIN = 'https://globalnewsai.live';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { getMiddlewareMatchers } = require('next/dist/build/analysis/get-page-static-info.js') as {
  getMiddlewareMatchers: (m: unknown, c: unknown) => { regexp: string }[];
};
const matchers = getMiddlewareMatchers(config.matcher, {}).map((m) => new RegExp(m.regexp));
const middlewareRuns = (path: string) => matchers.some((re) => re.test(path));

function run(path: string, mode: string | undefined) {
  const saved = process.env.GNA_PUBLIC_ROOT;
  if (mode === undefined) delete process.env.GNA_PUBLIC_ROOT;
  else process.env.GNA_PUBLIC_ROOT = mode;
  try {
    const pathname = new URL(path, ORIGIN).pathname;
    if (!middlewareRuns(pathname)) return { kind: 'NOT_MATCHED' as const };
    const res = middleware(new NextRequest(new URL(path, ORIGIN)));
    const location = res.headers.get('location');
    return location === null
      ? { kind: 'PASS' as const, status: res.status }
      : { kind: 'REDIRECT' as const, status: res.status, location };
  } finally {
    if (saved === undefined) delete process.env.GNA_PUBLIC_ROOT;
    else process.env.GNA_PUBLIC_ROOT = saved;
  }
}
const passes = (r: ReturnType<typeof run>) => r.kind === 'PASS' || r.kind === 'NOT_MATCHED';

const STANDALONE_PASS = [
  '/',
  '/ask',
  '/ask/recent',
  '/ask?operation=op-1',
  '/saved',
  '/history',
  '/account/settings',
  '/support',
  '/privacy',
  '/cookies',
  '/terms',
  '/source-policy',
  '/third-party-notices',
  '/admin',
  '/admin/operations',
  '/admin/ai/ask-intelligence',
  '/robots.txt',
  '/sitemap.xml',
  '/icon.svg',
  '/apple-icon.png',
  '/manifest.webmanifest',
  '/sw.js',
  '/icons/icon-192.png',
  '/api/ask-v2/threads/t-1/turns',
  '/api/auth/google/callback?code=x&state=y',
  '/api/users/me',
  '/api/history',
  '/api/admin/operations',
  '/_next/static/chunks/main.js',
  '/_next/image?url=%2Fx.png&w=64&q=75',
  '/news/top-headlines',
  '/geo/countries',
  '/economy/observations/rw-nisr-cpi',
  '/market-data/procurement',
  '/conflict-data/observations',
];

const STANDALONE_REDIRECT = [
  '/search',
  '/search?q=What%20is%20inflation',
  '/map',
  '/map?country=USA',
  '/my-intelligence',
  '/conflict',
  '/market',
  '/market/compact',
  '/energy',
  '/humanitarian',
  '/humanitarian/compact',
  '/imihigo',
  '/imihigo/compact',
  '/delivery-visual-preview',
  '/delivery-visual-preview/compact',
  '/economy-visual-preview',
  '/economy-visual-preview/compact',
  '/election-visual-preview',
  '/election-visual-preview/compact',
  '/politics-visual-preview',
  '/politics-visual-preview/compact',
  '/security-visual-preview',
  '/security-visual-preview/compact',
  '/workspace',
  '/any-new-unknown-page',
  '/account',
  '/askew',
  '/administrator',
  '/%6Dap',
  '/MAP',
];

describe('STANDALONE mode (GNA_PUBLIC_ROOT unset or not "platform") — allowlist, fail closed', () => {
  it.each([undefined, '', 'standalone', 'Platformx'])('mode %p is Standalone', (mode) => {
    expect(standaloneAskRoot(mode === undefined ? {} : { GNA_PUBLIC_ROOT: mode })).toBe(true);
    expect(run('/map', mode).kind).toBe('REDIRECT');
  });

  it.each(STANDALONE_PASS)('%s passes through', (path) => {
    expect(passes(run(path, undefined))).toBe(true);
  });

  it.each(STANDALONE_REDIRECT)('%s → temporary redirect to / (query dropped)', (path) => {
    const r = run(path, undefined);
    expect(r).toEqual({ kind: 'REDIRECT', status: 307, location: `${ORIGIN}/` });
  });

  it('a blocked /search?q=… never carries its question to / (nothing to execute)', () => {
    const r = run('/search?q=What%20is%20inflation&articleId=a-1', undefined);
    expect(r.kind === 'REDIRECT' && new URL(r.location).search).toBe('');
  });

  it('trailing slashes do not change the decision', () => {
    expect(passes(run('/saved/', undefined))).toBe(true);
    expect(run('/map/', undefined).kind).toBe('REDIRECT');
  });

  it('the decision ignores Host, query and cookies (mode + path only)', () => {
    const a = middleware(
      new NextRequest(new URL('/map?platform=1', ORIGIN), {
        headers: { host: 'frontend-alpha-4560.up.railway.app', cookie: 'gna_mode=platform' },
      }),
    );
    expect(a.status).toBe(307);
  });
});

describe('PLATFORM mode (GNA_PUBLIC_ROOT=platform) — everything passes, unchanged', () => {
  it.each(['platform', ' Platform ', 'PLATFORM'])('mode %p is platform', (mode) => {
    expect(standaloneAskRoot({ GNA_PUBLIC_ROOT: mode })).toBe(false);
  });

  it.each([...STANDALONE_PASS, ...STANDALONE_REDIRECT])('%s passes through', (path) => {
    const r = run(path, 'platform');
    expect(passes(r)).toBe(true);
    if (r.kind === 'PASS') expect(r.status).toBe(200);
  });
});

describe('every application page is classified (no accidental exposure)', () => {
  const pages = (dir: string, base = ''): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (!statSync(p).isDirectory()) return name === 'page.tsx' ? [base || '/'] : [];
      return pages(p, `${base}/${name}`);
    });
  const all = pages(join(SRC, 'app'));

  it('Standalone serves exactly the allowlisted pages; every other page redirects', () => {
    const served = all.filter((p) => routeGateDecision(true, p) === 'PASS').sort();
    const allowed = all
      .filter(
        (p) =>
          STANDALONE_ALLOWLIST.pages.includes(p) ||
          STANDALONE_ALLOWLIST.subtrees.some((s) => p.startsWith(s)),
      )
      .sort();
    expect(served).toEqual(allowed);
    expect(served.filter((p) => !p.startsWith('/admin/'))).toEqual([
      '/',
      '/account/settings',
      '/admin',
      '/ask',
      '/ask/recent',
      '/cookies',
      '/history',
      '/privacy',
      '/saved',
      '/source-policy',
      '/support',
      '/terms',
      '/third-party-notices',
    ]);
    expect(all.filter((p) => routeGateDecision(false, p) !== 'PASS')).toEqual([]);
  });
});

describe('zero compute and no client gate', () => {
  /* The middleware's repository import graph: it can reach no transport, no Ask client, no fetch. */
  function graph(entry: string): Map<string, string> {
    const seen = new Map<string, string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      const source = readFileSync(file, 'utf8');
      seen.set(file, source);
      for (const imp of ts.preProcessFile(source).importedFiles) {
        const name = imp.fileName;
        const base = name.startsWith('@/')
          ? resolve(SRC, name.slice(2))
          : name.startsWith('.')
            ? resolve(dirname(file), name)
            : null;
        if (!base) continue;
        const target = [base + '.ts', base + '.tsx', base + '/index.ts'].find(existsSync);
        if (target) visit(target);
      }
    };
    visit(entry);
    return seen;
  }

  it('the middleware graph is four pure files: no fetch, no Ask/analysis client, no storage', () => {
    const files = graph(join(SRC, 'middleware.ts'));
    expect(
      [...files.keys()].map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/')).sort(),
    ).toEqual([
      'lib/admin/adminRoutes.ts',
      'lib/ask/standaloneRoot.ts',
      'lib/routing/standaloneRouteGate.ts',
      'middleware.ts',
    ]);
    for (const source of files.values()) {
      expect(source).not.toMatch(
        /fetch\(|askV2Api|analysisApi|analyzeNews|localStorage|document\./,
      );
    }
  });

  it('a redirect has no body: nothing of the platform page is rendered or leaked', async () => {
    const res = middleware(new NextRequest(new URL('/my-intelligence', ORIGIN)));
    expect(res.status).toBe(307);
    expect(await res.text()).toBe('');
  });

  it('it is server middleware (src/middleware.ts), not a client component', () => {
    const src = readFileSync(join(SRC, 'middleware.ts'), 'utf8');
    expect(src).not.toMatch(/['"]use client['"]/);
    expect(src).toContain('standaloneAskRoot({ GNA_PUBLIC_ROOT: process.env.GNA_PUBLIC_ROOT })');
  });

  it('/ still renders by the SAME predicate (Standalone root vs platform Home)', () => {
    const page = readFileSync(join(SRC, 'app/page.tsx'), 'utf8');
    expect(page).toMatch(/if \(standaloneAskRoot\(\)\) \{\s*return <AskStandaloneRoot/);
  });
});
