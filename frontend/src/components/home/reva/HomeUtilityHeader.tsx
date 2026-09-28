import type { JSX } from 'react';
import Link from 'next/link';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AccountControl } from '@/components/navigation/AccountControl';
import { HomeLanguageControl } from '@/components/home/HomeLanguageControl';
import { Logo } from '@/components/ui/Logo';
import { HeaderAskLauncher } from './HeaderAskLauncher';
import { HEADER_LANGUAGE_ID } from './homeRevaModel';

/**
 * HOME WELCOME & DISCOVERY R1 REV A — THE UTILITY HEADER (≥1024).
 *
 * Authority: LEFT_RAIL_SPEC "Header / rail division", REV_A_DELTA row 2.
 * Header = quick actions only: identity, the compact Ask launcher (D2 — only
 * once the Hero composer has scrolled out), search, the ONE quick language
 * switch, and the account control (the ONE anonymous "Sign in"; an avatar
 * menu when signed in). No product destination is repeated here — the rail
 * owns destinations.
 *
 * Below 1024 Home keeps the existing NavBar and four-item bottom navigation
 * unchanged. `BetaHomeHeader` stays as the My Intelligence page header; Home
 * no longer renders it.
 */
export function HomeUtilityHeader({ language }: { language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.navBar;

  return (
    <header
      data-home-utility-header=""
      className="sticky top-0 z-50 hidden h-[64px] border-b border-[#0a2744] bg-[rgba(2,13,29,0.94)] backdrop-blur-[12px] lg:block"
    >
      <div className="flex h-full items-center gap-3 px-4 xl:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={t.homeAriaLabel}>
          <Logo size={30} gapPx={11} />
          <span className="rounded-[5px] border border-cyan-400/35 bg-cyan-400/10 px-1.5 py-[2px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Beta
          </span>
        </Link>
        <div className="flex-1" />
        <HeaderAskLauncher label={dict.homeReva.header.askLauncher} ariaLabel={dict.homeReva.header.askLauncherAria} />
        <Link
          href="/search"
          prefetch={false}
          aria-label={t.searchAriaLabel}
          title={t.searchAriaLabel}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[#1b3a68] text-[#cfe2f2] transition-colors hover:border-[#2f6ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </Link>
        <div id={HEADER_LANGUAGE_ID}>
          <HomeLanguageControl language={language} label={t.languageSelectorLabel} actionLabel={t.languageSelectorAction} />
        </div>
        <AccountControl
          myIntelligenceLabel={dict.myIntelligence.accountMenuItem}
          myIntelligenceTag={dict.myIntelligence.accountMenuItemTag}
          signInLabel={t.signIn}
          signInClassName="inline-flex min-h-[44px] items-center rounded-full border border-[#2f6ea8] px-5 text-[14px] font-semibold text-white transition-colors hover:border-[#5abff5] hover:bg-white/[0.04]"
          accountLabel={t.account}
          accountMenuAriaLabel={t.accountMenuAriaLabel}
          signedInAsLabel={t.signedInAs}
          historyLabel={t.history}
          supportLabel={t.support}
          settingsLabel={t.settings}
          signOutLabel={t.signOut}
        />
      </div>
    </header>
  );
}
