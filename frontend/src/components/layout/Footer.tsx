import { Fragment } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { Logo } from '@/components/ui/Logo';
import { footerLinkGroups } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface FooterProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * M66.7 — GN-CD-200 → GN-CD-204, the Footer.
 *
 * WHAT CHANGED. The footer used to be a full-bleed `border-t border-cyan-500/25`
 * band with two HUD corner brackets, wrapping a `max-w-[1480px]` container,
 * wrapping a rounded panel, above a second row separated by a cyan rail with an
 * indicator dot. GN-CD-200 authors ONE bordered bar and — more importantly — a
 * list of ABSENCES: no gradient, no technical grid, no decorative rules, no
 * glow, no shadow, no mask, no clip. It is "the only home section with a flat
 * fill and no technical field of any kind… The page ends by removing every
 * technical layer — the visual full stop." Those layers are what came out.
 *
 * THE REPOSITORY'S BEHAVIOUR IS KEPT; ONLY THE PRESENTATION IS RELEASED
 * (CTO decision D-1 A). This is the first family in the series where the
 * repository is AHEAD of the design. GN-CD-200 logs seven new defects and the
 * production footer already does not have five of them:
 *
 *   DEFECT-044  every released link is an inert `<span cursor:pointer>` with no
 *               handler and no destination  ->  ours are real `<a href>` to real
 *               routes
 *   DEFECT-045  no released link is keyboard-reachable  ->  ours are native
 *               anchors, in the tab order, with a visible focus ring
 *   DEFECT-049  the released footer has no copyright or legal ownership
 *               statement at all  ->  ours has one, localized
 *   DEFECT-050  the released footer is a `<div>` with no landmark  ->  ours is a
 *               real `<footer>`, and its links sit in a labelled `<nav>`
 *   DEFECT-022/023  the released emblem collides SVG ids with the header's and
 *               is announced to screen readers  ->  `Logo` already solves both
 *               with `useId()` and `aria-hidden`
 *
 * GN-CD's behavioural acceptance asks implementers to verify items 5 and 6 —
 * "all footer links do nothing when clicked" and "no footer element is
 * reachable by keyboard" — AS REPORTED, NOT FIXED. Those two items are
 * FORMALLY RECORDED AS NOT FOLLOWED, per D-1 A: they contradict the standing
 * accessibility contract and the repository's role as the functional source of
 * truth. Every other acceptance item is honoured.
 *
 * ONE FOOTER, SEVEN ROUTES (CTO decision D-2 A). This component renders on `/`,
 * `/search`, `/map`, `/privacy`, `/terms`, `/history` and `/workspace`. Only the
 * first is a released Claude Design surface, and the released presentation is
 * applied to all of them rather than forking a second legacy variant. No route
 * body is redesigned.
 *
 * PLACEMENT IS DEFERRED (CTO decision D-3 C, M66.7-DEFERRED-001). GN-CD-200's
 * PARENT is GN-CD-004 — 18px below Trust, 1388px wide, left/right edges aligned
 * with Trust's, followed by the wrapper's 60px bottom padding. This component
 * sits outside `<main>` and outside `PageCanvas`, in its own container that
 * measures 1376px at a 1440 viewport. M66.1 asserted that placement
 * deliberately ("the header and footer have their own GN-CD milestones and must
 * not be re-bounded by this one"). The outer container below is therefore
 * UNCHANGED — the bar inside it is rebuilt, the wrapper geometry is not.
 *
 * COPY (CTO decision D-4 A). No dictionary file was modified.
 *   - The released desktop tagline plate carries the existing localized
 *     `closingTagline`, and the released mobile identity sub-line carries the
 *     SAME string — which is precisely the released relationship: "the same
 *     words appear as the identity block's mono sub-line".
 *   - The released two-line desktop description ("AI-powered. Evidence-based." /
 *     "Trusted by curious minds.") is OMITTED rather than approximated. The
 *     existing `footer.tagline` measures ≈575px at 11.5px against a ≈194px
 *     identity region; forcing it in would have broken the bar.
 *   - Neither the plate nor the identity uses a hard `<br />`, which is what
 *     removes GN-CD's MLR-18 and MLR-19 instead of importing them.
 *   - The `<nav>` accessible name is the existing localized `groupTitles.Legal`
 *     ("Legal" / "Informacje prawne") — concise, accurate for a group of two
 *     legal links, and a replacement for the full tagline sentence the nav used
 *     to be labelled with.
 *
 * LINKS (CTO decision D-6 A). Two of the design's six labels have real routes.
 * `About`, `Careers` and `Contact` have localized labels sitting unused in the
 * dictionary but no pages; `Source Policy` has neither a route nor a label.
 * None is rendered, and none is faked. The links still derive entirely from
 * `footerLinkGroups`, so this component has no destination list of its own.
 *
 * SHARE CONTROLS (CTO decision D-5 A). GN-CD-203 is omitted:
 * M66.7-DEFERRED-002. No toast infrastructure, no clipboard behaviour, no share
 * intent and no social-account URL is created. Their resting border also
 * measures 1.47:1, and it is the only visual signal that a 34px circle is
 * interactive — so shipping them without the affordance work would have been
 * worse than omitting them.
 *
 * ZERO DATA. No API client, no fetch, no client boundary, no state, no timer,
 * no router, no auth. The only runtime value is `new Date().getFullYear()` for
 * the copyright line. GN-CD-200's status inventory returns zero numbers, counts,
 * timestamps and live indicators — "the third family with a clean result on this
 * axis" — and that stays true.
 *
 * MOTION. The emblem's three animations are the family's only motion, exactly as
 * released. Link hover is an instant colour change with no transition declared,
 * also as released.
 */
export function Footer({ language = 'en' }: FooterProps): JSX.Element {
  const currentYear = new Date().getFullYear();
  const t = getDictionary(language).footer;
  const allLinks = footerLinkGroups.flatMap((group) => group.links);

  return (
    <footer>
      {/*
        M66.8b — THE OUTER CONTAINER, NOW THE CLAUDE DESIGN CANVAS BOX.

        M66.7 left this wrapper alone under CTO decision D-3 C and recorded the
        consequence as M66.7-DEFERRED-001. This milestone closes it.

        GN-CD-200's parent is GN-CD-004: the footer's edges align with the page
        content box. They did not. The legacy `max-w-[1480px]` with `lg:px-8`
        computed 1376px at a 1440px viewport against PageCanvas's 1388px — a
        12px deficit, 6px per side, holding at 1280px too and widening to 32px
        above 1500px. The Footer was the only misaligned element on the desktop
        page: NavBar's desktop header already uses `max-w-cd-page px-[26px]`,
        and LiveStatusStrip is `lg:hidden` so it never renders there at all.

        The fix is this container adopting the SAME box, not the Footer moving.
        M66.1 asserted `not.toContain('<Footer')` inside PageCanvas on purpose
        — "the header and footer have their own GN-CD milestones and must not
        be re-bounded by this one" — and moving it would touch app/page.tsx,
        PageCanvas.tsx and claudeDesignFoundation.spec.ts, all protected, while
        leaving the six non-home routes on a second geometry. Sharing the box
        costs one class string and keeps one Footer on all seven routes.

        `w-full` is explicit rather than implied: this element is a block-level
        child of <footer>, so it would fill anyway, but PageCanvas declares it
        and the two boxes must be readable as the same box, not as two that
        happen to agree.

        WHAT FOLLOWS NATURALLY BELOW `lg`, stated rather than discovered later:
        the `sm:` step disappears. The legacy ladder was 16px, then 24px from
        640px, then 32px from 1024px; the canvas is a flat 14px, then 26px from
        1024px. So the mobile bar gains 4px of width at 390px and the footer
        stops being the one element that steps at a breakpoint PageCanvas does
        not have. That is the approved shared token doing its job, and it also
        leaves this component with exactly ONE gate — `lg` — which is what CTO
        decision D-7 A asked for and could not have while `sm:` lived here.

        `py-6` is retained exactly. Vertical rhythm is not this milestone's
        subject: the 84px desktop gap from Trust (PageCanvas `lg:pb-cd-60` plus
        this 24px) is unchanged. M66.7-R1 mobile composition is untouched.
      */}
      <div className="mx-auto w-full max-w-cd-page px-cd-14 py-6 lg:px-cd-26">
        {/*
          GN-CD-200 — the outer section. Flat fill at both viewports; the mobile
          bar is 4px less rounded, .02 less bordered and ASYMMETRICALLY padded
          (6px 18px 6px 10px, right-heavy). None of that is a scale of the
          desktop values, so both are declared rather than derived.

          `flex-wrap` is the one addition, and it is a mitigation rather than a
          composition: it changes nothing while the content fits, and it lets the
          legal row drop to a second line in languages whose legal terms have no
          short form — GN-CD's MLR-22, which bites here because D-4 A authorizes
          no new abbreviated labels. Without it the Polish row would be clipped.
        */}
        <div className="flex flex-wrap items-center gap-cd-12 rounded-cd-14 border border-cd-edge-structural bg-cd-fill-footer py-cd-6 pl-cd-10 pr-cd-18 lg:flex-nowrap lg:gap-cd-36 lg:rounded-cd-16 lg:border-cd-edge-card lg:px-cd-22 lg:py-cd-20">
          {/* GN-CD-201 — identity block. Not a link on either viewport, unlike both headers. */}
          <div className="flex min-w-0 flex-1 items-center gap-cd-11">
            {/*
              The released emblem is 28px desktop / 26px mobile. `Logo` takes a
              numeric `size`, which cannot be responsive, so the rendered SVG is
              sized in CSS instead — one instance rather than two, which matters
              because the emblem carries three running animations.
            */}
            <Logo
              showWordmark={false}
              size={28}
              className="shrink-0 [&>svg]:h-[26px] [&>svg]:w-[26px] lg:[&>svg]:h-[28px] lg:[&>svg]:w-[28px]"
            />

            <div className="flex min-w-0 flex-col">
              {/*
                GN-CD-201 — the footer wordmark DROPS the cyan "AI" that both
                headers carry: "footer lockup = one uniform colour. A real
                divergence in the brand lockup, recorded." `Logo`'s own wordmark
                is the header treatment, so it is switched off above and the
                released footer lockup is rendered here.
              */}
              <span className="font-cd-display text-cd-footer-ident-m text-cd-ink-primary lg:text-cd-lockup">
                GlobalNews AI
              </span>

              {/* GN-CD-201 mobile — the tagline promoted into the identity block as a mono sub-line. */}
              <span className="mt-[3px] font-cd-mono uppercase text-cd-mono-tagline-m text-cd-ink-muted lg:hidden">
                {t.closingTagline}
              </span>

              {/*
                The copyright the released design does not have (DEFECT-049),
                kept per D-1 A and placed in the identity block's released
                secondary slot — the same 11.5px / #7f9dbd role the omitted
                description would have used.
              */}
              <span className="mt-[3px] text-cd-footer-legal-m text-cd-ink-muted lg:mt-cd-4 lg:text-cd-footer-desc">
                &copy; {currentYear} {t.copyrightSuffix}
              </span>
            </div>
          </div>

          {/*
            GN-CD-202 — the link row. Two links, because two routes exist
            (D-6 A). `aria-label` is the existing localized "Legal", replacing
            the full tagline sentence this nav used to be named with.
          */}
          <nav aria-label={t.groupTitles.Legal} className="flex flex-wrap items-center gap-cd-9 lg:gap-cd-22">
            {allLinks.map((link, index) => (
              <Fragment key={link.href}>
                {index > 0 && (
                  /* GN-CD-202 mobile — the 1px x 12px divider. Decorative, and hidden from assistive technology. */
                  <span aria-hidden="true" className="h-[12px] w-px bg-cd-edge-control lg:hidden" />
                )}
                <a
                  href={link.href}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-cd-6 px-[3px] text-cd-footer-legal-m text-cd-ink-tertiary hover:text-cd-accent-cyan lg:min-h-0 lg:min-w-0 lg:px-0 lg:text-cd-footer-link lg:text-cd-ink-secondary"
                >
                  {t.linkLabels[link.href] ?? link.label}
                  {link.comingSoon && (
                    <span className="rounded-cd-4 border border-cd-edge-control px-[3px] font-cd-mono text-cd-mono-badge-m uppercase text-cd-ink-muted">
                      {t.comingSoon}
                    </span>
                  )}
                </a>
              </Fragment>
            ))}
          </nav>

          {/* GN-CD-200 — the flex spacer that pushes the tagline plate to the far right. Desktop only. */}
          <span aria-hidden="true" className="hidden flex-1 lg:block" />

          {/*
            GN-CD-204 — the tagline plate. Desktop only; mobile promotes the same
            words into the identity block above. Its `rgba(56,189,248,.3)` border
            is the strongest in the footer — stronger than the section's own .14
            — which is what makes it the far-right terminus.
          */}
          <span className="hidden shrink-0 rounded-cd-10 border border-cd-edge-plate px-cd-16 py-cd-11 text-right font-cd-mono uppercase text-cd-mono-plate text-cd-ink-label lg:block">
            {t.closingTagline}
          </span>
        </div>
      </div>
    </footer>
  );
}
