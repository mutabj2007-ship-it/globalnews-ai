import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * STAGE B — THE RETAINED-ARTICLE OBSERVATION SEAM (port).
 *
 * After `persistMany` has COMMITTED a batch, the persistence service hands the same batch to
 * an optional observer. The news module defines only this port; it does not import the
 * stories module, does not know what observes, and stays session-blind.
 *
 * Contract for any implementation:
 *   - DATABASE ONLY: no provider, no model, no network, no scheduler;
 *   - bounded per call;
 *   - idempotent under re-observation of the same article;
 *   - NEVER throws into the caller (the persistence service also catches and logs, so an
 *     observation failure can never fail news retrieval).
 */
export const RETAINED_ARTICLE_OBSERVER = Symbol('RETAINED_ARTICLE_OBSERVER');

export interface RetainedArticleObserver {
  observeRetained(articles: readonly NewsArticle[]): Promise<void>;
}
