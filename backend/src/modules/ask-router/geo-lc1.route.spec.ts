import { routeAskR2 } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/*
  EA GEO-LC-1 (EA R47, CTO R63A) — the route's typed geography for every spelling of the qualified Congo names,
  pure route (no Analysis, no provider). Before the fix only lower-case "congo - kinshasa" was wrong: it was
  typed COG because the lower-case country reading stopped at the spaced hyphen and read the bare "congo".
*/
const typed = (q: string, lang: 'en' | 'pl' = 'en'): string[] => {
  const r: any = routeAskR2(
    { originalQuestion: q, sourceLanguage: lang, normalizationLanguage: lang, displayLanguage: lang, origin: 'ASK' } as never,
    { requestInstant: '2026-10-14T08:00:00Z' } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );
  return (r.envelope?.geography?.candidates ?? [])
    .filter((c: { source: string }) => c.source === 'TYPED_GEOGRAPHY')
    .map((c: { value: string }) => c.value);
};

describe('GEO-LC-1 · qualified Congo names, any case → one country', () => {
  it.each([
    ['LC-R1', 'what changed in congo - kinshasa?', 'COD'],
    ['LC-R2', 'What are the latest developments in congo - kinshasa budget talks?', 'COD'],
    ['LC-R3', 'What changed in Congo - Kinshasa?', 'COD'],
    ['LC-R4', 'WHAT CHANGED IN CONGO - KINSHASA?', 'COD'],
    ['LC-R5', 'what changed in congo kinshasa?', 'COD'],
    ['LC-R6', 'what changed in congo - brazzaville?', 'COG'],
    ['LC-R7', 'What changed in Congo - Brazzaville?', 'COG'],
    ['LC-R8', 'What changed in Brazzaville?', 'COG'],
  ])('%s %s → %s', (_id, q, iso3) => {
    expect(typed(q)).toEqual([iso3]);
  });
});

describe('GEO-LC-1 · what must NOT change', () => {
  it.each([
    ['bare, capitalised', 'What changed in Congo?'],
    ['bare, lower case', 'what changed in congo?'],
  ])('a bare Congo (%s) names neither country', (_l, q) => {
    expect(typed(q).filter((c) => c === 'COD' || c === 'COG')).toEqual([]);
  });
  it.each(['Co się zmieniło w Kongu?', 'Najnowsze wiadomości z Konga'])('Polish bare form "%s" guesses no Congo (and never Tonga)', (q) => {
    expect(typed(q, 'pl').filter((c) => c === 'COD' || c === 'COG' || c === 'TON')).toEqual([]);
  });
  it('an unrelated spaced hyphen does not join a country with the next word ("in kenya - what changed")', () => {
    expect(typed('news in kenya - what changed this week?')).toEqual(['KEN']);
  });
});
