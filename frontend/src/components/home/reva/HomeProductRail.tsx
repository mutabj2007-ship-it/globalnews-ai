'use client';

import type { JSX } from 'react';
import { useState } from 'react';
import {
  Activity,
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
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  SlidersHorizontal,
  User,
  Vote,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { useHomeSession } from './HomeSession';
import {
  ANALYSIS_WORKSPACE_HREF,
  HEADER_LANGUAGE_ID,
  HOME_RAIL,
  RESOLVED_DOMAINS,
  SPECIALIST_LINKS,
  type ExploreDomainKey,
} from './homeRevaModel';

/**
 * HOME WELCOME & DISCOVERY R1 REV A — THE PREMIUM LEFT PRODUCT RAIL (D1 CLOSED).
 *
 * Authority: LEFT_RAIL_SPEC.md. Rail = product DESTINATIONS only; the header
 * owns quick actions. So, anonymous: no second "Sign in" CTA (the Account row
 * carries "Sign in to personalize" at secondary weight on the same auth path),
 * and My Intelligence says "Available after sign-in" with no Sign in badge.
 * Language: the header has the one quick switch; this rail's "Language &
 * region" row hands off to it rather than rendering a second selector (no
 * language/region settings page exists yet — reported as a gap).
 *
 * Geometry: 64 px icon rail at 1024–1279 (not expandable there), 248 px at
 * ≥1280 with a Collapse toggle. D19: the collapsed state is PAGE-SESSION ONLY
 * (React state) — no browser storage and no account backend, consistent with
 * the My Intelligence no-storage rule.
 *
 * Every row is a real <a href> with visible text; icon-only rows keep `title`
 * and `aria-label`. Navigation spends nothing: 0 AI, 0 provider.
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

export function HomeProductRail({ language }: { language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.homeReva.rail;
  const domains = dict.homeReva.explore.domains;
  const { user, isLoading } = useHomeSession();
  const [collapsed, setCollapsed] = useState(false);
  const signedIn = !isLoading && user !== null;

  /* Labels show only on the expanded rail (≥1280, not collapsed). */
  const labelClass = collapsed ? 'sr-only' : 'sr-only xl:not-sr-only';

  const row = (key: string, props: RowProps): JSX.Element => <RailRow key={key} {...props} labelClass={labelClass} />;

  return (
    <aside
      data-home-rail={collapsed ? 'collapsed' : 'auto'}
      style={{ ['--rail-collapsed' as string]: `${HOME_RAIL.collapsedPx}px` }}
      className={`sticky top-[64px] z-30 hidden h-[calc(100dvh-64px)] shrink-0 flex-col border-r border-[#0a2744] bg-[#020f22] lg:flex lg:w-[64px] ${
        collapsed ? '' : 'xl:w-[248px]'
      }`}
    >
      <nav aria-label={t.ariaLabel} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 [scrollbar-width:thin]">
        <ul className="flex flex-col gap-0.5">
          {row('home', { href: '/', icon: Home, label: t.home, current: true })}
          {row('map', { href: '/map', icon: MapIcon, label: t.worldMap })}
          {row('ask', { href: '/ask', icon: MessagesSquare, label: t.askAi })}
          {row('mi', {
            href: '/my-intelligence',
            icon: LayoutDashboard,
            label: t.myIntelligence,
            sub: signedIn || isLoading ? undefined : t.myIntelligenceAnon,
          })}
        </ul>

        <Section label={t.sections.intelligence} collapsed={collapsed} />
        <ul className="flex flex-col gap-0.5">
          {RESOLVED_DOMAINS.map((domain) =>
            domain.href === null
              ? null
              : row(domain.key, {
                  href: domain.href,
                  icon: DOMAIN_ICONS[domain.key],
                  label: domains[domain.key].name,
                  tag: domain.preview ? t.preview : undefined,
                }),
          )}
        </ul>

        <Section label={t.sections.specialists} collapsed={collapsed} />
        <ul className="flex flex-col gap-0.5">
          {row('elections', { href: SPECIALIST_LINKS.elections.href, icon: Vote, label: t.elections, tag: t.preview })}
          {row('imihigo', { href: SPECIALIST_LINKS.imihigo.href, icon: Building2, label: t.imihigo })}
        </ul>

        <Section label={t.sections.deep} collapsed={collapsed} />
        <ul className="flex flex-col gap-0.5">
          {row('workspace', { href: ANALYSIS_WORKSPACE_HREF, icon: Activity, label: t.analysisWorkspace })}
        </ul>

        <Section label={t.sections.account} collapsed={collapsed} />
        <ul className="flex flex-col gap-0.5">
          {signedIn ? (
            <>
              {row('account', { href: '/account/settings', icon: User, label: t.account })}
              {row('preferences', { href: '/my-intelligence', icon: SlidersHorizontal, label: t.preferences })}
              <LanguageRow label={t.language} sub={t.languageSub} labelClass={labelClass} />
              <li>
                <span
                  title={`${t.plan} · ${t.soon}`}
                  aria-label={`${t.plan} · ${t.soon}`}
                  data-home-rail-row="plan"
                  className="flex min-h-[34px] items-center gap-3 rounded-[8px] px-2.5 text-[14px] font-semibold text-[#6f86a1]"
                >
                  <Gauge aria-hidden="true" className="h-5 w-5 shrink-0" />
                  <span className={`${labelClass} min-w-0 flex-1 truncate`}>{t.plan}</span>
                  <span className={`${labelClass} font-mono text-[10px] uppercase tracking-[0.1em] text-[#56708e]`}>{t.soon}</span>
                </span>
              </li>
              {row('settings', { href: '/account/settings', icon: Settings, label: t.settings })}
            </>
          ) : (
            <>
              {row('account', { href: accountSignInUrl('/'), icon: User, label: t.account, sub: isLoading ? undefined : t.accountAnon })}
              <LanguageRow label={t.language} sub={t.languageSub} labelClass={labelClass} />
            </>
          )}
        </ul>
      </nav>

      <div className="hidden border-t border-[#0a2744] p-2 xl:block">
        <button
          type="button"
          aria-pressed={collapsed}
          aria-label={collapsed ? t.expand : t.collapse}
          title={collapsed ? t.expand : t.collapse}
          onClick={() => setCollapsed((was) => !was)}
          className="flex min-h-[40px] w-full items-center gap-3 rounded-[8px] px-2.5 text-[14px] font-semibold text-[#8fa6c0] hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5]"
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-5 w-5 shrink-0" /> : <PanelLeftClose aria-hidden="true" className="h-5 w-5 shrink-0" />}
          <span className={labelClass}>{t.collapse}</span>
        </button>
      </div>
    </aside>
  );
}

interface RowProps {
  href: string;
  icon: LucideIcon;
  label: string;
  sub?: string;
  tag?: string;
  current?: boolean;
}

function RailRow({ href, icon: Icon, label, sub, tag, current = false, labelClass }: RowProps & { labelClass: string }): JSX.Element {
  const name = [label, sub, tag].filter(Boolean).join(' · ');
  return (
    <li>
      <a
        href={href}
        aria-current={current ? 'page' : undefined}
        title={name}
        data-home-rail-row=""
        className={`group flex min-h-[34px] items-center gap-3 rounded-[8px] px-2.5 py-1 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none ${
          current ? 'bg-[#07304f] text-white' : 'text-[#c3d4e6] hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${current ? 'text-[#5abff5]' : 'text-[#8fa6c0] group-hover:text-[#cfe2f2]'}`} />
        <span className={`${labelClass} min-w-0 flex-1`}>
          <span className="block truncate leading-[1.2]">{label}</span>
          {sub === undefined ? null : <span className="block truncate text-[11.5px] font-normal leading-[1.3] text-[#8299b4]">{sub}</span>}
        </span>
        {tag === undefined ? null : (
          <span className={`${labelClass} rounded-[4px] border border-[#3a3326] px-1.5 py-[1px] text-[10px] font-semibold text-[#c9ae86]`}>{tag}</span>
        )}
      </a>
    </li>
  );
}

function LanguageRow({ label, sub, labelClass }: { label: string; sub: string; labelClass: string }): JSX.Element {
  /* Hands off to the header's one quick switch — never a second selector. */
  const focusHeaderSwitch = (): void => {
    const target = document.getElementById(HEADER_LANGUAGE_ID)?.querySelector<HTMLElement>('button, select, [role="combobox"]');
    target?.focus();
    target?.click();
  };
  return (
    <li>
      <button
        type="button"
        onClick={focusHeaderSwitch}
        title={`${label} · ${sub}`}
        data-home-rail-row="language"
        className="group flex min-h-[34px] w-full items-center gap-3 rounded-[8px] px-2.5 py-1 text-left text-[14px] font-semibold text-[#c3d4e6] transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
      >
        <Languages aria-hidden="true" className="h-5 w-5 shrink-0 text-[#8fa6c0] group-hover:text-[#cfe2f2]" />
        <span className={`${labelClass} min-w-0 flex-1`}>
          <span className="block truncate leading-[1.2]">{label}</span>
          <span className="block truncate text-[11.5px] font-normal leading-[1.3] text-[#8299b4]">{sub}</span>
        </span>
      </button>
    </li>
  );
}

function Section({ label, collapsed }: { label: string; collapsed: boolean }): JSX.Element {
  return (
    <p
      aria-hidden={collapsed ? 'true' : undefined}
      className={`mb-1 mt-4 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#56708e] ${collapsed ? 'h-px overflow-hidden bg-[#0a2744] text-transparent' : 'hidden xl:block'}`}
    >
      {collapsed ? '' : label}
    </p>
  );
}

