import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { inheritedConversationCountry } from './conversation-place';
import { readConversationalTurn, type ConversationalTurn } from './conversation-state';

/**
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — the conversation as the service drives it: each turn's
 * state is folded from the reader's OWN earlier questions (newest first, excluding the turn), the
 * composed question (if any) goes through the REAL integrated router (frozen C included), and a
 * turn that composes nothing inherits the conversation's place exactly as AskV2Service does.
 * Pure: no I/O, no model, no provider. The live-Postgres composition is
 * conversation-journeys.r3.postgres.spec.ts.
 */
const deps = { specialistRegistry: specialistRegistryFixture };
const INSTANT = '2026-10-03T07:00:00Z';

interface Step {
  readonly turn: ConversationalTurn;
  readonly answered: string;
  readonly route: ReturnType<typeof routeAskR2>;
}

function converse(questions: readonly string[], lang: 'en' | 'pl' = 'en'): Step[] {
  const earlier: { question: string; language: string }[] = [];
  const steps: Step[] = [];
  for (const q of questions) {
    const newestFirst = [...earlier].reverse();
    const turn = readConversationalTurn(q, lang, newestFirst);
    if (turn === null) throw new Error('unreadable');
    const answered = turn.composition?.effectiveQuestion ?? q;
    const place =
      turn.composition === null ? inheritedConversationCountry(q, lang, newestFirst) : null;
    const route = routeAskR2(
      {
        originalQuestion: answered,
        sourceLanguage: lang,
        normalizationLanguage: lang,
        displayLanguage: lang,
        origin: 'ASK',
      },
      { requestInstant: INSTANT, ...(place === null ? {} : { mapContextCountry: place }) },
      deps,
    );
    steps.push({ turn, answered, route });
    earlier.push({ question: q, language: lang });
  }
  return steps;
}

const places = (s: Step) => s.route.envelope.geography.candidates.map((c) => c.value);
const newsCalled = (s: Step) =>
  s.route.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING');

describe('§35 — the long travel journey keeps the trip (PO-03/PO-08 class)', () => {
  const steps = converse([
    'Which places can I visit in Rwanda?',
    'I have five days and prefer nature.',
    'What about Nyungwe instead?',
    'Compare Nyungwe and Volcanoes.',
    'Which is cheaper?',
    'Is there anything current I should know?',
    'And in Kenya?',
    'Compare the same five-day nature trip.',
  ]);

  it('every turn is travel background scoped to the trip — never a country news search', () => {
    for (const s of steps) {
      expect(s.route.knowledgeRequirement).toBe('PLACE_REFERENCE');
      expect(s.route.plan.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
      expect(newsCalled(s)).toBe(false);
    }
  });

  it('turn 2 — the stated constraints become state (duration, interests); the place carries', () => {
    expect(steps[1].turn.state).toMatchObject({
      job: 'TRAVEL_PLANNING',
      geography: ['RWA'],
      duration: '5 days',
      interests: ['nature'],
    });
    expect(steps[1].turn.trace.carried).toEqual(expect.arrayContaining(['job', 'geography']));
    expect(steps[1].answered).toBe(
      'Planning a trip to Rwanda (5 days; interests: nature): I have five days and prefer nature — how should I plan it?',
    );
  });

  it('turn 3 — "What about Nyungwe instead?" replaces the option, carries Rwanda / 5 days / nature', () => {
    expect(steps[2].turn.state.options).toEqual(['Nyungwe']);
    expect(steps[2].turn.trace.carried).toEqual(
      expect.arrayContaining(['job', 'geography', 'duration', 'interests']),
    );
    expect(steps[2].answered).toBe(
      'Planning a trip to Rwanda (5 days; interests: nature): What about Nyungwe instead?',
    );
    expect(places(steps[2])).toEqual(['RWA']);
  });

  it('turns 4–5 — the options under discussion are the members of "Which is cheaper?"', () => {
    expect(steps[3].turn.state.options).toEqual(['Nyungwe', 'Volcanoes']);
    expect(steps[4].answered).toBe(
      'Planning a trip to Rwanda (5 days; interests: nature): Which is cheaper — Nyungwe or Volcanoes?',
    );
  });

  it('turn 6 — a generic "anything current?" in a trip asks for TRAVEL notices, not Rwanda news (§8)', () => {
    expect(steps[5].answered).toBe(
      'Planning a trip to Rwanda (5 days; interests: nature): what current travel notices should I know about?',
    );
  });

  it('turn 7 — "And in Kenya?": geography REPLACED, options DROPPED (scoped to Rwanda), constraints CARRIED', () => {
    const t = steps[6].turn;
    expect(t.state).toMatchObject({
      geography: ['KEN'],
      options: [],
      duration: '5 days',
      interests: ['nature'],
    });
    expect(t.trace.overridden).toEqual(expect.arrayContaining(['geography', 'options']));
    expect(places(steps[6])).toEqual(['KEN']);
  });

  it('turn 8 — "Compare the same five-day nature trip" compares the two places of this conversation', () => {
    expect(steps[7].answered).toBe(
      'Planning a trip to Rwanda and Kenya (5 days; interests: nature): Compare the same five-day nature trip.',
    );
  });

  it('every composition is a JOB_CONTEXT continuation of the reader’s own first question', () => {
    for (const s of steps.slice(1)) {
      expect(s.turn.composition).toMatchObject({
        kind: 'JOB_CONTEXT',
        fromQuestion: 'Which places can I visit in Rwanda?',
      });
    }
  });
});

describe('PO-05 / PO-06 / PO-07 — place, domain and time continuity', () => {
  it('PO-05 Madagascar → "And the economy?": no composition; the place is inherited (economy domain kept)', () => {
    const [, economy] = converse(['What is going on in Madagascar?', 'And the economy?']);
    expect(economy.turn.composition).toBeNull();
    expect(places(economy)).toEqual(['MDG']);
    expect(economy.route.envelope.domains.domains).toContain('economic');
  });

  it('PO-06 Madagascar economy → "And in Kenya?": Kenya REPLACES the place, the economy subject carries', () => {
    const [, kenya] = converse(["How is Madagascar's economy doing?", 'And in Kenya?']);
    expect(kenya.answered).toBe("How is Kenya's economy doing?");
    expect(kenya.turn.composition?.kind).toBe('CROSS_COUNTRY');
    expect(places(kenya)).toEqual(['KEN']);
    expect(kenya.route.plan.terminalState).not.toBe('CLARIFICATION_REQUIRED');
  });

  it('PO-07 "What about yesterday?" changes the time and keeps place + topic; then "And in Kenya?" carries both', () => {
    const steps = converse([
      'What is going on in Madagascar?',
      'And the economy?',
      'What about yesterday?',
      'And in Kenya?',
    ]);
    expect(places(steps[2])).toEqual(['MDG']);
    expect(steps[2].turn.state.topicFollowUp).toBe('And the economy?');
    expect(steps[2].turn.state.period).toBe('yesterday');
    expect(steps[3].answered).toBe('And the economy in Kenya yesterday?');
    expect(places(steps[3])).toEqual(['KEN']);
  });
});

describe('§4 — portable, never blindly copied (negative controls)', () => {
  it('"Who was Napoleon?" → "And in Kenya?" composes NOTHING (no "Napoleon in Kenya")', () => {
    const [, kenya] = converse(['Who was Napoleon?', 'And in Kenya?']);
    expect(kenya.turn.composition).toBeNull();
    expect(kenya.answered).toBe('And in Kenya?');
  });

  it('a self-contained new job resets the job-scoped context (no "nature" carried into history)', () => {
    const steps = converse([
      'Which places can I visit in Rwanda?',
      'I have five days and prefer nature.',
      'What caused the First World War and how did it end?',
    ]);
    expect(steps[2].turn.trace.reset).toBe(true);
    expect(steps[2].turn.composition).toBeNull();
    expect(steps[2].turn.state).toMatchObject({ interests: [], duration: null, geography: [] });
  });

  it('a turn that brings its own story / module context is never composed', () => {
    const turn = readConversationalTurn(
      'Which is cheaper?',
      'en',
      [
        { question: 'Compare Nyungwe and Volcanoes.', language: 'en' },
        { question: 'Which places can I visit in Rwanda?', language: 'en' },
      ],
      { hasOwnContext: true },
    );
    expect(turn?.composition).toBeNull();
  });

  it('a different-language earlier turn is not folded (a language switch is a new reading)', () => {
    const turn = readConversationalTurn('Which is cheaper?', 'en', [
      { question: 'Jakie miejsca warto odwiedzić w Rwandzie?', language: 'pl' },
    ]);
    expect(turn?.composition).toBeNull();
  });
});

describe('§36 — the economic decision journey (state and routing; governed series are a separate gate)', () => {
  const steps = converse([
    'Compare economic growth in Rwanda, Kenya and Tanzania.',
    'Which is strongest for market expansion?',
    'I care more about growth than current market size.',
    'Re-evaluate.',
  ]);

  it('the comparison set carries into the decision; the objective is the reader’s', () => {
    expect(steps[1].answered).toBe(
      'Comparing Rwanda, Kenya and Tanzania: Which is strongest for market expansion?',
    );
    expect(steps[1].route.knowledgeRequirement).toBe('DECISION_SUPPORT');
    expect(steps[1].route.decisionObjective).toBe('market expansion');
    expect(newsCalled(steps[1])).toBe(false);
  });

  it('§13 a stated weighting re-weighs the SAME decision (objective kept; "current" is not freshness here)', () => {
    expect(steps[2].turn.state.priorities).toBe('growth over market size');
    expect(steps[2].answered).toBe(
      'Comparing Rwanda, Kenya and Tanzania (priorities: growth over market size): which is the strongest choice for market expansion, given these priorities?',
    );
    expect(steps[2].route.knowledgeRequirement).toBe('DECISION_SUPPORT');
    expect(steps[2].route.decisionObjective).toBe('market expansion');
    expect(steps[3].route.knowledgeRequirement).toBe('DECISION_SUPPORT');
  });

  it('§12 "Which economy is best?" has no objective (the executor asks "best for what?")', () => {
    const [best] = converse(['Which economy is best?']);
    expect(best.route.knowledgeRequirement).toBe('DECISION_SUPPORT');
    expect(best.route.decisionObjective).toBeNull();
  });
});

describe('§37 / PO-02 — the cross-border relationship keeps both sides', () => {
  it('the relationship is read, and a short follow-up stays inside it', () => {
    const steps = converse([
      'What is happening commercially between Rwanda and Tanzania at the border?',
      'What goods are affected?',
    ]);
    expect(steps[0].route.relationship).toMatchObject({
      countries: ['RWA', 'TZA'],
      domain: 'COMMERCIAL',
    });
    expect(steps[1].answered).toBe(
      'Between Rwanda and Tanzania (border, trade): What goods are affected?',
    );
    expect(steps[1].route.relationship?.countries).toEqual(['RWA', 'TZA']);
  });
});

describe('§23 — preferences and constraints are thread-level', () => {
  it('"Only official sources." is a constraint-only turn that survives a later new job until changed', () => {
    const steps = converse([
      'What is going on in Madagascar?',
      'Only official sources.',
      'How does photosynthesis work?',
      'Any sources are fine now.',
    ]);
    expect(steps[1].turn.constraintOnly).toBe(true);
    expect(steps[1].turn.state.officialSourcesOnly).toBe(true);
    expect(steps[2].turn.state.officialSourcesOnly).toBe(true);
    expect(steps[2].turn.trace.carried).toContain('officialSourcesOnly');
    expect(steps[3].turn.state.officialSourcesOnly).toBe(false);
  });
});

describe('EN / PL parity — the Polish travel journey', () => {
  it('Polish constraints and the place switch carry the same way', () => {
    const steps = converse(
      ['Jakie miejsca warto odwiedzić w Rwandzie?', 'Mam pięć dni i wolę przyrodę.', 'A w Kenii?'],
      'pl',
    );
    expect(steps[1].answered).toBe(
      'Planuję podróż do Rwandy (5 dni; zainteresowania: przyroda): Mam pięć dni i wolę przyrodę — jak najlepiej to zaplanować?',
    );
    expect(steps[2].turn.state).toMatchObject({ geography: ['KEN'], duration: '5 dni' });
    for (const s of steps) expect(s.route.knowledgeRequirement).toBe('PLACE_REFERENCE');
  });
});
