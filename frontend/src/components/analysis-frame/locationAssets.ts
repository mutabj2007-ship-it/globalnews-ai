import type { GeographicPrecision } from '../search/analysisDimensions';

/**
 * PAF-R1 — the curated, self-hosted location asset registry.
 *
 * THIS IS THE PRECISION-INTEGRITY BOUNDARY. Handoff §7 makes
 * `LocationImage` the single component where a mistake becomes a visible
 * false claim, and this module is where that component gets its answer.
 *
 * FOUR STRUCTURAL REFUSALS, not four checks:
 *
 * 1. The lookup key is `(resolvedPlace, resolvedPrecision)` — both taken
 *    from the RESOLVED geography. No parameter here can carry the user's
 *    question, so "the user typed Musanze" is not an input this module
 *    can be given, let alone act on. The spec asserts that against this
 *    file's source text, which is why the parameter is named `lookup`.
 * 2. `unresolved` returns `none` before any lookup happens. No fallback
 *    illustration, no map screenshot, no flag.
 * 3. A `city` key is never consulted for a `country`-resolved analysis
 *    and vice versa — the precision is part of the key, not a filter
 *    applied afterwards.
 * 4. Nothing in this file imports, references or can reach the article
 *    record or its image field. Article imagery is never a location
 *    image, in any state, for any reason (§7.4). The spec asserts this
 *    against this file's own source text, which is why the identifiers
 *    themselves are deliberately not written here.
 *
 * SCOPE, PER CTO RULING: the R1 set is deliberately bounded. This is not
 * a world-city catalogue and must not become one. An entry may only be
 * added for a place whose asset is a licensed file committed to
 * `frontend/public/location-assets/`; `locationAssets.spec.ts` fails the
 * build if any registered path is missing from disk, so an invented URL
 * cannot survive review.
 *
 * THE REGISTRY SHIPS EMPTY IN R1, AND THAT IS THE CORRECT STATE. No
 * licensed location photography exists in this repository today. Every
 * place therefore resolves to `NO VERIFIED LOCATION IMAGE` — a truthful
 * specified state (§7.9, 09 §3), not a defect and not scaffolding. The
 * mechanism is fully implemented and proven by tests against an
 * injected registry, so adding a licensed asset later is a data change,
 * never a code change.
 */

export interface LocationAssetEntry {
  /** Path under `frontend/public`, e.g. `/location-assets/kigali.jpg`. */
  readonly src: string;
  /** The place exactly as it will be named in the chip and the alt text. */
  readonly displayName: string;
}

/** place key -> asset, per precision level. Keys are lowercase. */
export interface LocationAssetRegistry {
  readonly city: Readonly<Record<string, LocationAssetEntry>>;
  readonly country: Readonly<Record<string, LocationAssetEntry>>;
}

/**
 * R1 production registry. Intentionally empty — see the doc comment.
 * Adding an entry REQUIRES committing the referenced file; the spec
 * enforces it.
 */
export const LOCATION_ASSETS: LocationAssetRegistry = {
  city: {},
  country: {},
};

export type LocationImageDecision =
  | { readonly kind: 'asset'; readonly src: string; readonly place: string }
  | { readonly kind: 'no-verified-asset'; readonly place: string }
  | { readonly kind: 'suppressed-unresolved' };

export interface LocationImageLookup {
  /** RESOLVED precision. Required — there is no default. */
  readonly precision: GeographicPrecision;
  /** RESOLVED place: the city when precision is 'city', else the country. */
  readonly resolvedPlace: string | null;
}

export function normalizeAssetKey(place: string): string {
  return place.trim().toLowerCase();
}

/**
 * The single decision. Returns what may be rendered, never what was
 * asked for.
 */
export function resolveLocationImage(
  lookup: LocationImageLookup,
  registry: LocationAssetRegistry = LOCATION_ASSETS,
): LocationImageDecision {
  const { precision, resolvedPlace } = lookup;

  // §7 table row 3, and 09 §3: unresolved suppresses the image element
  // entirely rather than degrading it to a country image.
  if (precision === 'unresolved') return { kind: 'suppressed-unresolved' };

  if (resolvedPlace === null || resolvedPlace.trim().length === 0) {
    return { kind: 'suppressed-unresolved' };
  }

  const table = precision === 'city' ? registry.city : registry.country;
  const entry = table[normalizeAssetKey(resolvedPlace)];

  if (entry === undefined) return { kind: 'no-verified-asset', place: resolvedPlace };

  return { kind: 'asset', src: entry.src, place: entry.displayName };
}

/**
 * §8 / 10 §6 — the alt text states the image's NATURE, never its
 * content, and carries the provenance disclaimer itself rather than
 * leaving it to the visual caption.
 */
export function locationImageAlt(place: string): string {
  return `Representative location imagery of ${place}. Not imagery of this story.`;
}

/** Every asset path this registry can ever produce, for the disk check. */
export function registeredAssetPaths(registry: LocationAssetRegistry = LOCATION_ASSETS): string[] {
  return [...Object.values(registry.city), ...Object.values(registry.country)].map((e) => e.src);
}
