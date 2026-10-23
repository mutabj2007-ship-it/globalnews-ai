import { findCountryByIso3, type CountryMeta } from '@globalnews-ai/shared';
import {
  bodyAssertsEffectOf,
  impactPlacesFor,
  readFollowUpGeography,
  relatesPlaces,
} from './follow-up-impact.util';

/*
  Politics LX-2 (residual of 9aac59a) — the both-places test missed three shapes:
    a  the destination named by its city ("Nairobi"),
    b  the origin named by a demonym ("Palestinian", "Gazan"),
    c  namesTerm read only the FIRST indexOf hit, so "Gazans … the Gaza war" never matched "gaza".
*/
describe('Politics LX-2 · the both-places test reads cities, demonyms and every occurrence', () => {
  const country = (iso3: string): CountryMeta => findCountryByIso3(iso3)!;
  const geo = readFollowUpGeography('How does that affect Kenya?', 'What happened in Gaza today?');
  const places = impactPlacesFor(geo.originTerms, geo.origin, geo.added);

  it('builds both sides from the existing authorities', () => {
    expect(geo.added.map((c) => c.iso3)).toEqual(['KEN']);
    expect(places.origin).toEqual(
      expect.arrayContaining(['gaza', 'gazan', 'gazans', 'palestinian']),
    );
    expect(places.destination).toEqual(
      expect.arrayContaining(['kenya', 'kenyan', 'kenyans', 'nairobi', 'mombasa']),
    );
  });

  it.each([
    ['LX-2a', 'Nairobi fuel importers paid more as the Gaza war dragged on.'],
    ['LX-2b', "Palestinian displacement is straining Kenya's aid budget."],
    ['LX-2b', 'Gazan exporters lost Mombasa contracts this year.'],
    ['LX-2c', 'Gazans fled south; since the Gaza war Kenya pays more for fuel.'],
    ['LX-2c', 'Kenyanite traders say Kenya pays more since the Gaza war.'],
  ])('%s relates both places: %p', (_id, sentence) => {
    expect(relatesPlaces(sentence, places)).toBe(true);
  });

  it.each([
    'Nairobi raised pump prices on Friday.',
    'Palestinian officials said the ceasefire held.',
    'Gazaland reports rain. Nairobian is not a curated form.',
    'The Gaza ceasefire held. Nairobi traffic was heavy.',
  ])('one side only, a non-word hit, or two sentences relates nothing: %p', (sentence) => {
    expect(relatesPlaces(sentence, places)).toBe(false);
  });

  it('a term with regex metacharacters is matched literally', () => {
    const p = { origin: ['a.b'], destination: ['kenya'] };
    expect(relatesPlaces('a.b and Kenya', p)).toBe(true);
    expect(relatesPlaces('axb and Kenya', p)).toBe(false);
  });

  it('the link test is NOT widened: a demonym or city in the body is no link', () => {
    expect(
      bodyAssertsEffectOf('Palestinian displacement is raising costs for Kenya.', geo.originTerms),
    ).toBe(false);
    expect(
      bodyAssertsEffectOf('The Gaza war is raising fuel costs in Kenya.', geo.originTerms),
    ).toBe(true);
  });

  it('only a regular -a place term gets the -an demonym; country names keep the curated table', () => {
    const p = impactPlacesFor(['goma'], [country('COD')], [country('RWA')]);
    expect(p.origin).toEqual(expect.arrayContaining(['goma', 'goman', 'gomans']));
    expect(p.destination).toEqual(expect.arrayContaining(['rwanda', 'rwandan', 'kigali']));
    const q = impactPlacesFor(['kharkiv'], [country('UKR')], [country('POL')]);
    expect(q.origin).toEqual(expect.arrayContaining(['kharkiv', 'ukrainian', 'ukrainians']));
    expect(q.origin).not.toContain('kharkivn');
    expect(q.destination).toEqual(expect.arrayContaining(['poland', 'polish', 'warsaw', 'kraków']));
  });
});
