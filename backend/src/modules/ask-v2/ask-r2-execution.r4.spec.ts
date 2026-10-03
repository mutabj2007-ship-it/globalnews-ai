import type { AskRequest } from './ask-compute.contract';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import { validateArtifact, type PriorArtifact } from './conversation/conversation-artifact';
import { SEMANTIC_INTERPRETER_MAX_TOKENS } from '../ask-router/semantic-ir/semantic-interpreter';

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
  /** the news pipeline's behaviour (default: no articles) */
  analysis?: () => Promise<unknown>;
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
      if (opts.analysis !== undefined) return opts.analysis();
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
  it('T1 (live wording) — a causal question gets the CAUSAL rubric; artifact produced in the SAME call and hidden from the reader', async () => {
    const h = harness({ background: () => `## Definition\nA prime moment is…\n${FRAMEWORK_LINE}` });
    const p = await run(
      h,
      'indicate how a prime moment of someone can lead him to losing whatever he had in life',
    );
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
    expect(h.calls.classify).toHaveLength(0);
    expect(h.calls.background[0].jobRules).toMatch(/CAUSAL ANALYSIS: the reader asked how or why/);
    expect(h.calls.background[0].jobRules).toMatch(
      /amplification — the feedback loops or thresholds/,
    );
    expect(h.calls.background[0].jobRules).toMatch(/kind is most likely CONCEPTUAL_FRAMEWORK/);
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
          /* E1-R4-2 — the contract requires one kind per segmented clause */
          clauses: [{ id: 0, kind: 'STABLE' }],
        }),
    });
    const p = await run(h, Q);
    expect(h.calls.classify).toHaveLength(1);
    /* CTO R4 semantic IR — the ONE bounded interpretation returns the closed IR fields */
    expect(h.calls.classify[0].maxCompletionTokens).toBe(SEMANTIC_INTERPRETER_MAX_TOKENS);
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

/* ── CTO R4 FINAL CLOSEOUT ──────────────────────────────────────────────────────────────────── */

describe('R4 closeout §8 — the Prime Moment artifact chain in ONE thread (framework → diagnosis → recommendation → plan)', () => {
  /* the model's reply per turn: it hands back the kind the job rules name as most likely */
  const reply = (input: BackgroundInput): string => {
    const kind = /kind is most likely ([A-Z_]+)/.exec(input.jobRules ?? '')?.[1] ?? 'SUMMARY';
    const label = `${kind.toLowerCase()} for turn`;
    return `Answer.\n<<<ARTIFACT {"kind":"${kind}","label":"${label}","components":["a","b","c"]} ARTIFACT>>>`;
  };
  const EN: Array<[string, string, string]> = [
    [
      'Define deeply what is "Prime moment" of something or someone. I need deeper analysis.',
      'DEEP_CONCEPTUAL_ANALYSIS',
      'CONCEPTUAL_FRAMEWORK',
    ],
    [
      'Apply that idea to GlobalNewsAI. Are we approaching our prime moment?',
      'DECISION_SUPPORT',
      'DIAGNOSIS',
    ],
    ['Which part is weakest?', 'DEEP_CONCEPTUAL_ANALYSIS', 'DIAGNOSIS'],
    ['What should we do about it?', 'ADVISORY', 'RECOMMENDATION'],
    ['Turn that into a 90-day plan.', 'PLANNING', 'PLAN'],
  ];
  const PL: Array<[string, string, string]> = [
    [
      'Wyjaśnij dogłębnie, czym jest „moment szczytowy” czegoś lub kogoś.',
      'DEEP_CONCEPTUAL_ANALYSIS',
      'CONCEPTUAL_FRAMEWORK',
    ],
    ['Zastosuj tę ideę do GlobalNewsAI.', 'DECISION_SUPPORT', 'DIAGNOSIS'],
    ['Która część jest najsłabsza?', 'DEEP_CONCEPTUAL_ANALYSIS', 'DIAGNOSIS'],
    ['Co powinniśmy z tym zrobić?', 'ADVISORY', 'RECOMMENDATION'],
    ['Przekształć to w plan na 90 dni.', 'PLANNING', 'PLAN'],
  ];

  it.each([
    ['en', EN],
    ['pl', PL],
  ] as const)(
    '%s — every turn: zero news, the previous artifact received with its source turn, its own artifact produced; never evidence',
    async (lang, turns) => {
      let prior: PriorArtifact | undefined;
      const chain: string[] = [];
      for (const [i, [q, job, kind]] of turns.entries()) {
        const h = harness({ background: reply });
        const request: AskRequest = {
          question: q,
          language: lang,
          intent: 'ask',
          ...(prior === undefined ? {} : { priorArtifact: prior }),
        };
        const plan = await h.adapter.prepare(request);
        const opId = `op-turn-${i + 1}`;
        const result = await inRequest(() => h.adapter.execute(request, plan, opId));
        const p = JSON.parse(result.payloadJson) as Payload & {
          analysis?: unknown;
          recentReporting?: unknown;
        };
        /* zero news, one reasoning call */
        expect(h.calls.analysis).toHaveLength(0);
        expect(h.calls.background).toHaveLength(1);
        expect(p.diagnostics.job.job).toBe(job);
        /* the previous turn's artifact arrived, with its source turn */
        if (prior !== undefined) {
          expect(p.diagnostics.job.artifactUsed).toEqual({
            kind: prior.kind,
            label: prior.label,
            sourceOperationId: `op-turn-${i}`,
          });
          expect(h.calls.background[0].priorWork).toMatch(/NOT evidence/);
        }
        /* this turn's own artifact: kind, bounded content, model reasoning, never citable */
        expect(p.artifact).toMatchObject({ kind, provenance: 'MODEL_REASONING', citable: false });
        expect(p.artifact!.components.length).toBeLessThanOrEqual(8);
        /* never evidence: no sources, no reporting, no evidence role obtained */
        expect(p.analysis ?? null).toBeNull();
        expect(p.recentReporting ?? null).toBeNull();
        expect(h.observed[0]).toMatchObject({
          evidenceRolesObtained: [],
          reportingItemCount: 0,
          jobArtifactProducedKind: kind,
        });
        chain.push(kind);
        /* what the service does on the next turn: validate the stored artifact, attach its source */
        const stored = validateArtifact(p.artifact);
        expect(stored).not.toBeNull();
        prior = { ...stored!, sourceOperationId: opId };
      }
      expect(chain).toEqual([
        'CONCEPTUAL_FRAMEWORK',
        'DIAGNOSIS',
        'DIAGNOSIS',
        'RECOMMENDATION',
        'PLAN',
      ]);
    },
  );
});

describe('R4 closeout §7 — a MIXED answer keeps its stable half when current retrieval fails', () => {
  const Q =
    "Explain why currency pegs can be fragile and tell me what happened to Argentina's exchange rate this week.";
  it('frozen C can only OFFER to broaden the current part → the stable causal explanation is still answered, the current part named UNAVAILABLE (never a bare broadening ask)', async () => {
    const h = harness({
      analysis: async () => {
        throw new Error('GNews rate limited');
      },
    });
    const p = (await run(h, Q)) as Payload & {
      guidance?: { kind: string; currentPart?: string; currentEvidenceNeeded: string[] };
    };
    /* BROADENING_OFFERED: no reporting attempt, one reasoning call for the stable half */
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
    expect(h.observed[0]).toMatchObject({
      providerCallCount: 1,
      terminalState: 'BROADENING_OFFERED',
    });
    expect(p.answer).toMatchObject({
      state: 'REFERENCE_BACKGROUND',
      basis: 'PARTIAL_CURRENT_UNAVAILABLE',
    });
    expect(p.background?.text).toBe('Reasoned answer.');
    expect(p.guidance).toMatchObject({
      kind: 'MIXED_REFERENCE_CURRENT',
      currentPart: 'UNAVAILABLE',
    });
    expect(p.guidance!.currentEvidenceNeeded.join(' ')).toMatch(/this week/);
  });
  it('PL — the same survival', async () => {
    const h = harness({
      analysis: async () => {
        throw new Error('timeout');
      },
    });
    const p = await run(
      h,
      'Czym jest Trybunał Konstytucyjny i jak wygląda obecnie spór polityczny wokół niego?',
      'pl',
    );
    expect(h.calls.background).toHaveLength(1);
    expect(p.answer).toMatchObject({
      state: 'REFERENCE_BACKGROUND',
      basis: 'PARTIAL_CURRENT_UNAVAILABLE',
    });
  });
});

describe('R4 closeout §1/§5 — the R4-G1 questions through the adapter: causal rubric, zero news', () => {
  it.each([
    ['How does a currency peg turn a small shock into a big crisis?', 'en'],
    [
      'Jak nadmierna centralizacja władzy może prowadzić do gorszych decyzji w czasie kryzysu?',
      'pl',
    ],
  ] as const)('%s', async (q, lang) => {
    const h = harness({});
    const p = await run(h, q, lang);
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.classify).toHaveLength(0);
    expect(h.calls.background[0].jobRules).toMatch(/CAUSAL ANALYSIS/);
    expect(p.guidance?.kind).toBe('CONCEPTUAL_ANALYSIS');
  });
});

describe('R4 closeout §9 — the job is observable (codes only)', () => {
  it('a deterministic deep turn on earlier work', async () => {
    const h = harness({
      background: () =>
        'Diagnosis.\n<<<ARTIFACT {"kind":"DIAGNOSIS","label":"weakest","components":["x"]} ARTIFACT>>>',
    });
    await run(h, 'Which part is weakest?', 'en', PRIME);
    expect(h.observed[0]).toMatchObject({
      jobKind: 'DEEP_CONCEPTUAL_ANALYSIS',
      jobSource: 'DETERMINISTIC',
      jobDepth: 'DEEP',
      jobFreshness: 'NONE',
      jobClassifierUsed: false,
      jobTransformation: null,
      jobDiscourseReference: 'PRIOR_WORK',
      jobArtifactUsedKind: 'CONCEPTUAL_FRAMEWORK',
      jobArtifactProducedKind: 'DIAGNOSIS',
    });
    /* never the artifact's content or the model's prose */
    expect(JSON.stringify(h.observed[0])).not.toMatch(/weakest|Diagnosis\.|Prime moment/);
  });
  it('an UNRESOLVED turn decided by the classifier records that the classifier was used', async () => {
    const h = harness({
      classify: async () =>
        JSON.stringify({
          job: 'DECISION_SUPPORT',
          needsCurrentEvidence: false,
          depth: 'STANDARD',
          transformation: null,
          confidence: 'HIGH',
          /* E1-R4-2 — the contract requires one kind per segmented clause */
          clauses: [{ id: 0, kind: 'STABLE' }],
        }),
    });
    await run(h, 'Are we approaching our prime moment?');
    expect(h.observed[0]).toMatchObject({
      jobKind: 'DECISION_SUPPORT',
      jobSource: 'SEMANTIC',
      jobClassifierUsed: true,
    });
  });
  it('a current-reporting turn records the evidence job and no classifier', async () => {
    const h = harness({});
    const request: AskRequest = {
      question: 'What happened in Kenya 90 days ago?',
      language: 'en',
      intent: 'ask',
    };
    const plan = await h.adapter.prepare(request);
    await inRequest(() => h.adapter.execute(request, plan, 'op')).catch(() => undefined);
    expect(h.observed[0]).toMatchObject({
      jobKind: 'CURRENT_REPORTING',
      jobFreshness: 'CURRENT',
      jobClassifierUsed: false,
    });
  });
});

/* ── CTO R4 THIRD PASS ──────────────────────────────────────────────────────────────────────── */

describe('R4 third pass §11 — an IMPERATIVE turn creates the work; the chain resolves against it', () => {
  it('Outline … → Which assumption is weakest? → Turn that criticism into a checklist for a pilot', async () => {
    const reply = (input: BackgroundInput): string => {
      const kind = /kind is most likely ([A-Z_]+)/.exec(input.jobRules ?? '')?.[1] ?? 'SUMMARY';
      return `Answer.\n<<<ARTIFACT {"kind":"${kind}","label":"${kind.toLowerCase()}","components":["a","b"]} ARTIFACT>>>`;
    };
    const turns: Array<[string, string, string | null]> = [
      ['Outline the arguments for a four-day work week.', 'EXPLANATION', null],
      ['Which assumption is weakest?', 'DEEP_CONCEPTUAL_ANALYSIS', 'DIAGNOSIS'],
      ['Turn that criticism into a checklist for a pilot.', 'TRANSFORMATION', 'PLAN'],
    ];
    let prior: PriorArtifact | undefined;
    for (const [i, [q, job, kind]] of turns.entries()) {
      const h = harness({
        background: (input) =>
          i === 0
            ? 'Arguments.\n<<<ARTIFACT {"kind":"CONCEPTUAL_FRAMEWORK","label":"four-day week arguments","components":["productivity","wellbeing","cost"]} ARTIFACT>>>'
            : reply(input),
      });
      const request: AskRequest = {
        question: q,
        language: 'en',
        intent: 'ask',
        ...(prior === undefined ? {} : { priorArtifact: prior }),
      };
      const plan = await h.adapter.prepare(request);
      const opId = `op-imp-${i + 1}`;
      const result = await inRequest(() => h.adapter.execute(request, plan, opId));
      const p = JSON.parse(result.payloadJson) as Payload;
      /* the first turn is ANSWERED (never a noted constraint), every turn with zero news */
      expect(p.answer.basis).not.toBe('CONSTRAINT_NOTED');
      expect(h.calls.analysis).toHaveLength(0);
      expect(h.calls.background).toHaveLength(1);
      expect(p.diagnostics.job.job).toBe(job);
      if (i > 0) {
        expect(p.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
        expect(p.diagnostics.job.artifactUsed?.sourceOperationId).toBe(`op-imp-${i}`);
      }
      if (kind !== null) expect(p.artifact?.kind).toBe(kind);
      const stored = validateArtifact(p.artifact);
      expect(stored).not.toBeNull();
      prior = { ...stored!, sourceOperationId: opId };
    }
  });
});

describe('R4 third pass §8–§10 — a historical relationship keeps BOTH countries as scope, zero news', () => {
  it.each([
    [
      'How did relations between France and Germany change after the Second World War?',
      'en',
      ['FRA', 'DEU'],
    ],
    ['Jak rozwijał się spór Peru–Chile?', 'pl', ['PER', 'CHL']],
  ] as const)('%s', async (q, lang, countries) => {
    const h = harness({});
    const p = (await run(h, q, lang)) as Payload & { relationship?: { countries: string[] } };
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
    expect(p.diagnostics.job.job).toBe('RELATIONSHIP_ANALYSIS');
    expect([...(p.relationship?.countries ?? [])].sort()).toEqual([...countries].sort());
  });
});

describe('R4 third pass §3 — a completed past year is answered as history, never a news search', () => {
  it.each([
    ['Why did the financial system fail in 2008?', 'en'],
    ['Dlaczego w 2008 roku upadł system finansowy?', 'pl'],
  ] as const)('%s', async (q, lang) => {
    const h = harness({});
    await run(h, q, lang);
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
  });
});

/* ── CTO R4 FOURTH PASS ─────────────────────────────────────────────────────────────────────── */

describe('R4 fourth pass §10 — MIXED keeps its stable half in Polish written without diacritics', () => {
  it('czym sie rozni …, a jak dzis … → stable half answered when retrieval fails', async () => {
    const h = harness({
      analysis: async () => {
        throw new Error('GNews unavailable');
      },
    });
    const p = await run(
      h,
      'czym sie rozni obligacja od akcji, a jak dzis zachowuje sie WIG20?',
      'pl',
    );
    expect(h.calls.background).toHaveLength(1);
    expect(p.answer.state).toBe('REFERENCE_BACKGROUND');
    expect(p.answer.basis).toMatch(/^PARTIAL_CURRENT_/);
  });
});

describe('R4 fourth pass §12 — present / recent language reaches the evidence path', () => {
  it.each([
    ['Have Turkey and Greece been cooperating more lately?', 'en'],
    ['What is the situation in Haiti at present?', 'en'],
  ] as const)('%s → the news pipeline is called, never reasoning only', async (q, lang) => {
    const h = harness({});
    const request: AskRequest = { question: q, language: lang, intent: 'ask' };
    const plan = await h.adapter.prepare(request);
    await inRequest(() => h.adapter.execute(request, plan, 'op')).catch(() => undefined);
    expect(h.calls.analysis.length).toBeGreaterThan(0);
  });
});

/* ── CTO R4 FIFTH PASS ──────────────────────────────────────────────────────────────────────── */

describe('R4 fifth pass D — the conversation objective answers "best for what?"', () => {
  const trace = {
    job: 'UNKNOWN',
    ownJob: 'UNKNOWN',
    carried: [],
    overridden: [],
    reset: false,
    composed: null,
  };
  it('a decision with the objective stated two turns earlier is answered, not clarified', async () => {
    const h = harness({});
    const request: AskRequest = {
      question: 'Which one fits me better?',
      language: 'en',
      intent: 'ask',
      conversation: {
        officialSourcesOnly: false,
        constraintOnly: false,
        trace,
        objective: { text: 'income stability and working abroad', sourceTurn: 1 },
      },
    };
    const plan = await h.adapter.prepare(request);
    const p = JSON.parse(
      (await inRequest(() => h.adapter.execute(request, plan, 'op'))).payloadJson,
    ) as Payload;
    expect(p.answer.basis).not.toBe('DECISION_OBJECTIVE_MISSING');
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
  });
  it('with no objective anywhere, "best for what?" is still asked (zero compute)', async () => {
    const h = harness({});
    const request: AskRequest = {
      question: 'Which country is best?',
      language: 'en',
      intent: 'ask',
    };
    const plan = await h.adapter.prepare(request);
    const p = JSON.parse(
      (await inRequest(() => h.adapter.execute(request, plan, 'op'))).payloadJson,
    ) as Payload;
    expect(p.answer.basis).toBe('DECISION_OBJECTIVE_MISSING');
    expect(h.calls.background).toHaveLength(0);
  });
  it('a component evaluation of earlier work is answered on that work (never "best for what?")', async () => {
    const h = harness({});
    const p = await run(h, "Which of the critic's points is the strongest, and why?", 'en', PRIME);
    expect(p.answer.basis).not.toBe('DECISION_OBJECTIVE_MISSING');
    expect(p.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
    expect(h.calls.analysis).toHaveLength(0);
  });
});

describe('CTO R4 SEMANTIC IR — one bounded interpretation, only for ambiguous turns, before any provider', () => {
  const CONFLICT = 'What is the current federal funds target range?';
  const verdict = (needsCurrentEvidence: boolean) => async () =>
    JSON.stringify({
      job: needsCurrentEvidence ? 'OFFICIAL_CURRENT_REFERENCE' : 'EXPLANATION',
      needsCurrentEvidence,
      depth: 'STANDARD',
      transformation: null,
      confidence: 'HIGH',
      clauses: [{ id: 0, kind: needsCurrentEvidence ? 'CURRENT' : 'STABLE' }],
      relation: null,
      reference: 'NONE',
    });

  it('§4 FAST PATH — an obvious current question makes ZERO interpretation calls', async () => {
    const h = harness({ classify: verdict(true) });
    await run(h, 'What happened in Kenya today?');
    expect(h.calls.classify).toHaveLength(0);
    expect(h.observed[0]).toMatchObject({ semanticPath: 'DETERMINISTIC', semanticConflicts: [] });
  });

  it('§4 FAST PATH — an obvious conceptual question makes ZERO interpretation calls and no news', async () => {
    const h = harness({ classify: verdict(true) });
    await run(h, 'Explain deeply what resilience means.');
    expect(h.calls.classify).toHaveLength(0);
    expect(h.calls.analysis).toHaveLength(0);
  });

  it('§5/§6 — a CONFLICT gets exactly ONE interpretation, BEFORE the news provider; its verdict (current) decides', async () => {
    const h = harness({ classify: verdict(true) });
    await run(h, CONFLICT);
    expect(h.calls.classify).toHaveLength(1);
    expect(h.calls.classify[0].system).toContain('interpret the MEANING of ONE user turn');
    expect(h.calls.classify[0].user).toContain('Unresolved: STABLE_SHAPE_WITH_CURRENT_MARKER');
    expect(h.calls.analysis).toHaveLength(1);
    expect(h.observed[0]).toMatchObject({
      semanticPath: 'SEMANTIC',
      semanticConflicts: ['STABLE_SHAPE_WITH_CURRENT_MARKER'],
      semanticFreshness: 'CURRENT',
      semanticInterpreterPromptTokens: 120,
      semanticInterpreterCompletionTokens: 30,
      jobClassifierUsed: true,
    });
    /* the interpretation is a model invocation of this Ask too */
    expect(h.observed[0].modelInvocationCount).toBeGreaterThanOrEqual(1);
  });

  it('§5 — the interpreter may decide the opposite (no current evidence): reasoning, zero news', async () => {
    const h = harness({ classify: verdict(false) });
    await run(h, CONFLICT);
    expect(h.calls.classify).toHaveLength(1);
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.observed[0]).toMatchObject({ semanticPath: 'SEMANTIC', semanticFreshness: 'NONE' });
  });

  it('§5 FALLBACK — no interpreter: the governed default (explicit currentness outranks shape) stands, 0 calls', async () => {
    const h = harness({});
    await run(h, CONFLICT);
    expect(h.calls.classify).toHaveLength(0);
    expect(h.calls.analysis).toHaveLength(1);
    expect(h.observed[0]).toMatchObject({ semanticPath: 'FALLBACK', semanticFreshness: 'CURRENT' });
  });

  it('§5 — an invalid interpretation (outside the closed schema) is the governed default, never news by itself', async () => {
    const h = harness({ classify: async () => '{"job":"NEWS","needsCurrentEvidence":"yes"}' });
    await run(h, 'Are we approaching our prime moment?');
    expect(h.calls.classify).toHaveLength(1);
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.observed[0]).toMatchObject({ semanticPath: 'FALLBACK' });
  });

  it('§12 / §20 — a venue city is observed as CITY:<ISO2> (never a name), the actors as ISO3', async () => {
    const h = harness({ classify: verdict(true) });
    await run(h, 'Has anything come out of the DR Congo–Rwanda peace talks in Doha this week?');
    expect(h.observed[0]).toMatchObject({
      semanticActorCodes: ['COD', 'RWA'],
      semanticVenueCodes: ['CITY:QA'],
      semanticRelation: 'DIPLOMATIC',
    });
  });
});
