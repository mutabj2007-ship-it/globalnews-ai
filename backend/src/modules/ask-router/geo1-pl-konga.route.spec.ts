/*
  GEO-1 (Main) — a Polish "Konga" / "Kongo" is the Polish name of the Congo, never a typo of Tonga.

  Main's own regression for the fix applied from Claude G's R131 package (Part A:
  PROTECTED_FOREIGN_TOPONYMS in shared/src/geo-fuzzy-resolver.ts; Part B: the Polish COD aliases in
  shared/src/countries.ts). Independent of EA's fixture by design: EA keeps its own fixture for its
  own verification. Pure: no provider, DB, clock or network.
*/
import { resolveCountryByAnyIdentifier, resolveGeoTypo } from '@globalnews-ai/shared';
import { routeAskR2, type AskR2Route } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';

const deps = { specialistRegistry: specialistRegistryFixture };

function route(question: string, lang: 'en' | 'pl'): AskR2Route {
  return routeAskR2(
    {
      originalQuestion: question,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-23T12:00:00Z' },
    deps,
  );
}

function typedCountries(question: string, lang: 'en' | 'pl'): string[] {
  return route(question, lang).envelope.geography.candidates.map((c) => c.value);
}

describe('GEO-1 · the typo corrector leaves a correctly spelled Polish Congo alone', () => {
  it.each(['konga', 'Konga', 'kongo', 'KONGO'])('"%s" is not corrected to any country', (word) => {
    expect(resolveGeoTypo(word)).toBeUndefined();
  });

  it('still corrects a genuine typo, including one of Tonga', () => {
    expect(resolveGeoTypo('Tonge')?.canonicalLocation).toBe('tonga');
    expect(resolveGeoTypo('Rwnada')?.canonicalLocation).toBe('rwanda');
  });
});

describe('GEO-1 · the Polish names of the DR Congo resolve to COD through the exact alias table', () => {
  it.each([
    'DR Konga',
    'DR Kongo',
    'Demokratyczna Republika Konga',
    'Demokratycznej Republiki Konga',
    'Demokratycznej Republice Konga',
  ])('"%s" → COD', (name) => {
    expect(resolveCountryByAnyIdentifier(name)?.iso3).toBe('COD');
  });

  it('a bare "Konga" / "Kongo" names neither Congo (and never Tonga)', () => {
    expect(resolveCountryByAnyIdentifier('konga')).toBeFalsy();
    expect(resolveCountryByAnyIdentifier('kongo')).toBeFalsy();
  });
});

describe('GEO-1 · Ask routing of Polish DR Congo questions', () => {
  it('a Polish question about eastern DR Congo is routed to COD, not TON', () => {
    const iso = typedCountries('Jaka jest sytuacja w DR Konga w tym miesiącu?', 'pl');
    expect(iso).toContain('COD');
    expect(iso).not.toContain('TON');
  });

  it('the full Polish name in the nominative is routed to COD', () => {
    const iso = typedCountries('Co nowego w Demokratyczna Republika Konga?', 'pl');
    expect(iso).toContain('COD');
    expect(iso).not.toContain('TON');
  });

  /* Known residual R131-GEO-1-F1 (G §4.1): the locative "Republice" span is not yet offered to the
     alias table by the router, so this fails CLOSED (no country) rather than resolving COD. The
     invariant held here is the safe one: never Tonga. */
  it('the locative full name is never Tonga', () => {
    expect(typedCountries('Wybory w Demokratycznej Republice Konga', 'pl')).not.toContain('TON');
  });

  it('a bare Polish "Kongo" claims no country at all', () => {
    expect(typedCountries('Co słychać w Kongo?', 'pl')).toEqual([]);
  });

  it.each([
    ['What is the news from Tonga?', 'en'],
    ['Jakie są wiadomości z Tonga?', 'pl'],
  ] as const)('real Tonga still routes to TON: %s', (question, lang) => {
    expect(typedCountries(question, lang)).toContain('TON');
  });
});
