import type { NewsArticle, SourceDiversity } from '@globalnews-ai/shared';
import { clusterArticlesWithMembership } from './cluster-articles.util';

/**
 * Milestone #43 — Evidence Source Diversity & Corroboration.
 *
 * Purely deterministic, zero AI calls, zero network calls. Operates on
 * the ORIGINAL retrieved article pool — the exact array AnalysisService
 * has immediately before calling clusterDuplicateArticles()/the
 * maxArticles cap — never the post-cluster/post-cap/post-citation
 * populations. See SourceDiversity's own doc comment in
 * shared/src/analysis.ts for the full non-authority statement (this
 * cannot prove editorial independence or true syndication origin).
 *
 * Reuses clusterArticlesWithMembership() for clustering — no second
 * Jaccard/title-similarity implementation exists here or anywhere else.
 *
 * Has NO effect on Milestone #41/#42 trust scoring: this module is
 * never imported by derive-trust-state.util.ts,
 * build-relational-composition.util.ts,
 * resolve-relational-evidence-assessment.util.ts, or
 * validate-analysis-result.ts.
 */

/**
 * Milestone #43 domain normalization — lowercase hostname, strip a
 * leading "www.", nothing else. No arbitrary subdomain collapsing (e.g.
 * "news.example.com" is NOT treated as the same domain as
 * "example.com" — this repository has no basis to prove that safely).
 * A malformed/unparseable URL returns null and is NEVER counted as its
 * own distinct domain — see unknownDomainArticleCount.
 */
function extractNormalizedDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}

/**
 * Milestone #43 sourceName rule (binding clarification): counts
 * distinct NON-EMPTY provider-supplied sourceName strings. Whitespace
 * is trimmed ONLY to determine whether a value is empty — the ORIGINAL,
 * untrimmed, un-normalized string is what's used as the distinctness
 * key once it passes that check. Never lowercased, aliased, or merged.
 */
function countDistinctSourceNames(articles: NewsArticle[]): number {
  const names = new Set<string>();
  for (const article of articles) {
    if (article.sourceName && article.sourceName.trim().length > 0) {
      names.add(article.sourceName);
    }
  }
  return names.size;
}

export function computeSourceDiversity(articles: NewsArticle[]): SourceDiversity {
  const clusters = clusterArticlesWithMembership(articles);
  const clusterSizes = clusters.map((cluster) => cluster.members.length);

  const domains = new Set<string>();
  let unknownDomainArticleCount = 0;
  for (const article of articles) {
    const domain = extractNormalizedDomain(article.url);
    if (domain) {
      domains.add(domain);
    } else {
      unknownDomainArticleCount += 1;
    }
  }
  const knownDomainCount = domains.size;

  return {
    retrievedArticleCount: articles.length,
    reportingClusterCount: clusters.length,
    duplicateLikeClusterCount: clusterSizes.filter((size) => size >= 2).length,
    largestClusterSize: clusterSizes.length > 0 ? Math.max(...clusterSizes) : 0,
    knownDomainCount,
    unknownDomainArticleCount,
    distinctSourceNameCount: countDistinctSourceNames(articles),
  };
}
