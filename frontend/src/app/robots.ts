import type { MetadataRoute } from 'next';
import { DISALLOWED_PREFIXES } from '@/lib/seo/routes';
import { absoluteUrl, resolveSiteOrigin } from '@/lib/seo/siteOrigin';

/**
 * ═══ /robots.txt ═══════════════════════════════════════════════════════
 *
 * CORRECTED BY CTO REV A BLOCKER 1. R1 disallowed the §B HTML routes —
 * `/admin`, `/account`, `/history`, `/search`, `/support`, `/workspace` —
 * and described that as complementing their `noindex`. It did the
 * opposite.
 *
 * **A `noindex` rule must be crawlable to be obeyed.** A blocked URL is
 * never fetched, so the directive on the page is never read, and the URL
 * can still appear in results when it is discovered from somewhere else.
 * R1 was therefore using one control to defeat the other, on precisely
 * the surfaces where exclusion matters most.
 *
 * Those routes are now CRAWLABLE ON PURPOSE. Each still carries
 * `noindex, nofollow` in its own metadata — see `lib/seo/routes.ts` — and
 * that directive is the mechanism. `Allow: /` covers them.
 *
 * `/api` stays disallowed for crawl management alone, not to hide a
 * directive: JSON endpoints carry no meta robots tag, so nothing is
 * concealed by not crawling them.
 *
 * NEITHER FORM IS A SECURITY CONTROL, and the correction does not weaken
 * one. §D says so, and it bears repeating where the list lives: a crawler
 * that ignores every line of this file still cannot reach `/admin` or
 * `/account`, because the existing authentication boundary stops it. That
 * boundary is untouched by this work. Robots rules govern DISCOVERY only.
 *
 * The sitemap and host lines are advertised only when an origin is
 * configured. A `Sitemap:` line pointing at the wrong host is worse than
 * none.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const origin = resolveSiteOrigin();
  const sitemap = absoluteUrl('/sitemap.xml', origin);

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...DISALLOWED_PREFIXES],
      },
    ],
    ...(sitemap === null ? {} : { sitemap }),
    ...(origin === null ? {} : { host: origin }),
  };
}
