'use client';

import type { JSX } from 'react';
import { ArrowRight } from 'lucide-react';
import { findCountryByIso3, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { useAccount } from '@/lib/hooks/useAccount';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { StoryVisual } from '@/components/home/StoryVisual';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * C7 · THE SIGNED-IN AND SIGNED-OUT RAIL CARD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA HOME CLOSURE R2 increment C7. R1 held these zones because the local
 * evidence environment had no backend and their states could not be exercised.
 * Alpha is that environment and both endpoints have now been verified against
 * it — `GET /api/users/me` and `GET /api/follows/countries` each return 401 for
 * a signed-out visitor, which is the correct answer and proves they are real.
 *
 * ── THE DEFECT THIS FIXES ────────────────────────────────────────────────
 *
 * The rail showed "Sign in to follow" to EVERY reader, including one already
 * signed in. R2 forbids that in terms. The sign-in invitation is now rendered
 * only when there is no session.
 *
 * ── WHY IT RENDERS NOTHING WHILE IT IS DECIDING ──────────────────────────
 *
 * Session state lives in an httpOnly cookie the browser will not show the
 * server, so Home cannot know on the server whether this reader is signed in.
 * The state resolves after mount, and there are only two ways to fill that gap:
 * assume signed out and show the sign-in card, or show nothing.
 *
 * Assuming signed out reproduces the exact defect being fixed — a signed-in
 * reader would see "Sign in to follow" flash on every single page load. So the
 * card holds its space and stays empty until `isLoading` clears. Nothing is
 * claimed about the reader until something is known about them.
 *
 * ── "FOR YOU" HAS NO BACKEND, AND IS NOT INVENTED ────────────────────────
 *
 * There is no personalised-feed endpoint in this product. Rather than claim
 * one, this derives the list from data already in hand: the stories the page
 * has ALREADY fetched, filtered to the countries this reader follows. So it
 * issues no request of its own, cannot spend provider quota, and cannot show a
 * story the page did not already have.
 *
 * THE CODE ALPHABETS DIFFER, AND THAT IS LOAD-BEARING. `useCountryFollows`
 * returns ISO-3, because the follows API is ISO-3 and validates against the
 * canonical list; `NewsArticle.countryCode` is ISO-2. The conversion goes
 * through `findCountryByIso3`, the one canonical crossing. A `slice(0, 2)`
 * here would silently mis-match countries whose codes do not share a prefix —
 * the hook's own file rules it out by name.
 *
 * ── FOLLOWING AND MANAGE ARE REAL ────────────────────────────────────────
 *
 * The chips are the reader's actual follow list from the API, named through the
 * existing localized `getCountryDisplayName` helper. "Manage" goes to `/map`,
 * which is where countries are genuinely followed and unfollowed — not to an
 * invented settings surface.
 *
 * `follows === null` and `follows === []` are DIFFERENT and are treated as
 * such: null means no list is available to this visitor, `[]` means signed in
 * and following nothing yet. Collapsing them would tell a signed-in reader to
 * sign in, which is the defect this increment exists to remove.
 */

interface HomeAccountPanelProps {
  /**
   * The stories the page already holds, from the one `getHomeFeed()` response.
   * Passed in rather than fetched: this component must not add a request.
   */
  articles: NewsArticle[];
  language?: LanguageCode;
}

/*
  ── THE PERSONALIZATION BAND ────────────────────────────────────────────

  Final correction: "replace the giant empty slab with a compact premium
  personalization band ... signed-out users must not see a huge empty
  personalized panel."

  The DATA in this file was already honest — For you is the governed Home feed
  filtered to the countries this reader actually follows, and the chips are the
  real follow list. What was wrong was the PRESENTATION: one full-width slab at
  the same weight whether it held three stories or a single sentence, which
  made the signed-out state a large empty box.

  So there are now two shapes, not one:

    signed out -> a single compact row. One sentence, one button, ~76px. It
                  makes no personalized claim and reserves no personalized
                  space, because there is nothing personal to show.
    signed in  -> a two-column band: For you on the left with up to three
                  IMAGE-BACKED stories, Following on the right as compact chips
                  with Manage. It stacks on phone.

  Still true, and still structural: nothing here is fabricated. A signed-in
  reader following nothing gets the invitation to manage rather than invented
  stories, and `follows === null` (not read yet) stays distinct from `[]`.
*/
const BAND =
  'rounded-[14px] border border-[#122a45] bg-[linear-gradient(135deg,#0a1b30_0%,#071528_46%,#040e1c_100%)] ' +
  'shadow-[inset_0_1px_0_rgba(148,197,255,0.12),0_22px_52px_-26px_rgba(0,0,0,0.95)]';

export function HomeAccountPanel({ articles, language = 'en' }: HomeAccountPanelProps): JSX.Element | null {
  const t = getDictionary(language).betaHome;
  const { user, isLoading: accountLoading } = useAccount();
  const { follows, isLoading: followsLoading } = useCountryFollows();

  /* Nothing is known yet, so nothing is claimed. See the file note. */
  if (accountLoading) return null;

  if (user === null) {
    return (
      /* Compact by construction: one row, no reserved personalized area. */
      <section className={`${BAND} flex flex-col gap-3 px-[18px] py-[15px] sm:flex-row sm:items-center sm:justify-between sm:gap-6`}>
        <p className="text-[13.5px] leading-relaxed text-[#c2d3e6]">{t.firstVisit}</p>
        {/*
          HOME CLICK CONTRACT R1 — the bare `/auth/google` path is not served by
          this origin (Alpha returned 404); the first-party OAuth entry is
          `/api/auth/google`, built by the same helper every other sign-in uses,
          returning the reader to Home.
        */}
        <a
          href={accountSignInUrl('/')}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(180deg,#2f7df5_0%,#1d5fd0_100%)] px-5 text-[13.5px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 motion-reduce:transition-none"
        >
          {t.signInToFollow}
        </a>
      </section>
    );
  }

  /*
    Signed in. ISO-3 from the API, converted once through the canonical helper
    so the ISO-2 the feed carries can be compared against it.
  */
  const followedIso2 = new Set(
    (follows ?? [])
      .map((iso3) => findCountryByIso3(iso3)?.iso2)
      .filter((iso2): iso2 is string => iso2 !== undefined),
  );

  const forYou = articles
    .filter((article) => article.countryCode !== undefined && followedIso2.has(article.countryCode))
    .slice(0, 3);

  return (
    <section aria-labelledby="beta-foryou-heading" className={`${BAND} p-[18px]`}>
      <div className="grid grid-cols-1 gap-x-7 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        {/* ── FOR YOU ─────────────────────────────────────────────────── */}
        <div className="min-w-0">
          <h2 id="beta-foryou-heading" className="text-[15px] font-bold text-white">
            {t.forYouTitle}
          </h2>
          <p className="mt-[3px] text-[11.5px] leading-relaxed text-[#8ca3bd]">{t.forYouNote}</p>

          {forYou.length === 0 ? (
            /* Signed in, following nothing yet. No invented stories. */
            <p className="mt-3 text-[13px] text-[#8ca3bd]">{t.forYouEmpty}</p>
          ) : (
            <ul className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {forYou.map((article) => (
                <li key={article.id}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full min-h-[44px] flex-col overflow-hidden rounded-[10px] border border-[#122a45] bg-[#061424] transition-[transform,border-color] duration-200 hover:-translate-y-[2px] hover:border-[#2a5a8c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    {/*
                      IMAGE-BACKED, as ruled — through the same `StoryVisual`
                      the story cards use, so a story with no publisher image
                      falls back to its category's artwork rather than to a
                      blank or a generic placeholder. No photograph is invented.
                    */}
                    <StoryVisual
                      article={article}
                      className="aspect-[16/9]"
                      missingLabel={t.imageUnavailable}
                      sizes="(min-width: 1024px) 200px, 45vw"
                    />
                    <span className="flex flex-1 flex-col gap-1 p-2.5">
                      <span className="line-clamp-2 text-[12.5px] font-semibold leading-[1.3] text-white">
                        {article.title}
                      </span>
                      <span className="mt-auto text-[11px] text-[#8299b4]">
                        {article.sourceName}
                        <Elapsed article={article} language={language} />
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── FOLLOWING ───────────────────────────────────────────────── */}
        {followsLoading ? null : (
          <div className="min-w-0 border-t border-[#122a45] pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13.5px] font-bold text-white">{t.followingTitle}</h3>
              <a
                href="/map"
                className="inline-flex min-h-[44px] items-center gap-1 text-[12.5px] font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 lg:min-h-[28px]"
              >
                {t.manageFollows}
                <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
              </a>
            </div>
            {follows === null || follows.length === 0 ? null : (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {follows.map((iso3) => {
                  const country = findCountryByIso3(iso3);
                  const name =
                    country === undefined
                      ? iso3
                      : getCountryDisplayName(country.iso2, language, country.name);
                  return (
                    <li
                      key={iso3}
                      className="rounded-full border border-[#1b3a5c] bg-[#0a1e33] px-3 py-1 text-[12px] text-[#c2d3e6]"
                    >
                      {name}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Basis-aware elapsed time, or nothing at all where the feed gives none. */
function Elapsed({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element | null {
  const elapsed = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
  if (elapsed === '') return null;
  return <>{' · '}{elapsed}</>;
}
