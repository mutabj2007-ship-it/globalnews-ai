import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { MapPageClient } from '@/components/map/MapPageClient';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * Milestone #49 (World Map EN/PL integration) — Next.js's static
 * `metadata` export cannot read cookies (it has no request context at
 * all); only the async `generateMetadata()` function can. This is the
 * established, safe mechanism for language-aware metadata without a
 * parallel i18n system — it reuses the exact same cookie/dictionary
 * architecture as the rest of the page, just through the one API
 * surface Next.js actually provides for this.
 */
export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language).map;

  return {
    title: t.metaTitle,
    description: t.metaDescription,
  };
}

/**
 * Milestone #49 — mirrors the homepage's own cookie-based language
 * resolution (frontend/src/app/page.tsx) exactly: reads the SAME
 * cookie persistLanguageSelection() writes, validates against the SAME
 * ACTIVE_LANGUAGES set, and always resolves to a concrete 'en'/'pl' —
 * never `undefined` — matching the Milestone #48 Blocker 1 fix that
 * closed the equivalent gap on the homepage feed. No second language
 * persistence mechanism is introduced.
 */
export default function MapPage(): JSX.Element {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';

  return (
    <>
      <NavBar language={language} />
      <main className="min-h-screen bg-void">
        <MapPageClient language={language} />
      </main>
      <Footer language={language} />
    </>
  );
}
