'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import type { CountryMeta, CountryNewsResponse, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { type CategoryFilterValue } from '@/components/map/CategoryFilterBar';
import { CountryContextShelf } from '@/components/map/CountryContextShelf';
import { CountryArticleCard } from '@/components/map/CountryArticleCard';
import { getCountryDisplayName } from '@/lib/countryDisplayName';

/**
 * Milestone #50 Phase F — re-exported for backward compatibility with
 * existing test imports (CountryPanel.spec.ts) and any other consumer
 * that imports these from this module's public surface. The actual
 * implementations now live in countryPanelText.ts (see that file's own
 * doc comment for why — avoiding a circular import with
 * CountryContextShelf.tsx, which also needs them). Behavior is
 * byte-for-byte unchanged.
 */
export {
  resolveFeedBadgeText,
  resolveFallbackTitle,
  resolveFallbackDescription,
} from '@/components/map/countryPanelText';

interface CountryPanelProps {
  country: CountryMeta;
  response: CountryNewsResponse | null;
  isLoading: boolean;
  error: string | null;
  category: CategoryFilterValue;
  onCategoryChange: (value: CategoryFilterValue) => void;
  /** Milestone #49 — defaults to 'en', so every pre-M49 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #50 Phase F — CountryPanel is now a thin orchestrator
 * rather than one long monolithic card. It composes:
 *   - CountryContextShelf (sticky: identity, badge, category filter,
 *     compact coverage metrics)
 *   - a flowing (non-sticky, non-internally-scrollable) article stream
 *     using CountryArticleCard
 *
 * Structurally mirrors the exact outer-cell/inner-sticky pattern
 * already proven for the left-column map in Milestone #50 Phase E:
 * the shelf's own wrapper carries `lg:sticky lg:top-20`, while this
 * component's ROOT remains a normal flowing block (no fixed height,
 * no `overflow-y-auto`) — the browser document is the only scroll
 * surface, and article cards naturally pass beneath the shelf's lower
 * edge as the page scrolls, exactly like the map does on the left.
 *
 * `lg:z-30` keeps this shelf below the map's `lg:z-40` and the
 * NavBar's `z-50`, so stacking order remains unambiguous even though
 * they're in different columns and would never actually overlap.
 */
export function CountryPanel({
  country,
  response,
  isLoading,
  error,
  category,
  onCategoryChange,
  language = 'en',
}: CountryPanelProps): JSX.Element {
  const router = useRouter();
  const t = getDictionary(language).map;
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const displayName = getCountryDisplayName(country.iso2, language, country.name);

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-8 font-mono text-xs text-ink-tertiary">
        <div role="status" aria-live="polite" className="flex items-center gap-2">
          <Loader2 size={16} className="motion-safe:animate-spin" strokeWidth={2} />
          {country.iso3} {' · '} {country.region}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-ink-secondary" role="alert">
        {error}
      </p>
    );
  }

  if (!response) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-ink-secondary">{t.noSelectionPrompt}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="lg:sticky lg:top-20 lg:z-30">
        <CountryContextShelf
          country={country}
          response={response}
          category={category}
          onCategoryChange={onCategoryChange}
          isLoading={isLoading}
          language={language}
          detailsExpanded={detailsExpanded}
          onToggleDetails={() => setDetailsExpanded((current) => !current)}
        />
      </div>

      {response.articles.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          {t.panel.noCoveragePrefix}{' '}
          {displayName}
          {category !== 'all' ? ` ${t.panel.noCoverageInCategory} ${t.categories[category] ?? category}` : ''}
          {t.panel.noCoverageSuffix}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {response.articles.map((article) => (
            <CountryArticleCard key={article.id} article={article} language={language} countryCode={country.iso2} />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() =>
          router.push(
            // Milestone #49 Phase D: deliberately uses country.name
            // (the canonical English name), NOT the localized display
            // name — this is a navigation query string to the general
            // search page, not a display element.
            `/search?q=${encodeURIComponent(country.name)}`,
          )
        }
        className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-bright"
      >
        {t.panel.viewFullCoverage}
        <ArrowUpRight size={16} strokeWidth={2.25} />
      </button>
    </div>
  );
}
