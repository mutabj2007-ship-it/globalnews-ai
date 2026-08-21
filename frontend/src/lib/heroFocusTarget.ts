import { COUNTRIES, type CountryMeta } from '@globalnews-ai/shared';
import {
  computeFeatureCenter,
  getCountryFeatureCollection,
  type CountryFeature,
} from '@/lib/map/countryGeometry';

/**
 * M66.14B — COUNTRY CODE -> A POINT ON THE HERO MAP.
 *
 * Every link in this chain already existed and is reused verbatim:
 *
 *   countryCode ('KE')
 *     -> COUNTRIES  (shared/src/countries.ts)          .isoNumeric
 *     -> getCountryFeatureCollection()                 world-atlas feature
 *     -> computeFeatureCenter(feature)                 [lon, lat]
 *
 * No d3-geo, no centroid override table, no invented coordinate. The feature
 * collection is cached module-side by countryGeometry.ts and the hero map
 * already loads it, so this adds no parse and no asset.
 *
 * KNOWN LIMITATION — BOUNDING-BOX CENTRE, NOT A TRUE CENTROID.
 * computeFeatureCenter() is documented as a rough bounding-box centre. For
 * countries that cross the antimeridian or hold distant territories — Russia,
 * Fiji, the United States with Alaska, France with French Guiana, Norway with
 * Svalbard — the point can fall well away from the landmass, and for Fiji in
 * the wrong hemisphere. This is the same function the map page already uses to
 * fly to a country, so the behaviour is consistent across the product rather
 * than novel here. The country IDENTITY is always correct; only its plotted
 * point can be poor, and the context card names the country in words so no
 * reader depends on the marker to know which country is meant.
 *
 * Returns null rather than a guess when the country is unknown to either
 * dataset. A null target means the map shows no focus — never a wrong one.
 */
export function countryFocusPoint(countryCode: string): [number, number] | null {
  const country = COUNTRIES.find((candidate: CountryMeta) => candidate.iso2 === countryCode);

  if (!country) {
    return null;
  }

  const feature = getCountryFeatureCollection().features.find(
    (candidate: CountryFeature) => candidate.properties.numericId === country.isoNumeric,
  );

  if (!feature) {
    return null;
  }

  return computeFeatureCenter(feature);
}
