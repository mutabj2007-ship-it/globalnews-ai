import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { NO_CURRENT_FINDINGS_RULE, SOURCES_UNAVAILABLE_RULE } from './job-execution';

/**
 * MASTER CTO P0 #85 — through the REAL executor (harness pattern of the D-28 / R2 contract specs,
 * fake providers, offline): an answer whose every candidate was withheld by the geo-identity hold is
 * never told to the reader as "no current findings", the operator observation records
 * GEO_IDENTITY_HELD, the reader payload carries the existing OUTCOME_UNAVAILABLE, and the cost is
 * unchanged (one retrieval attempt, at most one background model call, nothing retried).
 */
type Mode = 'geoHeld' | 'noMatch';
const EMPTY = { analysis: null, analysisError: 'No matching reporting.', articles: [] as never[] };
const RESPONSES: Record<Mode, () => unknown> = {
  geoHeld: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews', 'gdelt-doc'],
      geoIdentityHeld: { count: 5 },
      retrievalTrace: { candidatesSeen: 5, candidatesAdmitted: 0, lanesUnavailable: [] },
    },
  }),
  noMatch: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews', 'gdelt-doc'],
      outcome: 'NO_RELEVANT_EVIDENCE',
      retrievalTrace: { candidatesSeen: 0, candidatesAdmitted: 0, lanesUnavailable: [] },
    },
  }),
};

function harness(mode: Mode) {
  const analysisCalls: unknown[][] = [];
  const backgroundCalls: Array<{ jobRules?: string }> = [];
  const observations: Array<Record<string, unknown>> = [];
  const settle = jest.fn(async () => true);
  const analysisService = {
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      analysisCalls.push(args);
      return RESPONSES[mode]();
    }),
  };
  const provider = { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() };
  const backgroundProvider = {
    id: 'openai',
    displayName: 'OpenAI',
    isMock: false,
    answerBackground: jest.fn(async (input: { jobRules?: string; usageSink?: (u: unknown) => void }) => {
      backgroundCalls.push(input);
      input.usageSink?.({ promptTokens: 400, completionTokens: 150 });
      return { text: 'General guidance follows.' };
    }),
  };
  const adapter = new AskR2ExecutionAdapter(
    analysisService as never,
    provider as never,
    backgroundProvider as never,
    {
      config: { outputWeight: 4 },
      reserve: jest.fn(async () => ({ admitted: true as const, reservationId: 'r', estimatedUnits: 1 })),
      settle,
    } as never,
    {
      permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' as const })),
      record: jest.fn(async () => undefined),
    } as never,
    { isEnabled: jest.fn(async () => true) } as never,
    { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    {
      record: jest.fn(async (o: Record<string, unknown>) => {
        observations.push(o);
        return true;
      }),
    } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async () => ({ considered: [], contributions: [] })),
    } as never,
  );
  return { adapter, analysisCalls, backgroundCalls, observations, settle };
}

/* a question whose named actors / topic gate the evidence (the fallback path the hold must not mislabel) */
const QUESTION = 'Compare the latest economic news from Kenya and Rwanda.';

async function ask(mode: Mode) {
  const h = harness(mode);
  const request = { question: QUESTION, language: 'en', intent: 'ask' } as AskRequest;
  const payload = await askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never, async () => {
    const plan = await h.adapter.prepare(request);
    return JSON.parse((await h.adapter.execute(request, plan, 'op-85')).payloadJson) as {
      answer: { state: string; basis?: string };
      research?: { outcome: string | null };
    };
  });
  return { ...h, payload, observation: h.observations[h.observations.length - 1] ?? {} };
}

const rulesOf = (calls: Array<{ jobRules?: string }>) => calls.map((c) => String(c.jobRules ?? ''));

describe('#85 · a held-only search through the real executor', () => {
  it('is UNAVAILABLE, never "no current findings"; observation GEO_IDENTITY_HELD; reader outcome OUTCOME_UNAVAILABLE', async () => {
    const t = await ask('geoHeld');
    /* non-vacuous: the fallback IS reached */
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.answer.basis).toBe('PARTIAL_CURRENT_UNAVAILABLE');
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(SOURCES_UNAVAILABLE_RULE);
      expect(r).not.toContain(NO_CURRENT_FINDINGS_RULE);
    }
    expect(t.observation.retrievalOutcome).toBe('GEO_IDENTITY_HELD');
    expect(t.payload.research?.outcome).toBe('OUTCOME_UNAVAILABLE');
    /* cost unchanged: one retrieval attempt, one background call, nothing retried */
    expect(t.analysisCalls).toHaveLength(1);
    expect(t.observation.providerCallCount).toBe(2);
    expect(t.observation.modelInvocationCount).toBe(1);
  });

  it('control: a genuine completed no-match keeps NO_EVIDENCE + NO CURRENT FINDINGS (unchanged)', async () => {
    const t = await ask('noMatch');
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.answer.basis).toBe('PARTIAL_CURRENT_NO_EVIDENCE');
    for (const r of rulesOf(t.backgroundCalls)) expect(r).toContain(NO_CURRENT_FINDINGS_RULE);
    expect(t.observation.retrievalOutcome).toBe('COMPLETED_NO_MATCH');
    expect(t.observation.providerCallCount).toBe(2);
    expect(t.observation.modelInvocationCount).toBe(1);
  });
});
