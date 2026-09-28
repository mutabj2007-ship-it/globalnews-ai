'use client';

import type { StoryContext } from '@globalnews-ai/shared';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { askR2Strings, type AskR2Locale } from '@/lib/ask/askR2Strings';
import { askR2View, type AskR2View } from '@/lib/ask/askR2View';
import { openFullAnalysisHref, type AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { localisedCountryName } from '@/lib/map/geography/displayName';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE G — ONE ASK R2 TURN, AS D25 DRAWS IT.
 *
 * Everything decided is decided by `askR2View` (pure, tested); this only draws it. The
 * surface follows D25 06: Reference background is a dashed, muted card with its "Model
 * background · no citations" note and no handoff; the current states are solid cards with
 * their freshness line, sources and — for 2, 3, 5 — the two handoffs:
 *
 *   Open full analysis   a real link to a DISPLAY-ONLY read of this operation (0 AI)
 *   Run deeper analysis  asks the server for a quote; nothing runs until confirmed
 *
 * The analysis body reuses the landed `AskCompactResult` with its own "run full analysis"
 * transition turned OFF — on an R2 turn that transition would start new compute, which is
 * exactly what D25's "Open full analysis" must not do.
 */

const TONE_CLASS: Readonly<Record<AskR2View['tone'], string>> = {
  reference: 'border border-dashed border-[#b4c0cf]/60 bg-transparent text-[#b4c0cf]',
  verified: 'border border-[#7cc4f7]/70 bg-[#0d2238] text-[#e8eef8]',
  current: 'border border-[#d5e4f2]/40 bg-[#0f1b29] text-[#e8eef8]',
  clarification: 'border border-[#e9c46a]/60 bg-[#221c0c] text-[#f3e6c4]',
  partial: 'border border-[#8fb3d9]/50 bg-[#0f1b29] text-[#e8eef8]',
  insufficient: 'border border-[#c98a8a]/50 bg-[#1f1214] text-[#f1dada]',
  unavailable: 'border border-[#8a96a6]/50 bg-[#12161c] text-[#c5ccd6]',
};

export function AskR2TurnView({
  turn,
  locale,
  context,
  onRunDeeper,
  displayOnly = false,
}: {
  readonly turn: AskR2Turn;
  readonly locale: AskR2Locale;
  readonly context: StoryContext | undefined;
  readonly onRunDeeper?: (question: string) => void;
  /** The Open-full-analysis target itself: no link back to the page it is on. */
  readonly displayOnly?: boolean;
}): JSX.Element {
  const s = askR2Strings(locale);
  const payload = turn.payload ?? null;

  if (payload === null) {
    return (
      <article
        data-ask-turn
        data-ask="turn"
        data-ask-state="unavail"
        className="mb-5 border-b border-sp-line pb-4"
      >
        <p className="text-[11px] uppercase tracking-[0.08em] text-sp-ink-3">{s.youAsked}</p>
        <h2 className="mb-3 text-[15px] font-semibold leading-[1.45]">{turn.question}</h2>
        <p role="alert" data-ask="unavailable" className="text-[15px] leading-[1.55]">
          {s.unavailable}
        </p>
      </article>
    );
  }

  const view = askR2View(payload, s, locale, (iso3) => localisedCountryName(iso3, locale) ?? iso3);
  const operationId = turn.operation?.operationId;

  return (
    <article
      data-ask-turn
      data-ask="turn"
      data-ask-state={view.badge}
      className="mb-5 border-b border-sp-line pb-4"
    >
      <p className="text-[11px] uppercase tracking-[0.08em] text-sp-ink-3">{s.youAsked}</p>
      <h2 className="mb-2 text-[15px] font-semibold leading-[1.45]">{turn.question}</h2>

      <div data-ask="engine-state" className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          data-ask-badge={view.badge}
          className={`inline-flex min-h-[24px] items-center rounded px-2 text-[11px] font-semibold tracking-[0.06em] ${TONE_CLASS[view.tone]}`}
        >
          {view.badgeText}
        </span>
        <span data-ask="freshness" className="text-[12px] text-sp-ink-2">
          {view.freshness}
        </span>
        {turn.expired === true && (
          <span data-ask="expired" className="text-[12px] text-sp-ink-2">
            {s.expiredNote}
          </span>
        )}
      </div>

      <div data-ask="scope" className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="text-[11px] uppercase tracking-[0.08em] text-sp-ink-3">{s.scope}</span>
        {view.chips.items.map((chip, i) => (
          <span
            key={`${chip.kind}-${i}`}
            data-ask-chip={chip.kind}
            data-ask-chip-kept={chip.kept ? 'true' : undefined}
            className={`rounded-full border px-2 py-0.5 ${chip.kept ? 'border-dashed border-[#c98a8a]/60' : 'border-sp-line'}`}
          >
            {chip.label}
          </span>
        ))}
        {view.chips.note !== null && <span className="text-sp-ink-2">{view.chips.note}</span>}
      </div>

      {view.badge === 'clar' ? (
        <section data-ask="clarification" className={`rounded p-3 ${TONE_CLASS.clarification}`}>
          {view.clarification.candidates.length > 0 ? (
            <>
              <p className="text-[15px] leading-[1.55]">{s.whichOne}</p>
              <ul data-ask="clarification-candidates" className="mt-2 flex flex-wrap gap-2">
                {view.clarification.candidates.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-[#e9c46a]/60 px-2 py-0.5 text-[13px]"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </>
          ) : view.clarification.lead !== null ? (
            <p data-ask="clarification-lead" className="text-[15px] leading-[1.55]">
              {view.clarification.lead}
            </p>
          ) : (
            <p className="text-[15px] leading-[1.55]">{s.freshness.nothingRan}</p>
          )}
          <p className="mt-2 text-[12px]">
            {view.clarification.byExecutor ? s.clarificationFooterNoAi : s.clarificationFooter}
          </p>
          <p className="mt-1 text-[12px]">{s.sourcesAfterChoice}</p>
        </section>
      ) : view.badge === 'unavail' ? (
        <p
          role="alert"
          data-ask="unavailable"
          data-ask-basis={payload.answer.basis}
          className={`rounded p-3 text-[15px] leading-[1.55] ${TONE_CLASS.unavailable}`}
        >
          {view.unavailableText}
        </p>
      ) : (
        <section data-ask="answer" className={`rounded p-3 ${TONE_CLASS[view.tone]}`}>
          {view.badge === 'ref' && !view.citable && (
            <div data-ask="reference-note" className="mb-2 text-[13px] leading-[1.5]">
              <p className="font-semibold">{s.referenceNoteTitle}</p>
              <p>{s.referenceNoteBody}</p>
            </div>
          )}
          {view.badge === 'insuf' && (
            <p className="mb-2 text-[15px] font-semibold leading-[1.45]">{s.insufficientTitle}</p>
          )}
          {payload.analysis !== null && (
            <AskCompactResult
              response={payload.analysis}
              question={turn.question}
              language={locale}
              context={context}
              showFullAnalysisLink={false}
            />
          )}
          {view.badge === 'ref' && view.sourceCount === 0 && (
            <p data-ask="no-citable" className="mt-2 text-[12px]">
              {s.noCitable}
            </p>
          )}
        </section>
      )}

      {((view.handoffs.openFull && !displayOnly) ||
        (view.handoffs.runDeeper && onRunDeeper !== undefined)) &&
        operationId !== undefined && (
          <div data-ask="handoffs" className="mt-3 flex flex-wrap gap-3">
            {view.handoffs.openFull && !displayOnly && (
              <a
                data-ask="open-full-analysis"
                href={openFullAnalysisHref(operationId)}
                className="inline-flex min-h-[44px] flex-col justify-center rounded border border-[#4a9de0] px-3 text-[13px] text-[#93cdf5]"
              >
                <span className="font-semibold">{s.openFull}</span>
                <span className="text-[11px] text-sp-ink-2">{s.openFullMeta}</span>
              </a>
            )}
            {view.handoffs.runDeeper && onRunDeeper !== undefined && (
              <button
                type="button"
                data-ask="run-deeper"
                onClick={() => onRunDeeper(turn.question)}
                className="inline-flex min-h-[44px] flex-col justify-center rounded border-2 border-[#6a5634] bg-[#2e2618] px-3 text-left text-[13px] text-[#D9B98A]"
              >
                <span className="font-semibold">{s.runDeep}</span>
                <span className="text-[11px]">{s.runDeepMeta}</span>
              </button>
            )}
          </div>
        )}
    </article>
  );
}
