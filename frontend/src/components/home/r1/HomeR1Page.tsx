import type { JSX } from 'react';
import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { articleRefFor } from '@/lib/identity/articleRefServer';
import type { HomeR1Gates } from '@/lib/platform/homeR1Gates';
import type { ThemePreference } from '@/lib/theme/theme';
import { HomeSessionProvider } from '@/components/home/reva/HomeSession';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';
import { SiteStructuredData } from '@/components/seo/SiteStructuredData';
import { Footer } from '@/components/layout/Footer';
import { HomeR1Canvas, HomeR1Header, HomeR1PhoneNav, HomeR1Rail } from './HomeR1Chrome';
import { HomeR1Hero } from './HomeR1Hero';
import { HomeR1World60 } from './HomeR1World60';
import { HomeR1Stories } from './HomeR1Stories';
import { HomeR1Bridge, HomeR1Explore } from './HomeR1Sections';
import { HomeR1Compare } from './HomeR1Compare';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — THE LIGHT-PRIMARY PLATFORM HOME
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Served by app/page.tsx ONLY when `home.lightPrimary` (GNA_HOME_R1) is on — and `/` reaches
 * the platform Home at all only under GNA_PUBLIC_ROOT=platform, which this tranche does not
 * change anywhere. Gate OFF: the Rev A Home, byte for byte (the rollback).
 *
 * DATA: the SAME one getHomeFeed() response and the SAME first-screen allocation as Rev A —
 * no second request, no AI on render. articleRef is derived here, server-side, with the
 * governed definition, so held / compared stories carry the identity the server verifies.
 *
 * GEOMETRY: the content column is the size container. ≥1140 px of content: the 60-second
 * module is a 360 px right rail beside the hero and the stories; narrower: stacked in the
 * Design's phone priority (hero → 60 seconds → what's happening). Phone: navy top bar,
 * four-slot light bottom navigation, the tray above it.
 */
export function HomeR1Page({
  language,
  gates,
  worldIn60,
  whats,
  dataMode,
  theme,
}: {
  readonly language: LanguageCode;
  readonly gates: HomeR1Gates;
  readonly worldIn60: readonly NewsArticle[];
  readonly whats: readonly NewsArticle[];
  readonly dataMode: NewsDataMode | null;
  /** The reader’s Light / Dark / System choice from the first-party cookie (server-read). */
  readonly theme: ThemePreference;
}): JSX.Element {
  const dict = getDictionary(language);
  const stories = whats.map((article) => ({ article, articleRef: articleRefFor(article.url) }));
  return (
    <>
      <SiteStructuredData />
      <HomeSessionProvider>
        <HomeR1Canvas theme={theme}>
          <HomeR1Header language={language} theme={theme} />
          <div className="lg:flex">
            <HomeR1Rail language={language} />
            <div data-home-content="" className="min-w-0 flex-1 [container-name:home-content] [container-type:inline-size]">
              <main className="pb-28 lg:pb-12">
                <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-10">
                  <AuthErrorBanner language={language} />
                  <div
                    data-home-band=""
                    className="grid grid-cols-1 gap-x-8 gap-y-6 [grid-template-areas:'hero'_'w60'_'whats'] [@container(min-width:1140px)]:[grid-template-areas:'hero_w60'_'whats_w60'] [@container(min-width:1140px)]:[grid-template-columns:minmax(0,1fr)_360px]"
                  >
                    <div className="min-w-0 [grid-area:hero]">
                      <HomeR1Hero language={language} askSends={gates.askEmbedded} suggestions={dict.hero.exampleQuestions} />
                    </div>
                    <aside aria-label={dict.homeReva.w60.title} className="min-w-0 self-start [grid-area:w60] [@container(min-width:1140px)]:pt-6">
                      <HomeR1World60 items={worldIn60} language={language} />
                    </aside>
                    <div className="min-w-0 [grid-area:whats]">
                      <HomeR1Stories
                        stories={stories}
                        dataMode={dataMode}
                        language={language}
                        cardActions={gates.cardActions}
                        compareTray={gates.compareTray}
                      />
                    </div>
                  </div>
                  <div className="mt-10 flex flex-col gap-10">
                    <HomeR1Bridge language={language} />
                    <HomeR1Explore language={language} />
                  </div>
                </div>
              </main>
            </div>
          </div>
          <Footer language={language} />
          <HomeR1PhoneNav language={language} />
          {gates.compareTray && (
            <HomeR1Compare
              language={language}
              compareView={gates.compareView}
              askEmbedded={gates.askEmbedded}
              askContextRefs={gates.askContextRefs}
            />
          )}
        </HomeR1Canvas>
      </HomeSessionProvider>
    </>
  );
}
