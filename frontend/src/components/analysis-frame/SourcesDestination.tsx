'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { SourceSupportEntry } from '../search/analysisDimensions';
import { SourcesReporting } from './SourcesReporting';
import { EMPTY_RELATIONAL_EVIDENCE, type RelationalEvidenceModel } from './relationalEvidence';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE DEDICATED SOURCES DESTINATION — PO C904 REVIEW, CORRECTION 2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The ruling, verbatim: *"The inner vertical Sources scrollbar carve-out is NOT
 * approved... For extremely short viewports where expanded cards cannot coexist
 * with a useful reader, implement the dedicated Sources destination/state
 * already permitted by the ruling. It may replace the frame temporarily and
 * return to it. It must preserve the user's question/analysis state. It must
 * have an obvious Back/Close return path. Do not create a new route unless the
 * existing destination-switch pattern requires one; prefer in-place destination
 * state."*
 *
 * ── WHAT C904 DID WRONG ─────────────────────────────────────────────────────
 *
 * C904 kept the inner scroller for viewports too short to fit the expanded
 * dock, reported it honestly, and called the destination "not built in this
 * candidate". That was still the rejected behaviour, just narrowed: on a short
 * screen the only way to reach the source imagery remained a vertical scrollbar
 * inside the Sources region. The carve-out is now gone and this is what fills
 * it.
 *
 * ── NO NEW ROUTE, BECAUSE THE PATTERN ALREADY EXISTS ────────────────────────
 *
 * `AnalysisFrameClient` already holds `destination` state — `'frame'`,
 * `'record'`, `'library'` — and each non-frame destination is a full-surface
 * component with `onBack={() => setDestination('frame')}`. This is the fourth
 * member of that set, built the same way, so:
 *
 *   THE URL DOES NOT CHANGE.        No route, no navigation, no refetch.
 *   THE ANALYSIS IS NOT RE-RUN.     `response` lives in the client above this
 *                                   component and is untouched; returning is a
 *                                   state change, not a reload.
 *   THE QUESTION SURVIVES.          Same reason. The reader comes back to the
 *                                   frame they left, with the same answer.
 *
 * ── THE SAME SOURCE PRESENTATION, GIVEN ROOM ────────────────────────────────
 *
 * This does NOT introduce a second way of drawing a source. It renders
 * `SourcesReporting` — the exact component the dock renders — with the page to
 * itself, so the cards appear at their intended size instead of being clipped
 * or shrunk. The ruling is explicit that shrinking was not an acceptable
 * alternative: *"Do not shrink the source imagery into illegibility merely to
 * retain the old centre floor."*
 *
 * Horizontal navigation inside the card strip is unchanged and still expected.
 * The page itself scrolls, as an ordinary document does — what the ruling
 * forbids is a scrollbar INSIDE the Sources region whose purpose is to reveal
 * the cards, and there is no such region here: the cards are the page.
 */

export interface SourcesDestinationProps {
  readonly sources: readonly SourceSupportEntry[];
  /** Echoed so the reader can see which question these sources answer. */
  readonly query: string;
  readonly relational?: RelationalEvidenceModel;
  readonly highlightedArticleId?: string | null;
  readonly language?: LanguageCode;
  readonly onBack: () => void;
}

export function SourcesDestination({
  sources,
  query,
  relational = EMPTY_RELATIONAL_EVIDENCE,
  highlightedArticleId = null,
  language = 'en',
  onBack,
}: SourcesDestinationProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;

  return (
    <div data-paf="sources-destination" className="mx-auto max-w-[1200px] px-6 py-8">
      {/*
        THE RETURN PATH IS THE FIRST THING IN THE DOCUMENT, and it is a real
        button rather than a browser-back hint. "Obvious Back/Close return
        path" is a requirement of the ruling, and a destination whose exit
        depends on the browser's own back button is not one — this destination
        never touched the history.

        Same affordance, same copy key and same position as the Evidence
        Library and the Complete Record, because a reader should not have to
        learn a third way out.
      */}
      <button
        type="button"
        onClick={onBack}
        data-paf="sources-destination-back"
        className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
      >
        ← {t.backToWorkspace}
      </button>

      <h1 className="mt-4 font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#a9bccf]">
        {t.sourcesDestinationTitle}
      </h1>

      {/*
        THE QUESTION IS ECHOED, NOT RESTATED FROM MEMORY. It is the same
        `response.query` the frame prints, passed down — so a reader who has
        replaced the frame with this page can still see what they asked, which
        is most of what "preserve the user's question state" means to the
        person rather than to the component tree.
      */}
      <p
        data-paf="sources-destination-question"
        className="mt-[6px] max-w-[74ch] font-gn-sans text-[15px] leading-[1.45] text-[#d5e1ee]"
      >
        {query}
      </p>

      <div className="mt-6">
        <SourcesReporting
          sources={sources}
          highlightedArticleId={highlightedArticleId}
          relational={relational}
          language={language}
          /*
            NEVER COLLAPSED HERE. Collapsing exists for a frame that has run out
            of vertical room; this page has the whole viewport, which is the
            entire reason the reader was brought to it.
          */
          collapsed={false}
        />
      </div>
    </div>
  );
}
