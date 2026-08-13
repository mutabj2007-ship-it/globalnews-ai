'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  computeFeatureBounds,
  getCountryFeatureCollection,
  type CountryFeature,
} from '@/lib/map/countryGeometry';
import { COUNTRIES, type CountryMeta, type LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

const FILL_LAYER_ID = 'countries-fill';
const OUTLINE_LAYER_ID = 'countries-outline';
const HOVER_LAYER_ID = 'countries-hover';
const SOURCE_ID = 'countries';

/**
 * A fully local style: solid background plus our own layers, so the map
 * never needs a runtime fetch to any tile/style server (no token, no
 * third-party dependency for the base map itself, consistent with the
 * project's dark/blue design language rather than clashing basemap
 * imagery).
 */
const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#080b12' },
    },
  ],
};

function isoToNumeric(iso3: string | null): string {
  if (!iso3) return '';
  return COUNTRIES.find((c) => c.iso3 === iso3)?.isoNumeric ?? '';
}
function numericToCountry(numericId: string): CountryMeta | undefined {
  return COUNTRIES.find((country) => country.isoNumeric === numericId);
}
export interface HoveredCountry {
  numericId: string;
  country: CountryMeta | undefined;
  x: number;
  y: number;
}

interface WorldMapProps {
  /**
   * Number of stories currently loaded for each country.
   * Example:
   * {
   *   BRA: 8,
   *   USA: 12,
   *   RWA: 6,
   * }
   */
  countryStoryCounts: Record<string, number>;

  /** Currently selected country's ISO3 code, if any. */
  selectedIso3: string | null;

  onHoverCountry: (hover: HoveredCountry | null) => void;

  onSelectCountry: (feature: CountryFeature) => void;

  /** Milestone #49 — defaults to 'en', so every pre-M49 caller renders exactly as before. */
  language?: LanguageCode;
}

export function WorldMap({
  countryStoryCounts,
  selectedIso3,
  onHoverCountry,
  onSelectCountry,
  language = 'en',
}: WorldMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const t = getDictionary(language).map;

 // Initialize the map once.
useEffect(() => {
  if (!containerRef.current) {
    return undefined;
  }

  let map: maplibregl.Map;

  try {
    map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [12, 20],
      zoom: 1.1,
      minZoom: 0.6,
      maxZoom: 6,
      attributionControl: false,
    });
  } catch (error) {
    setLoadError(
      error instanceof Error
        ? error.message
        : 'The map failed to initialize in this browser.',
    );

    return undefined;
  }

  mapRef.current = map;

  map.addControl(
    new maplibregl.NavigationControl({
      showCompass: false,
    }),
    'top-right',
  );

  map.on('load', () => {
    try {
      const collection = getCountryFeatureCollection();

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: collection,
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#3d6fff',
          'fill-opacity': 0.1,
        },
      });

      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#1e2636',
          'line-width': 0.6,
        },
      });
      map.addLayer({
  id: HOVER_LAYER_ID,
  type: 'line',
  source: SOURCE_ID,
  filter: ['==', ['get', 'numericId'], '__none__'],
  paint: {
    'line-color': '#67e8f9',
    'line-width': 2,
    'line-opacity': 0.95,
  },
});  

      setIsStyleLoaded(true);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'World map geometry could not be loaded.',
      );
    }
  });

  map.on('error', (event) => {
    const mapError =
      'error' in event && event.error instanceof Error
        ? event.error.message
        : 'Unknown MapLibre error';

    console.warn('[world-map] MapLibre error event:', mapError);
  });

  map.on(
    'mousemove',
    FILL_LAYER_ID,
    (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0] as CountryFeature | undefined;

      if (!feature) {
        return;
      }

      const numericId = String(feature.properties.numericId);
      const country = numericToCountry(numericId);

      map.getCanvas().style.cursor = country ? 'pointer' : '';
      if (map.getLayer(HOVER_LAYER_ID)) {
  map.setFilter(HOVER_LAYER_ID, [
    '==',
    ['get', 'numericId'],
    numericId,
  ]);
}
      onHoverCountry({
        numericId,
        country,
        x: event.point.x,
        y: event.point.y,
      });
    },
  );

  map.on('mouseleave', FILL_LAYER_ID, () => {
  map.getCanvas().style.cursor = '';

  if (map.getLayer(HOVER_LAYER_ID)) {
    map.setFilter(HOVER_LAYER_ID, [
      '==',
      ['get', 'numericId'],
      '__none__',
    ]);
  }

  onHoverCountry(null);
});

  map.on(
    'click',
    FILL_LAYER_ID,
    (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0] as CountryFeature | undefined;

      if (!feature) {
        return;
      }

      const numericId = String(feature.properties.numericId);
      const country = numericToCountry(numericId);

      if (!country) {
        return;
      }

      onSelectCountry({
        ...feature,
        id: numericId,
        properties: {
          numericId,
          country,
        },
      });
    },
  );

  return () => {
    map.remove();
    mapRef.current = null;
  };

  // These callbacks intentionally remain fixed for this one-time map setup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // Move the camera whenever a country is selected by search or map click.
useEffect(() => {
  const map = mapRef.current;

  if (!map || !isStyleLoaded || !selectedIso3) {
    return;
  }

  const collection = getCountryFeatureCollection();

  const selectedFeature = collection.features.find(
    (feature) => feature.properties.country?.iso3 === selectedIso3,
  );

  if (!selectedFeature) {
    return;
  }

  /*
   * Some countries cross the international date line at ±180 degrees.
   * Their raw bounding boxes can incorrectly span almost the entire world,
   * so we use controlled camera views for them instead of fitBounds().
   */
  const antimeridianViews: Record<
    string,
    {
      center: [number, number];
      zoom: number;
    }
  > = {
    RUS: {
      center: [90, 61],
      zoom: 2.1,
    },
    FJI: {
      center: [178, -17.8],
      zoom: 4.4,
    },
    KIR: {
      center: [-157, 1.8],
      zoom: 3.2,
    },
    NZL: {
      center: [172, -41],
      zoom: 3.3,
    },
  };

  const specialView = antimeridianViews[selectedIso3];

  if (specialView) {
    map.easeTo({
      center: specialView.center,
      zoom: specialView.zoom,
      duration: 1000,
      essential: true,
    });

    return;
  }

  const bounds = computeFeatureBounds(selectedFeature);

  if (!bounds) {
    return;
  }

  map.fitBounds(bounds, {
    padding: {
      top: 70,
      right: 70,
      bottom: 70,
      left: 70,
    },
    maxZoom: 5,
    duration: 1000,
    essential: true,
  });
}, [selectedIso3, isStyleLoaded]);

// Update loaded-coverage styling and selected-country emphasis.
useEffect(() => {
  const map = mapRef.current;

  if (!map || !isStyleLoaded) {
    return;
  }

  const selectedNumeric = isoToNumeric(selectedIso3);

  const countMatchExpression: unknown[] = [
    'match',
    ['get', 'numericId'],
  ];

  for (const [iso3, storyCount] of Object.entries(countryStoryCounts)) {
    const numericId = isoToNumeric(iso3);

    if (numericId) {
      countMatchExpression.push(numericId, storyCount);
    }
  }

  // Countries not loaded during this session default to zero.
  countMatchExpression.push(0);

  map.setPaintProperty(FILL_LAYER_ID, 'fill-color', [
    'case',

    // Selected country receives the strongest visual treatment.
    ['==', ['get', 'numericId'], selectedNumeric],
    '#22d3ee',

    // Previously loaded countries use a quieter heat scale.
    [
      'step',
      countMatchExpression,
      '#0f1726',
      1,
      '#17284a',
      4,
      '#203e73',
      8,
      '#2b5191',
      13,
      '#3a65b5',
    ],
  ]);

  map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
    'case',

    ['==', ['get', 'numericId'], selectedNumeric],
    0.82,

    [
      'step',
      countMatchExpression,
      0.05,
      1,
      0.16,
      4,
      0.23,
      8,
      0.31,
      13,
      0.4,
    ],
  ]);

  map.setPaintProperty(OUTLINE_LAYER_ID, 'line-color', [
    'case',

    ['==', ['get', 'numericId'], selectedNumeric],
    '#a5f3fc',

    [
      'step',
      countMatchExpression,
      '#202b3e',
      1,
      '#2a3b58',
      4,
      '#35517c',
      8,
      '#476da5',
      13,
      '#5c83c7',
    ],
  ]);

  map.setPaintProperty(OUTLINE_LAYER_ID, 'line-width', [
    'case',

    ['==', ['get', 'numericId'], selectedNumeric],
    2.4,

    [
      'step',
      countMatchExpression,
      0.55,
      1,
      0.65,
      4,
      0.75,
      8,
      0.85,
      13,
      0.95,
    ],
  ]);
}, [countryStoryCounts, selectedIso3, isStyleLoaded]);

  if (loadError) {
    return (
      <div
        className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-8 text-center"
        role="alert"
      >
        <p className="text-sm text-ink-secondary">
          {t.mapLoadErrorPrefix}
          {loadError}
          {t.mapLoadErrorSuffix}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-border">
      <div ref={containerRef} className="h-full w-full" aria-hidden="true" />
      {!isStyleLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-void">
          <p className="font-mono text-xs text-ink-tertiary">{t.loading}</p>
        </div>
      )}
    </div>
  );
}
