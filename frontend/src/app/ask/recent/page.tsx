import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { AskRecentClient } from '@/components/ask/AskRecentClient';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';

/**
 * ASK RECENT + SAVED CONTINUITY R1 — `/ask/recent`.
 *
 * NOINDEX, like `/ask` and `/history`: the page reads an account session and
 * renders one reader's own material, so it has nothing to offer a crawler.
 *
 * SIGNED-IN ONLY, AND THE SERVER IS THE AUTHORITY ON THAT. This page does not
 * pre-judge the session: `GET /ask-v2/threads` answers 401 to a signed-out reader
 * and the surface says so. Guessing here from a cookie's presence would let a
 * stale cookie render an empty list, which would tell a reader their
 * conversations are gone.
 */
export const metadata: Metadata = {
  title: 'Recent — Ask GlobalNews AI',
  robots: { index: false, follow: false },
};

export default function AskRecentPage(): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';

  return (
    <>
      <NavBar language={locale} />
      <AskRecentClient locale={locale} />
    </>
  );
}
