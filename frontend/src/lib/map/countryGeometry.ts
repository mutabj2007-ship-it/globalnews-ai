import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import worldAtlas110m from 'world-atlas/countries-110m.json';
import { findCountryByNumeric, type CountryMeta } from '@globalnews-ai/shared';

export interface CountryFeatureProperties {
  /** ISO 3166-1 numeric code, as provided by world-atlas (world feature id). */
  numericId: string;
  /** Present only for countries we have metadata for (see shared/src/countries.ts). */
  country?: CountryMeta;
}

export type CountryFeature = Feature<Geometry, CountryFeatureProperties>;
export type CountryFeatureCollection = FeatureCollection<Geometry, CountryFeatureProperties>;

let cachedCollection: CountryFeatureCollection | null = null;

/**
 * Converts the bundled world-atlas TopoJSON (Natural Earth 1:110m admin-0
 * countries, see docs/map-data-sources.md) into a GeoJSON FeatureCollection
 * once, joining each feature to our curated country metadata by its ISO
 * 3166-1 numeric id — this is the "map feature ID mapping" that avoids
 * fragile string matching between the geometry dataset's names and our
 * own country list.
 */
export function getCountryFeatureCollection(): CountryFeatureCollection {
  if (cachedCollection) return cachedCollection;

  const topology = worldAtlas110m as unknown as Topology;
  const countriesObject = topology.objects.countries as GeometryCollection;
  const converted = feature(topology, countriesObject) as unknown as FeatureCollection<Geometry>;

  const features: CountryFeature[] = converted.features.map((f) => {
    const numericId = String(f.id ?? '').padStart(3, '0');
    return {
      ...f,
      id: numericId,
      properties: {
        numericId,
        country: findCountryByNumeric(numericId),
      },
    };
  });

  cachedCollection = { type: 'FeatureCollection', features };
  return cachedCollection;
}

/** Rough bounding-box center for a feature's geometry, used to fly the map to a selected country. */
export function computeFeatureCenter(f: CountryFeature): [number, number] | null {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  function visit(coords: unknown): void {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      const [lng, lat] = coords as [number, number];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    if (Array.isArray(coords)) {
      for (const c of coords) visit(c);
    }
  }

  const geometry = f.geometry as { coordinates?: unknown };
  if (!geometry?.coordinates) return null;
  visit(geometry.coordinates);

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}
/**
 * Calculates the geographic bounding box of a country feature.
 * Returns [[west, south], [east, north]] for MapLibre fitBounds().
 */
export function computeFeatureBounds(
  feature: CountryFeature,
): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  function visit(coords: unknown): void {
    if (
      Array.isArray(coords) &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      const [lng, lat] = coords as [number, number];

      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;

      return;
    }

    if (Array.isArray(coords)) {
      for (const child of coords) {
        visit(child);
      }
    }
  }

  const geometry = feature.geometry as { coordinates?: unknown };

  if (!geometry?.coordinates) {
    return null;
  }

  visit(geometry.coordinates);

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}