import express from 'express';
import request from 'supertest';

import {
  AUTHENTICATED_API_FAMILIES,
  AUTHENTICATED_CACHE_CONTROL,
  createAuthenticatedCacheHeaders,
} from './authenticated-cache-headers';
import {
  PUBLIC_API_FAMILIES,
  PUBLIC_CACHE_CONTROL,
  createPublicCacheHeaders,
  isPublicApiFamilyPath,
} from './public-cache-headers';

/**
 * E1-N-4. Asserted on a REAL Express response, for the same reason the
 * authenticated spec is: the R-2 failure was a header that was declared and
 * never returned. A source-only assertion would repeat that mistake.
 */

/** Both middlewares in the real order, then a stage adding Vary the way cors and the transport do. */
function buildApp(handler: express.RequestHandler): express.Express {
  const app = express();
  app.use(createAuthenticatedCacheHeaders());
  app.use(createPublicCacheHeaders());
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
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
}

describe('E1-N-4 — /news is classified PUBLIC explicitly', () => {
  it('THE TWO CLASSES DO NOT INTERSECT — a path cannot be both public and private', () => {
    const overlap = PUBLIC_API_FAMILIES.filter((f) => AUTHENTICATED_API_FAMILIES.includes(f));
    expect(overlap).toEqual([]);
    expect(AUTHENTICATED_API_FAMILIES).not.toContain('/news');
  });

  it('matches the family root and below, and nothing that merely starts alike', () => {
    expect(isPublicApiFamilyPath('/news')).toBe(true);
    /* G-2 — `/geo` is the SECOND public family, classified for the same reason. */
    expect(isPublicApiFamilyPath('/geo')).toBe(true);
    expect(isPublicApiFamilyPath('/geo/map-feed')).toBe(true);
    expect(isPublicApiFamilyPath('/geo/search')).toBe(true);
    expect(AUTHENTICATED_API_FAMILIES).not.toContain('/geo');
    /* and the public classification carries NO `Vary: Cookie` — asserted below. */
    expect(isPublicApiFamilyPath('/news/country/FRA')).toBe(true);
    expect(isPublicApiFamilyPath('/newsroom')).toBe(false);
  });

  it('is case-insensitive, because Express routing is', () => {
    expect(isPublicApiFamilyPath('/NEWS/top-headlines')).toBe(true);
  });

  it('carries Cache-Control: public, max-age=0, must-revalidate', async () => {
    const app = buildApp((_req, res) => res.status(200).json({ articles: [] }));
    const response = await request(app).get('/news/top-headlines?limit=12');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
    expect(response.headers['cache-control']).toBe(PUBLIC_CACHE_CONTROL);
  });

  it('does NOT carry Vary: Cookie — the response does not vary by session', async () => {
    const app = buildApp((_req, res) => res.status(200).json({ articles: [] }));
    const response = await request(app).get('/news/top-headlines');

    expect(varyFields(response.headers.vary)).not.toContain('cookie');
  });

  it('PRESERVES Vary: Origin and Accept-Encoding — it never assigns that header', async () => {
    const app = buildApp((_req, res) => res.status(200).end());
    const response = await request(app).get('/news/country/FRA');
    const fields = varyFields(response.headers.vary);

    expect(fields).toContain('origin');
    expect(fields).toContain('accept-encoding');
  });

  it('is unaffected by a session cookie being present on the request', async () => {
    // Same-origin means the cookies now travel here. The classification must not
    // change because of that — news is session-blind, and that is the point.
    const app = buildApp((_req, res) => res.status(200).json({ articles: [] }));
    const response = await request(app)
      .get('/news/top-headlines')
      .set('Cookie', 'gna_session=opaque; gna_csrf=opaque');

    expect(response.headers['cache-control']).toBe(PUBLIC_CACHE_CONTROL);
    expect(varyFields(response.headers.vary)).not.toContain('cookie');
  });

  it('the AUTHENTICATED families are untouched by the public middleware', async () => {
    for (const family of AUTHENTICATED_API_FAMILIES) {
      const app = buildApp((_req, res) => res.status(401).end());
      const response = await request(app).get(family);

      expect(response.headers['cache-control']).toBe(AUTHENTICATED_CACHE_CONTROL);
      expect(varyFields(response.headers.vary)).toContain('cookie');
    }
  });

  it('a 404 and a 429 on the news path carry the classification too', async () => {
    for (const status of [404, 429]) {
      const app = buildApp((_req, res) => res.status(status).end());
      const response = await request(app).get('/news/nope');

      expect(response.status).toBe(status);
      expect(response.headers['cache-control']).toBe(PUBLIC_CACHE_CONTROL);
    }
  });
});
