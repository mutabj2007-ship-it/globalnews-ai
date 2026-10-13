import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS, type NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { OpenAiAnalysisProvider } from '../providers/openai-analysis.provider';
import { WP6_PRESENTATION_RULES } from '../prompt/presentation-rules.util';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { REWORK_RESEARCH_RULES } from '../../ask-v2/execution-contract';

/*
  RETRIEVAL R1 · WP6 — THE ENABLED PATH, END TO END, WITH NO LIVE MODEL.

  1. PROVIDER: the real OpenAiAnalysisProvider, HTTP faked. With ANSWER_PRESENTATION_WP6_ENABLED the
     ONE request carries the rules block; the user message, the request count and the rest of the
     system prompt are exactly those of the flag-off request.
  2. SERVICE: the real AnalysisService, a recorded WP6-formatted model answer (direct answer, a
     heading, bullets, selective bold, a table). It is served as written — not withheld by the
     existing validators, not rewritten — with ONE model call, the same evidence and the same
     key-fact citations as a plain-prose control; a cached re-ask reuses it with no further call.
*/

function article(id: string, title: string, summary: string): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://${id}.example/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Outlet ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher' as const,
    sourceLanguage: 'en',
  };
}

const RELEVANT = [
  article(
    'rail-1',
    'Nairobi commuter rail expansion approved',
    'The Nairobi commuter rail expansion was approved by cabinet on Tuesday.',
  ),
  article(
    'rail-2',
    'Funding confirmed for Nairobi commuter rail expansion',
    'Treasury confirmed funding for the Nairobi commuter rail expansion.',
  ),
];

const WP6_SUMMARY = [
  'Cabinet approved the **Nairobi commuter rail expansion** on **Tuesday**, and Treasury confirmed its funding.',
  '',
  '## What the reports say',
  '- The Nairobi commuter rail expansion was approved by cabinet on Tuesday.',
  '- Treasury confirmed funding for the Nairobi commuter rail expansion.',
  '',
  '| Step | Reported |',
  '|---|---|',
  '| Approval | Cabinet, Tuesday |',
  '| Funding | Confirmed by Treasury |',
].join('\n');

const PLAIN_SUMMARY =
  'Cabinet approved the Nairobi commuter rail expansion on Tuesday, and Treasury confirmed its funding. ' +
  'The Nairobi commuter rail expansion was approved by cabinet on Tuesday. Treasury confirmed funding for the Nairobi commuter rail expansion.';

function stub(articles: NewsArticle[]): NewsProvider {
  const run = async () => articles.map((a) => ({ ...a, providerId: 'gnews' }));
  return {
    id: 'gnews',
    displayName: 'gnews',
    isMock: false,
    capabilities: ['search'],
    search: run,
    topHeadlines: async () => [],
    category: async () => [],
    health: async () => ({
      providerId: 'gnews',
      displayName: 'gnews',
      status: 'ok' as const,
      checkedAt: '',
    }),
  } as unknown as NewsProvider;
}

async function serviceWith(summary: string, cacheTtlSeconds = 0) {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const providers = [stub(RELEVANT)];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: providers },
      { provide: ALL_NEWS_PROVIDERS, useValue: providers },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  /* the recorded model answer: the mock's valid structure, with the summary the model wrote */
  const model: AnalysisProvider = {
    id: 'openai',
    displayName: 'Recorded model',
    isMock: false,
    analyzeNews: async (input: AnalysisProviderInput) => {
      inputs.push(input);
      const base = (await mock.analyzeNews(input)) as Record<string, unknown>;
      return { ...base, summary };
    },
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds,
      openAiApiKey: undefined,
      rightsAudience: 'TEST_FIXTURE' as const, openAiModel: 'fixture',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
      wp6Presentation: true as const,
    }),
  } as unknown as AnalysisConfigService;
  return {
    service: new AnalysisService(
      moduleRef.get(NewsService),
      moduleRef.get(CountryNewsService),
      model,
      config,
    ),
    inputs,
  };
}

describe('WP6 · enabled path — provider request (real OpenAiAnalysisProvider, HTTP faked)', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        choices: [
          { message: { content: JSON.stringify({ headline: 'H' }) }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const provider = (wp6: boolean) =>
    new OpenAiAnalysisProvider({
      get: () => ({
        maxArticles: 8,
        maxArticleChars: 1200,
        timeoutMs: 5000,
        cacheTtlSeconds: 0,
        openAiApiKey: 'sk-test-key',
        rightsAudience: 'TEST_FIXTURE' as const, openAiModel: 'gpt-4o-mini',
        executionMode: 'development' as const,
        retryAttempts: 0,
        retryBaseDelayMs: 1,
        maxCompletionTokens: 2000,
        ...(wp6 ? { wp6Presentation: true as const } : {}),
      }),
    } as unknown as AnalysisConfigService);

  async function requestBody(wp6: boolean, extra: Partial<AnalysisProviderInput> = {}) {
    fetchMock.mockClear();
    await provider(wp6)
      .analyzeNews({
        query: 'Nairobi commuter rail expansion',
        articles: RELEVANT,
        ...extra,
      } as AnalysisProviderInput)
      .catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    return JSON.parse(fetchMock.mock.calls[0][1].body) as {
      messages: Array<{ role: string; content: string }>;
    };
  }

  it('flag ON: exactly one request; it carries the rules; everything else is the flag-OFF request', async () => {
    const off = await requestBody(false);
    const on = await requestBody(true);
    expect(off.messages[0]?.content).not.toContain(WP6_PRESENTATION_RULES);
    expect(on.messages[0]?.content).toContain(WP6_PRESENTATION_RULES);
    expect(on.messages[1]).toEqual(off.messages[1]);
    expect(on.messages[0]?.content.replace(`\n\n${WP6_PRESENTATION_RULES}\n`, '')).toBe(
      off.messages[0]?.content,
    );
  });

  /* PRIOR-ANSWER REWORK (CTO R4 §5): the Ask adapter sends the rework rules as governed system rules
     and the EARLIER WORK as governed data (withContractRules). With the flag on, the rework request
     is the flag-off rework request plus the one WP6 block: the rework rules, the earlier work and the
     evidence are untouched, the block appears exactly once, and it is still one request. Support's
     NEWS_QUESTION reaches this same provider through the same AnalysisService.analyzeNews. */
  it('flag ON, prior-answer rework: one request; rework rules and earlier work intact; the block once', async () => {
    const governed = {
      rules: REWORK_RESEARCH_RULES,
      data: 'EARLIER WORK\nCabinet approved the Nairobi commuter rail expansion on Tuesday.',
    };
    const off = await requestBody(false, { governed });
    const on = await requestBody(true, { governed });
    expect(on.messages[0]?.content).toContain(REWORK_RESEARCH_RULES);
    expect(on.messages[0]?.content.split(WP6_PRESENTATION_RULES)).toHaveLength(2);
    expect(on.messages[1]).toEqual(off.messages[1]);
    expect(on.messages[1]?.content).toContain('EARLIER WORK');
    expect(on.messages[0]?.content.replace(`\n\n${WP6_PRESENTATION_RULES}\n`, '')).toBe(
      off.messages[0]?.content,
    );
  });
});

describe('WP6 · enabled path — real AnalysisService with a recorded WP6-formatted answer', () => {
  it('served exactly as written: not withheld, not rewritten, one model call; same evidence and citations as plain prose', async () => {
    const wp6 = await serviceWith(WP6_SUMMARY);
    const plain = await serviceWith(PLAIN_SUMMARY);
    const a = await wp6.service.analyzeNews('Nairobi commuter rail expansion', 'en');
    const b = await plain.service.analyzeNews('Nairobi commuter rail expansion', 'en');

    expect(wp6.inputs).toHaveLength(1);
    expect(plain.inputs).toHaveLength(1);
    expect(a.analysis?.briefState?.availability ?? 'accepted').not.toBe('withheld-non-compliant');
    expect(a.analysis?.summary).toBe(WP6_SUMMARY);
    expect(b.analysis?.summary).toBe(PLAIN_SUMMARY);
    /* the same evidence reached the model, and the same evidence is returned */
    expect(wp6.inputs[0]?.articles.map((x) => x.id)).toEqual(
      plain.inputs[0]?.articles.map((x) => x.id),
    );
    expect(a.articles.map((x) => x.id)).toEqual(b.articles.map((x) => x.id));
    /* key-fact citations are identical — formatting moved no citation */
    const cites = (r: typeof a) =>
      (r.analysis?.keyFacts ?? []).map((f) => [f.claim, ...(f.sourceArticleIds ?? [])].join('|'));
    expect(cites(a)).toEqual(cites(b));
    expect(cites(a).length).toBeGreaterThan(0);
  });

  it('a cached re-ask reuses the formatted answer with no further model call', async () => {
    const wp6 = await serviceWith(WP6_SUMMARY, 300);
    const first = await wp6.service.analyzeNews('Nairobi commuter rail expansion', 'en');
    const second = await wp6.service.analyzeNews('Nairobi commuter rail expansion', 'en');
    expect(wp6.inputs).toHaveLength(1);
    expect(second.analysis?.summary).toBe(first.analysis?.summary);
    expect(second.provenance?.cached).toBe(true);
  });
});

describe('WP6 · enabled path — existing validators judge content, not formatting', () => {
  /* This phrasing (a reader-requested table) qualifies ONE independent report. The existing
     single-source rule (brief-compliance.util) then requires the brief to say so. */
  const question =
    'Give me a table about the Nairobi commuter rail expansion with columns: Step, Reported';
  const DISCLOSED = 'Based on one report: ';

  it('without the one-report disclosure: each is withheld for its CONTENT, and only WP6 meets the reader\x27s table', async () => {
    const wp6 = await serviceWith(WP6_SUMMARY);
    const plain = await serviceWith(PLAIN_SUMMARY);
    const a = await wp6.service.analyzeNews(question, 'en');
    const b = await plain.service.analyzeNews(question, 'en');
    expect(wp6.inputs).toHaveLength(1);
    expect(plain.inputs).toHaveLength(1);
    /* WP6: the table contract is met; the remaining gap is the single-source disclosure (content) */
    expect(a.analysis?.briefState?.reason).toMatch(/does not say it rests on one report/u);
    /* plain prose: the reader asked for a table and got none */
    expect(b.analysis?.briefState?.reason).toMatch(/requested table is missing/u);
  });

  it('with the disclosure, the WP6 answer (heading, bullets, bold, table) is accepted and served unchanged, one call', async () => {
    const summary = DISCLOSED + WP6_SUMMARY;
    const wp6 = await serviceWith(summary);
    const result = await wp6.service.analyzeNews(question, 'en');
    expect(wp6.inputs).toHaveLength(1);
    expect(result.analysis?.briefState?.availability ?? 'accepted').not.toBe(
      'withheld-non-compliant',
    );
    expect(result.analysis?.summary).toBe(summary);
  });
});
