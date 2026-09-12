'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { AccentToken, DimensionModel, SubViewKey } from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { dimensionAccessibleName, dimensionLabel } from './AnalysisIndex';
import { ANALYSIS_SUBVIEW_PANEL_ID, AnalysisSubViewStrip } from './AnalysisSubViewStrip';

/**
 * H2B — E-08 AnalysisViewport.
 *
 * The single exchangeable analytical surface. It holds exactly one
 * dimension at a time and is never a stack of all of them — that is the
 * whole point of the redesign, and it is enforced structurally here
 * rather than left to a later slice.
 *
 * WHAT THIS RENDERS, AND WHAT IT DOES NOT.
 * The viewport owns the region, its heading, its accent, its real item
 * count and the tabpanel/focus/live-region semantics. It does not own
 * the content: H2C passes the Executive Brief or the claim cards in as
 * children, so this component stays a frame and the decision about what
 * belongs in a dimension lives in one place above it.
 *
 * H2D adds the level-2 strip (E-26) between the caption and the body.
 * The strip is rendered here because it belongs to the panel, but every
 * segment it shows comes from the adapter's own allocation — this
 * component decides nothing about which refinements a dimension has.
 *
 * Still not built here, and deliberately absent rather than
 * approximated: the context rail and its modules (E-18), the colour
 * legend (E-20) and the mobile persistent footer (E-23). The fallback
 * below is what a caller sees when it passes no children at all — it
 * reports the real count from the H2A adapter and never stands in for a
 * finding.
 *
 * No intelligence is lost. SearchPageClient continues to render the
 * complete existing analysis beneath this shell, so every claim,
 * citation and source remains on the page and reachable no matter which
 * dimension is selected.
 */

const ACCENT_SQUARE: Readonly<Record<AccentToken, string>> = {
  'gn-verified': 'bg-gn-verified',
  'gn-ai': 'bg-gn-ai',
  'gn-geo': 'bg-gn-geo',
  'gn-significance': 'bg-gn-significance',
  'gn-uncertain': 'bg-gn-uncertain',
  'gn-provenance': 'bg-gn-provenance',
};

export const ANALYSIS_VIEWPORT_ID = 'gn-analysis-viewport';
export const ANALYSIS_VIEWPORT_HEADING_ID = 'gn-analysis-viewport-heading';

export interface AnalysisViewportProps {
  dimension: DimensionModel;
  /** Active level-2 segment. Null when the dimension has no strip. */
  activeSubView?: SubViewKey | null;
  onSelectSubView?: (key: SubViewKey) => void;
  language?: LanguageCode;
  /**
   * Rendered inside the region when the shell has real bound content for
   * this dimension. H2B passes nothing; H2C onward fills it.
   */
  children?: ReactNode;
}

export function AnalysisViewport({
  dimension,
  activeSubView = null,
  onSelectSubView,
  language = 'en',
  children,
}: AnalysisViewportProps): JSX.Element {
  const t = getDictionary(language).analysisWorkspace;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isFirstRender = useRef(true);

  /**
   * On dimension change the viewport scrolls to top instantly and moves
   * keyboard focus to the heading (02 §2.8). Skipped on first render so
   * the page does not steal focus on load.
   *
   * `scrollIntoView` is deliberately never used anywhere in this
   * workspace (10 §3) — it scrolls ancestors unpredictably. Setting
   * scrollTop on the owning region is the specified mechanism.
   */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const node = panelRef.current;
    if (node === null) return;
    node.scrollTop = 0;
    node.focus({ preventScroll: true });
  }, [dimension.key]);

  const label = dimensionLabel(dimension.key, t.dimensions);
  const announcement = dimension.countable
    ? `${t.showingPrefix} ${dimensionAccessibleName(dimension, t.dimensions, language, t.itemForms)}`
    : `${t.showingPrefix} ${label}`;

  return (
    <>
      {/*
        Dimension changes are announced politely. Without this a
        keyboard or screen-reader user gets no confirmation that the
        panel behind the tablist actually changed (10 §2).
      */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        ref={panelRef}
        id={ANALYSIS_VIEWPORT_ID}
        role="tabpanel"
        tabIndex={-1}
        aria-labelledby={ANALYSIS_VIEWPORT_HEADING_ID}
        className="min-w-0 px-4 pb-14 pt-[22px] outline-none md:px-[26px]"
      >
        <div className="flex items-center gap-3">
          {/* 12px accent square — E-08 HUD. Decorative; the heading names the dimension. */}
          <span
            aria-hidden="true"
            className={`h-3 w-3 shrink-0 rounded-[2px] ${ACCENT_SQUARE[dimension.accent]}`}
          />
          <h2
            id={ANALYSIS_VIEWPORT_HEADING_ID}
            className="font-gn-display text-gn-dimension uppercase text-gn-ink-primary"
          >
            {label}
          </h2>
          {dimension.countable && dimension.count !== null && (
            <span className="font-gn-mono text-gn-hud-meta text-gn-hud-faint">
              {pluralWithForms(dimension.count, language, t.itemForms).toUpperCase()}
            </span>
          )}
        </div>

        <p className="ml-6 mt-2 max-w-[70ch] font-gn-display text-gn-prose text-gn-ink-secondary">
          {t.captions[dimension.key === 'brief' ? 'brief' : 'dimension']}
        </p>

        {/*
          E-26. Rendered only when the adapter says the dimension has a
          refinement worth switching to; a one-segment strip is a control
          with nothing to control, and stripVisible already encodes that.
        */}
        {dimension.stripVisible && activeSubView !== null && onSelectSubView !== undefined && (
          <div className="max-w-[1100px]">
            <AnalysisSubViewStrip
              dimension={dimension.key}
              dimensionName={label}
              subViews={dimension.subViews}
              activeSubView={activeSubView}
              onSelect={onSelectSubView}
              language={language}
            />
          </div>
        )}

        <div
          id={ANALYSIS_SUBVIEW_PANEL_ID}
          role={dimension.stripVisible ? 'tabpanel' : undefined}
          className="mt-[22px] max-w-[1100px]"
        >
          {children ?? (
            <div className="rounded-gn-module border border-gn-line-card bg-gn-panel p-5">
              {/*
                An honest structural state. It reports the real count from
                the H2A adapter and says plainly that the detailed view is
                not in this build. It never stands in for a finding, and it
                never implies the analysis produced nothing.
              */}
              <p className="font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint">
                {dimension.isEmpty ? t.noItemsInDimension : t.regionNotInThisBuild}
              </p>
              <p className="mt-2 font-gn-display text-gn-prose text-gn-ink-secondary">
                {t.fullAnalysisBelow}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
