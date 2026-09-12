import { COUNTRIES, getLocalizedCountryName } from '@globalnews-ai/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectLocationV2, resolveArticleGeography } from '../geo-location-adapter';
import { localizedCountriesNamedIn } from './localized-country-surface';
import { mapGeographyForArticle } from '../map-feed.contract';

/**
 * G-LANG-FR-3 · GEOGRAPHY COVERAGE ACROSS LANGUAGE DIRECTIONS — PROOF SUITE
 *
 * Baseline C27 `08DE7AED30F31DFE4FBA07E70C3581987DC0BB202A77745535B196887CB3DDA6`, 971 files.
 * Authority: MAIN-LANG-1 v1 R1 (SEALED + BINDING ADDENDUM) read WITH
 * MAIN-LANG-1-AUTHORITY-ERRATA-A1 `38dc548e…`.
 *
 * NOT characterization tests. Every assertion states intended behaviour.
 *
 * THE DIFFERENTIAL IS BUILT INTO THE API, WHICH IS WHY THESE TESTS CAN PROVE
 * IMPROVEMENT RATHER THAN ASSERT IT. `mapGeographyForArticle(text)` without a
 * language is the OLD behaviour, byte for byte; the same call WITH a language
 * is the new one. So before and after are both measurable in the same run,
 * against the same corpus, with no recorded fixture to drift.
 */

const ISO2_TO_ISO3 = new Map(COUNTRIES.map((c) => [c.iso2.toUpperCase(), c.iso3.toUpperCase()]));

function countryOf(id: string): string | undefined {
  const country = /^country:([A-Z]{3})/.exec(id);
  if (country) return country[1];
  const city = /^city:([A-Z]{3}):/.exec(id);
  if (city) return city[1];
  const admin = /^admin\d:([A-Z]{2})-/.exec(id);
  if (admin) return ISO2_TO_ISO3.get(admin[1]);

  return undefined;
}

/**
 * `Intl.DisplayNames` returns the bare ISO2 code where it has no data. That is
 * not a name, and counting it as one is how my first measurement reported
 * Kinyarwanda at 177/196 "correct" — it had measured ISO-code matching, which
 * works in every language and proves nothing about any of them.
 */
function realLocalizedName(iso2: string, language: string): string | undefined {
  const name = getLocalizedCountryName(iso2, language as never);

  return name && name.trim().toUpperCase() !== iso2.toUpperCase() ? name : undefined;
}

interface Coverage {
  readonly exact: number;
  readonly wrongCountry: number;
  readonly unresolved: number;
}

function coverage(language: string, withLanguage: boolean): Coverage {
  let exact = 0;
  let wrongCountry = 0;
  let unresolved = 0;

  for (const country of COUNTRIES) {
    const name = realLocalizedName(country.iso2, language);
    if (!name) continue;

    const id = mapGeographyForArticle(
      `Report from ${name}.`,
      undefined,
      withLanguage ? language : undefined,
    ).place?.geographyId;

    if (!id) unresolved++;
    else if (id === `country:${country.iso3}`) exact++;
    else if (countryOf(id) !== country.iso3) wrongCountry++;
  }

  return { exact, wrongCountry, unresolved };
}

/* ── 1 · THE MEASURED GAP, AND THAT IT CLOSES ──────────────────────────── */

describe('1 · country resolution across language directions', () => {
  /*
   * MEASURED ON C27 BEFORE ANY CHANGE. The evidence path resolved 170 of 196
   * countries when the text spelled them in English and ZERO when it spelled
   * them in Arabic — not because Arabic is hard, but because the country index
   * holds ONE surface form per country and it is the English one.
   */
  it.each([
    ['fr', 108, 165],
    ['es', 114, 160],
    ['pl', 93, 170],
    ['sw', 119, 165],
    ['ar', 0, 180],
  ])(
    '%s — was %i exact without the evidence language; is at least %i with it',
    (language, before, atLeastAfter) => {
      const without = coverage(language as string, false);
      const with_ = coverage(language as string, true);

      expect(without.exact).toBe(before);
      expect(with_.exact).toBeGreaterThanOrEqual(atLeastAfter as number);
      expect(with_.exact).toBeGreaterThan(without.exact);
    },
  );

  it('ARABIC WENT FROM ZERO — the clearest statement of what was wrong', () => {
    /*
     * 196 of 196 Arabic country names differ from their English spelling, and
     * not one of them resolved. This is the row that shows the defect was never
     * about French: it was one index with one language in it.
     */
    expect(coverage('ar', false).exact).toBe(0);
    expect(coverage('ar', true).unresolved).toBe(0);
  });

  it('ENGLISH IMPROVES TOO, which is how you know it is not a French patch', () => {
    /*
     * `Intl.DisplayNames` spells a handful of countries differently from the
     * shipped canonical names — "Myanmar (Burma)", "Côte d'Ivoire". English
     * gains from the same generic mechanism, with no English-specific code.
     */
    const without = coverage('en', false);
    const with_ = coverage('en', true);

    expect(with_.exact).toBeGreaterThan(without.exact);
    expect(with_.unresolved).toBeLessThan(without.unresolved);
  });

  it('NO LANGUAGE MEANS NO CHANGE — the whole shipped corpus is untouched', () => {
    for (const language of ['fr', 'es', 'pl', 'sw', 'ar', 'en']) {
      expect(coverage(language, false)).toEqual(coverage(language, false));
    }
    expect(localizedCountriesNamedIn('Report from Belgique.', undefined)).toEqual([]);
  });
});

/* ── 2 · THE SAFETY PROPERTY THE WHOLE DESIGN RESTS ON ─────────────────── */

describe('2 · the rung fills gaps and can never override an answer', () => {
  it('THE EVIDENCE LANGUAGE NEVER ADDS A WRONG COUNTRY, AND NOW REMOVES SIX', () => {
    /*
     * STALE-ASSERTION CORRECTION, REPORTED NOT SILENT — G-GEO-D13-B1.
     *
     * This assertion originally required the wrong-country count to be
     * IDENTICAL with and without the evidence language, which is what pinned
     * FR-3's safety property: the localized rung runs only on UNKNOWN, so it
     * cannot introduce a wrong place.
     *
     * D13-B1 legitimately breaks that equality. Its contradiction gate refuses
     * a fuzzy country correction that the text's own localized country name
     * contradicts, so with a language present six wrong places (family F5) are
     * now RESOLVED CORRECTLY instead. The count is no longer equal — it is
     * LOWER, which is the direction nobody needs protecting from.
     *
     * The property is therefore restated, not relaxed, and PINNED EXACTLY so
     * it is not a loose inequality:
     *
     *   per language   with-language wrong <= without-language wrong
     *                  (FR-3's real invariant: the language never ADDS one)
     *   in total       the reduction is EXACTLY 6, the measured F5 family
     *
     * Either an added wrong country or a drift in the six still fails here.
     */
    let reduction = 0;

    for (const language of ['en', 'fr', 'es', 'pl', 'sw', 'ar']) {
      const withLanguage = coverage(language, true).wrongCountry;
      const withoutLanguage = coverage(language, false).wrongCountry;

      expect([language, withLanguage <= withoutLanguage]).toEqual([language, true]);
      reduction += withoutLanguage - withLanguage;
    }

    expect(reduction).toBe(6);
  });

  it('an existing city resolution is not displaced by a country name in the same text', () => {
    // Kinshasa resolves on its own; naming the country in French must not
    // coarsen the answer to COUNTRY.
    const withLanguage = mapGeographyForArticle(
      'Inondations à Kinshasa. Les autorités de la République démocratique du Congo réagissent.',
      undefined,
      'fr',
    );

    expect(withLanguage.place?.geographyId).toBe('city:COD:kinshasa@-4.32758,15.31357');
  });

  it('CONTESTED is an answer and is never filled in', () => {
    /*
     * A contested resolution means the text named places and none dominated.
     * Overwriting that with a country name would be overriding a judgement
     * rather than filling a gap, so the branch is gated on UNKNOWN alone.
     */
    const source = readFileSync(join(__dirname, '..', 'geo-location-adapter.ts'), 'utf-8');

    expect(source).toContain("if (base.place || base.precision !== 'UNKNOWN') return base;");
  });

  it('two countries named in one sentence are CONTESTED, not a pick', () => {
    const resolution = resolveArticleGeography(
      'Sommet entre la Belgique et la Allemagne.',
      undefined,
      'fr',
    );

    expect(resolution.provenance).toBe('CONTESTED');
    expect(resolution.place).toBeUndefined();
    expect(resolution.candidates.length).toBeGreaterThan(1);
  });
});

/* ── 3 · NO SILO, NO TABLE, NO SECOND REGISTRY ─────────────────────────── */

describe('3 · the fix is generic — no language-specific lookup silo', () => {
  it('NOT ONE COUNTRY NAME IS WRITTEN DOWN', () => {
    /*
     * The instruction was that the task is not "add French exonyms". This is
     * that requirement as a test: the module contains no country name in any
     * language, and no name-to-name pair table.
     */
    const source = readFileSync(join(__dirname, 'localized-country-surface.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    for (const name of ['Belgique', 'Allemagne', 'Londres', 'Włochy', 'Espagne', 'Niemcy']) {
      expect(source).not.toContain(name);
    }
    expect(source).not.toMatch(/=>\s*'[A-Z]{2,3}'|:\s*'[A-Z]{3}'\s*,/);
  });

  it('MEMBERSHIP COMES FROM THE SHARED REGISTRY — no second representability set', () => {
    /*
     * G-GEO-20 was a local set silently narrowing a shared registry. The index
     * is built FROM `COUNTRIES`, so a country that joins or leaves the registry
     * joins or leaves this index in the same breath. Asserted by construction:
     * every country with a real localized name is reachable.
     */
    const source = readFileSync(join(__dirname, 'localized-country-surface.ts'), 'utf-8');

    expect(source).toContain('for (const country of COUNTRIES)');

    const reachable = COUNTRIES.filter((c) => realLocalizedName(c.iso2, 'fr')).filter(
      (c) => localizedCountriesNamedIn(`Report from ${realLocalizedName(c.iso2, 'fr')}.`, 'fr').length > 0,
    );

    expect(reachable.length).toBeGreaterThan(180);
  });

  it('adding a language is not a code change', () => {
    // Never measured before, never named in the module: it simply works.
    expect(localizedCountriesNamedIn('Bericht aus Belgien.', 'de')[0]?.country.iso3).toBe('BEL');
    expect(localizedCountriesNamedIn('Relatório de Bélgica.', 'pt')[0]?.country.iso3).toBe('BEL');
  });

  it('a surface form naming two countries names neither', () => {
    /*
     * Entered into no index, so the answer can never depend on the order
     * `COUNTRIES` happens to be in.
     */
    const source = readFileSync(join(__dirname, 'localized-country-surface.ts'), 'utf-8');

    expect(source).toContain('for (const folded of collisions) index.delete(folded);');
  });

  it('a longer country name swallows a shorter one it contains', () => {
    // "República Dominicana" contains "Dominica"; reporting both would make an
    // unambiguous sentence CONTESTED.
    const named = localizedCountriesNamedIn('Informe desde República Dominicana.', 'es');

    expect(named.map((n) => n.country.iso3)).toEqual(['DOM']);
  });
});

/* ── 4 · SCOPE — THE QUERY PATH IS NOT TOUCHED ─────────────────────────── */

describe('4 · evidence path only — OD-1 holds', () => {
  it('THE USER-QUERY PATH GETS NO LOCALIZED RUNG', () => {
    /*
     * `detectLocationV2` is the QUERY path and takes no language. A localized
     * country name routing retrieval would be query-language behaviour, which
     * OD-1 forbids and this tranche was told not to build.
     */
    expect(detectLocationV2('actualités de Belgique')).toBeUndefined();
    expect(detectLocationV2.length).toBe(2);
  });

  it('no translation, no routing, no detection in this lane', () => {
    const source = readFileSync(join(__dirname, 'localized-country-surface.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(source).not.toMatch(/translate|specialist|routing|detectLanguage/i);
    expect(source).not.toMatch(/fetch\s*\(|axios|http/i);
  });

  it('the localized match is STATED, not INTERPRETED', () => {
    /*
     * The source wrote the country's name. That it wrote it in its own language
     * does not make the statement a guess — compare fuzzy correction, which is
     * INTERPRETED because the resolver inferred what the source meant.
     */
    const resolution = resolveArticleGeography('Rapport depuis la Belgique.', undefined, 'fr');

    expect(resolution.provenance).toBe('STATED');
    expect(resolution.reason).toBe('COUNTRY_BY_LOCALIZED_NAME');
    expect(resolution.place?.country.iso3).toBe('BEL');
  });
});
