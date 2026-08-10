import type { NewsArticle } from '@globalnews-ai/shared';
import { MockAnalysisProvider } from './mock-analysis.provider';
import { validateAnalysisResult } from '../validation/validate-analysis-result';

function makeArticle(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'id',
    title: 'title',
    summary: 'summary',
    url: 'https://example.com',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MockAnalysisProvider', () => {
  const provider = new MockAnalysisProvider();

  it('is flagged as mock', () => {
    expect(provider.isMock).toBe(true);
  });

  it('produces output that passes the same validator used for the real provider', async () => {
    const articles = [
      makeArticle({ id: 'a1', title: 'Story A' }),
      makeArticle({ id: 'a2', title: 'Story B' }),
    ];
    const candidate = await provider.analyzeNews({ query: 'test', articles });
    const validated = validateAnalysisResult(candidate, {
      query: 'test',
      articles,
      analysisMode: 'mock-ai',
    });

    expect(validated.analysisMode).toBe('mock-ai');
    expect(validated.keyFacts.length).toBeGreaterThan(0);
    // Every key fact must cite a real article ID from the input.
    const validIds = new Set(articles.map((a) => a.id));
    for (const fact of validated.keyFacts) {
      expect(fact.sourceArticleIds.every((id) => validIds.has(id))).toBe(true);
    }
  });

  it('clearly discloses that it is not live AI reasoning', async () => {
    const articles = [makeArticle({ id: 'a1' })];
    const candidate = (await provider.analyzeNews({ query: 'test', articles })) as {
      unknowns: string[];
    };
    expect(candidate.unknowns.some((u) => /mock/i.test(u))).toBe(true);
  });

  it('Milestone #31: cites sources using request-local evidenceIds (S1/S2/...), never real article IDs', async () => {
    const articles = [
      makeArticle({ id: 'a1', title: 'Story A' }),
      makeArticle({ id: 'a2', title: 'Story B' }),
    ];
    const candidate = (await provider.analyzeNews({ query: 'test', articles })) as {
      keyFacts: Array<{ evidenceIds: string[] }>;
    };
    for (const fact of candidate.keyFacts) {
      for (const evidenceId of fact.evidenceIds) {
        expect(evidenceId).toMatch(/^S[12]$/);
      }
    }
  });

  it('Milestone #31: validated output never contains an S-label, only real article IDs', async () => {
    const articles = [
      makeArticle({ id: 'a1', title: 'Story A' }),
      makeArticle({ id: 'a2', title: 'Story B' }),
    ];
    const candidate = await provider.analyzeNews({ query: 'test', articles });
    const validated = validateAnalysisResult(candidate, {
      query: 'test',
      articles,
      analysisMode: 'mock-ai',
    });
    const realIds = new Set(articles.map((a) => a.id));
    for (const fact of validated.keyFacts) {
      for (const id of fact.sourceArticleIds) {
        expect(realIds.has(id)).toBe(true);
        expect(id).not.toMatch(/^S\d+$/);
      }
    }
  });
});
