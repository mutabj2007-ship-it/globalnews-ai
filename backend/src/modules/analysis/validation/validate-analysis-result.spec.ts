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
  // Milestone #32: generous default so existing (pre-M32) fixtures'
  // article summaries are never truncated by this test helper.
  maxArticleChars: 1200,
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

  describe('evidenceBreadth (Milestone #32)', () => {
    it('computes sourceCount=1 / singleSource=true for a single-source key fact', () => {
      const articles = [makeArticle({ id: 'real-article' })];
      const result = validateAnalysisResult(validCandidate('S1'), context(articles));
      expect(result.keyFacts[0].evidenceBreadth).toEqual({ sourceCount: 1, singleSource: true });
    });

    it('computes sourceCount=2 / singleSource=false for a multi-source key fact', () => {
      const articles = [makeArticle({ id: 'a1' }), makeArticle({ id: 'a2' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [{ claim: 'Multi-sourced', evidenceIds: ['S1', 'S2'] }],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBreadth).toEqual({ sourceCount: 2, singleSource: false });
    });

    it('does not let a duplicate evidenceId inflate breadth beyond distinct resolved articles', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [{ claim: 'Duplicated citation', evidenceIds: ['S1', 'S1'] }],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBreadth).toEqual({ sourceCount: 1, singleSource: true });
    });

    it('is a deterministic backend computation independent of anything the provider claims', () => {
      // Even though nothing in the candidate mentions "evidenceBreadth"
      // at all, the validator computes it purely from resolved
      // sourceArticleIds — the field can never be supplied/overridden
      // by the provider.
      const articles = [makeArticle({ id: 'a1' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'x', evidenceIds: ['S1'], evidenceBreadth: { sourceCount: 999, singleSource: false } },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBreadth).toEqual({ sourceCount: 1, singleSource: true });
    });
  });

  describe('evidenceBasis (Milestone #32)', () => {
    it('accepts a valid evidence basis whose excerpt appears verbatim in the cited evidence text', () => {
      const articles = [makeArticle({ id: 'a1', title: 'Officials discuss evacuation', summary: 'Local officials are discussing a possible evacuation of the district.' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          {
            claim: 'Officials discussed a possible evacuation',
            evidenceIds: ['S1'],
            evidenceBasis: { evidenceId: 'S1', excerpt: 'discussing a possible evacuation' },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBasis).toEqual({
        articleId: 'a1',
        excerpt: 'discussing a possible evacuation',
      });
    });

    it('accepts an excerpt that differs only by whitespace/typographic-quote normalization', () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Report', summary: 'The mayor said   "recovery efforts are ongoing".' }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          {
            claim: 'Recovery is ongoing',
            evidenceIds: ['S1'],
            // Curly quotes + collapsed whitespace vs. the source's straight quotes.
            evidenceBasis: { evidenceId: 'S1', excerpt: '\u201Crecovery efforts are ongoing\u201D' },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBasis?.articleId).toBe('a1');
    });

    it('omits evidenceBasis when the excerpt does not exist in the supplied evidence text', () => {
      const articles = [makeArticle({ id: 'a1', title: 'Report', summary: 'A calm situation.' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          {
            claim: 'x',
            evidenceIds: ['S1'],
            evidenceBasis: { evidenceId: 'S1', excerpt: 'a chaotic and dangerous situation' },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
      // The entry itself is still kept — a failed evidence basis never
      // drops an otherwise-grounded entry.
      expect(result.keyFacts).toHaveLength(1);
    });

    it('omits evidenceBasis when evidenceId is malformed/unknown', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          {
            claim: 'x',
            evidenceIds: ['S1'],
            evidenceBasis: { evidenceId: 'S99', excerpt: articles[0].title },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
    });

    it('omits evidenceBasis when the evidenceId belongs to another article, not among this entry\'s own citations', () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Story A', summary: 'Summary A.' }),
        makeArticle({ id: 'a2', title: 'Story B', summary: 'Summary B.' }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        // Cites only S1 (a1) but claims its evidence basis is from S2 (a2).
        keyFacts: [
          {
            claim: 'x',
            evidenceIds: ['S1'],
            evidenceBasis: { evidenceId: 'S2', excerpt: 'Story B' },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
    });

    it('omits evidenceBasis for a deduped/capped-out slot the same way S2 already resolves to nothing', () => {
      // Only one article supplied to this call (simulating an article
      // that was removed by dedup/maxArticles upstream) — S2 has no
      // entry in the evidence map at all.
      const articles = [makeArticle({ id: 'a1' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'x', evidenceIds: ['S1'], evidenceBasis: { evidenceId: 'S2', excerpt: 'anything' } },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
    });

    it('omits evidenceBasis when the excerpt is empty', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'x', evidenceIds: ['S1'], evidenceBasis: { evidenceId: 'S1', excerpt: '   ' } },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
    });

    it('treats a missing evidenceBasis as a valid, backward-compatible result', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const result = validateAnalysisResult(validCandidate('S1'), context(articles));
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
      expect(result.keyFacts[0].sourceArticleIds).toEqual(['a1']);
    });

    it('never validates an excerpt against untruncated article content the model was never shown', () => {
      const longSummary = 'Short lead. ' + 'Padding sentence repeated many times to exceed the truncation limit. '.repeat(50) + 'A UNIQUE TAIL PHRASE THAT ONLY EXISTS PAST THE TRUNCATION BOUNDARY.';
      const articles = [makeArticle({ id: 'a1', title: 'T', summary: longSummary })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          {
            claim: 'x',
            evidenceIds: ['S1'],
            evidenceBasis: {
              evidenceId: 'S1',
              excerpt: 'a unique tail phrase that only exists past the truncation boundary',
            },
          },
        ],
      };
      // maxArticleChars deliberately small enough to truncate before the tail phrase.
      const result = validateAnalysisResult(candidate, { ...context(articles), maxArticleChars: 50 });
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
    });

    it('resolves evidence basis for agreements', () => {
      const articles = [makeArticle({ id: 'a1', title: 'T', summary: 'Widely reported detail here.' })];
      const candidate = {
        ...validCandidate('S1'),
        agreements: [
          {
            point: 'Multiple outlets agree',
            evidenceIds: ['S1'],
            evidenceBasis: { evidenceId: 'S1', excerpt: 'Widely reported detail' },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.agreements[0].evidenceBasis?.articleId).toBe('a1');
      expect(result.agreements[0].evidenceBreadth).toEqual({ sourceCount: 1, singleSource: true });
    });

    it('resolves evidence basis for a difference position', () => {
      const articles = [makeArticle({ id: 'a1', title: 'T', summary: 'Officials dispute the death toll figures.' })];
      const candidate = {
        ...validCandidate('S1'),
        differences: [
          {
            topic: 'Death toll',
            positions: [
              {
                description: 'One outlet disputes the figures',
                evidenceIds: ['S1'],
                evidenceBasis: { evidenceId: 'S1', excerpt: 'dispute the death toll figures' },
              },
            ],
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.differences[0].positions[0].evidenceBasis?.articleId).toBe('a1');
      expect(result.differences[0].positions[0].evidenceBreadth).toEqual({
        sourceCount: 1,
        singleSource: true,
      });
    });

    it('resolves evidence basis for a timeline event', () => {
      const articles = [makeArticle({ id: 'a1', title: 'T', summary: 'The evacuation began at dawn on Tuesday.' })];
      const candidate = {
        ...validCandidate('S1'),
        timeline: [
          {
            timestamp: new Date().toISOString(),
            event: 'Evacuation began',
            evidenceIds: ['S1'],
            evidenceBasis: { evidenceId: 'S1', excerpt: 'evacuation began at dawn' },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.timeline[0].evidenceBasis?.articleId).toBe('a1');
      expect(result.timeline[0].evidenceBreadth).toEqual({ sourceCount: 1, singleSource: true });
    });

    it('does not add evidenceBreadth/evidenceBasis fields to uncertainties (out of Milestone #32 scope)', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const candidate = {
        ...validCandidate('S1'),
        uncertainties: [{ description: 'General gap', evidenceIds: ['S1'] }],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.uncertainties![0]).toEqual({
        description: 'General gap',
        sourceArticleIds: ['a1'],
      });
      expect('evidenceBreadth' in result.uncertainties![0]).toBe(false);
      expect('evidenceBasis' in result.uncertainties![0]).toBe(false);
    });

    it('a failed evidence-basis validation never escalates to validation-rejected or drops the entry', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          {
            claim: 'Still a valid, grounded claim',
            evidenceIds: ['S1'],
            evidenceBasis: { evidenceId: 'S1', excerpt: 'text that is not present anywhere' },
          },
        ],
      };
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.keyFacts).toHaveLength(1);
      expect(result.keyFacts[0].sourceArticleIds).toEqual(['a1']);
      expect(result.keyFacts[0].evidenceBasis).toBeUndefined();
    });
  });

  describe('Milestone #40 fail-closed applicability (authoritative-context correction)', () => {
    it('when relationalContextPresent is omitted (default), a provider-emitted relationalEvidenceAssessments array is forced empty', () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Report', summary: 'Climate change is reducing maize yields. Agricultural emissions contribute to climate change.' }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'x', evidenceIds: ['S1'], relationshipAssessmentIds: ['R1'] },
        ],
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
        ],
      };
      // context(articles) does not set relationalContextPresent -> defaults to falsy.
      const result = validateAnalysisResult(candidate, context(articles));
      expect(result.relationalEvidenceAssessments).toEqual([]);
      expect(result.keyFacts[0].relationalSupport).toBeUndefined();
      // The ordinary M31 grounding is completely unaffected.
      expect(result.keyFacts[0].sourceArticleIds).toEqual(['a1']);
    });

    it('when relationalContextPresent is explicitly false, behaves identically to omitted', () => {
      const articles = [makeArticle({ id: 'a1', title: 'Report', summary: 'Climate change is reducing maize yields.' })];
      const candidate = {
        ...validCandidate('S1'),
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
        ],
      };
      const result = validateAnalysisResult(candidate, { ...context(articles), relationalContextPresent: false });
      expect(result.relationalEvidenceAssessments).toEqual([]);
    });

    it('when relationalContextPresent is true, valid relational assessments are processed normally (Case 9 regression through full validateAnalysisResult)', () => {
      const articles = [
        makeArticle({
          id: 'real-article-1',
          title: 'Report',
          summary: 'Climate change is reducing maize yields. Agricultural emissions contribute to climate change.',
        }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'Climate change reduces maize yields', evidenceIds: ['S1'], relationshipAssessmentIds: ['R1'] },
          { claim: 'Agriculture contributes to climate change', evidenceIds: ['S1'], relationshipAssessmentIds: ['R2'] },
        ],
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
          { assessmentId: 'R2', evidenceId: 'S1', excerpt: 'Agricultural emissions contribute to climate change', direction: 'reverse-direction' },
        ],
      };
      const result = validateAnalysisResult(candidate, { ...context(articles), relationalContextPresent: true });

      expect(result.relationalEvidenceAssessments).toHaveLength(2);
      expect(result.keyFacts[0].relationalSupport?.direction).toBe('requested-direction');
      expect(result.keyFacts[1].relationalSupport?.direction).toBe('reverse-direction');
      // Claim referencing R2 never inherits R1, even though both share an article.
      expect(result.keyFacts[1].relationalSupport?.assessments).toHaveLength(1);
    });

    it('when relationalContextPresent is true but the provider emits nothing relational, ordinary M31 behavior is unaffected', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const result = validateAnalysisResult(validCandidate('S1'), { ...context(articles), relationalContextPresent: true });
      expect(result.relationalEvidenceAssessments).toEqual([]);
      expect(result.keyFacts[0].relationalSupport).toBeUndefined();
      expect(result.keyFacts[0].sourceArticleIds).toEqual(['a1']);
    });

    it('duplicate assessmentId fail-closed behavior still applies when relationalContextPresent is true', () => {
      const articles = [makeArticle({ id: 'a1', title: 'Report', summary: 'Climate change is reducing maize yields.' })];
      const candidate = {
        ...validCandidate('S1'),
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'reverse-direction' },
        ],
      };
      const result = validateAnalysisResult(candidate, { ...context(articles), relationalContextPresent: true });
      expect(result.relationalEvidenceAssessments).toEqual([]);
    });
  });

  describe('Milestone #41 relational composition', () => {
    it('8. non-relational validation (no relationalContext supplied) -> relationalComposition undefined', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const result = validateAnalysisResult(validCandidate('S1'), context(articles));
      expect(result.relationalComposition).toBeUndefined();
    });

    it('8b. relationalContextPresent true but relationalContext (x/y) not supplied -> relationalComposition still undefined', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const result = validateAnalysisResult(validCandidate('S1'), { ...context(articles), relationalContextPresent: true });
      expect(result.relationalComposition).toBeUndefined();
    });

    it('9. relational request with zero relationalSupport data -> relationalComposition unsupported + insufficient', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const result = validateAnalysisResult(validCandidate('S1'), {
        ...context(articles),
        relationalContextPresent: true,
        relationalContext: { x: 'climate change', y: 'agriculture' },
      });
      expect(result.relationalComposition?.directionalEligibility).toBe('unsupported');
      expect(result.relationalComposition?.evidenceSufficiency).toBe('insufficient');
    });

    it('11. malformed/dropped candidate claims cannot shift an untrusted reference — ClaimReference always corresponds to the FINAL VALIDATED array', () => {
      const articles = [
        makeArticle({ id: 'real-article-1', title: 'Report', summary: 'Climate change is reducing maize yields.' }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: '', evidenceIds: ['S1'] }, // malformed (empty claim) -> dropped during validation
          {
            claim: 'Climate change reduces maize yields',
            evidenceIds: ['S1'],
            relationshipAssessmentIds: ['R1'],
          },
        ],
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
        ],
      };
      const result = validateAnalysisResult(candidate, {
        ...context(articles),
        relationalContextPresent: true,
        relationalContext: { x: 'climate change', y: 'agriculture' },
      });

      // Only the surviving claim reaches validated keyFacts (the empty
      // one was dropped) — validated index 0 IS the surviving claim.
      expect(result.keyFacts).toHaveLength(1);
      expect(result.keyFacts[0].claim).toBe('Climate change reduces maize yields');
      // The ClaimReference correctly points at validated index 0 —
      // never accidentally computed from the candidate's original
      // index 1, because no candidate index is ever read at all.
      expect(result.relationalComposition?.supportingClaims).toEqual([{ section: 'keyFacts', index: 0 }]);
    });

    it('12. M40 Case 9 remains unchanged, and relationalComposition correctly reflects both directions from the same article', () => {
      const articles = [
        makeArticle({
          id: 'real-article-1',
          title: 'Report',
          summary: 'Climate change is reducing maize yields. Agricultural emissions contribute to climate change.',
        }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'Climate change reduces maize yields', evidenceIds: ['S1'], relationshipAssessmentIds: ['R1'] },
          { claim: 'Agriculture contributes to climate change', evidenceIds: ['S1'], relationshipAssessmentIds: ['R2'] },
        ],
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
          { assessmentId: 'R2', evidenceId: 'S1', excerpt: 'Agricultural emissions contribute to climate change', direction: 'reverse-direction' },
        ],
      };
      const result = validateAnalysisResult(candidate, {
        ...context(articles),
        relationalContextPresent: true,
        relationalContext: { x: 'climate change', y: 'agriculture' },
      });

      // Case 9 itself, unchanged:
      expect(result.keyFacts[0].relationalSupport?.direction).toBe('requested-direction');
      expect(result.keyFacts[1].relationalSupport?.direction).toBe('reverse-direction');

      // Composition correctly reflects both, from the SAME article,
      // without conflating them:
      expect(result.relationalComposition?.supportingClaims).toEqual([{ section: 'keyFacts', index: 0 }]);
      expect(result.relationalComposition?.reverseClaims).toEqual([{ section: 'keyFacts', index: 1 }]);
      // Only 1 distinct supporting article (real-article-1) -> limited, not adequate.
      expect(result.relationalComposition?.evidenceSufficiency).toBe('limited');
    });

    it('13. M40 duplicate-assessmentId fail-closed behavior remains unchanged, and relationalComposition correctly reflects the resulting empty state', () => {
      const articles = [makeArticle({ id: 'a1', title: 'Report', summary: 'Climate change is reducing maize yields.' })];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'x', evidenceIds: ['S1'], relationshipAssessmentIds: ['R1'] },
        ],
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'reverse-direction' },
        ],
      };
      const result = validateAnalysisResult(candidate, {
        ...context(articles),
        relationalContextPresent: true,
        relationalContext: { x: 'climate change', y: 'agriculture' },
      });

      expect(result.relationalEvidenceAssessments).toEqual([]);
      expect(result.keyFacts[0].relationalSupport).toBeUndefined();
      expect(result.relationalComposition?.directionalEligibility).toBe('unsupported');
      expect(result.relationalComposition?.evidenceSufficiency).toBe('insufficient');
    });
  });

  describe('Milestone #42 authoritative trust state', () => {
    it('every successful validateAnalysisResult() result contains trustState (required field)', () => {
      const articles = [makeArticle({ id: 'a1' })];
      const result = validateAnalysisResult(validCandidate('S1'), context(articles));
      expect(result.trustState).toBeDefined();
      expect(typeof result.trustState.level).toBe('string');
      expect(Array.isArray(result.trustState.reasons)).toBe(true);
    });

    it('MODEL OVERCONFIDENCE (Case 1/13): confidence.level="high"/score=95 does NOT influence trustState — a single-article analysis still yields "limited"', () => {
      const articles = [makeArticle({ id: 'a1', title: 'Report' })];
      const candidate = {
        ...validCandidate('S1'),
        confidence: { level: 'high', score: 95, explanation: 'Extremely confident.' },
      };
      const result = validateAnalysisResult(candidate, context(articles));
      // The model's own self-reported confidence is preserved unchanged...
      expect(result.confidence).toEqual({ level: 'high', score: 95, explanation: 'Extremely confident.' });
      // ...but trustState is derived entirely independently and disagrees.
      expect(result.trustState.level).toBe('limited');
      expect(result.trustState.reasons).toContain('single-distinct-article');
    });

    it('mock mode hard override applies end-to-end through the real validator, even with a multi-article, high-confidence-claiming candidate', () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'First' }),
        makeArticle({ id: 'a2', title: 'Second' }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'x', evidenceIds: ['S1'] },
          { claim: 'y', evidenceIds: ['S2'] },
        ],
        confidence: { level: 'high', score: 90, explanation: 'x' },
      };
      const result = validateAnalysisResult(candidate, { ...context(articles), analysisMode: 'mock-ai' });
      expect(result.trustState.level).toBe('insufficient');
      expect(result.trustState.reasons).toEqual(['mock-execution']);
    });

    it('relational end-to-end: trustState.relationalEvidenceSufficiency mirrors the validated relationalComposition exactly', () => {
      const articles = [
        makeArticle({
          id: 'real-article-1',
          title: 'Report',
          summary: 'Climate change is reducing maize yields.',
        }),
      ];
      const candidate = {
        ...validCandidate('S1'),
        keyFacts: [
          { claim: 'Climate change reduces maize yields', evidenceIds: ['S1'], relationshipAssessmentIds: ['R1'] },
        ],
        relationalEvidenceAssessments: [
          { assessmentId: 'R1', evidenceId: 'S1', excerpt: 'Climate change is reducing maize yields', direction: 'requested-direction' },
        ],
      };
      const result = validateAnalysisResult(candidate, {
        ...context(articles),
        relationalContextPresent: true,
        relationalContext: { x: 'climate change', y: 'agriculture' },
      });
      expect(result.trustState.relationalEvidenceSufficiency).toBe(result.relationalComposition?.evidenceSufficiency);
      expect(result.trustState.level).toBe('limited');
    });
  });
});
