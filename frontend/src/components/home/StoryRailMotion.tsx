'use client';

import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE STORY RAIL — RESTRAINED AUTO-ADVANCE, PLUS EXPLICIT PREVIOUS / NEXT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Completion ruling item 4 established the automatic behaviour:
 *
 *   "Cards should move horizontally to the left in a restrained automatic
 *    progression ... pause on hover/focus/interaction; resume after
 *    inactivity; respect `prefers-reduced-motion`; no continuous marquee; no
 *    fast ticker behavior."
 *
 * The final visual contract adds the manual half:
 *
 *   "Add visible Previous <- / Next -> rail controls. One card step per press.
 *    Preserve existing auto-advance, swipe, keyboard navigation,
 *    pause-on-interaction and reduced-motion behavior. No native horizontal
 *    scrollbar."
 *
 * ── ONE MOVEMENT FUNCTION, TWO CALLERS ──────────────────────────────────
 *
 * `advance()` is the only thing that ever scrolls this rail. The interval
 * calls it with +1; the buttons call it with +1 or -1. That is deliberate:
 * a press and a tick therefore move by exactly the same measured stride —
 * one card plus the row's real column gap, read from the DOM rather than
 * assumed — so the two can never disagree about what "one card" means.
 *
 * A press is also an interaction, so it calls `hold()`. Pressing Next does
 * not leave the timer about to fire again a moment later.
 *
 * Both controls wrap, in the same direction the timer does: Next at the end
 * returns to the start, Previous at the start goes to the end. That keeps
 * either control useful at every position instead of dead-ending, and it
 * matches what the automatic progression already does.
 *
 * REDUCED MOTION: the automatic progression is disabled entirely, but the
 * buttons remain — a reader who has asked for less motion still gets to move
 * the rail, they simply are not moved without asking. Their scroll is
 * instant rather than smooth for the same reason.
 *
 * ── IT MAKES NO NETWORK REQUESTS. AT ALL. ───────────────────────────────
 *
 * No fetch, no poll, no state from outside. It scrolls an element already in
 * the document holding cards the server already rendered from the one
 * `getHomeFeed()` call Home already makes. Nothing here can cause a provider
 * call, spend quota, or start an AI analysis.
 *
 * Only this controller ships to the browser: the `<li>` cards are passed
 * through as `children` and stay server-rendered, and the CSS-only category
 * filter keeps working because the `<ul>` is still a descendant of `.gn-deck`.
 */

/** Long enough to read a card before it moves. Deliberately unhurried. */
const DWELL_MS = 7000;
/** Quiet required after the reader touches the rail before motion resumes. */
const RESUME_MS = 4500;

interface StoryRailMotionProps {
  children: ReactNode;
  className: string;
  ariaLabel: string;
  /** Governed `globalDevelopments.previousLabel` / `nextLabel`. */
  previousLabel: string;
  nextLabel: string;
}

export function StoryRailMotion({
  children,
  className,
  ariaLabel,
  previousLabel,
  nextLabel,
}: StoryRailMotionProps): JSX.Element {
  const railRef = useRef<HTMLUListElement | null>(null);
  const busyUntil = useRef<number>(0);
  const programmatic = useRef<boolean>(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [reduced, setReduced] = useState(false);

  /* Automatic motion is OFF until we have confirmed the reader has not asked
     for less of it. Defaulting to off means a reduced-motion reader never
     sees a first advance before the check lands. */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (): void => {
      setReduced(query.matches);
      setAutoEnabled(!query.matches);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const hold = useCallback((ms: number = RESUME_MS): void => {
    busyUntil.current = Date.now() + ms;
  }, []);

  /** The single movement function. `direction` is +1 or -1; one card per call. */
  const advance = useCallback(
    (direction: 1 | -1, manual: boolean): void => {
      const rail = railRef.current;
      if (rail === null) return;

      const overflow = rail.scrollWidth - rail.clientWidth;
      /* A rail with nothing to scroll must not twitch. */
      if (overflow <= 4) return;

      const first = rail.firstElementChild as HTMLElement | null;
      if (first === null) return;
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap || '0') || 0;
      const stride = first.getBoundingClientRect().width + gap;

      let next = rail.scrollLeft + stride * direction;
      if (direction === 1 && rail.scrollLeft + stride >= overflow - 2) next = 0;
      if (direction === -1 && rail.scrollLeft <= 2) next = overflow;
      next = Math.max(0, Math.min(overflow, next));

      programmatic.current = true;
      rail.scrollTo({ left: next, behavior: manual && reduced ? 'auto' : 'smooth' });
      window.setTimeout(() => {
        programmatic.current = false;
      }, 700);
    },
    [reduced],
  );

  useEffect(() => {
    if (!autoEnabled) return undefined;
    const id = window.setInterval(() => {
      if (Date.now() < busyUntil.current) return;
      if (document.hidden) return;
      advance(1, false);
    }, DWELL_MS);
    return () => window.clearInterval(id);
  }, [autoEnabled, advance]);

  /* The reader's own scrolling pauses the rotation; ours does not. */
  const onScroll = useCallback((): void => {
    if (!programmatic.current) hold();
  }, [hold]);

  /* A press is an interaction: move one card AND stop the clock. */
  const press = useCallback(
    (direction: 1 | -1): void => {
      hold();
      advance(direction, true);
    },
    [advance, hold],
  );

  const control =
    'inline-flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[#1b3a5c] ' +
    'bg-[#0a1e33] text-[#c2d3e6] transition-colors hover:border-cyan-400/55 hover:bg-[#12293f] hover:text-white ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none ' +
    'xl:h-[38px] xl:w-[38px]';

  return (
    <div className="flex flex-col gap-2.5">
      {/*
        The controls sit ABOVE the rail rather than floating over its sides.
        At four-up desktop there is no side margin to overlay without covering
        a card, and a control that covers the thing it scrolls is worse than
        one that does not. Right-aligned, 44px targets, visible at every width.
      */}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => press(-1)} aria-label={previousLabel} className={control}>
          <ArrowLeft size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => press(1)} aria-label={nextLabel} className={control}>
          <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <ul
        ref={railRef}
        tabIndex={0}
        role="group"
        aria-label={ariaLabel}
        className={className}
        onPointerEnter={() => hold(Number.MAX_SAFE_INTEGER - Date.now())}
        onPointerLeave={() => hold()}
        onPointerDown={() => hold()}
        onPointerUp={() => hold()}
        onTouchStart={() => hold()}
        onTouchEnd={() => hold()}
        onWheel={() => hold()}
        onFocus={() => hold(Number.MAX_SAFE_INTEGER - Date.now())}
        onBlur={() => hold()}
        onScroll={onScroll}
      >
        {children}
      </ul>
    </div>
  );
}
