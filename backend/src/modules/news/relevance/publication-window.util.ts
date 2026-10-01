import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * BETA-ASK-005 — does a report's TRUSTWORTHY publication time lie inside [from, to]? Only a
 * publisher-stated time counts: an aggregator's observation time is not a publication time,
 * and an absent or unparseable time can never satisfy a strict window.
 *
 * CTO ADDENDUM — APPLIED BEFORE ANY DEDUPLICATION. Every duplicate collapse in the retrieval
 * path keeps the FIRST copy it meets; if an out-of-window copy came first, the in-window copy of
 * the same story would be discarded as its duplicate and the window filter would then drop the
 * survivor. Strict eligibility is therefore decided per provider candidate, before any collapse.
 */
export function publishedInsideWindow(
  article: Pick<NewsArticle, 'publishedAt' | 'publishedAtBasis'>,
  from: string,
  to: string,
): boolean {
  if (article.publishedAtBasis !== 'publisher') return false;
  const at = Date.parse(article.publishedAt ?? '');
  const start = Date.parse(from);
  const end = Date.parse(to);
  return (
    Number.isFinite(at) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    at >= start &&
    at <= end
  );
}
