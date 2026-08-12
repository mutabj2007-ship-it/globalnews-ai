import { cookies } from 'next/headers';
import { NavBar } from '@/components/navigation/NavBar';
import { LiveStatusStrip } from '@/components/home/LiveStatusStrip';
import { Hero } from '@/components/home/Hero';
import { NewsroomSection } from '@/components/home/NewsroomSection';
import { CategoryCards } from '@/components/home/CategoryCards';
import { LatestUpdatesFeed } from '@/components/home/LatestUpdatesFeed';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TrustSection } from '@/components/home/TrustSection';
import { Footer } from '@/components/layout/Footer';
import { getHomeFeed } from '@/lib/homeFeed';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';

/**
 * Milestone #47 (homepage feed language correction, round 2) — this
 * Server Component cannot read window/localStorage (they don't exist
 * outside a browser); it reads the SAME-named cookie
 * persistLanguageSelection() now writes alongside its existing,
 * unchanged localStorage write (see i18n/languages.ts's own doc
 * comment for why a cookie was chosen as the smallest safe bridge, and
 * for why the cookie's physical name differs from the localStorage
 * key). next/headers's cookies() is a plain, request-scoped server
 * read — not a client API, not window, not localStorage.
 *
 * CRITICAL (Blocker 1 fix): the resolved language is NEVER
 * `undefined`. An absent, malformed, or unrecognized cookie — the
 * exact case for every first-time visitor — now explicitly resolves
 * to 'en', so the homepage feed request is ALWAYS language-contained
 * (lang=en at minimum) rather than ever reaching GNews with no
 * language filter at all, which is what previously allowed an
 * uncontrolled multilingual mixture while the UI still visibly says
 * English.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';

  const feed = await getHomeFeed(language);

  return (
    <>
      <NavBar />
      <LiveStatusStrip isLive={feed.isLive} dataMode={feed.dataMode} />
      <main>
        <Hero />
        <NewsroomSection story={feed.featured} trending={feed.trending} dataMode={feed.dataMode} />
        <CategoryCards cards={feed.categoryCards} />
        <LatestUpdatesFeed updates={feed.latestUpdates} dataMode={feed.dataMode} />
        <HowItWorks />
        <TrustSection />
      </main>
      <Footer />
    </>
  );
}
