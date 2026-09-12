'use client';

import type { ReactNode } from 'react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import { DOCK_H_COMPACT } from '@/components/today/todayWorkspaceGeometry';

/**
 * R7 `05` — THE SOURCES DOCK. PERMANENT CHROME, NEVER A MODAL.
 *
 * ── WHY IT IS CALLED RETRIEVED ARTICLES ──────────────────────────────────
 *
 * `05` asks that sources be visibly discoverable rather than hidden behind a
 * hover. It is discoverable here because the dock is always present: compact it
 * still shows its label and its control, and opening it costs one click and no
 * navigation.
 *
 * What it may NOT do is imply corroboration. A Today record is ONE retrieved
 * article — `sourcesCount` is hardcoded to 1 by the provider — so a dock
 * labelled SOURCES showing 1 would read as "one source confirms this", a claim
 * nothing in the payload supports. It is labelled RETRIEVED ARTICLES, it states
 * the caveat in words, and the count is never styled as an evidence figure.
 *
 * ── IT OWNS ITS TRACK, AND THE GEOMETRY DECIDES HOW BIG THAT IS ──────────
 *
 * `dockHeight` is RESOLVED by `resolveDock` and handed in. Opening the dock
 * does not overlay the workspace and does not lengthen the page: its height is
 * an input to the same arithmetic that gives ANALYSE and the right column
 * theirs, so the frame stays exactly its constant and ANALYSE never falls under
 * `ANALYSE_FLOOR`.
 *
 * ── RELOCATION (`05 §5.1`) ───────────────────────────────────────────────
 *
 * Below the S breakpoint, and at any frame where the cap would leave a dock too
 * short to show one source card, the right column MOVES IN HERE as tabs. The
 * dock then owns the tab strip and the single OPEN WORLD MAP control, and the
 * geography panel is handed a `permanent-chrome` layout so it renders none of
 * its own — exactly one instance exists in every configuration.
 */
export type DockTab = 'sources' | 'watch' | 'geography';

export interface DockRelocation {
  tab: DockTab;
  onSelectTab: (tab: DockTab) => void;
  watchCount: number;
  watchPanel: ReactNode;
  geographyPanel: ReactNode;
}

interface SourcesDockProps {
  /** The record whose article is on show, or null when nothing is open. */
  record: NewsArticle | null;
  expanded: boolean;
  onToggle: () => void;
  /** Resolved by `resolveDock`. Never computed here. */
  dockHeight: number;
  relocation: DockRelocation | null;
  /**
   * F17/B20 — THE PERMANENT-CHROME OPEN WORLD MAP, AND ITS ONLY HOME.
   *
   * `06 §A5` makes the control's position a function of the TIER, meaning one
   * position at a time. Two of the three positions belong to the geography
   * region itself; the third, `permanent-chrome`, does not — the region
   * deliberately renders nothing then, because at tier E the column SCROLLS
   * and a control inside it could sit below the fold, which F17 forbids.
   *
   * The dock is the workspace's only permanent chrome, so this is where that
   * third position lives. Passed non-null exactly when the geography region is
   * rendering none of its own — while relocated, or at tier E.
   */
  worldMap: (() => void) | null;
  language: LanguageCode;
}

const BODY_ID = 'today-dock-body';

export function SourcesDock({
  record,
  expanded,
  onToggle,
  dockHeight,
  relocation,
  worldMap,
  language,
}: SourcesDockProps): JSX.Element {
  const t = getDictionary(language).todayWorkspace.dock;
  const geo = getDictionary(language).todayWorkspace.geography;
  const tabs = getDictionary(language).todayWorkspace.tabs;
  const open = expanded;
  /*
    A DEFECT THIS CHILD FIXES, FOUND WHILE VERIFYING 768.

    When the column relocates, the dock chrome swaps its expand control for the
    tab strip — and `open` is gated on `expanded`, so at 768 there was NO WAY to
    open the dock at all. The tabs changed `dockTab` and nothing appeared:
    WATCH and GEOGRAPHY were unreachable below the S breakpoint. Selecting a tab
    now opens the dock (the caller does that), and the collapse control stays
    beside the tab strip so the reader can close it again — which is H1's "one
    interaction away", restored in both directions.
  */
  /* B6 — the SCROLLING element carries the 120px floor, not a clipping parent. */
  const bodyHeight = Math.max(0, dockHeight - DOCK_H_COMPACT);

  return (
    <section
      aria-label={t.label}
      className="flex shrink-0 flex-col overflow-hidden border-t border-[#16202e] bg-[#060a10]"
      style={{ height: `${dockHeight}px`, flex: '0 0 auto' }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-[10px] px-[16px]"
        style={{ height: `${DOCK_H_COMPACT}px` }}
      >
        {relocation !== null ? (
          /* `05 §5.1` — the relocated tab strip, with its counts. */
          <div role="tablist" aria-label={tabs.label} className="flex min-w-0 items-center gap-[4px]">
            {(
              [
                ['sources', t.label, record === null ? 0 : 1],
                ['watch', tabs.watch, relocation.watchCount],
                ['geography', tabs.geography, null],
              ] as Array<[DockTab, string, number | null]>
            ).map(([name, label, count]) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={relocation.tab === name}
                aria-controls={BODY_ID}
                onClick={() => relocation.onSelectTab(name)}
                className={`inline-flex min-h-[44px] items-center gap-[5px] rounded-[7px] px-[9px] font-gn-mono text-[8px] font-bold uppercase tracking-[.10em] outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff] ${
                  relocation.tab === name
                    ? 'bg-[rgba(34,211,238,.08)] text-[#67e8f9]'
                    : 'text-[#5f7288] hover:text-[#a9bccf]'
                }`}
              >
                {label}
                {count !== null && <span className="tabular-nums opacity-70">{count}</span>}
              </button>
            ))}
          </div>
        ) : (
          <span className="flex min-w-0 items-baseline gap-[9px]">
            <span className="font-gn-mono text-[9px] font-bold uppercase tracking-[.16em] text-[#94a3b8]">
              {t.label}
            </span>
            {/* The count is beside the words that say what it counts. A bare
                "1" is the thing that reads as corroboration. */}
            <span className="truncate font-gn-display text-[10.5px] leading-[1.4] text-[#7d92aa]">
              {record !== null ? t.retrievalNote : t.noneSelected}
            </span>
          </span>
        )}

        <span className="flex shrink-0 items-center gap-[8px]">
          {worldMap !== null && (
            <button
              type="button"
              onClick={worldMap}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-[7px] border border-[rgba(125,192,255,.3)] px-[10px] font-gn-mono text-[8px] font-bold uppercase tracking-[.10em] text-[#7dc0ff] outline-none transition-colors hover:border-[rgba(125,192,255,.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
            >
              {geo.worldMapCompact}
            </button>
          )}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={BODY_ID}
            onClick={onToggle}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-[6px] rounded-[7px] px-[10px] font-gn-mono text-[8.5px] font-bold uppercase tracking-[.10em] text-[#a9bccf] outline-none transition-colors hover:text-[#dbe6f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
          >
            {/* While relocated the label would crowd the tab strip, so the
                control keeps only its glyph and its accessible name. */}
            <span className={relocation !== null ? 'sr-only' : undefined}>
              {expanded ? t.collapse : t.expand}
            </span>
            <span aria-hidden="true">{expanded ? '▾' : '▴'}</span>
          </button>
        </span>
      </div>

      {open && (
        <div
          id={BODY_ID}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{ height: `${bodyHeight}px`, minHeight: '120px' }}
        >
          {relocation !== null && relocation.tab === 'watch' ? (
            relocation.watchPanel
          ) : relocation !== null && relocation.tab === 'geography' ? (
            relocation.geographyPanel
          ) : (
            <div className="px-[16px] pb-[14px]">
              {record === null ? (
                <p className="font-gn-display text-[12px] leading-[1.5] text-[#8ba3bd]">
                  {t.noneSelected}
                </p>
              ) : (
                <article className="rounded-[10px] border border-[#16202e] bg-[#080d14] p-[13px]">
                  <div className="flex flex-wrap items-center gap-[7px]">
                    <span className="font-gn-mono text-[7.5px] uppercase tracking-[.10em] text-[#67e8f9]">
                      {record.sourceName}
                    </span>
                    {record.firstSeenAt !== undefined && (
                      <span className="font-gn-mono text-[7.5px] uppercase tracking-[.10em] text-[#4a5c73]">
                        {formatUtcClock(record.firstSeenAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-[6px] font-gn-display text-[12.5px] leading-[1.42] text-[#dbe6f2]">
                    {record.title}
                  </p>
                  <p className="mt-[5px] font-gn-display text-[10.5px] leading-[1.4] text-[#7d92aa]">
                    {t.retrievalNote}
                  </p>
                  {/* The ONE outbound control: the reader must be able to reach
                      the article itself, not a summary of it. */}
                  <a
                    href={record.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-[9px] inline-flex min-h-[44px] items-center font-gn-mono text-[8.5px] font-bold uppercase tracking-[.10em] text-[#7dc0ff] outline-none transition-colors hover:text-[#a9d5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dc0ff]"
                  >
                    {t.openOriginal}
                  </a>
                </article>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
