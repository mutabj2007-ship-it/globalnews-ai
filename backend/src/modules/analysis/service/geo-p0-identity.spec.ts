import { resolveGeoTypo } from '@globalnews-ai/shared';
import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { routeTypedCountryOf } from '../../ask-v2/ask-r2-execution.adapter';
import { resolveGeography } from '../../geo/geo-resolver';
import { detectAmbiguousCountryMention } from '../anchor/event-anchor.util';
import { AnalysisService } from './analysis.service';
import { reconcileTypedCountry } from './typed-country-handoff.util';

/*
  EA-GEO-R1 G-1 / G-2 (P0) — country identity survives the Ask → Analysis handoff.
  Companion to ea-geo-r1.acceptance.spec.ts (EA's own fixtures, unchanged meanings). These add the
  exact drafts of the D0.1 correction candidate bae59e0 (ChoosePlace "Research new changes") and the
  positive / negative controls for the typo guard. Synthetic text only; no provider, model or DB.
*/
const analysis: any = Object.assign(Object.create(AnalysisService.prototype), {
  logger: { debug() {}, warn() {}, log() {}, error() {} },
});
/** The country Analysis's own text reader would type (GATE F applied), as in EA's fixture. */
const textTyped = (q: string): string | undefined => {
  if (detectAmbiguousCountryMention(q) !== undefined) return undefined;
  return (analysis.detectLocation(q) ?? analysis.detectLocationByDemonym(q))?.country?.iso3;
};
const route = (q: string, lang = 'en'): any =>
  routeAskR2(
    { originalQuestion: q, sourceLanguage: lang, normalizationLanguage: lang, displayLanguage: lang, origin: 'ASK' } as never,
    { requestInstant: '2026-10-12T12:00:00Z' } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );
const routeGeo = (q: string, lang = 'en'): string[] =>
  route(q, lang).envelope.geography.candidates.map((c: { value: string }) => c.value);
/** What Analysis types after the handoff (its text reading, validated by the route's country). */
const handedOff = (q: string, lang = 'en'): string | undefined => {
  const routeIso = routeTypedCountryOf(route(q, lang));
  const loc = (iso3: string | undefined) => (iso3 === undefined ? undefined : { country: { iso3 } });
  const reconciled = reconcileTypedCountry(loc(textTyped(q)), loc(routeIso)).location?.country.iso3;
  /* GATE F still drops a bare ambiguous Congo after the handoff, exactly as before */
  const ambiguous = detectAmbiguousCountryMention(q);
  return ambiguous !== undefined && reconciled !== undefined && ambiguous.candidates.includes(reconciled)
    ? undefined
    : reconciled;
};

describe('G-1 · the D0.1 (bae59e0) drafts keep the chosen country end to end', () => {
  /* Analysis types the country only where its OWN reader finds it (the route validates, never adds):
     the EN drafts carry "in", the PL drafts put the name first, so Analysis types nothing for them —
     ordinary search over the reader's words — and never the wrong country. */
  it.each([
    ['en', 'What are the latest developments in Congo - Kinshasa?', 'COD', 'COD'],
    ['en', 'What are the latest developments in Congo - Brazzaville?', 'COG', 'COG'],
    ['en', 'What are the latest developments in Rwanda?', 'RWA', 'RWA'],
    ['pl', 'Demokratyczna Republika Konga: jakie są najnowsze wydarzenia?', 'COD', undefined],
    ['pl', 'Polska: jakie są najnowsze wydarzenia?', 'POL', undefined],
  ])('%s · %s → route %s, Analysis %s, never Tonga', (lang, q, routeIso, analysisIso) => {
    expect(routeGeo(q, lang)).not.toContain('TON');
    expect(routeTypedCountryOf(route(q, lang))).toBe(routeIso);
    expect(handedOff(q, lang)).toBe(analysisIso);
  });

  it('pl "Kongo: …" (CLDR pl name of the Republic of the Congo) is a bare ambiguous Congo: Analysis types neither', () => {
    const q = 'Kongo: jakie są najnowsze wydarzenia?';
    expect(detectAmbiguousCountryMention(q)).toMatchObject({ candidates: ['COD', 'COG'] });
    expect(handedOff(q, 'pl')).toBeUndefined();
  });

  it('Analysis\'s own reader no longer returns COG for a Kinshasa-qualified Congo (and keeps COG for Brazzaville)', () => {
    expect(textTyped('What changed in Congo - Kinshasa')).toBe('COD');
    expect(textTyped('What changed in Congo - Brazzaville')).toBe('COG');
  });
});

describe('G-1 · the handoff rule', () => {
  const at = (iso3: string) => ({ country: { iso3 } });
  it('text only → text; route only → none (the route never adds a scope); same → it; different → none (disputed)', () => {
    expect(reconcileTypedCountry(at('KEN'), undefined)).toEqual({ location: at('KEN'), disputed: false });
    expect(reconcileTypedCountry(undefined, at('COD'))).toEqual({ location: undefined, disputed: false });
    expect(reconcileTypedCountry(at('COD'), at('COD'))).toEqual({ location: at('COD'), disputed: false });
    expect(reconcileTypedCountry(at('COD'), at('COG'))).toEqual({ location: undefined, disputed: true });
    expect(reconcileTypedCountry(undefined, undefined)).toEqual({ location: undefined, disputed: false });
  });

  it('the route never moves a question onto a country feed the text reader did not choose ("Kenya\'s economy" keeps its path)', () => {
    const q = "What has changed in Kenya's economy?";
    expect(routeTypedCountryOf(route(q))).toBe('KEN');
    expect(handedOff(q)).toBe(textTyped(q));
  });

  it('only ONE reader-typed COUNTRY crosses: a comparison, a corridor or no typed place passes none', () => {
    expect(routeTypedCountryOf(route('What is happening in Kenya?'))).toBe('KEN');
    expect(routeTypedCountryOf(route('What changed this week in Congo'))).toBeUndefined();
    expect(routeTypedCountryOf(route('What is the latest world news?'))).toBeUndefined();
    expect(
      routeTypedCountryOf({
        corridor: null,
        envelope: {
          geography: {
            candidates: [
              { source: 'TYPED_GEOGRAPHY', value: 'KEN', precision: 'COUNTRY' },
              { source: 'TYPED_GEOGRAPHY', value: 'RWA', precision: 'COUNTRY' },
            ],
          },
        },
      } as never),
    ).toBeUndefined();
    expect(
      routeTypedCountryOf({
        corridor: null,
        envelope: { geography: { candidates: [{ source: 'MAP_GEOGRAPHY_CONTEXT', value: 'KEN', precision: 'COUNTRY' }] } },
      } as never),
    ).toBeUndefined();
  });
});

describe('G-2 · a reviewed country word is never typo-corrected into another country', () => {
  it.each(['Konga', 'Kongu', 'Kongo', 'konga'])('"%s" is not corrected (it is a Congo form, not a typo of Tonga)', (w) => {
    expect(resolveGeoTypo(w)).toBeUndefined();
  });

  it('genuine typos still correct (positive controls)', () => {
    expect(resolveGeoTypo('Rwnada')?.canonicalLocation).toBe('rwanda');
    expect(resolveGeoTypo('Kigalli')?.canonicalLocation).toBe('kigali');
    expect(resolveGeoTypo('Tongaa')?.canonicalLocation).toBe('tonga');
  });

  it('Tonga itself still resolves when the reader names it', () => {
    expect(routeGeo('What is happening in Tonga?')).toEqual(['TON']);
    expect((resolveGeography('Cyclone hits Tonga') as any).place?.country?.iso3).toBe('TON');
  });

  it.each([
    'Co zmieniło się w Demokratyczna Republika Konga',
    'Co zmieniło się w Demokratycznej Republice Konga',
  ])('pl "%s" never reaches Tonga anywhere', (q) => {
    expect(routeGeo(q, 'pl')).not.toContain('TON');
    expect((resolveGeography(q) as any).place?.country?.iso3).not.toBe('TON');
  });
});
