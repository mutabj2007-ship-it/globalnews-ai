import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { GNewsProviderError } from '../../news/providers/gnews.provider';
import { isSameStory } from '../../news/identity/article-identity.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC BETA HARDENING R1G — EVIDENCE DELETION FAILS CLOSED, at the FINAL model boundary.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R1F measured that the former final gate — clusterDuplicateArticles (title Jaccard >= 0.6
 * within 12 h) — merged "Ukraine peace talks resume in Geneva" with "…collapse in Geneva", its
 * Polish equivalent, and cholera spreading in Sudan with cholera spreading in Yemen. Evidence
 * now collapses only when the identity ladder PROVES one story (isSameStory). These tests run
 * the real NewsService + AnalysisService and read the array actually handed to the model.
 *
 * [SYNTHETIC] controls; no provider or model is contacted.
 */

const NOW = Date.parse('2026-10-01T08:00:00Z');
let seq = 0;
function report(
  title: string,
  summary: string,
  host: string,
  minutesAgo: number,
  extra: Partial<NewsArticle> = {},
): NewsArticle {
  seq += 1;
  return {
    id: `r${seq}`,
    title,
    summary,
    url: `https://${host}/story-${seq}`,
    /* RIGHTS CONTAINMENT R1 — real provenance: GNews emits a publisher SLUG (lowercase letters, digits,
       hyphens), never a hostname; the host still decides url / sourceName exactly as before */
    sourceId: host.split('.').join('-'),
    sourceName: host,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
    publishedAtBasis: 'publisher',
    sourceLanguage: 'en',
    providerId: 'gnews',
    ...extra,
  };
}

async function services(opts: { live?: NewsArticle[]; retained?: NewsArticle[] }) {
  const gnews = {
    id: 'gnews',
    displayName: 'gnews',
    isMock: false,
    capabilities: ['search', 'top-headlines'],
    search: async () => [],
    topHeadlines: async () => {
      if (opts.live === undefined)
        throw new GNewsProviderError('GNews rate limit reached.', 429, 'rate-limited');
      return opts.live.map((a) => ({ ...a }));
    },
    category: async () => [],
    health: async () => ({
      providerId: 'gnews',
      displayName: 'gnews',
      status: 'ok',
      checkedAt: '',
    }),
  } as unknown as NewsProvider;
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue((opts.retained ?? []).map((a) => ({ ...a }))),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: [gnews] },
      { provide: ALL_NEWS_PROVIDERS, useValue: [gnews] },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  const model: AnalysisProvider = {
    id: 'openai',
    displayName: 'Fixture model',
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
  const service = new AnalysisService(
    moduleRef.get(NewsService),
    moduleRef.get(CountryNewsService),
    model,
    config,
  );
  const ask = async (language: 'en' | 'pl' = 'en') => {
    const result = await service.analyzeNews(
      language === 'en' ? 'Any global news can you share?' : 'Co się dzieje na świecie?',
      language,
      undefined,
      undefined,
      undefined,
      undefined,
      { broadHeadlines: true },
    );
    /* the FINAL post-dedup evidence array — exactly what the model was handed */
    const finalEvidence = inputs[inputs.length - 1]?.articles ?? [];
    return { result, finalEvidence };
  };
  return { ask };
}

/* ── NEGATIVE CONTROLS — distinct or contradictory reports; BOTH must reach the model ───────── */
const NEGATIVES: Array<[string, () => [NewsArticle, NewsArticle], 'en' | 'pl']> = [
  [
    'EN opposite outcomes: peace talks resume / collapse in Geneva',
    () => [
      report(
        'Ukraine peace talks resume in Geneva',
        'Delegations from Ukraine and Russia returned to the table in Geneva on Tuesday, mediators said.',
        'outlet-a.example',
        30,
      ),
      report(
        'Ukraine peace talks collapse in Geneva',
        'Delegations from Ukraine and Russia left the table in Geneva on Tuesday, mediators said.',
        'outlet-b.example',
        10,
      ),
    ],
    'en',
  ],
  [
    'EN same disease, different countries: cholera in Sudan / Yemen',
    () => [
      report(
        'Cholera outbreak spreads in Sudan camps, WHO warns',
        'The World Health Organization said cholera cases rose in displacement camps in Sudan.',
        'outlet-a.example',
        50,
      ),
      report(
        'Cholera outbreak spreads in Yemen, WHO warns',
        'The World Health Organization said cholera cases rose across Yemen after floods.',
        'outlet-b.example',
        20,
      ),
    ],
    'en',
  ],
  [
    'EN same company/product, different announcement',
    () => [
      report(
        'Google rolls out Gemini 4 Argon, its most advanced model',
        'Google released Gemini 4 Argon to developers and enterprise customers on Tuesday.',
        'outlet-a.example',
        50,
      ),
      report(
        'Google fined over Gemini 4 Argon data practices',
        'European regulators fined Google over how Gemini 4 Argon was trained on customer data.',
        'outlet-b.example',
        20,
      ),
    ],
    'en',
  ],
  [
    'EN same actor, different event',
    () => [
      report(
        'President meets EU leaders in Brussels',
        'The president met European Union leaders in Brussels to discuss defence spending.',
        'outlet-a.example',
        40,
      ),
      report(
        'President signs budget law at home',
        'The president signed the 2027 budget law on Wednesday.',
        'outlet-b.example',
        20,
      ),
    ],
    'en',
  ],
  [
    'EN same team, different event',
    () => [
      report(
        'Arsenal beat Chelsea 2-1 in Premier League derby',
        'Arsenal won the London derby against Chelsea at the Emirates Stadium.',
        'outlet-a.example',
        60,
      ),
      report(
        'Arsenal beat Bayern Munich in Champions League',
        'Arsenal won against Bayern Munich at the Emirates Stadium in the Champions League.',
        'outlet-b.example',
        30,
      ),
    ],
    'en',
  ],
  [
    'EN same place, unrelated incident',
    () => [
      report(
        'Fire destroys market in Nairobi',
        'Firefighters in Nairobi battled a blaze that destroyed hundreds of stalls.',
        'outlet-a.example',
        50,
      ),
      report(
        'Bus crash kills 12 in Nairobi',
        'A bus crashed on Thika Road in Nairobi, killing 12 passengers, police said.',
        'outlet-b.example',
        20,
      ),
    ],
    'en',
  ],
  [
    'EN follow-up that changes the outcome: found alive / found dead',
    () => [
      report(
        'Missing climbers found alive in the Tatras',
        'Rescuers said the two climbers missing in the Tatra mountains were found alive on Monday.',
        'outlet-a.example',
        300,
      ),
      report(
        'Climbers missing in the Tatras found dead, rescuers say',
        'Rescuers said the two climbers missing in the Tatra mountains were found dead on Monday.',
        'outlet-b.example',
        20,
      ),
    ],
    'en',
  ],
  [
    'PL opposite outcomes: rozmowy wznowione / zerwane',
    () => [
      report(
        'Rozmowy pokojowe w Genewie wznowione',
        'Delegacje Ukrainy i Rosji wróciły do stołu rozmów w Genewie, poinformowali mediatorzy.',
        'outlet-a.example',
        30,
        { sourceLanguage: 'pl' },
      ),
      report(
        'Rozmowy pokojowe w Genewie zerwane',
        'Delegacje Ukrainy i Rosji opuściły stół rozmów w Genewie, poinformowali mediatorzy.',
        'outlet-b.example',
        10,
        { sourceLanguage: 'pl' },
      ),
    ],
    'pl',
  ],
  [
    'PL same club, separate matches',
    () => [
      report(
        'Legia pokonała Lecha w Ekstraklasie',
        'Legia Warszawa wygrała z Lechem Poznań na własnym stadionie.',
        'outlet-a.example',
        60,
        { sourceLanguage: 'pl' },
      ),
      report(
        'Legia pokonała Rapid Wiedeń w Lidze Konferencji',
        'Legia Warszawa wygrała z Rapidem Wiedeń na własnym stadionie.',
        'outlet-b.example',
        30,
        { sourceLanguage: 'pl' },
      ),
    ],
    'pl',
  ],
  [
    'PL same place, unrelated incidents',
    () => [
      report(
        'Pożar hali w Krakowie',
        'Strażacy w Krakowie gasili pożar hali magazynowej.',
        'outlet-a.example',
        50,
        { sourceLanguage: 'pl' },
      ),
      report(
        'Wypadek tramwaju w Krakowie',
        'Tramwaj wykoleił się w centrum Krakowa, są ranni.',
        'outlet-b.example',
        20,
        { sourceLanguage: 'pl' },
      ),
    ],
    'pl',
  ],
];

describe('R1G · negative controls — both reports reach the FINAL evidence array', () => {
  it.each(NEGATIVES)('live headlines path — %s', async (_label, make, language) => {
    const [a, b] = make();
    expect(isSameStory(a, b)).toBe(false);
    const { ask } = await services({ live: [a, b] });
    const { finalEvidence } = await ask(language);
    expect(finalEvidence.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
  });

  it.each(NEGATIVES)(
    'retained path (no provider-level collapse) — %s',
    async (_label, make, language) => {
      const [a, b] = make();
      const { ask } = await services({ retained: [a, b] });
      const { result, finalEvidence } = await ask(language);
      expect(result.retrievalContext?.outcome).toBe('RETAINED_ONLY');
      expect(finalEvidence.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
    },
  );

  it('the retrieval trace counts the same conservative evidence (independentClusters)', async () => {
    const [a, b] = NEGATIVES[0]![1]();
    const { ask } = await services({ live: [a, b] });
    const { result, finalEvidence } = await ask();
    expect(finalEvidence).toHaveLength(2);
    expect(result.retrievalContext?.retrievalTrace?.independentClusters).toBe(2);
  });
});

/* ── POSITIVE CONTROLS — PROVEN duplicates; exactly ONE must survive ─────────────────────── */
const POSITIVES: Array<[string, () => [NewsArticle, NewsArticle]]> = [
  [
    'identical provider-native record id (different URLs and headlines)',
    () => [
      report('Central bank holds rates', 'The bank kept rates unchanged.', 'wire-a.example', 30, {
        providerRecordId: 'REC-1',
      }),
      report(
        'Central bank keeps rates on hold',
        'Rates were left unchanged.',
        'wire-b.example',
        20,
        { providerRecordId: 'REC-1' },
      ),
    ],
  ],
  [
    'same normalized URL (tracking parameter + fragment)',
    () => {
      const a = report(
        'Quake strikes off Hokkaido',
        'A magnitude 6.1 quake struck off Hokkaido.',
        'news.example',
        30,
      );
      return [
        a,
        {
          ...a,
          id: `${a.id}-tracked`,
          url: `${a.url}?utm_source=newsletter#top`,
          title: 'Quake strikes off Hokkaido (updated)',
        },
      ];
    },
  ],
  [
    'exact normalized headline + same source host + same basis, inside the window',
    () => [
      report(
        'Dangote refinery begins petrol exports',
        'The first cargo left Lagos.',
        'energy.example',
        60,
      ),
      report(
        'Dangote Refinery Begins Petrol Exports',
        'The first export cargo left Lagos on Tuesday.',
        'energy.example',
        20,
      ),
    ],
  ],
  [
    'exact normalized headline + same image + same basis, inside the window (different hosts)',
    () => [
      report(
        'ECB holds interest rates at 2.5%',
        'The deposit rate stays at 2.5%.',
        'outlet-a.example',
        40,
        { imageUrl: 'https://img.example/ecb.jpg' },
      ),
      report(
        'ECB holds interest rates at 2.5%',
        'The European Central Bank kept its rate.',
        'outlet-b.example',
        25,
        { imageUrl: 'https://img.example/ecb.jpg?utm_source=x' },
      ),
    ],
  ],
];

describe('R1G · positive controls — PROVEN duplicates collapse to one at the final boundary', () => {
  it.each(POSITIVES)('%s', async (_label, make) => {
    const [a, b] = make();
    expect(isSameStory(a, b)).toBe(true);
    /* retained path: NewsService does not collapse, so the FINAL boundary must */
    const { ask } = await services({ retained: [a, b] });
    const { finalEvidence } = await ask();
    expect(finalEvidence.map((x) => x.id)).toEqual([a.id]);
  });

  it('provider order is kept and maxArticles is unchanged (8) for distinct developments', async () => {
    const distinct = Array.from({ length: 11 }, (_, i) =>
      report(
        `Distinct development number ${i + 1} in city ${i + 1}`,
        `Report ${i + 1}.`,
        `outlet-${i}.example`,
        60 - i,
      ),
    );
    const { ask } = await services({ live: distinct });
    const { finalEvidence } = await ask();
    expect(finalEvidence.map((x) => x.id)).toEqual(distinct.slice(0, 8).map((x) => x.id));
  });
});
