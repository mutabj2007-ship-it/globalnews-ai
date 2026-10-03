import { routeAskR2 } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { isFuturePeriod } from './knowledge-requirement';
import { resolveGeography } from '../geo/geo-resolver';
import { allCities, allExonyms } from '../geo/geo-gazetteer';
import { foldPlaceName } from '../geo/geo-normalize.util';
import { POLISH_SETTLEMENT_CASE_FORMS } from '../geo/language/polish-settlement-case-forms';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 §14 — regression paraphrases for the four HELD-OUT misses
 * (travel + future period, historical entity, Polish city case forms, "<name> the country").
 *
 * These are NOT the held-out questions: trust-r1-evaluation.corpus.spec.ts keeps its HELD_OUT
 * split unedited and is re-measured separately. Every fix here has an opposite control.
 */
function route(q: string, lang: 'en' | 'pl' = 'en') {
  const r = routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-03T12:00:00Z' },
    { specialistRegistry: specialistRegistryFixture },
  );
  return {
    knowledge: r.knowledgeRequirement,
    terminal: r.plan.terminalState,
    news: r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING'),
    place: r.envelope.geography.candidates[0]?.value ?? null,
    stated: r.readerStatedPeriod,
  };
}

describe('§14 A — a future period inside a travel request is the trip timing', () => {
  it.each([
    ['Planning a trip to Kenya next summer, what should I know?', 'en', 'KEN'],
    ['I am visiting Rwanda in 2027, what should I prepare?', 'en', 'RWA'],
    ['Travelling to Uganda in a few weeks, what should I pack?', 'en', 'UGA'],
    ['Wybieram się na wycieczkę do Kenii w przyszłym roku, co warto wiedzieć?', 'pl', 'KEN'],
  ] as const)('%s → place background, no news', (q, lang, place) => {
    expect(route(q, lang)).toMatchObject({
      knowledge: 'PLACE_REFERENCE',
      terminal: 'REFERENCE_BACKGROUND_ONLY',
      news: false,
      place,
    });
  });

  it('keeps the reader’s own words for the timing', () => {
    expect(route('I am visiting Rwanda in 2027, what should I prepare?').stated).toBe('2027');
  });

  it.each([
    'Is it safe to travel to Kenya now?',
    'Travel to Kenya this year: is it safe?',
    'Tanzania news next year',
    'Will Kenya hold elections next year?',
    'I visited Rwanda in 2024, what happened there since?',
  ])('control: %s stays on current reporting', (q) => {
    expect(route(q).news).toBe(true);
  });

  it('only forward-pointing spans count; a past or current year never does', () => {
    expect(isFuturePeriod('next year', 'en', 2026)).toBe(true);
    expect(isFuturePeriod('2027', 'en', 2026)).toBe(true);
    expect(isFuturePeriod('w przyszłym roku', 'pl', 2026)).toBe(true);
    expect(isFuturePeriod('2026', 'en', 2026)).toBe(false);
    expect(isFuturePeriod('2025', 'en', 2026)).toBe(false);
    expect(isFuturePeriod('2027', 'en', undefined)).toBe(false);
    expect(isFuturePeriod('this year', 'en', 2026)).toBe(false);
    expect(isFuturePeriod('last week', 'en', 2026)).toBe(false);
  });
});

describe('§14 B — a historical entity asked about in the past tense is background', () => {
  it.each([
    ['What were the Crusades?', 'en'],
    ['What was the Soviet Union?', 'en'],
    ['Czym było Imperium Osmańskie?', 'pl'],
  ] as const)('%s → background, no news', (q, lang) => {
    expect(route(q, lang)).toMatchObject({
      knowledge: 'STABLE_REFERENCE',
      terminal: 'REFERENCE_BACKGROUND_ONLY',
      news: false,
    });
  });

  it('a historical entity that names a place is place background', () => {
    expect(route('What was the Kingdom of Rwanda?')).toMatchObject({
      knowledge: 'PLACE_REFERENCE',
      news: false,
      place: 'RWA',
    });
  });

  it.each([
    'What was the outcome of the election?',
    'What was the Fed decision?',
    'What was the Ottoman Empire mentioned in the news today?',
  ])('control: %s stays on current reporting', (q) => {
    expect(route(q).news).toBe(true);
  });
});

describe('§14 C — Polish case forms of Polish cities (curated, never stemmed)', () => {
  it.each([
    ['Wiadomości z Krakowa'],
    ['Co nowego w Gdańsku?'],
    ['Jaka jest sytuacja w Warszawie?'],
    ['Co się dzieje w Poznaniu dzisiaj?'],
  ])('%s → POL', (q) => {
    expect(route(q, 'pl').place).toBe('POL');
  });

  it('control: "w łodzi" (in a boat) is never Łódź', () => {
    expect(route('Płynęliśmy w łodzi po jeziorze', 'pl').place).toBeNull();
  });

  it('every curated form points at a real Polish gazetteer settlement', () => {
    const polish = new Set(
      allCities()
        .filter((c) => c.cc === 'PL')
        .map((c) => c.n),
    );
    for (const form of POLISH_SETTLEMENT_CASE_FORMS) expect(polish.has(form.n)).toBe(true);
  });

  it('no curated form is itself a settlement name or an artifact exonym', () => {
    const names = new Set(allCities().map((c) => foldPlaceName(c.n)));
    const exonyms = new Set(allExonyms().map((e) => e.x));
    for (const form of POLISH_SETTLEMENT_CASE_FORMS) {
      expect(names.has(form.x)).toBe(false);
      expect(exonyms.has(form.x)).toBe(false);
      expect(form.x).toBe(foldPlaceName(form.x));
    }
  });
});

describe('§14 D — "<ambiguous name> + country" reads the sovereign country', () => {
  it.each([
    'News from the country of Georgia',
    'Georgia (the country) elections',
    'Is Georgia the nation in the EU?',
  ])('%s → GEO', (q) => {
    expect(resolveGeography(q).place?.country.iso3).toBe('GEO');
  });

  it('works for another ambiguous name too (Jordan)', () => {
    expect(resolveGeography('Jordan the country latest news').place?.country.iso3).toBe('JOR');
  });

  it.each([
    'What is happening in Georgia state?',
    'What is happening in the state of Georgia?',
    'Atlanta Georgia news',
    'Georgia State University wins',
  ])('control: %s is never the country', (q) => {
    expect(resolveGeography(q).place?.country.iso3).not.toBe('GEO');
    expect(route(q).place).not.toBe('GEO');
  });
});
