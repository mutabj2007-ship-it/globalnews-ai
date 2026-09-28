import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskExecutionRefused, validatePlan, type AskRequest } from './ask-compute.contract';
import {
  AskR2ExecutionAdapter,
  estimateUnits,
  estimateBackgroundUnits,
} from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
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
}) {
  const calls: Calls = {
    analysis: [],
    background: [],
    reserve: [],
    settle: [],
    permit: [],
    record: [],
  };
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
  );
  return { adapter, calls };
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
    it.each([
      ['What is NATO and what is it doing in Poland today?', 'CLARIFICATION_REQUIRED'],
      ['What is inflation and what is the inflation rate today?', 'CAPABILITY_UNAVAILABLE'],
    ])('%s → current-evidence path (%s), never the background provider', async (q, state) => {
      const { adapter, calls } = harness({});
      const plan = await adapter.prepare(req(q));
      expect(plan.contract).toMatch(/:CURRENT_REPORTING:/);
      expect(plan.contract).not.toMatch(/:REFERENCE_BACKGROUND_ONLY$/);
      const result = await inRequest(() => adapter.execute(req(q), plan, 'op-1'));
      const payload = JSON.parse(result.payloadJson);
      expect(payload.answer.state).toBe(state);
      expect(payload.background).toBeNull();
      expect(payload.modelPriorCitable).toBe(false);
      expect(payload.aiExecuted).toBe(false);
      expect(calls.background).toEqual([]);
      expect(calls.analysis).toEqual([]);
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

      /* Frozen C ends this current follow-up in a governed clarification (BROADENING_OFFERED,
         zero model calls); the boundary is what matters — it never reaches background. */
      const turn3 = 'What is NATO doing in Poland today?';
      const plan3 = await adapter.prepare(req(turn3));
      expect(plan3.contract).toMatch(/:CURRENT_REPORTING:/);
      const r3 = await inRequest(() => adapter.execute(req(turn3), plan3, 'op-3'));
      expect(JSON.parse(r3.payloadJson).background).toBeNull();
      expect(calls.background).toHaveLength(2);

      /* …and an executable current follow-up goes to Reporting, still never to background. */
      const turn4 = 'What is happening in Kenya?';
      const plan4 = await adapter.prepare(req(turn4));
      await inRequest(() => adapter.execute(req(turn4), plan4, 'op-4'));
      /* the boundary: current turns never touch the background provider, and turns 1–2's
         background answers never touched Reporting. */
      expect(calls.background).toHaveLength(2);
      expect(calls.analysis).toHaveLength(1);
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
