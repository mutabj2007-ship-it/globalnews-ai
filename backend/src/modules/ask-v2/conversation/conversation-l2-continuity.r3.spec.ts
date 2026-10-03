import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { inheritedConversationCountry } from './conversation-place';
import { readConversationalTurn } from './conversation-state';

/**
 * CTO R3 LIVE DEFECT L-2 — a time-only follow-up keeps the subject the conversation already
 * carries. Live Alpha 8f44abd: "What is happening with Madagascar's economy?" → "And in Kenya?" →
 * "What about yesterday?" lost the economy (general Kenya reporting). The state is now replayed
 * through the same reducer that interprets the live turn, so the composed subject of "And in
 * Kenya?" is the subject the next turn inherits. Every chain goes through the real router.
 */
const deps = { specialistRegistry: specialistRegistryFixture };

function chain(questions: readonly string[], lang: 'en' | 'pl' = 'en') {
  const earlier: { question: string; language: string }[] = [];
  return questions.map((q) => {
    const newestFirst = [...earlier].reverse();
    const turn = readConversationalTurn(q, lang, newestFirst)!;
    const answered = turn.composition?.effectiveQuestion ?? q;
    const place = turn.composition ? null : inheritedConversationCountry(q, lang, newestFirst);
    const route = routeAskR2(
      {
        originalQuestion: answered,
        sourceLanguage: lang,
        normalizationLanguage: lang,
        displayLanguage: lang,
        origin: 'ASK',
      },
      {
        requestInstant: '2026-10-03T08:00:00Z',
        ...(place === null ? {} : { mapContextCountry: place }),
      },
      deps,
    );
    earlier.push({ question: q, language: lang });
    return {
      q,
      answered,
      subject: turn.trace.subject ?? null,
      places: route.envelope.geography.candidates.map((c) => c.value),
      domains: route.envelope.domains.domains,
      period: route.readerStatedPeriod,
      requirement: route.knowledgeRequirement,
    };
  });
}

describe('L-2 — the live chain, before → after', () => {
  const [mdg, ken, yesterday, tza] = chain([
    "What is happening with Madagascar's economy?",
    'And in Kenya?',
    'What about yesterday?',
    'And in Tanzania?',
  ]);

  it('Madagascar economy → subject = Madagascar economy', () => {
    expect(mdg.subject).toBe("What is happening with Madagascar's economy?");
    expect(mdg.domains).toContain('economic');
  });

  it('"And in Kenya?" → Kenya replaces Madagascar; the subject becomes Kenya economy', () => {
    expect(ken.answered).toBe("What is happening with Kenya's economy?");
    expect(ken.subject).toBe("What is happening with Kenya's economy?");
    expect(ken.places).toEqual(['KEN']);
  });

  it('"What about yesterday?" → Kenya economy + yesterday (was: general Kenya reporting, no domain)', () => {
    expect(yesterday.answered).toBe("What is happening with Kenya's economy yesterday?");
    expect(yesterday.places).toEqual(['KEN']);
    expect(yesterday.domains).toContain('economic');
    expect(yesterday.period).toBe('yesterday');
  });

  it('"And in Tanzania?" → Tanzania economy; the stated period carries (existing time rule)', () => {
    expect(tza.answered).toBe("What is happening with Tanzania's economy yesterday?");
    expect(tza.places).toEqual(['TZA']);
    expect(tza.domains).toContain('economic');
  });
});

describe('L-2 — required chains (EN)', () => {
  it.each([
    [
      ['What is the security situation in Rwanda?', 'And in Uganda?', 'What about last week?'],
      'What is the security situation in Uganda last week?',
      'UGA',
    ],
    [
      ['What is happening with inflation in Poland?', 'And in Germany?', 'What about this month?'],
      'What is happening with inflation in Germany this month?',
      'DEU',
    ],
  ])('%j → %s', (questions, answered, place) => {
    const last = chain(questions).pop()!;
    expect(last.answered).toBe(answered);
    expect(last.places).toContain(place);
  });

  it('Tanzania travel → Kenya → next year: a trip, the new place, the trip timing (never a news window)', () => {
    const steps = chain([
      'I want to visit Tanzania for a safari, what should I know?',
      'And in Kenya?',
      'What about next year?',
    ]);
    expect(steps[1].places).toEqual(['KEN']);
    expect(steps[2].answered).toMatch(/^Planning a trip to Kenya.*: What about next year\?$/);
    expect(steps[2].requirement).toBe('PLACE_REFERENCE');
  });
});

describe('L-2 — PL equivalents (as far as current R3 semantics support them)', () => {
  it('Madagaskar gospodarka → Kenia → wczoraj', () => {
    const steps = chain(
      ['Jak radzi sobie gospodarka Madagaskaru?', 'A w Kenii?', 'A co z wczoraj?'],
      'pl',
    );
    expect(steps[1].answered).toBe('Jak radzi sobie gospodarka Kenii?');
    expect(steps[2].answered).toBe('Jak radzi sobie gospodarka Kenii wczoraj?');
    expect(steps[2].places).toEqual(['KEN']);
  });
});

describe('L-2 — negative controls: no stale subject carry', () => {
  it('"Who was Napoleon?" → "And in Kenya?" composes nothing', () => {
    const [, kenya] = chain(['Who was Napoleon?', 'And in Kenya?']);
    expect(kenya.answered).toBe('And in Kenya?');
  });

  it('Kenya economy → "Explain TCP": a new subject, no economy, no Kenya', () => {
    const [, tcp] = chain(["How is Kenya's economy doing?", 'Explain TCP']);
    expect(tcp.answered).toBe('Explain TCP');
    expect(tcp.subject).toBe('Explain TCP');
    expect(tcp.places).toEqual([]);
  });

  it('Rwanda travel → "Who is the president of France?": no trip carried', () => {
    const [, france] = chain([
      'Which places can I visit in Rwanda?',
      'Who is the president of France?',
    ]);
    expect(france.answered).toBe('Who is the president of France?');
    expect(france.places).toEqual(['FRA']);
  });

  it('"What about yesterday?" → "Who was Napoleon?" resets the economic subject', () => {
    const steps = chain([
      "What is happening with Kenya's economy?",
      'What about yesterday?',
      'Who was Napoleon?',
      'And in Uganda?',
    ]);
    expect(steps[2].subject).toBe('Who was Napoleon?');
    expect(steps[3].answered).not.toMatch(/economy/i);
  });
});
