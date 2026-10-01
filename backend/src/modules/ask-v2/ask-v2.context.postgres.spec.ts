import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../auth/session.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { AskV2Module } from './ask-v2.module';
import { AskV2Service } from './ask-v2.service';
import { accountPrincipal } from './guest/ask-principal';
import { ASK_EXECUTION_PORT, type AskPlan, type AskRequest, type ExecutionResult } from './ask-compute.contract';
import { askRequestContext, type AskRequestContext } from './ask-request-context';
import type { AskContextRefDto, QuoteTurnDto } from './ask-v2.dto';

/**
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — the server-resolved context references,
 * through the REAL AskV2Module (real AskContextResolver, real NewsService retained read)
 * against the dedicated loopback test database. The execution port is a fake that records
 * what the server put in the request context: that is the only way the adapter receives it.
 */

const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask V2 live tests require the dedicated loopback test database');
}
jest.setTimeout(30000);
const live = url ? describe : describe.skip;

live('Ask V2 context references — live PostgreSQL', () => {
  let db: PrismaClient;
  let service: AskV2Service;
  let userId: string;
  let threadId: string;
  let configValues: Record<string, string> = {};
  const seen: (AskRequestContext | undefined)[] = [];
  const prepare = jest.fn<Promise<AskPlan>, [Readonly<AskRequest>]>();
  const execute = jest.fn<Promise<ExecutionResult>, [Readonly<AskRequest>, Readonly<AskPlan>, string]>();
  const stamp = randomUUID().slice(0, 8);
  const URL_A = `https://wire.example/ctx-${stamp}-a`;
  const URL_B = `https://wire.example/ctx-${stamp}-b`;
  const REF_A = computeArticleRef(URL_A);
  const REF_B = computeArticleRef(URL_B);
  const basePlan = (): AskPlan => ({
    revision: 'rev-1',
    scope: 'scope',
    contract: 'test',
    executionKey: 'exec',
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 0,
    domainCount: 0,
    timeWindowDays: 0,
  });
  const ask = (key: string, context?: Record<string, unknown>): QuoteTurnDto => ({
    idempotencyKey: key,
    question: 'What does this mean for regional trade?',
    language: 'en' as const,
    intent: 'ask' as const,
    ...(context === undefined ? {} : { context: context as unknown as AskContextRefDto }),
  });

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
    await db.$connect();
    const config = { get: (key: string) => configValues[key] } as ConfigService;
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AskV2Module],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(SessionService)
      .useValue({ validateSession: async () => null })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({ prepare, execute })
      .compile();
    service = module.get(AskV2Service);
    await db.article.createMany({
      data: [
        {
          id: `ctx-${stamp}-a`,
          title: 'Mombasa port works extend container dwell times',
          summary: 'Retained summary',
          url: URL_A,
          sourceId: 'wire',
          sourceName: 'Wire',
          category: 'business',
          publishedAt: new Date(),
          countryCode: 'KE',
          countryName: 'Kenya',
        },
        {
          id: `ctx-${stamp}-b`,
          title: 'Northern corridor upgrades begin',
          summary: 'Retained summary',
          url: URL_B,
          sourceId: 'wire',
          sourceName: 'Wire',
          category: 'business',
          publishedAt: new Date(),
        },
      ],
    });
  });

  beforeEach(async () => {
    configValues = { ASK_V2_ENABLED: 'true', ASK_CONTEXT_REFS_ENABLED: 'true' };
    seen.length = 0;
    prepare.mockReset();
    execute.mockReset();
    prepare.mockImplementation(async () => {
      seen.push(askRequestContext.getStore());
      return basePlan();
    });
    execute.mockImplementation(async () => {
      seen.push(askRequestContext.getStore());
      return {
        succeeded: true,
        payloadJson: JSON.stringify({ answer: { state: 'CURRENT_REPORTING' } }),
        evidenceRevision: 'rev-1',
        validUntil: new Date(Date.now() + 3600000).toISOString(),
      };
    });
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `ctx-${stamp}@example.invalid` } });
    threadId = (
      await service.createThread(accountPrincipal(userId), { idempotencyKey: 't', language: 'en' })
    ).id;
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: userId } });
  });
  afterAll(async () => {
    await db.article.deleteMany({ where: { url: { in: [URL_A, URL_B] } } });
    await db.$disconnect();
  });

  /* The service runs prepare/execute inside the controller's interceptor store; emulate it. */
  const asReader = <T>(work: () => Promise<T>) =>
    askRequestContext.run({ accountId: userId, ipScope: 'ip:test' }, work);

  it('one ordinary Send with a story reference: ONE execution, the anchor resolved server-side', async () => {
    const op = await asReader(() =>
      service.submit(accountPrincipal(userId), threadId, ask('k-story', { entry: 'story', stories: [{ articleRef: REF_A, url: URL_A }] })),
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(op.status).toBe('COMPLETED');
    const atExecute = seen[1]?.askContext;
    expect(atExecute?.storyContext).toMatchObject({
      title: 'Mombasa port works extend container dwell times',
      url: URL_A,
      countryCode: 'KE',
    });
    expect(atExecute?.route).toEqual({ hasResolvedArticleAnchor: true, storyAnchorCountry: 'KEN' });
    expect((op as { context?: unknown }).context).toEqual({
      entry: 'story',
      scope: 'story',
      refs: [{ kind: 'story', ref: REF_A, status: 'available', label: 'Mombasa port works extend container dwell times' }],
    });
  });

  it('an unresolvable reference is VISIBLE on the operation, never silently dropped', async () => {
    const missing = `https://wire.example/ctx-${stamp}-missing`;
    const op = await asReader(() =>
      service.submit(
        accountPrincipal(userId),
        threadId,
        ask('k-sel', {
          entry: 'compare',
          stories: [
            { articleRef: REF_A, url: URL_A },
            { articleRef: computeArticleRef(missing), url: missing },
          ],
        }),
      ),
    );
    const refs = (op as { context?: { refs: { status: string; reason?: string }[] } }).context?.refs ?? [];
    expect(refs.map((r) => [r.status, r.reason ?? null])).toEqual([
      ['available', null],
      ['unavailable', 'NOT_RETAINED'],
    ]);
    expect(seen[1]?.askContext?.selection).toEqual({ action: 'ASK_SELECTED', stories: [{ articleRef: REF_A, url: URL_A }] });
  });

  it('a retried Send (same key, same bag) is the SAME operation; a different bag under that key conflicts', async () => {
    const bag = { entry: 'story', stories: [{ articleRef: REF_A, url: URL_A }] };
    const first = await asReader(() => service.submit(accountPrincipal(userId), threadId, ask('k-retry', bag)));
    const again = await asReader(() => service.submit(accountPrincipal(userId), threadId, ask('k-retry', bag)));
    expect(again.operationId).toBe(first.operationId);
    expect(execute).toHaveBeenCalledTimes(1);
    await expect(
      asReader(() =>
        service.submit(accountPrincipal(userId), threadId, ask('k-retry', { entry: 'story', stories: [{ articleRef: REF_B, url: URL_B }] })),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('gate OFF: the Send runs as a context-free Ask and says every reference was EXCLUDED', async () => {
    configValues = { ASK_V2_ENABLED: 'true' };
    const op = await asReader(() =>
      service.submit(accountPrincipal(userId), threadId, ask('k-off', { entry: 'story', stories: [{ articleRef: REF_A, url: URL_A }] })),
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(seen[1]?.askContext).toEqual({ route: {} });
    expect((op as { context?: { refs: { status: string; reason: string }[] } }).context?.refs).toEqual([
      { kind: 'story', ref: REF_A, status: 'excluded', reason: 'CONTEXT_REFS_DISABLED' },
    ]);
  });

  it('no bag: the operation response and the request context are exactly as before', async () => {
    const op = await asReader(() => service.submit(accountPrincipal(userId), threadId, ask('k-plain')));
    expect('context' in op).toBe(false);
    expect(seen[1]?.askContext).toBeUndefined();
    const row = await db.computeOperation.findUnique({ where: { id: op.operationId } });
    expect((row?.plan as Record<string, unknown>).context).toBeUndefined();
  });

  it('a deep quote keeps its context through accept → reserve → execute (separate requests)', async () => {
    const quote = await asReader(() =>
      service.submit(accountPrincipal(userId), threadId, {
        ...ask('k-deep', { entry: 'my-intelligence', action: 'COMPARE', stories: [{ articleRef: REF_A, url: URL_A }, { articleRef: REF_B, url: URL_B }] }),
        intent: 'deep-analysis',
      }),
    );
    expect(quote.requiresAcceptance).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    await service.accept(accountPrincipal(userId), quote.operationId);
    await service.reserve(accountPrincipal(userId), quote.operationId);
    await asReader(() => service.execute(accountPrincipal(userId), quote.operationId));
    await asReader(() => service.execute(accountPrincipal(userId), quote.operationId));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(seen[1]?.askContext?.selection?.action).toBe('COMPARE');
    expect(seen[1]?.askContext?.route.articleRefs).toEqual([REF_A, REF_B]);
  });
});
