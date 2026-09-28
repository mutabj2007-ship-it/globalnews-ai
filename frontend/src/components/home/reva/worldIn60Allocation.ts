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

/**
 * HOME R2 DEDUP R1 — PRODUCT OWNER FOLLOW-UP: THE 60-SECOND IMAGE STAYS.
 *
 * On a small response (the GNews Free plan returns ~10 stories), What's
 * happening now takes every story and `latestUpdates` is empty, so the
 * 60-second module lost its image-led lead. The PO rejected that: the module
 * keeps its lead image AND shares no story with What's happening now.
 *
 * So the first screen is allocated as ONE partition of the same response:
 * - the 60-second module takes the disjoint leftovers first;
 * - while it has fewer than W60_TARGET stories and What's happening now holds
 *   more than WHATS_MIN (the four cards visible on desktop), the lowest-priority
 *   What's happening story (discovery tail, then inFocus tail) MOVES to it —
 *   removed from What's happening, never copied;
 * - with fewer stories still, the 60-second module keeps at least one lead as
 *   long as What's happening keeps at least one card. Only a one-story response
 *   leaves it empty.
 * `featured` never moves. Still a pure reading of the ONE Home response.
 */
export const W60_TARGET = 5;
export const WHATS_MIN = 4;

export interface HomeFirstScreen {
  featured: NewsArticle | null;
  inFocus: NewsArticle[];
  discovery: NewsArticle[];
  worldIn60: NewsArticle[];
}

export function allocateHomeFirstScreen(feed: WorldIn60Source): HomeFirstScreen {
  const leftovers = allocateWorldIn60(feed);
  const inFocus = [...feed.inFocus];
  const discovery = [...feed.discovery];
  const whatsCount = (): number => (feed.featured === null ? 0 : 1) + inFocus.length + discovery.length;
  const take = (): NewsArticle | undefined => discovery.pop() ?? inFocus.pop();

  const moved: NewsArticle[] = [];
  const moveOne = (): void => {
    const article = take();
    if (article !== undefined) moved.push(article);
  };
  while (leftovers.length + moved.length < W60_TARGET && whatsCount() > WHATS_MIN) moveOne();
  if (leftovers.length + moved.length === 0 && whatsCount() >= 2) moveOne();

  const worldIn60 = [...leftovers, ...moved].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return { featured: feed.featured, inFocus, discovery, worldIn60 };
}

/** The lead is image-led: bring the first story with a real image to the front of the shown set. */
export function preferImageLead<T extends { imageUrl?: string }>(items: readonly T[]): T[] {
  if (items.length === 0 || items[0].imageUrl) return [...items];
  const index = items.findIndex((item) => Boolean(item.imageUrl));
  if (index <= 0) return [...items];
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}
