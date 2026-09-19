import { COUNTRIES, getLocalizedCountryName, type LanguageCode } from '@globalnews-ai/shared';
import { sourceLanguageFor } from '@/lib/i18n/sourceLanguage';

/**
 * ══ ONE ISO-3 → READER-FACING COUNTRY NAME BRIDGE ═════════════════════════
 *
 * MAP-DISPLAY-NAME-CENTRALISATION
 *
 * THE DEFECT: the map's rail, callout, city card and region card all resolved
 * a country name like this —
 *
 *     COUNTRIES.find((c) => c.iso3 === id)?.name ?? id
 *
 * — and `COUNTRIES` is an ENGLISH-ONLY registry. Its `name` is `'Kenya'` in
 * every locale. So a Polish reader met "Kenya" in the rail title, "Kenya" in
 * the callout and "Kenya" beside a city, while the MAP CANVAS BEHIND THEM
 * correctly said "Kenia" — the labels already went through the localised path
 * and the chrome did not. The rail's own comment asserted the opposite ("the
 * registry already holds the name, in the reader's language"), which is not
 * true of this registry; it has been corrected where it sits.
 *
 * ── WHAT THIS MODULE IS NOT ───────────────────────────────────────────────
 *
 * It is NOT a new resolver. Milestone #50 Phase D consolidated every locale
 * lookup into `shared/src/countryDisplayName.ts` and states the invariant
 * plainly: "there is no longer a second, independent `Intl.DisplayNames`
 * construction anywhere in the codebase." A first draft of this file built
 * one. It was wrong, and this module calls the canonical resolver instead.
 *
 * ── WHAT IT ACTUALLY CENTRALISES ──────────────────────────────────────────
 *
 * The BRIDGE, which was the part genuinely duplicated. The resolver is keyed
 * by ISO-2; every map surface carries ISO-3; and the locale must first be
 * narrowed by `sourceLanguageFor`, because Swahili and Kinyarwanda have no
 * localised country names and must fall through rather than resolve wrongly.
 * That three-step sequence was written out twice — in `MapPageClient` and in
 * `labelSources` — and a third copy was about to be written for the rail. It
 * is now in one place, and the two existing copies call it.
 *
 * ── AND IT APPLIES NO FALLBACK OF ITS OWN ─────────────────────────────────
 *
 * `undefined` means NO LOCALISED NAME IS AVAILABLE, and each caller supplies
 * the fallback its own surface needs — the backend's `countryName` for the
 * evidence card, the registry name for a map label, the raw id as the last
 * resort in the rail. Those are genuinely different answers, and folding them
 * into one default here would have quietly changed three surfaces while
 * claiming to consolidate them. It is the same reason the shared resolver is
 * deliberately fallback-free.
 */
export function localisedCountryName(
  iso3: string,
  language: LanguageCode,
): string | undefined {
  const meta = COUNTRIES.find((country) => country.iso3 === iso3);

  if (meta === undefined) return undefined;

  /*
    THE ISO-2 IS READ FROM THE REGISTRY ROW, never derived from the ISO-3.
    `RWA` to `RW` happens to work and `DEU` to `DE` does not, and a rule that
    is right by coincidence is the kind that fails on the one country nobody
    tests.
  */
  const source = sourceLanguageFor(language);

  if (source === undefined) return undefined;

  return getLocalizedCountryName(meta.iso2, source);
}

/**
 * THE CONTINENT ON THE IDENTITY LINE — the `AFRICA` in `KEN · AFRICA`.
 *
 * Part I §E block 01 is explicit that this is "NOT a REGION-precision record".
 * It is the country registry's own grouping, and the registry publishes
 * exactly five: Americas, Europe, Asia, Africa, Oceania. Five strings per
 * locale is a dictionary entry, so this one is localised from copy.
 *
 * ── NOT `map.spatial.continents`, WHICH ALREADY EXISTS AND IS A DIFFERENT SET
 *
 * That block is MAP LABEL copy for the canvas and is keyed
 * `africa / europe / asia / northAmerica / southAmerica / oceania` — six
 * landmasses, split across the Americas the way a map draws them. The registry
 * groups countries into five and keeps the Americas together. Same word, two
 * key spaces, and reusing the label block here would have silently failed to
 * find `Americas` and rendered the English through the gap.
 *
 * An unrecognised grouping returns the raw value, so a sixth added to the
 * registry shows the English word until the copy is written — visibly
 * incomplete rather than silently blank.
 */
export function continentDisplayName(
  region: string,
  labels: Readonly<Record<string, string>>,
): string {
  return labels[region] ?? region;
}
