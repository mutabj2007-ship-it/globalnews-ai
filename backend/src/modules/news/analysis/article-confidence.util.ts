export interface ArticleConfidenceInput {
  publishedAt: string;
}

export interface ArticleConfidenceResult {
  confidence: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Produces an initial article-ranking confidence score from:
 *
 * - the article's previously calculated country-relevance score;
 * - the freshness of the article.
 *
 * This is not yet a factual-veracity score. Publisher reliability,
 * independent-source agreement and contradiction analysis can be added
 * later without changing the result shape.
 */
export function scoreArticleConfidence(
  article: ArticleConfidenceInput,
  relevanceScore: number,
  nowMs: number = Date.now(),
): ArticleConfidenceResult {
  const freshnessBonus = getFreshnessBonus(
    article.publishedAt,
    nowMs,
  );

  const rawScore = relevanceScore + freshnessBonus;
  const clampedScore = Math.min(100, Math.max(0, rawScore));

  return {
    confidence: Math.round(clampedScore),
  };
}

function getFreshnessBonus(
  publishedAt: string,
  nowMs: number,
): number {
  const publishedAtMs = Date.parse(publishedAt);

  if (!Number.isFinite(publishedAtMs)) {
    return 0;
  }

  const ageMs = nowMs - publishedAtMs;

  // Invalid future publication times should not receive a bonus.
  if (ageMs < 0) {
    return 0;
  }

  if (ageMs < DAY_MS) {
    return 20;
  }

  if (ageMs < 3 * DAY_MS) {
    return 10;
  }

  if (ageMs < 7 * DAY_MS) {
    return 5;
  }

  return 0;
}