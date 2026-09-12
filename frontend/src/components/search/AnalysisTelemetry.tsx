'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { EvidenceMeterState } from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';

/**
 * H2C — E-04 evidence meter · E-05 retrieval counter · E-06 sources entry.
 * R2a adds E-05b, the evidence-used counter, and empties the count out
 * of E-06. See the block comment above the E-05b cell for why.
 *
 * The telemetry cluster of the WorkspaceBar: three cells that state the
 * evidentiary base of the analysis before any of its prose is read.
 *
 * EVERY NUMBER HERE IS A COUNT OF RECORDS THAT EXIST.
 * `articlesRetrieved` and the cluster count come straight from the
 * production payload; the sources count is the length of the existing
 * source list. Nothing is estimated, interpolated or scored.
 *
 * NO NUMERIC EVIDENCE SCORE, BY SPECIFICATION.
 * 08-DATA-BINDING-MAP row 7 reads "No numeric score", and §3 prohibits
 * "evidence scores or percentages". The meter is therefore an ordinal
 * of three segments carrying a mandatory word label, and this component
 * never renders a percentage, a ratio or a derived index.
 *
 * NO AI CONFIDENCE, BY CONTRACT.
 * `analysis.confidence` is documented in shared/src/analysis.ts as model
 * self-assessment metadata that is explicitly NOT the authoritative
 * trust signal and never an input to trust derivation. It is not read
 * here, and the meter is deliberately fed only from the backend-derived
 * TrustState via the H2A adapter. E-04 also requires that this cell is
 * never visually equated with the AI self-assessment module.
 *
 * UNRATED IS NOT A LOW SCORE. `rated: false` renders the word UNRATED in
 * the muted HUD ink, not a red or empty-looking meter, so the absence of
 * a rating can never be misread as a poor rating. `INSUFFICIENT` also
 * fills zero segments but is a real backend verdict, and it is styled
 * and labelled differently for exactly that reason.
 */

export interface AnalysisTelemetryProps {
  meter: EvidenceMeterState;
  articlesRetrieved: number;
  /** From sourceDiversity when the payload carries it; null when it does not. */
  reportingClusterCount: number | null;
  /**
   * R2a — `trustState.distinctSourceArticleCount`, passed through from
   * `buildTelemetryModel`. Null when there is no analysis; it NEVER
   * falls back to the retrieved count, which is the substitution this
   * repair exists to remove.
   */
  evidenceUsedCount: number | null;
  /**
   * How many source records the drawer can open. This is a CAPABILITY
   * figure — it decides whether the control is enabled — and R2a stops
   * rendering it as a number beside the word "Sources", because it
   * counts RETRIEVED articles and reading it as evidentiary support was
   * exactly the misreading being fixed.
   */
  sourceCount: number;
  sourcesOpen: boolean;
  onOpenSources: () => void;
  sourcesPanelId: string;
  language?: LanguageCode;
}

const CELL = 'flex flex-col gap-[5px] bg-gn-telemetry px-4 py-[9px] text-left';

export function AnalysisTelemetry({
  meter,
  articlesRetrieved,
  reportingClusterCount,
  evidenceUsedCount,
  sourceCount,
  sourcesOpen,
  onOpenSources,
  sourcesPanelId,
  language = 'en',
}: AnalysisTelemetryProps): JSX.Element {
  const t = getDictionary(language).analysisWorkspace.telemetry;

  const levelWord = meter.rated
    ? {
        STRONG: t.evidenceLevels.strong,
        MODERATE: t.evidenceLevels.moderate,
        LIMITED: t.evidenceLevels.limited,
        INSUFFICIENT: t.evidenceLevels.insufficient,
        UNRATED: t.evidenceLevels.unrated,
      }[meter.label]
    : t.evidenceLevels.unrated;

  /* "Evidence support: moderate, 2 of 3" — E-04 A11y, composed from
     localized parts rather than an English template. */
  const meterLabel = `${t.evidenceAriaPrefix}: ${levelWord}, ${meter.filledSegments} ${t.segmentsOf} ${meter.totalSegments}`;

  const articlesText = pluralWithForms(articlesRetrieved, language, t.articleForms);
  const retrievalLabel =
    reportingClusterCount === null
      ? articlesText
      : `${articlesText} ${t.across} ${pluralWithForms(reportingClusterCount, language, t.clusterForms)}`;

  return (
    <div className="flex flex-wrap items-stretch border-t border-gn-line-telemetry">
      {/* ── E-04 ─────────────────────────────────────────────── */}
      <div
        className={`${CELL} border-r border-gn-line-telemetry`}
        role="img"
        aria-label={meterLabel}
      >
        <span className="font-gn-mono text-gn-hud-micro uppercase text-gn-hud">
          {t.evidenceLabel}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="flex items-center gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-[5px] w-4 rounded-[2px] lg:h-[5px] lg:w-4 ${
                  i < meter.filledSegments ? 'bg-gn-verified' : 'bg-gn-line-strong'
                }`}
              />
            ))}
          </span>
          {/*
            The word is mandatory — the meter is never colour-only
            (10-ACCESSIBILITY). UNRATED takes the muted ink so that "no
            rating" never reads as "bad rating".
          */}
          <span
            className={`font-gn-mono text-gn-hud-cell uppercase ${
              meter.rated ? 'text-gn-verified-soft' : 'text-gn-hud-faint'
            }`}
          >
            {levelWord}
          </span>
        </span>
      </div>

      {/* ── E-05 ─────────────────────────────────────────────── */}
      <div
        className={`${CELL} border-r border-gn-line-telemetry`}
        aria-label={retrievalLabel}
        role="group"
      >
        <span className="font-gn-mono text-gn-hud-micro uppercase text-gn-hud">
          {t.retrievalLabel}
        </span>
        {articlesRetrieved === 0 ? (
          <span className="font-gn-mono text-gn-hud-value uppercase text-gn-hud-faint">
            {t.noArticlesRetrieved}
          </span>
        ) : (
          <span className="whitespace-nowrap font-gn-mono text-gn-hud-value text-gn-ink-value">
            {/*
              Both figures name what they count, in full and abbreviated
              form alike (E-05: "if they differ, both labels must name
              what they count"). Articles are articles and clusters are
              clusters — neither is ever presented as a number of events.
            */}
            <span className="xl:hidden">
              {articlesRetrieved} {t.articlesShort}
              {reportingClusterCount !== null && ` · ${reportingClusterCount} ${t.clustersShort}`}
            </span>
            <span className="hidden xl:inline">{retrievalLabel}</span>
          </span>
        )}
      </div>

      {/*
        ── E-05b — EVIDENCE USED ──────────────────────────────────

        R2a. THE DEFECT THIS CELL EXISTS TO CORRECT.

        E-06 used to render `Sources {n}` where n was
        `model.sourceSupport.length`. `buildSourceSupport` ends with
        `response.articles.map(...)` — it maps over EVERY RETRIEVED
        ARTICLE, tagging each `cited` or `not-cited-in-this-analysis`.
        So the figure beside the word "Sources" was the retrieved count,
        sitting one cell away from the retrieval counter showing the same
        number, while implying evidentiary support it did not measure.

        Retrieval and evidence-used are now two separate labelled cells.
        The face text says "used"; the accessible name says what that
        means. Neither says "independent" or "corroborating" — the
        contract for `distinctSourceArticleCount` explicitly forbids both
        readings, and a spec asserts that vocabulary never renders.

        Null is a real state, not a zero: no analysis means there is no
        evidence-used figure to state, and the cell says so rather than
        borrowing the retrieval number.
      */}
      <div
        className={`${CELL} border-r border-gn-line-telemetry`}
        aria-label={
          evidenceUsedCount === null
            ? `${t.evidenceUsedLabel}: ${t.noEvidenceUsed}`
            : t.evidenceUsedAria.replace('{n}', String(evidenceUsedCount))
        }
        role="group"
      >
        <span className="font-gn-mono text-gn-hud-micro uppercase text-gn-hud">
          {t.evidenceUsedLabel}
        </span>
        {evidenceUsedCount === null ? (
          <span
            data-gn="evidence-used-unavailable"
            className="font-gn-mono text-gn-hud-value uppercase text-gn-hud-faint"
          >
            {t.noEvidenceUsed}
          </span>
        ) : (
          <span
            data-gn="evidence-used"
            className="whitespace-nowrap font-gn-mono text-gn-hud-value text-gn-ink-value"
          >
            {pluralWithForms(evidenceUsedCount, language, t.articleForms)}
          </span>
        )}
      </div>

      {/* ── E-06 ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onOpenSources}
        disabled={sourceCount === 0}
        aria-haspopup="dialog"
        aria-expanded={sourcesOpen}
        aria-controls={sourcesPanelId}
        className={`flex min-h-[44px] items-center gap-2 bg-gn-provenance-tint px-4 py-[9px] font-gn-mono text-gn-hud-entry uppercase transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus ${
          sourceCount === 0
            ? 'cursor-not-allowed text-gn-disabled'
            : 'text-gn-ink-strong hover:bg-white/[.12]'
        } ${sourcesOpen ? 'bg-white/[.14]' : ''}`}
      >
        {sourceCount === 0 ? (
          t.noSources
        ) : (
          <>
            {/* An ACTION, not a measurement. The count that used to sit
                here is now E-05b, where it is the right number under the
                right label. */}
            <span data-gn="sources-action">{t.sourcesLabel}</span>
            <span className="sr-only">{t.openSourcesPanel}</span>
          </>
        )}
      </button>
    </div>
  );
}
