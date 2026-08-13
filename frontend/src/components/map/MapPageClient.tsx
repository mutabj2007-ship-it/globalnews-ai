'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { CountryMeta, CountryNewsResponse, LanguageCode } from '@globalnews-ai/shared';
import type { CountryFeature } from '@/lib/map/countryGeometry';
import type { HoveredCountry } from '@/components/map/WorldMap';
import { CountrySearchBox } from '@/components/map/CountrySearchBox';
import { CountryPanel } from '@/components/map/CountryPanel';
import { MapTooltip } from '@/components/map/MapTooltip';
import { CoverageLegend } from '@/components/map/CoverageLegend';
import type { CategoryFilterValue } from '@/components/map/CategoryFilterBar';
import { fetchCountryNews, CountryNewsApiError } from '@/lib/api/countryApi';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { readLanguageCookie } from '@/lib/i18n/languages';

/**
 * Milestone #49 (Phase B cleanup) — next/dynamic's `loading` callback
 * is a module-scope function with no access to MapPageClient's own
 * `language` prop or React state. This callback only ever executes
 * client-side (guaranteed by `ssr: false` below), so it's safe to call
 * the SAME `readLanguageCookie()` utility already used for the
 * homepage's Hero.tsx language-sync logic directly here — reusing the
 * existing cookie-reading mechanism rather than introducing a second
 * one. Falls back to 'en' exactly like every other cookie-absent case
 * in this codebase.
 */
function DynamicMapLoadingFallback(): JSX.Element {
  const language = readLanguageCookie() ?? 'en';
  const t = getDictionary(language).map;

  return (
    <div className="flex h-full min-h-[360px] w-full items-center justify-center rounded-2xl border border-border bg-surface">
      <p className="font-mono text-xs text-ink-tertiary">{t.loading}</p>
    </div>
  );
}

const WorldMap = dynamic(() => import('@/components/map/WorldMap').then((m) => m.WorldMap), {
  ssr: false,
  loading: DynamicMapLoadingFallback,
});

type CachedByCountry = Record<string, CountryNewsResponse>;

/**
 * Milestone #49 — `language` is now part of the cache key. Without
 * this, switching from English to Polish (or back) could silently
 * reuse a response fetched in the other language, presenting
 * wrong-language source-language evidence as if it matched the
 * current selection.
 */
function cacheKey(iso3: string, category: CategoryFilterValue, language: LanguageCode): string {
  return `${iso3}:${category}:${language}`;
}

interface MapPageClientProps {
  /** Milestone #49 — defaults to 'en', so every pre-M49 caller renders exactly as before. */
  language?: LanguageCode;
}

export function MapPageClient({ language = 'en' }: MapPageClientProps): JSX.Element {
  const [selectedCountry, setSelectedCountry] = useState<CountryMeta | null>(null);
  const [category, setCategory] = useState<CategoryFilterValue>('all');
  const [cache, setCache] = useState<CachedByCountry>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoveredCountry | null>(null);

  const t = getDictionary(language).map;

  const loadCountry = useCallback(
    async (country: CountryMeta, requestedCategory: CategoryFilterValue) => {
      setSelectedCountry(country);
      setError(null);

      const key = cacheKey(country.iso3, requestedCategory, language);
      if (cache[key]) return; // already loaded for this country+category+language

      setIsLoading(true);
      try {
        const response = await fetchCountryNews(country.iso3, {
          category: requestedCategory === 'all' ? undefined : requestedCategory,
          lang: language,
        });
        setCache((current) => ({ ...current, [key]: response }));
      } catch (err) {
        setError(
          err instanceof CountryNewsApiError
            ? err.message
            : t.genericFetchError,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [cache, language, t.genericFetchError],
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

  const activeResponse = selectedCountry ? cache[cacheKey(selectedCountry.iso3, category, language)] : null;

  // Countries we know have stories, across any category we've fetched —
  // used only to lightly emphasize already-explored countries on the
  // map. This never triggers new requests; it just reflects what's
  // already been loaded client-side.
  const countryStoryCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};

    for (const [key, response] of Object.entries(cache)) {
      const [iso3, cachedCategory, cachedLanguage] = key.split(':');

      // Use only the unfiltered "all" response, and only for the
      // currently active language — a count loaded under a different
      // language reflects a different, potentially not-yet-fetched
      // set of results for the language currently being viewed.
      if (cachedCategory !== 'all' || cachedLanguage !== language) continue;

      counts[iso3] = response.totalResults;
    }

    return counts;
  }, [cache, language]);

  const hoveredKnownCount = hovered?.country ? countryStoryCounts[hovered.country.iso3] ?? null : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">{t.exploreLabel}</span>
        <h1 className="mt-2 font-display text-2xl font-medium text-ink-primary sm:text-3xl">{t.headline}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t.intro}</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CountrySearchBox onSelectCountry={handleSelectFromSearch} language={language} />
        <p className="sr-only" id="map-a11y-note">
          {t.mapA11yNote}
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
            language={language}
          />
          <CoverageLegend language={language} />

          {hovered && <MapTooltip hovered={hovered} knownStoryCount={hoveredKnownCount} language={language} />}
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
              language={language}
            />
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-ink-secondary">{t.noSelectionPrompt}</p>
            </div>
          )}
        </div>
      </div>

      {/* Always-visible simplified summary for narrow screens, so the
          experience never depends on hover or the visual map. */}
      <div className="mt-6 lg:hidden">
        {!selectedCountry && (
          <p className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-ink-secondary">
            {t.mobileFallback}
          </p>
        )}
      </div>
    </div>
  );
}
