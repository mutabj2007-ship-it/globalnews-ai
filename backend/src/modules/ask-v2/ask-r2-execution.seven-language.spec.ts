import type { AskRequest, Language } from './ask-compute.contract';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import {
  SEMANTIC_FIRST_INTERPRETER_MAX_TOKENS,
  SEMANTIC_FIRST_INTERPRETER_SYSTEM,
  SEMANTIC_INTERPRETER_SYSTEM,
} from '../ask-router/semantic-ir/semantic-interpreter';

/**
 * CTO R4 SEVEN-LANGUAGE RULING — the interpreter-first path through the execution adapter, every
 * dependency faked at its boundary. FR / DE / ES / PT / AR: exactly ONE bounded interpretation per
 * turn on the ORIGINAL text, BEFORE any provider; no translation call; the answer is written in the
 * reader's language; without a valid verdict the reader is asked one focused question (zero compute).
 */
type Usage = { promptTokens: number; completionTokens: number };
function harness(classify?: (user: string) => Promise<string>) {
  const calls = {
    analysis: [] as unknown[][],
    background: [] as Array<{ question: string; responseLanguage: string }>,
    classify: [] as Array<{ system: string; user: string; maxCompletionTokens: number }>,
  };
  const observed: Array<Record<string, unknown>> = [];
  const backgroundProvider: Record<string, unknown> = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    answerBackground: jest.fn(
      async (input: {
        question: string;
        responseLanguage: string;
        usageSink?: (u: Usage) => void;
      }) => {
        calls.background.push(input);
        input.usageSink?.({ promptTokens: 500, completionTokens: 300 });
        return { text: 'Réponse.' };
      },
    ),
  };
  if (classify !== undefined)
    backgroundProvider.completeStructured = jest.fn(
      async (input: {
        system: string;
        user: string;
        maxCompletionTokens: number;
        usageSink?: (u: Usage) => void;
      }) => {
        calls.classify.push(input);
        input.usageSink?.({ promptTokens: 700, completionTokens: 90 });
        return classify(input.user);
      },
    );
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        calls.analysis.push(args);
        return { analysis: {} as never, articles: [], retrievalContext: {} as never };
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
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

async function run(
  h: ReturnType<typeof harness>,
  question: string,
  language: Language,
  readerTurns?: string[],
) {
  const request: AskRequest = {
    question,
    language,
    intent: 'ask',
    ...(readerTurns === undefined ? {} : { readerTurns }),
  };
  const plan = await h.adapter.prepare(request);
  const result = await askRequestContext.run(
    { accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' },
    () => h.adapter.execute(request, plan, 'op-7'),
  );
  expect(result.succeeded).toBe(true);
  return JSON.parse(result.payloadJson) as {
    answer: { state: string; basis?: string };
    aiExecuted: boolean;
  };
}

const verdict = (o: Record<string, unknown>) => async () =>
  JSON.stringify({
    job: 'EXPLANATION',
    needsCurrentEvidence: false,
    temporalRole: 'NONE',
    depth: 'STANDARD',
    transformation: null,
    confidence: 'HIGH',
    parts: [],
    relation: null,
    reference: 'NONE',
    objective: null,
    ...o,
  });

const CONCEPTUAL: ReadonlyArray<readonly [Language, string]> = [
  ['fr', 'Pourquoi certaines démocraties résistent-elles mieux que d’autres au populisme ?'],
  ['de', 'Warum gelingt manchen Volkswirtschaften der Sprung aus der Mitteleinkommensfalle?'],
  ['es', '¿Por qué algunas ciudades se reinventan tras la desindustrialización y otras no?'],
  ['pt', 'Por que algumas instituições sobrevivem a crises de confiança e outras desaparecem?'],
  ['ar', 'لماذا تنجح بعض الدول في تنويع اقتصادها بعيداً عن النفط بينما تفشل أخرى؟'],
];

describe('seven-language — FR / DE / ES / PT / AR are interpreter-first through the executor', () => {
  it.each(CONCEPTUAL)(
    '%s: ONE bounded call on the original text, before any provider; answer in the reader language; zero news',
    async (lang, q) => {
      const h = harness(verdict({ job: 'DEEP_CONCEPTUAL_ANALYSIS', depth: 'DEEP' }));
      const p = await run(h, q, lang);
      expect(h.calls.classify).toHaveLength(1);
      expect(h.calls.classify[0].system).toBe(SEMANTIC_FIRST_INTERPRETER_SYSTEM);
      expect(h.calls.classify[0].maxCompletionTokens).toBe(SEMANTIC_FIRST_INTERPRETER_MAX_TOKENS);
      expect(h.calls.classify[0].user).toContain(q);
      expect(h.calls.analysis).toHaveLength(0);
      expect(h.calls.background).toHaveLength(1);
      expect(h.calls.background[0]).toMatchObject({ question: q, responseLanguage: lang });
      expect(p.aiExecuted).toBe(true);
      expect(h.observed[0]).toMatchObject({
        semanticPath: 'SEMANTIC',
        semanticCompleteness: 'UNRESOLVED',
      });
    },
  );

  it('a current verdict reaches the evidence path; de retrieves with a representable language and answers in German', async () => {
    const h = harness(
      verdict({
        job: 'CURRENT_REPORTING',
        needsCurrentEvidence: true,
        temporalRole: 'CURRENT_STATE',
      }),
    );
    await run(h, 'Was passiert gerade an der Grenze zwischen Polen und Belarus?', 'de');
    expect(h.calls.classify).toHaveLength(1);
    expect(h.calls.analysis).toHaveLength(1);
    const [question, retrieval, , , , , policy] = h.calls.analysis[0] as [
      string,
      string,
      unknown,
      unknown,
      unknown,
      unknown,
      { answerLanguage?: string },
    ];
    expect(question).toBe('Was passiert gerade an der Grenze zwischen Polen und Belarus?');
    expect(retrieval).toBe('en');
    expect(policy.answerLanguage).toBe('de');
  });

  it('fr / es / ar retrieve natively (no answer-language override needed)', async () => {
    const h = harness(
      verdict({
        job: 'CURRENT_REPORTING',
        needsCurrentEvidence: true,
        temporalRole: 'CURRENT_STATE',
      }),
    );
    await run(h, 'ما آخر الأخبار عن المفاوضات بين مصر وإثيوبيا؟', 'ar');
    const [, retrieval, , , , , policy] = h.calls.analysis[0] as [
      string,
      string,
      unknown,
      unknown,
      unknown,
      unknown,
      { answerLanguage?: string },
    ];
    expect(retrieval).toBe('ar');
    expect(policy.answerLanguage).toBeUndefined();
  });

  it('no interpreter / an invalid answer → ONE focused clarification, zero compute, never news', async () => {
    for (const h of [harness(), harness(async () => '{"job":"NEWS"}')]) {
      const p = await run(h, CONCEPTUAL[0][1], 'fr');
      expect(p.answer).toMatchObject({
        state: 'CLARIFICATION_REQUIRED',
        basis: 'INTERPRETATION_UNRESOLVED',
      });
      expect(h.calls.analysis).toHaveLength(0);
      expect(h.calls.background).toHaveLength(0);
    }
  });

  it('the reader’s own earlier turns reach the call (bounded, as data); the objective is taken verbatim', async () => {
    const h = harness(
      verdict({
        job: 'DECISION_SUPPORT',
        reference: 'CHOICE_SET',
        objective: { text: 'la plus proche de la mer' },
      }),
    );
    await run(h, 'Alors, laquelle me conseilles-tu ?', 'fr', [
      'J’hésite entre Rennes, Lyon et Montpellier pour mes études.',
      'Je veux la ville la plus proche de la mer.',
    ]);
    expect(h.calls.classify).toHaveLength(1);
    expect(h.calls.classify[0].user).toContain('Je veux la ville la plus proche de la mer.');
    expect(h.calls.analysis).toHaveLength(0);
    expect(h.calls.background).toHaveLength(1);
  });

  it('EN / PL keep the deterministic fast path and their own contract', async () => {
    const h = harness(verdict({}));
    await run(h, 'Explain deeply what resilience means.', 'en');
    expect(h.calls.classify).toHaveLength(0);
    const h2 = harness(async () =>
      JSON.stringify({
        job: 'EXPLANATION',
        needsCurrentEvidence: false,
        depth: 'STANDARD',
        transformation: null,
        confidence: 'HIGH',
        clauses: [{ id: 0, kind: 'STABLE' }],
        relation: null,
        reference: 'NONE',
      }),
    );
    await run(h2, 'What is the current meaning of sovereignty?', 'en');
    expect(h2.calls.classify.every((c) => c.system === SEMANTIC_INTERPRETER_SYSTEM)).toBe(true);
  });
});
