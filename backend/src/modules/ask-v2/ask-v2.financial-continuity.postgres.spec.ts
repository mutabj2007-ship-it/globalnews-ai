import { accountPrincipal } from './guest/ask-principal';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { ComputeMeterService } from '../compute-controls/compute-meter.service';
import { CircuitBreakerService } from '../compute-controls/circuit-breaker.service';
import { OperationalSwitchService } from '../compute-controls/operational-switch.service';
import { AskV2Service } from './ask-v2.service';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { AskObservationService } from '../ask-observability/ask-observation.service';
import { AskObservationRetentionService } from '../ask-observability/ask-observation-retention.service';
import { askRequestContext } from './ask-request-context';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK FINANCIAL CONTINUITY P0 — the live loan sequence, through the REAL service path
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Alpha 04889bb (2026-10-10): op 8e7e0876 computed the single-repayment loan (10.5263 %); the very
 * next question in the same conversation, op 0ec1717c, was routed to CURRENT_REPORTING. The
 * executor-level spec passed because its harness put the previous question into the request
 * context itself. Here nothing is injected: each question goes through AskV2Service.submit (quote →
 * execute) on a real PostgreSQL, so the previous question reaches the solver only if the service's
 * own anchor selection hands it over. The analysis path and the background model are recording
 * stand-ins, so "no news, no model" is a count.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask R2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const Q1 =
  'I receive $950 today and repay $1,050 in a single payment after exactly one year, with no other fees. What is the effective annual rate?';
const Q2 =
  'And if I repay the $1,050 in 12 equal monthly instalments instead, is the rate still the same?';

type Payload = {
  aiExecuted: boolean;
  answer: { state: string; basis: string; candidates?: string[] };
  computation?: {
    kind: string;
    steps: { label: string; value: number }[];
    result: { name: string; value: number; unit: string };
    conventions: string[];
  };
};

live('ASK FINANCIAL CONTINUITY P0 — loan schedule follow-up, live PostgreSQL service path', () => {
  let db: PrismaClient;
  let values: Record<string, string>;
  let userId: string;
  let service: AskV2Service;
  let switches: OperationalSwitchService;
  const analyzeNews = jest.fn();
  const answerBackground = jest.fn();
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;

  const within = <T>(work: () => Promise<T>): Promise<T> =>
    askRequestContext.run({ accountId: userId, ipScope: 'ip:v4:198.51.100.23' }, work);
  const newThread = async (key: string = randomUUID()) =>
    (await service.createThread(accountPrincipal(userId), { idempotencyKey: key, language: 'en' })).id;
  const submit = (threadId: string, question: string, key = randomUUID()) =>
    within(() =>
      service.submit(accountPrincipal(userId), threadId, {
        idempotencyKey: key,
        question,
        language: 'en',
        intent: 'ask',
      }),
    );
  const payloadOf = async (storedResultId: string | null) =>
    storedResultId === null
      ? null
      : ((await db.storedResult.findUnique({ where: { id: storedResultId } }))?.payload as Payload);
  const observationOf = (operationId: string) =>
    db.askObservation.findFirst({ where: { operationId } });

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 8 }) });
    await db.$connect();
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "ComputeMeter", "ComputeReservation", "CircuitBreakerState", "OperationalSwitch", "OperationalSwitchAudit"',
    );
    values = { ASK_V2_ENABLED: 'true', ASK_FLAG_CACHE_MS: '0', ASK_BREAKER_CACHE_MS: '0' };
    answerBackground.mockReset();
    answerBackground.mockImplementation(async () => ({ text: 'background' }));
    analyzeNews.mockReset();
    analyzeNews.mockImplementation(async (...args: unknown[]) => {
      const policy = args[6] as {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      };
      policy.usageSink?.({ promptTokens: 2500, completionTokens: 600 });
      return {
        analysis: {},
        articles: [{ id: 'a' }, { id: 'b' }],
        retrievalContext: {},
      } as unknown as AnalysisApiResponse;
    });
    const meter = new ComputeMeterService(db as unknown as PrismaService, config);
    const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
    switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      { id: 'mock', displayName: 'Mock General Background', isMock: true, answerBackground } as never,
      meter,
      breaker,
      switches,
      { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      new AskObservationService(
        db as unknown as PrismaService,
        new AskObservationRetentionService(db as unknown as PrismaService),
      ),
      { boundSpecialistDomains: () => ['CONFLICT'], read: async () => ({ considered: [], contributions: [] }) } as never,
    );
    service = new AskV2Service(db as unknown as PrismaService, config, adapter);
    /* Alpha's posture: ASK_R2 and PUBLIC_COMPUTE on */
    values.ASK_R2_ENABLED = 'true';
    values.ASK_PUBLIC_COMPUTE_ENABLED = 'true';
    await switches.set('ASK_R2_ENABLED', true, 'financial-continuity-spec', 'test');
    await switches.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'financial-continuity-spec', 'test');
    switches.forget();
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `ask-fin-${userId}@example.invalid` } });
  });
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: userId } });
  });

  const stepsOf = (p: Payload) => Object.fromEntries(p.computation!.steps.map((s) => [s.label, s.value]));

  it('ops 8e7e0876 → 0ec1717c: the instalment follow-up is solved from the reader\'s own earlier loan, 0 news, 0 model', async () => {
    const thread = await newThread();
    const first = await submit(thread, Q1);
    expect(first.status).toBe('COMPLETED');
    const p1 = (await payloadOf(first.storedResultId))!;
    expect(p1.answer.state).toBe('COMPUTED_RESULT');
    expect(p1.computation!.result.value).toBe(10.5263);

    const second = await submit(thread, Q2);
    expect(second.status).toBe('COMPLETED');
    const p2 = (await payloadOf(second.storedResultId))!;
    /* the live defect: CURRENT_REPORTING */
    expect(p2.answer).toMatchObject({ state: 'COMPUTED_RESULT', basis: 'DETERMINISTIC_COMPUTATION' });
    expect(p2.aiExecuted).toBe(false);
    const steps = stepsOf(p2);
    expect(steps['Each monthly payment']).toBe(87.5);
    expect(steps['Rate per month (r)']).toBeCloseTo(1.5744, 4);
    expect(steps['Nominal annual rate (APR)']).toBeCloseTo(18.8925, 4);
    expect(p2.computation!.result).toEqual({ name: 'effective annual rate', value: 20.6173, unit: '%' });
    /* not the same as the single repayment, and the carried input is disclosed */
    const conventions = p2.computation!.conventions.join(' ');
    expect(conventions).toMatch(/not the same as repaying the same total in one payment at the end \(10\.5263 %/);
    expect(conventions).toMatch(/amount received \(receive \$950\) is taken from your earlier question/);

    /* zero news-provider and zero model calls for BOTH turns; nothing metered */
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(answerBackground).not.toHaveBeenCalled();
    for (const op of [first, second]) {
      const obs = await observationOf(op.operationId);
      expect(obs).toMatchObject({ aiExecuted: false, modelInvocationCount: 0 });
    }
    expect(await db.computeReservation.count()).toBe(0);
  });

  it('a third schedule change in the same thread still binds to the complete loan, not to the partial follow-up', async () => {
    const thread = await newThread();
    await submit(thread, Q1);
    await submit(thread, Q2);
    const third = await submit(thread, 'What if I repay the $1,050 in 4 equal quarterly instalments instead, what is the rate then?');
    const p3 = (await payloadOf(third.storedResultId))!;
    expect(p3.answer.state).toBe('COMPUTED_RESULT');
    expect(stepsOf(p3)['Each quarterly payment']).toBe(262.5);
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(answerBackground).not.toHaveBeenCalled();
  });

  it('the follow-up with no earlier loan in its thread asks for the missing input — no news search, no model', async () => {
    const thread = await newThread();
    const op = await submit(thread, Q2);
    expect(op.status).toBe('COMPLETED');
    const p = (await payloadOf(op.storedResultId))!;
    expect(p.answer).toMatchObject({
      state: 'CLARIFICATION_REQUIRED',
      basis: 'COMPUTATION_INPUTS_MISSING',
      candidates: ['amount received'],
    });
    expect(p.computation).toBeUndefined();
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(answerBackground).not.toHaveBeenCalled();
    expect(await observationOf(op.operationId)).toMatchObject({ aiExecuted: false, modelInvocationCount: 0 });
  });

  it('thread isolation: the loan stated in ANOTHER of the reader\'s threads is never carried over', async () => {
    const a = await newThread('thread-a');
    const b = await newThread('thread-b');
    await submit(a, Q1);
    const op = await submit(b, Q2);
    const p = (await payloadOf(op.storedResultId))!;
    expect(p.answer.state).toBe('CLARIFICATION_REQUIRED');
    expect(p.computation).toBeUndefined();
  });

  it('owner isolation: another account\'s loan is never carried over', async () => {
    const thread = await newThread();
    await submit(thread, Q1);
    const otherId = randomUUID();
    await db.user.create({ data: { id: otherId, email: `ask-fin-${otherId}@example.invalid` } });
    try {
      const otherThread = (
        await service.createThread(accountPrincipal(otherId), { idempotencyKey: 'o', language: 'en' })
      ).id;
      const op = await askRequestContext.run({ accountId: otherId, ipScope: 'ip:v4:198.51.100.24' }, () =>
        service.submit(accountPrincipal(otherId), otherThread, {
          idempotencyKey: randomUUID(),
          question: Q2,
          language: 'en',
          intent: 'ask',
        }),
      );
      const p = (await payloadOf(op.storedResultId))!;
      expect(p.answer.state).toBe('CLARIFICATION_REQUIRED');
    } finally {
      await db.user.deleteMany({ where: { id: otherId } });
    }
  });

  it('idempotency: a retried submit of the follow-up is the same operation, with one result', async () => {
    const thread = await newThread();
    await submit(thread, Q1);
    const key = randomUUID();
    const once = await submit(thread, Q2, key);
    const again = await submit(thread, Q2, key);
    expect(again.operationId).toBe(once.operationId);
    expect(again.storedResultId).toBe(once.storedResultId);
    expect(await db.askTurn.count({ where: { threadId: thread } })).toBe(2);
  });

  it('plan identity: the same follow-up after a DIFFERENT earlier loan is a different plan and answer', async () => {
    const t1 = await newThread('t1');
    const t2 = await newThread('t2');
    await submit(t1, Q1);
    await submit(t2, 'I receive $900 today and repay $1,050 in a single payment after one year. What is the effective annual rate?');
    const a = await submit(t1, Q2);
    const b = await submit(t2, Q2);
    const pa = (await payloadOf(a.storedResultId))!;
    const pb = (await payloadOf(b.storedResultId))!;
    expect(a.storedResultId).not.toBe(b.storedResultId);
    expect(pa.computation!.result.value).toBe(20.6173);
    expect(pb.computation!.result.value).not.toBe(20.6173);
  });

  it('a market-rate question with none of the reader\'s own amounts is never bound to the earlier loan', async () => {
    const thread = await newThread();
    await submit(thread, Q1);
    const op = await submit(thread, 'What interest rate do banks charge for a car loan of $20,000 over 12 monthly payments?');
    const p = (await payloadOf(op.storedResultId))!;
    expect(p.computation).toBeUndefined();
    expect(p.answer.basis).not.toBe('COMPUTATION_INPUTS_MISSING');
  });

  it('unrelated routing is unchanged: a news question after the loan still searches news', async () => {
    const thread = await newThread();
    await submit(thread, Q1);
    const op = await submit(thread, 'What is happening in Kenya?');
    expect(analyzeNews).toHaveBeenCalledTimes(1);
    expect((await payloadOf(op.storedResultId))!.answer.state).toBe('CURRENT_REPORTING');
  });
});
