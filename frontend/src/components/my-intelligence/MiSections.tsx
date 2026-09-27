'use client';

import Link from 'next/link';
import type { LanguageCode } from '@globalnews-ai/shared';
import { findCountryByIso3 } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import {
  MI_ASK_SURFACE,
  MI_CARD,
  MI_CHIP,
  MI_FOLLOW_ON,
  MI_PILL,
  MI_RAIL,
  MI_TARGET,
} from './miPresentation';
import { fill } from './MiPrimitives';
import { NewSinceRow, SavedCard, SavedRow } from './MiStoryViews';
import type { FixtureStory } from './devFixtures';
import type { RecentQuestion } from './useMyIntelligenceData';

interface StoryHandlers {
  language: LanguageCode;
  savedRefs: ReadonlySet<string>;
  onToggleSaved: (url: string) => void;
  selecting: boolean;
  selectedUrls: ReadonlySet<string>;
  onToggleSelected: (url: string) => void;
}

function Section({
  title,
  surface,
  action,
  children,
  id,
}: {
  title: string;
  surface: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}): JSX.Element {
  return (
    <section id={id} className={`${surface} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold leading-[1.2] text-white sm:text-[19px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * NEW SINCE YOUR PREVIOUS VISIT.
 *
 * Three distinct states, and conflating any two of them would be a lie:
 *   first visit  — there is no boundary yet, so NOTHING is marked new.
 *   unavailable  — the boundary check failed; we say so and keep the rest.
 *   empty        — the boundary exists and nothing crossed it, which INCLUDES
 *                  the case where every candidate lacks an observation time.
 */
export function NewSinceSection({
  stories,
  count,
  boundary,
  isFirstVisit,
  failed,
  handlers,
}: {
  stories: readonly FixtureStory[];
  count: number;
  boundary: string | null;
  isFirstVisit: boolean;
  failed: boolean;
  handlers: StoryHandlers;
}): JSX.Element {
  const { language } = handlers;
  const t = getDictionary(language).myIntelligence;

  return (
    <Section
      id="mi-new-since"
      title={t.newSince.title}
      surface={MI_CARD}
      action={
        count > 0 ? (
          <span className="text-[12.5px] font-semibold text-[#5abff5]">
            {fill(t.newSince.countLabel, { count })}
          </span>
        ) : undefined
      }
    >
      {failed ? (
        <p className="mt-2 text-[13px] leading-[1.55] text-[#ffcf7d]">{t.newSince.unavailable}</p>
      ) : isFirstVisit || boundary === null ? (
        <p className="mt-2 text-[13px] leading-[1.55] text-[#93a7bd]">{t.newSince.firstVisit}</p>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-[1.55] text-[#93a7bd]">
            {fill(t.newSince.explainer, {
              date: new Date(boundary).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </p>
          {stories.length === 0 ? (
            <p className="mt-3 text-[13px] leading-[1.55] text-[#7d92aa]">{t.newSince.empty}</p>
          ) : (
            <ul className="mt-2">
              {stories.map((story) => (
                <NewSinceRow
                  key={story.id}
                  story={story}
                  language={language}
                  isSaved={handlers.savedRefs.has(story.url) || handlers.savedRefs.has(story.url.replace(/\/$/, ''))}
                  onToggleSaved={() => handlers.onToggleSaved(story.url)}
                  selecting={handlers.selecting}
                  isSelected={handlers.selectedUrls.has(story.url)}
                  onToggleSelected={() => handlers.onToggleSelected(story.url)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}

export function SavedSection({
  stories,
  totalCount,
  categories,
  activeCategory,
  onCategory,
  handlers,
}: {
  stories: readonly FixtureStory[];
  totalCount: number;
  categories: readonly string[];
  activeCategory: string;
  onCategory: (category: string) => void;
  handlers: StoryHandlers;
}): JSX.Element {
  const { language } = handlers;
  const t = getDictionary(language).myIntelligence;

  return (
    <Section
      id="mi-saved"
      title={t.saved.title}
      surface={MI_RAIL}
      action={
        totalCount > 0 ? (
          <span className="text-[12.5px] font-semibold text-[#5abff5]">
            {fill(t.saved.viewAll, { count: totalCount })}
          </span>
        ) : undefined
      }
    >
      {totalCount === 0 ? (
        <p className="mt-2 text-[13px] leading-[1.55] text-[#93a7bd]">{t.saved.empty}</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {[t.saved.filterAll, ...categories].map((category) => (
              <li key={category}>
                <button
                  type="button"
                  onClick={() => onCategory(category)}
                  aria-pressed={activeCategory === category}
                  className={`${MI_CHIP} ${MI_TARGET} inline-flex min-h-[32px] items-center border px-2.5 text-[12px] font-semibold ${
                    activeCategory === category
                      ? 'border-[#1b6fa8] bg-[#07304f] text-[#93cdf5]'
                      : 'border-[#1d3a5a] text-[#9fb4cb]'
                  }`}
                >
                  {category}
                </button>
              </li>
            ))}
          </ul>
          {/* Local filtering. No AI, and no commercial framing of that fact. */}
          <p className="mt-1.5 text-[11.5px] text-[#7d92aa]">{t.saved.filterNote}</p>

          <ul className="mt-3 md:hidden">
            {stories.map((story) => (
              <SavedRow
                key={story.id}
                story={story}
                language={language}
                isSaved={handlers.savedRefs.has(story.url)}
                onToggleSaved={() => handlers.onToggleSaved(story.url)}
                selecting={handlers.selecting}
                isSelected={handlers.selectedUrls.has(story.url)}
                onToggleSelected={() => handlers.onToggleSelected(story.url)}
              />
            ))}
          </ul>
          <ul className="mt-3 hidden gap-3 md:grid md:grid-cols-2 min-[1700px]:grid-cols-3">
            {stories.map((story) => (
              <SavedCard
                key={story.id}
                story={story}
                language={language}
                isSaved={handlers.savedRefs.has(story.url)}
                onToggleSaved={() => handlers.onToggleSaved(story.url)}
                selecting={handlers.selecting}
                isSelected={handlers.selectedUrls.has(story.url)}
                onToggleSelected={() => handlers.onToggleSelected(story.url)}
              />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

export function ForYouSection({
  stories,
  handlers,
}: {
  stories: readonly FixtureStory[];
  handlers: StoryHandlers;
}): JSX.Element {
  const { language } = handlers;
  const t = getDictionary(language).myIntelligence;

  return (
    <Section id="mi-for-you" title={t.forYou.title} surface={MI_RAIL}>
      {/* Separates this from New since: recommendation, not a change claim. */}
      <p className="mt-2 text-[12.5px] leading-[1.5] text-[#93a7bd]">{t.forYou.note}</p>
      {stories.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#7d92aa]">{t.forYou.empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2 min-[1700px]:grid-cols-3">
          {stories.map((story) => {
            const country = findCountryByIso3(story.countryCode);
            const name =
              country === undefined
                ? story.countryCode
                : getCountryDisplayName(country.iso2, language, country.name);
            return (
              <SavedCard
                key={story.id}
                story={story}
                language={language}
                reason={fill(t.forYou.reason, { country: name })}
                isSaved={handlers.savedRefs.has(story.url)}
                onToggleSaved={() => handlers.onToggleSaved(story.url)}
                selecting={handlers.selecting}
                isSelected={handlers.selectedUrls.has(story.url)}
                onToggleSelected={() => handlers.onToggleSelected(story.url)}
              />
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/**
 * FOLLOWING.
 *
 * The toggle is ordinary personalisation, in the World-chip tone. It is NOT
 * mint and it carries no run record, no cadence and no state chip, because
 * Part IV separates Follow from Watch on exactly those four axes and they must
 * never read as two variants of one control.
 *
 * The dormant Watch line is always present, and says plainly that Following
 * sends no notifications. There is no push handler in this product, and
 * absence must not be dressed up as a feature that already works.
 */
export function FollowingSection({
  follows,
  newByCountry,
  language,
}: {
  follows: readonly string[] | null;
  newByCountry: Readonly<Record<string, number>>;
  language: LanguageCode;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence;

  return (
    <Section
      id="mi-following"
      title={t.following.title}
      surface={MI_RAIL}
      action={
        <Link href="/map" className="text-[12.5px] font-semibold text-[#5abff5]">
          {t.following.manage}
        </Link>
      }
    >
      {follows === null || follows.length === 0 ? (
        <p className="mt-2 text-[13px] text-[#93a7bd]">{t.following.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {follows.map((iso3) => {
            const country = findCountryByIso3(iso3);
            const name =
              country === undefined ? iso3 : getCountryDisplayName(country.iso2, language, country.name);
            const count = newByCountry[country?.iso2 ?? iso3] ?? 0;

            return (
              <li
                key={iso3}
                className="flex items-center justify-between gap-3 border-b border-[#0a2744] py-2.5 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-[#e4eefb]">{name}</span>
                  <span className="block text-[12px] text-[#7d92aa]">
                    {count > 0 ? fill(t.following.newSince, { count }) : t.following.nothingNew}
                  </span>
                </span>
                <span
                  className={`${MI_PILL} ${MI_FOLLOW_ON} inline-flex h-[40px] min-w-[112px] items-center justify-center gap-1.5 px-3 text-[12.5px] font-semibold`}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                  {t.following.following}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 flex items-start gap-2 rounded-[10px] border border-dashed border-[#2b3f56] px-3 py-2.5 text-[12px] leading-[1.45] text-[#7d92aa]">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-[1px] h-[14px] w-[14px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M3 3l18 18M10.6 5.3A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.2 3.4M6.2 7.4C4 9 3 11.2 3 12c0 2.5 4 7 9 7a9.3 9.3 0 0 0 3.6-.7" />
        </svg>
        <span>{t.following.watchDormant}</span>
      </p>
    </Section>
  );
}

/**
 * RECENT INTELLIGENCE.
 *
 * Questions only — never stored answers, which would be stale and would read
 * as current intelligence. On the current release this section is EXPECTED to
 * be empty: `POST /history` exists but nothing in the product calls it, so
 * there is nothing to list. That is the truth of the release and the frozen
 * design draws it deliberately rather than papering over it.
 */
export function RecentSection({
  questions,
  language,
}: {
  questions: readonly RecentQuestion[];
  language: LanguageCode;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence;

  return (
    <Section
      id="mi-recent"
      title={t.recent.title}
      surface={MI_ASK_SURFACE}
      action={
        <Link href="/history" className="text-[12.5px] font-semibold text-[#5abff5]">
          {t.recent.questionHistory}
        </Link>
      }
    >
      <p className="mt-2 text-[12.5px] leading-[1.5] text-[#93a7bd]">{t.recent.note}</p>
      {questions.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#7d92aa]">{t.recent.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {questions.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 border-b border-[#0a2744] py-2.5 last:border-b-0"
            >
              <span className="flex min-w-0 items-start gap-2">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-[3px] h-[15px] w-[15px] shrink-0 text-[#a78bfa]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />
                </svg>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-[1.35] text-[#e4eefb]">
                    {entry.query}
                  </span>
                  <span className="block text-[12px] text-[#7d92aa]">
                    {fill(t.recent.askedOn, { date: formatRelativeTime(entry.createdAt, language) })}
                  </span>
                </span>
              </span>
              {/* `/ask?q=` STAGES a draft. It does not run. The commit is Send, inside Ask. */}
              <Link
                href={`/ask?q=${encodeURIComponent(entry.query)}`}
                className={`${MI_PILL} ${MI_TARGET} inline-flex h-[40px] shrink-0 items-center border border-[#1d3a5a] px-3 text-[12.5px] font-semibold text-[#cfe2f2]`}
              >
                {t.recent.askAgain}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * The signed-out card.
 *
 * `returnTo` is exactly `/my-intelligence`, with no query and no fragment: the
 * backend validator accepts only exact governed destinations and rejects `?`
 * and `#` outright, and R1.2 rules that the validator is not loosened. The
 * sub-view a reader was on is therefore not preserved across sign-in, and the
 * copy does not promise that it is.
 */
export function AuthRequiredCard({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).myIntelligence.states;

  return (
    <section className={`${MI_CARD} mx-auto max-w-[520px] p-6 text-center`}>
      <h1 className="text-[20px] font-bold text-white">{t.signedOutTitle}</h1>
      <p className="mt-2 text-[13.5px] leading-[1.55] text-[#93a7bd]">{t.signedOutBody}</p>
      <a
        href={accountSignInUrl('/my-intelligence')}
        className={`${MI_PILL} ${MI_TARGET} mt-4 inline-flex h-[44px] items-center border border-[#1b6fa8] bg-[#07304f] px-5 text-[14px] font-bold text-[#93cdf5]`}
      >
        {t.signedOutAction}
      </a>
      <p className="mt-2.5 text-[12px] text-[#7d92aa]">{t.signedOutReturn}</p>
    </section>
  );
}
