'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { CountryMeta, CountryNewsResponse } from '@globalnews-ai/shared';
import type { CountryFeature } from '@/lib/map/countryGeometry';
import type { HoveredCountry } from '@/components/map/WorldMap';
import { CountrySearchBox } from '@/components/map/CountrySearchBox';
import { CountryPanel } from '@/components/map/CountryPanel';
import { MapTooltip } from '@/components/map/MapTooltip';
import { CoverageLegend } from '@/components/map/CoverageLegend';
import type { CategoryFilterValue } from '@/components/map/CategoryFilterBar';
import { fetchCountryNews, CountryNewsApiError } from '@/lib/api/countryApi';

const WorldMap = dynamic(() => import('@/components/map/WorldMap').then((m) => m.WorldMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] w-full items-center justify-center rounded-2xl border border-border bg-surface">
      <p className="font-mono text-xs text-ink-tertiary">Loading world map…</p>
    </div>
  ),
});

type CachedByCountry = Record<string, CountryNewsResponse>;

function cacheKey(iso3: string, category: CategoryFilterValue): string {
  return `${iso3}:${category}`;
}

export function MapPageClient(): JSX.Element {
  const [selectedCountry, setSelectedCountry] = useState<CountryMeta | null>(null);
  const [category, setCategory] = useState<CategoryFilterValue>('all');
  const [cache, setCache] = useState<CachedByCountry>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoveredCountry | null>(null);

  const loadCountry = useCallback(
    async (country: CountryMeta, requestedCategory: CategoryFilterValue) => {
      setSelectedCountry(country);
      setError(null);

      const key = cacheKey(country.iso3, requestedCategory);
      if (cache[key]) return; // already loaded for this country+category

      setIsLoading(true);
      try {
        const response = await fetchCountryNews(country.iso3, {
          category: requestedCategory === 'all' ? undefined : requestedCategory,
        });
        setCache((current) => ({ ...current, [key]: response }));
      } catch (err) {
        setError(
          err instanceof CountryNewsApiError
            ? err.message
            : 'Something went wrong while loading this country\u2019s coverage.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [cache],
  );

  function handleSelectFromSearch(country: CountryMeta): void {
    setCategory('all');
    void loadCountry(country, 'all');
  }

  function handleSelectFromMap(feature: CountryFeature): void {
    const country = feature.properties.country;
    if (!country) return; // geometry feature we don't have metadata for yet
    setCategory('all');
    void loadCountry(country, 'all');
  }

  function handleCategoryChange(value: CategoryFilterValue): void {
    setCategory(value);
    if (selectedCountry) void loadCountry(selectedCountry, value);
  }

  const activeResponse = selectedCountry ? cache[cacheKey(selectedCountry.iso3, category)] : null;

  // Countries we know have stories, across any category we've fetched —
  // used only to lightly emphasize already-explored countries on the
  // map. This never triggers new requests; it just reflects what's
  // already been loaded client-side.
  const countryStoryCounts = useMemo<Record<string, number>>(() => {
  const counts: Record<string, number> = {};

  for (const [key, response] of Object.entries(cache)) {
    const [iso3, cachedCategory] = key.split(':');

    // Use only the unfiltered "all" response. Category-specific responses
    // contain partial totals and would make the heat level misleading.
    if (cachedCategory !== 'all') continue;

    counts[iso3] = response.totalResults;
  }

  return counts;
}, [cache]);

  const hoveredKnownCount = hovered?.country
  ? countryStoryCounts[hovered.country.iso3] ?? null
  : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
          Explore
        </span>
        <h1 className="mt-2 font-display text-2xl font-medium text-ink-primary sm:text-3xl">
          World News Map
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Select a country to see its current headlines, sourced live where a provider is
          configured. Search by name, or click directly on the map.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CountrySearchBox onSelectCountry={handleSelectFromSearch} />
        <p className="sr-only" id="map-a11y-note">
          An interactive world map is shown below on larger screens. You do not need to use it —
          the country search field above lets you find and select any supported country by
          typing its name, with full keyboard support.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map is hidden on small screens per the mobile fallback requirement: country
            search + the selection panel below remain fully functional without it. */}
        <div className="relative hidden h-[480px] lg:col-span-2 lg:block" aria-describedby="map-a11y-note">
          <WorldMap
  countryStoryCounts={countryStoryCounts}
  selectedIso3={selectedCountry?.iso3 ?? null}
  onHoverCountry={setHovered}
  onSelectCountry={handleSelectFromMap}
/>
<CoverageLegend />

          {hovered && <MapTooltip hovered={hovered} knownStoryCount={hoveredKnownCount} />}
        </div>

        <div className="lg:col-span-1">
          {selectedCountry ? (
            <CountryPanel
              country={selectedCountry}
              response={activeResponse ?? null}
              isLoading={isLoading}
              error={error}
              category={category}
              onCategoryChange={handleCategoryChange}
            />
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-ink-secondary">
                Search for a country above, or select one on the map, to see its current
                coverage.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Always-visible simplified summary for narrow screens, so the
          experience never depends on hover or the visual map. */}
      <div className="mt-6 lg:hidden">
        {!selectedCountry && (
          <p className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-ink-secondary">
            The interactive map is available on larger screens. Use the search field above to
            select a country here.
          </p>
        )}
      </div>
    </div>
  );
}
