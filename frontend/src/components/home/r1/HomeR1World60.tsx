import type { JSX } from 'react';
import { safeExternalHref, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { StoryVisual } from '@/components/home/StoryVisual';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';

/**
 * HOME R1 · STAGE A — "Your world in 60 seconds", light primary.
 *
 * The SAME disjoint pool Rev A allocates (allocateHomeFirstScreen — never a story already
 * in What's happening now), one image-led lead and up to four numbered rows. Every headline
 * is the publisher link; Save is the existing StoryBookmark as a sibling. No request beyond
 * the one Home feed read, no AI.
 */
export function HomeR1World60({
  items,
  language,
}: {
  readonly items: readonly NewsArticle[];
  readonly language: LanguageCode;
}): JSX.Element | null {
  const dict = getDictionary(language);
  const t = dict.homeReva.w60;
  if (items.length === 0) return null;
  const [lead, ...rest] = items;
  const meta = (a: NewsArticle): string => {
    const at = formatObservationalTime(a.publishedAt, a.publishedAtBasis, language);
    return at === '' ? a.sourceName : `${a.sourceName} · ${at}`;
  };
  return (
    <section aria-labelledby="home-r1-w60" data-home-r1-w60="" className="rounded-[14px] border border-[var(--gt-line)] bg-[var(--gt-card)] p-4">
      <h2 id="home-r1-w60" className="font-display text-[18px] font-bold text-[var(--gt-ink)]">
        {t.title}
      </h2>
      <p className="text-[12.5px] text-[var(--gt-ink2)]">{t.note}</p>
      <div className="relative mt-3 overflow-hidden rounded-[10px]">
        <a href={safeExternalHref(lead.url)} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="block">
          <StoryVisual article={lead} className="aspect-[16/9]" missingLabel={t.noImage} sizes="(min-width: 1140px) 360px, 92vw" />
        </a>
        <span className="absolute right-2 top-2">
          <StoryBookmark url={lead.url} language={language} className="!border-[var(--gt-pgLine2)] !bg-[var(--gt-card)] !text-[var(--gt-link)]" />
        </span>
      </div>
      <p className="mt-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--gt-link)]">
        {dict.map.categories[lead.category] ?? lead.category}
      </p>
      <h3 className="mt-1 text-[16px] font-bold leading-[1.3] text-[var(--gt-ink)]">
        <a href={safeExternalHref(lead.url)} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {lead.title}
        </a>
      </h3>
      <p className="mt-1 text-[12px] text-[var(--gt-ink2)]">{meta(lead)}</p>
      <ol className="mt-3 flex flex-col divide-y divide-[var(--gt-line2)] border-t border-[var(--gt-line2)]">
        {rest.slice(0, 4).map((article, index) => (
          <li key={article.id} className="flex items-center gap-3 py-2.5">
            <span aria-hidden="true" className="w-4 shrink-0 text-[12px] font-semibold text-[var(--gt-ink3)]">
              {index + 2}
            </span>
            <a href={safeExternalHref(article.url)} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="block w-[64px] shrink-0 overflow-hidden rounded-[6px]">
              <StoryVisual article={article} className="aspect-[4/3]" missingLabel={t.noImage} sizes="64px" />
            </a>
            <span className="min-w-0 flex-1">
              <a href={safeExternalHref(article.url)} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-[var(--gt-ink)] hover:underline">
                {article.title}
              </a>
              <span className="mt-0.5 block truncate text-[11.5px] text-[var(--gt-ink2)]">{meta(article)}</span>
            </span>
            <StoryBookmark url={article.url} language={language} size="compact" className="!border-[var(--gt-pgLine2)] !bg-[var(--gt-card)] !text-[var(--gt-link)]" />
          </li>
        ))}
      </ol>
    </section>
  );
}
