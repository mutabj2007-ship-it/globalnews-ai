'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pauseLatestNowMotion } from '@/components/home/latestNowMotionSignal';

interface LatestNowScrollControlsProps {
  /** id of the server-rendered scroll region this controls — looked up via getElementById rather than a React ref, since a Server Component can't hand a ref to this client sibling directly. */
  regionId: string;
  itemCount: number;
  previousLabel: string;
  nextLabel: string;
}

/** Below this count, the rail fits without needing scroll controls at all — matching a ~220px card width across typical viewport widths; the controls are a pure convenience layered on top of native scrolling, never required. */
const MIN_ITEMS_FOR_CONTROLS = 4;
const SCROLL_AMOUNT_PX = 240;
/** How long a manual arrow click suppresses the ticker's auto-scroll — matches LatestNowTicker's own post-interaction grace delay, so control never visibly "snaps back" from the user. */
const PAUSE_AFTER_CLICK_MS = 1500;

const BUTTON_CLASSES =
  'flex h-11 w-11 items-center justify-center rounded-full border border-cyan-500/25 bg-void/90 text-ink-secondary shadow-md backdrop-blur-sm transition-colors hover:border-cyan-400 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50';

/**
 * Milestone #51 (browser-acceptance UX polish) — redesigned from a
 * detached header toolbar into two independently-positioned overlay
 * buttons meant to sit directly on the rail itself (left/right edges,
 * vertically centered against the cards) — the caller positions each
 * with its own absolute wrapper; this component no longer groups them
 * side by side. Hidden below `sm` per "controls may be hidden [on
 * mobile] if they interfere with useful width" — native swipe remains
 * the primary mobile interaction, matching the existing pattern of
 * other homepage controls being desktop-only enhancements over a
 * fully-functional touch/scroll base.
 *
 * Still the ONLY client boundary for manual navigation. LatestNowRail
 * itself (the parent) remains a Server Component; CSS scroll-snap
 * makes the rail fully scrollable via trackpad/touch/wheel with zero
 * JavaScript regardless of whether these buttons render at all.
 *
 * Never renders when there isn't genuinely more content than fits
 * (see MIN_ITEMS_FOR_CONTROLS) — "do not render useless arrows."
 */
export function LatestNowPreviousButton({
  regionId,
  itemCount,
  previousLabel,
}: Pick<LatestNowScrollControlsProps, 'regionId' | 'itemCount' | 'previousLabel'>): JSX.Element | null {
  if (itemCount < MIN_ITEMS_FOR_CONTROLS) {
    return null;
  }

  function handleClick(): void {
    pauseLatestNowMotion(PAUSE_AFTER_CLICK_MS);
    document.getElementById(regionId)?.scrollBy({ left: -SCROLL_AMOUNT_PX, behavior: 'smooth' });
  }

  return (
    <button type="button" onClick={handleClick} aria-label={previousLabel} className={`hidden sm:flex ${BUTTON_CLASSES}`}>
      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function LatestNowNextButton({
  regionId,
  itemCount,
  nextLabel,
}: Pick<LatestNowScrollControlsProps, 'regionId' | 'itemCount' | 'nextLabel'>): JSX.Element | null {
  if (itemCount < MIN_ITEMS_FOR_CONTROLS) {
    return null;
  }

  function handleClick(): void {
    pauseLatestNowMotion(PAUSE_AFTER_CLICK_MS);
    document.getElementById(regionId)?.scrollBy({ left: SCROLL_AMOUNT_PX, behavior: 'smooth' });
  }

  return (
    <button type="button" onClick={handleClick} aria-label={nextLabel} className={`hidden sm:flex ${BUTTON_CLASSES}`}>
      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
