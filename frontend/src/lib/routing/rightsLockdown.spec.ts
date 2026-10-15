import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { NextRequest } from 'next/server';
import { config, middleware } from '@/middleware';
import {
  LOCKDOWN_CODE,
  LOCKDOWN_UNDECODABLE,
  LOCKED_PREFIXES,
  lockdownBlocks,
  normaliseLockdownPath,
  rightsLockdownMode,
} from './rightsLockdown';

/**
 * CTO R84 (#95) — the DORMANT frontend proxy lockdown, through the REAL middleware and the REAL
 * compiled matcher (Next's own getMiddlewareMatchers). OFF by default; ACTIVE only by the one
 * deployment variable. Nothing here deploys or activates anything.
 */
const ORIGIN = 'https://frontend-alpha.example';
const SRC = resolve(__dirname, '..', '..');
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { getMiddlewareMatchers } = require('next/dist/build/analysis/get-page-static-info.js') as {
  getMiddlewareMatchers: (m: unknown, c: unknown) => { regexp: string }[];
};
const matchers = getMiddlewareMatchers(config.matcher, {}).map((m) => new RegExp(m.regexp));
const middlewareRuns = (path: string) => matchers.some((re) => re.test(path));

async function send(path: string, lockdown: string | undefined, method = 'GET', root = 'standalone') {
  const saved = { l: process.env.GNA_RIGHTS_LOCKDOWN, r: process.env.GNA_PUBLIC_ROOT };
  if (lockdown === undefined) delete process.env.GNA_RIGHTS_LOCKDOWN;
  else process.env.GNA_RIGHTS_LOCKDOWN = lockdown;
  process.env.GNA_PUBLIC_ROOT = root;
  try {
    /* a raw request path is appended to the origin (new URL(path, base) would read '//api…' as a host) */
    const url = new URL(ORIGIN + path);
    if (!middlewareRuns(url.pathname)) return { matched: false as const };
    const res = middleware(new NextRequest(url, { method, ...(method === 'GET' || method === 'HEAD' ? {} : { body: '{}' }) }));
    const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    return { matched: true as const, status: res.status, body, headers: res.headers };
  } finally {
    if (saved.l === undefined) delete process.env.GNA_RIGHTS_LOCKDOWN;
    else process.env.GNA_RIGHTS_LOCKDOWN = saved.l;
    if (saved.r === undefined) delete process.env.GNA_PUBLIC_ROOT;
    else process.env.GNA_PUBLIC_ROOT = saved.r;
  }
}

const LOCKED_SAMPLES = [
  '/news/search?q=kenya',
  '/news/top-headlines',
  '/news/country/KEN',
  '/news',
  '/news/search.json',
  '/api/analysis/news',
  '/api/ask-v2/threads',
  '/api/ask-v2/threads/t1/turns',
  '/api/ask-v2/operations/op1',
  '/api/ask-v2/guest/threads',
  '/api/ask-v2/briefings/b1/versions/1',
  '/api/stories/s1/brief',
  '/api/stories/search?q=x',
  '/api/alerts/inbox',
  '/api/discussion/articles/a1',
  '/api/users/me/saved/stories',
  '/api/users/me/intelligence/feed',
  /* E1 R85 C-2: proxied data families locked rather than assumed clean */
  '/geo/map-feed',
  '/economy/country/POL',
  '/market-data/quotes',
  '/conflict-data/events',
];
const OPEN_SAMPLES = [
  '/',
  '/ask',
  '/saved',
  '/history',
  '/api/auth/google',
  '/api/auth/session',
  '/api/users/me',
  '/api/history',
  '/api/follows',
  '/api/support/tickets',
  '/api/admin/me',
  '/newsletter',
  '/geography-guide',
  '/economyx',
  '/newsroom-guide',
  '/manifest.webmanifest',
];

describe('the one gate: OFF unless the deployment sets it; fail closed on any unrecognised value', () => {
  it.each([[undefined], [''], ['  '], ['off'], ['OFF']])('%p → OFF', (raw) => {
    expect(rightsLockdownMode(raw as string | undefined)).toBe('OFF');
  });
  it.each([['active'], ['ACTIVE'], ['true'], ['1'], ['on'], ['yes'], ['actvie']])('%p → ACTIVE', (raw) => {
    expect(rightsLockdownMode(raw)).toBe('ACTIVE');
  });
});

describe('OFF (the deployed default): every request behaves exactly as before', () => {
  it.each([...LOCKED_SAMPLES, ...OPEN_SAMPLES])('%s is not answered by the lockdown', async (path) => {
    const r = await send(path, undefined);
    if (r.matched) {
      expect(r.status).not.toBe(503);
      expect(r.headers.get('x-rights-lockdown')).toBeNull();
    }
  });
});

describe('ACTIVE: every locked proxy family, every method → typed 503, nothing proxied', () => {
  it.each(LOCKED_SAMPLES)('%s → 503 SOURCE_RIGHTS_MAINTENANCE (GET)', async (path) => {
    const r = await send(path, 'active');
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ code: LOCKDOWN_CODE, statusCode: 503 });
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-middleware-rewrite')).toBeNull();
    expect(JSON.stringify(r.body)).not.toMatch(/no news|no reporting|no results/i);
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])('method %s on /api/ask-v2/threads → 503', async (method) => {
    const r = await send('/api/ask-v2/threads', 'active', method);
    expect(r.matched && r.status).toBe(503);
  });
  it('the typed code makes the Ask client treat it as a definitive refusal, never a lost response to replay', () => {
    const api = readFileSync(join(SRC, 'lib', 'api', 'askV2Api.ts'), 'utf8');
    expect(api).toMatch(/outcome\.code === undefined/);
  });
});

describe('ACTIVE: bypass variants of a locked path are still answered by the lockdown', () => {
  it.each([
    '//api//analysis/news',
    '/API/Analysis/news',
    '/%61pi/analysis/news',
    '/api/%61nalysis/news',
    '/api/./analysis/news',
    '/api/x/../analysis/news',
    '/%2Fapi/analysis/news',
    '/NEWS/search',
    '/news/',
    '/api/ask-v2%2Fthreads',
  ])('%s', async (path) => {
    const r = await send(path, 'active');
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.status).toBe(503);
  });
  it('normalisation is bounded and segment-safe', () => {
    /* three decoding rounds fully decode a triple-encoded dot segment, which is then resolved */
    expect(normaliseLockdownPath('/%25252E%25252E/api/analysis')).toBe('/api/analysis');
    expect(lockdownBlocks('/newsletter')).toBe(false);
    expect(lockdownBlocks('/api/analysisx')).toBe(false);
    expect(LOCKED_PREFIXES).toContain('/api/ask-v2');
  });
});

describe('E1 R85 C-1: an undecodable or over-encoded path fails CLOSED, never open', () => {
  it.each(['/news%', '/news%zz', '/news%00', '/%2525256eews', '/anything%', '/x%00y'])('%s is locked', (path) => {
    expect(lockdownBlocks(path)).toBe(true);
    expect(normaliseLockdownPath(path)).toBe(LOCKDOWN_UNDECODABLE);
  });
  it('an ordinary path containing a space is not treated as undecodable', () => {
    expect(lockdownBlocks('/ask/a b')).toBe(false);
    expect(lockdownBlocks('/ask/a%20b')).toBe(false);
  });
});

describe('ACTIVE: unrelated surfaces stay usable (sign-in, account, history, follows, support, admin, pages)', () => {
  it.each(OPEN_SAMPLES)('%s is not answered by the lockdown', async (path) => {
    const r = await send(path, 'active');
    if (r.matched) {
      expect(r.status).not.toBe(503);
      expect(r.headers.get('x-rights-lockdown')).toBeNull();
    }
  });
  it('the standalone route gate is unchanged: a platform page still redirects to /', async () => {
    const r = await send('/my-intelligence', 'active');
    expect(r.matched && r.status).toBe(307);
  });
  it("Next's static assets are outside the matcher", () => {
    expect(middlewareRuns('/_next/static/chunks/app.js')).toBe(false);
  });
});
