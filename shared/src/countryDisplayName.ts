import type { LanguageCode } from './analysis';

/**
 * Milestone #50 Phase C (multilingual country-relevance containment) —
 * the SAME `Intl.DisplayNames`-based mechanism already established in
 * Milestone #49 for the World Map's visible country names
 * (`frontend/src/lib/countryDisplayName.ts`), now made available here
 * in `shared/` so the BACKEND relevance scorer can reuse the identical
 * underlying approach — NOT a second, independently-maintained
 * country-translation table. The frontend's own M49 helper is left
 * completely untouched (its own file, its own tests, unmodified);
 * this is a parallel implementation of the same standard-library
 * technique, sharing the same zero-new-data property: it requires
 * only the ISO2 code already on every `CountryMeta`, works generically
 * for any supported language, and needs no change to
 * `shared/src/countries.ts`'s `COUNTRIES` array or `CountryMeta` type
 * at all.
 *
 * `Intl.DisplayNames` instances are cached per language, never
 * constructed per-call.
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
 * Returns the country's display name localized to `language`, or
 * `undefined` if localization isn't available for any reason
 * (unsupported runtime, unusual/malformed code) — deliberately no
 * canonical-name fallback parameter here, unlike the frontend's
 * display-only helper, since this function's callers (relevance
 * scoring) need to distinguish "no localized name available" from "the
 * localized name happens to equal the canonical one" — the caller
 * decides what to do with an absent result, never a silently-wrong
 * fallback string.
 */
export function getLocalizedCountryName(iso2: string, language: LanguageCode): string | undefined {
  const instance = getDisplayNamesInstance(language);
  if (!instance) return undefined;

  try {
    const result = instance.of(iso2.toUpperCase());
    return result && result.length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}
