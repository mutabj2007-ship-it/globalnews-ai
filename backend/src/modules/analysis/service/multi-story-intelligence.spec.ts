import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ANALYSIS_TOTAL_BUDGET_MS,
  MAX_SELECTED_STORIES,
  MULTI_STORY_ACTIONS,
  MULTI_STORY_MIN_STORIES,
  resolveCountryByAnyIdentifier,
  type CountryNewsResponse,
  type MultiStoryAction,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import type { AnalysisConfigService } from '../config/analysis-config.service';
import type { AnalysisProviderInput } from '../interfaces/analysis-provider.interface';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { buildAnalysisMessages } from '../prompt/build-analysis-prompt.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { scoreCountryRelevance } from '../../news/country/country-relevance.util';
import { computeArticleRef } from '../../news/identity/article-ref.util';
import { AnalyzeNewsDto } from '../dto';
import { AnalysisService } from './analysis.service';

/**
 * MY INTELLIGENCE R1 — MULTI-STORY INTELLIGENCE through the REAL
 * AnalysisService (recording retrieval stubs + the mock analysis provider).
 * One compute architecture: the selection is an additive input to the same
 * /analysis/news pipeline. No provider search, no country feed, no publisher
 * page — the selected stories are resolved from retained reporting.
 */

const a = (id: string, title: string, summary: string, countryCode?: string): NewsArticle =>
  ({
    id,
    title,
    summary,
    url: `https://wire.example/${id}`,
    sourceId: 'wire',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    ...(countryCode ? { countryCode } : {}),
    publishedAt: `2026-09-2${Number(id.replace(/\D/g, '') || 0) % 7}T10:00:00.000Z`,
    publishedAtBasis: 'publisher',
    firstSeenAt: '2026-09-27T06:00:00.000Z',
  }) as NewsArticle;

const TOPICS = [
  'Central bank holds interest rates',
  'Port strike ends after talks',
  'Election commission certifies results',
  'Drought cuts wheat harvest',
  'Parliament passes energy bill',
  'Tech firm reports record profit',
  'Border crossing reopens to trade',
  'Health ministry expands vaccination',
  'Rail link opens between capitals',
];
const RETAINED = TOPICS.map((topic, i) => a(`s${i + 1}`, topic, `${topic}, officials said on Monday.`));
const ref = (article: NewsArticle) => ({ articleRef: computeArticleRef(article.url), url: article.url });

type Corpus = readonly NewsArticle[];

function harness(
  corpus: Corpus,
  decorate?: (raw: Record<string, unknown>, input: AnalysisProviderInput) => void,
) {
  const searchCalls: string[] = [];
  const countryCalls: string[] = [];
  const providerInputs: AnalysisProviderInput[] = [];
  const now = () => new Date().toISOString();
  const newsService = {
    search: jest.fn(
      async (query: string, _l?: number, mode?: { type?: string }): Promise<NewsResponse> => {
        searchCalls.push(query);
        const articles =
          mode?.type === 'generic'
            ? corpus.filter((c) => scoreGenericRelevance(c, query).isRelevant)
            : [...corpus];
        return {
          articles,
          totalResults: articles.length,
          providers: ['gnews'],
          dataMode: 'live',
          generatedAt: now(),
        } as NewsResponse;
      },
    ),
    topHeadlines: jest.fn(async () => ({
      articles: [],
      totalResults: 0,
      providers: ['gnews'],
      dataMode: 'live',
      generatedAt: now(),
    })),
    findArticleById: jest.fn(async (id: string) => corpus.find((c) => c.id === id) ?? null),
    findRetainedArticleByUrl: jest.fn(async (url: string) => corpus.find((c) => c.url === url) ?? null),
    findRetainedByCountry: jest.fn(async () => []),
    findRetainedByQuery: jest.fn(async () => []),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(async (identifier: string): Promise<CountryNewsResponse> => {
      countryCalls.push(identifier);
      const country = resolveCountryByAnyIdentifier(identifier);
      const articles = country
        ? corpus.filter((c) => scoreCountryRelevance(c, country).isRelevant)
        : [];
      return {
        countryCode: country?.iso3 ?? identifier,
        countryName: country?.name ?? identifier,
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: now(),
      } as unknown as CountryNewsResponse;
    }),
  };
  const mock = new MockAnalysisProvider();
  const provider = {
    id: 'mock-analysis',
    displayName: 'Mock',
    isMock: true,
    analyzeNews: jest.fn(async (input: AnalysisProviderInput) => {
      providerInputs.push(input);
      const raw = (await mock.analyzeNews(input)) as Record<string, unknown>;
      decorate?.(raw, input);
      return raw;
    }),
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'gpt-4o-mini',
      executionMode: 'development' as const,
      retryAttempts: 0,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    newsService as never,
    countryNewsService as never,
    provider as never,
    config,
  );
  return { service, searchCalls, countryCalls, providerInputs, provider };
}


const promptFor = (input: AnalysisProviderInput) =>
  buildAnalysisMessages(
    input.query,
    input.articles,
    1200,
    undefined,
    'en',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    input.eventAnchor,
    input.eventEvidenceRelations,
    input.conversationSubject,
    input.selection,
  );

const selectionOf = (action: MultiStoryAction, count: number) => ({
  action,
  stories: RETAINED.slice(0, count).map(ref),
});

describe('multi-story bounds: 1 / 2 / 8, and the 9th is rejected', () => {
  it('the DTO accepts 1 and 8 stories and rejects 9', async () => {
    const check = async (count: number) =>
      validate(plainToInstance(AnalyzeNewsDto, { query: 'Summarize the selected stories', selection: selectionOf('SUMMARIZE', count) }));
    expect(await check(1)).toEqual([]);
    expect(await check(MAX_SELECTED_STORIES)).toEqual([]);
    expect(MAX_SELECTED_STORIES).toBe(8);
    expect((await check(9)).length).toBeGreaterThan(0);
  });

  it('the DTO rejects a story whose identity is not a sha256 ref, and any extra story field', async () => {
    const errors = await validate(
      plainToInstance(AnalyzeNewsDto, {
        query: 'Summarize',
        selection: { action: 'SUMMARIZE', stories: [{ articleRef: 'gnews-123', url: 'https://wire.example/s1' }] },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    ['SUMMARIZE', 1],
    ['COMPARE', 2],
    ['SUMMARIZE', 8],
  ] as const)('%s over %i selected stories → exactly one analysis over exactly those stories', async (action, count) => {
    const h = harness(RETAINED);
    const r = await h.service.analyzeNews('Selected stories', 'en', undefined, undefined, selectionOf(action, count));

    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    expect(h.providerInputs[0].articles.map((article) => article.id).sort()).toEqual(
      RETAINED.slice(0, count).map((article) => article.id).sort(),
    );
    expect(r.retrievalContext.selection).toEqual({ action, requested: count, resolved: count, unresolvedRefs: [] });
    /* Retained reporting, honestly labelled — and not one provider search. */
    expect(r.retrievalContext.dataMode).toBe('cached');
    expect(h.searchCalls).toEqual([]);
    expect(h.countryCalls).toEqual([]);
  });

  it('the minimum per action is the shared contract', () => {
    expect(MULTI_STORY_MIN_STORIES).toEqual({
      COMPARE: 2,
      SUMMARIZE: 1,
      ASK_SELECTED: 1,
      EXPLAIN_DISAGREEMENTS: 2,
      WHAT_CHANGED: 1,
      CREATE_BRIEFING: 2,
    });
  });
});

describe('each of the six actions reaches the one pipeline with its own instruction', () => {
  const INSTRUCTION: Record<MultiStoryAction, string> = {
    COMPARE: 'COMPARE the selected stories',
    SUMMARIZE: 'SUMMARIZE the selected stories only',
    ASK_SELECTED: "ANSWER the reader's question using ONLY the selected stories",
    EXPLAIN_DISAGREEMENTS: 'never invent a disagreement',
    WHAT_CHANGED: 'Do not claim any memory of previous sessions, alerts or watched situations',
    CREATE_BRIEFING: 'CREATE A BRIEFING from the selected stories',
  };

  it.each(MULTI_STORY_ACTIONS.map((action) => [action] as const))('%s', async (action) => {
    const h = harness(RETAINED);
    const question = action === 'ASK_SELECTED' ? 'Which story mentions officials?' : `Run ${action}`;
    await h.service.analyzeNews(question, 'en', undefined, undefined, selectionOf(action, MULTI_STORY_MIN_STORIES[action]));

    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    const input = h.providerInputs[0];
    expect(input.selection).toEqual({ action, storyCount: MULTI_STORY_MIN_STORIES[action] });
    /* The reader's own question is the question. */
    expect(input.query).toBe(question);
    const { system } = promptFor(input);
    expect(system).toContain('SELECTED STORIES');
    expect(system).toContain(INSTRUCTION[action]);
  });

  it('an ordinary question has no selection section (every other prompt is unchanged)', () => {
    const { system } = buildAnalysisMessages('q', RETAINED.slice(0, 1), 1200);
    expect(system).not.toContain('SELECTED STORIES');
  });
});

describe('trusted identity, retained evidence, zero evidence = zero AI', () => {
  it('a story whose articleRef does not hash from its URL is refused, never relabelled', async () => {
    const h = harness(RETAINED);
    const forged = { articleRef: computeArticleRef(RETAINED[0].url), url: RETAINED[1].url };
    const r = await h.service.analyzeNews('Summarize', 'en', undefined, undefined, {
      action: 'SUMMARIZE',
      stories: [forged],
    });
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.analysis).toBeNull();
    expect(r.retrievalContext.selection).toMatchObject({ requested: 1, resolved: 0 });
  });

  it('a story not in retained reporting is reported unresolved; below the minimum → no AI call', async () => {
    const h = harness(RETAINED);
    const missing = { articleRef: computeArticleRef('https://nowhere.example/x'), url: 'https://nowhere.example/x' };
    const r = await h.service.analyzeNews('Compare', 'en', undefined, undefined, {
      action: 'COMPARE',
      stories: [ref(RETAINED[0]), missing],
    });
    expect(h.provider.analyzeNews).not.toHaveBeenCalled();
    expect(r.analysis).toBeNull();
    expect(r.retrievalContext.selection).toEqual({
      action: 'COMPARE',
      requested: 2,
      resolved: 1,
      unresolvedRefs: [missing.articleRef],
    });
  });

  it('with enough resolved stories, the unresolved one is disclosed and the rest are analysed', async () => {
    const h = harness(RETAINED);
    const missing = { articleRef: computeArticleRef('https://nowhere.example/x'), url: 'https://nowhere.example/x' };
    const r = await h.service.analyzeNews('Summarize', 'en', undefined, undefined, {
      action: 'SUMMARIZE',
      stories: [ref(RETAINED[0]), missing],
    });
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(1);
    expect(r.retrievalContext.selection?.unresolvedRefs).toEqual([missing.articleRef]);
  });

  it('duplicate selected refs count once', async () => {
    const h = harness(RETAINED);
    const r = await h.service.analyzeNews('Summarize', 'en', undefined, undefined, {
      action: 'SUMMARIZE',
      stories: [ref(RETAINED[0]), ref(RETAINED[0])],
    });
    expect(r.retrievalContext.selection).toMatchObject({ requested: 1, resolved: 1 });
    expect(h.providerInputs[0].articles).toHaveLength(1);
  });

  it('story context and a prior question are ignored for a selection — the selection is the whole scope', async () => {
    const h = harness(RETAINED);
    await h.service.analyzeNews(
      'What changed?',
      'en',
      { title: 'Other story', articleId: 's9', countryCode: 'POL' },
      'What caused the plane crash in Congo?',
      selectionOf('WHAT_CHANGED', 1),
    );
    expect(h.providerInputs[0].articles.map((article) => article.id)).toEqual(['s1']);
    expect(h.providerInputs[0].eventAnchor).toBeUndefined();
    expect(h.providerInputs[0].conversationSubject).toBeUndefined();
    expect(h.searchCalls).toEqual([]);
  });

  it('each explicit Run computes exactly once: a retained-evidence answer is never replayed from cache', async () => {
    const h = harness(RETAINED);
    await h.service.analyzeNews('Summarize', 'en', undefined, undefined, selectionOf('SUMMARIZE', 2));
    await h.service.analyzeNews('Summarize', 'en', undefined, undefined, selectionOf('SUMMARIZE', 2));
    await h.service.analyzeNews('Summarize', 'en', undefined, undefined, selectionOf('SUMMARIZE', 3));
    expect(h.provider.analyzeNews).toHaveBeenCalledTimes(3);
  });

  it('an ordinary question (no selection) is untouched by all of this', async () => {
    const h = harness(RETAINED);
    await h.service.analyzeNews('Central bank holds interest rates', 'en');
    expect(h.searchCalls.length).toBeGreaterThan(0);
    expect(h.providerInputs[0]?.selection).toBeUndefined();
  });
});
