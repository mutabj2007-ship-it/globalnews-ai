import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import {
  ANALYSIS_TOTAL_BUDGET_MS,
  type NewsArticle,
  type NewsResponse,
} from '@globalnews-ai/shared';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import { AnalysisService } from '../../analysis/service/analysis.service';
import { AnalysisConfigService } from '../../analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../../analysis/providers/mock-analysis.provider';
import type {
  AnalysisProvider,
  AnalysisProviderInput,
} from '../../analysis/interfaces/analysis-provider.interface';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';
import { ComputeMeterService } from '../../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { AskObservationService } from '../../ask-observability/ask-observation.service';
import { AskObservationRetentionService } from '../../ask-observability/ask-observation-retention.service';
import { AskV2Service } from '../ask-v2.service';
import { AskR2ExecutionAdapter } from '../ask-r2-execution.adapter';
import { askRequestContext } from '../ask-request-context';
import { accountPrincipal, guestPrincipal } from './ask-principal';
import { GuestSessionService } from './guest-session.service';
import { GuestClaimService } from './guest-claim.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 COMBINED-CANDIDATE BRIEF §5 — A GENUINELY CONTEXT-DEPENDENT FOLLOW-UP, BEFORE AND
 * AFTER GUEST SIGN-IN, THROUGH THE REAL APPLICATION PATH (FIXTURE EVIDENCE)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * REAL: AskV2Service (principals, owner-verified thread, slot ledger), the Ask R2 execution
 * adapter (frozen-C routing, controls, meter, breaker, switches, observation), the guest and
 * claim services, and the landed AnalysisService (retrieval routing, relevance gate, prompt
 * assembly, validation). FIXTURES: the news-provider transport (a fixed article pool behind
 * the real relevance gate) and the model (the repository's MockAnalysisProvider, wrapped to
 * record exactly what the model would receive). Real-source quality, real Google handover
 * and a physical keyboard are NOT measured here.
 *
 * The follow-up "How does this affect ordinary households?" names no subject: without the
 * prior turn it has nothing to retrieve. With it, the landed path routes retrieval by the
 * reader's PRIOR question and the model receives the conversation subject.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask V2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const IP = 'ip:v4:198.51.100.91';
const FOLLOW_UP = 'How does this affect ordinary households?';
const SETTINGS: Record<string, string> = {
  ASK_V2_ENABLED: 'true',
  ASK_R2_ENABLED: 'true',
  ASK_PUBLIC_COMPUTE_ENABLED: 'true',
  ASK_GUEST_TRIAL_ENABLED: 'true',
  ASK_FLAG_CACHE_MS: '0',
  ASK_BREAKER_CACHE_MS: '0',
  ASK_IP_UNITS_PER_DAY: '100000',
  ASK_GUEST_ATTEMPTS_PER_SESSION: '8',
  ASK_GUEST_UNITS_PER_SESSION: '48000',
  ASK_GUEST_POOL_UNITS_PER_HOUR: '50000',
  ASK_GUEST_POOL_UNITS_PER_DAY: '150000',
  ASK_GUEST_EXECUTIONS_PER_DAY: '20',
  ASK_GUEST_EXECUTIONS_PER_IP_DAY: '12',
  ASK_GUEST_SESSIONS_PER_IP_DAY: '5',
  ASK_GUEST_CONCURRENT_PER_SESSION: '1',
  ASK_GUEST_COOLDOWN_AFTER_NO_ANSWER: '3',
  ASK_GUEST_COOLDOWN_S: '600',
};

function article(id: string, title: string, summary: string): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://example.test/${id}`,
    sourceId: 'fixture',
    sourceName: `Fixture ${id}`,
    category: 'business',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
  };
}
/* A controlled economy answer with several developments, plus unrelated same-country items. */
const POOL: NewsArticle[] = [
  article(
    'ke-1',
    "Kenya's economy: central bank cuts policy rate to 9%",
    "Kenya's economy gets a rate cut as inflation eases; lenders expected to lower loan costs.",
  ),
  article(
    'ke-2',
    "Kenya's economy: inflation eases to 3.8% in September",
    "Food and fuel prices fell, the statistics bureau said of Kenya's economy.",
  ),
  article(
    'ke-3',
    "Kenya's economy: shilling steady after Eurobond buyback",
    "Traders said Kenya's economy benefits from lower external debt pressure.",
  ),
  article(
    'ke-x',
    'Kenya Airways adds a Nairobi–Lagos route',
    'The airline expands its West Africa network.',
  ),
  article(
    'gh-1',
    "Ghana's economy: cedi recovers after IMF review",
    "Ghana's economy steadies as reserves rise.",
  ),
];

live(
  'ASK R3 — context-dependent follow-up through the real path, before and after guest sign-in',
  () => {
    let db: PrismaClient;
    let values: Record<string, string>;
    let service: AskV2Service;
    let guests: GuestSessionService;
    let claims: GuestClaimService;
    let switches: OperationalSwitchService;
    const created: string[] = [];
    const searched: string[] = [];
    const modelInputs: AnalysisProviderInput[] = [];
    const config = { get: (key: string) => values[key] } as unknown as ConfigService;

    const news = {
      search: jest.fn(async (query: string): Promise<NewsResponse> => {
        searched.push(query);
        const articles = POOL.filter((a) => scoreGenericRelevance(a, query).isRelevant);
        return {
          articles,
          totalResults: articles.length,
          providers: ['fixture'],
          dataMode: 'live',
          generatedAt: new Date().toISOString(),
        };
      }),
      topHeadlines: jest.fn(async () => ({
        articles: [],
        totalResults: 0,
        providers: ['fixture'],
        dataMode: 'live',
        generatedAt: new Date().toISOString(),
      })),
      findArticleById: jest.fn(async () => null),
      findRetainedByQuery: jest.fn(async () => []),
    };
    const mock = new MockAnalysisProvider();
    const model: AnalysisProvider = {
      id: 'openai',
      displayName: 'Fixture model (MockAnalysisProvider)',
      isMock: false,
      analyzeNews: async (input: AnalysisProviderInput) => {
        modelInputs.push(input);
        input.usageSink?.({ promptTokens: 2500, completionTokens: 600 });
        return mock.analyzeNews(input);
      },
    };
    const analysisConfig = {
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

    function build(): void {
      const meter = new ComputeMeterService(db as unknown as PrismaService, config);
      const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
      switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
      guests = new GuestSessionService(db as unknown as PrismaService, config, meter, switches);
      claims = new GuestClaimService(db as unknown as PrismaService, guests, meter);
      const analysis = new AnalysisService(
        news as never,
        { getCountryNews: jest.fn() } as never,
        model,
        analysisConfig,
      );
      const adapter = new AskR2ExecutionAdapter(
        analysis,
        model as never,
        {
          id: 'mock',
          displayName: 'Mock',
          isMock: true,
          answerBackground: async () => ({ text: null }),
        } as never,
        meter,
        breaker,
        switches,
        analysisConfig,
        { registeredDomains: () => ['CONFLICT'] } as never,
        new AskObservationService(
          db as unknown as PrismaService,
          new AskObservationRetentionService(db as unknown as PrismaService),
        ),
        {
          boundSpecialistDomains: () => ['CONFLICT'],
          read: async () => ({ considered: [], contributions: [] }),
        } as never,
        guests,
      );
      service = new AskV2Service(
        db as unknown as PrismaService,
        config,
        adapter,
        guests,
        switches,
        meter,
      );
    }

    const asGuest = <T>(id: string, work: () => Promise<T>) =>
      askRequestContext.run({ accountId: null, guestSessionId: id, ipScope: IP }, work);
    const asAccount = <T>(id: string, work: () => Promise<T>) =>
      askRequestContext.run({ accountId: id, ipScope: IP }, work);
    const q = (question: string) => ({
      idempotencyKey: randomUUID(),
      question,
      language: 'en' as const,
      intent: 'ask' as const,
    });
    const answerOf = (op: { result: { payload: unknown } | null }) =>
      (op.result?.payload as { answer?: { state?: string } } | undefined)?.answer?.state;
    const articleIds = (input: AnalysisProviderInput | undefined) =>
      (input?.articles ?? []).map((a) => a.id).sort();

    async function newGuest() {
      const g = await guests.issue(IP, { cookie: () => undefined } as never);
      const row = await db.guestSession.findUniqueOrThrow({ where: { id: g.id } });
      const thread = await service.createThread(guestPrincipal(g.id), {
        idempotencyKey: randomUUID(),
        language: 'en',
      });
      return { id: g.id, tokenHash: row.tokenHash, threadId: thread.id };
    }

    beforeAll(async () => {
      process.env.OAUTH_FLOW_SECRET = process.env.OAUTH_FLOW_SECRET ?? 'test-flow-secret-r3';
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
      await db.$connect();
    });
    afterAll(async () => {
      await db.user.deleteMany({ where: { id: { in: created } } });
      await db?.$disconnect();
    });
    beforeEach(async () => {
      await db.$executeRawUnsafe(
        'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
      );
      values = { ...SETTINGS };
      searched.length = 0;
      modelInputs.length = 0;
      build();
      for (const name of [
        'ASK_R2_ENABLED',
        'ASK_PUBLIC_COMPUTE_ENABLED',
        'ASK_GUEST_TRIAL_ENABLED',
      ] as const) {
        await switches.set(name, true, 'r3-continuity-spec', 'disposable test database');
      }
      switches.forget();
    });

    it("NEGATIVE CONTROL · the same follow-up as a thread's FIRST turn has no subject: nothing about Kenya is retrieved", async () => {
      const g = await newGuest();
      const op = await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q(FOLLOW_UP)),
      );
      expect(searched.every((s) => !/kenya/i.test(s))).toBe(true);
      expect(modelInputs.some((i) => articleIds(i).some((id) => id.startsWith('ke-')))).toBe(false);
      expect(answerOf(op)).not.toBe('CURRENT_REPORTING');
    });

    it('BEFORE SIGN-IN (guest) · the follow-up is routed by the prior question and the model receives the conversation subject', async () => {
      const g = await newGuest();
      const first = await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q("What has changed in Kenya's economy?")),
      );
      expect(answerOf(first)).toBe('CURRENT_REPORTING');
      expect(articleIds(modelInputs[0])).toEqual(['ke-1', 'ke-2', 'ke-3']);

      searched.length = 0;
      const follow = await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q(FOLLOW_UP)),
      );
      expect(follow.status).toBe('COMPLETED');
      expect(answerOf(follow)).toBe('CURRENT_REPORTING');
      /* Retrieval used the prior subject, never the pronoun sentence. */
      expect(searched[0]).toBe('Kenya s economy');
      const input = modelInputs[1];
      /* The prior EVIDENCE family reaches the next turn: the same Kenya-economy reports, not the airline. */
      expect(articleIds(input)).toEqual(['ke-1', 'ke-2', 'ke-3']);
      /* The model still receives THIS turn's question, plus the conversation subject. */
      expect(input.query).toContain('ordinary households');
      expect(
        JSON.stringify(
          (input as unknown as { conversationSubject?: unknown }).conversationSubject ?? null,
        ),
      ).toMatch(/Kenya/);
      /* It counted as a guest answer. */
      expect((await service.guestAllowance(g.id)).committed).toBe(2);
    });

    it('AFTER SIGN-IN (account) · the claimed conversation keeps its context: the same follow-up after the claim is routed by the guest-era subject', async () => {
      const g = await newGuest();
      await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q("What has changed in Kenya's economy?")),
      );
      await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q('Why did that happen?')),
      );
      await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q('What caused it?')),
      );
      expect((await service.guestAllowance(g.id)).committed).toBe(3);

      const userId = randomUUID();
      await db.user.create({
        data: { id: userId, email: `r3-continuity-${userId}@example.invalid` },
      });
      created.push(userId);
      await claims.createClaim(g.id, g.threadId);
      expect(
        (await claims.transfer((await claims.pendingClaimFor(g.id)) as string, g.tokenHash, userId))
          .transferred,
      ).toBe(true);

      const callsBefore = modelInputs.length;
      searched.length = 0;
      const follow = await asAccount(userId, () =>
        service.submit(accountPrincipal(userId), g.threadId, q(FOLLOW_UP)),
      );
      expect(follow.status).toBe('COMPLETED');
      expect(answerOf(follow)).toBe('CURRENT_REPORTING');
      expect(modelInputs.length).toBe(callsBefore + 1);
      expect(searched[0]).toMatch(/Kenya s economy/);
      expect(articleIds(modelInputs[callsBefore]).every((id) => id.startsWith('ke-'))).toBe(true);
      expect((await service.getThread(accountPrincipal(userId), g.threadId)).turns).toHaveLength(4);
    });

    it('CHAINED follow-ups keep the subject: a follow-up after a follow-up continues the subject-bearing turn', async () => {
      const g = await newGuest();
      await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q("What has changed in Kenya's economy?")),
      );
      await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q('Why did that happen?')),
      );
      searched.length = 0;
      await asGuest(g.id, () => service.submit(guestPrincipal(g.id), g.threadId, q(FOLLOW_UP)));
      expect(searched[0]).toBe('Kenya s economy');
    });

    it("ISOLATION · another owner's thread never supplies context, and the same words after a different subject are a different request", async () => {
      const kenya = await newGuest();
      const ghana = await newGuest();
      await asGuest(kenya.id, () =>
        service.submit(
          guestPrincipal(kenya.id),
          kenya.threadId,
          q("What has changed in Kenya's economy?"),
        ),
      );
      await asGuest(ghana.id, () =>
        service.submit(
          guestPrincipal(ghana.id),
          ghana.threadId,
          q("What has changed in Ghana's economy?"),
        ),
      );
      searched.length = 0;
      const a = await asGuest(kenya.id, () =>
        service.submit(guestPrincipal(kenya.id), kenya.threadId, q(FOLLOW_UP)),
      );
      const b = await asGuest(ghana.id, () =>
        service.submit(guestPrincipal(ghana.id), ghana.threadId, q(FOLLOW_UP)),
      );
      expect(searched).toEqual(['Kenya s economy', 'Ghana s economy']);
      const opA = await db.computeOperation.findUniqueOrThrow({ where: { id: a.operationId } });
      const opB = await db.computeOperation.findUniqueOrThrow({ where: { id: b.operationId } });
      expect(opA.fingerprint).not.toBe(opB.fingerprint);
    });

    it('SELF-CONTAINED questions get no prior: asking the same question again in a thread with context still reuses its stored result (0 AI)', async () => {
      const g = await newGuest();
      await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q("What has changed in Kenya's economy?")),
      );
      await asGuest(g.id, () => service.submit(guestPrincipal(g.id), g.threadId, q(FOLLOW_UP)));
      const calls = modelInputs.length;
      const again = await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q("What has changed in Kenya's economy?")),
      );
      expect(again.storedResultReused).toBe(true);
      expect(modelInputs.length).toBe(calls);
    });

    it('ELLIPSIS stays honest: "And what about Uganda?" after a subject still asks (no silent place-only answer)', async () => {
      const g = await newGuest();
      await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q("What has changed in Kenya's economy?")),
      );
      const calls = modelInputs.length;
      const op = await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, q('And what about Uganda?')),
      );
      expect(answerOf(op)).toBe('CLARIFICATION_REQUIRED');
      expect(modelInputs.length).toBe(calls);
      expect((await service.guestAllowance(g.id)).committed).toBe(1);
    });
  },
);
