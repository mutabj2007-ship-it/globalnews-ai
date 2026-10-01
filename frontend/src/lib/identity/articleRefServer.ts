import { createHash } from 'node:crypto';
import { normalizeArticleUrl } from '@globalnews-ai/shared';

/**
 * HOME R1 · STAGE A — the governed story identity, computed where the Home is rendered.
 *
 *   articleRef = sha256(normalizeArticleUrl(url))   (backend news/identity/article-ref.util.ts)
 *
 * The SAME definition, over the SAME shared normalisation, in the server component that
 * already holds the feed — so a held / compared story carries the identity the backend
 * verifies (it recomputes this from the URL and refuses a mismatch). Server-only: imported
 * by the root page, never by a client module. It is an identity, not authority.
 */
export function articleRefFor(url: string): string {
  return createHash('sha256').update(normalizeArticleUrl(url), 'utf8').digest('hex');
}
