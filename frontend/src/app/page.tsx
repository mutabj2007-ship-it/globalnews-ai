import { cookies } from 'next/headers';
import { NavBar } from '@/components/navigation/NavBar';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { LiveStatusStrip } from '@/components/home/LiveStatusStrip';
import { Hero } from '@/components/home/Hero';
import { GlobalDevelopments } from '@/components/home/GlobalDevelopments';
import { HomepageSituationMap } from '@/components/home/HomepageSituationMap';
import { IntelligenceModulesDesktop } from '@/components/home/IntelligenceModulesDesktop';
import { IntelligenceModulesMobile } from '@/components/home/IntelligenceModulesMobile';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TrustSection } from '@/components/home/TrustSection';
import { Footer } from '@/components/layout/Footer';
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
 *   HomepageSituationMap (real, lazy-loaded /map infrastructure —
 *                          replaces WorldMapGateway's plain CTA panel)
 *   IntelligenceModulesDesktop / IntelligenceModulesMobile
 *                        (render from the SAME canonical
 *                         INTELLIGENCE_MODULES config; exactly one is
 *                         visible per breakpoint via hidden/lg:hidden)
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
 * Hero rather than its own gateway section). Their underlying
 * reusable pieces —
 * SafeImage usage patterns, CARD_INTERACTION_CLASSES, DataModeLabel,
 * getCountryDisplayName, formatRelativeTime/formatUtcClock,
 * pluralWithForms — are all still in active use by the new components
 * above.
 *
 * Single homepage fetch preserved unchanged: getHomeFeed() still makes
 * exactly one fetchTopHeadlines(12, language) call — Hero's live-updates
 * panel, GlobalDevelopments all derive from that SAME feed object.
 * HomepageSituationMap makes zero fetch on load (see its own doc
 * comment) — its one real fetchCountryNews() call is strictly
 * user-interaction-triggered, not part of this page's initial render.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const languageCookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en';

  const feed = await getHomeFeed(language);

  return (
    <>
      <NavBar language={language} />
      <LiveStatusStrip isLive={feed.isLive} dataMode={feed.dataMode} language={language} />
      <main className="pb-16 lg:pb-0">
        <Hero latestArticles={feed.latestUpdates} />
        <GlobalDevelopments
          lead={feed.featured}
          secondary={feed.inFocus}
          dataMode={feed.dataMode}
          language={language}
        />
        <HomepageSituationMap language={language} />
        <IntelligenceModulesDesktop language={language} />
        <IntelligenceModulesMobile language={language} />
        <HowItWorks language={language} />
        <TrustSection language={language} />
      </main>
      <Footer language={language} />
      <MobileBottomNav language={language} />
    </>
  );
}
