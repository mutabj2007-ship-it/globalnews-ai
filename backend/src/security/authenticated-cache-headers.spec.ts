import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import express from 'express';
import request from 'supertest';

import {
  AUTHENTICATED_API_FAMILIES,
  AUTHENTICATED_CACHE_CONTROL,
  createAuthenticatedCacheHeaders,
  isAuthenticatedApiFamilyPath,
} from './authenticated-cache-headers';

/**
 * E1-M-4 / R-2. These assert the RUNTIME header, on a real Express response,
 * because the rehearsal proved that a header declared in configuration is not
 * the same thing as a header returned on the wire. A test that only inspected
 * this module's source would repeat exactly the mistake that produced the R-2
 * failure.
 */

/**
 * An app shaped like the real one: our middleware first, then something that
 * adds `Vary: Origin` the way enableCors() does and `Vary: Accept-Encoding` the
 * way the transport does. The ordering is the real ordering, so the merge being
 * asserted is the merge that actually happens.
 */
function buildApp(handler: express.RequestHandler): express.Express {
  const app = express();

  app.use(createAuthenticatedCacheHeaders());

  app.use((_req, res, next) => {
    res.vary('Origin');
    res.vary('Accept-Encoding');
    next();
  });

  app.use(handler);

  return app;
}

function varyFields(header: string | undefined): string[] {
  return (header ?? '')
    .split(',')
    .map((field) => field.trim().toLowerCase())
    .filter(Boolean);
}

describe('authenticated cache headers — scope', () => {
  it('SCOPE IS DERIVED, NOT GUESSED: the families are exactly the rewrite destinations in next.config.mjs', () => {
    const nextConfig = readFileSync(
      join(__dirname, '..', '..', '..', 'frontend', 'next.config.mjs'),
      'utf8',
    );

    const rewritten = [...nextConfig.matchAll(/source: '\/api\/([a-z]+)\/:path\*'/g)].map(
      (match) => `/${match[1]}`,
    );

    expect(rewritten.length).toBe(7);
    expect([...rewritten].sort()).toEqual([...AUTHENTICATED_API_FAMILIES].sort());
  });

  it('matches a family root and everything beneath it', () => {
    expect(isAuthenticatedApiFamilyPath('/users')).toBe(true);
    expect(isAuthenticatedApiFamilyPath('/users/me')).toBe(true);
    expect(isAuthenticatedApiFamilyPath('/admin/support/tickets')).toBe(true);
  });

  it('does NOT match a path that merely starts with the same letters', () => {
    expect(isAuthenticatedApiFamilyPath('/usersomething')).toBe(false);
    expect(isAuthenticatedApiFamilyPath('/authority')).toBe(false);
  });

  it('is case-insensitive, because Express routing is: /USERS/me must not bypass the control', () => {
    expect(isAuthenticatedApiFamilyPath('/USERS/me')).toBe(true);
    expect(isAuthenticatedApiFamilyPath('/Admin')).toBe(true);
  });

  it('D — /news is OUTSIDE the middleware and stays publicly cacheable', () => {
    expect(isAuthenticatedApiFamilyPath('/news')).toBe(false);
    expect(isAuthenticatedApiFamilyPath('/news/top-headlines')).toBe(false);
  });
});

describe('authenticated cache headers — runtime response', () => {
  it('A — a matching family carries Cache-Control: private, no-store', async () => {
    const app = buildApp((_req, res) => {
      res.status(200).json({ id: 'u1' });
    });

    const response = await request(app).get('/users/me');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(AUTHENTICATED_CACHE_CONTROL);
  });

  it('B — a matching family carries a Vary that includes Cookie', async () => {
    const app = buildApp((_req, res) => {
      res.status(200).json({ id: 'u1' });
    });

    const response = await request(app).get('/users/me');

    expect(varyFields(response.headers.vary)).toContain('cookie');
  });

  it('C — existing Vary values are PRESERVED, not replaced', async () => {
    const app = buildApp((_req, res) => {
      res.status(200).json({ id: 'u1' });
    });

    const response = await request(app).get('/users/me');
    const fields = varyFields(response.headers.vary);

    expect(fields).toContain('cookie');
    expect(fields).toContain('origin');
    expect(fields).toContain('accept-encoding');
  });

  it('C2 — Vary merges in EITHER registration order, so the fix cannot be broken by reordering', async () => {
    const app = express();

    app.use((_req, res, next) => {
      res.vary('Origin');
      next();
    });
    app.use(createAuthenticatedCacheHeaders());
    app.use((_req, res) => res.status(200).end());

    const response = await request(app).get('/users/me');
    const fields = varyFields(response.headers.vary);

    expect(fields).toContain('origin');
    expect(fields).toContain('cookie');
  });

  it('D — /news receives NEITHER directive', async () => {
    const app = buildApp((_req, res) => {
      res.status(200).json({ articles: [] });
    });

    const response = await request(app).get('/news/top-headlines?limit=12');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBeUndefined();
    expect(varyFields(response.headers.vary)).not.toContain('cookie');
  });

  it('E — an UNAUTHENTICATED 401 carries both directives', async () => {
    const app = buildApp((_req, res) => {
      res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
    });

    const response = await request(app).get('/users/me');

    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe(AUTHENTICATED_CACHE_CONTROL);
    expect(varyFields(response.headers.vary)).toContain('cookie');
  });

  it('F — an AUTHENTICATED 200 carries both directives', async () => {
    const app = buildApp((_req, res) => {
      res.status(200).json({ id: 'u1', email: 'someone@example.test' });
    });

    const response = await request(app).get('/users/me').set('Cookie', 'gna_session=opaque');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(AUTHENTICATED_CACHE_CONTROL);
    expect(varyFields(response.headers.vary)).toContain('cookie');
  });

  it('G — the OAuth callback REDIRECT still redirects, and is not cached either', async () => {
    const app = buildApp((_req, res) => {
      res.redirect('https://frontend.example.test/');
    });

    const response = await request(app).get('/auth/google/callback?code=abc&state=xyz');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://frontend.example.test/');
    expect(response.headers['cache-control']).toBe(AUTHENTICATED_CACHE_CONTROL);
    expect(varyFields(response.headers.vary)).toContain('cookie');
  });

  it('G2 — a Set-Cookie on the sign-in response is untouched by this middleware', async () => {
    const app = buildApp((_req, res) => {
      res.setHeader('Set-Cookie', 'gna_session=opaque; Path=/; HttpOnly; SameSite=Lax');
      res.status(200).end();
    });

    const response = await request(app).get('/auth/google');

    expect(response.headers['set-cookie']).toEqual([
      'gna_session=opaque; Path=/; HttpOnly; SameSite=Lax',
    ]);
  });

  it('every one of the seven families carries the directives', async () => {
    for (const family of AUTHENTICATED_API_FAMILIES) {
      const app = buildApp((_req, res) => res.status(200).end());
      const response = await request(app).get(family);

      expect(response.headers['cache-control']).toBe(AUTHENTICATED_CACHE_CONTROL);
      expect(varyFields(response.headers.vary)).toContain('cookie');
    }
  });
});
