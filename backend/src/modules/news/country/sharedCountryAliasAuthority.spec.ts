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

  /*
    ════════════════════════════════════════════════════════════════════════
    SUPERSEDED EXPECTATION — NAMED, NOT DELETED
    ════════════════════════════════════════════════════════════════════════

    REMOVED 2026-10-11 by CTO supersession **R3-GEO-01**, on the independent
    recommendation of `RETRIEVAL-R1/EAST_AFRICA-G-REVIEW-R1/EA-G-01` §4:

        it('bare "Congo" with no qualifier still resolves to CG', () => {
          expect(query('Congo raises fuel duty')).toBe('CG');
        });

    Its comment read: "THE RULE IS 'LONGEST SPECIFIC PHRASE WINS', NOT 'DRC
    ALWAYS WINS'. With no longer phrase present there is nothing to suppress
    CG, and CG is the country whose registry name is 'Congo'."

    THAT REASONING IS SOUND ABOUT SUPPRESSION AND WRONG ABOUT EVIDENCE. It
    answers "which country wins" without first asking whether a word the shared
    authority itself declares ambiguous (`AMBIGUOUS_COUNTRY_NAMES:
    congo -> [COD, COG]`) should answer at all. The measured consequence was DR
    Congo reporting persisted as CG and served to Republic-of-the-Congo
    readers. R3-GEO-01: "For unconstrained prose, bare 'Congo' is ambiguous."

    EVERYTHING ELSE THIS BLOCK PROTECTS IS UNTOUCHED AND STILL PASSES: longest
    specific phrase wins, COD's spellings resolve COD inside prose, the
    explicit COG forms resolve COG, the identifier resolver accepts the
    variants, and · B's "nothing else moved". The six assertions below replace
    the one that was removed; they are EA-G-01 §4's table verbatim.
  */
  it.each([
    /* fails closed: an ambiguous name, nothing in the text to settle it */
    ['Congo raises fuel duty', undefined],
    /* settled by the country's own places — these must keep resolving */
    ['Congo announces budget in Brazzaville', 'CG'],
    ['Congo announces budget, Pointe-Noire port expands', 'CG'],
    /* explicit COG identifier, via the shared alias added with this change */
    ['Republic of Congo raises fuel duty', 'CG'],
    /* a COD city settles it the other way, through the existing curated path */
    ['Congo: clashes near Goma displace thousands', 'CD'],
  ])('R3-GEO-01 · %s -> %s', (text, expected) => {
    expect(query(text)).toBe(expected);
  });

  it('R3-GEO-01 · a place someone is BASED IN does not settle the ambiguous name', () => {
    /* A Gabon story. "Brazzaville" appears only as where the observers are
       based, so it must not make this Republic of the Congo. */
    expect(
      query('Gabon vote: Congo observers based in Brazzaville report calm in Libreville'),
    ).not.toBe('CG');
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
