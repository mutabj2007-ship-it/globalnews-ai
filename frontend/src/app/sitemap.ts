import type { MetadataRoute } from 'next';
import { sitemapRoutes } from '@/lib/seo/routes';
import { absoluteUrl, resolveSiteOrigin } from '@/lib/seo/siteOrigin';

/**
 * ═══ /sitemap.xml ══════════════════════════════════════════════════════
 *
 * CANONICAL PUBLIC URLS ONLY, FROM THE SAME TABLE THE PAGES READ.
 * `sitemapRoutes()` requires `sitemap && index && !userDependent`, so a
 * private, transient or user-dependent surface cannot appear here even if
 * someone sets one field by mistake — the conjunction is the guard.
 *
 * NO `lastmod`, DELIBERATELY (§E). A sitemap `lastmod` is a claim about
 * when the PAGE last changed. These five routes have no change record:
 * the legal pages are static files with no publication date in the
 * product, and the home and map surfaces recompose continuously from
 * retrieved evidence, which is a different fact from the document being
 * modified. Emitting a build time or a fetch time here would be exactly
 * the fabricated change date §E forbids, and §J forbids converting
 * retrieval time into publication time. So the field is absent, and its
 * absence is honest.
 *
 * EMPTY WHEN NO ORIGIN IS CONFIGURED. A sitemap of relative or guessed
 * URLs is not a degraded sitemap, it is a wrong one.
 */
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = resolveSiteOrigin();
  if (origin === null) return [];

  return sitemapRoutes().flatMap((entry) => {
    const url = absoluteUrl(entry.path, origin);
    return url === null ? [] : [{ url }];
  });
}
