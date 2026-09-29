import type { CountryNewsResponse, NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { ANALYSIS_TOTAL_BUDGET_MS, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import {
  EVENT_FAMILIES,
  eventFamily,
  readRelationalEventQuestion,
  scoreRelationalEventRelevance,
} from './relational-event';
import { scoreGenericRelevance, scoreRelationalRelevance } from './generic-relevance.util';
import { scoreCountryRelevance } from '../country/country-relevance.util';
import { AnalysisService } from '../../analysis/service/analysis.service';
import type { RelevanceMode } from '../news.service';
import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { landedSpecialistRegistryPort } from '../../ask-router/specialist-registry.port';

/**
 * P1 MULTI-ENTITY / TOPIC RELEVANCE CLOSURE R1 — the regression matrix (A–G), at the
 * mechanism. Deterministic: the real AnalysisService, the real relevance gates applied to a
 * fixed corpus at the NewsService boundary, no network, no model (the analysis provider
 * records what it was given and stops).
 */
const art = (id: string, title: string, summary = ''): NewsArticle =>
  ({
    id,
    title,
    summary,
    url: `https://pub${id}.example/${id}`,
    sourceId: 'gnews',
    sourceName: `Publisher ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-29T06:00:00.000Z',
    publishedAtBasis: 'publisher',
  }) as NewsArticle;

/* Genuinely relevant Russia → Ukraine strike reporting, in varied wording. */
const R1 = art('r1', 'Russia launches massive missile and drone attack on Ukraine’s energy grid');
const R2 = art('r2', 'Ukraine says Russia fired 90 missiles and 400 drones overnight');
const R3 = art('r3', 'Kyiv hit by Russian drones; air defences shoot down 40');
const R4 = art(
  'r4',
  'Russian strike on Kharkiv kills three',
  'A Russian missile hit a residential building, Ukrainian officials said.',
);
const R5 = art('r5', 'Moscow pounds Kyiv with drones overnight'); // F: capitals, no country names
const R6 = art('r6', 'Russian forces shelled Ukrainian positions near the front'); // F: "shelled"
/* Negative controls. */
const RUSSIA_ONLY = art(
  'n1',
  'Russian central bank holds key rate',
  'The Bank of Russia kept its rate unchanged.',
);
const UKRAINE_ONLY = art(
  'n2',
  'Ukraine grain exports rise in September',
  'Ukraine exported more grain.',
);
const BOTH_OTHER_EVENT = art('n3', 'Russia and Ukraine hold grain talks in Istanbul');
const EVENT_ELSEWHERE = art(
  'n4',
  'Drone attack hits Sudan airport',
  'Russia condemned the strike.',
);
const SCATTERED = art(
  'n5',
  'Kremlin comments on Ukraine',
  'The statement was brief. Separately, a drone attack hit Syria.',
);

const RELEVANT = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
const CORPUS = [
  R1,
  R2,
  R3,
  R4,
  R5,
  R6,
  RUSSIA_ONLY,
  UKRAINE_ONLY,
  BOTH_OTHER_EVENT,
  EVENT_ELSEWHERE,
  SCATTERED,
];

function harness(corpus: NewsArticle[] = CORPUS) {
  const calls: Array<{ query: string; mode: string }> = [];
  const country: string[] = [];
  const sent: { ids: string[] | null } = { ids: null };
  const newsService = {
    search: jest.fn(async (query: string, _limit?: number, mode?: RelevanceMode) => {
      calls.push({ query, mode: mode?.type ?? 'none' });
      const articles = corpus.filter((a) => {
        if (mode?.type === 'relationalEvent') {
          const entities = mode.entities.map((i) => resolveCountryByAnyIdentifier(i)!);
          return scoreRelationalEventRelevance(a, entities, eventFamily(mode.familyId)).isRelevant;
        }
        if (mode?.type === 'relational')
          return scoreRelationalRelevance(a, mode.x, mode.y).isRelevant;
        if (mode?.type === 'generic') return scoreGenericRelevance(a, query).isRelevant;
        return true;
      });
      return {
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
        generatedAt: 'x',
      } as NewsResponse;
    }),
    topHeadlines: jest.fn(
      async () =>
        ({
          articles: [],
          totalResults: 0,
          providers: [],
          dataMode: 'live',
        }) as unknown as NewsResponse,
    ),
    findArticleById: jest.fn(async () => null),
    findRetainedByQuery: jest.fn(async () => []),
  };
  const countryNewsService = {
    getCountryNews: jest.fn(async (id: string) => {
      country.push(id);
      const c = resolveCountryByAnyIdentifier(id)!;
      const articles = corpus.filter((a) => scoreCountryRelevance(a, c).isRelevant);
      return {
        countryCode: c.iso3,
        countryName: c.name,
        articles,
        totalResults: articles.length,
        providers: ['gnews'],
        dataMode: 'live',
      } as unknown as CountryNewsResponse;
    }),
  };
  const provider = {
    id: 'mock',
    displayName: 'mock',
    isMock: true,
    analyzeNews: jest.fn(async (_q: string, articles: NewsArticle[]) => {
      sent.ids = articles.map((a) => a.id).sort();
      throw new Error('stop: model boundary');
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
      openAiModel: 'x',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 10,
    }),
  };
  const service = new AnalysisService(
    newsService as never,
    countryNewsService as never,
    provider as never,
    config as never,
  );
  const ask = async (q: string, lang: 'en' | 'pl' = 'en') => {
    /* what retrieval ADMITTED as evidence (the model boundary is stubbed and stops) */
    const response = await service.analyzeNews(q, lang).catch(() => null);
    return response === null ? null : response.articles.map((a) => a.id).sort();
  };
  return { ask, calls, country, provider };
}

describe('A — the original reproduction: genuinely relevant Russia → Ukraine reporting is retained', () => {
  it.each([
    'What are the latest reported Russian missile and drone attacks on Ukraine? Cite the sources.',
    'What are the latest Russian missile and drone attacks on Ukraine?',
    'Did Russia launch missile and drone attacks on Ukraine?',
  ])('%s', async (q) => {
    const h = harness();
    const sentToModel = await h.ask(q);
    /* both entities and the event reach retrieval; neither entity is narrowed away */
    expect(h.calls).toEqual([{ query: 'Russia Ukraine attack', mode: 'relationalEvent' }]);
    expect(h.country).toEqual([]); // no single-country collapse
    expect(sentToModel).toEqual(RELEVANT);
  });

  it('BEFORE the correction (proof of the mechanism): one entity, no topic, a decoy admitted', () => {
    /* The classifier path the old code took: the demonym's country news, unfiltered by the event. */
    const russia = resolveCountryByAnyIdentifier('RUS')!;
    expect(scoreCountryRelevance(RUSSIA_ONLY, russia).isRelevant).toBe(true);
    /* and the whole-sentence generic gate rejected every relevant report */
    const sentence = 'Did Russia launch missile and drone attacks on Ukraine';
    expect(CORPUS.filter((a) => scoreGenericRelevance(a, sentence).isRelevant)).toEqual([]);
  });
});

describe('B — reversed / rephrased relationship resolves to the same evidence', () => {
  it.each([
    'Has Ukraine been hit by Russian drones?',
    'Is Ukraine under Russian missile attack?',
    'What strikes has Russia carried out against Ukraine?',
  ])('%s', async (q) => {
    const h = harness();
    expect(await h.ask(q)).toEqual(RELEVANT);
    expect(h.calls[0]?.mode).toBe('relationalEvent');
  });
});

describe('C — multi-entity current event: no entity is silently discarded', () => {
  it('both entities are required together; the retrieval query carries both', () => {
    const shape = readRelationalEventQuestion(
      'What are the latest Russian missile and drone attacks on Ukraine?',
    )!;
    expect(shape.entities.map((e) => e.iso3)).toEqual(['RUS', 'UKR']);
    expect(shape.providerQuery).toBe('Russia Ukraine attack');
  });

  it.each([
    ['Did the United States impose new sanctions on Iran?', 'SANCTIONS', ['USA', 'IRN']],
    ['What are the latest Chinese tariffs on Canadian canola?', 'TRADE_MEASURES', ['CAN', 'CHN']],
    ['Has Israel launched airstrikes on Lebanon?', 'ARMED_ATTACK', ['ISR', 'LBN']],
  ])('general, not Russia/Ukraine: %s → %s', (q, family, isos) => {
    const shape = readRelationalEventQuestion(q)!;
    expect(shape.family.id).toBe(family);
    expect(shape.entities.map((e) => e.iso3).sort()).toEqual([...isos].sort());
  });

  it('a coordination the classifier already splits into sides keeps its per-side path — both sides retrieved', async () => {
    const h = harness([]);
    await h.ask('What is the latest on drone attacks between Russia and Ukraine?');
    expect(h.calls.some((c) => c.mode === 'relationalEvent')).toBe(false);
    expect(h.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('a two-entity event the classifier did NOT split keeps BOTH entities (US ↔ China talks)', async () => {
    const h = harness([]);
    await h.ask('Are the United States and China in trade talks?');
    expect(h.calls).toEqual([{ query: 'United States China talks', mode: 'relationalEvent' }]);
  });
});

describe('D / E — negative controls: one entity is never enough', () => {
  const shape = readRelationalEventQuestion(
    'Did Russia launch missile and drone attacks on Ukraine?',
  )!;
  const gate = (a: NewsArticle) =>
    scoreRelationalEventRelevance(a, shape.entities, shape.family).isRelevant;

  it('D — Russia mentioned, unrelated to the event → rejected', () => {
    expect(gate(RUSSIA_ONLY)).toBe(false);
  });
  it('E — Ukraine mentioned, unrelated to the event → rejected', () => {
    expect(gate(UKRAINE_ONLY)).toBe(false);
  });
  it('both entities but a different event → rejected', () => {
    expect(gate(BOTH_OTHER_EVENT)).toBe(false);
  });
  it('the event elsewhere with one entity reacting → rejected', () => {
    expect(gate(EVENT_ELSEWHERE)).toBe(false);
  });
  it('entities and event scattered across unrelated sentences → rejected', () => {
    expect(gate(SCATTERED)).toBe(false);
  });
});

describe('F — semantically equivalent event wording remains eligible', () => {
  const shape = readRelationalEventQuestion(
    'What are the latest Russian missile and drone attacks on Ukraine?',
  )!;
  it.each([R2, R3, R4, R5, R6])('%j', (a) => {
    expect(scoreRelationalEventRelevance(a, shape.entities, shape.family).isRelevant).toBe(true);
  });
  it('the event family is one closed, reviewed table (no stemming, no model)', () => {
    expect(EVENT_FAMILIES.map((f) => f.id)).toEqual([
      'ARMED_ATTACK',
      'SANCTIONS',
      'TALKS',
      'TRADE_MEASURES',
    ]);
  });
});

describe('G — accepted routing and follow-up behaviour is untouched', () => {
  const route = (q: string, lang: 'en' | 'pl') =>
    routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: lang,
        normalizationLanguage: lang,
        displayLanguage: lang,
        origin: 'ASK',
      },
      { computeConsent: 'GRANTED', requestInstant: '2026-09-29T10:00:00Z' },
      { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT']) },
    ).plan;

  it.each([
    ['pl', 'Co to jest NATO?'],
    ['pl', 'Dlaczego artykuł 5 NATO jest ważny?'],
    ['en', 'What is slip in an induction motor?'],
  ] as const)(
    '[%s] %s still routes to Reference Background and is not a relational event',
    (lang, q) => {
      expect(`${route(q, lang).questionClass} → ${route(q, lang).terminalState}`).toBe(
        'REFERENCE → REFERENCE_BACKGROUND_ONLY',
      );
      expect(readRelationalEventQuestion(q, lang)).toBeNull();
    },
  );

  it('Polish questions keep the Polish retrieval path (the shape is English-only)', () => {
    expect(
      readRelationalEventQuestion('Jakie są rosyjskie ataki dronów na Ukrainę?', 'pl'),
    ).toBeNull();
  });

  it.each(['What is happening in Ukraine?', 'What is the latest news from Russia?'])(
    'a single-country question keeps the country branch: %s',
    async (q) => {
      const h = harness([]);
      await h.ask(q);
      expect(h.country.length).toBe(1);
      expect(h.calls.some((c) => c.mode === 'relationalEvent')).toBe(false);
    },
  );
});

/*
 * ASK INTELLIGENCE BINDING R1 (§10) — the P1 release guard: when the question states who acts
 * on whom, a report stating the OPPOSITE direction never supports it.
 */
describe('§10 — directional negative control (P1 release guard)', () => {
  const dir = (q: string) => readRelationalEventQuestion(q)!;
  const gate = (q: string, a: NewsArticle) => {
    const shape = dir(q);
    return scoreRelationalEventRelevance(a, shape.entities, shape.family, shape.direction)
      .isRelevant;
  };
  const RUS_ON_UKR = 'What are the latest Russian missile and drone attacks on Ukraine?';
  const REVERSED = [
    art('x1', 'Ukrainian drones hit Russian oil refinery overnight'),
    art('x2', 'Ukraine strikes Russian air base with long-range drones'),
    art('x3', 'Russian refinery hit by Ukrainian drones'),
  ];

  it.each([
    [RUS_ON_UKR, 'RUS', 'UKR'],
    ['Did Russia launch missile and drone attacks on Ukraine?', 'RUS', 'UKR'],
    ['Has Ukraine been hit by Russian drones?', 'RUS', 'UKR'],
    ['What strikes has Russia carried out against Ukraine?', 'RUS', 'UKR'],
    ['What are the latest Ukrainian drone attacks on Russia?', 'UKR', 'RUS'],
  ])('%s → actor %s, target %s', (q, actor, target) => {
    expect(dir(q).direction).toMatchObject({ actor: { iso3: actor }, target: { iso3: target } });
  });

  it.each(REVERSED)(
    'Ukraine → Russia evidence does not support "Russia attacks Ukraine": %#',
    (a) => {
      expect(gate(RUS_ON_UKR, a)).toBe(false);
    },
  );

  it('the original Russia → Ukraine reporting still qualifies under the guard', () => {
    for (const a of [R1, R2, R3, R4, R5, R6]) expect(gate(RUS_ON_UKR, a)).toBe(true);
  });

  it('the reversed question accepts the reversed reporting (the guard is directional, not one-sided)', () => {
    const q = 'What are the latest Ukrainian drone attacks on Russia?';
    for (const a of REVERSED) expect(gate(q, a)).toBe(true);
  });

  it('no stated direction → the landed role-symmetric gate, unchanged', () => {
    const q = 'Are Russia and Ukraine exchanging drone strikes?';
    const shape = readRelationalEventQuestion(q);
    if (shape !== null) {
      expect(shape.direction).toBeNull();
      expect(
        scoreRelationalEventRelevance(REVERSED[0]!, shape.entities, shape.family, shape.direction)
          .isRelevant,
      ).toBe(true);
    }
  });
});
