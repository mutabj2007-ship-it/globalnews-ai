'use client';

import { useEffect } from 'react';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §9 — ONE shared on-screen-keyboard signal for the whole product.
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens; it overlays it. A
 * `position: fixed; inset: 0` panel therefore keeps its composer BEHIND the keyboard. This writes
 * the overlap onto <html> as `--gna-kb` (px; 0 when closed), from `window.visualViewport`, so any
 * fixed panel can lift its bottom edge with `bottom: var(--gna-kb, 0px)`. Below 80 px is treated as
 * browser-bar movement, not a keyboard. No-op where visualViewport is absent (older browsers,
 * desktop) — the variable simply stays 0.
 */
export function keyboardOverlap(innerHeight: number, vvHeight: number, vvOffsetTop: number): number {
  const overlap = Math.round(innerHeight - vvHeight - vvOffsetTop);
  return overlap >= 80 ? overlap : 0;
}

export function ViewportKeyboardSync(): null {
  useEffect(() => {
    const vv = window.visualViewport;
    if (vv === null || vv === undefined) return;
    const root = document.documentElement;
    let frame = 0;
    const update = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--gna-kb', `${keyboardOverlap(window.innerHeight, vv.height, vv.offsetTop)}px`);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--gna-kb');
    };
  }, []);
  return null;
}
