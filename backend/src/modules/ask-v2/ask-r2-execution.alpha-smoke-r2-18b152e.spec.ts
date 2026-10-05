import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { conversationPlaceOf } from './conversation/conversation-place';
import { conversationGeography } from './context/resolved-ask-context';
import { isSubjectFollowUp } from '../analysis/anchor/conversation-subject.util';
import { isAnaphoricFollowUp } from '../analysis/anchor/event-anchor.util';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { conversationOf } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import { validateStoredArtifact, type PriorArtifact } from './conversation/conversation-artifact';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 ALPHA SMOKE R2 — the repeat Alpha smoke on 18b152e (ops 960094f8 … 670a2d7e)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Replayed through the REAL executor with fake providers, now with BOTH conversation carries the
 * service applies before execution: the answer record (priorArtifactIn, R1-B) AND the
 * conversation place (conversationPlaceOf, exactly as quote() gates it). R1 drove the record only,
 * so op a812ea97 ("Show me the official evidence." → Scope: Chile) was not reproduced.
 *
 *   A  the place follows the latest answer record: one country → it; none → none (never an older
 *      reader question); several → no single place.
 *   B  "Is it still true now?" about a REASONING answer re-examines the reasoning and says the
 *      current part was not verified (no news retrieval for the word "now").
 */
type Call = unknown[];

function harness() {
  const analysis: Call[] = [];
  const background: Array<{ question: string; priorWork?: string; jobRules?: string }> = [];
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
          /* as the analysis service stamps it: a supplied place context was applied */
          retrievalContext: (args[5] == null ? {} : { geographyContextUsed: true }) as never,
        } satisfies Partial<AnalysisApiResponse>;
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
  diagnostics: {
    job: {
      job: string | null;
      discourseReference: string;
      artifactUsed: { sourceOperationId: string | null } | null;
    };
  };
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
    /* the service's place carry (ask-v2.service.ts conversationPlace), with the same gates */
    const place =
      composed !== null || isSubjectFollowUp(question) || isAnaphoricFollowUp(question)
        ? null
        : conversationPlaceOf(
            question,
            'en',
            [...earlier].reverse().map((q) => ({ question: q, language: 'en' })),
            prior,
          );
    const context = place === null ? undefined : conversationGeography(place);
    const request = {
      ...(context === undefined ? {} : { context }),
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
    /* R1-B: the latest turn's own record; a turn that answered nothing leaves NOTHING bindable
       (the executor gives every answered turn a record, so this matches priorArtifactIn) */
    prior = stored === null ? undefined : { ...stored, sourceOperationId: id };
    return {
      place,
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

describe('R4 ALPHA SMOKE R2 — the exact seven-turn Alpha replay, record AND place carries', () => {
  it('turns 3–6 stay on the central-bank / Fed chain; turn 6 carries no country', async () => {
    const c = conversation();
    const t1 = await c.ask(ALPHA[0]);
    expect(t1.analysisCalls).toHaveLength(0);

    const t2 = await c.ask(ALPHA[1]);
    expect(t2.stored?.scope?.countries).toEqual(['CHL']);

    /* 1 · turn 3 → the central-bank / Fed chain, no Chile */
    const t3 = await c.ask(ALPHA[2]);
    expect(t3.place).toBeNull();
    expect(t3.payload.answer).toMatchObject({ basis: 'PARTIAL_CURRENT_UNAVAILABLE' });
    expect(t3.stored?.scope?.countries).toEqual([]);
    expect(JSON.stringify(t3.payload)).not.toContain('CHL');

    /* 2 · turn 4 binds turn 3 */
    const t4 = await c.ask(ALPHA[3]);
    expect(t4.payload.diagnostics.job.artifactUsed?.sourceOperationId).toBe('op-3');
    expect(t4.analysisCalls).toHaveLength(0);
    expect(JSON.stringify(t4.payload)).not.toContain('CHL');

    /* 3 · turn 5 binds the same chain, re-examines the reasoning, and says the current part was
       not verified — no news retrieval for the word "now" */
    const t5 = await c.ask(ALPHA[4]);
    expect(t5.payload.diagnostics.job.artifactUsed?.sourceOperationId).toBe('op-4');
    expect(t5.stored?.scope?.question).toBe(ALPHA[2]);
    expect(t5.analysisCalls).toHaveLength(0);
    expect(t5.backgroundCalls).toHaveLength(1);
    expect(t5.backgroundCalls[0].priorWork ?? '').toMatch(/central bank|interest rates/i);
    expect(t5.backgroundCalls[0].jobRules ?? '').toContain('No current evidence was checked');
    expect(t5.payload.answer).toMatchObject({
      state: 'REFERENCE_BACKGROUND',
      basis: 'PARTIAL_CURRENT_UNAVAILABLE',
      missingRoles: ['REPORTING'],
    });
    expect(t5.payload.guidance).toMatchObject({
      kind: 'MIXED_REFERENCE_CURRENT',
      currentPart: 'UNAVAILABLE',
      currentEvidenceNeeded: [ALPHA[4]],
    });
    expect(JSON.stringify(t5.payload)).not.toContain('CHL');

    /* 4 · turn 6 → the latest record (turn 5) carries no country: no place, no walk back to
       Chile, no Chile scope anywhere in the answer, no Chile retrieval */
    const t6 = await c.ask(ALPHA[5]);
    expect(t6.place).toBeNull();
    expect(JSON.stringify(t6.payload)).not.toContain('CHL');
    expect(JSON.stringify(t6.payload)).not.toMatch(/Chile/);
    for (const call of t6.analysisCalls) expect(JSON.stringify(call)).not.toMatch(/Chile|CHL/);
  });

  /* 5 · turn 7 — a NEW conversation: clarification, zero retrieval */
  it('turn 7: "What about it?" in a new conversation clarifies with zero retrieval', async () => {
    const t = await conversation().ask('What about it?');
    expect(t.place).toBeNull();
    expect(t.payload.answer).toMatchObject({ state: 'CLARIFICATION_REQUIRED' });
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(0);
  });
});

describe('R4 ALPHA SMOKE R2 — positive controls: legitimate place continuation is kept', () => {
  it('same-country continuation: the record that carries Madagascar keeps carrying it', async () => {
    const c = conversation();
    const t1 = await c.ask('What is going on in Madagascar?');
    expect(t1.stored?.scope?.countries).toEqual(['MDG']);
    const t2 = await c.ask('And the economy?');
    expect(t2.place).toBe('MDG');
    expect(t2.stored?.scope?.countries).toEqual(['MDG']);
    /* a composed continuation keeps Madagascar through the conversation state (unchanged) */
    const t3 = await c.ask('What about yesterday?');
    expect(String(t3.analysisCalls[0]?.[0])).toMatch(/Madagascar/);
    expect(t3.stored?.scope?.countries).toEqual(['MDG']);
    /* the record-driven place: the latest record carries Madagascar, so the evidence turn does */
    const t4 = await c.ask('Show me the official evidence.');
    expect(t4.place).toBe('MDG');
    expect(JSON.stringify(t4.payload)).not.toContain('CHL');
  });

  it('a record-driven place never skips the latest record for an older one (Chile → Kenya)', async () => {
    const c = conversation();
    await c.ask(ALPHA[1]); /* Chile */
    const k = await c.ask('What is happening in Kenya right now?');
    expect(k.stored?.scope?.countries).toEqual(['KEN']);
    const t = await c.ask('Show me the official evidence.');
    expect(t.place).toBe('KEN');
  });

  it('"Is it still true now?" about a SOURCED answer is re-verified, not disclosed as unverified', async () => {
    const c = conversation();
    await c.ask(ALPHA[1]);
    const t = await c.ask(ALPHA[4]);
    expect(t.analysisCalls.length).toBeGreaterThan(0);
    expect(t.payload.guidance?.currentPart).not.toBe('UNAVAILABLE');
    for (const call of t.backgroundCalls)
      expect(call.jobRules ?? '').not.toContain('RE-EXAMINATION');
  });
});

describe('R4 ALPHA SMOKE R2 — conversationPlaceOf: the latest record decides the place', () => {
  const earlier = [
    { question: 'Why did you say that?', language: 'en' },
    { question: 'What is happening with inflation in Chile right now?', language: 'en' },
  ];
  const rec = (countries: string[]) => ({ scope: { countries } });
  it('a record with no country → no place, never an older question’s country', () => {
    expect(
      conversationPlaceOf('Show me the official evidence.', 'en', earlier, rec([])),
    ).toBeNull();
  });
  it('a record with one country → that country', () => {
    expect(conversationPlaceOf('Show me the official evidence.', 'en', earlier, rec(['KEN']))).toBe(
      'KEN',
    );
  });
  it('a record with several countries → no single place (the relationship travels with the record)', () => {
    expect(
      conversationPlaceOf('Show me the official evidence.', 'en', earlier, rec(['KEN', 'ETH'])),
    ).toBeNull();
  });
  it('a place the reader types still wins over the record', () => {
    expect(conversationPlaceOf('What about Kenya?', 'en', earlier, rec(['CHL']))).toBeNull();
  });
  it('no record → the reader’s own questions are read exactly as before', () => {
    expect(conversationPlaceOf('Show me the official evidence.', 'en', earlier)).toBe('CHL');
  });
});
