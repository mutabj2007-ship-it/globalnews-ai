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
  const answerBackground = jest.fn();
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
      service.submit(accountPrincipal(userId), threadId, {
        idempotencyKey: key,
        question,
        language,
        intent,
      }),
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
    answerBackground.mockReset();
    answerBackground.mockImplementation(async () => ({ text: null }));
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
    threadId = (
      await service.createThread(accountPrincipal(userId), {
        idempotencyKey: 'thread',
        language: 'en',
      })
    ).id;
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
        answerBackground,
      } as never,
      meter,
      breaker,
      switches,
      {
        get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
      } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      /* R1 observability: the REAL writer against the REAL database, so this live suite
         proves the observation is written and what it contains — not that a stub was
         called. `observationsFor` below reads it back through the same client. */
      new AskObservationService(
        db as unknown as PrismaService,
        new AskObservationRetentionService(db as unknown as PrismaService),
      ),
      /* ASK INTELLIGENCE BINDING R1 — CONFLICT bound; no governed contribution in this suite. */
      {
        boundSpecialistDomains: () => ['CONFLICT'],
        read: async () => ({ considered: [], contributions: [] }),
      } as never,
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
      /* actual = 2500 + 4 × 600 = 4900, written back to BOTH global buckets — each exactly
         once, in its own row, whatever the time of day (P1 R1: at 00:xx UTC the shared
         'global' scope used to merge them into one 9800 row). */
      const global = await db.computeMeter.findMany({
        where: { scope: { in: ['global:hour', 'global:day'] } },
        orderBy: { scope: 'asc' },
      });
      expect(global.map((g) => [g.scope, Number(g.units)])).toEqual([
        ['global:day', 4900],
        ['global:hour', 4900],
      ]);
      expect(await db.computeMeter.count({ where: { scope: 'global' } })).toBe(0);
      /* concurrency released on settle */
      const conc = await db.computeMeter.findMany({ where: { scope: { startsWith: 'conc:' } } });
      expect(conc.every((c) => Number(c.units) === 0)).toBe(true);
    });

    it('no double provider call: a retried submit and a re-execute reuse the one run', async () => {
      const key = randomUUID();
      const first = await submit('What is happening in Kenya?', key);
      const again = await submit('What is happening in Kenya?', key);
      await within(() => service.execute(accountPrincipal(userId), first.operationId));
      expect(again.operationId).toBe(first.operationId);
      expect(analyzeNews).toHaveBeenCalledTimes(1);
    });

    it('opening an existing result is display-only: 0 AI', async () => {
      const op = await submit('What is happening in Kenya?');
      analyzeNews.mockClear();
      const read = await service.getOperation(accountPrincipal(userId), op.operationId);
      expect(read.result?.displayOnly).toBe(true);
      expect(analyzeNews).not.toHaveBeenCalled();
    });

    /* CURRENT REPORTING STORED-RESULT REUSE R1 — a current question asked again (a NEW Send,
       new idempotency key) is a new observation under the same controls, never a replay. */
    it('the same current question asked again is observed afresh: a new operation, one more bounded call', async () => {
      const first = await submit('What is happening in Kenya?');
      const second = await submit('What is happening in Kenya?');
      expect(second.operationId).not.toBe(first.operationId);
      expect(second.storedResultReused).toBe(false);
      expect(second.computeClass).not.toBe('STORED');
      expect(second.storedResultId).not.toBe(first.storedResultId);
      expect(analyzeNews).toHaveBeenCalledTimes(2);
    });

    it('deep analysis stops at a quote: 0 AI until explicitly accepted', async () => {
      const quoted = await submit('What is happening in Kenya?', randomUUID(), 'deep-analysis');
      expect(quoted.status).toBe('QUOTED');
      expect(quoted.requiresAcceptance).toBe(true);
      expect(analyzeNews).not.toHaveBeenCalled();
      await service.accept(accountPrincipal(userId), quoted.operationId);
      await service.reserve(accountPrincipal(userId), quoted.operationId);
      const done = await within(() =>
        service.execute(accountPrincipal(userId), quoted.operationId),
      );
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

  /*
    ════════════════════════════════════════════════════════════════════════════
    CURRENT REPORTING STORED-RESULT REUSE R1 — Production 2026-10-01.
    "Any global news can you share?" settled INSUFFICIENT while GNews was rate-limited
    (operation 060f89ff…, aiExecuted=false). The reader sent it again 15 minutes later and
    got the SAME artifact back in 59 ms — no retrieval, checkedAt still 02:59 UTC — because
    any unexpired StoredResult with the same fingerprint was replayed.
    ════════════════════════════════════════════════════════════════════════════
  */
  describe('CURRENT REPORTING STORED-RESULT REUSE R1 — a new Send is a new observation', () => {
    const LIVE_Q = 'Any global news can you share?';
    beforeEach(allOn);
    /* The provider is rate-limited: retrieval reaches nothing usable, no model answer. */
    const degraded = async () =>
      ({ analysis: null, articles: [], retrievalContext: {} }) as unknown as AnalysisApiResponse;
    const stored = async (storedResultId: string | null) =>
      (await payloadOf(storedResultId)) as unknown as {
        aiExecuted: boolean;
        checkedAt: string;
        answer: { state: string };
      };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 15));

    it('1–5 · a degraded INSUFFICIENT answer is never replayed; the retry runs again; the first stays display-only', async () => {
      analyzeNews.mockImplementation(degraded);
      /* 1 — first attempt: degraded, INSUFFICIENT, aiExecuted=false */
      const first = await submit(LIVE_Q);
      expect(first.status).toBe('COMPLETED');
      const firstPayload = await stored(first.storedResultId);
      expect(firstPayload).toMatchObject({ aiExecuted: false, answer: { state: 'INSUFFICIENT' } });
      await tick();
      /* 2 — the same question, a NEW idempotency key, the provider still refusing */
      const second = await submit(LIVE_Q);
      /* 3 — a new operation; 4 — not a stored replay */
      expect(second.operationId).not.toBe(first.operationId);
      expect(second.storedResultReused).toBe(false);
      expect(second.computeClass).not.toBe('STORED');
      expect(analyzeNews).toHaveBeenCalledTimes(2);
      /* a FRESH degraded result with a NEW checkedAt — not the old artifact */
      expect(second.storedResultId).not.toBe(first.storedResultId);
      const secondPayload = await stored(second.storedResultId);
      expect(secondPayload).toMatchObject({ aiExecuted: false, answer: { state: 'INSUFFICIENT' } });
      expect(Date.parse(secondPayload.checkedAt)).toBeGreaterThan(
        Date.parse(firstPayload.checkedAt),
      );
      /* 5 — reopening the first operation: display-only, original checkedAt, 0 provider, 0 AI */
      analyzeNews.mockClear();
      const reservations = await db.computeReservation.count();
      const reopened = await service.getOperation(accountPrincipal(userId), first.operationId);
      expect(reopened.result?.displayOnly).toBe(true);
      expect(reopened.result?.id).toBe(first.storedResultId);
      expect((reopened.result?.payload as { checkedAt: string }).checkedAt).toBe(
        firstPayload.checkedAt,
      );
      expect(reopened.storedResultReused).toBe(false);
      expect(analyzeNews).not.toHaveBeenCalled();
      expect(answerBackground).not.toHaveBeenCalled();
      expect(await db.computeReservation.count()).toBe(reservations);
    });

    it('recovery: once the provider is back, the retry returns live reporting', async () => {
      analyzeNews.mockImplementationOnce(degraded);
      const first = await submit(LIVE_Q);
      expect((await stored(first.storedResultId)).answer.state).toBe('INSUFFICIENT');
      const retry = await submit(LIVE_Q);
      expect(retry.storedResultReused).toBe(false);
      expect(await stored(retry.storedResultId)).toMatchObject({
        aiExecuted: true,
        answer: { state: 'CURRENT_REPORTING' },
      });
    });

    it('a refusing control still governs the retry: it is refused by name, never answered from the old artifact', async () => {
      analyzeNews.mockImplementation(degraded);
      const first = await submit(LIVE_Q);
      values.ASK_ACCOUNT_UNITS_PER_DAY = '100';
      build();
      const retry = await submit(LIVE_Q);
      expect(retry.status).toBe('RELEASED');
      expect(retry.failureCode).toBe('BUDGET_REFUSED:account-day');
      expect(retry.storedResultReused).toBe(false);
      expect(retry.storedResultId).toBeNull();
      expect(retry.result).toBeNull();
      expect(analyzeNews).toHaveBeenCalledTimes(1);
      expect((await stored(first.storedResultId)).answer.state).toBe('INSUFFICIENT');
    });

    it('6 · a stable REFERENCE_BACKGROUND answer asked again is still reused: 0 additional calls', async () => {
      answerBackground.mockImplementation(async () => ({
        text: 'TCP is connection-oriented and reliable; UDP is connectionless.',
      }));
      const first = await submit('How does TCP work?');
      expect((await stored(first.storedResultId)).answer.state).toBe('REFERENCE_BACKGROUND');
      expect(answerBackground).toHaveBeenCalledTimes(1);
      const again = await submit('How does TCP work?');
      expect(again.operationId).not.toBe(first.operationId);
      expect(again.computeClass).toBe('STORED');
      expect(again.storedResultReused).toBe(true);
      expect(again.storedResultId).toBe(first.storedResultId);
      expect(answerBackground).toHaveBeenCalledTimes(1);
      expect(analyzeNews).not.toHaveBeenCalled();
    });

    it('a declined background (CAPABILITY_UNAVAILABLE) is not replayed either', async () => {
      const first = await submit('How does TCP work?');
      expect((await stored(first.storedResultId)).answer.state).toBe('CAPABILITY_UNAVAILABLE');
      const again = await submit('How does TCP work?');
      expect(again.storedResultReused).toBe(false);
      expect(answerBackground).toHaveBeenCalledTimes(2);
    });

    it('8 · deep analysis on a current question is quoted afresh: acceptance is still required, never a silent replay', async () => {
      const quoted = await submit('What is happening in Kenya?', randomUUID(), 'deep-analysis');
      await service.accept(accountPrincipal(userId), quoted.operationId);
      await service.reserve(accountPrincipal(userId), quoted.operationId);
      await within(() => service.execute(accountPrincipal(userId), quoted.operationId));
      expect(analyzeNews).toHaveBeenCalledTimes(1);
      const again = await submit('What is happening in Kenya?', randomUUID(), 'deep-analysis');
      expect(again.status).toBe('QUOTED');
      expect(again.requiresAcceptance).toBe(true);
      expect(again.storedResultReused).toBe(false);
      expect(analyzeNews).toHaveBeenCalledTimes(1);
    });
  });
});
