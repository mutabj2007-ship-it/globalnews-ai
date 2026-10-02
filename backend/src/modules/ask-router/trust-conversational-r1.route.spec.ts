import { routeAskR2, type AskRouteContext } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { supportedWindowHours } from './reporting-window';

/**
 * TRUST, CONVERSATIONAL RETRIEVAL AND SHARED UX R1 — Tranche 1 routing corpus.
 *
 * The reported cases (A: Iran → Madagascar; B: Tanzania safari preparation) plus PARAPHRASES and
 * held-out shapes, through the real integrated router (frozen C included). Before this tranche
 * (Production 5b71483) history and travel questions about a named place went to news only,
 * elliptical follow-ups lost the conversation's country, and "Who was Napoleon?" was scoped to
 * the USA (Napoleon, Ohio). Conversation geography is supplied here the way the service supplies
 * it: as the inherited GEOGRAPHY rung (mapContextCountry), see conversation-place.ts.
 */
const deps = { specialistRegistry: specialistRegistryFixture };
const INSTANT = '2026-10-02T19:59:00Z';

function route(q: string, ctx: Partial<AskRouteContext> = {}, lang: 'en' | 'pl' = 'en') {
  return routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: INSTANT, ...ctx },
    deps,
  );
}

const required = (r: ReturnType<typeof route>) =>
  r.plan.evidenceRequests.filter((e) => e.required).map((e) => e.evidenceClass);
const places = (r: ReturnType<typeof route>) =>
  r.envelope.geography.candidates.map((c) => `${c.source}:${c.value}`);

describe('Case A — current news intent and an explicit country switch', () => {
  it.each([
    'What is going on in Madagascar?',
    'What is happening in Madagascar?',
    'whats going on in madagascar',
    'What about Madagascar?',
    'news in Madagascar',
  ])('%s → current reporting scoped to MDG, never reference background', (q) => {
    const r = route(q, { priorQuestion: 'Which news are in Iran?' });
    expect(r.plan.terminalState).toBe('EXECUTABLE');
    expect(required(r)).toContain('NEWS_REPORTING');
    expect(places(r)).toEqual(['TYPED_GEOGRAPHY:MDG']);
  });
});

describe('Case B — travel preparation is place background, not an empty news search', () => {
  it.each([
    'I want to visit Tanzania especially Safari national park, I want to know some information before going there',
    'Planning a safari in Tanzania, what should I know?',
    'What should I pack for a trip to Rwanda?',
    'Compare Tanzania and Kenya for a safari',
  ])('%s → REFERENCE_BACKGROUND_ONLY keeping the place', (q) => {
    const r = route(q);
    expect(r.knowledgeRequirement).toBe('PLACE_REFERENCE');
    expect(r.plan.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
    expect(r.envelope.geography.candidates.length).toBeGreaterThan(0);
    expect(r.seam.knowledgeDecoupling).toBe('PLACE_REFERENCE');
  });

  it('a follow-up keeps the travel intent: "Compare it with Kenya"', () => {
    const r = route('Compare it with Kenya', {
      priorQuestion: 'I want to visit Tanzania especially Safari national park',
    });
    expect(r.knowledgeRequirement).toBe('PLACE_REFERENCE');
    expect(r.plan.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
  });

  it.each(['Is it safe to travel to Kenya now?', 'Any recent news about tourism in Tanzania?'])(
    '%s — a travel question that asserts freshness stays current reporting',
    (q) => {
      const r = route(q);
      expect(r.knowledgeRequirement).not.toBe('PLACE_REFERENCE');
      expect(required(r)).toContain('NEWS_REPORTING');
    },
  );
});

describe('History and science do not depend on a breaking-news provider', () => {
  it.each([
    'What caused the Rwandan genocide?',
    'When did Poland join the EU?',
    'What is the history of Madagascar?',
    'Kiedy Polska wstąpiła do Unii Europejskiej?',
  ])('%s → background scoped to the place', (q) => {
    const r = route(q, {}, /[ąęłńóśźż]/i.test(q) ? 'pl' : 'en');
    expect(r.plan.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
    expect(required(r)).not.toContain('NEWS_REPORTING');
  });

  it('"Who was Napoleon?" is about a person, not Napoleon, Ohio', () => {
    const r = route('Who was Napoleon?');
    expect(r.plan.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
    expect(places(r)).toEqual([]);
  });

  it('a country in a person question is still read ("Who is the president of Kenya?")', () => {
    const r = route('Who is the president of Kenya?');
    expect(places(r).some((p) => p.endsWith(':KEN'))).toBe(true);
  });

  it('How does photosynthesis work? stays stable reference with no place', () => {
    const r = route('How does photosynthesis work?');
    expect(r.knowledgeRequirement).toBe('STABLE_REFERENCE');
    expect(places(r)).toEqual([]);
  });
});

describe('Follow-ups that change topic or time keep the conversation country', () => {
  const inherited = { priorQuestion: 'What is going on in Madagascar?', mapContextCountry: 'MDG' };

  it('"And the economy?" keeps MDG', () => {
    const r = route('And the economy?', inherited);
    expect(r.plan.terminalState).toBe('EXECUTABLE');
    expect(places(r)).toEqual(['MAP_GEOGRAPHY_CONTEXT:MDG']);
  });

  it('"What about yesterday?" keeps MDG and executes within a publication window', () => {
    const r = route('What about yesterday?', inherited);
    expect(r.plan.terminalState).toBe('EXECUTABLE');
    expect(places(r)).toEqual(['MAP_GEOGRAPHY_CONTEXT:MDG']);
    expect(r.reportingWindow?.hours).toBe(48);
  });

  it('a stable named-subject question suppresses the inherited country', () => {
    const r = route('How does photosynthesis work?', { mapContextCountry: 'MDG' });
    expect(r.eligibility?.decision).toBe('SUPPRESSED');
  });
});

describe('Named relative windows', () => {
  it.each([
    ['yesterday', 48],
    ['wczoraj', 48],
    ['past week', 168],
    ['last 7 days', 168],
  ])('%s → %d h', (phrase, hours) => {
    expect(supportedWindowHours(phrase)).toBe(hours);
  });

  it('a calendar "this week" stays a constraint (its start is ambiguous)', () => {
    expect(supportedWindowHours('this week')).toBeNull();
  });
});
