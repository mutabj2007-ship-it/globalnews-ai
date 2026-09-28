'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { findCountryByIso3, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { StoryVisual } from '@/components/home/StoryVisual';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';
import { useHomeSession } from './HomeSession';

/**
 * HOME REV A — FOR YOU + FOLLOWING (CTO §11, signed in only).
 *
 * The SAME rule Home already had (HomeAccountPanel): Home's own loaded
 * reporting matched to the reader's followed places, with the existing Follow
 * list, "Manage" and "Open My Intelligence". Per §11 this deliberately does
 * NOT copy My Intelligence's interest-aware For you — Home keeps to the data
 * Home governs until the CTO issues a convergence ruling.
 *
 * Anonymous readers get nothing here: the bridge's "Make GlobalNewsAI yours"
 * band is the single, compact invitation (no giant empty panel).
 */
export function HomeForYou({ articles, language }: { articles: readonly NewsArticle[]; language: LanguageCode }): JSX.Element | null {
  const dict = getDictionary(language);
  const t = dict.betaHome;
  const { user, isLoading, follows } = useHomeSession();
  if (isLoading || user === null) return null;

  const followedIso2 = new Set(
    (follows ?? []).map((iso3) => findCountryByIso3(iso3)?.iso2).filter((iso2): iso2 is string => iso2 !== undefined),
  );
  const seen = new Set<string>();
  const forYou = articles
    .filter((article) => {
      if (seen.has(article.id)) return false;
      seen.add(article.id);
      return article.countryCode !== undefined && followedIso2.has(article.countryCode);
    })
    .slice(0, 3);

  return (
    <section aria-labelledby="home-foryou-heading" data-home-for-you="" className="rounded-[14px] border border-[#122a45] bg-[#061527] p-4 md:p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 id="home-foryou-heading" className="text-[18px] font-bold text-white">
            {t.forYouTitle}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#8ca3bd]">{t.forYouNote}</p>
        </div>
        <Link href="/my-intelligence" className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-[#5abff5] hover:text-[#8fd3ff]">
          {dict.homeReva.bridge.open}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
        {forYou.length === 0 ? (
          <p className="text-[13px] text-[#8ca3bd]">{t.forYouEmpty}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {forYou.map((article) => {
              const age = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
              return (
                <li key={article.id} className="relative flex items-center gap-3 rounded-[10px] border border-[#122a45] bg-[#07182c] p-2 md:block md:p-0">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] md:block"
                  >
                    <StoryVisual
                      article={article}
                      missingLabel={t.imageUnavailable}
                      sizes="(min-width: 768px) 220px, 76px"
                      className="block h-[58px] w-[76px] shrink-0 overflow-hidden rounded-[8px] md:aspect-[16/9] md:h-auto md:w-full md:rounded-b-none"
                    />
                    <span className="flex min-w-0 flex-col gap-1 md:p-2.5 md:pr-12">
                      <span className="line-clamp-2 text-[13px] font-semibold leading-[1.3] text-white">{article.title}</span>
                      <span className="truncate text-[11.5px] text-[#8299b4]">
                        {article.sourceName}
                        {age === '' ? null : ` · ${age}`}
                      </span>
                    </span>
                  </a>
                  <StoryBookmark url={article.url} language={language} className="shrink-0 md:absolute md:bottom-2 md:right-2" />
                </li>
              );
            })}
          </ul>
        )}

        <div className="min-w-0 border-t border-[#122a45] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#8ca3bd]">{t.followingTitle}</h3>
            <a href="/map" className="inline-flex min-h-[44px] items-center gap-1 text-[12.5px] font-semibold text-[#5abff5] hover:text-[#8fd3ff] lg:min-h-[28px]">
              {t.manageFollows}
            </a>
          </div>
          {follows === null || follows.length === 0 ? null : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {follows.map((iso3) => {
                const country = findCountryByIso3(iso3);
                const name = country === undefined ? iso3 : getCountryDisplayName(country.iso2, language, country.name);
                return (
                  <li key={iso3} className="rounded-full border border-[#1b3a5c] bg-[#0a1e33] px-3 py-1 text-[12px] text-[#c2d3e6]">
                    {name}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
