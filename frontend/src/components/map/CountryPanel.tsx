'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import type {
  CountryMeta,
  CountryNewsResponse,
  NewsArticle,
} from '@globalnews-ai/shared';
import { SafeImage } from '@/components/ui/SafeImage';

import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { calculateCoverageQuality } from '@/lib/coverageQuality';
import { CategoryFilterBar, type CategoryFilterValue } from '@/components/map/CategoryFilterBar';
type FreshnessStatus = 'FRESH' | 'RECENT' | 'AGING' | 'LIMITED';

interface CategoryCount {
  category: string;
  count: number;
}

function countUniquePublishers(articles: NewsArticle[]): number {
  return new Set(articles.map((article) => article.sourceId)).size;
}

function findLatestArticle(articles: NewsArticle[]): NewsArticle | null {
  if (articles.length === 0) return null;

  return articles.reduce((latest, article) =>
    new Date(article.publishedAt).getTime() >
    new Date(latest.publishedAt).getTime()
      ? article
      : latest,
  );
}

function countByCategory(articles: NewsArticle[]): CategoryCount[] {
  const counts = new Map<string, number>();

  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function getFreshnessStatus(
  latestArticle: NewsArticle | null,
): FreshnessStatus {
  if (!latestArticle) return 'LIMITED';

  const publishedTime = new Date(latestArticle.publishedAt).getTime();
  const ageHours = (Date.now() - publishedTime) / (1000 * 60 * 60);

  if (ageHours < 2) return 'FRESH';
  if (ageHours < 12) return 'RECENT';
  if (ageHours < 48) return 'AGING';

  return 'LIMITED';
}

const FRESHNESS_STYLES: Record<FreshnessStatus, string> = {
  FRESH:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  RECENT:
    'border-signal/50 bg-signal/10 text-signal-bright',
  AGING:
    'border-amber-500/40 bg-amber-500/10 text-amber-400',
  LIMITED:
    'border-border-strong bg-surface text-ink-tertiary',
};
interface CountryPanelProps {
  country: CountryMeta;
  response: CountryNewsResponse | null;
  isLoading: boolean;
  error: string | null;
  category: CategoryFilterValue;
  onCategoryChange: (value: CategoryFilterValue) => void;
}

export function CountryPanel({
  country,
  response,
  isLoading,
  error,
  category,
  onCategoryChange,
}: CountryPanelProps): JSX.Element {
  const router = useRouter();
  const coverageQuality = calculateCoverageQuality(response?.articles ?? []);
  const qualityStyles = {
  none: {
    label: 'text-ink-secondary',
    badge: 'border-border-strong text-ink-secondary',
    bar: 'bg-ink-tertiary',
  },
  limited: {
    label: 'text-amber-300',
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    bar: 'bg-amber-400',
  },
  developing: {
    label: 'text-blue-300',
    badge: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    bar: 'bg-blue-400',
  },
  strong: {
    label: 'text-emerald-300',
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    bar: 'bg-emerald-400',
  },
}[coverageQuality.level];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium text-ink-primary">{country.name}</h2>
          <p className="font-mono text-[11px] text-ink-tertiary">
            {country.iso3} {' · '} {country.region}
          </p>
        </div>
{response && (
  <span className="inline-flex items-center rounded-full border border-brand/50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand">
    {response.dataMode === 'mock'
      ? 'DEMO MODE · SAMPLE CONTENT ONLY'
      : response.dataMode === 'cached'
        ? 'CACHED · PREVIOUSLY RETRIEVED REPORTING'
        : response.feedTier === 'delayed'
          ? `DELAYED FEED · POWERED BY ${response.providerDisplayName}`
          : `LIVE · POWERED BY ${response.providerDisplayName}`}
  </span>
)}
          </div>

      <div className="mb-4">
        <CategoryFilterBar value={category} onChange={onCategoryChange} disabled={isLoading} />
      </div>

      {isLoading && (
        <div
          className="flex flex-1 items-center justify-center gap-2 py-10 font-mono text-xs text-ink-tertiary"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={16} className="animate-spin" strokeWidth={2} />
          {country.iso3} {' · '} {country.region}
        </div>
      )}

      {!isLoading && error && (
        <p className="rounded-xl border border-border bg-void p-4 text-sm text-ink-secondary" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && response && (
        <>
          <p className="mb-3 font-mono text-xs text-ink-tertiary">
            {response.totalResults} stor{response.totalResults === 1 ? 'y' : 'ies'} currently loaded
          </p>
          <div className="mb-4 rounded-xl border border-border bg-void p-4">
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-signal-bright">
        Coverage Quality
      </p>

      <p className={`mt-1 text-sm font-medium ${qualityStyles.label}`}>
  {coverageQuality.label}
</p>
    </div>

    <span
  className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${qualityStyles.badge}`}
>
  {coverageQuality.score}/100
</span>
  </div>

  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
    {coverageQuality.description}
  </p>
  <div className="mt-3">
  <div className="mb-1.5 flex items-center justify-between gap-3">
    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
      Coverage strength
    </span>

    <span className="font-mono text-[10px] text-ink-secondary">
      {coverageQuality.score}%
    </span>
  </div>

  <div
    className="h-1.5 overflow-hidden rounded-full bg-surface"
    role="progressbar"
    aria-label={`${country.name} coverage quality`}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={coverageQuality.score}
  >
    <div
  className={`h-full rounded-full transition-[width] duration-500 ${qualityStyles.bar}`}
  style={{ width: `${coverageQuality.score}%` }}
/>
<p className="mt-2 font-mono text-[9px] leading-relaxed text-ink-tertiary">
  Based on article volume, publisher diversity and reporting freshness.
</p>
  </div>
</div>

  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
        Publishers
      </p>
      <p className="mt-1 text-sm font-medium text-ink-primary">
        {coverageQuality.publisherCount}
      </p>
    </div>

    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
        Latest
      </p>
      <p className="mt-1 text-sm font-medium text-ink-primary">
        {coverageQuality.latestPublishedAt
          ? formatRelativeTime(coverageQuality.latestPublishedAt)
          : '—'}
      </p>
    </div>
  </div>
</div>
{response.articles.length > 0 && (() => {
  const articles = response.articles;
  const latestArticle = findLatestArticle(articles);
  const freshness = getFreshnessStatus(latestArticle);
  const publisherCount = countUniquePublishers(articles);
  const categoryCounts = countByCategory(articles);
  const topCategory = categoryCounts[0]?.category ?? '—';
  const maxCategoryCount = categoryCounts[0]?.count ?? 1;

  return (
    <section
      className="mb-4 rounded-xl border border-border bg-void p-4"
      aria-labelledby="coverage-snapshot-title"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3
          id="coverage-snapshot-title"
          className="font-mono text-[10px] font-semibold uppercase tracking-widest text-signal-bright"
        >
          Coverage snapshot
        </h3>

        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${FRESHNESS_STYLES[freshness]}`}
        >
          {freshness}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-3">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">
            Stories
          </dt>
          <dd className="mt-1 text-lg font-semibold text-ink-primary">
            {articles.length}
          </dd>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">
            Publishers
          </dt>
          <dd className="mt-1 text-lg font-semibold text-ink-primary">
            {publisherCount}
          </dd>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">
            Latest
          </dt>
          <dd className="mt-1 truncate text-sm font-medium text-ink-primary">
            {latestArticle
              ? formatRelativeTime(latestArticle.publishedAt)
              : '—'}
          </dd>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">
            Main topic
          </dt>
          <dd className="mt-1 truncate text-sm font-medium capitalize text-ink-primary">
            {topCategory}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-tertiary">
          Category activity
        </p>

        <div className="flex flex-col gap-2.5">
          {categoryCounts.map(({ category: categoryName, count }) => {
            const width = Math.max(
              8,
              Math.round((count / maxCategoryCount) * 100),
            );

            return (
              <div key={categoryName} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                  {categoryName}
                </span>

                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-signal transition-[width] duration-500"
                    style={{ width: `${width}%` }}
                  />
                </div>

                <span
                  className="w-6 shrink-0 text-right font-mono text-[10px] text-ink-secondary"
                  aria-label={`${count} ${categoryName} stories`}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
})()}
          {response.articles.length === 0 ? (
            <p className="flex-1 text-sm text-ink-secondary">
              No current coverage found for {country.name}
              {category !== 'all' ? ` in ${category}` : ''}. Try a different category, or view
              full coverage below.
            </p>
          ) : (
            <ul className="mb-4 flex flex-1 flex-col gap-3 overflow-y-auto">
              {response.articles.map((article) => (
                <li key={article.id}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 rounded-xl border border-border bg-void p-3 transition-colors hover:border-signal/60"
                    aria-label={`Read the full story: ${article.title}`}
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                      <SafeImage
                        src={article.imageUrl || '/images/article-placeholder.jpg'}
                        alt={article.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-signal-bright">
                        {article.category}
                      </span>
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-primary transition-colors group-hover:text-signal-bright">
                        {article.title}
                      </p>
                      <span className="font-mono text-[11px] text-ink-tertiary">
                        {article.sourceName} {'.'} {formatRelativeTime(article.publishedAt)}
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => router.push(`/search?q=${encodeURIComponent(country.name)}`)}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-bright"
      >
        View full country coverage
        <ArrowUpRight size={16} strokeWidth={2.25} />
      </button>
    </div>
  );
}
