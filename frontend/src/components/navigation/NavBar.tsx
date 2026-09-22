'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LanguageCode } from '@globalnews-ai/shared';
import { Logo } from '@/components/ui/Logo';
import { ReturnControl } from '@/components/navigation/ReturnControl';
import { NAV_MODEL, type NavModelEntry } from '@/lib/navModel';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { persistLanguageSelection } from '@/lib/i18n/languages';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { AccountControl } from './AccountControl';

interface NavBarProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * M65 — header + navigation, implementing the approved Claude Design
 * (GlobalNews AI.dc.html: desktop header ~L20-73, mobile header/menu
 * ~L708-751, nav-model script ~L1661-1667) on top of the CURRENT
 * production logic. The presentation is the design's; the behaviour is
 * this application's.
 *
 * PORTED FROM THE APPROVED DESIGN (exact values, not approximations):
 *   - 62px desktop / 52px mobile header geometry, backgrounds, borders,
 *     blur.
 *   - Nav item treatment: the exact inset edge (`inset 0 -2px 0
 *     #38bdf8`) with the exact #7dd3fc / #a7c0d8 colors, and exact
 *     padding / radius / font-size (8px 12px / 8px / 13.5px).
 *   - Search control: the design's own CSS-drawn 12px circle (1.5px
 *     border) + 7px bar at translate(5px,4px) rotate(45deg) — no icon
 *     library.
 *   - Language pill: the design's CSS-drawn 13px globe + chevron.
 *   - Mobile: 44x44 three-bar hamburger, full-screen rgba(3,6,12,0.97)
 *     overlay, "SECTIONS" heading, 52px rows.
 *
 * RETAINED FROM C2.1 (already approved, already in production): the
 * Logo emblem component itself, unchanged and deliberately not rebuilt,
 * and the bottom scan-line rail beneath the header.
 *
 * REAL PRODUCTION LOGIC UNDERNEATH:
 *   - NAV_MODEL (navModel.ts): Home / World Map resolve through the
 *     REAL primaryNavLinks (navigation.ts, unchanged, still exactly two
 *     entries). The six editorial items are real /search?q=<term> links
 *     — the design's own this.search(n.q) behaviour translated into a
 *     route that genuinely exists. About carries no href at all and is
 *     rendered as a genuinely non-interactive, aria-disabled control.
 *     No fabricated destination; no 404 is reachable from here.
 *   - Every visible label localizes: navItemLabels first, then the
 *     existing linkLabels-by-href map for the two real routes, then the
 *     design's own English wording as a last resort.
 *   - Active-route detection is real usePathname + aria-current.
 *   - AccountControl (real Google OAuth) is reused verbatim, restyled.
 *
 * LANGUAGE — ONE model, deliberately corrected relative to the archived
 * experiment this design was recovered from:
 *   1. `language` arrives as a prop from the Server Component that
 *      already read the cookie. This component NEVER reads localStorage
 *      during render, so the server render and the first client render
 *      agree and no hydration mismatch is possible.
 *   2. Changing the language persists the choice (cookie + localStorage
 *      in one call) and then calls router.refresh(), so the Server
 *      Components on the current route re-render and real data — the
 *      homepage feed above all — is re-requested in the new language.
 *      Without that refresh, selecting Polish would change nothing
 *      visible until a manual reload.
 *   3. Desktop and mobile render the SAME LanguageSelector component,
 *      only styled differently. There is no second language
 *      implementation anywhere in this file.
 */
export function NavBar({ language = 'en' }: NavBarProps): JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const t = getDictionary(language).navBar;

  function handleLanguageChange(next: LanguageCode): void {
    if (next === language) return;
    persistLanguageSelection(next);
    // Server Components on this route re-render against the freshly
    // written cookie — this is what makes the homepage feed, the page
    // shell and <html lang> all follow the selection.
    router.refresh();
  }

  // Escape closes the full-screen mobile menu — a real keyboard exit
  // from a full-viewport overlay.
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  /** Localized visible label for a nav entry — never a hardcoded English literal. */
  function labelFor(entry: NavModelEntry): string {
    const localized = t.navItemLabels[entry.labelKey];
    if (localized) return localized;
    if (entry.kind === 'route' && entry.href) return t.linkLabels[entry.href] ?? entry.label;
    return entry.label;
  }

  function renderNavItem(entry: NavModelEntry, keyPrefix: string): JSX.Element {
    /*
      M66.2 — GN-CD-024 nav item box, exact: padding 8px 12px, radius 8px,
      13.5px. Two corrections:

        - the type role is the RELEASED body treatment, not mono. ERRATUM-009
          releases the desktop nav item as `13.5px`, weight 400, inherited
          family; `font-mono` was a C2.1 assumption. Besides fidelity this
          buys back ~53px (EN) / ~71px (PL) of row width, because IBM Plex
          Mono's fixed .60em advance is wider than IBM Plex Sans's.
        - `whitespace-nowrap`. MLR-08 records the design's failure mode: nine
          items in one non-wrapping flex row with no overflow rule, so under
          pressure labels wrap INSIDE a fixed 62px container and spill outside
          the header band. nowrap removes that failure mode, per CTO decision
          D1's explicit rule.
    */
    const itemStyle =
      'inline-flex items-center whitespace-nowrap rounded-lg px-3 py-2 font-cd-body text-cd-nav-item transition-colors';

    if (entry.kind === 'unavailable') {
      return (
        <span
          key={`${keyPrefix}-${entry.labelKey}`}
          aria-disabled="true"
          aria-label={`${labelFor(entry)} — ${t.editorialUnavailableLabel}`}
          className={`${itemStyle} cursor-not-allowed text-cd-ink-secondary opacity-60`}
        >
          {labelFor(entry)}
        </span>
      );
    }

    /*
      GN-CD-024 states: default `#a7c0d8`, active `#7dd3fc` +
      `inset 0 -2px 0 #38bdf8`, hover `#e8f1ff` + `rgba(56,189,248,.08)`.

      The colours moved from an inline `style` to classes for one concrete
      reason: an inline style beats every class, so with the previous carrier
      the released hover colour could never take effect. Same released values,
      a carrier that lets the released hover state exist. The active marker
      stays inline — it has no hover interaction, and its exact declaration is
      worth keeping verbatim.

      Hover is deliberately NOT applied to the unavailable entry above: giving
      an inert control an interactive hover would misrepresent it.
    */
    const isActive = pathname === entry.href;
    return (
      <Link
        key={`${keyPrefix}-${entry.labelKey}`}
        href={entry.href as string}
        aria-current={isActive ? 'page' : undefined}
        className={`${itemStyle} hover:bg-cd-nav-hover hover:text-cd-ink-primary ${
          isActive ? 'text-cd-ink-label' : 'text-cd-ink-secondary'
        }`}
        style={isActive ? { boxShadow: 'inset 0 -2px 0 #38bdf8' } : undefined}
      >
        {labelFor(entry)}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(56,189,248,0.18)] bg-[rgba(4,7,14,0.92)] backdrop-blur-[10px]">
      {/*
        M66.2 — the C2.1 scan-line rail is REMOVED. GN-CD-020's layer table
        lists "Scan line ❌ none" and states the header is "four declarations
        deep: fill, blur, border, nothing else" — it is deliberately the
        plainest surface in the design, because every section beneath it
        carries its own technical field. The rail was a C2.1 addition with no
        authority in the released family. The element's redundant `relative`
        went with it: it existed only to position the rail, and it was
        competing with `sticky` for the same `position` property.
      */}

      {/*
        Desktop header — released 62px geometry, now gated on `cd-header`
        (1400px) rather than `lg` (1024px). See CTO decision D1 and the
        breakpoint's own note in tailwind.config.ts: nine non-wrapping nav
        items plus the utility cluster need ~1313px (EN) / ~1388px (PL), so
        below 1400px the existing mobile chrome serves instead of a header
        that cannot fit.

        `cd-canvas` scopes M66.1's GN-CD-306 focus treatment
        (rgba(34,211,238,.7), 2px, 2px offset) to the desktop header only, per
        CTO decision D3. It is deliberately on THIS row and not on <header>,
        so the mobile chrome below keeps its existing focus treatment exactly
        as authorization §12 requires.
      */}
      <div className="cd-canvas mx-auto hidden h-[62px] max-w-cd-page items-center gap-7 px-[26px] cd-header:flex">
        {/*
          ALPHA MAJOR CONVERGENCE R1 — HOST A OF THE SHARED RETURN CONTROL.

          The leading position of the EXISTING 62px row, before the home link.
          The row already renders and already has that height, so no chrome is
          added: h-[62px] is unchanged and is asserted byte-identical by the
          shared-nav guard. The control is the one shared primitive - this
          header does not own a bespoke arrow.
        */}
        <ReturnControl language={language} variant="navbar" />
        <Link href="/" className="flex shrink-0 items-center" aria-label={t.homeAriaLabel}>
          {/* GN-CD-021 — released 30px emblem box and 11px lockup gap. */}
          <Logo size={30} gapPx={11} />
        </Link>

        {/* Long localized labels scroll within the nav, keeping account controls in the viewport. */}
        <nav className="ml-[14px] flex min-w-0 items-center gap-1 overflow-x-auto" aria-label={t.primaryNavigationAriaLabel}>
          {NAV_MODEL.map((entry) => renderNavItem(entry, 'desktop'))}
        </nav>

        <div className="flex-1" />

        {/* Search control — the design's own CSS-drawn geometry, and a real link to the real /search workspace. */}
        <Link
          href="/search"
          aria-label={t.searchAriaLabel}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-cd-edge-header transition-colors hover:border-[rgba(34,211,238,0.55)]"
        >
          <span aria-hidden="true" className="relative block h-[12px] w-[12px]">
            <span className="absolute inset-0 rounded-full border-[1.5px] border-[#9fc6e8]" />
            <span
              className="absolute h-[1.5px] w-[7px] bg-[#9fc6e8]"
              style={{ transform: 'translate(5px,4px) rotate(45deg)', marginTop: '-4px' }}
            />
          </span>
        </Link>

        {/*
          M66.11 — GN-CD-M66.11. The language control is now ONE component that
          owns its whole trigger. It used to be a native <select> wrapped in a
          pill this file drew, with the cyan ring and the chevron as siblings of
          the component — which is why the released button/listbox architecture
          could not be built without touching this file: a native button element
          cannot be assembled from spans in a parent container, the pill would
          double-border,
          and a sibling chevron cannot see the open state it has to swap on.

          The released GN-CD-026 geometry is not redrawn — it moved onto the
          button element verbatim: 9px radius, 13/7 padding, 13px label, the
          13x13
          cyan ring. Nothing else in this header changes, and because the
          trigger's box is identical in every state the header cannot reflow
          when the popup opens.

          handleLanguageChange below is UNCHANGED, so persistence and the
          Server-Component refresh still run exactly as before, and its
          `if (next === language) return;` guard still makes re-selecting the
          current language a complete no-op.
        */}
        {/*
          SUPPORT CLOSURE — HELP IS A UTILITY AFFORDANCE, NOT AN EDITORIAL ONE,
          AND THAT IS WHY IT IS HERE RATHER THAN IN NAV_MODEL.

          NAV_MODEL is the approved Claude Design sequence, ported from the
          prototype's own nav-model script (GlobalNews AI.dc.html ~L1661) and
          deliberately built as ONE explicit ordered array so that the exact
          nine-item sequence is "guaranteed by construction". That design
          specifies no Help entry. Inserting a tenth item would break the very
          property navModel.ts exists to hold.

          So Help sits with the other persistent utilities the design DOES place
          in the header rail — the language selector and the account control —
          where a reader looks for help on any page. The editorial nav is
          untouched, and primaryNavLinks still carries exactly its two real
          routes.
        */}
        <Link
          href="/support"
          aria-current={pathname === '/support' ? 'page' : undefined}
          className="flex min-h-[44px] shrink-0 items-center px-2 font-cd-body text-cd-nav text-ink-secondary transition-colors hover:text-ink-primary"
        >
          {t.help}
        </Link>

        <LanguageSelector
          value={language}
          onChange={handleLanguageChange}
          label={t.languageSelectorLabel}
          actionLabel={t.languageSelectorAction}
          variant="desktop"
        />

        <AccountControl
          signInLabel={t.signIn}
          /*
             M66.2 — every released GN-CD-027 value was already exact, including
             ERRATUM-009's weight correction to 600. The only change is that the
             specification explicitly RE-DECLARES `'IBM Plex Sans',sans-serif`
             on this button, so it now says so through `font-cd-body` and the
             `cd-signin` role token instead of inheriting Inter. Geometry,
             gradient, border, glow and colour are untouched. AccountControl
             applies this same string to all three of its real auth states
             (loading, signed out, signed in) and is NOT modified — CTO
             decision D4.
          */
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

      {/*
        Mobile header — UNCHANGED except for the breakpoint at which it hands
        over to the desktop header (CTO decision D1, authorization §12: the
        handoff is the only authorized responsive change, and at 390x844 this
        chrome must remain visually and functionally identical). Every geometry
        value, colour, target size and behaviour below is exactly as shipped.
      */}
      {/*
        M66.11 (CTO decision 4) — `relative` is the ONLY change to this row.
        The released mobile popup is anchored 12px from the viewport edge, not
        from the trigger. Making this row the containing block lets the popup
        declare `right:12px` and mean literally twelve pixels, instead of a
        compensation offset silently coupled to this row’s own px-4. Height,
        fill, gap, blur and the breakpoint are untouched, and the row has no
        other absolutely-positioned descendant.
      */}
      <div className="relative flex h-[52px] items-center gap-3 bg-[rgba(5,7,13,0.96)] px-4 backdrop-blur-[8px] cd-header:hidden">
        <button
          type="button"
          aria-label={isMobileMenuOpen ? t.closeMenuAriaLabel : t.openMenuAriaLabel}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="-ml-2.5 flex h-11 w-11 flex-col justify-center gap-[5px] px-2.5"
        >
          <span aria-hidden="true" className="h-[2px] rounded-sm bg-[#dbeafe]" />
          <span aria-hidden="true" className="h-[2px] rounded-sm bg-[#dbeafe]" />
          <span aria-hidden="true" className="h-[2px] rounded-sm bg-[#dbeafe]" />
        </button>

        <Link href="/" className="flex items-center gap-[9px]" aria-label={t.homeAriaLabel}>
          <Logo />
        </Link>

        <div className="flex-1" />

        <Link href="/search" aria-label={t.searchAriaLabel} className="flex h-11 w-11 items-center justify-center">
          <span aria-hidden="true" className="relative block h-[15px] w-[15px]">
            <span className="absolute inset-0 rounded-full border-[1.8px] border-[#cfe3f5]" />
            <span
              className="absolute h-[1.8px] w-2 bg-[#cfe3f5]"
              style={{ transform: 'translate(9px,7px) rotate(45deg)' }}
            />
          </span>
        </Link>

        {/*
          M66.11 — the mobile language control. It used to be the approved
          globe/EN visual with an INVISIBLE opacity-0 <select> laid over it to
          capture the tap. That overlay is gone; the same globe and EN code are
          now rendered by the shared component inside a real button element, so the
          decoration and the control are finally the same element.

          The released GN-CD-227 layout is carried over exactly — 44px minimum
          height, 4px padding, 6px gap, the 18px globe, the mono EN code. The
          one addition is the released chevron (CTO decision 8), which did not
          exist here before.
        */}
        <LanguageSelector
          value={language}
          onChange={handleLanguageChange}
          label={t.languageSelectorLabel}
          actionLabel={t.languageSelectorAction}
          variant="mobile"
        />
      </div>

      {/*
        LAUNCH-PREP — THE FULL-SCREEN MOBILE MENU IS RENDERED THROUGH A PORTAL,
        AND IT HAS TO BE.

        This <header> carries backdrop-blur-[10px]. A non-none backdrop-filter
        makes an element the CONTAINING BLOCK for its fixed-position
        descendants, so while this overlay lived in the header subtree its
        fixed inset-0 resolved against the header instead of the viewport:
        measured in Chromium at 390x844, the supposedly full-screen menu was a
        390x92 scrolling strip, with the nine nav items, Help and the account
        control all trapped inside it. Toggling that one property at runtime
        was the whole difference — 390x844 without it, 390x92 with it.

        The blur is an approved part of the header appearance and is NOT
        removed. The overlay is moved out of the containing block instead, to
        document.body, which is what a viewport-fixed layer wants anyway: it is
        then immune to the header AND to whatever wrapper each of the nine
        <NavBar> mount points happens to place around it, now or later.

        z-[70] rather than the previous z-40. Inside the header the overlay sat
        within the header own z-50 stacking context, so z-40 already painted it
        above the rows; at document level it must clear that z-50 header itself,
        or the 52px bar would cover the overlay close control. 70 also clears
        the language popup z-[60], which is the correct order for a layer that
        covers the row that popup belongs to.

        Nothing else changes. React events still bubble through the portal into
        this component, so every onClick below is untouched, the Escape handler
        above still closes the menu, and AccountControl own outside-click test
        still works because it asks the real DOM whether the click landed
        inside its container.
      */}
      {/* Full-screen mobile menu — exact nine-item order, real destinations only. */}
      {isMobileMenuOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-[rgba(3,6,12,0.97)] px-[22px] pb-[22px] pt-[70px] cd-header:hidden">
            <button
              type="button"
              aria-label={t.closeMenuAriaLabel}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-[18px] top-[18px] flex h-11 w-11 items-center justify-center text-2xl text-[#9fbdd8]"
            >
              &times;
            </button>

            {/*
              M66.13 — this heading was a bare "SECTIONS" literal, ported verbatim
              from the Claude Design prototype during the M65 header reconstruction
              (see this file's own header, which lists it among the ported values).
              It rendered English inside an otherwise fully Polish menu. The English
              value is unchanged; it simply comes from the dictionary now, like every
              other visible string in this component.
            */}
            <div className="mb-[14px] mt-[26px] font-mono text-[11px] tracking-[0.16em] text-[#7dd3fc]">
              {t.sectionsHeading}
            </div>

            <nav className="flex flex-col" aria-label={t.mobileNavigationAriaLabel}>
              {NAV_MODEL.map((entry) =>
                entry.kind === 'unavailable' ? (
                  <span
                    key={`mobile-menu-${entry.labelKey}`}
                    aria-disabled="true"
                    aria-label={`${labelFor(entry)} — ${t.editorialUnavailableLabel}`}
                    className="flex min-h-[52px] cursor-not-allowed items-center border-b border-[rgba(56,189,248,0.1)] font-display text-xl font-medium text-[#a7c0d8] opacity-60"
                  >
                    {labelFor(entry)}
                  </span>
                ) : (
                  <Link
                    key={`mobile-menu-${entry.labelKey}`}
                    href={entry.href as string}
                    aria-current={pathname === entry.href ? 'page' : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex min-h-[52px] items-center border-b border-[rgba(56,189,248,0.1)] font-display text-xl font-medium text-ink-primary"
                  >
                    {labelFor(entry)}
                  </Link>
                ),
              )}
            </nav>

            {/* SUPPORT CLOSURE — the mobile counterpart of the header utility
                entry above. Same destination, same reasoning: outside NAV_MODEL,
                beside the account control. */}
            <Link
              href="/support"
              aria-current={pathname === '/support' ? 'page' : undefined}
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-6 flex min-h-[52px] items-center border-b border-[rgba(56,189,248,0.1)] font-display text-xl font-medium text-ink-primary"
            >
              {t.help}
            </Link>

            <div className="mt-6">
              <AccountControl
                signInLabel={t.signIn}
                signInClassName="mt-4 w-full rounded-[9px] border border-[rgba(56,189,248,0.5)] bg-gradient-to-b from-[rgba(37,99,235,0.95)] to-[rgba(29,78,216,0.95)] px-5 py-3 text-center text-sm font-semibold text-[#eaf6ff]"
                accountLabel={t.account}
                accountMenuAriaLabel={t.accountMenuAriaLabel}
                signedInAsLabel={t.signedInAs}
                historyLabel={t.history}
                supportLabel={t.support}
                settingsLabel={t.settings}
                signOutLabel={t.signOut}
              />
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
