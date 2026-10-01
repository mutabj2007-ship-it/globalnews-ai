import { AskExecutionRefused, type AskRequest } from './ask-compute.contract';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext, type AskRequestContext } from './ask-request-context';
import { countsAsGuestAnswer } from './guest/guest-allowance';

/**
 * UNIFIED INTELLIGENCE BINDING R2A.1 — guest background compute-meter parity.
 *
 * The Reporting path always reserved a guest's work with its guest resource scope (pool hour,
 * pool day, session units, session concurrency). The REFERENCE_BACKGROUND path reached the same
 * meter WITHOUT it. These cases pin that both paths now hand the meter the SAME scope, built
 * once from server-held context and GuestSessionService's config, and that every guest control
 * still fails closed BEFORE any model call. Every dependency is faked at its boundary; the real
 * meter rows are proven by `ask-r2-guest-meter-parity.postgres.spec.ts`.
 */

const LIMITS = {
  attemptsPerSession: 8,
  unitsPerSession: 48000,
  poolUnitsPerHour: 100000,
  poolUnitsPerDay: 500000,
  sessionsPerIpScopePerDay: 1000,
  executionsPerIpScopePerDay: 1000,
  executionsPerDay: 1000,
  concurrentPerSession: 1,
  cooldownAfterNoAnswer: 3,
  cooldownSeconds: 600,
};
const LIFETIMES = {
  sessionLifetimeH: 168,
  claimTtlS: 600,
  sweepIntervalS: 60,
  sweepBatch: 100,
  purgeGraceH: 24,
};
const GUEST_ID = '6f1c2a54-0d4b-4c8e-9a51-2f3e7b9c1d20';
const EXPECTED_GUEST_SCOPE = {
  sessionId: GUEST_ID,
  unitsPerSession: 48000,
  poolUnitsPerHour: 100000,
  poolUnitsPerDay: 500000,
  concurrentPerSession: 1,
};

type Calls = {
  analysis: unknown[][];
  background: unknown[][];
  reserve: Record<string, unknown>[];
  settle: unknown[][];
  record: unknown[][];
};

function harness(opts: {
  guests?: 'valid' | 'invalid' | 'absent';
  guestSwitch?: boolean;
  meter?: 'admit' | 'refuse-session-units' | 'degrade-pool-hour' | 'refuse-concurrent-guest';
  background?: () => Promise<{ text: string | null }>;
}) {
  const calls: Calls = { analysis: [], background: [], reserve: [], settle: [], record: [] };
  const analysisService = {
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      calls.analysis.push(args);
      (
        args[6] as { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void }
      ).usageSink?.({ promptTokens: 3000, completionTokens: 800 });
      return { analysis: {}, articles: [{}, {}], retrievalContext: {} };
    }),
  };
  const backgroundProvider = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    answerBackground: jest.fn(async (input: unknown) => {
      calls.background.push([input]);
      const { usageSink } = input as {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      };
      if (opts.background) return opts.background();
      usageSink?.({ promptTokens: 500, completionTokens: 200 });
      return { text: 'General background answer.' };
    }),
  };
  const meterMode = opts.meter ?? 'admit';
  const meter = {
    config: { outputWeight: 4 },
    reserve: jest.fn(async (input: Record<string, unknown>) => {
      calls.reserve.push(input);
      if (meterMode === 'refuse-session-units')
        return {
          admitted: false as const,
          kind: 'REFUSED' as const,
          control: 'guest-session-units',
        };
      if (meterMode === 'degrade-pool-hour')
        return { admitted: false as const, kind: 'DEGRADED' as const, control: 'guest-pool-hour' };
      if (meterMode === 'refuse-concurrent-guest')
        return { admitted: false as const, kind: 'REFUSED' as const, control: 'concurrent-guest' };
      return { admitted: true as const, reservationId: 'res-1', estimatedUnits: 1000 };
    }),
    settle: jest.fn(async (...args: unknown[]) => {
      calls.settle.push(args);
      return true;
    }),
  };
  const breaker = {
    permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' as const })),
    record: jest.fn(async (...args: unknown[]) => {
      calls.record.push(args);
    }),
  };
  const sw: Record<string, boolean> = {
    ASK_R2_ENABLED: true,
    ASK_PUBLIC_COMPUTE_ENABLED: true,
    ASK_GUEST_TRIAL_ENABLED: opts.guestSwitch ?? true,
  };
  const switches = { isEnabled: jest.fn(async (name: string) => sw[name] === true) };
  const guestMode = opts.guests ?? 'valid';
  const guests =
    guestMode === 'absent'
      ? undefined
      : {
          trialConfig: jest.fn(() =>
            guestMode === 'valid'
              ? { valid: true as const, limits: LIMITS, lifetimes: LIFETIMES }
              : {
                  valid: false as const,
                  problems: ['ASK_GUEST_UNITS_PER_SESSION'],
                  lifetimes: LIFETIMES,
                },
          ),
        };
  const adapter = new AskR2ExecutionAdapter(
    analysisService as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    backgroundProvider as never,
    meter as never,
    breaker as never,
    switches as never,
    {
      get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
    } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async () => true) } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async () => ({ considered: [], contributions: [] })),
    } as never,
    guests as never,
  );
  return { adapter, calls, guests };
}

const BACKGROUND_Q = 'What is inflation?';
const REPORTING_Q = 'What is happening in Kenya?';
const req = (question: string): AskRequest => ({ question, language: 'en', intent: 'ask' });
const GUEST: AskRequestContext = {
  accountId: null,
  guestSessionId: GUEST_ID,
  ipScope: 'ip:v4:203.0.113.9',
};
const ACCOUNT: AskRequestContext = { accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' };

async function run(
  h: ReturnType<typeof harness>,
  question: string,
  who: AskRequestContext,
): Promise<string> {
  const plan = await h.adapter.prepare(req(question));
  return (await askRequestContext.run(who, () => h.adapter.execute(req(question), plan, 'op-1')))
    .payloadJson;
}

async function refusal(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return 'NOT_REFUSED';
  } catch (e) {
    return e instanceof AskExecutionRefused ? e.code : `OTHER:${(e as Error).message}`;
  }
}

describe('R2A.1 — the questions take the paths under test', () => {
  it('the background question plans REFERENCE_BACKGROUND_ONLY; the reporting question does not', async () => {
    const { adapter } = harness({});
    expect((await adapter.prepare(req(BACKGROUND_Q))).contract).toMatch(
      /:REFERENCE:REFERENCE_BACKGROUND_ONLY$/,
    );
    expect((await adapter.prepare(req(REPORTING_Q))).contract).not.toMatch(
      /REFERENCE_BACKGROUND_ONLY$/,
    );
  });
});

describe('R2A.1 — guest REFERENCE_BACKGROUND reserves with the guest resource scope', () => {
  it('a guest background answer reserves with EXACTLY the configured guest scope, then one provider call', async () => {
    const h = harness({});
    const payload = JSON.parse(await run(h, BACKGROUND_Q, GUEST)) as {
      answer: { state: string };
    };
    expect(payload.answer.state).toBe('REFERENCE_BACKGROUND');
    expect(h.calls.reserve).toHaveLength(1);
    expect(h.calls.reserve[0]).toEqual({
      accountId: null,
      ipScope: 'ip:v4:203.0.113.9',
      guest: EXPECTED_GUEST_SCOPE,
      provider: 'openai',
      estimatedUnits: expect.any(Number),
    });
    expect(h.calls.background).toHaveLength(1);
    expect(h.calls.analysis).toEqual([]);
  });

  it('the guest scope is the four meter controls’ inputs: pool hour, pool day, session units, session concurrency', async () => {
    const h = harness({});
    await run(h, BACKGROUND_Q, GUEST);
    const guest = h.calls.reserve[0]!.guest as typeof EXPECTED_GUEST_SCOPE;
    /* ComputeMeterService.reserve turns these into guest-pool-hour, guest-pool-day,
       guest-session-units and concurrent-guest (proven against real rows in the live spec). */
    expect(guest.poolUnitsPerHour).toBe(LIMITS.poolUnitsPerHour);
    expect(guest.poolUnitsPerDay).toBe(LIMITS.poolUnitsPerDay);
    expect(guest.unitsPerSession).toBe(LIMITS.unitsPerSession);
    expect(guest.concurrentPerSession).toBe(LIMITS.concurrentPerSession);
    expect(guest.sessionId).toBe(GUEST_ID);
  });

  it('PARITY: Reporting and Background hand the meter the identical guest scope', async () => {
    const background = harness({});
    await run(background, BACKGROUND_Q, GUEST);
    const reporting = harness({});
    await run(reporting, REPORTING_Q, GUEST);
    expect(reporting.calls.analysis).toHaveLength(1);
    expect(reporting.calls.reserve[0]!.guest).toEqual(EXPECTED_GUEST_SCOPE);
    expect(background.calls.reserve[0]!.guest).toEqual(reporting.calls.reserve[0]!.guest);
  });

  it('the guest scope comes from server-held context and config only (one config read per execution)', async () => {
    const h = harness({});
    await run(h, BACKGROUND_Q, GUEST);
    expect(h.guests!.trialConfig).toHaveBeenCalledTimes(1);
  });

  it('estimateBackgroundUnits is unchanged by the guest scope (same estimate for account and guest)', async () => {
    const asGuest = harness({});
    await run(asGuest, BACKGROUND_Q, GUEST);
    const asAccount = harness({});
    await run(asAccount, BACKGROUND_Q, ACCOUNT);
    expect(asGuest.calls.reserve[0]!.estimatedUnits).toBe(
      asAccount.calls.reserve[0]!.estimatedUnits,
    );
  });
});

describe('R2A.1 — accounts are unchanged', () => {
  it.each([
    ['background', BACKGROUND_Q],
    ['reporting', REPORTING_Q],
  ])('a signed-in %s request carries NO guest scope', async (_path, question) => {
    const h = harness({});
    await run(h, question, ACCOUNT);
    expect(h.calls.reserve).toHaveLength(1);
    expect(h.calls.reserve[0]).not.toHaveProperty('guest');
    expect(h.calls.reserve[0]).toMatchObject({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' });
    expect(h.guests!.trialConfig).not.toHaveBeenCalled();
  });

  it('an account background request needs no GuestSessionService (absent → still runs)', async () => {
    const h = harness({ guests: 'absent' });
    await run(h, BACKGROUND_Q, ACCOUNT);
    expect(h.calls.background).toHaveLength(1);
  });
});

describe('R2A.1 — every guest control fails closed BEFORE model spend, on both paths', () => {
  it.each([
    ['background', BACKGROUND_Q],
    ['reporting', REPORTING_Q],
  ] as const)(
    '%s: invalid guest config → GUEST_TRIAL_NOT_CONFIGURED; 0 reserve, 0 model',
    async (_p, q) => {
      const h = harness({ guests: 'invalid' });
      const plan = await h.adapter.prepare(req(q));
      expect(
        await refusal(askRequestContext.run(GUEST, () => h.adapter.execute(req(q), plan, 'op-1'))),
      ).toBe('GUEST_TRIAL_NOT_CONFIGURED');
      expect(h.calls.reserve).toEqual([]);
      expect(h.calls.background).toEqual([]);
      expect(h.calls.analysis).toEqual([]);
      expect(h.calls.settle).toEqual([]);
    },
  );

  it.each([
    ['background', BACKGROUND_Q],
    ['reporting', REPORTING_Q],
  ] as const)(
    '%s: no GuestSessionService → GUEST_TRIAL_NOT_CONFIGURED; 0 reserve, 0 model',
    async (_p, q) => {
      const h = harness({ guests: 'absent' });
      const plan = await h.adapter.prepare(req(q));
      expect(
        await refusal(askRequestContext.run(GUEST, () => h.adapter.execute(req(q), plan, 'op-1'))),
      ).toBe('GUEST_TRIAL_NOT_CONFIGURED');
      expect(h.calls.reserve).toEqual([]);
      expect(h.calls.background).toEqual([]);
      expect(h.calls.analysis).toEqual([]);
    },
  );

  it.each([
    ['background', BACKGROUND_Q],
    ['reporting', REPORTING_Q],
  ] as const)(
    '%s: ASK_GUEST_TRIAL_ENABLED off → GUEST_TRIAL_UNAVAILABLE; 0 reserve, 0 model',
    async (_p, q) => {
      const h = harness({ guestSwitch: false });
      const plan = await h.adapter.prepare(req(q));
      expect(
        await refusal(askRequestContext.run(GUEST, () => h.adapter.execute(req(q), plan, 'op-1'))),
      ).toBe('GUEST_TRIAL_UNAVAILABLE');
      expect(h.calls.reserve).toEqual([]);
      expect(h.calls.background).toEqual([]);
      expect(h.calls.analysis).toEqual([]);
    },
  );

  it.each([
    ['refuse-session-units', 'BUDGET_REFUSED:guest-session-units'],
    ['degrade-pool-hour', 'BUDGET_DEGRADED:guest-pool-hour'],
    ['refuse-concurrent-guest', 'BUDGET_REFUSED:concurrent-guest'],
  ] as const)(
    'background: a guest meter refusal (%s) prevents the provider call → %s; breaker REFUSAL; nothing settled',
    async (mode, code) => {
      const h = harness({ meter: mode });
      const plan = await h.adapter.prepare(req(BACKGROUND_Q));
      expect(
        await refusal(
          askRequestContext.run(GUEST, () => h.adapter.execute(req(BACKGROUND_Q), plan, 'op-1')),
        ),
      ).toBe(code);
      expect(h.calls.background).toEqual([]);
      expect(h.calls.settle).toEqual([]);
      expect(h.calls.record).toEqual([['openai', 'REFUSAL', false]]);
    },
  );
});

describe('R2A.1 — settlement releases exactly as before', () => {
  it('success: ONE settle on the one reservation with actual units (concurrency released by the meter)', async () => {
    const h = harness({});
    await run(h, BACKGROUND_Q, GUEST);
    /* 500 + 4 × 200 */
    expect(h.calls.settle).toEqual([['res-1', 1300, 'SUCCESS']]);
  });

  it('decline: ONE settle as NO_EVIDENCE at 0 units; not a substantive guest answer', async () => {
    const h = harness({ background: async () => ({ text: null }) });
    const payload = JSON.parse(await run(h, BACKGROUND_Q, GUEST)) as unknown;
    expect(h.calls.settle).toEqual([['res-1', 0, 'NO_EVIDENCE']]);
    expect(countsAsGuestAnswer(payload)).toBe(false);
    expect((payload as { answer: { state: string } }).answer.state).toBe('CAPABILITY_UNAVAILABLE');
  });

  it('provider failure: ONE settle as FAILURE (estimate kept), then MODEL_FAILURE', async () => {
    const h = harness({ background: () => Promise.reject(new Error('socket hang up')) });
    const plan = await h.adapter.prepare(req(BACKGROUND_Q));
    expect(
      await refusal(
        askRequestContext.run(GUEST, () => h.adapter.execute(req(BACKGROUND_Q), plan, 'op-1')),
      ),
    ).toBe('MODEL_FAILURE');
    expect(h.calls.settle).toEqual([['res-1', null, 'FAILURE']]);
  });
});

describe('R2A.1 — entitlement semantics unchanged', () => {
  it('a guest REFERENCE_BACKGROUND answer is still ONE substantive guest answer', async () => {
    const h = harness({});
    const payload = JSON.parse(await run(h, BACKGROUND_Q, GUEST)) as unknown;
    expect(countsAsGuestAnswer(payload)).toBe(true);
  });
});
