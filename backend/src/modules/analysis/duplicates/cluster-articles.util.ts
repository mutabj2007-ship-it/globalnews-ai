import type { NewsArticle } from '@globalnews-ai/shared';

const TITLE_SIMILARITY_THRESHOLD = 0.6;
const TIME_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'to',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'with',
  'at',
  'by',
  'as',
  'it',
  'its',
  'this',
  'that',
  'after',
  'over',
  'amid',
  'new',
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Milestone #43 (URL identity correction) — normalizes a URL for
 * EXACT-DUPLICATE comparison only (never for domain grouping, which is
 * a separate concept computed independently in
 * compute-source-diversity.util.ts). Lowercases scheme/hostname, strips
 * a leading "www." from the hostname, drops the query string and
 * fragment, and preserves the port and pathname exactly (no trailing-
 * slash guessing, no case-folding of the path — this repository has no
 * basis to assume paths are case-insensitive). Same domain alone is
 * NEVER sufficient for a match here — the full normalized
 * scheme+host+port+path must agree.
 *
 * Comparison-only: never mutates NewsArticle.url anywhere. A malformed/
 * unparseable URL returns null and is NEVER treated as equal to
 * anything (including another null) — isLikelyDuplicate() below falls
 * through to the existing title/time heuristic in that case rather than
 * crashing or inventing a match.
 */
function normalizeComparisonUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol.toLowerCase()}//${hostname}${port}${parsed.pathname}`;
  } catch {
    return null;
  }
}

function isLikelyDuplicate(a: NewsArticle, b: NewsArticle): boolean {
  const normalizedA = normalizeComparisonUrl(a.url);
  const normalizedB = normalizeComparisonUrl(b.url);
  if (normalizedA !== null && normalizedB !== null && normalizedA === normalizedB) {
    return true;
  }

  const timeDiff = Math.abs(new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  if (timeDiff > TIME_WINDOW_MS) return false;

  const similarity = jaccardSimilarity(tokenize(a.title), tokenize(b.title));
  return similarity >= TITLE_SIMILARITY_THRESHOLD;
}

/**
 * Milestone #43 — the single canonical clustering pass. Both
 * `clusterDuplicateArticles()` (unchanged observable behavior, kept for
 * every existing caller) and `clusterArticlesWithMembership()` (new,
 * exposes full cluster membership for compute-source-diversity.util.ts)
 * are thin views over this ONE implementation — there is no second
 * Jaccard/title-clustering algorithm anywhere in this file or its new
 * sibling.
 */
interface ArticleCluster {
  representative: NewsArticle;
  members: NewsArticle[];
}

function computeClusters(articles: NewsArticle[]): ArticleCluster[] {
  const clusters: ArticleCluster[] = [];

  for (const article of articles) {
    const existingCluster = clusters.find((cluster) =>
      isLikelyDuplicate(cluster.representative, article),
    );
    if (existingCluster) {
      existingCluster.members.push(article);
    } else {
      clusters.push({ representative: article, members: [article] });
    }
    // If it matches an existing cluster, the earlier (already-kept)
    // representative is retained — articles arrive pre-sorted by the
    // news service, so "earlier in the list" reflects that ordering.
  }

  return clusters;
}

/**
 * Groups articles that are very likely the same story (identical URL,
 * or near-identical titles published close together — the classic
 * signature of syndicated wire copy) and returns one representative
 * per group, so downstream AI analysis and "sources" lists don't treat
 * duplicated coverage as independent confirmation.
 *
 * This is intentionally simple (title token overlap + a time window),
 * not semantic similarity — isolated here so it can be swapped for an
 * embedding-based approach later without touching any caller.
 *
 * Milestone #43: internally a thin view over computeClusters() — this
 * function's own observable behavior (inputs, outputs, ordering) is
 * completely unchanged from before that refactor; verified by
 * regression test against the pre-existing fixtures.
 */
export function clusterDuplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  return computeClusters(articles).map((cluster) => cluster.representative);
}

/**
 * Milestone #43 — same canonical clustering pass as
 * clusterDuplicateArticles(), but returns full cluster membership
 * instead of collapsing to representatives only. Used by
 * compute-source-diversity.util.ts to derive cluster-size/duplicate-
 * concentration metrics that clusterDuplicateArticles()'s
 * representative-only output cannot expose. Does not duplicate the
 * clustering algorithm — both functions share computeClusters().
 */
export function clusterArticlesWithMembership(
  articles: NewsArticle[],
): Array<{ representative: NewsArticle; members: NewsArticle[] }> {
  return computeClusters(articles);
}
