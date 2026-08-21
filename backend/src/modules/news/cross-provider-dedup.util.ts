import type { NewsArticle } from '@globalnews-ai/shared';
import { deduplicateArticles } from './country/deduplicate-articles.util';

/**
 * E1 — sentinel rank for an article with no `providerId`, or one whose
 * `providerId` isn't in the active registration order. Ranks after
 * every known provider, so a provenance-less article never outranks an
 * article that genuinely records where it came from.
 */
const UNKNOWN_PROVIDER_RANK = Number.MAX_SAFE_INTEGER;

function providerRank(article: NewsArticle, providerRanks: ReadonlyMap<string, number>): number {
  if (article.providerId === undefined) {
    return UNKNOWN_PROVIDER_RANK;
  }

  return providerRanks.get(article.providerId) ?? UNKNOWN_PROVIDER_RANK;
}

/**
 * E1 — the deterministic winner rule for a cross-provider duplicate
 * group, as a TOTAL order over articles.
 *
 * Applied in this exact sequence:
 *
 * 1. Higher `sourcesCount` wins. This is the only content-derived
 *    quality signal every provider already populates: it is the number
 *    of distinct outlets the provider itself says are carrying the
 *    story. More corroboration wins.
 * 2. Earlier registration order wins. Registration order is the
 *    deployment's own declared provider preference (news.module.ts's
 *    `realCandidates` array), so this is a configured decision, not an
 *    accident of which HTTP response happened to land first.
 * 3. Lexicographically smaller `id` wins. Ids are unique within the
 *    merged set (exact-id dedup has already run), so this final step
 *    makes the order TOTAL — there is no pair of distinct articles the
 *    comparator calls equal.
 *
 * Totality is what makes the surviving article deterministic: because
 * no two distinct articles compare equal, the sorted order — and
 * therefore the winner of every duplicate group — does not depend on
 * the input order, on Array.prototype.sort's stability, or on which
 * provider's promise settled first.
 *
 * Deliberately NOT part of the rule: `publishedAt` (two outlets
 * publishing the same wire story minutes apart says nothing about
 * which record is better), and `isMock` (a mock provider can never be
 * in the same active set as a real one — see
 * news-provider-registry.ts — so the case cannot arise).
 */
export function compareCrossProviderPreference(
  first: NewsArticle,
  second: NewsArticle,
  providerRanks: ReadonlyMap<string, number>,
): number {
  if (first.sourcesCount !== second.sourcesCount) {
    return second.sourcesCount - first.sourcesCount;
  }

  const firstRank = providerRank(first, providerRanks);
  const secondRank = providerRank(second, providerRanks);

  if (firstRank !== secondRank) {
    return firstRank - secondRank;
  }

  if (first.id === second.id) {
    return 0;
  }

  return first.id < second.id ? -1 : 1;
}

/**
 * E1 — collapses articles that different providers are carrying as the
 * same story.
 *
 * WHY THIS EXISTS. NewsService's merge step deduplicates on
 * `article.id`, and every provider namespaces its own ids (GNews emits
 * `gnews-<hash-of-url>`, the mock wire emits `mock-<slug>`). Two
 * providers carrying the identical story therefore produce two
 * different ids, and id-based dedup cannot see them as one. That was
 * harmless while exactly one provider could ever be active; with an
 * accumulating real-provider set it is not.
 *
 * NO SECOND DEDUP ALGORITHM. The similarity decision is made by the
 * repository's existing `deduplicateArticles` /
 * `areLikelyDuplicateArticles` pair (country/deduplicate-articles.util.ts),
 * already used by CountryNewsService and AnalysisService, unchanged and
 * un-forked. This function contributes only the ORDER that utility is
 * handed, which is what turns "keeps whichever came first" into
 * "keeps a deterministic, content-preferred winner".
 *
 * HOW IT PRESERVES RESPONSE ORDER. The preference order is used solely
 * to decide WHICH articles survive; the survivors are then returned in
 * the caller's original order. Sorting for recency, capping to `limit`
 * and every other downstream step therefore behave exactly as before.
 *
 * Returns the input array unchanged when there is nothing that could
 * possibly collapse (fewer than two articles).
 */
export function collapseCrossProviderDuplicates(
  articles: NewsArticle[],
  providerOrder: readonly string[],
): NewsArticle[] {
  if (articles.length < 2) {
    return articles;
  }

  const providerRanks = new Map<string, number>();
  providerOrder.forEach((providerId, index) => {
    if (!providerRanks.has(providerId)) {
      providerRanks.set(providerId, index);
    }
  });

  const byPreference = [...articles].sort((first, second) =>
    compareCrossProviderPreference(first, second, providerRanks),
  );

  const survivingIds = new Set(deduplicateArticles(byPreference).map((article) => article.id));

  return articles.filter((article) => survivingIds.has(article.id));
}
