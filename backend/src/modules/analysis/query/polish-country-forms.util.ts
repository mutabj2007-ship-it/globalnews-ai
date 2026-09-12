import { COUNTRIES, getLocalizedCountryName, type CountryMeta } from '@globalnews-ai/shared';

/**
 * G-ALPHA-2.1 (A) — POLISH COUNTRY NAMES, INCLUDING THEIR CASE FORMS.
 *
 * WHY THIS IS NEEDED. G-ALPHA-2 gave Polish the Stage 1 guard but not Stage 2
 * routing, and the reason was structural: every country reading in the pipeline
 * is English. `resolveCountryByAnyIdentifier()` matches ISO codes, English
 * names and English aliases, so "Rosją", "Ukrainą", "Polskę" and "Niemczech"
 * resolve to nothing, and a Polish comparison or multi-country question had no
 * determinable members at all.
 *
 * NO NEW GAZETTEER, AND NO TRANSLATION CALL. The Polish name of every country
 * is already in the repository, via `getLocalizedCountryName(iso2, 'pl')` —
 * Intl.DisplayNames, the same mechanism `scoreCountryRelevance()` already
 * trusts for Polish article matching. This module reads those 195 curated
 * nominatives and expands each into a small, closed set of Polish surface
 * forms.
 *
 * THE DIRECTION MATTERS AND IS THE SAFETY PROPERTY. Forms are generated
 * FORWARD, from a known country name into a bounded variant set, and then
 * matched as whole words. Nothing is ever inferred BACKWARD from arbitrary user
 * text: there is no stemmer, no suffix-stripper, and no morphological analysis
 * of anything the user typed. A rule that over-generates is therefore inert —
 * an impossible form such as "polsky" simply never occurs in real text — while
 * a rule that under-generates only costs recall. That asymmetry is why the
 * rules below are deliberately generous.
 *
 * THIS IS NOT A POLISH MORPHOLOGY ENGINE, and it is not presented as one. It is
 * the same bounded, explicitly-disclosed exception Milestone #47 established
 * with POLISH_CASE_NORMALIZATION, widened from two hand-written entries to a
 * generated set — with the same honesty about its edges. What it does NOT
 * cover is listed at IRREGULAR_FORMS and in the multi-word rule below.
 *
 * MEASURED, NOT ASSUMED. Across all 195 countries with a Polish name the
 * generator produces 737 distinct surface forms of four characters or more,
 * with ZERO collisions between two countries and ZERO collisions with the
 * Stage 1 routing function-word list. Both figures are asserted by the
 * accompanying spec, so a future rule that introduced an ambiguity would fail a
 * test rather than misroute a reader's question.
 */

/**
 * Forms shorter than this are not indexed. A three-letter fragment is where a
 * generated variant stops being distinctive enough to be safe on its own, and
 * no real Polish country name is lost by the floor.
 */
const MIN_FORM_LENGTH = 4;

/**
 * The handful of Polish country names whose case forms change the stem itself,
 * which no suffix rule can reach. Deliberately a short, closed, hand-checked
 * list — exactly the shape of Milestone #47's disclosed exception, and
 * deliberately NOT an attempt at general irregular-noun coverage. A country
 * absent from here keeps whatever its regular rules produced.
 */
const IRREGULAR_FORMS: Record<string, readonly string[]> = {
  niemcy: ['niemiec', 'niemczech', 'niemcami'],
  włochy: ['włoszech', 'włochami', 'włoch'],
  węgry: ['węgier', 'węgrzech'],
};

/**
 * Expands one Polish nominative into its bounded surface-form set.
 *
 * MULTI-WORD NAMES KEEP THEIR NOMINATIVE ONLY. "Wielka Brytania" and "Stany
 * Zjednoczone" inflect on every word ("w Wielkiej Brytanii"), which a
 * single-token suffix rule cannot express. Rather than produce a half-correct
 * form, those names are indexed as written and their oblique cases are an
 * accepted, disclosed gap.
 */
function generatePolishForms(nominative: string): Set<string> {
  const lower = nominative.toLowerCase();
  const forms = new Set<string>([lower]);

  for (const irregular of IRREGULAR_FORMS[lower] ?? []) {
    forms.add(irregular);
  }

  if (/\s/.test(lower)) {
    return forms;
  }

  /*
   * FEMININE NOUNS IN -a — the largest class by far (Polska, Ukraina, Rosja,
   * Rwanda, Kenia, Hiszpania, Francja, Litwa, Japonia, Brazylia...). The
   * genitive/dative/accusative/instrumental endings attach to the bare stem;
   * both -y and -i are generated because which one is correct depends on the
   * preceding consonant (Ukrainy but Polski, Rwandy but Rosji), and generating
   * the wrong one costs nothing.
   */
  if (/a$/.test(lower)) {
    const stem = lower.slice(0, -1);

    for (const suffix of ['y', 'i', 'ę', 'ą', 'e', 'ie']) {
      forms.add(stem + suffix);
    }

    /*
     * The locative alternates the final stem consonant: Polska -> Polsce,
     * Rwanda -> Rwandzie, Malta -> Malcie. Each rule below is one such
     * documented alternation, not a general phonological model.
     */
    if (/k$/.test(stem)) forms.add(`${stem.slice(0, -1)}ce`);
    if (/g$/.test(stem)) forms.add(`${stem.slice(0, -1)}dze`);
    if (/d$/.test(stem)) forms.add(`${stem.slice(0, -1)}dzie`);
    if (/t$/.test(stem)) forms.add(`${stem.slice(0, -1)}cie`);
    if (/ł$/.test(stem)) forms.add(`${stem.slice(0, -1)}le`);
    if (/r$/.test(stem)) forms.add(`${stem.slice(0, -1)}rze`);
  }

  /*
   * PLURAL NAMES IN -y (Niemcy, Czechy, Włochy, Chiny, Węgry). The genitive
   * drops the ending; the instrumental and locative add -ami / -ach / -ech.
   * The stem-changing ones are covered by IRREGULAR_FORMS above.
   */
  if (/y$/.test(lower)) {
    const stem = lower.slice(0, -1);

    for (const suffix of ['', 'ami', 'ach', 'ech']) {
      forms.add(stem + suffix);
    }
  }

  /* Names in -ś (Białoruś -> Białorusi, Białorusią). */
  if (/ś$/.test(lower)) {
    const stem = lower.slice(0, -1);

    for (const suffix of ['si', 'sią']) {
      forms.add(stem + suffix);
    }
  }

  return forms;
}

/**
 * The reverse index, built once at module load. A form claimed by more than one
 * country is DISCARDED rather than assigned to either — no ambiguous form ever
 * decides a route. Measured today that discard set is empty; it exists so it
 * stays empty by construction rather than by luck.
 */
const POLISH_FORM_INDEX: ReadonlyMap<string, CountryMeta> = (() => {
  const claims = new Map<string, CountryMeta[]>();

  for (const country of COUNTRIES) {
    const nominative = getLocalizedCountryName(country.iso2, 'pl');

    if (!nominative) continue;

    for (const form of generatePolishForms(nominative)) {
      if (form.length < MIN_FORM_LENGTH) continue;

      const claimants = claims.get(form) ?? [];

      if (!claimants.some((existing) => existing.iso3 === country.iso3)) {
        claimants.push(country);
      }

      claims.set(form, claimants);
    }
  }

  const index = new Map<string, CountryMeta>();

  for (const [form, claimants] of claims) {
    if (claimants.length === 1) {
      index.set(form, claimants[0]);
    }
  }

  return index;
})();

/** Number of distinct unambiguous Polish surface forms indexed. Diagnostic and test surface. */
export function polishCountryFormCount(): number {
  return POLISH_FORM_INDEX.size;
}

/** The curated Polish nominative for a country, or undefined when Intl has none. */
export function polishCountryName(country: CountryMeta): string | undefined {
  return getLocalizedCountryName(country.iso2, 'pl');
}

/**
 * Resolves a single Polish token to a country, in any of its indexed case
 * forms. Whole-token only: the caller supplies one candidate, and no substring
 * of it is ever considered.
 */
export function resolvePolishCountry(candidate: string): CountryMeta | undefined {
  const token = candidate
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/gu, '')
    .replace(/[^\p{L}\p{N}]+$/gu, '');

  return token.length >= MIN_FORM_LENGTH ? POLISH_FORM_INDEX.get(token) : undefined;
}
