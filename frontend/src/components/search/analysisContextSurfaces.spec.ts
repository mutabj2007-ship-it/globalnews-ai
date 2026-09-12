import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
  SourcedClaim,
} from '@globalnews-ai/shared';
import { AnalysisWorkspace } from './AnalysisWorkspace';
import { CompleteRecordView } from '../analysis-frame/CompleteRecordView';
import { GeographicIntelligence } from './GeographicIntelligence';
import { WatchNextModule } from './WatchNextModule';
import { TimelineSubView } from './TimelineSubView';
import { AnalysisSubViewStrip } from './AnalysisSubViewStrip';
import { buildAnalysisWorkspaceModel, resolveGeography } from './analysisDimensions';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';
import { buildTimelineEntries, buildWatchNextEntries } from './analysisClaims';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H2D — the surfaces added to close Analysis for MVP, and the retirement
 * of the duplicate long-form presentation.
 *
 * The geography assertions are the ones to read first. The permanent
 * rule is that displayed precision never exceeds evidence precision, and
 * the way that rule fails in practice is not a wrong label — it is a
 * device that looks like a coordinate. So these check the markup, not
 * just the words.
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
const ARTICLES: NewsArticle[] = [article('a1'), article('a2')];
const claim = (t: string, ids: string[]): SourcedClaim => ({ claim: t, sourceArticleIds: ids });

function analysisWith(overrides: Partial<NewsAnalysisResult> = {}): NewsAnalysisResult {
  const base: NewsAnalysisResult = {
    query: 'q',
    headline: 'H',
    summary: 'The ministry suspended exports.',
    keyFacts: [claim('Exports suspended.', ['a1'])],
    agreements: [{ point: 'Both outlets agree.', sourceArticleIds: ['a1', 'a2'] }],
    differences: [],
    unknowns: [],
    timeline: [
      { timestamp: '2026-08-20T09:00:00.000Z', event: 'Port closed', sourceArticleIds: ['a1'] },
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
      distinctSourceArticleCount: 2,
      differenceTopicCount: 0,
      uncertaintyCount: 0,
    },
    context: [claim('The port handles most regional trade.', ['a2'])],
    relevance: [claim('It matters.', ['a1'])],
    affectedParties: [
      { party: 'Kenya', partyType: 'country', effect: 'Exports delayed', sourceArticleIds: ['a2'] },
    ],
    immediateImpacts: [claim('Shipments held.', ['a1'])],
    spilloverImplications: [],
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
    query: 'What is happening with the export ban?',
    normalizedQuery: 'x',
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

const COUNTRY_CONTEXT = {
  dataMode: 'live' as const,
  providers: ['gnews'],
  articlesRetrieved: 2,
  countryCode: 'KE',
  countryName: 'Kenya',
  matchedFrom: 'query',
};

const render = (response: AnalysisApiResponse, language: 'en' | 'pl' = 'en'): string =>
  renderToStaticMarkup(createElement(AnalysisWorkspace, { response, language }));

const source = (file: string): string => readFileSync(join(__dirname, file), 'utf-8');
const codeOnly = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const EN = getDictionary('en').analysisWorkspace;
const NEW_CODE = [
  'GeographicIntelligence.tsx',
  'WatchNextModule.tsx',
  'TimelineSubView.tsx',
  'RelationshipsSubView.tsx',
  'AnalysisSubViewStrip.tsx',
].map((f) => codeOnly(source(f)));

function geographyMarkup(retrievalContext: AnalysisApiResponse['retrievalContext']): string {
  return renderToStaticMarkup(
    createElement(GeographicIntelligence, {
      geography: resolveGeography(retrievalContext),
      language: 'en',
    }),
  );
}

/* ------------------------------------------------------------------ *
 * A. E-13 — displayed precision never exceeds evidence precision
 * ------------------------------------------------------------------ */

describe('A. Geographic intelligence', () => {
  const countryHtml = geographyMarkup(COUNTRY_CONTEXT);

  it('states the retrieval badge and renders no city VALUE the payload did not resolve', () => {
    /*
     * THE BADGE IS INTENTIONALLY THE SAME FOR CITY AND COUNTRY.
     * Both come from retrievalContext, which is query-side by contract, so both
     * state where we LOOKED — RETRIEVED FOR. Granularity is carried by the PLACE
     * VALUE beside the badge. Asserting label-inequality is therefore no longer
     * possible OR meaningful; asserting the city value is absent is stronger,
     * because the value is what would actually mislead a reader.
     */
    const cityHtml = geographyMarkup({ ...COUNTRY_CONTEXT, city: 'mombasa' });

    expect(countryHtml).toContain(EN.geography.precision.country);
    expect(countryHtml).toContain('Kenya');
    expect(cityHtml).toContain('mombasa');
    expect(countryHtml).not.toContain('mombasa');
  });

  it('says plainly that nothing finer exists in the evidence', () => {
    expect(countryHtml).toContain(EN.geography.noSubnationalPrecision);
  });

  it('names country and precision in the alternative text, and no coordinate', () => {
    expect(countryHtml).toContain('role="img"');
    expect(countryHtml).toMatch(/aria-label="[^"]*Kenya[^"]*RETRIEVED FOR[^"]*"/);
    /* Rings are a certainty area; describing them as a position would
       be the exact failure this module exists to avoid. */
    expect(countryHtml).not.toMatch(/aria-label="[^"]*(lat|lon|coordinate|°)[^"]*"/i);
  });

  it('renders no surface, marker or rings when nothing resolved', () => {
    const unresolved = geographyMarkup({
      dataMode: 'live',
      providers: ['gnews'],
      articlesRetrieved: 2,
    });
    expect(unresolved).toContain(EN.geography.noResolution);
    expect(unresolved).not.toContain('role="img"');
    expect(unresolved).not.toContain('rounded-full');
  });

  it('shows a city VALUE only when a city genuinely resolved', () => {
    const cityHtml = geographyMarkup({ ...COUNTRY_CONTEXT, city: 'mombasa' });

    /* Same badge as the country case, by design — see the first test above. */
    expect(cityHtml).toContain(EN.geography.precision.city);
    expect(cityHtml).toContain('mombasa');
    expect(countryHtml).not.toContain('mombasa');
  });

  it('links to the world map by the existing iso3 convention', () => {
    expect(countryHtml).toContain('href="/map?country=KEN"');
  });

  it('does not promise to focus the country, because the map does not yet read the parameter', () => {
    expect(EN.geography.openWorldMap.toLowerCase()).not.toContain('kenya');
    expect(EN.geography.openWorldMap.toLowerCase()).not.toContain('focus');
  });

  it('shows no resolution confidence and no source-count claim for geography', () => {
    expect(countryHtml).not.toMatch(/\d+\s*%/);
    expect(countryHtml).not.toContain(EN.claim.citedByPrefix);
    NEW_CODE.forEach((code) => expect(code).not.toContain('matchConfidence'));
  });

  it('is reachable from the workspace, in the affected-parties panel', () => {
    const workspaceCode = codeOnly(source('AnalysisWorkspace.tsx'));
    expect(workspaceCode).toContain("activeModel.key === 'who-is-affected'");
    expect(workspaceCode).toContain('<GeographicIntelligence');
  });
});

/* ------------------------------------------------------------------ *
 * B. E-24 context
 * ------------------------------------------------------------------ */

describe('B. Context disclosure', () => {
  it('renders collapsed, inside the brief, with the specified accessible name', () => {
    const html = render(responseWith(analysisWith()));
    expect(html).toContain(`aria-label="${EN.context.ariaLabel}"`);
    expect(html).toContain('aria-expanded="false"');
    /* Collapsed means the body is not painted. */
    expect(html).not.toContain('The port handles most regional trade.');
  });

  it('is absent entirely when the field is empty — never a placeholder', () => {
    const html = render(responseWith(analysisWith({ context: [] })));
    expect(html).not.toContain(EN.context.ariaLabel);
  });
});

/* ------------------------------------------------------------------ *
 * C. E-25 watch next
 * ------------------------------------------------------------------ */

describe('C. Watch next', () => {
  const html = renderToStaticMarkup(
    createElement(WatchNextModule, {
      entries: buildWatchNextEntries(responseWith(analysisWith())),
      language: 'en',
    }),
  );

  it('carries the projection qualifier in its accessible name, not only on screen', () => {
    expect(html).toMatch(new RegExp(`aria-label="[^"]*${EN.watchNext.qualifier}[^"]*"`));
    expect(html).toContain(EN.watchNext.qualifier);
  });

  it('renders items verbatim with their hinge type', () => {
    expect(html).toContain('Ministry statement expected');
    expect(html).toContain(EN.watchNext.hingeTypes.pending_response);
  });

  it('uses the AI accent and never the uncertainty accent', () => {
    const code = codeOnly(source('WatchNextModule.tsx'));
    expect(code).toContain('gn-ai');
    expect(code).not.toContain('gn-uncertain');
  });

  it('renders nothing at all when the field is absent', () => {
    expect(
      renderToStaticMarkup(createElement(WatchNextModule, { entries: [], language: 'en' })),
    ).toBe('');
  });

  it('introduces no persistence, subscription or notification', () => {
    const code = codeOnly(source('WatchNextModule.tsx'));
    ['localStorage', 'sessionStorage', 'Notification', 'subscribe', 'fetch('].forEach((banned) =>
      expect(code).not.toContain(banned),
    );
  });
});

/* ------------------------------------------------------------------ *
 * D. E-26 sub-view strip
 * ------------------------------------------------------------------ */

describe('D. Sub-view strip', () => {
  const model = buildAnalysisWorkspaceModel(responseWith(analysisWith()));
  const keyFacts = model.dimensions.find((d) => d.key === 'key-facts');

  const stripHtml = renderToStaticMarkup(
    createElement(AnalysisSubViewStrip, {
      dimension: 'key-facts' as const,
      dimensionName: EN.dimensions.keyFacts,
      subViews: keyFacts?.subViews ?? [],
      activeSubView: 'reported-facts' as const,
      onSelect: () => undefined,
      language: 'en' as const,
    }),
  );

  it('is a nested tablist named for its dimension', () => {
    expect(stripHtml).toContain('role="tablist"');
    expect(stripHtml).toContain(
      `aria-label="${EN.dimensions.keyFacts} ${EN.subViews.viewsSuffix}"`,
    );
  });

  it('marks exactly one segment active and gives the rest tabindex -1', () => {
    expect((stripHtml.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    expect((stripHtml.match(/tabindex="0"/g) ?? []).length).toBe(1);
  });

  it('shows each segment count and its divergence qualifier', () => {
    expect(stripHtml).toContain(EN.subViews.agreements);
    expect(stripHtml).toContain(EN.subViews.reportedFacts);
  });

  it('renders nothing when there is only one segment to show', () => {
    expect(
      renderToStaticMarkup(
        createElement(AnalysisSubViewStrip, {
          dimension: 'key-facts' as const,
          dimensionName: 'x',
          subViews: (keyFacts?.subViews ?? []).slice(0, 1),
          activeSubView: 'reported-facts' as const,
          onSelect: () => undefined,
          language: 'en' as const,
        }),
      ),
    ).toBe('');
  });

  it('is underlined, not pilled — the level-1 navigator is the pill', () => {
    const code = codeOnly(source('AnalysisSubViewStrip.tsx'));
    expect(code).toContain('border-b-2');
    expect(code).not.toContain('rounded-gn-pill');
  });
});

/* ------------------------------------------------------------------ *
 * E. E-28 timeline
 * ------------------------------------------------------------------ */

describe('E. Timeline is a list, not a chart', () => {
  const html = renderToStaticMarkup(
    createElement(TimelineSubView, {
      entries: buildTimelineEntries(responseWith(analysisWith())),
      onOpenSource: () => undefined,
      language: 'en',
    }),
  );

  it('is an ordered list carrying the event verbatim', () => {
    expect(html).toContain('<ol');
    expect(html).toContain('Port closed');
  });

  it('keeps each event linked to its own source', () => {
    expect(html).toMatch(new RegExp(`aria-label="${EN.claim.sourcePrefix} 1, Publisher a1`));
  });

  it('draws no axis, no canvas and no percentage', () => {
    expect(html).not.toContain('<canvas');
    expect(html).not.toMatch(/\d+\s*%/);
  });

  it('scales nothing by time — no positional style is computed from a timestamp', () => {
    const code = codeOnly(source('TimelineSubView.tsx'));
    expect(code).not.toContain('getTime()');
    expect(code).not.toContain('style={{ height');
    expect(code).not.toContain('flexGrow');
  });
});

/* ------------------------------------------------------------------ *
 * F. Legacy suppression
 * ------------------------------------------------------------------ */

/*
 * ── F RETARGETED IN R4 ────────────────────────────────────────────────
 *
 * OLD ASSERTIONS: four locator checks on `SearchPageClient.tsx` — that
 * `<AnalysisClassicRecord` appeared after `{response.analysis ? (` and
 * before `<AnalysisResultView`; that the article grid sat after
 * `</AnalysisClassicRecord>`; that the file contained `useState(false)`,
 * `hidden={!open}` and `aria-expanded={open}`; and that four named
 * legacy components were each rendered in this file.
 *
 * WHY THEY NO LONGER HOLD: `AnalysisClassicRecord` was the disclosure
 * that kept the long-form record reachable from the long `/search`
 * document. R4 §2 rejects that document; §3 replaces it with the bounded
 * frame, whose own Complete Record control is now the disclosure. A
 * second disclosure wrapping a second copy of the record would be the
 * duplicate rendering §3.C forbids, so it is gone from this file.
 *
 * WHAT THIS BLOCK WAS REALLY FOR: its own title — the workspace is the
 * analysis, and the long-form record is COLLAPSED, not deleted. Both
 * halves still have to hold, so both are asserted below, on rendered
 * markup rather than on the layout that used to produce it.
 *
 * The fourth assertion — "deletes nothing" — is the important one, and
 * it is not weakened: `analysis-frame/r4DataPreservation.spec.ts` seeds
 * every field R4 §4 names with a unique sentinel and asserts each one
 * still reaches the reader. That is a stronger guarantee than four
 * component names, which a file could satisfy while rendering nothing.
 */
describe('F. The workspace is the analysis; the long-form record is collapsed', () => {
  const RESPONSE = responseWith(analysisWith(), { retrievalContext: COUNTRY_CONTEXT });

  const surface = (extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response: RESPONSE,
        initialViewport: { width: 1440, height: 900 },
        ...extra,
      } as never),
    );

  it('the DEFAULT surface is the bounded frame, not the long-form record', () => {
    const html = surface();
    expect(html).toContain('data-paf="frame"');
    expect(html).not.toContain('data-paf="complete-record"');
  });

  it('the long-form record is COLLAPSED, not deleted — it is one control away', () => {
    const opened = surface({ initialDestination: 'record' });
    expect(opened).toContain('data-paf="complete-record"');
    /* And it is the accepted long-form presentation, not a reimplementation. */
    const recordSource = source('../analysis-frame/CompleteRecordView.tsx');
    expect(recordSource).toContain('<AnalysisResultView');
    expect(recordSource).toContain('<RetrievalContextStatus');
    expect(recordSource).toContain('<SourceEntitiesPanel');
  });

  it('the control that opens it is present, labelled and at the bottom of the rail (§3.B)', () => {
    /* The record REPLACES the frame in place rather than expanding
       within it, so the correct affordance is a labelled button, not an
       aria-expanded disclosure — that ARIA belongs to the Sources Dock,
       which genuinely expands, and is asserted where it lives. */
    const html = surface();
    expect(html).toContain('data-paf="complete-record-entry"');
    const control = html.slice(html.indexOf('data-paf="complete-record-entry"'));
    expect(control).toContain(getDictionary('en').analysisFrame.completeRecord);

    /* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A. The Sources Dock left the
       reading path — R3 rejected the miniature presentation — and took
       its expand/collapse ARIA with it into the Complete Analysis Record,
       where it still genuinely expands. The §9 ARIA is therefore asserted
       at its new home rather than deleted. */
    const record = renderToStaticMarkup(
      createElement(CompleteRecordView as never, {
        response: RESPONSE,
        language: 'en',
        onBack: () => undefined,
      } as never),
    );
    expect(record).toMatch(/data-paf="dock-toggle"[^>]*aria-expanded="(true|false)"/);
    expect(record).toMatch(/aria-controls="gn-paf-sources-dock"/);
  });

  it('the evidence stays outside the disclosure — sources survive AI failure (M52-B)', () => {
    const failed = renderToStaticMarkup(
      createElement(AnalysisFrameSurface as never, {
        response: { ...RESPONSE, analysis: null },
        initialViewport: { width: 1440, height: 900 },
      } as never),
    );
    /* RETARGETED: same invariant — the retrieved evidence survives an AI
       failure and is NOT hidden behind the Complete Record disclosure.
       The region that carries it on the reading path is now the image-led
       sources section. */
    expect(failed).toContain('data-paf="sources-reporting"');
    expect(failed).not.toContain('data-paf="complete-record"');
  });
});

/* ------------------------------------------------------------------ *
 * G. Localization and honesty across the new surfaces
 * ------------------------------------------------------------------ */

describe('G. Localization and honesty', () => {
  it('keeps en and pl structurally identical in every new group', () => {
    const en = getDictionary('en').analysisWorkspace;
    const pl = getDictionary('pl').analysisWorkspace;
    (
      [
        'geography',
        'context',
        'watchNext',
        'subViews',
        'timeline',
        'relationships',
        'classicRecord',
      ] as const
    ).forEach((group) =>
      expect(Object.keys(pl[group]).sort()).toEqual(Object.keys(en[group]).sort()),
    );
  });

  it('renders the Polish dictionary when the language is pl', () => {
    const pl = getDictionary('pl').analysisWorkspace;
    const html = render(responseWith(analysisWith(), { retrievalContext: COUNTRY_CONTEXT }), 'pl');
    expect(html).toContain(pl.brief.aiInterpretation);
  });

  it('renders no percentage, no confidence score and no chart anywhere', () => {
    const html = render(responseWith(analysisWith(), { retrievalContext: COUNTRY_CONTEXT }));
    expect(html).not.toMatch(/\d+\s*%/);
    expect(html).not.toContain('91');
    expect(html).not.toContain('<canvas');
  });

  it('introduces no charting library in any new surface', () => {
    NEW_CODE.forEach((code) => {
      expect(code).not.toMatch(/from '(recharts|d3|chart\.js|victory|nivo|plotly)/);
      expect(code).not.toContain('scrollIntoView');
      expect(code).not.toContain('fetch(');
    });
  });
});
