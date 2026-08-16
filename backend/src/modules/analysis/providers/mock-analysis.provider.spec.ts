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
      maxArticleChars: 1200,
    });

    expect(validated.analysisMode).toBe('mock-ai');
    expect(validated.keyFacts.length).toBeGreaterThan(0);
    // Every key fact must cite a real article ID from the input.
    const validIds = new Set(articles.map((a) => a.id));
    for (const fact of validated.keyFacts) {
      expect(fact.sourceArticleIds.every((id) => validIds.has(id))).toBe(true);
    }
  });

  it('Milestone #32: produces schema-valid, backend-verifiable evidenceBreadth/evidenceBasis', async () => {
    const articles = [
      makeArticle({ id: 'a1', title: 'Story A' }),
      makeArticle({ id: 'a2', title: 'Story B' }),
    ];
    const candidate = await provider.analyzeNews({ query: 'test', articles });
    const validated = validateAnalysisResult(candidate, {
      query: 'test',
      articles,
      analysisMode: 'mock-ai',
      maxArticleChars: 1200,
    });

    for (const fact of validated.keyFacts) {
      expect(fact.evidenceBreadth).toEqual({ sourceCount: 1, singleSource: true });
      // The mock provider's excerpt is the article's own title, so it
      // must independently validate against the supplied evidence text
      // exactly like a live provider's would — no special trust.
      expect(fact.evidenceBasis).toBeDefined();
      expect(fact.evidenceBasis?.articleId).toBe(fact.sourceArticleIds[0]);
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

  describe('Milestone #47 (runtime correction) — mock analysis response language', () => {
    it('English (default, no responseLanguage) demonstration prose remains in English, unchanged from pre-Milestone-#47 behavior', async () => {
      const articles = [makeArticle({ id: 'a1', title: 'Story A' })];
      const candidate = (await provider.analyzeNews({ query: 'test', articles })) as {
        summary: string;
        unknowns: string[];
        uncertainties: Array<{ description: string }>;
        confidence: { explanation: string };
      };
      expect(candidate.summary).toContain('This is a demonstration analysis');
      expect(candidate.unknowns[0]).toContain('mock analysis');
      expect(candidate.uncertainties[0].description).toContain('mock analysis');
      expect(candidate.confidence.explanation).toContain('Mock analysis mode');
    });

    it('explicit responseLanguage="en" behaves identically to the default', async () => {
      const articles = [makeArticle({ id: 'a1', title: 'Story A' })];
      const withDefault = await provider.analyzeNews({ query: 'test', articles });
      const withExplicitEn = await provider.analyzeNews({
        query: 'test',
        articles,
        responseLanguage: 'en',
      });
      expect(withDefault).toEqual(withExplicitEn);
    });

    it('responseLanguage="pl" produces Polish demonstration prose', async () => {
      const articles = [makeArticle({ id: 'a1', title: 'Story A' })];
      const candidate = (await provider.analyzeNews({
        query: 'test',
        articles,
        responseLanguage: 'pl',
      })) as {
        summary: string;
        unknowns: string[];
        uncertainties: Array<{ description: string }>;
        confidence: { explanation: string };
      };
      expect(candidate.summary).toContain('analiza demonstracyjna');
      expect(candidate.unknowns[0]).toContain('analiza demonstracyjna');
      expect(candidate.uncertainties[0].description).toContain('analiza demonstracyjna');
      expect(candidate.confidence.explanation).toContain('demonstracyjnej');
    });

    it('Polish mock output still passes the SAME unmodified validator, deterministically', async () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Story A' }),
        makeArticle({ id: 'a2', title: 'Story B' }),
      ];
      const candidate = await provider.analyzeNews({
        query: 'test',
        articles,
        responseLanguage: 'pl',
      });
      const validated = validateAnalysisResult(candidate, {
        query: 'test',
        articles,
        analysisMode: 'mock-ai',
        maxArticleChars: 1200,
      });
      expect(validated.analysisMode).toBe('mock-ai');
      expect(validated.keyFacts.length).toBeGreaterThan(0);
    });

    it("headline is NEVER translated — always the real article's own title, verbatim, regardless of responseLanguage", async () => {
      const articles = [makeArticle({ id: 'a1', title: 'Real English Headline Text' })];
      const candidateEn = (await provider.analyzeNews({ query: 'test', articles })) as {
        headline: string;
      };
      const candidatePl = (await provider.analyzeNews({
        query: 'test',
        articles,
        responseLanguage: 'pl',
      })) as { headline: string };
      expect(candidateEn.headline).toBe('Real English Headline Text');
      expect(candidatePl.headline).toBe('Real English Headline Text');
    });

    it('source names in entities.organizations are NEVER translated, regardless of responseLanguage', async () => {
      const articles = [makeArticle({ id: 'a1', sourceName: 'Reuters' })];
      const candidatePl = (await provider.analyzeNews({
        query: 'test',
        articles,
        responseLanguage: 'pl',
      })) as { entities: { organizations: string[] } };
      expect(candidatePl.entities.organizations).toContain('Reuters');
    });

    it('an unimplemented mock language (e.g. "sw") falls back to English demonstration prose, not an error or empty string', async () => {
      const articles = [makeArticle({ id: 'a1', title: 'Story A' })];
      const candidate = (await provider.analyzeNews({
        query: 'test',
        articles,
        responseLanguage: 'sw',
      })) as { summary: string };
      expect(candidate.summary).toContain('This is a demonstration analysis');
    });

    it('remains fully deterministic for the same input and language', async () => {
      const articles = [makeArticle({ id: 'a1', title: 'Story A' })];
      const a = await provider.analyzeNews({ query: 'test', articles, responseLanguage: 'pl' });
      const b = await provider.analyzeNews({ query: 'test', articles, responseLanguage: 'pl' });
      expect(a).toEqual(b);
    });
  });

  describe('Milestone #62 Phase 1 — context/relevance', () => {
    it('always returns empty context and relevance arrays — the mock never fabricates background/importance reasoning, matching its existing honest differences: [] behavior', async () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Story A' }),
        makeArticle({ id: 'a2', title: 'Story B' }),
      ];
      const candidate = (await provider.analyzeNews({ query: 'test', articles })) as {
        context: unknown[];
        relevance: unknown[];
      };
      expect(candidate.context).toEqual([]);
      expect(candidate.relevance).toEqual([]);
    });
  });

  describe('Milestone #62 Phase 2 — affectedParties/immediateImpacts/spilloverImplications', () => {
    it('always returns empty affectedParties, immediateImpacts, and spilloverImplications arrays — the mock never fabricates rich demo intelligence for these fields, matching the existing honest empty-array pattern', async () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Story A' }),
        makeArticle({ id: 'a2', title: 'Story B' }),
      ];
      const candidate = (await provider.analyzeNews({ query: 'test', articles })) as {
        affectedParties: unknown[];
        immediateImpacts: unknown[];
        spilloverImplications: unknown[];
      };
      expect(candidate.affectedParties).toEqual([]);
      expect(candidate.immediateImpacts).toEqual([]);
      expect(candidate.spilloverImplications).toEqual([]);
    });
  });

  describe('Milestone #62 Phase 3 — significance', () => {
    it('always returns null significance — mock mode never fabricates a severity judgment', async () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Story A' }),
        makeArticle({ id: 'a2', title: 'Story B' }),
      ];
      const candidate = (await provider.analyzeNews({ query: 'test', articles })) as {
        significance: unknown;
      };
      expect(candidate.significance).toBeNull();
    });
  });

  describe('Milestone #62 Phase 4 (final) — watchNext', () => {
    it('always returns an empty watchNext array — mock mode never fabricates forthcoming intelligence', async () => {
      const articles = [
        makeArticle({ id: 'a1', title: 'Story A' }),
        makeArticle({ id: 'a2', title: 'Story B' }),
      ];
      const candidate = (await provider.analyzeNews({ query: 'test', articles })) as {
        watchNext: unknown[];
      };
      expect(candidate.watchNext).toEqual([]);
    });
  });
});
