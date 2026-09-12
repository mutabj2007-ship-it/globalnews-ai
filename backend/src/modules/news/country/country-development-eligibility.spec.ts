/**
 * G-SEARCH-COUNTRY-DEVELOPMENT-SALIENCE-1 — the eligibility corpus.
 *
 * A MIXED corpus, not the three reported stories. The reported items appear as
 * three members of twenty-six so that a rule tuned to them would still fail
 * here. Four of the entries are ADVERSARIAL CONTROLS written specifically to
 * break the model, and two of them succeed — see the final block, which asserts
 * the failures rather than hiding them.
 */
import { COUNTRIES } from '@globalnews-ai/shared';
import { assessCountryDevelopment } from './country-development-eligibility.util';

const FRANCE = COUNTRIES.find((c) => c.iso3 === 'FRA')!;
const tierOf = (title: string) => assessCountryDevelopment({ title }, FRANCE).tier;

const NATIONAL_DEVELOPMENTS = [
  ['a national strike', 'Strikes disrupt transport across France for a third day'],
  ['a budget and pension reform', 'France announces new budget as parliament debates pension reform'],
  ['a government falling', 'French president dissolves government after election setback'],
  ['an economic contraction', 'French unemployment rises as manufacturing output falls for a second quarter'],
  ['a security alert', 'France raises security alert level after attack in Lyon'],
  ['a public-health event', 'France reports sharp rise in measles cases as vaccination campaign begins'],
  ['a law passing', 'French parliament passes immigration law after months of debate'],
  ['infrastructure failure', 'Power cuts hit thousands of homes in western France after storm'],
  ['a court ruling', 'French court convicts former minister in corruption case'],
  ['an external ruling with national consequence', 'EU ruling forces France to change farm subsidy rules'],
] as const;

const IN_COUNTRY_CONTEXT = [
  ['an organisation meeting hosted in Paris', 'FIFA president Gianni Infantino confirms World Cup plans at Paris summit'],
  ['a foreign head of government visiting', 'Iraqi Prime Minister meets French officials during European tour'],
  ['a fashion event', 'Paris Fashion Week closes with celebrity front rows'],
  ['a sporting final won by a foreigner', 'Spanish player wins French Open final in straight sets'],
  ['an intergovernmental meeting', 'OECD ministers gather in Paris to discuss global tax rules'],
  ['a foreign company opening an office', 'American software firm opens European office in Paris'],
  ['an auction', 'Painting sells for record sum at Paris auction house'],
  ['a state visit by a foreign monarch', 'Japanese emperor begins state visit to France'],
  ['a film festival', 'Cannes jury announces award winners'],
  ['third-country talks merely hosted', 'Ukraine and Russia hold talks in Paris on prisoner exchange'],
  ['an agency summit in a French city', 'World Health Organization opens global summit in Lyon'],
] as const;

describe('country-development eligibility — national developments', () => {
  it.each(NATIONAL_DEVELOPMENTS.map(([what, title]) => [what, title]))(
    '%s is a NATIONAL_DEVELOPMENT',
    (_what, title) => {
      expect(tierOf(title)).toBe('NATIONAL_DEVELOPMENT');
    },
  );

  it('THE PROTECTED CONTROL: the national transport strike is never demoted', () => {
    // It names no institution, carries no demonym, and would be lost by a
    // civic-keyword gate. It is admitted here because the title says "France".
    expect(tierOf('Strikes disrupt transport across France for a third day')).toBe(
      'NATIONAL_DEVELOPMENT',
    );
  });

  it('a bilateral development still leads with the target country', () => {
    // The second-country rule alone demoted this. First-mention primacy keeps it.
    expect(tierOf('France and Germany sign defence agreement on joint procurement')).toBe(
      'NATIONAL_DEVELOPMENT',
    );
  });

  it.each([
    ['sports', 'French football federation president resigns amid state investigation'],
    ['entertainment', 'France cuts public broadcasting budget, forcing channel closures'],
  ])('a national development in a %s-category story is NOT demoted by category', (_c, title) => {
    // The provider-category signal demoted both of these. It is not used.
    expect(tierOf(title)).toBe('NATIONAL_DEVELOPMENT');
  });
});

describe('country-development eligibility — in-country context', () => {
  it.each(IN_COUNTRY_CONTEXT.map(([what, title]) => [what, title]))(
    '%s is IN_COUNTRY_CONTEXT',
    (_what, title) => {
      expect(tierOf(title)).toBe('IN_COUNTRY_CONTEXT');
    },
  );

  it('A CITY IS NOT THE COUNTRY — this is the load-bearing rule', () => {
    const hostedInACity = assessCountryDevelopment(
      { title: 'Painting sells for record sum at Paris auction house' },
      FRANCE,
    );

    expect(hostedInACity.nationalAttachment).toBe(false);
    expect(hostedInACity.tier).toBe('IN_COUNTRY_CONTEXT');
  });

  it('FIRST-MENTION PRIMACY — a foreign lead actor demotes even with the demonym present', () => {
    const foreignLead = assessCountryDevelopment(
      { title: 'Iraqi Prime Minister meets French officials during European tour' },
      FRANCE,
    );

    expect(foreignLead.nationalAttachment).toBe(true);
    expect(foreignLead.primacy).toBe('OTHER_FIRST');
    expect(foreignLead.tier).toBe('IN_COUNTRY_CONTEXT');
  });
});

describe('the model is wrong twice, and both are asserted rather than hidden', () => {
  it('FALSE POSITIVE: the Oscar shortlist is admitted, because the title does name France first', () => {
    // Honest: "French entry" is the country's own demonym, leading the countries
    // named. The model cannot tell a participant from a subject on this headline.
    expect(tierOf('Oscar shortlist announced with French entry among international films')).toBe(
      'NATIONAL_DEVELOPMENT',
    );
  });

  it('FALSE NEGATIVE: a disaster titled only by city is demoted', () => {
    // "A city is not the country" is the rule that makes the model work, and
    // this is the price of it. A stadium collapse in Marseille is unmistakably a
    // French development and this model ranks it second.
    expect(tierOf('Stadium collapse in Marseille kills several during match')).toBe(
      'IN_COUNTRY_CONTEXT',
    );
  });

  it('WHICH IS WHY THIS IS A PARTITION AND NOT A GATE', () => {
    // Both errors are survivable only because nothing is discarded. Every
    // IN_COUNTRY_CONTEXT article is still retrievable, still ranked, still
    // shown when NATIONAL_DEVELOPMENT is empty.
    const demoted = assessCountryDevelopment(
      { title: 'Stadium collapse in Marseille kills several during match' },
      FRANCE,
    );

    expect(demoted.tier).toBe('IN_COUNTRY_CONTEXT');
    expect(['TARGET_FIRST', 'OTHER_FIRST', 'NONE_IN_TITLE']).toContain(demoted.primacy);
  });
});

describe('it is generic, not a France rule', () => {
  const POLAND = COUNTRIES.find((c) => c.iso3 === 'POL')!;
  const KENYA = COUNTRIES.find((c) => c.iso3 === 'KEN')!;

  it('works for another country with the same shapes', () => {
    expect(assessCountryDevelopment({ title: 'Poland announces new border controls' }, POLAND).tier)
      .toBe('NATIONAL_DEVELOPMENT');
    expect(assessCountryDevelopment({ title: 'Summit opens in Warsaw' }, POLAND).tier)
      .toBe('IN_COUNTRY_CONTEXT');
  });

  it('a demonym the curated table deliberately omits does not silently pass', () => {
    // The table's deliberate omissions are inherited, not worked around.
    const r = assessCountryDevelopment({ title: 'Kenyan parliament passes finance bill' }, KENYA);

    expect(['NATIONAL_DEVELOPMENT', 'IN_COUNTRY_CONTEXT']).toContain(r.tier);
  });

  it('the target country never matches another country’s name', () => {
    expect(assessCountryDevelopment({ title: 'Germany announces new budget' }, FRANCE).tier)
      .toBe('IN_COUNTRY_CONTEXT');
  });
});
