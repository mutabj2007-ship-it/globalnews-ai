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
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — the §35 travel journey and the §23 constraints through
 * the REAL Ask V2 service on real PostgreSQL. The execution port records what the ONE engine is
 * handed: the composed question (quote and execute derive it identically from durable turns),
 * the disclosed continuation, and the conversation-state diagnostics. Turns keep the reader's own
 * words; every completed turn stays readable afterwards (§21 persistence, read back from the DB).
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (
  url &&
  !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/(?:ask_v2_test|trust_r2_[a-z0-9_]+)$/.test(url)
) {
  throw new Error('Conversation journey live tests require a dedicated loopback test database');
}
jest.setTimeout(120000);
const live = url ? describe : describe.skip;

live('R3 conversation journeys — live PostgreSQL through AskV2Service', () => {
  let db: PrismaClient;
  let service: AskV2Service;
  let userId = '';
  const prepared: Readonly<AskRequest>[] = [];
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
        prepare: async (r: Readonly<AskRequest>) => (prepared.push(r), plan()),
        execute: async (r: Readonly<AskRequest>): Promise<ExecutionResult> => {
          executed.push(r);
          return {
            succeeded: true,
            payloadJson: JSON.stringify({
              schema: 'ask-r2-result/1',
              answer: { state: 'REFERENCE_BACKGROUND' },
              background: { text: `answer to: ${r.question}` },
              checkedAt: new Date().toISOString(),
            }),
            evidenceRevision: 'rev-1',
            validUntil: plan().validUntil,
          };
        },
      })
      .compile();
    service = module.get(AskV2Service);
    userId = (await db.user.create({ data: { email: `${randomUUID()}@r3-journey.test` } })).id;
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
  type Payload = {
    continuation?: { readerQuestion: string; answeredAs: string; kind: string };
    diagnostics?: { conversation?: { job: string; carried: string[]; overridden: string[] } };
    background?: { text: string };
  };

  it('§35 the travel journey: every turn is composed inside the trip, disclosed, and stays readable', async () => {
    const t = await thread();
    const questions = [
      'Which places can I visit in Rwanda?',
      'I have five days and prefer nature.',
      'What about Nyungwe instead?',
      'Compare Nyungwe and Volcanoes.',
      'Which is cheaper?',
      'Is there anything current I should know?',
      'And in Kenya?',
      'Compare the same five-day nature trip.',
    ];
    const answeredAs = [
      'Which places can I visit in Rwanda?',
      'Planning a trip to Rwanda (5 days; interests: nature): I have five days and prefer nature — how should I plan it?',
      'Planning a trip to Rwanda (5 days; interests: nature): What about Nyungwe instead?',
      'Planning a trip to Rwanda (5 days; interests: nature): Compare Nyungwe and Volcanoes.',
      'Planning a trip to Rwanda (5 days; interests: nature): Which is cheaper — Nyungwe or Volcanoes?',
      'Planning a trip to Rwanda (5 days; interests: nature): what current travel notices should I know about?',
      'Planning a trip to Kenya (5 days; interests: nature): which places should I visit, and how would I plan it?',
      'Planning a trip to Rwanda and Kenya (5 days; interests: nature): Compare the same five-day nature trip.',
    ];
    const operations: string[] = [];
    const start = executed.length;
    for (const q of questions) operations.push((await ask(t, q)).operationId);

    const handed = executed.slice(start);
    expect(handed.map((r) => r.question)).toEqual(answeredAs);
    /* quote and execute derived the SAME composition from durable state */
    expect(prepared.slice(-questions.length).map((r) => r.question)).toEqual(answeredAs);
    for (const r of handed.slice(1)) {
      expect(r.continuation?.kind).toBe('JOB_CONTEXT');
      expect(r.context).toBeUndefined();
      expect(r.conversation?.trace.job).toBe('TRAVEL_PLANNING');
    }

    /* §21 — after a "refresh" (fresh reads from the database) every completed turn is there */
    const turns = await db.askTurn.findMany({
      where: { threadId: t },
      orderBy: { sequence: 'asc' },
    });
    expect(turns.map((x) => x.question)).toEqual(questions);
    for (const [i, id] of operations.entries()) {
      const op = await service.getOperation(accountPrincipal(userId), id);
      expect(op.status).toBe('COMPLETED');
      const payload = op.result?.payload as Payload;
      expect(payload.background?.text).toBe(`answer to: ${answeredAs[i]}`);
      if (i > 0) {
        expect(payload.continuation).toMatchObject({
          readerQuestion: questions[i],
          answeredAs: answeredAs[i],
          kind: 'JOB_CONTEXT',
        });
        expect(payload.diagnostics?.conversation?.job).toBe('TRAVEL_PLANNING');
      }
    }
    const kenya = (await service.getOperation(accountPrincipal(userId), operations[6])).result
      ?.payload as Payload;
    expect(kenya.diagnostics?.conversation?.overridden).toEqual(
      expect.arrayContaining(['geography', 'options']),
    );
  });

  it('§23 "Only official sources." is a constraint-only turn; the next turn carries the constraint', async () => {
    const t = await thread();
    await ask(t, 'What is going on in Madagascar?');
    await ask(t, 'Only official sources.');
    expect(executed[executed.length - 1].conversation).toMatchObject({
      officialSourcesOnly: true,
      constraintOnly: true,
    });
    await ask(t, 'And the economy?');
    const last = executed[executed.length - 1];
    expect(last.conversation).toMatchObject({ officialSourcesOnly: true, constraintOnly: false });
    /* the conversation's place is still inherited for the placeless follow-up */
    expect(last.context).toMatchObject({ kind: 'GEOGRAPHY', countryIso3: 'MDG' });
  });

  it('L-2 the live chain: quote and execute both answer "yesterday" as Kenya economy + yesterday', async () => {
    const t = await thread();
    await ask(t, "What is happening with Madagascar's economy?");
    await ask(t, 'And in Kenya?');
    const start = executed.length;
    await ask(t, 'What about yesterday?');
    const handed = executed[start];
    expect(handed.question).toBe("What is happening with Kenya's economy yesterday?");
    expect(prepared[prepared.length - 1].question).toBe(handed.question);
    expect(handed.context).toBeUndefined();
    expect(handed.conversation?.trace).toMatchObject({
      composed: 'JOB_CONTEXT',
      subject: "What is happening with Kenya's economy yesterday?",
    });
    await ask(t, 'And in Tanzania?');
    expect(executed[executed.length - 1].question).toBe(
      "What is happening with Tanzania's economy yesterday?",
    );
  });

  it('§4 a self-contained question in a trip is NOT composed into the trip', async () => {
    const t = await thread();
    await ask(t, 'Which places can I visit in Rwanda?');
    await ask(t, 'I have five days and prefer nature.');
    await ask(t, 'What caused the First World War and how did it end?');
    const last = executed[executed.length - 1];
    expect(last.question).toBe('What caused the First World War and how did it end?');
    expect(last.continuation).toBeUndefined();
    expect(last.conversation?.trace.reset).toBe(true);
  });
});
