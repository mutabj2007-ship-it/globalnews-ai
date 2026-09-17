import { readFileSync } from 'fs';
import { join } from 'path';

import { computeSourceDiversity } from './compute-source-diversity.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * L-4 — WHY "N ARTICLES" AND "N ITEMS" ARE ALLOWED TO DISAGREE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The frontend's Complete Record button shows `sourceSupport.length`, which is
 * `response.articles.length` — the DEDUPED, capped set the model was shown.
 * Telemetry shows `sourceDiversity.retrievedArticleCount`, which is computed
 * over the ORIGINAL retrieved pool, before de-duplication and before the cap.
 *
 * So the two numbers measure different things and can legitimately differ on
 * one screen. That is deliberate: computing diversity from the deduped array
 * would make duplicate concentration invisible by construction — the very thing
 * the metric exists to expose.
 *
 * This spec pins the basis, because the whole L-4 finding rests on it. If the
 * call site ever switched to `deduped`, the counters would silently start
 * reporting one, and no unit test of the util alone would notice.
 */

const article = (i: number, over: Record<string, unknown> = {}) =>
  ({
    id: `a${i}`,
    title: `Report ${i}`,
    summary: `Summary ${i}.`,
    url: `https://outlet${i}.example.com/story-${i}`,
    sourceId: `src${i}`,
    sourceName: `Outlet ${i}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-15T00:00:00.000Z',
    ...over,
  }) as never;

describe('L-4 — the retrieval counter counts the pool, not the final set', () => {
  describe('THE CALL SITE USES THE PRE-DEDUP ARRAY', () => {
    const service = readFileSync(
      join(__dirname, '..', 'service', 'analysis.service.ts'),
      'utf-8',
    );

    it('passes `articles`, never `deduped`', () => {
      expect(service).toContain('computeSourceDiversity(articles)');
      expect(service).not.toContain('computeSourceDiversity(deduped)');
    });

    it('and the response ships `deduped` as its articles, which is the other count', () => {
      /*
        This is the pair that makes the two figures diverge. Both are correct;
        neither is labelled on screen in a way that distinguishes them, which is
        the L-4 finding recorded for the Claude Design redesign.
      */
      expect(service).toContain('buildSourceEntities(deduped)');
    });
  });

  describe('THE COUNTER ITSELF REPORTS WHAT IT WAS GIVEN', () => {
    it('retrievedArticleCount is the length of the input array', () => {
      const articles = [article(1), article(2), article(3)];

      expect(computeSourceDiversity(articles).retrievedArticleCount).toBe(3);
    });

    it('duplicates inflate the retrieval count and NOT the cluster count', () => {
      /*
        The measurement that proves the basis matters. Three near-identical
        reports of one story are three retrieved articles and fewer distinct
        reportings — which is only visible because diversity sees the pool.
      */
      const duplicates = [
        article(1, { title: 'Ministry confirms tax proposal returns to committee' }),
        article(2, { title: 'Ministry confirms tax proposal returns to committee' }),
        article(3, { title: 'Ministry confirms tax proposal returns to committee' }),
      ];
      const diversity = computeSourceDiversity(duplicates);

      expect(diversity.retrievedArticleCount).toBe(3);
      expect(diversity.reportingClusterCount).toBeLessThan(diversity.retrievedArticleCount);
    });

    it('an empty pool reports zero rather than being omitted', () => {
      expect(computeSourceDiversity([]).retrievedArticleCount).toBe(0);
    });
  });

  describe('THE COUNTERS ARE FOUR DIFFERENT QUANTITIES, NOT ONE RENDERED FOUR WAYS', () => {
    it('distinct outlets, distinct domains and article count can all differ', () => {
      /*
        Two articles from one outlet on one domain, plus one from another:
        3 articles, 2 domains, 2 source names. If any pair of these were the
        same metric they could not diverge here.
      */
      const articles = [
        article(1, { sourceName: 'Outlet A', url: 'https://a.example.com/1' }),
        article(2, { sourceName: 'Outlet A', url: 'https://a.example.com/2' }),
        article(3, { sourceName: 'Outlet B', url: 'https://b.example.com/1' }),
      ];
      const diversity = computeSourceDiversity(articles);

      expect(diversity.retrievedArticleCount).toBe(3);
      expect(diversity.distinctSourceNameCount).toBe(2);
    });
  });
});
