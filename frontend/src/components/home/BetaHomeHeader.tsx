import type { JSX } from 'react';
import Link from 'next/link';

import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import { AccountControl } from '@/components/navigation/AccountControl';
import { HomeLanguageControl } from '@/components/home/HomeLanguageControl';
import { Logo } from '@/components/ui/Logo';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE BETA HOME HEADER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DESKTOP FIDELITY CORRECTION R2 §1, which settled the conflict I reported
 * rather than leaving it open:
 *
 *   "At the Product Owner prototype width, the Home must show the full desktop
 *    navigation, not the hamburger. Do not rewrite the global product
 *    navigation model merely to achieve this. If necessary, implement a
 *    Home-specific Beta header presentation that reads from canonical
 *    route/module truth but visually follows the prototype."
 *
 * That is exactly what this is, and the two halves of that instruction are why
 * it is a separate file.
 *
 * ── WHAT IS NOT TOUCHED ─────────────────────────────────────────────────
 *
 * `NavBar` is unmodified. `NAV_MODEL` is unmodified. The nine canonical nav
 * entries, their seven deliberate `kind: 'unavailable'` decisions — quota, not
 * design — and CTO decision D1's 1400px handoff all stand exactly as they
 * were, on every other surface and on this one below `lg`. Home renders THIS
 * header at `lg` and up and the existing mobile chrome below it; nothing about
 * the product's navigation model changed to make that happen.
 *
 * ── WHERE THE ROUTES COME FROM ──────────────────────────────────────────
 *
 * `INTELLIGENCE_MODULES`, gated by `isModuleNavigable`. Not a second table,
 * not a hand-written list of hrefs. Each item resolves its destination from
 * the registry at render time, so a module that loses its route loses its
 * header entry in the same edit, and no entry here can outlive the surface it
 * points at.
 *
 * The ruling's mapping, and how each one resolves:
 *
 *     Home          /                            the page itself
 *     World         #whats-happening-now         "World may route to the
 *                                                Home's world/current-
 *                                                developments anchor if no
 *                                                distinct World route exists"
 *                                                — and none does:
 *                                                `world-intelligence` is
 *                                                state 'comingSoon' with no
 *                                                destination.
 *     Economy       registry: economy            /economy-visual-preview
 *     Energy        registry: energy             /energy
 *     Security      registry: security           /security-visual-preview
 *     Humanitarian  registry: humanitarian       /humanitarian
 *     More ▾        World Map · Politics · Conflict · Market, plus any of the
 *                   above that has lost its route, shown as unavailable
 *
 * ── NO DEAD PRIMARY CONTROLS ────────────────────────────────────────────
 *
 * A primary item whose module is not navigable is NOT rendered as a primary
 * item. It falls into the More menu and is drawn there as an explicitly
 * unavailable row — named, so the reader can see the product intends it, and
 * inert, so pressing it cannot fail. Nothing in the primary row can be pressed
 * without going somewhere.
 *
 * ── "GET STARTED" IS DELIBERATELY ABSENT ────────────────────────────────
 *
 * The prototype draws `Sign In` and a filled `Get Started` beside it. There is
 * one authentication entry in this product and no separate registration route.
 * Two buttons to the same destination is a decoy: the reader reasonably infers
 * that one creates an account and the other signs in to an existing one, and
 * that inference would be wrong. So the header carries the real control —
 * `AccountControl`, which is state-aware and shows an account menu rather than
 * "Sign in" to someone already signed in, as §9 requires — and the second
 * button waits for a registration route to exist. Declared, not overlooked.
 */

/** The five primary destinations after Home, in the prototype's order. */
const PRIMARY_MODULE_IDS = ['economy', 'energy', 'security', 'humanitarian'] as const;

/** What the More menu offers, in registry order. */
const MORE_MODULE_IDS = ['country-intelligence', 'politics', 'conflict', 'market', 'world-intelligence'] as const;

interface BetaHomeHeaderProps {
  language?: LanguageCode;
}

export function BetaHomeHeader({ language = 'en' }: BetaHomeHeaderProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.navBar;
  const beta = dict.betaHome;
  const moduleText = dict.intelligenceModules.modules;

  const labelFor = (id: string): string => {
    /* The nav wording, where the prototype names one; otherwise the registry's
       own short title. The label never decides the destination. */
    const named = beta.navLabels[id];
    if (named !== undefined) return named;
    const entryModule = INTELLIGENCE_MODULES.find((m) => m.id === id);
    if (entryModule === undefined) return id;
    const entry = moduleText[entryModule.dictionaryKey as keyof typeof moduleText];
    return entry?.shortTitle ?? entry?.title ?? id;
  };

  const resolve = (id: string): string | null => {
    const entryModule = INTELLIGENCE_MODULES.find((m) => m.id === id);
    if (entryModule === undefined) return null;
    return isModuleNavigable(entryModule) && entryModule.destination !== undefined ? entryModule.destination : null;
  };

  const primary = PRIMARY_MODULE_IDS.map((id) => ({ id, label: labelFor(id), href: resolve(id) }));
  const primaryLive = primary.filter((e) => e.href !== null);
  /* A primary whose route vanished joins More as an unavailable row rather than
     becoming a control that goes nowhere. */
  const demoted = primary.filter((e) => e.href === null).map((e) => e.id);

  const more = [...MORE_MODULE_IDS, ...demoted].map((id) => ({
    id,
    label: labelFor(id),
    href: resolve(id),
  }));

  const navItem =
    'inline-flex h-[32px] items-center rounded-full px-3.5 text-[13.5px] font-medium text-[#b6c9de] transition-colors hover:bg-white/[0.07] hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none';

  return (
    <header className="sticky top-0 z-50 hidden border-b border-[#0a3358] bg-[rgba(3,21,45,0.90)] shadow-[0_1px_0_rgba(0,58,106,0.45)] backdrop-blur-[12px] lg:block">
      <div className="mx-auto flex h-[62px] max-w-cd-page items-center gap-5 px-[26px]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={t.homeAriaLabel}>
          <Logo size={30} gapPx={11} />
          {/*
            The BETA mark the prototype carries beside the wordmark. It is a
            statement about the product's stage, which is true, and it is the
            same word the footer already shows — so the header and the footer
            now agree instead of only one of them saying it.
          */}
          <span className="rounded-[5px] border border-cyan-400/35 bg-cyan-400/10 px-1.5 py-[2px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Beta
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label={t.primaryNavigationAriaLabel}>
          {/* Home is the page itself, so it carries the prototype's filled active pill. */}
          <Link
            href="/"
            aria-current="page"
            className={`${navItem} bg-[#12365e] text-white shadow-[inset_0_1px_0_rgba(150,200,255,0.18)]`}
          >
            {t.navItemLabels.home}
          </Link>

          {/* World: the current-developments anchor, per the ruling's own fallback. */}
          <a href="#whats-happening-now" className={navItem}>
            {t.navItemLabels.world}
          </a>

          {primaryLive.map((entry) => (
            <Link key={entry.id} href={entry.href as string} className={navItem}>
              {entry.label}
            </Link>
          ))}

          {/*
            MORE — a CSS-only disclosure. `<details>` gives the open/close
            behaviour, the keyboard operation and the accessible state without a
            client boundary, which keeps this whole header a Server Component.
          */}
          <details className="group relative">
            <summary
              className={`${navItem} cursor-pointer list-none gap-1 [&::-webkit-details-marker]:hidden`}
            >
              {beta.navMore}
              <span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="absolute left-0 top-[calc(100%+8px)] z-10 w-[232px] overflow-hidden rounded-xl border border-border-strong bg-[rgba(6,10,18,0.98)] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md">
              {more.map((entry) =>
                entry.href === null ? (
                  <span
                    key={entry.id}
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-[13px] text-ink-tertiary"
                  >
                    {entry.label}
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary/70">
                      {beta.navUnavailable}
                    </span>
                  </span>
                ) : (
                  <Link
                    key={entry.id}
                    href={entry.href}
                    className="flex items-center rounded-lg px-3 py-2 text-[13px] text-ink-secondary transition-colors hover:bg-white/[0.07] hover:text-ink-primary motion-reduce:transition-none"
                  >
                    {entry.label}
                  </Link>
                ),
              )}
            </div>
          </details>
        </nav>

        <div className="flex-1" />

        <Link
          href="/search"
          aria-label={t.searchAriaLabel}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-cd-edge-header transition-colors hover:border-[rgba(34,211,238,0.55)] motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="relative block h-[12px] w-[12px]">
            <span className="absolute inset-0 rounded-full border-[1.5px] border-[#9fc6e8]" />
            <span
              className="absolute h-[1.5px] w-[7px] bg-[#9fc6e8]"
              style={{ transform: 'translate(5px,4px) rotate(45deg)', marginTop: '-4px' }}
            />
          </span>
        </Link>

        <HomeLanguageControl
          language={language}
          label={t.languageSelectorLabel}
          actionLabel={t.languageSelectorAction}
        />

        <AccountControl
          signInLabel={t.signIn}
          signInClassName="rounded-[9px] border border-cd-edge-emphasis-50 bg-gradient-to-b from-[rgba(37,99,235,0.95)] to-[rgba(29,78,216,0.95)] px-5 py-[9px] font-cd-body text-cd-signin text-cd-ink-signin shadow-[0_0_22px_rgba(37,99,235,0.35)] transition-opacity hover:opacity-90"
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
