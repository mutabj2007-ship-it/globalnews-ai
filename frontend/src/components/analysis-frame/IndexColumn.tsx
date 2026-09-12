'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { DimensionModel, PrimaryDimensionKey } from '../search/analysisDimensions';
import { AnalysisIndex } from '../search/AnalysisIndex';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * P-03 — column 1, row 2 (F-2).
 *
 * NEVER COMPRESSES. `compressed` is not a prop on this component, and
 * `frameGeometry.resolveColumns()` does not accept it either — the
 * index's track width cannot be a function of compression because
 * nothing gives it one. Shrinking navigation to buy reading space trades
 * away the one thing that lets the user leave the current view.
 *
 * The tablist semantics — `role="tablist"`, vertical orientation, roving
 * tabindex, counts in the accessible name — are the EXISTING
 * `AnalysisIndex`, reused unchanged. The frame supplies the track; it
 * does not reimplement the navigation.
 */
export interface IndexColumnProps {
  dimensions: readonly DimensionModel[];
  activeDimension: PrimaryDimensionKey;
  onSelect: (key: PrimaryDimensionKey) => void;
  panelId: string;
  focusedIndex: number;
  onFocusedIndexChange: (index: number) => void;
  /** 'desktop' column at M and wider, 'mobile' chip row at S. */
  variant?: 'desktop' | 'mobile';
  language?: LanguageCode;
  onOpenRecord?: () => void;
  /**
   * A1 ADDENDUM B — the record's size, so the control's own label and its
   * accessible name can BOTH state the action and the count (A1-C2-25c).
   * Absent or 0 renders no control at all, never a disabled one.
   */
  recordItemCount?: number;
}

export function IndexColumn({
  dimensions,
  activeDimension,
  onSelect,
  panelId,
  focusedIndex,
  onFocusedIndexChange,
  variant = 'desktop',
  language = 'en',
  onOpenRecord,
  recordItemCount = 0,
}: IndexColumnProps): JSX.Element {
  const t = getDictionary(language).analysisFrame;

  return (
    <nav
      data-paf="index-column"
      aria-label={t.indexRegion}
      className="flex min-h-0 flex-col overflow-hidden border-r border-[#101923]"
    >
      {/* PAF-R1.2 (P2) — `overflow-x-hidden` is belt-and-braces only: the
          `fluid` row below cannot overflow its track, so the horizontal
          scrollbar is removed structurally rather than concealed. */}
      {/*
        `[&>div]:!flex` on the MOBILE variant only.

        `AnalysisIndex` predates the frame and selects its variant in CSS:
        the chip row carries `flex md:hidden`. The frame selects in JS,
        and `resolveColumns()` puts the chip row on screen from 768 to
        1071px — a band that lies entirely inside Tailwind's `md`
        (>=768px). The chip row was therefore display:none'd by its own
        class across the whole range it exists to serve, leaving those
        widths with no section navigation at all.

        Overridden here rather than in `AnalysisIndex`, which is shared
        with the pre-R4 workspace and carries its own pinned tests. The
        selector targets that component's root element, which is this
        div's direct child.
      */}
      {/*
        ── H-C2 — MOBILE INDEX DISCOVERABILITY ──────────────────────────

        MEASURED at 390: the chip row's content is 1197px wide inside a
        389px track. Two and a half of eight sections are on screen, the
        scrollbar is suppressed by design, and nothing anywhere states that
        the other five exist. A reader who never swipes that strip never
        learns the analysis HAS eight sections.

        The fix is a statement, not an animation: the row is named and its
        EXTENT is counted, in the same 12px mono the rest of the surface
        uses. It is passive — no control, no navigation — so it adds a fact
        and not a second way in. The chips themselves also go to Lock 9's
        44px phone target, which they were 12px short of.
      */}
      {variant === 'mobile' ? (
        <p
          data-paf="index-sections-count"
          className="shrink-0 px-4 pt-[6px] font-gn-mono text-[12px] uppercase tracking-[0.12em] text-[#54687f] md:text-[11px]"
        >
          {getDictionary(language).analysisWorkspace.indexLabel} &middot; {dimensions.length}
        </p>
      ) : null}

      <div
        className={[
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden',
          variant === 'mobile' ? '[&>div]:!flex' : '',
        ].join(' ').trim()}
      >
        <AnalysisIndex
          dimensions={dimensions}
          activeDimension={activeDimension}
          onSelect={onSelect}
          variant={variant}
          panelId={panelId}
          language={language}
          focusedIndex={focusedIndex}
          onFocusedIndexChange={onFocusedIndexChange}
          fluid
          typeFloor
          touchTargets
        />
      </div>

      {/* 06 §1 — the complete record is demoted to a destination beside
          navigation, never a section of the reading path. */}
      {/*
        ── A1 ADDENDUM B — DISCOVERABLE WITHOUT PROMOTION ──────────────

        LOCK 5 was right on weight and wrong on discoverability: a slate
        outline below the sources section is easy to miss, which is the
        same defect the tester reported against Back. A1 corrects the
        treatment without promoting the control:

          BODY    outline. NOT a solid amber fill. Solid amber remains
                  the exclusive grammar of the primary action, which is a
                  FILL with dark text; this is an EDGE.
          BORDER  1px amber rgba(245,158,11,.45)      A1-C2-21b (>=0.35)
          GROUND  rgba(245,158,11,.04)                A1-C2-21  (<=0.06)
          LABEL   amber-muted #d9a441, 12px mono uppercase, with count
          HEIGHT  44px phone, 36px desktop
          NAME    states BOTH the action and the count   A1-C2-25c

        EMPTY STATE: absent entirely, never present-and-disabled — so a
        record with nothing in it offers nothing, rather than a control
        that opens emptiness.
      */}
      {onOpenRecord !== undefined && (recordItemCount ?? 0) > 0 ? (
        <div className="shrink-0 border-t border-[#101923] p-3">
          <button
            type="button"
            data-paf="complete-record-entry"
            onClick={onOpenRecord}
            aria-label={`${t.completeRecordAction} · ${t.completeRecordCount.replace('{n}', String(recordItemCount))}`}
            style={{
              borderColor: 'rgba(245,158,11,.45)',
              backgroundColor: 'rgba(245,158,11,.04)',
            }}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-[6px] border px-3 py-2 text-left font-gn-mono text-[12px] uppercase tracking-[0.12em] text-[#d9a441] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus md:min-h-[36px] md:text-[11px]"
          >
            {/*
              ONE LINE. A1 gives the label as "amber-muted, 12px mono
              uppercase, with its count" and the height as 44px phone /
              36px desktop. A second forensic sub-line inside the control
              pushed it to 105px measured, which is a panel's height, not
              a control's — and A1 separates those two things deliberately.
              The forensic framing lives in the record itself.
            */}
            <span className="min-w-0 flex-1 truncate">{t.completeRecordAction}</span>
            <span
              data-paf="complete-record-count"
              className="shrink-0 tabular-nums text-[12px] tracking-[0.1em] text-[#d9a441] md:text-[11px]"
            >
              {t.completeRecordCount.replace('{n}', String(recordItemCount))}
            </span>
            {/* CONTROL, not panel — the chevron is part of that distinction. */}
            <span aria-hidden="true" className="shrink-0 text-[#d9a441]">&rsaquo;</span>
          </button>
        </div>
      ) : null}
    </nav>
  );
}
