import { cookies } from 'next/headers';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';

/**
 * M66.10B — Source Policy, the third public legal surface.
 *
 * This page is a deliberate, line-for-line reuse of the B2 legal-page
 * architecture established by app/privacy/page.tsx and app/terms/page.tsx:
 * the same server-side language resolution (cookies().get(
 * LANGUAGE_COOKIE_NAME) + isActiveLanguageCode(), defaulting to 'en'),
 * the same <NavBar> / max-w-3xl <main> / <Footer> shell, the same legacy
 * token scale, and the same { title, lastUpdatedLabel, lastUpdatedDate,
 * intro, sections[] } dictionary shape. A plain async server component —
 * no 'use client', because static policy content needs no client
 * interactivity.
 *
 * NO SHARED ABSTRACTION WAS EXTRACTED (M66.10A §E.7, CTO-approved).
 * Factoring privacy/terms/source-policy into one <LegalPage> would have
 * modified two accepted, CTO-approved routes to save ~30 lines on a
 * third. That is a refactor, and this milestone is not a refactor. If the
 * abstraction is wanted it should be its own milestone, generalizing from
 * three real callers rather than two plus a hypothesis.
 *
 * NO CLAUDE DESIGN TOKENS. /privacy and /terms "render entirely on the
 * legacy tokens" (claudeDesignFoundation.spec.ts). Introducing cd-* here
 * would create a third, unreleased legal-page treatment inside one route
 * family. The GN-CD canvas reaches this page only through <Footer>, which
 * M66.8b already aligned to the shared box on all routes.
 *
 * ZERO DATA. No fetch, no API client, no state, no client boundary, no
 * timer, no router. This route creates no second news-fetch path.
 *
 * NOT IN THE HEADER. /source-policy is a footer destination only, exactly
 * like /privacy and /terms — it is deliberately absent from
 * primaryNavLinks and from MobileBottomNav (see index.spec.ts, which
 * asserts the same absence for /privacy).
 */
export default async function SourcePolicyPage(): Promise<JSX.Element> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language).sourcePolicyPage;

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
