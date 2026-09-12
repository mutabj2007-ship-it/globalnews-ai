import { COUNTRIES, getLocalizedCountryName } from '@globalnews-ai/shared';
import type { CountryMeta, LanguageCode } from '@globalnews-ai/shared';
import { foldPlaceName, tokenCasing } from '../geo-normalize.util';

/**
 * G-LANG-FR-3 · THE COUNTRY RUNG THE EVIDENCE PATH NEVER HAD
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MEASURED FIRST, ON C27, ACROSS SIX LANGUAGE DIRECTIONS.
 *
 * `mapGeographyForArticle("Report from <country>.")`, one neutral sentence per
 * country, names supplied by `Intl.DisplayNames` so no private table decides
 * what a country is called:
 *
 *      lang   exact country   right country,   WRONG country   unresolved
 *                             coarser/finer
 *      en          170              11               3             12
 *      fr          108              11              10             67
 *      es          114               5              15             62
 *      pl           93               5              12             86
 *      sw          119               9               6             62
 *      ar            0               4               3            189
 *
 * 135 French country names differ from their English spelling; 196 Arabic ones
 * do. The evidence path resolves 170 of 196 countries in English and **zero**
 * in Arabic — not because Arabic is hard, but because the country index holds
 * ONE surface form per country and it is the English one.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS IS NOT "ADD FRENCH EXONYMS".
 *
 * The instruction was explicit that the task is not to add French exonyms, and
 * the readiness audit had already measured why that would fail: the exonym
 * table is 53 hand-added CITY→CITY pairs across 19 countries, with **no
 * country-level edge of any language**. Adding French rows to it would fix
 * French, leave the other 195 language directions exactly as broken, and grow a
 * second hand-maintained name table beside the first.
 *
 * So no name is written down here. `Intl.DisplayNames` — reached through the
 * shipped `getLocalizedCountryName()`, the SAME helper the relevance scorer
 * already uses — supplies every country's name in every language the runtime
 * carries. Zero new data. Adding a language later is not a code change at all.
 *
 * WHY IT IS NOT A NEW LOOKUP SILO.
 *
 * A silo would be a second index with its own membership, its own staleness and
 * its own idea of which countries exist — the `eacTranche()` mistake
 * (G-GEO-20), where a local set silently narrowed a shared registry. This
 * builds its surface forms from `COUNTRIES` itself, the same registry the
 * resolver already uses, and folds them with `foldPlaceName()`, the same
 * MATCHING fold. A country that leaves `COUNTRIES` leaves this index in the
 * same breath; a country that joins it is covered without anyone remembering.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 *   NO TRANSLATION.       No text is translated. A localized country NAME is
 *                         looked up; the article's prose is never rewritten.
 *   NO QUERY ROUTING.     This is the evidence path only. OD-1 holds.
 *   NO OVERRIDE.          It is consulted ONLY where the resolver already
 *                         answered UNKNOWN — see `resolveArticleGeography`. It
 *                         cannot change an answer the resolver reached on its
 *                         own, which is why no currently-correct resolution can
 *                         regress.
 *   NO GUESSING.          Two countries whose localized names both appear is
 *                         CONTESTED, not a pick.
 */

/** One country, named as some language spells it. */
export interface LocalizedCountrySurface {
  readonly country: CountryMeta;
  /** The localized name as written, for the audit trail. */
  readonly surface: string;
}

/*
 * The lookup is per-language and built once. `Intl.DisplayNames` instances are
 * already cached inside `getLocalizedCountryName()`; this caches the FOLDED
 * index so a per-article call is a map read.
 */
const indexByLanguage = new Map<string, Map<string, LocalizedCountrySurface>>();

/**
 * INSTRUMENT GUARD, AND IT MATTERS.
 *
 * `Intl.DisplayNames` returns the bare ISO2 code when it holds no data for a
 * language — `'CL'` for Chile in Kinyarwanda. That is not a name. Counting it
 * as one made my first measurement report Kinyarwanda at 177/196 "correct",
 * when what it had actually measured was the resolver matching ISO codes it
 * already matched in every language. Anything that comes back equal to the
 * country's own ISO2 is discarded here for the same reason.
 */
function isRealName(name: string, country: CountryMeta): boolean {
  return name.trim().length > 0 && name.trim().toUpperCase() !== country.iso2.toUpperCase();
}

function buildIndex(language: string): Map<string, LocalizedCountrySurface> {
  const index = new Map<string, LocalizedCountrySurface>();
  const collisions = new Set<string>();

  for (const country of COUNTRIES) {
    const name = getLocalizedCountryName(country.iso2, language as LanguageCode);
    if (!name || !isRealName(name, country)) continue;

    const folded = foldPlaceName(name);
    if (folded.length === 0) continue;

    if (index.has(folded)) {
      /*
       * TWO COUNTRIES SPELLED THE SAME IN ONE LANGUAGE. Neither is entered.
       * A surface form that names two countries names neither of them, and
       * silently keeping whichever came first in COUNTRIES order would make
       * the answer depend on array position.
       */
      collisions.add(folded);
      continue;
    }
    index.set(folded, { country, surface: name });
  }

  for (const folded of collisions) index.delete(folded);

  return index;
}

function indexFor(language: string): Map<string, LocalizedCountrySurface> {
  const key = language.trim().toLowerCase();
  const cached = indexByLanguage.get(key);
  if (cached) return cached;

  const built = buildIndex(key);
  indexByLanguage.set(key, built);

  return built;
}

/**
 * G-GEO-D14-B1-RUNG · ENTITY-RUN SUPPRESSION — RULE 2' AS MEASURED IN D14-A2
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, MEASURED. On a 38-case real-prose corpus across six languages
 * this rung produced TWELVE false geographic claims against eight legitimate
 * ones — it was wrong more often than right:
 *
 *   "Georgia Meloni addressed the summit."          -> country:GEO
 *   "El diputado Ivan Chile presento la mocion."    -> country:CHL
 *   "La societe Belgique Telecom a publie..."       -> country:BEL
 *   "Chad United beat the visitors three nil."      -> country:TCD
 *   "Nowy model Malta Pro trafil do sprzedazy."     -> country:MLT
 *
 * In every one the country surface is not a place claim at all: it is one
 * token of a PERSON, ORGANISATION, TEAM or BRAND name.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE RULE. A country surface with a CAPITALISED NEIGHBOUR that is NOT
 * SENTENCE-INITIAL is part of a longer entity name, and this rung does not
 * claim it.
 *
 * THREE SIGNALS, NEVER CASING ALONE — the brief forbids casing alone and it is
 * right to:
 *
 *   CASING      the neighbour is capitalised
 *   POSITION    it is not sentence-initial. `geo-resolver.ts` already states
 *               why this matters: "a sentence boundary is not a statement
 *               about anything." Without it, "La Belgique accueille le
 *               sommet" is suppressed by its own opening article — measured,
 *               and it is what separated Rule 2 from Rule 2'.
 *   ADJACENCY   it is immediately before or after the matched surface, so a
 *               capitalised word elsewhere in the sentence is irrelevant.
 *
 * AND NO PREPOSITION REQUIREMENT, DELIBERATELY. A preposition rule looked
 * attractive and D14-A2 measured why it fails: the Polish locative "Wloszech"
 * is not in this index at all (G-GEO-D14-N5), so the country is invisible in
 * exactly the prepositional sentences such a rule would depend on.
 *
 * ONE EXCLUSION WAS REMOVED AFTER MEASURING IT. My first version skipped a
 * capitalised neighbour that is a settlement anywhere in the gazetteer, to
 * avoid suppressing real place evidence. It silently exempted
 * "Jordan HENDERSON" — Henderson is a city in Nevada. An exclusion meant to
 * protect place evidence was protecting surnames. Removing it fixed one more
 * negative and broke nothing, which is the difference between Rule 2 and
 * Rule 2'.
 *
 * WHAT THIS CANNOT DO, STATED HERE RATHER THAN DISCOVERED LATER.
 * "The Jordan sneaker line sold out" keeps its false claim: the neighbour is
 * lowercase, so no entity-run signal exists. Authorised to remain open.
 *
 * SCOPE. RUNG-ONLY. `COUNTRY_ONLY`, `COUNTRY_BY_FUZZY` and every gazetteer
 * path are untouched — they never call this function.
 */
function sentenceStartTokenIndices(text: string): ReadonlySet<number> {
  const starts = new Set<number>([0]);
  const tokens = text.replace(/[^\p{L}\p{N}.!?]+/gu, ' ').trim().split(/\s+/);
  let index = 0;

  for (const token of tokens) {
    if (token.replace(/[.!?]+$/u, '').length > 0) index += 1;
    if (/[.!?]$/u.test(token)) starts.add(index);
  }

  return starts;
}

function sitsInsideAnEntityRun(text: string, surface: string): boolean {
  const folded = foldPlaceName(text).split(' ');
  const casing = tokenCasing(text);
  const starts = sentenceStartTokenIndices(text);
  const words = foldPlaceName(surface).split(' ');

  for (let start = 0; start + words.length <= folded.length; start += 1) {
    if (folded.slice(start, start + words.length).join(' ') !== words.join(' ')) continue;

    for (const neighbour of [start - 1, start + words.length]) {
      if (neighbour < 0 || neighbour >= folded.length) continue;
      if (casing[neighbour] !== true) continue;
      if (starts.has(neighbour)) continue;

      return true;
    }
  }

  return false;
}

/**
 * Every country whose name IN THIS LANGUAGE appears in the folded text.
 *
 * WHOLE-TOKEN-RUN MATCHING, NOT SUBSTRING. Measured reason: a substring scan
 * turns "Antigua & Barbuda" into a hit for the city Antigua in Spain — which
 * is exactly the class of wrong answer this path already produces in ENGLISH
 * (registered G-LANG-FR-D13, not fixed here). A rung added to reduce wrong
 * places must not add more of them, so matching is anchored on token
 * boundaries and the longest surface wins.
 */
export function localizedCountriesNamedIn(
  text: string,
  language: string | undefined,
): readonly LocalizedCountrySurface[] {
  if (!language) return [];

  const index = indexFor(language);
  if (index.size === 0) return [];

  const folded = foldPlaceName(text);
  if (folded.length === 0) return [];

  const padded = ` ${folded} `;
  const found = new Map<string, LocalizedCountrySurface>();

  for (const [key, entry] of index) {
    if (padded.includes(` ${key} `)) found.set(entry.country.iso3, entry);
  }

  /*
   * A LONGER NAME SWALLOWS A SHORTER ONE IT CONTAINS. "República Dominicana"
   * contains "Dominica"; reporting both would make an unambiguous sentence
   * CONTESTED. The containing name is the one the text actually used.
   */
  /*
   * G-GEO-D14-B1-RUNG — drop any surface that sits inside a longer entity name.
   * Applied before the containment filter so a suppressed surface cannot shadow
   * a legitimate longer one either.
   */
  const surfaces = [...found.values()].filter((entry) => !sitsInsideAnEntityRun(text, entry.surface));

  return surfaces.filter(
    (candidate) =>
      !surfaces.some(
        (other) =>
          other !== candidate &&
          ` ${foldPlaceName(other.surface)} `.includes(` ${foldPlaceName(candidate.surface)} `),
      ),
  );
}
