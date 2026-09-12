'use client';

import type { CSSProperties } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isModuleNavigable, type IntelligenceModuleConfig } from '@/lib/intelligenceModules';
import { MOBILE_ICON_PATHS, MODULE_IDENTITY } from '@/components/home/intelligenceEngineGeometry';

/**
 * DC-03 — WCAG 2.1 SC 1.4.11 on the boundary of an INTERACTIVE component.
 *
 * The released border is `rgba({identity},.35)`. CTO decision D-12 A kept it
 * for fidelity and recorded the shortfall as M66.5-DESIGN-FEEDBACK-001 rather
 * than changing it silently. Claude Design's DESIGN_CORRECTIONS_MATRIX now
 * closes that open question the other way for the four cards that genuinely
 * ARE interactive components, and instructs: raise the alpha on the navigable
 * branch only, per identity colour, leaving the five inert cards at `.35`.
 *
 * MEASURED HERE, NOT QUOTED. The package's own MANIFEST records its
 * 1.75-2.28:1 figure as quoted from an earlier report and requires the
 * per-colour targets to be measured during implementation. Recomputed by sRGB
 * relative luminance with real alpha compositing over the released stack —
 * page `#04060c`, then BOTH stops of the section radial (`cd-engine` and
 * `cd-engine-m`), then BOTH stops of the card's own
 * `linear-gradient(120deg, rgba({identity},.1), rgba(6,11,22,.85))` — and
 * evaluated against BOTH adjacent surfaces the criterion names: the card fill
 * inside the border and the section ground outside it. The value below is the
 * smallest hundredth at which the WORST of those combinations clears 3.00:1.
 *
 *   module                 worst @ .35   shipped   worst @ shipped
 *   world-intelligence          1.85       .54          3.08
 *   ai-research                 1.97       .51          3.12
 *   country-intelligence        1.64       .63          3.09
 *   evidence                    1.91       .53          3.11
 *
 * (This worst case includes the bright centre stop of the section radial, so
 * the guarantee holds at every position a card can occupy, not only where the
 * cards happen to sit today.)
 *
 * The single-property technique is PRESERVED: the identity RGB triple still
 * arrives once as `--em-ch` and is still the only colour source. `--em-ba`
 * carries a number, not a colour, so there is still exactly one place per card
 * where the identity colour is written. The gradient, the glow, the code tile
 * and the badge are untouched and keep the released `.35`.
 */
const INERT_BORDER_ALPHA = '.35';

/**
 * Any FUTURE module promoted to navigable without a measured value falls back
 * to the highest alpha any of the nine identity colours needs (conflict red,
 * the darkest, at .66), so a promotion can never silently ship below 3:1.
 */
const SC1411_BORDER_ALPHA_FALLBACK = '.66';

const SC1411_BORDER_ALPHA: Record<string, string> = {
  'world-intelligence': '.54',
  'ai-research': '.51',
  'country-intelligence': '.63',
  evidence: '.53',
};

interface IntelligenceModulePanelProps {
  module: IntelligenceModuleConfig;
  language?: LanguageCode;
  /** Fired on hover AND on keyboard focus, from the panel's own focusable root. */
  onEmphasisChange?: (moduleId: string | null) => void;
  /** True when this panel is the one currently hovered or focused. */
  isEmphasized?: boolean;
}

/**
 * M66.5 — GN-CD-148/149/156, the module card.
 *
 * PRESENTATION, per the released card:
 *   - a fixed box — `340×82` desktop, `108×56` mobile — with a 1px
 *     identity border, an identity-tinted 120° gradient fill and an
 *     identity glow;
 *   - desktop: a `32×32` bordered tile carrying the two-letter code;
 *   - mobile: a `17×17` stroked line icon and NO tile — GN-CD-150
 *     records that these "are not two renderings of one system" and that
 *     unifying them is a design change (UNRESOLVED-007), so both are
 *     reproduced as released rather than harmonised;
 *   - an uppercase, tracked, identity-coloured mono name — the full
 *     title on desktop, the released `shortTitle` on mobile;
 *   - a status badge, `white-space:nowrap`;
 *   - a two-line description, desktop only, exactly as released.
 *
 * ONE COLOUR PROPERTY, NINE CARDS. The identity RGB triple is set once
 * as `--em-ch` and read by the border, the gradient, the glow, the tile,
 * the name, the icon stroke and the badge. That is the same technique
 * M66.4 proved in TrendingCard, and it is why the released values live
 * in `intelligenceEngineGeometry.ts` (CTO decision D-4 A) instead of
 * nine hardcoded class permutations or an edit to the shared accent
 * table.
 *
 * TRUTH, unchanged and unchangeable here. `isModuleNavigable()` remains
 * the SOLE gate on interactivity: a module is a real link only when it
 * is ACTIVE *and* has a real destination. A PREVIEW or COMING SOON
 * capability therefore cannot become clickable.
 *
 * WORLD INTELLIGENCE IS ACTIVE **AND** NAVIGABLE — Claude Design DC-05.
 * This paragraph previously stated that the module "correctly renders
 * inert", describing the superseded D-6 A contract, while the executable
 * code beside it did the opposite. Claude Design's review names that
 * contradiction as the single most likely cause of a wrong decision in
 * this family, so the wording is corrected here rather than left to be
 * trusted. The current contract: `state: 'active'` with
 * `destination: '/#global-developments-heading'`, a real in-page anchor
 * proved at test time against GlobalDevelopments.tsx. FOUR modules render
 * as real links, not three. Nothing here fabricates a
 * destination, and every visible string comes from the dictionary.
 *
 * ACCESSIBILITY — the prototype defect is NOT reproduced. GN-CD §N
 * authors COMING SOON cards as `role="link"`, focusable, activating a
 * toast; GN-CD's own UNRESOLVED-016 records that a screen-reader user
 * then hears "link" for something that will never navigate. This panel
 * keeps the repository's stronger treatment: a non-navigable module is
 * an inert container with no focusable element by design, and its state
 * is in its accessible name. GN-CD §N's `${name} — ${status}` pattern is
 * adopted for BOTH branches, so status is announced whether or not the
 * card is a link.
 *
 * The post-M64 audit fix is preserved at its root: the emphasis handlers
 * and the focus treatment live on the panel's ROOT element, which IS the
 * focusable `<a>` for navigable modules. In the retired card they sat on
 * an inner `<div>` nested inside the `<a>`, where a focus event could
 * never reach them.
 *
 * TWO DOCUMENTED DIVERGENCES, both required by CTO decisions:
 *   1. `cursor`. GN-CD-148 authors `not-allowed` for COMING SOON and
 *      `pointer` for everything else. The two PREVIEW modules are inert
 *      under D-10, so a pointer cursor there would promise navigation
 *      that cannot happen; they get `default`. COMING SOON keeps the
 *      released `not-allowed`, and real links keep `pointer`.
 *   2. Card border contrast. The released `rgba({RGB},.35)` measures
 *      1.75–2.28 : 1 against both the card fill and the section ground,
 *      below WCAG 2.1 SC 1.4.11's 3:1 for an interactive component's
 *      boundary. CTO decision D-12 A retains the released value for
 *      fidelity and records the measurement rather than altering it
 *      silently (M66.5-DESIGN-FEEDBACK-001). Status is never carried by
 *      colour alone — the badge is text (GN-CD-307).
 */
export function IntelligenceModulePanel({
  module,
  language = 'en',
  onEmphasisChange,
  isEmphasized = false,
}: IntelligenceModulePanelProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;
  const moduleText = t.modules[module.dictionaryKey as keyof typeof t.modules];
  const navigable = isModuleNavigable(module);
  const identity = MODULE_IDENTITY[module.id];
  const iconPath = MOBILE_ICON_PATHS[module.id];

  const stateLabel =
    module.state === 'active'
      ? t.stateLabels.active
      : module.state === 'preview'
        ? t.stateLabels.preview
        : t.stateLabels.comingSoon;

  /** GN-CD §N — `${name} — ${status}`, kept alongside the richer description the CTO approved in M66.4. */
  const accessibleName = `${moduleText.title}: ${moduleText.description}, ${stateLabel}`;

  const rootClassName = [
    'group relative flex h-full w-full items-center gap-cd-6 overflow-hidden rounded-cd-10 px-cd-7 py-cd-5 text-left',
    'md:gap-cd-12 md:rounded-cd-12 md:px-cd-14 md:py-cd-10',
    'border border-[color:rgba(var(--em-ch),var(--em-ba))]',
    'bg-[linear-gradient(120deg,rgba(var(--em-ch),.1),rgba(6,11,22,.85))]',
    'shadow-[0_0_16px_rgba(var(--em-ch),.07)] md:shadow-[0_0_24px_rgba(var(--em-ch),.07)]',
    'transition-[filter,transform] duration-cd-160 ease-out md:duration-cd-180',
    module.state === 'comingSoon' ? 'cursor-not-allowed opacity-[.88] md:opacity-[.86]' : '',
    navigable
      /*
        M66 — A VISIBLE KEYBOARD FOCUS STATE.

        Until now the only focus treatment here was a brightness shift and a 1px
        lift: on a dark card that is not an obvious focus indicator, and it was
        the same on every navigable module, not just World Intelligence.

        This reuses the ONE released focus colour, cd-edge-focus
        (rgba(34,211,238,0.70)) — the same treatment HeroLiveFeedPanel,
        TrendingCard, GlobalDevelopments and LanguageSelector already use. No
        new colour, no redesign, and the existing brightness/lift are kept.

        The offset is NEGATIVE, as on the hero feed rows: this panel is
        overflow-hidden and sits inside IntelligenceEngineSection, which is also
        overflow-hidden, so an outward ring on an edge card could be clipped by
        the section. An inset ring cannot be.

        Nothing is added for keyboard activation: this branch is a real <a>, so
        Tab and Enter are native. No JavaScript key handling was introduced.
      */
      ? 'cursor-pointer hover:brightness-[1.16] hover:saturate-[1.08] hover:-translate-y-px focus-visible:brightness-[1.2] focus-visible:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cd-edge-focus motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0'
      : '',
    !navigable && module.state !== 'comingSoon' ? 'cursor-default' : '',
    isEmphasized ? 'brightness-[1.16] saturate-[1.08]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      {/* GN-CD-148 — mobile: a stroked line icon, no tile. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[17px] w-[17px] shrink-0 stroke-[rgb(var(--em-ch))] md:hidden"
      >
        <path d={iconPath} />
      </svg>

      {/* GN-CD-148 — desktop: the two-letter identifier in a bordered tile. */}
      <span
        aria-hidden="true"
        className="hidden h-[32px] w-[32px] shrink-0 place-items-center rounded-cd-9 border border-[color:rgba(var(--em-ch),.35)] font-cd-mono text-cd-mono-tile font-semibold text-[color:rgb(var(--em-ch))] md:grid"
      >
        {module.code}
      </span>

      <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-start md:justify-between md:gap-cd-12">
        <span className="flex min-w-0 flex-col">
          {/* Mobile name — the released short title. */}
          <span
            aria-hidden="true"
            className="font-cd-mono text-cd-mono-module-m uppercase leading-[1.22] text-[color:rgb(var(--em-ch))] md:hidden"
          >
            {moduleText.shortTitle}
          </span>
          {/* Desktop name — the full title, clipped rather than wrapped, as released. */}
          <span
            aria-hidden="true"
            className="hidden overflow-hidden text-ellipsis whitespace-nowrap font-cd-mono text-cd-mono-module uppercase leading-[1.3] text-[color:rgb(var(--em-ch))] md:block"
          >
            {moduleText.title}
          </span>

          {/*
            GN-CD-148 — "Descriptions render on desktop only".

            `hidden md:line-clamp-2` and NOT `hidden md:block md:line-clamp-2`:
            Tailwind's `line-clamp-2` already declares
            `display:-webkit-box` (with `overflow:hidden` and
            `-webkit-box-orient`), so pairing it with `md:block` puts two
            display utilities in the same breakpoint bucket and the clamp
            silently stops working depending on plugin order. One utility,
            one display value, no ambiguity.
          */}
          <span
            aria-hidden="true"
            className="mt-cd-4 hidden text-cd-module-desc text-cd-ink-tertiary md:line-clamp-2"
          >
            {moduleText.description}
          </span>
        </span>

        {/*
          THE TRAILING GROUP — status, then (navigable only) the open cue.

          Placing the DC-01 affordance in the badge's own column rather than on
          the card's main line is deliberate and measured: the trailing column's
          width is set by the badge, which is wider than `Open ↗` at every
          released size, so the affordance costs the NAME column zero pixels.
          Putting it on the main line would have taken roughly 48px from a
          desktop name column that already leaves `Evidence & Source Comparison`
          about 5px of headroom, pushing more titles into the ellipsis.

          Mobile stacks it beside the badge, desktop below it, which is what the
          released `md:flex-row md:items-start md:justify-between` parent already
          implies for a right-hand column.
        */}
        <span className="mt-[2px] flex shrink-0 items-center gap-cd-3 self-start md:mt-0 md:flex-col md:items-end md:gap-cd-4">
          {/*
            GN-CD-149 — the status badge. `white-space:nowrap` is mandatory:
            without it "COMING SOON" wraps inside the 69px mobile text
            column and the fixed 56px card height with `overflow:hidden`
            clips the second line. That was a live defect and its fix is
            load-bearing. The badge is also the TEXT carrier GN-CD-307
            requires — status is never signalled by colour alone.
          */}
          <span
            aria-hidden="true"
            className="inline-block whitespace-nowrap rounded-cd-4 border border-[color:rgba(var(--em-ch),.35)] px-[3px] py-px font-cd-mono text-cd-mono-badge-m uppercase text-[color:rgb(var(--em-ch))] md:rounded-cd-5 md:px-cd-7 md:py-[3px] md:text-cd-mono-badge"
          >
            {stateLabel}
          </span>

          {/*
            DC-01 — THE VISIBLE OPEN AFFORDANCE.

            ACTIVE is a status word, not an invitation. Cursor, hover and focus
            ring are the only signals that a card will navigate, and a touch
            user has none of them; on mobile the description is hidden too, so
            nothing at all separated the four working modules from the five that
            cannot be opened.

            Gated on `navigable` — the SAME `isModuleNavigable()` result the
            element choice below uses — so it is structurally impossible for an
            inert card to show it.

            NOT INVENTED: the retired IntelligenceModuleCard rendered exactly
            this, `{t.openAction}` plus an up-right arrow, on navigable modules
            only. The string survived the migration to this panel and has sat
            translated and unrendered in both dictionaries ever since; the
            affordance did not. No new string, no new colour — `openAction` is
            already `Open` / `Otwórz`, and the tint is the card's own `--em-ch`.

            Below `md` the word does not fit beside `shortTitle` and the badge in
            a 108x56 box, so the arrow travels alone, as Claude Design specifies.

            `aria-hidden`, like every other visual child: the accessible name
            already carries title, description and status, and the element IS a
            real anchor, so assistive technology already announces it as a link.
            Adding "Open" to the name would be a second, redundant announcement.

            The arrow is inline SVG rather than a lucide import, matching the
            mobile identity icon a few lines above — this file deliberately
            carries no UI-library import surface.
          */}
          {navigable && (
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center gap-cd-3 whitespace-nowrap font-cd-mono text-cd-mono-badge-m uppercase text-[color:rgb(var(--em-ch))] md:text-cd-mono-badge"
            >
              <span className="hidden md:inline">{t.openAction}</span>
              <svg
                focusable="false"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[11px] w-[11px] shrink-0 md:h-[10px] md:w-[10px]"
              >
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </span>
          )}
        </span>
      </span>
    </>
  );

  /* DC-03 — see SC1411_BORDER_ALPHA. Inert cards keep the released value. */
  const borderAlpha = navigable
    ? (SC1411_BORDER_ALPHA[module.id] ?? SC1411_BORDER_ALPHA_FALLBACK)
    : INERT_BORDER_ALPHA;

  const style = { '--em-ch': identity.rgb, '--em-ba': borderAlpha } as CSSProperties;

  if (navigable && module.destination) {
    return (
      <a
        href={module.destination}
        aria-label={accessibleName}
        style={style}
        onMouseEnter={() => onEmphasisChange?.(module.id)}
        onMouseLeave={() => onEmphasisChange?.(null)}
        onFocus={() => onEmphasisChange?.(module.id)}
        onBlur={() => onEmphasisChange?.(null)}
        className={rootClassName}
      >
        {body}
      </a>
    );
  }

  return (
    <div
      role="group"
      aria-label={accessibleName}
      style={style}
      onMouseEnter={() => onEmphasisChange?.(module.id)}
      onMouseLeave={() => onEmphasisChange?.(null)}
      className={rootClassName}
    >
      {body}
    </div>
  );
}
