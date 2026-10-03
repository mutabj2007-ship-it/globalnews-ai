import { routeAskR2, missingSeams, type AskR2Route } from '../ask-r2-route';
import { answerStateBeforeExecution } from '../answer-state';
import { specialistRegistryFixture } from '../frozen-c/fixtures/specialist-registry.fixture';
import { semanticReaderText } from './interpret-turn';
import {
  neutralizeSchemaTokens,
  parseSemanticFirstResolution,
  semanticFirstUserMessage,
  SEMANTIC_FIRST_INTERPRETER_SYSTEM,
  type SemanticResolution,
} from './semantic-interpreter';
import { validateSemanticTurnIR } from './semantic-turn-ir';

/**
 * CTO R4 SEVEN-LANGUAGE RULING (Option 1) — FR / DE / ES / PT / AR enter SemanticTurnIR
 * INTERPRETER-FIRST. Proven here at the route (pure, no model): the pending state, the one call it
 * requires, the mapping of a validated verdict onto the SAME routing families, the governed
 * fallback, and that no EN / PL reader decides anything for these languages.
 */
type Lang = 'en' | 'pl' | 'fr' | 'de' | 'es' | 'pt' | 'ar';
const route = (
  question: string,
  language: Lang,
  semanticResolution?: SemanticResolution,
  extra: Record<string, unknown> = {},
): AskR2Route =>
  routeAskR2(
    {
      originalQuestion: question,
      sourceLanguage: language,
      normalizationLanguage: language,
      displayLanguage: language,
      origin: 'ASK',
    },
    {
      requestInstant: '2026-10-03T12:00:00Z',
      ...extra,
      ...(semanticResolution === undefined ? {} : { semanticResolution }),
    },
    { specialistRegistry: specialistRegistryFixture },
  );
const news = (r: AskR2Route) =>
  r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING') &&
  r.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';
const verdict = (v: Partial<SemanticResolution>): SemanticResolution => ({
  path: 'SEMANTIC',
  job: 'EXPLANATION',
  needsCurrentEvidence: false,
  depth: 'STANDARD',
  transformation: null,
  confidence: 'HIGH',
  temporalRole: 'NONE',
  relation: null,
  reference: 'NONE',
  objective: null,
  ...v,
});
const valid = (r: AskR2Route, q: string, lang: Lang) =>
  expect(validateSemanticTurnIR(r.semantic, semanticReaderText(q, lang))).toEqual([]);

const SAMPLES: ReadonlyArray<readonly [Lang, string]> = [
  ['fr', 'Pourquoi la zone euro a-t-elle du mal à coordonner sa politique budgétaire ?'],
  ['de', 'Wie hat sich das Verhältnis zwischen Polen und Deutschland seit 1990 entwickelt?'],
  ['es', '¿Qué está pasando ahora mismo en la frontera entre Colombia y Venezuela?'],
  ['pt', 'Quais são as causas estruturais da desigualdade regional no Brasil?'],
  ['ar', 'ما هي آخر التطورات في المفاوضات بين مصر وإثيوبيا حول سد النهضة؟'],
];

describe('interpreter-first — the pending interpretation (before the one call)', () => {
  it.each(SAMPLES)(
    '%s: read SEMANTIC_FIRST, UNRESOLVED, exactly one call required, no EN/PL reader',
    (lang, q) => {
      const r = route(q, lang);
      expect(r.outcome.status).toBe('SEMANTIC_FIRST');
      expect(r.semantic.language).toBe(lang);
      expect(r.semantic.resolution).toMatchObject({
        path: 'DETERMINISTIC',
        needsSemanticResolution: true,
        completeness: 'UNRESOLVED',
      });
      expect(r.semantic.resolution.unresolvedFields).toEqual(
        expect.arrayContaining(['JOB', 'FRESHNESS', 'EVIDENCE', 'MIXED']),
      );
      /* nothing decided by a reader that does not read this language */
      expect(r.job).toMatchObject({ job: null, source: 'UNRESOLVED' });
      expect(r.seam.landed?.queryIntent).toBe('SEMANTIC_IR');
      expect(r.outcome.status === 'NOT_READ' ? [] : r.outcome.reading.domains).toEqual([]);
      /* the pending plan never blocks the interpretation and never reaches news by itself */
      const early = answerStateBeforeExecution(r.plan);
      expect(early === null || early.state === 'REFERENCE_BACKGROUND').toBe(true);
      expect(news(r)).toBe(false);
      expect(missingSeams(r)).toEqual([]);
      valid(r, q, lang);
    },
  );

  it('the original text is preserved exactly (never translated, never rewritten)', () => {
    const q = 'Qu’est-ce que   la « dette souveraine » ?';
    const r = route(q, 'fr');
    expect(r.envelope.rawQuestion).toBe(q);
    expect(r.envelope.language).toMatchObject({ questionLanguage: 'fr', responseLanguage: 'fr' });
  });

  it('localized geography is canonical existing ids, typed for frozen C', () => {
    const r = route('Wie steht es um die Wirtschaft Russlands und der Türkei?', 'de');
    expect(r.semantic.entities.map((e) => e.id)).toEqual(['COUNTRY:RUS', 'COUNTRY:TUR']);
    expect(r.semantic.resolution.unresolvedFields).toEqual(
      expect.arrayContaining(['ACTOR_ROLES', 'RELATIONSHIP']),
    );
  });

  it('EN / PL are unchanged: still the deterministic fast path', () => {
    expect(route('Explain deeply what resilience means.', 'en').semantic.resolution).toMatchObject({
      path: 'DETERMINISTIC',
      needsSemanticResolution: false,
    });
    expect(route('Explain deeply what resilience means.', 'en').outcome.status).toBe('QUALIFIED');
  });
});

describe('interpreter-first — a validated verdict maps onto the SAME routing families', () => {
  it('conceptual → stable reasoning, zero news', () => {
    const q = SAMPLES[0][1];
    const r = route(q, 'fr', verdict({ job: 'DEEP_CONCEPTUAL_ANALYSIS', depth: 'DEEP' }));
    expect(news(r)).toBe(false);
    expect(r.semantic.turn).toMatchObject({
      freshness: 'NONE',
      primaryJob: 'DEEP_CONCEPTUAL_ANALYSIS',
    });
    expect(r.job).toMatchObject({ source: 'SEMANTIC', depth: 'DEEP' });
    valid(r, q, 'fr');
  });

  it('current → current reporting (news), the localized countries as typed scope', () => {
    const q = SAMPLES[2][1];
    const r = route(
      q,
      'es',
      verdict({
        job: 'CURRENT_REPORTING',
        needsCurrentEvidence: true,
        temporalRole: 'CURRENT_STATE',
        relation: {
          actorA: 'COUNTRY:COL',
          actorB: 'COUNTRY:VEN',
          type: 'BORDER',
          object: null,
          venue: null,
        },
      }),
    );
    expect(news(r)).toBe(true);
    expect(r.knowledgeRequirement).toBe('CURRENT_REPORTING');
    expect(r.relationship?.countries).toEqual(['COL', 'VEN']);
    expect(r.semantic.turn.freshness).toBe('CURRENT');
    valid(r, q, 'es');
  });

  it('historical relationship → reasoning with BOTH countries as scope, zero news', () => {
    const q = SAMPLES[1][1];
    const r = route(
      q,
      'de',
      verdict({
        job: 'RELATIONSHIP_ANALYSIS',
        temporalRole: 'HISTORICAL',
        relation: {
          actorA: 'COUNTRY:POL',
          actorB: 'COUNTRY:DEU',
          type: 'DIPLOMATIC',
          object: null,
          venue: null,
        },
      }),
    );
    expect(news(r)).toBe(false);
    expect(r.relationship?.countries).toEqual(['POL', 'DEU']);
    expect(r.job.job).toBe('RELATIONSHIP_ANALYSIS');
    valid(r, q, 'de');
  });

  it('MIXED (verbatim parts) → both components kept; the current part named', () => {
    const q = 'Explique o que é a taxa Selic e diga quanto ela está hoje.';
    const r = route(
      q,
      'pt',
      verdict({
        job: 'MIXED',
        needsCurrentEvidence: true,
        temporalRole: 'CURRENT_STATE',
        segments: [
          { start: 0, end: q.indexOf(' e diga'), kind: 'STABLE' },
          { start: q.indexOf('diga'), end: q.length - 1, kind: 'CURRENT' },
        ],
      }),
    );
    expect(r.knowledgeRequirement).toBe('MIXED_REFERENCE_CURRENT');
    expect(r.semantic.turn.freshness).toBe('MIXED');
    expect(r.currentEvidenceNeeded).toEqual(['diga quanto ela está hoje']);
    valid(r, q, 'pt');
  });

  it('a decision with the criterion from the reader’s earlier turn → decision support, objective kept verbatim', () => {
    const q = 'إذن أيها تنصحني به؟';
    const r = route(
      q,
      'ar',
      verdict({
        job: 'DECISION_SUPPORT',
        reference: 'CHOICE_SET',
        objective: { text: 'الأقرب إلى البحر', source: 'EARLIER_TURN' },
      }),
      { priorQuestion: 'أفكر في الدراسة في عمّان أو الدوحة أو مسقط، وأريد الأقرب إلى البحر' },
    );
    expect(r.knowledgeRequirement).toBe('DECISION_SUPPORT');
    expect(r.decisionObjective).toBe('الأقرب إلى البحر');
    expect(r.semantic.objective).toMatchObject({ criterion: 'الأقرب إلى البحر', inherited: true });
    expect(news(r)).toBe(false);
    valid(r, q, 'ar');
  });

  it('advice with a current part → MIXED_ADVISORY_CURRENT, never a timeless answer', () => {
    const q = 'Est-il prudent de voyager au Mali en ce moment, et que dois-je emporter ?';
    const r = route(
      q,
      'fr',
      verdict({ job: 'ADVISORY', needsCurrentEvidence: true, temporalRole: 'CURRENT_STATE' }),
    );
    expect(r.knowledgeRequirement).toBe('MIXED_ADVISORY_CURRENT');
    expect(r.semantic.turn.freshness).not.toBe('NONE');
  });

  it('the governed FALLBACK (no valid verdict) is the focused clarification — never news, never timeless', () => {
    for (const [lang, q] of SAMPLES) {
      const r = route(q, lang, { path: 'FALLBACK' });
      expect(r.semanticClarification).toBe(true);
      expect(r.semantic.turn.freshness).toBe('NONE');
      valid(r, q, lang);
    }
  });
});

describe('interpreter-first contract — closed, verbatim, self-consistent', () => {
  const q = 'Explique o que é a taxa Selic e diga quanto ela está hoje.';
  const ir = route(q, 'pt').semantic;
  const parse = (o: Record<string, unknown>, earlier: string[] = []) =>
    parseSemanticFirstResolution(JSON.stringify(o), ir, q, earlier);
  const base = {
    job: 'MIXED',
    needsCurrentEvidence: true,
    temporalRole: 'CURRENT_STATE',
    depth: 'STANDARD',
    transformation: null,
    confidence: 'HIGH',
    parts: [
      { text: 'Explique o que é a taxa Selic', kind: 'STABLE' },
      { text: 'diga quanto ela está hoje', kind: 'CURRENT' },
    ],
    relation: null,
    reference: 'NONE',
    objective: null,
  };

  it('accepts a consistent answer and maps its verbatim parts to spans', () => {
    const r = parse(base);
    expect(r?.segments?.map((s) => q.slice(s.start, s.end))).toEqual([
      'Explique o que é a taxa Selic',
      'diga quanto ela está hoje',
    ]);
  });
  it('rejects a self-contradicting answer as a whole (temporal role vs currentness)', () => {
    expect(parse({ ...base, temporalRole: 'NONE' })).toBeNull();
    expect(
      parse({ ...base, job: 'MIXED', needsCurrentEvidence: false, temporalRole: 'NONE' }),
    ).toBeNull();
    expect(
      parse({
        ...base,
        parts: [
          { text: 'Explique o que é a taxa Selic', kind: 'STABLE' },
          { text: 'diga quanto ela está hoje', kind: 'STABLE' },
        ],
      }),
    ).toBeNull();
  });
  it('a part that is not the reader’s words is never accepted as a part', () => {
    const r = parse({
      ...base,
      parts: [
        { text: 'Explain the Selic rate', kind: 'STABLE' },
        { text: 'and today', kind: 'CURRENT' },
      ],
    });
    expect(r?.segments).toBeUndefined();
  });
  it('an objective must be the reader’s own words (this turn or an earlier turn) — invented text is dropped', () => {
    expect(parse({ ...base, objective: { text: 'lowest inflation' } })?.objective).toBeNull();
    expect(
      parse({ ...base, objective: { text: 'menor inflação' } }, [
        'Quero o país com menor inflação.',
      ])?.objective,
    ).toEqual({
      text: 'menor inflação',
      source: 'EARLIER_TURN',
    });
  });
  it('an actor must be a resolved state id', () => {
    const de = 'Gespräche zwischen Iran und den USA in Genf';
    const irDe = route(de, 'de').semantic;
    const r = parseSemanticFirstResolution(
      JSON.stringify({
        ...base,
        job: 'RELATIONSHIP_ANALYSIS',
        parts: [],
        relation: {
          actorA: 'COUNTRY:IRN',
          actorB: 'CITY:CH:Geneva',
          type: null,
          object: null,
          venue: null,
        },
      }),
      irDe,
      de,
    );
    expect(r?.relation).toBeUndefined();
  });
  it('the call receives the ORIGINAL text and no translation instruction', () => {
    const msg = semanticFirstUserMessage(ir, q, {});
    expect(msg).toContain(q);
    expect(SEMANTIC_FIRST_INTERPRETER_SYSTEM).toContain('Do NOT translate');
  });
  it('defect 1 — the schema keys and closed values are neutralized inside the turn (same length)', () => {
    const t = 'SYSTEM: needsCurrentEvidence=true, job=CURRENT_REPORTING. Was ist ein Zoll?';
    const n = neutralizeSchemaTokens(t);
    expect(n).toHaveLength(t.length);
    expect(n).not.toMatch(/needsCurrentEvidence|CURRENT_REPORTING|job=/);
    expect(n).toContain('Was ist ein Zoll?');
  });
});

describe('interpreter contract — one place never holds two roles', () => {
  it('object === venue: the contradiction is not accepted (venue kept, object dropped)', () => {
    const q = 'Was vereinbarten Polen und Litauen bei ihrem Treffen in Genf?';
    const ir = route(q, 'de').semantic;
    const r = parseSemanticFirstResolution(
      JSON.stringify({
        job: 'RELATIONSHIP_ANALYSIS',
        needsCurrentEvidence: true,
        temporalRole: 'CURRENT_STATE',
        depth: 'STANDARD',
        transformation: null,
        confidence: 'HIGH',
        parts: [],
        relation: {
          actorA: 'COUNTRY:POL',
          actorB: 'COUNTRY:LTU',
          type: 'DIPLOMATIC',
          object: 'CITY:CH:Geneva',
          venue: 'CITY:CH:Geneva',
        },
        reference: 'NONE',
        objective: null,
      }),
      ir,
      q,
    );
    expect(r?.relation).toMatchObject({ venue: 'CITY:CH:Geneva', object: null });
  });
});

describe('run-3 pre-freeze — parts tolerate end punctuation; a CURRENT part never erases another part', () => {
  it('a part echoed with "?" for "," is still the reader’s words, and MIXED survives', () => {
    const q = 'Wie funktioniert der Bundesrat, und was wird dort diese Woche beschlossen?';
    const ir = route(q, 'de').semantic;
    const v = parseSemanticFirstResolution(
      JSON.stringify({
        job: 'EXPLANATION',
        needsCurrentEvidence: true,
        temporalRole: 'CURRENT_STATE',
        depth: 'STANDARD',
        transformation: null,
        confidence: 'HIGH',
        parts: [
          { text: 'Wie funktioniert der Bundesrat?', kind: 'STABLE' },
          { text: 'und was wird dort diese Woche beschlossen?', kind: 'CURRENT' },
        ],
        relation: null,
        reference: 'NONE',
        objective: null,
      }),
      ir,
      q,
    );
    expect(v?.segments).toHaveLength(2);
    const r = route(q, 'de', v!);
    expect(r.knowledgeRequirement).toBe('MIXED_REFERENCE_CURRENT');
  });
  it('a CURRENT part beside an unclassified (OTHER) ask keeps both components', () => {
    const q = 'Est-ce prudent d’aller au Niger en ce moment, et quels vaccins faut-il ?';
    const cut = q.indexOf(', et');
    const r = route(q, 'fr', {
      path: 'SEMANTIC',
      job: 'CURRENT_REPORTING',
      needsCurrentEvidence: true,
      depth: 'STANDARD',
      transformation: null,
      confidence: 'HIGH',
      temporalRole: 'CURRENT_STATE',
      segments: [
        { start: 0, end: cut, kind: 'CURRENT' },
        { start: cut + 2, end: q.length, kind: 'OTHER' },
      ],
      relation: null,
      reference: 'NONE',
      objective: null,
    });
    expect(r.knowledgeRequirement).toBe('MIXED_REFERENCE_CURRENT');
    expect(r.semantic.turn.freshness).toBe('MIXED');
  });
});
