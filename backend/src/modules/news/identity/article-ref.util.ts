import { createHash } from 'crypto';
import { ARTICLE_REF_PATTERN, normalizeArticleUrl } from '@globalnews-ai/shared';

/**
 * MY INTELLIGENCE R1 — THE STORY IDENTITY.
 *
 *   articleRef = sha256(normalizeArticleUrl(url)), 64 lowercase hex chars.
 *
 * The canonical URL is the story's identity everywhere in the product; the
 * provider's article id is a weak 32-bit hash (see NewsArticle.id) and is
 * never identity. Normalization is the shared, fail-closed authority, so two
 * spellings of the same article URL (tracking parameters, case, trailing
 * slash) are the same story, and an unparseable URL is hashed as given rather
 * than guessed at.
 */
export function computeArticleRef(url: string): string {
  return createHash('sha256').update(normalizeArticleUrl(url), 'utf8').digest('hex');
}

export function isArticleRef(value: unknown): value is string {
  return typeof value === 'string' && ARTICLE_REF_PATTERN.test(value);
}

/** True only when `articleRef` is exactly the identity of `url`. */
export function articleRefMatchesUrl(articleRef: string, url: string): boolean {
  return isArticleRef(articleRef) && computeArticleRef(url) === articleRef;
}
