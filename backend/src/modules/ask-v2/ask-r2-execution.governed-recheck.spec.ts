import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { conversationOf } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import { validateStoredArtifact, type PriorArtifact } from './conversation/conversation-artifact';
import type { AskR2Route } from '../ask-router/ask-r2-route';
import { selectContributors } from '../ask-intelligence/contributor-selection';
import type { AskContribution } from '../ask-intelligence/ask-contribution.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SHARED GOVERNED RE-CHECK — "Is that still true now?" by the EVIDENCE the earlier answer stood on
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling (Politics R1 on final R4): re-check eligibility is decided by the earlier answer's own
 * evidence references (the stored artifact), not by whether it was classified as sourced news:
 *   reporting-backed  → a current REPORTING re-check (R-5, unchanged);
 *   governed-backed   → a current GOVERNED-RECORD re-check in the same bound scope (EARLIER_TURN),
 *                       zero news; no current governed record → the truthful unavailable answer;
 *   no evidence       → a reasoning re-examination (unchanged).
 * A governed re-check is never silently turned into a generic news search. Real adapter, real
 * selection; only the providers, the model and the governed reads are stubbed.
 */
type Call = unknown[];

function harness(governed: { used: boolean | (() => boolean) }) {
  const analysis: Call[] = [];
  const background: Array<{ question: string; jobRules?: string; governed?: { rules: string; data: string } }> = [];
  const reads: AskR2Route[] = [];
  const usedNow = () => (typeof governed.used === 'function' ? governed.used() : governed.used);
  const contribution = (s: ReturnType<typeof selectContributors>[number]): AskContribution => ({
    contributorId: s.contributorId,
    domain: s.domain,
    status: usedNow() ? 'USED' : 'NO_MATCH',
    applicability: s.applicability,
    observations: usedNow()
      ? [{ reference: `rec-${s.contributorId}`, kind: 'RECORD', label: 'A governed record', value: null, unit: null, period: '2026-09-18',
          geography: s.scope.countryIso3 ?? '', source: { name: 'Governed source', url: 'https://example.org/r', licence: null }, retainedAt: '2026-10-02T12:00:00Z' }]
      : [],
    temporalBasis: 'RETAINED_EVENT_RECORD',
    geographyBasis: s.scope.countryIso3 ?? 'NONE',
    disclosures: usedNow() ? ['RETAINED_NOT_CURRENT'] : [],
    degradationReason: null,
  });
  const adapter = new AskR2ExecutionAdapter(
    { analyzeNews: jest.fn(async (...args: unknown[]) => {
      analysis.push(args);
      const n = analysis.length;
      return { analysis: { headline: `Sourced headline ${n}`, summary: 'Summary.', keyFacts: [{ claim: `Sourced claim ${n}a`, sourceArticleIds: [`art-${n}-1`] }] } as never,
        articles: [{ id: `art-${n}-1` } as never], retrievalContext: {} as never } satisfies Partial<AnalysisApiResponse>;
    }) } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, answerBackground: jest.fn(async (input: { question: string; jobRules?: string; governed?: { rules: string; data: string } }) => { background.push(input); return { text: 'Reasoned answer. It stands on the records shown.' }; }) } as never,
    { config: { outputWeight: 4 }, reserve: jest.fn(async () => ({ admitted: true, reservationId: 'r', estimatedUnits: 1 })), settle: jest.fn(async () => true) } as never,
    { permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' })), record: jest.fn(async () => undefined) } as never,
    { isEnabled: jest.fn(async () => true) } as never,
    { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: jest.fn(async () => true) } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: jest.fn(async (route: AskR2Route) => {
        reads.push(route);
        const considered = selectContributors(route);
        return { considered, contributions: considered.map(contribution) };
      }),
    } as never,
  );
  return { adapter, analysis, background, reads };
}

interface Payload { answer: { state: string; basis?: string }; artifact?: unknown }

function conversation(language: 'en' | 'pl', governed: { used: boolean | (() => boolean) }) {
  const h = harness(governed);
  const earlier: string[] = [];
  let prior: PriorArtifact | undefined;
  let op = 0;
  return async function ask(question: string) {
    const conversational = readConversationalTurn(question, language, [...earlier].reverse().map((q) => ({ question: q, language })));
    const composed = conversational?.composition ?? null;
    const request = { question: composed?.effectiveQuestion ?? question, language, intent: 'ask', ...conversationOf(conversational), ...(prior === undefined ? {} : { priorArtifact: prior }) } as AskRequest;
    const before = { a: h.analysis.length, b: h.background.length, r: h.reads.length };
    const priorQuestion = earlier[earlier.length - 1];
    const id = `op-${++op}`;
    const payload = await askRequestContext.run(
      { accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7', ...(priorQuestion === undefined ? {} : { priorQuestion }) } as never,
      async () => { const plan = await h.adapter.prepare(request); return JSON.parse((await h.adapter.execute(request, plan, id)).payloadJson) as Payload; },
    );
    earlier.push(question);
    const stored = validateStoredArtifact(payload.artifact);
    if (stored !== null) prior = { ...stored, sourceOperationId: id };
    const reads = h.reads.slice(before.r);
    return { payload, stored, analysisCalls: h.analysis.slice(before.a), backgroundCalls: h.background.slice(before.b), read: reads[reads.length - 1] };
  };
}

const RECHECK = 'RE-CHECK OF YOUR EARLIER ANSWER AGAINST CURRENT GOVERNED RECORDS';
/* final R4 81a5034 (smoke R2 B) — the reasoning-only re-check's "nothing current was checked" disclosure */
const UNVERIFIED = 'No current evidence was checked for this answer.';

describe('SHARED GOVERNED RE-CHECK — eligibility from the earlier answer’s evidence references', () => {
  it('1 · reporting-backed earlier answer → a current REPORTING re-check (R-5, unchanged)', async () => {
    const ask = conversation('en', { used: false });
    const t1 = await ask('What is the security situation in Mali?');
    expect(t1.stored?.provenance).toBe('SOURCED_REPORTING');
    const t2 = await ask('Is that still true now?');
    expect(t2.analysisCalls).toHaveLength(1);
    expect(String(t2.analysisCalls[0][0])).toBe('What is the security situation in Mali?');
    expect(t2.backgroundCalls.some((b) => (b.governed?.rules ?? '').includes(RECHECK))).toBe(false);
  });

  it('2 · governed-backed earlier answer → a current GOVERNED re-check in the same bound scope, zero news', async () => {
    const ask = conversation('en', { used: true });
    const t1 = await ask('What did the Sejm decide?');
    expect(t1.analysisCalls).toHaveLength(0); /* answered from governed records, no news */
    expect(t1.stored?.provenance).toBe('GOVERNED_RECORDS');
    expect(t1.stored?.kind).toBe('GOVERNED_RECORD_ANSWER');
    expect((t1.stored?.evidenceRefs ?? []).every((r) => /^GOV:[A-Z_]+:[0-9a-f]{32}$/.test(r))).toBe(true);
    const t2 = await ask('Is that still true now?');
    expect(t2.analysisCalls).toHaveLength(0); /* never a generic news search */
    expect(t2.backgroundCalls).toHaveLength(1);
    expect(t2.backgroundCalls[0].governed?.rules).toContain(RECHECK);
    expect(t2.backgroundCalls[0].governed?.data).toContain('A governed record'); /* the CURRENT governed records */
    expect(t2.read?.inheritedScope?.provenance).toBe('EARLIER_TURN');
    expect(t2.read?.envelope.geography.candidates.some((g) => g.source === 'TYPED_GEOGRAPHY')).toBe(false);
    /* current governed records WERE read: never R4's "nothing current was checked" partial-current answer */
    expect(t2.backgroundCalls[0].jobRules ?? '').not.toContain(UNVERIFIED);
    expect(t2.payload.answer.basis ?? '').not.toMatch(/^PARTIAL_CURRENT_/);
  });

  it('2b · governed-backed earlier answer, no current governed record → the truthful governed no-record answer, zero AI, zero news', async () => {
    let first = true;
    const ask = conversation('en', { used: () => first });
    await ask('What did the Sejm decide?');
    first = false;
    const t2 = await ask('Is that still true now?');
    expect(t2.analysisCalls).toHaveLength(0);
    expect(t2.backgroundCalls).toHaveLength(0);
    /* the existing shared governed answer: consulted, no current record in that scope (zero AI, zero news) */
    expect(t2.payload.answer).toMatchObject({ state: 'RETAINED_RECORD', basis: 'GOVERNED_NO_RECORD' });
  });

  it('3 · earlier answer with no governed evidence references → a reasoning re-examination, never the governed re-check', async () => {
    const ask = conversation('en', { used: false });
    const t1 = await ask('What is the EU AI Act?');
    expect(t1.stored?.provenance).toBe('MODEL_REASONING');
    const t2 = await ask('Is that still true now?');
    expect(t2.analysisCalls).toHaveLength(0);
    expect(t2.backgroundCalls.some((b) => (b.governed?.rules ?? '').includes(RECHECK))).toBe(false);
    /* final R4 preserved: the reasoning re-check names its current part as unverified */
    expect(t2.backgroundCalls[0].jobRules ?? '').toContain(UNVERIFIED);
    expect(t2.payload.answer).toMatchObject({ state: 'REFERENCE_BACKGROUND', basis: 'PARTIAL_CURRENT_UNAVAILABLE' });
  });

  it('an artifact cannot be upgraded to GOVERNED_RECORDS from untrusted input outside a server kind', () => {
    expect(validateStoredArtifact({ kind: 'SUMMARY', label: 'x', components: ['y'], provenance: 'GOVERNED_RECORDS' })?.provenance).toBe('MODEL_REASONING');
    expect(validateStoredArtifact({ kind: 'GOVERNED_RECORD_ANSWER', label: 'x', components: ['y'], provenance: 'GOVERNED_RECORDS', evidenceRefs: ['GOV:POLITICS:' + 'a'.repeat(32)] })?.evidenceRefs).toHaveLength(1);
  });
});
