'use client';

import { useCallback } from 'react';
import { canReturnInApp } from '@/lib/navigation/returnDepth';
import { returnFallbackFor } from '@/lib/navigation/returnFallback';
import { returnStringsFor } from '@/lib/navigation/returnStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SHARED BACK / RETURN CONTROL — ONE PRIMITIVE, TWO ACCEPTED HOSTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT, MEASURED. H probed fourteen surfaces across two viewports for any
 * affordance whose text begins with an arrow, *back*, *return*, *wstecz* or
 * *powrót*:
 *
 *     surfaces with a return affordance ......... 1 of 14
 *     and it is Energy, COMPACT ONLY
 *     every other surface, both viewports ....... none
 *
 * `SearchPageClient` calls `router.back()` directly and `AnalysisSubViewStrip`
 * owns a sub-view back — two bespoke implementations, neither shared, neither
 * reachable from a specialist surface. That cross-product shape is why this is
 * solved ONCE here rather than fourteen times in fourteen headers.
 *
 * ── THE BEHAVIOUR, AND WHY IT CANNOT RENDER DEAD ───────────────────────────
 *
 *     entered by in-app navigation   -> history.back()
 *     entered by direct link/new tab -> navigate to the governed fallback
 *
 * THE TWO BRANCHES ARE TOTAL. `canReturnInApp()` returns a boolean and the
 * fallback is always a real route, so there is no third state, no unknown and
 * NO DISABLED STATE. The control cannot render as an affordance that does
 * nothing — the exact "dead Back button" failure this round rules out.
 *
 * ── WHY THE PLATFORM HISTORY API AND NOT `useRouter` ───────────────────────
 *
 * MEASURED, NOT PREFERRED. `useRouter`/`usePathname` throw
 * *"invariant expected app router to be mounted"* outside an App Router
 * context, and the specialist surfaces are rendered through
 * `renderToStaticMarkup` in their own accepted harnesses — Market's synthetic
 * harness failed exactly this way. A chrome control that cannot be rendered by
 * the harnesses that govern its hosts is not landable.
 *
 * Nothing is lost by the change. H's own note says the back branch is
 * *"router.back() — the browser's own"*, and `history.back()` IS that call
 * without the context requirement. The fallback branch is a real navigation
 * either way. In exchange the control becomes renderable anywhere, hook-free
 * apart from `useCallback`, and carries no `next/navigation` edge into the
 * sealed specialist closures.
 *
 * ── WHY IT DOES NOT IMPORT THE PRODUCT DICTIONARY ──────────────────────────
 *
 * Also measured. `getDictionary` drags `en/pl/adminEn/adminPl/supportEn/
 * supportPl` into the closure of every host, and those files carry `https://`
 * literals and provider names, so the specialist surfaces' OWN provider-
 * reachability guards fired. The guards were right. See
 * `lib/navigation/returnStrings.ts`.
 *
 * ── WHAT IT IS NOT ─────────────────────────────────────────────────────────
 *
 *   a page-specific arrow   NO — one component, imported. A guard sweeps for
 *                                local arrow literals outside this file.
 *   a second history stack  NO — `history.back()` is the browser's own.
 *   a modal/overlay dismiss NO — EnergyAskOverlay and the Energy lens own their
 *                                transient returns, which are STATE exits, not
 *                                route exits. They are untouched.
 *   a breadcrumb            NO — BreadcrumbZoomNavigator is Map's spatial
 *                                ladder and answers a different question.
 *   a replacement for the   NO — this is IN ADDITION to the platform gesture,
 *   browser gesture              which is never intercepted.
 *
 * ── NO CHROME IS ADDED, BY CONSTRUCTION ────────────────────────────────────
 *
 * Both hosts already exist and already have their height: the NavBar's 62px
 * desktop row, and each specialist surface's existing top micro-line. The
 * control takes the LEADING POSITION of a row that already renders. It never
 * introduces a row, so `COMPACT_CHROME_HARD_MAX` cannot be approached.
 *
 * ── NO RETRIEVAL, EVER ─────────────────────────────────────────────────────
 *
 * This file performs no fetch on mount, on render or on press. Navigation is
 * not retrieval, and nothing here can spend provider quota.
 */

export type ReturnControlVariant =
  /** HOST A — the leading item of the NavBar's existing 62px desktop row. */
  | 'navbar'
  /** HOST B — the leading item of a specialist surface's existing micro-line. */
  | 'microline';

export interface ReturnControlProps {
  /*
    DELIBERATELY WIDER THAN `LanguageCode`, and narrowed once here rather than
    at nine call sites. The specialist surfaces carry their own locale types —
    Economy's `DisplayLocale` admits de/pt/ar — so a narrow prop would force a
    cast in every host, and a cast at a call site is where a wrong value enters
    silently.
  */
  language: string;
  /** Which accepted host is rendering it. Affects type scale only. */
  variant?: ReturnControlVariant;
  /**
   * Hide the text label and keep only the arrow, for the host rows H measured
   * at 0px free width at 390px. The destination still reaches assistive
   * technology through `aria-label`, which is never abbreviated.
   */
  iconOnly?: boolean;
  /**
   * `/map` only. A reader who selected a country expects the first return to
   * undo the SELECTION and stay on the route; only a second press leaves it.
   * When supplied and it returns true, the selection was cleared and no
   * navigation happens. Every other surface omits this.
   */
  onClearSubState?: () => boolean;
  className?: string;
}

/**
 * The arrow. Declared once, here, so the guard forbidding local arrow literals
 * elsewhere has exactly one legitimate home to point at.
 */
export const RETURN_GLYPH = '←';

export function ReturnControl({
  language,
  variant = 'microline',
  iconOnly = false,
  onClearSubState,
  className,
}: ReturnControlProps) {
  const t = returnStringsFor(language);

  const handleReturn = useCallback(() => {
    /*
      SUB-STATE FIRST. On /map with a selection the first press clears the
      selection and stays put. Opt-in per surface, so this component holds no
      knowledge about the map.
    */
    if (onClearSubState && onClearSubState()) return;

    if (typeof window === 'undefined') return;

    /*
      THE TOTAL PAIR, read at CLICK TIME and never during render — so the value
      cannot disagree with what the reader just did, and there is no hydration
      surface here at all.
    */
    if (canReturnInApp()) {
      window.history.back();
      return;
    }

    window.location.assign(returnFallbackFor(window.location.pathname));
  }, [onClearSubState]);

  /*
    THE VISIBLE LABEL IS RESOLVED AT RENDER AND MUST NOT READ THE COUNTER.
    `canReturnInApp()` is client-only state; reading it during render would make
    the server and client markup disagree. The label is therefore the neutral
    one and the accessible name is the neutral one — both branches are reachable
    from the same rendered control, which is what keeps it from ever being dead.
  */
  const ariaLabel = onClearSubState ? t.ariaLabelClearSelection : t.ariaLabelBack;

  /*
    THE 44px COMPACT TARGET WITHOUT GROWING THE BOX. `before:` paints nothing
    (`content-['']`, no background) and is absolutely positioned, so it takes
    part in hit-testing and not in layout. The button's own box keeps the host
    row's type scale, so measured chrome height is byte-identical.
  */
  const target =
    'relative before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] ' +
    "before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] md:before:hidden";

  const scale =
    variant === 'navbar'
      ? 'font-cd-mono text-[12px] tracking-[0.08em]'
      : 'font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em]';

  return (
    <button
      type="button"
      data-gn-return-control={variant}
      onClick={handleReturn}
      aria-label={ariaLabel}
      className={[
        'inline-flex shrink-0 items-center gap-[6px] text-ink-secondary',
        'transition-none hover:text-ink-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus',
        target,
        scale,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true">{RETURN_GLYPH}</span>
      {iconOnly ? null : <span className="truncate">{t.label}</span>}
    </button>
  );
}
