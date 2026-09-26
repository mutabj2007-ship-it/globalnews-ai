'use client';

import { comparisonCoverageLines, resolveEvidenceState } from '@globalnews-ai/shared';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { AnalysisModeBadge } from '@/components/search/AnalysisModeBadge';
import { EvidenceFreshnessNotice } from '@/components/search/EvidenceFreshnessNotice';
import {
  ABSENT_BRIEF,
  buildBriefModel,
  buildBriefTelemetry,
  splitSynthesisParagraphs,
} from '@/components/analysis-frame/briefModel';
import { fullAnalysisHref } from '@/lib/ask/storyContextStore';
import { grantAnalysisConsent } from '@/lib/analysis/analysisComputeConsent';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ═══ ASK AI REV A §6 — THE COMPACT RESULT ════════════════════════════════
 *
 * A PROJECTION OF ONE RESPONSE. Everything below is read from the single
 * `AnalysisApiResponse` that `analyzeNews` already returned. There is no
 * second call, no second engine, no second evidence contract, and nothing
 * is generated here (§6.1).
 *
 * THE FOUR PERMITTED ELEMENTS, EACH THROUGH ITS EXISTING READER (§6.2):
 *   execution state  -> `AnalysisModeBadge`, reused, not reimplemented, so
 *                       not-attempted / validation-rejected / failed / demo
 *                       stay ONE vocabulary across both surfaces;
 *   compact answer   -> `buildBriefModel`, the same pure reader Surface B
 *                       uses. Reusing it is what makes this surface
 *                       INCAPABLE of inventing a different reading of the
 *                       same response;
 *   source list      -> `response.analysis.sources` rendered directly. NOT
 *                       rebuilt from `articles` or `sourceEntities`, which
 *                       would be a parallel list nothing validated;
 *   telemetry        -> `buildBriefTelemetry`, as figures.
 *
 * WHAT IS NOT DONE HERE, STATED SO IT CANNOT DRIFT BACK IN: no dimension
 * concatenation (joining `keyFacts` / `agreements` / `differences` into
 * prose composes a NEW claim), no re-ranking, no re-clustering, no
 * re-fetching, and no truncation that changes meaning.
 */

/**
 * §6.4 — the dock is a compact surface, so the list is bounded BY COUNT
 * and the bound is DECLARED. Sources are never dropped silently; the
 * remainder is reachable through §4.5's transition.
 */
export const COMPACT_SOURCE_LIMIT = 4;

interface AskCompactResultProps {
  readonly response: AnalysisApiResponse;
  readonly question: string;
  readonly language?: LanguageCode;
  /**
   * The context the question was ASKED with — not a fresh read of the
   * store. The transition must reproduce the request that produced this
   * response, and by the time a reader presses it the live context may
   * already be something else.
   */
  readonly context: StoryContext | undefined;
}

export function AskCompactResult({
  response,
  question,
  language = 'en',
  context,
}: AskCompactResultProps): JSX.Element {
  const dictionary = getDictionary(language);
  const t = dictionary.askAi;

  /*
   * FAIL CLOSED. `buildBriefModel` is called only when an analysis is
   * actually present; otherwise the model is `ABSENT_BRIEF`, its own
   * fail-closed default. No branch here fabricates a model.
   */
  const analysis = response.analysis ?? null;
  const brief = analysis === null ? ABSENT_BRIEF : buildBriefModel(response);

  /*
   * §6.2 — `unresolvedCount` is NOT KNOWN on this surface. The frame
   * derives it from its own geographic state, which the dock does not
   * mount. `null` is the truthful argument; inventing a figure to fill
   * the parameter would be a fabricated measurement.
   */
  const telemetry = buildBriefTelemetry(response, null);

  const sources = analysis?.sources ?? [];
  const shown = sources.slice(0, COMPACT_SOURCE_LIMIT);
  const truncated = sources.length > shown.length;

  /*
   * §6.3 ROW 4 — not-attempted / provider-failed / validation-rejected.
   * The badge states it; there is NO answer body and NO source list,
   * because a list here would imply evidence that was never retrieved.
   */
  const hasAnalysis = analysis !== null;

  /*
   * §6.3 ROWS 2 AND 3 — THE DISTINCTION THAT MUST NOT BE FLATTENED.
   * `briefWithheld` is an ASSESSED REFUSAL: a brief existed, was measured
   * non-compliant, the one permitted repair failed, and the backend did
   * not transmit the prose. An empty paragraph with `briefWithheld: false`
   * is an ABSENCE NOBODY MEASURED. They read differently because they are
   * different facts, and `briefModel.ts` already separates them.
   */
  const paragraphs = brief.paragraph.length > 0 ? splitSynthesisParagraphs(brief.paragraph) : [];
  const briefAccepted = !brief.briefWithheld && paragraphs.length > 0;
  const briefAbsent = hasAnalysis && !brief.briefWithheld && paragraphs.length === 0;

  /* ASK/SEARCH R1 — the backend's own outcome, when stamped, decides failure
     vs absence before dataMode is consulted. */
  const retrievalUnavailable =
    (response.retrievalContext.evidenceState ??
      resolveEvidenceState(response.retrievalContext, response.articles.length)) === 'degraded-fallback';
  const noAnswerMessage = retrievalUnavailable
    ? t.resultNoAnswerProvider
    : t.resultNoAnswerEvidence;
  const canOpenFullAnalysis = hasAnalysis || response.articles.length > 0;

  return (
    <div data-ask="compact-result" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <AnalysisModeBadge provenance={response.provenance} language={language} />
        <EvidenceFreshnessNotice retrievalContext={response.retrievalContext} language={language} />
        {telemetry.retrievedArticleCount === null && telemetry.reportingClusterCount === null ? null : (
          <span data-ask="telemetry" className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            {telemetry.retrievedArticleCount === null
              ? null
              : `${telemetry.retrievedArticleCount} ${t.telemetryReports}`}
            {telemetry.retrievedArticleCount !== null && telemetry.reportingClusterCount !== null ? ' · ' : null}
            {telemetry.reportingClusterCount === null
              ? null
              : `${telemetry.reportingClusterCount} ${t.telemetryClusters}`}
          </span>
        )}
      </div>

      {response.retrievalContext.comparisonCoverage?.length ? (
        <section
          data-ask="coverage-checked"
          className="min-w-0 rounded-xl border border-border-strong px-3 py-2"
        >
          <p className="text-xs font-medium text-ink-primary">
            {language === 'pl' ? 'Sprawdzone pokrycie' : 'Coverage checked'}
          </p>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-secondary">
            {comparisonCoverageLines(response.retrievalContext.comparisonCoverage, language).map(
              (line, index) => (
                <li key={response.retrievalContext.comparisonCoverage?.[index].iso3}>{line}</li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      {analysis?.relationalComposition ? (
        <div data-ask="relational-answer" className="rounded-2xl border border-signal/35 bg-signal/10 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-signal">
            {dictionary.analysisFrame.relationalAnswer}
          </p>
          <p className="text-sm leading-relaxed text-ink-primary">
            {analysis.relationalComposition.summary}
          </p>
        </div>
      ) : null}

      {!hasAnalysis ? (
        <div data-ask="no-answer" className="border-s-2 border-border-strong ps-3 pe-1 py-1">
          <p className="text-sm font-medium leading-relaxed text-ink-primary">
            {noAnswerMessage}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
            {t.resultNoAnswerSafety}
          </p>
        </div>
      ) : (
        <>
          {brief.briefWithheld ? (
            /*
              THE WITHHELD NOTICE **AND** THE REASON, VERBATIM (§6.3 row 2).
              Never a substitute summary, never silence. The heading and
              body are `analysisResultView`'s own accepted words, so this
              state cannot be described differently here than on Surface B.
            */
            <div data-ask="brief-withheld" className="flex flex-col gap-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                {dictionary.analysisResultView.briefWithheldHeading}
              </p>
              <p className="text-sm text-ink-secondary">{dictionary.analysisResultView.briefWithheldBody}</p>
              {brief.briefWithheldReason === null ? null : (
                <p data-ask="brief-withheld-reason" className="text-sm text-ink-secondary">
                  {brief.briefWithheldReason}
                </p>
              )}
            </div>
          ) : null}

          {briefAbsent ? (
            <p data-ask="brief-absent" className="text-sm text-ink-secondary">
              {t.resultBriefAbsent}
            </p>
          ) : null}

          {briefAccepted ? (
            <div data-ask="brief" className="flex flex-col gap-3">
              {paragraphs.map((paragraph, index) => (
                <p
                  key={`${index}-${paragraph.slice(0, 24)}`}
                  data-ask="brief-paragraph"
                  className="text-sm leading-relaxed text-ink-primary"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}

          <div data-ask="sources" className="flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
              {t.resultSourcesHeading}
            </p>
            {shown.length === 0 ? (
              <p data-ask="sources-none" className="text-sm text-ink-tertiary">
                {t.resultSourcesNone}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {shown.map((source) => (
                  <li key={source.articleId} data-ask="source" className="text-sm">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-primary underline decoration-border underline-offset-4 hover:decoration-signal"
                    >
                      {source.title}
                    </a>
                    <span className="ms-2 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                      {source.publisher}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!truncated ? null : (
              /* §6.4 — say SO, and say HOW MANY. */
              <p data-ask="sources-truncated" className="text-xs text-ink-tertiary">
                {t.resultSourcesTruncated
                  .replace('{shown}', String(shown.length))
                  .replace('{total}', String(sources.length))}
              </p>
            )}
          </div>
        </>
      )}

      {/*
        §6.5 — THE TRANSITION, NOT AN EXPANSION.

        A real link, so it survives middle-click, copy-link and reload, and
        so the preserved subject/anchor are visible in the address bar
        rather than hidden in client state. The full workspace is the only
        place full analytical detail is rendered (§2.3).
      */}
      {canOpenFullAnalysis ? (
        <div className="flex flex-col items-start gap-0.5">
        <a
          data-ask="open-full"
          href={fullAnalysisHref(question, context)}
          /*
            ASK/SEARCH R1 — THIS TRANSITION IS THE ACCEPTED DEEPER-COMPUTE
            ACTION. A plain same-tab activation leaves a one-shot grant for
            exactly this href, so /search runs the full analysis once. A
            modified click (new tab/window), a copied link or a reload carries
            no grant and lands on the staged question, at zero requests.
          */
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            grantAnalysisConsent(fullAnalysisHref(question, context));
          }}
          className="self-start rounded-lg px-1 py-0.5 text-sm font-medium text-signal underline decoration-signal/50 underline-offset-4 hover:decoration-signal"
        >
          {/* CTO ruling 2 — the control starts compute, so it says Run. */}
          {t.runFullAnalysis}
        </a>
        <span data-ask="run-full-note" className="px-1 text-xs text-ink-tertiary">
          {t.runFullAnalysisNote}
        </span>
        </div>
      ) : null}
    </div>
  );
}
