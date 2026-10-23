import { countryAliasesFor, findCountryByIso3 } from '@globalnews-ai/shared';
import { impactPlacesFor, readFollowUpGeography, relatesPlaces } from './follow-up-impact.util';

/*
  EA LX-2 P2 (EA-LX2-c084b06.md) — COD's both-places vocabulary was ["dr congo", cities]: no "drc", no
  long form, no "congolese", so an uncited sentence naming the DRC that way was not withheld. The guard
  now reads the resolver's own alias table (≥3 letters) and a guard-only "congolese". Withhold-only:
  nothing here can admit a sentence or route a country.
*/
describe('EA LX-2 P2 · the both-places guard names the DRC the way readers do', () => {
  const geo = readFollowUpGeography(
    'How does that affect the DRC?',
    'What happened in Gaza today?',
  );
  const places = impactPlacesFor(geo.originTerms, geo.origin, geo.added);

  it('the follow-up resolves to COD (never COG or TON)', () => {
    expect(geo.added.map((c) => c.iso3)).toEqual(['COD']);
  });

  it('COD destination vocabulary carries the aliases and the guard-only demonym', () => {
    expect(places.destination).toEqual(
      expect.arrayContaining([
        'drc',
        'democratic republic of the congo',
        'democratic republic of congo',
        'congolese',
        'kinshasa',
      ]),
    );
  });

  it('the alias table never contributes the bare "congo" to COD', () => {
    expect(countryAliasesFor('COD')).not.toContain('congo');
  });

  it.each([
    'Prices in the DRC rose after the Gaza war.',
    'The Democratic Republic of Congo pays more for fuel since the Gaza war.',
    'Congolese importers paid more as the Gaza war dragged on.',
  ])('withholds an uncited both-places sentence: %p', (sentence) => {
    expect(relatesPlaces(sentence, places)).toBe(true);
  });

  /* no effect verb, so only the both-places test could fire (an effect verb fires on its own, by design) */
  it.each(['The Gaza war entered its second year.', 'The DRC held a regional summit in Kinshasa.'])(
    'one side only is not a both-places sentence: %p',
    (sentence) => {
      expect(relatesPlaces(sentence, places)).toBe(false);
    },
  );

  it('two-letter aliases never enter the guard ("us" is a pronoun)', () => {
    const usa = impactPlacesFor(
      ['gaza'],
      [],
      [findCountryByIso3('USA')!, findCountryByIso3('GBR')!],
    );
    expect(usa.destination).toEqual(
      expect.arrayContaining(['usa', 'united states', 'united kingdom']),
    );
    expect(usa.destination).not.toContain('us');
    expect(usa.destination).not.toContain('uk');
    expect(relatesPlaces('Gaza aid groups told us the war is worsening.', usa)).toBe(false);
  });

  it('the shared vocabulary that routes relevance is untouched: "congolese" is guard-only', () => {
    const cog = impactPlacesFor(['gaza'], [], [findCountryByIso3('COG')!]);
    expect(cog.destination).toContain('congolese');
    expect(countryAliasesFor('COD')).not.toContain('congolese');
    expect(countryAliasesFor('COG')).not.toContain('congolese');
  });
});
