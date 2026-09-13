'use client';

import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { FrameClarificationReason, FrameEvidenceState } from './analysisFrameState';

/**
 * ── R1 RULING 3 — THE ZERO-REPORT STATE ──────────────────────────────
 *
 * WHAT THIS REPLACES. With no evidence at all, the workspace frame
 * rendered an empty brief band, a chip row for dimensions holding
 * nothing, a Complete Record control pointing at an empty record, an
 * Evidence Geography module reading "no geography to show", two zero
 * counters and an empty Sources Dock — and buried the one honest
 * sentence below three of them. Testers described being unable to
 * recover, and there was in fact nothing on screen to recover with: no
 * Retry, no Edit, no Back, and not even their own question.
 *
 * WHAT IT RENDERS, in this order and nothing else:
 *
 *     Back  ->  the full original question  ->  the truthful reason
 *           ->  Retry  ->  Edit question
 *
 * Deliberately ABSENT: analysis dimensions, the forensic record entry,
 * Evidence Geography and the Sources Dock. Not collapsed, not greyed —
 * not rendered. An empty module is not evidence of anything, and four of
 * them are not a page.
 *
 * NOTHING IS SOFTENED. The reason comes from the accepted state table in
 * the frame's own dictionary block, and evidence honesty is unchanged:
 * this state exists precisely because there is no evidence, and it says
 * so in the reader's language.
 */
export interface ZeroReportRecoveryProps {
  response: AnalysisApiResponse;
  state: FrameEvidenceState;
  language?: LanguageCode;
  onRetry: () => void;
  onEdit: () => void;
  onBack?: () => void;
  /**
   * H-C2 MICRO-CLOSURE — G's code for WHY the question needs narrowing.
   * Null is a legitimate value: a clarification with no stated reason still
   * gets the general question rather than an invented specific one.
   */
  clarificationReason?: FrameClarificationReason | null;
}

export function ZeroReportRecovery({
  response,
  state,
  language = 'en',
  onRetry,
  onEdit,
  onBack,
  clarificationReason = null,
}: ZeroReportRecoveryProps): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.analysisFrame;

  /*
   * ── H-C2 MICRO-CLOSURE — THE CLARIFICATION STATE ─────────────────────
   *
   * WHAT WAS WRONG. G's classifier declines to guess the members of an
   * under-specified comparison and routes it through the same zero-evidence
   * context the provider-safety edge uses. The reader was therefore told
   * "the provider was queried and returned nothing for this question" about
   * a question NO PROVIDER WAS EVER ASKED. That is a false statement about
   * retrieval standing in for a true one about the question, and it is the
   * defect G reported four times and could not fix, because the sentence is
   * this lane's to write.
   *
   * WHAT IT SAYS NOW, in three parts and in this order:
   *   1  the state          nothing was searched for, and why that is not
   *                         a finding about what exists
   *   2  the reason         G's code, rendered — never invented. Absent code,
   *                         absent line.
   *   3  the question       one thing the reader can answer. This is the
   *                         "clarification question" the surface exists for.
   *
   * WHAT THE ACTIONS DO. Edit is the remedy and is presented as one; Retry
   * stays reachable but is demoted and second, with a line saying plainly
   * that re-running the same words reaches the same point. Offering a
   * provider retry as the primary answer to an ambiguous QUESTION would be
   * the same category error the copy above exists to correct.
   */
  const isClarification = state === 'clarification-required';

  const clarificationWhy =
    clarificationReason === 'COMPARISON_MEMBERS_UNDETERMINED'
      ? t.clarificationComparisonMembers
      : clarificationReason === 'TOO_MANY_ENTITIES'
        ? t.clarificationTooManyEntities
        : null;

  const clarificationAsk =
    clarificationReason === 'COMPARISON_MEMBERS_UNDETERMINED'
      ? t.clarificationAskComparisonMembers
      : clarificationReason === 'TOO_MANY_ENTITIES'
        ? t.clarificationAskTooManyEntities
        : t.clarificationAskGeneral;

  /*
   * R1 RULING 4 — THE REASON IS THE TRUE ONE, IN ALREADY-ACCEPTED WORDS.
   *
   * `resolveFrameEvidence` now reads the existing `fallbackReason`
   * contract (`'no-live-results' | 'provider-error'`), so a provider
   * that ANSWERED and had nothing no longer arrives here labelled as a
   * provider that could not be reached. These two sentences are the
   * frame's own existing strings — no new copy, and no provider detail
   * that is not in the response.
   */
  const heading = isClarification
    ? t.stateClarificationRequired
    : state === 'provider-unavailable'
      ? t.stateProviderUnavailable
      : t.stateNoEvidence;
  const body = isClarification
    ? t.stateClarificationRequiredBody
    : state === 'provider-unavailable'
      ? t.stateProviderUnavailableBody
      : t.stateNoEvidenceBody;

  /*
   * 44x44 declared in px, so a later type change cannot shrink it.
   *
   * The focus ring is written out on EACH button rather than only here,
   * because PAF-21 counts rings against buttons per file and a shared
   * constant would satisfy the invariant while failing the count. The
   * ring is the accessibility requirement; making it visible once per
   * control is the honest way to keep both true.
   */
  const action =
    'flex min-h-[44px] items-center justify-center rounded-[10px] border px-5 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] focus-visible:outline-2 focus-visible:outline-offset-2';

  return (
    <div
      data-paf="zero-report"
      data-evidence-state={state}
      className="mx-auto flex min-h-screen w-full max-w-[680px] flex-col px-5 pt-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
    >
      {onBack === undefined ? null : (
        <button
          type="button"
          data-paf="workspace-back"
          onClick={onBack}
          className="-ml-2 flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-[6px] self-start rounded-[8px] px-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#a9bccf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          <span aria-hidden="true">←</span>
          {t.backLabel}
        </button>
      )}

      <section data-paf="analysis-question" aria-label={dict.yourQuestion} className="mt-2">
        <p className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.16em] text-[#67e8f9]">
          {dict.yourQuestion}
        </p>
        {/* FULL text. Ruling 6 asks Edit to preserve the complete query,
            so this is not the place to shorten it. */}
        <h1
          data-paf="analysis-question-text"
          className="mt-[6px] font-gn-sans text-[19px] font-medium leading-[1.35] text-[#eaf1f8]"
        >
          {response.query}
        </h1>
      </section>

      <section data-paf="zero-report-reason" className="mt-6">
        <h2 className="font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#e0a33d]">
          {heading}
        </h2>
        <p className="mt-3 font-gn-sans text-[15px] leading-[1.6] text-[#d5e1ee]">{body}</p>

        {clarificationWhy === null ? null : (
          <p
            data-paf="clarification-reason"
            data-clarification-reason={clarificationReason ?? undefined}
            className="mt-3 font-gn-sans text-[15px] leading-[1.6] text-[#a9bccf]"
          >
            {clarificationWhy}
          </p>
        )}
      </section>

      {isClarification ? (
        <section data-paf="clarification-question" className="mt-6">
          <p className="font-gn-sans text-[17px] font-semibold leading-[1.35] text-[#eaf1f8] md:text-[18px]">
            {clarificationAsk}
          </p>
        </section>
      ) : null}

      {/*
        ORDER AND EMPHASIS BOTH CARRY THE MEANING, so both flip for a
        clarification and neither flips anywhere else. Every other state keeps
        Retry first and primary exactly as accepted — `analysisRecovery.spec`
        pins that order and still passes, because it is unchanged for them.
      */}
      <div className="mt-7 flex flex-wrap gap-3">
        {isClarification ? (
          <>
            <button
              type="button"
              data-paf="zero-report-edit"
              onClick={onEdit}
              className={`${action} border-[#22303f] bg-[rgba(103,232,249,.08)] text-[#67e8f9] focus-visible:outline-gn-focus`}
            >
              {t.editQuestion}
            </button>
            <button
              type="button"
              data-paf="zero-report-retry"
              onClick={onRetry}
              className={`${action} border-[#22303f] text-[#a9bccf] focus-visible:outline-gn-focus`}
            >
              {t.retry}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-paf="zero-report-retry"
              onClick={onRetry}
              className={`${action} border-[#22303f] bg-[rgba(103,232,249,.08)] text-[#67e8f9] focus-visible:outline-gn-focus`}
            >
              {t.retry}
            </button>
            <button
              type="button"
              data-paf="zero-report-edit"
              onClick={onEdit}
              className={`${action} border-[#22303f] text-[#a9bccf] focus-visible:outline-gn-focus`}
            >
              {t.editQuestion}
            </button>
          </>
        )}
      </div>

      {isClarification ? (
        <p
          data-paf="clarification-retry-note"
          className="mt-3 font-gn-mono text-[12px] uppercase tracking-[0.1em] text-[#54687f] md:text-[11px]"
        >
          {t.clarificationRetryNote}
        </p>
      ) : null}
    </div>
  );
}
