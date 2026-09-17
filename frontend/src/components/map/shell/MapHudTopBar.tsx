'use client';

import type { ReactNode } from 'react';
import { MAP_PERIODS, type MapPeriod } from '@/lib/map/state/mapState';
import { BAND_ACTIVE, BAND_AVAILABLE } from '@/lib/map/spatial/controlBands';

/**
 * SPATIAL M2 — THE HUD TOP BAR, FROM DESIGN PART II §2.
 *
 * "Brand strip, mode switcher slot, search slot, period chips. SHRINK ORDER IS
 * FIXED: modes scroll first, search floors at 158 px, chips never shrink."
 *
 * ── THE SHRINK ORDER IS CSS, NOT A COMMENT ────────────────────────────────
 *
 * The spec fixes an order, so each slot carries the flex rule that produces
 * its position in that order rather than a note asking a future editor to
 * remember it:
 *
 *   modes    `min-w-0 flex-1` — it is the only slot that may lose width, and
 *            its own row scrolls horizontally once it runs out.
 *   search   `shrink-0` at a 158 px floor, supplied by `PlaceSearch` itself.
 *   chips    `shrink-0`, unconditionally. "Chips never shrink."
 *
 * ── SLOTS, NOT COMPONENTS ─────────────────────────────────────────────────
 *
 * The mode switcher and search arrive as children. The bar is a layout, and a
 * layout that imported the controls it positions would force every surface
 * that wants the bar to accept the controls too — which is exactly the clone
 * problem Part II §8 q3 solves with density profiles.
 */

export interface MapHudTopBarLabels {
  readonly brand: string;
  readonly brandSub: string;
  /** Accessible-name suffix on the brand mark, which links home. */
  readonly brandHome: string;
  readonly periodGroup: string;
  readonly periods: Readonly<Record<MapPeriod, string>>;
}

export interface MapHudTopBarProps {
  readonly modeSlot?: ReactNode;
  readonly searchSlot?: ReactNode;
  /**
   * CHECKPOINT F — MAP-GLOBAL-LANGUAGE-CONTROL-1.
   *
   * A SLOT, not a component, because that is what this bar takes. The Spatial
   * shell mounts no NavBar, so before this there was no EN/PL control anywhere
   * on the map: the language could be read from the cookie and never changed.
   *
   * Optional, so a bar rendered without it is exactly the accepted bar.
   */
  readonly languageSlot?: ReactNode;
  readonly period: MapPeriod;
  readonly onPeriodChange: (period: MapPeriod) => void;
  readonly showPeriodChips?: boolean;
  readonly labels: MapHudTopBarLabels;
  readonly className?: string;
}

export function MapHudTopBar({
  modeSlot,
  searchSlot,
  languageSlot,
  period,
  onPeriodChange,
  showPeriodChips = true,
  labels,
  className = '',
}: MapHudTopBarProps): JSX.Element {
  return (
    <div
      data-gn="map-hud-top-bar"
      /* The prototype's 44px top row: brand · modes · search · period. */
      className={`flex h-[44px] items-center gap-[14px] border-b border-sp-line bg-gradient-to-b from-sp-top-a to-sp-top-b px-[12px] ${className}`}
    >
      {/*
        ══ THE BRAND MARK IS THE WAY OUT ═══════════════════════════════════

        NAMED AND REVERSIBLE, and the reason is a consequence rather than a
        preference. The CTO's ruling removes the product NavBar at this
        breakpoint, which is right — Design's composition is full-screen and
        carries its own bar. But the NavBar was also the only route off this
        page, and a full-screen surface with no exit is a worse outcome than
        the one the ruling is fixing.

        So the mark that already reads `● GLOBALNEWS AI` becomes a link to the
        homepage. NOT A REDESIGN: the same dot, the same two words, the same
        44 px row, the same spacing and the same colours — every pixel is
        unchanged, and an `<a>` replaces a `<div>` around them. The prototype's
        own bar carries this mark in this position; this only makes it do the
        thing a brand mark in a product header does.

        Delete the anchor and restore the `<div>` to revert, in one edit.
      */}
      <a
        data-gn="hud-brand"
        href="/"
        aria-label={`${labels.brand} — ${labels.brandHome}`}
        className="flex shrink-0 items-center gap-[8px] border-e border-sp-line pe-[12px] outline-none transition-colors hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
      >
        <span
          aria-hidden="true"
          className="h-[7px] w-[7px] rounded-full bg-sp-cyan shadow-[0_0_10px_#3ad6e6]"
        />
        <b className="text-[12px] font-semibold tracking-[0.16em] text-sp-ink">{labels.brand}</b>
        <span className="hidden font-gn-mono text-[9.5px] tracking-[0.16em] text-sp-ink-3 lg:inline">
          {labels.brandSub}
        </span>
      </a>

      {/* MODES SCROLL FIRST — the only slot permitted to lose width (Part II §5). */}
      {modeSlot && (
        <div data-gn="hud-mode-slot" className="flex min-w-0 flex-1">
          {modeSlot}
        </div>
      )}

      {searchSlot && (
        <div data-gn="hud-search-slot" className="ms-auto shrink">
          {searchSlot}
        </div>
      )}

      {/*
        LANGUAGE SITS BESIDE THE PERIOD CHIPS, AND BEFORE THEM.

        Both are small closed-set choices in the same segmented grammar, so they
        belong together rather than at opposite ends of the bar. Language comes
        first because it governs everything else in the row — the mode names,
        the period names and the search placeholder are all rendered in it.

        It never shrinks, for the same reason the chips do not: Part II §5 gives
        the mode row the entire shrink budget.
      */}
      {languageSlot && (
        <div data-gn="hud-language-slot" className="flex shrink-0 items-center">
          {languageSlot}
        </div>
      )}

      {/*
        CHIPS NEVER SHRINK — and they are one segmented control, not four
        buttons: a single hairline border with 1px gaps, which is what makes
        them read as a range selector rather than as four unrelated actions.
      */}
      {showPeriodChips && (
        <div
          data-gn="hud-period-chips"
          role="radiogroup"
          aria-label={labels.periodGroup}
          className="flex shrink-0 gap-px overflow-hidden rounded-[2px] border border-sp-line"
        >
          {MAP_PERIODS.map((value) => {
            const active = value === period;

            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                data-gn="period-chip"
                data-gn-period={value}
                onClick={() => onPeriodChange(value)}
                /*
                  DESIGN v1.6 — period chips are controls, and every period is
                  built, so the choice is only ever ACTIVE or AVAILABLE.
                  The revision also raises the active fill from .12 to .16,
                  which the ACTIVE band carries.

                  These sit inside a segmented group with its own border, so the
                  band's per-chip border is suppressed here: two borders one
                  pixel apart read as a rendering fault rather than as emphasis.
                */
                className={`shrink-0 border-transparent px-[9px] py-[6px] font-gn-mono text-[9.5px] tracking-[0.1em] ${
                  active ? BAND_ACTIVE : `${BAND_AVAILABLE} !border-transparent !bg-transparent`
                }`}
              >
                {labels.periods[value]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
