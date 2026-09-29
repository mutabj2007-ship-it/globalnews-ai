import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
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
 */
export const metadata: Metadata = {
  title: 'Saved — Ask GlobalNews AI',
  robots: { index: false, follow: false },
};

export default function SavedPage(): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';

  return (
    <>
      <NavBar language={locale} />
      <SavedClient locale={locale} />
    </>
  );
}
