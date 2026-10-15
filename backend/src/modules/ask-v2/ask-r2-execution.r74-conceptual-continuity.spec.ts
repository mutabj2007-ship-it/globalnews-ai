import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { anchorQuestionOf, conversationOf } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import { asksForUnnamedExample } from './conversation/example-continuation';
import { deriveKnowledgeRequirement } from '../ask-router/knowledge-requirement';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R74 (#95) — the Product Owner's live Alpha journey, 15 Oct, replayed through the REAL executor
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Q1 (conceptual) was answered "What exactly should this cover? Add one specific place, topic or
 * period…" (No sources searched · no compute used): "…even when an economy is growing" was read as a
 * trend in progress, so the question became MIXED and the current part had no scope.
 * Q2 ("Give me a practical example involving a small shop owner…") reached the model with NO earlier
 * question: it is not an anaphoric / bounded follow-up, so the service passed no prior, and the
 * model invented a generic marketing checklist.
 *
 * Fake providers only: no live provider, no model, no network. The prior question is chosen exactly
 * as AskV2Service chooses it (anchorQuestionOf over this thread's earlier questions, newest first).
 */
const Q1 =
  'Explain the difference between economic growth and inflation in simple terms. How can prices rise even when an economy is growing?';
const Q2 =
  'Give me a practical example involving a small shop owner, and recommend what they should consider doing.';

function harness() {
  const analysis: unknown[][] = [];
  const background: Array<{ question: string; priorQuestion?: string }> = [];
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        analysis.push(args);
        return {
          analysis: null,
          articles: [],
          retrievalContext: {
            outcome: 'NO_RELEVANT_EVIDENCE',
            providers: ['rss-feeds'],
            providerFailures: [],
            dataMode: 'live',
            retrievalTrace: { lanesUnavailable: [] },
          } as never,
        } as never;
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    {
      id: 'openai',
      displayName: 'OpenAI',
      isMock: false,
      answerBackground: jest.fn(async (input: { question: string; priorQuestion?: string }) => {
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

/** One thread: each turn gets the prior question AskV2Service would give it. */
function thread() {
  const h = harness();
  const earlier: string[] = [];
  let op = 0;
  async function ask(question: string) {
    const newestFirst = [...earlier].reverse();
    const conversational = readConversationalTurn(
      question,
      'en',
      newestFirst.map((q) => ({ question: q, language: 'en' })),
    );
    const request = {
      question: conversational?.composition?.effectiveQuestion ?? question,
      language: 'en',
      intent: 'ask',
      ...conversationOf(conversational),
    } as AskRequest;
    const priorQuestion = anchorQuestionOf(question, newestFirst);
    const before = { a: h.analysis.length, b: h.background.length };
    const payload = await askRequestContext.run(
      {
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        ...(priorQuestion === null ? {} : { priorQuestion }),
      } as never,
      async () => {
        const plan = await h.adapter.prepare(request);
        return JSON.parse((await h.adapter.execute(request, plan, `op-${++op}`)).payloadJson);
      },
    );
    earlier.push(question);
    return {
      payload,
      priorQuestion,
      newsCalls: h.analysis.slice(before.a),
      backgroundCalls: h.background.slice(before.b),
    };
  }
  return { ask };
}

describe('R74 #95 — the conceptual question is answered, not asked for a place or period', () => {
  it('Q1 is answered as background: no clarification, no news retrieval, one background call', async () => {
    const t1 = await thread().ask(Q1);
    expect(t1.payload.answer.state).not.toBe('CLARIFICATION_REQUIRED');
    expect(t1.newsCalls).toHaveLength(0);
    expect(t1.backgroundCalls).toHaveLength(1);
    expect(t1.backgroundCalls[0].question).toBe(Q1);
  });

  it('the knowledge reader: a generic "an economy is growing" is not a trend in progress', () => {
    expect(deriveKnowledgeRequirement(Q1, 'en').requirement).toBe('STABLE_REFERENCE');
    expect(
      deriveKnowledgeRequirement('Explain what happens when a currency is falling.', 'en').requirement,
    ).toBe('STABLE_REFERENCE');
  });
});

describe('R74 #95 — the follow-up example keeps the earlier economics question', () => {
  it('Q2 after Q1 reaches the model WITH Q1 as the previous question, and searches no news', async () => {
    const t = thread();
    await t.ask(Q1);
    const t2 = await t.ask(Q2);
    expect(t2.priorQuestion).toBe(Q1);
    expect(t2.newsCalls).toHaveLength(0);
    expect(t2.backgroundCalls).toHaveLength(1);
    expect(t2.backgroundCalls[0]).toMatchObject({ question: Q2, priorQuestion: Q1 });
  });

  it('an example request that names no subject continues; one that names its subject does not', () => {
    expect(anchorQuestionOf(Q2, [Q1])).toBe(Q1);
    expect(asksForUnnamedExample('Can you give me a concrete example?')).toBe(true);
    expect(asksForUnnamedExample('Podaj mi praktyczny przykład z małym sklepem.')).toBe(true);
    expect(anchorQuestionOf('Give me an example of a mixed economy.', [Q1])).toBeNull();
    expect(asksForUnnamedExample('Podaj przykład inflacji bazowej.')).toBe(false);
    /* a new thread has no earlier question: nothing is invented */
    expect(anchorQuestionOf(Q2, [])).toBeNull();
    /* an example request is never itself the anchor: the subject-bearing question is */
    expect(anchorQuestionOf('Give me another example.', [Q2, Q1])).toBe(Q1);
  });
});

describe('R74 #95 — negative contrast: genuine current-news questions keep their current reading', () => {
  it.each([
    'Why is the dollar falling?',
    'Why are prices rising in Kenya?',
    "Kenya's economy is growing fast — what is driving it this year?",
    'Is a war escalating in Sudan?',
  ])('%s → not stable reference', (q) => {
    const r = deriveKnowledgeRequirement(q, 'en').requirement;
    expect(r).not.toBe('STABLE_REFERENCE');
    expect(r).not.toBeNull();
  });

  it('a current-news question is never answered from background (it stays on the reporting path)', async () => {
    const t = await thread().ask('What is happening in Sudan this week?');
    expect(t.backgroundCalls).toHaveLength(0);
    /* unchanged landed behaviour: the reporting plan offers its broadening (0 AI) or searches */
    expect(t.payload.answer.state === 'CLARIFICATION_REQUIRED' || t.newsCalls.length === 1).toBe(true);
  });
});
