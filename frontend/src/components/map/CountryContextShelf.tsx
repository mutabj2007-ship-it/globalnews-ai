import type { CountryMeta, CountryNewsResponse, LanguageCode } from '@globalnews-ai/shared';
import { Database, TriangleAlert } from 'lucide-react';
import {
  CategoryFilterBar,
  type CategoryFilterValue,
} from '@/components/map/CategoryFilterBar';
import { CoverageMetrics } from '@/components/map/CoverageMetrics';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { calculateCoverageQuality } from '@/lib/coverageQuality';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { resolveFeedBadgeText, resolveFallbackTitle, resolveFallbackDescription } from '@/components/map/countryPanelText';

interface CountryContextShelfProps {
  country: CountryMeta;
  response: CountryNewsResponse | null;
  category: CategoryFilterValue;
  onCategoryChange: (value: CategoryFilterValue) => void;
  isLoading: boolean;
  language?: LanguageCode;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
}

/**
 * Milestone #50 Phase F — the compact, sticky right-column context
 * shelf: country identity, feed badge, category controls, and
 * compact coverage metrics. Deliberately excludes the article list
 * itself — that flows underneath as normal page content, per the
 * explicit "no nested article scrollbar" requirement. An opaque
 * background (bg-surface, matching the panel's existing surface
 * color) prevents underlying article cards from bleeding through as
 * they scroll beneath this shelf; a bottom gradient mask makes the
 * transition visually clear without a hard edge.
 */
export function CountryContextShelf({
  country,
  response,
  category,
  onCategoryChange,
  isLoading,
  language = 'en',
  detailsExpanded,
  onToggleDetails,
}: CountryContextShelfProps): JSX.Element {
  const t = getDictionary(language).map;
  const displayName = getCountryDisplayName(country.iso2, language, country.name);
  const coverageQuality = calculateCoverageQuality(response?.articles ?? [], language);
  const fallbackTitle = response ? resolveFallbackTitle(response, language) : null;
  const fallbackDescription = response ? resolveFallbackDescription(response, language) : null;

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink-primary sm:text-xl">{displayName}</h2>
          <p className="font-mono text-[11px] text-ink-tertiary">
            {country.iso3} {' · '} {country.region}
          </p>
        </div>

        {response && (
          <span className="inline-flex items-center rounded-full border border-brand/50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand">
            {resolveFeedBadgeText(response, language)}
          </span>
        )}
      </div>

      <div className="mb-3">
        <CategoryFilterBar value={category} onChange={onCategoryChange} disabled={isLoading} language={language} />
      </div>

      {response && response.dataMode === 'cached' && (
        <section
          className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"
          aria-label={t.storedReportingNoticeAriaLabel}
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0 text-amber-400">
              {response.fallbackReason === 'provider-error' ? (
                <TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Database size={15} strokeWidth={2} aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                {fallbackTitle}
              </p>
              {fallbackDescription && (
                <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">{fallbackDescription}</p>
              )}
              {response.newestArticlePublishedAt && (
                <p className="mt-1.5 font-mono text-[10px] text-ink-tertiary">
                  {t.newestStoredArticle}{' '}
                  <span className="text-ink-secondary">{formatRelativeTime(response.newestArticlePublishedAt)}</span>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {response && (
        <CoverageMetrics
          articles={response.articles}
          coverageQuality={coverageQuality}
          language={language}
          detailsExpanded={detailsExpanded}
          onToggleDetails={onToggleDetails}
        />
      )}

      {/* Subtle bottom fade so article cards scrolling underneath this
          shelf visually recede rather than ending in a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-4 h-4 bg-gradient-to-b from-surface to-transparent"
      />
    </div>
  );
}
