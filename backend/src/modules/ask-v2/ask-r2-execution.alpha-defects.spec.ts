import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { conversationOf } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import {
  SERVER_ARTIFACT_KINDS,
  validateStoredArtifact,
  type PriorArtifact,
} from './conversation/conversation-artifact';
import { ANSWER_RECORD_KINDS } from '../ask-router/semantic-ir/prior-claim';
import { executionContractOf } from './execution-contract';
import { routeAskR2 } from '../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import type { SemanticResolution } from '../ask-router/semantic-ir/semantic-interpreter';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 ALPHA DEFECT RULING — REQUIRED REGRESSION PROOF (R-1 … R-5)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The EXACT failed Alpha thread f9f2e430 (ops 30874bf2 · f5bfac83 · 364492e4 · 55b34106 · 2da0209c ·
 * 5ac0e7b0), replayed through the REAL executor with fake providers, the conversation threaded the
 * way AskV2Service threads it: each turn's composed question (readConversationalTurn), the previous
 * USER question in the request context, and the most recent stored answer's memory read back
 * through the stored-artifact validator (validateStoredArtifact — what priorArtifactIn does).
 *
 * Then metamorphic variants, so no assertion can be satisfied by a phrase: other wordings of the
 * same follow-ups, a mixed economy question about another country, a mixed technical / current
 * question, another bilateral pair, Polish, and an interpreter-first (FR / DE / ES / PT / AR) path.
 * No Rwanda, Poland or inflation special case exists in the code under test.
 */

type Call = unknown[];
interface Calls {
  analysis: Call[];
  background: Array<{ question: string; priorWork?: string; [k: string]: unknown }>;
}

function harness() {
  const calls: Calls = { analysis: [], background: [] };
  const analysisService = {
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      calls.analysis.push(args);
      const policy = args[6] as {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      };
      policy?.usageSink?.({ promptTokens: 1200, completionTokens: 300 });
      const n = calls.analysis.length;
      return {
        analysis: {
          headline: `Sourced headline ${n}`,
          summary: 'Summary.',
          keyFacts: [
            { claim: `Sourced claim ${n}a`, sourceArticleIds: [`art-${n}-1`] },
            { claim: `Sourced claim ${n}b`, sourceArticleIds: [`art-${n}-2`] },
          ],
        } as never,
        articles: [{ id: `art-${n}-1` } as never, { id: `art-${n}-2` } as never],
        retrievalContext: {} as never,
      } satisfies Partial<AnalysisApiResponse>;
    }),
  };
  const provider = { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() };
  const backgroundProvider = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    answerBackground: jest.fn(async (input: Calls['background'][number]) => {
      calls.background.push(input);
      (
        input as { usageSink?: (u: { promptTokens: number; completionTokens: number }) => void }
      ).usageSink?.({ promptTokens: 400, completionTokens: 150 });
      return { text: `Reasoned answer.\n\nSecond paragraph about ${input.question.slice(0, 30)}.` };
    }),
  };
  const adapter = new AskR2ExecutionAdapter(
    analysisService as never,
    provider as never,
    backgroundProvider as never,
    {
      config: { outputWeight: 4 },
      reserve: jest.fn(async () => ({
        admitted: true as const,
        reservationId: 'r',
        estimatedUnits: 1,
      })),
      settle: jest.fn(async () => true),
    } as never,
    {
      permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' as const })),
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
  return { adapter, calls };
}

interface Payload {
  answer: { state: string; basis?: string };
  analysis: unknown;
  background: { text: string } | null;
  guidance?: { kind: string; currentPart?: string; stablePart?: string };
  artifact?: unknown;
  diagnostics: { job: { job: string | null; discourseReference: string } };
}

/** One conversation, threaded exactly as AskV2Service threads it. */
function conversation(language: 'en' | 'pl' = 'en') {
  const { adapter, calls } = harness();
  const earlier: string[] = [];
  let prior: PriorArtifact | undefined;
  let op = 0;
  async function ask(question: string) {
    const conversational = readConversationalTurn(
      question,
      language,
      [...earlier].reverse().map((q) => ({ question: q, language })),
    );
    const composed = conversational?.composition ?? null;
    const request: AskRequest = {
      question: composed?.effectiveQuestion ?? question,
      language,
      intent: 'ask',
      ...conversationOf(conversational),
      ...(prior === undefined ? {} : { priorArtifact: prior }),
    } as AskRequest;
    const before = { analysis: calls.analysis.length, background: calls.background.length };
    const priorQuestion = earlier[earlier.length - 1];
    const id = `op-${++op}`;
    const payload = await askRequestContext.run(
      {
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        ...(priorQuestion === undefined ? {} : { priorQuestion }),
      } as never,
      async () => {
        const plan = await adapter.prepare(request);
        return JSON.parse((await adapter.execute(request, plan, id)).payloadJson) as Payload;
      },
    );
    earlier.push(question);
    /* what priorArtifactIn returns for the next turn */
    const stored = validateStoredArtifact(payload.artifact);
    if (stored !== null) prior = { ...stored, sourceOperationId: id };
    return {
      payload,
      analysisCalls: calls.analysis.slice(before.analysis),
      backgroundCalls: calls.background.slice(before.background),
      stored,
    };
  }
  return { ask };
}

const THREAD = [
  'What makes a moment the prime moment to act, and why can acting too early or too late both reduce the chance of success?',
  'What are the most important developments in Poland today?',
  'Explain why inflation can fall while people still feel that prices are high, and tell me what the current situation is in Poland.',
  'What is happening between Rwanda and Tanzania, especially in their political and commercial relationship?',
  'Why did you say that?',
  'Is it still true now?',
];

describe('R4 ALPHA — the exact failed Alpha thread f9f2e430, replayed', () => {
  it('every previously failed transition now passes; every passed one still passes', async () => {
    const c = conversation();

    /* 1 · conceptual — reasoning, no news; the answer registers as referable work (R-3) */
    const t1 = await c.ask(THREAD[0]);
    expect(t1.analysisCalls).toHaveLength(0);
    expect(t1.backgroundCalls).toHaveLength(1);
    expect(t1.stored?.provenance).toBe('MODEL_REASONING');

    /* 2 · current Poland — current reporting; a SOURCED_REPORT with its scope (R-3) */
    const t2 = await c.ask(THREAD[1]);
    expect(t2.analysisCalls).toHaveLength(1);
    expect(t2.stored).toMatchObject({
      kind: 'SOURCED_REPORT',
      provenance: 'SOURCED_REPORTING',
      citable: false,
    });
    expect(t2.stored?.scope?.countries).toContain('POL');
    expect(t2.stored?.evidenceRefs).toEqual(['art-1-1', 'art-1-2']);

    /* 3 · MIXED (op 364492e4) — R-1: retrieval for the CURRENT part, not the raw question, no
       previous-question steering; R-2: the explanatory part answered beside it */
    const t3 = await c.ask(THREAD[2]);
    expect(t3.analysisCalls).toHaveLength(1);
    const query3 = String(t3.analysisCalls[0][0]);
    expect(query3).toContain('tell me what the current situation is in Poland.');
    expect(query3).toContain('Explain why inflation can fall'); /* the sibling clause as context */
    expect(query3).not.toBe(THREAD[2]);
    expect(
      t3.analysisCalls[0][3],
    ).toBeUndefined(); /* no priorQuestion: the IR resolved the subject */
    expect(t3.backgroundCalls).toHaveLength(1);
    expect(t3.backgroundCalls[0].question).toBe(
      'Explain why inflation can fall while people still feel that prices are high',
    );
    expect(t3.payload.background?.text).toContain('\n\n'); /* authored paragraphs kept */
    expect(t3.payload.guidance).toMatchObject({
      kind: 'MIXED_REFERENCE_CURRENT',
      currentPart: 'SOURCED',
      stablePart: 'ANSWERED',
    });

    /* 4 · Rwanda–Tanzania — both sides; the answer's scope keeps both (R-3) */
    const t4 = await c.ask(THREAD[3]);
    expect(t4.analysisCalls).toHaveLength(1);
    const policy4 = t4.analysisCalls[0][6] as { relationship?: { countries: string[] } };
    expect(policy4.relationship?.countries).toEqual(['RWA', 'TZA']);
    expect([...(t4.stored?.scope?.countries ?? [])].sort()).toEqual(['RWA', 'TZA']);

    /* 5 · "Why did you say that?" (op 2da0209c) — the earlier answer, explained: NO news */
    const t5 = await c.ask(THREAD[4]);
    expect(t5.analysisCalls).toHaveLength(0);
    expect(t5.backgroundCalls).toHaveLength(1);
    expect(t5.backgroundCalls[0].priorWork).toContain('points the answer made');
    expect(t5.backgroundCalls[0].priorWork).toContain('Sourced claim 3a'); /* turn 4's claims */
    expect(t5.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');

    /* 6 · "Is it still true now?" (op 5ac0e7b0) — the EARLIER SOURCED claim re-verified in ITS
       scope: retrieval for turn 4's question, both sides, no previous-question steering, and the
       re-verification rules + the earlier points as data (R-5). Turn 5's explanation was reasoning
       over turn 4's sourced answer; the nearest SOURCED answer is what can be re-verified. */
    const t6 = await c.ask(THREAD[5]);
    expect(t6.analysisCalls).toHaveLength(1);
    expect(String(t6.analysisCalls[0][0])).toBe(THREAD[3]); /* turn 4's question — its scope */
    expect(t6.analysisCalls[0][3]).toBeUndefined();
    const policy6 = t6.analysisCalls[0][6] as {
      relationship?: { countries: string[] };
      governed?: { rules: string; data: string };
    };
    expect(policy6.relationship?.countries).toEqual(['RWA', 'TZA']);
    expect(policy6.governed?.rules).toContain('EARLIER-ANSWER RE-VERIFICATION');
    expect(policy6.governed?.data).toContain('Sourced claim 3a'); /* turn 4's claims, as data */
    expect(t6.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
    expect(t6.payload.answer.state).not.toBe('CLARIFICATION_REQUIRED');
  });
});

describe('R4 ALPHA — R-5 claim re-verification, in the earlier answer’s own scope', () => {
  it.each(['Is it still true now?', 'Does that still hold today?', 'Is that still accurate now?'])(
    'after a sourced bilateral answer: "%s" re-verifies THAT answer’s claims for ITS scope',
    async (followUp) => {
      const c = conversation();
      const first =
        'What is happening between India and China, especially in their trade relationship?';
      await c.ask(first);
      const t = await c.ask(followUp);
      expect(t.analysisCalls).toHaveLength(1);
      expect(String(t.analysisCalls[0][0])).toBe(first); /* the earlier answer's question */
      expect(t.analysisCalls[0][3]).toBeUndefined();
      const policy = t.analysisCalls[0][6] as {
        relationship?: { countries: string[] };
        governed?: { rules: string; data: string };
      };
      expect([...(policy.relationship?.countries ?? [])].sort()).toEqual(['CHN', 'IND']);
      expect(policy.governed?.rules).toContain('EARLIER-ANSWER RE-VERIFICATION');
      expect(policy.governed?.data).toContain('Sourced claim 1a');
      expect(t.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
    },
  );

  it('an earlier REASONING answer is not news-verifiable: it is re-examined by reasoning, no news', async () => {
    const c = conversation();
    await c.ask('Why do strong institutions sometimes decay slowly and then suddenly?');
    const t = await c.ask('Is that still true now?');
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
  });

  it('a genuinely new current question with "it … now" is NOT a claim re-check (control)', async () => {
    const c = conversation();
    await c.ask(
      'What is happening between India and China, especially in their trade relationship?',
    );
    const t = await c.ask('Is it raining in Kigali now?');
    expect(t.payload.diagnostics.job.discourseReference).toBe('NONE');
  });
});

describe('R4 ALPHA — R-4 an unbound reference to an earlier answer clarifies, never news', () => {
  it.each([
    ['Why did you say that?', 'en'],
    ['Why did you conclude that?', 'en'],
    ['What made you say that?', 'en'],
    ['Is it still true now?', 'en'],
    ['Does that still hold today?', 'en'],
    ['Is that still accurate now?', 'en'],
    ['Dlaczego tak powiedziałeś?', 'pl'],
    ['Czy to nadal prawda?', 'pl'],
  ] as const)('first turn "%s" (%s) → PRIOR_REFERENCE_UNRESOLVED, zero calls', async (q, lang) => {
    const c = conversation(lang);
    const t = await c.ask(q);
    expect(t.payload.answer).toMatchObject({
      state: 'CLARIFICATION_REQUIRED',
      basis: 'PRIOR_REFERENCE_UNRESOLVED',
    });
    expect(t.analysisCalls).toHaveLength(0);
    expect(t.backgroundCalls).toHaveLength(0);
  });

  it('an attribution that STATES its own proposition is answerable, never a clarification', async () => {
    const c = conversation();
    const t = await c.ask('You said growth was strong — how has it changed since 2020?');
    expect(t.payload.answer.basis).not.toBe('PRIOR_REFERENCE_UNRESOLVED');
  });
});

describe('R4 ALPHA — R-2 MIXED answers both parts (other subjects, other countries)', () => {
  it.each([
    [
      'Explain what drives youth unemployment, and what is the current situation in Spain?',
      'Explain what drives youth unemployment',
    ],
    [
      'Explain how central bank digital currencies work, and what is happening with the digital euro now?',
      'Explain how central bank digital currencies work',
    ],
  ])('"%s" → stable part by reasoning + current part sourced', async (q, stable) => {
    const c = conversation();
    const t = await c.ask(q);
    expect(t.analysisCalls).toHaveLength(1);
    expect(String(t.analysisCalls[0][0])).not.toBe(q);
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.backgroundCalls[0].question).toBe(stable);
    expect(t.payload.guidance).toMatchObject({ currentPart: 'SOURCED', stablePart: 'ANSWERED' });
  });

  it('Polish MIXED: the stable part by reasoning + the current part sourced', async () => {
    const c = conversation('pl');
    const t = await c.ask(
      'Wyjaśnij, czym jest inflacja bazowa, i jaka jest dziś inflacja w Czechach?',
    );
    expect(t.analysisCalls).toHaveLength(1);
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.guidance).toMatchObject({ currentPart: 'SOURCED', stablePart: 'ANSWERED' });
  });

  it('Polish follow-ups bind the earlier answer (R-3 / R-5)', async () => {
    const c = conversation('pl');
    await c.ask('Co się dzieje między Indiami a Chinami w handlu?');
    const why = await c.ask('Dlaczego tak powiedziałeś?');
    expect(why.analysisCalls).toHaveLength(0);
    expect(why.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
  });
});

describe('R4 ALPHA — interpreter-first (FR / DE / ES / PT / AR): the same decisions from the one verdict', () => {
  const route = (
    q: string,
    lang: string,
    verdict: SemanticResolution,
    prior?: 'SOURCED_REPORTING' | 'MODEL_REASONING',
  ) =>
    routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: lang,
        normalizationLanguage: lang,
        displayLanguage: lang,
        origin: 'ASK',
      } as never,
      {
        requestInstant: '2026-10-04T12:00:00Z',
        priorQuestion: 'Que se passe-t-il entre le Rwanda et la Tanzanie ?',
        semanticResolution: verdict,
        ...(prior === undefined
          ? {}
          : {
              priorWork: {
                kind: prior === 'SOURCED_REPORTING' ? 'SOURCED_REPORT' : 'REASONED_ANSWER',
                label: 'Rwanda–Tanzanie',
                provenance: prior,
              },
            }),
      } as never,
      { specialistRegistry: specialistRegistryFixture } as never,
    );
  const recheck: SemanticResolution = {
    path: 'SEMANTIC',
    job: 'CURRENT_REPORTING',
    needsCurrentEvidence: true,
    depth: 'STANDARD',
    transformation: null,
    confidence: 'HIGH',
    temporalRole: 'CURRENT_STATE',
    relation: null,
    reference: 'ARTIFACT_PROPOSITION',
  };
  const PRIOR: PriorArtifact = {
    kind: 'SOURCED_REPORT',
    label: 'Que se passe-t-il entre le Rwanda et la Tanzanie ?',
    components: ['Point sourcé A'],
    provenance: 'SOURCED_REPORTING',
    citable: false,
    scope: {
      question: 'Que se passe-t-il entre le Rwanda et la Tanzanie ?',
      job: 'CURRENT_REPORTING',
      countries: ['RWA', 'TZA'],
      relation: 'TRADE',
      freshness: 'CURRENT',
    },
    sourceOperationId: 'op-prior',
  };

  it.each([
    ['Est-ce toujours vrai maintenant ?', 'fr'],
    ['Stimmt das jetzt noch?', 'de'],
    ['¿Sigue siendo cierto ahora?', 'es'],
    ['Isso ainda é verdade agora?', 'pt'],
    ['هل ما زال ذلك صحيحًا الآن؟', 'ar'],
  ])(
    '"%s" (%s) with a sourced earlier answer → prior claim + current verification in ITS scope',
    (q, lang) => {
      const r = route(q, lang, recheck, 'SOURCED_REPORTING');
      expect(r.semanticClarification).not.toBe(true);
      expect(r.semantic.references.target).toBe('ARTIFACT_PROPOSITION');
      expect(r.semantic.turn.freshness).not.toBe('NONE');
      const contract = executionContractOf({
        question: q,
        language: lang,
        route: r,
        priorArtifact: PRIOR,
      });
      expect(contract.kind).toBe('CLAIM_RECHECK');
      expect(contract.retrievalQuestion).toBe(PRIOR.scope?.question);
      expect(contract.usePriorQuestion).toBe(false);
      expect(contract.relationship?.countries).toEqual(['RWA', 'TZA']);
    },
  );

  it('the same verdict with NO earlier answer → clarification (R-4)', () => {
    const r = routeAskR2(
      {
        originalQuestion: 'Est-ce toujours vrai maintenant ?',
        sourceLanguage: 'fr',
        normalizationLanguage: 'fr',
        displayLanguage: 'fr',
        origin: 'ASK',
      } as never,
      { requestInstant: '2026-10-04T12:00:00Z', semanticResolution: recheck } as never,
      { specialistRegistry: specialistRegistryFixture } as never,
    );
    expect(r.semanticClarification).toBe(true);
    expect(r.priorReferenceUnresolved).toBe(true);
  });

  it('the same verdict over an earlier REASONING answer → no current evidence planned (R-5)', () => {
    const r = route('Est-ce toujours vrai maintenant ?', 'fr', recheck, 'MODEL_REASONING');
    expect(r.semantic.turn.freshness).toBe('NONE');
  });
});

describe('R4 ALPHA — R-3 scope: answer records bind only explicit answer references', () => {
  it('the router’s answer-record kinds equal the artifact authority’s server kinds', () => {
    expect([...ANSWER_RECORD_KINDS].sort()).toEqual([...SERVER_ARTIFACT_KINDS].sort());
  });

  it('after a news answer, generic anaphora keeps following the READER’s subject (R3 continuity)', async () => {
    const c = conversation();
    await c.ask("What has changed in Kenya's economy?");
    const t = await c.ask('How does this affect ordinary households?');
    expect(t.payload.diagnostics.job.discourseReference).toBe('NONE');
    expect(t.analysisCalls).toHaveLength(1);
    /* the landed continuity routing still receives the previous USER question */
    expect(t.analysisCalls[0][3]).toBe("What has changed in Kenya's economy?");
  });

  it('the same stable question asked again in the thread is the same plan (stored answers reusable)', async () => {
    const { adapter } = harness();
    const q = 'Why do strong institutions sometimes decay slowly and then suddenly?';
    const record = validateStoredArtifact({
      kind: 'REASONED_ANSWER',
      provenance: 'MODEL_REASONING',
      label: q,
      components: ['A point.'],
      scope: { question: q, job: 'EXPLANATION', countries: [], relation: null, freshness: 'NONE' },
    });
    expect(record).not.toBeNull();
    const plain = { question: q, language: 'en', intent: 'ask' } as AskRequest;
    const withRecord = {
      ...plain,
      priorArtifact: { ...(record as NonNullable<typeof record>), sourceOperationId: 'op-1' },
    } as AskRequest;
    const ctx = { accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never;
    const a = await askRequestContext.run(ctx, () => adapter.prepare(plain));
    const b = await askRequestContext.run(ctx, () => adapter.prepare(withRecord));
    expect(b.revision).toBe(a.revision);
  });
});
