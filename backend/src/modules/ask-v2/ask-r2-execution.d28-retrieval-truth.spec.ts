import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AnalysisDeadlineExceededError } from '../analysis/service/analysis.service';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { observedRetrievalOf, retrievalIncomplete } from './retrieval-outcome';
import { NO_CURRENT_FINDINGS_RULE, SOURCES_UNAVAILABLE_RULE } from './job-execution';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * RETRIEVAL R1 · D-28 — A SEARCH THAT DID NOT COMPLETE IS NEVER "NO FINDINGS"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Sentinel: Alpha op 4f585f99 (2026-10-12 15:58Z) — GNews rate-limited, GDELT DOC HTTP 429, a third
 * lane answered with nothing. Observed: retrievalOutcome PARTIAL_NO_MATCH, candidatesSeen null
 * (no retrievalTrace), admitted 0, providerCallCount 2, modelInvocationCount 1, answerBasis
 * PARTIAL_CURRENT_NO_EVIDENCE — the background call was told NO CURRENT FINDINGS.
 *
 * Every fixture runs the REAL executor with fake providers (harness from
 * ask-r2-execution.r2-contract.spec.ts). Offline: no provider, model, DB or network.
 */

type Mode =
  | 'sentinel'
  | 'noMatch'
  | 'noMatchUnconfiguredLane'
  | 'allDown'
  | 'deadline'
  | 'partialFindings'
  | 'rightsWithheld'
  | 'retainedOnly';

const EMPTY = { analysis: null, analysisError: 'No matching reporting.', articles: [] as never[] };
const sourced = (retrievalContext: Record<string, unknown>) =>
  ({
    analysis: {
      headline: 'Sourced headline',
      summary: 'Summary.',
      keyFacts: [{ claim: 'Sourced claim', sourceArticleIds: ['art-1'] }],
    } as never,
    articles: [
      { id: 'art-1', url: 'https://news.example/r-1', publishedAt: new Date().toISOString() },
    ] as never,
    retrievalContext: retrievalContext as never,
  }) satisfies Partial<AnalysisApiResponse>;

/** What the analysis returns for each fixture — the shapes analysis.service.ts emits. */
const RESPONSES: Record<Exclude<Mode, 'deadline'>, () => unknown> = {
  /* the exact sentinel: two named failures, one lane answered empty, no retrievalTrace */
  sentinel: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['newsdata'],
      providerFailures: [
        { providerId: 'gnews', kind: 'rate-limited' },
        { providerId: 'gdelt-doc', kind: 'rate-limited' },
      ],
      outcome: 'NO_RELEVANT_EVIDENCE',
    },
  }),
  /* a genuine completed search: every lane answered, nothing relevant */
  noMatch: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews', 'gdelt-doc'],
      outcome: 'NO_RELEVANT_EVIDENCE',
      retrievalTrace: { candidatesSeen: 0, candidatesAdmitted: 0, lanesUnavailable: [] },
    },
  }),
  /* a lane that is merely not configured does not make a completed search incomplete (R2B) */
  noMatchUnconfiguredLane: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews', 'gdelt-doc'],
      outcome: 'NO_RELEVANT_EVIDENCE',
      retrievalTrace: {
        candidatesSeen: 0,
        candidatesAdmitted: 0,
        lanesUnavailable: [{ lane: 'newsapi', reason: 'not-configured' }],
      },
    },
  }),
  /* total unavailability (the P0-6 shape) */
  allDown: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'unavailable',
      providers: [],
      fallbackReason: 'provider-error',
      providerFailures: [
        { providerId: 'gnews', kind: 'rate-limited' },
        { providerId: 'gdelt-doc', kind: 'timeout' },
      ],
    },
  }),
  /* some sources failed, but reporting WAS admitted: a sourced answer, never background */
  partialFindings: () =>
    sourced({
      dataMode: 'live',
      providers: ['newsdata'],
      providerFailures: [{ providerId: 'gnews', kind: 'rate-limited' }],
    }),
  /* every returned item withheld for rights: not a source failure, never "nothing relevant" */
  rightsWithheld: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews', 'gdelt-doc'],
      rightsExcluded: { count: 3 },
      retrievalTrace: { candidatesSeen: 3, candidatesAdmitted: 0, lanesUnavailable: [] },
    },
  }),
  /* live providers refused, retained reporting answered */
  retainedOnly: () =>
    sourced({
      dataMode: 'cached',
      providers: [],
      outcome: 'RETAINED_ONLY',
      fallbackReason: 'provider-error',
      providerFailures: [{ providerId: 'gnews', kind: 'rate-limited' }],
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
      if (mode === 'deadline') throw new AnalysisDeadlineExceededError(28_000, 'k');
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
      return { text: 'The search could not be completed.\n\nGeneral guidance follows.' };
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

/* The sentinel's own question (WP6 EN baseline), and the P0-6 guidance-path question. */
const SENTINEL_Q = 'Compare the latest economic news from Kenya and Rwanda.';
const FUEL_Q =
  'What fuel price changes were reported in Rwanda in the past seven days? Present a table with date and source.';

async function ask(mode: Mode, question: string) {
  const h = harness(mode);
  const request = { question, language: 'en', intent: 'ask' } as AskRequest;
  const payload = await askRequestContext.run(
    { accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never,
    async () => {
      const plan = await h.adapter.prepare(request);
      return JSON.parse((await h.adapter.execute(request, plan, 'op-d28')).payloadJson) as {
        answer: { state: string; basis?: string };
      };
    },
  );
  return { ...h, payload, observation: h.observations[h.observations.length - 1] ?? {} };
}

const rulesOf = (calls: Array<{ jobRules?: string }>) => calls.map((c) => String(c.jobRules ?? ''));

describe('D-28 · the predicate (pure)', () => {
  it.each<[Exclude<Mode, 'deadline'>, boolean]>([
    ['sentinel', true],
    ['allDown', true],
    ['noMatch', false],
    ['noMatchUnconfiguredLane', false],
    ['rightsWithheld', false],
  ])('%s → retrievalIncomplete %s', (mode, expected) => {
    expect(retrievalIncomplete(RESPONSES[mode]() as never)).toBe(expected);
  });

  it('the observation code is unchanged: sentinel stays PARTIAL_NO_MATCH, no-match COMPLETED_NO_MATCH, rights RIGHTS_WITHHELD', () => {
    expect(observedRetrievalOf(RESPONSES.sentinel() as never).retrievalOutcome).toBe('PARTIAL_NO_MATCH');
    expect(observedRetrievalOf(RESPONSES.sentinel() as never).candidatesSeen).toBeNull();
    expect(observedRetrievalOf(RESPONSES.noMatch() as never).retrievalOutcome).toBe('COMPLETED_NO_MATCH');
    expect(observedRetrievalOf(RESPONSES.allDown() as never).retrievalOutcome).toBe('PROVIDER_FAILED');
    expect(observedRetrievalOf(RESPONSES.rightsWithheld() as never).retrievalOutcome).toBe('RIGHTS_WITHHELD');
    expect(observedRetrievalOf(RESPONSES.retainedOnly() as never).retrievalOutcome).toBe('RETAINED_ONLY');
    expect(observedRetrievalOf(RESPONSES.partialFindings() as never).retrievalOutcome).toBe('PARTIAL');
  });

  it('a search that was never attempted is not "incomplete"', () => {
    expect(retrievalIncomplete({ retrievalContext: { retrievalAttempted: false } } as never)).toBe(false);
    expect(retrievalIncomplete(null)).toBe(false);
    expect(retrievalIncomplete({} as never)).toBe(false);
  });
});

describe.each([
  ['the sentinel question', SENTINEL_Q],
  ['the P0-6 guidance question', FUEL_Q],
])('D-28 · through the real executor — %s', (_label, question) => {
  it('SENTINEL (GNews 429 + GDELT 429 + another lane empty): UNAVAILABLE, never "no current findings"', async () => {
    const t = await ask('sentinel', question);
    expect(t.payload.answer.state).not.toBe('CURRENT_REPORTING');
    expect(t.payload.answer.basis ?? '').not.toBe('PARTIAL_CURRENT_NO_EVIDENCE');
    /* non-vacuous: the sentinel DOES reach the background fallback (as live op 4f585f99 did) */
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.answer.basis).toBe('PARTIAL_CURRENT_UNAVAILABLE');
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(SOURCES_UNAVAILABLE_RULE);
      expect(r).not.toContain('NO CURRENT FINDINGS');
    }
    /* cost: one retrieval attempt, at most one background model call — nothing added, no retry */
    expect(t.analysisCalls).toHaveLength(1);
    expect(t.backgroundCalls.length).toBeLessThanOrEqual(1);
    expect(t.observation.retrievalOutcome).toBe('PARTIAL_NO_MATCH');
    expect(t.observation.providerCallCount).toBe(1 + t.backgroundCalls.length);
  });

  it('genuine completed no-match keeps NO_EVIDENCE + NO CURRENT FINDINGS (unchanged)', async () => {
    const t = await ask('noMatch', question);
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.answer.basis).toBe('PARTIAL_CURRENT_NO_EVIDENCE');
    for (const r of rulesOf(t.backgroundCalls)) expect(r).toContain(NO_CURRENT_FINDINGS_RULE);
    expect(t.observation.retrievalOutcome).toBe('COMPLETED_NO_MATCH');
  });

  it('a merely not-configured lane does not turn a completed no-match into "unavailable"', async () => {
    const t = await ask('noMatchUnconfiguredLane', question);
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.answer.basis).toBe('PARTIAL_CURRENT_NO_EVIDENCE');
  });

  it('total unavailability keeps UNAVAILABLE + SOURCES UNAVAILABLE (unchanged)', async () => {
    const t = await ask('allDown', question);
    expect(t.backgroundCalls).toHaveLength(1);
    expect(t.payload.answer.basis).toBe('PARTIAL_CURRENT_UNAVAILABLE');
    for (const r of rulesOf(t.backgroundCalls)) expect(r).toContain('SOURCES UNAVAILABLE');
    expect(t.observation.retrievalOutcome).toBe('PROVIDER_FAILED');
  });

  it('partial findings (reporting admitted beside a failed source) stay a sourced answer, no background call', async () => {
    const t = await ask('partialFindings', question);
    expect(t.backgroundCalls).toHaveLength(0);
    expect(t.payload.answer.basis ?? '').not.toMatch(/^PARTIAL_CURRENT_/);
    expect(t.observation.retrievalOutcome).toBe('PARTIAL');
  });

  it('rights withholding is not a source failure: no "sources unavailable" claim, code RIGHTS_WITHHELD', async () => {
    const t = await ask('rightsWithheld', question);
    for (const r of rulesOf(t.backgroundCalls)) expect(r).not.toContain('SOURCES UNAVAILABLE');
    expect(t.observation.retrievalOutcome).toBe('RIGHTS_WITHHELD');
  });

  it('retained-only evidence stays a sourced answer (RETAINED_ONLY), no background call', async () => {
    const t = await ask('retainedOnly', question);
    expect(t.backgroundCalls).toHaveLength(0);
    expect(t.observation.retrievalOutcome).toBe('RETAINED_ONLY');
  });
});

describe('D-28 · deadline expiry and metering are unchanged', () => {
  it('deadline expiry on a current question: one analysis attempt, no background call, no retry', async () => {
    const h = harness('deadline');
    const request = { question: SENTINEL_Q, language: 'en', intent: 'ask' } as AskRequest;
    await expect(
      askRequestContext.run({ accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7' } as never, async () =>
        h.adapter.execute(request, await h.adapter.prepare(request), 'op-d28-deadline'),
      ),
    ).rejects.toThrow(/MODEL_TIMEOUT/);
    expect(h.analysisCalls).toHaveLength(1);
    expect(h.backgroundCalls).toHaveLength(0);
  });

  it('the sentinel settles the empty search at 0 units as NO_EVIDENCE and the background call on its own usage', async () => {
    const t = await ask('sentinel', SENTINEL_Q);
    const calls = t.settle.mock.calls as unknown as Array<[string, number | null, string]>;
    expect(calls[0]).toEqual(['r', 0, 'NO_EVIDENCE']);
    expect(calls[1]).toEqual(['r', 400 + 4 * 150, 'SUCCESS']);
    expect(calls).toHaveLength(2);
    /* live 4f585f99: providerCallCount 2, modelInvocationCount 1 */
    expect(t.observation.providerCallCount).toBe(2);
    expect(t.observation.modelInvocationCount).toBe(1);
  });
});
