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
 * followed-places-first and its own cap of five. The page no longer calls this
 * directly: allocateHomeFirstScreen (below) builds on it.
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
 * HOME R2 60-SECOND ALLOCATION STARVATION CORRECTION R1 — ONE FIRST-SCREEN PARTITION.
 *
 * The defect (PR #61, live Alpha): the 60-second module read only the exclusive
 * remainder `latestUpdates`. When the live response is narrow enough that
 * featured + inFocus + discovery consume every story, that remainder is empty
 * and the right rail showed its empty-state card beside a full What's happening.
 *
 * Rule (CTO): the two modules stay mutually exclusive AND both stay populated
 * whenever at least two distinct Home stories exist.
 *
 * A. worldIn60 starts from the truly disjoint `latestUpdates` (allocateWorldIn60).
 * B. Below W60_MAX, the governed brief head (`briefUpdates`: chronological, minus
 *    the featured story, max 3) is the fallback. A brief story is TRANSFERRED,
 *    never copied: if it sits in inFocus/discovery it leaves What's happening.
 *    The featured story is never transferred.
 * C. What's happening keeps at least whatsFloor(initial count):
 *    0–1 → all of them, 2 → 1, 3 → 2, ≥4 → 3.
 * D. The final 60-second set is ordered newest first (stable) before the
 *    module's followed-places preference.
 * E. Identity is article id AND the shared normalizeArticleUrl — no second rule.
 *
 * Pure: a reading of the ONE Home response. No request, no AI, nothing invented.
 */
export const W60_MAX = 5;

export interface HomeFirstScreenSource extends WorldIn60Source {
  briefUpdates: readonly NewsArticle[];
}

export interface HomeFirstScreen {
  worldIn60: NewsArticle[];
  whats: {
    featured: NewsArticle | null;
    inFocus: NewsArticle[];
    discovery: NewsArticle[];
  };
}

export function whatsFloor(initialCount: number): number {
  if (initialCount <= 1) return initialCount;
  return Math.min(initialCount - 1, 3);
}

const sameStory = (a: NewsArticle, b: NewsArticle): boolean => {
  if (a.id === b.id) return true;
  const ua = urlKey(a);
  return ua !== null && ua === urlKey(b);
};

export function allocateHomeFirstScreen(feed: HomeFirstScreenSource): HomeFirstScreen {
  const featured = feed.featured;
  const inFocus = [...feed.inFocus];
  const discovery = [...feed.discovery];
  const whatsCount = (): number => (featured === null ? 0 : 1) + inFocus.length + discovery.length;
  const floor = whatsFloor(whatsCount());

  // A — the disjoint remainder.
  const worldIn60 = allocateWorldIn60(feed);

  // B/C — transfer brief stories while the 60-second module is short and What's happening can spare one.
  for (const candidate of feed.briefUpdates) {
    if (worldIn60.length >= W60_MAX || whatsCount() <= floor) break;
    if (featured !== null && sameStory(candidate, featured)) continue;
    if (worldIn60.some((story) => sameStory(story, candidate))) continue;
    // Transfer: remove every What's happening copy of the story (id or canonical URL), then place it here.
    for (const role of [inFocus, discovery]) {
      for (let i = role.length - 1; i >= 0; i--) {
        if (sameStory(role[i], candidate)) role.splice(i, 1);
      }
    }
    worldIn60.push(candidate);
  }

  // D — newest first, stable, so a transferred newer story can lead.
  worldIn60.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return { worldIn60, whats: { featured, inFocus, discovery } };
}
