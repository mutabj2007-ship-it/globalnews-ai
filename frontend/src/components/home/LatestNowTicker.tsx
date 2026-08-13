'use client';

import { useEffect, useRef } from 'react';
import { isLatestNowMotionPaused } from '@/components/home/latestNowMotionSignal';

interface LatestNowTickerProps {
  regionId: string;
  regionLabel: string;
  children: React.ReactNode;
  /** Rendered as an absolutely-positioned overlay at the ticker's left edge, vertically centered against the cards — see LatestNowScrollControls.tsx's own doc comment for why this moved out of a detached header toolbar. */
  previousButton?: React.ReactNode;
  nextButton?: React.ReactNode;
}

/**
 * Milestone #51 (browser acceptance correction) — root cause of the
 * "static" complaint: the previous LatestNowRail had no auto-motion
 * mechanism at all, only manual arrow buttons. This component adds a
 * slow, continuous, professional-feeling auto-scroll — NOT a
 * setInterval that jumps one card at a time (fragile, visibly janky),
 * and NOT duplicated DOM content faking infinite scroll (explicitly
 * discouraged) — instead a `requestAnimationFrame` loop making small,
 * time-based `scrollLeft` increments on the SAME native scrollable
 * container the manual arrows/trackpad/touch already use. When it
 * reaches either end it reverses direction rather than looping —
 * a finite rail that gracefully reverses, as preferred.
 *
 * Performance: exactly one rAF callback, reading refs only — never
 * calls setState, so this NEVER triggers a React re-render, avoiding
 * the "re-render on every frame" failure mode entirely. Pauses (via
 * cancelAnimationFrame, not just a flag) when the tab is hidden
 * (`visibilitychange`), so it costs nothing in a background tab.
 * Cleans up its rAF and all listeners on unmount.
 *
 * Manual-interaction coordination: pauses on pointerenter (mouse
 * hover), touchstart (mobile), and focus (keyboard) — resuming on the
 * corresponding leave/end/blur — plus reads the shared
 * isLatestNowMotionPaused() signal so a manual arrow-button click
 * (LatestNowScrollControls, a separate client component) also
 * suppresses auto-motion briefly rather than visibly fighting it.
 * None of this disables native scrolling: the container remains a
 * genuine `overflow-x-auto` region the whole time, so trackpad/wheel/
 * touch swipe/keyboard-arrow-scroll and drag-to-scroll all keep
 * working exactly as before, whether or not the ticker is currently
 * animating.
 *
 * Reduced motion: if `prefers-reduced-motion: reduce` is active, the
 * animation loop is never started at all — manual scrolling and the
 * arrow buttons remain fully functional, matching the requirement
 * that reduced-motion users lose only the continuous automatic
 * movement, nothing else.
 */
const PIXELS_PER_SECOND = 26;
const RESUME_AFTER_INTERACTION_MS = 1500;

export function LatestNowTicker({
  regionId,
  regionLabel,
  children,
  previousButton,
  nextButton,
}: LatestNowTickerProps): JSX.Element {
  const containerRef = useRef<HTMLUListElement>(null);
  const interactingRef = useRef(false);
  const directionRef = useRef<1 | -1>(1);
  const lastTimestampRef = useRef<number | undefined>(undefined);
  const rafIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    function step(timestamp: number): void {
      const el = containerRef.current;

      if (!el) {
        return;
      }

      const shouldAdvance = !interactingRef.current && !isLatestNowMotionPaused();

      if (shouldAdvance) {
        if (lastTimestampRef.current !== undefined) {
          const deltaMs = timestamp - lastTimestampRef.current;
          const distance = (PIXELS_PER_SECOND * deltaMs) / 1000;
          const maxScroll = el.scrollWidth - el.clientWidth;

          if (maxScroll > 0) {
            let next = el.scrollLeft + distance * directionRef.current;

            if (next >= maxScroll) {
              next = maxScroll;
              directionRef.current = -1;
            } else if (next <= 0) {
              next = 0;
              directionRef.current = 1;
            }

            el.scrollLeft = next;
          }
        }
        lastTimestampRef.current = timestamp;
      } else {
        // Reset the delta baseline while paused so resuming doesn't
        // "jump" by the elapsed pause duration in one frame.
        lastTimestampRef.current = undefined;
      }

      rafIdRef.current = requestAnimationFrame(step);
    }

    function handleVisibilityChange(): void {
      if (document.hidden) {
        if (rafIdRef.current !== undefined) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = undefined;
        }
      } else if (rafIdRef.current === undefined) {
        lastTimestampRef.current = undefined;
        rafIdRef.current = requestAnimationFrame(step);
      }
    }

    function pauseInteraction(): void {
      interactingRef.current = true;
    }

    function resumeInteraction(): void {
      window.setTimeout(() => {
        interactingRef.current = false;
      }, RESUME_AFTER_INTERACTION_MS);
    }

    rafIdRef.current = requestAnimationFrame(step);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    container.addEventListener('pointerenter', pauseInteraction);
    container.addEventListener('pointerleave', resumeInteraction);
    container.addEventListener('touchstart', pauseInteraction, { passive: true });
    container.addEventListener('touchend', resumeInteraction);
    container.addEventListener('focusin', pauseInteraction);
    container.addEventListener('focusout', resumeInteraction);

    return () => {
      if (rafIdRef.current !== undefined) {
        cancelAnimationFrame(rafIdRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      container.removeEventListener('pointerenter', pauseInteraction);
      container.removeEventListener('pointerleave', resumeInteraction);
      container.removeEventListener('touchstart', pauseInteraction);
      container.removeEventListener('touchend', resumeInteraction);
      container.removeEventListener('focusin', pauseInteraction);
      container.removeEventListener('focusout', resumeInteraction);
    };
  }, []);

  return (
    <div className="relative">
      <ul
        ref={containerRef}
        id={regionId}
        role="region"
        aria-label={regionLabel}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>

      {/* Two-sided edge fade — reads as "a live stream continuing in
          both directions," not an accidental cutoff. Widened slightly
          from the single-edge version and pointer-events-none so it
          never blocks the overlay buttons or card interaction. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-void to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-void to-transparent"
      />

      {previousButton && (
        <div className="absolute inset-y-0 left-1 flex items-center">{previousButton}</div>
      )}
      {nextButton && <div className="absolute inset-y-0 right-1 flex items-center">{nextButton}</div>}
    </div>
  );
}
