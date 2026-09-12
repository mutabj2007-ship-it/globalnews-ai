import type {
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
} from '@globalnews-ai/shared';
import {
  PRIMARY_DIMENSION_KEYS,
  SUB_VIEW_ALLOCATION,
  buildAnalysisWorkspaceModel,
  buildCitationNumbering,
  buildSourceSupport,
  citationNumberFor,
  resolveClaimReference,
  resolveGeography,
  subViewHash,
} from './analysisDimensions';

/**
 * H2A — analysisDimensions.ts
 *
 * Unlike every other spec in this directory, these are REAL behavioural
 * unit tests rather than source-text assertions. That is possible here
 * precisely because analysisDimensions.ts is a pure module: no React, no
 * JSX, no DOM, no I/O. It runs unmodified under the repository's existing
 * `testEnvironment: 'node'` harness, so no jsdom and no React Testing
 * Library dependency is introduced (H2A authorization section 2).
 */

/* ------------------------------------------------------------------ *
 * Fixtures — shaped exactly like production, never copied from the
 * Claude Design prototype (whose content is hard-coded demo material).
 * ------------------------------------------------------------------ */

function article(id: string, sourceName: string): NewsArticle {
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

const ARTICLES: NewsArticle[] = [
  article('a1', 'India Today'),
  article('a2', 'The Manila Times'),
  article('a3', 'The Morning Star'),
  article('a4', 'Al Jazeera'),
];

function fullAnalysis(overrides: Partial<NewsAnalysisResult> = {}): NewsAnalysisResult {
  const base: NewsAnalysisResult = {
    query: 'q',
    headline: 'Headline',
    summary: 'Executive summary text.',
    keyFacts: [claim('Fact one', ['a1'], 1), claim('Fact two', ['a1', 'a2'], 2)],
    agreements: [{ point: 'Sources concur', sourceArticleIds: ['a2', 'a3'] }],
    differences: [
      {
        topic: 'Scale',
        positions: [
          { description: 'Account A', sourceArticleIds: ['a1'] },
          { description: 'Account B', sourceArticleIds: ['a4'] },
        ],
      },
    ],
    unknowns: ['Unknown one', 'Unknown two'],
    timeline: [{ timestamp: '2026-08-21T00:00:00.000Z', event: 'Event', sourceArticleIds: ['a3'] }],
    confidence: { level: 'medium', score: 50, explanation: 'Model self-assessment.' },
    entities: { countries: ['X'], locations: [], people: [], organizations: [], topics: ['t'] },
    sources: ARTICLES.map((a) => ({
      articleId: a.id,
      publisher: a.sourceName,
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
      differenceTopicCount: 1,
      uncertaintyCount: 1,
    },
    uncertainties: [{ description: 'Cited uncertainty', sourceArticleIds: ['a2'] }],
    context: [claim('Background context', ['a1'], 1)],
    relevance: [claim('Why it matters', ['a2'], 1)],
    affectedParties: [
      { party: 'Country X', partyType: 'country', effect: 'Effect', sourceArticleIds: ['a3'] },
    ],
    immediateImpacts: [claim('Immediate impact', ['a1'], 1)],
    spilloverImplications: [claim('Spillover', ['a4'], 1)],
    significance: { level: 'major', rationale: [claim('Significant because', ['a1'], 1)] },
    watchNext: [
      {
        claim: 'Watch this',
        hingeType: 'scheduled_event',
        sourceArticleIds: ['a2'],
      },
    ],
    relationalComposition: {
      directionalEligibility: 'supported',
      evidenceSufficiency: 'adequate',
      summary: 'Backend template summary.',
      supportingClaims: [{ section: 'keyFacts', index: 0 }],
      reverseClaims: [],
      associationOnlyClaims: [{ section: 'agreements', index: 0 }],
      mixedClaims: [],
      unclearOrNonSubstantiveClaims: [],
    },
  };
  return { ...base, ...overrides };
}

function response(overrides: Partial<AnalysisApiResponse> = {}): AnalysisApiResponse {
  const base: AnalysisApiResponse = {
    query: 'q',
    normalizedQuery: 'q',
    requestedLanguage: 'en',
    responseLanguage: 'en',
    analysis: fullAnalysis(),
    articles: ARTICLES,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews'],
      articlesRetrieved: 4,
      countryCode: 'CD',
      countryName: 'Democratic Republic of the Congo',
    },
    sourceEntities: { organizations: [] },
    sourceDiversity: {
      retrievedArticleCount: 4,
      reportingClusterCount: 4,
      duplicateLikeClusterCount: 0,
      largestClusterSize: 1,
      knownDomainCount: 4,
      unknownDomainArticleCount: 0,
      distinctSourceNameCount: 4,
    },
    provenance: {
      provider: 'openai',
      executionMode: 'production',
      analysisMode: 'live-ai',
      status: 'success',
      cached: false,
    },
  };
  return { ...base, ...overrides };
}

/** An analysis whose every array is empty — the zero-count contract. */
function emptyAnalysis(): NewsAnalysisResult {
  return fullAnalysis({
    keyFacts: [],
    agreements: [],
    differences: [],
    unknowns: [],
    timeline: [],
    uncertainties: [],
    context: [],
    relevance: [],
    affectedParties: [],
    immediateImpacts: [],
    spilloverImplications: [],
    significance: null,
    watchNext: [],
    relationalComposition: undefined,
  });
}

/* ------------------------------------------------------------------ *
 * A. The fixed seven
 * ------------------------------------------------------------------ */

describe('A. Fixed seven primary dimensions', () => {
  it('exposes exactly seven primary dimension keys', () => {
    expect(PRIMARY_DIMENSION_KEYS).toHaveLength(7);
  });

  it('exposes them in the exact approved order', () => {
    expect([...PRIMARY_DIMENSION_KEYS]).toEqual([
      'brief',
      'significance',
      'why-this-matters',
      'who-is-affected',
      'immediate-effects',
      'key-facts',
      'insufficient-evidence',
    ]);
  });

  it('builds exactly seven dimensions, in that same order, from a full response', () => {
    const model = buildAnalysisWorkspaceModel(response());
    expect(model.dimensions.map((d) => d.key)).toEqual([...PRIMARY_DIMENSION_KEYS]);
  });

  it('never produces an eighth primary dimension, even when every level-2 field is populated', () => {
    const model = buildAnalysisWorkspaceModel(response());
    expect(model.dimensions).toHaveLength(7);

    // The seven preserved capabilities must NOT appear as primary keys.
    const primaryKeys = model.dimensions.map((d) => String(d.key));
    [
      'context',
      'spillover',
      'spilloverImplications',
      'watch-next',
      'watchNext',
      'agreements',
      'differences',
      'timeline',
      'relationships',
      'relationalComposition',
    ].forEach((forbidden) => {
      expect(primaryKeys).not.toContain(forbidden);
    });
  });

  it('binds the correct dimension accent tokens (02-DESKTOP-SPEC section 4, unchanged by R1)', () => {
    const model = buildAnalysisWorkspaceModel(response());
    const accents = Object.fromEntries(model.dimensions.map((d) => [d.key, d.accent]));
    expect(accents).toEqual({
      brief: 'gn-ai',
      significance: 'gn-significance',
      'why-this-matters': 'gn-ai',
      'who-is-affected': 'gn-geo',
      'immediate-effects': 'gn-verified',
      'key-facts': 'gn-verified',
      'insufficient-evidence': 'gn-uncertain',
    });
  });
});

/* ------------------------------------------------------------------ *
 * B. Zero-count contract — the recorded reversal
 * ------------------------------------------------------------------ */

describe('B. Zero-count dimensions remain present and selectable', () => {
  /**
   * THIS TEST RECORDS A DELIBERATE REVERSAL.
   *
   * The previous presentation (AnalysisResultView.tsx, M62) gated every
   * section on `.length > 0`, so an empty section vanished entirely, and
   * richIntelligenceFields.spec.ts asserted that no placeholder existed.
   *
   * The approved Claude Design inverts that: a zero-count dimension still
   * renders, still carries count 0, and remains selectable so the reader
   * can see for themselves that the analysis produced nothing there
   * (07-INTERACTION-STATES section 1, 08-DATA-BINDING-MAP item 13,
   * re-affirmed by R1 section 4). Absence of a finding is information.
   *
   * The reversal is recorded here rather than deleted, so a future reader
   * can see that the older behaviour was replaced on purpose.
   */
  it('keeps all seven dimensions when every analysis array is empty', () => {
    const model = buildAnalysisWorkspaceModel(response({ analysis: emptyAnalysis() }));
    expect(model.dimensions).toHaveLength(7);
    expect(model.dimensions.map((d) => d.key)).toEqual([...PRIMARY_DIMENSION_KEYS]);
  });

  it('gives every countable empty dimension the number 0, never null and never absent', () => {
    const model = buildAnalysisWorkspaceModel(response({ analysis: emptyAnalysis() }));
    model.dimensions
      .filter((d) => d.countable)
      .forEach((d) => {
        expect(d.count).toBe(0);
        expect(d.isEmpty).toBe(true);
      });
  });

  it('keeps every dimension selectable and present at count 0', () => {
    const model = buildAnalysisWorkspaceModel(response({ analysis: emptyAnalysis() }));
    model.dimensions.forEach((d) => {
      expect(d.present).toBe(true);
      expect(d.selectable).toBe(true);
    });
  });

  it('treats the Executive Brief as uncountable (index renders an em dash), not as count 0', () => {
    const model = buildAnalysisWorkspaceModel(response());
    const brief = model.dimensions.find((d) => d.key === 'brief');
    expect(brief?.countable).toBe(false);
    expect(brief?.count).toBeNull();
  });

  it('still renders all seven dimensions when the AI failed entirely', () => {
    const model = buildAnalysisWorkspaceModel(response({ analysis: null }));
    expect(model.analysisUnavailable).toBe(true);
    expect(model.dimensions).toHaveLength(7);
    model.dimensions.filter((d) => d.countable).forEach((d) => expect(d.count).toBe(0));
  });
});

/* ------------------------------------------------------------------ *
 * C. Per-dimension production field binding
 * ------------------------------------------------------------------ */

describe('C. Per-dimension field binding', () => {
  it('counts each dimension from its own production field', () => {
    const model = buildAnalysisWorkspaceModel(response());
    const counts = Object.fromEntries(model.dimensions.map((d) => [d.key, d.count]));

    expect(counts['significance']).toBe(1); // significance.rationale.length
    expect(counts['why-this-matters']).toBe(1); // relevance.length
    expect(counts['who-is-affected']).toBe(1); // affectedParties.length
    expect(counts['immediate-effects']).toBe(1); // immediateImpacts.length
    expect(counts['key-facts']).toBe(2); // keyFacts.length
    expect(counts['insufficient-evidence']).toBe(3); // uncertainties + unknowns
  });

  it('reads significance rationale length, and treats a null significance as 0 rather than absent', () => {
    const model = buildAnalysisWorkspaceModel(
      response({ analysis: fullAnalysis({ significance: null }) }),
    );
    const significance = model.dimensions.find((d) => d.key === 'significance');
    expect(significance?.count).toBe(0);
    expect(significance?.present).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * D. The seven preserved level-2 capabilities
 * ------------------------------------------------------------------ */

describe('D. All seven preserved intelligence capabilities are represented', () => {
  it('allocates sub-views to exactly the three dimensions R1 section 1.3 names', () => {
    expect(Object.keys(SUB_VIEW_ALLOCATION).sort()).toEqual([
      'immediate-effects',
      'key-facts',
      'who-is-affected',
    ]);
  });

  it('matches the R1 section 1.3 allocation table exactly', () => {
    const segments = (key: 'key-facts' | 'immediate-effects' | 'who-is-affected') =>
      (SUB_VIEW_ALLOCATION[key] ?? []).map((s) => s.key);

    expect(segments('key-facts')).toEqual(['reported-facts', 'agreements', 'differences']);
    expect(segments('immediate-effects')).toEqual(['reported-effects', 'spillover', 'timeline']);
    expect(segments('who-is-affected')).toEqual(['affected-entities', 'relationships']);
  });

  it('never exceeds three segments in any dimension', () => {
    Object.values(SUB_VIEW_ALLOCATION).forEach((segments) => {
      expect((segments ?? []).length).toBeLessThanOrEqual(3);
    });
  });

  it('gives SIGNIFICANCE, WHY THIS MATTERS, INSUFFICIENT EVIDENCE and BRIEF no strip at all', () => {
    const model = buildAnalysisWorkspaceModel(response());
    (['brief', 'significance', 'why-this-matters', 'insufficient-evidence'] as const).forEach(
      (key) => {
        const dimension = model.dimensions.find((d) => d.key === key);
        expect(dimension?.subViews).toHaveLength(0);
        expect(dimension?.stripVisible).toBe(false);
      },
    );
  });

  it('represents agreements, differences, spillover, timeline and relationships as sub-views with real counts', () => {
    const model = buildAnalysisWorkspaceModel(response());
    const find = (dimension: string, subView: string) =>
      model.dimensions.find((d) => d.key === dimension)?.subViews.find((s) => s.key === subView);

    expect(find('key-facts', 'agreements')?.count).toBe(1);
    expect(find('key-facts', 'differences')?.count).toBe(1);
    expect(find('immediate-effects', 'spillover')?.count).toBe(1);
    expect(find('immediate-effects', 'timeline')?.count).toBe(1);
    expect(find('who-is-affected', 'relationships')?.count).toBe(2); // 1 supporting + 1 association-only
  });

  it('represents context (E-24) with its claim structure intact, not flattened to prose', () => {
    const model = buildAnalysisWorkspaceModel(response());
    expect(model.context.present).toBe(true);
    expect(model.context.count).toBe(1);
    // The citation must survive: a flattened prose string could not carry this.
    expect(model.context.items[0]?.sourceArticleIds).toEqual(['a1']);
    expect(model.context.items[0]?.evidenceBreadth?.sourceCount).toBe(1);
  });

  it('represents watchNext (E-25) verbatim, including hingeType, with its mandatory qualifier', () => {
    const model = buildAnalysisWorkspaceModel(response());
    expect(model.watchNext.present).toBe(true);
    expect(model.watchNext.items[0]?.hingeType).toBe('scheduled_event');
    expect(model.watchNext.qualifier).toBe('AI_PROJECTED_NOT_A_FORECAST');
    // Never amber: watch-next is projection, not an evidentiary gap.
    expect(model.watchNext.accent).toBe('gn-ai');
    expect(model.watchNext.accent).not.toBe('gn-uncertain');
  });

  it('preserves relationalComposition as the real production structure, inventing no subject/relation/object triple', () => {
    const model = buildAnalysisWorkspaceModel(response());
    expect(model.relationships.present).toBe(true);
    expect(model.relationships.composition?.summary).toBe('Backend template summary.');
    expect(model.relationships.composition?.directionalEligibility).toBe('supported');
    expect(model.relationships.bucketCounts).toEqual({
      supporting: 1,
      reverse: 0,
      associationOnly: 1,
      mixed: 0,
      unclearOrNonSubstantive: 0,
    });

    // Nothing resembling a fabricated triple is exposed.
    const serialized = JSON.stringify(model.relationships);
    expect(serialized).not.toMatch(/"subject"/);
    expect(serialized).not.toMatch(/"relation"/);
    expect(serialized).not.toMatch(/"object"/);
  });

  it('resolves a ClaimReference back into the real claim it points at, and null when out of range', () => {
    const analysis = fullAnalysis();
    expect(resolveClaimReference(analysis, { section: 'keyFacts', index: 0 })).toBe(
      analysis.keyFacts[0],
    );
    expect(resolveClaimReference(analysis, { section: 'agreements', index: 0 })).toBe(
      analysis.agreements[0],
    );
    expect(resolveClaimReference(analysis, { section: 'timeline', index: 99 })).toBeNull();
  });

  it('omits an empty extra segment, and hides the whole strip when only the primary survives', () => {
    const model = buildAnalysisWorkspaceModel(
      response({
        analysis: fullAnalysis({
          agreements: [],
          differences: [],
          spilloverImplications: [],
          timeline: [],
          relationalComposition: undefined,
        }),
      }),
    );

    const keyFacts = model.dimensions.find((d) => d.key === 'key-facts');
    expect(keyFacts?.subViews.map((s) => s.key)).toEqual(['reported-facts']);
    expect(keyFacts?.stripVisible).toBe(false);

    const effects = model.dimensions.find((d) => d.key === 'immediate-effects');
    expect(effects?.subViews.map((s) => s.key)).toEqual(['reported-effects']);
    expect(effects?.stripVisible).toBe(false);
  });

  it('keeps the primary segment even when the dimension itself is empty', () => {
    const model = buildAnalysisWorkspaceModel(response({ analysis: emptyAnalysis() }));
    const keyFacts = model.dimensions.find((d) => d.key === 'key-facts');
    expect(keyFacts?.subViews.map((s) => s.key)).toEqual(['reported-facts']);
    expect(keyFacts?.subViews[0]?.count).toBe(0);
  });

  it('carries exactly the two divergence labels R1 names, on exactly the two segments R1 names', () => {
    /**
     * R1 colour errata section 6 requires a visible label wherever a
     * sub-view's accent differs from its parent's, "so the distinction
     * survives greyscale and screen readers", and names exactly two:
     * AI-PROJECTED and SOURCES DIVERGE.
     *
     * Three segments carry a non-parent accent, but only two of them are
     * divergences in the errata's sense:
     *
     *   spillover  #60a5fa vs parent #34d399  -> AI_PROJECTED
     *              projected, not reported. A real semantic departure.
     *   differences #f59e0b vs parent #34d399 -> SOURCES_DIVERGE
     *              unsettled evidence. A real semantic departure.
     *   timeline   #22d3ee vs parent #34d399  -> no label, deliberately
     *              NOT a departure: errata section 5 restates gn-geo as
     *              "geographic, live AND temporal context" precisely so
     *              that cyan on the timeline segment is the hue's own
     *              assigned meaning. Labelling it would assert a
     *              distinction the errata went out of its way to remove,
     *              and R1 supplies no third label to use.
     */
    const labels = Object.values(SUB_VIEW_ALLOCATION)
      .flatMap((segments) => segments ?? [])
      .filter((segment) => segment.divergenceLabel !== null)
      .map((segment) => `${segment.key}:${segment.divergenceLabel}`)
      .sort();

    expect(labels).toEqual(['differences:SOURCES_DIVERGE', 'spillover:AI_PROJECTED']);
  });

  it('gives the timeline segment the temporal-context hue without a divergence label', () => {
    const timeline = (SUB_VIEW_ALLOCATION['immediate-effects'] ?? []).find(
      (s) => s.key === 'timeline',
    );
    expect(timeline?.accent).toBe('gn-geo');
    expect(timeline?.divergenceLabel).toBeNull();
  });

  it('produces the R1 level-2 hash format, and plain dimension hashes for primary segments', () => {
    expect(subViewHash('immediate-effects', 'timeline')).toBe('#immediate-effects/timeline');
    expect(subViewHash('key-facts', 'differences')).toBe('#key-facts/differences');
    expect(subViewHash('key-facts', 'reported-facts')).toBe('#key-facts');
    expect(subViewHash('significance', null)).toBe('#significance');
  });

  it('binds timeline to immediate-effects/timeline and to nowhere else — the excluded brief strip', () => {
    /**
     * The CTO excluded the optional always-visible Executive Brief
     * timeline strip. This asserts the exclusion structurally: timeline
     * appears in exactly one place in the whole view-model.
     */
    const model = buildAnalysisWorkspaceModel(response());

    const timelineSegments = model.dimensions.flatMap((d) =>
      d.subViews.filter((s) => s.key === 'timeline').map((s) => `${d.key}/${s.key}`),
    );
    expect(timelineSegments).toEqual(['immediate-effects/timeline']);

    // The brief's own surfaces carry no timeline of any kind.
    const brief = model.dimensions.find((d) => d.key === 'brief');
    expect(brief?.subViews).toHaveLength(0);
    expect(model.briefAnswers.map((c) => c.key)).not.toContain('timeline');
    expect(Object.keys(model)).not.toContain('briefTimeline');
  });
});

/* ------------------------------------------------------------------ *
 * E. Unknowns vs uncertainties
 * ------------------------------------------------------------------ */

describe('E. Uncited unknowns and cited uncertainties stay distinguishable', () => {
  it('keeps them in separate arrays with separate counts', () => {
    const model = buildAnalysisWorkspaceModel(response());
    expect(model.insufficientEvidence.citedUncertainties).toHaveLength(1);
    expect(model.insufficientEvidence.uncitedUnknowns).toEqual(['Unknown one', 'Unknown two']);
    expect(model.insufficientEvidence.citedCount).toBe(1);
    expect(model.insufficientEvidence.uncitedCount).toBe(2);
    expect(model.insufficientEvidence.totalCount).toBe(3);
  });

  it('never fabricates a citation for an uncited unknown', () => {
    const model = buildAnalysisWorkspaceModel(response());
    // Unknowns remain plain strings — there is nowhere for an invented
    // articleId to be attached.
    model.insufficientEvidence.uncitedUnknowns.forEach((unknown) => {
      expect(typeof unknown).toBe('string');
    });
    const serialized = JSON.stringify(model.insufficientEvidence.uncitedUnknowns);
    expect(serialized).not.toMatch(/sourceArticleIds/);
  });

  it('keeps the cited uncertainties carrying their own real citations', () => {
    const model = buildAnalysisWorkspaceModel(response());
    expect(model.insufficientEvidence.citedUncertainties[0]?.sourceArticleIds).toEqual(['a2']);
  });
});

/* ------------------------------------------------------------------ *
 * F. Citation numbering and source support inversion
 * ------------------------------------------------------------------ */

describe('F. Citation numbering is articleId-based, never render-index based', () => {
  it('numbers by position in the sources array and resolves by articleId', () => {
    const numbering = buildCitationNumbering(fullAnalysis().sources, ARTICLES);
    expect(citationNumberFor('a1', numbering)).toBe(1);
    expect(citationNumberFor('a3', numbering)).toBe(3);
    expect(citationNumberFor('missing', numbering)).toBeNull();
  });

  it('keeps a number attached to its article even when the rendered order differs', () => {
    const numbering = buildCitationNumbering(fullAnalysis().sources, ARTICLES);
    const reordered = [...ARTICLES].reverse();
    // Looking up by articleId, not by position, is what makes this hold.
    expect(reordered.map((a) => citationNumberFor(a.id, numbering))).toEqual([4, 3, 2, 1]);
  });

  it('falls back to the response articles when the AI failed and no sources array exists', () => {
    const numbering = buildCitationNumbering(undefined, ARTICLES);
    expect(citationNumberFor('a1', numbering)).toBe(1);
    expect(citationNumberFor('a4', numbering)).toBe(4);
  });
});

describe('F2. Source support inversion', () => {
  it('preserves backend response order exactly — no sorting, no grouping', () => {
    const support = buildSourceSupport(response());
    expect(support.map((s) => s.articleId)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('does not filter uncited sources out; they remain representable as NOT CITED', () => {
    // a4 is cited only by a difference position and by nothing else here;
    // build a response where one article is cited by nothing at all.
    const analysis = fullAnalysis({
      keyFacts: [claim('Fact', ['a1'], 1)],
      agreements: [],
      differences: [],
      timeline: [],
      uncertainties: [],
      context: [],
      relevance: [],
      affectedParties: [],
      immediateImpacts: [],
      spilloverImplications: [],
      significance: null,
      watchNext: [],
    });
    const support = buildSourceSupport(response({ analysis }));

    expect(support).toHaveLength(4);
    expect(support.map((s) => s.articleId)).toEqual(['a1', 'a2', 'a3', 'a4']);

    const a4 = support.find((s) => s.articleId === 'a4');
    expect(a4?.supportState).toBe('not-cited-in-this-analysis');
    expect(a4?.supports).toEqual([]);
    // Still present, still numbered — never dropped.
    expect(a4?.citationNumber).toBe(4);
  });

  it('inverts by articleId into the dimensions and sub-views that actually cite each article', () => {
    const support = buildSourceSupport(response());
    const origins = (id: string) =>
      support
        .find((s) => s.articleId === id)
        ?.supports.map((o) => (o.subView === null ? o.dimension : `${o.dimension}/${o.subView}`))
        .sort();

    // a3 is cited by the timeline event and by the affected party.
    expect(origins('a3')).toEqual([
      'immediate-effects/timeline',
      'key-facts/agreements',
      'who-is-affected/affected-entities',
    ]);

    // a4 is cited by the spillover claim and by the second position of
    // the difference topic — and by nothing else.
    expect(origins('a4')).toEqual(['immediate-effects/spillover', 'key-facts/differences']);
  });

  it('records each origin once even when several entries in the same group cite one article', () => {
    const analysis = fullAnalysis({
      keyFacts: [claim('One', ['a1'], 1), claim('Two', ['a1'], 1), claim('Three', ['a1'], 1)],
    });
    const support = buildSourceSupport(response({ analysis }));
    const a1 = support.find((s) => s.articleId === 'a1');
    const keyFactOrigins = a1?.supports.filter(
      (o) => o.dimension === 'key-facts' && o.subView === 'reported-facts',
    );
    expect(keyFactOrigins).toHaveLength(1);
  });

  it('keeps every source present and functional when the AI failed entirely', () => {
    const support = buildSourceSupport(response({ analysis: null }));
    expect(support).toHaveLength(4);
    expect(support.map((s) => s.articleId)).toEqual(['a1', 'a2', 'a3', 'a4']);
    support.forEach((entry) => {
      expect(entry.supportState).toBe('not-cited-in-this-analysis');
      expect(entry.article).toBeDefined();
      expect(entry.citationNumber).not.toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ *
 * G. Geography
 * ------------------------------------------------------------------ */

describe('G. Geography never exceeds the resolution production supplied', () => {
  it('reports country-level when only a country resolved', () => {
    const geo = resolveGeography({
      dataMode: 'live',
      providers: [],
      articlesRetrieved: 4,
      countryCode: 'CD',
      countryName: 'Democratic Republic of the Congo',
    });
    expect(geo.precision).toBe('country');
    expect(geo.city).toBeNull();
  });

  it('reports city-level only when a curated city actually resolved', () => {
    const geo = resolveGeography({
      dataMode: 'live',
      providers: [],
      articlesRetrieved: 4,
      countryCode: 'RW',
      countryName: 'Rwanda',
      city: 'kigali',
    });
    expect(geo.precision).toBe('city');
    expect(geo.city).toBe('kigali');
  });

  it('reports unresolved on the generic retrieval path, inventing nothing', () => {
    const geo = resolveGeography({ dataMode: 'live', providers: [], articlesRetrieved: 4 });
    expect(geo.precision).toBe('unresolved');
    expect(geo.countryName).toBeNull();
    expect(geo.countryCode).toBeNull();
    expect(geo.city).toBeNull();
  });

  it('reports unresolved when there is no retrieval context at all', () => {
    expect(resolveGeography(undefined).precision).toBe('unresolved');
  });

  it('carries the fuzzy-match disclosure through without treating it as spatial certainty', () => {
    const geo = resolveGeography({
      dataMode: 'live',
      providers: [],
      articlesRetrieved: 1,
      countryName: 'Rwanda',
      city: 'kigali',
      matchedFrom: 'kigalli',
      canonicalLocation: 'kigali',
      matchConfidence: 92,
    });
    expect(geo.matchedFrom).toBe('kigalli');
    expect(geo.canonicalLocation).toBe('kigali');
    expect(geo.matchConfidence).toBe(92);
    // Precision still comes from which field resolved, never from the score.
    expect(geo.precision).toBe('city');
  });

  it('never emits a subnational, province, district or coordinate field', () => {
    const model = buildAnalysisWorkspaceModel(response());
    const serialized = JSON.stringify(model.geography);
    expect(serialized).not.toMatch(
      /latitude|longitude|province|district|region|subnational|coordinate/i,
    );
  });
});

/* ------------------------------------------------------------------ *
 * H. Purity — no second fetch path
 * ------------------------------------------------------------------ */

describe('H. The adapter is pure', () => {
  it('returns an identical model for the same input on repeated calls', () => {
    const input = response();
    expect(JSON.stringify(buildAnalysisWorkspaceModel(input))).toEqual(
      JSON.stringify(buildAnalysisWorkspaceModel(input)),
    );
  });

  it('does not mutate the response it is given', () => {
    const input = response();
    const before = JSON.stringify(input);
    buildAnalysisWorkspaceModel(input);
    expect(JSON.stringify(input)).toEqual(before);
  });
});
