'use client';

import { forwardRef } from 'react';
import type { ReactNode, UIEvent } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

export const CENTRE_VIEWPORT_ID = 'gn-paf-centre';

/**
 * P-04 — THE READING REGION.
 *
 * ── R4 RESTORED: THE CENTRE IS THE ONLY SCROLLER AGAIN ───────────────
 *
 * `12-FOUR-SIDED-FRAME-GEOMETRY` §1: "persist top + left + right +
 * bottom; scroll centre." Under H-ALPHA-1 ruling 1 this element gave up
 * `overflow-y-auto` and its bounded height, and the whole surface became
 * an ordinary document.
 *
 * THAT RULING IS SUPERSEDED, and the reason it existed is worth keeping
 * in view so it cannot recur. The frozen-page complaint was never caused
 * by the geometry: the shell began BELOW the NavBar while still being
 * sized `100vh`, so it overhung its own space by exactly one header and
 * the overflow was clipped with no gesture able to reach it. That is a
 * height-arithmetic defect. The frame is now sized
 * `calc(100dvh - navbar)`, which removes the overhang and keeps the
 * four-sided composition.
 *
 * `bounded` is FALSE on the phone column, where `08-MOBILE-TABLET` still
 * governs and the document scrolls (R4 §9). One component, two models,
 * and the frame — never this file — decides which is in force.
 *
 * `onScroll` REMAINS IN THE PROP CONTRACT and is simply never fired by
 * this element any more. It is not removed, because the retained
 * `/analysis` library still constructs this component and R1 SS10 drops
 * the compression that consumed the signal rather than re-keying it.
 *
 * `scrollIntoView` is never called anywhere in this frame; positioning
 * is `scrollTop`/`scrollLeft` only (§5).
 */
export interface CentreViewportProps {
  onScroll: (scrollTop: number) => void;
  labelledBy: string;
  language?: LanguageCode;
  /**
   * R4 §2 — true wherever the four-sided frame is in force, which is
   * every width `resolveColumns().frameApplies` reports. The centre then
   * carries the frame's only block-axis scroll. False on the phone
   * column, which keeps the document model of `08`.
   */
  bounded?: boolean;
  children: ReactNode;
}

export const CentreViewport = forwardRef<HTMLDivElement, CentreViewportProps>(
  function CentreViewport({ onScroll, labelledBy, language = 'en', bounded = false, children }, ref) {
    const t = getDictionary(language).analysisFrame;

    return (
      <main
        id={CENTRE_VIEWPORT_ID}
        ref={ref}
        data-paf="centre-viewport"
        role="tabpanel"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        aria-label={t.centreRegion}
        onScroll={(event: UIEvent<HTMLDivElement>) => onScroll(event.currentTarget.scrollTop)}
        className={
          /*
            `min-h-0` is what makes `overflow-y-auto` mean anything inside
            a grid track: without it the item's automatic minimum size is
            its content, the track grows, and the scroller never engages.
            The pair is the mechanism, not decoration.
          */
          bounded
            ? 'min-h-0 overflow-y-auto overflow-x-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus'
            : 'overflow-x-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gn-focus'
        }
      >
        {children}
      </main>
    );
  },
);
