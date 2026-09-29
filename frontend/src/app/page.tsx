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
import { allocateHomeFirstScreen } from '@/components/home/reva/worldIn60Allocation';
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
import { AskStandaloneRoot } from '@/components/ask-nav/AskStandaloneRoot';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { ASK_SOCIAL_PREVIEW } from '@/lib/seo/socialPreview';

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
 * RIGHT RAIL PLACEMENT is a CONTAINER query on the content column: at ≥1140 px
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

  /* STANDALONE PUBLIC BETA CONVERGENCE R1 — the root is Ask GlobalNewsAI (see standaloneRoot). */
  if (standaloneAskRoot()) {
    return buildPageMetadata({
      path: '/',
      title: t.askRootMetaTitle,
      description: t.askRootMetaDescription,
      language,
      image: ASK_SOCIAL_PREVIEW,
    });
  }

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
  /* STANDALONE PUBLIC BETA CONVERGENCE R1 — `/` is the standalone Ask entry surface; the
     Home composition below is served only when GNA_PUBLIC_ROOT=platform. No Home feed is
     fetched for the Ask root. Ask serves EN/PL, like /ask. */
  if (standaloneAskRoot()) {
    return <AskStandaloneRoot locale={languageCookie === 'pl' ? 'pl' : 'en'} />;
  }
  const dict = getDictionary(language);
  const t = dict.homeReva;
  const feed = await getHomeFeed(language);
  /*
    Every module reads a role of the ONE Home response. For you (signed in, below
    the fold) reads the whole loaded pool, de-duplicated by id.

    HOME R2 STORY DEDUPLICATION R1 — the 60-second module no longer reads that
    pool. It shares the first screen with What's happening now (featured +
    inFocus + discovery), so it reads its OWN disjoint pool: `latestUpdates`
    minus every What's happening story by id and canonical URL. It is never
    padded with a story already shown beside it.

    W60 STARVATION CORRECTION R1 — on a narrow live response that remainder is
    empty, which left the right rail as an empty-state card. The first screen is
    now ONE partition (allocateHomeFirstScreen): the 60-second module takes the
    disjoint remainder, then TRANSFERS governed brief stories (`briefUpdates`)
    out of What's happening — moved, never copied, never the featured story —
    while What's happening keeps its floor (≥3 at normal widths). Both modules
    are populated whenever the response has at least two distinct stories.
  */
  const seenIds = new Set<string>();
  const homeArticles = [
    ...(feed.featured === null ? [] : [feed.featured]),
    ...feed.inFocus,
    ...feed.discovery,
    ...feed.latestUpdates,
  ].filter((article) => {
    if (seenIds.has(article.id)) return false;
    seenIds.add(article.id);
    return true;
  });
  const firstScreen = allocateHomeFirstScreen(feed);
  const worldIn60 = firstScreen.worldIn60;
  const whats = firstScreen.whats;

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
          <div
            data-home-content=""
            className="min-w-0 flex-1 [container-name:home-content] [container-type:inline-size]"
          >
            <main className={`pb-24 lg:pb-0 ${HOME_PAGE_SURFACE}`}>
              <div className="mx-auto w-full max-w-[1600px] px-4 md:px-10 gn-xl:px-12">
                <AuthErrorBanner language={language} />
                {/*
                  HOME REV A — DENSITY / ORDER / 60-SECONDS CORRECTION R2.
                  Priority everywhere: Hero → Your world in 60 seconds → What's
                  happening now → Suggested investigations. DOM follows it.
                  - phone (<700 content): exactly that, stacked.
                  - tablet (700–999): Rev A tablet order kept — hero → stories →
                    60 s → questions.
                  - 1000–1139 (e.g. 1280 with the expanded rail): stacked in the
                    priority order, the 60 s module two-column with a 240 px lead.
                  - wide (≥1140 content — 1440 with a 15–17 px desktop scrollbar
                    leaves 1175 px, so the Rev A 1180 threshold would silently
                    drop real Windows/Linux desktops into the stacked layout):
                    the 60-second module is the right rail beside
                    Hero AND stories (360 px; 420 px ≥1560), the stories sit under
                    the Hero four across, and Suggested investigations follows
                    both as one full-width row — so no empty band opens under the
                    Hero, whatever the module's height.
                */}
                <div
                  data-home-band=""
                  className="grid grid-cols-1 gap-x-6 gap-y-6 [grid-template-areas:'hero'_'rail'_'whats'_'sugg'] [@container(min-width:700px)_and_(max-width:999.98px)]:[grid-template-areas:'hero'_'whats'_'rail'_'sugg'] [@container(min-width:1140px)]:[grid-template-areas:'hero_rail'_'whats_rail'_'sugg_sugg'] [@container(min-width:1140px)]:[grid-template-columns:minmax(0,1fr)_360px] [@container(min-width:1140px)]:[grid-template-rows:auto_1fr_auto] [@container(min-width:1560px)]:[grid-template-columns:minmax(0,1fr)_420px]"
                >
                  <div className="min-w-0 [grid-area:hero]">
                    <HomeWelcomeHero language={language} />
                  </div>
                  <aside
                    aria-label={t.w60.title}
                    data-home-right-rail=""
                    className="flex min-w-0 flex-col gap-4 self-start [grid-area:rail] [@container(min-width:1140px)]:pt-6"
                  >
                    <WorldIn60Seconds
                      items={worldIn60}
                      language={language}
                      showEmptyState={whats.featured !== null}
                    />
                  </aside>
                  <div className="min-w-0 self-start [grid-area:whats]">
                    <WhatsHappeningNow
                      lead={whats.featured}
                      secondary={whats.inFocus}
                      discovery={whats.discovery}
                      dataMode={feed.dataMode}
                      language={language}
                    />
                  </div>
                  <div data-home-suggested-row="" className="min-w-0 [grid-area:sugg]">
                    <SuggestedInvestigations
                      title={t.suggested.title}
                      note={t.suggested.note}
                      questions={dict.hero.exampleQuestions}
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
