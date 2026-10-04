import { COUNTRIES, type DisplayLocale } from '@globalnews-ai/shared';

/**
 * R4 · CTO LOCALIZATION CONVERGENCE §5 (category B — a localized DATA formatter).
 *
 * A country named in the reader's own DisplayLocale. `localisedCountryName` takes the
 * source-intelligence `LanguageCode`, which cannot express `de` or `pt`, so Ask callers crossed
 * through `askLocaleForLegacyCatalogue` and German and Portuguese readers got English country
 * names. This is the same CLDR lookup (`Intl.DisplayNames`, type `region`, the ISO-2 read from
 * the registry row — never derived from the ISO-3), keyed by the locale the reader chose; for
 * en / pl / fr / es / ar it returns exactly what `localisedCountryName` returned.
 */
const cache = new Map<DisplayLocale, Intl.DisplayNames | null>();

export function askCountryName(iso3: string, locale: DisplayLocale): string | undefined {
  const meta = COUNTRIES.find((country) => country.iso3 === iso3);
  if (meta === undefined) return undefined;
  if (!cache.has(locale)) {
    let instance: Intl.DisplayNames | null;
    try {
      instance = new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      instance = null;
    }
    cache.set(locale, instance);
  }
  const names = cache.get(locale) ?? null;
  if (names === null) return undefined;
  try {
    const name = names.of(meta.iso2.toUpperCase());
    return name && name.length > 0 ? name : undefined;
  } catch {
    return undefined;
  }
}
