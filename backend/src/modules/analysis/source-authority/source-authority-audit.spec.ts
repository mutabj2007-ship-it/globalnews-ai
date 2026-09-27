import { Test } from '@nestjs/testing';
import { ANALYSIS_TOTAL_BUDGET_MS, normalizeQuery, type NewsArticle } from '@globalnews-ai/shared';

import { AnalysisService } from '../service/analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { classifyQueryIntent } from '../query/query-intent.util';
import { clusterDuplicateArticles } from '../duplicates/cluster-articles.util';
import { normalizeArticlesForPrompt } from '../prompt/build-analysis-prompt.util';
import { NewsService } from '../../news/news.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import type { NewsProvider, NewsProviderCapability } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * RETRIEVAL SOURCE AUTHORITY AUDIT R1 — NON-PRODUCTION FIXTURES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Kept inside this spec file on purpose: tsconfig.build excludes *spec.ts, so
 * none of this can reach the production build.
 *
 * Each fixture is a pair (or set) of records about ONE institutional act:
 *
 *   PRIMARY   — the institution's own record of what it adopted, published,
 *               decided, measured or enacted, titled the way institutions
 *               actually title their own releases.
 *   SECONDARY — independent reporting, commentary or an aggregator copy of the
 *               same act, titled the way newsrooms title them: in the words a
 *               reader would type.
 *
 * The texts are written for this audit (not captured from live providers), so
 * the regression suite never depends on a provider response. The headline
 * patterns are the real ones: ECB releases are titled "Monetary policy
 * decisions", Statistics Poland's are "Flash estimate of consumer price
 * index…", the IPCC's are "Climate Change 2023: Synthesis Report", and the
 * Council announced the AI Act as "Artificial Intelligence Act: Council gives
 * final green light…". Hosts are illustrative.
 *
 * NOTHING HERE ASSERTS THAT THE PRIMARY RECORD IS TRUE. The audit's model is
 * that for a question about what an institution itself did, the institution's
 * own record is the most DIRECT evidence of that act, and independent
 * reporting stays necessary for interpretation, impact and disagreement.
 */

let sequence = 0;

function record(
  overrides: Partial<NewsArticle> & Pick<NewsArticle, 'title' | 'summary' | 'url' | 'sourceName'>,
): NewsArticle {
  sequence += 1;
  return {
    id: overrides.id ?? `audit-${sequence}`,
    sourceId: overrides.sourceId ?? overrides.sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-20T10:00:00.000Z',
    publishedAtBasis: 'publisher',
    providerId: 'gnews',
    ...overrides,
  } as NewsArticle;
}

/** Hours after the fixed reference instant, as ISO-8601. */
const at = (hours: number): string =>
  new Date(Date.parse('2026-09-20T10:00:00.000Z') + hours * 3_600_000).toISOString();

/* ─────────────────────────── 1 · EU AI regulation ─────────────────────────── */

const AI_ACT_COUNCIL_ADOPTION = record({
  id: 'eu-council-ai-act',
  title:
    'Artificial Intelligence Act: Council gives final green light to the first worldwide rules on AI',
  summary:
    'The Council adopted the regulation laying down harmonised rules on artificial intelligence, ' +
    'following a risk-based approach.',
  url: 'https://www.consilium.europa.eu/en/press/press-releases/2024/05/21/artificial-intelligence-ai-act/',
  sourceName: 'Council of the EU',
  publishedAt: at(0),
});

const AI_ACT_OFFICIAL_JOURNAL = record({
  id: 'eu-oj-ai-act',
  title: 'Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence',
  summary: 'Official Journal of the European Union. Artificial Intelligence Act.',
  url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
  sourceName: 'EUR-Lex',
  publishedAt: at(-72),
});

const AI_ACT_COMMISSION_ENTRY_INTO_FORCE = record({
  id: 'eu-commission-ai-act-in-force',
  title: 'AI Act enters into force',
  summary: 'European Commission: the European Artificial Intelligence Act enters into force today.',
  url: 'https://commission.europa.eu/news/ai-act-enters-force',
  sourceName: 'European Commission',
  publishedAt: at(1),
});

const AI_ACT_OPINION = record({
  id: 'ai-act-opinion',
  title: 'Opinion: The EU AI Act will stifle European startups',
  summary: 'Critics say the new rules on AI go too far and will push founders abroad.',
  url: 'https://commentary.example/opinion/eu-ai-act-stifles-startups',
  sourceName: 'Tech Commentary Weekly',
  publishedAt: at(3),
});

const AI_ACT_AGGREGATOR_EXPLAINER = record({
  id: 'ai-act-aggregator',
  title: 'EU AI regulation explained: what changes for business',
  summary: 'An explainer of the EU AI regulation compiled from wire reports.',
  url: 'https://aggregator.example/eu-ai-regulation-explained',
  sourceName: 'NewsRoundup',
  publishedAt: at(4),
});

/* ─────────────────────── 2 · ECB interest-rate decision ────────────────────── */

const ECB_PRESS_RELEASE = record({
  id: 'ecb-mpd',
  title: 'Monetary policy decisions',
  summary:
    'The Governing Council today decided to raise the three key ECB interest rates by 25 basis points.',
  url: 'https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260920.en.html',
  sourceName: 'European Central Bank',
  publishedAt: at(0),
});

const ECB_MARKETS_REACTION = record({
  id: 'ecb-markets-reaction',
  title: 'ECB interest rate decision: markets react',
  summary: 'Markets reacted to the ECB interest rate decision with a sell-off in bonds.',
  url: 'https://markets.example/ecb-interest-rate-decision-markets-react',
  sourceName: 'Markets Daily',
  publishedAt: at(2),
});

/* ──────────────────── 3 · Legislation / parliamentary bill ─────────────────── */

const BILL_ROYAL_ASSENT = record({
  id: 'bill-royal-assent',
  title: 'Online Safety Act 2023 receives Royal Assent',
  summary:
    'The Online Safety Bill completed its passage through Parliament and received Royal Assent.',
  url: 'https://bills.parliament.uk/bills/3137',
  sourceName: 'UK Parliament',
  publishedAt: at(0),
});

const BILL_CAMPAIGN_REPORTING = record({
  id: 'bill-campaign',
  title: 'Online Safety Bill status: campaigners criticise delays',
  summary: 'Campaigners criticised the Online Safety Bill and its implementation timetable.',
  url: 'https://news.example/online-safety-bill-status',
  sourceName: 'General News',
  publishedAt: at(2),
});

/* ───────────────────── 4 · Government statistical release ─────────────────── */

const STATS_FLASH_CPI = record({
  id: 'gus-flash-cpi',
  title: 'Flash estimate of consumer price index in August 2026',
  summary:
    'Statistics Poland: prices of consumer goods and services increased by 2.9% year on year.',
  url: 'https://stat.gov.pl/en/topics/prices-trade/price-indices/flash-estimate-aug-2026,1,1.html',
  sourceId: 'feed:gus-pl',
  sourceName: 'Statistics Poland',
  providerId: 'rss-feeds',
  publishedAt: at(0),
});

const STATS_NEWSROOM = record({
  id: 'pl-inflation-newsroom',
  title: 'Polish inflation figures surprise economists',
  summary: 'Polish inflation figures came in above forecasts, economists said.',
  url: 'https://news.example/polish-inflation-figures-surprise',
  sourceName: 'General News',
  publishedAt: at(1),
});

/* ─────────────────────── 5 · Central-bank decision (Fed) ───────────────────── */

const FED_STATEMENT = record({
  id: 'fed-fomc',
  title: 'Federal Reserve issues FOMC statement',
  summary: 'The Committee decided to lower the target range for the federal funds rate.',
  url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260920a.htm',
  sourceName: 'Federal Reserve',
  publishedAt: at(0),
});

const FED_NEWSROOM = record({
  id: 'fed-newsroom',
  title: 'Fed cuts rates, stocks rally',
  summary: 'The Fed cut rates by a quarter point and stocks rallied.',
  url: 'https://news.example/fed-cuts-rates',
  sourceName: 'General News',
  publishedAt: at(1),
});

/* ──────────────────── 6 · Intergovernmental report (IPCC) ──────────────────── */

const IPCC_SYNTHESIS = record({
  id: 'ipcc-syr',
  title: 'Climate Change 2023: Synthesis Report',
  summary: 'IPCC AR6 Synthesis Report, Summary for Policymakers.',
  url: 'https://www.ipcc.ch/report/ar6/syr/',
  sourceName: 'IPCC',
  publishedAt: at(0),
});

const IPCC_REACTION = record({
  id: 'ipcc-reaction',
  title: 'IPCC report: world off track on climate, experts react',
  summary: 'Scientists and campaigners reacted to the IPCC report.',
  url: 'https://news.example/ipcc-report-experts-react',
  sourceName: 'General News',
  publishedAt: at(2),
});

/* ──────────── Shared-headline set: a primary record and its echoes ─────────── */

/** An official statistical release whose headline ALSO reads the way a reader asks. */
const EUROSTAT_FLASH = record({
  id: 'eurostat-flash',
  title: 'Euro area annual inflation down to 2.1%',
  summary:
    'Eurostat flash estimate: euro area annual inflation is expected to be 2.1% in August 2026.',
  url: 'https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-01092026-ap',
  sourceName: 'Eurostat',
  publishedAt: at(0),
});

/** The same release republished by an aggregator three hours later, brand appended. */
const EUROSTAT_AGGREGATOR_COPY = record({
  id: 'eurostat-aggregator-copy',
  title: 'Euro area annual inflation down to 2.1% | NewsRoundup',
  summary:
    'Euro area annual inflation is expected to be 2.1% in August 2026, according to reports.',
  url: 'https://aggregator.example/2026/09/euro-area-annual-inflation-down',
  sourceName: 'NewsRoundup',
  publishedAt: at(3),
});

/** Eight distinct, newer, independent pieces on the same subject. */
const EURO_INFLATION_COMMENTARY = [
  'Euro area inflation cools as energy prices fall',
  'Why euro area inflation matters for your mortgage',
  'Economists split over what euro area inflation means for rates',
  'Euro area inflation: retailers brace for a slower autumn',
  'Opinion: euro area inflation is not beaten yet',
  'Euro area inflation lowest since 2021, traders bet on cuts',
  'Southern Europe leads euro area inflation slowdown',
  'Euro area inflation data lifts bonds across the bloc',
].map((title, index) =>
  record({
    id: `euro-commentary-${index + 1}`,
    title,
    summary: `${title}. Reporting and analysis of the latest figures.`,
    url: `https://news.example/euro-area-inflation-${index + 1}`,
    sourceName: `Outlet ${index + 1}`,
    publishedAt: at(4 + index),
  }),
);

/**
 * ════════════════════════════════════════════════════════════════════════════
 * RETRIEVAL SOURCE AUTHORITY AUDIT R1 — CHARACTERIZATION SUITE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * These tests PIN THE CURRENT BEHAVIOUR of the retrieval path, deterministically
 * and offline: real NewsService, real AnalysisService, stub news providers, a
 * mock analysis provider that only records what it would have been shown. No
 * live provider, no AI call.
 *
 * Every test named "DEFECT Dn" passes TODAY because the defect exists. It is the
 * proof of the defect path documented in
 * docs/retrieval-source-authority-audit-r1.md, and the implementation lane that
 * corrects Dn is expected to INVERT that test's assertion, not delete it.
 * Tests named "INVARIANT" must keep passing through any correction.
 */

/* ───────────────────────────── harness ───────────────────────────── */

function stubProvider(
  id: string,
  articles: NewsArticle[],
  capabilities?: readonly NewsProviderCapability[],
): NewsProvider & { calls: number; queries: string[] } {
  const provider = {
    id,
    displayName: id,
    isMock: false,
    calls: 0,
    queries: [] as string[],
    ...(capabilities === undefined ? {} : { capabilities }),
    async search(query: string): Promise<NewsArticle[]> {
      provider.calls += 1;
      provider.queries.push(query);
      return articles.map((article) => ({ ...article, providerId: id }));
    },
    async topHeadlines(): Promise<NewsArticle[]> {
      provider.calls += 1;
      return articles.map((article) => ({ ...article, providerId: id }));
    },
    async category(): Promise<NewsArticle[]> {
      provider.calls += 1;
      return [];
    },
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: at(0) };
    },
  };
  return provider as NewsProvider & { calls: number; queries: string[] };
}

async function buildNewsService(
  primaries: NewsProvider[],
  fallbacks: NewsProvider[] = [],
): Promise<NewsService> {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };
  const active = [...primaries, ...fallbacks];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: active },
      { provide: ALL_NEWS_PROVIDERS, useValue: active },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbacks },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  return moduleRef.get(NewsService);
}

function configService(): AnalysisConfigService {
  const config = {
    maxArticles: 8,
    maxArticleChars: 1200,
    timeoutMs: 20000,
    totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
    cacheTtlSeconds: 300,
    openAiApiKey: undefined,
    openAiModel: 'gpt-4o-mini',
    executionMode: 'development' as const,
    retryAttempts: 0,
    retryBaseDelayMs: 0,
    maxCompletionTokens: 2000,
  };
  return { get: () => config } as unknown as AnalysisConfigService;
}

/**
 * Runs one explicit analysis end to end and returns exactly the evidence the
 * model would have received (ids, in prompt order). The model is never called
 * for real: the mock records its input and returns nothing usable.
 */
async function evidenceSentToModel(
  question: string,
  providerArticles: NewsArticle[],
  priorQuestion?: string,
): Promise<{ ids: string[]; articles: NewsArticle[]; modelCalls: number }> {
  const newsService = await buildNewsService([stubProvider('gnews', providerArticles)]);
  const inputs: AnalysisProviderInput[] = [];
  const provider: AnalysisProvider = {
    id: 'audit-recorder',
    displayName: 'Audit recorder',
    isMock: true,
    analyzeNews: jest.fn(async (input: AnalysisProviderInput) => {
      inputs.push(input);
      return null;
    }),
  };
  const countryNewsService = { getCountryNews: jest.fn() };
  const service = new AnalysisService(
    newsService,
    countryNewsService as never,
    provider,
    configService(),
  );
  await service.analyzeNews(question, 'en', undefined, priorQuestion);
  const articles = inputs[0]?.articles ?? [];
  return { ids: articles.map((article) => article.id), articles, modelCalls: inputs.length };
}

const admits = (article: NewsArticle, phrase: string): boolean =>
  scoreGenericRelevance(article, phrase).isRelevant;

/* ─────────────── §1 · query classes reach no authority-aware route ─────────────── */

describe('§1 query classification — DEFECT D6: no route for institutional-fact questions', () => {
  it.each([
    ['EU AI regulation / AI Act', 'Explain the new EU AI regulation', 'EXPLANATION'],
    ['EU AI regulation / AI Act', 'What does the EU AI Act require?', 'CURRENT_EVENT'],
    ['ECB interest-rate decision', 'Did the ECB raise interest rates?', 'CURRENT_EVENT'],
    ['legislation / bill status', 'What is the status of the Online Safety Bill?', 'EXPLANATION'],
    ['statistical release', 'Polish inflation figures', 'GEOGRAPHIC_REGIONAL'],
    ['central-bank decision', 'Did the Fed cut rates?', 'CURRENT_EVENT'],
    ['intergovernmental report', 'What did the IPCC report say?', 'CURRENT_EVENT'],
  ])(
    '%s — "%s" is classified %s, an intent with no notion of a primary record',
    (_c, q, intent) => {
      expect(classifyQueryIntent(normalizeQuery(q).normalizedQuery).intent).toBe(intent);
    },
  );
});

/* ─────────────── §2 · the lexical relevance gate (unit, per class) ─────────────── */

describe('§2 relevance gate — DEFECT D1: the institution’s own record fails the gate its echoes pass', () => {
  /*
   * scoreGenericRelevance is the admission rule every search-based branch uses.
   * It admits on the READER's words appearing in the headline (or one
   * headline-anchored summary sentence). Institutions title their own records
   * institutionally; newsrooms, commentators and aggregators title theirs in
   * the reader's words. So for the same act, the secondary record is admitted
   * and the primary record is refused — before any ranking exists to prefer it.
   */
  it.each([
    ['EU AI regulation', 'EU AI regulation', AI_ACT_COUNCIL_ADOPTION, AI_ACT_OPINION],
    [
      'EU AI regulation (Commission)',
      'EU AI regulation',
      AI_ACT_COMMISSION_ENTRY_INTO_FORCE,
      AI_ACT_AGGREGATOR_EXPLAINER,
    ],
    ['ECB rate decision', 'ECB interest rate decision', ECB_PRESS_RELEASE, ECB_MARKETS_REACTION],
    ['bill status', 'Online Safety Bill status', BILL_ROYAL_ASSENT, BILL_CAMPAIGN_REPORTING],
    ['statistical release', 'Polish inflation figures', STATS_FLASH_CPI, STATS_NEWSROOM],
    ['central-bank decision', 'Fed cuts rates', FED_STATEMENT, FED_NEWSROOM],
  ])('%s — primary refused, secondary admitted for "%s"', (_c, phrase, primary, secondary) => {
    expect(admits(primary, phrase)).toBe(false);
    expect(admits(secondary, phrase)).toBe(true);
  });

  it('COUNTER-EXAMPLE — IPCC: for "IPCC report" the Synthesis Report IS admitted (institution named in its own summary); the gate is not the loss point for this class, ordering is (§3, §5)', () => {
    expect(admits(IPCC_SYNTHESIS, 'IPCC report')).toBe(true);
    expect(admits(IPCC_REACTION, 'IPCC report')).toBe(true);
    expect(admits(IPCC_SYNTHESIS, 'What did the IPCC report say')).toBe(false);
  });

  it('INVARIANT — an institutional record whose headline happens to carry the reader’s words is admitted (the gate is lexical, not anti-official)', () => {
    expect(admits(AI_ACT_OFFICIAL_JOURNAL, 'EU AI regulation')).toBe(true);
    expect(admits(EUROSTAT_FLASH, 'euro area inflation')).toBe(true);
  });

  it('DEFECT D1b — question-form retrieval admits NEITHER record (whole question used as the phrase)', () => {
    for (const [phrase, records] of [
      ['Did the ECB raise interest rates', [ECB_PRESS_RELEASE, ECB_MARKETS_REACTION]],
      ['What did the IPCC report say', [IPCC_SYNTHESIS, IPCC_REACTION]],
      ['What does the EU AI Act require', [AI_ACT_COUNCIL_ADOPTION, AI_ACT_OPINION]],
    ] as const) {
      for (const article of records) expect(admits(article, phrase)).toBe(false);
    }
  });
});

/* ───────────── §3 · end to end: what the model is actually shown ───────────── */

describe('§3 end to end — the EU AI regulation case, reproduced offline', () => {
  const ALL_AI_ACT = [
    AI_ACT_COUNCIL_ADOPTION,
    AI_ACT_OFFICIAL_JOURNAL,
    AI_ACT_COMMISSION_ENTRY_INTO_FORCE,
    AI_ACT_OPINION,
    AI_ACT_AGGREGATOR_EXPLAINER,
  ];

  it('DEFECT D1 — "Explain the new EU AI regulation": the Council adoption and Commission entry-into-force records are retrieved but never reach the model; opinion and aggregator do', async () => {
    const { ids, modelCalls } = await evidenceSentToModel(
      'Explain the new EU AI regulation',
      ALL_AI_ACT,
    );

    expect(modelCalls).toBe(1);
    expect(ids).toContain(AI_ACT_OPINION.id);
    expect(ids).toContain(AI_ACT_AGGREGATOR_EXPLAINER.id);
    expect(ids).not.toContain(AI_ACT_COUNCIL_ADOPTION.id);
    expect(ids).not.toContain(AI_ACT_COMMISSION_ENTRY_INTO_FORCE.id);
  });

  it('DEFECT D2 — the surviving evidence is ordered by recency only: newest commentary leads, the Official Journal text comes last', async () => {
    const { ids } = await evidenceSentToModel('Explain the new EU AI regulation', ALL_AI_ACT);
    expect(ids[0]).toBe(AI_ACT_AGGREGATOR_EXPLAINER.id);
    expect(ids[ids.length - 1]).toBe(AI_ACT_OFFICIAL_JOURNAL.id);
  });

  it('DEFECT D1 — ECB: the Governing Council’s own decision is refused; the markets reaction is the whole evidence', async () => {
    const { ids } = await evidenceSentToModel('ECB interest rate decision', [
      ECB_PRESS_RELEASE,
      ECB_MARKETS_REACTION,
    ]);
    expect(ids).toEqual([ECB_MARKETS_REACTION.id]);
  });

  it('DEFECT D1b — "Did the ECB raise interest rates?" retrieves nothing admissible and spends no model call', async () => {
    const { ids, modelCalls } = await evidenceSentToModel('Did the ECB raise interest rates?', [
      ECB_PRESS_RELEASE,
      ECB_MARKETS_REACTION,
    ]);
    expect(ids).toEqual([]);
    expect(modelCalls).toBe(0);
  });

  it('DEFECT D5 — nothing the model receives says who is speaking: no authority field is populated and the prompt item has no slot for one', async () => {
    const { articles } = await evidenceSentToModel('Explain the new EU AI regulation', ALL_AI_ACT);
    for (const article of articles) {
      expect(article.sourceAuthorityClass).toBeUndefined();
      expect(article.evidencePrecision).toBeUndefined();
    }
    const [official, opinion] = normalizeArticlesForPrompt(
      [AI_ACT_OFFICIAL_JOURNAL, AI_ACT_OPINION],
      1200,
    );
    expect(Object.keys(official).sort()).toEqual(Object.keys(opinion).sort());
    expect(Object.keys(official).sort()).toEqual(
      ['evidenceId', 'publishedAt', 'publishedAtBasis', 'sourceName', 'summary', 'title'].sort(),
    );
  });

  it('INVARIANT — competing reporting is preserved: the dissenting opinion is not suppressed when an official record is present', async () => {
    const { ids } = await evidenceSentToModel('Explain the new EU AI regulation', ALL_AI_ACT);
    expect(ids).toContain(AI_ACT_OFFICIAL_JOURNAL.id);
    expect(ids).toContain(AI_ACT_OPINION.id);
  });
});

/* ─────────── §4 · duplicate collapse keeps the weaker copy ─────────── */

describe('§4 duplicate collapse — DEFECT D3: the republication survives, the original is dropped', () => {
  it('unit — clusterDuplicateArticles keeps whichever copy is first, and recency order puts the later republication first', () => {
    const recencyOrdered = [EUROSTAT_AGGREGATOR_COPY, EUROSTAT_FLASH];
    expect(clusterDuplicateArticles(recencyOrdered).map((a) => a.id)).toEqual([
      EUROSTAT_AGGREGATOR_COPY.id,
    ]);
  });

  it('end to end — the model receives the aggregator’s copy of the Eurostat release, not Eurostat’s', async () => {
    const { ids } = await evidenceSentToModel('euro area inflation', [
      EUROSTAT_FLASH,
      EUROSTAT_AGGREGATOR_COPY,
    ]);
    expect(ids).toEqual([EUROSTAT_AGGREGATOR_COPY.id]);
  });
});

/* ─────────── §5 · caps drop stronger evidence by position alone ─────────── */

describe('§5 caps — DEFECT D4: position, not evidence, decides what survives', () => {
  it('analysis cap (maxArticles = 8) — eight newer commentary pieces push the primary release out', async () => {
    const { ids } = await evidenceSentToModel('euro area inflation', [
      EUROSTAT_FLASH,
      ...EURO_INFLATION_COMMENTARY,
    ]);
    expect(ids).toHaveLength(8);
    expect(ids).not.toContain(EUROSTAT_FLASH.id);
  });

  it('news cap before gate — NewsService.search slices to `limit` by recency BEFORE the relevance gate, so an older relevant primary record is never scored', async () => {
    const offTopic = Array.from({ length: 20 }, (_, index) =>
      record({
        id: `off-topic-${index}`,
        title: `Unrelated sports result number ${index}`,
        summary: 'Nothing to do with prices.',
        url: `https://sport.example/${index}`,
        sourceName: 'Sport Desk',
        publishedAt: at(10 + index),
      }),
    );
    const newsService = await buildNewsService([
      stubProvider('gnews', [EUROSTAT_FLASH, ...offTopic]),
    ]);

    const response = await newsService.search('euro area inflation', 20, { type: 'generic' });

    expect(admits(EUROSTAT_FLASH, 'euro area inflation')).toBe(true);
    expect(response.articles.map((a) => a.id)).not.toContain(EUROSTAT_FLASH.id);
  });
});

/* ─────────── §6 · provider tier and registration order decide authority ─────────── */

describe('§6 provider order — DEFECT D7: official feeds are reachable only when the primary tier is empty, and lose ties by registration order', () => {
  const GUS_RELEASE = record({
    id: 'gus-release',
    title: 'Consumer prices: Polish inflation figures for August 2026',
    summary: 'Statistics Poland published the Polish inflation figures for August 2026.',
    url: 'https://stat.gov.pl/en/topics/prices-trade/cpi-aug-2026,1,2.html',
    sourceId: 'feed:gus-pl',
    sourceName: 'Statistics Poland',
  });
  const NEWSROOM = record({
    id: 'pl-newsroom',
    title: 'Polish inflation figures surprise economists',
    summary: 'Polish inflation figures came in above forecasts.',
    url: 'https://news.example/pl-inflation',
    sourceName: 'General News',
    publishedAt: at(1),
  });

  it('the official feed (fallback tier) is never asked when the primary tier returns any relevant article', async () => {
    const gnews = stubProvider('gnews', [NEWSROOM]);
    const feeds = stubProvider('rss-feeds', [GUS_RELEASE], ['search']);
    const newsService = await buildNewsService([gnews], [feeds]);

    const response = await newsService.search('Polish inflation figures', 20, { type: 'generic' });

    expect(feeds.calls).toBe(0);
    expect(response.articles.map((a) => a.id)).toEqual([NEWSROOM.id]);
  });

  it('when both fallback providers carry the same release, GDELT’s copy wins purely by registration order', async () => {
    const gdeltCopy = {
      ...GUS_RELEASE,
      id: 'gdelt-copy',
      url: 'https://portal.example/gus-cpi',
      sourceId: 'portal-example',
      sourceName: 'portal.example',
    };
    const gnews = stubProvider('gnews', []);
    const gdelt = stubProvider('gdelt-doc', [gdeltCopy], ['search']);
    const feeds = stubProvider('rss-feeds', [GUS_RELEASE], ['search']);
    const newsService = await buildNewsService([gnews], [gdelt, feeds]);

    const response = await newsService.search('Polish inflation figures', 20, { type: 'generic' });

    expect(response.articles.map((a) => a.id)).toEqual(['gdelt-copy']);
  });
});

/* ─────────── §7 · Ask and Search share one ranking ─────────── */

describe('§7 Ask vs Search — INVARIANT: one transport, one ranking', () => {
  it('a non-referential follow-up with a prior question (Ask) gets the same evidence, in the same order, as the bare question (Search)', async () => {
    const articles = [AI_ACT_OFFICIAL_JOURNAL, AI_ACT_OPINION, AI_ACT_AGGREGATOR_EXPLAINER];
    const search = await evidenceSentToModel('Explain the new EU AI regulation', articles);
    const ask = await evidenceSentToModel(
      'Explain the new EU AI regulation',
      articles,
      'What is happening with electricity prices?',
    );
    expect(ask.ids).toEqual(search.ids);
  });
});
