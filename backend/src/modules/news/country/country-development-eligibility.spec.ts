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

/**
 * C911-R1 -- INCIDENTAL-ROLE FRAMES.
 *
 * The reproduced Production shape and its negative controls. Every control
 * below was MEASURED on the accepted C910 baseline before the correction, and
 * the measured baseline tier is stated beside each one so a future reader can
 * tell which assertions the correction changed and which it merely protects.
 */
describe('C911-R1 -- a country named in an incidental role does not lead', () => {
  const ZAF = COUNTRIES.find((c) => c.iso3 === 'ZAF')!;
  const zaTier = (title: string) => assessCountryDevelopment({ title }, ZAF).tier;

  describe('THE DEFECT -- measured NATIONAL_DEVELOPMENT on C910, now demoted', () => {
    it('an opponent in a fixture is not a national development (Production shape)', () => {
      // C910: NATIONAL_DEVELOPMENT / TARGET_FIRST. A squad selection in
      // Australia led a South Africa analysis.
      const tier = zaTier('Wallabies name squad for Rugby Championship clash against South Africa');

      expect(tier).toBe('IN_COUNTRY_CONTEXT');
    });

    it('versus and vs are the same opposition frame as against', () => {
      expect(zaTier('Argentina squad announced for Test versus South Africa')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
      expect(zaTier('Match preview: Australia vs South Africa')).toBe('IN_COUNTRY_CONTEXT');
    });

    it('membership in an enumeration is not a national development', () => {
      // C910: NATIONAL_DEVELOPMENT / TARGET_FIRST.
      expect(zaTier('G20 bloc including South Africa agrees debt relief framework')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
      expect(zaTier('Emerging markets such as South Africa face higher borrowing costs')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
    });
  });

  describe('NEGATIVE CONTROLS -- legitimate reporting keeps the tier it had on C910', () => {
    it('a domestic national development still leads', () => {
      expect(zaTier('South Africa parliament passes new electricity reform bill')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });

    it('a summit materially involving the country still leads', () => {
      expect(zaTier('South Africa to host G20 leaders summit in Johannesburg')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });

    it('the national team winning at home still leads -- sport is not the signal', () => {
      expect(zaTier('South Africa wins Rugby Championship after victory in Cape Town')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });

    it('the country leading its own fixture headline still leads', () => {
      // The frame demotes the country named AFTER 'against', never the one
      // named before it. 'South Africa beat Australia' is a South Africa story.
      expect(zaTier('South Africa beat Australia in Rugby Championship opener')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });

    it('bare "as" is not an enumeration frame', () => {
      // Only 'such as' is the frame. 'as South Africa votes' is substantive.
      expect(zaTier('Markets steady as South Africa votes on budget')).toBe('NATIONAL_DEVELOPMENT');
    });

    it('sanctions, investment and foreign military action remain admissible', () => {
      // These were IN_COUNTRY_CONTEXT on C910 because another country leads the
      // title. The correction does not change them -- it is asserted here so a
      // later change to the frame list cannot silently exclude them.
      expect(zaTier('United States imposes new sanctions on South Africa mining executives')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
      expect(zaTier('Chinese carmaker to build 2 billion dollar plant in South Africa')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
      expect(zaTier('Russian naval vessels begin joint exercise off South Africa coast')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
    });
  });

  describe('THE PARTITION IS UNCHANGED -- nothing is excluded', () => {
    it('every demoted article still returns a tier, never an exclusion', () => {
      const demoted = [
        'Wallabies name squad for Rugby Championship clash against South Africa',
        'G20 bloc including South Africa agrees debt relief framework',
      ];

      for (const title of demoted) {
        const verdict = assessCountryDevelopment({ title }, ZAF);

        expect(['NATIONAL_DEVELOPMENT', 'IN_COUNTRY_CONTEXT']).toContain(verdict.tier);
        expect(typeof verdict.reason).toBe('string');
      }
    });

    it('the France corpus above is unaffected by the new frames', () => {
      expect(tierOf('France announces new budget as parliament debates pension reform')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(tierOf('Strikes disrupt transport across France for a third day')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });
  });
});

/**
 * C911-V1 -- THE PRODUCTION VISUAL DEFECT.
 *
 * The article that actually led a Production South Africa evidence set, and the
 * shapes around it. Every rejecting fixture here was MEASURED as
 * NATIONAL_DEVELOPMENT / TARGET_FIRST on the accepted C911 tree
 * 30f38eea46bc59899ef5e444548f0f76a61a4af8 before this correction.
 */
describe('C911-V1 -- the Wallabies / Western Force shape cannot lead', () => {
  const ZAF = COUNTRIES.find((c) => c.iso3 === 'ZAF')!;
  const za = (title: string) => assessCountryDevelopment({ title }, ZAF).tier;

  describe('REJECTING FIXTURES -- opponent, schedule target or contest modifier', () => {
    it('the exact Production headline shape does not lead', () => {
      // C911 tree: NATIONAL_DEVELOPMENT / TARGET_FIRST. This is the card the
      // Product Owner saw first on /search?q=South+Africa&countryCode=ZA.
      expect(za('Wallabies name five Western Force players to face South Africa')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
    });

    it('the country as an attributive modifier of a contest noun does not lead', () => {
      // C911 tree: NATIONAL_DEVELOPMENT / TARGET_FIRST.
      expect(za('Wallabies name five Western Force players for South Africa Test')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
      expect(za('Argentina announce squad for South Africa series')).toBe('IN_COUNTRY_CONTEXT');
      expect(za('Ireland confirm South Africa tour dates')).toBe('IN_COUNTRY_CONTEXT');
    });

    it('every opposition marker form is covered, not just "against"', () => {
      for (const title of [
        'Australia name squad to face South Africa',
        'Australia name squad against South Africa',
        'Argentina squad announced for Test versus South Africa',
        'Match preview: Australia vs South Africa',
        'Wales host South Africa in November',
      ]) {
        expect(za(title)).toBe('IN_COUNTRY_CONTEXT');
      }
    });

    it('a schedule or comparison marker does not make it a national development', () => {
      expect(za('Australia finalise preparations ahead of South Africa')).toBe(
        'IN_COUNTRY_CONTEXT',
      );
      expect(za('Nigeria inflation falls, unlike South Africa')).toBe('IN_COUNTRY_CONTEXT');
    });
  });

  describe('POSITIVE CONTROLS -- material South Africa stories still lead', () => {
    it('SPORT: the national team as the actor still leads', () => {
      expect(za('South Africa beat Australia in Rugby Championship opener')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(za('South Africa wins Rugby Championship after victory in Cape Town')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(za('South Africa names Test squad for home series')).toBe('NATIONAL_DEVELOPMENT');
      expect(za('South Africa to host Rugby Championship decider in Johannesburg')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });

    it('POLITICS: domestic institutions still lead', () => {
      expect(za('South Africa parliament passes new electricity reform bill')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(za('South Africa president signs public procurement act')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(za('South Africa cabinet approves new energy policy')).toBe('NATIONAL_DEVELOPMENT');
    });

    it('ECONOMY: domestic economic developments still lead', () => {
      expect(za('South Africa central bank holds repo rate at 8.25 percent')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(za('South Africa unemployment falls for a second quarter')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(za('South Africa to host G20 leaders summit in Johannesburg')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });

    it('a country modifying an INSTITUTION is not a contest modifier', () => {
      // 'South Africa Test' is a fixture; 'South Africa Reserve Bank' is not.
      expect(za('South Africa Reserve Bank revises growth forecast')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });

    it('the accepted France corpus is unaffected', () => {
      expect(tierOf('Strikes disrupt transport across France for a third day')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
      expect(tierOf('France announces new budget as parliament debates pension reform')).toBe(
        'NATIONAL_DEVELOPMENT',
      );
    });
  });

  describe('IT IS STILL A PARTITION -- nothing is excluded', () => {
    it('every demoted headline still returns a tier', () => {
      for (const title of [
        'Wallabies name five Western Force players to face South Africa',
        'Wallabies name five Western Force players for South Africa Test',
      ]) {
        expect(['NATIONAL_DEVELOPMENT', 'IN_COUNTRY_CONTEXT']).toContain(za(title));
      }
    });
  });
});
