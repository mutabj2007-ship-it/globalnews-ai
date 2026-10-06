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
 * ASK RETRIEVAL / CONVERSATION R2 — the contract's regression inputs through the REAL executor
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Harness copied from ask-r2-execution.alpha-defects.spec.ts (fake providers, the conversation
 * threaded exactly as AskV2Service threads it). Benchmark prompts are verbatim from the contract;
 * paraphrases guard against phrase-matching.
 */

type Call = unknown[];
/** ASK R2 — switched per turn by the tests: retrieval returns no evidence while set. */
const evidence = { none: false };
interface Calls {
  analysis: Call[];
  background: Array<{ question: string; priorWork?: string; [k: string]: unknown }>;
}

function harness() {
  const calls: Calls = { analysis: [], background: [] };
  const analysisService = {
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      calls.analysis.push(args);
      /* ASK R2 — a turn whose retrieval found nothing (the failed-A path) */
      if (evidence.none) return { analysis: null, analysisError: 'No matching reporting.', articles: [] };
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


const TEST_A =
  'What were the three most significant developments affecting small businesses in Kenya over the past seven days? Present a concise table with: development, date, likely business impact, and a clickable source supporting the development. Prioritize Kenyan reporting and official sources. Distinguish reported facts from your analysis, and give fewer than three developments if the evidence is insufficient. Finish by explaining, in no more than 60 words, which development a small shopkeeper should watch most closely and why.';
const TEST_E =
  'What has changed recently in relations between Rwanda and DR Congo concerning the conflict? Cite relevant dated reporting.';

describe('ASK R2 · one coherent question (contract §7, gate D)', () => {
  it('TEST A is ONE request: the full question reaches analysis, nothing is sent to reasoning alone', async () => {
    const c = conversation();
    const t = await c.ask(TEST_A);
    expect(t.analysisCalls).toHaveLength(1);
    const query = String(t.analysisCalls[0][0]);
    expect(query).toContain('Present a concise table');
    expect(query).toContain('Finish by explaining, in no more than 60 words');
    /* no clause ("…and why") was sent to the reasoning model by itself */
    expect(t.backgroundCalls.filter((b) => /^s*(?:ands+)?why/i.test(b.question))).toHaveLength(0);
    expect(t.backgroundCalls.some((b) => b.question.trim().length < 80)).toBe(false);
  });

  it.each([
    'Which three developments hit Kenyan small traders this past week? Put them in a short table with dates and sources, and end by saying which one a corner-shop owner should watch most and why.',
    'List up to three recent developments affecting small businesses in Uganda over the past seven days in a table, then explain which one matters most to a shopkeeper and why.',
  ])('paraphrase stays one request: %s', async (q) => {
    const c = conversation();
    const t = await c.ask(q);
    expect(t.backgroundCalls.filter((b) => /^s*(?:ands+)?why/i.test(b.question))).toHaveLength(0);
  });

  it('a genuinely separate explanatory part is still answered by reasoning (R-2 unchanged)', async () => {
    const c = conversation();
    const t = await c.ask('Explain what drives youth unemployment, and what is the current situation in Spain?');
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.backgroundCalls[0].question).toBe('Explain what drives youth unemployment');
  });
});

describe('ASK R2 · relevance — no incidental topic on a diplomacy question (TEST E)', () => {
  it('"…Cite relevant dated reporting." never adds Transport (Polish "port" matched inside "reporting")', async () => {
    const c = conversation();
    const t = await c.ask(TEST_E);
    const chips = JSON.stringify((t.payload as unknown as { chips?: unknown }).chips ?? null);
    expect(chips).not.toMatch(/TRANSPORT/);
  });
});

describe('ASK R2 · "As of <today>" anchors the stated window; it is not a filter (TEST B / C)', () => {
  const day = (d: Date) =>
    `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
  const corridor = (asOf: string) =>
    `As of ${asOf}, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.\nPrioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.`;

  it('asked today: executed with the seven-day window applied — never a broadening offer', async () => {
    const c = conversation();
    const t = await c.ask(corridor(day(new Date())));
    const p = t.payload as unknown as { answer: { basis: string }; chips: { chips?: Array<{ kind: string; source: string; applied: boolean }> } };
    expect(p.answer.basis).not.toBe('PLAN_BROADENING_OFFERED');
    expect(t.analysisCalls).toHaveLength(1);
    expect(p.chips.chips).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'TIME', source: 'REPORTING_WINDOW', applied: true })]),
    );
  });

  it('a past "as of" date is NOT silently re-anchored on now (it stays a constraint)', async () => {
    const c = conversation();
    const t = await c.ask(corridor(day(new Date(Date.now() - 40 * 86_400_000))));
    expect(t.analysisCalls).toHaveLength(0);
  });
});
