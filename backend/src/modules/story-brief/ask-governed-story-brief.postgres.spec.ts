import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { AskV2Service } from '../ask-v2/ask-v2.service';
import { AskR2ExecutionAdapter } from '../ask-v2/ask-r2-execution.adapter';
import { GuestSessionService } from '../ask-v2/guest/guest-session.service';
import { askRequestContext } from '../ask-v2/ask-request-context';
import { AskContextResolver } from '../ask-v2/context/ask-context.resolver';
import { StoryIdentityService } from '../stories/story-identity.service';
import { StoryBriefService } from './story-brief.service';
import { AskGovernedStoryBriefGenerator, STORY_BRIEF_QUESTION } from './ask-governed-story-brief.generator';

/**
 * CTO §3 — a Story Brief is generated ONLY through the governed Ask path: the REAL AskV2Service,
 * execution adapter, compute meter, breaker, operational switches and context resolver; only the
 * analysis provider is a counted fake (no network, no model). Loopback test database only.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Story Brief governed tests require the dedicated loopback test database');
}
jest.setTimeout(90000);
const live = url ? describe : describe.skip;

live('Story Brief — generated through the governed Ask path (real PostgreSQL)', () => {
  let db: PrismaClient;
  let values: Record<string, string> = {};
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const analyzeNews = jest.fn();
  let switches: OperationalSwitchService;
  let briefs: StoryBriefService;
  let identity: StoryIdentityService;
  let userId: string;
  const stamp = randomUUID().slice(0, 8);
  let seq = 0;
  const ctx = () => ({ accountId: userId, guestSessionId: null, ipScope: 'ip:v4:198.51.100.77' });
  const request = (storyId: string) => askRequestContext.run(ctx(), () => briefs.request(storyId, { userId }));

  async function story() {
    seq++;
    const articleUrl = `https://wire.example/governed-${stamp}-${seq}`;
    await db.article.create({
      data: {
        id: `gov-${stamp}-${seq}`,
        title: `Port of Mombasa reopens after strike ${stamp}-${seq}`,
        summary: 'Retained summary',
        url: articleUrl,
        sourceId: 'wire',
        sourceName: 'Example Wire',
        category: 'world',
        countryCode: 'KE',
        publishedAt: new Date(),
      },
    });
    const { story: s } = await identity.ensureStoryForArticle({ articleRef: computeArticleRef(articleUrl), url: articleUrl });
    return s.storyId;
  }

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
    identity = new StoryIdentityService(db as unknown as PrismaService);
  });
  afterAll(async () => db.$disconnect());

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
    );
    values = {
      ASK_V2_ENABLED: 'true',
      ASK_R2_ENABLED: 'true',
      ASK_PUBLIC_COMPUTE_ENABLED: 'true',
      ASK_FLAG_CACHE_MS: '0',
      ASK_BREAKER_CACHE_MS: '0',
      ASK_UNITS_PER_REQUEST_MAX: '16000',
      ASK_GLOBAL_UNITS_PER_HOUR: '1000000',
      ASK_GLOBAL_UNITS_PER_DAY: '5000000',
      ASK_PROVIDER_UNITS_PER_HOUR: '1000000',
      ASK_IP_UNITS_PER_DAY: '360000',
      ASK_CONCURRENT_GLOBAL: '8',
    };
    analyzeNews.mockReset();
    analyzeNews.mockImplementation(async (...args: unknown[]) => {
      (args[6] as { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void })?.usageSink?.({
        promptTokens: 2000,
        completionTokens: 400,
      });
      return { analysis: {}, articles: [{ id: 'x' }], retrievalContext: {} };
    });
    await build();
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `brief-${userId}@example.invalid` } });
  });

  /** Construct the governed stack from the CURRENT config (the meter reads it at construction). */
  async function build(): Promise<void> {
    const persistence = new ArticlePersistenceService(db as unknown as PrismaService);
    const meter = new ComputeMeterService(db as unknown as PrismaService, config);
    const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
    switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
    const guests = new GuestSessionService(db as unknown as PrismaService, config, meter, switches);
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      { id: 'mock', displayName: 'Mock Background', isMock: true, answerBackground: async () => ({ text: 'bg' }) } as never,
      meter,
      breaker,
      switches,
      { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: async () => true } as never,
      { boundSpecialistDomains: () => ['CONFLICT'], read: async () => ({ considered: [], contributions: [] }), readPinned: async () => null } as never,
      guests,
    );
    const ask = new AskV2Service(
      db as unknown as PrismaService,
      config,
      adapter,
      guests,
      switches,
      meter,
      new AskContextResolver(
        {
          findRetainedArticleByUrl: async (u: string) => (await persistence.findRetainedByUrl(u))?.article ?? null,
          findArticleById: async (id: string) => persistence.findById(id),
        },
        { resolvePinned: async () => null } as never,
      ),
    );
    for (const name of ['ASK_R2_ENABLED', 'ASK_PUBLIC_COMPUTE_ENABLED'] as const) await switches.set(name, true, 'story-brief-spec', 'test');
    switches.forget();
    briefs = new StoryBriefService(db as unknown as PrismaService, identity, new AskGovernedStoryBriefGenerator(ask, config));
  }

  it('one governed ComputeOperation, in the REQUESTER’s own Ask history, metered; the Brief keeps only its id', async () => {
    const storyId = await story();
    const view = await request(storyId);
    expect(['READY', 'PARTIAL', 'INSUFFICIENT']).toContain(view.state);
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    const version = await db.storyBriefVersion.findFirstOrThrow({ where: { storyId } });
    const op = await db.computeOperation.findUniqueOrThrow({ where: { id: version.sourceOperationId! }, include: { turn: { include: { thread: true } } } });
    expect(op).toMatchObject({ userId, status: 'COMPLETED' });
    expect(op.turn?.question).toBe(STORY_BRIEF_QUESTION); /* system-composed: no reader text */
    expect(op.turn?.thread.userId).toBe(userId);
    expect(await db.computeMeter.count()).toBeGreaterThan(0); /* the governed meter saw it */
    expect(JSON.stringify(version)).not.toContain(userId);
  });

  it('reopening the current Brief spends nothing (no second governed operation)', async () => {
    const storyId = await story();
    await request(storyId);
    const before = await db.computeOperation.count({ where: { userId } });
    await request(storyId);
    await briefs.read(storyId);
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(before);
  });

  it('a budget refusal is BUDGET_REFUSED on the attempt — not INSUFFICIENT, no Brief', async () => {
    values.ASK_ACCOUNT_UNITS_PER_DAY = '100';
    values.ASK_NEW_ACCOUNT_UNITS_PER_DAY = '100';
    await build();
    const storyId = await story();
    const view = await request(storyId);
    expect(view.state).toBe('FAILED');
    expect(view.lastAttempt).toMatchObject({ status: 'FAILED', failureKind: 'BUDGET_REFUSED' });
    expect(view.lastAttempt?.failureCode).toMatch(/^BUDGET_/);
    expect(await db.storyBriefVersion.count({ where: { storyId } })).toBe(0);
    expect(analyzeNews).not.toHaveBeenCalled();
  });

  it('the governed compute switch OFF → CAPABILITY_UNAVAILABLE (no provider call)', async () => {
    await switches.set('ASK_R2_ENABLED', false, 'story-brief-spec', 'test');
    switches.forget();
    const storyId = await story();
    const view = await request(storyId);
    expect(view.lastAttempt).toMatchObject({ status: 'FAILED', failureKind: 'CAPABILITY_UNAVAILABLE' });
    expect(analyzeNews).not.toHaveBeenCalled();
  });

  it('a retry after a failure is a NEW governed operation (never a replay of the failed one)', async () => {
    values.ASK_ACCOUNT_UNITS_PER_DAY = '100';
    values.ASK_NEW_ACCOUNT_UNITS_PER_DAY = '100';
    await build();
    const storyId = await story();
    expect((await request(storyId)).lastAttempt).toMatchObject({ failureKind: 'BUDGET_REFUSED' });
    delete values.ASK_ACCOUNT_UNITS_PER_DAY;
    delete values.ASK_NEW_ACCOUNT_UNITS_PER_DAY;
    await build();
    const view = await request(storyId);
    expect(['READY', 'PARTIAL', 'INSUFFICIENT']).toContain(view.state);
    expect(await db.computeOperation.count({ where: { userId } })).toBe(2);
  });
});
