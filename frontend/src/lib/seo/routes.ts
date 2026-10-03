/**
 * ═══ THE ROUTE INDEXABILITY REGISTRY — ONE SOURCE OF TRUTH ═════════════
 *
 * Page metadata, `robots.ts` and `sitemap.ts` all read THIS table. That
 * is the point: three independent lists would eventually disagree, and
 * the way that failure shows up is a private surface appearing in the
 * sitemap while its page still says `noindex` — nobody notices until a
 * crawler does.
 *
 * WHAT THIS FILE IS NOT. It is not an indexability POLICY decision.
 * §B of the authorization names the private categories and §A names the
 * candidate public ones; this encodes those instructions and records the
 * rationale per route. Every entry whose classification required a
 * judgement is marked `ruling: 'main'` and is listed in OPEN-QUESTIONS
 * for Main, who owns the canonical public/indexability boundary.
 *
 * THE DEFAULT IS PRIVATE. `classify()` returns `noindex` for any path not
 * listed, so a route added later is excluded from discovery until someone
 * deliberately adds it here. "Do not assume that having a URL makes a page
 * indexable" is implemented as a default, not as a review habit.
 */

import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';

export type Indexability = 'index' | 'noindex';

export interface RouteEntry {
  /** Canonical path. No query, no fragment, no trailing slash except '/'. */
  readonly path: string;
  readonly indexability: Indexability;
  /** Included in the XML sitemap. Only ever true for `index` routes. */
  readonly sitemap: boolean;
  /**
   * True where the route's content materially depends on an individual
   * user's request or session (§B). Such a route is never indexed, never
   * in the sitemap, and never carries a public canonical.
   */
  readonly userDependent: boolean;
  /** Who ruled this classification: the authorization text, or Main. */
  readonly ruling: 'authorization' | 'main';
  readonly rationale: string;
}

export const PUBLIC_ROUTES: readonly RouteEntry[] = [
  {
    path: '/',
    indexability: 'index',
    sitemap: true,
    userDependent: false,
    ruling: 'authorization',
    rationale:
      'STANDALONE PUBLIC BETA CONVERGENCE R1 — the ONE indexable Ask canonical: `/` is the ' +
      'standalone Ask GlobalNewsAI entry surface (/ask stays noindex, so the two never compete). ' +
      'Server-rendered, no authentication gate, the surface the released product is entered through.',
  },
  {
    path: '/source-policy',
    indexability: 'index',
    sitemap: true,
    userDependent: false,
    ruling: 'authorization',
    rationale:
      '§A names "public legal/source-policy pages". Static content, linked from the Footer.',
  },
  {
    path: '/privacy',
    indexability: 'index',
    sitemap: true,
    userDependent: false,
    ruling: 'authorization',
    rationale: '§A names public legal pages. Static content, linked from the Footer.',
  },
  {
    path: '/terms',
    indexability: 'index',
    sitemap: true,
    userDependent: false,
    ruling: 'authorization',
    rationale: '§A names public legal pages. Static content, linked from the Footer.',
  },
];

export const PRIVATE_ROUTES: readonly RouteEntry[] = [
  {
    /* TRUST R1 §12 — the Cookies & similar technologies notice: public legal content, linked from
       the Privacy Notice and the Ask composer. Noindex and out of the sitemap until the notice is reviewed. */
    path: '/cookies',
    indexability: 'noindex',
    sitemap: false,
    userDependent: false,
    ruling: 'authorization',
    rationale: '§A names public legal pages. Static content (Trust R1 §12 cookies notice).',
  },
  {
    path: '/map',
    indexability: 'noindex',
    sitemap: false,
    userDependent: false,
    ruling: 'authorization',
    rationale:
      'STANDALONE PUBLIC BETA CONVERGENCE R1 — the released product is Ask GlobalNewsAI, so the ' +
      'wider Beta Map is not advertised as a standalone discovery page: noindex and out of the ' +
      'sitemap. The route itself is intact and still reachable.',
  },
  {
    path: '/search',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      '§B first line: "arbitrary /search result pages" and "arbitrary user natural-language question ' +
      'result pages". The content IS the answer to one person\'s question; there is no stable public ' +
      'document here to index.',
  },
  {
    /*
      MY INTELLIGENCE R1.2 — a signed-in personal workspace, registered for the
      same reason /history is: it reads the account session and renders one
      person's own saved stories, follows and question history. There is no
      stable public document here to index, so it is noindex and out of the
      sitemap, and it is recorded in the registry rather than special-cased in
      the route, so the registry stays the one place that decides.
    */
    path: '/my-intelligence',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      '\u00a7B: user-specific personal workspace. Saved stories, followed places and question history ' +
      'belong to one account and are meaningless to any other reader.',
  },
  {
    path: '/history',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      '§B: "History where user-specific". Reads the account session and renders that user\'s own queries.',
  },
  {
    /*
      ASK RECENT + SAVED CONTINUITY R1 — the two standalone Ask continuity
      surfaces, registered for the same reason /history and /my-intelligence are:
      each reads the account session and renders one reader's own Ask material.
      Registered in the registry rather than special-cased in the route, so the
      registry stays the one place that decides indexability.
    */
    path: '/ask/recent',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      "\u00a7B: user-specific. One reader's own Ask conversations, their first questions and when they " +
      'were last active. Meaningless to any other reader and not a stable public document.',
  },
  {
    path: '/saved',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      '\u00a7B: user-specific. The questions one account saved. The bookmark is a relation to that ' +
      "reader's own Ask turns and exists only inside their session.",
  },
  {
    path: '/saved/briefing',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      "§B: user-specific. One reader's own saved briefing (R2 · D1): private by default, " +
      'readable only inside their session; not a public document.',
  },
  {
    path: '/account/settings',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale: '§B: "Account", "account settings".',
  },
  {
    path: '/support',
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      '§B: "support conversations/tickets". Already `robots: index false` before this work; that ' +
      'directive is preserved, not re-decided.',
  },
  {
    /*
      MAIN CONVERGENCE — READ FROM THE ADMIN AUTHORITY, NOT RETYPED.

      H's package hardcoded '/admin' here. In isolation that is harmless; on
      the converged tree it fails `adminRouteManifest.spec.ts`, an ACCEPTED
      Admin authority whose whole point is that every admin path has exactly
      one source of truth. The literal and `ADMIN_ROUTES.overview` are the same
      string today — which is precisely why retyping it is the dangerous form:
      the day the admin overview moves, this table would keep pointing at a
      route that no longer exists and would silently stop excluding the real
      one from discovery.

      Reading the constant costs nothing and makes that drift impossible. The
      classification, the rationale and the emitted behaviour are unchanged.
    */
    path: ADMIN_ROUTES.overview,
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale:
      '§B: "Admin". Already `robots: index false` on the admin layout, which every /admin/** page ' +
      'inherits; that directive is preserved. Robots handling is an SEO control and is NOT what keeps ' +
      'admin safe — the existing authorization boundary is, and is untouched.',
  },
  {
    path: '/workspace',
    indexability: 'noindex',
    sitemap: false,
    userDependent: false,
    ruling: 'main',
    rationale:
      'FLAGGED FOR MAIN. The route is named in §B\'s "personalized workspaces", but the page as built is ' +
      'a STATIC capability list with no user state and no account call — so the §B category and the ' +
      'actual content disagree. H excludes it in R1 because wrongly indexing a surface is harder to ' +
      'withdraw than wrongly excluding one, and because promoting it is an indexability-policy decision ' +
      '§ governance reserves to Main. If Main rules it public, the change is one field in this table.',
  },
];

export const ALL_ROUTES: readonly RouteEntry[] = [...PUBLIC_ROUTES, ...PRIVATE_ROUTES];

/**
 * ═══ WHAT `robots.txt` DISALLOWS — AND WHY IT IS ALMOST NOTHING ════════
 *
 * R1 DISALLOWED THE §B HTML ROUTES, AND THAT WAS WRONG. CTO Rev A
 * blocker 1, and the reasoning is Google's own: **a `noindex` rule has to
 * be crawlable to work.** If `robots.txt` blocks the URL, Googlebot never
 * fetches the page, never sees `<meta name="robots" content="noindex">`,
 * and the URL can still surface in results if it is discovered from
 * anywhere else — an inbound link, a shared URL, a sitemap elsewhere.
 *
 * So R1's two controls were not complementary as its own comment claimed.
 * They were in direct conflict: the `Disallow` was actively preventing the
 * `noindex` from ever being observed, on exactly the surfaces where
 * keeping the URL out of the index matters most.
 *
 * The correction is to let crawlers FETCH those routes and read the
 * directive they carry. Every one of them keeps `noindex, nofollow` in its
 * page metadata; that is now the whole mechanism, and it is the one that
 * actually works.
 *
 * WHAT REMAINS DISALLOWED, AND ON WHAT GROUNDS. `/api` only, and NOT to
 * keep anything out of the index — it is crawl management. Those paths
 * return JSON, not HTML documents, so they carry no meta robots tag to
 * observe and there is no indexable document whose directive a block
 * could hide. Nothing is lost by not crawling them.
 *
 * Per the ruling, any future entry here needs a specific crawl-management
 * reason and must not undermine a required `noindex`. A test enforces the
 * second half: no route classified `noindex` may be blocked.
 *
 * NONE OF THIS IS A PRIVACY OR SECURITY CONTROL, and removing the blocks
 * changes nothing about that. What keeps `/admin`, `/account` and support
 * correspondence private is the existing authentication boundary, which
 * this work has never touched. Robots directives govern DISCOVERY; they
 * were never what stood between a crawler and protected data.
 */
export const DISALLOWED_PREFIXES: readonly string[] = ['/api'];

/**
 * Why each disallowed prefix is disallowed, so the ruling's "must have a
 * specific crawl-management reason" is recorded beside the rule rather
 * than in a document that can drift from it.
 */
export const DISALLOW_RATIONALE: Readonly<Record<string, string>> = {
  '/api':
    'JSON endpoints, not HTML documents. No meta robots tag exists there to be observed, so blocking hides no directive; excluded purely as crawl management.',
};

export function classify(path: string): RouteEntry {
  const exact = ALL_ROUTES.find((entry) => entry.path === path);
  if (exact !== undefined) return exact;

  const prefixed = ALL_ROUTES.find(
    (entry) => entry.path !== '/' && path.startsWith(`${entry.path}/`),
  );
  if (prefixed !== undefined) return { ...prefixed, path };

  /*
    THE DEFAULT IS EXCLUSION. An unlisted route is treated as private, so
    a surface added after this work cannot become a discovery surface by
    omission — only by someone adding it above on purpose.
  */
  return {
    path,
    indexability: 'noindex',
    sitemap: false,
    userDependent: true,
    ruling: 'authorization',
    rationale: 'Unlisted route. §B: "Do not assume that having a URL makes a page indexable."',
  };
}

export function sitemapRoutes(): readonly RouteEntry[] {
  /*
    Both conditions, not just `sitemap`. A sitemap entry for a `noindex`
    page is a contradiction a crawler is entitled to complain about, and
    asserting the conjunction here means the table cannot express one.
  */
  return PUBLIC_ROUTES.filter(
    (entry) => entry.sitemap && entry.indexability === 'index' && !entry.userDependent,
  );
}
