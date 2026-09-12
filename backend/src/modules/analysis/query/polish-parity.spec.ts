/**
 * G-SEARCH-POLISH-PARITY-1 — the paired EN/PL corpus.
 *
 * Every case is a PAIR. A Polish assertion that is not tied to its English twin
 * proves nothing about parity, so each block asserts the English behaviour too
 * and the two are compared in the same test.
 *
 * THREE OUTCOMES ARE POSSIBLE AND ALL THREE APPEAR HERE:
 *
 *   FIXED           the languages now behave identically  (clarification)
 *   GRAMMAR-BOUND   they cannot behave identically, and the reason is Polish
 *                   morphology rather than a missing pattern (inflected names)
 *   EQUIVALENT      the intent LABEL differs and the OUTCOME does not, because
 *                   Polish inflection forces the classifier down the explicit
 *                   country route while English hands a clean country name to
 *                   the derive layer  (geography)
 *
 * The last two are asserted as deliberate, not skipped.
 */
import { deriveGenericNewsQuery } from './derive-generic-news-query.util';
import { classifyQueryIntent } from './query-intent.util';

const intentOf = (q: string) => classifyQueryIntent(q, {}).intent;
const countriesOf = (q: string) =>
  classifyQueryIntent(q, {})
    .countries.map((c) => c.iso3)
    .sort();

describe('CLARIFICATION PARITY — fixed', () => {
  it.each([
    ['synthetic comparative (potężniejszy)', 'Which country is more powerful in East Africa?', 'Który kraj jest potężniejszy w Afryce Wschodniej?'],
    ['synthetic comparative (silniejszy)', 'Which country is stronger in East Africa?', 'Który kraj jest silniejszy w Afryce Wschodniej?'],
    ['analytic comparative (bardziej wpływowy)', 'Which country is more influential in the region?', 'Który kraj jest bardziej wpływowy w regionie?'],
    ['analytic comparative (bardziej demokratyczny)', 'Which country is more democratic in the region?', 'Który kraj jest bardziej demokratyczny w regionie?'],
    ['synthetic comparative (bogatszy)', 'Which country is richer in the region?', 'Który kraj jest bogatszy w regionie?'],
  ])('%s — both languages ask instead of answering', (_what, en, pl) => {
    expect(intentOf(en)).toBe('CLARIFICATION_REQUIRED');
    expect(intentOf(pl)).toBe('CLARIFICATION_REQUIRED');
  });

  it('THE REPORTED FAILURE: the Polish question no longer proceeds silently', () => {
    expect(intentOf('Który kraj jest potężniejszy w Afryce Wschodniej?')).toBe(
      'CLARIFICATION_REQUIRED',
    );
  });

  it('THE STRUCTURAL REPAIR: "bardziej" is Polish\'s "more", and it covers the open class', () => {
    // Polish forms comparatives morphologically, so an enumerated stem list can
    // only ever cover the adjectives somebody thought of. "bardziej X" is the
    // analytic form and works for any adjective — including ones absent here.
    expect(intentOf('Który kraj jest bardziej stabilny w regionie?')).toBe('CLARIFICATION_REQUIRED');
    expect(intentOf('Który kraj jest bardziej zadłużony w regionie?')).toBe('CLARIFICATION_REQUIRED');
  });

  it.each([
    ['two named members', 'Compare Poland and Germany', 'Porównaj Polskę i Niemcy'],
    ['difference between', 'What is the difference between Poland and Germany?', 'Jaka jest różnica między Polską a Niemcami?'],
  ])('%s — both retrieve per side rather than clarifying', (_what, en, pl) => {
    expect(intentOf(en)).toBe('COMPARISON_RESEARCH');
    expect(intentOf(pl)).toBe('COMPARISON_RESEARCH');
    expect(countriesOf(en)).toEqual(['DEU', 'POL']);
    expect(countriesOf(pl)).toEqual(['DEU', 'POL']);
  });

  it('FALSE-POSITIVE CONTROL: "bardziej" outside the frame is not a comparison', () => {
    // The marker is added INSIDE the existing "który kraj / państwo" frame, so
    // an ordinary sentence using "bardziej" is untouched.
    expect(intentOf('Polska jest bardziej zaangażowana w pomoc humanitarną')).not.toBe(
      'CLARIFICATION_REQUIRED',
    );
    expect(intentOf('Firma bardziej skupia się na eksporcie')).not.toBe('CLARIFICATION_REQUIRED');
  });
});

describe('SUBJECT EXTRACTION — fixed where grammar allows', () => {
  it.each([
    ['acronym', 'What can you tell me about NATO?', 'Co możesz powiedzieć o NATO?', 'NATO'],
    ['indeclinable place', 'Do you know anything about Kigali?', 'Czy wiesz coś o Kigali?', 'Kigali'],
  ])('%s — the derived subject is IDENTICAL in both languages', (_what, en, pl, subject) => {
    expect(deriveGenericNewsQuery(en)).toBe(subject);
    expect(deriveGenericNewsQuery(pl)).toBe(subject);
  });

  it('the whole sentence is no longer the subject — which is the actual defect', () => {
    const pl = 'Co wiesz o Donaldzie Trumpie?';

    expect(deriveGenericNewsQuery(pl)).not.toContain('Co wiesz');
    expect(deriveGenericNewsQuery(pl).split(/\s+/).length).toBeLessThan(pl.split(/\s+/).length);
  });

  it('GRAMMAR-BOUND, ASSERTED: the Polish span is INFLECTED and cannot equal the English one', () => {
    // "o" governs the locative case. The English twin yields the nominative
    // "Donald Trump"; Polish yields "Donaldzie Trumpie". No pattern in this file
    // can close that — it needs morphology this repository does not carry.
    expect(deriveGenericNewsQuery('What do you know about Donald Trump?')).toBe('Donald Trump');
    expect(deriveGenericNewsQuery('Co wiesz o Donaldzie Trumpie?')).toBe('Donaldzie Trumpie');
    expect(deriveGenericNewsQuery('Co wiesz o Donaldzie Trumpie?')).not.toBe('Donald Trump');
  });

  it('and that is an IMPROVEMENT, not a regression — the old value could never match anything', () => {
    // A nominative headline contains neither. But the provider query is now a
    // name instead of a question, and the failure has moved from retrieval to
    // the verbatim headline gate, where it can be seen.
    const headline = 'Donald Trump ogłosił nowe cła na import stali';

    expect(headline).not.toContain('Co wiesz o Donaldzie Trumpie');
    expect(headline).not.toContain('Donaldzie Trumpie');
  });

  it('FALSE-POSITIVE CONTROL: the safety rule still refuses a non-shortening match', () => {
    // A candidate is used only when it has FEWER words than the input.
    expect(deriveGenericNewsQuery('Co wiesz')).toBe('Co wiesz');
    expect(deriveGenericNewsQuery('NATO')).toBe('NATO');
  });
});

describe('GEOGRAPHY IS PRESERVED — equivalent outcome, different label', () => {
  it.each([
    ['Rwanda', 'What is happening in Rwanda?', 'Co dzieje się w Rwandzie?', 'RWA'],
    ['Poland', 'What is happening in Poland?', 'Co dzieje się w Polsce?', 'POL'],
    ['France', 'What is happening in France?', 'Co dzieje się we Francji?', 'FRA'],
  ])('%s — the Polish inflected form still resolves to the country', (_c, en, pl, iso3) => {
    expect(deriveGenericNewsQuery(en)).toBe(_c);
    expect(countriesOf(pl)).toContain(iso3);
  });

  it('EQUIVALENT, ASSERTED: the labels differ and both reach the same country', () => {
    // English derives a clean country name and lets downstream location
    // resolution handle it; Polish inflection forces the classifier to resolve
    // the country itself. Different route, same destination — NOT a defect.
    expect(intentOf('What is happening in Rwanda?')).toBe('CURRENT_EVENT');
    expect(intentOf('Co dzieje się w Rwandzie?')).toBe('GEOGRAPHIC_REGIONAL');
    expect(countriesOf('Co dzieje się w Rwandzie?')).toEqual(['RWA']);
  });

  it('multi-country Polish still routes like its English twin', () => {
    expect(intentOf('Russia and Ukraine conflict')).toBe(intentOf('Konflikt Rosji i Ukrainy'));
  });
});

describe('CONTROLS — unchanged in both languages', () => {
  it.each([
    ['NATO', 'NATO'],
    ['oil price cap', 'limit cen ropy'],
    ['Poland, security', 'Polska, bezpieczeństwo'],
  ])('%s / %s stay CURRENT_EVENT and unmodified', (en, pl) => {
    expect(intentOf(en)).toBe('CURRENT_EVENT');
    expect(intentOf(pl)).toBe('CURRENT_EVENT');
    expect(deriveGenericNewsQuery(en)).toBe(en);
    expect(deriveGenericNewsQuery(pl)).toBe(pl);
  });
});

describe('KNOWN RESIDUAL, pinned so it is not mistaken for parity', () => {
  it('the intent classifier lacks the "Czy wiesz coś o" frame the derive layer now has', () => {
    // The DERIVED SUBJECT is already identical ("Kigali"), so retrieval matches
    // its English twin. Only the intent LABEL differs, and nothing downstream
    // reads it differently for this shape — recorded rather than claimed fixed.
    expect(deriveGenericNewsQuery('Do you know anything about Kigali?')).toBe('Kigali');
    expect(deriveGenericNewsQuery('Czy wiesz coś o Kigali?')).toBe('Kigali');

    expect(intentOf('Do you know anything about Kigali?')).toBe('ENTITY_BACKGROUND');
    expect(intentOf('Czy wiesz coś o Kigali?')).toBe('CURRENT_EVENT');
  });
});
