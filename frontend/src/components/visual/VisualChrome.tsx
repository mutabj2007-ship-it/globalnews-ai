'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { BookMarked, Compass, Globe2, Home, Map as MapIcon, MessagesSquare, Sparkles, type LucideIcon } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AccountControl } from '@/components/navigation/AccountControl';
import { HomeLanguageControl } from '@/components/home/HomeLanguageControl';
import { Logo } from '@/components/ui/Logo';
import { ThemeControl } from '@/components/platform/ThemeControl';
import { AlertsBell } from '@/components/home/r1/stageb/AlertsCentre';
import { VISUAL_HOME_HREF, VISUAL_PHONE_NAV, VISUAL_TOP_NAV, type VisualNavKey } from '@/lib/visual/visualNav';
import type { ThemePreference } from '@/lib/theme/theme';

/**
 * COMPACT VISUAL PRODUCT R1 — HEADER AND PHONE NAVIGATION (Design: navy top bar; light bottom bar).
 *
 * Every item is a real destination from lib/visual/visualNav.ts. The Updates control is the real
 * Alerts bell (signed-in readers, alerts.inApp). Theme is the existing four-mode control —
 * System · Light · Dark · Scheduled (H0 ruling 5). Language and account are the existing
 * controls. Below 900 px the top bar is brand + utilities only and the bottom bar navigates
 * (design doc 01); from 900 px the destinations sit in the top bar.
 */
const TOP_ICONS: Record<VisualNavKey, LucideIcon> = {
  home: Home,
  worldMap: MapIcon,
  ask: MessagesSquare,
  savedAskBriefings: BookMarked,
  explore: Compass,
};

export function VisualHeader({
  language,
  theme,
  alerts,
}: {
  readonly language: LanguageCode;
  readonly theme: ThemePreference;
  readonly alerts: { readonly replies: boolean } | null;
}): JSX.Element {
  const dict = getDictionary(language);
  const nav = dict.navBar;
  const t = dict.visual.nav;
  return (
    <header data-visual-header="" className="sticky top-0 z-50 bg-[var(--gt-hdr)]">
      <div className="mx-auto flex min-h-[56px] w-full max-w-[1360px] flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 min-[600px]:px-6 min-[900px]:min-h-[60px] min-[900px]:px-8">
        <Link href={VISUAL_HOME_HREF} className="flex min-h-[44px] shrink-0 items-center" aria-label={nav.homeAriaLabel}>
          <Logo size={24} gapPx={8} className="hidden min-[400px]:inline-flex" />
          <Logo size={24} gapPx={8} showWordmark={false} className="min-[400px]:hidden" />
        </Link>
        <nav aria-label={t.aria} className="hidden min-w-0 min-[900px]:block">
          <ul className="flex flex-wrap items-center gap-1">
            {VISUAL_TOP_NAV.map(({ key, href }) => {
              const Icon = TOP_ICONS[key];
              const current = key === 'home';
              return (
                <li key={key}>
                  <a
                    href={href}
                    aria-current={current ? 'page' : undefined}
                    data-visual-nav={key}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-3 text-[0.875rem] font-semibold ${
                      current ? 'bg-white/10 text-white' : 'text-[var(--gt-hdrInk)] hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {t[key]}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0 flex-1" />
        <ThemeControl language={language} initial={theme} />
        {alerts !== null && <AlertsBell language={language} replies={alerts.replies} />}
        <div className="hidden min-[600px]:block">
          <HomeLanguageControl language={language} label={nav.languageSelectorLabel} actionLabel={nav.languageSelectorAction} />
        </div>
        <div className="min-[600px]:hidden">
          <HomeLanguageControl language={language} label={nav.languageSelectorLabel} actionLabel={nav.languageSelectorAction} variant="mobile" />
        </div>
        <AccountControl
          myIntelligenceLabel={dict.myIntelligence.accountMenuItem}
          myIntelligenceTag={dict.myIntelligence.accountMenuItemTag}
          signInLabel={nav.signIn}
          signInClassName="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-[0.5rem] border border-white/40 px-3 text-[0.875rem] font-semibold text-white hover:bg-white/[0.06]"
          accountLabel={nav.account}
          accountMenuAriaLabel={nav.accountMenuAriaLabel}
          signedInAsLabel={nav.signedInAs}
          historyLabel={nav.history}
          supportLabel={nav.support}
          settingsLabel={nav.settings}
          signOutLabel={nav.signOut}
        />
      </div>
    </header>
  );
}

const PHONE_ICONS = { home: Home, worldMap: Globe2, ask: MessagesSquare, intelligence: Sparkles } as const;

export function VisualPhoneNav({ language }: { readonly language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.nav;
  const labels = { home: t.home, worldMap: t.worldMap, ask: t.ask, intelligence: t.intelligence };
  return (
    <nav
      aria-label={t.phoneAria}
      data-gn-bottom-nav=""
      data-visual-phone-nav=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--gt-line)] bg-[var(--gt-chrome)] backdrop-blur-md min-[900px]:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around">
        {VISUAL_PHONE_NAV.map(({ key, href }) => {
          const Icon = PHONE_ICONS[key];
          const current = key === 'home';
          return (
            <li key={key} className="min-w-0 flex-1">
              <a
                href={href}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-1.5 ${current ? 'text-[var(--gt-navOn)]' : 'text-[var(--gt-chromeIc)]'}`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                <span className="text-center text-[0.75rem] font-semibold leading-tight [overflow-wrap:anywhere]">{labels[key]}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
