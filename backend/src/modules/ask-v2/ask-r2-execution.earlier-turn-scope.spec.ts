import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { AskR2ExecutionAdapter } from './ask-r2-execution.adapter';
import { askRequestContext } from './ask-request-context';
import type { AskRequest } from './ask-compute.contract';
import { conversationOf } from './ask-v2.service';
import { readConversationalTurn } from './conversation/conversation-state';
import { validateStoredArtifact, type PriorArtifact } from './conversation/conversation-artifact';
import { executionContractOf } from './execution-contract';
import { routeAskR2, type AskR2Route } from '../ask-router/ask-r2-route';
import { readAnswerRequest } from '../ask-router/semantic-ir/prior-claim';
import { specialistRegistryFixture } from '../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import type { SemanticResolution } from '../ask-router/semantic-ir/semantic-interpreter';
import { selectContributors } from '../ask-intelligence/contributor-selection';
import type { AskContribution } from '../ask-intelligence/ask-contribution.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SHARED R4 CONTINUITY — CTO "EARLIER_TURN SUBJECT CARRY" (required for shared consumers)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * When R4 resolves a turn to a SPECIFIC earlier answer, the execution contract exposes that
 * answer's subject / scope to downstream shared retrieval, with provenance EARLIER_TURN — never
 * relabelled as reader-stated. Measured gap on 5699eb7: "Is that still true now?" re-verified the
 * earlier question but shared contributor selection saw no place (it reads only TYPED_GEOGRAPHY);
 * "Show me the official evidence." / "What changed since the previous stage?" were not bound at all
 * (a news search for the literal words, or reasoning with no referent).
 *
 * The subject here is a Conflict scope (Mali) because that contributor is bound on this line; no
 * assertion and no line of the code under test names a domain, a country or a contributor.
 */

type Call = unknown[];

function harness(used: boolean) {
  const analysis: Call[] = [];
  const background: Array<{ question: string }> = [];
  const reads: AskR2Route[] = [];
  const contribution = (s: ReturnType<typeof selectContributors>[number]): AskContribution => ({
    contributorId: s.contributorId,
    domain: s.domain,
    status: 'USED',
    applicability: s.applicability,
    observations: [],
    temporalBasis: 'RETAINED_EVENT_RECORD',
    geographyBasis: s.scope.countryIso3 ?? 'NONE',
    disclosures: [],
    degradationReason: null,
  });
  const adapter = new AskR2ExecutionAdapter(
    {
      analyzeNews: jest.fn(async (...args: unknown[]) => {
        analysis.push(args);
        const n = analysis.length;
        return {
          analysis: {
            headline: `Sourced headline ${n}`,
            summary: 'Summary.',
            keyFacts: [{ claim: `Sourced claim ${n}a`, sourceArticleIds: [`art-${n}-1`] }],
          } as never,
          articles: [{ id: `art-${n}-1` } as never],
          retrievalContext: {} as never,
        } satisfies Partial<AnalysisApiResponse>;
      }),
    } as never,
    { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
    {
      id: 'openai',
      displayName: 'OpenAI',
      isMock: false,
      answerBackground: jest.fn(async (input: { question: string }) => {
        background.push(input);
        return { text: 'Reasoned answer.' };
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
      /* the real shared selection, so what is asserted is what a contributor would be asked */
      read: jest.fn(async (route: AskR2Route) => {
        reads.push(route);
        const considered = selectContributors(route);
        return { considered, contributions: used ? considered.map(contribution) : [] };
      }),
    } as never,
  );
  return { adapter, analysis, background, reads };
}

interface Payload {
  answer: { state: string; basis?: string };
  diagnostics: { job: { job: string | null; discourseReference: string } };
  artifact?: unknown;
}

function conversation(language: 'en' | 'pl', opts: { used?: boolean } = {}) {
  const h = harness(opts.used === true);
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
    const request = {
      question: composed?.effectiveQuestion ?? question,
      language,
      intent: 'ask',
      ...conversationOf(conversational),
      ...(prior === undefined ? {} : { priorArtifact: prior }),
    } as AskRequest;
    const before = { a: h.analysis.length, b: h.background.length, r: h.reads.length };
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
    if (stored !== null) prior = { ...stored, sourceOperationId: id };
    const reads = h.reads.slice(before.r);
    return {
      payload,
      analysisCalls: h.analysis.slice(before.a),
      backgroundCalls: h.background.slice(before.b),
      read: reads[reads.length - 1],
      selected: reads.length === 0 ? [] : selectContributors(reads[reads.length - 1]),
      stored,
    };
  }
  return { ask };
}

const policyOf = (call: Call) =>
  call[6] as { governed?: { rules: string; data: string }; relationship?: unknown };

const SUBJECT = {
  en: 'What is the security situation in Mali?',
  pl: 'Jaka jest sytuacja bezpieczeństwa w Mali?',
};

describe('SHARED R4 CONTINUITY — the answer-dependent request forms (EN / PL, structural)', () => {
  it.each([
    ['Show me the official evidence.', 'en', 'OFFICIAL_EVIDENCE'],
    ['Can you show me the official sources for that?', 'en', 'OFFICIAL_EVIDENCE'],
    ['Show me the evidence.', 'en', 'EVIDENCE'],
    ['What are the sources for your answer?', 'en', 'EVIDENCE'],
    ['Where does that come from?', 'en', 'EVIDENCE'],
    ['What changed since the previous stage?', 'en', 'CHANGE_SINCE'],
    ['Has anything changed since then?', 'en', 'CHANGE_SINCE'],
    ['Any updates since your last answer?', 'en', 'CHANGE_SINCE'],
    ['Pokaż oficjalne dowody.', 'pl', 'OFFICIAL_EVIDENCE'],
    ['Pokaz oficjalne dowody.', 'pl', 'OFFICIAL_EVIDENCE'],
    ['Podaj mi źródła tej odpowiedzi.', 'pl', 'EVIDENCE'],
    ['Jakie są źródła?', 'pl', 'EVIDENCE'],
    ['Co się zmieniło od poprzedniego etapu?', 'pl', 'CHANGE_SINCE'],
    ['Czy coś się zmieniło od tamtej pory?', 'pl', 'CHANGE_SINCE'],
  ])('"%s" (%s) → %s', (q, lang, kind) => {
    expect(readAnswerRequest(q, lang)).toBe(kind);
  });

  it.each([
    /* a subject of its own: answerable as asked, never bound to an earlier answer */
    ['Show me the official evidence on inflation in Poland.', 'en'],
    ['What changed in Poland since 2020?', 'en'],
    ['Show me the news about Mali.', 'en'],
    ['Is it still true now?', 'en'] /* the claim-validity form — its own reader */,
    ['Is it raining in Kigali now?', 'en'],
    ['Pokaż oficjalne dane o inflacji w Polsce.', 'pl'],
    ['Co się zmieniło w Polsce od 2020 roku?', 'pl'],
    /* FR–AR reach an earlier answer through the interpreter verdict, never a regex bank */
    ['Montre-moi les preuves officielles.', 'fr'],
  ])('"%s" (%s) → not this form', (q, lang) => {
    expect(readAnswerRequest(q, lang)).toBeNull();
  });
});

describe('SHARED R4 CONTINUITY — a bound follow-up inherits the earlier answer’s scope (EARLIER_TURN)', () => {
  it('"Is that still true now?" — the re-verified claim’s subject now reaches shared retrieval (measured gap)', async () => {
    const c = conversation('en');
    const t1 = await c.ask(SUBJECT.en);
    expect(
      t1.selected.map((s) => [s.contributorId, s.scope.countryIso3, s.scope.provenance]),
    ).toEqual([['CONFLICT', 'MLI', undefined] /* the reader's own place: not inherited */]);
    const t2 = await c.ask('Is that still true now?');
    expect(String(t2.analysisCalls[0][0])).toBe(SUBJECT.en);
    expect(t2.read?.inheritedScope).toMatchObject({
      provenance: 'EARLIER_TURN',
      sourceOperationId: 'op-1',
      question: SUBJECT.en,
      countries: ['MLI'],
      evidenceRefs: ['art-1-1'],
      officialOnly: false,
    });
    expect(
      t2.selected.map((s) => [s.contributorId, s.scope.countryIso3, s.scope.provenance]),
    ).toEqual([['CONFLICT', 'MLI', 'EARLIER_TURN']]);
    /* never relabelled as reader-stated: frozen C's envelope carries no typed place for this turn */
    expect(t2.read?.envelope.geography.candidates.some((g) => g.source === 'TYPED_GEOGRAPHY')).toBe(
      false,
    );
  });

  it('"Show me the official evidence." with no governed official record in that scope → truthful, zero AI, zero news', async () => {
    const c = conversation('en');
    await c.ask(SUBJECT.en);
    const t2 = await c.ask('Show me the official evidence.');
    expect(t2.payload.answer).toMatchObject({
      state: 'CAPABILITY_UNAVAILABLE',
      basis: 'OFFICIAL_SOURCE_UNAVAILABLE',
    });
    expect(t2.analysisCalls).toHaveLength(0);
    expect(t2.backgroundCalls).toHaveLength(0);
    expect(t2.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
    /* the governed reads WERE scoped to the earlier answer — they simply had nothing official */
    expect(
      t2.selected.map((s) => [s.contributorId, s.scope.countryIso3, s.scope.provenance]),
    ).toEqual([['CONFLICT', 'MLI', 'EARLIER_TURN']]);
    expect(t2.read?.inheritedScope?.officialOnly).toBe(true);
  });

  it('"Show me the official evidence." with a governed record USED in that scope → answered in THAT scope, official rules', async () => {
    const c = conversation('en', { used: true });
    await c.ask(SUBJECT.en);
    const t2 = await c.ask('Show me the official evidence.');
    expect(t2.payload.answer.state).not.toBe('CAPABILITY_UNAVAILABLE');
    expect(t2.analysisCalls).toHaveLength(1);
    expect(String(t2.analysisCalls[0][0])).toBe(SUBJECT.en); /* never the literal words */
    expect(t2.analysisCalls[0][3]).toBeUndefined(); /* no previous-question steering */
    const governed = policyOf(t2.analysisCalls[0]).governed;
    expect(governed?.rules).toContain('EVIDENCE FOR YOUR EARLIER ANSWER');
    expect(governed?.rules).toContain('OFFICIAL evidence');
    expect(governed?.data).toContain('Sourced claim 1a'); /* the earlier points, as data */
  });

  it('"Show me the evidence." → the earlier answer’s question and scope; its record keeps that scope', async () => {
    const c = conversation('en');
    await c.ask(SUBJECT.en);
    const t2 = await c.ask('Show me the evidence.');
    expect(String(t2.analysisCalls[0][0])).toBe(SUBJECT.en);
    expect(policyOf(t2.analysisCalls[0]).governed?.rules).toContain(
      'EVIDENCE FOR YOUR EARLIER ANSWER',
    );
    expect(t2.stored?.scope).toMatchObject({ question: SUBJECT.en, countries: ['MLI'] });
    /* so the NEXT follow-up still binds the same subject */
    const t3 = await c.ask('Is that still true now?');
    expect(String(t3.analysisCalls[0][0])).toBe(SUBJECT.en);
    expect(t3.selected.map((s) => s.scope.provenance)).toEqual(['EARLIER_TURN']);
  });

  it('"What changed since the previous stage?" → a change analysis in the earlier answer’s scope, no invented stage', async () => {
    const c = conversation('en');
    await c.ask(SUBJECT.en);
    const t2 = await c.ask('What changed since the previous stage?');
    expect(t2.payload.diagnostics.job).toMatchObject({
      job: 'CHANGE_ANALYSIS',
      discourseReference: 'PRIOR_WORK',
    });
    expect(String(t2.analysisCalls[0][0])).toBe(SUBJECT.en);
    const rules = policyOf(t2.analysisCalls[0]).governed?.rules ?? '';
    expect(rules).toContain('CHANGE SINCE YOUR EARLIER ANSWER');
    expect(rules).toContain('never infer or invent a stage');
    expect(
      t2.selected.map((s) => [s.contributorId, s.scope.countryIso3, s.scope.provenance]),
    ).toEqual([['CONFLICT', 'MLI', 'EARLIER_TURN']]);
  });

  it('a two-sided earlier answer keeps BOTH sides for "What changed since then?"', async () => {
    const c = conversation('en');
    await c.ask('What is happening between Rwanda and Tanzania?');
    const t2 = await c.ask('What changed since then?');
    expect(String(t2.analysisCalls[0][0])).toBe('What is happening between Rwanda and Tanzania?');
    expect([...(t2.read?.inheritedScope?.countries ?? [])].sort()).toEqual(['RWA', 'TZA']);
  });

  it.each([
    ['Pokaż oficjalne dowody.', 'OFFICIAL_SOURCE_UNAVAILABLE'],
    ['Co się zmieniło od poprzedniego etapu?', null],
    ['Czy to nadal prawda?', null],
  ])('PL "%s" → bound to the earlier answer, its scope inherited', async (q, basis) => {
    const c = conversation('pl');
    await c.ask(SUBJECT.pl);
    const t2 = await c.ask(q);
    expect(t2.payload.diagnostics.job.discourseReference).toBe('PRIOR_WORK');
    expect(
      t2.selected.map((s) => [s.contributorId, s.scope.countryIso3, s.scope.provenance]),
    ).toEqual([['CONFLICT', 'MLI', 'EARLIER_TURN']]);
    if (basis !== null) {
      expect(t2.payload.answer.basis).toBe(basis);
      expect(t2.analysisCalls).toHaveLength(0);
    } else {
      expect(String(t2.analysisCalls[0][0])).toBe(SUBJECT.pl);
    }
  });
});

describe('SHARED R4 CONTINUITY — carry ONLY with a specific resolved earlier answer', () => {
  it.each([
    ['Show me the official evidence.', 'en'],
    ['What changed since the previous stage?', 'en'],
    ['Pokaż oficjalne dowody.', 'pl'],
    ['Co się zmieniło od poprzedniego etapu?', 'pl'],
  ] as const)(
    '"%s" (%s) with no earlier answer → clarification, zero retrieval (R-4)',
    async (q, lang) => {
      const c = conversation(lang);
      const t = await c.ask(q);
      expect(t.payload.answer).toMatchObject({
        state: 'CLARIFICATION_REQUIRED',
        basis: 'PRIOR_REFERENCE_UNRESOLVED',
      });
      expect(t.analysisCalls).toHaveLength(0);
      expect(t.backgroundCalls).toHaveLength(0);
      expect(t.read).toBeUndefined();
    },
  );

  it('a new explicit subject wins: no inherited scope', async () => {
    const c = conversation('en');
    await c.ask(SUBJECT.en);
    const t2 = await c.ask('What is the security situation in Somalia?');
    expect(t2.read?.inheritedScope).toBeUndefined();
    expect(
      t2.selected.map((s) => [s.contributorId, s.scope.countryIso3, s.scope.provenance]),
    ).toEqual([['CONFLICT', 'SOM', undefined]]);
  });

  it('a request with its own subject is not bound ("…official evidence on inflation in Poland")', async () => {
    const c = conversation('en');
    await c.ask(SUBJECT.en);
    const t2 = await c.ask('Show me the official evidence on inflation in Poland.');
    expect(t2.payload.diagnostics.job.discourseReference).not.toBe('PRIOR_WORK');
    expect(t2.read?.inheritedScope).toBeUndefined();
  });

  it('bare anaphora without a resolver binding carries nothing ("What about it?")', async () => {
    const c = conversation('en');
    await c.ask(SUBJECT.en);
    const t2 = await c.ask('What about it?');
    expect(t2.read?.inheritedScope).toBeUndefined();
    expect(t2.selected.some((s) => s.scope.provenance === 'EARLIER_TURN')).toBe(false);
  });

  it('selection: a place the turn names itself outranks an inherited scope', () => {
    const own = routeAskR2(
      {
        originalQuestion: 'What is the security situation in Somalia?',
        sourceLanguage: 'en',
        normalizationLanguage: 'en',
        displayLanguage: 'en',
        origin: 'ASK',
      } as never,
      { requestInstant: '2026-10-04T12:00:00Z' } as never,
      { specialistRegistry: specialistRegistryFixture } as never,
    );
    const withInherited: AskR2Route = {
      ...own,
      inheritedScope: {
        provenance: 'EARLIER_TURN',
        sourceOperationId: 'op-1',
        question: SUBJECT.en,
        countries: ['MLI'],
        relation: null,
        job: 'CURRENT_REPORTING',
        evidenceRefs: [],
        officialOnly: false,
      },
    };
    expect(
      selectContributors(withInherited).map((s) => [s.scope.countryIso3, s.scope.provenance]),
    ).toEqual([['SOM', undefined]]);
  });
});

describe('SHARED R4 CONTINUITY — interpreter-first (FR / DE / ES / PT / AR): the recheck exposes the same inherited scope', () => {
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
    label: 'Quelle est la situation sécuritaire au Mali ?',
    components: ['Point sourcé A'],
    provenance: 'SOURCED_REPORTING',
    citable: false,
    scope: {
      question: 'Quelle est la situation sécuritaire au Mali ?',
      job: 'CURRENT_REPORTING',
      countries: ['MLI'],
      relation: null,
      freshness: 'CURRENT',
    },
    evidenceRefs: ['art-9'],
    sourceOperationId: 'op-prior',
  };
  it.each([
    ['Est-ce toujours vrai maintenant ?', 'fr'],
    ['Stimmt das jetzt noch?', 'de'],
    ['¿Sigue siendo cierto ahora?', 'es'],
    ['Isso ainda é verdade agora?', 'pt'],
    ['هل ما زال ذلك صحيحًا الآن؟', 'ar'],
  ])('"%s" (%s)', (q, lang) => {
    const r = routeAskR2(
      {
        originalQuestion: q,
        sourceLanguage: lang,
        normalizationLanguage: lang,
        displayLanguage: lang,
        origin: 'ASK',
      } as never,
      {
        requestInstant: '2026-10-04T12:00:00Z',
        semanticResolution: recheck,
        priorWork: { kind: 'SOURCED_REPORT', label: PRIOR.label, provenance: 'SOURCED_REPORTING' },
      } as never,
      { specialistRegistry: specialistRegistryFixture } as never,
    );
    const contract = executionContractOf({
      question: q,
      language: lang,
      route: r,
      priorArtifact: PRIOR,
    });
    expect(contract.kind).toBe('CLAIM_RECHECK');
    expect(contract.inheritedScope).toEqual({
      provenance: 'EARLIER_TURN',
      sourceOperationId: 'op-prior',
      question: PRIOR.scope?.question,
      countries: ['MLI'],
      relation: null,
      job: 'CURRENT_REPORTING',
      evidenceRefs: ['art-9'],
      officialOnly: false,
    });
    expect(
      selectContributors({ ...r, inheritedScope: contract.inheritedScope ?? undefined }).map(
        (s) => [s.contributorId, s.scope.countryIso3, s.scope.provenance],
      ),
    ).toEqual([['CONFLICT', 'MLI', 'EARLIER_TURN']]);
  });
});
