'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { SafeImage } from '@/components/ui/SafeImage';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface CountryArticleCardProps {
  article: NewsArticle;
  language?: LanguageCode;
  /**
   * Milestone #51 Phase B — the real country this article's coverage
   * belongs to (from CountryPanel's own already-selected `country`
   * prop), passed through so the "Ask GlobalNews AI about this"
   * action can anchor retrieval to the correct country instead of
   * relying solely on free-text detection of the article title. A
   * bounded 2-3 character code, not the whole article/country object
   * — see this file's own doc comment for why.
   */
  countryCode?: string;
}

/**
 * Milestone #51 — Map \u2192 Story \u2192 Q&A integration. Added a second
 * action alongside the existing external "read full story" link: "Ask
 * GlobalNews AI about this", which navigates to `/search?q=...` using
 * the exact same plain-text-query pattern CountryPanel's own
 * "View full country coverage" button already uses (see that file) \u2014
 * no new backend field, no new shared contract. The query text is the
 * article's own real title, nothing fabricated.
 *
 * Converted the card's root from a single enclosing <a> to a <div>
 * with two independent interactive children, since a <button> cannot
 * be nested inside an <a> (invalid HTML / conflicting click targets).
 * The external-link behavior for the title/image area is otherwise
 * unchanged \u2014 same href, target, rel, and hover/focus treatment.
 */
export function CountryArticleCard({ article, language = 'en', countryCode }: CountryArticleCardProps): JSX.Element {
  const t = getDictionary(language).map;
  const router = useRouter();

  return (
    <li>
      <div className="group flex items-start gap-3 rounded-xl border border-border bg-void p-3 transition-all duration-200 hover:border-signal/60 hover:bg-surface-hover motion-reduce:transition-none">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
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

        <button
          type="button"
          onClick={() => {
            /**
             * Milestone #51 Phase B fix — this previously navigated
             * with ONLY the article title as `q`, which silently lost
             * all story identity: the backend had no way to know this
             * query originated from a specific, already-known-country
             * article, and its own free-text country detection was
             * not reliable enough for every real headline (real-
             * browser CTO acceptance testing demonstrated this: a
             * Rwanda migration-story title produced an unrelated
             * Italian swimming analysis). Now also passes a bounded
             * `countryCode` param — NOT the whole article object/body
             * — which SearchPageClient reads to build a StoryContext
             * and anchor retrieval correctly.
             *
             * CTO final correction — also passes `articleId`
             * (article.id, already a real, bounded string this
             * component already has — no new prop). Country alone was
             * insufficient: it could not distinguish this specific
             * story from any other Rwanda article (e.g. a football or
             * economy story). articleId lets the backend resolve THIS
             * exact article server-side as a trusted evidence anchor.
             */
            const params = new URLSearchParams({ q: article.title, articleId: article.id });
            if (countryCode) {
              params.set('countryCode', countryCode);
            }
            router.push(`/search?${params.toString()}`);
          }}
          aria-label={`${t.askAboutStory}: ${article.title}`}
          title={t.askAboutStory}
          className="shrink-0 self-center rounded-full border border-border-strong p-2 text-ink-tertiary transition-colors hover:border-signal hover:text-signal-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
        >
          <Search size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
