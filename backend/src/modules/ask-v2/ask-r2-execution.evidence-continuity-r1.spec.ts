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

function harness(mode: () => Mode) {
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
  );
  return { adapter, analysis, background };
}

function conversation(language: 'en' | 'pl' = 'en') {
  let mode: Mode = 'SOURCED';
  const h = harness(() => mode);
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
    const payload = await askRequestContext.run(
      {
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        ...(priorQuestion === undefined ? {} : { priorQuestion }),
      } as never,
      async () => {
        const plan = await h.adapter.prepare(request);
        return JSON.parse((await h.adapter.execute(request, plan, id)).payloadJson);
      },
    );
    earlier.push(question);
    const stored = validateStoredArtifact(payload.artifact);
    prior = stored === null ? undefined : { ...stored, sourceOperationId: id };
    return {
      payload,
      stored,
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

  it('after a GENUINELY SOURCED answer the follow-up is unchanged (same call shape as fc00e98)', async () => {
    const c = conversation();
    await c.ask(T1, 'SOURCED');
    const t2 = await c.ask(T2, 'SOURCED');
    expect(t2.analysisCalls).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(t2.backgroundCalls))).toEqual([BASELINE_SOURCED_T2_CALL]);
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

  it('a non-financial explanation sends a byte-identical call (as fc00e98)', async () => {
    const t = await conversation().ask(NON_FINANCIAL, 'SOURCED');
    expect(JSON.parse(JSON.stringify(t.backgroundCalls))).toEqual([BASELINE_NON_FINANCIAL_CALL]);
  });
});

