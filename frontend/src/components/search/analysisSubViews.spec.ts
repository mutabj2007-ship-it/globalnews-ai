import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
} from '@globalnews-ai/shared';
import {
  buildContextEntries,
  buildDifferenceGroups,
  buildRelationshipsSurface,
  buildSubViewClaims,
  buildTimelineEntries,
  buildWatchNextEntries,
  resolveGeographicLink,
  RELATIONAL_BUCKET_KEYS,
} from './analysisClaims';
import { buildAnalysisWorkspaceModel } from './analysisDimensions';
import { resolveSubViewArrowTarget } from './AnalysisSubViewStrip';

/**
 * H2D — the level-2 selection layer.
 *
 * The load-bearing test here is section A. analysisDimensions.ts counts
 * a segment; analysisClaims.ts resolves its entries. If those two could
 * disagree, the strip would say "3" over a panel showing four, and the
 * navigator would be lying about the analysis. Asserting the agreement
 * per segment, across several payload shapes, is what makes it
 * structural rather than hopeful.
 */

function article(id: string): NewsArticle {
  return {
    id,
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    url: `https://example.test/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Source ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-22T06:00:00.000Z',
  };
}

const ARTICLES: NewsArticle[] = [article('a1'), article('a2'), article('a3')];

function claim(text: string, ids: string[], n?: number): SourcedClaim {
  return {
    claim: text,
    sourceArticleIds: ids,
    ...(n === undefined ? {} : { evidenceBreadth: { sourceCount: n, singleSource: n === 1 } }),
  };
}

function analysisWith(overrides: Partial<NewsAnalysisResult> = {}): NewsAnalysisResult {
  const base: NewsAnalysisResult = {
    query: 'q',
    headline: 'H',
    summary: 'A verbatim summary.',
    keyFacts: [claim('Fact one', ['a1'], 1), claim('Fact two', ['a2'], 1)],
    agreements: [{ point: 'All outlets agree the port closed.', sourceArticleIds: ['a1', 'a2'] }],
    differences: [
      {
        topic: 'Duration',
        positions: [
          { description: 'Four days', sourceArticleIds: ['a1'] },
          { description: 'Six days', sourceArticleIds: ['a2'] },
        ],
      },
    ],
    unknowns: ['Nobody has confirmed the cause.'],
    timeline: [
      { timestamp: '2026-08-20T09:00:00.000Z', event: 'Port closed', sourceArticleIds: ['a1'] },
      { timestamp: '2026-08-21T09:00:00.000Z', event: 'Exports halted', sourceArticleIds: ['a3'] },
    ],
    confidence: { level: 'high', score: 91, explanation: 'self' },
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
      differenceTopicCount: 1,
      uncertaintyCount: 0,
    },
    context: [claim('The port handles most regional trade.', ['a3'], 1)],
    relevance: [claim('It matters.', ['a1'], 1)],
    affectedParties: [
      { party: 'Kenya', partyType: 'country', effect: 'Exports delayed', sourceArticleIds: ['a2'] },
    ],
    immediateImpacts: [claim('Shipments held.', ['a3'], 1)],
    spilloverImplications: [claim('Prices may follow.', ['a2'], 1)],
    significance: null,
    watchNext: [
      {
        claim: 'Ministry statement expected',
        hingeType: 'pending_response',
        sourceArticleIds: ['a1'],
      },
    ],
  };
  return { ...base, ...overrides };
}

function responseWith(
  analysis: NewsAnalysisResult | null,
  extra: Partial<AnalysisApiResponse> = {},
): AnalysisApiResponse {
  return {
    query: 'What is happening?',
    normalizedQuery: 'x',
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
 * A. The segment count lock
 * ------------------------------------------------------------------ */

describe('A. A segment count always matches the entries behind it', () => {
  const payloads: ReadonlyArray<readonly [string, AnalysisApiResponse]> = [
    ['a populated analysis', responseWith(analysisWith())],
    [
      'an analysis with every refinement empty',
      responseWith(
        analysisWith({ agreements: [], differences: [], spilloverImplications: [], timeline: [] }),
      ),
    ],
    ['a failed analysis', responseWith(null)],
  ];

  payloads.forEach(([name, response]) => {
    const model = buildAnalysisWorkspaceModel(response);
    model.dimensions.forEach((dimension) => {
      dimension.subViews.forEach((view) => {
        it(`${dimension.key}/${view.key} matches its adapter count for ${name}`, () => {
          if (view.key === 'differences') {
            expect(buildDifferenceGroups(response)).toHaveLength(view.count);
            return;
          }
          if (view.key === 'timeline') {
            expect(buildTimelineEntries(response)).toHaveLength(view.count);
            return;
          }
          if (view.key === 'relationships') {
            const surface = buildRelationshipsSurface(response);
            expect(surface?.totalReferences ?? 0).toBe(view.count);
            return;
          }
          expect(buildSubViewClaims(response, view.key)).toHaveLength(view.count);
        });
      });
    });
  });

  it('never allocates a segment whose field is empty', () => {
    const response = responseWith(analysisWith({ agreements: [], differences: [] }));
    const keyFacts = buildAnalysisWorkspaceModel(response).dimensions.find(
      (d) => d.key === 'key-facts',
    );
    expect(keyFacts?.subViews.map((v) => v.key)).toEqual(['reported-facts']);
    /* Only the primary segment survives, so there is nothing to switch. */
    expect(keyFacts?.stripVisible).toBe(false);
  });

  it('shows the strip only when a refinement genuinely exists', () => {
    const model = buildAnalysisWorkspaceModel(responseWith(analysisWith()));
    const keyFacts = model.dimensions.find((d) => d.key === 'key-facts');
    expect(keyFacts?.subViews.map((v) => v.key)).toEqual([
      'reported-facts',
      'agreements',
      'differences',
    ]);
    expect(keyFacts?.stripVisible).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * B. Verbatim content, and shapes that must not be flattened
 * ------------------------------------------------------------------ */

describe('B. Segment content', () => {
  const response = responseWith(analysisWith());

  it('carries agreement text verbatim from its own field', () => {
    expect(buildSubViewClaims(response, 'agreements').map((e) => e.text)).toEqual([
      'All outlets agree the port closed.',
    ]);
  });

  it('keeps a disagreement as a topic with competing positions, never one flat list', () => {
    const [group] = buildDifferenceGroups(response);
    expect(group?.topic).toBe('Duration');
    expect(group?.positions.map((p) => p.text)).toEqual(['Four days', 'Six days']);
    /* Flattening would silently assert the positions agree. */
    expect(buildSubViewClaims(response, 'differences')).toHaveLength(0);
  });

  it('each position keeps its own citations', () => {
    const [group] = buildDifferenceGroups(response);
    expect(group?.positions[0]?.citations[0]?.citationNumber).toBe(1);
    expect(group?.positions[1]?.citations[0]?.citationNumber).toBe(2);
  });

  it('separates spillover from reported effects', () => {
    expect(buildSubViewClaims(response, 'reported-effects').map((e) => e.text)).toEqual([
      'Shipments held.',
    ]);
    expect(buildSubViewClaims(response, 'spillover').map((e) => e.text)).toEqual([
      'Prices may follow.',
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * C. Timeline
 * ------------------------------------------------------------------ */

describe('C. Timeline is a chronology, not a measurement', () => {
  const response = responseWith(analysisWith());

  it('preserves response order and does not sort', () => {
    expect(buildTimelineEntries(response).map((e) => e.event)).toEqual([
      'Port closed',
      'Exports halted',
    ]);
  });

  it('carries each timestamp verbatim', () => {
    expect(buildTimelineEntries(response)[0]?.timestamp).toBe('2026-08-20T09:00:00.000Z');
  });

  it('links each event to its own source by articleId', () => {
    const entries = buildTimelineEntries(response);
    expect(entries[0]?.citations[0]?.citationNumber).toBe(1);
    expect(entries[1]?.citations[0]?.citationNumber).toBe(3);
  });

  it('flags an unparseable timestamp instead of inventing one', () => {
    const broken = responseWith(
      analysisWith({
        timeline: [{ timestamp: 'not-a-date', event: 'Something', sourceArticleIds: ['a1'] }],
      }),
    );
    const [entry] = buildTimelineEntries(broken);
    expect(entry?.timeValid).toBe(false);
    expect(entry?.timestamp).toBe('not-a-date');
    /* The event and its citation survive; only the time line is dropped. */
    expect(entry?.event).toBe('Something');
    expect(entry?.citations).toHaveLength(1);
  });

  it('computes no duration or interval anywhere', () => {
    expect(CODE).not.toContain('getTime() -');
    expect(CODE).not.toContain('duration');
    expect(CODE).not.toContain('.sort(');
  });
});

/* ------------------------------------------------------------------ *
 * D. Relationships are gated and never invented
 * ------------------------------------------------------------------ */

describe('D. Relational surface', () => {
  it('is null when the payload carries no relational composition', () => {
    expect(buildRelationshipsSurface(responseWith(analysisWith()))).toBeNull();
    expect(buildRelationshipsSurface(responseWith(null))).toBeNull();
  });

  it('is absent from the allocation when unsupported, so no empty panel can be reached', () => {
    const model = buildAnalysisWorkspaceModel(responseWith(analysisWith()));
    const affected = model.dimensions.find((d) => d.key === 'who-is-affected');
    expect(affected?.subViews.map((v) => v.key)).not.toContain('relationships');
  });

  it('renders the backend summary verbatim and resolves its references', () => {
    const response = responseWith(
      analysisWith({
        relationalComposition: {
          directionalEligibility: 'supported',
          evidenceSufficiency: 'adequate',
          summary: 'The closure is evidence relevant to the export halt.',
          supportingClaims: [{ section: 'keyFacts', index: 0 }],
          reverseClaims: [],
          associationOnlyClaims: [],
          mixedClaims: [],
          unclearOrNonSubstantiveClaims: [],
        },
      }),
    );
    const surface = buildRelationshipsSurface(response);
    expect(surface?.summary).toBe('The closure is evidence relevant to the export halt.');
    expect(surface?.totalReferences).toBe(1);
    const supporting = surface?.buckets.find((b) => b.key === 'supporting');
    expect(supporting?.entries.map((e) => e.text)).toEqual(['Fact one']);
    expect(supporting?.entries[0]?.citations[0]?.citationNumber).toBe(1);
  });

  it('keeps the backend count when a reference resolves to nothing', () => {
    const response = responseWith(
      analysisWith({
        relationalComposition: {
          directionalEligibility: 'unsupported',
          evidenceSufficiency: 'limited',
          summary: 'S',
          supportingClaims: [{ section: 'keyFacts', index: 99 }],
          reverseClaims: [],
          associationOnlyClaims: [],
          mixedClaims: [],
          unclearOrNonSubstantiveClaims: [],
        },
      }),
    );
    const bucket = buildRelationshipsSurface(response)?.buckets.find((b) => b.key === 'supporting');
    /* The count is the backend's; the row could not be resolved. Visible,
       not quietly reconciled. */
    expect(bucket?.count).toBe(1);
    expect(bucket?.entries).toHaveLength(0);
  });

  it('exposes all five buckets and synthesises no subject/relation/object triple', () => {
    expect(RELATIONAL_BUCKET_KEYS).toHaveLength(5);
    expect(CODE).not.toContain('subject');
    expect(CODE).not.toContain('predicate');
  });
});

/* ------------------------------------------------------------------ *
 * E. Context, watch next and geography selection
 * ------------------------------------------------------------------ */

describe('E. Context, watch next, geography', () => {
  const response = responseWith(analysisWith());

  it('carries context verbatim, with its citations', () => {
    const [entry] = buildContextEntries(response);
    expect(entry?.text).toBe('The port handles most regional trade.');
    expect(entry?.citations[0]?.citationNumber).toBe(3);
  });

  it('returns no context entries when the field is empty', () => {
    expect(buildContextEntries(responseWith(analysisWith({ context: [] })))).toHaveLength(0);
  });

  it('carries watch-next items verbatim with their hinge type', () => {
    const [entry] = buildWatchNextEntries(response);
    expect(entry?.claim).toBe('Ministry statement expected');
    expect(entry?.hingeType).toBe('pending_response');
  });

  it('persists nothing — no storage primitive exists in this module', () => {
    expect(CODE).not.toContain('localStorage');
    expect(CODE).not.toContain('sessionStorage');
    expect(CODE).not.toContain('indexedDB');
  });

  it('resolves a country identifier to the world map iso3, or to null', () => {
    expect(resolveGeographicLink('KE')?.iso3).toBe('KEN');
    expect(resolveGeographicLink('KEN')?.iso3).toBe('KEN');
    expect(resolveGeographicLink(null)).toBeNull();
    expect(resolveGeographicLink('')).toBeNull();
    expect(resolveGeographicLink('not-a-country')).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * F. The keyboard model, and purity
 * ------------------------------------------------------------------ */

describe('F. Strip keyboard model and module purity', () => {
  it('moves and wraps in both directions', () => {
    expect(resolveSubViewArrowTarget(0, 'ArrowRight', 3)).toBe(1);
    expect(resolveSubViewArrowTarget(2, 'ArrowRight', 3)).toBe(0);
    expect(resolveSubViewArrowTarget(0, 'ArrowLeft', 3)).toBe(2);
    expect(resolveSubViewArrowTarget(1, 'Home', 3)).toBe(0);
    expect(resolveSubViewArrowTarget(1, 'End', 3)).toBe(2);
  });

  it('never re-declares the allocation the adapter owns', () => {
    expect(CODE).not.toContain('SUB_VIEW_ALLOCATION');
    expect(CODE).not.toContain('isPrimarySegment');
  });

  it('still reads no self-assessment or resolution confidence', () => {
    expect(CODE).not.toContain('confidence');
    expect(CODE).not.toContain('matchConfidence');
  });

  it('still fetches nothing', () => {
    expect(CODE).not.toContain('fetch(');
    expect(CODE).not.toContain('analysisApi');
  });

  it('does not mutate the response', () => {
    const response = responseWith(analysisWith());
    const before = JSON.stringify(response);
    buildContextEntries(response);
    buildWatchNextEntries(response);
    buildTimelineEntries(response);
    buildDifferenceGroups(response);
    buildRelationshipsSurface(response);
    buildSubViewClaims(response, 'agreements');
    expect(JSON.stringify(response)).toBe(before);
  });
});
