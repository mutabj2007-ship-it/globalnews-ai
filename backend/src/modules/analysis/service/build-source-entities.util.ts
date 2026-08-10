import type { NewsArticle, ResolvedOrganizationMention, SourceEntities } from '@globalnews-ai/shared';
import { extractArticleEntities } from '../../news/analysis/article-entities.util';

/**
 * Milestone #29 — builds the response-level SourceEntities from a
 * final article set.
 *
 * The caller MUST pass the same final, de-duplicated, truncated
 * article array that is also returned as AnalysisApiResponse.articles
 * (i.e. `deduped` in analysis.service.ts) — never the pre-dedup or
 * pre-truncation article list. This function does not know or care
 * about de-duplication/truncation itself; it simply extracts and
 * aggregates over whatever it is given, so the grounding guarantee
 * ("every articleId in the result belongs to the supplied array")
 * holds by construction as long as the caller passes the right array.
 *
 * Deterministic and entirely independent of the AI provider — this
 * only ever looks at article.title/summary via extractArticleEntities.
 */
export function buildSourceEntities(articles: NewsArticle[]): SourceEntities {
  const matchedFromByCanonical = new Map<string, Set<string>>();
  const articleIdsByCanonical = new Map<string, Set<string>>();
  const canonicalOrder: string[] = [];

  for (const article of articles) {
    const { organizationMatches } = extractArticleEntities(article);
    if (!organizationMatches) continue;

    for (const match of organizationMatches) {
      if (!matchedFromByCanonical.has(match.canonical)) {
        matchedFromByCanonical.set(match.canonical, new Set());
        articleIdsByCanonical.set(match.canonical, new Set());
        canonicalOrder.push(match.canonical);
      }

      const matchedFromSet = matchedFromByCanonical.get(match.canonical)!;
      for (const surfaceForm of match.matchedFrom) {
        matchedFromSet.add(surfaceForm);
      }

      articleIdsByCanonical.get(match.canonical)!.add(article.id);
    }
  }

  const organizations: ResolvedOrganizationMention[] = canonicalOrder.map((canonical) => ({
    canonical,
    matchedFrom: Array.from(matchedFromByCanonical.get(canonical)!),
    articleIds: Array.from(articleIdsByCanonical.get(canonical)!),
  }));

  return { organizations };
}
