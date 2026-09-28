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
import { askRequestContext } from './ask-request-context';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE E — THE EXECUTION PATH, LIVE POSTGRES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The REAL AskV2Service lifecycle, the REAL adapter and the REAL Gate B controls
 * (meter, breaker, two-key switches) on a real PostgreSQL. Only the analysis path is a
 * recording stand-in, so every claim about "the model ran / did not run" is a count.
 *
 * Contract §8 (flag alone activates no AI; no double provider call; deep work needs
 * acceptance; Sand off), §10 (budget, kill switch fails closed), §22 (clarification
 * terminal: 0 AI; existing result: 0 AI).
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask R2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

live('Ask R2 execution — live PostgreSQL, real lifecycle and controls', () => {
  let db: PrismaClient;
  let values: Record<string, string>;
  let userId: string;
  let threadId: string;
  let service: AskV2Service;
  let switches: OperationalSwitchService;
  const analyzeNews = jest.fn();
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;

  const within = <T>(work: () => Promise<T>): Promise<T> =>
    askRequestContext.run({ accountId: userId, ipScope: 'ip:v4:198.51.100.23' }, work);
  const submit = (
    question: string,
    key = randomUUID(),
    intent: 'ask' | 'deep-analysis' = 'ask',
    language: 'en' | 'pl' = 'en',
  ) =>
    within(() =>
      service.submit(userId, threadId, { idempotencyKey: key, question, language, intent }),
    );
  const payloadOf = async (storedResultId: string | null) =>
    storedResultId === null
      ? null
      : ((await db.storedResult.findUnique({ where: { id: storedResultId } }))?.payload as {
          aiExecuted: boolean;
          answer: { state: string };
          route: { terminalState: string };
        });

  async function allOn(): Promise<void> {
    values.ASK_R2_ENABLED = 'true';
    values.ASK_PUBLIC_COMPUTE_ENABLED = 'true';
    await switches.set('ASK_R2_ENABLED', true, 'gate-e-live-spec', 'test');
    await switches.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'gate-e-live-spec', 'test');
    switches.forget();
  }

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
    build();
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `ask-r2-${userId}@example.invalid` } });
    threadId = (await service.createThread(userId, { idempotencyKey: 'thread', language: 'en' }))
      .id;
  });

  /** Controls read their knobs at construction, as in production: build after setting values. */
  function build(): void {
    const meter = new ComputeMeterService(db as unknown as PrismaService, config);
    const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
    switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      {
        id: 'mock',
        displayName: 'Mock General Background',
        isMock: true,
        answerBackground: async () => ({ text: null }),
      } as never,
      meter,
      breaker,
      switches,
      {
        get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
      } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
    );
    service = new AskV2Service(db as unknown as PrismaService, config, adapter);
  }
  afterEach(async () => {
    await db.user.deleteMany({ where: { id: userId } });
  });

  describe('§8 / §23 — the default posture runs no AI', () => {
    it('ASK_V2_ENABLED alone: the operation is RELEASED as ASK_R2_DISABLED; 0 analysis calls; nothing metered', async () => {
      const op = await submit('What is happening in Kenya?');
      expect(op.status).toBe('RELEASED');
      expect(op.failureCode).toBe('ASK_R2_DISABLED');
      expect(analyzeNews).not.toHaveBeenCalled();
      expect(await db.computeReservation.count()).toBe(0);
      expect(await db.computeMeter.count()).toBe(0);
    });

    it('two-key: the deployment literal without the audited row is still OFF', async () => {
      values.ASK_R2_ENABLED = 'true';
      values.ASK_PUBLIC_COMPUTE_ENABLED = 'true';
      const op = await submit('What is happening in Kenya?');
      expect(op.failureCode).toBe('ASK_R2_DISABLED');
      expect(analyzeNews).not.toHaveBeenCalled();
    });

    it('two-key: the audited row without the deployment literal is still OFF', async () => {
      await switches.set('ASK_R2_ENABLED', true, 'gate-e-live-spec', 'test');
      await switches.set('ASK_PUBLIC_COMPUTE_ENABLED', true, 'gate-e-live-spec', 'test');
      const op = await submit('What is happening in Kenya?');
      expect(op.failureCode).toBe('ASK_R2_DISABLED');
      expect(analyzeNews).not.toHaveBeenCalled();
    });

    it('a refusal is never stored: after the switch lifts, the same question runs', async () => {
      const refused = await submit('What is happening in Kenya?');
      expect(refused.storedResultId).toBeNull();
      await allOn();
      const ran = await submit('What is happening in Kenya?');
      expect(ran.status).toBe('COMPLETED');
      expect(analyzeNews).toHaveBeenCalledTimes(1);
    });
  });

  describe('§22 — clarification is a successful terminal with 0 AI', () => {
    it.each([
      ['Compare them.', 'en'],
      ['Porównaj je.', 'pl'],
    ] as const)(
      '%s — COMPLETED, aiExecuted false, 0 analysis, 0 reservations — switches OFF',
      async (q, lg) => {
        const op = await submit(q, randomUUID(), 'ask', lg);
        expect(op.status).toBe('COMPLETED');
        expect(await payloadOf(op.storedResultId)).toMatchObject({
          aiExecuted: false,
          answer: { state: 'CLARIFICATION_REQUIRED' },
        });
        expect(analyzeNews).not.toHaveBeenCalled();
        expect(await db.computeReservation.count()).toBe(0);
      },
    );
  });

  describe('§8 / §10 — with both switches on', () => {
    beforeEach(allOn);

    it('ONE analysis call, settled on actual units against every scope', async () => {
      const op = await submit('What is happening in Kenya?');
      expect(op.status).toBe('COMPLETED');
      expect(analyzeNews).toHaveBeenCalledTimes(1);
      expect(await payloadOf(op.storedResultId)).toMatchObject({
        aiExecuted: true,
        answer: { state: 'CURRENT_REPORTING' },
      });
      const [reservation] = await db.computeReservation.findMany();
      expect(reservation).toMatchObject({ outcome: 'SUCCESS' });
      expect(reservation!.settledAt).not.toBeNull();
      /* actual = 2500 + 4 × 600 = 4900, written back to the global hour bucket */
      const global = await db.computeMeter.findMany({ where: { scope: 'global' } });
      expect(global.map((g) => Number(g.units))).toContain(4900);
      /* concurrency released on settle */
      const conc = await db.computeMeter.findMany({ where: { scope: { startsWith: 'conc:' } } });
      expect(conc.every((c) => Number(c.units) === 0)).toBe(true);
    });

    it('no double provider call: a retried submit and a re-execute reuse the one run', async () => {
      const key = randomUUID();
      const first = await submit('What is happening in Kenya?', key);
      const again = await submit('What is happening in Kenya?', key);
      await within(() => service.execute(userId, first.operationId));
      expect(again.operationId).toBe(first.operationId);
      expect(analyzeNews).toHaveBeenCalledTimes(1);
    });

    it('opening an existing result is display-only: 0 AI', async () => {
      const op = await submit('What is happening in Kenya?');
      analyzeNews.mockClear();
      const read = await service.getOperation(userId, op.operationId);
      expect(read.result?.displayOnly).toBe(true);
      expect(analyzeNews).not.toHaveBeenCalled();
    });

    it('the same question asked again reuses the stored result: 0 additional AI', async () => {
      await submit('What is happening in Kenya?');
      const second = await submit('What is happening in Kenya?');
      expect(second.storedResultReused).toBe(true);
      expect(analyzeNews).toHaveBeenCalledTimes(1);
    });

    it('deep analysis stops at a quote: 0 AI until explicitly accepted', async () => {
      const quoted = await submit('What is happening in Kenya?', randomUUID(), 'deep-analysis');
      expect(quoted.status).toBe('QUOTED');
      expect(quoted.requiresAcceptance).toBe(true);
      expect(analyzeNews).not.toHaveBeenCalled();
      await service.accept(userId, quoted.operationId);
      await service.reserve(userId, quoted.operationId);
      const done = await within(() => service.execute(userId, quoted.operationId));
      expect(done.status).toBe('COMPLETED');
      expect(analyzeNews).toHaveBeenCalledTimes(1);
    });

    it('an exhausted account budget refuses with its control named; 0 AI', async () => {
      values.ASK_ACCOUNT_UNITS_PER_DAY = '100';
      build();
      const op = await submit('What is happening in Kenya?');
      expect(op.status).toBe('RELEASED');
      expect(op.failureCode).toBe('BUDGET_REFUSED:account-day');
      expect(analyzeNews).not.toHaveBeenCalled();
    });

    it('Sand stays off: nothing is charged', async () => {
      const op = await submit('What is happening in Kenya?');
      expect(op.chargingEnabled).toBe(false);
      expect(op.quotedSand).toBe(0);
    });
  });
});
