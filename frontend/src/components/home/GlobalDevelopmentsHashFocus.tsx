'use client';

import { useEffect } from 'react';

/**
 * DC-02 — MOVE FOCUS TO THE ANCHOR TARGET ON HASH ACTIVATION.
 *
 * World Intelligence is the one Intelligence Engine module whose destination is
 * an in-page anchor, `/#global-developments-heading`. Before this, activating it
 * moved the viewport and nothing else: focus stayed on the card, nothing was
 * announced, and the next Tab resumed from the engine rather than from the
 * section the user had just opened. Global Developments sits ABOVE the engine,
 * so a user already at that section perceived no change whatsoever.
 *
 * Claude Design's correction is the smallest one that fixes it: make the
 * existing heading programmatically focusable (`tabIndex={-1}`, added in
 * GlobalDevelopments.tsx) and focus it when the fragment resolves. That single
 * move announces the heading, hands the tab sequence to the right place, and is
 * perceptible even when the viewport does not move.
 *
 * DELIBERATELY NOT DONE, per the design constraints: no `/world` route, no new
 * page, no change to the destination, no scroll animation of our own (the page's
 * existing `scroll-behavior` governs, exactly as it already does for
 * MobileBottomNav's `#intelligence-modules` link), and no new copy. The heading's
 * text, id and classes are untouched — a spec reads that id at test time, and it
 * must keep passing.
 *
 * WHY THERE ARE THREE ENTRY POINTS. `hashchange` alone is not enough:
 *
 *  1. Landing with the fragment already in the URL — a pasted link, or the
 *     Engine activated from a surface that is not the homepage — fires no
 *     `hashchange` at all, because the hash was never changed.
 *  2. Ordinary same-document fragment navigation does fire it.
 *  3. Re-activating the link while that fragment is ALREADY current fires
 *     nothing, because the hash does not change. Without the third case, the
 *     design's own acceptance criterion — "activating it twice in a row still
 *     produces a perceptible change the second time" — cannot be met.
 *
 * The click listener is scoped as narrowly as delegation allows: it reads only
 * `href`, ignores every anchor that does not resolve to this heading, and never
 * calls `preventDefault`, so the browser's own fragment handling is untouched
 * and the link keeps working with JavaScript disabled. The zero-delay timeout
 * simply lets that default handling finish before focus is placed.
 *
 * This component renders nothing. It is mounted by GlobalDevelopments, which is
 * already a Client Component, so it introduces no new client boundary onto the
 * page and `app/page.tsx` — a protected file — is not touched.
 */
const TARGET_ID = 'global-developments-heading';

export function GlobalDevelopmentsHashFocus(): null {
  useEffect(() => {
    const focusTarget = (): void => {
      document.getElementById(TARGET_ID)?.focus();
    };

    const focusIfTargeted = (): void => {
      if (window.location.hash === `#${TARGET_ID}`) focusTarget();
    };

    const handleClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      const href = anchor?.getAttribute('href');
      if (!href || !href.endsWith(`#${TARGET_ID}`)) return;
      window.setTimeout(focusTarget, 0);
    };

    focusIfTargeted();
    window.addEventListener('hashchange', focusIfTargeted);
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('hashchange', focusIfTargeted);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
