import { routeAskR2, type AskR2Route } from './ask-r2-route';
import { planChips } from './plan-chips';
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

describe('F — the four Alpha clarification questions are genuine broadening offers', () => {
  const cases = [
    {
      question: 'What are the latest major developments in Poland today?',
      notApplied: ['today'],
      draft: 'What are the latest major developments in Poland?',
    },
    {
      question:
        'What are the latest major political developments in Poland today? Give me the top 3 and cite the sources.',
      notApplied: ['political', 'today'],
      draft:
        'What are the latest major developments in Poland? Give me the top 3 and cite the sources.',
    },
    {
      question: 'What are the latest major developments in Ukraine today?',
      notApplied: ['today'],
      draft: 'What are the latest major developments in Ukraine?',
    },
    {
      question:
        'What are the latest reported Russian missile and drone attacks on Ukraine today? Cite the sources.',
      notApplied: ['today'],
      draft:
        'What are the latest reported Russian missile and drone attacks on Ukraine? Cite the sources.',
    },
  ];

  it.each(cases)('$question', ({ question, notApplied, draft }) => {
    const r = route(question, 'en');
    expect(r.plan.terminalState).toBe('BROADENING_OFFERED');
    expect(r.plan.clarification).toEqual([]);
    /* The display names exactly the reader's words the plan could not apply… */
    const chips = planChips(r.envelope, r.plan);
    expect(chips.kind).toBe('SCOPED');
    const unapplied =
      chips.kind === 'SCOPED'
        ? [
            ...new Set(
              chips.chips
                .filter((c) => !c.applied && c.kind !== 'GEOGRAPHY' && c.kind !== 'SELECTION')
                .map((c) => c.value.toLowerCase()),
            ),
          ].sort()
        : [];
    expect(unapplied).toEqual([...notApplied].sort());
    for (const word of notApplied) expect(question.toLowerCase()).toContain(word);
    /* …and the draft it offers (those words removed) is an executable question. */
    expect(route(draft, 'en').plan.terminalState).toBe('EXECUTABLE');
  });
});
