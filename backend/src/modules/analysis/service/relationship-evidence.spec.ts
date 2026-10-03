import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { classifyQueryIntent } from '../query/query-intent.util';
import { attachProviderFailures } from '../../news/news.service';
import type { RelationKind } from '../../ask-router/bilateral-relationship';
import { AnalysisService } from './analysis.service';

/**
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §14 / §44 / PO-02 — and CTO R3 LIVE DEFECT L-1.
 *
 * Through the real AnalysisService: when the Ask router hands an execution a relationship scope,
 * that scope DRIVES retrieval — one per-side retrieval for each governed member, merged, and only
 * reports that evidence the relationship are admitted. The service's own prose classifier may
 * fail to rediscover the countries (it did, live, on Alpha 8f44abd); it can no longer downgrade the
 * router's scope to single-country or generic retrieval.
 */
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
    publishedAt: new Date().toISOString(),
    publishedAtBasis: 'publisher',
  } as NewsArticle;
}

function response(articles: NewsArticle[], unavailable = false): NewsResponse {
  const value = {
    articles,
    totalResults: articles.length,
    providers: unavailable ? [] : ['gnews'],
    dataMode: unavailable ? 'unavailable' : 'live',
    fallbackReason: unavailable ? 'provider-error' : undefined,
    generatedAt: new Date().toISOString(),
  } as NewsResponse;
  return unavailable
    ? attachProviderFailures(value, [{ providerId: 'gnews', kind: 'rate-limited' }])
    : value;
}

/** Per-side corpora keyed by the side name the per-side retrieval searches for. */
type Corpus = Record<string, { articles: NewsArticle[]; unavailable?: boolean }>;

function harness(corpus: Corpus) {
  const terms: string[] = [];
  const search = jest.fn(async (term: string) => {
    terms.push(term);
    const side = Object.keys(corpus).find((name) => new RegExp(name, 'i').test(term));
    return side === undefined
      ? response([])
      : response(corpus[side].articles, corpus[side].unavailable === true);
  });
  const news = {
    search,
    topHeadlines: jest.fn(async () => response([])),
    findArticleById: jest.fn(async () => undefined),
    findRetainedByCountry: jest.fn(async () => []),
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
  return { service, inputs, search, terms };
}

const policy = (countries: string[], relations: RelationKind[]) => ({
  relationship: { countries, relations },
});
const run = (
  h: ReturnType<typeof harness>,
  q: string,
  countries: string[],
  relations: RelationKind[],
) =>
  h.service.analyzeNews(
    q,
    'en',
    undefined,
    undefined,
    undefined,
    undefined,
    policy(countries, relations),
  );
const sent = (h: ReturnType<typeof harness>) =>
  (h.inputs[0]?.articles ?? []).map((a) => a.id).sort();

const RW_TZ: Corpus = {
  Rwanda: {
    articles: [
      article(
        'rw-border',
        'Rwanda and Tanzania ease cargo checks at Rusumo border',
        'Truck traders welcome faster customs clearance on the Rwanda Tanzania route.',
      ),
      article(
        'rw-only',
        'Rwanda unveils new tourism campaign for Kigali',
        'Rwanda hopes to attract more visitors to Kigali.',
      ),
      article(
        'rw-tz-summit',
        'Rwanda and Tanzania presidents meet at regional summit',
        'The two leaders discussed regional peace.',
      ),
    ],
  },
  Tanzania: {
    articles: [
      article(
        'tz-trade',
        'Tanzanian exporters report new Rwanda border fees',
        'Tanzania traders say Rwanda customs fees raised costs for goods.',
      ),
      article(
        'tz-only',
        'Tanzania parliament debates mining law',
        'Tanzania lawmakers debated mining royalties in Dodoma.',
      ),
    ],
  },
};

describe('R3 L-1 — the router relationship scope drives retrieval (live wording, Alpha 8f44abd)', () => {
  const LIVE =
    'What is happening at the border linking Rwanda and Tanzania regarding commercial services?';

  it('precondition: the prose classifier alone finds NO sides for the live wording', () => {
    expect(classifyQueryIntent(LIVE).sides).toEqual([]);
  });

  it('per-side retrieval runs anyway: one search per member, only relationship evidence reaches the model', async () => {
    const h = harness(RW_TZ);
    const result = await run(h, LIVE, ['RWA', 'TZA'], ['BORDER', 'TRADE']);
    expect(h.terms.some((t) => /rwanda/i.test(t))).toBe(true);
    expect(h.terms.some((t) => /tanzania/i.test(t))).toBe(true);
    expect(h.search).toHaveBeenCalledTimes(2);
    expect(sent(h)).toEqual(['rw-border', 'tz-trade']);
    expect(result.retrievalContext?.relationshipEvidence).toEqual({
      countries: ['RWA', 'TZA'],
      relations: ['BORDER', 'TRADE'],
      admitted: 2,
      rejected: 3,
      classifierSides: [],
    });
  });

  it('INVARIANT: router relationship scope cannot be downgraded by downstream prose reclassification', async () => {
    /* the same scope, three prose shapes the classifier reads differently — retrieval is identical */
    for (const q of [
      LIVE,
      'What is happening commercially between Rwanda and Tanzania at the border?',
      'Rwanda and Tanzania border commercial services',
    ]) {
      const h = harness(RW_TZ);
      await run(h, q, ['RWA', 'TZA'], ['BORDER', 'TRADE']);
      expect(sent(h)).toEqual(['rw-border', 'tz-trade']);
      expect(h.search).toHaveBeenCalledTimes(2);
    }
  });

  it('a report naming both countries with no sign of the named relation is rejected (summit ≠ border trade)', async () => {
    const h = harness(RW_TZ);
    await run(h, LIVE, ['RWA', 'TZA'], ['BORDER', 'TRADE']);
    expect(sent(h)).not.toContain('rw-tz-summit');
  });

  it('a generic bilateral relationship admits any two-sided report (and still no one-sided one)', async () => {
    const h = harness(RW_TZ);
    await run(h, 'How are relations between Rwanda and Tanzania?', ['RWA', 'TZA'], ['DIPLOMATIC']);
    expect(sent(h)).toEqual(['rw-border', 'rw-tz-summit', 'tz-trade']);
  });

  it('Kenya + Uganda freight / customs', async () => {
    const h = harness({
      Kenya: {
        articles: [
          article(
            'ke-ug-freight',
            'Kenya and Uganda agree faster freight clearance at Malaba',
            'Customs officers on both sides will share cargo data.',
          ),
          article(
            'ke-only',
            'Kenya central bank holds rates',
            'Nairobi policymakers kept rates unchanged.',
          ),
        ],
      },
      Uganda: {
        articles: [
          article(
            'ug-only',
            'Uganda opens new hospital in Gulu',
            'Health officials opened the facility.',
          ),
        ],
      },
    });
    await run(
      h,
      'What is happening with freight and customs between Kenya and Uganda?',
      ['KEN', 'UGA'],
      ['TRADE', 'TRANSPORT'],
    );
    expect(sent(h)).toEqual(['ke-ug-freight']);
  });

  it('Poland + Germany border / trade', async () => {
    const h = harness({
      Poland: {
        articles: [
          article(
            'pl-de-border',
            'Poland and Germany reopen border crossing for trucks',
            'Freight traffic resumes at the Polish-German border.',
          ),
          article('pl-only', 'Poland passes budget', 'Warsaw lawmakers approved spending.'),
        ],
      },
      Germany: {
        articles: [article('de-only', 'Germany unveils rail strategy', 'Berlin plans new lines.')],
      },
    });
    await run(h, 'Poland Germany border trade', ['POL', 'DEU'], ['BORDER', 'TRADE']);
    expect(sent(h)).toEqual(['pl-de-border']);
  });

  it('a provider failure on ONE side is disclosed per side; the other side still contributes only relationship evidence', async () => {
    const h = harness({ ...RW_TZ, Tanzania: { articles: [], unavailable: true } });
    const result = await run(h, LIVE, ['RWA', 'TZA'], ['BORDER', 'TRADE']);
    const coverage = result.retrievalContext?.comparisonCoverage ?? [];
    expect(coverage.find((c) => c.iso3 === 'TZA')?.retrievalState).toBe('PROVIDER_UNAVAILABLE');
    expect(sent(h)).toEqual(['rw-border']);
  });

  it('nothing two-sided on either side → zero evidence, NO model call, never padded with one-sided news', async () => {
    const h = harness({
      Rwanda: { articles: [article('rw-only', 'Rwanda unveils new tourism campaign', '')] },
      Tanzania: { articles: [article('tz-only', 'Tanzania parliament debates mining law', '')] },
    });
    const result = await run(h, LIVE, ['RWA', 'TZA'], ['BORDER', 'TRADE']);
    expect(h.inputs).toHaveLength(0);
    expect(result.analysis).toBeNull();
    expect(result.articles).toEqual([]);
    expect(result.retrievalContext?.relationshipEvidence).toMatchObject({
      admitted: 0,
      rejected: 2,
    });
  });

  it('an unresolvable member fails CLOSED: no provider call, the scope gap is disclosed', async () => {
    const h = harness(RW_TZ);
    const result = await run(h, LIVE, ['RWA', 'XXX'], ['BORDER', 'TRADE']);
    expect(h.search).not.toHaveBeenCalled();
    expect(h.inputs).toHaveLength(0);
    expect(result.retrievalContext?.relationshipEvidence).toMatchObject({
      unresolvedCountries: ['XXX'],
    });
  });

  it('control: without a relationship scope, the live wording takes its old single-country path', async () => {
    const h = harness(RW_TZ);
    await h.service.analyzeNews(LIVE, 'en');
    expect(h.terms.some((t) => /tanzania/i.test(t) && !/rwanda/i.test(t))).toBe(false);
  });
});
