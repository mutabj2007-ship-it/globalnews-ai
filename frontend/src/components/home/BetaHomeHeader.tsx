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

/**
 * ── THE 1024-1279 HEADER, AND WHY THERE ARE TWO NAVS IN THIS FILE ───────
 *
 * C1, as ruled:
 *
 *   ">=1280: use the newer Product Owner prototype full desktop navigation.
 *    1024-1279: use the R5.1 approved compact desktop/tablet header with its
 *    exact four destinations, search, language and account/avatar.
 *    Do not hide required search/language controls merely to fit the 1280
 *    header into 1024."
 *
 * That is two different navigations, not one navigation that shrinks, so the
 * file carries both and shows exactly one. The compact set is R5.1
 * `NAVIGATION.md` verbatim -- "Home / World Map / Ask AI / Intelligence",
 * with "No Explore, Saved, Watch, Notifications, story route or fifth tab" --
 * and it is drawn in `1440x900_H3_home_top_categories_dark.png`.
 *
 * WHY THIS REPLACED THE EARLIER FIX. The first attempt kept the seven-item
 * prototype nav at 1024 and hid the search and language controls to make it
 * fit. It did fit. It was still wrong: at 1024 the approved design is a
 * four-destination header that HAS those controls, so hiding them solved an
 * overflow by contradicting the authority that governs that width. The
 * overflow was a symptom of using the wrong navigation, not of having too
 * many controls.
 *
 * Both navs are `hidden` at the widths where they do not apply, which takes
 * them out of the accessibility tree as well as out of the layout, so a
 * screen reader is never offered two primary navigations.
 */

/** R5.1 NAVIGATION.md, in its order. Home is rendered separately. */
const COMPACT_DESTINATIONS = [
  { id: 'map', href: '/map', labelKey: 'worldMap' },
  { id: 'ask', href: '/ask', labelKey: 'ask' },
  { id: 'intelligence', href: '#intelligence-modules', labelKey: 'intelligence' },
] as const;

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
  /* The four R5.1 destinations already have governed EN and PL labels: they
     are the ones `MobileBottomNav` prints, which is the same four-destination
     vocabulary R5.1 specifies at every size. No new dictionary keys, and the
     tablet header and the phone bar cannot drift apart in wording. */
  const compact = dict.mobileBottomNav;
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

  /*
    1024 is iPad landscape — a TOUCH surface, not merely a small desktop. R5.1's
    shell floor is "Targets >=44px everywhere", and the ruling is explicit that
    fit problems are not to be solved by shrinking controls. So the destinations
    are 44px through the compact header's whole range and only relax to the
    Product Owner prototype's 32px pill at `xl`, where the header is the
    mouse-driven desktop one.
  */
  const navItem =
    'inline-flex h-[44px] items-center rounded-full px-3 text-[13px] font-medium text-[#b6c9de] transition-colors hover:bg-white/[0.07] hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none xl:h-[32px] xl:px-3.5 xl:text-[13.5px]';

  return (
    <header className="sticky top-0 z-50 hidden border-b border-[#0a3358] bg-[rgba(3,21,45,0.90)] shadow-[0_1px_0_rgba(0,58,106,0.45)] backdrop-blur-[12px] lg:block">
      <div className="mx-auto flex h-[64px] max-w-cd-page items-center gap-3 px-4 xl:h-[62px] xl:gap-5 xl:px-[26px]">
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

        {/* 1024-1279 -- the R5.1 four-destination header. */}
        <nav className="flex items-center gap-1 xl:hidden" aria-label={t.primaryNavigationAriaLabel}>
          <Link href="/" aria-current="page" className={`${navItem} bg-[#12365e] text-white shadow-[inset_0_1px_0_rgba(150,200,255,0.18)]`}>
            {compact.home}
          </Link>
          {COMPACT_DESTINATIONS.map((entry) => (
            <Link key={entry.id} href={entry.href} className={navItem}>
              {compact[entry.labelKey]}
            </Link>
          ))}
        </nav>

        <nav className="hidden items-center gap-1 xl:flex" aria-label={t.primaryNavigationAriaLabel}>
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

        {/*
          THE SEARCH PILL, 1024-1279. R5.1 draws a wide "Search or ask" control
          here, not the icon button the prototype uses at 1280.

          N4, as ruled: "Keep the R5.1 Search control in the 1024-1279 header.
          For now it may navigate to `/search`, but ordinary navigation must not
          automatically spend AI quota. Do not silently convert the Search pill
          into Ask AI."

          So it is a Link to `/search` and nothing more. It starts no analysis
          by being pressed; whatever `/search` does on arrival is that route's
          own behaviour and a separate engineering matter, which this control is
          deliberately not being used to paper over.
        */}
        <Link
          href="/search"
          /*
            PREFETCH OFF, DELIBERATELY.

            Measured: with the default prefetch, idle Home issued one
            `GET /search?_rsc=...` — Next speculatively rendering that route's
            server component. It carries no `q`, and `/search` renders a client
            component, so nothing metered runs. But N4 records that `/search`
            auto-runs an analysis on arrival as an open engineering issue, and
            speculatively rendering a route with that property buys nothing and
            risks something.

            This is not a fix for that defect and does not touch the visual
            authority, per the ruling. It removes one avoidable server render.
          */
          prefetch={false}
          className="flex h-[44px] min-w-[176px] items-center gap-2.5 rounded-full border border-[#1b3a68] bg-[#0c1e38] px-3.5 text-[13px] text-[#8fa9c6] transition-colors hover:border-[#2f6ea8] hover:text-[#cfe2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none xl:hidden"
        >
          <span aria-hidden="true" className="relative block h-[13px] w-[13px] shrink-0">
            <span className="absolute inset-0 rounded-full border-[1.5px] border-current" />
            <span className="absolute h-[1.5px] w-[7px] bg-current" style={{ transform: 'translate(5px,5px) rotate(45deg)', marginTop: '-4px' }} />
          </span>
          <span className="truncate">{t.searchAriaLabel}</span>
        </Link>

        <Link
          href="/search"
          aria-label={t.searchAriaLabel}
          prefetch={false}
          className="hidden h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-cd-edge-header xl:flex transition-colors hover:border-[rgba(34,211,238,0.55)] motion-reduce:transition-none"
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
          signInClassName="rounded-[9px] border border-cd-edge-emphasis-50 bg-gradient-to-b from-[rgba(37,99,235,0.95)] to-[rgba(29,78,216,0.95)] px-4 py-[9px] font-cd-body text-cd-signin xl:px-5 text-cd-ink-signin shadow-[0_0_22px_rgba(37,99,235,0.35)] transition-opacity hover:opacity-90"
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
