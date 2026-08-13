import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { SafeImage } from '@/components/ui/SafeImage';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface CountryArticleCardProps {
  article: NewsArticle;
  language?: LanguageCode;
}

/**
 * Milestone #50 Phase F — extracted from CountryPanel.tsx's inline
 * article `<li>` markup. Only real, already-available data is shown:
 * category (from the actual classified article), source name, and
 * relative age. No "trending"/popularity/engagement label is
 * fabricated — NewsArticle has no such field, so none is invented
 * here. Hover interaction is intentionally subtle (a small lift +
 * border-color shift + slightly brighter title, no scale/zoom/bounce)
 * and respects prefers-reduced-motion via Tailwind's `motion-safe:`
 * variant — the non-hover, non-motion state is fully informative and
 * fully usable without it; hover only adds polish, never gates access
 * to any information or control. Keyboard/touch users get the exact
 * same focus-visible treatment as the mouse-hover treatment.
 */
export function CountryArticleCard({ article, language = 'en' }: CountryArticleCardProps): JSX.Element {
  const t = getDictionary(language).map;

  return (
    <li>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-3 rounded-xl border border-border bg-void p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/60 hover:bg-surface-hover hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:border-signal/60 focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        aria-label={`${t.readFullStoryPrefix} ${article.title}`}
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
          <SafeImage
            src={article.imageUrl || '/images/article-placeholder.jpg'}
            alt={article.title}
            fill
            sizes="56px"
            className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-signal-bright">
            {article.category}
          </span>

          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-primary transition-colors group-hover:text-signal-bright">
            {article.title}
          </p>

          <span className="flex items-center gap-1 font-mono text-[11px] text-ink-tertiary">
            {article.sourceName}
            <span aria-hidden="true">&middot;</span>
            {formatRelativeTime(article.publishedAt, language)}
          </span>
        </div>
      </a>
    </li>
  );
}
