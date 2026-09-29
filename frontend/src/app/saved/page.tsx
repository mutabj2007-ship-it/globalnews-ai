import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { AskClearedBoundary } from '@/components/ask-nav/AskClearedBoundary';
import { SavedClient } from '@/components/ask/SavedClient';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';

/**
 * ASK RECENT + SAVED CONTINUITY R1 — `/saved`.
 *
 * Standalone Ask: saved QUESTIONS only. Saved Stories remain where they are, in My
 * Intelligence, untouched and unexposed here, per the Product Owner's standalone
 * ruling.
 *
 * NOINDEX and signed-in only, for the same reasons as `/ask/recent`: the server
 * answers 401 and the surface reports it, rather than this page inferring a session.
 *
 * STANDALONE CONTINUITY SHELL CLOSURE — the standalone Ask navigation, never the
 * platform NavBar: the same AskNavProvider + AskNavShell as `/` and `/ask` (62px bar
 * on desktop), plus AskContinuityHeader for the phone/768-portrait 56px header whose
 * trigger opens the same drawer. The list below it scrolls normally.
 */
export const metadata: Metadata = {
  title: 'Saved — Ask GlobalNews AI',
  robots: { index: false, follow: false },
};

export default function SavedPage(): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';

  return (
    <AskNavProvider>
      <AskNavShell language={locale} />
      <AskContinuityHeader locale={locale} surface="saved" />
      <AskClearedBoundary>
        <SavedClient locale={locale} />
      </AskClearedBoundary>
    </AskNavProvider>
  );
}
