'use client';

import type { JSX } from 'react';
import { findCountryByIso3, type LanguageCode, type NewsArticle, safeExternalHref } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { StoryVisual } from '@/components/home/StoryVisual';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';
import { CATEGORY_TEXT, CATEGORY_TEXT_BASE, CATEGORY_TEXT_FALLBACK } from '@/components/home/homePresentation';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { useHomeSession } from './HomeSession';

/**
 * HOME REV A — YOUR WORLD IN 60 SECONDS, IMAGE-LED ON EVERY DEVICE (REQUIRED).
 *
 * Authority: W60_MEDIA_SPEC.md, CTO §7.
 * - Source: the stories Home ALREADY loaded — `feed.latestUpdates` minus every
 *   What's happening now story (allocateWorldIn60, HOME R2 DEDUP R1). Rev A's
 *   caller had drifted to the whole merged Home pool, which put the same stories
 *   on both sides. No extra fetch, no AI. Signed in (D5): followed places first,
 *   from that same list. Up to five; FEWER when fewer distinct stories remain,
 *   never padded. Empty: a one-line truthful note (`showEmptyState`) so the
 *   right rail is not a silent blank beside a full What's happening now.
 * - Lead: the story's REAL image in a fixed box, or the governed "No image"
 *   fallback in the same box (StoryVisual) — never stock or generated imagery.
 *   Heights: 1920 → 176 · 1440/1280 → 150 · in flow on tablet → 190 (lead
 *   left, list right) · 430 → 156 · 390 → 140 · 360 → 120.
 * - Below the image: category (accent) · age, headline (3 lines), source;
 *   the 44 px bookmark sits at the image's top-right as a SIBLING of the link.
 * - Secondary rows: 4 (desktop/tablet) or 2 (phone) — number, 2-line headline,
 *   source · age, 44 px bookmark.
 *
 * The component is its own size container: narrower than 520 px it stacks
 * (the right rail, phones); wider it goes two-column (in flow on tablet/desktop).
 */
export function orderFollowedFirst(items: readonly NewsArticle[], followsIso3: readonly string[] | null): NewsArticle[] {
  if (followsIso3 === null || followsIso3.length === 0) return [...items];
  const followed = new Set(
    followsIso3.map((iso3) => findCountryByIso3(iso3)?.iso2).filter((iso2): iso2 is string => iso2 !== undefined),
  );
  const first = items.filter((a) => a.countryCode !== undefined && followed.has(a.countryCode));
  const rest = items.filter((a) => !(a.countryCode !== undefined && followed.has(a.countryCode)));
  return [...first, ...rest];
}

export function WorldIn60Seconds({
  items,
  language,
  showEmptyState = false,
}: {
  items: readonly NewsArticle[];
  language: LanguageCode;
  /** True when What's happening now holds stories, so "all of them are there" is a true statement. */
  showEmptyState?: boolean;
}): JSX.Element | null {
  const dict = getDictionary(language);
  const t = dict.homeReva.w60;
  const categoryLabels = dict.map.categories;
  const { user, follows } = useHomeSession();
  const signedIn = user !== null;
  const ordered = orderFollowedFirst(items, signedIn ? follows : null).slice(0, 5);
  const [lead, ...rows] = ordered;
  if (lead === undefined) {
    if (!showEmptyState) return null;
    return (
      <section
        aria-labelledby="home-w60-heading"
        data-home-w60=""
        data-home-w60-empty=""
        className="rounded-[14px] border border-[#122a45] bg-[#061527] p-4 md:p-[18px]"
      >
        <h2 id="home-w60-heading" className="text-[18px] font-bold leading-tight text-white">
          {t.title}
        </h2>
        <p className="mt-1 text-[12.5px] text-[#8ca3bd]">{t.empty}</p>
      </section>
    );
  }
  const leadAge = formatObservationalTime(lead.publishedAt, lead.publishedAtBasis, language);

  return (
    <section
      aria-labelledby="home-w60-heading"
      data-home-w60=""
      className="rounded-[14px] border border-[#122a45] bg-[#061527] p-4 [container-type:inline-size] md:p-[18px]"
    >
      <h2 id="home-w60-heading" className="text-[18px] font-bold leading-tight text-white">
        {t.title}
      </h2>
      <p className="mt-1 text-[12.5px] text-[#8ca3bd]">{signedIn && follows !== null && follows.length > 0 ? t.noteSigned : t.note}</p>

      <div className="mt-3 flex flex-col gap-3 [@container(min-width:520px)]:grid [@container(min-width:520px)]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] [@container(min-width:520px)]:gap-5">
        <div className="min-w-0">
          {/*
            DENSITY / 60-SECONDS CORRECTION R2 — the lead image is NEVER reduced;
            where versions differed, the TALLER one wins:
              phone (<700 content)   full-bleed 16/9 — the pre-Rev-A phone brief
                                     (≈201 px at 390; Rev A was 140)
              tablet (700–999)       two-column, 190 px (unchanged)
              1000–1139 content      two-column, 240 px
              right rail (≥1140)     full-bleed 16/9 (≈203 px at 360, ≈236 at 420;
                                     pre-Rev-A rail was 22/10 ≈167, Rev A 150/176)
          */}
          <div className="relative [@container_home-content_(max-width:699.98px)]:-mx-4 [@container_home-content_(min-width:1140px)]:-mx-[18px]">
            <a
              href={safeExternalHref(lead.url)}
              target="_blank"
              rel="noopener noreferrer"
              data-home-w60-lead=""
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5]"
            >
              <StoryVisual
                article={lead}
                missingLabel={t.noImage}
                sizes="(min-width: 1024px) 440px, 100vw"
                className="block aspect-[16/9] w-full overflow-hidden rounded-[10px] [@container_home-content_(max-width:699.98px)]:rounded-none [@container_home-content_(min-width:700px)_and_(max-width:999.98px)]:aspect-auto [@container_home-content_(min-width:700px)_and_(max-width:999.98px)]:h-[190px] [@container_home-content_(min-width:1000px)_and_(max-width:1139.98px)]:aspect-auto [@container_home-content_(min-width:1000px)_and_(max-width:1139.98px)]:h-[240px] [@container_home-content_(min-width:1140px)]:rounded-none"
              />
              <span className="mt-2.5 block [@container_home-content_(max-width:699.98px)]:px-4 [@container_home-content_(min-width:1140px)]:px-[18px]">
                <span className={`${CATEGORY_TEXT_BASE} ${CATEGORY_TEXT[lead.category] ?? CATEGORY_TEXT_FALLBACK}`}>
                  {categoryLabels[lead.category] ?? lead.category}
                </span>
                {leadAge === '' ? null : <span className="text-[11px] text-[#8299b4]"> · {leadAge}</span>}
              </span>
              <span className="mt-1 line-clamp-3 block text-[16px] font-bold leading-[1.3] text-white group-hover:text-[#bfe0ff] [@container_home-content_(max-width:699.98px)]:px-4 [@container_home-content_(min-width:1140px)]:px-[18px] [@container_home-content_(min-width:1140px)]:text-[17px]">
                {lead.title}
              </span>
              {lead.summary !== undefined && lead.summary !== '' ? (
                /* The pre-Rev-A rail brief carried two lines of the lead's own summary; restored in the rail only. */
                <span data-home-w60-summary="" className="mt-1.5 hidden text-[12.5px] leading-[1.45] text-[#93a9c2] [@container_home-content_(min-width:1140px)]:line-clamp-2 [@container_home-content_(min-width:1140px)]:px-[18px]">
                  {lead.summary}
                </span>
              ) : null}
              <span className="mt-1 block text-[12px] text-[#8299b4] [@container_home-content_(max-width:699.98px)]:px-4 [@container_home-content_(min-width:1140px)]:px-[18px]">{lead.sourceName}</span>
            </a>
            <span className="absolute right-2 top-2 z-10 [@container_home-content_(max-width:699.98px)]:right-[24px] [@container_home-content_(min-width:1140px)]:right-[26px]">
              <StoryBookmark url={lead.url} language={language} />
            </span>
          </div>
        </div>

        {rows.length === 0 ? null : (
          <ol className="min-w-0 border-t border-[#0d2137] [@container(min-width:520px)]:border-t-0" start={2}>
            {rows.slice(0, 4).map((item, index) => {
              const age = formatObservationalTime(item.publishedAt, item.publishedAtBasis, language);
              return (
                <li
                  key={item.id}
                  data-home-w60-row=""
                  className={`flex items-center gap-2 border-b border-[#0d2137] py-2 last:border-b-0 ${index >= 2 ? 'hidden md:flex' : ''}`}
                >
                  <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono text-[11px] text-[#56708e]">
                    {index + 2}
                  </span>
                  {/*
                    DENSITY R1 ADDENDUM — a small real thumbnail ONLY where the content
                    column is ≥1000 px (1280+ desktop: the rail, or the wide in-flow
                    list). Phone, 768 portrait and 1024 keep the compact text row, so
                    no text is shrunk to make room. The image is the story's own
                    (StoryVisual: real image or the governed "No image" box), from
                    the Home feed object already loaded — no request is added.
                  */}
                  <a
                    href={safeExternalHref(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={-1}
                    aria-hidden="true"
                    data-home-w60-thumb=""
                    className="block h-[54px] w-[72px] shrink-0 overflow-hidden rounded-[8px] [@container_home-content_(max-width:999.98px)]:hidden"
                  >
                    <StoryVisual
                      article={item}
                      missingLabel={t.noImage}
                      sizes="72px"
                      className="h-full"
                    />
                  </a>
                  <a
                    href={safeExternalHref(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] min-w-0 flex-1 flex-col justify-center gap-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5]"
                  >
                    <span className="line-clamp-2 text-[13.5px] font-semibold leading-[1.3] text-white hover:text-[#bfe0ff]">{item.title}</span>
                    <span className="truncate text-[11.5px] text-[#8299b4]">
                      {item.sourceName}
                      {age === '' ? null : ` · ${age}`}
                    </span>
                  </a>
                  <StoryBookmark url={item.url} language={language} className="shrink-0" />
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
