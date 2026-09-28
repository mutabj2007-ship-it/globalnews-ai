'use client';

import type { JSX } from 'react';
import { safeExternalHref } from '@globalnews-ai/shared';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';
import { askR2Strings, type AskR2Locale } from '@/lib/ask/askR2Strings';
import { formatUtc } from '@/lib/ask/askR2View';
import type { AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { ASK_EYEBROW } from './AskParts';

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
  readonly locale: AskR2Locale;
}): JSX.Element {
  const s = askR2Strings(locale);
  const payload = turn?.payload ?? null;
  const sources = payload?.analysis?.analysis?.sources ?? [];
  const empty =
    payload?.answer.state === 'CLARIFICATION_REQUIRED' ? s.sourcesAfterChoice : s.noCitable;
  return (
    <aside
      data-ask="sources-column"
      aria-label={s.sources}
      className="flex min-w-0 flex-col gap-2.5 self-start rounded-[12px] border border-[#0e2d4d] bg-[#03152a] p-4"
    >
      <div className="flex items-center gap-2">
        <h2 className={ASK_EYEBROW}>{s.sources}</h2>
        <span className="rounded-[9px] bg-[#0a2744] px-[7px] py-[3px] text-[12px] font-bold leading-none text-[#bfe3fb]">
          {sources.length}
        </span>
      </div>
      {sources.length === 0 ? (
        <p
          data-ask="sources-column-empty"
          className="rounded-[8px] border border-dashed border-[#2a3f57] p-3.5 text-[13px] leading-[1.45] text-[#8fa6c0]"
        >
          {empty}
        </p>
      ) : (
        <ol className="flex flex-col">
          {sources.map((source, index) => (
            <li
              key={source.articleId}
              data-ask="source"
              data-source-number={index + 1}
              className="flex gap-2.5 border-t border-[#0a2744] py-2.5"
            >
              <span className="flex h-[22px] min-w-[28px] shrink-0 items-center justify-center rounded-[5px] border border-[#2b4a6b] px-[5px] font-mono text-[11px] font-bold text-[#d5e4f2]">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <a
                  href={safeExternalHref(source.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-semibold leading-[1.3] text-[#e6eef6] underline decoration-transparent underline-offset-4 hover:decoration-[#5abff5]"
                >
                  {source.title}
                </a>
                <span className="font-mono text-[12px] leading-[1.3] text-[#8299b4]">
                  {[source.publisher, formatUtc(source.publishedAt, locale)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <span className="shrink-0">
                <StoryBookmark url={source.url} language={locale} size="compact" />
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
