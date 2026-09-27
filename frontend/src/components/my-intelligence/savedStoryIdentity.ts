/**
 * SAVED STORY IDENTITY — CANONICAL URL, NEVER THE ARTICLE ID.
 *
 * Frozen authority: MY-INTELLIGENCE-R1.2 `SAVED_STORIES.md` §Principle.
 * Capability authority: MY INTELLIGENCE DATA CAPABILITY SHEET R1 §5.
 *
 * ── WHY `Article.id` CANNOT BE THE IDENTITY ──────────────────────────────
 *
 * It is a 32-bit rolling hash of the URL (`gnews-${abs(hash)}`), it is
 * provider-specific, and it can collide. Persistence upserts on
 * `Article.url @unique`, so where two providers carry one story the FIRST
 * provider's id wins and the second is never seen again. Keying saved items on
 * it would silently attach one reader's saved story to a different article.
 *
 * The identity is therefore the normalized article URL. `normalizeArticleUrl`
 * is the existing SHARED function, so the frontend and the backend derive the
 * same reference from the same input — which is what makes a saved reference
 * survive `Article` row churn and retention purges.
 *
 * ── THIS LANE PERSISTS NOTHING ───────────────────────────────────────────
 *
 * There is no SavedStory table, no `/saved` endpoint and no migration in this
 * frontend lane, by instruction. What this module does is fix the KEY now, so
 * that when the persistence lane arrives it inherits a frontend that was never
 * written against the article id. Saved state here lives in React state for
 * the life of the page and is gone on reload; nothing is written to
 * localStorage, sessionStorage, IndexedDB or a cookie.
 */

import { normalizeArticleUrl } from '@globalnews-ai/shared';

/** The stable reference for a saved story: the normalized URL. */
export function savedStoryRef(url: string): string {
  return normalizeArticleUrl(url);
}

/**
 * The reference contract, as R1.2 states it.
 *
 * `providerArticleId` is present ONLY because the authority permits retaining
 * it as a hint. Nothing in this codebase may look a saved story up by it, and
 * the field name says so.
 */
export interface SavedStoryReference {
  /** Identity. `normalizeArticleUrl(url)`. */
  readonly articleRef: string;
  /** Link-out target, and the input that makes `articleRef` re-derivable. */
  readonly canonicalUrl: string;
  /** The provider URL as received. Audit trail and link-out fallback. */
  readonly sourceUrl: string;
  /** NON-AUTHORITATIVE hint. Never a lookup key. */
  readonly providerArticleIdHint?: string;
}

export function toSavedStoryReference(article: {
  url: string;
  id?: string;
}): SavedStoryReference {
  return {
    articleRef: savedStoryRef(article.url),
    canonicalUrl: normalizeArticleUrl(article.url),
    sourceUrl: article.url,
    providerArticleIdHint: article.id,
  };
}

/** Two saved entries are the same story when their canonical references match. */
export function isSameSavedStory(a: SavedStoryReference, b: SavedStoryReference): boolean {
  return a.articleRef === b.articleRef;
}
