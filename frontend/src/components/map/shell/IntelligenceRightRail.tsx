'use client';

import type { ReactNode } from 'react';

/**
 * SPATIAL M2 — THE INTELLIGENCE RAIL, FROM DESIGN PART II §2.
 *
 * "Hosts ContextSummaryPanel or EvidenceSelectionCard depending on selection.
 * SCROLLS INDEPENDENTLY OF THE MAP."
 *
 * It is a container and deliberately nothing more. It does not know what a
 * selection is, does not read the evidence set, and chooses between its two
 * possible children only by which one it was handed — because the moment a
 * rail starts deciding what to show, the selection model has a second owner
 * and the two disagree on the first edge case.
 *
 * Part II §5 gives it its widths: 372 px at ≥1440, 320 px at 1024–1439, and
 * "becomes an OVERLAY DRAWER over the map, opened by selection, dismissable"
 * at 861–1023. Below 860 the rail does not exist at all — the bottom sheet
 * renders "the same card components as the right rail, NEVER A PARALLEL MOBILE
 * CARD IMPLEMENTATION" (§2), which is why this component holds no card markup
 * of its own for the sheet to duplicate.
 */

export interface IntelligenceRightRailProps {
  readonly label: string;
  readonly children: ReactNode;
  /** Tablet: the rail floats over the map and can be dismissed. */
  readonly asDrawer?: boolean;
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
  readonly className?: string;
}

export function IntelligenceRightRail({
  label,
  children,
  asDrawer = false,
  onDismiss,
  dismissLabel,
  className = '',
}: IntelligenceRightRailProps): JSX.Element {
  return (
    <aside
      data-gn="map-intelligence-rail"
      data-gn-drawer={asDrawer}
      aria-label={label}
      className={`${
        asDrawer
          ? 'absolute right-0 top-0 z-20 h-full w-[320px] max-w-[85%] border-s border-gn-line-card bg-gn-panel/95 backdrop-blur-sm'
          : 'h-full w-full'
      } flex flex-col ${className}`}
    >
      {asDrawer && onDismiss && (
        <div className="flex justify-end p-1">
          <button
            type="button"
            data-gn="rail-dismiss"
            onClick={onDismiss}
            className="rounded-[5px] border border-gn-line-chip px-2 py-0.5 font-gn-mono text-[10px] uppercase tracking-[0.08em] text-gn-ink-secondary hover:border-gn-line-hover"
          >
            {dismissLabel}
          </button>
        </div>
      )}

      {/*
        SCROLLS INDEPENDENTLY OF THE MAP — Part II §2, and the reason the
        overflow lives here rather than on the page. A rail that scrolled the
        document would take the map with it.
      */}
      <div data-gn="rail-scroll" className="min-h-0 flex-1 overflow-y-auto p-2">
        {children}
      </div>
    </aside>
  );
}
