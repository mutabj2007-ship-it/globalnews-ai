import type { JSX } from 'react';
import type { LanguageCode, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { HomeR1Gates } from '@/lib/platform/homeR1Gates';
import type { ThemePreference } from '@/lib/theme/theme';
import { HomeSessionProvider } from '@/components/home/reva/HomeSession';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';
import { Footer } from '@/components/layout/Footer';
import { HomeR1Canvas } from '@/components/home/r1/HomeR1Chrome';
import { HomeR1Explore } from '@/components/home/r1/HomeR1Sections';
import { StageBHost } from '@/components/home/r1/stageb/StageBHost';
import { VisualHeader, VisualPhoneNav } from './VisualChrome';
import { VisualHero } from './VisualHero';
import { VisualMain } from './VisualMain';
import { VisualStoryFeed, type VisualStory } from './VisualStoryFeed';
import { VisualBriefPanel } from './VisualBriefPanel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE PAGE COMPOSITION (Design R1, frames RF01–RF18)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   HEADER   navy top bar (brand · real destinations from 900 px · theme · Updates · language · account)
 *   HERO     navy card: heading, ONE Ask, examples │ the real Global Map + region meaning
 *   STORIES  "Developing stories" — up to three columns, never under 280 px
 *   EXPLORE  the registry-backed intelligence modules (the existing section, reused)
 *   FOOTER   the one shared Footer (real legal / support routes)
 *   PHONE    the light bottom bar (four real destinations), safe-area aware
 *   BRIEF    beside the feed ≥1200 · drawer 600–1199 · sheet <600
 *
 * Content max width 1360 px; gutters 12 / 16 / 24 / 32 px by width (design doc 01). Every
 * capability is the existing one, behind its existing gate: Discussion and Alerts render only
 * where Stage B says they exist; the Story Brief only where the canonical backend serves it.
 */
export function VisualHomePage({
  language,
  gates,
  stories,
  dataMode,
  examples,
  theme,
}: {
  readonly language: LanguageCode;
  readonly gates: HomeR1Gates;
  readonly stories: readonly VisualStory[];
  readonly dataMode: NewsDataMode | null;
  readonly examples: readonly string[];
  readonly theme: ThemePreference;
}): JSX.Element {
  const t = getDictionary(language).visual;
  return (
    <HomeSessionProvider>
      <HomeR1Canvas theme={theme}>
        <div data-visual-home="">
          <VisualHeader language={language} theme={theme} alerts={gates.alertsInApp ? { replies: gates.discussionRead } : null} />
          <VisualMain>
            <div className="mx-auto w-full max-w-[1360px] px-3 min-[360px]:px-4 min-[600px]:px-6 min-[900px]:px-8">
              <p data-visual-preview-banner="" className="mt-3 rounded-[0.5rem] border border-[var(--gt-line)] bg-[var(--gt-card)] px-3 py-2 text-[0.8125rem] text-[var(--gt-ink2)]">
                {t.previewBanner}
              </p>
              <AuthErrorBanner language={language} />
              <div className="mt-4 flex flex-col gap-8 min-[600px]:mt-6 min-[600px]:gap-10">
                <VisualHero language={language} examples={examples} />
                <VisualStoryFeed stories={stories} dataMode={dataMode} language={language} discussionRead={gates.discussionRead} />
                <HomeR1Explore language={language} />
              </div>
            </div>
          </VisualMain>
          <Footer language={language} />
          <VisualPhoneNav language={language} />
          {(gates.discussionRead || gates.alertsInApp) && (
            <StageBHost
              language={language}
              articleRefs={stories.map((s) => s.articleRef)}
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
