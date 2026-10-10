import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import type { AnalysisProvider } from '../interfaces';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import { AnalysisService } from './analysis.service';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { isAttributableToRequestedSource, type RequestedSource } from '../../news/identity/requested-source.util';
import { withoutReaderRequestFrame } from '../query/reader-request-frame.util';

/*
  P0 SOURCE-BACKED NEWS ANSWERS R1 — the Product Owner's EXACT wording, through the real
  AnalysisService (providers stubbed; no network, no model). Proves what each form does at the
  retrieval boundary after Claude G's correction + the integrator wiring:
    · N1 "…According reuters please." → Reuters RECOGNISED, NOT CARRIED: no provider, no country
      route, no model call, and the reader-facing verdict travels in the retrieval context.
    · idioms are never publisher requests.
  The Reuters article is a FIXTURE whose title / URL / date are the CTO-verified facts; its summary is
  synthetic. A fixture passing is NOT proof of live retrieval (CTO P0 order §TASK CODE 5).
*/
const REUTERS_FIXTURE: NewsArticle = {
  id: 'reuters-fixture-1',
  title: "Erik Prince's forces suffer battlefield loss in Congo, former UFC fighter among wounded, sources say",
  summary: 'FIXTURE — synthetic summary for a retrieval-boundary test; not the article text.',
  url: 'https://www.reuters.com/world/africa/erik-princes-forces-suffer-battlefield-loss-congo-former-ufc-fighter-among-2026-10-09/',
  sourceId: 'gnews:reuters',
  sourceName: 'Reuters',
  countryCode: 'COD',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-10-09T12:00:00.000Z',
  publishedAtBasis: 'publisher',
} as NewsArticle;

function harness(corpus: NewsArticle[]) {
  const searchCalls: Array<{ query: string; requestedSourceId?: string }> = [];
  const countryCalls: string[] = [];
  const newsService = {
    search: jest.fn(async (query: string, _l?: number, mode?: { type?: string }, options?: { requestedSource?: RequestedSource }): Promise<NewsResponse> => {
      searchCalls.push({ query, ...(options?.requestedSource ? { requestedSourceId: options.requestedSource.sourceId } : {}) });
      const gated = mode?.type === 'generic' ? corpus.filter((c) => scoreGenericRelevance(c, query).isRelevant) : corpus;
      const articles = options?.requestedSource ? gated.filter((c) => isAttributableToRequestedSource(c, options.requestedSource!)) : gated;
      return { articles, totalResults: articles.length, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as NewsResponse;
    }),
    topHeadlines: jest.fn(async (): Promise<NewsResponse> => ({ articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() }) as NewsResponse),
    findArticleById: jest.fn(async () => null),
    findRetainedByCountry: jest.fn(async () => []),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      countryCalls.push(identifier);
      const country = resolveCountryByAnyIdentifier(identifier);
      const articles = country ? corpus.filter((c) => scoreCountryRelevance(c, country).isRelevant) : [];
      return { countryCode: country?.iso3 ?? identifier, countryName: country?.name ?? identifier, articles, totalResults: articles.length, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as unknown as CountryNewsResponse;
    }),
  };
  const provider: AnalysisProvider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn(async () => {
      throw new Error('analysis provider reached');
    }),
  };
  const config = {
    get: () => ({
      maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0,
      openAiApiKey: undefined, openAiModel: 'gpt-4o-mini', executionMode: 'development' as const, retryAttempts: 2, retryBaseDelayMs: 300, maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  return { service: new AnalysisService(newsService as never, countryNewsService as never, provider, config), searchCalls, countryCalls, provider };
}

describe('N1 — "Report abt Eric Prince in congo. According reuters please." (exact)', () => {
  it('Reuters is recognised but not carried: no provider, no country route, no model call; the verdict is recorded', async () => {
    const h = harness([REUTERS_FIXTURE]);
    const response = await h.service.analyzeNews('Report abt Eric Prince in congo. According reuters please.');
    expect(h.searchCalls).toEqual([]);
    expect(h.countryCalls).toEqual([]);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(response.articles).toEqual([]);
    expect(response.retrievalContext.retrievalAttempted).toBe(false);
    expect(response.retrievalContext.requestedPublisher).toMatchObject({
      phrase: 'reuters',
      state: 'RECOGNISED_NOT_CARRIED',
      reason: 'REQUESTED_SOURCE_NOT_CARRIED_NO_INGEST_RIGHTS',
      displayName: 'Reuters',
    });
    /* the topic is offered back so the reader can ask without the publisher (draft only) */
    expect(response.retrievalContext.requestedPublisher?.topic ?? '').toMatch(/eri[ck] prince/i);
  });
});

describe('N2 — "According to Reuters, what happened to Erik Prince\'s forces in eastern Congo?"', () => {
  it('same verdict for the grammatical form; never answered from another publisher', async () => {
    const h = harness([REUTERS_FIXTURE]);
    const response = await h.service.analyzeNews("According to Reuters, what happened to Erik Prince's forces in eastern Congo?");
    expect(h.searchCalls).toEqual([]);
    expect(response.retrievalContext.requestedPublisher?.state).toBe('RECOGNISED_NOT_CARRIED');
  });
});

describe('idioms are never publisher requests', () => {
  it.each([
    'The rollout went according to plan in Kigali this week.',
    'Did the election in Kenya go according to plan?',
    'The attack, according to witnesses, killed three people in Goma.',
  ])('%s', async (q) => {
    const h = harness([]);
    const response = await h.service.analyzeNews(q);
    expect(response.retrievalContext.requestedPublisher).toBeUndefined();
  });
});

/* ── P1 + P3: the forms WITHOUT a publisher reach the reporting (fixture title/URL/date only) ── */

function traced(h: ReturnType<typeof harness>) {
  return {
    queries: () => h.searchCalls.map((c) => c.query),
    modelArticles: (): NewsArticle[] => {
      const calls = (h.provider.analyzeNews as jest.Mock).mock.calls;
      return calls.length === 0 ? [] : ((calls[0][0] as { articles?: NewsArticle[] }).articles ?? []);
    },
  };
}

const BRAZZAVILLE_CONTROL: NewsArticle = {
  ...REUTERS_FIXTURE,
  id: 'brazzaville-control',
  title: 'Erik Prince meets officials in Brazzaville, Republic of the Congo',
  url: 'https://example.invalid/control-brazzaville',
};

describe('Alpha form — "Give any reports about Eric Prince please." (exact)', () => {
  it('searches the canonical name only, admits the Reuters headline, discloses the spelling', async () => {
    const h = harness([REUTERS_FIXTURE]);
    const response = await h.service.analyzeNews('Give any reports about Eric Prince please.');
    expect(traced(h).queries()).toEqual(['Erik Prince']);
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    expect(response.retrievalContext.entitySpellings).toEqual([
      { asked: 'Eric Prince', searched: 'Erik Prince', entityId: 'erik-prince' },
    ]);
    expect(response.retrievalContext.requestedPublisher).toBeUndefined();
  });

  it('canonical spelling: same search, no spelling disclosure', async () => {
    const h = harness([REUTERS_FIXTURE]);
    const response = await h.service.analyzeNews('Give any reports about Erik Prince please.');
    expect(traced(h).queries()).toEqual(['Erik Prince']);
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    expect(response.retrievalContext.entitySpellings).toBeUndefined();
  });
});

describe('N3 — "Give any recent reports about Eric Prince in Congo." (exact)', () => {
  it('bare Congo + a headline that says only "Congo" → the reader is asked which Congo; no model call', async () => {
    const h = harness([REUTERS_FIXTURE]);
    const response = await h.service.analyzeNews('Give any recent reports about Eric Prince in Congo.');
    expect(traced(h).queries()).toEqual(['erik prince Congo']);
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(response.retrievalContext.retrievalOutcome).toBe('CLARIFICATION_REQUIRED');
    expect([...(response.retrievalContext.clarificationCandidates ?? [])].sort()).toEqual(['COD', 'COG']);
    /* a provider WAS asked to disambiguate — never recorded as "not attempted" */
    expect(response.retrievalContext.retrievalAttempted).toBeUndefined();
    expect(response.retrievalContext.entitySpellings?.[0]?.searched).toBe('Erik Prince');
  });
});

describe('the reader named the country — person search scoped to it, never the country feed', () => {
  it('"…Eric Prince in DRC." → one "Erik Prince" search; the bare-Congo Reuters headline is consistent with DRC', async () => {
    const h = harness([REUTERS_FIXTURE, BRAZZAVILLE_CONTROL]);
    const response = await h.service.analyzeNews('Give any recent reports about Eric Prince in DRC.');
    expect(traced(h).queries()).toEqual(['Erik Prince']);
    expect(h.countryCalls).toEqual([]);
    expect(response.retrievalContext.countryCode).toBe('COD');
    expect(traced(h).modelArticles().map((a) => a.id)).toEqual(['reuters-fixture-1']);
  });

  it('"What is Erik Prince doing in eastern Congo?" → "Erik Prince" is the provider phrase', async () => {
    const h = harness([REUTERS_FIXTURE]);
    await h.service.analyzeNews('What is Erik Prince doing in eastern Congo?');
    expect(traced(h).queries()[0]).toBe('Erik Prince');
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
  });

  it('a person with no matching reporting → zero evidence, no model call, no substitution', async () => {
    const h = harness([BRAZZAVILLE_CONTROL]);
    const response = await h.service.analyzeNews('Give any recent reports about Eric Prince in DRC.');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(response.articles).toEqual([]);
    expect(h.countryCalls).toEqual([]);
  });
});

describe('EA review of c12e372 — evidence that NAMES the DRC settles "Congo"; a place is never a publisher', () => {
  const NAMED_DRC: NewsArticle = {
    ...REUTERS_FIXTURE,
    id: 'named-drc',
    summary: 'FIXTURE — fighters linked to Erik Prince in eastern Democratic Republic of Congo.',
  };

  it('N3 with a lead that says "eastern Democratic Republic of Congo" → interpreted as COD from evidence', async () => {
    const h = harness([NAMED_DRC]);
    const response = await h.service.analyzeNews('Give any recent reports about Eric Prince in Congo.');
    expect(response.retrievalContext.retrievalOutcome).not.toBe('CLARIFICATION_REQUIRED');
    expect(response.retrievalContext.countryCode).toBe('COD');
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
  });

  it('a Brazzaville-named article still never settles "Congo" as the DRC', async () => {
    const h = harness([BRAZZAVILLE_CONTROL]);
    const response = await h.service.analyzeNews('Give any recent reports about Eric Prince in Congo.');
    expect(response.retrievalContext.countryCode).not.toBe('COD');
  });

  it('"What did Rwanda say about Erik Prince in Congo?" — Rwanda is not a publisher', async () => {
    const h = harness([REUTERS_FIXTURE]);
    const response = await h.service.analyzeNews('What did Rwanda say about Erik Prince in Congo?');
    expect(response.retrievalContext.requestedPublisher).toBeUndefined();
  });
});

/*
  MASTER CTO RECOVERY R1 §2 P0A — N1's optional alternative is the reader's choice, not a silent
  substitution: the verdict offers the topic back as a draft (frontend askPublisherStrings EN
  withoutDraft), and THAT question performs a real search whose evidence keeps its own publisher.
*/
describe('N1 → "Ask again without Reuters" draft (two steps, exact wording)', () => {
  const OTHER_PUBLISHER_DRC: NewsArticle = {
    ...REUTERS_FIXTURE,
    id: 'other-publisher-drc',
    title: 'Erik Prince contractors wounded in eastern Congo clash',
    summary: 'FIXTURE — fighting near Uvira in eastern Democratic Republic of Congo.',
    url: 'https://example.invalid/other-publisher-drc',
    sourceId: 'gnews:example-wire',
    sourceName: 'Example Wire',
  };

  it('step 1 searches nothing; step 2 searches once and admits labelled non-Reuters DRC reporting', async () => {
    const h = harness([OTHER_PUBLISHER_DRC]);
    const first = await h.service.analyzeNews('Report abt Eric Prince in congo. According reuters please.');
    expect(h.searchCalls).toEqual([]);
    const topic = first.retrievalContext.requestedPublisher?.topic ?? '';
    expect(topic).toMatch(/prince in congo/i);

    const second = await h.service.analyzeNews(`What are the latest reports about ${topic.trim()}?`);
    expect(h.searchCalls).toHaveLength(1);
    expect(second.retrievalContext.requestedPublisher).toBeUndefined();
    expect(second.retrievalContext.countryCode).toBe('COD');
    const admitted = traced(h).modelArticles();
    expect(admitted.map((a) => a.id)).toEqual(['other-publisher-drc']);
    expect(admitted.every((a) => a.sourceName !== 'Reuters')).toBe(true);
  });

  it('step 2 with reporting from BOTH Congos asks which Congo; nothing is admitted on a guess', async () => {
    const h = harness([OTHER_PUBLISHER_DRC, BRAZZAVILLE_CONTROL]);
    const response = await h.service.analyzeNews('What are the latest reports about Erik Prince in congo?');
    expect(h.searchCalls).toHaveLength(1);
    expect(response.retrievalContext.retrievalOutcome).toBe('CLARIFICATION_REQUIRED');
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
  });

  it('the draft frame is closed: a reporting noun inside the subject keeps its words', () => {
    expect(withoutReaderRequestFrame('What did the report say about inflation?')).toBe('What did the report say about inflation?');
    expect(withoutReaderRequestFrame('What is the news about Kenya?')).toBe('What is the news about Kenya?');
    expect(withoutReaderRequestFrame('What are the latest reports about Erik Prince in congo?')).toBe('Erik Prince in congo?');
    expect(withoutReaderRequestFrame('Jakie są najnowsze doniesienia o Kongu?')).toBe('Kongu?');
  });
});
