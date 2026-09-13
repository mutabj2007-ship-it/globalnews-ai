import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  AffectedParty,
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
} from '@globalnews-ai/shared';
import {
  buildDimensionClaims,
  buildExecutiveBriefModel,
  buildTelemetryModel,
  citedSourceCount,
} from './analysisClaims';
import { buildAnalysisWorkspaceModel, PRIMARY_DIMENSION_KEYS } from './analysisDimensions';

/**
 * H2C — the pure claim/evidence adapter.
 *
 * The most important test in this file is the count lock in section A.
 * The index row and the viewport cards are two renderings of one
 * selection; if they could ever disagree, the navigator would be lying
 * about the analysis. Asserting it for every dimension across several
 * payload shapes is what makes that structural rather than hopeful.
 */

function article(id: string, sourceName = `Source ${id}`): NewsArticle {
  return {
    id,
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    url: `https://example.test/${id}`,
    sourceId: `src-${id}`,
    sourceName,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-22T06:00:00.000Z',
  };
}

function claim(text: string, ids: string[], sourceCount?: number): SourcedClaim {
  return {
    claim: text,
    sourceArticleIds: ids,
    ...(sourceCount === undefined
      ? {}
      : { evidenceBreadth: { sourceCount, singleSource: sourceCount === 1 } }),
  };
}

function party(name: string, effect: string, ids: string[]): AffectedParty {
  return { party: name, partyType: 'country', effect, sourceArticleIds: ids };
}

const ARTICLES: NewsArticle[] = [article('a1'), article('a2'), article('a3')];

function analysisWith(overrides: Partial<NewsAnalysisResult> = {}): NewsAnalysisResult {
  const base: NewsAnalysisResult = {
    query: 'q',
    headline: 'Headline',
    summary: 'A verbatim executive summary.',
    keyFacts: [claim('Fact one', ['a1'], 1), claim('Fact two', ['a2', 'a3'], 2)],
    agreements: [],
    differences: [],
    unknowns: ['Nobody has confirmed the cause.'],
    timeline: [],
    confidence: { level: 'high', score: 91, explanation: 'model self-assessment' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
    sources: ARTICLES.map((a) => ({
      articleId: a.id,
      publisher: `Publisher ${a.id}`,
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
    })),
    generatedAt: '2026-08-22T06:05:00.000Z',
    analysisMode: 'live-ai',
    trustState: {
      level: 'moderate',
      reasons: [],
      distinctSourceArticleCount: 3,
      differenceTopicCount: 0,
      uncertaintyCount: 1,
    },
    uncertainties: [{ description: 'Reports conflict on the timing.', sourceArticleIds: ['a1'] }],
    context: [],
    relevance: [claim('It matters because.', ['a1'], 1)],
    affectedParties: [party('Kenya', 'Exports delayed', ['a2'])],
    immediateImpacts: [claim('Prices moved', ['a3'], 1)],
    spilloverImplications: [],
    significance: { level: 'major', rationale: [claim('Two agencies acted', ['a1', 'a2'], 2)] },
    watchNext: [],
  };
  return { ...base, ...overrides };
}

function responseWith(
  analysis: NewsAnalysisResult | null,
  extra: Partial<AnalysisApiResponse> = {},
): AnalysisApiResponse {
  return {
    query: 'What is happening?',
    normalizedQuery: 'what is happening',
    requestedLanguage: 'en',
    responseLanguage: 'en',
    analysis,
    articles: ARTICLES,
    retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 3 },
    sourceEntities: { organizations: [] },
    provenance: {
      provider: 'openai',
      executionMode: 'production',
      analysisMode: 'live-ai',
      status: 'success',
      cached: false,
    },
    ...extra,
  };
}

const SRC = readFileSync(join(__dirname, 'analysisClaims.ts'), 'utf-8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ------------------------------------------------------------------ *
 * A. The count lock
 * ------------------------------------------------------------------ */

describe('A. Entry count always equals the index count', () => {
  const payloads: ReadonlyArray<readonly [string, AnalysisApiResponse]> = [
    ['a populated analysis', responseWith(analysisWith())],
    [
      'an analysis with every list empty',
      responseWith(
        analysisWith({
          keyFacts: [],
          relevance: [],
          affectedParties: [],
          immediateImpacts: [],
          unknowns: [],
          uncertainties: [],
          significance: null,
        }),
      ),
    ],
    ['an analysis with no significance block', responseWith(analysisWith({ significance: null }))],
    [
      'an analysis with uncertainties absent from the payload',
      responseWith(analysisWith({ uncertainties: undefined })),
    ],
    ['a failed analysis', responseWith(null)],
  ];

  payloads.forEach(([name, response]) => {
    const model = buildAnalysisWorkspaceModel(response);
    PRIMARY_DIMENSION_KEYS.forEach((key) => {
      it(`${key} matches the adapter count for ${name}`, () => {
        const dimension = model.dimensions.find((d) => d.key === key);
        const entries = buildDimensionClaims(response, key);
        if (key === 'brief') {
          // The brief is E-09 + E-10, not a list; its index count is a dash.
          expect(dimension?.count).toBeNull();
          expect(entries).toHaveLength(0);
          return;
        }
        expect(entries).toHaveLength(dimension?.count ?? -1);
      });
    });
  });
});

/* ------------------------------------------------------------------ *
 * B. Text is carried, never composed
 * ------------------------------------------------------------------ */

describe('B. Verbatim contract text', () => {
  const response = responseWith(analysisWith());

  it('copies claim text exactly', () => {
    expect(buildDimensionClaims(response, 'key-facts').map((e) => e.text)).toEqual([
      'Fact one',
      'Fact two',
    ]);
  });

  it('keeps the affected party and its effect as separate fields', () => {
    const [entry] = buildDimensionClaims(response, 'who-is-affected');
    expect(entry?.party).toBe('Kenya');
    expect(entry?.partyType).toBe('country');
    expect(entry?.text).toBe('Exports delayed');
  });

  it('carries an evidence excerpt without paraphrase or truncation', () => {
    const excerpt = 'The ministry said exports were held for four days.';
    const withBasis = responseWith(
      analysisWith({
        keyFacts: [{ ...claim('Fact', ['a1'], 1), evidenceBasis: { articleId: 'a1', excerpt } }],
      }),
    );
    expect(buildDimensionClaims(withBasis, 'key-facts')[0]?.evidenceBasis?.excerpt).toBe(excerpt);
  });

  it('treats an unknowns string as a first-class, genuinely uncited entry', () => {
    const entries = buildDimensionClaims(response, 'insufficient-evidence');
    const unknown = entries.find((e) => e.kind === 'unknown');
    expect(unknown?.text).toBe('Nobody has confirmed the cause.');
    expect(unknown?.uncited).toBe(true);
    expect(unknown?.citations).toHaveLength(0);
  });

  it('orders insufficient-evidence as uncertainties then unknowns, with running ordinals', () => {
    const entries = buildDimensionClaims(response, 'insufficient-evidence');
    expect(entries.map((e) => e.kind)).toEqual(['uncertainty', 'unknown']);
    expect(entries.map((e) => e.ordinal)).toEqual(['01', '02']);
  });
});

/* ------------------------------------------------------------------ *
 * C. Citations resolve by articleId, never by position
 * ------------------------------------------------------------------ */

describe('C. Citation identity', () => {
  it('numbers a citation from the source list, not the render order', () => {
    const response = responseWith(
      analysisWith({ keyFacts: [claim('Cites the third article', ['a3'], 1)] }),
    );
    const [entry] = buildDimensionClaims(response, 'key-facts');
    // First and only rendered card, but the third source.
    expect(entry?.citations[0]?.citationNumber).toBe(3);
  });

  it('keeps a citation number attached to its article when the list is reordered', () => {
    const forward = responseWith(
      analysisWith({ keyFacts: [claim('One', ['a1'], 1), claim('Two', ['a3'], 1)] }),
    );
    const reversed = responseWith(
      analysisWith({ keyFacts: [claim('Two', ['a3'], 1), claim('One', ['a1'], 1)] }),
    );
    const numberFor = (r: AnalysisApiResponse, text: string): number | null | undefined =>
      buildDimensionClaims(r, 'key-facts').find((e) => e.text === text)?.citations[0]
        ?.citationNumber;

    expect(numberFor(forward, 'Two')).toBe(numberFor(reversed, 'Two'));
    expect(numberFor(forward, 'One')).toBe(numberFor(reversed, 'One'));
  });

  it('deduplicates a repeated article id on one entry', () => {
    const response = responseWith(
      analysisWith({ keyFacts: [claim('Repeats a source', ['a1', 'a1', 'a2'])] }),
    );
    expect(buildDimensionClaims(response, 'key-facts')[0]?.citations).toHaveLength(2);
  });

  it('marks a citation unresolved rather than inventing a number', () => {
    const response = responseWith(
      analysisWith({ keyFacts: [claim('Cites something absent', ['ghost'])] }),
    );
    const [citation] = buildDimensionClaims(response, 'key-facts')[0]?.citations ?? [];
    expect(citation?.citationNumber).toBeNull();
    expect(citation?.outletName).toBeNull();
    expect(citation?.resolved).toBe(false);
  });

  it('resolves the outlet from the source record, falling back to the article', () => {
    const response = responseWith(analysisWith());
    expect(buildDimensionClaims(response, 'key-facts')[0]?.citations[0]?.outletName).toBe(
      'Publisher a1',
    );

    const noSources = responseWith(analysisWith({ sources: [] }));
    expect(buildDimensionClaims(noSources, 'key-facts')[0]?.citations[0]?.outletName).toBe(
      'Source a1',
    );
  });
});

/* ------------------------------------------------------------------ *
 * D. Counts are counts
 * ------------------------------------------------------------------ */

describe('D. No fabricated quantity', () => {
  it('prefers the backend evidence breadth when the payload carries one', () => {
    const response = responseWith(analysisWith({ keyFacts: [claim('Fact', ['a1', 'a2'], 2)] }));
    const [entry] = buildDimensionClaims(response, 'key-facts');
    expect(entry?.evidenceBreadth).toEqual({ sourceCount: 2, singleSource: false });
    expect(citedSourceCount(entry!)).toBe(2);
  });

  it('falls back to the count of distinct citations when breadth is absent', () => {
    const response = responseWith(analysisWith({ keyFacts: [claim('Fact', ['a1', 'a2'])] }));
    const [entry] = buildDimensionClaims(response, 'key-facts');
    expect(entry?.evidenceBreadth).toBeNull();
    expect(citedSourceCount(entry!)).toBe(2);
  });

  it('returns null rather than zero when there is nothing to count', () => {
    const response = responseWith(analysisWith());
    const unknown = buildDimensionClaims(response, 'insufficient-evidence').find(
      (e) => e.kind === 'unknown',
    );
    expect(citedSourceCount(unknown!)).toBeNull();
  });

  it('never synthesises an evidence breadth for a record type that has none', () => {
    const response = responseWith(analysisWith());
    const uncertainty = buildDimensionClaims(response, 'insufficient-evidence').find(
      (e) => e.kind === 'uncertainty',
    );
    expect(uncertainty?.evidenceBreadth).toBeNull();
    expect(uncertainty?.evidenceBasis).toBeNull();
  });

  it('reports a null cluster count when sourceDiversity is absent, never the article count', () => {
    const telemetry = buildTelemetryModel(responseWith(analysisWith()));
    expect(telemetry.articlesRetrieved).toBe(3);
    expect(telemetry.reportingClusterCount).toBeNull();
  });

  it('reads the real cluster count when the payload carries one', () => {
    const telemetry = buildTelemetryModel(
      responseWith(analysisWith(), {
        sourceDiversity: {
          retrievedArticleCount: 3,
          reportingClusterCount: 2,
          duplicateLikeClusterCount: 1,
          largestClusterSize: 2,
          knownDomainCount: 3,
          unknownDomainArticleCount: 0,
          distinctSourceNameCount: 3,
        },
      }),
    );
    expect(telemetry.reportingClusterCount).toBe(2);
  });
});

/* ------------------------------------------------------------------ *
 * E. Degraded payloads
 * ------------------------------------------------------------------ */

describe('E. Missing data produces an empty state, never a substitute', () => {
  it('returns no entries at all when the AI failed', () => {
    PRIMARY_DIMENSION_KEYS.forEach((key) => {
      expect(buildDimensionClaims(responseWith(null), key)).toHaveLength(0);
    });
  });

  it('omits the executive brief when there is no analysis or no summary', () => {
    expect(buildExecutiveBriefModel(responseWith(null))).toBeNull();
    expect(buildExecutiveBriefModel(responseWith(analysisWith({ summary: '   ' })))).toBeNull();
  });

  it('carries the summary verbatim when one exists', () => {
    const brief = buildExecutiveBriefModel(responseWith(analysisWith()));
    expect(brief?.summary).toBe('A verbatim executive summary.');
    expect(brief?.generatedAt).toBe('2026-08-22T06:05:00.000Z');
  });
});

/* ------------------------------------------------------------------ *
 * F. What this module is forbidden to touch
 * ------------------------------------------------------------------ */

describe('F. Purity and prohibited reads', () => {
  it('never reads the model self-assessment confidence', () => {
    // The contract documents analysis.confidence as model self-reported
    // metadata that is explicitly NOT the authoritative trust signal.
    expect(CODE).not.toContain('.confidence');
    expect(CODE).not.toContain('confidence');
  });

  it('never reads a retrieval or geographic confidence signal either', () => {
    expect(CODE).not.toContain('matchConfidence');
  });

  it('contains no fetch, no API client and no second analysis request', () => {
    expect(CODE).not.toContain('fetch(');
    expect(CODE).not.toContain('analysisApi');
    expect(CODE).not.toContain('XMLHttpRequest');
  });

  it('contains no React, JSX, DOM or timer', () => {
    expect(CODE).not.toContain('react');
    expect(CODE).not.toContain('document.');
    expect(CODE).not.toContain('window.');
    expect(CODE).not.toContain('setTimeout');
  });

  it('does not mutate the response it is given', () => {
    const response = responseWith(analysisWith());
    const before = JSON.stringify(response);
    PRIMARY_DIMENSION_KEYS.forEach((key) => buildDimensionClaims(response, key));
    buildExecutiveBriefModel(response);
    buildTelemetryModel(response);
    expect(JSON.stringify(response)).toBe(before);
  });

  it('is deterministic across repeated calls', () => {
    const response = responseWith(analysisWith());
    expect(JSON.stringify(buildDimensionClaims(response, 'key-facts'))).toBe(
      JSON.stringify(buildDimensionClaims(response, 'key-facts')),
    );
  });
});
