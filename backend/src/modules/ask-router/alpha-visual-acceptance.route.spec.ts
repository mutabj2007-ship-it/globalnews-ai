import { routeAskR2, type AskR2Route } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — router evidence for the Product Owner's Alpha findings.
 *
 * L · STABLE FOLLOW-UP ROUTING. "Co to jest NATO?" was REFERENCE → REFERENCE_BACKGROUND_ONLY,
 *     but its follow-up "Dlaczego artykuł 5 NATO jest ważny?" became CURRENT_REPORTING →
 *     INSUFFICIENT (an empty news search). Corrected narrowly in the intent lexicon
 *     (query-intent.util.ts EXPLANATION_PATTERNS, EN + PL mirrors); frozen C is untouched.
 *     Current wording still routes current.
 *
 * F · THE FOUR "CLARIFICATION REQUIRED" QUESTIONS. Measured, not assumed: each is frozen C's
 *     BROADENING_OFFERED — "today" (and a category word such as "political") cannot be carried
 *     to retrieval, and the geography remains. That is frozen-C semantics (corpus row
 *     B3-topic-geography-time) and is NOT changed here. What was wrong was the display: a
 *     broadening offer rendered with nothing to act on. The frontend now names what cannot be
 *     applied and offers the reader's own question without it — and this spec proves each
 *     offered draft routes EXECUTABLE, so the offer is real, not decorative.
 */
const deps = { specialistRegistry: specialistRegistryFixture };

function route(question: string, language: 'en' | 'pl'): AskR2Route {
  return routeAskR2(
    {
      originalQuestion: question,
      sourceLanguage: language,
      normalizationLanguage: language,
      displayLanguage: language,
      origin: 'ASK',
    },
    { computeConsent: 'GRANTED', requestInstant: '2026-09-29T10:00:00Z' },
    deps,
  );
}

const outcome = (r: AskR2Route) => `${r.plan.questionClass} → ${r.plan.terminalState}`;

describe('L — stable explanatory follow-ups route to Reference Background (EN + PL)', () => {
  it.each([
    ['en', 'What is an induction motor?'],
    ['en', 'What is slip in an induction motor?'],
    ['pl', 'Co to jest NATO?'],
    ['pl', 'Dlaczego artykuł 5 NATO jest ważny?'],
    ['en', 'Why is NATO Article 5 important?'],
    ['en', 'Why does NATO Article 5 matter?'],
    ['pl', 'Dlaczego artykuł 5 NATO ma znaczenie?'],
    ['en', 'What does NATO Article 5 mean?'],
    ['pl', 'Co oznacza artykuł 5 NATO?'],
  ] as const)('[%s] %s', (language, question) => {
    expect(outcome(route(question, language))).toBe('REFERENCE → REFERENCE_BACKGROUND_ONLY');
  });

  it.each([
    ['en', 'Why is NATO Article 5 important today?'],
    ['en', 'What are the latest developments on NATO Article 5?'],
    ['en', 'What is the current status of NATO Article 5?'],
    ['en', 'What are the recent developments around NATO Article 5?'],
    ['pl', 'Dlaczego artykuł 5 NATO jest dzisiaj ważny?'],
    ['pl', 'Jakie są najnowsze wydarzenia dotyczące artykułu 5 NATO?'],
    ['pl', 'Jaka jest aktualna sytuacja wokół artykułu 5 NATO?'],
  ] as const)('current wording still routes current — [%s] %s', (language, question) => {
    expect(route(question, language).plan.questionClass).not.toBe('REFERENCE');
  });

  it('the recorded conservative decision is kept: "Why was NATO created?" is not reclassified', () => {
    expect(route('Why was NATO created?', 'en').plan.questionClass).toBe('CURRENT_REPORTING');
  });
});

/*
  ASK INTELLIGENCE BINDING R1 (§11B) — SUPERSEDED WITH UPDATED CONTRACT PROOF. These four were
  frozen-C broadening offers only because "today" (and a duplicated "political" topic) reached
  the planner as untransportable constraints. The composition layer now hands frozen C neither:
  "today" is served by current reporting itself (the phrase still reaches the executor as
  readerStatedPeriod), and "political" is already carried as the analytical DOMAIN. Frozen C is
  untouched; the same questions now EXECUTE current reporting. Other periods and topics are
  unchanged (see the controls below).
*/
describe('F — the four Alpha "today" questions now execute current reporting (§11B)', () => {
  it.each([
    'What are the latest major developments in Poland today?',
    'What are the latest major political developments in Poland today? Give me the top 3 and cite the sources.',
    'What are the latest major developments in Ukraine today?',
    'What are the latest reported Russian missile and drone attacks on Ukraine today? Cite the sources.',
  ])('%s', (question) => {
    const r = route(question, 'en');
    expect(r.plan.terminalState).toBe('EXECUTABLE');
    expect(
      r.plan.evidenceRequests.some((e) => e.evidenceClass === 'NEWS_REPORTING' && e.required),
    ).toBe(true);
    expect(r.plan.constraints.some((c) => c.axis === 'TIME')).toBe(false);
    expect(r.plan.constraints.some((c) => c.axis === 'TOPIC')).toBe(false);
    expect(r.envelope.time.requirement).toBe('RECENT');
    expect(r.readerStatedPeriod).toBe('today');
  });

  it('"political" is carried once — as the domain — and the Politics specialist stays unbound', () => {
    const r = route('What are the latest major political developments in Poland today?', 'en');
    expect(r.plan.constraints.filter((c) => c.axis === 'DOMAIN').map((c) => c.value)).toEqual([
      'political',
    ]);
    expect(r.plan.disclosures).toContain('SPECIALIST_INTELLIGENCE_NOT_USED');
  });

  it.each([['What happened in Kenya this week?', 'this week']])(
    'control — any other CURRENT stated period is still a constraint: %s',
    (question) => {
      expect(route(question, 'en').plan.terminalState).toBe('BROADENING_OFFERED');
    },
  );

  /* CTO R4 THIRD PASS §3 (supersedes the former "2024" control): a COMPLETED past year, asked
     after it ended, is historical / reference analysis — never current news, never a constraint. */
  it('a completed past year is historical analysis, not a news constraint: What happened in Poland in 2024?', () => {
    const r = route('What happened in Poland in 2024?', 'en');
    expect(r.plan.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
    expect(r.job.temporal.map((t) => t.role)).toContain('HISTORICAL_PERIOD');
  });
});
