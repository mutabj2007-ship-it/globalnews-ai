import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { conversationOf, priorArtifactIn } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import { validateStoredArtifact, type PriorArtifact } from './conversation/conversation-artifact';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 ALPHA SMOKE REPAIR R1 — the exact failed Alpha smoke on 790e088 (thread 6948a8a5 + e8832d58)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ops 572bd791 · e5e381e4 · efe6d76d · 3f51b793 · 591f5659 · b629adb1 · 08b5c4fe, replayed through
 * the REAL executor with fake providers. The earlier answer is threaded EXACTLY as the repaired
 * service reads it (priorArtifactIn): the LATEST turn's own record, or nothing (R1-B).
 *
 *   R1-A  "…central bank sets interest rates, and what is the Fed doing this week?" — frozen C cannot
 *         transport "this week" (CAPABILITY_UNAVAILABLE / CONSTRAINT_UNTRANSPORTABLE): the explanatory
 *         part is answered, the current part is named as not verified, no retrieval, nothing broadened.
 *   R1-B  "that / it" follows the latest turn: never jumps back over it to the Chile answer.
 */
type Call = unknown[];

function harness() {
  const analysis: Call[] = [];
  const background: Array<{ question: string; priorWork?: string }> = [];
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        analysis.push(args);
        const n = analysis.length;
        return {
          analysis: {
            headline: `Sourced headline ${n}`,
            summary: 'Summary.',
            keyFacts: [{ claim: `Chile sourced claim ${n}`, sourceArticleIds: [`art-${n}`] }],
          } as never,
          articles: [{ id: `art-${n}` } as never],
          retrievalContext: {} as never,
        } satisfies Partial<AnalysisApiResponse>;
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    {
      id: 'openai',
      displayName: 'OpenAI',
      isMock: false,
      answerBackground: jest.fn(async (input: { question: string; priorWork?: string }) => {
        background.push(input);
        return { text: `Reasoned: ${input.question.slice(0, 60)}.\n\nSecond paragraph.` };
      }),
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

interface Payload {
  answer: { state: string; basis?: string };
  guidance?: {
    kind: string;
    currentPart?: string;
    stablePart?: string;
    currentEvidenceNeeded?: string[];
  };
  background: { text: string } | null;
  artifact?: unknown;
  diagnostics: { job: { job: string | null; discourseReference: string } };
}

/** One conversation, the earlier answer read as the REPAIRED service reads it: latest turn only. */
function conversation() {
  const h = harness();
  const earlier: string[] = [];
  let prior: PriorArtifact | undefined;
  let op = 0;
  async function ask(question: string) {
    const conversational = readConversationalTurn(
      question,
      'en',
      [...earlier].reverse().map((q) => ({ question: q, language: 'en' as const })),
    );
    const composed = conversational?.composition ?? null;
    const request = {
      question: composed?.effectiveQuestion ?? question,
      language: 'en',
      intent: 'ask',
      ...conversationOf(conversational),
      ...(prior === undefined ? {} : { priorArtifact: prior }),
    } as AskRequest;
    const before = { a: h.analysis.length, b: h.background.length };
    const priorQuestion = earlier[earlier.length - 1];
    const id = `op-${++op}`;
    const payload = await askRequestContext.run(
      {
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        ...(priorQuestion === undefined ? {} : { priorQuestion }),
      } as never,
      async () => {
        const plan = await h.adapter.prepare(request);
        return JSON.parse((await h.adapter.execute(request, plan, id)).payloadJson) as Payload;
      },
    );
    earlier.push(question);
    const stored = validateStoredArtifact(payload.artifact);
    /* R1-B: the latest turn's own record, or NOTHING — never an older one */
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

const ALPHA = [
  "Explain how a prime moment in someone's career can lead them to lose everything they had.",
  'What is happening with inflation in Chile right now?',
  'Explain how a central bank sets interest rates, and what is the Fed doing this week?',
  'Why did you say that?',
  'Is it still true now?',
  'Show me the official evidence.',
];

describe('R1-A — the live mixed question no longer collapses (op efe6d76d)', () => {
  it('the explanatory part is answered; the "this week" part is named as not verified; no retrieval', async () => {
    const t = await conversation().ask(ALPHA[2]);
    expect(t.payload.answer.state).not.toBe('CAPABILITY_UNAVAILABLE');
    expect(t.analysisCalls).toHaveLength(
      0,
    ); /* nothing about "this week" is retrieved or invented */
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.backgroundCalls[0].question).toBe('Explain how a central bank sets interest rates');
    /* the existing partial-mixed contract (R4 CLOSEOUT §7), rendered by the frontend as the stable
       answer plus "current part not verified" */
    expect(t.payload.answer).toMatchObject({
      state: 'REFERENCE_BACKGROUND',
      basis: 'PARTIAL_CURRENT_UNAVAILABLE',
    });
    expect(t.payload.guidance).toMatchObject({
      kind: 'MIXED_REFERENCE_CURRENT',
      currentPart: 'UNAVAILABLE',
      currentEvidenceNeeded: ['what is the Fed doing this week?'],
    });
    expect(t.payload.guidance?.currentPart).not.toBe('SOURCED');
    /* the temporal constraint is not silently dropped: the unverified current part is named */
    expect(JSON.stringify(t.payload.guidance)).toContain('this week');
    /* and it is referable work for the next turn */
    expect(t.stored?.kind).toBe('REASONED_ANSWER');
  });
});

describe('R1-B + R1-A — the exact seven-turn Alpha smoke, replayed', () => {
  it('turns 4–6 follow turn 3, never the Chile answer', async () => {
    const c = conversation();
    const t1 = await c.ask(ALPHA[0]);
    expect(t1.analysisCalls).toHaveLength(0);

    const t2 = await c.ask(ALPHA[1]);
    expect(t2.stored?.scope?.countries).toContain('CHL');

    const t3 = await c.ask(ALPHA[2]);
    expect(t3.payload.answer.state).not.toBe('CAPABILITY_UNAVAILABLE');
    expect(t3.stored?.kind).toBe('REASONED_ANSWER');

    /* 4 · "Why did you say that?" binds TURN 3 and explains it: no Chile, no news */
    const t4 = await c.ask(ALPHA[3]);
    expect(t4.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
    expect(t4.analysisCalls).toHaveLength(0);
    expect(t4.backgroundCalls).toHaveLength(1);
    expect(t4.backgroundCalls[0].priorWork ?? '').not.toMatch(/Chile/);
    expect(t4.backgroundCalls[0].priorWork ?? '').toMatch(/central bank|interest rates/i);
    expect(JSON.stringify(t4.stored?.scope)).not.toContain('CHL');

    /* 5 · "Is it still true now?" stays on that chain — never Chile's question or scope */
    const t5 = await c.ask(ALPHA[4]);
    expect(t5.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
    for (const call of t5.analysisCalls) expect(String(call[0])).not.toMatch(/Chile/);
    for (const call of t5.backgroundCalls) expect(call.priorWork ?? '').not.toMatch(/Chile/);
    expect(JSON.stringify(t5.stored?.scope ?? {})).not.toContain('CHL');

    /* 6 · official evidence inherits only that chain's scope: no Chile, no news search */
    const t6 = await c.ask(ALPHA[5]);
    expect(t6.analysisCalls.filter((call) => /Chile/.test(String(call[0])))).toEqual([]);
    expect(JSON.stringify(t6.payload)).not.toContain('CHL');
  });

  it('turn 7: a new conversation, "What about it?" clarifies with zero search', async () => {
    const t = await conversation().ask('What about it?');
    expect(t.payload.answer).toMatchObject({ state: 'CLARIFICATION_REQUIRED' });
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(0);
  });
});

describe('R1-B — never skip the latest turn for "that / it" (negative cases)', () => {
  /* a turn that answered nothing: an official-unavailable status ask leaves no answer record */
  it.each(['Why did you say that?', 'Is that still true?', 'Is it still true now?'])(
    'latest turn answered nothing → "%s" → clarification, never the older Chile answer',
    async (q) => {
      const c = conversation();
      await c.ask(ALPHA[1]); /* Chile, recorded */
      const blank = await c.ask('What is the official NBP reference rate today?');
      expect(blank.stored).toBeNull(); /* answered nothing: nothing referable */
      const t = await c.ask(q);
      expect(t.payload.answer).toMatchObject({
        state: 'CLARIFICATION_REQUIRED',
        basis: 'PRIOR_REFERENCE_UNRESOLVED',
      });
      expect(t.analysisCalls).toHaveLength(0);
      expect(t.backgroundCalls).toHaveLength(0);
    },
  );

  it('priorArtifactIn reads ONLY the latest turn: a latest turn without a record yields nothing', async () => {
    const chile = {
      kind: 'SOURCED_REPORT',
      label: 'Chile',
      components: ['Chile sourced claim'],
      provenance: 'SOURCED_REPORTING',
      citable: false,
      scope: {
        question: 'Chile?',
        job: 'CURRENT_REPORTING',
        countries: ['CHL'],
        relation: null,
        freshness: 'CURRENT',
      },
      evidenceRefs: ['a1'],
    };
    const turns = [
      {
        operationId: 'op-3',
        operation: { storedResult: { payload: { answer: { state: 'CAPABILITY_UNAVAILABLE' } } } },
      },
      { operationId: 'op-2', operation: { storedResult: { payload: { artifact: chile } } } },
    ];
    const findMany = jest.fn(async (args: { take: number }) => turns.slice(0, args.take));
    const got = await priorArtifactIn({ askTurn: { findMany } } as never, 'thread-1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1, orderBy: { sequence: 'desc' } }),
    );
    expect(got).toBeUndefined();
  });

  it('a valid carried chain is kept: the latest turn’s own record (carrying its referent) binds', async () => {
    const carried = {
      kind: 'SOURCED_REPORT',
      label: 'carried',
      components: ['claim'],
      provenance: 'SOURCED_REPORTING',
      citable: false,
      scope: {
        question: 'Q?',
        job: 'EXPLANATION',
        countries: ['KEN'],
        relation: null,
        freshness: 'NONE',
      },
      evidenceRefs: ['a1'],
    };
    const findMany = jest.fn(async () => [
      { operationId: 'op-9', operation: { storedResult: { payload: { artifact: carried } } } },
    ]);
    const got = await priorArtifactIn({ askTurn: { findMany } } as never, 'thread-1');
    expect(got?.sourceOperationId).toBe('op-9');
    expect(got?.scope?.countries).toEqual(['KEN']);
  });
});
