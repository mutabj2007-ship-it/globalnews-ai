import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import {
  ACKNOWLEDGED_SUBDIVISION_SHADOWING,
  SUPRANATIONAL_REGIONS,
  findSupranationalSpans,
  maskSupranationalSpans,
} from './supranational-regions';
import { resolveGeography } from './geo-resolver';
import { citiesNamed, regionsNamed } from './geo-gazetteer';
import { foldPlaceName } from './geo-normalize.util';

/**
 * THE DEFECT, RE-STATED AS THE FIRST TEST.
 *
 * Before this guard, `resolveGeography('unrest in East Africa')` returned
 * PROVINCE / CONTESTED with candidates [East Region (Cameroon), Eastern Region
 * (Iceland)] — because no index holds "east africa", so the scanner fell back
 * to the shorter run "east". A reader asking about East Africa was offered
 * Cameroon and Iceland.
 */
describe('SUPRANATIONAL — the measured defect', () => {
  it('no longer answers "East Africa" with a Cameroonian or Icelandic province', () => {
    const result = resolveGeography('unrest in East Africa', { requireGeographicContext: true });

    expect(result.precision).toBe('UNKNOWN');
    expect(result.reason).toBe('SUPRANATIONAL_NOT_GAZETTEERED');
    expect(result.place).toBeUndefined();
    expect(result.candidates).toHaveLength(0);
  });

  it.each([
    'the Sahel',
    'the Horn of Africa',
    'flooding in the Baltic region',
    'the Middle East',
    'news from Southeast Asia',
    'Latin America',
    'the Caribbean',
    'Sub-Saharan Africa',
    'the Western Balkans',
  ])('refuses %s rather than inventing an extent', (question) => {
    const result = resolveGeography(question, { requireGeographicContext: true });

    expect(result.precision).toBe('UNKNOWN');
    expect(result.reason).toBe('SUPRANATIONAL_NOT_GAZETTEERED');
  });

  it('says WHICH region it could not place, so a surface can be specific', () => {
    const result = resolveGeography('what is happening in the Sahel?', {
      requireGeographicContext: true,
    });

    expect(result.matchedText).toBe('Sahel');
    expect(result.detail).toContain('supranational');
  });

  it('SUPRANATIONAL_NOT_GAZETTEERED is distinguishable from NO_PLACE_EVIDENCE', () => {
    const named = resolveGeography('the Sahel', { requireGeographicContext: true });
    const nothing = resolveGeography('explain inflation', { requireGeographicContext: true });

    expect(named.precision).toBe(nothing.precision); // both UNKNOWN
    expect(named.reason).not.toBe(nothing.reason); // and they mean different things
    expect(nothing.reason).toBe('NO_PLACE_EVIDENCE');
  });
});

/**
 * THE VERIFICATION THAT MAKES THE LIST SAFE TO GROW.
 *
 * A refusal list can only ever do one kind of damage: suppress something real.
 * These tests are the guard on that, and they are the same discipline the exonym
 * table is held to — an entry that shadows a real place FAILS the suite rather
 * than silently degrading a resolution.
 */
describe('SUPRANATIONAL — no entry may shadow something real', () => {
  it.each(SUPRANATIONAL_REGIONS)('"%s" is not a country', (phrase) => {
    expect(resolveCountryByAnyIdentifier(phrase)).toBeUndefined();
  });

  it.each(SUPRANATIONAL_REGIONS)('"%s" is not a gazetteer settlement', (phrase) => {
    expect(citiesNamed(foldPlaceName(phrase))).toEqual([]);
  });

  /*
   * A subdivision collision is ALLOWED, but only when someone decided it on
   * purpose. This test is the tripwire: add a region name that shadows a real
   * admin1 unit without recording it, and the suite fails and tells you which.
   */
  it.each(SUPRANATIONAL_REGIONS)(
    '"%s" shadows no subdivision, or is a recorded deliberate trade',
    (phrase) => {
      const shadowed = regionsNamed(foldPlaceName(phrase));

      if (shadowed.length === 0) return;

      expect(ACKNOWLEDGED_SUBDIVISION_SHADOWING).toContain(phrase);
    },
  );

  it('every acknowledged shadowing entry is still in the list, and still shadows', () => {
    for (const phrase of ACKNOWLEDGED_SUBDIVISION_SHADOWING) {
      expect(SUPRANATIONAL_REGIONS).toContain(phrase);
      // If a rebuild ever removes the collision, the acknowledgement is stale
      // and should be deleted rather than left to accumulate as folklore.
      expect(regionsNamed(foldPlaceName(phrase)).length).toBeGreaterThan(0);
    }
  });

  it('Micronesia is NOT in the list — it is a sovereign state', () => {
    expect(SUPRANATIONAL_REGIONS).not.toContain('Micronesia');
    expect(resolveCountryByAnyIdentifier('Micronesia')).toBeDefined();
  });

  it('every entry is unique', () => {
    expect(new Set(SUPRANATIONAL_REGIONS).size).toBe(SUPRANATIONAL_REGIONS.length);
  });
});

/**
 * WORD BOUNDARIES ARE THE WHOLE SAFETY ARGUMENT.
 *
 * "Central Africa" is listed. "Central African Republic" is a sovereign state.
 * If the match were a substring rather than a bounded phrase, listing the first
 * would erase the second — and a country disappearing from the resolver because
 * of a REFUSAL list would be a far worse defect than the one being fixed.
 */
describe('SUPRANATIONAL — real countries survive', () => {
  it.each([
    ['Central African Republic', 'CAF'],
    ['South Africa', 'ZAF'],
    ['protests in South Africa', 'ZAF'],
    ['North Macedonia', 'MKD'],
    ['South Korea', 'KOR'],
    ['South Sudan', 'SSD'],
  ])('%s still resolves to %s', (question, iso3) => {
    const result = resolveGeography(question, { requireGeographicContext: true });

    expect(result.place?.country.iso3).toBe(iso3);
  });

  it('a country named alongside a supranational region is still found', () => {
    const result = resolveGeography('what is happening in East Africa and Rwanda?', {
      requireGeographicContext: true,
    });

    expect(result.place?.country.iso3).toBe('RWA');
  });
});

describe('SUPRANATIONAL — the mask preserves every character offset', () => {
  it('replaces only letters and digits, and never changes length', () => {
    const text = 'Unrest in East Africa, reported Tuesday.';
    const masked = maskSupranationalSpans(text, findSupranationalSpans(text));

    expect(masked).toHaveLength(text.length);
    expect(masked).toBe('Unrest in xxxx xxxxxx, reported Tuesday.');
  });

  it('keeps the space and the comma so tokenizers stay aligned', () => {
    const text = 'Musanze, Rwanda and the Sahel';
    const masked = maskSupranationalSpans(text, findSupranationalSpans(text));

    expect(masked).toHaveLength(text.length);
    expect(masked).toBe('Musanze, Rwanda and the xxxxx');
  });

  it('leaves text with no supranational phrase completely untouched', () => {
    const text = 'What is happening in Kigali today?';

    expect(maskSupranationalSpans(text, findSupranationalSpans(text))).toBe(text);
  });

  it('tolerates a hyphen where the list has a space, and the reverse', () => {
    expect(findSupranationalSpans('Sub Saharan Africa')).toHaveLength(1);
    expect(findSupranationalSpans('Sub-Saharan Africa')).toHaveLength(1);
    expect(findSupranationalSpans('South-East Asia')).toHaveLength(1);
  });

  it('prefers the LONGEST phrase and never half-masks an overlap', () => {
    const spans = findSupranationalSpans('the Western Balkans are quiet');

    expect(spans).toHaveLength(1);
    expect(spans[0].phrase).toBe('Western Balkans');
  });
});

/**
 * THE COORDINATION RULE, WHICH THE MASK MADE NECESSARY.
 *
 * "in East Africa and Rwanda" — once the supranational phrase is masked, Rwanda
 * follows "and" rather than a preposition, and the geographic gate refused it.
 * The second member of a coordination is as geographic as the first. These tests
 * bound that rule: it must INHERIT context, never manufacture it.
 */
describe('COORDINATION — context is inherited, not manufactured', () => {
  it('a place after "and" inherits an earlier preposition', () => {
    const result = resolveGeography('unrest in Kigali and Musanze', {
      requireGeographicContext: true,
    });

    expect(result.place?.cityName).toBe('Kigali');
  });

  it('two countries coordinated are CONTESTED, not silently the first one', () => {
    const result = resolveGeography('what is happening in Rwanda and Kenya?', {
      requireGeographicContext: true,
    });

    expect(result.provenance).toBe('CONTESTED');
    expect(result.place).toBeUndefined();
    expect(result.candidates.map((candidate) => candidate.country.iso3).sort()).toEqual([
      'KEN',
      'RWA',
    ]);
  });

  it('a bare list with NO preposition stays refused', () => {
    const result = resolveGeography('compare Rwanda and Kenya', {
      requireGeographicContext: true,
    });

    expect(result.reason).toBe('NO_PLACE_EVIDENCE');
  });

  it('does not let "and" rescue a false positive the "of" rule already refused', () => {
    const result = resolveGeography('the University of Chad and Republic', {
      requireGeographicContext: true,
    });

    expect(result.precision).toBe('UNKNOWN');
  });

  it('does not open the gate on a non-geographic coordination', () => {
    const result = resolveGeography('he met Georgia and left', {
      requireGeographicContext: true,
    });

    expect(result.precision).toBe('UNKNOWN');
  });
});

/**
 * SUBDIVISION RECOVERY BY GENERIC-NOUN STEM.
 *
 * The approved change log names the case in its own words:
 *
 *   "including English usages such as 'the Western Region of Rwanda', which is
 *    PROVINCE."
 *
 * Rwanda's ISO 3166-2 name for that unit is "Western Province". Before this
 * recovery the resolver answered UNKNOWN — a miss on a case the specification
 * calls out by name.
 */
describe('SUBDIVISION — a generic administrative noun is not part of the name', () => {
  it.each([
    ['the Western Region of Rwanda', 'RW-04', 'Western Province'],
    ['the Eastern Province of Rwanda', 'RW-02', 'Eastern Province'],
    ['the Southern Province of Rwanda', 'RW-05', 'Southern Province'],
    ['what is happening in the Northern Region of Rwanda?', 'RW-03', 'Northern Province'],
    ['Western Region, Rwanda', 'RW-04', 'Western Province'],
    ['the Masovian Voivodeship of Poland', 'PL-14', 'Masovian Voivodeship'],
  ])('%s resolves to %s', (question, regionCode, regionName) => {
    const result = resolveGeography(question, { requireGeographicContext: true });

    expect(result.precision).toBe('PROVINCE');
    expect(result.place?.regionCode).toBe(regionCode);
    expect(result.place?.regionName).toBe(regionName);
  });

  it('provenance stays STATED — the reader named the subdivision', () => {
    const result = resolveGeography('the Western Region of Rwanda', {
      requireGeographicContext: true,
    });

    // Nothing was inferred except the word for what KIND of unit it is, which
    // is not a geographic inference. Marking this INTERPRETED would tell H to
    // draw a verified fact as unverified.
    expect(result.provenance).toBe('STATED');
    expect(result.reason).toBe('PROVINCE_BY_COUNTRY_CONTEXT');
  });

  it('a country whose own name for the unit IS "Region" is unaffected', () => {
    const result = resolveGeography('the Western Region of Uganda', {
      requireGeographicContext: true,
    });

    expect(result.place?.regionCode).toBe('UG-W');
    expect(result.place?.regionName).toBe('Western Region');
  });

  it('does not raise precision — a PROVINCE stays a PROVINCE', () => {
    const result = resolveGeography('the Western Region of Rwanda', {
      requireGeographicContext: true,
    });

    expect(result.precision).not.toBe('DISTRICT');
    expect(result.precision).not.toBe('CITY');
    expect(result.place?.point).toBeUndefined();
  });
});

describe('SUBDIVISION — the recovery cannot manufacture a place', () => {
  it('a bare generic noun resolves to nothing', () => {
    expect(resolveGeography('Region', { requireGeographicContext: true }).precision).toBe(
      'UNKNOWN',
    );
    expect(resolveGeography('Province', { requireGeographicContext: true }).precision).toBe(
      'UNKNOWN',
    );
  });

  it('a generic noun with a country but no subdivision name gives only the country', () => {
    const result = resolveGeography('the Region of Rwanda', { requireGeographicContext: true });

    expect(result.precision).toBe('COUNTRY');
    expect(result.place?.country.iso3).toBe('RWA');
  });

  it('still refuses the false positives the "of" rule was built for', () => {
    expect(
      resolveGeography('the University of Chad', { requireGeographicContext: true }).precision,
    ).toBe('UNKNOWN');
    expect(
      resolveGeography('Republic of Georgia', { requireGeographicContext: true }).precision,
    ).toBe('UNKNOWN');
  });

  it('does not fire without a country to scope it to', () => {
    // "Western Region" alone matches Iceland, Nepal and Uganda. With no country
    // named there is no honest basis for choosing, and the exact tier's
    // CONTESTED answer is the correct one.
    const result = resolveGeography('Western Region', { requireGeographicContext: true });

    expect(result.place).toBeUndefined();
  });

  it('an exact subdivision name is still answered by the exact tier', () => {
    const exact = resolveGeography('Western Australia', { requireGeographicContext: true });

    expect(exact.reason).toBe('PROVINCE_UNIQUE');
    expect(exact.place?.regionCode).toBe('AU-WA');
  });

  it('a defunct subdivision is not resurrected', () => {
    // Kenya's provinces were replaced by 47 counties in 2013 and the gazetteer
    // holds the counties. "Eastern Province of Kenya" therefore has no unit to
    // find, and the honest answer is the country.
    const result = resolveGeography('news from the Eastern Province of Kenya', {
      requireGeographicContext: true,
    });

    expect(result.precision).toBe('COUNTRY');
    expect(result.place?.country.iso3).toBe('KEN');
  });
});
