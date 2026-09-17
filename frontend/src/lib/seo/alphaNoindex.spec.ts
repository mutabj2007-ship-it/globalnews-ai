import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ALPHA_ENVIRONMENT_ID,
  PRODUCTION_ENVIRONMENT_ID,
  isAlphaEnvironment,
  isAlphaEnvironmentId,
} from './deploymentEnvironment';
import { buildPageMetadata } from './metadata';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5.1 — ALPHA-ONLY NOINDEX
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `ALPHA-NOINDEX-ENV-SIGNAL-1`, closed. The discriminator is
 * `RAILWAY_ENVIRONMENT_ID`, measured read-only against the two governed
 * environments before a line was written:
 *
 *     alpha       70105bf5-b195-41af-b237-8745c8e76506
 *     production  8f4c9c3e-21f5-4fc1-abed-89e3b30eaddc
 *
 * ── THE PROPERTY THESE TESTS EXIST TO PROTECT ────────────────────────────
 *
 * Not "Alpha is noindex" — that is the easy half. The half worth guarding is
 * **PRODUCTION IS UNTOUCHED, INCLUDING WHEN THE VARIABLE IS WRONG.** Every
 * misconfiguration below must behave exactly as Production does today, because
 * a silently deindexed Production is an invisible outage and an indexed Alpha
 * is merely visible.
 */

const HOME = { path: '/', title: 'GlobalNews AI', description: 'd', language: 'en' } as const;

/* Read once at module scope — several blocks below assert over the same source. */
const ENV_SOURCE = readFileSync(join(__dirname, 'deploymentEnvironment.ts'), 'utf-8');
const ENV_CODE = ENV_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Set/restore around each case so no test leaks an environment into another. */
function withEnvironmentId<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.RAILWAY_ENVIRONMENT_ID;

  if (value === undefined) delete process.env.RAILWAY_ENVIRONMENT_ID;
  else process.env.RAILWAY_ENVIRONMENT_ID = value;

  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.RAILWAY_ENVIRONMENT_ID;
    else process.env.RAILWAY_ENVIRONMENT_ID = previous;
  }
}

describe('B5.1 · the discriminator is an exact match on the Alpha id', () => {
  it('POSITIVE CONTROL — the real Alpha id IS Alpha', () => {
    /*
      First and deliberately: every negative below would pass vacuously against
      a predicate that simply always returns false, which is what a broken
      discriminator looks like.
    */
    expect(isAlphaEnvironmentId(ALPHA_ENVIRONMENT_ID)).toBe(true);
    expect(withEnvironmentId(ALPHA_ENVIRONMENT_ID, isAlphaEnvironment)).toBe(true);
  });

  it('the real Production id is NOT Alpha', () => {
    expect(isAlphaEnvironmentId(PRODUCTION_ENVIRONMENT_ID)).toBe(false);
    expect(withEnvironmentId(PRODUCTION_ENVIRONMENT_ID, isAlphaEnvironment)).toBe(false);
  });

  it('the two governed ids are different, which is what makes any of this work', () => {
    expect(ALPHA_ENVIRONMENT_ID).not.toBe(PRODUCTION_ENVIRONMENT_ID);
  });

  it('EVERY malformed value fails towards PRODUCTION', () => {
    /*
      THE ASYMMETRY, ENUMERATED. Each of these is a plausible real mistake, and
      every one of them must leave Production indexable. Note especially the
      trimmable and quoted forms: the predicate does NOT repair them, because
      quietly repairing a wrong value converts a visible misconfiguration into a
      silent one — in the direction that costs Production its index.
    */
    for (const bad of [
      undefined,
      '',
      ' ',
      'alpha',
      'ALPHA',
      ALPHA_ENVIRONMENT_ID.toUpperCase(),
      ` ${ALPHA_ENVIRONMENT_ID}`,
      `${ALPHA_ENVIRONMENT_ID} `,
      `"${ALPHA_ENVIRONMENT_ID}"`,
      `'${ALPHA_ENVIRONMENT_ID}'`,
      ALPHA_ENVIRONMENT_ID.slice(0, -1),
      `${ALPHA_ENVIRONMENT_ID}x`,
      PRODUCTION_ENVIRONMENT_ID,
      'undefined',
      'null',
      '70105bf5',
    ]) {
      expect(withEnvironmentId(bad, isAlphaEnvironment)).toBe(false);
    }
  });
});

describe('B5.1 · Alpha renders noindex, nofollow on every surface', () => {
  it('a PUBLIC page that is indexable in Production is noindex on Alpha', () => {
    const production = withEnvironmentId(PRODUCTION_ENVIRONMENT_ID, () =>
      buildPageMetadata(HOME),
    );
    const alpha = withEnvironmentId(ALPHA_ENVIRONMENT_ID, () => buildPageMetadata(HOME));

    expect(production.robots).toEqual({ index: true, follow: true });
    expect(alpha.robots).toEqual({ index: false, follow: false });
  });

  it('nofollow as well as noindex — the link graph is not a discovery surface either', () => {
    const alpha = withEnvironmentId(ALPHA_ENVIRONMENT_ID, () => buildPageMetadata(HOME));

    expect(alpha.robots).toMatchObject({ follow: false });
  });

  it('and the canonical tag is dropped, because it would nominate the Alpha URL', () => {
    /*
      A canonical on a noindex page nominates that URL as the published home of
      the content. On Alpha that would point search engines at the pre-release
      host as the authoritative copy — the exact inversion the SEO foundation
      exists to prevent.
    */
    const alpha = withEnvironmentId(ALPHA_ENVIRONMENT_ID, () => buildPageMetadata(HOME));

    expect(alpha.alternates?.canonical).toBeUndefined();
  });

  it('a surface that is ALREADY private stays private — the override only withholds', () => {
    /*
      The conjunct can only ever remove indexability. Alpha cannot make a
      private surface public, which is why this is safe to apply globally.
    */
    const privatePage = { ...HOME, path: '/account/settings' };

    for (const id of [ALPHA_ENVIRONMENT_ID, PRODUCTION_ENVIRONMENT_ID]) {
      const meta = withEnvironmentId(id, () => buildPageMetadata(privatePage));

      expect(meta.robots).toEqual({ index: false, follow: false });
    }
  });
});

describe('B5.1 · PRODUCTION CANONICAL BEHAVIOUR IS UNCHANGED', () => {
  it('Production metadata is identical to the pre-B5.1 contract', () => {
    const meta = withEnvironmentId(PRODUCTION_ENVIRONMENT_ID, () => buildPageMetadata(HOME));

    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it('and so is metadata with the variable ABSENT, which is how every other environment runs', () => {
    /*
      Local development, CI, a preview environment and any future service all
      run without this variable. None of them may acquire noindex from this
      change.
    */
    const absent = withEnvironmentId(undefined, () => buildPageMetadata(HOME));

    expect(absent.robots).toEqual({ index: true, follow: true });
  });
});

describe('B5.1 · the mechanism, and the mechanisms deliberately NOT used', () => {
  const code = ENV_CODE;
  const robots = readFileSync(join(__dirname, '..', '..', 'app', 'robots.ts'), 'utf-8');

  it('the authority reads RAILWAY_ENVIRONMENT_ID and nothing else', () => {
    expect(code).toContain('process.env.RAILWAY_ENVIRONMENT_ID');

    for (const forbidden of [
      'NODE_ENV',
      'NEXT_PUBLIC_SITE_URL',
      'hostname',
      'location',
      'headers(',
      'RAILWAY_PUBLIC_DOMAIN',
      'RAILWAY_STATIC_URL',
      'RAILWAY_ENVIRONMENT_NAME',
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('it is a STATIC property access, not a computed lookup', () => {
    /* A computed key would defeat any bundler analysis and is the shape that
       silently yields undefined in an edge bundle. */
    expect(code).not.toMatch(/process\.env\[/);
  });

  it('it is NOT a NEXT_PUBLIC_ variable, so it never reaches the client bundle', () => {
    expect(code).not.toContain('NEXT_PUBLIC_');
  });

  it('robots.txt still allows the root — blocking would DEFEAT the noindex', () => {
    /*
      The ruling, and the reason this tree already documents: a noindex
      directive must be crawlable to be obeyed. `Disallow: /` would stop the
      directive being read at all, so it is not a stronger form of noindex — it
      is the thing that breaks it.
    */
    expect(robots).toContain("allow: '/'");
    expect(robots).not.toMatch(/disallow:\s*'\/'/);
    expect(robots).not.toMatch(/isAlphaEnvironment/);
  });

  it('and the sitemap advertises nothing on Alpha', () => {
    const sitemap = readFileSync(join(__dirname, '..', '..', 'app', 'sitemap.ts'), 'utf-8');

    expect(sitemap).toContain('isAlphaEnvironment()');
    expect(sitemap).toContain("export const dynamic = 'force-dynamic'");
  });
});

describe('B5.1 · the value cannot be baked at build time', () => {
  it('the frontend Dockerfile declares NO build ARG for it', () => {
    /*
      MEASURED, AND IT IS THE REASON A RUNTIME MECHANISM WAS REQUIRED. Docker
      only receives a build argument that the stage declares, and the build
      stage declares exactly three — none of them this one. Anything that needed
      the value during `next build` would therefore read undefined and behave as
      Production, silently.

      If a future change adds this as a build ARG, this test fails and the
      mechanism should be reconsidered rather than quietly half-migrated.
    */
    const dockerfile = readFileSync(
      join(__dirname, '..', '..', '..', 'Dockerfile'),
      'utf-8',
    );

    expect(dockerfile).not.toContain('RAILWAY_ENVIRONMENT_ID');
    expect(dockerfile).toContain('CMD ["npx", "next", "start"]');
  });

  it('every HTML route is server-rendered on demand, so metadata is decided per request', () => {
    /*
      The build's own route table showed 33 dynamic routes and exactly two
      static ones — `/icon.svg` and `/apple-icon.png`, which are images and
      carry no robots directive. So there is no HTML surface whose metadata was
      frozen at build time and could miss the override.

      Asserted through the homepage's server-only data dependency, which is what
      makes it dynamic: it reads cookies, so Next cannot statically render it.
    */
    const page = readFileSync(join(__dirname, '..', '..', 'app', 'page.tsx'), 'utf-8');

    expect(page).toContain('cookies()');
  });
});

describe('B5.1 · it survives the alpha.globalnewsai.live binding', () => {
  it('the authority reads no domain-derived value', () => {
    /*
      THE DURABILITY ARGUMENT, AND IT IS THE POINT OF CHOOSING THE ID.

      Measured: neither environment has a custom domain today, and each carries
      a Railway-generated one — frontend-alpha-4560 / frontend-production-c606.
      Binding alpha.globalnewsai.live CHANGES RAILWAY_PUBLIC_DOMAIN and
      RAILWAY_STATIC_URL, which is exactly why neither may be the authority.

      RAILWAY_ENVIRONMENT_ID is assigned when the environment is created and is
      not derived from any domain, so attaching, moving or removing a custom
      domain cannot alter it.
    */
    for (const domainDerived of [
      'RAILWAY_PUBLIC_DOMAIN',
      'RAILWAY_STATIC_URL',
      'globalnewsai.live',
      'railway.app',
    ]) {
      expect(ENV_SOURCE).not.toContain(domainDerived);
    }
  });

  it('nor the environment NAME, which a rename would change', () => {
    /*
      Both discriminate today. The id is used because a rename is a UI action
      nobody would connect to search indexing, and it would move the name while
      leaving the id alone.
    */
    expect(ENV_CODE).not.toContain('RAILWAY_ENVIRONMENT_NAME');
  });

  it('the Alpha id is the exact value the governance record names', () => {
    expect(ALPHA_ENVIRONMENT_ID).toBe('70105bf5-b195-41af-b237-8745c8e76506');
    expect(PRODUCTION_ENVIRONMENT_ID).toBe('8f4c9c3e-21f5-4fc1-abed-89e3b30eaddc');
  });
});
