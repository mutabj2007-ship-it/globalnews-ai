'use client';

import type { JSX, ReactNode } from 'react';
import { useVisualBrief } from '@/lib/visual/visualBriefStore';

/**
 * COMPACT VISUAL PRODUCT R1 — the content column. At ≥1200 px an open Brief sits BESIDE the feed
 * (design doc 01: "page padding-inline-end 520 px so the feed is not covered"), so the column
 * yields that space while a Brief is open; narrower, the Brief is an overlay and nothing moves.
 */
export function VisualMain({ children }: { readonly children: ReactNode }): JSX.Element {
  const panel = useVisualBrief();
  const beside = panel.kind === 'brief';
  return (
    <main
      id="main-content"
      data-visual-main=""
      data-brief-open={beside ? 'true' : 'false'}
      className={`pb-28 min-[900px]:pb-12 ${beside ? 'min-[1200px]:pe-[520px]' : ''}`}
    >
      {children}
    </main>
  );
}
