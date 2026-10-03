import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { AnalysisService } from './analysis.service';
import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { scoreCountryEconomyRelevance } from '../../news/relevance/country-economy-relevance.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';

/**
 * CTO CHECKPOINT 5 §6 — a focused domain question keeps its domain through retrieval and evidence
 * filtering. The fixture is the live Alpha Madagascar set from checkpoint 5 (S1 "And the economy?"):
 * one political report, a travel piece, two Rio Tinto mine-claim reports, a human-rights report and
 * a football result — plus, where stated, one genuinely economic report.
 */
const now = () => new Date().toISOString();
function art(id: string, title: string, summary: string, category = 'world'): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://example.org/${id}`,
    sourceId: 'wire',
    sourceName: 'Wire',
    category,
    sourcesCount: 1,
    publishedAt: now(),
    publishedAtBasis: 'publisher',
    countryCode: 'MG',
  } as NewsArticle;
}
const LIVE_SET = [
  art(
    'pol',
    "Madagascar's Gen Z 'betrayed' after ushering in military govt",
    'Activists in Madagascar say the new military government uses old tactics.',
    'politics',
  ),
  art('lemur', 'How to see lemurs in Madagascar', 'A travel guide to seeing lemurs in Madagascar.'),
  art(
    'rio1',
    'Madagascar villagers file claim against Rio Tinto',
    'Villagers in Madagascar allege contamination from a mine.',
  ),
  art(
    'alb',
    'Murdered for their eyes: people with albinism living in terror in Madagascar',
    'People with albinism in Madagascar face attacks.',
  ),
  art(
    'foot',
    'Soccer-Nigeria fight back to beat Madagascar in Cup of Nations qualifier',
    'Nigeria beat Madagascar.',
    'sports',
  ),
];
const ECON = art(
  'econ',
  'Madagascar inflation eases as central bank holds rate',
  'Madagascar inflation fell while the central bank kept its policy rate, the economy ministry said.',
  'business',
);

function harness(
  countryPool: NewsArticle[],
  supplementalPool: NewsArticle[] = [],
  supplementalFails = false,
) {
  const providerInputs: AnalysisProviderInput[] = [];
  const searchCalls: string[] = [];
  const searchModes: unknown[] = [];
  const news = {
    /* NewsService applies the country-economy gate INSIDE search when asked to (its real contract) */
    search: jest.fn(
      async (
        q: string,
        _limit?: number,
        mode?: { type?: string; countryEconomy?: { iso3: string } },
      ): Promise<NewsResponse> => {
        searchCalls.push(q);
        searchModes.push(mode);
        const pool = mode?.countryEconomy
          ? supplementalPool.filter(
              (a) => scoreCountryEconomyRelevance(a, mode.countryEconomy!.iso3).isRelevant,
            )
          : mode?.type === 'generic'
            ? supplementalPool.filter((a) => scoreGenericRelevance(a, q).isRelevant)
            : supplementalPool;
        return {
          articles: supplementalFails ? [] : pool,
          totalResults: pool.length,
          providers: supplementalFails ? [] : ['gnews'],
          dataMode: supplementalFails ? 'unavailable' : 'live',
          fallbackReason: supplementalFails ? 'provider-error' : undefined,
          generatedAt: now(),
        } as NewsResponse;
      },
    ),
    topHeadlines: jest.fn(),
    findArticleById: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
  };
  const country = {
    getCountryNews: jest.fn(
      async (): Promise<CountryNewsResponse> =>
        ({
          countryCode: 'MDG',
          countryName: 'Madagascar',
          articles: countryPool,
          totalResults: countryPool.length,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: now(),
        }) as unknown as CountryNewsResponse,
    ),
  };
  const mock = new MockAnalysisProvider();
  const provider = {
    id: 'mock',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn(
      async (input: AnalysisProviderInput) => (providerInputs.push(input), mock.analyzeNews(input)),
    ),
  };
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
  const service = new AnalysisService(news as never, country as never, provider as never, config);
  return { service, providerInputs, searchCalls, searchModes, country };
}
const evidenceIds = (input: AnalysisProviderInput | undefined) =>
  (input?.articles ?? []).map((a) => a.id).sort();

const conversational = (h: ReturnType<typeof harness>, q: string) =>
  h.service.analyzeNews(q, 'en', undefined, undefined, undefined, { countryCode: 'MDG' } as never);

describe('CTO checkpoint 5 §6 — a focused domain question keeps its domain (conversational path: domain + inherited place)', () => {
  it('"And the economy?" in a Madagascar conversation: economic evidence only, nothing else fills in', async () => {
    const h = harness([...LIVE_SET, ECON]);
    const result = await conversational(h, 'And the economy?');
    expect(evidenceIds(h.providerInputs[0])).toEqual(['econ']);
    expect(result.retrievalContext.focusedDomains).toEqual({
      requested: ['economic'],
      matched: 1,
      supplementalSearched: false,
      gap: false,
    });
    expect(h.searchCalls).toEqual([]);
  });

  it('no economic report in the country pool → ONE bounded supplemental search, filtered the same way', async () => {
    const h = harness(LIVE_SET, [ECON, art('other', 'Kenya economy grows', 'Kenya GDP grew.')]);
    const result = await conversational(h, 'And the economy?');
    expect(h.searchCalls).toEqual(['Madagascar economy']);
    expect(evidenceIds(h.providerInputs[0])).toEqual(['econ']);
    expect(result.retrievalContext.focusedDomains?.supplementalSearched).toBe(true);
  });

  it('no economic evidence anywhere → says so: no model call, no off-domain filler, gap disclosed', async () => {
    const h = harness(LIVE_SET, []);
    const result = await conversational(h, 'And the economy?');
    expect(h.providerInputs).toHaveLength(0);
    expect(result.analysis).toBeNull();
    expect(result.retrievalContext.focusedDomains).toEqual({
      requested: ['economic'],
      matched: 0,
      supplementalSearched: true,
      gap: true,
    });
  });

  it('a failed supplemental provider is no evidence (one call, no retry)', async () => {
    const h = harness(LIVE_SET, [ECON], true);
    const result = await conversational(h, 'And the economy?');
    expect(h.searchCalls).toEqual(['Madagascar economy']);
    expect(result.retrievalContext.focusedDomains?.gap).toBe(true);
  });

  it('a domain-free continuation is unchanged: the whole country pool is evidence', async () => {
    const h = harness([...LIVE_SET, ECON]);
    const result = await conversational(h, 'What else is happening?');
    expect(evidenceIds(h.providerInputs[0])).toEqual([
      'alb',
      'econ',
      'foot',
      'lemur',
      'pol',
      'rio1',
    ]);
    expect(result.retrievalContext.focusedDomains).toBeUndefined();
  });

  it('political reporting that is ALSO economic stays; other domains are not gated', async () => {
    const both = art(
      'polecon',
      'Madagascar government unveils economic recovery plan',
      'The president announced an economy and investment package.',
      'politics',
    );
    const h = harness([...LIVE_SET, both]);
    await conversational(h, 'And the economy?');
    expect(evidenceIds(h.providerInputs[0])).toEqual(['polecon']);
    /* other domains keep the existing behaviour: their keyword lists are too thin to gate on */
    const s = harness([...LIVE_SET, both]);
    const sec = await conversational(s, 'And security?');
    expect(evidenceIds(s.providerInputs[0])).toEqual([
      'alb',
      'foot',
      'lemur',
      'pol',
      'polecon',
      'rio1',
    ]);
    expect(sec.retrievalContext.focusedDomains).toBeUndefined();
  });
});

describe('the typed form takes the existing country-economy path (already domain-filtered)', () => {
  it('"How is Madagascar’s economy doing?" admits the economic report and no travel, football or human-rights filler', async () => {
    const h = harness([], [...LIVE_SET, ECON]);
    await h.service.analyzeNews("How is Madagascar's economy doing?", 'en');
    const ids = evidenceIds(h.providerInputs[0]);
    expect(ids).toContain('econ');
    for (const offDomain of ['lemur', 'foot', 'alb']) expect(ids).not.toContain(offDomain);
  });
});
