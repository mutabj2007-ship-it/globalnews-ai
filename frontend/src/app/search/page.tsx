import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { SearchPageClient } from '@/components/search/SearchPageClient';
import { LoadingStages } from '@/components/search/LoadingStages';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';

/**
 * M65 — resolves the language exactly as the homepage and the map route
 * already do: the SAME cookie persistLanguageSelection() writes,
 * validated against the SAME ACTIVE_LANGUAGES set, always resolving to a
 * concrete 'en'/'pl'. No second language mechanism.
 */
function resolvePageLanguage(): 'en' | 'pl' {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  return languageCookie && isActiveLanguageCode(languageCookie) ? (languageCookie as 'en' | 'pl') : 'en';
}

/**
 * M65 — Next.js's static `metadata` export cannot read cookies (it has
 * no request context); only the async generateMetadata() function can.
 * This closes the defect where a Polish search result rendered under an
 * English document title, and mirrors the mechanism map/page.tsx already
 * established rather than introducing a parallel one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const language = resolvePageLanguage();
  const t = getDictionary(language);
  /*
    ALPHA-SEO-FOUNDATION-1 — THE TITLE AND DESCRIPTION ARE UNCHANGED; what
    is added is the `noindex, nofollow` directive §B requires for
    "arbitrary /search result pages" and "arbitrary user natural-language
    question result pages".

    This surface renders one person's question and the analysis produced
    for it. There is no stable public document here to be the canonical
    home of anything, so the builder emits no canonical and no `og:url`
    either — a canonical tag would nominate a transient URL as published
    content.
  */
  return buildPageMetadata({
    path: '/search',
    title: t.searchMetaTitle,
    description: t.searchMetaDescription,
    language,
  });
}

export default function SearchPage(): JSX.Element {
  // M65 — the shell around the results is now rendered in the SAME
  // language as the results themselves. Previously NavBar and Footer
  // took their 'en' defaults here, so a Polish analysis was framed by an
  // English header and footer.
  const language = resolvePageLanguage();

  return (
    <>
      <NavBar language={language} />
      <main className="min-h-screen bg-void">
        <Suspense
          fallback={
            <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
              <LoadingStages />
            </div>
          }
        >
          <SearchPageClient initialLanguage={language} />
        </Suspense>
      </main>
      <Footer language={language} />
    </>
  );
}
