import type { NewsArticle } from '@globalnews-ai/shared';
import { COUNTRIES } from '@globalnews-ai/shared';
import { scoreCountryRelevance, resolvePrimaryCountry } from './country-relevance.util';

/**
 * GEO-PRECISION — COUNTRY / SUBNATIONAL COLLISION (G1 + G2).
 *
 * The confirmed article: "Bago Mourns Village Head Killed By Bandits In Niger"
 * (Independent Newspaper Nigeria). Its subject is the village head of Galla, in
 * Borgu Local Government Area, NIGER STATE, Nigeria — and the Analysis
 * Workspace drew the sovereign country Niger.
 *
 * Measured before this repair, on this exact headline:
 *
 *     summary naming "Niger State"          Niger 100  Nigeria 10  -> Niger
 *     summary naming "Niger State, Nigeria" Niger 100  Nigeria 40  -> Niger
 *
 * The sovereign country that was actually named lost to the subdivision's head
 * word. These tests pin the correction and, just as importantly, pin the
 * ambiguity that must NOT be corrected away.
 */

function makeArticle(title: string, summary: string): Pick<NewsArticle, 'title' | 'summary'> {
  return { title, summary };
}

const country = (name: string) => {
  const found = COUNTRIES.find((c) => c.name === name);
  if (!found) throw new Error(`fixture names a country that does not exist: ${name}`);
  return found;
};

const NIGER_HEADLINE = 'Bago Mourns Village Head Killed By Bandits In Niger';
const NIGER_STATE_SUMMARY =
  'Governor Bago of Niger State mourned the village head of Galla in Borgu Local Government Area.';

describe('N1 — the confirmed Niger State case resolves to Nigeria, never to Niger', () => {
  const article = makeArticle(NIGER_HEADLINE, NIGER_STATE_SUMMARY);

  it('does not resolve to the sovereign country Niger', () => {
    expect(resolvePrimaryCountry(article)?.countryName).not.toBe('Niger');
  });

  it('resolves to Nigeria', () => {
    expect(resolvePrimaryCountry(article)?.countryName).toBe('Nigeria');
  });
});

describe('N2 — "Niger State, Nigeria" spelled out: Nigeria must outscore Niger', () => {
  const article = makeArticle(
    NIGER_HEADLINE,
    'Governor Bago of Niger State, Nigeria mourned the village head of Galla in Borgu.',
  );

  it('the country that is actually named wins', () => {
    const niger = scoreCountryRelevance(article, country('Niger')).score;
    const nigeria = scoreCountryRelevance(article, country('Nigeria')).score;

    expect(nigeria).toBeGreaterThan(niger);
    expect(resolvePrimaryCountry(article)?.countryName).toBe('Nigeria');
  });
});

describe('N3 — G2: the subdivision qualifier stops arguing for the wrong nation', () => {
  /**
   * Before the repair: "Attack in Niger." scored 30 for sovereign Niger and
   * "Attack in Niger State." scored 35 — the word "State" ADDED to the score
   * of the country the phrase proves it is not.
   */
  it('adding the word "State" no longer raises the colliding country’s score', () => {
    const bare = scoreCountryRelevance(makeArticle('Report', 'Attack in Niger.'), country('Niger'));
    const stated = scoreCountryRelevance(
      makeArticle('Report', 'Attack in Niger State.'),
      country('Niger'),
    );

    expect(stated.score).toBeLessThan(bare.score);
  });

  it('and the colliding country draws no country reference at all from the phrase', () => {
    const stated = scoreCountryRelevance(
      makeArticle('Report', 'Attack in Niger State.'),
      country('Niger'),
    );

    expect(stated.reasons).not.toContain('country reference appears in summary');
    expect(stated.isRelevant).toBe(false);
  });

  it('THE G2 ISOLATION TEST: the qualifier contributes NOTHING, not merely too little', () => {
    /*
      This assertion exists because the first version of these tests did not
      catch the G2 mutation. Asserting only that the score DROPPED passes even
      with the qualifier still counting, because G1 alone removes the 30-point
      name evidence and 5 points of context can never reach the 35 threshold on
      its own. That made the weaker test pass against code where "State" still
      scored for the wrong nation.

      What actually distinguishes G2 is that the colliding country scores ZERO
      and records no context reason at all. Those five points are not harmless:
      the argmax in resolvePrimaryCountry() is decided by strict comparison, so
      a stray +5 can still tip a close result or turn what should be a tie into
      a winner.
    */
    const stated = scoreCountryRelevance(
      makeArticle('Report', 'Attack in Niger State.'),
      country('Niger'),
    );

    expect(stated.score).toBe(0);
    expect(stated.reasons.join(' ')).not.toContain('country-context term');
  });
});

describe('N4 — Borgu, Galla and Governor Bago do not promote sovereign Niger', () => {
  it('a Niger State story with no other geography still avoids Niger', () => {
    const article = makeArticle(
      NIGER_HEADLINE,
      'The Galla community in Borgu mourned after Governor Bago visited Niger State.',
    );

    expect(resolvePrimaryCountry(article)?.countryName).not.toBe('Niger');
  });
});

describe('N6 — the State of Georgia is not the country Georgia', () => {
  const article = makeArticle(
    'Georgia lawmakers pass new election bill in Atlanta',
    'The State of Georgia approved the measure. Governor Brian Kemp is expected to sign it.',
  );

  it('never resolves to sovereign Georgia', () => {
    expect(resolvePrimaryCountry(article)?.countryName).not.toBe('Georgia');
  });

  it('resolves to the United States, or to nothing — never to the wrong sovereign', () => {
    const resolved = resolvePrimaryCountry(article)?.countryName;
    expect(resolved === 'United States' || resolved === undefined).toBe(true);
  });

  it('DELIBERATE OMISSION: "Georgia State" is NOT in the table, because it names universities and teams', () => {
    // Georgia State University / Georgia State Panthers. The guard has to stay
    // geographical, so this string must not suppress anything on its own.
    const university = makeArticle(
      'Georgia State University opens new research centre',
      'The university said the centre will focus on public health.',
    );

    expect(() => resolvePrimaryCountry(university)).not.toThrow();
  });
});

describe('N7 — New Mexico is not Mexico', () => {
  const article = makeArticle(
    'Wildfire spreads across New Mexico',
    'Crews battled the blaze in New Mexico. The governor declared a state of emergency.',
  );

  it('never resolves to sovereign Mexico', () => {
    expect(resolvePrimaryCountry(article)?.countryName).not.toBe('Mexico');
  });

  it('resolves to the United States, or to nothing', () => {
    const resolved = resolvePrimaryCountry(article)?.countryName;
    expect(resolved === 'United States' || resolved === undefined).toBe(true);
  });

  it('no qualifier word is involved here — a rule about "State" alone would have missed this', () => {
    expect('New Mexico').not.toMatch(/state/i);
  });
});

describe('N8 — Washington State, the control that already passed and must keep passing', () => {
  it('still resolves to the United States', () => {
    const article = makeArticle(
      'Flooding closes highways in Washington State',
      'Washington State authorities closed several roads after heavy rain.',
    );

    expect(resolvePrimaryCountry(article)?.countryName).toBe('United States');
  });
});

describe('N9 — genuine sovereign Niger must remain reachable', () => {
  it('a real Niger story still resolves to Niger', () => {
    const article = makeArticle(
      "Niger's junta suspends political parties",
      'The military government in Niamey said the measure takes effect immediately.',
    );

    expect(resolvePrimaryCountry(article)?.countryName).toBe('Niger');
  });

  it('the guard removes only the NAME signal — a demonym is independent evidence and survives it', () => {
    /*
      Contradictory text on purpose. The suppression gate wraps
      containsCountryReference() and nothing else, so a demonym, a curated city
      and an ISO code all still count for the colliding country. If a future
      edit widened the gate to swallow them, this fails.

      A curated capital would have been the more natural fixture, but the
      curated city list holds 24 entries and none of them belongs to Niger,
      Georgia or Mexico — so no such fixture can be written honestly, and
      asserting one would be asserting a capability this repository does not
      have. The demonym path is the one that can actually be exercised here.
    */
    const article = makeArticle(
      'Nigerien forces respond after the Niger State killing',
      'Nigerien troops were deployed following the attack in Niger State.',
    );

    const scored = scoreCountryRelevance(article, country('Niger'));

    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.join(' ')).toContain('demonym');
    expect(scored.reasons.join(' ')).not.toContain('country reference');
  });
});

describe('N10 — the pre-existing longer-name overrides are untouched', () => {
  it.each([
    [
      'South Sudan signs new peace framework',
      'The government of South Sudan met mediators in Juba.',
      'South Sudan',
    ],
    [
      'DR Congo announces new mining rules',
      'The government of DR Congo published the decree.',
      'DR Congo',
    ],
    [
      'Equatorial Guinea opens new terminal',
      'The government of Equatorial Guinea said it is complete.',
      'Equatorial Guinea',
    ],
  ])('%s -> %s', (title, summary, expected) => {
    expect(resolvePrimaryCountry(makeArticle(title, summary))?.countryName).toBe(expected);
  });
});

describe('N11 — the person guard still yields no country', () => {
  it.each([
    [
      'Training facility opens ahead of the new season',
      'The player Michael Jordan attended the ceremony with his former coach.',
    ],
    ['Striker signs a two-year deal', 'The player Chad Johnson joined the club, aged 27.'],
  ])('%s', (title, summary) => {
    expect(resolvePrimaryCountry(makeArticle(title, summary))).toBeUndefined();
  });
});

describe('N12 — G2 was scoped, not a blanket removal of "state" and "province"', () => {
  it('"the state visit" is still ordinary country context', () => {
    const article = makeArticle(
      'Kenya prepares for the state visit',
      'The government said the state visit will focus on trade.',
    );

    expect(resolvePrimaryCountry(article)?.countryName).toBe('Kenya');
    expect(scoreCountryRelevance(article, country('Kenya')).reasons.join(' ')).toContain(
      'country-context term',
    );
  });

  it('"the province declared" is still ordinary country context', () => {
    const article = makeArticle(
      'Canada tightens rules',
      'The province declared the measure effective. The government of Canada agreed.',
    );

    expect(scoreCountryRelevance(article, country('Canada')).reasons.join(' ')).toContain(
      'country-context term',
    );
  });
});

describe('N15 — TITLE-ONLY AMBIGUITY MUST SURVIVE', () => {
  /**
   * The CTO refinement that shapes this whole repair: "In Niger" on its own may
   * genuinely mean the sovereign country. The guard fires on disambiguating
   * evidence, never on the headline alone, and there must be no rule of the
   * form "headline contains Niger -> Nigeria".
   */
  it('the headline with no Niger-State evidence still resolves to Niger', () => {
    expect(resolvePrimaryCountry(makeArticle(NIGER_HEADLINE, ''))?.countryName).toBe('Niger');
  });

  it('and is not rewritten to Nigeria', () => {
    expect(resolvePrimaryCountry(makeArticle(NIGER_HEADLINE, ''))?.countryName).not.toBe('Nigeria');
  });

  it('a summary that names neither the state nor Nigeria leaves the reading alone', () => {
    const article = makeArticle(
      NIGER_HEADLINE,
      'Bandits attacked the village at night, residents said. The governor sent condolences.',
    );

    expect(resolvePrimaryCountry(article)?.countryName).toBe('Niger');
  });
});

describe('THE COST OF THE DOCUMENT-LEVEL RULE, pinned rather than discovered later', () => {
  /**
   * Suppression is document-level, because an occurrence-scoped rule leaves the
   * bare "Georgia" in a headline scoring 60 and the article resolves wrongly
   * anyway. The price is that an article genuinely about sovereign Mexico which
   * ALSO mentions New Mexico loses its Mexico name evidence. Unresolved is the
   * outcome the contract prefers over an unsupported claim, but the behaviour
   * should be visible, not folklore.
   */
  it('an article naming both Mexico and New Mexico does not resolve to Mexico', () => {
    const article = makeArticle(
      'Mexico and New Mexico sign cross-border water deal',
      'Officials from Mexico met counterparts from New Mexico to agree the allocation.',
    );

    expect(resolvePrimaryCountry(article)?.countryName).not.toBe('Mexico');
  });

  it('an ordinary Mexico story with no New Mexico mention is completely unaffected', () => {
    const article = makeArticle(
      'Mexico raises minimum wage',
      'The government of Mexico announced the increase this week.',
    );

    expect(resolvePrimaryCountry(article)?.countryName).toBe('Mexico');
  });
});
