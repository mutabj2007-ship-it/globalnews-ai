import { ArrowUpRight } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';

interface CategoryCardsProps {
  cards: NewsArticle[];
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

export function CategoryCards({ cards, language = 'en' }: CategoryCardsProps): JSX.Element {
  const t = getDictionary(language).categoryCards;

  return (
    <section className="border-b border-border bg-void" aria-labelledby="coverage-heading">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-10 flex flex-col gap-2 sm:mb-12">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
            {t.label}
          </span>
          <h2
            id="coverage-heading"
            className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
          >
            {t.headline}
          </h2>
        </div>

        {cards.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-secondary">
            {t.unavailable}
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
                    <span>{formatRelativeTime(card.publishedAt, language)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{pluralWithForms(card.sourcesCount, language, t.sourceForms)}</span>
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
