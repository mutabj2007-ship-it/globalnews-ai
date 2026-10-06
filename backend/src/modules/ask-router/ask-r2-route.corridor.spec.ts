import { routeAskR2 } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

/**
 * ASK R2 · GEOGRAPHY — the route's typed geography for a trade / shipping corridor question.
 * Measured before: "…importing into Rwanda via Mombasa or Dar es Salaam…" → [TYPED_GEOGRAPHY:TZA]
 * only (resolveGeography answers one place; its city tier picked the longest city).
 */
const route = (q: string, language: 'en' | 'pl' = 'en', priorQuestion?: string) =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: language,
      normalizationLanguage: language,
      displayLanguage: language,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-06T10:00:00.000Z', ...(priorQuestion === undefined ? {} : { priorQuestion }) },
    { specialistRegistry: specialistRegistryFixture },
  );
const typed = (q: string, language: 'en' | 'pl' = 'en', prior?: string) =>
  route(q, language, prior)
    .envelope.geography.candidates.filter((c) => c.source === 'TYPED_GEOGRAPHY')
    .map((c) => c.value);

const TEST_C =
  'As of 6 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.\nPrioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.';

describe('ASK R2 · geography — corridor typed geography (route)', () => {
  it('TEST C: Rwanda (destination) first, then Kenya (Mombasa) and Tanzania (Dar es Salaam)', () => {
    const r = route(TEST_C);
    expect(typed(TEST_C)).toEqual(['RWA', 'KEN', 'TZA']);
    /* every typed place is carried as a GEOGRAPHY constraint by frozen C's planner */
    expect(
      r.plan.constraints.filter((c) => c.axis === 'GEOGRAPHY' && c.carried).map((c) => c.value),
    ).toEqual([
      'TYPED_GEOGRAPHY:RWA:COUNTRY',
      'TYPED_GEOGRAPHY:KEN:COUNTRY',
      'TYPED_GEOGRAPHY:TZA:COUNTRY',
    ]);
  });

  it('paraphrase with another destination: Uganda + both corridors', () => {
    expect(
      typed('Which developments this week affect a small business importing into Uganda via Mombasa or Dar es Salaam?'),
    ).toEqual(['UGA', 'KEN', 'TZA']);
  });

  it('Polish corridor question keeps every place', () => {
    expect(typed('Importuję towary do Rwandy przez Mombasę lub Dar es Salaam. Co się ostatnio zmieniło?', 'pl')).toEqual([
      'RWA',
      'KEN',
      'TZA',
    ]);
  });

  it('"…through Dar es Salaam, not Mombasa" follow-up: Rwanda kept as destination, Kenya never typed', () => {
    const q = 'My shipment goes through Dar es Salaam, not Mombasa. What has changed on that route recently?';
    expect(typed(q, 'en', TEST_C)).toEqual(['RWA', 'TZA']);
  });

  it('Polish "nie przez Mombasę" follow-up: Kenya never typed', () => {
    const q = 'Moja przesyłka idzie przez Dar es Salaam, nie przez Mombasę. Co się ostatnio zmieniło?';
    expect(typed(q, 'pl', TEST_C)).toEqual(['RWA', 'TZA']);
  });

  it('single-country and bilateral questions are unchanged (no corridor)', () => {
    expect(typed('What is the latest news about fuel prices in Kenya?')).toEqual(['KEN']);
    const bilateral = route(
      'What has changed recently in relations between Rwanda and DR Congo concerning the conflict? Cite relevant dated reporting.',
    );
    expect(bilateral.relationship?.countries).toEqual(['RWA', 'COD']);
    /* the bilateral scope as it was: frozen C typed place + the two-sided relationship */
    expect(typed(
      'What has changed recently in relations between Rwanda and DR Congo concerning the conflict? Cite relevant dated reporting.',
    )).toEqual(['COD']);
  });
});
