import { COUNTRIES, getLocalizedCountryName, type DisplayLocale } from '@globalnews-ai/shared';

/**
 * R4 · CTO LOCALIZATION CONVERGENCE (category B — a localized DATA formatter).
 *
 * A country named in the reader's own DisplayLocale. `localisedCountryName` takes the
 * source-intelligence `LanguageCode`, which cannot express `de` or `pt`, so Ask callers crossed
 * through `askLocaleForLegacyCatalogue` and German and Portuguese readers got English country
 * names. This reads the SAME shared CLDR lookup (`getLocalizedCountryName` — the codebase's one
 * `Intl.DisplayNames`, Milestone #50) with the ISO-2 read from the registry row, never derived
 * from the ISO-3; for en / pl / fr / es / ar it returns exactly what `localisedCountryName` did.
 */
export function askCountryName(iso3: string, locale: DisplayLocale): string | undefined {
  const meta = COUNTRIES.find((country) => country.iso3 === iso3);
  return meta === undefined ? undefined : getLocalizedCountryName(meta.iso2, locale);
}
