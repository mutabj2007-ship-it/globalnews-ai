import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';

interface LatestUpdatesFeedProps {
  updates: NewsArticle[];
  dataMode: NewsDataMode | null;
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

export function LatestUpdatesFeed({
  updates,
  dataMode,
  language = 'en',
}: LatestUpdatesFeedProps): JSX.Element {
  const t = getDictionary(language).latestUpdatesFeed;

  return (
    <section className="border-b border-border bg-surface/40" aria-labelledby="updates-heading">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 sm:mb-12">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
              {t.label}
            </span>
            <h2
              id="updates-heading"
              className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
            >
              {t.headline}
            </h2>
          </div>
          <DataModeLabel dataMode={dataMode} language={language} />
        </div>

        {updates.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-secondary">
            {t.unavailable}
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
                      {/*
                        Milestone #48: item.sourceName (Category C,
                        source-derived) is shown verbatim, untranslated,
                        when there's exactly one source — only the
                        pluralized COUNT wording (Category D, GlobalNews
                        AI-generated) is localized via pluralWithForms.
                      */}
                      {item.sourcesCount === 1
                        ? item.sourceName
                        : pluralWithForms(item.sourcesCount, language, t.sourceForms)}
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
