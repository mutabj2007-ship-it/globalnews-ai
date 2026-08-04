import type { NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import { DataModeLabel } from '@/components/ui/DataModeLabel';

interface LatestUpdatesFeedProps {
  updates: NewsArticle[];
  dataMode: NewsDataMode | null;
}

export function LatestUpdatesFeed({ updates, dataMode }: LatestUpdatesFeedProps): JSX.Element {
  return (
    <section className="border-b border-border bg-surface/40" aria-labelledby="updates-heading">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 sm:mb-12">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
              Latest updates
            </span>
            <h2
              id="updates-heading"
              className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
            >
              As it comes in
            </h2>
          </div>
          <DataModeLabel dataMode={dataMode} />
        </div>

        {updates.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-secondary">
            Live headlines are temporarily unavailable. Check that the backend is running.
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {updates.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-1 gap-2 p-5 transition-colors hover:bg-surface-hover sm:grid-cols-[110px_1fr] sm:gap-6 sm:p-6"
              >
                <div className="font-mono text-xs text-ink-tertiary sm:pt-0.5">
                  {formatUtcClock(item.publishedAt)}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-signal-bright">
                      {item.category}
                    </span>
                    <span className="text-ink-tertiary" aria-hidden="true">
                      &middot;
                    </span>
                    <span className="font-mono text-[11px] text-ink-tertiary">
                      {item.sourcesCount === 1 ? item.sourceName : `${item.sourcesCount} sources`}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 font-display text-base font-medium leading-snug text-ink-primary sm:text-lg">
                    {item.title}
                  </h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-ink-secondary">
                    {item.summary}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
