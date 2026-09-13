import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { SafeImage } from '@/components/ui/SafeImage';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface InFocusSidebarProps {
  items: NewsArticle[];
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #51 Phase B — renamed from TrendingSidebar. "Trending"
 * implied a measured popularity/engagement signal that never actually
 * existed — these items were, and remain, a curated selection (see
 * homeFeedAllocation.ts), not a ranked-by-engagement list. Renaming
 * the component alongside the user-facing copy keeps the code honest
 * about what the data represents, not just the label the user sees.
 */
export function InFocusSidebar({ items, language = 'en' }: InFocusSidebarProps): JSX.Element {
  const t = getDictionary(language).inFocusSidebar;

  return (
    <aside
      className="flex flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6"
      aria-labelledby="in-focus-heading"
    >
      <h3
        id="in-focus-heading"
        className="mb-4 font-mono text-xs uppercase tracking-widest text-signal-bright"
      >
        {t.heading}
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-ink-secondary">{t.unavailable}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-lg p-1.5 -m-1.5 transition-colors duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 motion-reduce:transition-none"
                aria-label={`${t.readFullStoryPrefix} ${item.title}`}
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                  <SafeImage
                    src={item.imageUrl || '/images/article-placeholder.jpg'}
                    alt={item.title}
                    fill
                    sizes="64px"
                    className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">
                    {item.category}
                  </span>
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-primary transition-colors group-hover:text-signal-bright">
                    {item.title}
                  </p>
                  <span className="font-mono text-[11px] text-ink-tertiary">
                    {formatRelativeTime(item.publishedAt, language)}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
