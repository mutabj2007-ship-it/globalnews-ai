'use client';

import { useCallback, useRef, useState } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { SituationRow } from '@/components/today/SituationRow';
import { WorkspaceCta } from '@/components/today/WorkspaceCta';
import { ANALYSE_CHROME } from '@/components/today/todayWorkspaceGeometry';

/**
 * R7 `02` — ANALYSE. THE PRINCIPAL INTERNAL SCROLL SURFACE.
 *
 * ── ONE SCROLL REGION, AND THE PAGE KEEPS ITS OWN ────────────────────────
 *
 * The CTO's mount ruling is the constraint that shapes this file: Today is a
 * bounded section INSIDE the normally scrolling homepage, so the surrounding
 * document must not participate in ANALYSE's scrolling and ANALYSE must not
 * lengthen the page. `overscroll-contain` is what enforces the first half —
 * reaching the end of this list does not hand the wheel to the homepage
 * behind it — and the fixed frame height enforces the second.
 *
 * ── THE CTA RELOCATION IS A ONE-CONTROL CONTRACT, LIKE F17 ───────────────
 *
 * The Workspace CTA has exactly two homes and is in exactly ONE of them at any
 * moment:
 *
 *   NOT AT THE END   header chrome, pinned, always visible
 *   AT THE END       inline, after the last record, where the reader has
 *                    just run out of records and the offer is the answer
 *
 * That is deliberately the same shape as F17's world-map rule, and for the
 * same reason: two visible copies of one action is a worse defect than either
 * position alone, and zero visible copies makes the action undiscoverable.
 * `atEnd` is read from the scroll container's own metrics on its own scroll
 * event — no window listener, no observer, nothing that survives unmount.
 *
 * ── SCROLL IS REPORTED UPWARD, NOT MEASURED UPWARD ───────────────────────
 *
 * The header collapse is geometry (`08 §4`), so the workspace needs a number,
 * not an element. This panel hands up `scrollTop` and the workspace applies
 * the threshold with hysteresis. No parent ever measures a child.
 */
interface AnalysePanelProps {
  records: NewsArticle[];
  height: number;
  expandedId: string | null;
  onToggleRecord: (id: string) => void;
  sourcesExpanded: boolean;
  onOpenSources: (id: string) => void;
  filterCountry: string | null;
  onClearFilter: () => void;
  onScrollTop: (scrollTop: number) => void;
  onOpenWorkspace: () => void;
  language: LanguageCode;
}

export function AnalysePanel({
  records,
  height,
  expandedId,
  onToggleRecord,
  sourcesExpanded,
  onOpenSources,
  filterCountry,
  onClearFilter,
  onScrollTop,
  onOpenWorkspace,
  language,
}: AnalysePanelProps): JSX.Element {
  const t = getDictionary(language).todayWorkspace.analyse;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  /*
    Starts TRUE so a list too short to scroll — which is already "at the end" —
    shows the inline CTA rather than none. A list that does scroll fires its
    first scroll event before the reader can reach the end, and corrects it.
  */
  const [atEnd, setAtEnd] = useState(true);
  /*
    R4 CORRECTION 2 — A ROW CLIPPED MID-GLYPH READS AS BROKEN, NOT AS SCROLLED.

    The header is opaque and in flow, so it genuinely cannot cover a record —
    the body's top edge is the boundary and anything past it is clipped. But a
    hard clip through the middle of a line looks like a rendering fault sitting
    right under the primary action. A top fade, applied ONLY once the list has
    actually moved, makes the boundary read as "there is more above".
  */
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((): void => {
    const el = bodyRef.current;
    if (el === null) return;
    onScrollTop(el.scrollTop);
    setScrolled(el.scrollTop > 4);
    setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight <= 8);
  }, [onScrollTop]);

  const empty = records.length === 0;

  return (
    <section
      aria-label={t.regionLabel}
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-r border-[#16202e] bg-[#05080d]"
      style={{ height: `${height}px` }}
    >
      {/*
        THE HEADER IS OPAQUE, AND THAT IS THE "DOES NOT COVER THE FIRST RECORD"
        GUARANTEE MADE VISIBLE.

        Structurally the header is a static sibling ABOVE the scroll container,
        so it cannot cover anything — a record scrolled past the boundary is
        clipped, not obscured. But with a transparent header the clipped row
        stayed VISIBLE right up to the CTA's edge, which reads as overlap
        whatever the geometry says. An opaque ground and a hairline make the
        boundary the reader's eye can see the one the layout already enforced.
      */}
      <header
        className="relative z-10 flex shrink-0 items-center justify-between gap-[10px] border-b border-[#101923] bg-[#05080d] px-[16px]"
        style={{ height: `${ANALYSE_CHROME}px` }}
      >
        <span className="flex min-w-0 items-baseline gap-[9px]">
          <span className="font-gn-mono text-[9px] font-bold uppercase tracking-[.16em] text-[#94a3b8]">
            {t.regionLabel}
          </span>
          {filterCountry !== null && (
            <button
              type="button"
              onClick={onClearFilter}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-[4px] border border-[rgba(34,211,238,.3)] px-[6px] font-gn-mono text-[7.5px] uppercase tracking-[.10em] text-[#67e8f9] outline-none transition-colors hover:border-[rgba(34,211,238,.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
            >
              {filterCountry} · {t.clearFilter}
            </button>
          )}
        </span>
        {/*
          THE ONLY WORKSPACE COMMAND ON THIS SURFACE.

          It used to be one of two: this header button appeared while `!atEnd`
          and handed over to an inline card at the foot of the list, so exactly
          one was on screen at a time. The lower card is now removed, and the
          `!atEnd` condition goes with it — kept, it would hide the last
          remaining workspace action the moment a reader reached the end of the
          list, which is precisely when they are most likely to want it.

          `!empty` is kept: with no records there is nothing to analyse.
        */}
        {!empty && (
          <WorkspaceCta variant="chrome" onOpen={onOpenWorkspace} language={language} />
        )}
      </header>

      <div
        ref={bodyRef}
        onScroll={handleScroll}
        /* B6 — the 120px floor is declared on the element that SCROLLS. A
           floor on a clipping parent does not satisfy it, and ANALYSE_FLOOR is
           this 120 plus this region's own ANALYSE_CHROME. */
        style={{
          minHeight: '120px',
          ...(scrolled
            ? {
                maskImage:
                  'linear-gradient(180deg, transparent 0, #000 18px, #000 100%)',
                WebkitMaskImage:
                  'linear-gradient(180deg, transparent 0, #000 18px, #000 100%)',
              }
            : {}),
        }}
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-[16px] pb-[16px] [scrollbar-gutter:stable]"
      >
        {empty ? (
          <p className="max-w-[62ch] font-gn-display text-[12.5px] leading-[1.5] text-[#8ba3bd]">
            {filterCountry !== null ? t.filteredEmpty : t.empty}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-[7px]">
              {records.map((record) => (
                <li key={record.id}>
                  <SituationRow
                    record={record}
                    expanded={expandedId === record.id}
                    onToggle={() => onToggleRecord(record.id)}
                    onOpenSources={() => onOpenSources(record.id)}
                    sourcesExpanded={sourcesExpanded && expandedId === record.id}
                    language={language}
                  />
                </li>
              ))}
            </ul>
            {/*
              THE LOWER WORKSPACE CTA IS GONE.

              It rendered a second OPEN ANALYSIS WORKSPACE button under the last
              record, above the line "Ask a question and run a full analysis."
              The header already carries that action, every row carries its own
              ANALYSE, and the accepted Today composition has one workspace
              command, not two. Removed as the obsolete lower control.

              The `inline` variant is left in WorkspaceCta, unimported, rather
              than deleted — the same treatment LatestNowRail has.
            */}
          </>
        )}
      </div>
    </section>
  );
}
