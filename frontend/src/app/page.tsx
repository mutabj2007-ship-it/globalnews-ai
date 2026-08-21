import { cookies } from 'next/headers';
import { NavBar } from '@/components/navigation/NavBar';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { LiveStatusStrip } from '@/components/home/LiveStatusStrip';
import { Hero } from '@/components/home/Hero';
import { HeroFocusProvider } from '@/components/home/HeroFocusProvider';
import { GlobalDevelopments } from '@/components/home/GlobalDevelopments';
import { IntelligenceEngineSection } from '@/components/home/IntelligenceEngineSection';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TrustSection } from '@/components/home/TrustSection';
import { Footer } from '@/components/layout/Footer';
import { PageCanvas } from '@/components/layout/PageCanvas';
import { getHomeFeed } from '@/lib/homeFeed';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';

/**
 * Master Frontend Recomposition — final homepage architecture:
 *
 *   NavBar (already has a compact mobile header — logo/search/menu —
 *           confirmed via direct inspection before this recomposition;
 *           no separate MobileHeader component was needed)
 *   LiveStatusStrip
 *   Hero                 (three-zone: search/ask left, dominant world
 *                          visual center, Global Intelligence
 *                          latest-updates panel right — this panel is
 *                          now the SOLE presentation of
 *                          feed.latestUpdates; the former separate
 *                          LatestNowRail section, which duplicated the
 *                          exact same data immediately above Hero, was
 *                          removed here as part of the M60 Phase 2
 *                          homepage deduplication correction —
 *                          LatestNowRail.tsx itself is intentionally
 *                          left in the repository, unrendered, rather
 *                          than deleted, per the explicit "don't
 *                          destroy potentially reusable code
 *                          unnecessarily" instruction)
 *   GlobalDevelopments   (ONE coherent editorial surface: lead + 4
 *                          secondary — replaces the former separate
 *                          NewsroomSection + CategoryCards sections)
 *   IntelligenceEngineSection
 *                        (M65.1 — ONE section for every breakpoint,
 *                         reconstructed from the approved Claude Design
 *                         Intelligence Engine reference and rendering
 *                         from the SAME canonical INTELLIGENCE_MODULES
 *                         config. Replaces IntelligenceModulesDesktop and
 *                         IntelligenceModulesMobile, which are RETIRED
 *                         from this render path — their files are
 *                         retained, unimported, pending a separate
 *                         cleanup decision.)
 *   HowItWorks
 *   TrustSection         (compacted this round)
 *   Footer
 *   MobileBottomNav      (fixed, lg:hidden, real destinations only)
 *
 * Retired from this composition (NOT deleted from the repository —
 * see the Master Frontend Recomposition implementation report for the
 * full retire/retain audit): NewsroomSection, FeaturedStory,
 * InFocusSidebar, CategoryCards, LatestUpdatesFeed, WorldMapGateway,
 * LatestNowRail (M60 Phase 2 — duplicated Hero's own live-updates
 * panel; see above), WorldMapAnimatedVisual (still used, but now via
 * Hero rather than its own gateway section), HomepageSituationMap
 * (M66.8c — see below). Their underlying
 * reusable pieces —
 * SafeImage usage patterns, CARD_INTERACTION_CLASSES, DataModeLabel,
 * getCountryDisplayName, formatRelativeTime/formatUtcClock,
 * pluralWithForms — are all still in active use by the new components
 * above.
 *
 * M66.1 — the sections above render inside <PageCanvas>, the shared Claude
 * Design presentation foundation (GN-CD-300 §F/§G, GN-CD-302 §E.1). <main> keeps
 * its exact `pb-16 lg:pb-0` class list, no section's own width or padding is
 * rewritten (CTO decision D5), and every data path below is unchanged.
 * PageCanvas fetches nothing and holds no state — it is presentation
 * infrastructure only.
 *
 * M66.8c — HOMEPAGE COMPOSITION CLOSE. HomepageSituationMap is retired from
 * this render path, leaving five canvas sections: Hero, GlobalDevelopments,
 * IntelligenceEngineSection, HowItWorks, TrustSection.
 *
 * The released Claude Design homepage composition is five sections — Hero,
 * Trending, Intelligence Engine, Built on Trust, Footer — and the situation
 * map was never one of them. It was also a strict subset of /map: the same
 * WorldMap component, the same fetchCountryNews() call, and a summary that
 * CoverageMetrics already computes more fully there, plus country search,
 * hover tooltips, a category filter and article cards that the homepage
 * section never had. Nothing was lost by removing it, and /map is unchanged.
 *
 * HomepageSituationMap.tsx REMAINS ON DISK, unimported — the same
 * retire-don't-delete convention already applied to LatestNowRail above and to
 * IntelligenceModulesDesktop/Mobile below. Its five direct specs
 * (HomepageSituationMap, situationMapVisualPolish, emptyPanelEvidenceFixes,
 * responsiveAccessibilityHardening, hudPanelGeometry) read the component file
 * rather than this one, so all five continue to pass untouched.
 *
 * /map is reachable from five places that are NOT this section: the NavBar
 * "World Map" item, MobileBottomNav, two Hero CTAs and the Hero live-feed
 * panel's own link. Removing the section removed no route and no affordance.
 * HowItWorks stays for now — M66.6-DEFERRED-001 is separate work.
 *
 * Single homepage fetch preserved unchanged: getHomeFeed() still makes
 * exactly one fetchTopHeadlines(12, language) call — Hero's live-updates
 * panel and GlobalDevelopments both derive from that SAME feed object.
 * M66.8c removed no fetch, because the retired section made none on load:
 * its one real fetchCountryNews() call was strictly user-interaction-
 * triggered and never part of this page's initial render. The request count
 * for this page is therefore identical before and after.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';

  const feed = await getHomeFeed(language);

  /**
   * M65 — ONE freshness instant per request, resolved here in the Server
   * Component and passed to BOTH status presentations (LiveStatusStrip's
   * mobile strip and Hero's desktop DATA STATUS row). Hero is a Client
   * Component: generating this there would let the two surfaces capture
   * different instants and genuinely disagree. Honest limitation, stated
   * plainly: this is the page-render time, not the feed-fetch time — the
   * same thing the strip previously showed, now merely consistent across
   * both surfaces instead of computed twice.
   */
  const updatedAt = new Date().toISOString();

  return (
    <>
      <NavBar language={language} />
      <LiveStatusStrip isLive={feed.isLive} dataMode={feed.dataMode} language={language} updatedAt={updatedAt} />
      <main className="pb-16 lg:pb-0">
        <PageCanvas>
          {/*
            M66.14B — HeroFocusProvider owns the hero's focus state and wraps
            BOTH consumers, because Hero and GlobalDevelopments are siblings
            and Hero-owned state could never reach TrendingCard.

            THIS FILE STAYS A SERVER COMPONENT. The provider receives its
            children as a prop, so everything below is still server-rendered;
            only the provider module itself joins the client bundle.

            GlobalDevelopments is inside it from the first commit even though
            TrendingCard does not participate until B-2 — the architecture is
            final now, so B-2 adds a consumer rather than replacing anything.
          */}
          <HeroFocusProvider
            language={language}
            isLive={feed.isLive}
            dataMode={feed.dataMode}
            updatedAt={updatedAt}
          >
            <Hero latestArticles={feed.latestUpdates}
              language={language}
              isLive={feed.isLive}
              dataMode={feed.dataMode}
              updatedAt={updatedAt}
            />
            <GlobalDevelopments
              lead={feed.featured}
              secondary={feed.inFocus}
              dataMode={feed.dataMode}
              language={language}
            />
          </HeroFocusProvider>
          <IntelligenceEngineSection language={language} />
          <HowItWorks language={language} />
          <TrustSection language={language} />
        </PageCanvas>
      </main>
      <Footer language={language} />
      <MobileBottomNav language={language} />
    </>
  );
}
