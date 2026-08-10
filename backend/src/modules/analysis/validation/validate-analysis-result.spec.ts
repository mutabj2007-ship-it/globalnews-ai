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

/**
 * Milestone #31 — candidates now cite request-local evidenceId aliases
 * (S1, S2, ...) rather than real article IDs. `evidenceId` here is
 * whatever alias the test wants the model to have used — normally
 * "S1" for a single-article context, matching
 * buildEvidenceReferences()'s deterministic S{index+1} assignment.
 */
function validCandidate(evidenceId: string) {
  return {
    headline: 'A headline',
    summary: 'A summary',
    keyFacts: [{ claim: 'Something happened', evidenceIds: [evidenceId] }],
    agreements: [],
    differences: [],
    unknowns: ['Some open question'],
    uncertainties: [],
    timeline: [
      {
        timestamp: new Date().toISOString(),
        event: 'Something occurred',
        evidenceIds: [evidenceId],
      },
    ],
    confidence: { level: 'medium', score: 60, explanation: 'Reasonable evidence.' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
  };
}

describe('validateAnalysisResult', () => {
  it('accepts a well-formed, grounded candidate', () => {
    const articles = [makeArticle()];
    const result = validateAnalysisResult(validCandidate('S1'), context(articles));

    expect(result.headline).toBe('A headline');
    expect(result.keyFacts).toHaveLength(1);
    // The validated result exposes the REAL article ID, never the S-label.
    expect(result.keyFacts[0].sourceArticleIds).toEqual(['article-1']);
    expect(result.analysisMode).toBe('live-ai');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].articleId).toBe('article-1');
  });

  it('uses the analysisMode passed in context, not a hardcoded value', () => {
    const articles = [makeArticle()];
    const result = validateAnalysisResult(validCandidate('S1'), {
      ...context(articles),
      analysisMode: 'mock-ai',
    });
    expect(result.analysisMode).toBe('mock-ai');
  });

  it('throws when headline is missing', () => {
    const articles = [makeArticle()];
    const candidate = { ...validCandidate('S1'), headline: '' };
    expect(() => validateAnalysisResult(candidate, context(articles))).toThrow(
      AnalysisValidationError,
    );
  });

  it('throws when confidence.level is not a valid enum value', () => {
    const articles = [makeArticle()];
    const candidate = {
      ...validCandidate('S1'),
      confidence: { level: 'extremely-high', score: 99, explanation: 'x' },
    };
    expect(() => validateAnalysisResult(candidate, context(articles))).toThrow(
      AnalysisValidationError,
    );
  });

  it('drops keyFacts that cite a nonexistent evidenceId (out of range)', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [
        { claim: 'Grounded claim', evidenceIds: ['S1'] },
        { claim: 'Hallucinated claim (S99 does not exist)', evidenceIds: ['S99'] },
      ],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(1);
    expect(result.keyFacts[0].claim).toBe('Grounded claim');
    expect(result.keyFacts[0].sourceArticleIds).toEqual(['real-article']);
  });

  it('drops keyFacts that cite a malformed evidenceId', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const malformedIds = ['S1x', '1', '', 'S0', 'S', 's1', ' S1'];
    for (const badId of malformedIds) {
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [{ claim: 'Malformed citation', evidenceIds: [badId] }],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts).toHaveLength(0);
    }
  });

  it('drops a citation that supplies a real article ID instead of an evidenceId alias', () => {
    // Even though "real-article" IS the true canonical ID, the model must
    // cite the S-label it was shown, not the real ID it was never given.
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [{ claim: 'Cited real ID directly', evidenceIds: ['real-article'] }],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(0);
  });

  it('drops a citation that supplies an arbitrary model-generated URL instead of an evidenceId', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [
        { claim: 'Cited a URL', evidenceIds: ['https://not-a-real-evidence-id.example.com'] },
      ],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(0);
  });

  it('deduplicates repeated citation of the same evidenceId within one entry', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [{ claim: 'Cited S1 twice', evidenceIds: ['S1', 'S1'] }],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(1);
    expect(result.keyFacts[0].sourceArticleIds).toEqual(['real-article']);
  });

  it('resolves multiple distinct evidenceIds to their correct real article IDs', () => {
    const articles = [
      makeArticle({ id: 'first' }),
      makeArticle({ id: 'second' }),
      makeArticle({ id: 'third' }),
    ];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [{ claim: 'Multi-sourced claim', evidenceIds: ['S1', 'S3'] }],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(1);
    expect(result.keyFacts[0].sourceArticleIds).toEqual(['first', 'third']);
  });

  it('the same evidenceId can be reused across multiple different claims', () => {
    const articles = [makeArticle({ id: 'shared-article' })];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [
        { claim: 'First claim citing S1', evidenceIds: ['S1'] },
        { claim: 'Second claim also citing S1', evidenceIds: ['S1'] },
      ],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(2);
    expect(result.keyFacts[0].sourceArticleIds).toEqual(['shared-article']);
    expect(result.keyFacts[1].sourceArticleIds).toEqual(['shared-article']);
  });

  it('a duplicate/capped article that never entered the evidence set cannot be cited via any evidenceId', () => {
    // Only ONE article is passed as context.articles (simulating that a
    // duplicate or maxArticles-capped article never made it into the
    // final bounded set) — so only S1 exists. S2 must not resolve.
    const articles = [makeArticle({ id: 'only-surviving-article' })];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [{ claim: 'Cites a second article that does not exist here', evidenceIds: ['S2'] }],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(0);
  });

  it('drops keyFacts with no evidenceIds at all', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
      keyFacts: [{ claim: 'Ungrounded claim', evidenceIds: [] }],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toHaveLength(0);
  });

  it('drops difference positions that are ungrounded, and drops the whole difference if none remain', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
      differences: [
        {
          topic: 'Disputed detail',
          positions: [{ description: 'Some outlet says X', evidenceIds: ['S99'] }],
        },
      ],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.differences).toHaveLength(0);
  });

  it('keeps a difference position when its evidenceId resolves', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
      differences: [
        {
          topic: 'Disputed detail',
          positions: [{ description: 'Some outlet says X', evidenceIds: ['S1'] }],
        },
      ],
    };
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0].positions[0].sourceArticleIds).toEqual(['real-article']);
  });

  it('clamps an out-of-range confidence score into 0-100', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      ...validCandidate('S1'),
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
    const candidate = {
      ...validCandidate('S1'),
      sources: [
        {
          articleId: 'fabricated',
          publisher: 'Fake',
          title: 'x',
          url: 'https://fake.example.com',
          publishedAt: 'x',
        },
      ],
    };
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

  describe('uncertainties (Milestone #31)', () => {
    it('accepts an uncertainty with resolved evidenceIds', () => {
      const articles = [makeArticle({ id: 'real-article' })];
      const candidate = {
        ...validCandidate('S1'),
        uncertainties: [{ description: 'Sources conflict on the timing.', evidenceIds: ['S1'] }],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.uncertainties).toEqual([
        { description: 'Sources conflict on the timing.', sourceArticleIds: ['real-article'] },
      ]);
    });

    it('accepts a general uncertainty with no evidenceIds (empty array is allowed, unlike other sections)', () => {
      const articles = [makeArticle({ id: 'real-article' })];
      const candidate = {
        ...validCandidate('S1'),
        uncertainties: [
          { description: 'No outlet reports the underlying cause.', evidenceIds: [] },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.uncertainties).toEqual([
        { description: 'No outlet reports the underlying cause.', sourceArticleIds: [] },
      ]);
    });

    it('drops an uncertainty invalid evidenceIds down to an empty (but still present) array rather than dropping the entry', () => {
      const articles = [makeArticle({ id: 'real-article' })];
      const candidate = {
        ...validCandidate('S1'),
        uncertainties: [{ description: 'Cites a nonexistent source.', evidenceIds: ['S99'] }],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.uncertainties).toEqual([
        { description: 'Cites a nonexistent source.', sourceArticleIds: [] },
      ]);
    });

    it('drops an uncertainty entry with no description', () => {
      const articles = [makeArticle({ id: 'real-article' })];
      const candidate = {
        ...validCandidate('S1'),
        uncertainties: [{ description: '', evidenceIds: ['S1'] }],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.uncertainties).toHaveLength(0);
    });

    it('defaults to an empty array when uncertainties is absent or malformed', () => {
      const articles = [makeArticle({ id: 'real-article' })];
      const rest = { ...validCandidate('S1'), uncertainties: undefined };
      const result = validateAnalysisResult(rest, context(articles));
      expect(result.uncertainties).toEqual([]);
    });
  });

  it('a fully-ungrounded candidate still succeeds with empty grounded sections, not validation-rejected (CTO Decision 1)', () => {
    const articles = [makeArticle({ id: 'real-article' })];
    const candidate = {
      headline: 'A headline',
      summary: 'A summary',
      keyFacts: [{ claim: 'Hallucinated', evidenceIds: ['S99'] }],
      agreements: [{ point: 'Hallucinated agreement', evidenceIds: ['S99'] }],
      differences: [
        { topic: 'x', positions: [{ description: 'Hallucinated position', evidenceIds: ['S99'] }] },
      ],
      unknowns: [],
      uncertainties: [{ description: 'Hallucinated uncertainty', evidenceIds: ['S99'] }],
      timeline: [
        { timestamp: new Date().toISOString(), event: 'Hallucinated event', evidenceIds: ['S99'] },
      ],
      confidence: { level: 'low', score: 10, explanation: 'x' },
      entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
    };
    // Does not throw — this is a valid, successfully-validated result
    // whose grounded sections all happen to be empty.
    const result = validateAnalysisResult(candidate, context(articles));
    expect(result.keyFacts).toEqual([]);
    expect(result.agreements).toEqual([]);
    expect(result.differences).toEqual([]);
    expect(result.timeline).toEqual([]);
    // uncertainties is the one section allowed to survive with an
    // empty sourceArticleIds — the description itself is still useful.
    expect(result.uncertainties).toEqual([
      { description: 'Hallucinated uncertainty', sourceArticleIds: [] },
    ]);
  });
});
