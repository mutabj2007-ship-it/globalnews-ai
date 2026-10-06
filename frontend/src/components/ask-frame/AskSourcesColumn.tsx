'use client';

import type { JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { AskSourcesList } from './AskSourcesPanel';
import type { AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { ASK_EYEBROW } from './AskParts';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * ASK R2 CLAUDE DESIGN RECONCILIATION R1 — D25 01 region 4: "Sources — right column ≥1280
 * (340 / 400 at 1920), inline below the answer otherwise."
 *
 * The SAME list the answer cites: `analysis.sources` in its own order, so every number here
 * is the number an inline citation carries. Nothing is re-ranked, filtered or given a role
 * the payload does not state. Below 1280 this column is hidden by CSS and the answer's own
 * inline list shows instead; at ≥1280 the latest turn's inline list is the one hidden.
 */
export function AskSourcesColumn({
  turn,
  locale,
}: {
  readonly turn: AskR2Turn | undefined;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const s = askShellStrings(locale).askR2Strings;
  const payload = turn?.payload ?? null;
  const sources = payload?.analysis?.analysis?.sources ?? [];
  const empty =
    payload?.answer.state === 'CLARIFICATION_REQUIRED' ? s.sourcesAfterChoice : s.noCitable;
  return (
    <aside
      data-ask="sources-column"
      aria-label={s.sources}
      /* ASK READING EXPERIENCE R1 — the desktop NON-MODAL panel: it scrolls inside itself, so a
         citation can bring item n into view without moving the reading column. */
      tabIndex={-1}
      className="flex max-h-[calc(100dvh-8rem)] min-w-0 flex-col gap-2.5 self-start overflow-y-auto overscroll-contain rounded-[12px] border border-[var(--ask-read-line-soft,#0e2d4d)] bg-[var(--ask-read-sunk,#03152a)] p-4"
    >
      <div className="flex items-center gap-2">
        <h2 className={ASK_EYEBROW}>{s.sources}</h2>
        <span className="rounded-[9px] bg-[var(--ask-read-sunk,#0a2744)] px-[7px] py-[3px] text-[12px] font-bold leading-none text-[var(--ask-read-control-ink,#bfe3fb)]">
          {sources.length}
        </span>
      </div>
      {sources.length === 0 ? (
        <p
          data-ask="sources-column-empty"
          className="rounded-[8px] border border-dashed border-[var(--ask-read-line,#2a3f57)] p-3.5 text-[13px] leading-[1.45] text-[var(--ask-read-ink2,#8fa6c0)]"
        >
          {empty}
        </p>
      ) : (
        /* ASK READING EXPERIENCE R1 — the ONE list rendering, shared with the Sources sheet. */
        <AskSourcesList sources={sources} locale={locale} />
      )}
    </aside>
  );
}
