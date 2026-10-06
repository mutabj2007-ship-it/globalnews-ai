'use client';

import type { JSX } from 'react';
import type { AnalysisSourceRef } from '@globalnews-ai/shared';
import { useAskSourcesPanel } from '@/components/ask-frame/AskSourcesPanel';

/**
 * ASK READING EXPERIENCE R1 — ONE INLINE CITATION (H-FREEZE §7).
 *
 * Still the governed link it always was: `href` is `safeExternalHref(cited.url)`, computed by
 * the answer renderer, and the number is the answer-local label derived from the same payload
 * (identity is the backend article id). What changes is what a plain activation does where the
 * surface offers a Sources panel: it opens Sources at item n — the desktop column, or the
 * sheet — instead of leaving the conversation. A modified click (new tab / window) and every
 * surface without a panel keep the link behaviour, so nothing becomes unreachable.
 *
 * The visual chip is 22px; the touch target is 44px through a pseudo-element
 * (`::before`, inset −11px −3px), so the text line keeps its rhythm.
 */
export function AskCitation({
  n,
  href,
  label,
  sources,
}: {
  readonly n: number;
  readonly href: string | undefined;
  readonly label: string;
  readonly sources: readonly AnalysisSourceRef[];
}): JSX.Element {
  const openSources = useAskSourcesPanel();
  return (
    <a
      data-ask="citation"
      data-citation={n}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onClick={(event) => {
        if (openSources === null) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        openSources({ sources, at: n, opener: event.currentTarget });
      }}
      className="relative ms-0.5 inline-flex h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-[6px] px-1 align-baseline text-[0.75rem] font-semibold tabular-nums text-signal underline decoration-signal/40 underline-offset-2 before:absolute before:-inset-x-[3px] before:-inset-y-[11px] before:content-[''] hover:decoration-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
    >
      [{n}]
    </a>
  );
}
