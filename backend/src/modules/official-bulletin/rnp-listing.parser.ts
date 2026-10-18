import { createHash } from 'node:crypto';
import { rnpHeadlineCountry, type RnpGeography } from './rnp-headline-country';

/*
  Rwanda National Police news listing (https://police.gov.rw/media/news/, TYPO3 tx_news) → permitted fields only.

  E1 ADDENDUM-02 §3 field contract: item URL · source-stated publication date · "Rwanda National Police" ·
  country-level event geography. The listing title exists here for one statement only — the ADDENDUM-05 country
  derivation and a SHA-256 de-duplication key — and is not returned, stored or logged. No body, paragraph or image
  is read. The stable identity is the news slug, never the TYPO3 cHash (a cache hash, not an identifier).

  Shape pinned against one permitted capture of the live listing (2026-10-18): `<base href="https://police.gov.rw/">`,
  blocks `class="single-news …"`, a detail link `media/news-detail/news/<slug>/?tx_news_pi1…&cHash=…`,
  `<time itemprop="datePublished" datetime="YYYY-MM-DD">` and `<h3 class="news-title"><a …>title</a></h3>`.
*/
export const RNP_HOST = 'police.gov.rw';
export const RNP_PUBLISHER = 'Rwanda National Police';
const RNP_BASE = `https://${RNP_HOST}/`;
export const RNP_MAX_ITEMS = 10;

export interface RnpListingItem {
  /** The news slug: the stable identity. */
  readonly slug: string;
  /** The link to the official page, exactly as the listing gives it (host-checked). */
  readonly url: string;
  /** Source-stated publication date, `YYYY-MM-DD`. Never the retrieval date. */
  readonly publishedOn: string;
  readonly geography: RnpGeography;
  /** SHA-256 of the listing title: change detection only. The title itself is not kept. */
  readonly titleKey: string;
}

export interface RnpListingParse {
  readonly items: readonly RnpListingItem[];
  /** Blocks dropped for a missing or foreign link, or a missing/invalid date. */
  readonly dropped: number;
  /** Whether the page carried the listing container at all (zero items without it is a parse failure). */
  readonly listingMarkup: boolean;
}

const decodeAttr = (value: string): string => value.replace(/&amp;/g, '&');
const stripTags = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

export function parseRnpListing(html: string): RnpListingParse {
  const blocks = html.split(/class="single-news\b/).slice(1);
  const bySlug = new Map<string, RnpListingItem>();
  let dropped = 0;
  for (const block of blocks) {
    const href = /href="(media\/news-detail\/news\/[^"]+)"/.exec(block)?.[1];
    const date = /<time\b[^>]*\bdatetime="(\d{4}-\d{2}-\d{2})"/.exec(block)?.[1];
    const titleHtml = /<h3 class="news-title">\s*<a\b[^>]*>([\s\S]*?)<\/a>/.exec(block)?.[1];
    if (href === undefined || date === undefined || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      dropped += 1;
      continue;
    }
    let url: URL;
    try {
      url = new URL(decodeAttr(href), RNP_BASE);
    } catch {
      dropped += 1;
      continue;
    }
    const slug = /^\/media\/news-detail\/news\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    if (url.protocol !== 'https:' || url.hostname !== RNP_HOST || slug === undefined) {
      dropped += 1;
      continue;
    }
    if (bySlug.has(slug)) continue;
    const title = titleHtml === undefined ? '' : stripTags(titleHtml);
    bySlug.set(slug, {
      slug,
      url: url.toString(),
      publishedOn: date,
      geography: rnpHeadlineCountry(title),
      titleKey: createHash('sha256').update(title).digest('hex'),
    });
  }
  const items = [...bySlug.values()]
    .sort((a, b) => (a.publishedOn < b.publishedOn ? 1 : a.publishedOn > b.publishedOn ? -1 : 0))
    .slice(0, RNP_MAX_ITEMS);
  return { items, dropped, listingMarkup: blocks.length > 0 };
}
