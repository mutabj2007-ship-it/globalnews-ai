'use client';

import { useEffect } from 'react';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §9 / ASK RELIABILITY R1 (Q) — ONE shared on-screen-keyboard
 * signal for the whole product.
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens; it OVERLAYS it and PANS
 * the visual viewport (offsetTop > 0) to reveal the focused field. A `position: fixed; inset: 0`
 * panel therefore keeps its composer behind the keyboard, and a panel lifted only at the bottom
 * loses its header / close control above the visible area.
 *
 * While a keyboard is open this writes, on <html>:
 *   data-gna-kb      present only while the keyboard is open (browser-bar movement < 80 px is not)
 *   --gna-kb         the obscured height below the visible box (px)
 *   --gna-vvt        the visible box's top (visual viewport offsetTop, px)
 *   --gna-vvh        the visible box's height (px)
 * and globals.css makes every `[data-kb-follow]` panel occupy exactly that visible box. Nothing is
 * written while the keyboard is closed, so desktop and closed-keyboard layouts are untouched.
 * No-op where visualViewport is absent.
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
    const clear = (): void => {
      root.removeAttribute('data-gna-kb');
      root.style.removeProperty('--gna-kb');
      root.style.removeProperty('--gna-vvt');
      root.style.removeProperty('--gna-vvh');
    };
    const update = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const overlap = keyboardOverlap(window.innerHeight, vv.height, vv.offsetTop);
        if (overlap === 0) {
          clear();
          return;
        }
        root.setAttribute('data-gna-kb', '');
        root.style.setProperty('--gna-kb', `${overlap}px`);
        root.style.setProperty('--gna-vvt', `${Math.round(vv.offsetTop)}px`);
        root.style.setProperty('--gna-vvh', `${Math.round(vv.height)}px`);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      clear();
    };
  }, []);
  return null;
}
