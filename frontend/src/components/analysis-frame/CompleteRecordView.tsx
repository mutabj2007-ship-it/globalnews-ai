'use client';

import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AnalysisResultView } from '../search/AnalysisResultView';
import { RetrievalContextStatus } from '../search/RetrievalContextStatus';
import { SourceEntitiesPanel } from '../search/SourceEntitiesPanel';
import { AnalysisModeBadge } from '../search/AnalysisModeBadge';
import { SourcesDock } from './SourcesDock';
import { buildAnalysisWorkspaceModel } from '../search/analysisDimensions';

/**
 * P-12 — the Complete Analysis Record, as a separate destination.
 *
 * 06 §1: preserved in full, demoted from the reading path. It may be as
 * long as it needs to be, so this view is the ONE place where ordinary
 * document scrolling is permitted (§5) — it is not inside the frame.
 *
 * ── R4: WHY THIS STOPPED BEING A JSON DUMP ────────────────────────────
 *
 * Until R4 this view rendered `JSON.stringify(response.analysis)`. That
 * was adequate while `/search` still rendered the long-form record
 * itself: the record was on the page, and this was a debug artefact
 * beside it.
 *
 * R4 makes the bounded frame the default `/search` presentation, so the
 * long-form record is no longer on the page — and this view becomes the
 * only place several fields still exist. A JSON dump of `analysis` alone
 * would have silently dropped every SIBLING of `analysis` on the
 * response (`retrievalContext`, `sourceEntities`, `provenance`,
 * `sourceDiversity`, `analysisError`), which R4 §4 forbids.
 *
 * Measured gap this closes — fields the frame's own reading path never
 * binds, directly or through `buildAnalysisWorkspaceModel`:
 *
 *   analysis.confidence   the model's SELF-assessment. The frame's
 *                         evidence meter reads `trustState.level`, which
 *                         is a different quantity; nothing in the frame
 *                         path reads `confidence` at all.
 *   analysis.analysisMode carried here by AnalysisModeBadge.
 *   sourceEntities        organizations resolved from the retrieved set.
 *   retrievalContext      in full, not just the geography the rail uses.
 *   sourceDiversity       the complete counters, not the cluster count.
 *   analysisError         the provider's own words when analysis failed.
 *
 * These are the ACCEPTED long-form components, reused rather than
 * reimplemented, so the record keeps the presentation those fields were
 * already reviewed in and no second rendering of them is introduced.
 *
 * This is progressive disclosure, not duplication (§6): the default
 * frame does not render any of it.
 */
export interface CompleteRecordViewProps {
  response: AnalysisApiResponse;
  language?: LanguageCode;
  onBack?: () => void;
}

export function CompleteRecordView({
  response,
  language = 'en',
  onBack,
}: CompleteRecordViewProps): JSX.Element {
  const t = getDictionary(language).analysisFrame;
  const analysis = response.analysis;

  return (
    <div data-paf="complete-record" className="mx-auto max-w-[900px] px-6 py-8">
      <button
        type="button"
        onClick={onBack}
        className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
      >
        ← {t.backToWorkspace}
      </button>

      <h1 className="mt-4 font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#a9bccf]">
        {t.completeRecord}
      </h1>
      <p className="mt-1 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#4a5c73]">
        {t.completeRecordSub}
      </p>

      {/* Siblings of `analysis`. Rendered whether or not the analysis
          itself survived — retrieval context and the resolved entities
          are facts about the RETRIEVAL, and they outlive an AI failure. */}
      <div data-paf="record-retrieval" className="mt-6 flex flex-col gap-4">
        <RetrievalContextStatus
          retrievalContext={response.retrievalContext}
          articleCount={response.articles.length}
          language={language}
        />
        <AnalysisModeBadge provenance={response.provenance} language={language} />
        <SourceEntitiesPanel sourceEntities={response.sourceEntities} language={language} />
      </div>

      {analysis === null ? (
        <div data-paf="record-no-analysis" className="mt-6">
          <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#e0a33d]">
            {t.analysisUnavailableRetrievalSucceeded}
          </p>
          {/* The provider's own words, when it gave any. Never invented,
              and never shown as an empty box when it did not. */}
          {response.analysisError === undefined ? null : (
            <p
              data-paf="record-analysis-error"
              className="mt-2 font-gn-mono text-[12px] md:text-[11px] leading-[1.6] text-[#a9bccf]"
            >
              {response.analysisError}
            </p>
          )}
        </div>
      ) : (
        <div data-paf="record-body" className="mt-6">
          <AnalysisResultView
            analysis={analysis}
            provenance={response.provenance}
            sourceDiversity={response.sourceDiversity}
            language={language}
          />
        </div>
      )}

      {/*
        H-ALPHA-VISUAL-1 ITEM A — THE FORENSIC DOCK KEEPS ITS HOME.
        The authorization retires the miniature dock as the NORMAL
        READING presentation and permits it to remain "for
        forensic/Complete Analysis Record use if useful". It is useful:
        this is the only surface that shows, per source, which dimensions
        cite it, its citation number, its support state and its
        relational assessments — none of which belongs on a reading card
        and none of which the image-led section carries.

        It is the SAME component, not a copy, so there is exactly one
        implementation of the provenance view in the product.
      */}
      <div data-paf="record-sources-forensic" className="mt-8">
        <SourcesDock
          sources={buildAnalysisWorkspaceModel(response).sourceSupport}
          expanded
          onToggle={() => undefined}
          highlightedArticleId={null}
          language={language}
        />
      </div>
    </div>
  );
}
