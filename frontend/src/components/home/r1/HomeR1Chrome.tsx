'use client';

import type { JSX, ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2,
  CandlestickChart,
  Gauge,
  Globe2,
  HeartHandshake,
  Home,
  Landmark,
  Languages,
  LayoutDashboard,
  LineChart,
  Map as MapIcon,
  MessagesSquare,
  Shield,
  Sparkles,
  User,
  Vote,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { AccountControl } from '@/components/navigation/AccountControl';
import { HomeLanguageControl } from '@/components/home/HomeLanguageControl';
import { Logo } from '@/components/ui/Logo';
import { useHomeSession } from '@/components/home/reva/HomeSession';
import { RESOLVED_DOMAINS, SPECIALIST_LINKS, type ExploreDomainKey } from '@/components/home/reva/homeRevaModel';

/**
 * HOME R1 · STAGE A — NAVIGATION (FINAL spec §1, Design R1-N1, R1-N3).
 *
 * Controlled navy appears ONLY on the header bar (desktop) / top bar (phone); the rail and
 * the bottom navigation are light. Desktop: Home · World Map · Ask GlobalNewsAI · My
 * Intelligence; the Intelligence group (the 7 governed domains, from the ONE module
 * registry); Specialists; Account & control. The visible "Analysis Workspace" label is
 * RETIRED here (R1-N3) — the /search route itself is untouched and still an OAuth return
 * destination. Discussions and Alerts are never navigation. "Plan & Usage" stays "Soon":
 * no plan name, price or allowance exists (WP8 not authorised).
 *
 * Phone: exactly four slots — Home · World Map · Ask · Intelligence (PL Start · Mapa świata
 * · Zapytaj · Analiza); the Ask tab uses the composer's forum glyph.
 */
const DOMAIN_ICONS: Record<ExploreDomainKey, LucideIcon> = {
  world: Globe2,
  politics: Landmark,
  economy: LineChart,
  energy: Zap,
  security: Shield,
  humanitarian: HeartHandshake,
  markets: CandlestickChart,
};

export function HomeR1Header({ language }: { readonly language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const nav = dict.navBar;
  return (
    <header data-home-r1-header="" className="sticky top-0 z-50 h-[56px] bg-[#0B1F3A] lg:h-[60px]">
      <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 lg:px-5">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2" aria-label={nav.homeAriaLabel}>
          <Logo size={24} gapPx={8} />
          {/* The BETA chip from 400 px: at 360 the top bar keeps brand, language and Sign in on one line. */}
          <span className="hidden rounded-[5px] border border-cyan-400/35 bg-cyan-400/10 px-1.5 py-[2px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cyan-200 min-[400px]:inline">
            {dict.homeR1.nav.brandBeta}
          </span>
        </Link>
        <div className="min-w-0 flex-1" />
        <div id="home-r1-language" className="hidden sm:block">
          <HomeLanguageControl language={language} label={nav.languageSelectorLabel} actionLabel={nav.languageSelectorAction} />
        </div>
        {/* Phone: the compact selector (globe + code), so the top bar never overflows at 360. */}
        <div className="sm:hidden">
          <HomeLanguageControl language={language} label={nav.languageSelectorLabel} actionLabel={nav.languageSelectorAction} variant="mobile" />
        </div>
        <AccountControl
          myIntelligenceLabel={dict.myIntelligence.accountMenuItem}
          myIntelligenceTag={dict.myIntelligence.accountMenuItemTag}
          signInLabel={nav.signIn}
          signInClassName="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border border-white/40 px-3 text-[14px] font-semibold text-white hover:bg-white/[0.06] sm:px-4"
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

function RailRow({
  href,
  icon: Icon,
  label,
  sub,
  tag,
  current,
}: {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly sub?: string;
  readonly tag?: string;
  readonly current?: boolean;
}): JSX.Element {
  return (
    <li>
      <a
        href={href}
        aria-current={current ? 'page' : undefined}
        title={label}
        className={`flex min-h-[40px] items-center gap-3 rounded-[8px] px-2.5 py-1 text-[14px] font-semibold ${
          current ? 'bg-[#E8EEF6] text-[#14243B]' : 'text-[#33465E] hover:bg-[#EEF2F7] hover:text-[#14243B]'
        }`}
      >
        <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#526174]" />
        <span className="sr-only min-w-0 flex-1 xl:not-sr-only">
          <span className="block truncate">{label}</span>
          {sub !== undefined && <span className="block truncate text-[11px] font-normal text-[#7A8AA0]">{sub}</span>}
        </span>
        {tag !== undefined && (
          <span className="sr-only rounded-[5px] border border-[#DCE3EA] px-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#7A8AA0] xl:not-sr-only">
            {tag}
          </span>
        )}
      </a>
    </li>
  );
}

function Section({ label }: { readonly label: string }): JSX.Element {
  return (
    <p className="sr-only mb-1 mt-4 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A8AA0] xl:not-sr-only">
      {label}
    </p>
  );
}

export function HomeR1Rail({ language }: { readonly language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.homeR1.nav;
  const domains = dict.homeReva.explore.domains;
  const { user, isLoading } = useHomeSession();
  const signedIn = !isLoading && user !== null;
  /* Same-origin destinations only: settings, or the governed Google sign-in returning Home. */
  const accountDestination = signedIn ? '/account/settings' : accountSignInUrl('/');
  return (
    <aside
      data-home-r1-rail=""
      className="sticky top-[60px] z-30 hidden h-[calc(100dvh-60px)] w-[64px] shrink-0 border-r border-[#DCE3EA] bg-white lg:block xl:w-[248px]"
    >
      <nav aria-label={t.ariaLabel} className="h-full overflow-y-auto overscroll-contain px-2 py-3 [scrollbar-width:thin]">
        <ul className="flex flex-col gap-0.5">
          <RailRow href="/" icon={Home} label={t.home} current />
          <RailRow href="/map" icon={MapIcon} label={t.worldMap} />
          <RailRow href="/ask" icon={MessagesSquare} label={t.ask} />
          <RailRow
            href="/my-intelligence"
            icon={LayoutDashboard}
            label={t.myIntelligence}
            {...(signedIn || isLoading ? {} : { sub: t.myIntelligenceAnon })}
          />
        </ul>
        <Section label={t.sections.intelligence} />
        <ul className="flex flex-col gap-0.5">
          {RESOLVED_DOMAINS.map((domain) =>
            domain.href === null ? null : (
              <RailRow
                key={domain.key}
                href={domain.href}
                icon={DOMAIN_ICONS[domain.key]}
                label={domains[domain.key].name}
                {...(domain.preview ? { tag: t.preview } : {})}
              />
            ),
          )}
        </ul>
        <Section label={t.sections.specialists} />
        <ul className="flex flex-col gap-0.5">
          <RailRow href={SPECIALIST_LINKS.elections.href} icon={Vote} label={t.elections} tag={t.preview} />
          <RailRow href={SPECIALIST_LINKS.imihigo.href} icon={Building2} label={t.imihigo} />
        </ul>
        <Section label={t.sections.account} />
        <ul className="flex flex-col gap-0.5">
          <RailRow
            href={accountDestination}
            icon={User}
            label={t.account}
            {...(signedIn || isLoading ? {} : { sub: t.accountAnon })}
          />
          <RailRow href="#home-r1-language" icon={Languages} label={t.language} sub={t.languageSub} />
          {signedIn && (
            <li>
              <span
                data-home-r1-plan="soon"
                aria-label={`${t.planUsage} · ${t.soon}`}
                className="flex min-h-[40px] items-center gap-3 rounded-[8px] px-2.5 text-[14px] font-semibold text-[#7A8AA0]"
              >
                <Gauge aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                <span className="sr-only min-w-0 flex-1 truncate xl:not-sr-only">{t.planUsage}</span>
                <span className="sr-only font-mono text-[10px] uppercase tracking-[0.1em] xl:not-sr-only">{t.soon}</span>
              </span>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  );
}

export function HomeR1PhoneNav({ language }: { readonly language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeR1.nav;
  const items: readonly { key: string; href: string; icon: LucideIcon; label: string; current?: boolean }[] = [
    { key: 'home', href: '/', icon: Home, label: t.phone.home, current: true },
    { key: 'map', href: '/map', icon: Globe2, label: t.phone.worldMap },
    { key: 'ask', href: '/ask', icon: MessagesSquare, label: t.phone.ask },
    { key: 'intelligence', href: '#explore-intelligence', icon: Sparkles, label: t.phone.intelligence },
  ];
  return (
    <nav
      aria-label={t.phoneAria}
      data-gn-bottom-nav=""
      data-home-r1-phone-nav=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DCE3EA] bg-white/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map(({ key, href, icon: Icon, label, current }) => (
          <li key={key} className="flex-1">
            <a
              href={href}
              aria-current={current ? 'page' : undefined}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 ${current ? 'text-[#245FC7]' : 'text-[#526174]'}`}
            >
              <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-center font-mono text-[11.5px] uppercase leading-tight">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The light canvas the whole R1 Home sits on. */
export function HomeR1Canvas({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <div data-home-r1="" data-home-theme="light" className="min-h-[100dvh] bg-[#F3F6F9] text-[#14243B]">
      {children}
    </div>
  );
}
