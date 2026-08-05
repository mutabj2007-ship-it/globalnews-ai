import type { NewsArticle } from '@globalnews-ai/shared';

export type CoverageQualityLevel =
  | 'none'
  | 'limited'
  | 'developing'
  | 'strong';

export interface CoverageQualityResult {
  level: CoverageQualityLevel;
  label: string;
  description: string;
  score: number;
  publisherCount: number;
  articleCount: number;
  latestPublishedAt: string | null;
}

export function calculateCoverageQuality(
  articles: NewsArticle[],
): CoverageQualityResult {
  if (articles.length === 0) {
    return {
      level: 'none',
      label: 'No coverage',
      description: 'No current articles are available for this selection.',
      score: 0,
      publisherCount: 0,
      articleCount: 0,
      latestPublishedAt: null,
    };
  }

  const publisherCount = new Set(
    articles
      .map((article) => article.sourceName.trim().toLowerCase())
      .filter(Boolean),
  ).size;

  const timestamps = articles
    .map((article) => Date.parse(article.publishedAt))
    .filter((timestamp) => Number.isFinite(timestamp));

  const latestTimestamp =
    timestamps.length > 0 ? Math.max(...timestamps) : null;

  const latestPublishedAt =
    latestTimestamp !== null
      ? new Date(latestTimestamp).toISOString()
      : null;

  const articleScore = Math.min(articles.length * 6, 42);
  const publisherScore = Math.min(publisherCount * 8, 40);

  let freshnessScore = 0;

  if (latestTimestamp !== null) {
    const ageHours =
      (Date.now() - latestTimestamp) / (1000 * 60 * 60);

    if (ageHours <= 6) {
      freshnessScore = 18;
    } else if (ageHours <= 24) {
      freshnessScore = 12;
    } else if (ageHours <= 72) {
      freshnessScore = 6;
    }
  }

  const score = Math.min(
    100,
    articleScore + publisherScore + freshnessScore,
  );

  if (score >= 75) {
    return {
      level: 'strong',
      label: 'Strong coverage',
      description:
        'Coverage includes several recent articles from multiple publishers.',
      score,
      publisherCount,
      articleCount: articles.length,
      latestPublishedAt,
    };
  }

  if (score >= 45) {
    return {
      level: 'developing',
      label: 'Developing coverage',
      description:
        'Several reports are available, but coverage may still be developing.',
      score,
      publisherCount,
      articleCount: articles.length,
      latestPublishedAt,
    };
  }

  return {
    level: 'limited',
    label: 'Limited coverage',
    description:
      'Only a small number of reports or publishers are currently available.',
    score,
    publisherCount,
    articleCount: articles.length,
    latestPublishedAt,
  };
}