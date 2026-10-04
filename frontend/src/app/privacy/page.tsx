import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { Footer } from '@/components/layout/Footer';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { effectiveWithin } from '@/lib/i18n/surfaceLocale';
import { GuestDataSection } from '@/components/consent/GuestDataSection';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { COOKIES_PAGE } from '@/lib/privacy/cookiesPageStrings';

/**
 * B2 — Public Legal Surfaces. Mirrors the homepage's own server-side
 * language resolution exactly (cookies().get(LANGUAGE_COOKIE_NAME) —
 * T2: now through surfaceLocale(), the display-locale authority) so
 * this page respects the same stored language preference NavBar/
 * Footer already use elsewhere, without introducing any new
 * resolution mechanism. A plain server component — no client
 * interactivity is needed for static legal content, so no 'use
 * client' directive (unlike /history, which needs one for its own
 * account-fetching behavior).
 */
/*
 * ALPHA-SEO-FOUNDATION-1 — metadata for a public canonical surface.
 *
 * Title and description come from the SAME dictionary section the page
 * already renders, in the SAME language the page already resolved. No
 * new copy is authored here and no string is truncated: a shortened
 * description is a different description, and §E/§G's rule against
 * fabricated metadata applies to prose as much as to dates.
 */
export async function generateMetadata(): Promise<Metadata> {
  const language = surfaceLocale('privacy').language;
  const t = getDictionary(language).privacyPage;

  return buildPageMetadata({
    path: '/privacy',
    title: `${t.title} \u2014 GlobalNews AI`,
    description: t.intro,
    language,
  });
}

export default async function PrivacyPage(): Promise<JSX.Element> {
  const surface = surfaceLocale('privacy');
  const language = surface.language;
  const t = getDictionary(language).privacyPage;
  /* T5 Part B — the guest-data section's catalogue (`consent`) authors en/pl only; in any other
     locale the T2 rule already renders this whole surface in English with the declared notice. */
  const consentLocale = effectiveWithin(surface, ['en', 'pl']);

  return (
    /* TRUST R1 §16 — the legal pages take the same theme as the Standalone surfaces (read from the
       theme cookie on the server; changing it touches no network and no Ask). Wording unchanged. */
    <AskThemedSurface theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
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
          {/* T5 Part B — the measured guest contract, this browser's guest dates/quota, and
              "Delete my guest data now" (one status read on mount; never mints a session). */}
          <GuestDataSection locale={consentLocale} />
          {/* TRUST R1 §12 — the detailed Cookies & similar technologies notice and settings. */}
          <p className="mt-8 text-sm">
            <a
              href="/cookies"
              data-privacy="cookies-link"
              className="text-signal underline-offset-2 hover:underline"
            >
              {COOKIES_PAGE[consentLocale].title}
            </a>
          </p>
        </main>
        <Footer language={language} />
      </div>
    </AskThemedSurface>
  );
}
