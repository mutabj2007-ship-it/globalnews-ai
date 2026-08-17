import { cookies } from 'next/headers';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';

/**
 * B2 — Public Legal Surfaces. Mirrors the homepage's own server-side
 * language resolution exactly (cookies().get(LANGUAGE_COOKIE_NAME) +
 * isActiveLanguageCode(), defaulting to 'en' — see app/page.tsx) so
 * this page respects the same stored language preference NavBar/
 * Footer already use elsewhere, without introducing any new
 * resolution mechanism. A plain server component — no client
 * interactivity is needed for static legal content, so no 'use
 * client' directive (unlike /history, which needs one for its own
 * account-fetching behavior).
 */
export default async function PrivacyPage(): Promise<JSX.Element> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language).privacyPage;

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <NavBar language={language} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
        <h1 className="text-2xl font-semibold text-ink-primary sm:text-3xl">{t.title}</h1>
        <p className="mt-2 font-mono text-xs text-ink-tertiary">
          {t.lastUpdatedLabel}: {t.lastUpdatedDate}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-secondary">{t.intro}</p>

        <div className="mt-8 flex flex-col gap-8">
          {t.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-ink-primary">{section.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer language={language} />
    </div>
  );
}
