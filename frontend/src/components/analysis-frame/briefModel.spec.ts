import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { buildBriefModel, buildBriefTelemetry } from './briefModel';

const analysis = (over: Record<string, unknown> = {}): any => ({
  query: 'q', headline: 'District health programme expansion announced',
  summary: 'A long orientation paragraph that runs to several sentences. It is the expanded brief. It must never be sliced.',
  keyFacts: [], agreements: [], differences: [], unknowns: [], timeline: [],
  confidence: { level: 'medium', score: 60, explanation: 'ok' },
  entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
  sources: [], generatedAt: '2026-08-24T09:00:00Z', analysisMode: 'live-ai',
  trustState: { level: 'moderate', reasons: [], distinctSourceArticleCount: 2, differenceTopicCount: 0, uncertaintyCount: 0 },
  context: [], relevance: [], affectedParties: [], immediateImpacts: [], spilloverImplications: [],
  significance: null, watchNext: [], uncertainties: [], ...over,
});

const response = (over: Record<string, unknown> = {}): AnalysisApiResponse =>
  ({ query: 'q', requestedLanguage: 'en', responseLanguage: 'en', normalizedQuery: 'q',
     analysis: analysis(), articles: [], retrievalContext: { dataMode: 'live', providers: [] },
     sourceEntities: { organizations: [] }, provenance: { status: 'success' },
     ...over } as unknown as AnalysisApiResponse);

describe('RULING 2 — ordinary analysis: title and telemetry only, never a fabricated clause', () => {
  it('exposes headline as the title and summary as the paragraph, both verbatim', () => {
    const model = buildBriefModel(response());
    expect(model.title).toBe('District health programme expansion announced');
    expect(model.paragraph).toBe(analysis().summary);
  });

  it('CLAUSE IS NULL — the contract supplies no thesis clause on this path', () => {
    const model = buildBriefModel(response());
    expect(model.clause).toBeNull();
    expect(model.clauseSource).toBe('unavailable');
  });

  it('the clause is never any prefix, sentence or slice of the summary paragraph', () => {
    const model = buildBriefModel(response());
    expect(model.clause).toBeNull();
    // Guard against a future "helpful" first-sentence implementation.
    const firstSentence = analysis().summary.split('. ')[0];
    expect(model.clause).not.toBe(firstSentence);
    expect(model.clause).not.toBe(`${firstSentence}.`);
  });

  it('the paragraph is returned at full length — never clamped in the model', () => {
    const long = 'x'.repeat(4000);
    expect(buildBriefModel(response({ analysis: analysis({ summary: long }) })).paragraph).toHaveLength(4000);
  });

  it('the title is not marked orientation-only when there is no relational composition', () => {
    expect(buildBriefModel(response()).titleIsOrientationOnly).toBe(false);
  });
});

describe('RULING 2 — relational analysis: the backend-authored reduction is authoritative', () => {
  const relational = response({
    analysis: analysis({
      relationalComposition: {
        directionalEligibility: 'supported', evidenceSufficiency: 'adequate',
        summary: 'The evidence describes coffee prices affecting export revenue, not the reverse.',
        supportingClaims: [], reverseClaims: [], associationOnlyClaims: [], mixedClaims: [],
        unclearOrNonSubstantiveClaims: [],
      },
    }),
  });

  it('uses relationalComposition.summary as the clause', () => {
    const model = buildBriefModel(relational);
    expect(model.clause).toBe('The evidence describes coffee prices affecting export revenue, not the reverse.');
    expect(model.clauseSource).toBe('relational-composition');
  });

  it('MARKS THE TITLE AS ORIENTATION ONLY — it must not read as the answer', () => {
    expect(buildBriefModel(relational).titleIsOrientationOnly).toBe(true);
  });

  it('an empty or whitespace relational summary is treated as absent, never rendered blank', () => {
    for (const summary of ['', '   ']) {
      const r = response({ analysis: analysis({ relationalComposition: { summary } }) });
      expect(buildBriefModel(r).clause).toBeNull();
    }
  });
});

describe('brief telemetry — every figure traced to a contract field', () => {
  it('reads counts from sourceDiversity and nowhere else', () => {
    const r = response({ sourceDiversity: { retrievedArticleCount: 5, reportingClusterCount: 3, duplicateLikeClusterCount: 1, largestClusterSize: 2, knownDomainCount: 4, unknownDomainArticleCount: 0, distinctSourceNameCount: 5 } });
    expect(buildBriefTelemetry(r, 1)).toEqual({ retrievedArticleCount: 5, reportingClusterCount: 3, unresolvedCount: 1 });
  });

  it('reports null rather than zero when sourceDiversity is absent', () => {
    expect(buildBriefTelemetry(response(), null)).toEqual({ retrievedArticleCount: null, reportingClusterCount: null, unresolvedCount: null });
  });
});

describe('analysis failure', () => {
  it('yields an empty brief rather than inventing prose', () => {
    const model = buildBriefModel(response({ analysis: null }));
    expect(model.title).toBe('');
    expect(model.clause).toBeNull();
    expect(model.paragraph).toBe('');
  });
});
