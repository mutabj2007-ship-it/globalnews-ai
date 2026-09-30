import { Test } from '@nestjs/testing';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { NewsService } from '../../news/news.service';
import type { NewsProvider } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { GdeltDocProviderError } from '../../news/providers/gdelt-doc.provider';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import {
  resolveCountryEconomyQuery,
  scoreCountryEconomyRelevance,
} from '../../news/relevance/country-economy-relevance.util';
import {
  deriveConversationSubject,
  deriveFollowUpFocus,
} from '../anchor/conversation-subject.util';
import { requestsDates } from '../query/response-directives.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — country + broad economy (CTO ruling), and the
 * continuation-subject correction. Offline; real AnalysisService + NewsService where stated.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * FIXTURE PROVENANCE (the Alpha 17:54Z candidates were never persisted and are not recoverable):
 *   [RETAINED-REAL]  public titles/summaries read from Alpha's Article table — Statistics Poland
 *                    releases persisted 2026-09-16/18, and the Poland rows of the 48 h window;
 *   [RECONSTRUCTED]  illustrative titles of the kind GNews / Wirtualna Polska return.
 */

function article(
  id: string,
  title: string,
  summary: string,
  sourceId: string,
  sourceName: string,
  url: string,
  extra: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id,
    title,
    summary,
    url,
    sourceId,
    sourceName,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher' as const,
    ...extra,
  };
}
const gus = (id: string, title: string, summary: string) =>
  article(
    id,
    title,
    summary,
    'feed:gus-pl',
    'Statistics Poland',
    `https://stat.gov.pl/en/topics/${id}.html`,
  );
const wp = (id: string, title: string, summary = '') =>
  article(
    id,
    title,
    summary,
    'feed:wp-pl',
    'Wirtualna Polska — Wiadomości',
    `https://wiadomosci.wp.pl/${id}`,
    {
      sourceLanguage: 'pl',
    },
  );
const wire = (id: string, title: string, summary = '', extra: Partial<NewsArticle> = {}) =>
  article(id, title, summary, 'gnews', 'Wire', `https://wire.example/${id}`, extra);

/* [RETAINED-REAL] Statistics Poland ECONOMIC releases — none names "Poland" in the title. */
const GUS_ECONOMIC = [
  gus(
    'cpi',
    'Consumer price indices in August 2026',
    'Consumer prices in August 2026 increased by 3.4% compared with the corresponding month of the previous year.',
  ),
  gus(
    'trade',
    'Foreign trade turnover of goods in total and by countries in January-July 2026',
    'In January-July 2026 foreign trade turnover in exports at current prices amounted to PLN 961.0 bn, while in imports to PLN 979.6 bn.',
  ),
  gus(
    'housing',
    'Housing economy in 2025',
    'In Poland as of the end of 2025 there were recorded almost 16.2 million dwellings.',
  ),
  gus(
    'tendency',
    'Business tendency. Voivodship report August 2026',
    'The publication presents the results of business tendency survey, indicating key trends and factors limiting activity of enterprises in various areas of the economy.',
  ),
  gus(
    'ppi',
    'Price indices of sold production of industry in August 2026',
    'According to preliminary data, the prices of sold production of industry in August 2026 increased both compared to August 2025 – by 4.2%, to the previous month – by 0.6%.',
  ),
];
/* [RETAINED-REAL] Statistics Poland releases that are NOT economy reporting — must stay rejected. */
const GUS_OTHER = [
  gus(
    'cattle',
    'Cattle population as of June 2026',
    'Cattle population in June 2026 reached 6 229.1 thousand heads and was higher by 1.3% compared to June of last year.',
  ),
  gus(
    'tourism',
    'Occupancy of tourist accommodation establishments in July and August 2026',
    'In July and August 2026, 10.0 million tourists stayed at tourist accommodations in Poland.',
  ),
  gus(
    'migration',
    'Internal migration of population for permanent residence by voivodships in 1974-2025',
    'The summary presents historical data on internal migration for permanent residence.',
  ),
  gus(
    'accidents',
    'Accidents at work in the first half of 2026 – preliminary data',
    '33,081 persons injured in accidents at work were reported in the first half of 2026.',
  ),
];
/* [RECONSTRUCTED] Polish-language general news from a verified own-country publisher. */
const WP_ECONOMIC = [
  wp('wp-econ', 'Polska gospodarka zwalnia. GUS podał nowe dane'),
  wp('wp-cpi', 'Inflacja we wrześniu. Ceny rosną wolniej'),
];
const WP_UNRELATED = [
  wp('wp-sport', 'Lewandowski strzelił dwa gole w meczu z Hiszpanią'),
  wp('wp-fire', 'Pożar hali magazynowej pod Krakowem. Strażacy walczą z ogniem'),
];
/* [RECONSTRUCTED] generic-provider economy coverage. */
const WIRE_ECONOMIC = [
  wire('w-polish', 'Polish economy expected to grow 3% next year, central bank says'),
  wire('w-economic', "Poland's economic growth slows as exports weaken"),
  wire('w-pl', 'Polska gospodarka rośnie szybciej niż oczekiwano', '', { sourceLanguage: 'pl' }),
];
/* [RETAINED-REAL] Poland named, economy absent — sport / security. */
const POLAND_OTHER = [
  wire('r-border', 'Poles brace for possible Russian attack on Poland border with Ukraine'),
  wire(
    'r-sport',
    'Why Is Robert Lewandowski Not Playing Today For Poland vs. Sweden in the UEFA Nations League Match?',
  ),
  wire(
    'r-tusk',
    "Tusk: Poland prepares for difficult months ahead amid Russia's growing aggression",
  ),
];

const ids = (articles: readonly { id: string }[]) => articles.map((a) => a.id).sort();

describe('R2 · the trigger is exactly "resolved country + broad economy"', () => {
  it.each([
    ["Poland's economy", 'POL'],
    ['Poland s economy', 'POL'],
    ['Polish economy', 'POL'],
    ['the economy of Poland', 'POL'],
    ['Polska gospodarka', 'POL'],
    ["Kenya's economy", 'KEN'],
  ])('%s → %s', (subject, iso3) => {
    expect(resolveCountryEconomyQuery(subject)?.iso3).toBe(iso3);
  });

  it.each([
    "Poland's energy sources",
    "Poland's economy this week",
    'inflation in Poland',
    'Poland and Germany economy',
    'the economy',
    'Poland',
    'gospodarka Polski' /* an inflected localized form the curated authority does not produce */,
  ])('%s → not this shape (unchanged generic gate)', (subject) => {
    expect(resolveCountryEconomyQuery(subject)).toBeUndefined();
  });
});

describe('R2 · both components, always — per candidate family', () => {
  const verdict = (a: NewsArticle) => scoreCountryEconomyRelevance(a, 'POL');

  it('Statistics Poland economic releases [RETAINED-REAL]: country from the VERIFIED own-country publisher, topic from the text', () => {
    for (const a of GUS_ECONOMIC) {
      /* the unchanged generic gate still rejects them … */
      expect(scoreGenericRelevance(a, 'Poland s economy').isRelevant).toBe(false);
      /* … and the bounded path admits them, for the right reasons */
      const v = verdict(a);
      expect(v.topic).toBe(true);
      expect(v.country === 'own-country-publisher' || v.country === 'named').toBe(true);
      expect(v.isRelevant).toBe(true);
    }
    expect(verdict(GUS_ECONOMIC[0]).country).toBe('own-country-publisher');
  });

  it('Statistics Poland non-economic releases [RETAINED-REAL]: publisher identity never satisfies the topic', () => {
    for (const a of GUS_OTHER) {
      const v = verdict(a);
      expect(v.topic).toBe(false);
      expect(v.isRelevant).toBe(false);
    }
  });

  it('generic providers: "Polish economy", "economic … Poland", Polish-language wording', () => {
    for (const a of WIRE_ECONOMIC) {
      const v = verdict(a);
      expect(v.country).toBe('named');
      expect(v.isRelevant).toBe(true);
    }
  });

  it('Polish-language economic wording from the verified own-country publisher', () => {
    for (const a of WP_ECONOMIC) expect(verdict(a).isRelevant).toBe(true);
  });

  it('a Polish publisher with an unrelated topic is rejected (country implied, topic absent)', () => {
    for (const a of WP_UNRELATED) {
      const v = verdict(a);
      expect(v.country).toBe('own-country-publisher');
      expect(v.topic).toBe(false);
      expect(v.isRelevant).toBe(false);
    }
  });

  it('Poland sport / security [RETAINED-REAL] stays rejected (country named, topic absent)', () => {
    for (const a of POLAND_OTHER) {
      const v = verdict(a);
      expect(v.country).toBe('named');
      expect(v.isRelevant).toBe(false);
    }
  });

  it('identity must VERIFY: a spoofed sourceId on another domain is not the publisher', () => {
    const spoof = { ...GUS_ECONOMIC[0], url: 'https://elsewhere.example/cpi' };
    expect(verdict(spoof).country).toBe('absent');
    expect(verdict(spoof).isRelevant).toBe(false);
  });

  it("another country's own publisher never satisfies Poland, and Poland's never satisfies Kenya", () => {
    const kenyan = article(
      'ke',
      'Inflation eases to 4.1% in September',
      '',
      'feed:cbk-ke',
      'Central Bank of Kenya',
      'https://www.centralbank.go.ke/ke',
    );
    expect(scoreCountryEconomyRelevance(kenyan, 'POL').isRelevant).toBe(false);
    expect(scoreCountryEconomyRelevance(kenyan, 'KEN').isRelevant).toBe(true);
    expect(scoreCountryEconomyRelevance(GUS_ECONOMIC[0], 'KEN').isRelevant).toBe(false);
  });
});

/* ── the full path, on the real services ─────────────────────────────────── */

type Stub = NewsProvider & { calls: string[] };
function provider(id: string, articles: NewsArticle[], failWith?: Error): Stub {
  const p = {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search'],
    calls: [] as string[],
    async search(query: string) {
      p.calls.push(query);
      if (failWith) throw failWith;
      return articles;
    },
    async topHeadlines() {
      return [];
    },
    async category() {
      return [];
    },
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' };
    },
  };
  return p as unknown as Stub;
}
const gdeltTimeout = () =>
  new GdeltDocProviderError('GDELT DOC request timed out.', undefined, 'timeout');

async function buildNews(
  primaries: NewsProvider[],
  fallbacks: NewsProvider[],
  retained: NewsArticle[] = [],
) {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue(retained),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
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

function analysisOver(news: NewsService) {
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  const model: AnalysisProvider = {
    id: 'openai',
    displayName: 'Fixture model (MockAnalysisProvider)',
    isMock: false,
    analyzeNews: async (input: AnalysisProviderInput) => {
      inputs.push(input);
      return mock.analyzeNews(input);
    },
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'fixture',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  return {
    service: new AnalysisService(news, { getCountryNews: jest.fn() } as never, model, config),
    inputs,
  };
}

const QUESTION = "What has changed in Poland's economy? Give the dates and cite the sources.";

describe('R2 · the Alpha question on the real services (6a379561 shape)', () => {
  it('admits the economic reporting, rejects the rest, keeps the instruction out of retrieval, and discloses the GDELT timeout', async () => {
    const gnews = provider('gnews', [...WIRE_ECONOMIC.slice(0, 2), ...POLAND_OTHER]);
    const feeds = provider('rss-feeds', [
      ...GUS_ECONOMIC,
      ...GUS_OTHER,
      ...WP_ECONOMIC,
      ...WP_UNRELATED,
    ]);
    const gdelt = provider('gdelt-doc', [], gdeltTimeout());
    const { service, inputs } = analysisOver(await buildNews([gnews], [feeds, gdelt]));

    const result = await service.analyzeNews(QUESTION, 'en');

    /* the original response-format instruction stays outside retrieval */
    expect(gnews.calls).toEqual(['Poland s economy']);
    for (const q of [...gnews.calls, ...feeds.calls])
      expect(q).not.toMatch(/give|cite|dates|sources/i);
    /* GNews answered with relevant economy coverage, so the rescue tier is not needed */
    expect(ids(result.articles)).toEqual(ids(WIRE_ECONOMIC.slice(0, 2)));
    expect(inputs).toHaveLength(1);
    /* the reader asked for dates → presentation flag set */
    expect(result.retrievalContext?.datesRequested).toBe(true);
  });

  it('when GNews has nothing relevant: feed economy reporting is admitted, non-economic feed items rejected, and the timeout stays DISCLOSED as degraded', async () => {
    const gnews = provider('gnews', POLAND_OTHER);
    const feeds = provider('rss-feeds', [
      ...GUS_ECONOMIC,
      ...GUS_OTHER,
      ...WP_ECONOMIC,
      ...WP_UNRELATED,
    ]);
    const gdelt = provider('gdelt-doc', [], gdeltTimeout());
    const { service, inputs } = analysisOver(await buildNews([gnews], [feeds, gdelt]));

    const result = await service.analyzeNews(QUESTION, 'en');

    /* Every answer item is admissible reporting (the existing evidence cap / clustering may keep
       fewer than all admitted items — that stage is unchanged). */
    const admissible = new Set(ids([...GUS_ECONOMIC, ...WP_ECONOMIC]));
    for (const id of ids(result.articles)) expect(admissible.has(id)).toBe(true);
    expect(result.articles.some((a) => a.sourceId === 'feed:gus-pl')).toBe(true);
    expect(result.articles.some((a) => a.sourceId === 'feed:wp-pl')).toBe(true);
    for (const a of [...GUS_OTHER, ...WP_UNRELATED, ...POLAND_OTHER]) {
      expect(result.articles.map((x) => x.id)).not.toContain(a.id);
    }
    expect(result.articles.length).toBeGreaterThan(0);
    expect(inputs).toHaveLength(1);
    /* not an unqualified "no matching reporting", and not a silent "live" either */
    expect(result.retrievalContext?.fallbackReason).toBe('provider-error');
    expect(result.retrievalContext?.evidenceState).toBe('degraded-fallback');
    expect(result.retrievalContext?.outcome).not.toBe('NO_RELEVANT_EVIDENCE');
  });

  it('with nothing admissible at all, the timeout still reads as a limited search (PROVIDER_UNAVAILABLE), never "no matching reporting"', async () => {
    const gnews = provider('gnews', POLAND_OTHER);
    const feeds = provider('rss-feeds', [...GUS_OTHER, ...WP_UNRELATED]);
    const gdelt = provider('gdelt-doc', [], gdeltTimeout());
    const { service, inputs } = analysisOver(await buildNews([gnews], [feeds, gdelt]));
    const result = await service.analyzeNews(QUESTION, 'en');
    expect(result.articles).toEqual([]);
    expect(inputs).toHaveLength(0);
    expect(result.retrievalContext?.outcome).toBe('PROVIDER_UNAVAILABLE');
    expect(result.retrievalContext?.evidenceState).toBe('degraded-fallback');
  });

  it('CONTROL: a subject outside the shape keeps the unchanged gate (Statistics Poland releases stay rejected)', async () => {
    const gnews = provider('gnews', []);
    const feeds = provider('rss-feeds', GUS_ECONOMIC);
    const { service } = analysisOver(await buildNews([gnews], [feeds]));
    const result = await service.analyzeNews("What are Poland's energy sources?", 'en');
    expect(result.articles).toEqual([]);
  });

  it('no dates flag when the reader did not ask for dates', async () => {
    const { service } = analysisOver(
      await buildNews([provider('gnews', WIRE_ECONOMIC.slice(0, 1))], []),
    );
    const result = await service.analyzeNews("What has changed in Poland's economy?", 'en');
    expect(result.retrievalContext?.datesRequested).toBeUndefined();
  });
});

describe('R2 · 8237863d — the continued subject is the clean subject; the focus is the reader’s phrase', () => {
  const PRIOR = 'What has changed in Kenya’s economy? Give the dates and cite the sources.';

  it('the prior question’s answer-format instruction never becomes the subject', () => {
    expect(deriveConversationSubject(PRIOR)).toBe('Kenya’s economy');
  });

  it('focus terms are unchanged; the display phrase keeps adjacent words together', () => {
    const focus = deriveFollowUpFocus(
      'How does this affect ordinary households?',
      'Kenya’s economy',
    );
    expect(focus.terms).toEqual(['ordinary', 'households']);
    expect(focus.phrases).toEqual(['ordinary households']);
    const split = deriveFollowUpFocus('What about consumers and prices?', 'inflation Poland');
    expect(split.phrases).toEqual(['consumers', 'prices']);
  });

  it('on the real services: subject, retrieval meaning and focus display are clean; no dates flag for the follow-up', async () => {
    const kenya = wire('ke-econ', "Kenya's economy slows as tax protests weigh on households", '');
    const gnews = provider('gnews', [kenya]);
    const { service } = analysisOver(await buildNews([gnews], []));
    const result = await service.analyzeNews(
      'How does this affect ordinary households?',
      'en',
      undefined,
      PRIOR,
    );
    const subject = result.retrievalContext?.conversationSubject;
    /* the question is normalised first (curly apostrophe → straight), as on every turn */
    expect(subject?.subject).toBe("Kenya's economy");
    expect(subject?.focusDisplay).toEqual(['ordinary households']);
    expect(subject?.retrievalMeaning).not.toMatch(/give|cite|dates|sources/i);
    for (const q of gnews.calls) expect(q).not.toMatch(/give|cite|dates|sources/i);
    expect(result.retrievalContext?.datesRequested).toBeUndefined();
  });

  it('requestsDates reads only recognised trailing instructions', () => {
    expect(requestsDates(PRIOR)).toBe(true);
    expect(requestsDates('Co się zmieniło w gospodarce Polski? Podaj daty i źródła.')).toBe(true);
    expect(requestsDates('What are the key dates in the EU AI Act timeline?')).toBe(false);
    expect(requestsDates("What has changed in Poland's economy?")).toBe(false);
  });
});
