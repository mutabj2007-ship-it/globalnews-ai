import { readFileSync } from 'fs';
import { join } from 'path';
import { ANALYSIS_TOTAL_BUDGET_MS, type CountryNewsResponse, type NewsArticle, type NewsResponse } from '@globalnews-ai/shared';
import { InterceptorsConsumer } from '@nestjs/core/interceptors/interceptors-consumer';
import { lastValueFrom, map as mapRx, of, type Observable } from 'rxjs';
import { FEED_SOURCES, resolveActiveFeedSources, type FeedSourceEntry } from '../providers/feed-source-registry';
import {
  __setReaderRightsFixtureModeForTests,
  __setReaderRightsTestFeeds,
  readerRightsDecision,
  readerRightsEnforced,
  withholdThirdPartyArticles,
} from './reader-rights';
import { ReaderRightsInterceptor } from './reader-rights.interceptor';
import { __setProviderAdmissionTestFeeds, providerAdmission } from './provider-admission';
import {
  admittedStoredSourceWhere,
  partitionByRights,
  sourceUseDecision,
  storedRowExclusionReason,
} from './source-use-policy';
import { withheldForSourceRights } from '../../ask-v2/source-rights-withholding';
import { AnalysisService } from '../../analysis/service/analysis.service';
import type { AnalysisConfigService } from '../../analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../../analysis/providers/mock-analysis.provider';
import { AskR2ExecutionAdapter } from '../../ask-v2/ask-r2-execution.adapter';
import { askRequestContext } from '../../ask-v2/ask-request-context';
import type { AskRequest } from '../../ask-v2/ask-compute.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R81 / E1 D2 (#93 J-10) — ALPHA RIGHTS CONVERGENCE: ONE FAIL-CLOSED AUTHORITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1_D2_ALPHA_RECONCILIATION_HOLD found Alpha's polarity inverted: provider items with basis
 * PROVIDER_PENDING_REVIEW were ADMITTED (record mode) to the model and the reader, /news/*, Home and
 * country routes had no withholding, and provider acquisition was ungated. These tests are E1's
 * AR-1 … AR-7 on the converged tree, with enforcement ON (the running-service state) and ONE
 * test-only CLEARED feed as the positive control (the reviewed registry has none).
 * AR-6 (mutations) is run by the qualification script against this file.
 */
const CLEARED = 'feed:r81-test-cleared';
const TEST_FEEDS: readonly FeedSourceEntry[] = [
  ...FEED_SOURCES,
  {
    sourceId: CLEARED,
    displayName: 'R81 Test Cleared Publisher',
    countryCode: 'KE',
    sourceType: 'NEWS_PROVIDER',
    feedUrl: 'https://cleared.example/feed',
    canonicalHost: 'cleared.example',
    language: 'en',
    enabled: false,
    provenanceNote: 'TEST ONLY — R81 no-false-negative fixture.',
    verifiedAt: '2026-10-15',
    rights: { state: 'CLEARED', evidence: 'TEST ONLY' },
  } as unknown as FeedSourceEntry,
];

beforeAll(() => {
  __setReaderRightsFixtureModeForTests(false);
  __setReaderRightsTestFeeds(TEST_FEEDS);
  __setProviderAdmissionTestFeeds(TEST_FEEDS);
});
afterAll(() => {
  __setReaderRightsTestFeeds(null);
  __setProviderAdmissionTestFeeds(null);
  __setReaderRightsFixtureModeForTests(true);
});

const article = (id: string, sourceId: string, over: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id,
    title: `Kenya budget ${id} report`,
    summary: 'Kenya budget summary',
    url: `https://news.example/${id}`,
    imageUrl: `https://img.example/${id}.jpg`,
    sourceId,
    sourceName: 'Some Publisher',
    category: 'world',
    sourcesCount: 1,
    countryCode: 'KEN',
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher',
    ...over,
  }) as NewsArticle;
const gnews = (id: string) => ({ ...article(id, 'some-publisher'), providerId: 'gnews' });

describe('the one switch: a running service is enforced', () => {
  it('enforcement is on outside fixture mode, and every gate reads the same switch', () => {
    expect(readerRightsEnforced()).toBe(true);
    const sources = ['source-use-policy.ts', 'reader-rights.ts', 'provider-admission.ts', 'reader-rights.interceptor.ts'].map((f) =>
      readFileSync(join(__dirname, f), 'utf8'),
    );
    for (const s of sources) expect(s).toMatch(/readerRightsEnforced/);
    /* no explicit `record` remains in application code of the policy (only the type and the fixture default) */
    expect(sources[0]).not.toMatch(/enforcement: 'record'/);
  });
});

describe("AR-3 — PROVIDER_PENDING_REVIEW is WITHHELD, not counted (closes D2-1)", () => {
  it('a GNews provider item: excluded for AI_INPUT and for METADATA, never admitted as pending', () => {
    for (const use of ['AI_INPUT', 'METADATA'] as const) {
      const d = sourceUseDecision(gnews('g1'), use);
      expect(d.allowed).toBe(false);
    }
    const { allowed, excluded, pending } = partitionByRights([gnews('g1'), gnews('g2')], 'AI_INPUT');
    expect(allowed).toEqual([]);
    expect(pending).toEqual([]);
    expect(excluded.map((e) => e.reason)).toEqual(['PROVIDER_RIGHTS_NOT_CLEARED', 'PROVIDER_RIGHTS_NOT_CLEARED']);
  });
  it('a stored provider row (no providerId) is not obtainable: repository check and query agree', () => {
    expect(storedRowExclusionReason('reuters', TEST_FEEDS)).not.toBeNull();
    expect(storedRowExclusionReason(CLEARED, TEST_FEEDS)).toBeNull();
    const where = JSON.stringify(admittedStoredSourceWhere(TEST_FEEDS));
    expect(where).toContain(CLEARED);
    expect(where).not.toMatch(/"NOT":\{"sourceId":\{"startsWith":"feed:"\}\}/);
  });
  it('one authority: the reader decision IS the external-reader policy decision', () => {
    for (const id of ['some-publisher', CLEARED, 'feed:taarifa-rw', 'social:x:someone', '']) {
      expect(readerRightsDecision(id, TEST_FEEDS).allowed).toBe(sourceUseDecision({ sourceId: id }, 'METADATA', { enforcement: 'enforce', feeds: TEST_FEEDS }).allowed);
    }
  });
});

describe('AR-1 — no CLEARED feed: reader JSON on every public route carries no uncleared article object', () => {
  const run = async (path: string, body: unknown) => {
    const headers: Record<string, string> = {};
    const ctx = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ originalUrl: path }), getResponse: () => ({ setHeader: (k: string, v: string) => (headers[k] = v) }) }),
    } as never;
    const out = await lastValueFrom(new ReaderRightsInterceptor().intercept(ctx, { handle: () => of(body) }) as Observable<unknown>);
    return { out, headers };
  };
  const news: NewsResponse = { articles: [gnews('g1'), article('g2', 'bbc')], totalResults: 2, providers: ['gnews'], dataMode: 'live', generatedAt: '2026-10-15T00:00:00Z' } as NewsResponse;
  it.each([
    ['/news/search?q=kenya', news],
    ['/news/top-headlines', news],
    ['/news/category/world', news],
    ['/news/country/KEN', { countryCode: 'KEN', countryName: 'Kenya', ...news } as unknown as CountryNewsResponse],
    ['/home/editorial', { stories: [{ id: 'a1', url: 'https://x.example/a1', title: 'Headline', summary: 's', imageUrl: 'https://img/x.jpg', sourceId: 'reuters', sourceName: 'Reuters' }] }],
    ['/stories/search?q=x', [{ id: 'a1', url: 'https://x.example/a1', title: 'Headline', sourceId: 'reuters' }]],
    ['/analysis/news', { articles: [gnews('g1')], analysis: { sources: [{ articleId: 'g1', title: 'Kenya budget g1 report', url: 'https://news.example/g1', publisher: 'P' }] } }],
    ['/users/me/saved/stories', { items: [{ id: 's1', title: 'Saved', url: 'https://x.example/s', sourceName: 'Reuters' }] }],
    ['/alerts/inbox', { events: [{ articleId: 'a1', title: 'Alert headline', url: 'https://x.example/a', sourceName: 'Reuters' }] }],
  ])('%s → no headline, link or image of an uncleared item; withheld is said', async (path, body) => {
    const { out, headers } = await run(path, body);
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/https:\/\/(news|x)\.example\//);
    expect(json).not.toMatch(/img/);
    expect(Number(headers['X-Source-Rights-Withheld'])).toBeGreaterThan(0);
  });
  it('internal admin and health routes are not reader surfaces', async () => {
    const { out } = await run('/admin/news', news);
    expect(out).toBe(news);
  });
  it('the analysis model gate: GNews-only evidence → no model call, no article, told "withheld" (never "no reporting")', async () => {
    const provider = new MockAnalysisProvider();
    const spy = jest.spyOn(provider, 'analyzeNews');
    const result = await analysis(countryResp([gnews('g1'), article('g2', 'reuters')]), provider).analyzeNews('What is happening in Kenya?');
    expect(spy).not.toHaveBeenCalled();
    expect(result.articles).toEqual([]);
    expect(result.retrievalContext.rightsExcluded?.count).toBe(2);
    expect(result.analysisError).toMatch(/^Reporting was found, but it cannot be shown or used here/);
  });
});

describe('AR-2 — positive control: a CLEARED feed item is served and reaches the model; a provider item beside it does not', () => {
  it('reader JSON keeps the CLEARED article with its image', () => {
    const { value, withheld } = withholdThirdPartyArticles({ articles: [article('c1', CLEARED), gnews('g1')] }, TEST_FEEDS);
    expect((value as { articles: NewsArticle[] }).articles.map((a) => a.id)).toEqual(['c1']);
    expect((value as { articles: NewsArticle[] }).articles[0].imageUrl).toBe('https://img.example/c1.jpg');
    expect(withheld).toBe(1);
  });
  it('the model receives only the CLEARED article', async () => {
    const provider = new MockAnalysisProvider();
    const spy = jest.spyOn(provider, 'analyzeNews');
    const result = await analysis(countryResp([article('c1', CLEARED), gnews('g1')]), provider).analyzeNews('What is happening in Kenya?');
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as { articles: NewsArticle[] }).articles.map((a) => a.id)).toEqual(['c1']);
    expect(result.articles.map((a) => a.id)).toEqual(['c1']);
  });
  it('acquisition: the feed lane is admitted with a CLEARED feed; GNews is not', () => {
    expect(providerAdmission({ id: 'rss-feeds' }).admitted).toBe(true);
    expect(providerAdmission({ id: 'gnews' })).toEqual({ admitted: false, reason: 'NO_RECORDED_RIGHT' });
  });
});

describe('Ask payloads read by any reader (fresh, reopened, guest) — R53 / R54 forward-adapted', () => {
  const sourced = (articles: unknown[], extra: Record<string, unknown> = {}) => ({
    schema: 'ask-r2-result/1',
    route: { r: 1 },
    chips: { kind: 'SCOPED', chips: [] },
    checkedAt: '2026-10-15T00:00:00Z',
    aiExecuted: true,
    answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [], text: 'PROSE FROM SOURCE' },
    analysis: { articles, analysis: { summary: 'Model prose written from the evidence [1].' } },
    guidance: { currentPart: 'SOURCED', objective: 'DERIVED GUIDANCE' },
    verification: { asOf: '2026-10-15', reports: 2 },
    continuation: { answeredAs: 'DERIVED' },
    artifact: { kind: 'SUMMARY', provenance: 'SOURCED_REPORTING', components: ['SOURCE CLAIM'], evidenceUrls: ['https://news.example/g1'] },
    ...extra,
  });
  it('R54 allowlist: a withheld answer keeps only identity, scope and run facts — nothing source-derived anywhere', () => {
    const out = withheldForSourceRights(sourced([gnews('g1')])) as Record<string, unknown>;
    const json = JSON.stringify(out);
    for (const leak of ['PROSE FROM SOURCE', 'Model prose', 'DERIVED GUIDANCE', 'DERIVED', 'SOURCE CLAIM', 'news.example', 'asOf']) {
      expect(json).not.toContain(leak);
    }
    expect(out).toMatchObject({ schema: 'ask-r2-result/1', checkedAt: '2026-10-15T00:00:00Z', answer: { state: 'INSUFFICIENT', basis: 'WITHHELD_SOURCE_RIGHTS' }, withheld: { reason: 'SOURCE_RIGHTS', count: 1 } });
  });
  it('R53: a sourced artifact on a payload whose own evidence is gone is withheld alone (claims, URLs)', () => {
    const out = withheldForSourceRights({ ...sourced([]), analysis: null }) as Record<string, unknown>;
    expect(out.artifact).toBeNull();
    expect(JSON.stringify(out)).not.toContain('SOURCE CLAIM');
    expect(out.withheld).toBeUndefined();
  });
  it('preserved: a general-knowledge answer (no evidence, unsourced artifact) is returned unchanged', () => {
    const gk = { schema: 'ask-r2-result/1', answer: { state: 'REFERENCE_BACKGROUND' }, background: { text: 'Inflation is…' }, artifact: { kind: 'CONCEPTUAL_FRAMEWORK', provenance: 'MODEL_PRIOR', components: ['prices'] } };
    expect(withheldForSourceRights(gk)).toBe(gk);
  });
  it('positive control: a CLEARED-feed answer keeps its analysis and its verified artifact', () => {
    const c = article('c1', CLEARED);
    const p = sourced([c], { artifact: { kind: 'SUMMARY', provenance: 'SOURCED_REPORTING', components: ['ok'], evidenceUrls: [c.url] } });
    const out = withheldForSourceRights(p) as Record<string, unknown>;
    expect(out.analysis).toEqual(p.analysis);
    expect(out.artifact).toEqual(p.artifact);
  });
});

describe('AR-4 — ReaderRightsInterceptor is the FIRST global interceptor (outermost)', () => {
  const order = () =>
    [...readFileSync(join(__dirname, '..', '..', '..', 'app.module.ts'), 'utf8').matchAll(/provide: APP_INTERCEPTOR,\s*useClass: (\w+),/g)].map((m) => m[1]);
  it('app.module.ts lists it before every other global interceptor', () => {
    expect(order()[0]).toBe('ReaderRightsInterceptor');
    expect(order()).toContain('PublisherImageWithholdingInterceptor');
  });
  const adds = { intercept: (_c: unknown, n: { handle: () => Observable<unknown> }) => n.handle().pipe(mapRx((b) => ({ ...(b as object), extra: [gnews('late')] }))) };
  const ctx = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({ originalUrl: '/news/search' }), getResponse: () => ({ setHeader: () => undefined }) }) } as never;
  const consume = async (interceptors: unknown[]) =>
    lastValueFrom(
      (await new InterceptorsConsumer().intercept(interceptors as never, [], { constructor: Object } as never, (() => undefined) as never, async () => ({ articles: [] }), 'http')) as Observable<unknown>,
    );
  it('first = outermost: what an inner interceptor adds is still withheld', async () => {
    expect(JSON.stringify(await consume([new ReaderRightsInterceptor(), adds]))).not.toContain('news.example/late');
    void ctx;
  });
  it('control: registered after it, the same addition would reach the reader (the order is what protects)', async () => {
    expect(JSON.stringify(await consume([adds, new ReaderRightsInterceptor()]))).toContain('news.example/late');
  });
});

describe('AR-5 — an UNRESOLVED feed named in RSS_FEED_SOURCES is refused (Alpha CLEARED-only activation)', () => {
  it('every non-CLEARED registry row named in the allowlist is refused; nothing becomes active', () => {
    const named = FEED_SOURCES.map((f) => f.sourceId).join(',');
    const sel = resolveActiveFeedSources(FEED_SOURCES, named);
    expect(sel.sources).toEqual([]);
    expect(sel.refused.length).toBe(FEED_SOURCES.length);
  });
});

describe('derived content — a stored story Brief resting on an uncleared source is withheld at read time', () => {
  const brief = (refs: unknown) => ({
    id: 'v1', storyId: 's1', version: 1, state: 'SUPPORTED', evidenceRevision: 'r1', materialVersion: 1,
    blocks: { summary: 'MODEL PROSE FROM SOURCES' }, evidenceRefs: Array.isArray(refs) && refs.every((r) => typeof r === 'string') ? (refs as string[]).map((id) => ({ id })) : refs, coverageGaps: [], uncertainty: [],
    asOf: new Date('2026-10-15T00:00:00Z'), generatedAt: new Date('2026-10-15T00:00:00Z'), sourceOperationId: null, createdAt: new Date(),
  });
  const service = (refs: unknown, rows: Array<{ id: string; sourceId: string; url: string }>) => {
    const prisma = {
      storyBriefVersion: { findFirst: jest.fn(async () => brief(refs)), count: jest.fn(async () => 1) },
      storyBriefAttempt: { findFirst: jest.fn(async () => null) },
      article: { findMany: jest.fn(async () => rows) },
      storyArticle: { findMany: jest.fn(async () => [{ articleRef: 'a', articleUrl: 'https://x' }]) },
    };
    const identity = { describe: jest.fn(async () => ({ storyId: 's1', aliasIds: ['s1'], briefVersion: 1 })) };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StoryBriefService } = require('../../story-brief/story-brief.service');
    return new StoryBriefService(prisma as never, identity as never, { available: true, generate: jest.fn() } as never);
  };
  it('a Brief built from a GNews-origin stored row: no prose reaches the reader; withheld is said', async () => {
    const view = await service(['g1'], [{ id: 'g1', sourceId: 'reuters', url: 'https://reuters.example/a' }]).read('s1');
    expect(view.brief).toBeNull();
    expect(view.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 1 });
    expect(JSON.stringify(view)).not.toContain('MODEL PROSE');
  });
  /* CTO R82 — a model-written Brief whose evidence cannot be verified never reaches a reader */
  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty', []],
    ['malformed (no ids)', [{ ref: 'x' }, { id: 7 }, 'loose']],
    ['not an array', { id: 'c1' }],
  ])('evidence refs %s → the Brief is withheld (unverifiable prose)', async (_label, refs) => {
    const view = await service(refs, [{ id: 'c1', sourceId: CLEARED, url: 'https://cleared.example/a' }]).read('s1');
    expect(view.brief).toBeNull();
    expect(view.withheld?.reason).toBe('SOURCE_RIGHTS');
    expect(JSON.stringify(view)).not.toContain('MODEL PROSE');
  });
  it('a CLEARED ref beside a malformed one does not let the Brief through', async () => {
    const view = await service([{ id: 'c1' }, { id: 7 }], [{ id: 'c1', sourceId: CLEARED, url: 'https://cleared.example/a' }]).read('s1');
    expect(view.brief).toBeNull();
    expect(view.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 1 });
  });
  it('positive control: a Brief resting only on a CLEARED feed row is shown', async () => {
    const view = await service(['c1'], [{ id: 'c1', sourceId: CLEARED, url: 'https://cleared.example/a' }]).read('s1');
    expect(view.brief?.blocks).toEqual({ summary: 'MODEL PROSE FROM SOURCES' });
    expect(view.withheld).toBeUndefined();
  });
});

describe('AR-7 — general-knowledge Ask still succeeds with every gate on, and no provider executes', () => {
  it('the economics concept question: one background answer, zero news calls', async () => {
    expect(readerRightsEnforced()).toBe(true);
    const news = jest.fn();
    const background = jest.fn(async () => ({ text: 'Growth is output; inflation is the price level.\n\nMore.' }));
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews: news } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false, answerBackground: background } as never,
      { config: { outputWeight: 4 }, reserve: jest.fn(async () => ({ admitted: true, reservationId: 'r', estimatedUnits: 1 })), settle: jest.fn(async () => true) } as never,
      { permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' })), record: jest.fn(async () => undefined) } as never,
      { isEnabled: jest.fn(async () => true) } as never,
      { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: jest.fn(async () => true) } as never,
      { boundSpecialistDomains: () => ['CONFLICT'], read: jest.fn(async () => ({ considered: [], contributions: [] })) } as never,
    );
    const request = { question: 'Explain the difference between economic growth and inflation in simple terms.', language: 'en', intent: 'ask' } as AskRequest;
    const payload = await askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never, async () => {
      const plan = await adapter.prepare(request);
      return JSON.parse((await adapter.execute(request, plan, 'op-ar7')).payloadJson);
    });
    expect(news).not.toHaveBeenCalled();
    expect(background).toHaveBeenCalledTimes(1);
    expect(payload.answer.state).not.toBe('CLARIFICATION_REQUIRED');
  });
});

/* ── helpers ── */
function countryResp(articles: NewsArticle[]): CountryNewsResponse {
  return { countryCode: 'KEN', countryName: 'Kenya', articles, totalResults: articles.length, providers: ['gnews'], dataMode: 'live', feedTier: 'delayed', providerDisplayName: 'GNews', generatedAt: new Date().toISOString() } as unknown as CountryNewsResponse;
}
function analysis(country: CountryNewsResponse, provider: MockAnalysisProvider): AnalysisService {
  const empty = { articles: [], totalResults: 0, providers: ['gnews'], dataMode: 'live', generatedAt: new Date().toISOString() } as unknown as NewsResponse;
  const config = {
    get: () => ({
      maxArticles: 8, maxArticleChars: 1200, timeoutMs: 20000, totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS, cacheTtlSeconds: 0,
      openAiApiKey: undefined, openAiModel: 'gpt-4o-mini', executionMode: 'development' as const, retryAttempts: 2,
      retryBaseDelayMs: 300, maxCompletionTokens: 2000, rightsAudience: 'EXTERNAL_READER' as const,
    }),
  } as unknown as AnalysisConfigService;
  return new AnalysisService(
    {
      search: jest.fn().mockResolvedValue(empty), topHeadlines: jest.fn().mockResolvedValue(empty), findArticleById: jest.fn().mockResolvedValue(null),
      findRetainedByCountry: jest.fn(async () => []), findRetainedByQuery: jest.fn(async () => []),
    } as never,
    { getCountryNews: jest.fn().mockResolvedValue(country) } as never,
    provider,
    config,
  );
}
