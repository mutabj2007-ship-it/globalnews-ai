/* ════════════════════════════════════════════════════════════════════════════
 * D-07 — AMBIGUOUS BARE "CONGO" REGRESSION MATRIX
 * ════════════════════════════════════════════════════════════════════════════
 *
 * AUTHORITY. CTO supersession **R3-GEO-01** (2026-10-11), implementing the
 * scope independently recommended as EA-A3 in
 * `Claude_Output/RETRIEVAL-R1/EAST_AFRICA-G-REVIEW-R1/EA-G-05` §3.
 *
 * PROVENANCE OF THE ROWS. Every row below is East Africa's, taken verbatim from
 * their independent review instrument `tools/ea-g-d07-d21.spec.ts` (the D-07
 * `C-*` and `C2-*` rows; the `R-*` and `N-*` rows belong to D-21 and are out of
 * scope here). Headlines are SYNTHETIC. Using the reviewer's own rows is what
 * makes this a regression matrix rather than a restatement of the implementer's
 * assumptions.
 *
 * THE LAST COLUMN IS MEASURED, NOT DESIRED. It is what this candidate actually
 * persists, and it was compared row-by-row against East Africa's `eaa3` column
 * (`evidence/matrix/eaa3-matrix.log`): **78 of 78 rows identical, 0
 * differences.** Rows marked RECORDED UNRESOLVED are the ones where the
 * measured value and the regional truth label still disagree. They are
 * asserted ANYWAY, with their reason, so that a later change which moves one —
 * for better or worse — fails a test instead of passing unnoticed. A missing
 * country is a visible absence; a wrong country is the defect this change
 * exists to remove.
 *
 * NOT IN SCOPE, BY INSTRUCTION, AND DELIBERATELY NOT "FIXED" HERE: D-21
 * (Musanze), P0-4 (the Danish Refugee Council / Denmark router and its
 * persistence analogue), P0-5, EA-C3 ("Kinshasa-based" on the COD route),
 * `congoReadingOf` (East Africa withdrew it for the persistence path), and any
 * rewriting of stored records.
 */
import type { LanguageCode } from '@globalnews-ai/shared';

import { resolvePrimaryCountry } from './country-relevance.util';

/* [id, class, regional truth (ISO2 | NONE | AMBIG), title, summary, lang?, measured persisted] */
type Row = [string, string, string, string, string, LanguageCode | undefined, string | undefined];

const ROWS: Row[] = [
  ['C-BARE-1', 'bare', 'AMBIG', 'Congo raises fuel duty', '', undefined, undefined],
  ['C-BARE-2', 'bare', 'AMBIG', 'Congo election results announced', '', undefined, undefined],
  ['C-BARE-3', 'bare', 'AMBIG', 'Congo river traffic resumes after floods', '', undefined, undefined],
  ['C-EAST-1', 'bare-east', 'AMBIG', 'Fighting in eastern Congo displaces thousands', '', undefined, undefined],
  ['C-K-T1', 'kennedy', 'AMBIG', 'Contractors suffer battlefield loss in Congo', 'A former fighter was among the wounded, sources said.', undefined, undefined],
  ['C-K-T2', 'kennedy', 'CD', 'Contractors suffer battlefield loss in Congo', 'The contractors were ambushed in the Democratic Republic of Congo, sources said.', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C-K-T3', 'kennedy', 'CD', 'Contractors suffer battlefield loss in Congo', 'The ambush happened in eastern DRC last month, sources said.', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C-K-T4', 'kennedy', 'CD', 'Contractors suffer battlefield loss in Congo', 'The convoy was hit near Uvira in South Kivu, sources said.', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C-K-T5', 'kennedy', 'CD', 'Contractors ambushed in eastern DR Congo', 'The attack happened in South Kivu.', undefined, 'CD'],
  ['C-COG-B', 'cog+city', 'CG', 'Congo announces budget in Brazzaville', '', undefined, 'CG'],
  ['C-COG-PN', 'cog+city', 'CG', 'Congo announces budget, Pointe-Noire port expands', '', undefined, 'CG'],
  ['C-COG-SAS', 'cog+actor', 'CG', 'Congo: Sassou Nguesso names new cabinet', '', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C-COG-DEM', 'cog-demonym', 'CG', 'Congolese authorities in Brazzaville announce a budget', '', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C-COG-X1', 'cog-explicit', 'CG', 'Republic of the Congo raises fuel duty', '', undefined, 'CG'],
  ['C-COG-X2', 'cog-explicit', 'CG', 'Republic of Congo raises fuel duty', '', undefined, 'CG'],
  ['C-COG-X3', 'cog-explicit', 'CG', 'Congo-Brazzaville raises fuel duty', '', undefined, 'CG'],
  ['C-COG-X4', 'cog-explicit', 'CG', 'Congo Brazzaville raises fuel duty', '', undefined, 'CG'],
  ['C-COG-FR', 'cog-explicit-fr', 'CG', 'République du Congo : le budget adopté', '', 'fr', 'CG'],
  ['C-COD-X1', 'cod-explicit', 'CD', 'DR Congo raises fuel duty', '', undefined, 'CD'],
  ['C-COD-X2', 'cod-explicit', 'CD', 'Democratic Republic of Congo raises fuel duty', '', undefined, 'CD'],
  ['C-COD-X3', 'cod-explicit', 'CD', 'Democratic Republic of the Congo raises fuel duty', '', undefined, 'CD'],
  ['C-COD-X4', 'cod-explicit', 'CD', 'Congo-Kinshasa raises fuel duty', '', undefined, 'CD'],
  ['C-COD-FR1', 'cod-explicit-fr', 'CD', 'République démocratique du Congo : nouveaux combats', '', 'fr', 'CD'],
  ['C-COD-FR2', 'cod-fr-acronym', 'CD', 'RDC : combats à Uvira', '', 'fr', 'CD'],
  ['C-COD-FR3', 'bare-fr', 'AMBIG', "Embuscade dans l'est du Congo", '', 'fr', undefined],
  ['C-COD-CITY', 'bare+codcity', 'CD', 'Congo: clashes near Goma displace thousands', '', undefined, 'CD'],
  ['C-PL-1', 'bare-pl', 'AMBIG', 'Walki we wschodnim Kongo', '', 'pl', undefined],
  ['C-PL-2', 'cod-explicit-pl', 'CD', 'Walki w Demokratycznej Republice Konga', '', 'pl', 'CD'],  /* GEO-1 (G R131 Part B, 23 Oct): now resolves to its truth */
  ['C-ACT-M23', 'actor', 'AMBIG', 'M23 advances in Congo', '', undefined, undefined],
  ['C-ACT-FARDC', 'actor', 'NONE', 'FARDC soldiers repelled an assault', '', undefined, undefined],
  ['C-ACT-MONUSCO', 'actor', 'NONE', 'MONUSCO patrols were suspended', '', undefined, undefined],
  ['C-LAKE', 'lake', 'NONE', 'Lake Kivu methane project talks resume', '', undefined, undefined],
  ['C-LAKE-RW', 'lake', 'RW', "Rwanda's Lake Kivu methane plant expands", '', undefined, 'RW'],
  ['C-DEMONYM', 'demonym', 'AMBIG', 'Congolese refugees arrive in Uganda camps', '', undefined, 'UG'],  /* RECORDED UNRESOLVED */
  ['C-OFFICE', 'office', 'AO', 'Angola election: Kinshasa-based correspondents report long queues in Luanda', '', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C-OFFICE-C', 'office+bare', 'AO', 'Angola vote: Congo-based observers report queues in Luanda', '', undefined, 'AO'],
  ['C-DRC-ORG', 'org', 'NONE', 'Danish Refugee Council opens a new regional office', '', undefined, 'DK'],  /* RECORDED UNRESOLVED */
  ['C-DRC-ORG-UKR', 'org', 'UA', 'Danish Refugee Council (DRC) scales up aid in eastern Ukraine', '', undefined, 'UA'],
  ['C-QUOTED', 'quoted-neighbour', 'CD', 'Eastern DR Congo fighting near Goma; Rwanda denied backing the rebels', '', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C-MIXED', 'mixed', 'NONE', 'DRC delegation arrives in Brazzaville for talks with Congo', '', undefined, 'CG'],  /* RECORDED UNRESOLVED */
  ['C2-COG-X5', 'cog-explicit', 'CG', 'Republic of Congo president names new cabinet', '', undefined, 'CG'],
  ['C2-COG-SUM', 'cog-explicit-summary', 'CG', 'Congo raises fuel duty', 'The Republic of Congo government said the duty takes effect in January.', undefined, 'CG'],
  ['C2-COG-SUM-THE', 'cog-explicit-summary', 'CG', 'Congo raises fuel duty', 'The Republic of the Congo government said the duty takes effect in January.', undefined, 'CG'],
  ['C2-COD-SUM', 'kennedy-shape', 'CD', 'Congo raises fuel duty', 'The Democratic Republic of Congo government said the duty takes effect in January.', undefined, 'CD'],
  ['C2-COD-RDC', 'cod-explicit-fr', 'CD', 'RDC : le budget adopté à Kinshasa', '', 'fr', 'CD'],
  ['C2-COD-DRC', 'cod-explicit', 'CD', 'DR Congo: displaced families return to South Kivu', '', undefined, 'CD'],
  ['C2-SKIVU', 'cod-province', 'CD', 'South Kivu: displaced families return home', '', undefined, undefined],  /* RECORDED UNRESOLVED */
  ['C2-PL-BZV', 'cog-pl+city', 'CG', 'Kongo: parlament w Brazzaville przyjął budżet', '', 'pl', 'CG'],
  ['C2-PL-PN', 'cog-pl+city', 'CG', 'Kongo: port Pointe-Noire zwiększa przeładunki', '', 'pl', 'CG'],
  ['C2-PL-BARE', 'bare-pl', 'AMBIG', 'Kongo: parlament przyjął budżet', '', 'pl', undefined],
  ['C2-BOTH', 'both-explicit', 'AMBIG', 'Republic of Congo and DR Congo sign border pact', '', undefined, 'CD'],  /* RECORDED UNRESOLVED */
  ['C2-DRC-ACR', 'acronym', 'AMBIG', 'DRC announces new aid programme', '', undefined, undefined],
  ['C2-DRC-ORG-SK', 'org+place', 'CD', 'Danish Refugee Council (DRC) aid convoy reaches South Kivu', '', undefined, 'DK'],  /* RECORDED UNRESOLVED */
  ['C2-OFFICE-BZV', 'office+cog-city', 'GA', 'Gabon vote: Brazzaville-based observers report calm in Libreville', '', undefined, 'GA'],
  ['C2-OFFICE-BZV-C', 'office+cog-city+bare', 'GA', 'Gabon vote: Congo observers based in Brazzaville report calm in Libreville', '', undefined, 'GA'],
  ['C2-QUOTE-BZV', 'quoted-city', 'CF', 'Central African Republic talks: Brazzaville mediator quoted on Bangui ceasefire', '', undefined, 'CF'],
];

describe('D-07 · R3-GEO-01 — the persisted country for ambiguous and explicit Congo forms', () => {
  it.each(ROWS)(
    '%s (%s) truth=%s',
    (_id, _klass, _truth, title, summary, lang, expected) => {
      const article = { title, summary: summary || `${title}.` };

      expect(resolvePrimaryCountry(article, lang)?.countryCode).toBe(expected);
    },
  );

  it('the three rules are each load-bearing, and the matrix proves it row by row', () => {
    /* 1 — fail closed on an unsettled ambiguous name */
    expect(resolvePrimaryCountry({ title: 'Congo raises fuel duty', summary: '' })).toBeUndefined();

    /* 2 — a place of the country's own settles it */
    expect(
      resolvePrimaryCountry({ title: 'Congo announces budget in Brazzaville', summary: '' })
        ?.countryCode,
    ).toBe('CG');

    /* 3 — a place someone is BASED IN does not */
    expect(
      resolvePrimaryCountry({
        title: 'Gabon vote: Congo observers based in Brazzaville report calm in Libreville',
        summary: '',
      })?.countryCode,
    ).not.toBe('CG');

    /* and an actor, a demonym, a lake and an acronym never settle it */
    for (const title of [
      'Congo: Sassou Nguesso names new cabinet',
      'Congolese refugees arrive in Uganda camps',
      'Lake Kivu methane project talks resume',
      'DRC announces new aid programme',
    ]) {
      expect(resolvePrimaryCountry({ title, summary: '' })?.countryCode).not.toBe('CG');
    }
  });

  it('the Polish forms follow the same rule as the English ones', () => {
    /* bare "Kongo" is ambiguous (the shared table lists kongo/konga/kongu) … */
    expect(
      resolvePrimaryCountry({ title: 'Kongo: parlament przyjął budżet', summary: '' }, 'pl'),
    ).toBeUndefined();

    /* … and is settled by the same places, in Polish too */
    expect(
      resolvePrimaryCountry(
        { title: 'Kongo: parlament w Brazzaville przyjął budżet', summary: '' },
        'pl',
      )?.countryCode,
    ).toBe('CG');
  });
});
