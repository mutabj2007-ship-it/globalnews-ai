import type { NewsArticle } from '@globalnews-ai/shared';

export interface HomeFeedAllocation {
  /** The single lead story — currently selected by response order (position 0); no popularity/engagement claim is made or implied by this selection. */
  featured: NewsArticle | null;
  /** A small set of additional notable stories, guaranteed distinct from `featured` by article id. Replaces the former "trending" concept — this is a curated selection, not a measured popularity signal. */
  inFocus: NewsArticle[];
  /** A further set of stories for exploration, guaranteed distinct from both `featured` and `inFocus` by article id. */
  discovery: NewsArticle[];
  /** The complete set, sorted by publishedAt descending. Unlike the other three roles, this MAY legitimately repeat a story already shown in featured/inFocus/discovery — it represents "everything, in time order," not a curated subset. */
  latestUpdates: NewsArticle[];
}

const DEFAULT_IN_FOCUS_COUNT = 5;
const DEFAULT_DISCOVERY_COUNT = 6;

/**
 * Milestone #51 Phase B — pure curation/partition helper, extracted
 * out of page.tsx (which previously contained this positional slicing
 * directly: `headlines[0]`, `headlines.slice(1, 6)`,
 * `headlines.slice(6, 12)`). Deliberately pure: no fetching, no I/O,
 * fully unit-testable in isolation. Takes the SAME single
 * already-fetched article list every homepage section draws from —
 * this function does not introduce any new request.
 *
 * `featured`, `inFocus`, and `discovery` are guaranteed to contain no
 * duplicate article (by `id`) across the three of them — an article
 * selected as `featured` can never also appear in `inFocus` or
 * `discovery`, and an article in `inFocus` can never also appear in
 * `discovery`. `latestUpdates` is deliberately exempt from this
 * exclusivity: it is the complete chronological record and is
 * expected to naturally include stories already surfaced above it.
 *
 * Never mutates the input array or any article object within it —
 * `latestUpdates` is built from a shallow copy (`[...articles]`)
 * before sorting; `inFocus`/`discovery` are built by pushing existing
 * article references into new arrays, never altering them.
 *
 * Handles empty and undersupplied input gracefully: with fewer than
 * 12 articles (or zero), each role simply receives as many genuinely
 * distinct articles as are available, down to `featured: null` and
 * empty arrays for a fully empty input — never throws.
 */
export function allocateHomeFeed(
  articles: NewsArticle[],
  inFocusCount: number = DEFAULT_IN_FOCUS_COUNT,
  discoveryCount: number = DEFAULT_DISCOVERY_COUNT,
): HomeFeedAllocation {
  const featured = articles[0] ?? null;
  const usedIds = new Set<string>();
  if (featured) {
    usedIds.add(featured.id);
  }

  const inFocus: NewsArticle[] = [];
  for (const article of articles) {
    if (inFocus.length >= inFocusCount) break;
    if (usedIds.has(article.id)) continue;
    inFocus.push(article);
    usedIds.add(article.id);
  }

  const discovery: NewsArticle[] = [];
  for (const article of articles) {
    if (discovery.length >= discoveryCount) break;
    if (usedIds.has(article.id)) continue;
    discovery.push(article);
    usedIds.add(article.id);
  }

  const latestUpdates = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return { featured, inFocus, discovery, latestUpdates };
}
