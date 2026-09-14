import { absoluteUrl, resolveSiteOrigin } from '@/lib/seo/siteOrigin';

/**
 * ═══ STRUCTURED DATA — ONLY WHAT THE RECORD ACTUALLY SUPPORTS ══════════
 *
 * WHY THERE IS NO `NewsArticle` ANYWHERE IN THIS WORK, AND WHY THAT IS
 * THE CORRECT ANSWER RATHER THAN A GAP.
 *
 * `NewsArticle` describes a news article published at the URL that
 * carries the markup. GlobalNews AI publishes none: the repository has
 * no dynamic route segment at all, and every article link in the product
 * — `SourceArticleCard`, `SourcesDrawer`, `AnalysisCitation`,
 * `LatestUpdatesFeed`, `AskCompactResult` — points at the ORIGINAL
 * publisher's URL with `target="_blank"`. There is no first-party
 * article page to annotate.
 *
 * Emitting `NewsArticle` on the home or map surface would therefore
 * assert a headline, a publication date, an author and a publisher for a
 * document this product did not publish. §G forbids every one of those
 * individually ("no invented author", "no invented publisher metadata",
 * "no fabricated entity data"), and doing it would also break the
 * original-source provenance the product exists to preserve.
 *
 * WHAT IS EMITTED IS ABOUT US, AND IS TRUE. `WebSite` and `Organization`
 * describe the site itself: its name, its URL, its languages. Every field
 * below is a fact already in the product — the wordmark `Logo.tsx`
 * renders, the origin Main configures, and the two languages the
 * dictionaries actually ship. No `logo`, no `sameAs`, no founding date,
 * no contact point: those would need values nobody has ruled.
 *
 * NO `SearchAction`. The obvious addition would be a sitelinks search box
 * pointing at `/search?q=`, and it is deliberately absent: §B rules
 * `/search` out as a discovery surface, so advertising it to crawlers as
 * this site's search endpoint would contradict the directive on the page
 * itself.
 *
 * FAIL CLOSED. With no configured origin there is no `url` to state, so
 * this renders nothing at all rather than a partial entity.
 */
export function SiteStructuredData(): JSX.Element | null {
  const origin = resolveSiteOrigin();
  if (origin === null) return null;

  /*
    The SAME construction the canonical and the sitemap use, so the home
    page's URL has exactly one spelling across the page, the sitemap and
    the structured data.
  */
  const home = absoluteUrl('/', origin) as string;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: home,
        name: 'GlobalNews AI',
        inLanguage: ['en', 'pl'],
        publisher: { '@id': `${origin}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'GlobalNews AI',
        url: home,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      data-seo="site-structured-data"
      /*
        `JSON.stringify` output only. No interpolation of user or
        retrieved content reaches this tag, so there is no path by which
        page data could close the script element.
      */
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
