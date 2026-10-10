import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { conversationOf } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import { validateStoredArtifact, type PriorArtifact } from './conversation/conversation-artifact';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK EVIDENCE CONTINUITY + FINANCE INTEGRITY R1 — the measured Production defects, replayed
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Through the REAL executor with fake providers (no live provider / model call):
 *   thread 9079dd09  turn 1 (op ce732c69) GNews rate-limited, 0 candidates, recorded as a
 *                    SOURCED_REPORT; turn 2 (op 9713f8ee) "Based on those reports…" answered by
 *                    reasoning as though reports existed.
 *   op b3924ff0      APR vs nominal rate explained with a simple cost percentage as THE APR.
 */
type Mode = 'RATE_LIMITED' | 'NO_MATCH' | 'SOURCED';

/* the store's read of an earlier answer's evidence ref (null: not obtainable — a held source is absent) */
type StoredRow = { id: string; sourceId: string } | null;

function harness(mode: () => Mode, store?: (id: string) => StoredRow) {
  const analysis: unknown[][] = [];
  const background: Array<{ question: string; priorWork?: string; jobRules?: string }> = [];
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        analysis.push(args);
        const m = mode();
        if (m === 'SOURCED')
          return {
            analysis: {
              headline: 'M23 holds Goma; aid access curtailed',
              summary: 'Summary.',
              keyFacts: [{ claim: 'Aid agencies report restricted access', sourceArticleIds: ['art-1'] }],
            } as never,
            articles: [{ id: 'art-1', url: 'https://example.org/a1' } as never],
            retrievalContext: { outcome: 'SUCCESS', providers: ['gnews'], providerFailures: [] } as never,
          } satisfies Partial<AnalysisApiResponse>;
        return {
          analysis: null,
          articles: [],
          retrievalContext: (m === 'RATE_LIMITED'
            ? {
                outcome: 'PROVIDER_RATE_LIMITED',
                providers: [],
                providerFailures: [{ providerId: 'gnews', kind: 'rate-limited' }],
                dataMode: 'unavailable',
                retrievalTrace: { lanesUnavailable: [{ lane: 'gnews', reason: 'rate-limited' }] },
              }
            : {
                outcome: 'NO_RELEVANT_EVIDENCE',
                providers: ['gnews'],
                providerFailures: [],
                dataMode: 'live',
                retrievalTrace: { lanesUnavailable: [] },
              }) as never,
        } as never;
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    {
      id: 'openai',
      displayName: 'OpenAI',
      isMock: false,
      answerBackground: jest.fn(
        async (input: { question: string; priorWork?: string; jobRules?: string }) => {
          background.push(input);
          return { text: `Reasoned: ${input.question.slice(0, 60)}.\n\nSecond paragraph.` };
        },
      ),
    } as never,
    {
      config: { outputWeight: 4 },
      reserve: jest.fn(async () => ({ admitted: true, reservationId: 'r', estimatedUnits: 1 })),
      settle: jest.fn(async () => true),
    } as never,
    {
      permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' })),
      record: jest.fn(async () => undefined),
    } as never,
    { isEnabled: jest.fn(async () => true) } as never,
    { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async () => true) } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async () => ({ considered: [], contributions: [] })),
    } as never,
    undefined /* guests */,
    store === undefined ? undefined : ({ findArticleById: jest.fn(async (id: string) => store(id)) } as never),
  );
  return { adapter, analysis, background };
}

function conversation(language: 'en' | 'pl' = 'en', store?: (id: string) => StoredRow) {
  let mode: Mode = 'SOURCED';
  const h = harness(() => mode, store);
  const earlier: string[] = [];
  let prior: PriorArtifact | undefined;
  let op = 0;
  async function ask(question: string, m: Mode = 'SOURCED', opts: { reopened?: boolean } = {}) {
    mode = m;
    const conversational = opts.reopened
      ? null
      : readConversationalTurn(
          question,
          language,
          [...earlier].reverse().map((q) => ({ question: q, language })),
        );
    const composed = conversational?.composition ?? null;
    const request = {
      question: composed?.effectiveQuestion ?? question,
      language,
      intent: 'ask',
      ...(opts.reopened ? {} : conversationOf(conversational)),
      ...(prior === undefined ? {} : { priorArtifact: prior }),
    } as AskRequest;
    const before = { a: h.analysis.length, b: h.background.length };
    const priorQuestion = opts.reopened ? undefined : earlier[earlier.length - 1];
    const id = `op-${++op}`;
    let plan: Awaited<ReturnType<typeof h.adapter.prepare>> | undefined;
    const payload = await askRequestContext.run(
      {
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        ...(priorQuestion === undefined ? {} : { priorQuestion }),
      } as never,
      async () => {
        plan = await h.adapter.prepare(request);
        return JSON.parse((await h.adapter.execute(request, plan, id)).payloadJson);
      },
    );
    earlier.push(question);
    const stored = validateStoredArtifact(payload.artifact);
    prior = stored === null ? undefined : { ...stored, sourceOperationId: id };
    return {
      payload,
      stored,
      plan: plan!,
      analysisCalls: h.analysis.slice(before.a),
      backgroundCalls: h.background.slice(before.b),
    };
  }
  return { ask };
}

const T1 =
  'What are the latest verified developments in eastern DR Congo over the last seven days? Give the original sources, publication dates, and distinguish confirmed facts from allegations.';
const T2 =
  'Based on those reports, what can we reasonably conclude about the situation for civilians, and what remains uncertain?';

/* The pre-repair (fc00e98) background-call shapes, captured from this harness before the change
   (JSON form: the usage-sink callback is not part of the prompt). */
const MEMORY_RULE =
  '1. MEMORY: if your answer establishes a reusable structure — a conceptual framework, a diagnosis, a comparison, decision criteria, recommendations, a plan or a summary — end your reply with exactly one line: <<<ARTIFACT {"kind": one of CONCEPTUAL_FRAMEWORK | DIAGNOSIS | COMPARISON | DECISION_CRITERIA | RECOMMENDATION | PLAN | SUMMARY, "label": a short name, "components": [up to 8 short component names]} ARTIFACT>>>. The line is removed before the reader sees the answer. Omit it when the answer establishes no such structure.';
const BASELINE_SOURCED_T2_CALL = {
  question: T2,
  responseLanguage: 'en',
  maxModelAttempts: 1,
  priorQuestion: T1,
  jobRules: `R4 JOB RULES (trusted)\n${MEMORY_RULE} For this answer the kind is most likely RECOMMENDATION.`,
};
const NON_FINANCIAL = 'Explain the difference between weather and climate, using a simple example.';
const BASELINE_NON_FINANCIAL_CALL = {
  question: NON_FINANCIAL,
  responseLanguage: 'en',
  maxModelAttempts: 1,
  jobRules: `R4 JOB RULES (trusted)\n${MEMORY_RULE}`,
};
const APR_Q =
  'Explain the difference between APR and the nominal interest rate on a loan, using a simple numerical example. State your assumptions.';

type Turn = Awaited<ReturnType<ReturnType<typeof conversation>['ask']>>;

describe('ASK EVIDENCE CONTINUITY R1 — the turn record says truthfully that no evidence was admitted', () => {
  it('rate-limited search (op ce732c69): search incomplete + no-evidence marker, no evidence refs', async () => {
    const t1 = await conversation().ask(T1, 'RATE_LIMITED');
    expect(t1.payload.answer).toMatchObject({ state: 'INSUFFICIENT' });
    expect(t1.stored).toMatchObject({
      kind: 'SOURCED_REPORT',
      provenance: 'SOURCED_REPORTING',
      components: [
        'The search did not complete (a news source was unavailable or rate-limited).',
        'No verified reports were obtained for this question.',
      ],
      currentFindings: 'NONE',
      noEvidenceReason: 'SEARCH_INCOMPLETE',
    });
    expect(t1.stored?.evidenceRefs).toBeUndefined();
    expect(t1.stored?.evidenceUrls).toBeUndefined();
    expect(JSON.stringify(t1.stored)).not.toMatch(/No qualifying reporting was found/);
  });

  it('a search that completed and matched nothing: "found no qualifying reporting"', async () => {
    const t1 = await conversation().ask(T1, 'NO_MATCH');
    expect(t1.stored).toMatchObject({
      kind: 'SOURCED_REPORT',
      components: ['No qualifying reporting was found for this question at the time it was asked.'],
      currentFindings: 'NONE',
      noEvidenceReason: 'NO_QUALIFYING_REPORTING',
    });
    expect(t1.stored?.evidenceRefs).toBeUndefined();
  });

  it('a sourced turn is recorded exactly as before (points + evidence refs, no marker)', async () => {
    const t1 = await conversation().ask(T1, 'SOURCED');
    expect(t1.stored).toEqual({
      kind: 'SOURCED_REPORT',
      label: T1.slice(0, 80),
      components: ['M23 holds Goma; aid access curtailed', 'Aid agencies report restricted access'],
      provenance: 'SOURCED_REPORTING',
      citable: false,
      scope: expect.objectContaining({ question: T1, countries: ['COD'] }),
      evidenceRefs: ['art-1'],
      evidenceUrls: ['https://example.org/a1'],
    });
  });
});

describe('ASK EVIDENCE CONTINUITY R1 — the Production sequence (thread 9079dd09)', () => {
  function expectUnverifiedFollowUp(t2: Turn, question: string, gap: 'UNAVAILABLE' | 'NO_EVIDENCE') {
    /* no extra search: the follow-up is not searched as a news topic */
    expect(t2.analysisCalls).toHaveLength(0);
    expect(t2.payload.answer).toEqual({
      state: 'REFERENCE_BACKGROUND',
      basis: `PARTIAL_CURRENT_${gap}`,
      missingRoles: ['REPORTING'],
    });
    expect(t2.payload.guidance).toEqual({
      kind: 'MIXED_REFERENCE_CURRENT',
      currentEvidenceNeeded: [question],
      currentPart: gap,
    });
    /* never presented as sourced: no analysis; the answer is the labelled background */
    expect(t2.payload.analysis).toBeNull();
    expect(t2.payload.background).not.toBeNull();
    expect(t2.backgroundCalls).toHaveLength(1);
    const call = t2.backgroundCalls[0];
    expect(call.jobRules).toContain('NO VERIFIED EARLIER REPORTS');
    expect(call.jobRules).toContain('Do not attribute any conclusion');
    expect(call.jobRules).toMatch(
      gap === 'UNAVAILABLE'
        ? /earlier search did not complete/
        : /earlier search completed and found no qualifying reporting/,
    );
    expect(call.priorWork).toContain('returned NO verified reports');
    expect(call.priorWork).not.toContain('summarised sourced reporting');
    /* the follow-up's own record keeps the no-evidence marker, so a later turn reads it too */
    expect(t2.stored).toMatchObject({ currentFindings: 'NONE' });
    expect(t2.stored?.evidenceRefs).toBeUndefined();
  }

  it('turn 1 rate-limited → turn 2 "Based on those reports…" names the unverified part (UNAVAILABLE)', async () => {
    const c = conversation();
    await c.ask(T1, 'RATE_LIMITED');
    const t2 = await c.ask(T2, 'SOURCED');
    expectUnverifiedFollowUp(t2, T2, 'UNAVAILABLE');
    expect(t2.stored).toMatchObject({ noEvidenceReason: 'SEARCH_INCOMPLETE' });
  });

  it('a REOPENED conversation (the earlier record arrives as priorArtifact only) behaves the same', async () => {
    const c = conversation();
    await c.ask(T1, 'RATE_LIMITED');
    const t2 = await c.ask(T2, 'SOURCED', { reopened: true });
    expectUnverifiedFollowUp(t2, T2, 'UNAVAILABLE');
  });

  it('a completed search that found nothing → NO_EVIDENCE', async () => {
    const c = conversation();
    await c.ask(T1, 'NO_MATCH');
    const t2 = await c.ask(T2, 'SOURCED');
    expectUnverifiedFollowUp(t2, T2, 'NO_EVIDENCE');
    expect(t2.stored).toMatchObject({ noEvidenceReason: 'NO_QUALIFYING_REPORTING' });
  });

  it('a third turn on the same chain still reads "no verified reports" (the marker carries)', async () => {
    const c = conversation();
    await c.ask(T1, 'RATE_LIMITED');
    await c.ask(T2, 'SOURCED');
    const q3 = 'Given those findings, what should aid agencies prioritise?';
    const t3 = await c.ask(q3, 'SOURCED');
    expect(t3.analysisCalls).toHaveLength(0);
    expect(t3.payload.guidance).toMatchObject({
      currentPart: 'UNAVAILABLE',
      currentEvidenceNeeded: [q3],
    });
    expect(t3.backgroundCalls[0]?.jobRules).toContain('NO VERIFIED EARLIER REPORTS');
  });

  it('PL: "Na podstawie tych raportów…" after a rate-limited search is not searched as news', async () => {
    const c = conversation('pl');
    const t1 = await c.ask('Co się dzieje we wschodnim Kongu?', 'RATE_LIMITED');
    expect(t1.stored).toMatchObject({ noEvidenceReason: 'SEARCH_INCOMPLETE' });
    const q = 'Na podstawie tych raportów, co możemy wywnioskować o sytuacji cywilów?';
    const t2 = await c.ask(q, 'SOURCED');
    expectUnverifiedFollowUp(t2, q, 'UNAVAILABLE');
    expect(t2.backgroundCalls[0].question).toBe(q);
  });

  it('after a GENUINELY SOURCED answer the follow-up is answered FROM those reports (live op 744166f3)', async () => {
    /* ASK REASONING LIVE DEFECTS R1 — at fc00e98 / 537a062 this call carried no earlier work at all
       (BASELINE_SOURCED_T2_CALL) and the Nairobi follow-up ignored the two reports it rested on */
    const c = conversation('en', (id) => ({ id, sourceId: 'example' }));
    await c.ask(T1, 'SOURCED');
    const t2 = await c.ask(T2, 'SOURCED');
    expect(t2.analysisCalls).toHaveLength(0);
    expect(t2.backgroundCalls).toHaveLength(1);
    const { priorWork, ...rest } = JSON.parse(JSON.stringify(t2.backgroundCalls[0]));
    expect(priorWork).toContain('summarised sourced reporting');
    expect(priorWork).toContain('Aid agencies report restricted access');
    expect(priorWork).not.toContain('NO verified reports');
    expect(rest.jobRules).not.toContain('NO VERIFIED EARLIER REPORTS');
    expect(rest.question).toBe(BASELINE_SOURCED_T2_CALL.question);
    expect(t2.payload.answer).toEqual({
      state: 'REFERENCE_BACKGROUND',
      basis: 'PLAN_NO_REQUIRED_EVIDENCE',
      missingRoles: [],
    });
    expect(t2.payload.guidance).toEqual({ kind: 'ADVISORY', currentEvidenceNeeded: [] });
  });

  it('a non-dependent follow-up ("And what about Rwanda?") is unaffected', async () => {
    const c = conversation();
    await c.ask(T1, 'RATE_LIMITED');
    const t2 = await c.ask('And what about Rwanda?', 'RATE_LIMITED');
    /* as at fc00e98: searched as its own question, honest INSUFFICIENT, no background call */
    expect(t2.analysisCalls).toHaveLength(1);
    expect(t2.backgroundCalls).toHaveLength(0);
    expect(t2.payload.answer).toEqual({
      state: 'INSUFFICIENT',
      basis: 'NO_ANSWER_PRODUCED',
      missingRoles: ['REPORTING'],
    });
    expect(t2.payload.guidance ?? null).toBeNull();
  });
});

describe('ASK FINANCE INTEGRITY R1 — APR explanation (op b3924ff0)', () => {
  it('the measured question receives the assumption / definitive-vs-illustrative rules', async () => {
    const t = await conversation().ask(APR_Q, 'SOURCED');
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(1);
    const rules = t.backgroundCalls[0].jobRules ?? '';
    expect(rules).toContain('FINANCIAL RATE CALCULATION');
    expect(rules).toMatch(/payment timing/);
    expect(rules).toMatch(/one repayment at the end of the term, or instalments/);
    expect(rules).toMatch(
      /deducted from the amount the borrower receives, paid separately up front, or financed/,
    );
    expect(rules).toMatch(/compounding/);
    expect(rules).toMatch(/Never present the simple cost percentage as the APR/);
    expect(rules).toMatch(/definitive only when it is computed from fully stated cash flows/);
    expect(rules).toMatch(/illustration of the method/);
    expect(rules).toContain('APR = 1,050 ÷ 950 − 1 = 10.53%');
    /* the earlier job rules are kept; the finance rule is appended */
    expect(rules.startsWith(`R4 JOB RULES (trusted)\n${MEMORY_RULE}`)).toBe(true);
  });


  /* ASK REASONING LIVE DEFECTS R1 — the live Alpha sequence (thread e6803a77) through the executor */
  const C2 =
    'I receive $950 today and repay $1,050 in a single payment after exactly one year, with no other fees. What is the effective annual rate?';
  const C3 = 'And if I repay the $1,050 in 12 equal monthly instalments instead, is the rate still the same?';

  it('op 1f437e26 (C2): solved deterministically to 10.5263 % — no news search, no model call', async () => {
    const c = conversation();
    await c.ask(APR_Q, 'SOURCED');
    const t = await c.ask(C2, 'RATE_LIMITED');
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(0);
    expect(t.payload.answer).toEqual({ state: 'COMPUTED_RESULT', basis: 'DETERMINISTIC_COMPUTATION', missingRoles: [] });
    expect(t.payload.computation.result).toEqual({ name: 'effective annual rate', value: 10.5263, unit: '%' });
    /* the live answer: an unrelated 5 %-compounded-quarterly example (5.09 %) in raw LaTeX */
    expect(JSON.stringify(t.payload)).not.toMatch(/5\.09|\\\\frac|\\\\\[/);
  });

  it('op 63644aa1 (C3): the instalment follow-up is completed from C2 and solved — not news', async () => {
    const c = conversation();
    await c.ask(APR_Q, 'SOURCED');
    await c.ask(C2, 'RATE_LIMITED');
    const t = await c.ask(C3, 'RATE_LIMITED');
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(0);
    expect(t.payload.answer.state).toBe('COMPUTED_RESULT');
    const steps = Object.fromEntries(t.payload.computation.steps.map((s: { label: string; value: number }) => [s.label, s.value]));
    expect(steps['Each monthly payment']).toBe(87.5);
    expect(steps['Rate per month (r)']).toBeCloseTo(1.5744, 4);
    expect(steps['Nominal annual rate (APR)']).toBeCloseTo(18.8925, 4);
    expect(t.payload.computation.result.value).toBeCloseTo(20.6173, 4);
  });

  it('C3 asked with no earlier loan is NOT computed (nothing assumed) and routes as before', async () => {
    const t = await conversation().ask(C3, 'RATE_LIMITED');
    expect(t.payload.answer.state).not.toBe('COMPUTED_RESULT');
  });

  it('a non-financial explanation sends a byte-identical call (as fc00e98)', async () => {
    const t = await conversation().ask(NON_FINANCIAL, 'SOURCED');
    expect(JSON.parse(JSON.stringify(t.backgroundCalls))).toEqual([BASELINE_NON_FINANCIAL_CALL]);
  });
});


/*
  RIGHTS × CONTINUITY (MASTER CTO rights/reasoning order, Ruling 2) — the combined source: an earlier
  answer's points reach the model again only when its evidence is still obtainable from the store
  (a held source is absent there, so its ref resolves to null); the no-evidence marker carries no
  source content, so it still reaches the model whatever the store says.
*/
describe('ASK EVIDENCE CONTINUITY R1 × RIGHTS CONTAINMENT R1.1 — the combined source', () => {
  const Q3 = 'Given those findings, what should aid agencies prioritise?';
  const REUSE_Q = 'Summarise your previous answer in three bullet points.';
  const providerRow = (id: string): StoredRow => ({ id, sourceId: 'example' });
  const heldRow = (): StoredRow => null;

  it.each([
    ['still obtainable (provider path)', providerRow],
    ['now held (absent from the store)', heldRow],
  ])('earlier SOURCED answer whose evidence is %s: no search, no held content to the model', async (_l, store) => {
    const c = conversation('en', store);
    await c.ask(T1, 'SOURCED');
    const t2 = await c.ask(T2, 'SOURCED');
    expect(t2.analysisCalls).toHaveLength(0);
    for (const call of t2.backgroundCalls) expect(JSON.stringify(call)).not.toContain('NO VERIFIED EARLIER REPORTS');
    if (store === heldRow) for (const call of t2.backgroundCalls) expect(call.priorWork).toBeUndefined();
  });

  it('a held earlier answer is never handed to the model, even when the turn reuses earlier work', async () => {
    const followUp = async (store: (id: string) => StoredRow) => {
      const c = conversation('en', store);
      await c.ask(T1, 'SOURCED');
      return c.ask(REUSE_Q, 'SOURCED');
    };
    /* positive control: with its evidence obtainable, this follow-up does reuse the earlier points */
    const reused = await followUp(providerRow);
    expect(reused.analysisCalls).toHaveLength(0);
    expect(reused.backgroundCalls[0].priorWork).toContain('Aid agencies report restricted access');
    /* ASK REASONING LIVE DEFECTS R1 (live op fb8a9b27) — with its sources withheld, the earlier answer
       cannot be summarised: answered with ZERO model calls as withheld, never an invented summary */
    const held = await followUp(heldRow);
    expect(held.analysisCalls).toHaveLength(0);
    expect(held.backgroundCalls).toHaveLength(0);
    expect(held.payload.answer).toEqual({ state: 'INSUFFICIENT', basis: 'WITHHELD_SOURCE_RIGHTS', missingRoles: [] });
    expect(held.payload.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 0 });
    expect(held.payload.background ?? null).toBeNull();
    expect(JSON.stringify(held.payload)).not.toContain('Aid agencies report restricted access');
    /* nothing of the held answer is copied into this turn's own record */
    expect(held.stored?.evidenceRefs ?? []).toEqual([]);
  });

  it('"Based on those reports…" after a now-held SOURCED answer: withheld, zero model calls', async () => {
    const c = conversation('en', heldRow);
    await c.ask(T1, 'SOURCED');
    const t2 = await c.ask(T2, 'SOURCED');
    expect(t2.analysisCalls).toHaveLength(0);
    expect(t2.backgroundCalls).toHaveLength(0);
    expect(t2.payload.answer.basis).toBe('WITHHELD_SOURCE_RIGHTS');
    expect(JSON.stringify(t2.payload)).not.toContain('Aid agencies report restricted access');
  });

  it('"Summarise your previous answer" after a turn that produced NO answer says so (live op fb8a9b27)', async () => {
    /* the live thread's latest turn (seq 3) produced nothing; its record holds no findings */
    const c = conversation('en', heldRow);
    await c.ask(T1, 'NO_MATCH');
    const t = await c.ask(REUSE_Q, 'SOURCED');
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.backgroundCalls[0].priorWork).toContain('returned NO verified reports');
    expect(t.backgroundCalls[0].jobRules).toContain('NO VERIFIED EARLIER REPORTS');
  });

  it('the same follow-up words after DIFFERENT earlier no-evidence turns are different plans (live ops f34b3dec, 54cd45ec)', async () => {
    /* A6 "Based on those reports…" after the Kibirizi flood search replayed A2's DR Congo answer
       through the same execution key. The earlier record is now part of the plan identity. */
    const plans: string[] = [];
    for (const first of [T1, 'What are the latest verified reports about flooding in Kibirizi village, South Kivu, over the last seven days? Give the original sources.']) {
      const c = conversation();
      await c.ask(first, 'NO_MATCH');
      const t = await c.ask(T2, 'SOURCED');
      plans.push(String(t.plan.executionKey));
    }
    expect(plans[0]).not.toBe(plans[1]);
  });

  it('…and they differ even when the earlier record is the ONLY thing that differs (reopened, as live A4 f34b3dec)', async () => {
    /* The test above is separated by the previous QUESTION already. Live, A4 / A6 shared A2's key, so
       the previous question did not separate them there: with the record as the only difference
       (a reopened thread carries the record, not the previous question), the record must decide. */
    const plans: string[] = [];
    for (const first of [T1, 'What are the latest verified reports about flooding in Kibirizi village, South Kivu, over the last seven days? Give the original sources.']) {
      const c = conversation();
      await c.ask(first, 'NO_MATCH');
      const t = await c.ask(T2, 'SOURCED', { reopened: true });
      plans.push(String(t.plan.executionKey));
    }
    expect(plans[0]).not.toBe(plans[1]);
  });

  it('a follow-up that does not rest on the earlier answer is searched as its own question either way', async () => {
    const c = conversation('en', heldRow);
    await c.ask(T1, 'SOURCED');
    const t = await c.ask(Q3, 'SOURCED');
    expect(t.analysisCalls).toHaveLength(1);
    expect(t.backgroundCalls).toHaveLength(0);
  });

  it('rate-limited earlier turn: the marker (no source content) still reaches the model with the store wired', async () => {
    const c = conversation('en', heldRow);
    await c.ask(T1, 'RATE_LIMITED');
    const t2 = await c.ask(T2, 'SOURCED');
    expectUnverifiedFollowUpShape(t2);
  });

  function expectUnverifiedFollowUpShape(t: Turn) {
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.payload.guidance).toMatchObject({ currentPart: 'UNAVAILABLE', currentEvidenceNeeded: [T2] });
    expect(t.backgroundCalls[0].priorWork).toContain('returned NO verified reports');
    expect(t.backgroundCalls[0].jobRules).toContain('NO VERIFIED EARLIER REPORTS');
  }
});
