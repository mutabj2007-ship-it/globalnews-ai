import { Test } from '@nestjs/testing';
import type { NewsArticle } from '@globalnews-ai/shared';
import {
  NewsService,
  readCandidatesSeen,
  readProviderFailures,
  readWindowExcluded,
} from '../news.service';
import type { NewsProvider } from '../interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../providers/provider.tokens';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { GNewsProviderError } from '../providers/gnews.provider';
import { withRetrievalDeadline } from '../retrieval-budget';
import { RetrievalTraceCollector, withRetrievalTrace } from './retrieval-trace';
import {
  finalizeAnalysisDiagnostics,
  localCoverageFor,
  withCoverage,
  type RetrievalDiagnostics,
} from './retrieval-diagnostics';

/*
  RETRIEVAL R1 · T1 — DETERMINISTIC TRACE FIXTURES.

  Every headline below is SYNTHETIC (written for this file). No real publisher text, no network,
  no model, no database. Each fixture asserts two things:
    1. the trace records the exact stage and cause; and
    2. DECISION IDENTITY — the same search, run with no trace scope (exactly the 129b547 path)
       and inside a trace scope, returns the same articles, the same side channels
       (candidatesSeen / providerFailures / windowExcluded), the same persistence calls and the
       same number of provider calls. The trace observes; it never decides.
*/

const NOW = '2026-10-11T12:00:00.000Z';

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id' | 'title'>): NewsArticle {
  return {
    summary: '',
    url: `https://synthetic.example/${overrides.id}`,
    sourceId: 'synthetic-wire',
    sourceName: 'Synthetic Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-10-09T10:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
    providerId: 'gnews',
    ...overrides,
  };
}

type Behaviour = { articles?: NewsArticle[]; failWith?: Error; delayMs?: number };

function stub(id: string, behaviour: Behaviour): NewsProvider & { calls: number } {
  const run = async (): Promise<NewsArticle[]> => {
    provider.calls += 1;
    if (behaviour.delayMs !== undefined) await new Promise((r) => setTimeout(r, behaviour.delayMs));
    if (behaviour.failWith) throw behaviour.failWith;
    return (behaviour.articles ?? []).map((a) => ({ ...a, providerId: id }));
  };
  const provider = {
    id,
    displayName: id,
    isMock: false,
    calls: 0,
    search: run,
    topHeadlines: run,
    category: run,
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: NOW };
    },
  };
  return provider as NewsProvider & { calls: number };
}

interface World {
  primary: Record<string, Behaviour>;
  fallback?: Record<string, Behaviour>;
  stored?: NewsArticle[];
}

async function build(world: World) {
  const primaries = Object.entries(world.primary).map(([id, b]) => stub(id, b));
  const fallbacks = Object.entries(world.fallback ?? {}).map(([id, b]) => stub(id, b));
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue(world.stored ?? []),
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
  return { service: moduleRef.get(NewsService), persistence, providers: active };
}

type SearchArgs = Parameters<NewsService['search']>;

function observable(
  response: Awaited<ReturnType<NewsService['search']>>,
  persistence: { persistMany: jest.Mock; findRecent: jest.Mock },
  providers: Array<{ calls: number }>,
) {
  return {
    articles: response.articles.map((a) => [a.id, a.countryCode ?? null]),
    totalResults: response.totalResults,
    providers: response.providers,
    dataMode: response.dataMode,
    fallbackReason: response.fallbackReason ?? null,
    candidatesSeen: readCandidatesSeen(response),
    failures: readProviderFailures(response),
    windowExcluded: [...readWindowExcluded(response)].sort(),
    persisted: persistence.persistMany.mock.calls.map((call) =>
      (call[0] as NewsArticle[]).map((a) => a.id),
    ),
    retainedQueries: persistence.findRecent.mock.calls.length,
    providerCalls: providers.map((p) => p.calls),
  };
}

/** Runs the same search untraced (129b547 behaviour) and traced; returns both and the envelope. */
async function runBoth(
  world: World,
  args: SearchArgs,
  wrap?: <T>(work: () => Promise<T>) => Promise<T>,
) {
  const outer = wrap ?? (<T>(work: () => Promise<T>) => work());
  const plain = await build(world);
  const plainResponse = await outer(() => plain.service.search(...args));

  const traced = await build(world);
  const collector = new RetrievalTraceCollector();
  const tracedResponse = await outer(() =>
    withRetrievalTrace(collector, () => traced.service.search(...args)),
  );
  const snapshot = collector.seal();
  const diagnostics = finalizeAnalysisDiagnostics(snapshot, {
    analysis: null,
    articles: tracedResponse.articles,
  });

  expect(observable(tracedResponse, traced.persistence, traced.providers)).toEqual(
    observable(plainResponse, plain.persistence, plain.providers),
  );
  expect(diagnostics.invariants).toEqual({ ok: true, violations: [] });
  return { response: tracedResponse, diagnostics, snapshot };
}

const causes = (d: RetrievalDiagnostics) =>
  d.causes.map((c) => `${c.cause}${c.detail === null ? '' : `:${c.detail}`}`);
const timeout = () => new GNewsProviderError('synthetic timeout', undefined, 'timeout');
const rateLimited = () => new GNewsProviderError('synthetic 429', undefined, 'rate-limited');
const generic = { type: 'generic' as const };

describe('T1 · FX-Q1 — 2 raw returned, 0 eligible, GDELT rescue times out', () => {
  const world: World = {
    primary: {
      gnews: {
        articles: [
          article({
            id: 'q1-a',
            title: 'UN warns of worsening humanitarian crisis in eastern DRC',
          }),
          article({ id: 'q1-b', title: 'Fighting in eastern Congo displaces thousands' }),
        ],
      },
    },
    fallback: { 'gdelt-doc': { failWith: timeout() } },
  };

  it('records RAW_RETURNED → RELEVANCE_REJECTED with reason codes, and the rescue timeout separately', async () => {
    const { response, diagnostics } = await runBoth(world, ['eastern DR Congo', 10, generic]);
    expect(response.articles).toHaveLength(0);

    const [gnews, gdelt] = diagnostics.attempts;
    expect(gnews).toMatchObject({
      providerId: 'gnews',
      tier: 'PRIMARY',
      outcome: 'SUCCESS',
      rawFetchedCount: 2,
    });
    expect(gdelt).toMatchObject({
      providerId: 'gdelt-doc',
      tier: 'RESCUE',
      outcome: 'TIMEOUT',
      rawFetchedCount: null,
    });

    const search = diagnostics.searches[0];
    expect(search?.postRelevanceRescue).toBe(true);
    expect(search?.stages).toMatchObject({ rawFetched: 2, relevanceRejected: 2, admittedLive: 0 });
    expect(search?.stages?.relevanceReasons).toEqual({
      'generic.no_whole_phrase_match_for_a_multiword_query': 2,
      'generic.no_governed_term_parity_match': 2,
    });

    expect(causes(diagnostics)).toEqual(
      expect.arrayContaining([
        'RELEVANCE_REJECTED:2',
        'PROVIDER_FAILED_TIMEOUT:gdelt-doc',
        'INCOMPLETE_CHECK',
      ]),
    );
    /* The defect R0 found (T-1): GNews answered, so it is never reported as empty or failed. */
    expect(causes(diagnostics).some((c) => c.startsWith('PROVIDER_EMPTY:gnews'))).toBe(false);
    expect(
      causes(diagnostics).some((c) => c.startsWith('PROVIDER_FAILED') && c.endsWith(':gnews')),
    ).toBe(false);
  });
});

describe('T1 · FX-Q2 — Kibirizi: zero fetched and GDELT 429', () => {
  it('distinguishes PROVIDER_EMPTY (GNews answered zero) from PROVIDER_FAILED_RATE_LIMIT (GDELT)', async () => {
    const { diagnostics } = await runBoth(
      {
        primary: { gnews: { articles: [] } },
        fallback: { 'gdelt-doc': { failWith: rateLimited() } },
      },
      ['flooding Kibirizi South Kivu', 10, generic],
    );
    expect(
      diagnostics.attempts.map((a) => [a.providerId, a.tier, a.outcome, a.rawFetchedCount]),
    ).toEqual([
      ['gnews', 'PRIMARY', 'ZERO_RAW', 0],
      ['gdelt-doc', 'FALLBACK', 'RATE_LIMIT', null],
    ]);
    expect(causes(diagnostics)).toEqual(
      expect.arrayContaining([
        'PROVIDER_EMPTY:gnews',
        'PROVIDER_FAILED_RATE_LIMIT:gdelt-doc',
        'INCOMPLETE_CHECK',
      ]),
    );
    expect(causes(diagnostics).some((c) => c.startsWith('RELEVANCE_REJECTED'))).toBe(false);
  });
});

describe('T1 · LOCAL-01 GOICO / Musanze', () => {
  it('a Kinyarwanda-language request records LANGUAGE_UNSUPPORTED_BY_PROVIDER (rw sent as en)', async () => {
    const { diagnostics } = await runBoth({ primary: { gnews: { articles: [] } } }, [
      'Isoko rya GOICO ryahiye',
      10,
      generic,
      { lang: 'rw' },
    ]);
    expect(diagnostics.searches[0]).toMatchObject({ requestedLang: 'rw', sentLangGnews: 'en' });
    expect(causes(diagnostics)).toEqual(
      expect.arrayContaining([
        'LANGUAGE_UNSUPPORTED_BY_PROVIDER:gnews:rw->en',
        'PROVIDER_EMPTY:gnews',
      ]),
    );
  });

  it('provider-raw-but-rejected: "Musanze market fire" loses a matching headline, and Musanze resolves to no country (D-21)', async () => {
    const { diagnostics } = await runBoth(
      {
        primary: {
          gnews: {
            articles: [article({ id: 'goico-en', title: 'Fire guts GOICO Plaza in Musanze' })],
          },
        },
      },
      ['Musanze market fire', 10, generic],
    );
    const stages = diagnostics.searches[0]?.stages;
    expect(stages).toMatchObject({
      rawFetched: 1,
      relevanceRejected: 1,
      admittedLive: 0,
      countryUnresolved: 1,
    });
    expect(stages?.countryTags).toEqual({});
    expect(causes(diagnostics)).toContain('RELEVANCE_REJECTED:1');
  });

  it('the exact-name variant is admitted, still with no persisted country (gazetteer gap recorded, not fixed)', async () => {
    const { response, diagnostics } = await runBoth(
      {
        primary: {
          gnews: {
            articles: [article({ id: 'goico-en', title: 'Fire guts GOICO Plaza in Musanze' })],
          },
        },
      },
      ['GOICO Plaza fire Musanze', 10, generic],
    );
    expect(response.articles.map((a) => a.id)).toEqual(['goico-en']);
    expect(diagnostics.searches[0]?.stages).toMatchObject({
      admittedLive: 1,
      countryUnresolved: 1,
      persistRequested: 1,
    });
  });

  it('a venue story with no market incident is recorded, not reinterpreted (T1 records classification only)', async () => {
    const { response, diagnostics } = await runBoth(
      {
        primary: {
          gnews: {
            articles: [
              article({
                id: 'goico-venue',
                title: 'Musanze traders reopen stalls at GOICO Plaza after renovation',
              }),
            ],
          },
        },
      },
      ['GOICO Plaza fire Musanze', 10, generic],
    );
    /* Measured at 129b547: the venue story without a fire is rejected by the generic gate. */
    expect(diagnostics.searches[0]?.stages).toMatchObject({
      rawFetched: 1,
      relevanceRejected: 1,
      admittedLive: 0,
    });
    expect(response.articles).toHaveLength(0);
  });

  it('RWA has no enabled local source and held candidates: NOT_IN_ENABLED_COVERAGE + NOT_RIGHTS_CLEARED', () => {
    const coverage = localCoverageFor('RWA', { RSS_FEEDS_ENABLED: 'false' });
    expect(coverage.enabledLocalSources).toBe(0);
    expect(coverage.heldLocalCandidates).toBeGreaterThan(0);
    const empty = finalizeAnalysisDiagnostics(new RetrievalTraceCollector().seal(), {
      analysis: null,
      articles: [],
    });
    expect(causes(withCoverage(empty, coverage))).toEqual(
      expect.arrayContaining([
        'NOT_IN_ENABLED_COVERAGE:RWA',
        `NOT_RIGHTS_CLEARED:RWA:${coverage.heldLocalCandidates} held`,
      ]),
    );
  });

  it('even with RSS switched on by environment, an uncleared Rwanda feed is not counted as enabled coverage', () => {
    const coverage = localCoverageFor('RWA', {
      RSS_FEEDS_ENABLED: 'true',
      RSS_FEED_SOURCES: 'feed:taarifa-rw,feed:ktpress-rw',
    });
    expect(coverage.enabledLocalSources).toBe(0);
  });
});

describe('T1 · REGIONAL-02 Tim Kennedy / Erik Prince — COD vs COG identity', () => {
  const world: World = {
    primary: {
      gnews: {
        articles: [
          article({
            id: 'tk-bare',
            title:
              "Erik Prince's forces suffer battlefield loss in Congo, former fighter among wounded",
          }),
          article({
            id: 'tk-cod',
            title: 'Tim Kennedy wounded in ambush in eastern DR Congo, sources say',
          }),
          article({ id: 'tk-place', title: 'Private contractors ambushed near Uvira, South Kivu' }),
        ],
      },
    },
  };

  it('records the persisted-country identity of every survivor (bare "Congo" → CG is made visible)', async () => {
    const { diagnostics } = await runBoth(world, ['Erik Prince Congo', 10, { type: 'none' }]);
    expect(diagnostics.searches[0]?.stages?.countryTags).toEqual({ CG: 1, CD: 2 });
  });

  it('a stored CG-tagged report is a GEO_CONTRADICTION for an eastern-DR-Congo question on the retained rung', async () => {
    const stored = [
      article({
        id: 'stored-cg',
        title:
          "Erik Prince's forces suffer battlefield loss in Congo, former fighter among wounded",
        countryCode: 'CG',
        publishedAt: '2026-10-09T19:56:00.000Z',
      }),
    ];
    const { response, diagnostics } = await runBoth(
      { primary: { gnews: { articles: [] } }, stored },
      ['Erik Prince eastern DR Congo battlefield', 10, generic],
    );
    expect(response.articles).toHaveLength(0);
    /* Measured at 129b547: the lexical gate rejects this row first; the country gate would ALSO
       reject it (CG contradicts the query's CD). Both facts are recorded, in stage order. */
    expect(diagnostics.searches[0]?.retained).toMatchObject({
      mode: 'TERM_PARITY',
      considered: 1,
      lexicalRejected: 1,
      geoRejected: 0,
      geoVerdicts: { ALSO_CONTRADICTS_QUERY_COUNTRY: 1 },
      admitted: 0,
    });
    expect(causes(diagnostics)).toContain('RELEVANCE_REJECTED:1');
  });
});

describe('T1 · GEO_CONTRADICTION as the deciding stage (lexical passes, country contradicts)', () => {
  it('a stored Tanzania report matching the terms is rejected by the country gate for a Mombasa (KEN) question', async () => {
    const stored = [
      article({
        id: 'stored-tz',
        title: 'Kenya: Mombasa port congestion pushes cargo south',
        summary:
          'Congestion at the Kenya port of Mombasa diverted shipments, Tanzania port officials said in Dar es Salaam.',
        countryCode: 'TZ',
      }),
    ];
    const { response, diagnostics } = await runBoth(
      { primary: { gnews: { articles: [] } }, stored },
      ['Mombasa port congestion Kenya', 10, generic],
    );
    expect(response.articles).toHaveLength(0);
    expect(diagnostics.searches[0]?.retained).toMatchObject({
      lexicalRejected: 0,
      geoRejected: 1,
      admitted: 0,
    });
    expect(diagnostics.searches[0]?.retained?.geoVerdicts).toEqual({
      CONTRADICTS_QUERY_COUNTRY: 1,
    });
    expect(causes(diagnostics)).toContain('GEO_CONTRADICTION:1');
  });
});

describe('T1 · R-04 Danish Refugee Council — recorded, never re-routed', () => {
  it('an organisation-acronym story keeps its own identity in the trace and admission is unchanged', async () => {
    const { diagnostics } = await runBoth(
      {
        primary: {
          gnews: {
            articles: [
              article({
                id: 'drc-org',
                title: 'Danish Refugee Council (DRC) expands aid in Ukraine and Somalia',
              }),
            ],
          },
        },
      },
      ['Danish Refugee Council eastern DR Congo', 10, generic],
    );
    const stages = diagnostics.searches[0]?.stages;
    expect(stages?.rawFetched).toBe(1);
    expect(stages?.countryTags.CD).toBeUndefined();
  });
});

describe('T1 · dedup of one story via two providers', () => {
  it('counts the cross-provider collapse and keeps a winner with a successful originating attempt', async () => {
    const same = {
      title: 'Port strike halts shipping at Dar es Salaam',
      publishedAt: '2026-10-09T08:00:00.000Z',
    };
    const { response, diagnostics } = await runBoth(
      {
        primary: {
          gnews: {
            articles: [
              article({ id: 'dup-gnews', url: 'https://outlet.example/port-strike', ...same }),
            ],
          },
        },
        fallback: {
          'gdelt-doc': {
            articles: [
              article({ id: 'dup-gdelt', url: 'https://outlet.example/port-strike', ...same }),
            ],
          },
        },
      },
      ['port strike Dar es Salaam', 10, generic, { alsoProviderIds: ['gdelt-doc'] }],
    );
    const stages = diagnostics.searches[0]?.stages;
    expect(stages?.rawFetched).toBe(2);
    expect(
      (stages?.perProviderDuplicatesCollapsed ?? 0) +
        (stages?.crossProviderDuplicatesCollapsed ?? 0),
    ).toBe(1);
    expect(response.articles).toHaveLength(1);
    expect(stages?.survivorsWithoutSuccessfulAttempt).toBe(0);
  });
});

describe('T1 · temporal — publication window, not event time', () => {
  it('an out-of-window report (event 17 Sep, published 18 Sep) is OUTSIDE_WINDOW; an in-window 9 Oct report of the same event is admitted', async () => {
    const { response, diagnostics } = await runBoth(
      {
        primary: {
          gnews: {
            articles: [
              article({
                id: 'early',
                title: 'Contractors ambushed in South Kivu, Uvira',
                publishedAt: '2026-09-18T09:00:00.000Z',
              }),
              article({
                id: 'late',
                title: 'Contractors ambushed in South Kivu last month, sources say',
                publishedAt: '2026-10-09T09:00:00.000Z',
              }),
            ],
          },
        },
      },
      ['South Kivu', 10, generic, { from: '2026-10-04T12:00:00.000Z', to: NOW }],
    );
    expect(diagnostics.searches[0]?.stages).toMatchObject({ rawFetched: 2, windowExcluded: 1 });
    expect(diagnostics.searches[0]?.window).toEqual({ from: '2026-10-04T12:00:00.000Z', to: NOW });
    expect(causes(diagnostics)).toEqual(expect.arrayContaining(['OUTSIDE_WINDOW:1']));
    expect(response.articles.map((a) => a.id)).toEqual(['late']);
  });
});

describe('T1 · provider timeout under budget — late completion never replaces the evidence used', () => {
  it('records NOT_AWAITED for the pipeline and the real late outcome separately', async () => {
    const world: World = {
      primary: {},
      fallback: {},
    };
    const slow = stub('gnews', {
      delayMs: 1500,
      articles: [article({ id: 'late-1', title: 'South Kivu update' })],
    });
    const persistence = {
      persistMany: jest.fn().mockResolvedValue(new Map()),
      findRecent: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: NEWS_PROVIDERS, useValue: [slow] },
        { provide: ALL_NEWS_PROVIDERS, useValue: [slow] },
        { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
        { provide: ArticlePersistenceService, useValue: persistence },
      ],
    }).compile();
    const service = moduleRef.get(NewsService);
    const collector = new RetrievalTraceCollector();
    const response = await withRetrievalDeadline(Date.now() + 2000, () =>
      withRetrievalTrace(collector, () => service.search('South Kivu', 10, generic)),
    );
    expect(response.articles).toHaveLength(0);
    expect(readProviderFailures(response)).toEqual([{ providerId: 'gnews', kind: 'timeout' }]);
    await new Promise((r) => setTimeout(r, 600)); // let the straggler settle before sealing
    const snapshot = collector.seal();
    expect(snapshot.attempts[0]).toMatchObject({
      providerId: 'gnews',
      outcome: 'NOT_AWAITED',
      rawFetchedCount: null,
      lateOutcome: 'SUCCESS',
      lateRawFetchedCount: 1,
    });
    const diagnostics = finalizeAnalysisDiagnostics(snapshot, { analysis: null, articles: [] });
    expect(causes(diagnostics)).toEqual(
      expect.arrayContaining(['PROVIDER_FAILED_NOT_AWAITED:gnews', 'INCOMPLETE_CHECK']),
    );
    void world;
  });
});

describe('T1 · budget skip — a provider never started is NOT_ASKED, never a provider failure', () => {
  it('records BUDGET_SKIPPED and PROVIDER_NOT_ASKED:<id>:budget', async () => {
    const { diagnostics } = await runBoth(
      { primary: { gnews: { articles: [article({ id: 'x', title: 'Anything' })] } } },
      ['anything', 10, generic],
      (work) => withRetrievalDeadline(Date.now() + 100, work),
    );
    expect(diagnostics.attempts[0]).toMatchObject({
      providerId: 'gnews',
      outcome: 'BUDGET_SKIPPED',
      initiatedAt: null,
    });
    expect(causes(diagnostics)).toEqual(
      expect.arrayContaining(['PROVIDER_NOT_ASKED:gnews:budget']),
    );
    expect(causes(diagnostics).some((c) => c.startsWith('PROVIDER_FAILED'))).toBe(false);
  });
});

describe('T1 · D-05 — why stored "seen" can be smaller than "admitted"', () => {
  it('a retained-rung answer stamps candidatesSeen with the LIVE count (0) while admitting stored rows', async () => {
    const stored = [
      article({
        id: 'kept-1',
        title: 'Nairobi commuter rail expansion approved by cabinet',
        countryCode: 'KE',
      }),
      article({
        id: 'kept-2',
        title: 'Cabinet approves Nairobi commuter rail funding',
        countryCode: 'KE',
      }),
    ];
    const { response, diagnostics } = await runBoth(
      { primary: { gnews: { articles: [] } }, stored },
      ['Nairobi commuter rail', 10, { type: 'none' }],
    );
    /* The existing side channel (129b547 semantics, unchanged): live candidates seen = 0 ... */
    expect(readCandidatesSeen(response)).toBe(0);
    /* ... while the response carries stored rows. Summed over searches, admitted > seen. */
    expect(response.articles.length).toBeGreaterThan(0);
    expect(diagnostics.searches[0]).toMatchObject({
      returnedFrom: 'RETAINED',
      returned: response.articles.length,
    });
    expect(diagnostics.searches[0]?.retained?.admitted).toBe(response.articles.length);
  });
});

describe('T1 · privacy — the envelope carries no question, query, title or URL', () => {
  it('serialises without any distinctive token from the query or the articles', async () => {
    const { diagnostics } = await runBoth(
      {
        primary: {
          gnews: {
            articles: [
              article({
                id: 'p-1',
                title: 'Zebrafinch quarry dispute widens',
                url: 'https://quarry.example/zebrafinch',
              }),
            ],
          },
        },
        fallback: { 'gdelt-doc': { failWith: timeout() } },
      },
      ['Xylophonist zebrafinch quarry dispute', 10, generic],
    );
    const text = JSON.stringify(diagnostics).toLowerCase();
    for (const token of [
      'xylophonist',
      'zebrafinch',
      'quarry',
      'quarry.example',
      'synthetic wire',
    ]) {
      expect(text).not.toContain(token);
    }
    expect(diagnostics.searches[0]?.queryFingerprint).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('T1 · no trace scope — the path outside an analysis run is untouched', () => {
  it('a search with no collector records nothing and behaves identically', async () => {
    const a = await build({
      primary: { gnews: { articles: [article({ id: 'h1', title: 'Headline one' })] } },
    });
    const response = await a.service.search('headline', 10, { type: 'none' });
    expect(response.articles.map((x) => x.id)).toEqual(['h1']);
  });
});
