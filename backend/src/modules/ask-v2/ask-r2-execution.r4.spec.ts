import type { AskRequest } from './ask-compute.contract';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { PriorArtifact } from './conversation/conversation-artifact';

/**
 * CTO R4 — DEEP CONVERSATIONAL INTELLIGENCE through the execution adapter, every dependency faked
 * at its boundary (as in ask-r2-execution.adapter.spec.ts). "analysis" is the news pipeline
 * (GNews / GDELT / RSS): the zero-news invariant is `calls.analysis.length === 0`.
 */
type Usage = { promptTokens: number; completionTokens: number };
type BackgroundInput = {
  question: string;
  jobRules?: string;
  priorWork?: string;
  maxCompletionTokens?: number;
  usageSink?: (u: Usage) => void;
};

function harness(opts: {
  background?: (input: BackgroundInput) => string | null;
  /** absent = the provider has no structured classifier */
  classify?: (user: string) => Promise<string>;
  breakerAllowed?: boolean;
}) {
  const calls = {
    analysis: [] as unknown[],
    background: [] as BackgroundInput[],
    classify: [] as Array<{ system: string; user: string; maxCompletionTokens: number }>,
    reserve: [] as unknown[],
    settle: [] as unknown[][],
  };
  const observed: Array<Record<string, unknown>> = [];
  const analysisService = {
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      calls.analysis.push(args);
      return { analysis: {} as never, articles: [], retrievalContext: {} as never };
    }),
  };
  const backgroundProvider: Record<string, unknown> = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    answerBackground: jest.fn(async (input: BackgroundInput) => {
      calls.background.push(input);
      input.usageSink?.({ promptTokens: 500, completionTokens: 300 });
      return { text: (opts.background ?? (() => 'Reasoned answer.'))(input) };
    }),
  };
  if (opts.classify !== undefined) {
    const classify = opts.classify;
    backgroundProvider.completeStructured = jest.fn(
      async (input: {
        system: string;
        user: string;
        maxCompletionTokens: number;
        usageSink?: (u: Usage) => void;
      }) => {
        calls.classify.push(input);
        input.usageSink?.({ promptTokens: 120, completionTokens: 30 });
        return classify(input.user);
      },
    );
  }
  const meter = {
    config: { outputWeight: 4 },
    reserve: jest.fn(async (input: unknown) => {
      calls.reserve.push(input);
      return {
        admitted: true as const,
        reservationId: `res-${calls.reserve.length}`,
        estimatedUnits: 1,
      };
    }),
    settle: jest.fn(async (...args: unknown[]) => {
      calls.settle.push(args);
      return true;
    }),
  };
  const breaker = {
    permit: jest.fn(async () =>
      opts.breakerAllowed === false
        ? { allowed: false, trial: false, state: 'OPEN' as const }
        : { allowed: true, trial: false, state: 'CLOSED' as const },
    ),
    record: jest.fn(async () => undefined),
  };
  const switches = { isEnabled: jest.fn(async () => true) };
  const adapter = new AskR2ExecutionAdapter(
    analysisService as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    backgroundProvider as never,
    meter as never,
    breaker as never,
    switches as never,
    { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    {
      record: jest.fn(async (input: Record<string, unknown>) => (observed.push(input), true)),
    } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async () => ({ considered: [], contributions: [] })),
    } as never,
    undefined,
    undefined,
  );
  return { adapter, calls, observed };
}

const inRequest = <T>(work: () => Promise<T>): Promise<T> =>
  askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' }, work);

type Payload = {
  aiExecuted: boolean;
  answer: { state: string; basis?: string };
  background?: { text: string } | null;
  guidance?: { kind: string };
  artifact?: {
    kind: string;
    label: string;
    components: string[];
    provenance: string;
    citable: boolean;
  };
  diagnostics: {
    job: {
      job: string | null;
      source: string;
      depth: string;
      transformation: string | null;
      discourseReference: string;
      temporal: Array<{ role: string; days?: number }>;
      classifierCalls: number;
      artifactUsed: { kind: string; label: string; sourceOperationId: string | null } | null;
      artifactProduced: { kind: string; label: string } | null;
    };
  };
};

async function run(
  h: ReturnType<typeof harness>,
  question: string,
  language: 'en' | 'pl' = 'en',
  priorArtifact?: PriorArtifact,
): Promise<Payload> {
  const request: AskRequest = {
    question,
    language,
    intent: 'ask',
    ...(priorArtifact === undefined ? {} : { priorArtifact }),
  };
  const plan = await h.adapter.prepare(request);
  const result = await inRequest(() => h.adapter.execute(request, plan, 'op-r4'));
  expect(result.succeeded).toBe(true);
  return JSON.parse(result.payloadJson) as Payload;
}

const FRAMEWORK_LINE =
  '<<<ARTIFACT {"kind":"CONCEPTUAL_FRAMEWORK","label":"Prime moment","components":["peak capability","peak recognition","overextension","complacency"]} ARTIFACT>>>';
const PRIME: PriorArtifact = {
  kind: 'CONCEPTUAL_FRAMEWORK',
  label: 'Prime moment',
  components: ['peak capability', 'peak recognition', 'overextension', 'complacency'],
  provenance: 'MODEL_REASONING',
  citable: false,
  sourceOperationId: 'op-turn-1',
};

describe('R4 — Prime Moment journey through the adapter: zero news, one reasoning call per turn', () => {
  it('T1 (live wording) — deep rubric, artifact produced in the SAME call and hidden from the reader', async () => {
    const h = harness({ background: () => `## Definition\nA prime moment is…\n${FRAMEWORK_LINE}` });
    const p = await run(
      h,
      'indicate how a prime moment of someone can lead him to losing whatever he had in life',
    );
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
    expect(h.calls.classify).toHaveLength(0);
    expect(h.calls.background[0].jobRules).toMatch(
      /DEPTH: the reader asked for deep conceptual analysis/,
    );
    expect(h.calls.background[0].jobRules).toMatch(
      /conceptual framework you are proposing, not an established scientific equation/,
    );
    expect(h.calls.background[0].maxCompletionTokens).toBe(1400);
    expect(p.aiExecuted).toBe(true);
    expect(p.background?.text).not.toContain('<<<ARTIFACT');
    expect(p.artifact).toEqual({
      kind: 'CONCEPTUAL_FRAMEWORK',
      label: 'Prime moment',
      components: ['peak capability', 'peak recognition', 'overextension', 'complacency'],
      provenance: 'MODEL_REASONING',
      citable: false,
    });
    expect(p.guidance?.kind).toBe('CONCEPTUAL_ANALYSIS');
    expect(p.diagnostics.job).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      depth: 'DEEP',
      classifierCalls: 0,
      artifactProduced: { kind: 'CONCEPTUAL_FRAMEWORK', label: 'Prime moment' },
    });
    expect(h.observed[0]).toMatchObject({ modelInvocationCount: 1, providerCallCount: 1 });
  });

  it('T2 — "Apply that idea to GlobalNewsAI…" receives the earlier framework as delimited, non-evidence work', async () => {
    const h = harness({});
    const p = await run(
      h,
      'Apply that idea to GlobalNewsAI. Are we approaching our prime moment?',
      'en',
      PRIME,
    );
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background[0].priorWork).toMatch(/EARLIER WORK/);
    expect(h.calls.background[0].priorWork).toMatch(/NOT evidence/);
    expect(h.calls.background[0].priorWork).toMatch(/peak recognition/);
    expect(h.calls.background[0].jobRules).toMatch(/EARLIER WORK: an EARLIER WORK block/);
    expect(p.diagnostics.job).toMatchObject({
      job: 'DECISION_SUPPORT',
      discourseReference: 'PRIOR_WORK',
      artifactUsed: {
        kind: 'CONCEPTUAL_FRAMEWORK',
        label: 'Prime moment',
        sourceOperationId: 'op-turn-1',
      },
    });
  });

  it('T3 — "Which part is weakest?" is a diagnosis of the earlier framework, zero news', async () => {
    const h = harness({});
    const p = await run(h, 'Which part is weakest?', 'en', PRIME);
    expect(h.calls.analysis).toHaveLength(0);
    expect(p.diagnostics.job).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      discourseReference: 'PRIOR_WORK',
    });
  });

  it('T4 — "Turn that into a 90-day plan." is a PLAN with a 90-day horizon, never a noted constraint', async () => {
    const h = harness({});
    const p = await run(h, 'Turn that into a 90-day plan.', 'en', PRIME);
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
    expect(p.answer.basis).not.toBe('CONSTRAINT_NOTED');
    expect(h.calls.background[0].jobRules).toMatch(
      /TASK: turn the earlier work into an actionable plan/,
    );
    expect(h.calls.background[0].jobRules).toMatch(/HORIZON: the plan covers 90 days/);
    expect(p.guidance?.kind).toBe('CONVERSATION_WORK');
    expect(p.diagnostics.job).toMatchObject({
      job: 'PLANNING',
      transformation: 'PLAN',
      temporal: [{ role: 'PLAN_HORIZON', days: 90 }],
    });
  });

  it('PL — "Przekształć to w plan na 90 dni." is the same PLAN job', async () => {
    const h = harness({});
    const p = await run(h, 'Przekształć to w plan na 90 dni.', 'pl', PRIME);
    expect(h.calls.analysis).toHaveLength(0);
    expect(p.diagnostics.job).toMatchObject({ job: 'PLANNING', transformation: 'PLAN' });
  });
});

describe('R4 — the bounded semantic classifier (UNRESOLVED questions only)', () => {
  const Q = 'Are we approaching our prime moment?';

  it('no classifier available → stable reasoning fallback, never news (0 classifier calls)', async () => {
    const h = harness({});
    const p = await run(h, Q);
    expect(h.calls.analysis).toHaveLength(0);
    expect(p.diagnostics.job).toMatchObject({ source: 'FALLBACK', classifierCalls: 0 });
  });

  it('a "no current evidence" verdict → reasoning; the classifier is counted as a model invocation', async () => {
    const h = harness({
      classify: async () =>
        JSON.stringify({
          job: 'DECISION_SUPPORT',
          needsCurrentEvidence: false,
          depth: 'DEEP',
          transformation: null,
          confidence: 'HIGH',
        }),
    });
    const p = await run(h, Q);
    expect(h.calls.classify).toHaveLength(1);
    expect(h.calls.classify[0].maxCompletionTokens).toBe(120);
    expect(h.calls.classify[0].user).toContain('<<<Are we approaching our prime moment?>>>');
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.reserve).toHaveLength(2); /* classifier + answer, each metered */
    expect(h.calls.settle).toHaveLength(2);
    expect(p.diagnostics.job).toMatchObject({
      job: 'DECISION_SUPPORT',
      source: 'SEMANTIC',
      classifierCalls: 1,
    });
    expect(h.observed[0]).toMatchObject({ modelInvocationCount: 2 });
  });

  it('a failing classifier → reasoning fallback (1 call recorded), never news', async () => {
    const h = harness({ classify: async () => Promise.reject(new Error('boom')) });
    const p = await run(h, Q);
    expect(h.calls.analysis).toHaveLength(0);
    expect(p.diagnostics.job).toMatchObject({ source: 'FALLBACK', classifierCalls: 1 });
  });

  it('a malformed verdict (outside the closed schema) → reasoning fallback', async () => {
    const h = harness({ classify: async () => '{"job":"NEWS","needsCurrentEvidence":true}' });
    const p = await run(h, Q);
    expect(h.calls.analysis).toHaveLength(0);
    expect(p.diagnostics.job.source).toBe('FALLBACK');
  });

  it('an open breaker → no classifier call; the answer meets the same breaker and refuses truthfully', async () => {
    const h = harness({ breakerAllowed: false, classify: async () => '{}' });
    const request: AskRequest = { question: Q, language: 'en', intent: 'ask' };
    const plan = await h.adapter.prepare(request);
    await expect(inRequest(() => h.adapter.execute(request, plan, 'op'))).rejects.toThrow();
    expect(h.calls.classify).toHaveLength(0);
    expect(h.calls.analysis).toHaveLength(0);
  });
});

describe('R4 — negative controls stay on the evidence path', () => {
  it.each([
    ['What happened in Kenya 90 days ago?', true],
    /* frozen C's own BROADENING_OFFERED news terminal: no execution yet, and never reasoning */
    ['What changed in Rwanda this month?', false],
  ] as const)('%s → the evidence route, no classifier, no reasoning call', async (q, executes) => {
    const h = harness({ classify: async () => '{}' });
    const request: AskRequest = { question: q, language: 'en', intent: 'ask' };
    const plan = await h.adapter.prepare(request);
    await inRequest(() => h.adapter.execute(request, plan, 'op')).catch(() => undefined);
    expect(h.calls.classify).toHaveLength(0);
    expect(h.calls.background).toHaveLength(0);
    expect(h.calls.analysis.length > 0).toBe(executes);
  });
});
