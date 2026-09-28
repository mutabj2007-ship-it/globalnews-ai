import { normalizeArticleUrl, type NewsArticle } from '@globalnews-ai/shared';

/**
 * HOME R2 STORY DEDUPLICATION R1 — YOUR WORLD IN 60 SECONDS IS ITS OWN POOL.
 *
 * The defect (entered with Rev A, 4843c29 / PR #59): the page merged
 * featured + inFocus + discovery + latestUpdates, sorted it newest first and
 * handed THAT to the 60-second module, while What's happening now rendered
 * featured + inFocus + discovery. Both modules therefore drew from the same
 * editorial stories, and on a normal day showed the same headlines side by side.
 *
 * Product Owner ruling: the two modules have different editorial roles and must
 * never show the same story at the same time. So:
 *
 * - The pool is `latestUpdates`: under the allocator's default `'exclusive'`
 *   policy it is already what remains after featured / inFocus / discovery.
 * - That exclusion is enforced AGAIN here, by article id AND by normalized
 *   canonical URL, so a caller-side change or a duplicate id/URL variant can
 *   never re-admit a What's happening story.
 * - Within the pool a story appears once (id and URL).
 * - Nothing pads the module. Fewer eligible stories means fewer rows, down to
 *   none. No second request, no AI, no invented story: this is a pure reading of
 *   the ONE Home response already in hand.
 *
 * Order is preserved (`latestUpdates` arrives newest first); the module applies
 * followed-places-first and its own cap of five.
 */
export interface WorldIn60Source {
  featured: NewsArticle | null;
  inFocus: readonly NewsArticle[];
  discovery: readonly NewsArticle[];
  latestUpdates: readonly NewsArticle[];
}

const urlKey = (article: NewsArticle): string | null => {
  const url = article.url?.trim();
  return url ? normalizeArticleUrl(url) : null;
};

export function allocateWorldIn60(feed: WorldIn60Source): NewsArticle[] {
  const editorial = [...(feed.featured === null ? [] : [feed.featured]), ...feed.inFocus, ...feed.discovery];
  const usedIds = new Set<string>();
  const usedUrls = new Set<string>();
  const claim = (article: NewsArticle): void => {
    usedIds.add(article.id);
    const url = urlKey(article);
    if (url !== null) usedUrls.add(url);
  };
  for (const article of editorial) claim(article);

  const pool: NewsArticle[] = [];
  for (const article of feed.latestUpdates) {
    const url = urlKey(article);
    if (usedIds.has(article.id) || (url !== null && usedUrls.has(url))) continue;
    claim(article);
    pool.push(article);
  }
  return pool;
}
