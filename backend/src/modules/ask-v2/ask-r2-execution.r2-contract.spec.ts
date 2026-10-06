import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskPlan, AskRequest } from './ask-compute.contract';
import type { QuestionAnchors } from '../analysis/query/question-anchors.util';
import { anchoredQueries } from '../analysis/query/question-anchors.util';
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
const evidence = {
  none: false,
  /* R2 §7 — the background capability declines (an entirely-current question) */
  declineBackground: false,
  /* R2 §7 — an earlier answer's evidence is no longer retained (a re-read resolves nothing) */
  notRetained: false,
};
interface Calls {
  analysis: Call[];
  background: Array<{ question: string; priorWork?: string; [k: string]: unknown }>;
}

function harness() {
  const calls: Calls = { analysis: [], background: [] };
  /* R2 §7 — what the fake "retained reporting" holds: every article a search returned, by URL */
  const retained = new Map<string, { id: string; url: string; publishedAt: string }>();
  const analysisService = {
    analyzeNews: jest.fn(async (...args: unknown[]) => {
      calls.analysis.push(args);
      const selection = args[4] as { stories?: Array<{ url: string }> } | undefined;
      /* R2 §7 — a selection re-reads RETAINED reporting: exactly the selected stories, original dates */
      if (selection?.stories !== undefined) {
        const articles = evidence.notRetained
          ? []
          : selection.stories.map((s) => retained.get(s.url)).filter((a) => a !== undefined);
        if (articles.length === 0) return { analysis: null, articles: [] };
        return {
          analysis: {
            headline: 'Re-read headline',
            summary: 'Summary.',
            keyFacts: articles.map((a) => ({ claim: `Claim from ${a!.id}`, sourceArticleIds: [a!.id] })),
          } as never,
          articles: articles as never,
          retrievalContext: { dataMode: 'cached' } as never,
        } satisfies Partial<AnalysisApiResponse>;
      }
      /* ASK R2 — a turn whose retrieval found nothing (the failed-A path) */
      if (evidence.none) return { analysis: null, analysisError: 'No matching reporting.', articles: [] };
      const policy = args[6] as {
        usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
      };
      policy?.usageSink?.({ promptTokens: 1200, completionTokens: 300 });
      const n = calls.analysis.length;
      const articles = [1, 2].map((k) => ({
        id: `art-${n}-${k}`,
        url: `https://news.example/report-${n}-${k}`,
        publishedAt: `2026-10-0${k}T08:00:00.000Z`,
      }));
      for (const a of articles) retained.set(a.url, a);
      return {
        analysis: {
          headline: `Sourced headline ${n}`,
          summary: 'Summary.',
          keyFacts: [
            { claim: `Sourced claim ${n}a`, sourceArticleIds: [`art-${n}-1`] },
            { claim: `Sourced claim ${n}b`, sourceArticleIds: [`art-${n}-2`] },
          ],
        } as never,
        articles: articles as never,
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
      if (evidence.declineBackground) return { text: null };
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
    let preparedPlan: AskPlan | undefined;
    const payload = await askRequestContext.run(
      {
        accountId: 'user-1',
        ipScope: 'ip:v4:203.0.113.7',
        ...(priorQuestion === undefined ? {} : { priorQuestion }),
      } as never,
      async () => {
        const plan = await adapter.prepare(request);
        preparedPlan = plan;
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
      /* ASK R2 · geography — the plan as prepared (scope / countryCount are what ComputeOperation stores) */
      plan: preparedPlan as AskPlan,
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

describe('ASK R2 · geography — a corridor keeps the destination and BOTH routes (TEST B / C)', () => {
  const day = (d: Date) =>
    `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
  const today = day(new Date());
  /* TEST C — verbatim from the contract, asked today */
  const TEST_C = `As of ${today}, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.\nPrioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.`;
  /* TEST B (paraphrase) — a longer equivalent that names the countries of both ports explicitly */
  const TEST_B = `As of ${today}, I run a small business importing goods into Rwanda via Mombasa, Kenya, or Dar es Salaam, Tanzania. Identify up to five developments reported in the past seven days that affect this import route: ports, border crossings, road and rail transport, customs and clearance, fuel supply and prices, and security along the corridors. Include events in the EU or the Middle East only where the reporting shows a link to these routes. Prioritize official and credible local sources. Present a concise table with: development, event date and publication date, affected route, reported facts, likely impact on my business, and source link. Keep reported facts, forecasts and your analysis separate. Flag coverage gaps — the absence of reports does not mean the absence of disruption. Finish with three practical checks I should make as an importer. Keep it under 600 words.`;
  /* TEST B — VERBATIM from the contract (multi-paragraph, 1,093 chars), asked today */
  const TEST_B_VERBATIM = `As of ${today}, what developments reported during the previous seven days could materially affect a small business importing goods into Rwanda through either Mombasa, Kenya, or Dar es Salaam, Tanzania?
Investigate port and border operations, transport disruptions, customs or trade-policy changes, fuel costs, and security. Include developments in the EU or Middle East only when evidence establishes a relevant connection to these routes.
Select up to five developments, prioritizing official notices and credible local reporting. Present a concise table showing: development; event date and publication date; affected route or location; reported facts; likely business impact; and a clickable supporting source.
Distinguish confirmed changes from forecasts and your own analysis. Do not assume a disruption exists. If you find no relevant update for a category or route, explain the coverage gap rather than treating silence as proof that conditions are normal.
Finish with three practical checks the importer should make next, explaining why. Keep the complete answer under 600 words.`;
  const UGANDA =
    'Which developments from the past seven days affect a small business importing into Uganda via Mombasa or Dar es Salaam? Cover ports, borders, customs and fuel, in a short table with sources.';

  const scopeOf = (plan: AskPlan) => (JSON.parse(plan.scope) as { geography: string[] }).geography;
  const anchorsOf = (call: unknown[]) =>
    (call[6] as { questionAnchors?: QuestionAnchors }).questionAnchors;

  it.each([
    ['TEST C', TEST_C, 'RWA'],
    ['TEST B', TEST_B, 'RWA'],
    ['TEST B (verbatim)', TEST_B_VERBATIM, 'RWA'],
    ['paraphrase (Uganda)', UGANDA, 'UGA'],
  ])('%s: typed geography = destination first, then BOTH corridors; countryCount 3', async (_n, q, dest) => {
    const c = conversation();
    const t = await c.ask(q);
    expect(scopeOf(t.plan)).toEqual([
      `TYPED_GEOGRAPHY:${dest}`,
      'TYPED_GEOGRAPHY:KEN',
      'TYPED_GEOGRAPHY:TZA',
    ]);
    expect(t.plan.countryCount).toBe(3);
  });

  it.each([
    ['TEST C', TEST_C, 'Rwanda'],
    ['TEST B', TEST_B, 'Rwanda'],
    ['TEST B (verbatim)', TEST_B_VERBATIM, 'Rwanda'],
    ['paraphrase (Uganda)', UGANDA, 'Uganda'],
  ])('%s: retrieval is anchored on the corridor and each route is searched (bounded: two)', async (_n, q, dest) => {
    const c = conversation();
    const t = await c.ask(q);
    expect(t.analysisCalls).toHaveLength(1);
    const anchors = anchorsOf(t.analysisCalls[0]);
    expect(anchors?.relation).toBe('CORRIDOR');
    expect(anchors?.actors.map((a) => `${(a as { role?: string }).role}:${a.key}`)).toEqual([
      expect.stringMatching(/^DESTINATION:/),
      'ROUTE:KEN',
      'ROUTE:TZA',
    ]);
    /* EU / Middle East are conditional ("only with an evidenced link"): never an actor of their own */
    expect(anchors?.actors.some((a) => a.key.startsWith('region:'))).toBe(false);
    expect(anchoredQueries(anchors!)).toEqual([`Mombasa ${dest}`, `Dar es Salaam ${dest}`]);
  });

  it('"…through Dar es Salaam, not Mombasa": Rwanda stays the destination; Mombasa is an exclusion, never retrieved', async () => {
    const c = conversation();
    await c.ask(TEST_C);
    const t = await c.ask(
      'My shipment goes through Dar es Salaam, not Mombasa. What has changed on that route recently?',
    );
    expect(scopeOf(t.plan)).toEqual(['TYPED_GEOGRAPHY:RWA', 'TYPED_GEOGRAPHY:TZA']);
    expect(scopeOf(t.plan)).not.toContain('TYPED_GEOGRAPHY:KEN');
    expect(t.plan.countryCount).toBe(2);
    expect(t.analysisCalls).toHaveLength(1);
    const anchors = anchorsOf(t.analysisCalls[0]);
    expect(anchors?.relation).toBe('CORRIDOR');
    expect(anchors?.actors.map((a) => `${(a as { role?: string }).role}:${a.key}`)).toEqual(['DESTINATION:RWA', 'ROUTE:TZA']);
    expect(anchoredQueries(anchors!)).toEqual(['Dar es Salaam Rwanda']);
  });

  it('bilateral relationship (TEST E) keeps its own scope — no corridor reading', async () => {
    const c = conversation();
    const t = await c.ask(TEST_E);
    expect(anchorsOf(t.analysisCalls[0])?.relation).not.toBe('CORRIDOR');
    expect(scopeOf(t.plan)).toEqual(['TYPED_GEOGRAPHY:COD']);
  });
});

/* ════════════════════════════════════════════════════════════════════════════════════════════
   ASK RETRIEVAL / CONVERSATION R2 (contract §7) — FOLLOW-UPS ON THE EARLIER ANSWER (TEST G / D)
   A follow-up must reference the prior user intent AND the actual outcome of the prior answer:
   after a sourced answer its evidence is re-read (original dates, no fresh unrelated search) and
   its subject / place / window are kept and disclosed; after a failed answer that outcome is
   stated, one new search runs only for the same scope, and the failed turn is never evidence.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

interface FollowUpPayload {
  answer: { state: string; basis?: string };
  chips: { kind: string; chips?: Array<{ kind: string; value: string; source: string; applied: boolean }> };
  priorAnswer?: { form: string; outcome: string; evidence: string };
  diagnostics: { job: { artifactUsed: { kind: string } | null } };
}
const follow = (t: { payload: unknown }) => t.payload as FollowUpPayload;
const selectionUrls = (call: Call) =>
  ((call[4] as { stories?: Array<{ url: string }> } | undefined)?.stories ?? []).map((s) => s.url);
const policyOf = (call: Call) =>
  call[6] as {
    governed?: { rules: string; data: string };
    reportingWindow?: { statedPeriod: string; from: string; to: string };
  };
const placeChips = (t: { payload: unknown }) =>
  (follow(t).chips.chips ?? []).filter((c) => c.kind === 'GEOGRAPHY').map((c) => c.value);
const timeChips = (t: { payload: unknown }) =>
  (follow(t).chips.chips ?? []).filter((c) => c.kind === 'TIME').map((c) => c.value.toLowerCase());
const urlsOf = (stored: unknown) => (stored as { evidenceUrls?: string[] } | null)?.evidenceUrls ?? [];

const TEST_G1 = 'Put those developments in a table with dates, sources and uncertainty.';
const TEST_G2 = 'Which should a small shopkeeper watch most closely, and why?';
const TEST_D1 =
  'My shipment goes through Dar es Salaam, not Mombasa. Revise your answer to retain only relevant developments and explain what changed. Reuse valid evidence already found; search again only where necessary.';
const todayAsOf = () => {
  const d = new Date();
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
};
const TEST_B = () =>
  `As of ${todayAsOf()}, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. End with three practical checks for the importer. Under 600 words.`;

afterEach(() => {
  evidence.none = false;
  evidence.declineBackground = false;
  evidence.notRetained = false;
});

describe('ASK R2 §7 · TEST G — format / priority follow-ups after a SUCCESSFUL answer', () => {
  it('"Put those developments in a table…" re-reads the earlier evidence — no fresh unrelated search', async () => {
    const c = conversation();
    const a = await c.ask(TEST_A);
    const aUrls = urlsOf(a.stored);
    expect(aUrls).toHaveLength(2);

    const g1 = await c.ask(TEST_G1);
    /* ONE call, on the earlier answer's own evidence; never a search for "put those in a table" */
    expect(g1.analysisCalls).toHaveLength(1);
    expect(selectionUrls(g1.analysisCalls[0])).toEqual(aUrls);
    expect(g1.backgroundCalls).toHaveLength(0);
    expect(follow(g1).priorAnswer).toEqual({ form: 'FORMAT', outcome: 'FINDINGS', evidence: 'REUSED' });
    expect(follow(g1).answer.state).toBe('CURRENT_REPORTING');
    expect(follow(g1).diagnostics.job.artifactUsed?.kind).toBe('SOURCED_REPORT');
    /* the reuse is said to the model: same evidence, original dates, no new check */
    const rules = policyOf(g1.analysisCalls[0]).governed?.rules ?? '';
    expect(rules).toMatch(/no new search was run/);
    expect(rules).toMatch(/original date/);
    /* the earlier intent travels as data: Kenya, small businesses, the seven days */
    const data = policyOf(g1.analysisCalls[0]).governed?.data ?? '';
    expect(data).toMatch(/small businesses in Kenya over the past seven days/);
    expect(data).toContain(TEST_G1);
    /* the scope is disclosed: never "General question" */
    expect(follow(g1).chips.kind).toBe('SCOPED');
    expect(placeChips(g1)).toEqual(['KEN']);
    expect(timeChips(g1)).toEqual(['past seven days']);
  });

  it('"Which should a small shopkeeper watch most closely, and why?" keeps the same subject and evidence', async () => {
    const c = conversation();
    const a = await c.ask(TEST_A);
    const aUrls = urlsOf(a.stored);
    await c.ask(TEST_G1);
    const g2 = await c.ask(TEST_G2);
    expect(g2.analysisCalls).toHaveLength(1);
    /* still the evidence A found (G1 re-read it; G2 re-reads the same stories) */
    expect(selectionUrls(g2.analysisCalls[0])).toEqual(aUrls);
    expect(follow(g2).priorAnswer).toEqual({ form: 'PRIORITY', outcome: 'FINDINGS', evidence: 'REUSED' });
    expect(placeChips(g2)).toEqual(['KEN']);
    expect(timeChips(g2)).toEqual(['past seven days']);
    /* the record keeps A's question and A's ORIGINAL window instants */
    const aScope = (a.stored as { scope?: { window?: unknown } } | null)?.scope;
    const g2Scope = (g2.stored as { scope?: { question: string; countries: string[]; window?: unknown } } | null)
      ?.scope;
    expect(g2Scope?.question).toMatch(/small businesses in Kenya/);
    expect(g2Scope?.countries).toEqual(['KEN']);
    expect(aScope?.window).toBeDefined();
    expect(g2Scope?.window).toEqual(aScope?.window);
  });

  it.each([
    'Can you show these as a table with dates and sources?',
    'Of those, which matters most to a corner-shop owner?',
    'Which one should a market trader worry about most?',
  ])('paraphrase binds the earlier answer: %s', async (q) => {
    const c = conversation();
    const a = await c.ask(TEST_A);
    const t = await c.ask(q);
    expect(t.analysisCalls).toHaveLength(1);
    expect(selectionUrls(t.analysisCalls[0])).toEqual(urlsOf(a.stored));
    expect(follow(t).priorAnswer?.outcome).toBe('FINDINGS');
    expect(placeChips(t)).toEqual(['KEN']);
  });

  it('evidence no longer retained → ONE search in the earlier scope, said as a new search', async () => {
    const c = conversation();
    await c.ask(TEST_A);
    evidence.notRetained = true;
    const g1 = await c.ask(TEST_G1);
    expect(g1.analysisCalls).toHaveLength(2);
    expect(String(g1.analysisCalls[1][0])).toMatch(/small businesses in Kenya over the past seven days/);
    expect(policyOf(g1.analysisCalls[1]).reportingWindow?.statedPeriod).toBe('past seven days');
    expect(policyOf(g1.analysisCalls[1]).governed?.rules).toMatch(/a new search was run now/);
    expect(follow(g1).priorAnswer).toEqual({ form: 'FORMAT', outcome: 'FINDINGS', evidence: 'SEARCHED_AGAIN' });
  });

  it('a self-contained new question, or a format turn about a NEW place, is not bound', async () => {
    const c = conversation();
    await c.ask(TEST_A);
    const fresh = await c.ask('Which countries raised interest rates this week?');
    expect(follow(fresh).priorAnswer).toBeUndefined();
    expect(fresh.analysisCalls.every((call) => selectionUrls(call).length === 0)).toBe(true);
    const c2 = conversation();
    await c2.ask(TEST_A);
    const elsewhere = await c2.ask('Put those developments for Uganda in a table.');
    expect(follow(elsewhere).priorAnswer).toBeUndefined();
  });
});

describe('ASK R2 §7 · TEST G — follow-ups after a FAILED (no-evidence) answer', () => {
  it('the failed A is an honest no-evidence answer: its current-news question never goes to reasoning', async () => {
    evidence.none = true;
    const c = conversation();
    const a = await c.ask(TEST_A);
    /* the explanatory part depends on the findings: nothing is answerable from background */
    expect(a.backgroundCalls).toHaveLength(0);
    expect(follow(a).answer.state).toBe('INSUFFICIENT');
    expect((a.payload as unknown as { background: unknown }).background).toBeNull();
  });

  it('G1 / G2 keep Kenya, small businesses and the window, say nothing was found, and never fabricate', async () => {
    evidence.none = true;
    const c = conversation();
    await c.ask(TEST_A);
    for (const [q, form] of [
      [TEST_G1, 'FORMAT'],
      [TEST_G2, 'PRIORITY'],
    ] as const) {
      const t = await c.ask(q);
      /* the earlier outcome is stated, and the new search that DID run is said */
      expect(follow(t).priorAnswer).toEqual({ form, outcome: 'NO_FINDINGS', evidence: 'SEARCHED_AGAIN' });
      /* ONE new search, for the SAME scope (A's question and window) — not the follow-up words */
      expect(t.analysisCalls).toHaveLength(1);
      expect(String(t.analysisCalls[0][0])).toMatch(/small businesses in Kenya over the past seven days/);
      expect(selectionUrls(t.analysisCalls[0])).toEqual([]);
      expect(policyOf(t.analysisCalls[0]).reportingWindow?.statedPeriod).toBe('past seven days');
      expect(policyOf(t.analysisCalls[0]).governed?.rules).toMatch(/found no verified reporting/);
      /* nothing found again → the honest insufficient answer; never a reasoning stand-in */
      expect(t.backgroundCalls).toHaveLength(0);
      expect(follow(t).answer.state).toBe('INSUFFICIENT');
      expect(placeChips(t)).toEqual(['KEN']);
      expect(timeChips(t)).toEqual(['past seven days']);
    }
  });

  it('paraphrase after failure: "Turn them into a table with dates."', async () => {
    evidence.none = true;
    const c = conversation();
    await c.ask(TEST_A);
    const t = await c.ask('Turn them into a table with dates.');
    expect(follow(t).priorAnswer?.outcome).toBe('NO_FINDINGS');
    expect(String(t.analysisCalls[0][0])).toMatch(/Kenya/);
  });

  it('when the new search DOES find reporting, the answer stands on it — the earlier outcome still said', async () => {
    evidence.none = true;
    const c = conversation();
    await c.ask(TEST_A);
    evidence.none = false;
    const g1 = await c.ask(TEST_G1);
    expect(follow(g1).answer.state).toBe('CURRENT_REPORTING');
    expect(follow(g1).priorAnswer).toEqual({ form: 'FORMAT', outcome: 'NO_FINDINGS', evidence: 'SEARCHED_AGAIN' });
    expect(policyOf(g1.analysisCalls[0]).governed?.rules).toMatch(/never present that earlier answer as findings/);
  });
});

describe('ASK R2 §7 · TEST D — a route change revises the earlier answer', () => {
  it('after a SUCCESSFUL corridor answer: earlier evidence re-read, Rwanda + window kept, Mombasa excluded', async () => {
    const c = conversation();
    const b = await c.ask(TEST_B());
    const bUrls = urlsOf(b.stored);
    expect(bUrls.length).toBeGreaterThan(0);
    const d = await c.ask(TEST_D1);
    expect(d.analysisCalls).toHaveLength(1);
    expect(selectionUrls(d.analysisCalls[0])).toEqual(bUrls);
    expect(follow(d).priorAnswer).toEqual({ form: 'REVISION', outcome: 'FINDINGS', evidence: 'REUSED' });
    /* the destination stays; the excluded port's country is never shown as scope */
    expect(placeChips(d)).toContain('RWA');
    expect(placeChips(d)).toContain('TZA');
    expect(placeChips(d)).not.toContain('KEN');
    expect(timeChips(d)).toEqual(['in the past seven days']);
    /* the correction is the reader's own words, handed over as what to do now */
    const data = policyOf(d.analysisCalls[0]).governed?.data ?? '';
    expect(data).toContain('not Mombasa');
    expect(data).toMatch(/importing into Rwanda/);
    expect(policyOf(d.analysisCalls[0]).governed?.rules).toMatch(/say what changed/);
  });

  it.each([
    'Actually the goods come in via Dar es Salaam rather than Mombasa — update your answer and keep only what still applies.',
    'We route through Dar es Salaam instead of Mombasa. Please adjust the answer accordingly.',
  ])('paraphrase: %s', async (q) => {
    const c = conversation();
    await c.ask(TEST_B());
    const d = await c.ask(q);
    expect(follow(d).priorAnswer?.form).toBe('REVISION');
    expect(placeChips(d)).toContain('RWA');
    expect(placeChips(d)).not.toContain('KEN');
  });

  it('after a FAILED corridor answer: says nothing was found, searches once in the revised scope', async () => {
    evidence.none = true;
    const c = conversation();
    await c.ask(TEST_B());
    const d = await c.ask(TEST_D1);
    expect(follow(d).priorAnswer).toEqual({ form: 'REVISION', outcome: 'NO_FINDINGS', evidence: 'SEARCHED_AGAIN' });
    expect(d.analysisCalls).toHaveLength(1);
    const query = String(d.analysisCalls[0][0]);
    expect(query).toMatch(/importing into Rwanda/);
    expect(query).toContain('not Mombasa');
    expect(policyOf(d.analysisCalls[0]).reportingWindow?.statedPeriod).toBe('in the past seven days');
    expect(d.backgroundCalls).toHaveLength(0);
    expect(follow(d).answer.state).toBe('INSUFFICIENT');
    expect(placeChips(d)).toContain('RWA');
    expect(placeChips(d)).not.toContain('KEN');
  });

  it('after a failed corridor answer whose background DECLINED: the failed search is still the outcome', async () => {
    evidence.none = true;
    evidence.declineBackground = true;
    const c = conversation();
    const b = await c.ask(TEST_B());
    expect(b.stored?.kind).toBe('SOURCED_REPORT');
    const d = await c.ask(TEST_D1);
    expect(follow(d).priorAnswer?.outcome).toBe('NO_FINDINGS');
    expect(String(d.analysisCalls[0][0])).toMatch(/importing into Rwanda/);
  });
});

describe('ASK R2 · no evidence never becomes background "developments" (TEST C failed path)', () => {
  const day = (d: Date) =>
    `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
  const TEST_C = `As of ${day(new Date())}, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.\nPrioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.`;

  it('a corridor question whose search finds nothing: no current answer, and any reasoning call is told there are NO current findings', async () => {
    evidence.none = true;
    try {
      const c = conversation();
      const t = await c.ask(TEST_C);
      expect(t.analysisCalls).toHaveLength(1);
      /* the reasoning model may give general guidance (the checks) but is TOLD there are no
         current findings and may not supply developments from memory */
      for (const b of t.backgroundCalls) {
        expect(String((b as { jobRules?: string }).jobRules ?? '')).toContain('NO CURRENT FINDINGS');
      }
      expect(t.payload.answer.state).not.toBe('CURRENT_REPORTING');
    } finally {
      evidence.none = false;
    }
  });
});

describe('ASK R2 LIVE-GATE REPAIR · P0-1 — the live TEST A wording keeps Kenya (never "| Date |" → Japan)', () => {
  const LIVE_A =
    'What are the three most important developments reported in the past seven days that could affect a small shop owner in Kenya? Start with a two-sentence summary. Then use a compact table: What changed | Date | Why it matters to the shop | Source link. Prioritize credible Kenyan reporting and official sources. Separate reported facts from your analysis. If you can verify fewer than three developments, show only those. Finish with one practical thing the shopkeeper should check next. Keep the entire answer under 250 words.';
  it('typed geography is KEN only; the full question reaches analysis', async () => {
    const c = conversation();
    const t = await c.ask(LIVE_A);
    expect((JSON.parse(t.plan.scope) as { geography: string[] }).geography).toEqual(['TYPED_GEOGRAPHY:KEN']);
    expect(String(t.analysisCalls[0][0])).toContain('What changed | Date | Why it matters to the shop | Source link');
  });
});
