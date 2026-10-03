import { composeCrossCountryContinuation } from './cross-country-continuation';

/**
 * CTO CHECKPOINT 5 §5 — the cross-country continuation matrix (EN + PL). Each case states the
 * earlier turns (newest first) and the question the engine must answer, or null (no composition:
 * the existing truthful clarification stays).
 */
const en = (q: string) => ({ question: q, language: 'en' });
const pl = (q: string) => ({ question: q, language: 'pl' });
const compose = (
  q: string,
  lang: 'en' | 'pl',
  earlier: { question: string; language: string }[],
  hasOwnContext = false,
) =>
  composeCrossCountryContinuation(q, lang, earlier, { hasOwnContext })?.effectiveQuestion ?? null;

describe('cross-country continuation — the subject carries, the place is replaced', () => {
  it.each([
    ['And in Kenya?', "How is Madagascar's economy doing?", "How is Kenya's economy doing?"],
    [
      'What about Kenya?',
      'What is the security situation in Madagascar?',
      'What is the security situation in Kenya?',
    ],
    ['And in Kenya?', 'What is going on in Madagascar?', 'What is going on in Kenya?'],
    ['How about Kenya?', 'Who is the president of Madagascar?', 'Who is the president of Kenya?'],
    ['And Kenya?', 'What changed in Madagascar this week?', 'What changed in Kenya this week?'],
  ])('EN %s after "%s" → "%s"', (q, prior, expected) => {
    expect(compose(q, 'en', [en(prior)])).toBe(expected);
  });

  it.each([
    ['A w Kenii?', 'Jak radzi sobie gospodarka Madagaskaru?', 'Jak radzi sobie gospodarka Kenii?'],
    ['A co z Kenią?', 'Co się dzieje na Madagaskarze?', null],
    ['A w Kenii?', 'Co się dzieje w Iranie?', 'Co się dzieje w Kenii?'],
    ['A w Rwandzie?', 'Jaka jest sytuacja w Polsce?', 'Jaka jest sytuacja w Rwandzie?'],
  ])('PL %s after "%s" → %s', (q, prior, expected) => {
    expect(compose(q, 'pl', [pl(prior)])).toBe(expected);
  });

  it('an explicit new time replaces the earlier one', () => {
    expect(
      compose('And in Kenya yesterday?', 'en', [en('What changed in Madagascar this week?')]),
    ).toBe('What changed in Kenya yesterday?');
    expect(
      compose('A w Kenii wczoraj?', 'pl', [pl('Co się zmieniło w Iranie w tym tygodniu?')]),
    ).toBe('Co się zmieniło w Kenii wczoraj?');
  });

  it('the earlier time carries when the reader gives none', () => {
    expect(compose('And in Kenya?', 'en', [en('What happened in Madagascar yesterday?')])).toBe(
      'What happened in Kenya yesterday?',
    );
  });

  it('a placeless follow-up carries its topic to the new place ("And the economy?" → Kenya)', () => {
    expect(
      compose('And in Kenya?', 'en', [
        en('And the economy?'),
        en('What is going on in Madagascar?'),
      ]),
    ).toBe('And the economy in Kenya?');
  });

  it('chains: Madagascar economy → Kenya → Uganda', () => {
    expect(
      compose('What about Uganda?', 'en', [
        en('And in Kenya?'),
        en("How is Madagascar's economy doing?"),
      ]),
    ).toBe("How is Uganda's economy doing?");
  });
});

describe('cross-country continuation — nothing is manufactured', () => {
  it('no earlier turn (or Start New Topic, which opens a new thread) → no composition', () => {
    expect(compose('And in Kenya?', 'en', [])).toBeNull();
  });

  it('a naked place with no continuation marker is not a continuation', () => {
    expect(compose('Kenya', 'en', [en("How is Madagascar's economy doing?")])).toBeNull();
  });

  it('an explicit new question keeps its own intent', () => {
    expect(
      compose('Tell me the history of Kenya', 'en', [en("How is Madagascar's economy doing?")]),
    ).toBeNull();
  });

  it('a subject with no replaceable geography is never re-targeted (Napoleon)', () => {
    expect(compose('And in Kenya?', 'en', [en('Who was Napoleon?')])).toBeNull();
  });

  it('a demonym is not a replaceable place (no "Kenyan genocide")', () => {
    expect(compose('And in Kenya?', 'en', [en('What caused the Rwandan genocide?')])).toBeNull();
  });

  it('a comparison of several countries is not one place to replace', () => {
    expect(
      compose('And in Kenya?', 'en', [en('Compare Madagascar and Tanzania economies')]),
    ).toBeNull();
  });

  it('a turn with its own story / module / selection context is never composed', () => {
    expect(
      compose('And in Kenya?', 'en', [en("How is Madagascar's economy doing?")], true),
    ).toBeNull();
  });

  it('several new places stay a clarification', () => {
    expect(
      compose('And Kenya and Uganda?', 'en', [en("How is Madagascar's economy doing?")]),
    ).toBeNull();
  });

  it('PL: an island preposition (na …) is never carried to the new place', () => {
    expect(compose('A w Kenii?', 'pl', [pl('Jaka jest sytuacja na Kubie?')])).toBeNull();
  });

  it('a language switch between turns is not composed', () => {
    expect(compose('A w Kenii?', 'pl', [en("How is Madagascar's economy doing?")])).toBeNull();
  });
});
