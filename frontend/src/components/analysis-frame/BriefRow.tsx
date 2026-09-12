'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { EvidenceMeterState } from '../search/analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { resolveBriefBand } from './briefLadder';
import { TrustSummaryLine } from './TrustSummaryLine';
import type { BriefModel, BriefTelemetry } from './briefModel';

export const BRIEF_TITLE_ID = 'gn-paf-thesis-title';

/**
 * P-02 — row 1, spanning the index and centre columns (F-1).
 *
 * TWO HEIGHT STATES, ONE DOM REGION (10 §4). The compressed band is the
 * same region with less content, so focus, the `<h1>` and any
 * aria-describedby survive the transition and a screen-reader user is
 * never given less than a sighted one.
 *
 * THE TITLE IS A DIRECT FLEX CHILD OF THE BAND. A min-width on a nested
 * span cannot push back on a `flex-shrink:0` sibling — it overflows and
 * overprints the telemetry cluster. 03 §2a spends a paragraph on this
 * because it is the bug the previous revisions kept reintroducing.
 *
 * RULING 2: `clause` is non-null ONLY for a relational analysis, where
 * the backend authored it. Nothing here slices the summary paragraph.
 */
export interface BriefRowProps {
  brief: BriefModel;
  telemetry: BriefTelemetry;
  evidenceMeter: EvidenceMeterState;
  compressed: boolean;
  /** Measured border-box width of the band, from a ResizeObserver. */
  bandWidth: number;
  onToggleFull: () => void;
  language?: LanguageCode;
  /**
   * A1-C2-25b — the size of the Complete Analysis Record, for the PASSIVE
   * EXISTENCE LINE below. 0 renders nothing at all, matching the
   * control's own empty state: if there is no record, the reader is not
   * told one exists.
   */
  recordItemCount?: number;
  /**
   * DESIGN-C2 LOCK 6 — whether the BAND carries the trust summary.
   *
   * `hidden md:flex` was not enough. A CSS-hidden element has no rect, so
   * C2-26's probe would have passed, but the element was still in the phone
   * DOM ahead of the answer — and the comment beside it claimed otherwise,
   * which is the kind of small untruth that outlives the reason for it. The
   * frame knows the viewport and decides; this component obeys.
   */
  showTrustSummary?: boolean;
}

export function BriefRow({
  brief,
  telemetry,
  evidenceMeter,
  compressed,
  bandWidth,
  onToggleFull,
  language = 'en',
  recordItemCount = 0,
  showTrustSummary = true,
}: BriefRowProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;
  const band = resolveBriefBand(bandWidth, brief.clause !== null);

  const meter = (
    <span data-paf="evidence-meter" className="inline-flex items-center gap-[3px]">
      {Array.from({ length: evidenceMeter.totalSegments }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`inline-block h-[4px] w-[13px] rounded-[1px] ${
            i < evidenceMeter.filledSegments ? 'bg-[#60a5fa]' : 'bg-[#22303f]'
          }`}
        />
      ))}
    </span>
  );

  const meterWord = (
    <span data-paf="evidence-word" className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#93c5fd]">
      {evidenceMeter.label}
    </span>
  );

  const control = (
    <button
      type="button"
      data-paf="brief-toggle"
      aria-expanded={!compressed}
      onClick={onToggleFull}
      aria-label={t.expandBrief}
      className="shrink-0 rounded-[6px] border border-[#22303f] px-[8px] py-[3px] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#a9bccf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
    >
      ▾{band.controlLabelled ? ` ${t.expandBrief}` : ''}
    </button>
  );

  if (compressed) {
    return (
      <section
        data-paf="brief-row"
        data-state="compressed"
        aria-label={t.briefRegion}
        className="flex h-full items-center gap-3 overflow-hidden border-b border-[#1b2634] bg-[rgba(6,10,16,.97)] px-4 md:px-[26px]"
      >
        <span aria-hidden="true" className="inline-block h-[9px] w-[9px] shrink-0 rotate-45 bg-[#60a5fa]" />

        {/* DIRECT flex child. 32ch floor, ellipsis, never removed. */}
        <h2
          id={BRIEF_TITLE_ID}
          data-paf="thesis-title"
          className="min-w-[32ch] shrink truncate font-gn-sans text-[14.5px] font-semibold text-[#eaf1f8]"
          style={band.showClause ? { maxWidth: '44ch' } : { flex: '1 1 auto' }}
        >
          {brief.title}
        </h2>

        {band.showClause && brief.clause !== null ? (
          <p
            data-paf="thesis-clause"
            className="min-w-0 flex-1 truncate font-gn-sans text-[13px] text-[#8ba3bd]"
          >
            <span className="mr-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9]">
              {t.relationalAnswer}
            </span>
            {brief.clause}
          </p>
        ) : null}

        <span className="ml-auto flex shrink-0 items-center gap-[10px]">
          {band.showMeterSegments ? meter : null}
          {meterWord}
          {band.showLocationToken && telemetry.retrievedArticleCount !== null ? (
            <span data-paf="location-token" className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9]">
              {telemetry.retrievedArticleCount} {t.retrievedReports}
            </span>
          ) : null}
          {control}
        </span>
      </section>
    );
  }

  return (
    <section
      data-paf="brief-row"
      data-state="expanded"
      aria-label={t.briefRegion}
      className="flex h-full flex-col gap-2 overflow-hidden border-b border-[#1b3555] bg-[linear-gradient(180deg,rgba(37,99,235,.09),rgba(5,8,13,.96))] px-4 py-4 md:px-[26px]"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-block h-[12px] w-[12px] shrink-0 rotate-45 bg-[#60a5fa]" />
        <span className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.16em] text-[#93c5fd]">{t.briefLabel}</span>
        <span className="ml-auto font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]">
          {telemetry.retrievedArticleCount !== null ? `${telemetry.retrievedArticleCount} ${t.retrievedReports}` : ''}
          {telemetry.reportingClusterCount !== null ? ` · ${telemetry.reportingClusterCount} ${t.reportingClusters}` : ''}
        </span>
      </div>

      {/*
        ── DESIGN-C2 LOCK 4 — <h2>, AND THE LOCKED PHONE SECTION HEADING ──

        C2-18 makes the reader's QUESTION the h1. This is the AI's
        headline: below it in the document, and now below it in the
        outline too. The tag change is the whole of the semantic edit —
        `BRIEF_TITLE_ID` is unchanged, so every `aria-labelledby` that
        points here still resolves.

        Phone takes Lock 4's section-heading value, 17px/1.35/600, which
        also stops the headline outranking the 20px question visually.
        Desktop keeps its released 25px: Lock 4 is a phone scale.
      */}
      <h2
        id={BRIEF_TITLE_ID}
        data-paf="thesis-title"
        className="font-gn-sans text-[17px] font-semibold leading-[1.35] tracking-[-0.02em] text-[#eaf1f8] md:text-[25px] md:leading-[1.22]"
      >
        {brief.title}
      </h2>

      {brief.titleIsOrientationOnly ? (
        <p data-paf="orientation-only" className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#54687f]">
          {t.orientationOnly}
        </p>
      ) : null}

      {brief.clause !== null ? (
        <p data-paf="relational-answer" className="font-gn-sans text-[15px] leading-[1.55] text-[#eaf1f8] md:leading-[1.5]">
          <span className="mr-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9]">
            {t.relationalAnswer}
          </span>
          {brief.clause}
        </p>
      ) : null}

      {/*
        ── H-ALPHA-VISUAL-1 H-1 — THE BAND NO LONGER CARRIES THE SUMMARY ──

        It used to render `analysis.summary` here, under `line-clamp-4`,
        while the Executive Brief dimension rendered THE SAME STRING
        unclamped a few hundred pixels below. Main proved the duplication;
        the clamp made the band's copy the truncated one, so the reader
        met the synthesis first in its cut-off form.

        The band is now what the CTO's preferred architecture calls for: a
        COMPACT ORIENTATION AND STATUS element — dimension, headline,
        retrieval telemetry, evidence strength, open questions. The
        Executive Brief owns the complete substantive summary and renders
        every paragraph of it, unclamped.

        Nothing is hidden by this. The Executive Brief is the DEFAULT
        active dimension, immediately below, so the full synthesis is the
        first prose the reader meets rather than the last.
      */}

      {/*
        ── DESIGN-C2 LOCK 6 — RANK ───────────────────────────────────────

        "Phone: BELOW the answer's first paragraph. Never above it." This
        band is above the answer at every width, so on phone the trust
        summary is not rendered here AT ALL — it is rendered in the reading
        path by `AnalysisFrame`, after the first paragraph. Desktop keeps it
        in the band, which Lock 6 permits because there is room and it
        displaces nothing.

        `hidden md:flex` rather than a JS branch, so the phone DOM is free of
        it whatever the hydration order.

        OPEN QUESTIONS stays here at both widths. It is a count of unresolved
        questions, not a statement of evidence strength, and Lock 6 governs
        the strength line only.
      */}
      <div className="mt-auto flex items-center gap-[10px]">
        {showTrustSummary ? (
          <TrustSummaryLine
            meter={evidenceMeter}
            telemetry={telemetry}
            language={language}
            placement="band"
          />
        ) : null}
        {telemetry.unresolvedCount !== null ? (
          <span className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]">
            {showTrustSummary ? '· ' : ''}
            {telemetry.unresolvedCount} {t.openQuestions}
          </span>
        ) : null}
      </div>

      {/*
        ── A1-C2-25b — THE PASSIVE EXISTENCE LINE ──────────────────────

        Addendum B's second affordance, and the structural half of the
        discoverability requirement. The reader learns that a complete
        record exists, and how big it is, HERE — in the summary band at
        the top of the reading path — rather than discovering it only if
        they reach the control at the end.

        IT IS NOT A SECOND CONTROL. No onClick, no href, no tabindex, no
        role: it states a fact and does not navigate. There is still
        exactly one way into the record, which is the control in the
        section index.

        ABSENT WHEN THE RECORD IS, matching the control's own empty
        state — a reader is never told a record exists when none does.
      */}
      {recordItemCount > 0 ? (
        <p
          data-paf="complete-record-exists"
          className="mt-[6px] font-gn-mono text-[12px] uppercase tracking-[0.1em] text-[#8a7340] md:text-[11px]"
        >
          {t.completeRecordExists.replace('{n}', String(recordItemCount))}
        </p>
      ) : null}
    </section>
  );
}
