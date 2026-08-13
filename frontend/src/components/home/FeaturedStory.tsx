import { Link2 } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { SafeImage } from '@/components/ui/SafeImage';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';

interface FeaturedStoryProps {
  story: NewsArticle | null;
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

export function FeaturedStory({ story, language = 'en' }: FeaturedStoryProps): JSX.Element {
  const t = getDictionary(language).featuredStory;

  if (!story) {
    return (
      <div className="flex h-full flex-col items-start justify-center rounded-2xl border border-border bg-surface p-8">
        <p className="text-sm text-ink-secondary">{t.unavailable}</p>
      </div>
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <a
        href={story.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-1 flex-col"
        aria-label={`Read the full story: ${story.title}`}
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
          <SafeImage
            src={story.imageUrl || '/images/article-placeholder.jpg'}
            alt={story.title}
            fill
            priority
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute left-4 top-4 rounded-full border border-border-strong bg-void/80 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-widest text-signal-bright backdrop-blur-sm">
            {story.tag ?? story.category}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-6 sm:p-8">
          <h3 className="mb-3 line-clamp-2 text-balance font-display text-2xl font-medium leading-tight text-ink-primary transition-colors group-hover:text-signal-bright sm:text-3xl">
            {story.title}
          </h3>
          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-ink-secondary sm:text-base">
            {story.summary}
          </p>
        </div>
      </a>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-6 pt-5 sm:px-8">
        <div className="flex flex-col gap-1 font-mono text-xs text-ink-tertiary sm:flex-row sm:items-center sm:gap-3">
          <span className="text-ink-secondary">{story.sourceName}</span>
          <span className="hidden sm:inline" aria-hidden="true">
            &middot;
          </span>
          <span>{formatRelativeTime(story.publishedAt, language)}</span>
          <span className="hidden sm:inline" aria-hidden="true">
            &middot;
          </span>
          <span>{pluralWithForms(story.sourcesCount, language, t.sourceForms)}</span>
        </div>

        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-ink-primary transition-colors hover:border-signal hover:text-signal-bright"
        >
          <Link2 size={16} strokeWidth={2} />
          {t.viewSources}
        </a>
      </div>
    </article>
  );
}
