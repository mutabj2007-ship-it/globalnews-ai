import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { SessionService } from '../../auth/session.service';
import { AskV2Module } from '../ask-v2.module';
import { AskV2Service } from '../ask-v2.service';
import { accountPrincipal } from '../guest/ask-principal';
import { ASK_EXECUTION_PORT, AskPlan, AskRequest, ExecutionResult } from '../ask-compute.contract';

/**
 * CTO CHECKPOINT 5 §5 — cross-country continuation through the REAL Ask V2 service on real
 * PostgreSQL: the engine (the execution port) receives the composed question, the turn keeps the
 * reader's own words, the stored answer discloses the continuation, and execute re-derives the
 * same composition from durable state only. A bare continuation with no portable subject reaches
 * the engine unchanged (the adapter then asks back, zero AI).
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (
  url &&
  !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/(?:ask_v2_test|trust_r2_[a-z0-9_]+)$/.test(url)
) {
  throw new Error('Continuation live tests require a dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

live('cross-country continuation — live PostgreSQL through AskV2Service', () => {
  let db: PrismaClient;
  let service: AskV2Service;
  let userId = '';
  const prepared: string[] = [];
  const executed: Readonly<AskRequest>[] = [];
  const plan = (): AskPlan => ({
    revision: 'rev-1',
    scope: 'scope:any',
    contract: 'qual-v1',
    executionKey: 'planned-ask',
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 1,
    domainCount: 1,
    timeWindowDays: 7,
  });

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 4 }) });
    await db.$connect();
    const values: Record<string, string> = {
      ASK_V2_ENABLED: 'true',
      SAND_LEDGER_ENABLED: 'true',
      SAND_CHARGING_ENABLED: 'false',
    };
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AskV2Module],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(ConfigService)
      .useValue({ get: (k: string) => values[k] } as ConfigService)
      .overrideProvider(SessionService)
      .useValue({ validateSession: async () => null })
      .overrideProvider(ASK_EXECUTION_PORT)
      .useValue({
        prepare: async (r: Readonly<AskRequest>) => (prepared.push(r.question), plan()),
        execute: async (r: Readonly<AskRequest>): Promise<ExecutionResult> => {
          executed.push(r);
          return {
            succeeded: true,
            payloadJson: JSON.stringify({
              schema: 'ask-r2-result/1',
              answer: { state: 'CURRENT_REPORTING' },
              checkedAt: new Date().toISOString(),
            }),
            evidenceRevision: 'rev-1',
            validUntil: plan().validUntil,
          };
        },
      })
      .compile();
    service = module.get(AskV2Service);
    userId = (await db.user.create({ data: { email: `${randomUUID()}@continuation.test` } })).id;
  });
  afterAll(async () => {
    await db?.user.deleteMany({ where: { id: userId } });
    await db?.$disconnect();
  });

  async function ask(threadId: string, question: string, language: 'en' | 'pl' = 'en') {
    const p = accountPrincipal(userId);
    const q = await service.quote(p, threadId, {
      idempotencyKey: randomUUID(),
      question,
      language,
      intent: 'ask',
    });
    if (q.status !== 'COMPLETED') {
      await service.accept(p, q.operationId);
      await service.reserve(p, q.operationId);
      await service.execute(p, q.operationId);
    }
    return service.getOperation(p, q.operationId);
  }
  const thread = async (language: 'en' | 'pl' = 'en') =>
    (
      await service.createThread(accountPrincipal(userId), {
        idempotencyKey: randomUUID(),
        language,
      })
    ).id;

  it('EN: "And in Kenya?" after a Madagascar economy question is answered as the Kenya economy question', async () => {
    const t = await thread();
    await ask(t, "How is Madagascar's economy doing?");
    const op = await ask(t, 'And in Kenya?');
    expect(prepared[prepared.length - 1]).toBe("How is Kenya's economy doing?");
    expect(executed[executed.length - 1].question).toBe("How is Kenya's economy doing?");
    expect(executed[executed.length - 1].continuation).toEqual({
      readerQuestion: 'And in Kenya?',
      fromQuestion: "How is Madagascar's economy doing?",
    });
    const turns = await db.askTurn.findMany({
      where: { threadId: t },
      orderBy: { sequence: 'asc' },
    });
    expect(turns.map((x) => x.question)).toEqual([
      "How is Madagascar's economy doing?",
      'And in Kenya?',
    ]);
    expect((op.result?.payload as { continuation?: unknown }).continuation).toEqual({
      readerQuestion: 'And in Kenya?',
      answeredAs: "How is Kenya's economy doing?",
      fromQuestion: "How is Madagascar's economy doing?",
    });
  });

  it('PL: "A w Kenii?" after a Madagascar economy question', async () => {
    const t = await thread('pl');
    await ask(t, 'Jak radzi sobie gospodarka Madagaskaru?', 'pl');
    await ask(t, 'A w Kenii?', 'pl');
    expect(executed[executed.length - 1].question).toBe('Jak radzi sobie gospodarka Kenii?');
  });

  it('no portable subject (Napoleon): the bare continuation reaches the engine unchanged, nothing disclosed', async () => {
    const t = await thread();
    await ask(t, 'Who was Napoleon?');
    const op = await ask(t, 'And in Kenya?');
    expect(executed[executed.length - 1].question).toBe('And in Kenya?');
    expect(executed[executed.length - 1].continuation).toBeUndefined();
    expect((op.result?.payload as { continuation?: unknown }).continuation).toBeUndefined();
  });

  it('a new thread (Start New Topic) inherits nothing', async () => {
    const t = await thread();
    await ask(t, 'And in Kenya?');
    expect(executed[executed.length - 1].question).toBe('And in Kenya?');
  });
});
