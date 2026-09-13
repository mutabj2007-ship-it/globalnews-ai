'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  COMPACT_TOP_PX,
  LAUNCHER_GAP,
  LAUNCHER_H,
  LAUNCHER_W,
  PROTECTED_SELECTOR,
  SPATIAL_FROM,
  chooseAnchor,
  type LauncherAnchor,
} from './launcherAnchor';

/**
 * The DOM half of R2 finding 2. The RULE is in `launcherAnchor.ts` and is
 * pure; this only supplies it with measurements.
 *
 * WHEN IT RE-EVALUATES: on mount, on resize/orientation change, and on
 * pathname change — the three moments at which "what is under the
 * launcher" can differ. `usePathname` is the only page fact this reads,
 * and it is read for TIMING, not to branch on a route: there is no route
 * list anywhere in this feature.
 *
 * WHY A FRAME IS WAITED FOR. The surfaces this measures against are
 * client-rendered (the Analysis frame, the Map's mobile shell), so a
 * measurement taken in the same tick as mount sees a page that has not
 * drawn its chrome yet and would choose from an empty document.
 */
export function useLauncherAnchor(): LauncherAnchor {
  const pathname = usePathname();
  /*
   * `bottom` is the SSR and first-paint value, which is the released
   * desktop placement — so nothing moves on a desktop render, and a
   * compact surface settles into its anchor after its own chrome exists
   * rather than flashing from a guess.
   */
  const [anchor, setAnchor] = useState<LauncherAnchor>('bottom');

  const measure = useCallback((): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const viewportWidth = window.innerWidth;
    if (viewportWidth >= SPATIAL_FROM) {
      setAnchor(chooseAnchor({ viewportWidth, topCollisions: 0, bottomCollisions: 0 }));
      return;
    }

    const left = viewportWidth - LAUNCHER_GAP - LAUNCHER_W;
    const right = viewportWidth - LAUNCHER_GAP;
    const candidates = {
      top: { top: COMPACT_TOP_PX, bottom: COMPACT_TOP_PX + LAUNCHER_H },
      bottom: {
        top: window.innerHeight - LAUNCHER_GAP - LAUNCHER_H,
        bottom: window.innerHeight - LAUNCHER_GAP,
      },
    };

    /*
     * Counted by hit-testing the candidate's four corners rather than by
     * walking every element: `elementsFromPoint` answers "what would the
     * reader's finger land on here", which is the actual question, and it
     * respects stacking, visibility and clipping for free.
     */
    const collisionsAt = (box: { top: number; bottom: number }): number => {
      const points: readonly (readonly [number, number])[] = [
        [left + 4, box.top + 4],
        [right - 4, box.top + 4],
        [left + 4, box.bottom - 4],
        [right - 4, box.bottom - 4],
      ];
      const hit = new Set<Element>();
      for (const [x, y] of points) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (el.closest('[data-ask="launcher"]') !== null) continue;
          if (el.closest('[data-ask="panel"]') !== null) continue;
          const protectedEl = el.closest(PROTECTED_SELECTOR);
          if (protectedEl !== null) hit.add(protectedEl);
        }
      }
      return hit.size;
    };

    setAnchor(
      chooseAnchor({
        viewportWidth,
        topCollisions: collisionsAt(candidates.top),
        bottomCollisions: collisionsAt(candidates.bottom),
      }),
    );
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      measure();
      /* a second pass after the client surfaces have settled */
      window.setTimeout(measure, 400);
    });
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [measure, pathname]);

  /*
   * RESERVED SPACE, AND WHY IT IS NOT THE LOCK I JUST REMOVED.
   *
   * The document lock deleted in this same delta took the reader's scroll
   * owner away. This does the opposite: while the launcher is anchored
   * over the bottom of a compact surface, the document is given enough
   * extra room at its end that its last content can be scrolled clear of
   * the launcher. Nothing is hidden permanently; the page simply has a
   * little more to scroll.
   *
   * Scoped and released exactly like the lock was — previous value
   * captured, restored on unmount and whenever the anchor moves — so no
   * other route inherits it.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (anchor !== 'bottom' || window.innerWidth >= SPATIAL_FROM) return undefined;
    const body = document.body;
    const previous = body.style.paddingBottom;
    body.style.paddingBottom = `calc(${previous === '' ? '0px' : previous} + ${LAUNCHER_H + LAUNCHER_GAP * 2}px)`;
    return () => {
      body.style.paddingBottom = previous;
    };
  }, [anchor, pathname]);

  return anchor;
}
