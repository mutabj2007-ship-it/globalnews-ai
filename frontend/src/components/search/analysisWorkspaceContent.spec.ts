import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AffectedParty,
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
} from '@globalnews-ai/shared';
import { AnalysisWorkspace } from './AnalysisWorkspace';
import { SourcesDrawer } from './SourcesDrawer';
import { ClaimCard } from './ClaimCard';
import { buildDimensionClaims } from './analysisClaims';
import { buildAnalysisWorkspaceModel } from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H2C — rendered content, evidence and provenance.
 *
 * Real markup assertions through react-dom/server in the existing node
 * harness, the same technique H2B established. What is checked here is
 * not that the components render *something*, but that the chain
 * claim -> citation -> source -> provenance survives rendering, and that
 * nothing on screen is a number the contract did not supply.
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

const ARTICLES: NewsArticle[] = [article('a1'), article('a2')];

function analysisWith(overrides: Partial<NewsAnalysisResult> = {}): NewsAnalysisResult {
  const base: NewsAnalysisResult = {
    query: 'q',
    headline: 'Headline',
    summary: 'The ministry suspended exports for four days.',
    keyFacts: [
      {
        ...claim('Exports were suspended.', ['a1'], 1),
        evidenceBasis: { articleId: 'a1', excerpt: 'The ministry confirmed a four-day hold.' },
      },
      claim('Prices rose the following week.', ['a2'], 1),
    ],
    agreements: [],
    differences: [],
    unknowns: ['Nobody has confirmed the cause.'],
    timeline: [],
    /* 91 is the model self-assessment score. It must never be rendered. */
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
      distinctSourceArticleCount: 2,
      differenceTopicCount: 0,
      uncertaintyCount: 0,
    },
    context: [],
    relevance: [claim('It matters because.', ['a1'], 1)],
    affectedParties: [party('Kenya', 'Exports delayed', ['a2'])],
    immediateImpacts: [],
    spilloverImplications: [],
    significance: null,
    watchNext: [],
  };
  return { ...base, ...overrides };
}

function responseWith(
  analysis: NewsAnalysisResult | null,
  extra: Partial<AnalysisApiResponse> = {},
): AnalysisApiResponse {
  return {
    query: 'What is happening with the export ban?',
    normalizedQuery: 'what is happening with the export ban',
    requestedLanguage: 'en',
    responseLanguage: 'en',
    analysis,
    articles: ARTICLES,
    retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 2 },
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

function render(response: AnalysisApiResponse, language: 'en' | 'pl' = 'en'): string {
  return renderToStaticMarkup(createElement(AnalysisWorkspace, { response, language }));
}

const source = (file: string): string => readFileSync(join(__dirname, file), 'utf-8');
const codeOnly = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const NEW_COMPONENTS = [
  'AnalysisTelemetry.tsx',
  'ExecutiveBrief.tsx',
  'ClaimCard.tsx',
  'SourcesDrawer.tsx',
];
const NEW_CODE = NEW_COMPONENTS.map((file) => codeOnly(source(file)));

const EN = getDictionary('en').analysisWorkspace;

/* ------------------------------------------------------------------ *
 * A. No fabricated quantity reaches the screen
 * ------------------------------------------------------------------ */

describe('A. Nothing numeric is invented', () => {
  const html = render(responseWith(analysisWith()));

  it('renders no percentage anywhere', () => {
    expect(html).not.toMatch(/\d+\s*%/);
  });

  it('never renders the model self-assessment score', () => {
    // The contract calls analysis.confidence model self-reported
    // metadata that is explicitly not the authoritative trust signal.
    expect(html).not.toContain('91');
  });

  it('no component reads the confidence field at all', () => {
    NEW_CODE.forEach((code) => {
      expect(code).not.toContain('.confidence');
      expect(code).not.toContain('matchConfidence');
    });
  });

  it('renders the real retrieved-article count, not an estimate', () => {
    expect(html).toContain('2 articles');
  });

  it('omits the cluster figure entirely when sourceDiversity is absent', () => {
    expect(html).not.toContain('reporting cluster');
  });

  it('names what it counts when a cluster count does exist', () => {
    const withDiversity = render(
      responseWith(analysisWith(), {
        sourceDiversity: {
          retrievedArticleCount: 2,
          reportingClusterCount: 2,
          duplicateLikeClusterCount: 0,
          largestClusterSize: 1,
          knownDomainCount: 2,
          unknownDomainArticleCount: 0,
          distinctSourceNameCount: 2,
        },
      }),
    );
    // Articles are articles and clusters are clusters; neither is ever
    // presented as a number of events.
    expect(withDiversity).toContain('2 articles');
    expect(withDiversity).toContain('2 reporting clusters');
  });
});

/* ------------------------------------------------------------------ *
 * B. E-04 evidence meter
 * ------------------------------------------------------------------ */

describe('B. Evidence meter', () => {
  it('renders three segments with the level word and a stated ratio', () => {
    const html = render(responseWith(analysisWith()));
    expect(html).toContain('aria-label="Evidence support: Moderate, 2 of 3"');
    expect(html).toContain('role="img"');
  });

  it('distinguishes an INSUFFICIENT verdict from an absent rating', () => {
    const insufficient = render(
      responseWith(
        analysisWith({
          trustState: {
            level: 'insufficient',
            reasons: [],
            distinctSourceArticleCount: 0,
            differenceTopicCount: 0,
            uncertaintyCount: 0,
          },
        }),
      ),
    );
    const unrated = render(responseWith(null));

    expect(insufficient).toContain('Evidence support: Insufficient, 0 of 3');
    expect(unrated).toContain('Evidence support: Unrated, 0 of 3');
    // Both fill zero segments; only the word tells them apart, which is
    // exactly why the word is mandatory.
    expect(insufficient).not.toContain('Unrated');
  });

  it('never renders a numeric evidence score beside the meter', () => {
    const html = render(responseWith(analysisWith()));
    expect(html).not.toContain('2/3');
    expect(html).not.toMatch(/score/i);
  });
});

/* ------------------------------------------------------------------ *
 * C. E-06 sources entry
 * ------------------------------------------------------------------ */

describe('C. Sources entry', () => {
  it('is a dialog trigger carrying the real source count', () => {
    const html = render(responseWith(analysisWith()));
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('states that there are none rather than showing a zero', () => {
    const html = render(responseWith(null, { articles: [] }));
    expect(html).toContain(EN.telemetry.noSources);
  });
});

/* ------------------------------------------------------------------ *
 * D. E-09 executive brief
 * ------------------------------------------------------------------ */

describe('D. Executive brief', () => {
  it('marks itself as AI interpretation in visible text', () => {
    const html = render(responseWith(analysisWith()));
    expect(html).toContain(EN.brief.aiInterpretation);
    expect(html).toContain('aria-label="AI-generated executive brief"');
  });

  it('prints the summary verbatim', () => {
    const html = render(responseWith(analysisWith()));
    expect(html).toContain('The ministry suspended exports for four days.');
  });

  it('omits the hero entirely when the analysis failed', () => {
    const html = render(responseWith(null));
    expect(html).not.toContain(EN.brief.aiInterpretation);
  });
});

/* ------------------------------------------------------------------ *
 * E. E-10 answer grid
 * ------------------------------------------------------------------ */

describe('E. Executive answer grid', () => {
  const html = render(responseWith(analysisWith()));

  it('renders all six cells', () => {
    const model = buildAnalysisWorkspaceModel(responseWith(analysisWith()));
    expect(model.briefAnswers).toHaveLength(6);
    Object.values(EN.brief.cells).forEach((label) => expect(html).toContain(label));
  });

  it('keeps an unresolved cell in the grid and says it is unresolved', () => {
    // No geography in this payload, so WHERE cannot resolve.
    expect(html).toContain(EN.brief.notResolved);
    expect(html).toContain(EN.brief.cells.where);
  });

  it('never upgrades geographic precision beyond the payload', () => {
    const countryOnly = render(
      responseWith(analysisWith(), {
        retrievalContext: {
          dataMode: 'live',
          providers: ['gnews'],
          articlesRetrieved: 2,
          countryCode: 'KE',
          countryName: 'Kenya',
        },
      }),
    );
    /*
     * THE BADGE NO LONGER DISTINGUISHES THESE TWO STATES, DELIBERATELY.
     * precision.city and precision.country are both RETRIEVED FOR: both are
     * derived from retrievalContext, which is query-side by contract, so both
     * describe where we LOOKED. Granularity is carried by the PLACE VALUE
     * beside the badge, so that is what this test asserts. Proving the city
     * value is absent is stronger than proving a label string is absent — the
     * value is the thing that would actually mislead a reader.
     */
    expect(countryOnly).toContain(EN.brief.precision.country);
    expect(countryOnly).toContain('Kenya');
    expect(countryOnly).not.toContain('Mombasa');
  });

  it('reports city precision only when the payload actually resolved a city', () => {
    const cityLevel = render(
      responseWith(analysisWith(), {
        retrievalContext: {
          dataMode: 'live',
          providers: ['gnews'],
          articlesRetrieved: 2,
          countryCode: 'KE',
          countryName: 'Kenya',
          city: 'Mombasa',
        },
      }),
    );
    expect(cityLevel).toContain(EN.brief.precision.city);
    expect(cityLevel).toContain('Mombasa');
  });
});

/* ------------------------------------------------------------------ *
 * F. E-16 / E-17 claim cards
 * ------------------------------------------------------------------ */

describe('F. Claim cards and the provenance chain', () => {
  const response = responseWith(analysisWith());
  const entries = buildDimensionClaims(response, 'key-facts');

  function card(index: number): string {
    const entry = entries[index];
    if (entry === undefined) throw new Error(`no entry at ${index}`);
    return renderToStaticMarkup(
      createElement(ClaimCard, {
        entry,
        accent: 'gn-verified' as const,
        dimensionName: EN.dimensions.keyFacts,
        total: entries.length,
        index,
        onOpenSource: () => undefined,
        language: 'en' as const,
      }),
    );
  }

  it('renders an article element named by dimension, position and total', () => {
    expect(card(0)).toContain(`aria-label="${EN.dimensions.keyFacts} finding 1 of 2"`);
    expect(card(1)).toContain(`aria-label="${EN.dimensions.keyFacts} finding 2 of 2"`);
    expect(card(0)).toContain('<article');
  });

  it('carries the ordinal marker as a non-colour identity cue', () => {
    expect(card(0)).toContain('>01<');
    expect(card(1)).toContain('>02<');
  });

  it('prints the claim exactly as the contract supplied it', () => {
    expect(card(0)).toContain('Exports were suspended.');
    expect(card(1)).toContain('Prices rose the following week.');
  });

  it('renders a citation pill whose number came from the articleId map', () => {
    // a2 is the second source, and it is the only citation on card 2.
    expect(card(1)).toContain('>2</span>');
    expect(card(1)).toContain('Publisher a2');
  });

  it('names the source and its action in the pill accessible name', () => {
    expect(card(0)).toContain('aria-label="Source 1, Publisher a1. Open in sources panel."');
  });

  it('states how many sources the entry is cited by, as a count', () => {
    expect(card(0)).toContain(`${EN.claim.citedByPrefix} 1 ${EN.claim.sourceForms[0]}`);
  });

  it('offers the evidence disclosure only where an excerpt exists', () => {
    expect(card(0)).toContain(EN.claim.showEvidenceBasis);
    expect(card(0)).toContain('aria-expanded="false"');
    // The second key fact has no evidenceBasis, so no toggle is rendered.
    expect(card(1)).not.toContain(EN.claim.showEvidenceBasis);
  });

  it('labels the excerpt as a basis from the cited source, never as confirmation', () => {
    const code = codeOnly(source('ClaimCard.tsx'));
    expect(code).toContain('t.evidenceBasisLabel');
    expect(EN.claim.evidenceBasisLabel.toLowerCase()).toContain('evidence basis');
    expect(EN.claim.evidenceBasisLabel.toLowerCase()).not.toContain('verified');
    expect(EN.claim.evidenceBasisLabel.toLowerCase()).not.toContain('confirmed');
  });

  it('renders the excerpt in a blockquote with a cite naming the source', () => {
    const code = codeOnly(source('ClaimCard.tsx'));
    expect(code).toContain('<blockquote');
    expect(code).toContain('<cite');
    expect(code).toContain('entry.evidenceBasis.excerpt');
    expect(code).toContain('aria-live="off"');
  });

  it('marks a genuinely uncited entry rather than borrowing a citation', () => {
    const uncited = buildDimensionClaims(response, 'insufficient-evidence').find(
      (e) => e.kind === 'unknown',
    );
    expect(uncited).toBeDefined();
    const html = renderToStaticMarkup(
      createElement(ClaimCard, {
        entry: uncited!,
        accent: 'gn-uncertain' as const,
        dimensionName: EN.dimensions.insufficientEvidence,
        total: 1,
        index: 0,
        onOpenSource: () => undefined,
        language: 'en' as const,
      }),
    );
    expect(html).toContain(EN.claim.uncited);
    expect(html).not.toContain('aria-label="Source');
  });

  it('shows an unresolved citation instead of guessing a number', () => {
    const ghost = buildDimensionClaims(
      responseWith(analysisWith({ keyFacts: [claim('Cites something absent', ['ghost'])] })),
      'key-facts',
    )[0];
    const html = renderToStaticMarkup(
      createElement(ClaimCard, {
        entry: ghost!,
        accent: 'gn-verified' as const,
        dimensionName: EN.dimensions.keyFacts,
        total: 1,
        index: 0,
        onOpenSource: () => undefined,
        language: 'en' as const,
      }),
    );
    expect(html).toContain(EN.claim.unresolvedCitation);
  });

  it('never composes prose from the claim text', () => {
    const code = codeOnly(source('ClaimCard.tsx'));
    expect(code).toContain('{entry.text}');
    expect(code).not.toContain('entry.text +');
    expect(code).not.toContain('`${entry.text}');
  });
});

/* ------------------------------------------------------------------ *
 * G. E-22 sources drawer
 * ------------------------------------------------------------------ */

describe('G. Sources drawer', () => {
  const model = buildAnalysisWorkspaceModel(responseWith(analysisWith()));

  function drawer(open: boolean, focusArticleId: string | null = null): string {
    return renderToStaticMarkup(
      createElement(SourcesDrawer, {
        open,
        entries: model.sourceSupport,
        focusArticleId,
        onClose: () => undefined,
        language: 'en',
      }),
    );
  }

  it('renders nothing at all while closed', () => {
    expect(drawer(false)).toBe('');
  });

  it('is a modal dialog with an accessible name', () => {
    const html = drawer(true);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Original sources"');
  });

  it('links every source to its real article url, opening safely', () => {
    const html = drawer(true);
    expect(html).toContain('href="https://example.test/a1"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('states which dimensions a source supports, from the citation map', () => {
    const html = drawer(true);
    expect(html).toContain(EN.sources.supportsPrefix);
    expect(html).toContain(EN.dimensions.keyFacts);
  });

  it('says NOT CITED for a retrieved article the analysis never cited', () => {
    const uncitedModel = buildAnalysisWorkspaceModel(
      responseWith(
        analysisWith({
          keyFacts: [claim('Only a1', ['a1'], 1)],
          relevance: [],
          affectedParties: [],
        }),
      ),
    );
    const html = renderToStaticMarkup(
      createElement(SourcesDrawer, {
        open: true,
        entries: uncitedModel.sourceSupport,
        focusArticleId: null,
        onClose: () => undefined,
        language: 'en',
      }),
    );
    expect(html).toContain(EN.sources.notCited);
  });

  it('shows the empty state rather than an empty panel', () => {
    const html = renderToStaticMarkup(
      createElement(SourcesDrawer, {
        open: true,
        entries: [],
        focusArticleId: null,
        onClose: () => undefined,
        language: 'en',
      }),
    );
    expect(html).toContain(EN.sources.empty);
  });
});

/* ------------------------------------------------------------------ *
 * H. Localization
 * ------------------------------------------------------------------ */

describe('H. Localization', () => {
  it('renders the Polish dictionary when the language is pl', () => {
    const pl = getDictionary('pl').analysisWorkspace;
    const html = render(responseWith(analysisWith()), 'pl');
    expect(html).toContain(pl.brief.aiInterpretation);
    expect(html).toContain(pl.telemetry.evidenceLabel);
  });

  it('hardcodes no user-visible English in any new component', () => {
    NEW_CODE.forEach((code) => {
      expect(code).not.toContain('>Evidence<');
      expect(code).not.toContain('>Sources<');
      expect(code).not.toContain("'Cited by");
      expect(code).not.toContain("'Not cited");
    });
  });

  it('keeps en and pl structurally identical in every new group', () => {
    const en = getDictionary('en').analysisWorkspace;
    const pl = getDictionary('pl').analysisWorkspace;
    (['telemetry', 'brief', 'claim', 'sources'] as const).forEach((group) => {
      expect(Object.keys(pl[group]).sort()).toEqual(Object.keys(en[group]).sort());
    });
  });
});

/* ------------------------------------------------------------------ *
 * I. Architecture guards
 * ------------------------------------------------------------------ */

describe('I. No second fetch, no improvised design system', () => {
  it('no new component fetches anything', () => {
    NEW_CODE.forEach((code) => {
      expect(code).not.toContain('fetch(');
      expect(code).not.toContain('analysisApi');
      expect(code).not.toContain('XMLHttpRequest');
      expect(code).not.toContain('useEffect(() => {\n    void fetch');
    });
  });

  it('no new component calls scrollIntoView', () => {
    NEW_CODE.forEach((code) => expect(code).not.toContain('scrollIntoView'));
  });

  it('introduces no charting or plotting library', () => {
    NEW_CODE.forEach((code) => {
      expect(code).not.toMatch(/from '(recharts|d3|chart\.js|victory|nivo|plotly)/);
      expect(code).not.toContain('<canvas');
    });
  });

  it('keeps the shell reading the response through the adapter only', () => {
    const workspace = codeOnly(source('AnalysisWorkspace.tsx'));
    expect(workspace).not.toContain('response.analysis');
    expect(workspace).not.toContain('response.sourceDiversity');
    expect(workspace).not.toContain('response.retrievalContext');
  });
});
