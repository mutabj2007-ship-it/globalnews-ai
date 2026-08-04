import type { NewsArticle } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { SafeImage } from '@/components/ui/SafeImage';

interface TrendingSidebarProps {
  items: NewsArticle[];
}

export function TrendingSidebar({ items }: TrendingSidebarProps): JSX.Element {
  return (
    <aside
      className="flex flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6"
      aria-labelledby="trending-heading"
    >
      <h3
        id="trending-heading"
        className="mb-4 font-mono text-xs uppercase tracking-widest text-signal-bright"
      >
        Trending now
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          Live headlines are temporarily unavailable.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3"
                aria-label={`Read the full story: ${item.title}`}
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                  <SafeImage
                    src={item.imageUrl || '/images/article-placeholder.jpg'}
                    alt={item.title}
                    fill
                    sizes="64px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.05]"
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
                    {formatRelativeTime(item.publishedAt)}
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
