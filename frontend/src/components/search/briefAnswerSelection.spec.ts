import type {
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
} from '@globalnews-ai/shared';
import {
  BRIEF_ANSWER_CELL_KEYS,
  selectBriefAnswers,
  selectHighestCitedKeyFact,
} from './analysisDimensions';

/**
 * H2A — Executive Brief answer selection (E-10, amended by R1 colour errata).
 *
 * 08-DATA-BINDING-MAP item 17 classifies the six answer cells as B —
 * DERIVED PRESENTATION OF EXISTING DATA — and marks the selection rules
 * normative, with one sentence that governs this whole file:
 *
 *   "Composing new sentences is prohibited."
 *
 * So the adapter SELECTS existing strings and COUNTS existing records.
 * It never concatenates a sentence, never paraphrases, never summarises.
 * Everything it returns is either a verbatim production value, a count,
 * a stable enum, or an explicit unresolved marker.
 */

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

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

function claim(text: string, ids: string[], sourceCount?: number): SourcedClaim {
  return {
    claim: text,
    sourceArticleIds: ids,
    ...(sourceCount === undefined
      ? {}
      : { evidenceBreadth: { sourceCount, singleSource: sourceCount === 1 } }),
  };
}

const ARTICLES: NewsArticle[] = [article('a1'), article('a2'), article('a3')];

function analysisWith(overrides: Partial<NewsAnalysisResult> = {}): NewsAnalysisResult {
  const base: NewsAnalysisResult = {
    query: 'q',
    headline: 'Headline',
    summary: 'Summary.',
    keyFacts: [],
    agreements: [],
    differences: [],
    unknowns: [],
    timeline: [],
    confidence: { level: 'medium', score: 50, explanation: 'e' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
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
      distinctSourceArticleCount: 2,
      differenceTopicCount: 0,
      uncertaintyCount: 0,
    },
    context: [],
    relevance: [],
    affectedParties: [],
    immediateImpacts: [],
    spilloverImplications: [],
    significance: null,
    watchNext: [],
  };
  return { ...base, ...overrides };
}

function responseWith(
  analysis: NewsAnalysisResult | null,
  retrieval: Partial<AnalysisApiResponse['retrievalContext']> = {},
): AnalysisApiResponse {
  return {
    query: 'q',
    normalizedQuery: 'q',
    requestedLanguage: 'en',
    responseLanguage: 'en',
    analysis,
    articles: ARTICLES,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews'],
      articlesRetrieved: 3,
      ...retrieval,
    },
    sourceEntities: { organizations: [] },
    sourceDiversity: {
      retrievedArticleCount: 3,
      reportingClusterCount: 3,
      duplicateLikeClusterCount: 0,
      largestClusterSize: 1,
      knownDomainCount: 3,
      unknownDomainArticleCount: 0,
      distinctSourceNameCount: 3,
    },
    provenance: {
      provider: 'openai',
      executionMode: 'production',
      analysisMode: 'live-ai',
      status: 'success',
      cached: false,
    },
  };
}

const cell = (cells: ReturnType<typeof selectBriefAnswers>, key: string) =>
  cells.find((c) => c.key === key);

/* ------------------------------------------------------------------ *
 * A. Shape and identity cues
 * ------------------------------------------------------------------ */

describe('A. Six cells, fixed order, four non-colour identity cues', () => {
  it('produces exactly six cells in the fixed reading order', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => c.key)).toEqual([...BRIEF_ANSWER_CELL_KEYS]);
    expect(cells.map((c) => c.key)).toEqual([
      'what-happened',
      'where',
      'why-it-matters',
      'who-is-affected',
      'how-strong-is-the-evidence',
      'what-is-uncertain',
    ]);
  });

  it('assigns the mono ordinals 01..06 in reading order (R1 identity cue 1)', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    expect(cells.map((c) => c.ordinal)).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it('applies R1 OPTION A: each cell inherits the accent of the surface it opens', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    const accents = Object.fromEntries(cells.map((c) => [c.key, c.accent]));
    expect(accents).toEqual({
      'what-happened': 'gn-verified',
      where: 'gn-geo',
      'why-it-matters': 'gn-ai',
      'who-is-affected': 'gn-geo',
      'how-strong-is-the-evidence': 'gn-verified',
      'what-is-uncertain': 'gn-uncertain',
    });
  });

  it('routes the two non-dimension cells to their real destinations, correcting the prototype', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    // The prototype linked WHERE to the who dimension and EVIDENCE to key
    // facts. The specification (errata section 3) wins.
    expect(cell(cells, 'where')?.destination).toEqual({
      kind: 'rail-module',
      key: 'geographic-intelligence',
    });
    expect(cell(cells, 'how-strong-is-the-evidence')?.destination).toEqual({
      kind: 'popover',
      key: 'evidence-support',
    });
    expect(cell(cells, 'what-happened')?.destination).toEqual({
      kind: 'dimension',
      key: 'key-facts',
    });
    expect(cell(cells, 'what-is-uncertain')?.destination).toEqual({
      kind: 'dimension',
      key: 'insufficient-evidence',
    });
  });

  it('carries significance as a labelled badge on cell 03 only — never as that cell hue', () => {
    const cells = selectBriefAnswers(
      responseWith(analysisWith({ significance: { level: 'major', rationale: [] } })),
    );
    const why = cell(cells, 'why-it-matters');
    expect(why?.significanceBadge).toBe('major');
    // The one permitted foreign token does not become the cell accent.
    expect(why?.accent).toBe('gn-ai');
    expect(why?.accent).not.toBe('gn-significance');

    cells
      .filter((c) => c.key !== 'why-it-matters')
      .forEach((c) => expect(c.significanceBadge).toBeNull());
  });

  it('omits the badge when significance is null, without disturbing the cell', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith({ significance: null })));
    expect(cell(cells, 'why-it-matters')?.significanceBadge).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * B. WHAT HAPPENED — deterministic selection and stable tie-break
 * ------------------------------------------------------------------ */

describe('B. WHAT HAPPENED selects the highest-cited key fact', () => {
  it('selects the fact with the highest existing evidenceBreadth.sourceCount', () => {
    const facts = [
      claim('One', ['a1'], 1),
      claim('Three', ['a1', 'a2', 'a3'], 3),
      claim('Two', ['a1'], 2),
    ];
    expect(selectHighestCitedKeyFact(facts)?.claim).toBe('Three');
  });

  it('breaks a tie by original array order, and does so stably', () => {
    const facts = [
      claim('First', ['a1'], 2),
      claim('Second', ['a2'], 2),
      claim('Third', ['a3'], 2),
    ];
    expect(selectHighestCitedKeyFact(facts)?.claim).toBe('First');
    // Repeated calls never drift.
    expect(selectHighestCitedKeyFact(facts)?.claim).toBe('First');
    expect(selectHighestCitedKeyFact(facts)?.claim).toBe('First');
  });

  it('treats a fact with no evidenceBreadth as 0 rather than discarding it', () => {
    const facts = [claim('No breadth', ['a1']), claim('Has breadth', ['a2'], 1)];
    expect(selectHighestCitedKeyFact(facts)?.claim).toBe('Has breadth');

    const onlyBare = [claim('Bare one', ['a1']), claim('Bare two', ['a2'])];
    expect(selectHighestCitedKeyFact(onlyBare)?.claim).toBe('Bare one');
  });

  it('returns null on an empty key-fact array', () => {
    expect(selectHighestCitedKeyFact([])).toBeNull();
  });

  it('reads the backend breadth field and never recounts sourceArticleIds.length', () => {
    // sourceArticleIds.length disagrees with evidenceBreadth.sourceCount
    // here on purpose. The backend field is authoritative: it counts
    // DISTINCT canonical grounded article IDs, which is a different
    // quantity from the raw array length.
    const facts = [
      claim('Long array, low breadth', ['a1', 'a2', 'a3'], 1),
      claim('Short array, high breadth', ['a1'], 3),
    ];
    expect(selectHighestCitedKeyFact(facts)?.claim).toBe('Short array, high breadth');
  });

  it('surfaces the selected fact verbatim in the cell, with its citations intact', () => {
    const fact = claim('The reported fact.', ['a1', 'a2'], 2);
    const cells = selectBriefAnswers(responseWith(analysisWith({ keyFacts: [fact] })));
    const value = cell(cells, 'what-happened')?.value;
    expect(value).toEqual({ kind: 'claim', claim: fact });
    if (value?.kind === 'claim') {
      expect(value.claim.claim).toBe('The reported fact.');
      expect(value.claim.sourceArticleIds).toEqual(['a1', 'a2']);
    }
  });
});

/* ------------------------------------------------------------------ *
 * C. WHERE — unresolved geography never gains precision
 * ------------------------------------------------------------------ */

describe('C. WHERE uses only genuine resolved geography', () => {
  it('reports country-level when a country resolved', () => {
    const cells = selectBriefAnswers(
      responseWith(analysisWith(), { countryCode: 'CD', countryName: 'DR Congo' }),
    );
    const value = cell(cells, 'where')?.value;
    expect(value?.kind).toBe('geography');
    if (value?.kind === 'geography') {
      expect(value.geography.precision).toBe('country');
      expect(value.geography.countryName).toBe('DR Congo');
    }
  });

  it('reports city-level only when a curated city resolved', () => {
    const cells = selectBriefAnswers(
      responseWith(analysisWith(), { countryName: 'Rwanda', city: 'kigali' }),
    );
    const value = cell(cells, 'where')?.value;
    if (value?.kind === 'geography') expect(value.geography.precision).toBe('city');
  });

  it('stays unresolved on the generic retrieval path and gains no precision', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    const where = cell(cells, 'where');
    expect(where?.value).toEqual({ kind: 'unresolved' });
    expect(where?.interactive).toBe(false);
  });

  it('never invents a country, city, region or coordinate for an unresolved analysis', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    const serialized = JSON.stringify(cell(cells, 'where'));
    expect(serialized).not.toMatch(
      /province|district|region|subnational|latitude|longitude|coordinate/i,
    );
    expect(serialized).not.toMatch(/countryName":"[^"]+"/);
  });
});

/* ------------------------------------------------------------------ *
 * D. The remaining cells select existing values only
 * ------------------------------------------------------------------ */

describe('D. WHY IT MATTERS, WHO IS AFFECTED, EVIDENCE, UNCERTAIN', () => {
  it('WHY IT MATTERS selects the first relevance item and the existing significance level', () => {
    const relevance = claim('Because of this.', ['a1'], 1);
    const cells = selectBriefAnswers(
      responseWith(
        analysisWith({
          relevance: [relevance, claim('Second reason', ['a2'], 1)],
          significance: { level: 'moderate', rationale: [] },
        }),
      ),
    );
    const value = cell(cells, 'why-it-matters')?.value;
    expect(value).toEqual({
      kind: 'relevance-with-significance',
      claim: relevance,
      significanceLevel: 'moderate',
    });
  });

  it('WHY IT MATTERS is unresolved only when both relevance and significance are absent', () => {
    const none = selectBriefAnswers(responseWith(analysisWith()));
    expect(cell(none, 'why-it-matters')?.value).toEqual({ kind: 'unresolved' });

    const significanceOnly = selectBriefAnswers(
      responseWith(analysisWith({ significance: { level: 'minor', rationale: [] } })),
    );
    expect(cell(significanceOnly, 'why-it-matters')?.value.kind).toBe(
      'relevance-with-significance',
    );
  });

  it('WHO IS AFFECTED exposes the existing party values without joining them into prose', () => {
    const cells = selectBriefAnswers(
      responseWith(
        analysisWith({
          affectedParties: [
            {
              party: 'Country X',
              partyType: 'country',
              effect: 'Effect X',
              sourceArticleIds: ['a1'],
            },
            {
              party: 'Org Y',
              partyType: 'organization',
              effect: 'Effect Y',
              sourceArticleIds: ['a2'],
            },
          ],
        }),
      ),
    );
    const value = cell(cells, 'who-is-affected')?.value;
    expect(value?.kind).toBe('affected-parties');
    if (value?.kind === 'affected-parties') {
      expect(value.parties).toHaveLength(2);
      expect(value.parties.map((p) => p.party)).toEqual(['Country X', 'Org Y']);
      expect(value.parties.map((p) => p.partyType)).toEqual(['country', 'organization']);
    }
  });

  it('HOW STRONG uses the existing trust level and the existing retrieval/diversity counts', () => {
    const cells = selectBriefAnswers(
      responseWith(
        analysisWith({
          trustState: {
            level: 'high',
            reasons: [],
            distinctSourceArticleCount: 3,
            differenceTopicCount: 0,
            uncertaintyCount: 0,
          },
        }),
      ),
    );
    const value = cell(cells, 'how-strong-is-the-evidence')?.value;
    expect(value?.kind).toBe('evidence-strength');
    if (value?.kind === 'evidence-strength') {
      expect(value.meter.label).toBe('STRONG');
      expect(value.meter.filledSegments).toBe(3);
      expect(value.articlesRetrieved).toBe(3);
      expect(value.reportingClusterCount).toBe(3);
      expect(value.distinctSourceNameCount).toBe(3);
    }
  });

  it('HOW STRONG tolerates an absent sourceDiversity without printing a zero it does not have', () => {
    const base = responseWith(analysisWith());
    const withoutDiversity: AnalysisApiResponse = { ...base, sourceDiversity: undefined };
    const value = cell(selectBriefAnswers(withoutDiversity), 'how-strong-is-the-evidence')?.value;
    if (value?.kind === 'evidence-strength') {
      expect(value.reportingClusterCount).toBeNull();
      expect(value.distinctSourceNameCount).toBeNull();
    }
  });

  it('WHAT IS UNCERTAIN counts the existing uncertainties and selects the first one verbatim', () => {
    const first = { description: 'First open question', sourceArticleIds: ['a1'] };
    const cells = selectBriefAnswers(
      responseWith(
        analysisWith({
          uncertainties: [first, { description: 'Second', sourceArticleIds: ['a2'] }],
        }),
      ),
    );
    const value = cell(cells, 'what-is-uncertain')?.value;
    expect(value).toEqual({ kind: 'uncertainty', count: 2, first });
  });

  it('WHAT IS UNCERTAIN reports a genuine zero rather than disappearing', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith({ uncertainties: [] })));
    expect(cell(cells, 'what-is-uncertain')?.value).toEqual({
      kind: 'uncertainty',
      count: 0,
      first: null,
    });
  });
});

/* ------------------------------------------------------------------ *
 * E. No synthetic sentence generation
 * ------------------------------------------------------------------ */

describe('E. Selection only — no prose is composed', () => {
  it('every string in the cell payload traces to a production value, an enum or a count', () => {
    const relevance = claim('Because of this.', ['a1'], 1);
    const fact = claim('The reported fact.', ['a1', 'a2'], 2);
    const uncertainty = { description: 'Open question', sourceArticleIds: ['a3'] };

    const cells = selectBriefAnswers(
      responseWith(
        analysisWith({
          keyFacts: [fact],
          relevance: [relevance],
          uncertainties: [uncertainty],
          affectedParties: [
            {
              party: 'Country X',
              partyType: 'country',
              effect: 'Effect X',
              sourceArticleIds: ['a1'],
            },
          ],
          significance: { level: 'major', rationale: [] },
        }),
        { countryName: 'DR Congo', countryCode: 'CD' },
      ),
    );

    // Every free-text string appearing anywhere in the payload must be one
    // the production response supplied. Anything else would be composition.
    const productionStrings = new Set([
      'The reported fact.',
      'Because of this.',
      'Open question',
      'Country X',
      'Effect X',
      'DR Congo',
    ]);

    const freeText: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') {
        // Ignore machine keys: ids, enums, ordinals and stable tokens.
        if (/^[a-z0-9]+([-_][a-z0-9]+)*$/.test(node)) return;
        if (/^[A-Z0-9_]+$/.test(node)) return;
        if (/^\d+$/.test(node)) return;
        freeText.push(node);
        return;
      }
      if (Array.isArray(node)) return node.forEach(walk);
      if (node !== null && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(cells);

    freeText.forEach((text) => expect(productionStrings.has(text)).toBe(true));
  });

  it('emits no connective or template wording of its own', () => {
    const cells = selectBriefAnswers(
      responseWith(
        analysisWith({
          keyFacts: [claim('The reported fact.', ['a1'], 1)],
          affectedParties: [
            { party: 'A', partyType: 'country', effect: 'E1', sourceArticleIds: ['a1'] },
            { party: 'B', partyType: 'organization', effect: 'E2', sourceArticleIds: ['a2'] },
          ],
        }),
      ),
    );
    const serialized = JSON.stringify(cells);
    // Sentence glue that would only appear if the adapter had composed text.
    [' and ', ' with ', ' according to ', ' which ', ' because ', ' as well as '].forEach((glue) =>
      expect(serialized).not.toContain(glue),
    );
  });

  it('never merges the affected parties into a single joined string', () => {
    const cells = selectBriefAnswers(
      responseWith(
        analysisWith({
          affectedParties: [
            { party: 'A', partyType: 'country', effect: 'E1', sourceArticleIds: ['a1'] },
            { party: 'B', partyType: 'organization', effect: 'E2', sourceArticleIds: ['a2'] },
          ],
        }),
      ),
    );
    const value = cell(cells, 'who-is-affected')?.value;
    if (value?.kind === 'affected-parties') {
      expect(Array.isArray(value.parties)).toBe(true);
      expect(JSON.stringify(value)).not.toContain('A, B');
    }
  });
});

/* ------------------------------------------------------------------ *
 * F. Empty and partial responses stay safe
 * ------------------------------------------------------------------ */

describe('F. Empty and partial data', () => {
  it('still produces all six cells when every analysis array is empty', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => c.key)).toEqual([...BRIEF_ANSWER_CELL_KEYS]);
  });

  it('marks unresolved cells non-interactive rather than removing them from the grid', () => {
    const cells = selectBriefAnswers(responseWith(analysisWith()));
    const unresolved = cells.filter((c) => c.value.kind === 'unresolved');
    expect(unresolved.length).toBeGreaterThan(0);
    unresolved.forEach((c) => expect(c.interactive).toBe(false));
    // The grid keeps its shape regardless.
    expect(cells).toHaveLength(6);
  });

  it('still produces all six cells when the AI failed entirely', () => {
    const cells = selectBriefAnswers(responseWith(null));
    expect(cells).toHaveLength(6);
    expect(cell(cells, 'what-happened')?.value).toEqual({ kind: 'unresolved' });
    expect(cell(cells, 'what-is-uncertain')?.value).toEqual({
      kind: 'uncertainty',
      count: 0,
      first: null,
    });
    const evidence = cell(cells, 'how-strong-is-the-evidence')?.value;
    if (evidence?.kind === 'evidence-strength') {
      // No analysis means no rating happened — UNRATED, never INSUFFICIENT.
      expect(evidence.meter.label).toBe('UNRATED');
      expect(evidence.meter.rated).toBe(false);
    }
  });

  it('is deterministic and does not mutate the response', () => {
    const input = responseWith(analysisWith({ keyFacts: [claim('F', ['a1'], 1)] }));
    const before = JSON.stringify(input);
    expect(JSON.stringify(selectBriefAnswers(input))).toEqual(
      JSON.stringify(selectBriefAnswers(input)),
    );
    expect(JSON.stringify(input)).toEqual(before);
  });
});
