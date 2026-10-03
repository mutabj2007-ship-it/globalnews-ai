import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routeAskR2, type AskR2Route, type AskRouteContext } from '../ask-r2-route';
import { specialistRegistryFixture } from '../frozen-c/fixtures/specialist-registry.fixture';
import { semanticReaderText } from './interpret-turn';
import { parseSemanticResolution, type SemanticResolution } from './semantic-interpreter';
import { validateSemanticTurnIR } from './semantic-turn-ir';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEMANTIC-IR HARDENING GATE
 * ════════════════════════════════════════════════════════════════════════════
 *   §2–§4  completeness: "no reader matched" is never COMPLETE; a routing-material field left
 *          unestablished escalates to the ONE bounded interpretation — obvious turns never do
 *   §5     the governed fallback after an interpreter failure: stable reasoning where clearly
 *          safe, otherwise a focused clarification; never ambiguous → news, never clearly
 *          current → a timeless assertion
 *   §9     an unknown place is an unresolved PLACE candidate, never an invented country actor
 *   §11    the IR is the only routing authority (static + behavioural proof)
 *   §12    contradictions are resolved by composition precedence, not token order
 * Fresh sentences: none is an inspected sealed / blind item.
 */
const route = (q: string, ctx: AskRouteContext = {}, lang: 'en' | 'pl' = 'en'): AskR2Route =>
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
const plansNews = (r: AskR2Route): boolean =>
  r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING') &&
  r.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';
const FALLBACK: SemanticResolution = { path: 'FALLBACK' };
const verdict = (
  needsCurrentEvidence: boolean,
  extra: Partial<SemanticResolution> = {},
): SemanticResolution => ({
  path: 'SEMANTIC',
  job: needsCurrentEvidence ? 'CURRENT_REPORTING' : 'EXPLANATION',
  needsCurrentEvidence,
  ...extra,
});

describe('§2–§4 completeness — obvious turns are COMPLETE and never call the interpreter', () => {
  it.each([
    'Explain photosynthesis.',
    'What happened in Kenya today?',
    'Explain deeply what resilience means.',
    'Why did Peru and Chile fight the War of the Pacific in 1879?',
    'Turn that into a checklist.',
    'Wyjaśnij, jak działa fotosynteza.',
  ])('%s', (q) => {
    const lang = /Wyjaśnij/.test(q) ? 'pl' : 'en';
    const r = route(
      q,
      q.startsWith('Turn') ? { priorWork: { kind: 'PLAN', label: 'x' } } : {},
      lang,
    );
    expect(r.semantic.resolution).toMatchObject({
      completeness: 'COMPLETE',
      unresolvedFields: [],
      needsSemanticResolution: false,
    });
  });
});

describe('§3 silent-miss classes now ESCALATE (PARTIAL), with no reader conflict', () => {
  it('freshness on a lexical basis only ("the negotiations" — which ones?)', () => {
    const r = route('Where do the negotiations stand?');
    expect(r.semantic.resolution).toMatchObject({
      completeness: 'PARTIAL',
      unresolvedFields: ['FRESHNESS', 'EVIDENCE'],
      needsSemanticResolution: true,
    });
  });
  it('a current clause beside an interrogative clause no reader classified', () => {
    const r = route('What happened in Kenya today, and who benefits?');
    expect(r.semantic.resolution.unresolvedFields).toContain('MIXED');
    expect(r.semantic.resolution.needsSemanticResolution).toBe(true);
  });
  it('two states joined by an unknown predicate ("rebuked")', () => {
    const r = route('Japan rebuked China over the drills.');
    expect(r.semantic.resolution.unresolvedFields).toEqual(
      expect.arrayContaining(['ACTOR_ROLES', 'RELATIONSHIP']),
    );
    expect(r.semantic.resolution.needsSemanticResolution).toBe(true);
  });
  it('the same predicate the grammar KNOWS is COMPLETE ("accused")', () => {
    const r = route('Japan accused China over the drills.');
    expect(r.semantic.resolution.unresolvedFields).not.toContain('ACTOR_ROLES');
    expect(r.relationship?.countries).toEqual(['JPN', 'CHN']);
  });
  it('a located particular state ("the situation in eastern DRC") is NOT weak freshness', () => {
    const r = route('How serious is the situation in eastern DRC?');
    expect(r.semantic.resolution.unresolvedFields).not.toContain('FRESHNESS');
  });
  it('a missing decision objective is recorded but NOT escalated (the interpreter cannot supply it)', () => {
    const r = route('Which one should I choose?', { priorQuestion: 'Compare A and B.' });
    if (r.semantic.resolution.unresolvedFields.includes('DECISION_OBJECTIVE'))
      expect(
        r.semantic.resolution.unresolvedFields.filter((f) => f !== 'DECISION_OBJECTIVE'),
      ).toEqual(r.semantic.resolution.unresolvedFields.filter((f) => f !== 'DECISION_OBJECTIVE'));
  });
});

describe('§5 governed outcomes after interpretation', () => {
  it('weak freshness + interpreter: current → news; not current → stable reasoning', () => {
    expect(
      plansNews(route('Where do the negotiations stand?', { semanticResolution: verdict(true) })),
    ).toBe(true);
    const r = route('Where do the negotiations stand?', { semanticResolution: verdict(false) });
    expect(plansNews(r)).toBe(false);
    expect(r.semantic.turn.freshness).toBe('NONE');
  });
  it('weak freshness + interpreter FAILURE → focused clarification, never news', () => {
    const r = route('Where do the negotiations stand?', { semanticResolution: FALLBACK });
    expect(r.semanticClarification).toBe(true);
    expect(r.semantic.turn.freshness).toBe('NONE');
  });
  it('unclassified MIXED + FAILURE → both components kept (MIXED)', () => {
    const r = route('What happened in Kenya today, and who benefits?', {
      semanticResolution: FALLBACK,
    });
    expect(r.knowledgeRequirement).toBe('MIXED_REFERENCE_CURRENT');
  });
  it('unresolved job + FAILURE → stable reasoning (no currentness evidence at all): never news', () => {
    const r = route('Are we nearing a turning point?', {
      semanticResolution: { path: 'FALLBACK', job: 'EXPLANATION', needsCurrentEvidence: false },
    });
    expect(plansNews(r)).toBe(false);
    expect(r.semanticClarification).not.toBe(true);
  });
  it('clearly current (explicit strong marker) + FAILURE → stays current: never a timeless assertion', () => {
    const r = route('What is the current deposit rate of the central bank?', {
      semanticResolution: FALLBACK,
    });
    expect(r.semantic.turn.freshness).toBe('CURRENT');
  });
});

describe('§9 an unknown place is an unresolved PLACE — never an invented country actor', () => {
  it('a venue the gazetteer does not know', () => {
    const r = route(
      'What came out of the talks between Kenya and Uganda held in Zarvana this week?',
    );
    const place = r.semantic.entities.find((e) => e.type === 'PLACE');
    expect(place).toMatchObject({
      surface: 'Zarvana',
      iso3: null,
      parentIso3: null,
      role: 'VENUE',
    });
    expect(r.relationship?.countries).toEqual(['KEN', 'UGA']);
    expect(
      validateSemanticTurnIR(
        r.semantic,
        semanticReaderText(
          'What came out of the talks between Kenya and Uganda held in Zarvana this week?',
          'en',
        ),
      ),
    ).toEqual([]);
  });
  it('the interpreter cannot promote it into an actor', () => {
    const r = route(
      'What came out of the talks between Kenya and Uganda held in Zarvana this week?',
    );
    const place = r.semantic.entities.find((e) => e.type === 'PLACE')!;
    const parsed = parseSemanticResolution(
      JSON.stringify({
        job: 'CURRENT_REPORTING',
        needsCurrentEvidence: true,
        relation: {
          actorA: 'COUNTRY:KEN',
          actorB: place.id,
          type: null,
          object: null,
          venue: null,
        },
      }),
      r.semantic,
    );
    expect(parsed?.relation).toBeUndefined();
  });
});

describe('§12 contradictions — composition precedence, not token order', () => {
  it.each([
    'What is inflation, and what is the current rate in Poland?',
    'Define deflation; what is the present rate in Hungary?',
  ])('stable concept + current figure → MIXED: %s', (q) => {
    const r = route(q);
    expect(r.knowledgeRequirement).toBe('MIXED_REFERENCE_CURRENT');
    expect(r.semantic.turn.freshness).toBe('MIXED');
  });
  it.each([
    'What is the current meaning of resilience?',
    'What is the current definition of a planet?',
  ])('a conceptual "current" is not automatic news — it escalates, default stable: %s', (q) => {
    const r = route(q);
    expect(plansNews(r)).toBe(false);
    expect(r.semantic.resolution.needsSemanticResolution).toBe(true);
    expect(r.semantic.resolution.conflicts).toContain('WEAK_CURRENTNESS_IN_EXPLANATION');
  });
  it.each(['Tell me what happened in 1997 today', 'What did the 1989 elections decide right now?'])(
    'a completed past anchor + a present marker in ONE clause is ambiguous, never news by accident: %s',
    (q) => {
      const r = route(q);
      expect(r.semantic.resolution.conflicts).toContain('TEMPORAL_AMBIGUOUS');
      expect(r.semantic.resolution.needsSemanticResolution).toBe(true);
      expect(plansNews(r)).toBe(false);
      /* the interpreter may still decide it is a current request */
      expect(plansNews(route(q, { semanticResolution: verdict(true) }))).toBe(true);
    },
  );
  it.each([
    'Explain the historical dispute between Japan and South Korea and whether it is still active.',
    'Describe the history of the dispute between Peru and Ecuador, and is it resolved now?',
  ])(
    'historical + current about a relationship → MIXED, both actors, current part sourced: %s',
    (q) => {
      const r = route(q);
      expect(r.knowledgeRequirement).toBe('MIXED_REFERENCE_CURRENT');
      expect(r.relationship?.countries.length).toBe(2);
      expect(plansNews(r)).toBe(true);
    },
  );
});

describe('§11 the IR is the ONLY routing authority', () => {
  const ROUTE_SRC = readFileSync(join(__dirname, '..', 'ask-r2-route.ts'), 'utf8');
  const imports = [
    ...ROUTE_SRC.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g),
  ].map((m) => ({ names: m[1], from: m[2] }));
  it('the router imports NO semantic reader (job, freshness, temporal, relationship, clause, objective)', () => {
    const forbidden =
      /\b(?:readUserJob|deriveKnowledgeRequirement|genuineFreshness|particularPhenomenon|readTemporalSemantics|readBilateralRelationship|readClauseIntents|readDecisionSupport|readObjectiveState|readCurrentnessMarkers|normalizeTurn|assignRoles|readEntityCandidates|readAdvisory)\b/;
    const offending = imports.filter((i) => forbidden.test(i.names.replace(/\btype\s+\w+/g, '')));
    expect(offending).toEqual([]);
    /* the only semantic entry point is the composition */
    expect(
      imports.some(
        (i) => i.from === './semantic-ir/interpret-turn' && /\binterpretTurn\b/.test(i.names),
      ),
    ).toBe(true);
  });
  it('after composition the router does not re-read raw text to change job / freshness (no regex tests on the question)', () => {
    const body = ROUTE_SRC.slice(
      ROUTE_SRC.indexOf('const { ir: semantic, decision: d } = interpretTurn('),
    );
    expect(body).not.toMatch(
      /\.test\(\s*(?:readerText|reading\.originalQuestion|request\.originalQuestion)/,
    );
    expect(body).not.toMatch(/\breadUserJob\(|\bderiveKnowledgeRequirement\(|\bgenuineFreshness\(/);
  });
  const SAMPLE = [
    'Explain photosynthesis.',
    'What happened in Kenya today?',
    'What is the current deposit rate of the central bank?',
    'Who is the president of Turkey?',
    'What came out of the talks between Kenya and Uganda held in Zarvana this week?',
    'Are Guyana and Venezuela still arguing over Essequibo?',
    'Why did Norway and Sweden dissolve their union in 1905?',
    'What is inflation, and what is the current rate in Poland?',
    'Tell me what happened in 1997 today',
    'Where do the negotiations stand?',
    'What is the current meaning of resilience?',
    'Japan rebuked China over the drills.',
    'Which one is best?',
  ];
  it.each(SAMPLE)('the route mirrors its IR exactly: %s', (q) => {
    const r = route(q);
    const ir = r.semantic;
    /* job: the route's job IS the IR's primary job */
    expect(r.job.job ?? null).toBe(ir.turn.primaryJob);
    /* relationship code cannot overwrite actor roles */
    const actors = ir.relationships[0];
    expect(r.relationship?.countries ?? null).toEqual(
      actors === undefined
        ? null
        : [actors.actorA, actors.actorB].map((id) => ir.entities.find((e) => e.id === id)!.iso3),
    );
    /* the provider decision derives from the IR: news only when the IR requires current evidence
       (or the one interpretation is still pending) */
    if (plansNews(r))
      expect(
        ir.turn.evidence === 'CURRENT_REPORTING' ||
          ir.turn.evidence === 'OFFICIAL' ||
          ir.resolution.needsSemanticResolution,
      ).toBe(true);
    if (ir.turn.freshness === 'CURRENT' && !ir.resolution.needsSemanticResolution)
      expect(r.plan.terminalState).not.toBe('REFERENCE_BACKGROUND_ONLY');
  });
  it('objective code cannot override the IR: the route objective IS the IR objective', () => {
    const r = route('So which one is best?', {
      conversation: {
        objective: {
          criterion: 'the lowest running cost',
          prefer: null,
          over: null,
          constraints: [],
          sourceTurn: 0,
          sourceSpan: [0, 22],
          target: null,
          inherited: true,
        },
        choiceSet: ['A', 'B'],
      },
    });
    expect(r.decisionObjective).toBe(r.semantic.objective?.criterion);
  });
});
