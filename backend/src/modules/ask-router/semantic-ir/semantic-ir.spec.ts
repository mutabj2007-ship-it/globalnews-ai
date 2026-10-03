import { writeFileSync } from 'node:fs';
import { routeAskR2, type AskRouteContext } from '../ask-r2-route';
import { specialistRegistryFixture } from '../frozen-c/fixtures/specialist-registry.fixture';
import { readConversationalTurn } from '../../ask-v2/conversation/conversation-state';
import { semanticReaderText } from './interpret-turn';
import { readCurrentnessMarkers } from './currentness';
import { readEntityCandidates } from './entities';
import { readObjectiveState } from './objective-state';
import {
  fallbackResolution,
  parseSemanticResolution,
  semanticInterpreterUserMessage,
} from './semantic-interpreter';
import { validateSemanticTurnIR, type SemanticTurnIR } from './semantic-turn-ir';

/**
 * CTO R4 SEMANTIC IR — the schema, the composition's fast path / conflict rules, the bounded
 * interpreter's validation, and the eight reference interpretations returned for architecture
 * review (written to SEMANTIC_IR_EXAMPLES when set). Fresh sentences: none is an inspected
 * sealed / blind item.
 */
const route = (q: string, lang: 'en' | 'pl' = 'en', ctx: AskRouteContext = {}) =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-03T12:00:00Z', ...ctx },
    { specialistRegistry: specialistRegistryFixture },
  );
const valid = (q: string, ir: SemanticTurnIR, lang: 'en' | 'pl' = 'en') =>
  expect(validateSemanticTurnIR(ir, semanticReaderText(q, lang))).toEqual([]);

const EXAMPLES: Record<string, { question: string | string[]; ir: SemanticTurnIR }> = {};
afterAll(() => {
  if (process.env.SEMANTIC_IR_EXAMPLES)
    writeFileSync(process.env.SEMANTIC_IR_EXAMPLES, JSON.stringify(EXAMPLES, null, 2));
});

describe('the eight reference interpretations (CTO §24)', () => {
  it('1 · pure conceptual — fast path, freshness NONE, no news', () => {
    const q = 'Explain in depth why central bank independence matters.';
    const r = route(q);
    EXAMPLES['1 pure conceptual'] = { question: q, ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.turn).toMatchObject({ freshness: 'NONE', evidence: 'NONE', depth: 'DEEP' });
    expect(r.semantic.resolution).toEqual({
      path: 'DETERMINISTIC',
      needsSemanticResolution: false,
      conflicts: [],
      completeness: 'COMPLETE',
      unresolvedFields: [],
    });
  });
  it('2 · current factual — fast path, CURRENT, the place is scope', () => {
    const q = 'What did the government of Ghana announce today?';
    const r = route(q);
    EXAMPLES['2 current factual'] = { question: q, ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.turn).toMatchObject({ freshness: 'CURRENT', evidence: 'CURRENT_REPORTING' });
    expect(r.semantic.entities).toEqual([
      expect.objectContaining({ id: 'COUNTRY:GHA', role: 'SCOPE' }),
    ]);
    expect(r.semantic.resolution.needsSemanticResolution).toBe(false);
  });
  it('3 · MIXED — a stated understanding + a current question, both components kept', () => {
    const q =
      'I get how a currency board works in theory — is Bulgaria still running one right now?';
    const r = route(q);
    EXAMPLES['3 MIXED'] = { question: q, ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.turn.freshness).toBe('MIXED');
    expect(r.semantic.clauses.map((c) => [c.job, c.freshness])).toEqual([
      ['CONTEXT_STATEMENT', 'NONE'],
      ['CURRENT_REPORTING', 'CURRENT'],
    ]);
  });
  it('4 · historical bilateral — both actors, completed past, no news', () => {
    const q = 'Why did Norway and Sweden dissolve their union in 1905?';
    const r = route(q);
    EXAMPLES['4 historical bilateral'] = { question: q, ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.turn.freshness).toBe('NONE');
    expect(r.semantic.relationships[0]).toMatchObject({
      actorA: 'COUNTRY:NOR',
      actorB: 'COUNTRY:SWE',
      temporalRole: 'HISTORICAL',
    });
    expect(r.semantic.relationships[0].relation).toContain('HISTORICAL_RELATION');
  });
  it('5 · two actors + venue — the city is the VENUE, never an actor; its country is not promoted', () => {
    const q = 'What came out of the talks between Ethiopia and Egypt in Vienna this week?';
    const r = route(q);
    EXAMPLES['5 two actors + venue'] = { question: q, ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.relationships[0]).toMatchObject({
      actorA: 'COUNTRY:ETH',
      actorB: 'COUNTRY:EGY',
      venue: 'CITY:AT:Vienna',
    });
    expect(r.relationship?.countries).toEqual(['ETH', 'EGY']);
    expect(r.semantic.entities.some((e) => e.iso3 === 'AUT')).toBe(false);
  });
  it('6 · two actors + disputed object — the object never replaces an actor', () => {
    const q = 'Are Guyana and Venezuela still arguing over Essequibo?';
    const r = route(q);
    EXAMPLES['6 two actors + disputed object'] = { question: q, ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.relationships[0]).toMatchObject({
      actorA: 'COUNTRY:GUY',
      actorB: 'COUNTRY:VEN',
      object: 'REGION:ESSEQUIBO',
      temporalRole: 'CURRENT_STATE',
    });
  });
  it('7 · inherited objective — structured, from the reader two turns back; "best for what?" never asked', () => {
    const turns = [
      "We're choosing a CRM. What matters most to me is keeping onboarding under two weeks, even if the licence costs more.",
      'Compare HubSpot, Pipedrive and Zoho.',
      'How do they price extra seats?',
    ];
    const q = 'So which one is best?';
    const turn = readConversationalTurn(
      q,
      'en',
      [...turns].reverse().map((t) => ({ question: t, language: 'en' })),
    );
    const r = route(q, 'en', {
      conversation: {
        ...(turn?.objective ? { objective: turn.objective } : {}),
        ...(turn?.choiceSet ? { choiceSet: turn.choiceSet } : {}),
      },
      ...(turn?.turnIndex === undefined ? {} : { turnIndex: turn.turnIndex }),
    });
    EXAMPLES['7 inherited objective'] = { question: [...turns, q], ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.objective).toMatchObject({
      criterion: 'keeping onboarding under two weeks',
      constraints: ['even if the licence costs more'],
      sourceTurn: 0,
      inherited: true,
    });
    expect(r.semantic.references).toMatchObject({
      target: 'CHOICE_SET',
      objective: true,
      choiceSet: true,
    });
    expect(r.decisionObjective).toBe('keeping onboarding under two weeks');
    expect(r.job.discourseReference).toBe('PRIOR_WORK');
  });
  it('8 · artifact continuation — a component of earlier work, zero news, no objective needed', () => {
    const q = 'Which of those recommendations is the riskiest?';
    const r = route(q, 'en', { priorWork: { kind: 'RECOMMENDATION', label: 'Expansion plan' } });
    EXAMPLES['8 artifact continuation'] = { question: q, ir: r.semantic };
    valid(q, r.semantic);
    expect(r.semantic.references).toMatchObject({
      artifact: 'RECOMMENDATION',
      target: 'ARTIFACT_COMPONENT',
    });
    expect(r.semantic.turn.freshness).toBe('NONE');
    expect(r.decisionObjective).toBeNull();
    expect(r.knowledgeRequirement).not.toBe('DECISION_SUPPORT');
  });
});

describe('§8 currentness is a semantic FUNCTION, not a word list', () => {
  it.each([
    ['What is the current deposit rate of the ECB?', 'CURRENT_STATE', 'STRONG'],
    ['Has the trade deal been ratified yet?', 'STATUS', 'STRONG'],
    ['Is the border still closed?', 'STATUS', 'STRONG'],
    ['How many have been evacuated so far?', 'SINCE_TO_NOW', 'STRONG'],
    ['Why do banks still use COBOL?', 'CONTEMPORARY', 'WEAK'],
    ['Czy granica jest nadal zamknięta?', 'STATUS', 'STRONG'],
  ] as const)('%s → %s (%s)', (q, fn, strength) => {
    const lang = /[ąęłńśźż]|^Czy/u.test(q) ? 'pl' : 'en';
    expect(readCurrentnessMarkers(q, lang)[0]).toMatchObject({ fn, strength });
  });
  it.each(['What is a current account deficit?', 'How does alternating current reach a house?'])(
    '"current" that is not time: %s',
    (q) =>
      expect(readCurrentnessMarkers(q, 'en').filter((m) => m.strength === 'STRONG')).toEqual([]),
  );
});

describe('§11 / §15 Stage A identity', () => {
  it.each([
    ['Talks between the DRC and Burundi', 'COUNTRY:COD'],
    ['the Republic of the Congo and Gabon', 'COUNTRY:COG'],
    ['Relations between the U.S. and Cuba', 'COUNTRY:USA'],
    ['what are us and uk officials saying', 'COUNTRY:USA'],
  ])('%s → %s', (q, id) => {
    expect(readEntityCandidates(q, 'en').map((e) => e.id)).toContain(id);
  });
  it('"tell us why" — the pronoun is never the United States', () => {
    expect(readEntityCandidates('tell us why inflation happens', 'en')).toEqual([]);
  });
  it('a city is a CITY with its parent, never a country candidate', () => {
    expect(readEntityCandidates('summit held in Geneva', 'en')).toEqual([
      expect.objectContaining({ type: 'CITY', iso3: null }),
    ]);
  });
});

describe('§9 the objective is a STRUCTURED slot (no length cap, preference and constraints split)', () => {
  it('I care more about reliability than raw speed', () => {
    expect(
      readObjectiveState('I care more about reliability than raw speed.', 'en', 2, true),
    ).toMatchObject({
      criterion: 'reliability than raw speed',
      prefer: 'reliability',
      over: 'raw speed',
      sourceTurn: 2,
      inherited: true,
    });
  });
  it('a long objective is captured whole', () => {
    const long =
      'My goal is a laptop light enough to carry between lectures all day, with a battery that survives back-to-back seminars and a keyboard I can type notes on for hours.';
    expect(readObjectiveState(long, 'en', 0, false)?.criterion.length).toBeGreaterThan(120);
  });
  it('PL — "Zależy mi na tym, żeby …, ale …" keeps the constraint apart', () => {
    expect(
      readObjectiveState(
        'Zależy mi na tym, żeby szybko dojeżdżać do pracy, ale mam mały budżet.',
        'pl',
        0,
        false,
      ),
    ).toMatchObject({ criterion: 'szybko dojeżdżać do pracy', constraints: ['mam mały budżet'] });
  });
  it('§10 — model prose is never read: an artifact label is not an objective', () => {
    const r = route('So which one is best?', 'en', {
      priorWork: { kind: 'RECOMMENDATION', label: 'What matters most is cost' },
    });
    expect(r.semantic.objective).toBeNull();
  });
});

describe('§19 conflicts are named; §4 obvious turns have none', () => {
  it.each([
    'What happened in Kenya today?',
    'Explain deeply what resilience means.',
    'Why did Peru and Chile fight the War of the Pacific in 1879?',
  ])('fast path: %s', (q) => expect(route(q).semantic.resolution.conflicts).toEqual([]));
  it('stable question shape + explicit current marker', () => {
    expect(
      route('What is the current reserve requirement for commercial banks?').semantic.resolution
        .conflicts,
    ).toContain('STABLE_SHAPE_WITH_CURRENT_MARKER');
  });
  it('a third place with no role besides two actors', () => {
    expect(
      route(
        'Why has Norway been mediating between Colombia and the FARC rebels and Venezuela lately?',
      ).semantic.resolution.needsSemanticResolution,
    ).toBe(true);
  });
  it('no governed form and no currentness evidence', () => {
    expect(route('Are we approaching our prime moment?').semantic.resolution.conflicts).toEqual([
      'JOB_UNRESOLVED',
    ]);
  });
});

describe('§5 the bounded interpreter returns ONLY closed IR fields, validated against the IR', () => {
  const ir = route(
    'Has anything come out of the talks between Ethiopia and Egypt in Vienna this week?',
  ).semantic;
  it('a valid answer is accepted', () => {
    expect(
      parseSemanticResolution(
        JSON.stringify({
          job: 'CURRENT_REPORTING',
          needsCurrentEvidence: true,
          clauses: [{ id: 0, kind: 'CURRENT' }],
          relation: {
            actorA: 'COUNTRY:ETH',
            actorB: 'COUNTRY:EGY',
            type: 'DIPLOMATIC',
            object: null,
            venue: 'CITY:AT:Vienna',
          },
          reference: 'NONE',
        }),
        ir,
      ),
    ).toMatchObject({
      path: 'SEMANTIC',
      relation: { actorA: 'COUNTRY:ETH', venue: 'CITY:AT:Vienna' },
    });
  });
  it('§12 — a CITY proposed as an actor is rejected; an entity it invents is rejected', () => {
    const cityActor = parseSemanticResolution(
      JSON.stringify({
        job: 'CURRENT_REPORTING',
        needsCurrentEvidence: true,
        relation: {
          actorA: 'COUNTRY:ETH',
          actorB: 'CITY:AT:Vienna',
          type: null,
          object: null,
          venue: null,
        },
      }),
      ir,
    );
    expect(cityActor?.relation).toBeUndefined();
    const invented = parseSemanticResolution(
      JSON.stringify({
        job: 'CURRENT_REPORTING',
        needsCurrentEvidence: true,
        relation: {
          actorA: 'COUNTRY:ETH',
          actorB: 'COUNTRY:AUT',
          type: null,
          object: null,
          venue: null,
        },
      }),
      ir,
    );
    expect(invented?.relation).toBeUndefined();
  });
  it('outside the closed schema → null (the governed fallback applies)', () => {
    expect(parseSemanticResolution('{"job":"NEWS","needsCurrentEvidence":true}', ir)).toBeNull();
    expect(parseSemanticResolution('The answer is …', ir)).toBeNull();
  });
  it('§17 the interpreter sees the bounded state only — never the transcript', () => {
    const msg = semanticInterpreterUserMessage(ir, 'x', {
      objective: 'low risk',
      choiceSet: ['A', 'B'],
      portableSubject: null,
    });
    expect(msg).toContain(
      'Conversation state: the user\'s stated objective: "low risk"; options the user named: ["A","B"]',
    );
    expect(msg).not.toContain('earlier turns');
  });
  it('FALLBACK — an unresolved job is reasoning (never news); any other conflict keeps its governed default', () => {
    expect(
      fallbackResolution(route('Are we approaching our prime moment?').semantic),
    ).toMatchObject({
      path: 'FALLBACK',
      needsCurrentEvidence: false,
    });
    expect(
      fallbackResolution(
        route('What is the current reserve requirement for commercial banks?').semantic,
      ),
    ).toEqual({
      path: 'FALLBACK',
    });
  });
});

describe('the validator enforces the IR invariants', () => {
  const base = route(
    'What came out of the talks between Ethiopia and Egypt in Vienna this week?',
  ).semantic;
  const text = semanticReaderText(
    'What came out of the talks between Ethiopia and Egypt in Vienna this week?',
    'en',
  );
  it("a city as actor, an object replacing an actor, a surface that is not the reader's words", () => {
    const bad: SemanticTurnIR = {
      ...base,
      entities: base.entities.map((e) =>
        e.type === 'CITY'
          ? { ...e, role: 'ACTOR' }
          : e.id === 'COUNTRY:EGY'
            ? { ...e, surface: 'Misr' }
            : e,
      ),
      relationships: [{ ...base.relationships[0], object: base.relationships[0].actorA }],
    };
    expect(validateSemanticTurnIR(bad, text)).toEqual(
      expect.arrayContaining([
        'CITY_AS_ACTOR:CITY:AT:Vienna',
        'ENTITY_SURFACE:COUNTRY:EGY',
        'OBJECT_REPLACES_ACTOR',
      ]),
    );
  });
  it('current freshness without evidence is invalid', () => {
    expect(
      validateSemanticTurnIR(
        { ...base, turn: { ...base.turn, freshness: 'CURRENT', evidence: 'NONE' } },
        text,
      ),
    ).toContain('CURRENT_WITHOUT_EVIDENCE');
  });
});
