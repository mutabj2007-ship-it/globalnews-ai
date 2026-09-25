'use client';

import type { JSX } from 'react';
import { ArrowRight } from 'lucide-react';
import { findCountryByIso3, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { useAccount } from '@/lib/hooks/useAccount';
import { useCountryFollows } from '@/components/home/useCountryFollows';
import { formatObservationalTime } from '@/lib/formatRelativeTime';

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

const CARD = 'rounded-2xl border border-border-strong bg-void/60 p-4';

export function HomeAccountPanel({ articles, language = 'en' }: HomeAccountPanelProps): JSX.Element | null {
  const t = getDictionary(language).betaHome;
  const { user, isLoading: accountLoading } = useAccount();
  const { follows, isLoading: followsLoading } = useCountryFollows();

  /* Nothing is known yet, so nothing is claimed. See the file note. */
  if (accountLoading) return null;

  if (user === null) {
    return (
      <section className={CARD}>
        <p className="text-sm leading-relaxed text-ink-primary">{t.firstVisit}</p>
        <a
          href="/auth/google"
          className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 motion-reduce:transition-none"
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
    <section aria-labelledby="beta-foryou-heading" className={CARD}>
      <h2 id="beta-foryou-heading" className="text-base font-semibold text-ink-primary">
        {t.forYouTitle}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-tertiary">{t.forYouNote}</p>

      {forYou.length === 0 ? (
        <p className="mt-3 text-sm text-ink-tertiary">{t.forYouEmpty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {forYou.map((article) => (
            <li key={article.id}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] flex-col gap-1 rounded-xl border border-border-strong bg-void/70 px-3 py-2 transition-colors hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
              >
                <span className="text-sm font-semibold leading-snug text-ink-primary">
                  {article.title}
                </span>
                <span className="text-xs text-ink-tertiary">
                  {article.sourceName}
                  <Elapsed article={article} language={language} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/*
        The follow list. Rendered once the read settles; `[]` is a real state —
        signed in, following nothing — and gets the invitation to manage rather
        than an invitation to sign in.
      */}
      {followsLoading ? null : (
        <div className="mt-4 border-t border-border-strong pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink-secondary">{t.followingTitle}</h3>
            <a
              href="/map"
              className="inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              {t.manageFollows}
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </a>
          </div>
          {follows === null || follows.length === 0 ? null : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {follows.map((iso3) => {
                const country = findCountryByIso3(iso3);
                const name =
                  country === undefined
                    ? iso3
                    : getCountryDisplayName(country.iso2, language, country.name);
                return (
                  <li
                    key={iso3}
                    className="rounded-full border border-border-strong bg-void/70 px-3 py-1 text-xs text-ink-secondary"
                  >
                    {name}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Basis-aware elapsed time, or nothing at all where the feed gives none. */
function Elapsed({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element | null {
  const elapsed = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
  if (elapsed === '') return null;
  return <>{' · '}{elapsed}</>;
}
