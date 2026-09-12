'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type {
  AccentToken,
  PrimaryDimensionKey,
  SubViewKey,
  SubViewModel,
} from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H2D — E-26 SubViewStrip, the level-2 segmented control.
 *
 * Switches between a dimension's primary claim list and its refinement
 * views. It is deliberately a DIFFERENT shape from the level-1
 * navigator: level 1 is pills, level 2 is underlines. R1 is explicit
 * that this is the mechanism by which the two navigation levels are
 * never confused, so the distinction is structural here rather than
 * decorative.
 *
 * IT DECLARES NOTHING. Every segment, its accent, its divergence label
 * and its count come from `model.dimensions[].subViews`, which
 * analysisDimensions.ts already computed and already filtered to the
 * segments that genuinely have data. This component adds no allocation
 * logic and reads no production field — if it did, the strip and the
 * panel beneath it could disagree about what exists.
 *
 * A SEGMENT IS NEVER INVENTED TO FILL THE ROW. The adapter drops an
 * empty segment, and when only the primary one survives it sets
 * stripVisible false and the strip does not render at all. Three
 * segments is the design maximum and also the natural maximum of the
 * allocation.
 */

const ACCENT_UNDERLINE: Readonly<Record<AccentToken, string>> = {
  'gn-verified': 'border-b-gn-verified',
  'gn-ai': 'border-b-gn-ai',
  'gn-geo': 'border-b-gn-geo',
  'gn-significance': 'border-b-gn-significance',
  'gn-uncertain': 'border-b-gn-uncertain',
  'gn-provenance': 'border-b-gn-provenance',
};

export function subViewTabId(subView: SubViewKey): string {
  return `gn-subview-tab-${subView}`;
}

export const ANALYSIS_SUBVIEW_PANEL_ID = 'gn-analysis-subview-panel';

type SubViewStrings = ReturnType<typeof getDictionary>['analysisWorkspace']['subViews'];

export function subViewLabel(key: SubViewKey, t: SubViewStrings): string {
  switch (key) {
    case 'reported-facts':
      return t.reportedFacts;
    case 'agreements':
      return t.agreements;
    case 'differences':
      return t.differences;
    case 'reported-effects':
      return t.reportedEffects;
    case 'spillover':
      return t.spillover;
    case 'timeline':
      return t.timeline;
    case 'affected-entities':
      return t.affectedEntities;
    case 'relationships':
      return t.relationships;
  }
}

/**
 * Left/Right move the selection, Home/End jump to the ends. Pure, so
 * the model is unit-tested without a DOM — the same approach H2B took
 * for the level-1 navigator.
 */
export function resolveSubViewArrowTarget(
  current: number,
  key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End',
  total: number,
): number {
  if (total <= 0) return 0;
  switch (key) {
    case 'ArrowLeft':
      return (current - 1 + total) % total;
    case 'ArrowRight':
      return (current + 1) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
  }
}

export interface AnalysisSubViewStripProps {
  dimension: PrimaryDimensionKey;
  dimensionName: string;
  subViews: readonly SubViewModel[];
  activeSubView: SubViewKey;
  onSelect: (key: SubViewKey) => void;
  language?: LanguageCode;
}

export function AnalysisSubViewStrip({
  dimension,
  dimensionName,
  subViews,
  activeSubView,
  onSelect,
  language = 'en',
}: AnalysisSubViewStripProps): JSX.Element | null {
  const dict = getDictionary(language).analysisWorkspace;
  const t = dict.subViews;

  /* Guarded here as well as by the caller: a one-segment strip is a
     control with nothing to control. */
  if (subViews.length < 2) return null;

  const activeIndex = Math.max(
    0,
    subViews.findIndex((view) => view.key === activeSubView),
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const key = event.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    event.preventDefault();
    const target = subViews[resolveSubViewArrowTarget(activeIndex, key, subViews.length)];
    if (target !== undefined) onSelect(target.key);
  }

  return (
    <div
      role="tablist"
      aria-label={`${dimensionName} ${t.viewsSuffix}`}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="mt-4 flex items-stretch gap-[18px] overflow-x-auto border-b border-gn-line-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollSnapType: 'x proximity' }}
    >
      {subViews.map((view, index) => {
        const active = view.key === activeSubView;
        const label = subViewLabel(view.key, t);
        const divergence =
          view.divergenceLabel === 'AI_PROJECTED'
            ? t.divergence.aiProjected
            : view.divergenceLabel === 'SOURCES_DIVERGE'
              ? t.divergence.sourcesDiverge
              : null;

        return (
          <button
            key={view.key}
            id={subViewTabId(view.key)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={ANALYSIS_SUBVIEW_PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(view.key)}
            style={{ scrollSnapAlign: 'start' }}
            /*
              Accessible name states the position, so a screen-reader
              user always knows they are inside a dimension and how many
              refinements it has (R1 A11y: "…, 2 items, view 3 of 3").
            */
            aria-label={`${label}, ${view.count} ${dict.itemForms[view.count === 1 ? 0 : 1]}, ${t.viewOf} ${index + 1} / ${subViews.length}`}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-[2px] py-[6px] font-gn-mono text-gn-hud-subview uppercase transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus md:min-h-[30px] ${
              active
                ? `${ACCENT_UNDERLINE[view.accent]} text-gn-title`
                : 'border-b-transparent text-gn-ink-muted hover:text-gn-ink-hover'
            }`}
          >
            <span aria-hidden="true">{label}</span>
            <span aria-hidden="true" className="font-gn-mono text-gn-hud-meta text-gn-hud-faint">
              {view.count}
            </span>
            {divergence !== null && (
              /*
                R1 attaches the qualifier to the segment, not the claims:
                it describes the SEGMENT'S nature — projected rather than
                reported, or divergent rather than settled.
              */
              <span
                aria-hidden="true"
                className="rounded-[3px] border border-gn-line-chip px-[4px] py-[1px] font-gn-mono text-gn-hud-micro text-gn-hud-faint"
              >
                {divergence}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
