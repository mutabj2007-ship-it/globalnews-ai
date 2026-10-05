import type { JSX } from 'react';
import type { HomeEditorialResponse, HomeStoryCard, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { HomeR1Gates } from '@/lib/platform/homeR1Gates';
import type { ThemePreference } from '@/lib/theme/theme';
import { HomeSessionProvider } from '@/components/home/reva/HomeSession';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';
import { Footer } from '@/components/layout/Footer';
import { HomeR1Canvas } from '@/components/home/r1/HomeR1Chrome';
import { StageBHost } from '@/components/home/r1/stageb/StageBHost';
import { VisualHeader, VisualPhoneNav } from './VisualChrome';
import { VisualMain } from './VisualMain';
import { VisualBriefPanel } from './VisualBriefPanel';
import { HomeHeroSection } from './home/HomeHeroSection';
import { HomeRegionRows } from './home/HomeRegionRows';
import { HomeAskSection } from './home/HomeAskSection';
import { OwnerAccessBar } from './home/OwnerAccessBar';
import { degradedRows } from './home/degradedRows';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHONE-FIRST HOME CORRECTION R1 — THE CORRECTED HOME COMPOSITION (`/visual`, Alpha)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   HEADER   navy top bar (unchanged)
 *   HERO     Search stories (persisted story search) · Your world in 60 seconds (personal major
 *            story) · the legacy GlobalNewsAI world map beside it (below it, compact, on a phone)
 *   ROWS     East Africa · European Union · Middle East — compact legacy cards, business/conflict
 *            only (enforced server-side before selection)
 *   ASK      Ask GlobalNewsAI in its lower place — the same one Ask engine
 *   FOOTER   the one shared Footer (Privacy, Cookies, Terms, Source policy, Help)
 *
 * REMOVED from Home by Product Owner ruling: "Explore intelligence" (the module wall). The modules,
 * their data and their standalone routes are untouched; only the Home section is gone, with no
 * placeholder left behind.
 *
 * Every card uses the canonical articleRef the Story Brief, Discussion, Alerts and Admin
 * (/admin/news/stories?articleRef=) already use — Home owns no story store.
 */
export function VisualHomePage({
  language,
  gates,
  editorial,
  examples,
  theme,
}: {
  readonly language: LanguageCode;
  readonly gates: HomeR1Gates;
  readonly editorial: HomeEditorialResponse | null;
  readonly examples: readonly string[];
  readonly theme: ThemePreference;
}): JSX.Element {
  const t = getDictionary(language).visual.home;
  const rows = editorial?.regions ?? degradedRows();
  const visibleCards: HomeStoryCard[] = [
    ...(editorial?.hero ? [editorial.hero.story, ...editorial.hero.more] : []),
    ...rows.flatMap((r) => r.stories),
  ];
  return (
    <HomeSessionProvider>
      <HomeR1Canvas theme={theme}>
        <div data-visual-home="" data-home-correction="phone-first-r1">
          <VisualHeader language={language} theme={theme} alerts={gates.alertsInApp ? { replies: gates.discussionRead } : null} />
          <VisualMain>
            <div className="mx-auto w-full max-w-[1360px] px-3 min-[360px]:px-4 min-[600px]:px-6 min-[900px]:px-8">
              <p data-visual-preview-banner="" className="mt-2 rounded-[0.5rem] border border-[var(--gt-line)] bg-[var(--gt-card)] px-3 py-1.5 text-[0.75rem] text-[var(--gt-ink2)]">
                {t.previewBanner}
              </p>
              <OwnerAccessBar language={language} />
              <AuthErrorBanner language={language} />
              <div className="mt-3 flex flex-col gap-7 min-[600px]:mt-4 min-[600px]:gap-9">
                <HomeHeroSection editorial={editorial} language={language} discussionRead={gates.discussionRead} />
                <HomeRegionRows rows={rows} language={language} discussionRead={gates.discussionRead} />
                <HomeAskSection language={language} examples={examples} />
              </div>
            </div>
          </VisualMain>
          <Footer language={language} />
          <VisualPhoneNav language={language} />
          {(gates.discussionRead || gates.alertsInApp) && (
            <StageBHost
              language={language}
              articleRefs={visibleCards.slice(0, 60).map((c) => c.articleRef)}
              discussionRead={gates.discussionRead}
              discussionWrite={gates.discussionWrite}
              alertsInApp={gates.alertsInApp}
            />
          )}
          <VisualBriefPanel language={language} discussionRead={gates.discussionRead} alertsInApp={gates.alertsInApp} />
        </div>
      </HomeR1Canvas>
    </HomeSessionProvider>
  );
}
