import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskExecutionRefused, validatePlan, type AskRequest } from './ask-compute.contract';
import {
  AskR2ExecutionAdapter,
  estimateUnits,
  estimateBackgroundUnits,
  executorVerificationOutcome,
} from './ask-r2-execution.adapter';
import { routeAskR2, type AskR2Route } from '../ask-router/ask-r2-route';
import type { AskContributionSet } from '../ask-intelligence/ask-specialist-read.coordinator';
import { deriveAnswerState } from '../ask-router/answer-state';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import { askRequestContext } from './ask-request-context';
import { GeneralBackgroundProviderError } from '../analysis/interfaces';
import { countsAsGuestAnswer } from './guest/guest-allowance';
import {
  ASK_MODEL_MAX_ATTEMPTS,
  resolveComputeControlsConfig,
} from '../compute-controls/compute-controls.config';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE E — the execution adapter, every dependency
 * faked AT ITS BOUNDARY so each control can be shown to fail closed BEFORE the analysis
 * path is reached. The live-Postgres composition is `ask-r2-execution.postgres.spec.ts`.
 */

type Calls = {
  analysis: unknown[][];
  background: unknown[][];
  reserve: unknown[];
  settle: unknown[][];
  permit: string[];
  record: unknown[][];
};

function harness(opts: {
  switches?: Partial<Record<'ASK_R2_ENABLED' | 'ASK_PUBLIC_COMPUTE_ENABLED', boolean>>;
  breakerAllowed?: boolean;
  meterAdmitted?: boolean;
  analysis?: (policy: {
    usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
  }) => Promise<Partial<AnalysisApiResponse>>;
  /** ASK GENERAL BACKGROUND EXECUTION R1 — the background provider's response/behaviour. */
  background?: (input: {
    usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
  }) => Promise<{ text: string | null }>;
  /** ASK INTELLIGENCE BINDING R1 — the governed contribution set the coordinator returns. */
  intelligence?: (route: AskR2Route) => AskContributionSet;
  /** TRUST R1 — the retained-reporting read (absent = not wired). */
  news?: { findRetainedByCountry: (iso2: string, limit: number, maxAgeMinutes: number) => Promise<unknown[]> };
}) {
  const calls: Calls = {
    analysis: [],
    background: [],
    reserve: [],
    settle: [],
    permit: [],
    record: [],
  };
  /*
    R1 observability — DELIBERATELY NOT A MEMBER OF `calls`.

    Several assertions below read `expect(calls).toEqual({ analysis: [], reserve: [], ... })`
    to prove a deterministic terminal spent NOTHING. Adding an observation key to that
    object would have forced every one of those assertions to be rewritten, and an
    assertion rewritten to accommodate a new write is exactly how a "this path spends
    nothing" guarantee gets quietly widened. The recorder is returned separately, so those
    assertions still mean what they meant, and the observation is asserted on its own.
  */
  const observed: unknown[] = [];
  const reads: AskR2Route[] = [];

  const analysisService = {
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      calls.analysis.push(args);
      const policy = args[6] as {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      };
      return (
        opts.analysis ??
        (async (p) => {
          p.usageSink?.({ promptTokens: 3000, completionTokens: 800 });
          return {
            analysis: {} as never,
            articles: [{} as never, {} as never],
            retrievalContext: {} as never,
          };
        })
      )(policy);
    }),
  };
  const provider = { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() };
  const backgroundProvider = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    answerBackground: jest.fn(async (input: unknown) => {
      calls.background.push([input]);
      const { usageSink } = input as {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      };
      return (
        opts.background ??
        (async (p: { usageSink?: typeof usageSink }) => {
          p.usageSink?.({ promptTokens: 500, completionTokens: 200 });
          return { text: 'General background answer.' };
        })
      )({ usageSink });
    }),
  };
  const meter = {
    config: { outputWeight: 4 },
    reserve: jest.fn(async (input: unknown) => {
      calls.reserve.push(input);
      return opts.meterAdmitted === false
        ? { admitted: false as const, kind: 'REFUSED' as const, control: 'account-day' }
        : { admitted: true as const, reservationId: 'res-1', estimatedUnits: 11_900 };
    }),
    settle: jest.fn(async (...args: unknown[]) => {
      calls.settle.push(args);
      return true;
    }),
  };
  const breaker = {
    permit: jest.fn(async (p: string) => {
      calls.permit.push(p);
      return opts.breakerAllowed === false
        ? { allowed: false, trial: false, state: 'OPEN' as const }
        : { allowed: true, trial: false, state: 'CLOSED' as const };
    }),
    record: jest.fn(async (...args: unknown[]) => {
      calls.record.push(args);
    }),
  };
  const sw = { ASK_R2_ENABLED: true, ASK_PUBLIC_COMPUTE_ENABLED: true, ...opts.switches };
  const switches = { isEnabled: jest.fn(async (name: keyof typeof sw) => sw[name]) };
  const analysisConfig = {
    get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
  };
  const specialists = { registeredDomains: () => ['CONFLICT'] };
  const adapter = new AskR2ExecutionAdapter(
    analysisService as never,
    provider as never,
    backgroundProvider as never,
    meter as never,
    breaker as never,
    switches as never,
    analysisConfig as never,
    specialists as never,
    /* Keeps what it was handed. Never a real store. */
    { record: jest.fn(async (input: unknown) => (observed.push(input), true)) } as never,
    /* ASK INTELLIGENCE BINDING R1 — a recorded coordinator: CONFLICT bound (its measured
       seam), reads recorded separately from `calls` so zero-spend assertions stay exact. */
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async (route: AskR2Route) => {
        reads.push(route);
        return opts.intelligence?.(route) ?? { considered: [], contributions: [] };
      }),
    } as never,
    undefined,
    opts.news as never,
  );
  return { adapter, calls, observed, reads };
}

const req = (question: string, language: 'en' | 'pl' = 'en'): AskRequest => ({
  question,
  language,
  intent: 'ask',
});
const inRequest = <T>(work: () => Promise<T>): Promise<T> =>
  askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' }, work);

async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'NOT_REFUSED';
  } catch (e) {
    return e instanceof AskExecutionRefused ? e.code : `OTHER:${(e as Error).message}`;
  }
}

describe('prepare — pure: frozen C only, no provider, no model', () => {
  it('returns a valid AskPlan and never touches the analysis path or a control', async () => {
    const { adapter, calls } = harness({});
    const plan = await adapter.prepare(req('What is happening in Kenya?'));
    expect(() => validatePlan(plan, req('What is happening in Kenya?'))).not.toThrow();
    expect(plan.contract).toMatch(/^ask-r2-adapter\/1:CURRENT_REPORTING:EXECUTABLE$/);
    expect(plan.countryCount).toBe(1);
    expect(calls).toEqual({
      analysis: [],
      background: [],
      reserve: [],
      settle: [],
      permit: [],
      record: [],
    });
  });

  it('a Polish question is routed through the same frozen authority', async () => {
    const { adapter } = harness({});
    expect((await adapter.prepare(req('Czym jest inflacja?', 'pl'))).contract).toMatch(
      /:REFERENCE:REFERENCE_BACKGROUND_ONLY$/,
    );
  });
});

describe('execute — a clarification is a successful terminal with ZERO AI', () => {
  it.each([
    ['Compare them.', 'en'],
    ['Porównaj je.', 'pl'],
    ['What were the results in 2026?', 'en'],
  ] as const)('%s → no switch read, no breaker, no reservation, no analysis', async (q, lg) => {
    const { adapter, calls } = harness({
      switches: { ASK_R2_ENABLED: false, ASK_PUBLIC_COMPUTE_ENABLED: false },
    });
    const plan = await adapter.prepare(req(q, lg));
    const result = await adapter.execute(req(q, lg), plan, 'op-1');
    const payload = JSON.parse(result.payloadJson) as {
      aiExecuted: boolean;
      answer: { state: string };
    };
    expect(result.succeeded).toBe(true);
    expect(payload.aiExecuted).toBe(false);
    expect(['CLARIFICATION_REQUIRED', 'CAPABILITY_UNAVAILABLE']).toContain(payload.answer.state);
    expect(calls).toEqual({
      analysis: [],
      background: [],
      reserve: [],
      settle: [],
      permit: [],
      record: [],
    });
  });
});

describe('execute — every control fails CLOSED before the analysis path', () => {
  const Q = 'What is happening in Kenya?';

  it.each([
    [{ switches: { ASK_R2_ENABLED: false } }, 'ASK_R2_DISABLED'],
    [{ switches: { ASK_PUBLIC_COMPUTE_ENABLED: false } }, 'ASK_PUBLIC_COMPUTE_DISABLED'],
    [{ breakerAllowed: false }, 'CIRCUIT_OPEN'],
    [{ meterAdmitted: false }, 'BUDGET_REFUSED:account-day'],
  ] as const)('%j → %s, analysis never called', async (opts, code) => {
    const { adapter, calls } = harness(opts);
    const plan = await adapter.prepare(req(Q));
    expect(await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')))).toBe(code);
    expect(calls.analysis).toEqual([]);
    expect(calls.settle).toEqual([]);
  });

  it('a budget refusal releases a claimed breaker trial as REFUSAL (never counted as failure)', async () => {
    const { adapter, calls } = harness({ meterAdmitted: false });
    const plan = await adapter.prepare(req(Q));
    await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')));
    expect(calls.record).toEqual([['openai', 'REFUSAL', false]]);
  });

  it('outside a request (no server-held account/IP) the call is refused — never unscoped', async () => {
    const { adapter, calls } = harness({});
    const plan = await adapter.prepare(req(Q));
    expect(await refusal(adapter.execute(req(Q), plan, 'op-1'))).toBe(
      'ASK_REQUEST_CONTEXT_MISSING',
    );
    expect(calls.permit).toEqual([]);
  });

  it('a plan quoted on a different route revision is refused', async () => {
    const { adapter, calls } = harness({});
    const plan = await adapter.prepare(req(Q));
    expect(
      await refusal(
        inRequest(() => adapter.execute(req(Q), { ...plan, revision: 'x'.repeat(64) }, 'op-1')),
      ),
    ).toBe('ASK_PLAN_REVISION_MISMATCH');
    expect(calls.analysis).toEqual([]);
  });
});

describe('execute — the one bounded call, settled on actual units', () => {
  const Q = 'What is happening in Kenya?';

  it('ONE analysis call, with maxModelAttempts = 1; reservation scoped to the server-held account and IP', async () => {
    const { adapter, calls } = harness({});
    const plan = await adapter.prepare(req(Q));
    const result = await inRequest(() => adapter.execute(req(Q), plan, 'op-1'));
    expect(calls.analysis).toHaveLength(1);
    expect(ASK_MODEL_MAX_ATTEMPTS).toBe(1);
    expect((calls.analysis[0]![6] as { maxModelAttempts: number }).maxModelAttempts).toBe(1);
    expect(calls.reserve).toEqual([
      expect.objectContaining({
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        provider: 'openai',
      }),
    ]);
    /* actual = prompt + outputWeight × completion = 3000 + 4 × 800 */
    expect(calls.settle).toEqual([['res-1', 6200, 'SUCCESS']]);
    expect(calls.record).toEqual([['openai', 'SUCCESS', false]]);
    const payload = JSON.parse(result.payloadJson) as {
      aiExecuted: boolean;
      answer: { state: string };
      modelPriorCitable: boolean;
    };
    expect(payload).toMatchObject({
      aiExecuted: true,
      answer: { state: 'CURRENT_REPORTING' },
      modelPriorCitable: false,
    });
    expect(result.evidenceRevision).toBe(plan.revision);
  });

  it('no evidence (0 articles, no model call) is a stored INSUFFICIENT answer, not a failure', async () => {
    const { adapter, calls } = harness({
      analysis: async () => ({
        analysis: null,
        analysisError: 'No matching reporting.',
        articles: [],
      }),
    });
    const plan = await adapter.prepare(req(Q));
    const result = await inRequest(() => adapter.execute(req(Q), plan, 'op-1'));
    expect(result.succeeded).toBe(true);
    const payload = JSON.parse(result.payloadJson) as {
      aiExecuted: boolean;
      answer: { state: string };
    };
    expect(payload).toMatchObject({ aiExecuted: false, answer: { state: 'INSUFFICIENT' } });
    /* the breaker is not told of a failure; the meter settles 0 actual units */
    expect(calls.record).toEqual([['openai', 'REFUSAL', false]]);
    expect(calls.settle).toEqual([['res-1', 0, 'NO_EVIDENCE']]);
  });

  it(
    'GATE H (Main MC-033), reconciled under ASK GENERAL BACKGROUND EXECUTION R1: a reference ' +
      'question the background provider declines is a TYPED refusal naming REFERENCE — never ' +
      '"no reporting found", and NEVER by way of a Reporting/news-retrieval call',
    async () => {
      const { adapter, calls } = harness({ background: async () => ({ text: null }) });
      const plan = await adapter.prepare(req('What is inflation?'));
      const result = await inRequest(() =>
        adapter.execute(req('What is inflation?'), plan, 'op-1'),
      );
      expect((JSON.parse(result.payloadJson) as { answer: unknown }).answer).toEqual({
        state: 'CAPABILITY_UNAVAILABLE',
        basis: 'REFERENCE_UNAVAILABLE',
        missingRoles: ['REFERENCE'],
      });
      /* THE proven defect this round closes: a background question never invokes Reporting
         merely to manufacture (or fail to find) a citation. */
      expect(calls.analysis).toEqual([]);
      expect(calls.background).toHaveLength(1);
    },
  );

  it('a provider failure WITH retrieved articles is still MODEL_FAILURE', async () => {
    const { adapter } = harness({
      analysis: async () => ({
        analysis: null,
        analysisError: 'provider-unavailable',
        articles: [{} as never],
      }),
    });
    const plan = await adapter.prepare(req(Q));
    expect(await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')))).toBe(
      'MODEL_FAILURE',
    );
  });

  it('a model failure settles with the estimate kept (null actual), records FAILURE, and refuses', async () => {
    const { adapter, calls } = harness({
      analysis: async () => ({
        analysis: null,
        analysisError: 'provider-unavailable',
        articles: [{} as never],
      }),
    });
    const plan = await adapter.prepare(req(Q));
    expect(await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')))).toBe(
      'MODEL_FAILURE',
    );
    expect(calls.settle).toEqual([['res-1', null, 'FAILURE']]);
    expect(calls.record).toEqual([['openai', 'FAILURE', false]]);
  });

  it('a thrown analysis error is also settled and recorded — the reservation never leaks', async () => {
    const { adapter, calls } = harness({
      analysis: async () => Promise.reject(new Error('socket hang up')),
    });
    const plan = await adapter.prepare(req(Q));
    expect(await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')))).toBe(
      'MODEL_FAILURE',
    );
    expect(calls.settle).toHaveLength(1);
  });

  it('the unit estimate for a MAXIMUM question fits the default per-request ceiling', () => {
    const ceiling = resolveComputeControlsConfig(() => undefined).unitsPerRequestMax;
    const max = estimateUnits(
      1000,
      { maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 },
      4,
    );
    expect(max).toBe(12_150);
    expect(max).toBeLessThanOrEqual(ceiling);
  });
});

describe('ASK GENERAL BACKGROUND EXECUTION R1 — REFERENCE_BACKGROUND_ONLY, zero Reporting calls', () => {
  const Q = 'What is inflation?';

  it.each([
    ['What is inflation?', 'en'],
    ['Czym jest inflacja?', 'pl'],
    ['Who was Hitler?', 'en'],
    ['What is NATO?', 'en'],
    ['How does an induction motor work?', 'en'],
    ['What is a derivative?', 'en'],
    ['How does TCP work?', 'en'],
    ['Explain the second law of thermodynamics.', 'en'],
    ['How does a transformer work?', 'en'],
  ] as const)(
    '%s (%s) → REFERENCE_BACKGROUND_ONLY plans through the background provider, never Reporting',
    async (q, lg) => {
      const { adapter, calls } = harness({});
      const plan = await adapter.prepare(req(q, lg));
      expect(plan.contract).toMatch(/:REFERENCE:REFERENCE_BACKGROUND_ONLY$/);
      const result = await inRequest(() => adapter.execute(req(q, lg), plan, 'op-1'));
      const payload = JSON.parse(result.payloadJson) as {
        aiExecuted: boolean;
        answer: { state: string };
        analysis: unknown;
        background: { text: string } | null;
        modelPriorCitable: boolean;
      };
      expect(payload).toMatchObject({
        aiExecuted: true,
        answer: { state: 'REFERENCE_BACKGROUND' },
        analysis: null,
        modelPriorCitable: false,
      });
      expect(payload.background).toEqual({ text: 'General background answer.' });
      /* THE proven defect this round closes. */
      expect(calls.analysis).toEqual([]);
      expect(calls.background).toHaveLength(1);
    },
  );

  it('ONE background call, maxModelAttempts = 1, reservation scoped to the server-held account/IP', async () => {
    const { adapter, calls } = harness({});
    const plan = await adapter.prepare(req(Q));
    await inRequest(() => adapter.execute(req(Q), plan, 'op-1'));
    expect(calls.background).toHaveLength(1);
    const input = calls.background[0]![0] as { maxModelAttempts?: number; question: string };
    expect(input.maxModelAttempts).toBe(ASK_MODEL_MAX_ATTEMPTS);
    expect(input.question).toBe(Q);
    expect(calls.reserve).toEqual([
      expect.objectContaining({
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        provider: 'openai',
      }),
    ]);
    /* actual = prompt + outputWeight × completion = 500 + 4 × 200 */
    expect(calls.settle).toEqual([['res-1', 1300, 'SUCCESS']]);
    expect(calls.record).toEqual([['openai', 'SUCCESS', false]]);
  });

  it('a decline (NO_BACKGROUND_ANSWER) settles as REFUSAL/0 units, never a fabricated answer, never MODEL_FAILURE', async () => {
    const { adapter, calls } = harness({ background: async () => ({ text: null }) });
    const plan = await adapter.prepare(req(Q));
    const result = await inRequest(() => adapter.execute(req(Q), plan, 'op-1'));
    const payload = JSON.parse(result.payloadJson) as {
      aiExecuted: boolean;
      answer: unknown;
      background: unknown;
    };
    expect(payload.aiExecuted).toBe(false);
    expect(payload.background).toBeNull();
    expect(payload.answer).toEqual({
      state: 'CAPABILITY_UNAVAILABLE',
      basis: 'REFERENCE_UNAVAILABLE',
      missingRoles: ['REFERENCE'],
    });
    expect(calls.settle).toEqual([['res-1', 0, 'NO_EVIDENCE']]);
    expect(calls.record).toEqual([['openai', 'REFUSAL', false]]);
  });

  it('a provider failure is MODEL_FAILURE — settled with the estimate kept, recorded, never silently answered', async () => {
    const { adapter, calls } = harness({
      background: async () => Promise.reject(new Error('socket hang up')),
    });
    const plan = await adapter.prepare(req(Q));
    expect(await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')))).toBe(
      'MODEL_FAILURE',
    );
    expect(calls.settle).toEqual([['res-1', null, 'FAILURE']]);
    expect(calls.record).toEqual([['openai', 'FAILURE', false]]);
  });

  /* A+H QUALIFICATION R1 — the provider's own attempt-timeout error, verbatim. Its message
     says "timed out"; the outcome must still be TIMEOUT in the refusal, meter and breaker. */
  it.each([
    ['attempt timeout', 'General background call timed out.'],
    ['caller deadline', 'General background call cancelled because the response deadline expired.'],
  ])(
    'a provider %s is MODEL_TIMEOUT — fail closed, settled and recorded as TIMEOUT',
    async (_k, message) => {
      const { adapter, calls } = harness({
        background: async () =>
          Promise.reject(new GeneralBackgroundProviderError(message, 'provider-timeout', false)),
      });
      const plan = await adapter.prepare(req(Q));
      expect(await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')))).toBe(
        'MODEL_TIMEOUT',
      );
      expect(calls.settle).toEqual([['res-1', null, 'TIMEOUT']]);
      expect(calls.record).toEqual([['openai', 'TIMEOUT', false]]);
      expect(calls.analysis).toEqual([]);
    },
  );

  it.each([
    [{ switches: { ASK_R2_ENABLED: false } }, 'ASK_R2_DISABLED'],
    [{ switches: { ASK_PUBLIC_COMPUTE_ENABLED: false } }, 'ASK_PUBLIC_COMPUTE_DISABLED'],
    [{ breakerAllowed: false }, 'CIRCUIT_OPEN'],
    [{ meterAdmitted: false }, 'BUDGET_REFUSED:account-day'],
  ] as const)(
    '%j → %s, the background provider is never called (same fail-closed order as Reporting)',
    async (opts, code) => {
      const { adapter, calls } = harness(opts);
      const plan = await adapter.prepare(req(Q));
      expect(await refusal(inRequest(() => adapter.execute(req(Q), plan, 'op-1')))).toBe(code);
      expect(calls.background).toEqual([]);
    },
  );

  it('outside a request (no server-held account/IP) the call is refused — never unscoped', async () => {
    const { adapter, calls } = harness({});
    const plan = await adapter.prepare(req(Q));
    expect(await refusal(adapter.execute(req(Q), plan, 'op-1'))).toBe(
      'ASK_REQUEST_CONTEXT_MISSING',
    );
    expect(calls.permit).toEqual([]);
  });

  it('the unit estimate for a long question fits the default per-request ceiling, and is far smaller than a Reporting call', () => {
    const ceiling = resolveComputeControlsConfig(() => undefined).unitsPerRequestMax;
    const reportingMax = estimateUnits(
      1000,
      { maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 },
      4,
    );
    const backgroundMax = estimateBackgroundUnits(1000, 4);
    expect(backgroundMax).toBeLessThanOrEqual(ceiling);
    expect(backgroundMax).toBeLessThan(reportingMax);
  });

  /*
    CTO POST-#66 CLOSURE — qualification family 1/2: MIXED background + current. A question
    with a stable part AND a present-day part (frozen C: `e.time.requirement === 'RECENT'`
    from a stated-now period, or a present-tense/geographic/domain signal — see
    `deriveEvidenceNeeds` in planner.ts) must put NEWS_REPORTING into `required`, so
    `required.length` is never 0 and the terminal is never REFERENCE_BACKGROUND_ONLY. That
    is the whole proof: a mixed question stays on the CURRENT-EVIDENCE path, so a current
    claim structurally cannot be silently answered from model background — there is no
    branch in this adapter that would let it.

    A+H QUALIFICATION R1 (test-only correction) — on that path Frozen C may still END the
    question before Reporting runs: "…NATO…in Poland today?" is BROADENING_OFFERED (a
    clarification) and "…inflation rate today?" is CAPABILITY_UNAVAILABLE. Both are governed
    current-path outcomes with zero model calls. The earlier assertion that Reporting always
    executes did not hold against the frozen router; the invariant asserted now is the one
    that matters: never the background provider, never background text, never citable.
  */
  describe('CTO POST-#66 CLOSURE — mixed background + current, never a silent fallback', () => {
    /*
      ASK INTELLIGENCE BINDING R1 (§11B) — SUPERSEDED WITH UPDATED CONTRACT PROOF. "today" is no
      longer an untransportable constraint (current reporting IS the most recent reporting), so
      both questions now EXECUTE current reporting instead of ending in broadening/capability.
      The invariant this block exists for is unchanged and still asserted: the current-evidence
      path, never the background provider, never background text, never citable model memory.
    */
    it.each([
      'What is NATO and what is it doing in Poland today?',
      'What is inflation and what is the inflation rate today?',
    ])('%s → current reporting, never the background provider', async (q) => {
      const { adapter, calls } = harness({});
      const plan = await adapter.prepare(req(q));
      expect(plan.contract).toMatch(/:CURRENT_REPORTING:EXECUTABLE$/);
      expect(plan.contract).not.toMatch(/:REFERENCE_BACKGROUND_ONLY$/);
      const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
      const payload = JSON.parse(result.payloadJson);
      expect(payload.answer.state).toBe('CURRENT_REPORTING');
      expect(payload.background).toBeNull();
      expect(payload.modelPriorCitable).toBe(false);
      expect(calls.background).toEqual([]);
      expect(calls.analysis).toHaveLength(1);
    });

    it('a current question that IS executable reaches Reporting, never the background provider', async () => {
      const q = 'What is happening in Kenya?';
      const { adapter, calls } = harness({});
      const plan = await adapter.prepare(req(q));
      expect(plan.contract).toMatch(/:CURRENT_REPORTING:EXECUTABLE$/);
      const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
      expect(JSON.parse(result.payloadJson).background).toBeNull();
      expect(calls.background).toEqual([]);
      expect(calls.analysis).toHaveLength(1);
    });
  });

  /*
    CTO POST-#66 CLOSURE — qualification family 2/2: BACKGROUND + FOLLOW-UP. A single
    adapter instance carries no per-turn state (`execute` reads only its arguments — the
    request, the plan Frozen C already computed, and the operation id), so this proves the
    provenance boundary holds ACROSS a conversation, not just within one call: three
    resolved turns (the upstream continuation/pronoun resolution that turns "Why was it
    created?" into a self-contained question is a different, already-tested layer — this
    adapter only ever sees the resolved text) run through the SAME harness, and the
    background/Reporting call counts must move independently, per turn, with no leakage
    from the prior turn's classification.
  */
  describe('CTO POST-#66 CLOSURE — background + follow-up, provenance boundary across turns', () => {
    it('stable → stable → current: each turn is classified and executed on its own, no state carried over', async () => {
      const { adapter, calls } = harness({});

      const turn1 = 'What is NATO?';
      const plan1 = await adapter.prepare(req(turn1));
      expect(plan1.contract).toMatch(/:REFERENCE_BACKGROUND_ONLY$/);
      await inRequest(() => adapter.execute(req(turn1), plan1, 'op-1'));
      expect(calls.background).toHaveLength(1);
      expect(calls.analysis).toHaveLength(0);

      /* A+H QUALIFICATION R1 (test-only correction) — "Why was NATO created?" is classified
         CURRENT_REPORTING by the frozen router (the conservative direction: it goes to
         evidence, not to the model), so it cannot stand for a stable turn. "What is the
         history of NATO?" is REFERENCE_BACKGROUND_ONLY under Frozen C. */
      const turn2 = 'What is the history of NATO?';
      const plan2 = await adapter.prepare(req(turn2));
      expect(plan2.contract).toMatch(/:REFERENCE_BACKGROUND_ONLY$/);
      await inRequest(() => adapter.execute(req(turn2), plan2, 'op-2'));
      expect(calls.background).toHaveLength(2);
      expect(calls.analysis).toHaveLength(0);

      /* ASK INTELLIGENCE BINDING R1 (§11B) — "today" now reaches current reporting (it used to
         end in BROADENING_OFFERED). The boundary is what matters — it never reaches background. */
      const turn3 = 'What is NATO doing in Poland today?';
      const plan3 = await adapter.prepare(req(turn3));
      expect(plan3.contract).toMatch(/:CURRENT_REPORTING:/);
      const r3 = await inRequest(() => adapter.execute(req(turn3), plan3, 'op-3'));
      expect(JSON.parse(r3.payloadJson).background).toBeNull();
      expect(calls.background).toHaveLength(2);
      expect(calls.analysis).toHaveLength(1);

      /* …and an executable current follow-up goes to Reporting, still never to background. */
      const turn4 = 'What is happening in Kenya?';
      const plan4 = await adapter.prepare(req(turn4));
      await inRequest(() => adapter.execute(req(turn4), plan4, 'op-4'));
      /* the boundary: current turns never touch the background provider, and turns 1–2's
         background answers never touched Reporting. */
      expect(calls.background).toHaveLength(2);
      expect(calls.analysis).toHaveLength(2);
    });
  });
});

describe('GATE H — Main R1.1 execution rows', () => {
  it('MC-047/MC-050: a computation or an attached file is a typed refusal with ZERO AI and no control touched', async () => {
    for (const q of ['Solve x^3 - 4x + 1 = 0', 'Summarise the PDF I attached']) {
      const { adapter, calls } = harness({});
      const plan = await adapter.prepare(req(q));
      const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
      const payload = JSON.parse(result.payloadJson) as {
        aiExecuted: boolean;
        answer: { state: string };
      };
      expect(payload).toMatchObject({
        aiExecuted: false,
        answer: { state: 'CAPABILITY_UNAVAILABLE' },
      });
      expect(calls).toEqual({
        analysis: [],
        background: [],
        reserve: [],
        settle: [],
        permit: [],
        record: [],
      });
    }
  });

  it('executor guard: a signed-in personal question is not answered from reporting (EXECUTOR_NOT_WIRED, ZERO AI)', async () => {
    const q = 'What have I saved about Rwanda?';
    const { adapter, calls } = harness({});
    const plan = await inRequest(() => adapter.prepare(req(q)));
    const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
    const payload = JSON.parse(result.payloadJson) as { aiExecuted: boolean; answer: unknown };
    expect(payload.answer).toEqual({
      state: 'CAPABILITY_UNAVAILABLE',
      basis: 'EXECUTOR_NOT_WIRED',
      missingRoles: ['PERSONAL'],
    });
    expect(payload.aiExecuted).toBe(false);
    expect(calls.analysis).toEqual([]);
    expect(calls.reserve).toEqual([]);
  });

  it('anonymous: the same personal question is IDENTITY_REQUIRED (frozen B7a), ZERO AI', async () => {
    const q = 'What have I saved about Rwanda?';
    const { adapter, calls } = harness({});
    const anon = <T>(work: () => Promise<T>) =>
      askRequestContext.run({ accountId: null, ipScope: 'ip:v4:203.0.113.7' }, work);
    const plan = await anon(() => adapter.prepare(req(q)));
    const result = await anon(() => adapter.execute(req(q), plan, 'op-1'));
    expect(JSON.parse(result.payloadJson)).toMatchObject({
      aiExecuted: false,
      answer: { state: 'CAPABILITY_UNAVAILABLE', basis: 'PLAN_IDENTITY_REQUIRED' },
      route: { terminalState: 'IDENTITY_REQUIRED' },
    });
    expect(calls.analysis).toEqual([]);
  });

  it('MC-069: the landed path ASKED ("Congo") — returned as a clarification with its candidates, no model', async () => {
    const q = 'What is happening in Congo?';
    const { adapter, calls } = harness({
      analysis: async () => ({
        analysis: null,
        articles: [],
        retrievalContext: {
          retrievalOutcome: 'CLARIFICATION_REQUIRED',
          clarificationReason: 'AMBIGUOUS_COUNTRY',
          clarificationCandidates: ['COD', 'COG'],
        } as never,
      }),
    });
    const plan = await adapter.prepare(req(q));
    const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
    const payload = JSON.parse(result.payloadJson) as {
      aiExecuted: boolean;
      answer: unknown;
      chips: unknown;
    };
    expect(payload.answer).toEqual({
      state: 'CLARIFICATION_REQUIRED',
      basis: 'LANDED_AMBIGUOUS_COUNTRY',
      missingRoles: [],
      candidates: ['COD', 'COG'],
    });
    expect(payload.aiExecuted).toBe(false);
    /* the chips never claim either candidate */
    expect(JSON.stringify(payload.chips)).not.toMatch(/COD|COG/);
    /* nothing was spent: the reservation settles 0, the breaker is told nothing failed */
    expect(calls.settle).toEqual([['res-1', 0, 'NO_EVIDENCE']]);
    expect(calls.record).toEqual([['openai', 'REFUSAL', false]]);
  });

  it('MC-071: a closed past period is HISTORICAL against the request instant and is offered, not run', async () => {
    const q = 'What happened in Rwanda in 1994?';
    const { adapter, calls } = harness({});
    const plan = await adapter.prepare(req(q));
    const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
    expect(JSON.parse(result.payloadJson)).toMatchObject({
      aiExecuted: false,
      answer: { state: 'CLARIFICATION_REQUIRED', basis: 'PLAN_BROADENING_OFFERED' },
    });
    expect(calls.analysis).toEqual([]);
  });
});

describe('ALPHA ENABLEMENT R1 — MC-055 / MC-070 on the Ask R2 path', () => {
  const anon = <T>(work: () => Promise<T>) =>
    askRequestContext.run({ accountId: null, ipScope: 'ip:v4:203.0.113.7' }, work);

  it('MC-055: "Compare my saved stories" without identity is IDENTITY_REQUIRED — no clarification, 0 AI', async () => {
    const q = 'Compare my saved stories';
    const { adapter, calls } = harness({});
    const plan = await anon(() => adapter.prepare(req(q)));
    const result = await anon(() => adapter.execute(req(q), plan, 'op-1'));
    const payload = JSON.parse(result.payloadJson) as {
      aiExecuted: boolean;
      answer: { state: string; basis: string };
      route: { terminalState: string };
    };
    expect(payload.route.terminalState).toBe('IDENTITY_REQUIRED');
    expect(payload.answer).toMatchObject({
      state: 'CAPABILITY_UNAVAILABLE',
      basis: 'PLAN_IDENTITY_REQUIRED',
    });
    expect(payload.aiExecuted).toBe(false);
    expect(calls).toEqual({
      analysis: [],
      background: [],
      reserve: [],
      settle: [],
      permit: [],
      record: [],
    });
  });

  it('MC-055: signed in, it is governed by capability — the personal library is not wired here, 0 AI', async () => {
    const q = 'Compare my saved stories';
    const { adapter, calls } = harness({});
    const plan = await inRequest(() => adapter.prepare(req(q)));
    const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
    expect(JSON.parse(result.payloadJson).answer).toEqual({
      state: 'CAPABILITY_UNAVAILABLE',
      basis: 'EXECUTOR_NOT_WIRED',
      missingRoles: ['PERSONAL'],
    });
    expect(calls.analysis).toEqual([]);
    expect(calls.reserve).toEqual([]);
  });

  it.each([
    ['Compare my saved stories', 'en', 'SAVED_STORIES'],
    ['Porównaj moje zapisane materiały', 'pl', 'SAVED_STORIES'],
    ['What is new in my interests?', 'en', 'INTERESTS'],
    ['Co nowego w tematach, które śledzę?', 'pl', 'INTERESTS'],
  ] as const)(
    'MC-055: %s carries the envelope’s personal scope %s (wording only), 0 AI, no control touched',
    async (q, lg, scope) => {
      for (const run of [anon, inRequest]) {
        const { adapter, calls } = harness({});
        const plan = await run(() => adapter.prepare(req(q, lg)));
        const result = await run(() => adapter.execute(req(q, lg), plan, 'op-1'));
        const payload = JSON.parse(result.payloadJson) as {
          aiExecuted: boolean;
          route: { personalScope: string | null };
        };
        expect(payload.route.personalScope).toBe(scope);
        expect(payload.aiExecuted).toBe(false);
        expect(calls).toEqual({
          analysis: [],
          background: [],
          reserve: [],
          settle: [],
          permit: [],
          record: [],
        });
      }
    },
  );

  it('a news question names no personal scope', async () => {
    const { adapter } = harness({});
    const plan = await inRequest(() => adapter.prepare(req('What is happening in Kenya?')));
    const result = await inRequest(() =>
      adapter.execute(req('What is happening in Kenya?'), plan, 'op-1'),
    );
    expect(JSON.parse(result.payloadJson).route.personalScope).toBeNull();
  });

  it.each([
    ['And Kenya?', 'en'],
    ['A Kenia?', 'pl'],
  ] as const)(
    'MC-070: %s says there is nothing to continue, keeps Kenya, 0 AI and no control touched',
    async (q, lg) => {
      const { adapter, calls } = harness({});
      const plan = await inRequest(() => adapter.prepare(req(q, lg)));
      const result = await inRequest(() => adapter.execute(req(q, lg), plan, 'op-1'));
      const payload = JSON.parse(result.payloadJson) as {
        aiExecuted: boolean;
        answer: unknown;
        chips: { kind: string; chips?: { kind: string; value: string }[] };
      };
      expect(payload.answer).toEqual({
        state: 'CLARIFICATION_REQUIRED',
        basis: 'NO_PRIOR_SUBJECT',
        missingRoles: [],
        candidates: ['KEN'],
      });
      expect(payload.aiExecuted).toBe(false);
      expect(payload.chips.chips?.some((c) => c.kind === 'GEOGRAPHY' && c.value === 'KEN')).toBe(
        true,
      );
      expect(calls).toEqual({
        analysis: [],
        background: [],
        reserve: [],
        settle: [],
        permit: [],
        record: [],
      });
    },
  );
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN ASK INTELLIGENCE OBSERVABILITY R1 — WHAT THE ADAPTER OBSERVES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * These assertions ride the SAME harness as the behavioural ones above, deliberately: an
 * observation asserted against a separate stub would prove that a recorder can be called,
 * not that the path that answers a reader records what it did.
 */
describe('R1 — one Ask, one observation, and never a question in it', () => {
  const observationOf = (observed: unknown[]): Record<string, unknown> =>
    observed[0] as Record<string, unknown>;

  it('an answered Ask records exactly one observation, carrying the operation id', async () => {
    const { adapter, observed } = harness({});
    const plan = await inRequest(() => adapter.prepare(req('What is happening in Kenya?')));
    await inRequest(() => adapter.execute(req('What is happening in Kenya?'), plan, 'op-1'));

    expect(observed).toHaveLength(1);
    expect(observationOf(observed).operationId).toBe('op-1');
    expect(observationOf(observed).routePath).toBe('ASK_R2');
  });

  it('`prepare` records NOTHING — a quote is not an Ask, and counting it would inflate every figure', async () => {
    const { adapter, observed } = harness({});
    await inRequest(() => adapter.prepare(req('What is happening in Kenya?')));
    expect(observed).toEqual([]);
  });

  /*
    CONTENT WORDS ONLY, AND THAT IS NOT A WEAKENING. A scan for 'is' or 'in' fires on
    `missingRoles` and `reportingItemCount`, which are field names rather than the reader's
    words — a guard that cannot be satisfied by a correct implementation gets deleted. These
    three carry the question's meaning: if any of them survived into an observation, the
    observation would be a record of what somebody typed.
  */
  const QUESTION_WORDS = ['happening', 'kenya', 'what'] as const;

  const scanFor = (haystack: unknown): string[] => {
    const serialised = JSON.stringify(haystack).toLowerCase();
    return QUESTION_WORDS.filter((word) => serialised.includes(word.toLowerCase()));
  };

  it('the recorded observation contains no question text, in any field, at any depth', async () => {
    const question = 'What is happening in Kenya?';
    const { adapter, observed } = harness({});
    const plan = await inRequest(() => adapter.prepare(req(question)));
    await inRequest(() => adapter.execute(req(question), plan, 'op-1'));

    /* Word by word, so a truncated or re-cased fragment is caught as well as the whole. */
    expect(scanFor(observationOf(observed))).toEqual([]);
    expect(JSON.stringify(observationOf(observed))).not.toContain(question);
  });

  it('POSITIVE CONTROL — the same scan DOES condemn an observation that carried the question', async () => {
    /*
      Without this, the assertion above could pass because the instrument was broken: a
      misspelled key, a scan over the wrong object, or a word list that matches nothing all
      produce a green absence. So the same scan is run over the same observation with the
      question put back into it, and it must fire on every word.
    */
    const question = 'What is happening in Kenya?';
    const { adapter, observed } = harness({});
    const plan = await inRequest(() => adapter.prepare(req(question)));
    await inRequest(() => adapter.execute(req(question), plan, 'op-1'));

    const contaminated = { ...observationOf(observed), question };
    expect(scanFor(contaminated).sort()).toEqual([...QUESTION_WORDS].sort());
  });

  it('a deterministic clarification records ZERO model and ZERO provider calls', async () => {
    const { adapter, observed, calls } = harness({});
    const plan = await inRequest(() => adapter.prepare(req('And Kenya?')));
    await inRequest(() => adapter.execute(req('And Kenya?'), plan, 'op-1'));

    const observation = observationOf(observed);
    expect(observation.answerState).toBe('CLARIFICATION_REQUIRED');
    expect(observation.clarificationRequired).toBe(true);
    expect(observation.modelInvocationCount).toBe(0);
    expect(observation.providerCallCount).toBe(0);
    expect(observation.aiExecuted).toBe(false);
    expect(observation.providerId).toBeNull();
    /* And the switches were never consulted, so they are null rather than false: the
       difference between "not read" and "off" is the whole reason those columns are
       nullable. */
    expect(observation.askR2Enabled).toBeNull();
    expect(observation.askPublicComputeEnabled).toBeNull();
    expect(calls).toEqual({
      analysis: [],
      background: [],
      reserve: [],
      settle: [],
      permit: [],
      record: [],
    });
  });

  it('a switch that is off records the refusal truthfully, and still records only one observation', async () => {
    const { adapter, observed } = harness({ switches: { ASK_PUBLIC_COMPUTE_ENABLED: false } });
    const question = 'What is happening in Kenya?';
    const plan = await inRequest(() => adapter.prepare(req(question)));
    await expect(inRequest(() => adapter.execute(req(question), plan, 'op-1'))).rejects.toThrow();

    expect(observed).toHaveLength(1);
    const observation = observationOf(observed);
    expect(observation.failureCode).toBe('ASK_PUBLIC_COMPUTE_DISABLED');
    expect(observation.askR2Enabled).toBe(true);
    expect(observation.askPublicComputeEnabled).toBe(false);
    expect(observation.modelInvocationCount).toBe(0);
  });

  it('a budget refusal is recorded as the control that refused it, not as a model failure', async () => {
    const { adapter, observed } = harness({ meterAdmitted: false });
    const question = 'What is happening in Kenya?';
    const plan = await inRequest(() => adapter.prepare(req(question)));
    await expect(inRequest(() => adapter.execute(req(question), plan, 'op-1'))).rejects.toThrow();

    const observation = observationOf(observed);
    expect(observation.failureCode).toBe('BUDGET_REFUSED:account-day');
    expect(observation.modelInvocationCount).toBe(0);
    expect(observation.providerCallCount).toBe(0);
  });

  it('an open circuit is recorded as a circuit refusal, with the provider named', async () => {
    const { adapter, observed } = harness({ breakerAllowed: false });
    const question = 'What is happening in Kenya?';
    const plan = await inRequest(() => adapter.prepare(req(question)));
    await expect(inRequest(() => adapter.execute(req(question), plan, 'op-1'))).rejects.toThrow();

    const observation = observationOf(observed);
    expect(observation.failureCode).toBe('CIRCUIT_OPEN');
    expect(observation.providerId).toBe('openai');
    expect(observation.providerCallCount).toBe(0);
  });

  it('an answered Ask records the model invocation, the measured tokens and the evidence it got', async () => {
    const { adapter, observed } = harness({});
    const question = 'What is happening in Kenya?';
    const plan = await inRequest(() => adapter.prepare(req(question)));
    await inRequest(() => adapter.execute(req(question), plan, 'op-1'));

    const observation = observationOf(observed);
    expect(observation.aiExecuted).toBe(true);
    expect(observation.modelInvocationCount).toBe(1);
    expect(observation.providerCallCount).toBe(1);
    expect(observation.promptTokens).toBe(3000);
    expect(observation.completionTokens).toBe(800);
    expect(observation.reportingItemCount).toBe(2);
    expect(observation.evidenceRolesObtained).toEqual(['REPORTING']);
    expect(typeof observation.latencyMs).toBe('number');
  });

  it('geography travels as governed codes and the reader topic as a boolean, never as words', async () => {
    const { adapter, observed } = harness({});
    const question = 'What is happening in Kenya?';
    const plan = await inRequest(() => adapter.prepare(req(question)));
    await inRequest(() => adapter.execute(req(question), plan, 'op-1'));

    const observation = observationOf(observed);
    expect(observation.geographyCodes).toEqual(['KEN']);
    expect(typeof observation.topicPresent).toBe('boolean');
    expect(typeof observation.statedPeriodPresent).toBe('boolean');
    expect(observation.requestLanguage).toBe('en');
  });
});

/*
  STANDALONE PUBLIC BETA CONVERGENCE R1 — A × F. The General Background executor (A) runs
  inside F's single emit point: every background outcome records EXACTLY ONE observation,
  written with the same fields as the Reporting path, and neither the question nor the
  model's background text reaches it.
*/
describe('A × F — General Background: one truthful observation per outcome, never the question', () => {
  const Q_BG = 'What is inflation?';
  const BG_TEXT = 'General background answer.';
  const run = async (opts: Parameters<typeof harness>[0]) => {
    const { adapter, calls, observed } = harness(opts);
    const plan = await adapter.prepare(req(Q_BG));
    expect(plan.contract).toMatch(/:REFERENCE_BACKGROUND_ONLY$/);
    let refusedWith: string | null = null;
    try {
      await inRequest(() => adapter.execute(req(Q_BG), plan, 'op-bg'));
    } catch (error) {
      refusedWith = (error as AskExecutionRefused).code;
    }
    expect(observed).toHaveLength(1);
    const o = observed[0] as Record<string, unknown>;
    /* never the reader's words, never the model's background text */
    const serialised = JSON.stringify(o).toLowerCase();
    expect(serialised).not.toContain('inflation');
    expect(serialised).not.toContain(BG_TEXT.toLowerCase());
    /* zero Reporting on every background outcome */
    expect(calls.analysis).toEqual([]);
    return { o, refusedWith };
  };
  const common = {
    operationId: 'op-bg',
    routePath: 'ASK_R2',
    terminalState: 'REFERENCE_BACKGROUND_ONLY',
    askR2Enabled: true,
    askPublicComputeEnabled: true,
    providerId: 'openai',
    providerCallCount: 1,
    reportingItemCount: 0,
    evidenceRolesObtained: [],
  };

  it('success → REFERENCE_BACKGROUND, one model invocation, aiExecuted, breaker SUCCESS', async () => {
    const { o, refusedWith } = await run({});
    expect(refusedWith).toBeNull();
    expect(o).toMatchObject({
      ...common,
      answerState: 'REFERENCE_BACKGROUND',
      aiExecuted: true,
      modelInvocationCount: 1,
      breakerOutcome: 'SUCCESS',
      failureCode: null,
    });
  });

  it('decline → CAPABILITY_UNAVAILABLE (REFERENCE missing), model invoked once, no answer, breaker REFUSAL', async () => {
    const { o, refusedWith } = await run({ background: async () => ({ text: null }) });
    expect(refusedWith).toBeNull();
    expect(o).toMatchObject({
      ...common,
      answerState: 'CAPABILITY_UNAVAILABLE',
      capabilityUnavailable: true,
      evidenceRolesMissing: ['REFERENCE'],
      aiExecuted: false,
      modelInvocationCount: 1,
      breakerOutcome: 'REFUSAL',
      failureCode: null,
    });
  });

  it('timeout → MODEL_TIMEOUT refusal, recorded once with breaker TIMEOUT, no answer state', async () => {
    const { o, refusedWith } = await run({
      background: async () =>
        Promise.reject(
          new GeneralBackgroundProviderError(
            'General background call timed out.',
            'provider-timeout',
            false,
          ),
        ),
    });
    expect(refusedWith).toBe('MODEL_TIMEOUT');
    expect(o).toMatchObject({
      ...common,
      answerState: 'UNROUTED',
      aiExecuted: false,
      breakerOutcome: 'TIMEOUT',
      failureCode: 'MODEL_TIMEOUT',
    });
  });

  it('failure → MODEL_FAILURE refusal, recorded once with breaker FAILURE, no answer state', async () => {
    const { o, refusedWith } = await run({
      background: async () => Promise.reject(new Error('socket hang up')),
    });
    expect(refusedWith).toBe('MODEL_FAILURE');
    expect(o).toMatchObject({
      ...common,
      answerState: 'UNROUTED',
      aiExecuted: false,
      breakerOutcome: 'FAILURE',
      failureCode: 'MODEL_FAILURE',
    });
  });

  it('a control refusal before the provider (compute OFF) is still ONE observation with no provider call', async () => {
    const { o, refusedWith } = await run({ switches: { ASK_PUBLIC_COMPUTE_ENABLED: false } });
    expect(refusedWith).toBe('ASK_PUBLIC_COMPUTE_DISABLED');
    expect(o).toMatchObject({
      askR2Enabled: true,
      askPublicComputeEnabled: false,
      providerCallCount: 0,
      failureCode: 'ASK_PUBLIC_COMPUTE_DISABLED',
    });
  });

  it('the Reporting path still records its own single observation, unchanged by the background branch', async () => {
    const { adapter, observed, calls } = harness({});
    const q = 'What is happening in Kenya?';
    const plan = await adapter.prepare(req(q));
    await inRequest(() => adapter.execute(req(q), plan, 'op-rep'));
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      operationId: 'op-rep',
      answerState: 'CURRENT_REPORTING',
      providerCallCount: 1,
      evidenceRolesObtained: ['REPORTING'],
    });
    expect(calls.background).toEqual([]);
  });
});

/*
 * ASK CURRENT REPORTING FINAL CLOSURE R1 (M1) — the current-status verification seam.
 *
 * The defect: a current-status plan carries frozen C's verification contract, the ONE
 * sufficiency derivation reads the executor's verdict from `obtained.verification`, and this
 * executor never supplied one. The executor now returns a frozen outcome it can truthfully
 * establish. PARTIAL is not reachable from the executor yet: the Analysis response carries no
 * deterministic agreement fact (the missing seam, reported, not invented) — so these tests
 * prove the seam's CONTRACT at the derivation, and the executor's honest verdict end to end.
 */
describe('M1 — current-status verification: the executor supplies a frozen verdict', () => {
  const CURRENT_STATUS = 'Who is the current president of Poland?';
  const route = (q: string) =>
    routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: 'en',
        normalizationLanguage: 'en',
        displayLanguage: 'en',
        origin: 'ASK',
      },
      { computeConsent: 'GRANTED', requestInstant: '2026-09-29T10:00:00Z' },
      { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT']) },
    ).plan;

  it('the fixture is a genuine current-status plan: contract present, OFFICIAL not bound', () => {
    const plan = route(CURRENT_STATUS);
    /* its class label is SPECIALIST_DOMAIN ("president" also reads as political); what makes it
       current-status is the contract frozen C attached */
    expect(plan.verification).not.toBeNull();
    expect(plan.verification?.mode).toBe('CURRENT_STATUS');
    expect(plan.verification?.minIndependentFreshSources).toBe(2);
    expect(plan.verification?.admissibleOutcomes).not.toContain('CURRENTLY_VERIFIED');
  });

  it('the executor verdict is a frozen outcome — INSUFFICIENT_EVIDENCE — never undefined', () => {
    expect(executorVerificationOutcome(route(CURRENT_STATUS))).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('end to end: retrieval success (articles + a model answer) is still not verification', async () => {
    const { adapter } = harness({
      analysis: async (p) => {
        p.usageSink?.({ promptTokens: 3000, completionTokens: 800 });
        return {
          analysis: {} as never,
          articles: [{} as never, {} as never, {} as never, {} as never],
          retrievalContext: {} as never,
        } as unknown as AnalysisApiResponse;
      },
    });
    const plan = await adapter.prepare(req(CURRENT_STATUS));
    const result = await inRequest(() => adapter.execute(req(CURRENT_STATUS), plan, 'op-cs'));
    const payload = JSON.parse(result.payloadJson) as {
      answer: { state: string; basis: string };
    };
    expect(payload.answer).toMatchObject({ state: 'INSUFFICIENT', basis: 'VERIFICATION_NOT_MET' });
    expect(payload.answer.state).not.toBe('CURRENTLY_VERIFIED');
  });

  it('the seam contract: a valid partial verdict with ≥2 reporting items → PARTIAL', () => {
    const plan = route(CURRENT_STATUS);
    expect(
      deriveAnswerState(plan, {
        items: { REPORTING: 2 },
        producedAnswer: true,
        verification: 'CURRENT_REPORTING_PARTIAL_VERIFICATION',
      }),
    ).toMatchObject({ state: 'PARTIAL', basis: 'REPORTING_PARTIAL_VERIFICATION' });
  });

  it('verification unmet → INSUFFICIENT (one source; or the honest INSUFFICIENT_EVIDENCE verdict)', () => {
    const plan = route(CURRENT_STATUS);
    for (const obtained of [
      { items: { REPORTING: 1 }, verification: 'CURRENT_REPORTING_PARTIAL_VERIFICATION' as const },
      { items: { REPORTING: 5 }, verification: 'INSUFFICIENT_EVIDENCE' as const },
      { items: { REPORTING: 5 } },
    ]) {
      expect(deriveAnswerState(plan, { producedAnswer: true, ...obtained })).toMatchObject({
        state: 'INSUFFICIENT',
        basis: 'VERIFICATION_NOT_MET',
      });
    }
  });

  it('OFFICIAL absent can never become CURRENTLY_VERIFIED — not even with a claimed verdict', () => {
    const plan = route(CURRENT_STATUS);
    for (const items of [{ REPORTING: 9 }, { REPORTING: 9, OFFICIAL: 1 }]) {
      expect(
        deriveAnswerState(plan, { items, producedAnswer: true, verification: 'CURRENTLY_VERIFIED' })
          .state,
      ).not.toBe('CURRENTLY_VERIFIED');
    }
  });

  it('stable background and ordinary current reporting carry no contract and get no verdict', () => {
    const background = route('What is an induction motor?');
    expect(background.verification).toBeNull();
    expect(executorVerificationOutcome(background)).toBeUndefined();
    const reporting = route('What is happening in Kenya?');
    expect(reporting.verification).toBeNull();
    expect(executorVerificationOutcome(reporting)).toBeUndefined();
    /*
      CURRENT STATUS CORROBORATION R1 — the governed NBP policy-rate question is now a
      current-status question on purpose (its answer depends on the time of asking), so it
      carries the contract and is decided by deterministic corroboration.
    */
    const nbp = route(
      'What is the current policy interest rate of the National Bank of Poland, and when was it last changed?',
    );
    expect(nbp.questionClass).toBe('CURRENT_STATUS_VERIFICATION');
    expect(nbp.verification?.admissibleOutcomes).toEqual([
      'CURRENT_REPORTING_PARTIAL_VERIFICATION',
      'INSUFFICIENT_EVIDENCE',
    ]);
  });

  it('ordinary current reporting is derived exactly as before', async () => {
    const { adapter } = harness({});
    const q = 'What is happening in Kenya?';
    const plan = await adapter.prepare(req(q));
    const result = await inRequest(() => adapter.execute(req(q), plan, 'op-k'));
    expect(JSON.parse(result.payloadJson).answer).toMatchObject({
      state: 'CURRENT_REPORTING',
      basis: 'REQUIRED_EVIDENCE_OBTAINED',
    });
  });
});

/*
 * CURRENT STATUS CORROBORATION R1 — end to end through the real adapter: the deterministic
 * seam decides PARTIAL vs INSUFFICIENT, the derivation receives the number of independent
 * agreeing reports (never raw articles.length), and a PARTIAL answer carries the as-of time of
 * the freshest corroborating report.
 */
describe('CURRENT STATUS CORROBORATION R1 — PARTIAL only on a deterministic corroborated fact', () => {
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const art = (id: string, domain: string, title: string, hours: number) =>
    ({
      id,
      title,
      summary: '',
      url: `https://${domain}/n/${id}`,
      sourceId: 'gnews',
      sourceName: domain,
      category: 'world',
      sourcesCount: 1,
      publishedAt: ago(hours),
      publishedAtBasis: 'publisher',
    }) as never;
  const withArticles = (articles: unknown[]) =>
    harness({
      analysis: async (p) => {
        p.usageSink?.({ promptTokens: 3000, completionTokens: 800 });
        return {
          analysis: {} as never,
          articles,
          retrievalContext: {} as never,
        } as unknown as AnalysisApiResponse;
      },
    });
  const execute = async (q: string, articles: unknown[], lang: 'en' | 'pl' = 'en') => {
    const { adapter } = withArticles(articles);
    const plan = await adapter.prepare(req(q, lang));
    const result = await inRequest(() => adapter.execute(req(q, lang), plan, 'op-c'));
    return JSON.parse(result.payloadJson) as {
      answer: { state: string; basis: string };
      verification: {
        outcome: string;
        reason: string;
        family: string | null;
        reports: number;
        asOf: string | null;
        fact: { family: string; value: string | number } | null;
      } | null;
    };
  };
  const NBP_Q =
    'What is the current policy interest rate of the National Bank of Poland, and when was it last changed?';
  const OFFICE_Q = 'Who is the current president of Poland?';

  it('office holder: two fresh independent reports, same person → PARTIAL, as of the freshest', async () => {
    const p = await execute(OFFICE_Q, [
      art('a', 'reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', 9),
      art('b', 'notesfrompoland.com', "Poland's President Karol Nawrocki signs defence law", 2),
    ]);
    expect(p.answer).toMatchObject({ state: 'PARTIAL', basis: 'REPORTING_PARTIAL_VERIFICATION' });
    expect(p.verification).toMatchObject({
      outcome: 'CURRENT_REPORTING_PARTIAL_VERIFICATION',
      reason: 'CORROBORATED',
      family: 'OFFICE_HOLDER',
      reports: 2,
      fact: { family: 'OFFICE_HOLDER', value: 'Karol Nawrocki' },
    });
    const asOf = Date.parse(p.verification!.asOf!);
    expect(Math.abs(asOf - (Date.now() - 2 * 3_600_000))).toBeLessThan(60_000);
  });

  it('policy rate (PL question): EN + PL reports agree on 575 bps → PARTIAL', async () => {
    const p = await execute(
      'Jaka jest obecna stopa referencyjna NBP?',
      [
        art('a', 'reuters.com', "Poland's central bank holds interest rates at 5.75%", 20),
        art('b', 'money.pl', 'Stopa referencyjna NBP wynosi 5,75 proc.', 5),
      ],
      'pl',
    );
    expect(p.answer.state).toBe('PARTIAL');
    expect(p.verification).toMatchObject({
      family: 'POLICY_RATE',
      reports: 2,
      fact: { value: 575 },
    });
  });

  it('many articles but no corroborated fact → INSUFFICIENT; the count passed is 0, not 5', async () => {
    const p = await execute(NBP_Q, [
      art('a', 'reuters.com', "Poland's central bank holds interest rates at 5.75%", 20),
      art('b', 'money.pl', 'RPP obniżyła stopy procentowe do 5,50 proc.', 5),
      art('c', 'bbc.co.uk', 'Polish economy grows', 5),
      art('d', 'ft.com', 'Zloty weakens', 5),
      art('e', 'wp.pl', 'Pogoda w Warszawie', 5),
    ]);
    expect(p.answer).toMatchObject({ state: 'INSUFFICIENT', basis: 'VERIFICATION_NOT_MET' });
    expect(p.verification).toMatchObject({
      outcome: 'INSUFFICIENT_EVIDENCE',
      reason: 'CONFLICTING_FACTS',
      reports: 0,
      asOf: null,
      fact: null,
    });
  });

  it('one corroborating report is not two → INSUFFICIENT', async () => {
    const p = await execute(OFFICE_Q, [
      art('a', 'reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', 9),
      art('b', 'reuters.com', "Poland's President Karol Nawrocki signs law", 2),
    ]);
    expect(p.answer.state).toBe('INSUFFICIENT');
    expect(p.verification).toMatchObject({
      reason: 'INSUFFICIENT_INDEPENDENT_REPORTS',
      reports: 1,
    });
  });

  it('an unsupported current-status category stays honestly INSUFFICIENT', async () => {
    const p = await execute('Who is the current minister of finance of Poland?', [
      art('a', 'reuters.com', 'Polish finance minister Andrzej Domański presents budget', 9),
      art('b', 'notesfrompoland.com', 'Finance minister Andrzej Domański on taxes', 2),
    ]);
    expect(p.answer.state).toBe('INSUFFICIENT');
    expect(p.verification).toMatchObject({ reason: 'UNSUPPORTED_FACT_FAMILY' });
  });

  it('never CURRENTLY_VERIFIED, and never OFFICIAL — whatever reporting says', async () => {
    const p = await execute(OFFICE_Q, [
      art('a', 'reuters.com', 'Polish President Karol Nawrocki vetoes budget bill', 9),
      art('b', 'notesfrompoland.com', "Poland's President Karol Nawrocki signs defence law", 2),
    ]);
    expect(p.answer.state).not.toBe('CURRENTLY_VERIFIED');
    expect(JSON.stringify(p)).not.toContain('OFFICIAL_CURRENT_EVIDENCE');
  });

  it('plans without a contract carry no verification block and are unchanged', async () => {
    const p = await execute('What is happening in Kenya?', [
      art('a', 'reuters.com', 'Kenya news', 9),
    ]);
    expect(p.answer.state).toBe('CURRENT_REPORTING');
    expect(p.verification).toBeNull();
  });
});

/*
 * ASK GLOBALNEWSAI INTELLIGENCE BINDING R1 — the governed contributions in the ONE answer path.
 */
describe('INTELLIGENCE BINDING R1 — governed contributors behind the one Ask answer', () => {
  const conflictUsed = (route: AskR2Route): AskContributionSet => ({
    considered: [
      {
        contributorId: 'CONFLICT',
        domain: 'security',
        applicability: route.plan.specialistLegs.some((l) => l.requiredness === 'REQUIRED')
          ? 'REQUIRED'
          : 'SUPPLEMENTARY',
        scope: { countryIso3: 'COD', district: null, place: null },
      },
    ],
    contributions: [
      {
        contributorId: 'CONFLICT',
        domain: 'security',
        status: 'USED',
        applicability: 'SUPPLEMENTARY',
        observations: [
          {
            reference: 'ucdp:1',
            kind: 'ARMED_CLASH',
            label: null,
            value: null,
            unit: null,
            period: '2026-09-27',
            geography: 'COD',
            source: { name: 'UCDP', url: null, licence: null },
            retainedAt: null,
          },
        ],
        temporalBasis: 'RETAINED_EVENT_RECORD',
        geographyBasis: 'COD',
        disclosures: ['RETAINED_NOT_CURRENT'],
        degradationReason: null,
      },
    ],
  });
  const conflictNone = (): AskContributionSet => ({ considered: [], contributions: [] });

  it('security question: Conflict observations join the ONE answer; still exactly one analysis call', async () => {
    const { adapter, calls, observed } = harness({ intelligence: conflictUsed });
    const q = 'What is the security situation in DR Congo?';
    const plan = await adapter.prepare(req(q));
    const result = await inRequest(() => adapter.execute(req(q), plan, 'op-sec'));
    const payload = JSON.parse(result.payloadJson);
    expect(payload.answer.state).toBe('CURRENT_REPORTING');
    expect(payload.intelligence.considered).toEqual(['CONFLICT']);
    expect(payload.intelligence.contributions[0].status).toBe('USED');
    expect(calls.analysis).toHaveLength(1);
    expect(calls.background).toHaveLength(0);
    expect(observed[0]).toMatchObject({
      evidenceRolesObtained: ['REPORTING', 'SPECIALIST'],
      contributorsConsidered: ['CONFLICT'],
      contributorsUsed: ['CONFLICT'],
      contributorItemCount: 1,
      modelInvocationCount: 1,
    });
  });

  it('an explicitly REQUIRED conflict assessment now EXECUTES (it was CAPABILITY_UNAVAILABLE while unbound)', async () => {
    const q = 'Give me the conflict assessment for DR Congo';
    const withData = harness({ intelligence: conflictUsed });
    const plan = await withData.adapter.prepare(req(q));
    expect(plan.contract).toMatch(/:EXECUTABLE$/);
    const ok = JSON.parse(
      (await inRequest(() => withData.adapter.execute(req(q), plan, 'op-r1'))).payloadJson,
    );
    expect(ok.answer.state).toBe('CURRENT_REPORTING');
    /* no governed Conflict record → the required specialist role is honestly MISSING */
    const without = harness({ intelligence: conflictNone });
    const plan2 = await without.adapter.prepare(req(q));
    const missing = JSON.parse(
      (await inRequest(() => without.adapter.execute(req(q), plan2, 'op-r2'))).payloadJson,
    );
    expect(missing.answer).toMatchObject({ state: 'PARTIAL', missingRoles: ['SPECIALIST'] });
  });

  /*
    LIVE ACCEPTANCE REPAIR R1 — SUPERSEDED WITH UPDATED CONTRACT PROOF. Live G2 proved that the
    background model, run beside a single TED snapshot, claimed procurement "changes" and
    "reforms" the governed record cannot show. A background-only procurement question is now
    answered from the retained snapshot itself (zero model) — see the G2 proof below. The
    background path still carries contributions and the governed rules for any other question.
  */
  it('the background path carries contributions and the governed rules into its ONE background call', async () => {
    const humanitarian = (): AskContributionSet => ({
      considered: [
        {
          contributorId: 'HUMANITARIAN',
          domain: 'humanitarian',
          applicability: 'SUPPLEMENTARY',
          scope: { countryIso3: null, district: null, place: null },
        },
      ],
      contributions: [
        {
          contributorId: 'HUMANITARIAN',
          domain: 'humanitarian',
          status: 'NOT_ASSESSED',
          applicability: 'SUPPLEMENTARY',
          observations: [],
          temporalBasis: 'NONE',
          geographyBasis: null,
          disclosures: ['HUMANITARIAN_NOT_ASSESSED'],
          degradationReason: 'NO_GOVERNED_OBSERVATION_READER',
        },
      ],
    });
    const { adapter, calls, reads } = harness({ intelligence: humanitarian });
    const q = 'What is NATO?';
    const plan = await adapter.prepare(req(q));
    const payload = JSON.parse(
      (await inRequest(() => adapter.execute(req(q), plan, 'op-bg'))).payloadJson,
    );
    expect(payload.answer.state).toBe('REFERENCE_BACKGROUND');
    expect(payload.intelligence.considered).toEqual(['HUMANITARIAN']);
    expect(calls.background).toHaveLength(1);
    expect(calls.analysis).toHaveLength(0);
    expect(reads).toHaveLength(1);
    const input = calls.background[0][0] as { governed?: { rules: string; data: string } };
    expect(input.governed?.rules).toMatch(/Humanitarian Intelligence was not assessed/);
    expect(input.governed?.data).toContain('"status": "NOT_ASSESSED"');
  });

  it('reads never bypass the controls: a disabled Ask reads nothing', async () => {
    const { adapter, reads } = harness({
      intelligence: conflictUsed,
      switches: { ASK_PUBLIC_COMPUTE_ENABLED: false },
    });
    const q = 'What is the security situation in DR Congo?';
    const plan = await adapter.prepare(req(q));
    await expect(inRequest(() => adapter.execute(req(q), plan, 'op-off'))).rejects.toThrow();
    expect(reads).toEqual([]);
  });

  it('an explicit NBP official request never uses reporting as official evidence', async () => {
    const { adapter, calls, reads } = harness({ intelligence: conflictUsed });
    const q = 'According to the NBP, what is the reference rate?';
    const plan = await adapter.prepare(req(q));
    const payload = JSON.parse(
      (await inRequest(() => adapter.execute(req(q), plan, 'op-nbp'))).payloadJson,
    );
    expect(payload.answer.state).toBe('CAPABILITY_UNAVAILABLE');
    expect(payload.aiExecuted).toBe(false);
    expect(calls.analysis).toEqual([]);
    expect(reads).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain('OFFICIAL_CURRENT_EVIDENCE');
  });

  it('no leak between turns: a later question without applicable contributors carries none', async () => {
    let n = 0;
    const { adapter } = harness({
      intelligence: (route) => (n++ === 0 ? conflictUsed(route) : conflictNone()),
    });
    const q1 = 'What is the security situation in DR Congo?';
    const q2 = 'What is happening in Kenya?';
    await inRequest(async () => adapter.execute(req(q1), await adapter.prepare(req(q1)), 'op-a'));
    const second = JSON.parse(
      (
        await inRequest(async () =>
          adapter.execute(req(q2), await adapter.prepare(req(q2)), 'op-b'),
        )
      ).payloadJson,
    );
    expect(second.intelligence).toBeNull();
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK INTELLIGENCE BINDING — LIVE ACCEPTANCE REPAIR R1: the live G1–G9 questions, verbatim,
 * through the REAL router and the REAL bridge, with every spend recorded.
 * ════════════════════════════════════════════════════════════════════════════
 */
describe('LIVE ACCEPTANCE REPAIR R1 — G1–G9 end to end', () => {
  type Contribution = AskContributionSet['contributions'][number];
  const c = (over: Partial<Contribution> & Pick<Contribution, 'contributorId'>): Contribution => ({
    domain: 'x',
    status: 'USED',
    applicability: 'SUPPLEMENTARY',
    observations: [],
    temporalBasis: 'NONE',
    geographyBasis: null,
    disclosures: [],
    degradationReason: null,
    ...over,
  });
  const o = (over: Record<string, unknown> = {}) => ({
    reference: 'r',
    kind: 'K',
    label: null,
    value: null,
    unit: null,
    period: '2026-08-31',
    geography: 'COD',
    source: { name: 'S', url: null, licence: null },
    retainedAt: null,
    ...over,
  });
  const setOf =
    (...contributions: Contribution[]) =>
    (): AskContributionSet => ({
      considered: contributions.map((x) => ({
        contributorId: x.contributorId,
        domain: x.domain,
        applicability: x.applicability,
        scope: { countryIso3: null, district: null, place: null },
      })),
      contributions,
    });
  async function run(q: string, h: ReturnType<typeof harness>) {
    const plan = await h.adapter.prepare(req(q));
    return JSON.parse((await inRequest(() => h.adapter.execute(req(q), plan, 'op-g'))).payloadJson);
  }
  const noSpend = (h: ReturnType<typeof harness>) => {
    expect(h.calls.analysis).toEqual([]);
    expect(h.calls.background).toEqual([]);
    expect(h.calls.reserve).toEqual([]);
    expect(h.calls.permit).toEqual([]);
    expect(h.calls.settle).toEqual([]);
  };
  const obsOf = (h: ReturnType<typeof harness>) => h.observed[0] as Record<string, unknown>;

  const conflictUsed = c({
    contributorId: 'CONFLICT',
    domain: 'security',
    temporalBasis: 'RETAINED_EVENT_RECORD',
    geographyBasis: 'COD',
    observations: [
      o({
        detail: {
          place: 'Beni territory, North Kivu',
          parties: ['ADF', 'Civilians'],
          headline: null,
          citedOutlets: ['Radio Okapi,2026-08-31'],
        },
      }),
    ],
    disclosures: [
      'RETAINED_NOT_CURRENT',
      'SEVERITY_NOT_ASSESSED',
      'NO_RECENT_RETAINED_RECORD',
      'SUBNATIONAL_SCOPE_NOT_APPLIED',
    ],
  });

  it('G1 eastern DRC: Conflict is read BEFORE the ONE analysis call and binds it; one model call', async () => {
    const h = harness({ intelligence: setOf(conflictUsed) });
    const payload = await run('How serious is the situation in eastern DRC?', h);
    expect(h.calls.analysis).toHaveLength(1);
    const policy = h.calls.analysis[0][6] as {
      governed?: { rules: string; data: string };
      maxModelAttempts?: number;
    };
    expect(policy.maxModelAttempts).toBe(1);
    /* PR #70 prompt boundary: trusted rules and retained data travel separately. */
    expect(policy.governed?.rules).toMatch(/retained scope is country-level/);
    expect(policy.governed?.rules).toMatch(/do not rank, grade or characterise severity/);
    expect(policy.governed?.rules).not.toContain('Beni');
    expect(policy.governed?.data).toContain('"contributor": "CONFLICT"');
    expect(policy.governed?.data).toContain('"recordCount": 1');
    expect(policy.governed?.data).toContain('"place": "Beni territory, North Kivu"');
    expect(payload.answer.state).toBe('CURRENT_REPORTING');
    expect(payload.intelligence.contributions[0].observations[0].detail.place).toBe(
      'Beni territory, North Kivu',
    );
    expect(obsOf(h)).toMatchObject({
      modelInvocationCount: 1,
      providerCallCount: 1,
      contributorsUsed: ['CONFLICT'],
    });
  });

  it('G2 Poland procurement: ONE retained TED snapshot is the answer — zero model, zero provider, never a "change" series', async () => {
    const h = harness({
      intelligence: setOf(
        c({
          contributorId: 'MARKET_PROCUREMENT',
          domain: 'economic',
          temporalBasis: 'RETAINED_PUBLICATION',
          geographyBasis: 'POL',
          observations: [o({ kind: 'cn-standard', period: '2026-09-24', geography: 'POL' })],
          disclosures: ['RETAINED_NOT_CURRENT', 'SNAPSHOT_NOT_CHANGE_SERIES'],
        }),
      ),
    });
    const payload = await run('What are the important procurement changes in Poland?', h);
    expect(payload.answer).toMatchObject({ state: 'RETAINED_RECORD', basis: 'GOVERNED_RECORD' });
    expect(payload.aiExecuted).toBe(false);
    expect(payload.background).toBeNull();
    expect(payload.analysis).toBeNull();
    expect(payload.intelligence.contributions[0].disclosures).toContain(
      'SNAPSHOT_NOT_CHANGE_SERIES',
    );
    noSpend(h);
    expect(obsOf(h)).toMatchObject({
      modelInvocationCount: 0,
      providerCallCount: 0,
      answerState: 'RETAINED_RECORD',
    });
  });

  const imihigo = (
    status: Contribution['status'],
    observations: ReturnType<typeof o>[],
    disclosures: string[] = [],
  ) =>
    setOf(
      c({
        contributorId: 'GEOGRAPHY',
        domain: 'geography',
        applicability: 'CONTEXT',
        observations: [o({ kind: 'NISR_DISTRICT' })],
      }),
      c({
        contributorId: 'IMIHIGO',
        domain: 'governance',
        status,
        temporalBasis: 'RETAINED_EVALUATION_CYCLE',
        observations,
        disclosures,
      }),
    );

  it('G3 Ngoma: the exact retained 77.2 % (2024/2025) with zero model — even when the compute budget is exhausted', async () => {
    const h = harness({
      meterAdmitted: false,
      intelligence: imihigo(
        'USED',
        [
          o({
            kind: 'IMIHIGO_DISTRICT_FINAL_SCORE',
            label: 'Ngoma',
            value: '77.2',
            unit: '%',
            period: '2024/2025',
            geography: 'nisr:district:56',
          }),
        ],
        ['RETAINED_NOT_CURRENT', 'CLOSED_EVALUATION_CYCLE'],
      ),
    });
    const payload = await run("What was Ngoma's 2024/2025 Imihigo result?", h);
    expect(payload.answer).toMatchObject({ state: 'RETAINED_RECORD', basis: 'GOVERNED_RECORD' });
    const record = payload.intelligence.contributions.find(
      (x: Contribution) => x.contributorId === 'IMIHIGO',
    );
    expect(record.observations[0]).toMatchObject({ value: '77.2', unit: '%', period: '2024/2025' });
    noSpend(h);
    expect(obsOf(h)).toMatchObject({ failureCode: null, modelInvocationCount: 0 });
  });

  it('G4 Gasabo: no individual score is retained — stated as absent, the Kigali aggregate never appears', async () => {
    const h = harness({
      intelligence: imihigo('NO_MATCH', [], ['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT']),
    });
    const payload = await run("What was Gasabo's 2024/2025 Imihigo result?", h);
    expect(payload.answer).toMatchObject({ state: 'RETAINED_RECORD', basis: 'GOVERNED_NO_RECORD' });
    const record = payload.intelligence.contributions.find(
      (x: Contribution) => x.contributorId === 'IMIHIGO',
    );
    expect(record.observations).toEqual([]);
    expect(record.disclosures).toEqual(['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT']);
    noSpend(h);
  });

  it('G5 Sudan: current reporting runs ONCE; Humanitarian NOT_ASSESSED binds the prompt and is never evidence', async () => {
    const h = harness({
      intelligence: setOf(
        c({
          contributorId: 'CONFLICT',
          domain: 'security',
          status: 'NO_MATCH',
          temporalBasis: 'RETAINED_EVENT_RECORD',
        }),
        c({
          contributorId: 'HUMANITARIAN',
          domain: 'humanitarian',
          status: 'NOT_ASSESSED',
          disclosures: ['HUMANITARIAN_NOT_ASSESSED'],
          degradationReason: 'NO_GOVERNED_OBSERVATION_READER',
        }),
      ),
    });
    const payload = await run('What is the humanitarian situation in Sudan?', h);
    expect(h.calls.analysis).toHaveLength(1);
    const policy = h.calls.analysis[0][6] as { governed?: { rules: string; data: string } };
    expect(policy.governed?.rules).toMatch(
      /never state or imply that Humanitarian Intelligence supports/,
    );
    expect(payload.answer.state).toBe('CURRENT_REPORTING');
    expect(obsOf(h)).toMatchObject({
      contributorsUsed: [],
      contributorsDegraded: ['HUMANITARIAN'],
      modelInvocationCount: 1,
    });
  });

  it.each([
    ['G6', 'Russian missile and drone attacks on Ukraine'],
    ['G7', 'What happened in Polish politics today?'],
  ])(
    '%s reaches current reporting with ONE analysis call and no governed prompt section',
    async (_id, q) => {
      const h = harness({});
      const payload = await run(q, h);
      expect(payload.answer.state).toBe('CURRENT_REPORTING');
      expect(h.calls.analysis).toHaveLength(1);
      expect((h.calls.analysis[0][6] as { governed?: unknown }).governed).toBeUndefined();
    },
  );

  it('G8 NBP official: official source unavailable — zero AI, zero reads, reporting never offered as official', async () => {
    const h = harness({ intelligence: setOf(conflictUsed) });
    const payload = await run("What is NBP's official reference rate?", h);
    expect(payload.answer).toEqual({
      state: 'CAPABILITY_UNAVAILABLE',
      basis: 'OFFICIAL_SOURCE_UNAVAILABLE',
      missingRoles: ['OFFICIAL'],
    });
    expect(payload.aiExecuted).toBe(false);
    expect(h.reads).toEqual([]);
    noSpend(h);
    expect(JSON.stringify(payload)).not.toContain('OFFICIAL_CURRENT_EVIDENCE');
  });

  it('G8 control: without the word "official" the current-status path is unchanged (never CURRENTLY_VERIFIED)', async () => {
    const h = harness({});
    const payload = await run("What is NBP's reference rate?", h);
    expect(h.calls.analysis).toHaveLength(1);
    expect(payload.answer.state).not.toBe('CURRENTLY_VERIFIED');
  });

  it('G9 Rwanda CPI: the retained NISR headline observation with its period, zero model — budget-independent', async () => {
    const h = harness({
      meterAdmitted: false,
      intelligence: setOf(
        c({
          contributorId: 'ECONOMY_CPI',
          domain: 'economic',
          temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
          observations: [
            o({
              kind: 'HEADLINE_CPI_YOY',
              value: '15.9',
              unit: 'PERCENT',
              period: '2026-08',
              geography: 'All Rwanda',
            }),
          ],
          disclosures: ['RETAINED_NOT_CURRENT'],
        }),
      ),
    });
    const payload = await run("What is Rwanda's latest inflation (CPI)?", h);
    expect(payload.answer).toMatchObject({ state: 'RETAINED_RECORD', basis: 'GOVERNED_RECORD' });
    expect(payload.intelligence.contributions[0].disclosures).toEqual(['RETAINED_NOT_CURRENT']);
    noSpend(h);
  });

  it('the deterministic path still obeys the Ask switches and the request context — nothing is read when Ask is off', async () => {
    const q = "What was Ngoma's 2024/2025 Imihigo result?";
    const h = harness({
      switches: { ASK_R2_ENABLED: false },
      intelligence: imihigo('USED', [o()]),
    });
    const plan = await h.adapter.prepare(req(q));
    expect(await refusal(inRequest(() => h.adapter.execute(req(q), plan, 'op-off')))).toBe(
      'ASK_R2_DISABLED',
    );
    expect(h.reads).toEqual([]);
    const h2 = harness({
      switches: { ASK_PUBLIC_COMPUTE_ENABLED: false },
      intelligence: imihigo('USED', [o()]),
    });
    const plan2 = await h2.adapter.prepare(req(q));
    expect(await refusal(inRequest(() => h2.adapter.execute(req(q), plan2, 'op-off2')))).toBe(
      'ASK_PUBLIC_COMPUTE_DISABLED',
    );
    const h3 = harness({ intelligence: imihigo('USED', [o()]) });
    const plan3 = await h3.adapter.prepare(req(q));
    expect(await refusal(h3.adapter.execute(req(q), plan3, 'op-noctx'))).toBe(
      'ASK_REQUEST_CONTEXT_MISSING',
    );
    expect(h3.reads).toEqual([]);
  });

  it('a failed governed read is never presented as a record: CAPABILITY_UNAVAILABLE / GOVERNED_RECORD_UNAVAILABLE', async () => {
    const h = harness({
      intelligence: setOf(
        c({
          contributorId: 'ECONOMY_CPI',
          domain: 'economic',
          status: 'DEGRADED',
          degradationReason: 'TIMEOUT',
        }),
      ),
    });
    const payload = await run("What is Rwanda's latest inflation (CPI)?", h);
    expect(payload.answer).toMatchObject({
      state: 'CAPABILITY_UNAVAILABLE',
      basis: 'GOVERNED_RECORD_UNAVAILABLE',
    });
    noSpend(h);
  });

  it.each([
    ['held but not displayable (live Alpha G9)', 'RETAINED_ARTIFACT_NOT_DISPLAYABLE'],
    ['no retained capture', 'NO_RETAINED_CAPTURE'],
  ])(
    'GAP REPAIR R1 — G9 CPI %s → CAPABILITY_UNAVAILABLE / GOVERNED_RECORD_UNAVAILABLE, zero spend, never a blank RETAINED_RECORD',
    async (_label, disclosure) => {
      const h = harness({
        meterAdmitted: false,
        intelligence: setOf(
          c({
            contributorId: 'ECONOMY_CPI',
            domain: 'economic',
            status: 'NO_DATA',
            temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
            disclosures: [disclosure],
            degradationReason: 'NO_PRODUCER',
          }),
        ),
      });
      const payload = await run("What is Rwanda's latest inflation (CPI)?", h);
      expect(payload.answer).toEqual({
        state: 'CAPABILITY_UNAVAILABLE',
        basis: 'GOVERNED_RECORD_UNAVAILABLE',
        missingRoles: [],
      });
      expect(payload.aiExecuted).toBe(false);
      expect(payload.intelligence.contributions[0].disclosures).toEqual([disclosure]);
      noSpend(h);
      expect(obsOf(h)).toMatchObject({
        answerState: 'CAPABILITY_UNAVAILABLE',
        answerBasis: 'GOVERNED_RECORD_UNAVAILABLE',
        modelInvocationCount: 0,
        providerCallCount: 0,
      });
    },
  );

  it('a reporting question with an exhausted budget is still refused truthfully (the control is not bypassed)', async () => {
    const h = harness({ meterAdmitted: false, intelligence: setOf(conflictUsed) });
    const q = 'How serious is the situation in eastern DRC?';
    const plan = await h.adapter.prepare(req(q));
    expect(await refusal(inRequest(() => h.adapter.execute(req(q), plan, 'op-b')))).toBe(
      'BUDGET_REFUSED:account-day',
    );
    expect(h.calls.analysis).toEqual([]);
  });

  it('no multiplication: at most ONE model/provider call per answer, and zero per contributor', async () => {
    for (const q of [
      'How serious is the situation in eastern DRC?',
      'What is the humanitarian situation in Sudan?',
      'Russian missile and drone attacks on Ukraine',
      'What happened in Polish politics today?',
    ]) {
      const h = harness({
        intelligence: setOf(
          conflictUsed,
          c({ contributorId: 'HUMANITARIAN', status: 'NOT_ASSESSED' }),
        ),
      });
      await run(q, h);
      expect(h.calls.analysis.length + h.calls.background.length).toBe(1);
      expect(h.reads.length).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * ASK CONVERSATIONAL BREADTH R1 — the live question reaches the existing General Background
 * executor: ONE background model call, ZERO news/reporting (analysis) calls. Currentness still
 * routes to reporting.
 */
describe('ASK CONVERSATIONAL BREADTH R1 — stable conceptual questions reach General Background', () => {
  async function run(q: string, h: ReturnType<typeof harness>) {
    const plan = await h.adapter.prepare(req(q));
    return JSON.parse(
      (await inRequest(() => h.adapter.execute(req(q), plan, 'op-breadth'))).payloadJson,
    );
  }

  it('the live Alpha question → REFERENCE_BACKGROUND, 1 background call, 0 reporting calls', async () => {
    const h = harness({});
    const payload = await run(
      'What do you think life is? How can I link it to death and resurrection?',
      h,
    );
    expect(payload.route.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
    expect(payload.answer.state).toBe('REFERENCE_BACKGROUND');
    expect(h.calls.background).toHaveLength(1);
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.observed[0]).toMatchObject({
      modelInvocationCount: 1,
      providerCallCount: 1,
      reportingItemCount: 0,
    });
  });

  it.each([
    'How should I think about death?',
    'What does resurrection mean in Christianity?',
    'Is it ethical to lie to protect someone?',
  ])('%s → one background call, no reporting', async (q) => {
    const h = harness({});
    await run(q, h);
    expect(h.calls.background).toHaveLength(1);
    expect(h.calls.analysis).toHaveLength(0);
  });

  it('"What do you think is happening in Ukraine today?" → current reporting, never background', async () => {
    const h = harness({});
    const payload = await run('What do you think is happening in Ukraine today?', h);
    expect(payload.route.questionClass).toBe('CURRENT_REPORTING');
    expect(h.calls.analysis).toHaveLength(1);
    expect(h.calls.background).toHaveLength(0);
  });
});

/*
  ASK PUBLIC BETA RETRIEVAL REPAIR R1 — the live Beta questions through the adapter. The guest
  contract is unchanged: a clarification and an insufficient-evidence result are never a
  substantive answer (countsAsGuestAnswer), and neither runs the model.
*/
describe('ASK PUBLIC BETA RETRIEVAL REPAIR R1 — fail-closed guards on the live Beta questions', () => {
  const Q1 =
    'What has changed in eastern Democratic Republic of the Congo over the last 7 days? Identify any verified security or territorial changes, effects on civilians or displacement, and any important claims that remain disputed. Separate confirmed facts from analytical inference, distinguish event dates from publication dates, and cite independent local/regional, official, and international sources where available.';
  const Q2 =
    'What are the most recent verified security or territorial changes in eastern Democratic Republic of the Congo, and what effects on civilians or displacement are currently reported? Separate confirmed facts from analytical inference, identify important claims that remain disputed, distinguish event dates from publication dates, and cite independent local/regional, official, and international sources where available.';
  async function run(q: string, h: ReturnType<typeof harness>) {
    const plan = await h.adapter.prepare(req(q));
    return JSON.parse(
      (await inRequest(() => h.adapter.execute(req(q), plan, 'op-beta'))).payloadJson,
    );
  }

  it('BETA-ASK-005 Q1: "last 7 days" is an executable bounded plan, not BROADENING_OFFERED', async () => {
    const h = harness({
      analysis: async (p) => {
        p.usageSink?.({ promptTokens: 3000, completionTokens: 800 });
        return {
          analysis: {} as never,
          articles: [{} as never, {} as never],
          retrievalContext: {
            dataMode: 'live',
            providers: ['gnews'],
            articlesRetrieved: 2,
          } as never,
        };
      },
    });
    const before = Date.now();
    const payload = await run(Q1, h);
    const after = Date.now();

    expect(payload.route.terminalState).toBe('EXECUTABLE');
    expect(payload.route.refusals).not.toContain('BROADENING_OFFERED');
    expect(payload.answer.state).toBe('CURRENT_REPORTING');
    /* The window is visible to the reader as an APPLIED time chip. */
    expect(payload.chips.chips).toContainEqual(
      expect.objectContaining({
        kind: 'TIME',
        value: 'last 7 days',
        source: 'REPORTING_WINDOW',
        applied: true,
      }),
    );
    /* The ONE analysis call carries the window, computed from the SERVER request instant. */
    expect(h.calls.analysis).toHaveLength(1);
    const policy = h.calls.analysis[0][6] as {
      reportingWindow?: { statedPeriod: string; from: string; to: string };
    };
    expect(policy.reportingWindow?.statedPeriod).toBe('last 7 days');
    const to = Date.parse(policy.reportingWindow!.to);
    const from = Date.parse(policy.reportingWindow!.from);
    expect(to).toBeGreaterThanOrEqual(before - 5);
    expect(to).toBeLessThanOrEqual(after + 5);
    expect(to - from).toBe(7 * 24 * 3_600_000);
    expect(countsAsGuestAnswer(payload)).toBe(true);
  });

  it('BETA-ASK-005 Q1 with zero reporting inside the window: INSUFFICIENT, no model, no guest answer', async () => {
    const h = harness({
      analysis: async () => ({
        analysis: null,
        articles: [],
        retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 0 } as never,
      }),
    });
    const payload = await run(Q1, h);
    expect(payload.answer.state).toBe('INSUFFICIENT');
    expect(payload.aiExecuted).toBe(false);
    expect(countsAsGuestAnswer(payload)).toBe(false);
  });

  it.each([
    'What has changed in eastern Democratic Republic of the Congo this week? Identify any verified security or territorial changes.',
    'What has changed in eastern Democratic Republic of the Congo over the last month? Identify any verified security or territorial changes.',
  ])(
    'BETA-ASK-005: an unsupported / ambiguous period still clarifies, with no spend — %s',
    async (q) => {
      const h = harness({});
      const payload = await run(q, h);
      expect(payload.answer.state).toBe('CLARIFICATION_REQUIRED');
      expect(payload.aiExecuted).toBe(false);
      expect(h.calls.analysis).toEqual([]);
      expect(countsAsGuestAnswer(payload)).toBe(false);
    },
  );

  it('R2A Flydubai: the exact PO aviation question executes (one analysis call), never a clarification', async () => {
    const h = harness({
      analysis: async () => ({
        analysis: null,
        articles: [],
        retrievalContext: {
          dataMode: 'live',
          providers: ['gnews'],
          articlesRetrieved: 0,
          verificationNotice: 'NOT_VERIFIED',
        } as never,
      }),
    });
    const q =
      'tell me in details what happened today in the Air from Dubai to Israel in a passenger plane. How did it happen?, Indicate if there were some casualties in that incidence';
    const payload = await run(q, h);
    expect(payload.route.terminalState).toBe('EXECUTABLE');
    expect(h.calls.analysis).toHaveLength(1);
    /* Zero qualifying evidence: INSUFFICIENT, no model, no guest answer — and the payload carries
       the server's NOT_VERIFIED notice for the reader. */
    expect(payload.answer.state).toBe('INSUFFICIENT');
    expect(payload.aiExecuted).toBe(false);
    expect(payload.analysis.retrievalContext.verificationNotice).toBe('NOT_VERIFIED');
    expect(countsAsGuestAnswer(payload)).toBe(false);
  });

  it('Q2 with zero qualifying reporting: INSUFFICIENT, no model, no guest answer', async () => {
    const h = harness({
      analysis: async () => ({
        analysis: null,
        articles: [],
        retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 0 } as never,
      }),
    });
    const payload = await run(Q2, h);
    expect(payload.answer.state).toBe('INSUFFICIENT');
    expect(payload.aiExecuted).toBe(false);
    expect(countsAsGuestAnswer(payload)).toBe(false);
  });

  it('Q2 with admitted reporting and no specialist record still answers from reporting', async () => {
    const h = harness({
      analysis: async (p) => {
        p.usageSink?.({ promptTokens: 3000, completionTokens: 800 });
        return {
          analysis: {} as never,
          articles: [{} as never, {} as never],
          retrievalContext: {
            dataMode: 'live',
            providers: ['gnews'],
            articlesRetrieved: 2,
          } as never,
        };
      },
    });
    const payload = await run(Q2, h);
    expect(payload.answer.state).toBe('CURRENT_REPORTING');
    expect(payload.route.disclosures).toContain('SPECIALIST_INTELLIGENCE_NOT_USED');
    expect(h.calls.analysis).toHaveLength(1);
    expect(countsAsGuestAnswer(payload)).toBe(true);
  });
});

/*
  ════════════════════════════════════════════════════════════════════════════
  ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — the Product Owner's 15 live questions,
  as permanent route-and-execution fixtures, plus the negative controls.
  Production before this tranche: 1/15 substantive (9 → news / "Search was limited",
  5 → "Add one specific place, topic or period").
  ════════════════════════════════════════════════════════════════════════════
*/
const PO_STABLE: ReadonlyArray<[string, string]> = [
  [
    'induction motor inrush',
    'Why does a three-phase induction motor draw a high inrush current when it starts, and how do a soft starter and a variable-frequency drive reduce it differently?',
  ],
  [
    'cavitation / NPSH',
    'Explain why cavitation occurs in a centrifugal pump. What is NPSH, and why must the available NPSH exceed the required NPSH?',
  ],
  [
    'reinforced concrete',
    'Why can a reinforced-concrete beam carry much more bending load than a plain concrete beam of the same size?',
  ],
  [
    'yield / UTS / fracture',
    'What is the difference between yield strength, ultimate tensile strength and fracture strength on a stress-strain curve?',
  ],
  [
    'stainless corrosion',
    'Why does stainless steel resist corrosion, and under what conditions can it still corrode?',
  ],
  [
    'AC / DC / HVDC',
    'Explain the difference between AC and DC transmission, and why HVDC is used for very long distances or undersea cables.',
  ],
  [
    'lithium-ion battery',
    'What physically happens inside a lithium-ion battery when it charges and discharges?',
  ],
  [
    'heat pump COP',
    'How does a heat pump produce more heat energy than the electrical energy it consumes? Explain the coefficient of performance.',
  ],
  [
    'Darcy–Weisbach',
    "Why does increasing a pipe's diameter reduce pressure loss so strongly? Explain using the Darcy-Weisbach equation.",
  ],
  ['TCP / UDP', 'What is the difference between TCP and UDP, and when would you use each?'],
  ['database ACID', 'Explain what a database transaction is and why ACID properties matter.'],
  [
    'encryption',
    'What is the difference between symmetric and asymmetric encryption, and how are they used together in TLS?',
  ],
  [
    'GPS satellites',
    'Why does a GPS receiver need signals from at least four satellites to determine its position?',
  ],
  ['weather / climate', 'What is the difference between weather and climate?'],
];
const MOTOR_Q =
  'A 400 V three-phase motor draws 32 A at a power factor of 0.84 and efficiency of 91%. Estimate its mechanical output power and show the calculation.';

describe('ASK TECHNICAL / SCIENTIFIC REASONING R1 — the PO corpus, routed and executed', () => {
  async function run(q: string, h: ReturnType<typeof harness>) {
    const plan = await h.adapter.prepare(req(q));
    return JSON.parse(
      (await inRequest(() => h.adapter.execute(req(q), plan, 'op-tech'))).payloadJson,
    );
  }

  it.each(PO_STABLE)(
    '%s → REFERENCE_BACKGROUND, zero news calls, no clarification, no place or time',
    async (_label, q) => {
      const h = harness({});
      const payload = await run(q, h);
      expect(payload.route.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
      expect(payload.answer.state).toBe('REFERENCE_BACKGROUND');
      expect(payload.background.text.length).toBeGreaterThan(0);
      /* the news/analysis path is never touched: a news outage has ZERO effect here */
      expect(h.calls.analysis).toEqual([]);
      expect(h.calls.background).toHaveLength(1);
      expect(payload.route.refusals).not.toContain('CLARIFICATION_REQUIRED');
      const chips = payload.chips.kind === 'SCOPED' ? payload.chips.chips : [];
      expect(
        chips.filter((c: { kind: string }) => c.kind === 'GEOGRAPHY' || c.kind === 'TIME'),
      ).toEqual([]);
    },
  );

  it('the motor calculation → COMPUTED_RESULT, deterministic numbers, zero AI, zero news', async () => {
    const h = harness({});
    const payload = await run(MOTOR_Q, h);
    expect(payload.route.questionClass).toBe('COMPUTATION');
    expect(payload.answer).toMatchObject({
      state: 'COMPUTED_RESULT',
      basis: 'DETERMINISTIC_COMPUTATION',
    });
    expect(payload.aiExecuted).toBe(false);
    expect(h.calls.analysis).toEqual([]);
    expect(h.calls.background).toEqual([]);
    expect(h.calls.reserve).toEqual([]);
    expect(payload.computation.steps.map((s: { value: number }) => s.value)).toEqual([
      18.62, 16.95,
    ]);
    expect(payload.computation.result).toEqual({
      name: 'mechanical output power',
      value: 16.95,
      unit: 'kW',
    });
  });

  it.each([
    ['What is the current price of lithium carbonate?', 'current price'],
    ['What changed today in lithium-ion battery safety regulation?', 'changed today'],
    ['What does the latest IEC battery-safety standard require?', 'latest standard'],
  ])('negative control "%s" stays on the current/retrieval path', async (q) => {
    const h = harness({});
    const payload = await run(q, h);
    expect(payload.route.terminalState).toBe('EXECUTABLE');
    expect(h.calls.analysis).toHaveLength(1);
    expect(h.calls.background).toEqual([]);
  });

  it('negative control: "Explain how lithium-ion batteries work." is stable reference', async () => {
    const h = harness({});
    const payload = await run('Explain how lithium-ion batteries work.', h);
    expect(payload.answer.state).toBe('REFERENCE_BACKGROUND');
    expect(h.calls.analysis).toEqual([]);
  });

  it('negative control: "Calculate the energy stored in a 48 V 100 Ah battery." is computation', async () => {
    const h = harness({});
    const payload = await run('Calculate the energy stored in a 48 V 100 Ah battery.', h);
    expect(payload.answer.state).toBe('COMPUTED_RESULT');
    expect(payload.computation.result).toEqual({
      name: 'stored energy (nominal)',
      value: 4.8,
      unit: 'kWh',
    });
    expect(h.calls.analysis).toEqual([]);
  });

  it('a missing engineering parameter is never invented: the reader is asked for it', async () => {
    const h = harness({});
    const payload = await run(
      'A 400 V three-phase motor draws 32 A. Estimate its mechanical output power.',
      h,
    );
    expect(payload.answer.state).toBe('CLARIFICATION_REQUIRED');
    expect(payload.answer.basis).toBe('COMPUTATION_INPUTS_MISSING');
    expect(payload.answer.candidates).toEqual(['power factor', 'efficiency']);
    expect(h.calls.analysis).toEqual([]);
  });

  it.each([
    ['Why is the dollar falling?', 'a changing quantity'],
    ['Compare TCP adoption trends in 2026 enterprise networks', 'a stated year'],
    ['What is happening in Kenya?', 'a named place'],
  ])('freshness still outranks a stable shape: "%s" (%s) keeps the retrieval path', async (q) => {
    const h = harness({});
    const payload = await run(q, h);
    expect(payload.answer.state).not.toBe('REFERENCE_BACKGROUND');
    expect(h.calls.background).toEqual([]);
  });

  /* FINAL STAGE 2 CONVERGENCE R1 — found by the live continuity suite: a context-dependent
     follow-up with a stable shape was detached from its subject and sent to General Background.
     With a prior subject it follows that subject; on its own, a stable concept is unchanged. */
  it('a stable-shaped FOLLOW-UP stays with its prior subject; the same shape standalone is reference', async () => {
    const FOLLOW = 'How does this affect ordinary households?';
    const withPrior = <T>(work: () => Promise<T>): Promise<T> =>
      askRequestContext.run(
        {
          accountId: 'user-1',
          ipScope: 'ip:v4:203.0.113.7',
          priorQuestion: "What has changed in Kenya's economy?",
        },
        work,
      );
    const h = harness({});
    const plan = await withPrior(() => h.adapter.prepare(req(FOLLOW)));
    const payload = JSON.parse(
      (await withPrior(() => h.adapter.execute(req(FOLLOW), plan, 'op-follow'))).payloadJson,
    );
    expect(payload.route.terminalState).not.toBe('REFERENCE_BACKGROUND_ONLY');
    expect(payload.answer.state).not.toBe('REFERENCE_BACKGROUND');
    expect(h.calls.background).toEqual([]);
    expect(h.calls.analysis).toHaveLength(1);

    const alone = harness({});
    const stable = await run(
      'How does a heat pump produce more heat energy than the electrical energy it consumes?',
      alone,
    );
    expect(stable.answer.state).toBe('REFERENCE_BACKGROUND');
    expect(alone.calls.analysis).toEqual([]);
  });
});

/*
  ════════════════════════════════════════════════════════════════════════════
  PUBLIC BETA HARDENING R1B — BROAD GLOBAL NEWS / HEADLINES, routed.
  "Any global news can you share?" must reach the headlines path; "What is happening around the
  world?" (and the Polish mirrors) used to be refused before retrieval because "world" was bound
  as a topic constraint frozen C could not transport. Every other question keeps its path and
  never carries the flag.
  ════════════════════════════════════════════════════════════════════════════
*/
describe('PUBLIC BETA HARDENING R1B — broad global headlines are routed as headlines', () => {
  async function run(
    q: string,
    lg: 'en' | 'pl' = 'en',
    intent: AskRequest['intent'] = 'ask',
    prior?: string,
  ) {
    const h = harness({});
    const request = { ...req(q, lg), intent };
    const context = {
      accountId: 'user-1',
      ipScope: 'ip:v4:203.0.113.7',
      ...(prior === undefined ? {} : { priorQuestion: prior }),
    };
    const plan = await askRequestContext.run(context, () => h.adapter.prepare(request));
    const payload = JSON.parse(
      (await askRequestContext.run(context, () => h.adapter.execute(request, plan, 'op-broad')))
        .payloadJson,
    );
    const policy = (h.calls.analysis[0]?.[6] ?? {}) as { broadHeadlines?: boolean };
    return { payload, h, broad: policy.broadHeadlines === true };
  }

  it.each([
    ['Any global news can you share?', 'en'],
    ['What is happening around the world?', 'en'],
    ["What are today's top world stories?", 'en'],
    ['Give me the latest global headlines.', 'en'],
    ['What are the main news stories today?', 'en'],
    ['Co się dzieje na świecie?', 'pl'],
    ['Jakie są najważniejsze wiadomości ze świata?', 'pl'],
    ['Podaj najnowsze wiadomości ze świata.', 'pl'],
    ['Jakie są dziś najważniejsze wiadomości?', 'pl'],
  ] as const)(
    '1 / 13 · "%s" (%s) → EXECUTABLE current reporting on the headlines path',
    async (q, lg) => {
      const { payload, h, broad } = await run(q, lg);
      expect(payload.route.terminalState).toBe('EXECUTABLE');
      expect(payload.route.refusals).toEqual([]);
      expect(h.calls.analysis).toHaveLength(1);
      expect(broad).toBe(true);
    },
  );

  it.each([
    ["What's happening with NATO?", 'en'],
    ['Latest news about Kenya', 'en'],
    ['Latest ECB interest-rate news', 'en'],
    [
      'tell me in details what happened today in the Air from Dubai to Israel in a passenger plane. How did it happen?, Indicate if there were some casualties in that incidence',
      'en',
    ],
    ['What are the latest developments in eastern DRC?', 'en'],
    [
      'What has changed in eastern Democratic Republic of the Congo over the last 7 days? Identify any verified security or territorial changes, effects on civilians or displacement, and any important claims that remain disputed.',
      'en',
    ],
    ['What are the main news stories in the last 7 days?', 'en'],
    ['Co się dzieje w Kenii?', 'pl'],
  ] as const)('7–10 · "%s" keeps its own path (no headlines flag)', async (q, lg) => {
    const { broad } = await run(q, lg);
    expect(broad).toBe(false);
  });

  it.each([
    ['What is GDP?'],
    ['Explain TCP vs UDP.'],
    ['Calculate the energy stored in a 48 V 100 Ah battery.'],
  ])('11 · "%s" stays reference / computation: no news call at all', async (q) => {
    const { h } = await run(q);
    expect(h.calls.analysis).toEqual([]);
  });

  it('deep analysis of the same words is not the plain headlines path', async () => {
    const { broad } = await run('Any global news can you share?', 'en', 'deep-analysis');
    expect(broad).toBe(false);
  });

  it('a follow-up in a conversation is never re-read as a world-headlines request', async () => {
    const { broad } = await run(
      'Any global news can you share?',
      'en',
      'ask',
      "What has changed in Kenya's economy?",
    );
    expect(broad).toBe(false);
  });
});

describe('TRUST R1 — mixed answer: place background + retained recent reporting (listed, not analysed)', () => {
  const TRAVEL = 'I want to visit Tanzania especially Safari national park, I want to know some information before going there';
  const RECENT = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const article = (n: number, over: Record<string, unknown> = {}) => ({ id: `a${n}`, title: `Report ${n}`, url: `https://example.test/${n}`, sourceName: 'Example', publishedAt: RECENT, countryCode: 'TZ', ...over });

  it('a travel question gets background PLUS dated retained reports — one model call, no analysis call', async () => {
    const asked: unknown[] = [];
    const { adapter, calls } = harness({
      background: async () => ({ text: 'General background.' }),
      news: { findRetainedByCountry: async (...args) => (asked.push(args), [article(1), article(2)]) },
    });
    const plan = await adapter.prepare(req(TRAVEL));
    const payload = JSON.parse((await inRequest(() => adapter.execute(req(TRAVEL), plan, 'op-1'))).payloadJson);
    expect(payload.background).toEqual({ text: 'General background.' });
    expect(payload.recentReporting).toEqual({
      country: 'TZA',
      status: 'LISTED',
      windowDays: 14,
      items: [1, 2].map((n) => ({ title: `Report ${n}`, url: `https://example.test/${n}`, sourceName: 'Example', publishedAt: RECENT })),
    });
    /* ISO3: ArticleCountry's key (an ISO2 read matched nothing on live Alpha) */
    expect(asked).toEqual([['TZA', 5, 14 * 24 * 60]]);
    expect(calls.analysis).toEqual([]);
    expect(calls.background).toHaveLength(1);
  });

  it('no retained reporting is SAID, and a failed read is SAID — never silently dropped', async () => {
    for (const [news, status] of [
      [{ findRetainedByCountry: async () => [] }, 'NONE_RETAINED'],
      [{ findRetainedByCountry: async () => { throw new Error('db down'); } }, 'UNAVAILABLE'],
    ] as const) {
      const { adapter } = harness({ background: async () => ({ text: 'bg' }), news: news as never });
      const plan = await adapter.prepare(req(TRAVEL));
      const payload = JSON.parse((await inRequest(() => adapter.execute(req(TRAVEL), plan, 'op-1'))).payloadJson);
      expect(payload.recentReporting.status).toBe(status);
      expect(payload.recentReporting.items).toEqual([]);
      /* §13 — a failed or empty read never erases the valid background answer */
      expect(payload.background).toEqual({ text: 'bg' });
    }
  });

  it('§13 — only reports whose OWN country is the place asked about are listed', async () => {
    const { adapter } = harness({
      background: async () => ({ text: 'bg' }),
      news: { findRetainedByCountry: async () => [article(1), article(2, { countryCode: 'KE' }), article(3, { countryCode: undefined })] },
    });
    const plan = await adapter.prepare(req(TRAVEL));
    const payload = JSON.parse((await inRequest(() => adapter.execute(req(TRAVEL), plan, 'op-1'))).payloadJson);
    expect(payload.recentReporting.items.map((i: { title: string }) => i.title)).toEqual(['Report 1']);
  });

  it('§13 — a stale, future-dated or undated report is never presented as recent', async () => {
    const day = 24 * 60 * 60 * 1000;
    const { adapter } = harness({
      background: async () => ({ text: 'bg' }),
      news: {
        findRetainedByCountry: async () => [
          article(1, { publishedAt: new Date(Date.now() - 15 * day).toISOString() }),
          article(2, { publishedAt: new Date(Date.now() + 2 * day).toISOString() }),
          article(3, { publishedAt: 'not a date' }),
        ],
      },
    });
    const plan = await adapter.prepare(req(TRAVEL));
    const payload = JSON.parse((await inRequest(() => adapter.execute(req(TRAVEL), plan, 'op-1'))).payloadJson);
    expect(payload.recentReporting).toMatchObject({ status: 'NONE_RETAINED', items: [] });
  });

  it('§13 — listed reports are never handed to the model: the background is not presented as corroborated by them', async () => {
    const seen: string[] = [];
    const { adapter, calls } = harness({
      background: async (...args: unknown[]) => (seen.push(JSON.stringify(args)), { text: 'General background.' }),
      news: { findRetainedByCountry: async () => [article(1, { title: 'UNIQUE-REPORT-HEADLINE' })] },
    });
    const plan = await adapter.prepare(req(TRAVEL));
    const payload = JSON.parse((await inRequest(() => adapter.execute(req(TRAVEL), plan, 'op-1'))).payloadJson);
    expect(payload.recentReporting.items).toHaveLength(1);
    expect(seen.join('')).not.toContain('UNIQUE-REPORT-HEADLINE');
    expect(calls.analysis).toEqual([]);
    expect(payload.analysis).toBeNull();
  });

  it('a stable concept with no place carries no recent-reporting section at all', async () => {
    const { adapter } = harness({ background: async () => ({ text: 'bg' }), news: { findRetainedByCountry: async () => [article(1)] } });
    const plan = await adapter.prepare(req('How does photosynthesis work?'));
    const payload = JSON.parse((await inRequest(() => adapter.execute(req('How does photosynthesis work?'), plan, 'op-1'))).payloadJson);
    expect(payload).not.toHaveProperty('recentReporting');
  });
});
