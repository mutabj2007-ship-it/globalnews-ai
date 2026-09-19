'use client';

import { useEffect } from 'react';
import type { CalloutPlacement } from '@/lib/map/selection/calloutPlacement';
import { MachineReadable } from '@/lib/typography/runBoundary';
import { continentDisplayName } from '@/lib/map/geography/displayName';

/**
 * ══ THE COMPACT SELECTION ANCHOR ══════════════════════════════════════════
 *
 * MAP-CALLOUT-RAIL-DUPLICATION · CTO/Product ruling, R2-B §5, 2026-09-19
 *
 * "The old SPATIAL M2 full selection-callout content is SUPERSEDED when the
 * persistent right rail/drawer is already presenting the same selected
 * geography ... the map callout becomes a compact selection anchor only. The
 * persistent right rail remains the authoritative detailed/action surface."
 *
 * ── WHAT THE MEASUREMENT FOUND ────────────────────────────────────────────
 *
 * Eight of eight blocks duplicated a right-rail block, and the component was
 * handed `labels={spatial.card}` — literally the rail card's own dictionary.
 * This was never a summary of the rail. It was the rail's vocabulary redrawn
 * over the map.
 *
 *     WAS                              NOW
 *     title                            title
 *     identity  KEN · AFRICA           identity  KEN · Afryka
 *     provider status                  close
 *     precision + provenance chips     —
 *     stats  reports / sources / new   —
 *     coverage band + freshness        —
 *     Follow / sign-in                 —
 *     Focus · Analysis · Sources       —
 *     close                            —
 *
 * ── THIS REVERSES AN EARLIER CORRECTION, DELIBERATELY AND BY NAME ─────────
 *
 * The deleted action cluster carried a CTO correction of 2026-09-01: "the
 * popup must expose the full selected-geography action cluster, not a reduced
 * subset ... These must not disappear simply because the rail also contains
 * related actions."
 *
 * The 2026-09-19 ruling reverses precisely that sentence, and names Follow,
 * Open Analysis, Sources, Print evidence, Expand period and provider status
 * for removal. Recorded here rather than silently dropped, because the older
 * instruction was right about the problem it addressed — a screenshot showing
 * FOCUS alone, two actions having vanished with no trace — and that problem is
 * now solved differently: the actions are not a reduced subset here, they are
 * not here at all, and the rail beside them carries the complete set.
 *
 * ── WHY THE RULE IS UNCONDITIONAL HERE RATHER THAN A BRANCH ───────────────
 *
 * The ruling conditions the compact form on "right rail = same selected
 * geography". On this surface that condition is ALWAYS TRUE, by construction
 * rather than by coincidence:
 *
 *     calloutVisible = hud.rightRail && … && selection !== null && …
 *
 * The anchor cannot render unless the rail is present, and the rail renders
 * the card for whatever `selection` holds. There is no reachable state in
 * which this component appears beside a rail showing something else, and
 * `calloutRailDuplication.spec.ts` asserts that rather than assuming it.
 *
 * So the removed blocks are DELETED, not branched behind a flag. R2-A settled
 * the principle for the provider boundary and it applies unchanged: a path
 * nothing calls today is how the defect returns. A spy proves one render did
 * not draw a Follow button; a component with no `follow` prop proves none can.
 *
 * ── WHAT IS KEPT, AND WHY THE IDENTITY LINE IS NOT A DUPLICATE ────────────
 *
 * The ruling's keep-list is "localized geography name; minimal type/context if
 * useful; close/dismiss affordance", and its remove-list ends with the
 * catch-all "any other block already present in the right rail". The identity
 * line — ISO-3 and the localised continent — answers to both, so the explicit
 * keep governs over the catch-all: it is exactly "minimal type/context", it is
 * one line of nine characters, and it is what lets the anchor name a place
 * unambiguously rather than showing a bare word that several geographies share
 * once translated. It carries no figure, no status and no action.
 *
 * ── DISMISSAL IS SELECTION-LOCAL, AND ALREADY WAS ─────────────────────────
 *
 * "Dismissal is selection-local only ... no persisted session/user preference;
 * no new settings contract." The shell keys dismissal to the geography it was
 * made for — `calloutDismissedFor !== selection.id` — so closing this hides it
 * for the current selection, and choosing a different geography shows that
 * one's anchor. Nothing is written to storage. The ruling confirms the
 * existing behaviour rather than changing it; the spec pins it so it stays.
 */

export interface SelectionCalloutLabels {
  readonly close: string;
}

export interface SelectionCalloutProps {
  /** From `state.selected`. The anchor creates no selection of its own. */
  readonly geographyId: string;
  /**
   * Already localised by the shell's single name path — see
   * `lib/map/geography/displayName`. The anchor resolves nothing itself.
   */
  readonly displayName: string;
  readonly identity?: { readonly iso3: string; readonly region?: string };
  /**
   * The five registry groupings, localised — the only label record this
   * component still needs.
   *
   * Deliberately NOT the `EvidenceSelectionCardLabels` block it used to take.
   * A component that cannot receive the rail's vocabulary cannot grow the
   * rail's content back, which is the same guard the original amendment used
   * when it refused an `items` prop.
   */
  readonly continents: Readonly<Record<string, string>>;
  readonly placement: CalloutPlacement;
  /**
   * The shell measures the rendered box so the placement maths uses the real
   * height rather than the ceiling. Not state the anchor owns — a measurement
   * of the DOM, like the projected anchor point.
   */
  readonly measureRef?: (node: HTMLElement | null) => void;
  readonly calloutLabels: SelectionCalloutLabels;
  readonly onDismiss: () => void;
}

/**
 * FIXED, NOT MAXIMUM.
 *
 * The width the placement maths is given and the width the element renders are
 * the same number, so the flip decision cannot be made against a size the
 * browser then disagrees with.
 *
 * NARROWED FROM 268 WITH THE CONTENT. An anchor holding a name and an ISO line
 * does not need the width a coverage band and a three-up statistic row did,
 * and an over-wide box flips sides sooner than it has to while covering more
 * of the map than it earns.
 */
export const CALLOUT_WIDTH = 212;

/**
 * A HEIGHT CEILING THAT IS NEVER REACHED BY THE KEPT CONTENT.
 *
 * `overflow-hidden` rather than `overflow-auto`, deliberately: if some future
 * edit does overflow this box, the content is CLIPPED and the defect is
 * visible in a screenshot. `auto` would hide the same mistake behind a
 * scrollbar — which the original amendment names as proof the implementation
 * is wrong, and that is no less true of the anchor.
 *
 * WAS 320, FOR EIGHT BLOCKS. It is also the FIRST-FRAME PLACEMENT FALLBACK
 * before the real box is measured, so leaving it at 320 would have placed the
 * first paint against a height nearly four times what now renders.
 */
export const CALLOUT_MAX_HEIGHT = 84;

export function SelectionCallout({
  geographyId,
  displayName,
  identity,
  continents,
  placement,
  measureRef,
  calloutLabels,
  onDismiss,
}: SelectionCalloutProps): JSX.Element {
  /*
    ESCAPE DISMISSES IT.

    Bound on the document rather than on the element, because the reader's
    focus is almost never inside the anchor when they want it gone — they have
    just clicked a country. `keydown` and not `keyup` so it matches every other
    Escape in the product.
  */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <aside
      ref={measureRef}
      data-gn="selection-callout"
      data-gn-variant="compact-anchor"
      data-gn-hud=""
      data-gn-geography={geographyId}
      data-gn-side={placement.side}
      data-gn-parked={placement.parked ? 'true' : 'false'}
      /*
        NOT `data-gn-hud-reserve`. The label placer avoids the HUD islands
        because they are permanent furniture; the anchor is transient and
        follows the camera, and reserving space for it would make country
        labels jump around the map as the reader panned.
      */
      aria-label={displayName}
      style={{
        left: `${placement.x}px`,
        top: `${placement.y}px`,
        width: `${CALLOUT_WIDTH}px`,
        maxHeight: `${CALLOUT_MAX_HEIGHT}px`,
      }}
      /*
        `overflow-hidden` — see CALLOUT_MAX_HEIGHT. And `pointer-events-auto`
        because the canvas region's overlay layer is inert to the pointer;
        without it the close control below would not be clickable.
      */
      className="pointer-events-auto absolute z-20 overflow-hidden border border-sp-line-2 bg-sp-panel/95 shadow-[0_10px_30px_rgba(0,0,0,.55)] backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-[8px] px-[11px] py-[9px]">
        <div className="min-w-0">
          <h2
            data-gn="callout-title"
            className="truncate text-[14px] font-semibold leading-tight text-sp-ink"
          >
            {displayName}
          </h2>
          {identity && (
            <p
              data-gn="callout-identity"
              className="mt-[2px] font-gn-mono text-[8.5px] uppercase tracking-[0.14em] text-sp-ink-3"
            >
              <MachineReadable>{identity.iso3}</MachineReadable>
              {identity.region && (
                <> {'·'} {continentDisplayName(identity.region, continents)}</>
              )}
            </p>
          )}
        </div>
        {/*
          THE CLOSE CONTROL. A named button, not a bare glyph — the same rule
          Design applies to the source card's open affordance, for the same
          reason: an icon with no accessible name is a control only some
          readers have.

          It is now the anchor's ONLY control, which is exactly what the ruling
          makes it: "closing the compact anchor hides it for the current
          selection".
        */}
        <button
          type="button"
          data-gn="callout-close"
          onClick={onDismiss}
          aria-label={calloutLabels.close}
          className="-mr-[3px] -mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center border border-sp-line text-[11px] text-sp-ink-3 outline-none transition-colors hover:border-sp-line-2 hover:text-sp-ink-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </aside>
  );
}
