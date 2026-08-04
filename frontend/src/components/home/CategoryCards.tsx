import { ArrowUpRight } from 'lucide-react';
import type { NewsArticle } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

interface CategoryCardsProps {
  cards: NewsArticle[];
}

export function CategoryCards({ cards }: CategoryCardsProps): JSX.Element {
  return (
    <section className="border-b border-border bg-void" aria-labelledby="coverage-heading">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-10 flex flex-col gap-2 sm:mb-12">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
            Today&rsquo;s coverage
          </span>
          <h2
            id="coverage-heading"
            className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
          >
            Six ways to see what&rsquo;s happening
          </h2>
        </div>

        {cards.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-secondary">
            Live headlines are temporarily unavailable. Check that the backend is running.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <article key={card.id} className="group h-full">
                <a
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Read the full story: ${card.title}`}
                  className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-signal/60 hover:bg-surface-hover"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-signal-bright">
                      {card.tag ?? card.category}
                    </span>
                    <ArrowUpRight
                      size={16}
                      className="text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>

                  <h3 className="mb-2 line-clamp-2 text-balance font-display text-lg font-medium leading-snug text-ink-primary">
                    {card.title}
                  </h3>

                  <p className="mb-5 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-secondary">
                    {card.summary}
                  </p>

                  <div className="flex items-center gap-3 border-t border-border pt-4 font-mono text-xs text-ink-tertiary">
                    <span>{formatRelativeTime(card.publishedAt)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{card.sourcesCount} sources</span>
                  </div>
                </a>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
