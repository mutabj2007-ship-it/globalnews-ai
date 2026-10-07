import { readTradeCorridor, corridorCountries } from './trade-corridor.util';
import {
  admitsReport,
  anchoredQueries,
  countriesNamedIn,
  questionAnchorsOf,
  supplementQueries,
} from './question-anchors.util';

/**
 * ASK R2 · GEOGRAPHY — a trade / shipping corridor keeps every place the reader named (destination
 * + every route), and a negated place is an exclusion, never a place to retrieve.
 */
const TEST_C =
  'As of 6 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Cover ports, borders, transport, customs, fuel and security. Include EU or Middle East events only with an evidenced link to these routes.\nPrioritize official and credible local sources. Use a concise table: development, event/publication dates, affected route, facts, likely impact and source link. Separate facts, forecasts and analysis. Flag coverage gaps; no reports does not mean no disruption. End with three practical checks for the importer. Under 600 words.';
const TEST_B =
  'As of 6 October 2026, I run a small business importing goods into Rwanda via Mombasa, Kenya, or Dar es Salaam, Tanzania. Identify up to five developments reported in the past seven days that affect this import route.';

const brief = (q: string, o: Parameters<typeof readTradeCorridor>[1] = {}) => {
  const c = readTradeCorridor(q, o);
  return c === null
    ? null
    : {
        destination: c.destination?.iso3 ?? null,
        inherited: c.destinationInherited,
        routes: c.routes.map((r) => `${r.iso3}:${r.label}`),
        excluded: c.excluded.map((r) => `${r.iso3}:${r.label}`),
      };
};

describe('readTradeCorridor — destination, routes, exclusions', () => {
  it.each([
    ['TEST C', TEST_C, 'RWA'],
    ['TEST B (countries named after each port)', TEST_B, 'RWA'],
    ['paraphrase: Uganda', 'What changed this week for a small business importing into Uganda via Mombasa or Dar es Salaam?', 'UGA'],
  ])('%s: the destination and BOTH routes', (_n, q, dest) => {
    expect(brief(q)).toEqual({
      destination: dest,
      inherited: false,
      routes: ['KEN:Mombasa', 'TZA:Dar es Salaam'],
      excluded: [],
    });
  });

  it('a route not in East Africa resolves through the same gazetteer (no curated list)', () => {
    expect(brief('We ship cargo to Zambia through Beira, not Durban.')).toEqual({
      destination: 'ZMB',
      inherited: false,
      routes: ['MOZ:Beira'],
      excluded: ['ZAF:Durban'],
    });
  });

  it('"through Dar es Salaam, not Mombasa" after a corridor question: destination kept, Mombasa excluded', () => {
    expect(
      brief('My shipment goes through Dar es Salaam, not Mombasa. Which of these developments matter for me?', {
        language: 'en',
        priorQuestion: TEST_C,
      }),
    ).toEqual({
      destination: 'RWA',
      inherited: true,
      routes: ['TZA:Dar es Salaam'],
      excluded: ['KEN:Mombasa'],
    });
  });

  it('Polish: "przez Dar es Salaam, nie przez Mombasę" keeps the destination and excludes Mombasa', () => {
    expect(
      brief('Moja przesyłka idzie przez Dar es Salaam, nie przez Mombasę. Które z tych zmian mnie dotyczą?', {
        language: 'pl',
        priorQuestion: TEST_C,
      }),
    ).toEqual({
      destination: 'RWA',
      inherited: true,
      routes: ['TZA:Dar es Salaam'],
      excluded: ['KEN:Mombasa'],
    });
  });

  it('Polish corridor question: "do Rwandy przez Mombasę lub Dar es Salaam"', () => {
    expect(brief('Importuję towary do Rwandy przez Mombasę lub Dar es Salaam. Co się zmieniło?', { language: 'pl' })).toEqual({
      destination: 'RWA',
      inherited: false,
      routes: ['KEN:Mombasa', 'TZA:Dar es Salaam'],
      excluded: [],
    });
  });

  it('"not via X" alone, with nothing before it, is only an exclusion', () => {
    expect(brief('Can my cargo avoid delays if it does not go via Mombasa?')).toEqual({
      destination: null,
      inherited: false,
      routes: [],
      excluded: ['KEN:Mombasa'],
    });
  });

  it.each([
    'What is the current situation in Kenya?',
    'What has changed in relations between Rwanda and DR Congo?',
    'Is it safe to travel to Kenya via Nairobi?',
    'Compare inflation in Kenya and Uganda.',
    'Explain how ports work.',
  ])('not a corridor: %s', (q) => {
    expect(readTradeCorridor(q)).toBeNull();
  });

  it('corridorCountries: destination first, then each route, once per country', () => {
    expect(corridorCountries(readTradeCorridor(TEST_B)!)).toEqual(['RWA', 'KEN', 'TZA']);
  });
});

describe('question anchors — CORRIDOR relation', () => {
  it('TEST C: destination + both routes; EU / Middle East never actors; coverage areas are alternatives', () => {
    const a = questionAnchorsOf(TEST_C);
    expect(a.relation).toBe('CORRIDOR');
    expect(a.gated).toBe(true);
    expect(a.actors.map((x) => `${x.role}:${x.key}`)).toEqual(['DESTINATION:RWA', 'ROUTE:KEN', 'ROUTE:TZA']);
    expect(anchoredQueries(a)).toEqual(['Mombasa Rwanda', 'Dar es Salaam Rwanda']);
    /* a Mombasa port report with no fuel / trade word is evidence for the corridor */
    expect(admitsReport(a, { title: 'Congestion at Mombasa port delays transit cargo' }).admitted).toBe(true);
    /* a report about neither the destination nor a route is not */
    expect(admitsReport(a, { title: 'EU fuel tariffs rise' }).admitted).toBe(false);
    /* nor is a place report with no corridor subject */
    expect(admitsReport(a, { title: 'Rwanda football team wins' }).admitted).toBe(false);
  });

  it('each route is searched until the evidence covers it — within the two-search bound', () => {
    const a = questionAnchorsOf(TEST_C);
    const tz = [1, 2, 3, 4].map((i) => ({ title: `Dar es Salaam port cargo update ${i}` }));
    /* four admitted Tanzania reports used to end the search (>= 3): Mombasa is still searched */
    expect(supplementQueries(a, tz)).toEqual(['Mombasa Rwanda']);
    const both = [...tz, { title: 'Mombasa port congestion eases' }];
    expect(supplementQueries(a, both)).toEqual([]);
    expect(supplementQueries(a, [])).toEqual(['Mombasa Rwanda', 'Dar es Salaam Rwanda']);
  });

  it('a corridor with an exclusion never anchors or searches the excluded place', () => {
    const corridor = readTradeCorridor('My shipment goes through Dar es Salaam, not Mombasa.', {
      priorQuestion: TEST_C,
    });
    const a = questionAnchorsOf('My shipment goes through Dar es Salaam, not Mombasa.', corridor);
    expect(a.actors.map((x) => x.key)).toEqual(['RWA', 'TZA']);
    expect(anchoredQueries(a)).toEqual(['Dar es Salaam Rwanda']);
  });

  it('null corridor keeps the plain reading (a bilateral relationship is unchanged)', () => {
    const q = 'What has changed recently in relations between Rwanda and DR Congo concerning the conflict?';
    const a = questionAnchorsOf(q, null);
    expect(a.relation).toBe('LINKED');
    expect(a.actors.map((x) => x.key)).toEqual(['RWA', 'COD']);
    expect(questionAnchorsOf(q)).toEqual(a);
  });

  it('a place at the end of a sentence is still named ("…Dar es Salaam. Cover…")', () => {
    expect(countriesNamedIn('Goods arrive via Dar es Salaam. Cover ports.')).toEqual(['TZA']);
    expect(countriesNamedIn('What is happening in Kenya.')).toEqual(['KEN']);
  });
});
