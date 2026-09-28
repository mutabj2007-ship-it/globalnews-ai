import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskExecutionRefused, validatePlan, type AskRequest } from './ask-compute.contract';
import { AskR2ExecutionAdapter, estimateUnits } from './ask-r2-execution.adapter';
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
}) {
  const calls: Calls = { analysis: [], reserve: [], settle: [], permit: [], record: [] };
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
    expect(calls).toEqual({ analysis: [], reserve: [], settle: [], permit: [], record: [] });
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
    expect(calls).toEqual({ analysis: [], reserve: [], settle: [], permit: [], record: [] });
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

  it('a model failure settles with the estimate kept (null actual), records FAILURE, and refuses', async () => {
    const { adapter, calls } = harness({
      analysis: async () => ({
        analysis: null,
        analysisError: 'provider-unavailable',
        articles: [],
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
