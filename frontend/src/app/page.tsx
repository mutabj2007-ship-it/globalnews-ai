import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { WhatsHappeningNow } from '@/components/home/WhatsHappeningNow';
import { HOME_PAGE_SURFACE } from '@/components/home/homePresentation';
import { HomeSessionProvider } from '@/components/home/reva/HomeSession';
import { HomeUtilityHeader } from '@/components/home/reva/HomeUtilityHeader';
import { HomeProductRail } from '@/components/home/reva/HomeProductRail';
import { HomeWelcomeHero } from '@/components/home/reva/HomeWelcomeHero';
import { WorldIn60Seconds } from '@/components/home/reva/WorldIn60Seconds';
import { SuggestedInvestigations } from '@/components/home/reva/SuggestedInvestigations';
import { HomeForYou } from '@/components/home/reva/HomeForYou';
import { ExploreIntelligence } from '@/components/home/reva/ExploreIntelligence';
import { DeepIntelligenceRow } from '@/components/home/reva/DeepIntelligenceRow';
import { HomeBridge } from '@/components/home/reva/HomeBridge';
import { HomeBuiltOnTrust, HomeHowItWorks } from '@/components/home/reva/HomeHowAndTrust';
import { Footer } from '@/components/layout/Footer';
import { getHomeFeed } from '@/lib/homeFeed';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SiteStructuredData } from '@/components/seo/SiteStructuredData';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';

/**
 * HOME WELCOME & DISCOVERY R1 REV A — THE HOME COMPOSITION.
 *
 * Authority: r6/HOME-WELCOME-DISCOVERY-R1-REV-A (package SHA256 ae143a26…9670)
 * and the CTO's queued implementation authority. Three information layers:
 *
 *   LEFT RAIL  (≥1024)  product navigation only — HomeProductRail
 *   HOME BODY           Hero → What's happening now | right rail (60 s, Suggested)
 *                       → [signed: For you + Following] → Explore intelligence
 *                       → Deep Intelligence → My Intelligence bridge
 *                       → How it works → Built on trust
 *   FOOTER              legal / support (unchanged real routes)
 *
 * Header: ≥1024 the Rev A utility header (quick actions only); below 1024 the
 * existing NavBar and the existing four-item bottom navigation, unchanged.
 *
 * ONE STATIC DOM ORDER SERVES BOTH STATES. Signed-in order is For you → Explore
 * → Deep → bridge; anonymous is Explore → Deep → "Make GlobalNewsAI yours".
 * For you renders nothing for an anonymous reader and the bridge renders the
 * right variant, so both orders hold without reshuffling server markup.
 *
 * RIGHT RAIL PLACEMENT is a CONTAINER query on the content column: at ≥1180 px
 * the 60-second module and Suggested investigations sit beside Hero + What's
 * happening; narrower (1280 with the expanded rail, tablet, phone) they flow
 * directly after What's happening. The DOM order is hero → stories → rail, so
 * reading order is the same either way and nothing is rendered twice.
 *
 * DATA: still exactly ONE getHomeFeed() call; every module reads a role of that
 * one response. No AI on render, no per-module provider call. Account-aware
 * islands share ONE account read through HomeSessionProvider (a client boundary
 * that takes the server-rendered page as children).
 *
 * RETIRED FROM HOME, NOT DELETED (this codebase's convention): BetaHomeHeader
 * (still the My Intelligence page header), BetaHero (its gold "Go further /
 * Plans coming soon" card and coloured CTA tiles have no Rev A equivalent),
 * HomeSideRail, ExploreByTopic, HomePremiumTeaser, HomeAccountPanel, HowItWorks,
 * TrustSection. PageCanvas is no longer the Home wrapper: Rev A sets its own
 * content geometry beside the rail.
 */

/*
 * ALPHA-SEO-FOUNDATION-1 — the home page's own metadata.
 *
 * It previously inherited title and description from the root layout,
 * which was correct for those two fields and silent on the other three:
 * there was no canonical, no robots directive and no social card. The
 * SAME dictionary strings are used, so the title and description are
 * byte-identical to what shipped; what is added is the canonical, the
 * explicit `index, follow`, and Open Graph/Twitter metadata that follows
 * that canonical.
 */
export async function generateMetadata(): Promise<Metadata> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const t = getDictionary(language);

  return buildPageMetadata({
    path: '/',
    title: t.homeMetaTitle,
    description: t.homeMetaDescription,
    language,
  });
}

export default async function HomePage(): Promise<JSX.Element> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';
  const dict = getDictionary(language);
  const t = dict.homeReva;
  const feed = await getHomeFeed(language);
  /*
    Every module reads a role of the ONE Home response. For you and the 60-second
    module both need the whole loaded pool: de-duplicated by id, and for the
    60-second module newest first (W60_MEDIA_SPEC: "the first five stories
    already loaded for Home"). `latestUpdates` alone can be empty once the
    allocator has placed every story in its curated roles.
  */
  const seenIds = new Set<string>();
  const homeArticles = [...(feed.featured === null ? [] : [feed.featured]), ...feed.inFocus, ...feed.discovery, ...feed.latestUpdates].filter((article) => {
    if (seenIds.has(article.id)) return false;
    seenIds.add(article.id);
    return true;
  });
  const newestFirst = [...homeArticles].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  return (
    <>
      <SiteStructuredData />
      <HomeSessionProvider>
        <HomeUtilityHeader language={language} />
        <div className="lg:hidden">
          <NavBar language={language} />
        </div>
        <div className="lg:flex">
          <HomeProductRail language={language} />
          {/* The content column is the size container every Rev A breakpoint rule measures. */}
          {/*
            The content column is the size container every Rev A breakpoint rule
            measures. DENSITY R1 names it (`home-content`) so modules that are
            their own containers (the 60-second module) can still ask how wide
            the whole column is.
          */}
          <div data-home-content="" className="min-w-0 flex-1 [container-name:home-content] [container-type:inline-size]">
            <main className={`pb-24 lg:pb-0 ${HOME_PAGE_SURFACE}`}>
              <div className="mx-auto w-full max-w-[1600px] px-4 md:px-10 gn-xl:px-12">
                <AuthErrorBanner language={language} />
                {/*
                  HOME REV A DENSITY CORRECTION R1.
                  - DOM order is hero → 60-second rail → What's happening, which is
                    the ruled PHONE order (a quick briefing, then the wider feed).
                  - Tablet / narrow desktop (700–1179 px content) keep Rev A's order
                    through grid areas: hero → What's happening → rail.
                  - Wide (≥1180 px content): the rail (60 s + Suggested
                    investigations, Rev A placement kept) sits beside the Hero at
                    380 px (420 px ≥1560 — the pre-Rev-A rail was 368 px), and What's
                    happening spans the FULL content width beneath both, so four
                    story cards are visible at 1440.
                */}
                <div
                  data-home-band=""
                  className="grid grid-cols-1 gap-x-8 gap-y-6 [grid-template-areas:'hero'_'rail'_'whats'] [@container(min-width:700px)_and_(max-width:1179.98px)]:[grid-template-areas:'hero'_'whats'_'rail'] [@container(min-width:1180px)]:[grid-template-areas:'hero_rail'_'whats_whats'] [@container(min-width:1180px)]:[grid-template-columns:minmax(0,1fr)_380px] [@container(min-width:1560px)]:[grid-template-columns:minmax(0,1fr)_420px]"
                >
                  <div className="min-w-0 [grid-area:hero]">
                    <HomeWelcomeHero language={language} />
                  </div>
                  <aside
                    aria-label={t.w60.title}
                    data-home-right-rail=""
                    className="flex min-w-0 flex-col gap-4 [grid-area:rail] [@container(min-width:1180px)]:pt-6"
                  >
                    <WorldIn60Seconds items={newestFirst} language={language} />
                    <SuggestedInvestigations title={t.suggested.title} note={t.suggested.note} questions={dict.hero.exampleQuestions} />
                  </aside>
                  <div className="min-w-0 [grid-area:whats]">
                    <WhatsHappeningNow
                      lead={feed.featured}
                      secondary={feed.inFocus}
                      discovery={feed.discovery}
                      dataMode={feed.dataMode}
                      language={language}
                    />
                  </div>
                </div>

                <div className="mt-10 flex flex-col gap-10 pb-12 md:mt-12 md:gap-12">
                  <HomeForYou articles={homeArticles} language={language} />
                  <ExploreIntelligence language={language} />
                  <DeepIntelligenceRow language={language} />
                  <HomeBridge language={language} />
                  <HomeHowItWorks language={language} />
                  <HomeBuiltOnTrust language={language} />
                </div>
              </div>
            </main>
          </div>
        </div>
        {/*
          The ONE shared Footer (M66.8b: no route-specific variant), unmodified,
          below the rail + content row at full width — beside the rail its
          full-width composition squeezes. Legal/support layer only (CTO §4).
        */}
        <Footer language={language} />
        <MobileBottomNav language={language} />
      </HomeSessionProvider>
    </>
  );
}
