import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { CoverageQualityResult } from '@/lib/coverageQuality';

/**
 * Milestone #50 Phase F — compact coverage presentation, extracted
 * from CountryPanel.tsx as its own component. Deliberately does NOT
 * touch calculateCoverageQuality()'s algorithm, publisher-count logic,
 * freshness logic, or category-activity calculation — this component
 * only reorganizes and visually compresses how those existing,
 * unchanged values are presented, per explicit scope.
 */

export type FreshnessStatus = 'FRESH' | 'RECENT' | 'AGING' | 'LIMITED';

interface CategoryCount {
  category: string;
  count: number;
}

export function countUniquePublishers(articles: NewsArticle[]): number {
  return new Set(articles.map((article) => article.sourceId)).size;
}

export function findLatestArticle(articles: NewsArticle[]): NewsArticle | null {
  if (articles.length === 0) {
    return null;
  }

  return articles.reduce((latest, article) =>
    new Date(article.publishedAt).getTime() > new Date(latest.publishedAt).getTime() ? article : latest,
  );
}

export function countByCategory(articles: NewsArticle[]): CategoryCount[] {
  const counts = new Map<string, number>();

  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function getFreshnessStatus(latestArticle: NewsArticle | null): FreshnessStatus {
  if (!latestArticle) {
    return 'LIMITED';
  }

  const publishedTime = new Date(latestArticle.publishedAt).getTime();
  const ageHours = (Date.now() - publishedTime) / (1000 * 60 * 60);

  if (ageHours < 2) return 'FRESH';
  if (ageHours < 12) return 'RECENT';
  if (ageHours < 48) return 'AGING';
  return 'LIMITED';
}

const QUALITY_BADGE_STYLES: Record<CoverageQualityResult['level'], string> = {
  none: 'border-border-strong text-ink-secondary',
  limited: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  developing: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  strong: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
};

interface CoverageMetricsProps {
  articles: NewsArticle[];
  coverageQuality: CoverageQualityResult;
  language?: LanguageCode;
  /** Whether the long explanatory description is currently shown (controlled by the parent, so it can live inside a sticky shelf without its own state). */
  detailsExpanded: boolean;
  onToggleDetails: () => void;
}

/**
 * Compact persistent summary: "{level label}" + "N stories · M
 * publishers · Xh latest · score/100" on one line, with per-category
 * activity bars beneath — small enough to fit comfortably inside a
 * sticky shelf. The longer explanatory sentence (e.g. "Several reports
 * are available, but coverage may still be developing.") is
 * secondary — collapsed by default, toggleable, never a fixed sticky
 * cost.
 */
export function CoverageMetrics({
  articles,
  coverageQuality,
  language = 'en',
  detailsExpanded,
  onToggleDetails,
}: CoverageMetricsProps): JSX.Element | null {
  const t = getDictionary(language).map;

  if (articles.length === 0) {
    return null;
  }

  const latestArticle = findLatestArticle(articles);
  const freshness = getFreshnessStatus(latestArticle);
  const publisherCount = countUniquePublishers(articles);
  const categoryCounts = countByCategory(articles);
  const maxCategoryCount = categoryCounts[0]?.count ?? 1;

  return (
    <div className="rounded-xl border border-border bg-void p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${QUALITY_BADGE_STYLES[coverageQuality.level]}`}>
          {coverageQuality.label}
        </span>
        <button
          type="button"
          onClick={onToggleDetails}
          aria-expanded={detailsExpanded}
          className="font-mono text-[10px] text-ink-tertiary underline-offset-2 hover:text-ink-secondary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {detailsExpanded ? t.panel.hideDetails : t.panel.showDetails}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-secondary">
        <span>{pluralWithForms(articles.length, language, t.storyForms)}</span>
        <span aria-hidden="true" className="text-ink-tertiary">
          &middot;
        </span>
        <span>{publisherCount} {t.panel.publishers.toLowerCase()}</span>
        <span aria-hidden="true" className="text-ink-tertiary">
          &middot;
        </span>
        <span>
          {latestArticle ? formatRelativeTime(latestArticle.publishedAt, language) : '—'}
        </span>
        <span aria-hidden="true" className="text-ink-tertiary">
          &middot;
        </span>
        <span
          role="progressbar"
          aria-label={t.coverageQualityAriaSuffix}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={coverageQuality.score}
        >
          {coverageQuality.score}/100
        </span>
        <span
          className="rounded-full border px-1.5 py-0.5 text-[10px]"
          style={{ borderColor: 'currentColor' }}
        >
          {t.freshness[freshness.toLowerCase()] ?? freshness}
        </span>
      </div>

      {detailsExpanded && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-tertiary">{coverageQuality.description}</p>
      )}

      {categoryCounts.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border pt-2.5">
          {categoryCounts.map(({ category: categoryName, count }) => {
            const width = Math.max(8, Math.round((count / maxCategoryCount) * 100));

            return (
              <div key={categoryName} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
                  {categoryName}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-signal transition-[width] duration-500"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span
                  className="w-5 shrink-0 text-right font-mono text-[9px] text-ink-secondary"
                  aria-label={`${t.categories[categoryName] ?? categoryName}: ${pluralWithForms(count, language, t.storyForms)}`}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
