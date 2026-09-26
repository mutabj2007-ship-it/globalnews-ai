'use client';

import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE STORY RAIL'S RESTRAINED AUTO-ADVANCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Completion ruling item 4:
 *
 *   "Cards should move horizontally to the left in a restrained automatic
 *    progression ... do not jump the reader while they are actively hovering,
 *    dragging, focusing or swiping; pause on hover/focus/interaction; resume
 *    after inactivity; respect `prefers-reduced-motion`; no continuous
 *    marquee; no fast ticker behavior."
 *
 *   "Do not create additional provider/AI calls simply to animate the rail.
 *    Use the already fetched governed Home feed."
 *
 * ── IT MAKES NO NETWORK REQUESTS. AT ALL. ───────────────────────────────
 *
 * There is no fetch, no poll, no timer that talks to anything, and no state
 * that comes from outside this component. It scrolls an element that is
 * already in the document, containing cards the server already rendered from
 * the one `getHomeFeed()` call Home already makes. Motion and refresh are
 * completely independent: nothing here can cause a provider call, spend quota,
 * or start an AI analysis, and the rail shows new material only when the page
 * itself is next served with it.
 *
 * ── WHY THE CARDS ARE CHILDREN AND NOT PROPS ────────────────────────────
 *
 * Only this controller ships to the browser. The `<li>` cards are passed
 * through as `children`, so they stay server-rendered: no article data, no
 * dictionary and no formatting logic crosses the client boundary. The
 * CSS-only category filter also keeps working, because the `<ul>` this renders
 * is still the `.gn-deck`'s descendant in the same document order.
 *
 * ── WHAT COUNTS AS "THE READER IS BUSY" ─────────────────────────────────
 *
 * Pointer over the rail, focus inside it, a pointer held down on it, a wheel
 * or trackpad gesture, a touch, and any scroll the reader causes themselves.
 * Each of those stops the clock and restarts it only after `RESUME_MS` of
 * quiet. The advance itself is one card, once per `DWELL_MS`, smooth — not a
 * marquee and not a ticker.
 */

/** Long enough to read a card before it moves. Deliberately unhurried. */
const DWELL_MS = 7000;
/** Quiet required after the reader touches the rail before motion resumes. */
const RESUME_MS = 4500;

interface StoryRailMotionProps {
  children: ReactNode;
  className: string;
  ariaLabel: string;
}

export function StoryRailMotion({ children, className, ariaLabel }: StoryRailMotionProps): JSX.Element {
  const railRef = useRef<HTMLUListElement | null>(null);
  const busyUntil = useRef<number>(0);
  const programmatic = useRef<boolean>(false);
  const [enabled, setEnabled] = useState(false);

  /* Motion is OFF until we have confirmed the reader has not asked for less
     of it. Defaulting to off means a reduced-motion reader never sees a first
     advance before the check lands. */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (): void => setEnabled(!query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const hold = useCallback((ms: number = RESUME_MS): void => {
    busyUntil.current = Date.now() + ms;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const rail = railRef.current;
    if (rail === null) return undefined;

    const step = (): void => {
      if (Date.now() < busyUntil.current) return;
      if (document.hidden) return;
      /* A rail with nothing to scroll must not twitch. */
      const overflow = rail.scrollWidth - rail.clientWidth;
      if (overflow <= 4) return;

      const first = rail.firstElementChild as HTMLElement | null;
      if (first === null) return;
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap || '0') || 0;
      const stride = first.getBoundingClientRect().width + gap;

      /* At the end, return to the start rather than stalling — one loop of
         the same governed set, never an endless crawl. */
      const next = rail.scrollLeft + stride >= overflow - 2 ? 0 : rail.scrollLeft + stride;
      programmatic.current = true;
      rail.scrollTo({ left: next, behavior: 'smooth' });
      window.setTimeout(() => {
        programmatic.current = false;
      }, 700);
    };

    const id = window.setInterval(step, DWELL_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  /* The reader's own scrolling pauses the rotation; ours does not. */
  const onScroll = useCallback((): void => {
    if (!programmatic.current) hold();
  }, [hold]);

  return (
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
  );
}
