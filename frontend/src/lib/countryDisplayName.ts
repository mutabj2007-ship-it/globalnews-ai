import type { LanguageCode } from '@globalnews-ai/shared';

/**
 * Milestone #49 Phase D (World Map country-name localization) — a
 * single, centralized helper, reused by every component that displays
 * a country name, rather than scattering hardcoded translations.
 *
 * Uses the standard `Intl.DisplayNames` API (region type) rather than
 * a new hand-maintained translation table: it requires zero new data
 * (works directly from the ISO2 code already present on every
 * `CountryMeta`), covers every supported language generically, and
 * needs no change to `shared/src/countries.ts` at all — `iso2`/`iso3`/
 * `isoNumeric` remain completely untouched, still the sole canonical
 * identity. This function only ever affects DISPLAY text.
 *
 * `Intl.DisplayNames` instances are cached per language (constructing
 * one has real, non-trivial cost) and never per-call.
 *
 * Defensive fallback: if `Intl.DisplayNames` is unavailable, throws,
 * or returns nothing for a given code (all theoretically possible —
 * an unsupported runtime, an unusual/malformed code), the caller-
 * supplied canonical English name is used instead. This function never
 * throws and never returns an empty string.
 */
const displayNamesCache = new Map<LanguageCode, Intl.DisplayNames | null>();

function getDisplayNamesInstance(language: LanguageCode): Intl.DisplayNames | null {
  if (displayNamesCache.has(language)) {
    return displayNamesCache.get(language) ?? null;
  }

  let instance: Intl.DisplayNames | null;
  try {
    instance = new Intl.DisplayNames([language], { type: 'region' });
  } catch {
    instance = null;
  }

  displayNamesCache.set(language, instance);
  return instance;
}

/**
 * Returns the country's display name localized to `language`, falling
 * back to `canonicalName` (the existing English `CountryMeta.name`) if
 * localization isn't available for any reason. `iso2` is the ONLY
 * input consulted for localization — `canonicalName` is purely the
 * fallback value, never itself translated or parsed.
 */
export function getCountryDisplayName(
  iso2: string,
  language: LanguageCode,
  canonicalName: string,
): string {
  const instance = getDisplayNamesInstance(language);
  if (!instance) return canonicalName;

  try {
    const result = instance.of(iso2.toUpperCase());
    return result && result.length > 0 ? result : canonicalName;
  } catch {
    return canonicalName;
  }
}
