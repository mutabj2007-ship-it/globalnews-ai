import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import { resolvePrimaryCountry } from './country-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SHARED COUNTRY ALIAS AUTHORITY — ALPHA RESILIENCE 1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT, MEASURED IN LIVE ALPHA. "eastern Democratic Republic of Congo"
 * resolved to CG — the Republic of the Congo, a different country roughly
 * 2,000 km from the fighting the question was about. The reader was not told
 * the evidence was about the wrong country, so a visible absence would have
 * been the safer failure.
 *
 * TWO CAUSES, BOTH IN THE SHARED AUTHORITY AND BOTH NOW CLOSED:
 *
 *   1. The alias table had `'democratic republic of the congo'` and not the
 *      equally valid spelling without "the" — which is what the query carried.
 *   2. `country-relevance.util.ts` matched country NAMES and had no way to see
 *      the alias table at all, so the phrase scored for CG on the bare embedded
 *      token "Congo".
 *
 * Fixed in the ONE alias authority, not in a second matcher and not inside the
 * retained-country gate that surfaced it.
 */

function query(text: string): string | undefined {
  return resolvePrimaryCountry({ title: text, summary: '' })?.countryCode;
}

describe('ALPHA RESILIENCE 1 · A — the two Congos resolve correctly', () => {
  it.each([
    ['eastern Democratic Republic of Congo', 'CD'],
    ['Democratic Republic of the Congo', 'CD'],
    ['DR Congo', 'CD'],
    ['Congo Kinshasa', 'CD'],
    ['Republic of the Congo', 'CG'],
    ['Congo Brazzaville', 'CG'],
  ])('%s -> %s', (text, expected) => {
    expect(query(text)).toBe(expected);
  });

  it('the identifier resolver accepts both DRC spellings', () => {
    expect(resolveCountryByAnyIdentifier('democratic republic of congo')?.iso2).toBe('CD');
    expect(resolveCountryByAnyIdentifier('democratic republic of the congo')?.iso2).toBe('CD');
    expect(resolveCountryByAnyIdentifier('republic of the congo')?.iso2).toBe('CG');
  });

  it('the longer phrase wins even buried in ordinary prose', () => {
    expect(
      query('Aid convoys reached the eastern Democratic Republic of Congo late on Tuesday'),
    ).toBe('CD');
  });

  it('bare "Congo" with no qualifier still resolves to CG', () => {
    /*
      THE RULE IS "LONGEST SPECIFIC PHRASE WINS", NOT "DRC ALWAYS WINS". With no
      longer phrase present there is nothing to suppress CG, and CG is the
      country whose registry name is "Congo".
    */
    expect(query('Congo raises fuel duty')).toBe('CG');
  });
});

describe('ALPHA RESILIENCE 1 · B — nothing else moved', () => {
  it('South Sudan and Sudan are unchanged', () => {
    expect(query('South Sudan peace talks resume')).toBe('SS');
    expect(query('Sudan floods displace thousands')).toBe('SD');
  });

  it('the Guinea family is unchanged', () => {
    expect(query('Papua New Guinea election result')).toBe('PG');
    expect(query('Equatorial Guinea oil output')).toBe('GQ');
    expect(query('Guinea-Bissau cashew harvest')).toBe('GW');
  });

  it('ordinary ISO-looking words do not become countries', () => {
    /*
      THE PROTECTION THIS CORRECTION MUST NOT WEAKEN. 'AND' is Andorra's ISO3,
      'ARM' Armenia's, 'ARE' the UAE's, 'NO' Norway's ISO2, 'IT' Italy's.
      Nothing in this change scans codes as prose — the alias phrases admitted
      are MULTI-WORD ONLY, so no single token, code or otherwise, participates.
    */
    expect(query('The talks are open and no date is set')).toBeUndefined();
    expect(query('It was a long arm of policy and no more')).toBeUndefined();
  });

  it('single-word aliases are NOT scanned as prose — "us" above all', () => {
    /*
      'us' is a key in the alias table. If the alias pass admitted single tokens,
      every article containing "told us" would be evidence for the United States.
      Multi-word-only is what prevents it, asserted rather than assumed.
    */
    expect(query('The minister told us the road would open')).toBeUndefined();
    expect(query('They asked us about the harvest')).toBeUndefined();
  });

  it('a multi-word alias still resolves its own country', () => {
    expect(query('United States of America imposes new tariffs')).toBe('US');
    expect(query('Ivory Coast cocoa exports climb')).toBe('CI');
  });
});
