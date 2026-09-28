'use client';

import type { JSX } from 'react';
import { findCountryByIso3, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
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
 * - Source: the stories Home ALREADY loaded (`feed.latestUpdates`). No extra
 *   fetch, no AI. Signed in (D5): followed places first, from that same list.
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

export function WorldIn60Seconds({ items, language }: { items: readonly NewsArticle[]; language: LanguageCode }): JSX.Element | null {
  const dict = getDictionary(language);
  const t = dict.homeReva.w60;
  const categoryLabels = dict.map.categories;
  const { user, follows } = useHomeSession();
  const signedIn = user !== null;
  const ordered = orderFollowedFirst(items, signedIn ? follows : null).slice(0, 5);
  const [lead, ...rows] = ordered;
  if (lead === undefined) return null;
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
          <div className="relative">
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              data-home-w60-lead=""
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5]"
            >
              <StoryVisual
                article={lead}
                missingLabel={t.noImage}
                sizes="(min-width: 1024px) 340px, 100vw"
                className="block h-[120px] w-full overflow-hidden rounded-[10px] min-[380px]:h-[140px] min-[420px]:h-[156px] lg:h-[150px] gn-xl:h-[176px] [@container(min-width:520px)]:h-[190px]"
              />
              <span className="mt-2.5 block">
                <span className={`${CATEGORY_TEXT_BASE} ${CATEGORY_TEXT[lead.category] ?? CATEGORY_TEXT_FALLBACK}`}>
                  {categoryLabels[lead.category] ?? lead.category}
                </span>
                {leadAge === '' ? null : <span className="text-[11px] text-[#8299b4]"> · {leadAge}</span>}
              </span>
              <span className="mt-1 line-clamp-3 block text-[15px] font-bold leading-[1.3] text-white group-hover:text-[#bfe0ff] md:text-[16px]">
                {lead.title}
              </span>
              <span className="mt-1 block text-[12px] text-[#8299b4]">{lead.sourceName}</span>
            </a>
            <span className="absolute right-2 top-2 z-10">
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
                  <a
                    href={item.url}
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
