import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
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
 * ASK R3 RELEASE-REVIEW CLOSEOUT — THE CONTINUATION-BUDGET PROOF (disposable DB, no live spend)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The REAL execution adapter, REAL meter, REAL breaker, REAL switches and the REAL guest and
 * claim services on the loopback test database. Only the landed analysis call is a stub, which
 * reports usage through the same `usageSink` the real model path uses (2,500 prompt + 600
 * completion tokens → 2,500 + 4·600 = 4,900 units settled per answer).
 *
 * Settings: the PROPOSED ALPHA values from the Alpha release request — the Alpha outer controls
 * as read (code defaults where absent), plus the one explicit Alpha delta the journey needs
 * (ASK_IP_UNITS_PER_DAY=100000) and the proposed guest values — EXACTLY the Alpha release request.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Ask V2 live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const IP = 'ip:v4:198.51.100.77';
const PROPOSED_ALPHA: Record<string, string> = {
  ASK_V2_ENABLED: 'true',
  ASK_R2_ENABLED: 'true',
  ASK_PUBLIC_COMPUTE_ENABLED: 'true',
  ASK_GUEST_TRIAL_ENABLED: 'true',
  ASK_FLAG_CACHE_MS: '0',
  ASK_BREAKER_CACHE_MS: '0',
  /* Alpha outer controls: absent → code defaults, except the one proposed explicit delta. */
  ASK_IP_UNITS_PER_DAY: '100000',
  /* Proposed Alpha guest values (Alpha release request §4). */
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

live('ASK R3 closeout — three guest answers, sign-in, one explicit follow-up', () => {
  let db: PrismaClient;
  let values: Record<string, string>;
  let service: AskV2Service;
  let guests: GuestSessionService;
  let claims: GuestClaimService;
  let meter: ComputeMeterService;
  let switches: OperationalSwitchService;
  const analyzeNews = jest.fn();
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const created: string[] = [];

  const answer = (usage = { promptTokens: 2500, completionTokens: 600 }) =>
    jest.fn(async (...args: unknown[]) => {
      const policy = args[6] as { usageSink?: (u: typeof usage) => void };
      policy.usageSink?.(usage);
      return {
        analysis: {},
        articles: [{ id: 'a' }, { id: 'b' }],
        retrievalContext: {},
      } as unknown as AnalysisApiResponse;
    });

  function build(): void {
    meter = new ComputeMeterService(db as unknown as PrismaService, config);
    const breaker = new CircuitBreakerService(db as unknown as PrismaService, meter);
    switches = new OperationalSwitchService(db as unknown as PrismaService, config, meter);
    guests = new GuestSessionService(db as unknown as PrismaService, config, meter, switches);
    claims = new GuestClaimService(db as unknown as PrismaService, guests, meter);
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      {
        id: 'mock',
        displayName: 'Mock',
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

  const asGuest = <T>(guestSessionId: string, work: () => Promise<T>) =>
    askRequestContext.run({ accountId: null, guestSessionId, ipScope: IP }, work);
  const asAccount = <T>(accountId: string, work: () => Promise<T>) =>
    askRequestContext.run({ accountId, ipScope: IP }, work);
  const ask = (q: string) => ({
    idempotencyKey: randomUUID(),
    question: q,
    language: 'en' as const,
    intent: 'ask' as const,
  });

  async function meterRow(scope: string): Promise<number> {
    const rows = await db.computeMeter.findMany({ where: { scope } });
    return rows.reduce((sum, r) => sum + Number(r.units), 0);
  }
  async function snapshot(userId: string, guestId: string) {
    return {
      globalDay: await meterRow('global:day'),
      globalHour: await meterRow('global:hour'),
      provider: await meterRow('provider:openai'),
      ip: await meterRow(IP),
      guestPoolDay: await meterRow('guestpool:day'),
      guest: await meterRow(`guest:${guestId}`),
      account: await meterRow(`acct:${userId}`),
      accountGuestAttribution: await meterRow(`acctguest:${userId}`),
    };
  }
  async function newGuest(): Promise<{ id: string; tokenHash: string; threadId: string }> {
    const g = await guests.issue(IP, { cookie: () => undefined } as never);
    const row = await db.guestSession.findUniqueOrThrow({ where: { id: g.id } });
    const thread = await service.createThread(guestPrincipal(g.id), {
      idempotencyKey: randomUUID(),
      language: 'en',
    });
    return { id: g.id, tokenHash: row.tokenHash, threadId: thread.id };
  }
  async function newAccount(): Promise<string> {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `r3-closeout-${id}@example.invalid` } });
    created.push(id);
    return id;
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
    values = { ...PROPOSED_ALPHA };
    analyzeNews.mockReset();
    analyzeNews.mockImplementation(answer());
    build();
    for (const name of [
      'ASK_R2_ENABLED',
      'ASK_PUBLIC_COMPUTE_ENABLED',
      'ASK_GUEST_TRIAL_ENABLED',
    ] as const) {
      await switches.set(name, true, 'r3-closeout-spec', 'disposable test database');
    }
    switches.forget();
  });

  it('JOURNEY · 3 counted answers → 4th blocked before any external work → one-time claim → explicit follow-up ADMITTED; nothing double-charged or reset', async () => {
    const g = await newGuest();
    const questions = [
      'What is happening in Kenya?',
      'What is happening in Rwanda?',
      'What is happening in Ghana?',
    ];
    for (const q of questions) {
      const op = await asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, ask(q)),
      );
      expect(op.status).toBe('COMPLETED');
    }
    expect(analyzeNews).toHaveBeenCalledTimes(3);
    expect((await service.guestAllowance(g.id)).committed).toBe(3);

    /* 4th: refused BEFORE the planner, provider or model. */
    await expect(
      asGuest(g.id, () =>
        service.submit(guestPrincipal(g.id), g.threadId, ask('What is happening in Uganda?')),
      ),
    ).rejects.toMatchObject({ response: { code: 'GUEST_TRIAL_EXHAUSTED' } });
    expect(analyzeNews).toHaveBeenCalledTimes(3);

    /* One-time claim, then transfer to a brand-new account. */
    const userId = await newAccount();
    await claims.createClaim(g.id, g.threadId);
    const claimId = (await claims.pendingClaimFor(g.id)) as string;
    const before = await snapshot(userId, g.id);
    expect((await claims.transfer(claimId, g.tokenHash, userId)).transferred).toBe(true);
    const after = await snapshot(userId, g.id);

    /* No auto-submit, no regeneration at claim. */
    expect(analyzeNews).toHaveBeenCalledTimes(3);
    /* Shared totals untouched by the identity change: not charged again, not erased. */
    expect(after.globalDay).toBe(before.globalDay);
    expect(after.globalHour).toBe(before.globalHour);
    expect(after.provider).toBe(before.provider);
    expect(after.ip).toBe(before.ip);
    expect(after.guestPoolDay).toBe(before.guestPoolDay);
    expect(after.guest).toBe(before.guest);
    /* Guest usage is ATTRIBUTED to the account once; the account's own eligibility is not debited. */
    expect(after.guest).toBe(3 * 4900);
    expect(after.accountGuestAttribution).toBe(after.guest);
    expect(after.account).toBe(0);

    /*
      The explicit same-conversation follow-up, through the ACCOUNT principal: admitted and answered.
      It is self-contained on purpose: an elliptical "And what about X?" gets the landed Ask R2
      NO_PRIOR_SUBJECT clarification (turn context does not cross the frozen execution port) —
      a pre-existing property of the release, recorded in the closeout, not changed here.
    */
    const follow = await asAccount(userId, () =>
      service.submit(accountPrincipal(userId), g.threadId, ask('What is happening in Uganda?')),
    );
    expect(follow.status).toBe('COMPLETED');
    expect(analyzeNews).toHaveBeenCalledTimes(4);
    const final = await snapshot(userId, g.id);
    expect(final.account).toBe(4900);
    expect(final.ip).toBe(after.ip + 4900);
    expect(final.globalDay).toBe(after.globalDay + 4900);
    /* The conversation is one thread: 3 guest turns + the follow-up. */
    expect((await service.getThread(accountPrincipal(userId), g.threadId)).turns).toHaveLength(4);
  });

  it('RESERVATION FEASIBILITY at the follow-up check: remaining account allowance ≥ the next reservation estimate', async () => {
    const g = await newGuest();
    for (const q of [
      'What is happening in Kenya?',
      'What is happening in Rwanda?',
      'What is happening in Ghana?',
    ]) {
      await asGuest(g.id, () => service.submit(guestPrincipal(g.id), g.threadId, ask(q)));
    }
    const userId = await newAccount();
    await claims.createClaim(g.id, g.threadId);
    await claims.transfer((await claims.pendingClaimFor(g.id)) as string, g.tokenHash, userId);
    /* The exact reservation the adapter would make for this follow-up. */
    const estimate =
      Math.ceil((8 * 1200 + 'What is happening in Uganda?'.length + 6000) / 4) + 4 * 2000;
    expect(estimate).toBeLessThanOrEqual(meter.config.unitsPerRequestMax);
    const accountLeft = meter.config.accountUnitsPerDay - (await meterRow(`acct:${userId}`));
    expect(accountLeft).toBeGreaterThanOrEqual(estimate);
    const ipLeft = meter.config.ipUnitsPerDay - (await meterRow(IP));
    expect(ipLeft).toBeGreaterThanOrEqual(estimate);
  });

  it('EXISTING account: its own history and its own usage are neither overwritten nor reset by the handover', async () => {
    const userId = await newAccount();
    const own = await service.createThread(accountPrincipal(userId), {
      idempotencyKey: randomUUID(),
      language: 'en',
    });
    await asAccount(userId, () =>
      service.submit(accountPrincipal(userId), own.id, ask('What is happening in Chile?')),
    );
    const ownUsage = await meterRow(`acct:${userId}`);
    expect(ownUsage).toBe(4900);

    const g = await newGuest();
    await asGuest(g.id, () =>
      service.submit(guestPrincipal(g.id), g.threadId, ask('What is happening in Peru?')),
    );
    await claims.createClaim(g.id, g.threadId);
    await claims.transfer((await claims.pendingClaimFor(g.id)) as string, g.tokenHash, userId);

    expect(await meterRow(`acct:${userId}`)).toBe(ownUsage);
    expect(await db.askThread.count({ where: { userId } })).toBe(2);
    expect((await service.getThread(accountPrincipal(userId), own.id)).turns).toHaveLength(1);
  });

  it('CONCURRENT and REPEATED claims cannot multiply anything: one transfer, one attribution', async () => {
    const g = await newGuest();
    await asGuest(g.id, () =>
      service.submit(guestPrincipal(g.id), g.threadId, ask('What is happening in Kenya?')),
    );
    const userId = await newAccount();
    await claims.createClaim(g.id, g.threadId);
    const claimId = (await claims.pendingClaimFor(g.id)) as string;
    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () => claims.transfer(claimId, g.tokenHash, userId)),
    );
    const transferred = outcomes.filter((o) => o.status === 'fulfilled' && o.value.transferred);
    expect(transferred).toHaveLength(1);
    /* Replay after the fact. */
    expect((await claims.transfer(claimId, g.tokenHash, userId)).transferred).toBe(false);
    expect(await meterRow(`acctguest:${userId}`)).toBe(4900);
    expect(await meterRow(`acct:${userId}`)).toBe(0);
    /* The guest's own allowance is not renewed by the claim: its session is CLAIMED. */
    expect((await db.guestSession.findUniqueOrThrow({ where: { id: g.id } })).status).toBe(
      'CLAIMED',
    );
  });

  it('FAILURE after a model call keeps its incurred usage; an EMPTY retrieval settles zero model units; neither consumes a visible slot', async () => {
    const g = await newGuest();
    analyzeNews.mockImplementationOnce(async (...args: unknown[]) => {
      (
        args[6] as { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void }
      ).usageSink?.({
        promptTokens: 3000,
        completionTokens: 500,
      });
      return {
        analysis: null,
        analysisError: 'MODEL_FAILURE',
        articles: [{ id: 'a' }],
        retrievalContext: {},
      } as unknown as AnalysisApiResponse;
    });
    const failed = await asGuest(g.id, () =>
      service.submit(guestPrincipal(g.id), g.threadId, ask('What is happening in Kenya?')),
    );
    expect(failed.status).toBe('RELEASED');
    expect(await meterRow(`guest:${g.id}`)).toBe(3000 + 4 * 500);

    analyzeNews.mockImplementationOnce(
      async () => ({ analysis: null, articles: [], retrievalContext: {} }) as never,
    );
    const empty = await asGuest(g.id, () =>
      service.submit(guestPrincipal(g.id), g.threadId, ask('What is happening in Tuvalu?')),
    );
    expect(empty.status).toBe('COMPLETED');
    /* The empty retrieval added no model units. */
    expect(await meterRow(`guest:${g.id}`)).toBe(3000 + 4 * 500);

    const slots = await db.guestSlot.findMany({
      where: { guestSessionId: g.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(slots.map((s) => [s.state, s.releaseReason])).toEqual([
      ['RELEASED', 'FAILED'],
      ['RELEASED', 'NO_ANSWER'],
    ]);
    expect((await service.guestAllowance(g.id)).remaining).toBe(3);
  });

  it('ALPHA AS READ (IP/day 30,000 code default, no explicit value) cannot hold three answers: guest configuration fails CLOSED', async () => {
    delete values.ASK_IP_UNITS_PER_DAY;
    build();
    const config = guests.trialConfig();
    expect(config.valid).toBe(false);
    await expect(guests.issue(IP, { cookie: () => undefined } as never)).rejects.toMatchObject({
      response: { code: 'GUEST_TRIAL_NOT_CONFIGURED' },
    });
  });
});
