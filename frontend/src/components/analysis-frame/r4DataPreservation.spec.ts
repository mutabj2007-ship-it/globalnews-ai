import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AnalysisApiResponse,
  NewsAnalysisResult,
  NewsArticle,
} from '@globalnews-ai/shared';
import { AnalysisFrame } from './AnalysisFrame';
import { CompleteRecordView } from './CompleteRecordView';

/**
 * R4 §4 — THE DATA-PRESERVATION CONTRACT, ASSERTED RATHER THAN CLAIMED.
 *
 * R4 replaces the long `/search` document with a bounded frame. §4 permits
 * that only while every analytical field the real response supports stays
 * reachable — in the frame, the rail, the dock, or Complete Record.
 *
 * A field-name checklist would prove nothing: a component can import a
 * field and never render it. So every field below is seeded with a
 * SENTINEL string that occurs nowhere else, both surfaces are rendered,
 * and the test asserts the sentinel reaches the reader's eyes. A field
 * that is dropped, or bound but never printed, fails here.
 *
 * `where` records which surface is expected to carry it, so a future
 * change that MOVES a field between surfaces still passes while a change
 * that LOSES it cannot.
 */

const S = (name: string) => `SENTINEL~${name}~VALUE`;

const article = (i: number, over: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id: `a${i}`,
    title: S(`article${i}Title`),
    summary: `Body of report ${i}.`,
    url: `https://outlet${i}.test/story`,
    sourceId: `s${i}`,
    sourceName: S(`article${i}Publisher`),
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-20T10:00:00.000Z',
    sourceLanguage: 'en',
    countryCode: 'UA',
    countryName: S('articleCountryName'),
    ...over,
  }) as NewsArticle;

const articles = [article(1), article(2), article(3)];

const analysis = {
  query: S('analysisQuery'),
  headline: S('headline'),
  summary: S('summary'),
  keyFacts: [
    { claim: S('keyFact'), sourceArticleIds: ['a1'], evidenceBreadth: 'single-article' },
  ],
  agreements: [{ point: S('agreement'), sourceArticleIds: ['a1', 'a2'] }],
  differences: [
    { topic: S('differenceTopic'), positions: [{ description: S('differenceStance'), sourceArticleIds: ['a1'] }] },
  ],
  unknowns: [S('unknown')],
  timeline: [{ timestamp: '2026-08-19T00:00:00.000Z', event: S('timelineEvent'), sourceArticleIds: ['a2'] }],
  confidence: { level: 'medium', score: 61, explanation: S('confidenceExplanation') },
  entities: {
    countries: [S('entityCountry')],
    locations: [S('entityLocation')],
    people: [S('entityPerson')],
    organizations: [S('entityOrganization')],
    topics: [S('entityTopic')],
  },
  sources: articles.map((a) => ({
    articleId: a.id,
    publisher: a.sourceName,
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
  })),
  generatedAt: '2026-08-21T08:00:00.000Z',
  analysisMode: 'live-ai',
  trustState: {
    level: 'moderate',
    reasons: ['differences-reported'],
    distinctSourceArticleCount: 3,
    differenceTopicCount: 1,
    uncertaintyCount: 1,
  },
  uncertainties: [{ description: S('uncertainty'), sourceArticleIds: [] }],
  context: [{ claim: S('context'), sourceArticleIds: ['a1'] }],
  relevance: [{ claim: S('relevance'), sourceArticleIds: ['a1'] }],
  affectedParties: [
    { party: S('affectedParty'), partyType: 'population', effect: S('affectedEffect'), sourceArticleIds: ['a2'] },
  ],
  immediateImpacts: [{ claim: S('immediateImpact'), sourceArticleIds: ['a1'] }],
  spilloverImplications: [{ claim: S('spillover'), sourceArticleIds: ['a3'] }],
  significance: { level: 'high', rationale: [{ claim: S('significance'), sourceArticleIds: ['a1'] }] },
  watchNext: [{ claim: S('watchNext'), hingeType: 'decision', sourceArticleIds: ['a2'] }],
  relationalComposition: {
    directionalEligibility: 'supported',
    evidenceSufficiency: 'adequate',
    summary: S('relationalSummary'),
    supportingClaims: [{ section: 'keyFacts', index: 0 }],
    reverseClaims: [],
    associationOnlyClaims: [],
    mixedClaims: [],
    unclearOrNonSubstantiveClaims: [],
  },
} as unknown as NewsAnalysisResult;

const response = {
  query: S('analysisQuery'),
  normalizedQuery: 'normalized',
  requestedLanguage: 'en',
  responseLanguage: 'en',
  analysis,
  articles,
  retrievalContext: {
    dataMode: 'live',
    providers: [S('provider')],
    articlesRetrieved: articles.length,
    countryName: S('retrievalCountryName'),
  },
  sourceEntities: {
    organizations: [
      { canonical: S('sourceEntityOrg'), matchedFrom: [S('sourceEntityAlias')], articleIds: ['a1'] },
    ],
  },
  provenance: {
    provider: 'openai',
    executionMode: 'production',
    analysisMode: 'live-ai',
    status: 'succeeded',
    cached: false,
  },
  sourceDiversity: { reportingClusterCount: 2, distinctSourceArticleCount: 3 },
} as unknown as AnalysisApiResponse;

const frameHtml = renderToStaticMarkup(
  createElement(AnalysisFrame as never, {
    response,
    initialViewport: { width: 1440, height: 900 },
    initialDock: 'expanded',
  } as never),
);

const recordHtml = renderToStaticMarkup(
  createElement(CompleteRecordView as never, { response } as never),
);

const BOTH = `${frameHtml}\n${recordHtml}`;

/*
 * R4.2 — the relational seed.
 *
 * Deliberately NOT added to `response` above: every other assertion in
 * this file measures the R4 §4 preservation contract on a response with
 * no relational content, and changing that shared fixture would alter
 * what those assertions are testing. The relational guards below build
 * their own response instead.
 *
 * The excerpt is a sentinel, so a match cannot come from fixture prose,
 * dictionary copy or analysis text — only from the assessment itself.
 */
const RELATIONAL_EXCERPT = S('relationalReverseExcerpt');

const relationalResponse = {
  ...response,
  analysis: {
    ...analysis,
    relationalEvidenceAssessments: [
      {
        articleId: articles[0].id,
        excerpt: RELATIONAL_EXCERPT,
        direction: 'reverse-direction',
      },
    ],
  },
} as unknown as AnalysisApiResponse;

/* The dock is compact by default, so the guard renders it expanded — the
   state R4.2 §2 places relational evidence in. */
const renderRelational = () =>
  renderToStaticMarkup(
    createElement(AnalysisFrame as never, {
      response: relationalResponse,
      initialViewport: { width: 1440, height: 900 },
      initialDock: 'expanded',
    } as never),
  );

/*
 * §4 has no width qualifier, so neither does this suite. Running only at
 * 1440 is exactly how the missing chip-row index at S went unnoticed:
 * the Complete Record entry vanished there, taking every record-only
 * field with it, while this file stayed green.
 */
const WIDTHS = [1440, 1024, 768, 375] as const;

/* Every field R4 §4 names, and the surface that must carry it. */
const FIELDS: ReadonlyArray<{ field: string; sentinel: string; where: 'frame' | 'record' | 'either' }> = [
  { field: 'analysis.headline', sentinel: S('headline'), where: 'either' },
  { field: 'analysis.summary', sentinel: S('summary'), where: 'either' },
  { field: 'analysis.keyFacts', sentinel: S('keyFact'), where: 'either' },
  { field: 'analysis.agreements', sentinel: S('agreement'), where: 'either' },
  { field: 'analysis.differences', sentinel: S('differenceStance'), where: 'either' },
  { field: 'analysis.unknowns', sentinel: S('unknown'), where: 'either' },
  { field: 'analysis.timeline', sentinel: S('timelineEvent'), where: 'either' },
  { field: 'analysis.uncertainties', sentinel: S('uncertainty'), where: 'either' },
  { field: 'analysis.entities.people', sentinel: S('entityPerson'), where: 'record' },
  { field: 'analysis.entities.topics', sentinel: S('entityTopic'), where: 'record' },
  { field: 'analysis.confidence.explanation', sentinel: S('confidenceExplanation'), where: 'record' },
  { field: 'analysis.relationalComposition', sentinel: S('relationalSummary'), where: 'either' },
  { field: 'analysis.context', sentinel: S('context'), where: 'either' },
  { field: 'analysis.relevance', sentinel: S('relevance'), where: 'either' },
  { field: 'analysis.affectedParties', sentinel: S('affectedParty'), where: 'either' },
  { field: 'analysis.immediateImpacts', sentinel: S('immediateImpact'), where: 'either' },
  { field: 'analysis.spilloverImplications', sentinel: S('spillover'), where: 'either' },
  { field: 'analysis.significance', sentinel: S('significance'), where: 'either' },
  { field: 'analysis.watchNext', sentinel: S('watchNext'), where: 'either' },
  { field: 'sourceEntities.organizations', sentinel: S('sourceEntityOrg'), where: 'record' },
  { field: 'articles[].sourceName', sentinel: S('article1Publisher'), where: 'either' },
];

describe('R4 §4 — no analytical field is lost when the long document is replaced', () => {
  it.each(FIELDS)('$field survives on the $where surface', ({ sentinel, where }) => {
    const haystack = where === 'frame' ? frameHtml : where === 'record' ? recordHtml : BOTH;
    expect(haystack).toContain(sentinel);
  });

  it('analysis.trustState.reasons survives on the record surface', () => {
    /*
     * TrustReason is a closed set of language-neutral CODES, not free
     * text, so a sentinel cannot ride in on it. The reader-visible proof
     * is that the record renders the localized sentence the supplied code
     * maps to — which also proves the code reached a renderer rather than
     * being carried and dropped.
     */
    const { trustReasonLabel } = require('@/lib/trustReasonLabels');
    expect(recordHtml).toContain(trustReasonLabel('differences-reported', 'en'));
  });

  it('the DEFAULT frame does not also render the record — disclosure, not duplication (§3.C)', () => {
    /* The record-only sentinels are the proof: if the frame carried them
       too, the same field would be rendered twice on one route, which is
       exactly the duplication §2 and §3.C reject. */
    for (const { sentinel, where } of FIELDS) {
      if (where !== 'record') continue;
      expect({ sentinel, inFrame: frameHtml.includes(sentinel) }).toEqual({ sentinel, inFrame: false });
    }
  });

  /*
   * ── INVERTED IN R4.2 ─────────────────────────────────────────────────
   *
   * OLD TEST: "KNOWN GAP: relationalEvidenceAssessments is bound by NO
   * surface, before or after R4", asserting
   * `/relationalEvidenceAssessments/.test(BOTH) === false`.
   *
   * WHY IT HAD TO GO — TWO SEPARATE REASONS.
   *
   * 1. Its claim is now FALSE. R4.2 binds the field through the relational
   *    evidence surface in the expanded Sources Dock. A test asserting the
   *    absence of a feature that exists is worse than no test: it is a
   *    standing instruction to remove the feature.
   *
   * 2. It measured the wrong thing, and would have kept passing anyway.
   *    It searched RENDERED MARKUP for the literal field IDENTIFIER. An
   *    identifier is source-level; it never appears in HTML whether the
   *    content is bound or not. So the assertion was inert — it could not
   *    have detected the binding it existed to detect, in either
   *    direction. Renaming it would have preserved exactly that defect.
   *
   * WHAT REPLACES IT: a positive guard that seeds a distinctive excerpt,
   * renders the real surface, and requires the excerpt to reach the
   * reader. It fails if the binding is removed — proven by mutation, not
   * assumed; see the CTO report for the recorded failure output.
   */
  /* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A: same guard, same excerpt, same
     binding to the article that carries it — read from the reading path's
     new sources region rather than the rejected miniature dock. */
  it('R4.2 GUARD: a seeded relational assessment is VISIBLE on the source card', () => {
    const html = renderRelational();

    /* The excerpt itself — the content, not the field name. */
    expect(html).toContain(RELATIONAL_EXCERPT);

    /* It reaches the reader through the relational surface, bound to the
       article that carries it, rather than leaking in as loose text. */
    const dock = html.slice(html.indexOf('data-paf="sources-reporting"'));
    expect(dock).toContain(RELATIONAL_EXCERPT);
    expect(dock).toContain('data-paf="relational-assessment"');
    expect(dock).toMatch(
      new RegExp(`data-direction="reverse-direction"[^>]*data-article-id="${articles[0].id}"`),
    );
  });

  it('R4.2 GUARD: the seeded reverse assessment keeps an honest label', () => {
    const html = renderRelational();
    const { getDictionary } = require('@/lib/i18n/dictionaries');
    const label = getDictionary('en').analysisFrame.relationalDirection['reverse-direction'];

    /* Reverse evidence is still called reverse on screen... */
    expect(html).toContain(label);
    expect(label).toMatch(/REVERSE/i);
    /* ...and is never softened into a generic positive word. */
    expect(label).not.toMatch(/\bSUPPORTS?\b|\bSUPPORTING\b|\bCONFIRMS?\b|\bPROVES?\b/i);
  });

  it('R4.2 GUARD: the guard is not vacuous — it fails on a response with no assessments', () => {
    /*
     * The control the OLD test lacked. If this render also contained the
     * excerpt, the assertions above would prove nothing about the binding
     * — they would be satisfied by any page that happened to include the
     * string. The unseeded response must NOT contain it.
     */
    const withoutHtml = renderToStaticMarkup(
      createElement(AnalysisFrame as never, {
        response,
        initialViewport: { width: 1440, height: 900 },
        initialDock: 'expanded',
      } as never),
    );
    expect(withoutHtml).not.toContain(RELATIONAL_EXCERPT);
    expect(withoutHtml).not.toContain('data-paf="relational-assessment"');
  });

  it.each(WIDTHS)('at %ipx the record is still REACHABLE, so record-only fields are not lost', (width) => {
    const html = renderToStaticMarkup(
      createElement(AnalysisFrame as never, {
        response,
        initialViewport: { width, height: 800 },
        onOpenRecord: () => undefined,
      } as never),
    );
    expect({ width, entry: html.includes('data-paf="complete-record-entry"') })
      .toEqual({ width, entry: true });
  });
});
