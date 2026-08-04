import type { NewsArticle } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { SafeImage } from '@/components/ui/SafeImage';

interface SourceArticleCardProps {
  article: NewsArticle;
}

export function SourceArticleCard({ article }: SourceArticleCardProps): JSX.Element {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-signal/60 hover:bg-surface-hover"
      aria-label={`Read the full story: ${article.title}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
        <SafeImage
          src={article.imageUrl || '/images/article-placeholder.jpg'}
          alt={article.title}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="mb-2 font-mono text-[10px] uppercase tracking-widest text-signal-bright">
          {article.category}
        </span>
        <h4 className="mb-3 line-clamp-2 font-display text-base font-medium leading-snug text-ink-primary transition-colors group-hover:text-signal-bright">
          {article.title}
        </h4>
        <div className="mt-auto flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-tertiary">
          <span className="text-ink-secondary">{article.sourceName}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatRelativeTime(article.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}
