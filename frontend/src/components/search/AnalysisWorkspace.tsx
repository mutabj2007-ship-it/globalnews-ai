'use client';

import { useMemo, useState } from 'react';
import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { buildAnalysisWorkspaceModel, PRIMARY_DIMENSION_KEYS } from './analysisDimensions';
import type { PrimaryDimensionKey } from './analysisDimensions';
import { dimensionEmptyLabelKey, dimensionEmptyReason } from './dimensionEmptiness';
import { AnalysisIndex, dimensionLabel } from './AnalysisIndex';
import { ANALYSIS_VIEWPORT_ID, AnalysisViewport } from './AnalysisViewport';
import { AnalysisTelemetry } from './AnalysisTelemetry';
import { ExecutiveBrief } from './ExecutiveBrief';
import { ClaimCard } from './ClaimCard';
import { SOURCES_DRAWER_ID, SourcesDrawer } from './SourcesDrawer';
import {
  buildContextEntries,
  buildDifferenceGroups,
  buildDimensionClaims,
  buildExecutiveBriefModel,
  buildRelationshipsSurface,
  buildSubViewClaims,
  buildTelemetryModel,
  buildTimelineEntries,
  buildWatchNextEntries,
} from './analysisClaims';
import { GeographicIntelligence } from './GeographicIntelligence';
import { subViewLabel } from './AnalysisSubViewStrip';
import { TimelineSubView } from './TimelineSubView';
import { RelationshipsSubView } from './RelationshipsSubView';
import type { SubViewKey } from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * H2B — the Analysis Workspace shell.
 *
 * Owns the workspace frame, its geometry, and the single piece of
 * navigation state the whole architecture turns on: which dimension is
 * active. Everything below it reads that state; nothing else writes it.
 *
 * NO SECOND FETCH. This component receives an AnalysisApiResponse that
 * SearchPageClient has already fetched through lib/api/analysisApi.ts.
 * It imports no API client, references no network primitive, and issues
 * no request of its own — switching dimensions is a render-selection
 * decision over data already in memory, which is exactly why the
 * one-panel-at-a-time architecture costs nothing at runtime.
 *
 * NO DUPLICATED MAPPING. Every dimension key, count, accent and empty
 * state comes from the H2A adapter (analysisDimensions.ts). This
 * component never reads a production response field directly, so there
 * is one place where the response is interpreted rather than two that
 * can drift apart.
 *
 * H2C — the shell now carries content. It mounts the telemetry cluster
 * (E-04/E-05/E-06) in the bar, the Executive Brief and answer grid
 * (E-09/E-10) in the brief dimension, claim cards (E-16/E-17) in the
 * other six, and the sources drawer (E-22) that both the sources
 * counter and every citation pill open. The claim entries come from
 * analysisClaims.ts, which mirrors the adapter's own per-dimension
 * selection — so the count in the index and the cards in the viewport
 * are two views of one list, never two lists that agree by luck.
 *
 * H2D closes the workspace for MVP. It adds the level-2 sub-views
 * (E-26) over the segments the H2A adapter already allocated, the
 * geographic intelligence module (E-13), the context disclosure (E-24),
 * analytical watch-next (E-25), the chronology list (E-28) and the
 * data-gated relational surface (E-29). With those bound, the workspace
 * is the analysis rather than a summary of it, and SearchPageClient
 * collapses the long-form record behind a disclosure.
 *
 * Still no fetch, still no API client, still no second interpretation
 * of the response. Opening the drawer, switching a segment and
 * expanding an evidence basis are render-selection decisions over data
 * already in memory.
 */

export interface AnalysisWorkspaceProps {
  response: AnalysisApiResponse;
  language?: LanguageCode;
}

export function AnalysisWorkspace({
  response,
  language = 'en',
}: AnalysisWorkspaceProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisWorkspace;

  /**
   * The adapter is pure and the response object is stable between
   * renders, so the model is memoized on the response identity rather
   * than rebuilt on every keystroke elsewhere in the tree.
   */
  const model = useMemo(() => buildAnalysisWorkspaceModel(response), [response]);

  /** Default on load is the Executive Brief (03 §2). */
  const [activeDimension, setActiveDimension] = useState<PrimaryDimensionKey>('brief');
  const [focusedIndex, setFocusedIndex] = useState(0);

  /** E-22 is opened by the sources counter and by every citation pill. */
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [focusArticleId, setFocusArticleId] = useState<string | null>(null);

  /**
   * E-26 level-2 state. Null means "the primary segment", which is what
   * every dimension shows until the reader chooses otherwise. Switching
   * primary dimension resets it — R1: "Switching primary dimension
   * resets its sub-view to the primary segment."
   */
  const [subViewByDimension, setSubViewByDimension] = useState<
    Partial<Record<PrimaryDimensionKey, SubViewKey>>
  >({});

  /**
   * Entries for the active dimension only. One dimension is on screen at
   * a time, so there is no reason to build the other six — and memoizing
   * on (response, activeDimension) keeps switching dimensions free of
   * re-derivation for the dimension already shown.
   */
  const claims = useMemo(
    () => buildDimensionClaims(response, activeDimension),
    [response, activeDimension],
  );

  /*
    Read through the adapter, never off the response. The shell has one
    interpretation layer beneath it and no second opinion of its own —
    the same rule H2B established and a test enforces.
  */
  const brief = useMemo(() => buildExecutiveBriefModel(response), [response]);
  const telemetry = useMemo(() => buildTelemetryModel(response), [response]);

  /**
   * The active dimension is validated against the model on every render
   * rather than trusted. The dimension list is fixed at seven so this
   * cannot currently fail — but it is the guard that keeps the invariant
   * true if a future slice ever makes the list conditional, and it costs
   * one array lookup.
   */
  /*
    ── J-2 · WHY THIS DIMENSION IS EMPTY ────────────────────────────────────

    Computed ONCE for the active dimension so the dimension panel and any
    sub-view panel cannot give different reasons for the same emptiness.

    The backend reports how many entries the model generated and how many
    survived grounding. Those counts are diagnostics and never render; what
    reaches the reader is the distinction they carry — the reporting was silent,
    or it did not support what was drafted. Where no census exists this resolves
    to the original generic line rather than guessing.
  */
  const emptyDimensionLabelKey = dimensionEmptyLabelKey(
    dimensionEmptyReason(response, activeDimension),
  );

  const activeIndex = model.dimensions.findIndex((d) => d.key === activeDimension);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeModel = model.dimensions[safeIndex];

  function selectDimension(key: PrimaryDimensionKey): void {
    setActiveDimension(key);
    /* Reset that dimension's segment, so returning to it always starts
       at the primary view rather than wherever it was left. */
    setSubViewByDimension((current) => ({ ...current, [key]: undefined }));
  }

  function selectSubView(key: SubViewKey): void {
    setSubViewByDimension((current) => ({ ...current, [activeDimension]: key }));
  }

  function openSourcesAt(articleId: string | null): void {
    setFocusArticleId(articleId);
    setSourcesOpen(true);
  }

  function closeSources(): void {
    setSourcesOpen(false);
    setFocusArticleId(null);
  }

  /*
    The active segment for the dimension on screen. Defaults to the
    primary segment, and falls back to it if a stored choice no longer
    exists in the allocation — which can happen when a new response
    drops the field that segment read.
  */
  const primarySubView = activeModel?.subViews.find((view) => view.isPrimarySegment)?.key ?? null;
  const storedSubView = subViewByDimension[activeDimension];
  const activeSubView =
    storedSubView !== undefined &&
    activeModel?.subViews.some((view) => view.key === storedSubView) === true
      ? storedSubView
      : primarySubView;

  const contextEntries = useMemo(() => buildContextEntries(response), [response]);
  const watchNextEntries = useMemo(() => buildWatchNextEntries(response), [response]);
  const timelineEntries = useMemo(() => buildTimelineEntries(response), [response]);
  const differenceGroups = useMemo(() => buildDifferenceGroups(response), [response]);
  const relationships = useMemo(() => buildRelationshipsSurface(response), [response]);

  if (activeModel === undefined) {
    // Unreachable while PRIMARY_DIMENSION_KEYS is non-empty; returning an
    // empty fragment is still better than throwing inside a live page.
    return <></>;
  }

  /**
   * The body for a non-primary segment. Three of the eight segments
   * carry a shape a claim list cannot express, so each has its own
   * surface; the other five are ordinary claim cards over a different
   * contract array.
   */
  function renderSubView(subView: SubViewKey): JSX.Element {
    if (subView === 'timeline') {
      return (
        <TimelineSubView
          entries={timelineEntries}
          onOpenSource={openSourcesAt}
          language={language}
        />
      );
    }

    if (subView === 'relationships') {
      /* Data-gated: the adapter drops the segment when the composition
         is absent, so this branch is only reachable when it exists. */
      return relationships === null ? (
        <EmptySubView label={t.noItemsInDimension} />
      ) : (
        <RelationshipsSubView
          model={relationships}
          onOpenSource={openSourcesAt}
          language={language}
        />
      );
    }

    if (subView === 'differences') {
      if (differenceGroups.length === 0) return <EmptySubView label={t.noItemsInDimension} />;
      return (
        <div className="flex flex-col gap-4">
          {differenceGroups.map((group) => (
            <div key={`${group.ordinal}-${group.topic}`}>
              <p className="font-gn-mono text-gn-hud-supports uppercase text-gn-uncertain">
                {t.subViews.topic} · {group.topic}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {group.positions.map((position, index) => (
                  <ClaimCard
                    key={`${group.ordinal}-${position.ordinal}`}
                    entry={position}
                    accent="gn-uncertain"
                    dimensionName={group.topic}
                    total={group.positions.length}
                    index={index}
                    onOpenSource={openSourcesAt}
                    language={language}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const entries = buildSubViewClaims(response, subView);
    if (entries.length === 0) return <EmptySubView label={t[emptyDimensionLabelKey]} />;
    const accent =
      activeModel.subViews.find((view) => view.key === subView)?.accent ?? activeModel.accent;
    return (
      <div className="flex flex-col gap-2">
        {entries.map((entry, index) => (
          <ClaimCard
            key={`${subView}-${entry.ordinal}`}
            entry={entry}
            accent={accent}
            dimensionName={subViewLabel(subView, t.subViews)}
            total={entries.length}
            index={index}
            onOpenSource={openSourcesAt}
            language={language}
          />
        ))}
      </div>
    );
  }

  return (
    <section
      aria-label={t.workspaceLabel}
      className="rounded-gn-module border border-gn-line-card bg-gn-page bg-gn-grid bg-[length:64px_64px]"
    >
      {/*
        E-01 WorkspaceBar. H2B builds its frame and identity row only —
        the telemetry cluster (evidence meter, retrieval counters, sources
        entry) is E-04/E-05/E-06 and belongs to a later slice. The bar is
        sticky so the workspace keeps its command frame while the viewport
        scrolls, which is the behaviour 02 §2 turns on.
      */}
      <header className="sticky top-0 z-10 border-b border-gn-line-card bg-gn-bar px-4 pb-4 pt-3 backdrop-blur-[14px] md:px-6">
        <span className="font-gn-mono text-gn-hud-label uppercase text-gn-hud">
          {dict.yourQuestion}
        </span>
        <h1 className="mt-[7px] line-clamp-3 max-w-[74ch] text-balance font-gn-display text-gn-title-m text-gn-title md:line-clamp-2 md:text-gn-title">
          {response.query}
        </h1>

        {/*
          E-01 telemetry cluster. Every figure is a count of records the
          payload already carries; the cluster reports the evidentiary
          base of the analysis before any of its prose is read.
        */}
        <div className="mt-[14px] -mx-4 md:-mx-6">
          <AnalysisTelemetry
            meter={model.evidenceMeter}
            articlesRetrieved={telemetry.articlesRetrieved}
            reportingClusterCount={telemetry.reportingClusterCount}
            evidenceUsedCount={telemetry.evidenceUsedCount}
            sourceCount={model.sourceSupport.length}
            sourcesOpen={sourcesOpen}
            onOpenSources={() => openSourcesAt(null)}
            sourcesPanelId={SOURCES_DRAWER_ID}
            language={language}
          />
        </div>
      </header>

      {/* E-19 mobile navigator — pinned directly under the header. */}
      <div className="border-b border-gn-line-card bg-gn-page md:hidden">
        <AnalysisIndex
          dimensions={model.dimensions}
          activeDimension={activeModel.key}
          onSelect={selectDimension}
          variant="mobile"
          panelId={ANALYSIS_VIEWPORT_ID}
          language={language}
          focusedIndex={focusedIndex}
          onFocusedIndexChange={setFocusedIndex}
        />
      </div>

      {/*
        Desktop geometry. The 320px context rail is E-18 and is not part
        of this slice, so the grid is deliberately two tracks rather than
        three with an empty column pretending to be a rail.

        R2a — WHY THIS TRACK IS 260px AND THE ROW IS FLUID.

        The released geometry put a FIXED 212px row inside a 236px track
        whose own padding (`md:pl-6 md:pr-[14px]` = 38px) left a 198px
        content box. 212 into 198 overflows by 14px, which is where the
        horizontal scrollbar came from — it was never a styling accident,
        it was arithmetic. Measured in Chromium before this change, both
        `INSUFFICIENT EVIDENCE` and `NIEWYSTARCZAJĄCE DOWODY` also
        truncated, because the fixed row left 151px of label area against
        the 153px and 167px those two strings need.

        `fluid` makes the row width-relative instead of fixed, so it
        cannot overflow ANY track, and lets a long label wrap between
        words rather than truncate. 260px is then the width that carries
        both languages on one line: at JetBrains Mono's 0.6em advance plus
        0.09em tracking the label area is 260 - 24 padding - 43 chrome -
        24.6 badge = 168.4px, against 152.1px for EN and 166.6px for PL.

        THE COUNT COLUMN IS UNAFFECTED. The badge stays `shrink-0` with
        its own `min-w-[26px]` track, so nothing a label does can reach
        it. `searchWorkspace.spec.ts` measures all of this rather than
        asserting the class names.
      */}
      <div className="md:grid md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        <AnalysisIndex
          dimensions={model.dimensions}
          activeDimension={activeModel.key}
          onSelect={selectDimension}
          variant="desktop"
          panelId={ANALYSIS_VIEWPORT_ID}
          language={language}
          focusedIndex={focusedIndex}
          onFocusedIndexChange={setFocusedIndex}
          fluid
        />

        <AnalysisViewport
          dimension={activeModel}
          activeSubView={activeSubView}
          onSelectSubView={selectSubView}
          language={language}
        >
          {/*
            E-13 sits at the top of the WHO IS AFFECTED panel. That is
            the design's own rail-free placement, used here at every
            breakpoint because the 320px context rail (E-18) is a later
            slice. It shares one source of truth with the WHERE cell.
          */}
          {activeModel.key === 'who-is-affected' && (
            <div className="mb-4">
              <GeographicIntelligence geography={model.geography} language={language} />
            </div>
          )}

          {activeModel.key === 'brief' ? (
            <ExecutiveBrief
              brief={brief}
              cells={model.briefAnswers}
              contextEntries={contextEntries}
              watchNextEntries={watchNextEntries}
              onSelectDimension={selectDimension}
              onOpenSource={openSourcesAt}
              language={language}
            />
          ) : activeSubView !== null && activeSubView !== primarySubView ? (
            renderSubView(activeSubView)
          ) : claims.length === 0 ? (
            /*
              A present dimension with nothing in it. The row stays in
              the index, the panel stays reachable, and the panel says so
              — 07 §1 reverses the older behaviour where an empty section
              simply disappeared.
            */
            <div className="rounded-gn-module border border-gn-line-card bg-gn-panel p-5">
              <p className="font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint">
                {t[emptyDimensionLabelKey]}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {claims.map((entry, index) => (
                <ClaimCard
                  key={`${activeModel.key}-${entry.ordinal}`}
                  entry={entry}
                  accent={activeModel.accent}
                  dimensionName={dimensionLabel(activeModel.key, t.dimensions)}
                  total={claims.length}
                  index={index}
                  onOpenSource={openSourcesAt}
                  language={language}
                />
              ))}
            </div>
          )}
        </AnalysisViewport>
      </div>

      <SourcesDrawer
        open={sourcesOpen}
        entries={model.sourceSupport}
        focusArticleId={focusArticleId}
        onClose={closeSources}
        language={language}
      />
    </section>
  );
}

/**
 * Exported for tests: the shell must never present a dimension list that
 * differs from the adapter's fixed seven, in count or in order.
 */
export const WORKSPACE_DIMENSION_ORDER = PRIMARY_DIMENSION_KEYS;

/** The shared "present but empty" panel state, used by every segment. */
function EmptySubView({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-gn-module border border-gn-line-card bg-gn-panel p-5">
      <p className="font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint">{label}</p>
    </div>
  );
}
