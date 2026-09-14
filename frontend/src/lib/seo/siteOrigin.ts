/**
 * ═══ ALPHA-SEO-FOUNDATION-1 · THE ABSOLUTE ORIGIN, FAIL CLOSED ═════════
 *
 * THE GAP THIS FILLS, STATED RATHER THAN ASSUMED. A canonical URL, an
 * Open Graph URL and a sitemap entry are all ABSOLUTE by specification.
 * The frontend had no public-origin configuration to build one from:
 * `FRONTEND_ORIGIN` in `.env.example` is a BACKEND CORS variable — it
 * tells the backend which browser origin to allow — and reading it here
 * would be borrowing a value that answers a different question.
 *
 * SO THE MECHANISM IS MINE AND THE VALUE IS MAIN'S. This resolves one
 * variable, `NEXT_PUBLIC_SITE_URL`, and validates it hard. What the
 * production origin actually IS remains a canonical-boundary ruling that
 * belongs to Main, and is raised in OPEN-QUESTIONS rather than decided
 * here. Nothing in this file contains a hostname.
 *
 * FAIL CLOSED IS THE WHOLE POINT. With no valid origin configured this
 * returns `null`, and every consumer then OMITS the thing it could not
 * build truthfully: no canonical link, no `og:url`, an empty sitemap. A
 * wrong absolute URL is worse than an absent one — it tells crawlers
 * that another origin is the home of this content, and that is a claim
 * we would have invented.
 */

export interface OriginRejection {
  readonly ok: false;
  readonly reason:
    | 'unset'
    | 'not-absolute'
    | 'bad-protocol'
    | 'has-path'
    | 'has-query'
    | 'has-fragment'
    | 'has-credentials';
}

export type OriginResolution = { readonly ok: true; readonly origin: string } | OriginRejection;

/**
 * Validates an origin string. Exported so the rule is testable without
 * touching `process.env`, and so one function decides it for metadata,
 * robots and the sitemap alike.
 *
 * A trailing slash is the one thing normalised, because `new URL().origin`
 * drops it and a sitemap that emitted `https://host//privacy` would be a
 * second URL for one page — the duplication §C exists to prevent.
 */
export function validateSiteOrigin(raw: string | undefined | null): OriginResolution {
  if (raw === undefined || raw === null || raw.trim().length === 0) {
    return { ok: false, reason: 'unset' };
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'not-absolute' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'bad-protocol' };
  if (url.username.length > 0 || url.password.length > 0) return { ok: false, reason: 'has-credentials' };
  if (url.search.length > 0) return { ok: false, reason: 'has-query' };
  if (url.hash.length > 0) return { ok: false, reason: 'has-fragment' };
  /* `new URL('https://host')` yields pathname '/', which is not a path. */
  if (url.pathname !== '/' && url.pathname !== '') return { ok: false, reason: 'has-path' };

  return { ok: true, origin: url.origin };
}

/**
 * `NEXT_PUBLIC_SITE_URL` is read as a STATIC property access, not through
 * a computed key: Next inlines `process.env.NEXT_PUBLIC_*` at build time
 * only when it can see the literal name.
 */
export function resolveSiteOrigin(): string | null {
  const resolved = validateSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  return resolved.ok ? resolved.origin : null;
}

/**
 * Absolute URL for a canonical path, or `null` when no origin is
 * configured. DETERMINISTIC (§C.3): the same path always yields the same
 * string, it never reads request state, and it never carries a query or
 * a fragment — a canonical URL that varied per request would be exactly
 * the duplication this foundation exists to avoid.
 */
export function absoluteUrl(path: string, origin: string | null = resolveSiteOrigin()): string | null {
  if (origin === null) return null;
  if (!path.startsWith('/')) return null;
  if (path.includes('?') || path.includes('#')) return null;
  /*
    ONE SPELLING PER PAGE, INCLUDING THE ROOT.
    `'/'` resolves to the bare origin rather than `origin + '/'`, because
    that is what Next renders into `<link rel="canonical">` for the home
    page once `metadataBase` has resolved it — measured in Chrome, where
    the sitemap said `https://host/` and the page said `https://host`.
    RFC 3986 §6.2.3 makes the two the same resource, so neither was
    wrong; having the sitemap and the page state it differently was.
    Emitting the form the page actually renders removes the question.
  */
  const trimmed = path.replace(/\/+$/, '');
  return `${origin}${trimmed}`;
}
