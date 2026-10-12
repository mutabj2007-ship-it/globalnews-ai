import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { observedRetrievalOf, retrievalIncomplete, retrievalRightsWithheld } from './retrieval-outcome';
import {
  EARLIER_RIGHTS_WITHHELD_REASON,
  earlierReportsUnverifiedRule,
  NO_CURRENT_FINDINGS_RULE,
  RIGHTS_WITHHELD_RULE,
  SOURCES_UNAVAILABLE_RULE,
} from './job-execution';
import { governedCode, OBSERVED_RETRIEVAL_OUTCOMES } from '../ask-observability/ask-observation.contract';
import { noEvidenceReasonText, priorEvidenceGap } from './conversation/conversation-artifact';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R4 · #87 F-1 — REPORTING WITHHELD FOR RIGHTS IS NEVER "NO FINDINGS"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1 30-REVIEW-C F-1: when every found item is withheld for source-use rights, the reader was told
 * "no findings". Three states must stay apart: a completed no-match, a provider-degraded search,
 * and otherwise-relevant reporting withheld for rights. Real executor, fake providers (the D-28
 * harness). Offline: no provider, model, DB or network.
 */
type Mode = 'noMatch' | 'degraded' | 'rightsWithheld' | 'rightsAndDegraded' | 'rightsBesideEvidence';

const EMPTY = { analysis: null, analysisError: 'No matching reporting.', articles: [] as never[] };
const RESPONSES: Record<Mode, () => unknown> = {
  noMatch: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews', 'gdelt-doc'],
      outcome: 'NO_RELEVANT_EVIDENCE',
      retrievalTrace: { candidatesSeen: 0, candidatesAdmitted: 0, lanesUnavailable: [] },
    },
  }),
  degraded: () => ({
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
  /* the search completed; the relevant items were all Reuters-host, withheld (PUBLISHER_RIGHTS_HOLD) */
  rightsWithheld: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews', 'gdelt-doc'],
      rightsExcluded: { count: 3, reasons: { PUBLISHER_RIGHTS_HOLD: 3 }, sourceIds: ['reuters'] },
      retrievalTrace: { candidatesSeen: 3, candidatesAdmitted: 0, lanesUnavailable: [] },
    },
  }),
  /* items withheld for rights AND a source failed: the search did not complete */
  rightsAndDegraded: () => ({
    ...EMPTY,
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews'],
      providerFailures: [{ providerId: 'gdelt-doc', kind: 'rate-limited' }],
      rightsExcluded: { count: 2, reasons: { PUBLISHER_RIGHTS_HOLD: 2 }, sourceIds: ['reuters'] },
    },
  }),
  /* some items withheld, other reporting admitted: an ordinary sourced answer */
  rightsBesideEvidence: () => ({
    analysis: {
      headline: 'Sourced headline',
      summary: 'Summary.',
      keyFacts: [{ claim: 'Sourced claim', sourceArticleIds: ['art-1'] }],
    },
    articles: [{ id: 'art-1', url: 'https://news.example/r-1', publishedAt: new Date().toISOString() }],
    retrievalContext: {
      dataMode: 'live',
      providers: ['gnews'],
      rightsExcluded: { count: 1, reasons: { PUBLISHER_RIGHTS_HOLD: 1 }, sourceIds: ['reuters'] },
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
      return RESPONSES[mode]() as Partial<AnalysisApiResponse>;
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
      return { text: 'Reporting could not be used.\n\nGeneral guidance follows.' };
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
      return JSON.parse((await h.adapter.execute(request, plan, 'op-f1')).payloadJson) as {
        answer: { state: string; basis?: string };
        artifact?: { noEvidenceReason?: string; components?: string[] };
        research?: { outcome?: string };
      };
    },
  );
  return { ...h, payload, observation: h.observations[h.observations.length - 1] ?? {} };
}

const rulesOf = (calls: Array<{ jobRules?: string }>) => calls.map((c) => String(c.jobRules ?? ''));

describe('#87 F-1 · the predicate and the observation vocabulary (pure)', () => {
  it.each<[Mode, boolean]>([
    ['noMatch', false],
    ['degraded', false],
    ['rightsWithheld', true],
    ['rightsAndDegraded', false],
    ['rightsBesideEvidence', false],
  ])('%s → retrievalRightsWithheld %s', (mode, expected) => {
    expect(retrievalRightsWithheld(RESPONSES[mode]() as never)).toBe(expected);
  });

  it('a search never attempted is not "rights withheld" (F-3 stays separate)', () => {
    expect(
      retrievalRightsWithheld({ articles: [], retrievalContext: { retrievalAttempted: false, rightsExcluded: { count: 2 } } } as never),
    ).toBe(false);
  });

  it('RIGHTS_WITHHELD is a governed observation code now (it was dropped to NULL before)', () => {
    expect(OBSERVED_RETRIEVAL_OUTCOMES.has('RIGHTS_WITHHELD')).toBe(true);
    expect(governedCode('RIGHTS_WITHHELD', OBSERVED_RETRIEVAL_OUTCOMES)).toBe('RIGHTS_WITHHELD');
    expect(observedRetrievalOf(RESPONSES.rightsWithheld() as never).retrievalOutcome).toBe('RIGHTS_WITHHELD');
    expect(retrievalIncomplete(RESPONSES.rightsAndDegraded() as never)).toBe(true);
  });

  it('the proposed wording asserts neither absence nor outage, and names no publisher', () => {
    expect(RIGHTS_WITHHELD_RULE).toContain('Do not say that no reporting or no findings exist');
    expect(RIGHTS_WITHHELD_RULE).toContain('do not describe this as a technical failure or outage');
    expect(RIGHTS_WITHHELD_RULE).not.toMatch(/reuters/i);
    expect(RIGHTS_WITHHELD_RULE).not.toContain('NO CURRENT FINDINGS');
    expect(RIGHTS_WITHHELD_RULE).not.toContain('SOURCES UNAVAILABLE');
    expect(earlierReportsUnverifiedRule('NO_EVIDENCE', true)).toContain(EARLIER_RIGHTS_WITHHELD_REASON);
    expect(earlierReportsUnverifiedRule('NO_EVIDENCE')).not.toContain(EARLIER_RIGHTS_WITHHELD_REASON);
    expect(noEvidenceReasonText('NO_EVIDENCE', true)).not.toContain('no qualifying reporting');
  });

  it('a rights-withheld record is a NO_EVIDENCE-class gap (search completed), with its own reason', () => {
    const artifact = { provenance: 'SOURCED_REPORTING', currentFindings: 'NONE', noEvidenceReason: 'RIGHTS_WITHHELD' } as never;
    expect(priorEvidenceGap(artifact)).toBe('NO_EVIDENCE');
  });
});

describe.each([
  ['the sentinel question', SENTINEL_Q],
  ['the P0-6 guidance question', FUEL_Q],
])('#87 F-1 · three states through the real executor — %s', (_label, question) => {
  it('completed no-match → NO CURRENT FINDINGS (unchanged)', async () => {
    const t = await ask('noMatch', question);
    expect(t.backgroundCalls).toHaveLength(1);
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(NO_CURRENT_FINDINGS_RULE);
      expect(r).not.toContain(RIGHTS_WITHHELD_RULE);
    }
    expect(t.observation.retrievalOutcome).toBe('COMPLETED_NO_MATCH');
  });

  it('provider-degraded → SOURCES UNAVAILABLE (unchanged, D-28)', async () => {
    const t = await ask('degraded', question);
    expect(t.backgroundCalls).toHaveLength(1);
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(SOURCES_UNAVAILABLE_RULE);
      expect(r).not.toContain(RIGHTS_WITHHELD_RULE);
    }
  });

  it('otherwise-relevant reporting withheld for rights → REPORTING WITHHELD: never "no findings", never "unavailable"', async () => {
    const t = await ask('rightsWithheld', question);
    expect(t.backgroundCalls).toHaveLength(1);
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(RIGHTS_WITHHELD_RULE);
      expect(r).not.toContain(NO_CURRENT_FINDINGS_RULE);
      expect(r).not.toContain(SOURCES_UNAVAILABLE_RULE);
    }
    expect(t.observation.retrievalOutcome).toBe('RIGHTS_WITHHELD');
    /* the reader's research record (FE 639785e has a RIGHTS_WITHHELD case: no "found" claim) */
    expect(t.payload.research?.outcome).toBe('RIGHTS_WITHHELD');
    /* the next turn's memory says withheld, never "no qualifying reporting" */
    expect(t.payload.artifact?.noEvidenceReason).toBe('RIGHTS_WITHHELD');
    expect(JSON.stringify(t.payload.artifact ?? {})).not.toContain('No qualifying reporting');
    /* cost: one retrieval attempt, one background call — nothing added, no retry */
    expect(t.analysisCalls).toHaveLength(1);
    expect(t.observation.providerCallCount).toBe(2);
    expect(t.observation.modelInvocationCount).toBe(1);
  });

  it('PRECEDENCE: rights-withheld beside a failed source → SOURCES UNAVAILABLE (the search did not complete)', async () => {
    const t = await ask('rightsAndDegraded', question);
    expect(t.backgroundCalls).toHaveLength(1);
    for (const r of rulesOf(t.backgroundCalls)) {
      expect(r).toContain(SOURCES_UNAVAILABLE_RULE);
      expect(r).not.toContain(NO_CURRENT_FINDINGS_RULE);
      expect(r).not.toContain(RIGHTS_WITHHELD_RULE);
    }
  });

  it('rights-withheld beside admitted evidence → an ordinary sourced answer, no background call', async () => {
    const t = await ask('rightsBesideEvidence', question);
    expect(t.backgroundCalls).toHaveLength(0);
    expect(t.payload.answer.basis ?? '').not.toMatch(/^PARTIAL_CURRENT_/);
  });
});

describe('#87 F-1 · metering is unchanged', () => {
  it('rights-withheld settles the empty search at 0 units as NO_EVIDENCE and the background call on its own usage', async () => {
    const t = await ask('rightsWithheld', SENTINEL_Q);
    const calls = t.settle.mock.calls as unknown as Array<[string, number | null, string]>;
    expect(calls[0]).toEqual(['r', 0, 'NO_EVIDENCE']);
    expect(calls[1]).toEqual(['r', 400 + 4 * 150, 'SUCCESS']);
    expect(calls).toHaveLength(2);
  });
});
