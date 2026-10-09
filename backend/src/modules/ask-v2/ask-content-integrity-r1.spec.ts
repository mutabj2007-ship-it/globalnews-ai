import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import type { AnalysisConfigService } from '../analysis/config/analysis-config.service';
import type { AnalysisProviderInput } from '../analysis/interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../analysis/providers/mock-analysis.provider';
import { AnalysisService } from '../analysis/service/analysis.service';
import { buildReportingWindowInstruction } from '../analysis/prompt/build-analysis-prompt.util';
import { questionAnchorsOf } from '../analysis/query/question-anchors.util';
import {
  directlyEvidencesRelationship,
  relationshipEvidenceClass,
} from '../analysis/relevance/relationship-evidence.util';
import { attachProviderFailures } from '../news/news.service';
import { routeAskR2 } from '../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { executionContractOf, selfContainedStablePart } from './execution-contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO — ALPHA ASK CONTENT-INTEGRITY FAILURE R1 (Alpha 89bd4da, op 05242618, 2026-10-09)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Product Owner's Tanzania–Rwanda trade-and-transportation question was answered with
 *   A  a general model essay on "uncertainty" (psychology, science, climate) — the reader's
 *      "explain what remains uncertain" was split off as a self-contained explanatory question;
 *   B  an East Africa–China business programme admitted as bilateral evidence by the anchor gate's
 *      supplement (LINKED:TZA+RWA:trade candidates=0 admitted=1 supplements=1);
 *   C  "I could not verify this claim" for an open question;
 *   D  source labels and counts built BEFORE the gate (its supplement searches, where GNews and
 *      GDELT answered 429, were invisible);
 *   E  an announced programme at risk of being read as an observed change in the window.
 * Each is pinned below with the exact question shapes, through the REAL router and the REAL
 * analysis service (fake providers only).
 */
const PO_QUESTION =
  'What changed in trade and transportation between Tanzania and Rwanda during the past 30 days?';
const route = (q: string, lang = 'en') =>
  routeAskR2(
    { originalQuestion: q, sourceLanguage: lang, normalizationLanguage: lang, displayLanguage: lang, origin: 'ASK' } as never,
    { requestInstant: '2026-10-09T12:00:00Z' } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );
const contract = (q: string, lang = 'en') =>
  executionContractOf({ question: q, language: lang, route: route(q, lang) });

describe('A · an explanation that depends on the findings stays attached to the subject', () => {
  it.each([
    `${PO_QUESTION} Explain what remains uncertain.`,
    'What changed in trade and transportation between Tanzania and Rwanda during the past 30 days, and explain what remains uncertain.',
    `${PO_QUESTION} Separate verified developments from analysis and explain what remains uncertain.`,
    `${PO_QUESTION} Also explain what is still unverified.`,
  ])('"%s" → ONE request (DIRECT), never a separate reasoning answer', (q) => {
    const c = contract(q);
    expect(c.kind).toBe('DIRECT');
    expect(c.stableQuestion).toBeNull();
    expect(c.stableDependsOnFindings).toBe(true);
    expect(c.retrievalQuestion).toBe(q);
    expect(c.relationship?.countries).toEqual(['TZA', 'RWA']);
  });

  it('the exact PO question alone stays a plain current-reporting request on the bilateral scope', () => {
    const c = contract(PO_QUESTION);
    expect(c.kind).toBe('DIRECT');
    expect(c.stableQuestion).toBeNull();
    expect(c.relationship?.relations).toEqual(expect.arrayContaining(['TRADE', 'TRANSPORT']));
  });

  it.each([
    ['What is the history of the Central Corridor and what is happening on it now?', 'What is the history of the Central Corridor'],
  ])('CONTROL — a legitimate mixed historical/current question still splits: "%s"', (q, stable) => {
    const c = contract(q);
    expect(c.kind).toBe('MIXED_CURRENT_PART');
    expect(c.stableQuestion).toBe(stable);
  });

  it('an UNCLASSIFIED instruction clause ("Separate verified developments from analysis") is never dropped by a split', () => {
    const q =
      'What is the history of the Central Corridor? Separate verified developments from analysis. What is happening on it now?';
    const c = contract(q);
    expect(c.kind).toBe('DIRECT');
    expect(c.retrievalQuestion).toBe(q);
  });

  it('the unit rule: findings-state parts are not self-contained; subject-bearing ones are', () => {
    for (const t of [
      'Explain what remains uncertain.',
      'what is still unverified',
      'and what has not been confirmed',
      'what evidence is missing',
      'Wyjaśnij, co pozostaje niepewne.',
    ])
      expect(selfContainedStablePart(t)).toBe(false);
    for (const t of [
      'What is the history of the Central Corridor',
      'What was the source of the Nile',
      'Explain the gap between rich and poor regions',
      'Why do central banks raise rates',
    ])
      expect(selfContainedStablePart(t)).toBe(true);
  });
});

/* ── B · bilateral evidence ─────────────────────────────────────────────── */
const SCOPE = { countries: ['TZA', 'RWA'], relations: ['TRADE', 'TRANSPORT'] as never };
const CHINA_PROGRAMME = {
  title: 'China launches market-access programme for East African businesses',
  summary:
    'Firms from Kenya, Uganda, Tanzania and Rwanda will be able to export goods to China under the programme, which starts next year, organisers said, as trade and logistics links grow.',
};

describe('B · direct bilateral evidence, regional context, and nothing', () => {
  it('the live regional China item is REGIONAL_CONTEXT — never evidence of a Tanzania–Rwanda change', () => {
    expect(relationshipEvidenceClass(CHINA_PROGRAMME, SCOPE)).toBe('REGIONAL_CONTEXT');
    expect(directlyEvidencesRelationship(CHINA_PROGRAMME, SCOPE)).toBe(false);
  });
  it.each([
    ['Rwanda and Tanzania ease cargo checks at Rusumo border', 'Truck traders welcome faster customs clearance on the route.'],
    ['Tanzania, Rwanda agree standard gauge railway link', 'Uganda is expected to join the project later.'],
    ['Kigali and Dar es Salaam traders cut trucking costs', 'Rwanda and Tanzania customs share cargo data; transport times fell.'],
    ['Rwanda and Tanzania presidents meet at regional summit to discuss trade', 'The two East African neighbours discussed transport.'],
  ])('DIRECT: "%s"', (title, summary) => {
    expect(relationshipEvidenceClass({ title, summary }, SCOPE)).toBe('DIRECT');
  });
  it.each([
    ['EAC partner states agree new customs rules', 'Tanzania and Rwanda traders, with Kenya and Burundi, will see trade costs fall.'],
    ['Tanzania, Rwanda and Uganda in new transport deal', 'The three countries signed a trade pact.'],
  ])('REGIONAL_CONTEXT: "%s"', (title, summary) => {
    expect(relationshipEvidenceClass({ title, summary }, SCOPE)).toBe('REGIONAL_CONTEXT');
  });
  it('NONE: one-sided, or both sides without the relation', () => {
    expect(relationshipEvidenceClass({ title: 'Tanzania port volumes rise', summary: 'Dar es Salaam trade grew.' }, SCOPE)).toBe('NONE');
    expect(relationshipEvidenceClass({ title: 'Rwanda and Tanzania football teams draw', summary: '' }, SCOPE)).toBe('NONE');
  });
});

/* ── B + C + D through the real analysis service ─────────────────────────── */
function article(id: string, title: string, summary = ''): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://example.org/${id}`,
    sourceId: 'wire',
    sourceName: 'Regional Wire',
    category: 'business',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    publishedAtBasis: 'publisher',
  } as NewsArticle;
}
function response(articles: NewsArticle[], providers: string[], failures: Array<{ providerId: string; kind: string }> = []): NewsResponse {
  const value = {
    articles,
    totalResults: articles.length,
    providers,
    dataMode: 'live',
    generatedAt: new Date().toISOString(),
  } as NewsResponse;
  return failures.length === 0 ? value : attachProviderFailures(value, failures as never);
}

function harness(
  supplement: NewsArticle[],
  perSide: Record<string, NewsArticle[]> = {},
  perSideFailures: Array<{ providerId: string; kind: string }> = [],
  supplementFailures: Array<{ providerId: string; kind: string }> = [
    { providerId: 'gnews', kind: 'rate-limited' },
    { providerId: 'gdelt-doc', kind: 'rate-limited' },
  ],
) {
  const search = jest.fn(async (term: string) => {
    const both = /tanzania/i.test(term) && /rwanda/i.test(term);
    if (both)
      /* the supplement: GNews refused (429) after the first search; GDELT 429; feeds answered */
      return response(supplement, ['rss-feeds'], supplementFailures);
    const side = Object.keys(perSide).find((name) => new RegExp(name, 'i').test(term));
    return response(side === undefined ? [] : perSide[side], ['gnews', 'rss-feeds'], perSideFailures);
  });
  const news = {
    search,
    topHeadlines: jest.fn(async () => response([], ['gnews'])),
    findArticleById: jest.fn(async () => undefined),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
  };
  const inputs: AnalysisProviderInput[] = [];
  const analyzeNews = jest.fn(async (input: AnalysisProviderInput) => {
    inputs.push(input);
    return new MockAnalysisProvider().analyzeNews(input);
  });
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: 60000,
      cacheTtlSeconds: 0,
      openAiModel: 'test',
      executionMode: 'development',
      retryAttempts: 0,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    news as never,
    { getCountryNews: jest.fn() } as never,
    { id: 'test', displayName: 'Test', isMock: true, analyzeNews },
    config,
  );
  return { service, inputs, search, analyzeNews };
}
const now = Date.now();
const policy = {
  relationship: { countries: ['TZA', 'RWA'], relations: ['TRADE', 'TRANSPORT'] as never },
  questionAnchors: questionAnchorsOf(PO_QUESTION),
  reportingWindow: {
    statedPeriod: 'the past 30 days',
    from: new Date(now - 30 * 86_400_000).toISOString(),
    to: new Date(now + 60_000).toISOString(),
  },
};
const ask = (h: ReturnType<typeof harness>) =>
  h.service.analyzeNews(PO_QUESTION, 'en', undefined, undefined, undefined, undefined, policy as never);

/* a regional item that LEADS with one side, so per-side retrieval keeps it for the relationship check */
const REGIONAL_TZ = () =>
  article(
    'tz-china',
    'Tanzania joins China market-access programme for East African exporters',
    'Firms from Rwanda, Kenya and Uganda are also eligible as trade and logistics links grow, organisers said.',
  );

describe('B + C + D · the live shape through the analysis service', () => {
  it('fixture sanity: the PO question is a gated, linked TZA+RWA anchor set', () => {
    expect(policy.questionAnchors.gated).toBe(true);
  });

  it('zero direct bilateral evidence + one regional item from the supplement: NOTHING admitted, no model call', async () => {
    const h = harness([article('china', CHINA_PROGRAMME.title, CHINA_PROGRAMME.summary)]);
    const out = await ask(h);
    expect(h.analyzeNews).not.toHaveBeenCalled();
    expect(out.articles).toEqual([]);
    const ctx = out.retrievalContext!;
    /* D — counts describe the evidence actually admitted */
    expect(ctx.articlesRetrieved).toBe(0);
    expect(ctx.questionAnchorGate?.admitted).toBe(0);
    expect(ctx.retrievalTrace?.candidatesAdmitted).toBe(0);
    /* D — the supplement's refusals are visible; a contacted provider is not "checked" */
    const unavailable = (ctx.retrievalTrace?.lanesUnavailable ?? []).map((u) => u.lane);
    expect(unavailable).toEqual(expect.arrayContaining(['gnews', 'gdelt-doc']));
    expect(ctx.retrievalTrace?.lanesSucceeded).not.toContain('gnews');
    expect(ctx.retrievalTrace?.lanesSucceeded).not.toContain('gdelt-doc');
    /* C — an open question carries no claims: the notice is about coverage, not "this claim" */
    expect(ctx.claimAssessments ?? []).toEqual([]);
    expect(ctx.verificationNotice).toBe('COVERAGE_INCOMPLETE');
  });

  it('the relationship branch itself admits no regional item (per-side retrieval returned it)', async () => {
    const h = harness([], { Tanzania: [REGIONAL_TZ()] });
    const out = await ask(h);
    expect(out.articles).toEqual([]);
    expect(out.retrievalContext?.relationshipEvidence?.admitted ?? 0).toBe(0);
  });

  it('without question anchors (relationship scope only) the branch still admits no regional item', async () => {
    const h = harness([], { Tanzania: [REGIONAL_TZ()] });
    const { questionAnchors: _drop, ...relationshipOnly } = policy;
    void _drop;
    const out = await h.service.analyzeNews(PO_QUESTION, 'en', undefined, undefined, undefined, undefined, relationshipOnly as never);
    expect(out.articles).toEqual([]);
    expect(out.retrievalContext?.relationshipEvidence?.admitted).toBe(0);
  });

  it('genuine direct bilateral evidence from the supplement is admitted (nothing genuine is suppressed); counts agree', async () => {
    const direct = article('rusumo', 'Rwanda and Tanzania ease cargo checks at Rusumo border', 'Truck traders welcome faster customs clearance and lower transport costs.');
    const h = harness([direct, article('china', CHINA_PROGRAMME.title, CHINA_PROGRAMME.summary)]);
    const out = await ask(h);
    expect(h.inputs[0]?.articles.map((a) => a.id)).toEqual(['rusumo']);
    const ctx = out.retrievalContext!;
    expect(ctx.articlesRetrieved).toBe(1);
    expect(ctx.questionAnchorGate?.admitted).toBe(1);
    expect(ctx.retrievalTrace?.candidatesAdmitted).toBe(1);
    expect(ctx.outcome).not.toBe('NO_RELEVANT_EVIDENCE');
  });

  it('E · the window instruction the model receives says an announcement is not an observed change', async () => {
    const h = harness([article('rusumo', 'Rwanda and Tanzania ease cargo checks at Rusumo border', 'Truck traders welcome faster customs clearance and lower transport costs.')]);
    await ask(h);
    expect(buildReportingWindowInstruction(policy.reportingWindow)).toMatch(
      /announced, planned or scheduled .* is NOT a change that happened/,
    );
  });

  it('NO-EVIDENCE PRESENTATION R1 · a lane refused during per-side retrieval is named unavailable, never "checked"; the lanes that answered stay checked', async () => {
    const h = harness([], {}, [{ providerId: 'gdelt-doc', kind: 'unavailable' }], []);
    const out = await ask(h);
    expect(h.analyzeNews).not.toHaveBeenCalled();
    const t = out.retrievalContext!.retrievalTrace!;
    expect(t.lanesUnavailable.map((u) => u.lane)).toContain('gdelt-doc');
    expect(t.lanesSucceeded).not.toContain('gdelt-doc');
    expect(t.lanesSucceeded).toEqual(expect.arrayContaining(['rss-feeds']));
    expect(out.retrievalContext!.providerFailures?.map((f) => f.providerId)).toContain('gdelt-doc');
  });
});
