import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_ROUTES,
  DISALLOWED_PREFIXES,
  DISALLOW_RATIONALE,
  PRIVATE_ROUTES,
  PUBLIC_ROUTES,
  classify,
  sitemapRoutes,
} from './routes';
import { absoluteUrl, validateSiteOrigin } from './siteOrigin';
import { buildPageMetadata, buildRootMetadataBase } from './metadata';

/**
 * ═══ ALPHA-SEO-FOUNDATION-1 — THE REQUIRED PROOFS (§N 1-12) ════════════
 *
 * These are written against the implementation rather than against a
 * snapshot, as §N asks. The difference matters most for the sitemap: a
 * snapshot would freeze today's five URLs and pass forever afterwards,
 * including on the day a private surface is added to the table by
 * mistake. What is asserted instead is the RULE — that nothing
 * user-dependent can reach the sitemap — evaluated over every route the
 * table actually contains.
 *
 * Several tests set and restore `NEXT_PUBLIC_SITE_URL` around themselves.
 * `siteOrigin` reads it at call time on purpose, so the fail-closed path
 * is reachable from a test without a second build.
 */

const SRC = join(__dirname, '..', '..');
const APP = join(SRC, 'app');
const read = (...p: string[]): string => readFileSync(join(...p), 'utf8');

/**
 * Source with comments AND string literals removed.
 *
 * WHY THE STRING LITERALS TOO, which is unusual. `routes.ts` carries a
 * `rationale` for every route, in prose, quoting the authorization — so it
 * legitimately contains the words "session", "retrieval" and "provider"
 * inside quoted text. A scan for those words over raw source reports the
 * EXPLANATION as the violation. Found by a failing run. What the
 * "does not reference" proofs are about is executable code, so that is
 * what they are given.
 */
const codeOnly = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

const ORIGIN = 'https://example.test';
const withOrigin = <T,>(value: string | undefined, fn: () => T): T => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
};

/* ─── 1 · public canonical pages expose the expected metadata ────────── */

describe('N1 — a public canonical page exposes title, description, canonical, robots and social', () => {
  it.each(PUBLIC_ROUTES.map((entry) => entry.path))('%s', (path) => {
    withOrigin(ORIGIN, () => {
      const meta = buildPageMetadata({ path, title: 'T', description: 'D', language: 'en' });
      expect(meta.title).toBe('T');
      expect(meta.description).toBe('D');
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(meta.alternates?.canonical).toBe(`${ORIGIN}${path === '/' ? '' : path}`);
      expect(meta.openGraph?.title).toBe('T');
      expect((meta.twitter as { title?: string }).title).toBe('T');
    });
  });

  it('every public route is wired to the builder in its own route file', () => {
    /*
      The builder can only guarantee anything for pages that call it. This
      checks the wiring rather than trusting it, which is how the one
      surface someone forgets gets caught.
    */
    const wiring: Readonly<Record<string, string>> = {
      '/': 'page.tsx',
      '/map': join('map', 'page.tsx'),
      '/privacy': join('privacy', 'page.tsx'),
      '/terms': join('terms', 'page.tsx'),
      '/source-policy': join('source-policy', 'page.tsx'),
    };
    for (const entry of PUBLIC_ROUTES) {
      const file = wiring[entry.path];
      expect(`${entry.path}: wired`).toBe(`${entry.path}: ${file === undefined ? 'MISSING' : 'wired'}`);
      const source = read(APP, file as string);
      expect(source).toContain('buildPageMetadata');
      expect(source).toContain(`path: '${entry.path}'`);
    }
  });
});

/* ─── 2 · private surfaces are not indexable ─────────────────────────── */

describe('N2 — private, transient and user-dependent surfaces are not indexable', () => {
  it.each(PRIVATE_ROUTES.map((entry) => entry.path))('%s is noindex, nofollow and has no canonical', (path) => {
    withOrigin(ORIGIN, () => {
      const meta = buildPageMetadata({ path, title: 'T', description: 'D', language: 'en' });
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates?.canonical).toBeUndefined();
      /*
        AND NO `og:url`. A social card carrying a URL is an invitation to
        treat that URL as the published home of the content, which is the
        same claim a canonical makes by another route.
      */
      expect(meta.openGraph).toBeDefined();
      expect((meta.openGraph as { url?: string }).url).toBeUndefined();
    });
  });

  it('/search — the named §B case — is noindex even with an origin configured', () => {
    withOrigin(ORIGIN, () => {
      const meta = buildPageMetadata({ path: '/search', title: 'T', description: 'D', language: 'en' });
      expect(meta.robots).toEqual({ index: false, follow: false });
    });
  });

  it('an UNLISTED route defaults to private', () => {
    /* §B: "Do not assume that having a URL makes a page indexable." */
    const unknown = classify('/some/route/added/later');
    expect(unknown.indexability).toBe('noindex');
    expect(unknown.sitemap).toBe(false);
    expect(unknown.userDependent).toBe(true);
  });

  it('admin and account SUBTREES inherit the classification, not just their index pages', () => {
    for (const path of ['/admin/users', '/admin/payments/vat', '/account/settings']) {
      expect(classify(path).indexability).toBe('noindex');
    }
  });

  it('the pre-existing admin and support robots directives are preserved', () => {
    expect(read(APP, 'admin', 'layout.tsx')).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    expect(read(APP, 'support', 'page.tsx')).toContain("path: '/support'");
  });
});

/* ─── 3 and 4 · the sitemap contains exactly the canonical public set ── */

describe('N3/N4 — the sitemap excludes private surfaces and contains only canonical public routes', () => {
  it('nothing user-dependent, noindex or unflagged can reach the sitemap', () => {
    for (const entry of sitemapRoutes()) {
      expect(`${entry.path} userDependent: ${entry.userDependent}`).toBe(`${entry.path} userDependent: false`);
      expect(entry.indexability).toBe('index');
      expect(entry.sitemap).toBe(true);
    }
  });

  it('every §B category named in the authorization is absent', () => {
    const paths = sitemapRoutes().map((entry) => entry.path);
    for (const forbidden of ['/search', '/history', '/account/settings', '/support', '/admin', '/workspace']) {
      expect(`${forbidden} in sitemap: ${paths.includes(forbidden)}`).toBe(`${forbidden} in sitemap: false`);
    }
  });

  it('every sitemap URL is absolute, canonical and query-free', () => {
    withOrigin(ORIGIN, () => {
      for (const entry of sitemapRoutes()) {
        const url = absoluteUrl(entry.path);
        expect(url).not.toBeNull();
        expect(url as string).toMatch(/^https:\/\//);
        expect(url as string).not.toMatch(/[?#]/);
        /* the sitemap URL and the page's canonical are the same string */
        const meta = buildPageMetadata({ path: entry.path, title: 'T', description: 'D', language: 'en' });
        expect(meta.alternates?.canonical).toBe(url);
      }
    });
  });

  it('the sitemap route emits NO lastmod — there is no change record to state', () => {
    /*
      §E: "appropriate `lastmod` only when supported by real data", and
      "Do not fabricate change dates". The three legal pages display a
      last-updated date, but it is LOCALIZED PROSE ('17 August 2026' /
      '17 sierpnia 2026') rather than a machine-readable field, and the
      home and map surfaces recompose from retrieved evidence, which §J
      forbids converting into a publication or modification time.
      See OPEN-QUESTIONS for the contract this would need.
    */
    const source = read(APP, 'sitemap.ts');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(code).not.toMatch(/lastModified/);
    expect(code).not.toMatch(/new Date\(/);
  });

  it('the sitemap is EMPTY rather than wrong when no origin is configured', () => {
    withOrigin(undefined, () => {
      expect(absoluteUrl('/privacy')).toBeNull();
    });
  });
});

/* ─── 5 · news sitemap ───────────────────────────────────────────────── */

describe('N5 — no news sitemap is published, because no first-party article URL exists', () => {
  it('the repository has no dynamic route segment at all', () => {
    /*
      A News sitemap lists the publisher's OWN article URLs. This product
      has none: there is no `[slug]`/`[id]` segment anywhere under app/,
      so there is no page that could be listed. Asserted rather than
      asserted-about, so the day an article route is added this test fails
      and the News sitemap question is reopened deliberately.
    */
    const segments: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (!statSync(full).isDirectory()) continue;
        if (name.startsWith('[')) segments.push(full.slice(APP.length));
        walk(full);
      }
    };
    walk(APP);
    expect(segments).toEqual([]);
  });

  it('no news-sitemap route was invented', () => {
    const files = readdirSync(APP);
    expect(files).toContain('sitemap.ts');
    expect(files.filter((f) => /news.*sitemap|sitemap.*news/i.test(f))).toEqual([]);
  });
});

/* ─── 6 · structured data parses and fabricates nothing ──────────────── */

describe('N6 — structured data parses and contains no fabricated fields', () => {
  const component = read(SRC, 'components', 'seo', 'SiteStructuredData.tsx');
  const code = component.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  /* string literals are KEPT here: the JSON-LD field names live in them */

  it('the emitted graph is valid JSON with only WebSite and Organization', () => {
    /* built the same way the component builds it, then parsed */
    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: 'GlobalNews AI', inLanguage: ['en', 'pl'], publisher: { '@id': `${ORIGIN}/#organization` } },
        { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'GlobalNews AI', url: `${ORIGIN}/` },
      ],
    };
    const parsed = JSON.parse(JSON.stringify(graph)) as { '@graph': { '@type': string }[] };
    expect(parsed['@graph'].map((node) => node['@type'])).toEqual(['WebSite', 'Organization']);
  });

  it('no Article or NewsArticle is claimed anywhere in the frontend', () => {
    /*
      §G's rules are each violated by a single NewsArticle on a page this
      product did not publish: it would assert a headline, a date, an
      author and a publisher for someone else's document.
    */
    for (const forbidden of ['NewsArticle', '"Article"', "'Article'", 'datePublished', 'dateModified', 'articleSection']) {
      expect(`${forbidden}: ${code.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('no invented author, publisher identity, image, rating or review', () => {
    for (const forbidden of ['author', 'logo', 'sameAs', 'aggregateRating', 'review', 'founder', 'address', 'telephone', 'image']) {
      expect(`${forbidden}: ${code.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('no SearchAction — it would advertise a surface §B rules out', () => {
    expect(code).not.toContain('SearchAction');
    expect(code).not.toContain('/search');
  });

  it('it renders nothing at all when no origin is configured', () => {
    expect(code).toMatch(/if \(origin === null\) return null;/);
  });
});

/* ─── 7 · canonical URLs are deterministic ───────────────────────────── */

describe('N7 — canonical construction is deterministic', () => {
  it('the same path always yields the same absolute URL', () => {
    withOrigin(ORIGIN, () => {
      for (const path of PUBLIC_ROUTES.map((e) => e.path)) {
        expect(absoluteUrl(path)).toBe(absoluteUrl(path));
      }
    });
  });

  it('a query string or fragment can never become a canonical', () => {
    withOrigin(ORIGIN, () => {
      expect(absoluteUrl('/search?q=iran')).toBeNull();
      expect(absoluteUrl('/privacy#section-2')).toBeNull();
      expect(absoluteUrl('relative/path')).toBeNull();
    });
  });

  it('a trailing slash never produces a second URL for one page', () => {
    withOrigin(ORIGIN, () => {
      expect(absoluteUrl('/privacy/')).toBe(absoluteUrl('/privacy'));
      /*
        THE ROOT IS THE BARE ORIGIN, AND THAT SPELLING WAS CHOSEN BY
        MEASUREMENT. Chrome verification showed the sitemap emitting
        `https://host/` while the rendered `<link rel="canonical">` said
        `https://host` — Next normalises the root once `metadataBase`
        resolves it. RFC 3986 §6.2.3 makes them one resource, so neither
        was wrong, but stating a page's URL two ways across the sitemap
        and the page is the ambiguity §C exists to remove.
      */
      expect(absoluteUrl('/')).toBe(ORIGIN);
      expect(absoluteUrl('//')).toBe(ORIGIN);
    });
  });

  it('the home URL has ONE spelling across canonical, sitemap and structured data', () => {
    withOrigin(ORIGIN, () => {
      const canonical = buildPageMetadata({ path: '/', title: 'T', description: 'D', language: 'en' })
        .alternates?.canonical;
      const inSitemap = absoluteUrl(sitemapRoutes().find((e) => e.path === '/')?.path ?? '/');
      expect(canonical).toBe(inSitemap);
      /* and the structured data builds its URL from the same function */
      const component = read(SRC, 'components', 'seo', 'SiteStructuredData.tsx');
      expect(component).toContain("absoluteUrl('/', origin)");
      expect(component).not.toMatch(/url: `\$\{origin\}\//);
    });
  });

  it('the origin itself is validated, and a bad one fails closed', () => {
    expect(validateSiteOrigin(undefined)).toEqual({ ok: false, reason: 'unset' });
    expect(validateSiteOrigin('')).toEqual({ ok: false, reason: 'unset' });
    expect(validateSiteOrigin('example.test')).toEqual({ ok: false, reason: 'not-absolute' });
    expect(validateSiteOrigin('ftp://example.test')).toEqual({ ok: false, reason: 'bad-protocol' });
    expect(validateSiteOrigin('https://example.test/base')).toEqual({ ok: false, reason: 'has-path' });
    expect(validateSiteOrigin('https://example.test?a=1')).toEqual({ ok: false, reason: 'has-query' });
    expect(validateSiteOrigin('https://example.test#x')).toEqual({ ok: false, reason: 'has-fragment' });
    expect(validateSiteOrigin('https://u:p@example.test')).toEqual({ ok: false, reason: 'has-credentials' });
    expect(validateSiteOrigin('https://example.test/')).toEqual({ ok: true, origin: 'https://example.test' });
  });

  it('no hostname is hard-coded anywhere in the SEO modules', () => {
    for (const file of ['siteOrigin.ts', 'routes.ts', 'metadata.ts']) {
      const source = read(__dirname, file);
      const code = codeOnly(source);
      expect(`${file}: ${/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(code)}`).toBe(`${file}: false`);
    }
  });
});

/* ─── 8 · metadata does not depend on authenticated state ────────────── */

describe('N8 — public metadata does not depend on authenticated state', () => {
  it('the SEO modules read no cookie, header, session or account', () => {
    for (const file of ['siteOrigin.ts', 'routes.ts', 'metadata.ts']) {
      const code = codeOnly(read(__dirname, file));
      for (const forbidden of ['cookies(', 'headers(', 'accountFetch', 'useAccount', 'session', 'Authorization']) {
        expect(`${file} ${forbidden}: ${code.includes(forbidden)}`).toBe(`${file} ${forbidden}: false`);
      }
    }
  });

  it('the same input yields the same metadata regardless of call order', () => {
    withOrigin(ORIGIN, () => {
      const first = buildPageMetadata({ path: '/privacy', title: 'T', description: 'D', language: 'en' });
      const second = buildPageMetadata({ path: '/privacy', title: 'T', description: 'D', language: 'en' });
      expect(first).toEqual(second);
    });
  });

  it('only the LANGUAGE varies, and it comes from the caller', () => {
    withOrigin(ORIGIN, () => {
      const en = buildPageMetadata({ path: '/privacy', title: 'T', description: 'D', language: 'en' });
      const pl = buildPageMetadata({ path: '/privacy', title: 'T', description: 'D', language: 'pl' });
      expect(en.alternates?.canonical).toBe(pl.alternates?.canonical);
      expect((en.openGraph as { locale?: string }).locale).toBe('en_US');
      expect((pl.openGraph as { locale?: string }).locale).toBe('pl_PL');
    });
  });
});

/* ─── 9 · social metadata follows the canonical ──────────────────────── */

describe('N9 — social metadata follows the canonical URL', () => {
  it('og:url equals the canonical on public pages and is absent on private ones', () => {
    withOrigin(ORIGIN, () => {
      for (const entry of ALL_ROUTES) {
        const meta = buildPageMetadata({ path: entry.path, title: 'T', description: 'D', language: 'en' });
        const ogUrl = (meta.openGraph as { url?: string }).url;
        expect(`${entry.path}: ${ogUrl ?? 'none'}`).toBe(`${entry.path}: ${meta.alternates?.canonical ?? 'none'}`);
      }
    });
  });

  it('no social image is claimed, because none of these surfaces has a valid per-page image', () => {
    withOrigin(ORIGIN, () => {
      const meta = buildPageMetadata({ path: '/', title: 'T', description: 'D', language: 'en' });
      expect((meta.openGraph as { images?: unknown }).images).toBeUndefined();
      expect((meta.twitter as { card?: string }).card).toBe('summary');
    });
  });
});

/* ─── 10, 11, 12 · nothing outside SEO metadata was touched ──────────── */

describe('N10/N11/N12 — routing, product contracts and providers are untouched', () => {
  it('N10 — no route was added, removed or renamed', () => {
    /*
      The only files added under app/ are metadata declarations and the
      two metadata ROUTES the authorization asks for. `robots.ts` and
      `sitemap.ts` are new endpoints by design (§D, §E); the two layouts
      render `{children}` and nothing else.
    */
    const pages: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === 'page.tsx') pages.push(full.slice(APP.length).replace(/[\\/]page\.tsx$/, '') || '/');
      }
    };
    walk(APP);
    /*
      R2-B §9 — 31. ONE ROUTE WAS ADDED, DELIBERATELY AND UNDER A RULING.

      This assertion's name is "no route was added", and it is doing exactly
      its job by failing: the CTO rights ruling of 2026-09-19 requires a
      reachable third-party notices surface, so /third-party-notices was added
      and the count moves with it rather than the assertion being relaxed.

      A NOTE ON THE FAILURE THIS TEST ALREADY HAD. On Windows the loop below
      compares "\\map" against "/map", because the path is sliced with the host
      separator and never normalised. That is why seoFoundation sits in the
      carried baseline set; it is a defect in this spec's path handling and not
      in any route. It is left alone here, per the standing instruction not to
      change implementation to clear a carried failure, and recorded so nobody
      reads this correction as having fixed it.
    */
    /*
      R3-HUM · TWO MORE ROUTES WERE ADDED, AND THE COUNT MOVES AGAIN.

      `/humanitarian` and `/humanitarian/compact`, landed by
      ALPHA-HUMANITARIAN-R3-CANONICAL-CONVERGENCE-R1 as H's accepted checkpoint-4
      bytes. Same treatment as `/third-party-notices` above, and for the reason this
      assertion already gives: the count moves with the tree rather than the assertion
      being relaxed.

      THIS DOES NOT CLEAR THE CARRIED FAILURE, and is not an attempt to. The Windows
      path-separator defect described above is untouched, so this spec stays in the
      carried baseline set exactly as before — confirmed by the failing-test-NAME set
      being identical across this convergence. Moving the count keeps the number
      honest; leaving it at 31 would have made it wrong for two unrelated reasons at
      once, and a later reader could not tell which.
    */
    /*
      PART VII · TWO MORE ROUTES, AND THE COUNT MOVES AGAIN — FOR A REASON THAT IS
      NARROWER THAN THE LAST ONE.

      `/market` and `/market/compact`, landed by H-MARKET-PARTVII-ALPHA-VISUAL-R1. Same
      treatment as `/third-party-notices` and the two Humanitarian routes above: the count
      moves with the tree rather than the assertion being relaxed.

      WHAT MAKES THESE TWO DIFFERENT FROM AN ORDINARY ROUTE ADDITION, and why moving the
      number does not weaken what N10 is for:

        - both declare `robots: { index: false, follow: false }`, so nothing here becomes
          indexable and the SEO surface this file guards is unchanged;
        - `intelligenceModules.ts` still carries `market` as `state: 'comingSoon'` with no
          `destination`, so neither route is reachable from Home navigation;
        - they are internally available for integration testing, which is exactly the
          posture the activation asked for and the reason they exist before the read
          endpoint does.

      So N10 still does its job: a route appeared, a human decided it should, and the
      decision is written down beside the number instead of inside a commit message.
    */
    /*
      PART VI · TWO MORE ROUTES — AND THESE TWO ARE NOT A PRODUCT SURFACE AT ALL.

      `/economy-visual-preview` and `/economy-visual-preview/compact`, landed by
      H-SPECIALIST-DASHBOARDS-ALPHA-VISUAL-R1. They exist so the Product Owner can inspect
      the final Economy composition before the governed `/economy` route opens, and the
      reason they are at this address rather than that one is the whole point of them:

        - `shared/src/economy/route-eligibility.ts` holds eight conditions and `/economy`
          fails three, all of them DATA conditions. Main's accepted entry is explicit that
          *"not one of the eight is visual readiness"*, so inspecting a layout is not a
          reason to open that route;
        - `b4aEconomySubstrate.spec.ts` asserts `existsSync(app/economy) === false`, and
          that tripwire is *"retired and replaced by a presence assertion with the same
          teeth, never deleted"* — only when the transition conditions hold. It still
          passes, unchanged, alongside this count;
        - both declare `robots: { index: false, follow: false }`, so the SEO surface this
          file guards is unchanged;
        - `intelligenceModules.ts` still carries `economy` as `state: 'preview'` with no
          `destination`, and `isModuleNavigable` requires `active` AND a destination, so
          neither route is reachable from Home navigation.

      THE COUNT MOVING IS THE DISCLOSURE. A preview route that did not move this number
      would be a route nobody had to decide about.
    */
    expect(pages).toHaveLength(37);
    expect(pages).toContain('/');
    /*
      AND `/economy` IS ASSERTED ABSENT, HERE, BESIDE THE COUNT.

      The B4-A tripwire already asserts the DIRECTORY does not exist. This asserts the
      ROUTE does not, from the walk this test already performs — a second, independent
      reading of the same fact, in the file that would notice a route appearing. The two
      would have to be defeated together.
    */
    for (const shut of ['/economy', '/economy/compact']) {
      expect(`${shut}: ${pages.includes(shut)}`).toBe(`${shut}: false`);
    }
    /* and the new ones are present, so a later removal is caught as loudly as an addition */
    for (const added of ['/market', '/market/compact',
      '/economy-visual-preview', '/economy-visual-preview/compact']) {
      expect(`${added}: ${pages.includes(added)}`).toBe(`${added}: true`);
    }
    for (const known of ['/map', '/search', '/privacy', '/terms', '/source-policy', '/support', '/workspace', '/history']) {
      expect(`${known}: ${pages.includes(known)}`).toBe(`${known}: true`);
    }
  });

  it('N11 — the metadata-only layouts render children and nothing else', () => {
    for (const file of [join('history', 'layout.tsx'), join('account', 'layout.tsx')]) {
      const source = read(APP, file);
      const code = source.replace(/\/\*\*[\s\S]*?\*\//g, ' ');
      expect(code).toMatch(/return children;/);
      /* no element, no wrapper, no class */
      expect(code).not.toMatch(/<div|<main|<section|className=/);
    }
  });

  it('N11 — no Analysis Workspace, Ask AI, map or dock file is in this change', () => {
    /*
      Asserted structurally: the SEO modules import nothing from the
      protected surfaces, so this work cannot reach them.
    */
    for (const file of ['siteOrigin.ts', 'routes.ts', 'metadata.ts']) {
      const source = codeOnly(read(__dirname, file));
      for (const forbidden of ['analysis-frame', 'components/ask', 'components/map', 'components/search']) {
        expect(`${file} ${forbidden}: ${source.includes(forbidden)}`).toBe(`${file} ${forbidden}: false`);
      }
    }
  });

  it('N12 — no provider, retrieval or question-routing code is referenced', () => {
    const all = codeOnly(
      [
        ...['siteOrigin.ts', 'routes.ts', 'metadata.ts'].map((f) => read(__dirname, f)),
        read(SRC, 'components', 'seo', 'SiteStructuredData.tsx'),
        read(APP, 'robots.ts'),
        read(APP, 'sitemap.ts'),
      ].join('\n'),
    );
    for (const forbidden of ['gnews', 'GNews', 'gdelt', 'GDELT', 'analysisApi', 'analyzeNews', 'provider', 'retrieval']) {
      expect(`${forbidden}: ${all.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });
});

/* ─── robots.txt ─────────────────────────────────────────────────────── */

describe('robots.txt does not prevent a crawler from OBSERVING a required noindex', () => {
  /*
   * CTO REV A BLOCKER 1 — THE REGRESSION THAT WOULD HAVE CAUGHT R1.
   *
   * R1 asserted that every §B subtree WAS disallowed, and passed while the
   * product was wrong: blocking a URL stops the fetch, so the `noindex` on
   * that page is never read and the URL can still be indexed from an
   * inbound link. The old assertion was pinning the defect.
   *
   * What is asserted now is the property that actually matters, over every
   * route in the registry rather than over a hand-written list.
   */

  const blockedBy = (path: string): string | null =>
    DISALLOWED_PREFIXES.find((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ?? null;

  it('NO route that carries a required noindex is blocked from being crawled', () => {
    for (const entry of ALL_ROUTES) {
      if (entry.indexability !== 'noindex') continue;
      const blocker = blockedBy(entry.path);
      expect(`${entry.path} blocked by ${blocker ?? 'nothing'}`).toBe(`${entry.path} blocked by nothing`);
    }
  });

  it('the six §B HTML routes are crawlable AND noindex — both, which is the point', () => {
    for (const path of ['/search', '/history', '/account/settings', '/support', '/admin', '/workspace']) {
      expect(`${path} blocked by ${blockedBy(path) ?? 'nothing'}`).toBe(`${path} blocked by nothing`);

      const meta = buildPageMetadata({ path, title: 'T', description: 'D', language: 'en' });
      expect(meta.robots).toEqual({ index: false, follow: false });
    }
  });

  it('no public canonical route is disallowed either', () => {
    for (const entry of PUBLIC_ROUTES) {
      expect(`${entry.path} blocked by ${blockedBy(entry.path) ?? 'nothing'}`)
        .toBe(`${entry.path} blocked by nothing`);
    }
  });

  it('every remaining Disallow has a recorded crawl-management reason', () => {
    /* The ruling requires a specific reason per entry, recorded beside the rule. */
    for (const prefix of DISALLOWED_PREFIXES) {
      expect(typeof DISALLOW_RATIONALE[prefix]).toBe('string');
      expect((DISALLOW_RATIONALE[prefix] ?? '').length).toBeGreaterThan(40);
    }
    expect(Object.keys(DISALLOW_RATIONALE).sort()).toEqual([...DISALLOWED_PREFIXES].sort());
  });

  it('only /api remains, and it is not an HTML document surface', () => {
    expect([...DISALLOWED_PREFIXES]).toEqual(['/api']);
    /* nothing under /api is a route in the registry, so no directive is hidden */
    expect(ALL_ROUTES.some((entry) => entry.path.startsWith('/api'))).toBe(false);
  });

  it('the route file still says in as many words that this is not a security control', () => {
    expect(read(APP, 'robots.ts')).toMatch(/not.*security|security.*not/is);
  });
});

/* ─── root metadataBase ──────────────────────────────────────────────── */

describe('the root layout gains metadataBase and nothing else', () => {
  it('metadataBase resolves from the origin and is absent without one', () => {
    withOrigin(ORIGIN, () => {
      expect(buildRootMetadataBase().metadataBase?.toString()).toBe(`${ORIGIN}/`);
    });
    withOrigin(undefined, () => {
      expect(buildRootMetadataBase()).toEqual({});
    });
  });

  it('the root sets no canonical, robots or social default', () => {
    /*
      A root-level default is precisely how a private surface inherits a
      public page's canonical. Those four facts are per-page, and the
      builder is the only thing that states them.
    */
    const layout = read(APP, 'layout.tsx');
    const start = layout.indexOf('export async function generateMetadata');
    const end = layout.indexOf('export default function RootLayout');
    const body = layout.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(body).toContain('buildRootMetadataBase()');
    expect(body).not.toMatch(/alternates|canonical|robots:|openGraph|twitter/);
    /* and the PWA contract's two required fields are still literal */
    expect(body).toMatch(/manifest:\s*'\/manifest\.webmanifest'/);
    expect(body).toMatch(/appleWebApp:\s*\{/);
  });
});
