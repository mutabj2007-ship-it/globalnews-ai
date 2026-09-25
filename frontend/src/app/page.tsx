import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { BetaHero } from '@/components/home/BetaHero';
import { WhatsHappeningNow } from '@/components/home/WhatsHappeningNow';
import { HomeSideRail } from '@/components/home/HomeSideRail';
import { HomepageSituationMap } from '@/components/home/HomepageSituationMap';
import { ExploreByTopic } from '@/components/home/ExploreByTopic';
import { EngineEnergyField } from '@/components/home/EngineEnergyField';
import { IntelligenceModulesSection } from '@/components/home/IntelligenceModulesSection';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TrustSection } from '@/components/home/TrustSection';
import { Footer } from '@/components/layout/Footer';
import { PageCanvas } from '@/components/layout/PageCanvas';
import { getHomeFeed } from '@/lib/homeFeed';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SiteStructuredData } from '@/components/seo/SiteStructuredData';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';

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
 * C3 (BETA HOME CLOSURE R2) SUPERSEDES THE M66.8c NOTE BELOW. HomepageSituationMap
 * is no longer retired: the R2 contract requires the Global Situation Map card on
 * Home, and it is mounted in the editorial column above. The reasoning M66.8c
 * recorded is kept verbatim underneath because it is still the reason the card
 * had been removed, and because one of its premises no longer holds — the
 * section makes no fetchCountryNews() call at all now, on load or on selection.
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
      {/*
        ALPHA-SEO-FOUNDATION-1 — `WebSite` + `Organization` JSON-LD.

        A `<script type="application/ld+json">` renders no box and no text
        node, so the released home composition below is untouched: NavBar
        remains the first visible element and nothing is wrapped.
      */}
      <SiteStructuredData />
      <NavBar language={language} />
      <main className="pb-16 lg:pb-0">
        <PageCanvas>
          {/*
            B5-A · C-13 — THE ERROR LANDING IS ALWAYS THE FRONTEND ORIGIN ROOT.

            A failed or cancelled sign-in never carries a returnTo, so this is
            the only surface that has to read the parameter, and it is mounted
            here rather than in the layout for exactly that reason.

            THIS FILE STAYS A SERVER COMPONENT. AuthErrorBanner is a client
            component that renders nothing at all unless the parameter is
            present and admissible, so on every ordinary visit it contributes no
            box, no text node and no layout shift.
          */}
          <AuthErrorBanner language={language} />
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
          {/*
            H2/H3 · Issue #29 — the approved Beta Home composition.

            BetaHero carries the headline, the Ask entry, the CTA pair and the
            "Your world in 60 seconds" brief; WhatsHappeningNow carries the
            editorial area. Together they replace Hero, GlobalDevelopments and
            LiveStatusStrip.

            THREE RETIREMENTS, ONE REASON EACH, and all three files stay on
            disk unimported — the convention this file already applies to
            TodaySection, LatestNowRail, HomepageSituationMap and the engine
            section:

              Hero                 superseded composition and copy, and its Ask
                                   submit spent metered AI from Home (C1).
              GlobalDevelopments   the same feed in the superseded M66
                                   presentation; the approved lead + four-up
                                   composition replaces it.
              LiveStatusStrip      a band above the hero that appears in no
                                   approved frame. Its degraded-data duty moved
                                   into WhatsHappeningNow, which is why the two
                                   changes land together rather than leaving
                                   Home briefly silent about a failed feed.

            HeroFocusProvider goes with them: it existed to link the old hero's
            focus state to GlobalDevelopments, and neither survives. It is a
            client boundary, so removing it also returns this stretch of Home
            to pure server rendering.

            The single getHomeFeed() call is unchanged; both sections read
            different roles of that one response.
          */}
          <BetaHero language={language} latestUpdates={feed.latestUpdates} />
          {/*
            H5 · Issue #29 — the approved two-column editorial band: the
            current-developments column beside the Home side rail, exactly as
            the R4.1 frames place them. One column on phone and tablet, where
            the approved phone frames stack the rail beneath the feed.
          */}
          {/*
            C3 · THE GLOBAL SITUATION MAP JOINS THE EDITORIAL COLUMN.

            `HomepageSituationMap` is RESTORED from retirement rather than
            rebuilt. It already reuses /map's own `WorldMap` through the same
            `next/dynamic({ ssr: false })` pattern, so MapLibre never enters the
            initial bundle, and it performs ZERO provider-capable country reads
            on mount and on selection. Selecting a country changes geographic
            scope and nothing else; the explicit retrieval action stays on the
            full map, so exploring geography on Home still cannot spend quota.

            It supersedes the rail's World Pulse thumbnail, which stood in for
            exactly this surface. See the note in HomeSideRail.
          */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
            <div className="flex flex-col gap-10">
              <WhatsHappeningNow
                lead={feed.featured}
                secondary={feed.inFocus}
                discovery={feed.discovery}
                dataMode={feed.dataMode}
                language={language}
              />
              <HomepageSituationMap language={language} />
            </div>
            <HomeSideRail language={language} />
          </div>
          {/*
            R2 — TODAY. Placed here deliberately: it is live editorial content,
            so it belongs with the live half of the page, between Global
            Developments and the explanatory sections below.

            It sits OUTSIDE HeroFocusProvider because it consumes no hero focus
            and writes none. Keeping it out means the provider's subtree is
            still exactly the two surfaces that participate in that chain.

            `feed.today` is derived from the SAME single getHomeFeed()
            response — no second request, no new route, and the corpus width is
            unchanged. This file stays a Server Component; TodayWorkspace is a
            Client Component only because the country filter is state.

            R7 — TodayWorkspace REPLACES TodaySection at this mount point, and
            replaces nothing else. Hero, Global Developments, the Intelligence
            Engine, How It Works and Trust are untouched; there is no new
            route; and production `html`/`body` keep their normal scrolling.
            The R7 fixed shell is scoped to the workspace element itself.

            TodaySection.tsx is RETIRED, NOT DELETED — the convention this
            codebase already applies to LatestNowRail, HomepageSituationMap and
            IntelligenceModulesDesktop. It stays on disk, unimported by any
            route, so the released surface remains inspectable beside the one
            that replaced it.
          */}
          {/*
            GATE A · R5.1 — IntelligenceModulesSection REPLACES
            IntelligenceEngineSection at this mount point, and replaces nothing
            else. `HOME_R4.1_DELTA.md` changes exactly one section of Home and
            declares the rest untouched, so Hero, Global Developments, the Today
            workspace, How It Works, Trust, the header, the footer and the
            bottom bar are all unchanged here.

            The engine files are RETIRED, NOT DELETED — the convention this file
            already applies to TodaySection, LatestNowRail, HomepageSituationMap
            and IntelligenceModulesDesktop/Mobile. IntelligenceEngineSection,
            IntelligenceEngineRing and intelligenceEngineGeometry stay on disk,
            unimported by any route, so the released surface stays inspectable
            beside the one that replaced it.

            WHY IT WAS REPLACED: measured on the built page at 1440, 430, 390
            and 360 in EN and PL, every module title, every status badge and the
            summary line were in the DOM but absent from rendered innerText —
            the radial ring keeps them in hover/focus panels. A first-time
            reader saw no module name as text. `id="intelligence-modules"`
            moves with the section, so MobileBottomNav's Intelligence tab, one
            of the four approved destinations, still resolves.
          */}
          {/*
            H5 · Issue #29 — THREE SECTIONS RETIRED FROM HOME.

            TodayWorkspace, HowItWorks and TrustSection appear in NO approved
            R4.1 or R5.1 Home frame, and none of the 139 keys in the approved
            Home copy catalogue names them. Under the contract's precedence
            rule 4 — "current implementation only as code to modify, never as
            missing design authority" — their presence here was not evidence
            that the approved Home contains them.

            RETIRED, NOT DELETED: all three files stay on disk, unimported,
            like TodaySection, LatestNowRail, HomepageSituationMap, Hero,
            GlobalDevelopments and LiveStatusStrip before them. Their own
            specs read those files rather than this one, so they keep passing.

            The Intelligence modules section stays exactly as accepted at
            c3dd01a — H4 is preserved and regression-tested, not rebuilt.
          */}
          {/*
            C4 · EXPLORE BY TOPIC. Six entries read out of INTELLIGENCE_MODULES,
            so their names and destinations are the registry's rather than a
            second list. It sits immediately above the nine-card Engine because
            "View all topics" is an anchor into it.
          */}
          <ExploreByTopic language={language} />
          {/*
            C5 · THE ENGINE KEEPS ITS NINE CARDS AND GETS ITS GLOW BACK.

            `IntelligenceModulesSection` is NOT touched — it is still the Gate A
            file, byte-for-byte, and `intelligenceModulesR51.spec.ts` still
            guards it. The intelligence-energy identity is restored behind it as
            a decorative field instead, drawn from the released engine geometry.

            The retired `IntelligenceEngineRing` could not be mounted here: it
            renders its own `IntelligenceModulePanel` per module, so the page
            would carry eighteen module representations and eighteen tab stops.
            EngineEnergyField draws only the hub, the rays and the node ring —
            no module name, state or route — so the nine cards in front remain
            the single presentation of the modules.
          */}
          <div className="relative isolate py-6 lg:py-10">
            <EngineEnergyField />
            <IntelligenceModulesSection language={language} />
          </div>
          {/*
            C6 · HOW IT WORKS AND BUILT ON TRUST RETURN.

            R1 retired both because neither appears in an approved R4.1 or R5.1
            Home frame and neither is named in the 139-key Home copy catalogue.
            That reasoning was sound against the authority R1 had; the R2
            contract supersedes it and requires both sections back, which is the
            later instruction and therefore the one that governs.

            Nothing about either file changed while it was retired — they were
            unimported, not deleted, and their own specs kept reading them — so
            this is a re-mount, not a rebuild. Both take the one resolved
            language like every other surface on the page, and neither fetches
            anything: they are static explanatory copy from the dictionary.
          */}
          <HowItWorks language={language} />
          <TrustSection language={language} />
        </PageCanvas>
      </main>
      <Footer language={language} />
      <MobileBottomNav language={language} />
    </>
  );
}
