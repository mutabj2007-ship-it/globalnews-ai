import { scoreArticleConfidence } from './article-confidence.util';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const NOW_MS = Date.parse('2026-08-05T06:00:00Z');

function isoPublishedBeforeNow(offsetMs: number): string {
  return new Date(NOW_MS - offsetMs).toISOString();
}

describe('scoreArticleConfidence', () => {
  it('adds the maximum freshness bonus for a recent high-relevance article', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(2 * HOUR_MS),
    };

    const result = scoreArticleConfidence(
      article,
      75,
      NOW_MS,
    );

    expect(result.confidence).toBe(95);
  });

  it('adds the maximum freshness bonus for a recent medium-relevance article', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(6 * HOUR_MS),
    };

    const result = scoreArticleConfidence(
      article,
      40,
      NOW_MS,
    );

    expect(result.confidence).toBe(60);
  });

  it('adds ten points for an article published fewer than three days ago', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(2 * DAY_MS),
    };

    const result = scoreArticleConfidence(
      article,
      50,
      NOW_MS,
    );

    expect(result.confidence).toBe(60);
  });

  it('adds five points for an article published fewer than seven days ago', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(5 * DAY_MS),
    };

    const result = scoreArticleConfidence(
      article,
      50,
      NOW_MS,
    );

    expect(result.confidence).toBe(55);
  });

  it('adds no freshness bonus for an old article', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(10 * DAY_MS),
    };

    const result = scoreArticleConfidence(
      article,
      50,
      NOW_MS,
    );

    expect(result.confidence).toBe(50);
  });

  it('adds no freshness bonus for an invalid publication date', () => {
    const result = scoreArticleConfidence(
      { publishedAt: 'not-a-date' },
      50,
      NOW_MS,
    );

    expect(result.confidence).toBe(50);
  });

  it('adds no freshness bonus for a future publication date', () => {
    const futureArticle = {
      publishedAt: new Date(NOW_MS + HOUR_MS).toISOString(),
    };

    const result = scoreArticleConfidence(
      futureArticle,
      50,
      NOW_MS,
    );

    expect(result.confidence).toBe(50);
  });

  it('never returns a score above 100', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(HOUR_MS),
    };

    const result = scoreArticleConfidence(
      article,
      95,
      NOW_MS,
    );

    expect(result.confidence).toBe(100);
  });

  it('never returns a score below zero', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(30 * DAY_MS),
    };

    const result = scoreArticleConfidence(
      article,
      -10,
      NOW_MS,
    );

    expect(result.confidence).toBe(0);
  });

  it('rounds the final result to the nearest integer', () => {
    const article = {
      publishedAt: isoPublishedBeforeNow(5 * DAY_MS),
    };

    const result = scoreArticleConfidence(
      article,
      42.4,
      NOW_MS,
    );

    expect(result.confidence).toBe(47);
  });
});