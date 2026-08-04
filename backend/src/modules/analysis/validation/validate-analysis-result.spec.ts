import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisValidationError, validateAnalysisResult } from './validate-analysis-result';

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'article-1',
    title: 'Test headline',
    summary: 'Test summary',
    url: 'https://example.com/test',
    sourceId: 'test-source',
    sourceName: 'Test Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

const context = (articles: NewsArticle[]) => ({
  query: 'test query',
  articles,
  analysisMode: 'live-ai' as const,
});

function validCandidate(articleId: string) {
  return {
    headline: 'A headline',
    summary: 'A summary',
    keyFacts: [{ claim: 'Something happened', sourceArticleIds: [articleId] }],
    agreements: [],
    differences: [],
    unknowns: ['Some open question'],
    timeline: [
      { timestamp: new Date().toISOString(), event: 'Something occurred', sourceArticleIds: [articleId] },
    ],
    confidence: { level: 'medium', score: 60, explanation: 'Reasonable evidence.' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
  };
}

describe('validateAnalysisResult', () => {
  it('accepts a well-formed, grounded candidate', () => {
    const articles = [makeArticle()];
    const result = validateAnalysisResult(validCandidate('article-1'), context(articles));

    expect(result.headline).toBe('A headline');
    expect(result.keyFacts).toHaveLength(1);
    expect(result.analysisMode).toBe('live-ai');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].articleId).toBe('article-1');
  });

  it('uses the analysisMode passed in context, not a hardcoded value', () => {
    const articles = [makeArticle()];
    const result = validateAnalysisResult(validCandidate('article-1'), {
      ...context(articles),
      analysisMode: 'mock-ai',
    });
    expect(result.analysisMode).toBe('mock-ai');
  });

  it('throws when headline is missing', () => {
    const articles = [makeArticle()];
    const candidate = { ...validCandidate('article-1'), headline: '' };
    expect(() => validateAnalysisResult(candidate, context(articles))).toThrow(
      AnalysisValidationError,
    );
  });

  it('throws when confidence.level is not a valid enum value', () => {
    const articles = [makeArticle()];
    const candidate = {
      ...validCandidate('article-1'),
      confidence: { level: 'extremely-high', score: 99, explanation: 'x' },
    };
    expect(() => validateAnalysisResult(candidate, context(articles))).toThrow(
      AnalysisValidationError,
    );
  });

  it('drops keyFacts that cite a nonexistent (hallucinated) article ID', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('real-article'),
      keyFacts: [
        { claim: 'Grounded claim', sourceArticleIds: ['real-article'] },
        { claim: 'Hallucinated claim', sourceArticleIds: ['fake-article-id'] },
      ],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(1);
    expect(result.keyFacts[0].claim).toBe('Grounded claim');
  });

  it('drops keyFacts with no sourceArticleIds at all', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('real-article'),
      keyFacts: [{ claim: 'Ungrounded claim', sourceArticleIds: [] }],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(0);
  });

  it('drops difference positions that are ungrounded, and drops the whole difference if none remain', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('real-article'),
      differences: [
        {
          topic: 'Disputed detail',
          positions: [{ description: 'Some outlet says X', sourceArticleIds: ['fake-id'] }],
        },
      ],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.differences).toHaveLength(0);
  });

  it('clamps an out-of-range confidence score into 0-100', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('real-article'),
      confidence: { level: 'high', score: 500, explanation: 'x' },
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.confidence.score).toBe(100);
  });

  it('builds sources deterministically from the real input articles, not from the model', () => {
    const articles = [
      makeArticle({ id: 'a1', url: 'https://real.example.com/a1', sourceName: 'Real Source' }),
    ];
    // Even if the model tried to include a "sources" field, it's ignored —
    // sources always come from the articles we actually sent it.
    const candidate = { ...validCandidate('a1'), sources: [{ articleId: 'fabricated', publisher: 'Fake', title: 'x', url: 'https://fake.example.com', publishedAt: 'x' }] };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.sources).toEqual([
      {
        articleId: 'a1',
        publisher: 'Real Source',
        title: articles[0].title,
        url: 'https://real.example.com/a1',
        publishedAt: articles[0].publishedAt,
      },
    ]);
  });
});
