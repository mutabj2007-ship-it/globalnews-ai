import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

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

/**
 * Milestone #49 (World Map EN/PL integration) — `language` is new and
 * defaults to 'en', so every pre-M49 caller renders exactly the same
 * `label`/`description` strings as before. The score/level/count
 * calculation logic below is completely unchanged — only the two
 * presentation strings attached to the result now come from the
 * dictionary (`map.coverageQualityLevels`, keyed by the SAME `level`
 * value already computed here) instead of being hardcoded inline.
 */
export function calculateCoverageQuality(
  articles: NewsArticle[],
  language: LanguageCode = 'en',
): CoverageQualityResult {
  const levels = getDictionary(language).map.coverageQualityLevels;

  if (articles.length === 0) {
    return {
      level: 'none',
      label: levels.none.label,
      description: levels.none.description,
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
      label: levels.strong.label,
      description: levels.strong.description,
      score,
      publisherCount,
      articleCount: articles.length,
      latestPublishedAt,
    };
  }

  if (score >= 45) {
    return {
      level: 'developing',
      label: levels.developing.label,
      description: levels.developing.description,
      score,
      publisherCount,
      articleCount: articles.length,
      latestPublishedAt,
    };
  }

  return {
    level: 'limited',
    label: levels.limited.label,
    description: levels.limited.description,
    score,
    publisherCount,
    articleCount: articles.length,
    latestPublishedAt,
  };
}
