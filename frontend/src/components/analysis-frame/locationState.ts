import type { GeographicResolution } from '../search/analysisDimensions';

/**
 * The RESOLVED place, and the only function permitted to decide it.
 *
 * `city` when the retrieval resolved a curated city, otherwise the
 * country name, otherwise null. The user's question is not an input.
 * This is the value that reaches the image, the map, the chip and every
 * accessible name in column 3 — so it is defined once, here, rather than
 * re-derived in four components where one of them could drift.
 */
export function resolvedPlaceOf(geography: GeographicResolution): string | null {
  if (geography.precision === 'city' && geography.city !== null && geography.city.length > 0) {
    return geography.city;
  }
  if (geography.precision === 'country' && geography.countryName !== null && geography.countryName.length > 0) {
    return geography.countryName;
  }
  return null;
}

/**
 * Display casing for a place that arrives lowercase from the resolver
 * (`retrievalContext.city` is a canonical lowercase key). Capitalisation
 * only — never transliteration, never diacritic stripping, never
 * truncation (§8 localization).
 */
export function formatPlaceForDisplay(place: string): string {
  return place
    .split(' ')
    .map((word) => (word.length === 0 ? word : word[0].toLocaleUpperCase() + word.slice(1)))
    .join(' ');
}
