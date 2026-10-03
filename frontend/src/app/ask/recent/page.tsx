import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { AskClearedBoundary } from '@/components/ask-nav/AskClearedBoundary';
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
 *
 * STANDALONE CONTINUITY SHELL CLOSURE — the standalone Ask navigation, never the
 * platform NavBar: the same AskNavProvider + AskNavShell as `/` and `/ask` (62px bar
 * on desktop), plus AskContinuityHeader for the phone/768-portrait 56px header whose
 * trigger opens the same drawer. The list below it scrolls normally.
 */
export const metadata: Metadata = {
  title: 'Recent — Ask GlobalNews AI',
  robots: { index: false, follow: false },
};

export default function AskRecentPage(): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';

  return (
    <AskThemedSurface theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
      <AskNavProvider>
        <AskNavShell language={locale} />
        <AskContinuityHeader locale={locale} surface="recent" />
        <AskClearedBoundary>
          <AskRecentClient locale={locale} />
        </AskClearedBoundary>
      </AskNavProvider>
    </AskThemedSurface>
  );
}
