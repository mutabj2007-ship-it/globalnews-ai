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

/* ASK R2 CLAUDE DESIGN RECONCILIATION R1 — the D25 BADGE palette, per engine state. */
const TONE_CLASS: Readonly<Record<AskR2View['tone'], string>> = {
  reference: 'border border-[#3a4a5e] bg-[#1a2230] text-[#c3ccd8]',
  verified: 'border border-[#1b6fa8] bg-[#07304f] text-[#8fd3ff]',
  current: 'border border-[#1b6fa8] bg-[#07304f] text-[#8fd3ff]',
  clarification: 'border border-[#2a6d9e] bg-[#0a2a47] text-[#bfe3fb]',
  partial: 'border border-[#6b5a20] bg-[#2a2410] text-[#f3d36b]',
  insufficient: 'border border-[#6b3236] bg-[#2d1618] text-[#f2a5a5]',
  unavailable: 'border border-[#3a4a5e] bg-[#12161c] text-[#c5ccd6]',
};

/* D25 answer surfaces: Reference is dashed and muted, never styled like current evidence. */
const CARD_CLASS: Readonly<Record<AskR2View['tone'], string>> = {
  reference: 'border border-dashed border-[#4a5a6e] bg-[#0e1520] text-[#c3ccd8]',
  verified:
    'border border-[#0e2d4d] bg-[linear-gradient(#082038,#041a30_46%,#02152b)] text-[#e6eef6]',
  current:
    'border border-[#0e2d4d] bg-[linear-gradient(#082038,#041a30_46%,#02152b)] text-[#e6eef6]',
  clarification: 'border border-[#2a6d9e] bg-[linear-gradient(#08263f,#051a2e)] text-[#e6eef6]',
  partial:
    'border border-[#0e2d4d] bg-[linear-gradient(#082038,#041a30_46%,#02152b)] text-[#e6eef6]',
  insufficient: 'border border-[#4a2a2e] bg-[#0b1522] text-[#cfe2f2]',
  unavailable: 'border border-[#3a4a5e] bg-[#12161c] text-[#c5ccd6]',
};

const EYEBROW =
  'font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-[#6f89a8]';
const TURN = 'mb-6 flex flex-col';
/* D25 qFs: 21 phone · 26 desktop · 30 at 1920. */
const QUESTION =
  'mb-3 mt-2.5 text-[21px] font-bold leading-[1.2] tracking-[-0.015em] text-white md:text-[26px] min-[1900px]:text-[30px]';
const CARD = 'rounded-[12px] p-3.5 md:p-5';

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
      <article data-ask-turn data-ask="turn" data-ask-state="unavail" className={TURN}>
        <p className={EYEBROW}>{s.youAsked}</p>
        <h2 className={QUESTION}>{turn.question}</h2>
        <p
          role="alert"
          data-ask="unavailable"
          className={`rounded-[12px] p-3.5 text-[15px] leading-[1.55] md:p-5 ${CARD_CLASS.unavailable}`}
        >
          {s.unavailable}
        </p>
      </article>
    );
  }

  const view = askR2View(payload, s, locale, (iso3) => localisedCountryName(iso3, locale) ?? iso3);
  const operationId = turn.operation?.operationId;

  return (
    <article data-ask-turn data-ask="turn" data-ask-state={view.badge} className={TURN}>
      <p className={EYEBROW}>{s.youAsked}</p>
      <h2 className={QUESTION}>{turn.question}</h2>

      <div data-ask="scope" className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="me-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f89a8]">
          {s.scope}
        </span>
        {view.chips.items.map((chip, i) => (
          <span
            key={`${chip.kind}-${i}`}
            data-ask-chip={chip.kind}
            data-ask-chip-kept={chip.kept ? 'true' : undefined}
            className={`inline-flex h-7 items-center whitespace-nowrap rounded-[14px] border bg-[#06223d] px-2.5 text-[13px] font-semibold text-[#cfe2f2] ${chip.kept ? 'border-dashed border-[#c98a8a]/60' : 'border-[#1d4a73]'}`}
          >
            {chip.label}
          </span>
        ))}
        {view.chips.note !== null && (
          <span className="text-[13px] italic text-[#8fa6c0]">{view.chips.note}</span>
        )}
      </div>

      <div data-ask="engine-state" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span
          data-ask-badge={view.badge}
          className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-[6px] px-2.5 font-mono text-[11px] font-bold tracking-[0.08em] ${TONE_CLASS[view.tone]}`}
        >
          {view.badgeText}
        </span>
        <span data-ask="freshness" className="font-mono text-[12px] leading-[1.3] text-[#8299b4]">
          {view.freshness}
        </span>
        {turn.expired === true && (
          <span data-ask="expired" className="font-mono text-[12px] text-[#8299b4]">
            {s.expiredNote}
          </span>
        )}
      </div>

      {view.badge === 'clar' ? (
        <section
          data-ask="clarification"
          className={`flex flex-col gap-3 ${CARD} ${CARD_CLASS.clarification}`}
        >
          {view.clarification.candidates.length > 0 ? (
            <>
              <p className="text-[19px] font-bold leading-[1.2] md:text-[22px]">{s.whichOne}</p>
              <ul data-ask="clarification-candidates" className="flex flex-col gap-2">
                {view.clarification.candidates.map((name) => (
                  <li
                    key={name}
                    className="flex min-h-[48px] items-center rounded-[10px] border border-[#1d4a73] bg-[#06223d] px-3.5 text-[15px] font-semibold"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </>
          ) : view.clarification.lead !== null ? (
            <p data-ask="clarification-lead" className="text-[16px] leading-[1.55]">
              {view.clarification.lead}
            </p>
          ) : (
            <p className="text-[16px] leading-[1.55]">{s.freshness.nothingRan}</p>
          )}
          <p className="font-mono text-[12px] text-[#6f89a8]">
            {view.clarification.byExecutor ? s.clarificationFooterNoAi : s.clarificationFooter}
          </p>
          {/* At ≥1280 the Sources column states this instead; never both (CTO ruling). */}
          <p data-ask="sources-after-choice" className="font-mono text-[12px] text-[#6f89a8]">
            {s.sourcesAfterChoice}
          </p>
        </section>
      ) : view.badge === 'unavail' ? (
        <p
          role="alert"
          data-ask="unavailable"
          data-ask-basis={payload.answer.basis}
          className={`text-[15px] leading-[1.55] ${CARD} ${CARD_CLASS.unavailable}`}
        >
          {view.unavailableText}
        </p>
      ) : (
        <section
          data-ask="answer"
          className={`flex flex-col gap-3.5 ${CARD} ${CARD_CLASS[view.tone]}`}
        >
          <p className={EYEBROW}>{s.answer}</p>
          {view.badge === 'ref' && !view.citable && (
            <div
              data-ask="reference-note"
              className="rounded-[8px] border border-dashed border-[#4a5a6e] bg-[#121a26] px-3 py-2.5 text-[13px] leading-[1.45] text-[#a9b6c6]"
            >
              <p className="font-bold text-[#d3dbe5]">{s.referenceNoteTitle}</p>
              <p>{s.referenceNoteBody}</p>
            </div>
          )}
          {view.badge === 'insuf' && (
            <p className="text-[19px] font-bold leading-[1.2] md:text-[22px]">
              {s.insufficientTitle}
            </p>
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
            <p data-ask="no-citable" className="font-mono text-[12px] text-[#8fa6c0]">
              {s.noCitable}
            </p>
          )}
        </section>
      )}

      {((view.handoffs.openFull && !displayOnly) ||
        (view.handoffs.runDeeper && onRunDeeper !== undefined)) &&
        operationId !== undefined && (
          <div data-ask="handoffs" className="mt-4 flex flex-wrap gap-2.5">
            {view.handoffs.openFull && !displayOnly && (
              <a
                data-ask="open-full-analysis"
                href={openFullAnalysisHref(operationId)}
                className="flex min-h-[56px] flex-[1_1_220px] flex-col justify-center gap-1 rounded-[12px] border border-[#1b6fa8] px-4 py-2.5 hover:bg-[#07304f]"
              >
                <span className="text-[15px] font-bold leading-[1.1] text-[#cfe2f2]">
                  {s.openFull}
                </span>
                <span className="font-mono text-[11px] leading-[1.2] text-[#8299b4]">
                  {s.openFullMeta}
                </span>
              </a>
            )}
            {view.handoffs.runDeeper && onRunDeeper !== undefined && (
              <button
                type="button"
                data-ask="run-deeper"
                onClick={() => onRunDeeper(turn.question)}
                className="flex min-h-[56px] flex-[1_1_220px] flex-col justify-center gap-1 rounded-[12px] border-2 border-[#6a5634] bg-[#2e2618] px-4 py-2.5 text-left hover:bg-[#3a3020]"
              >
                <span className="text-[15px] font-bold leading-[1.1] text-[#D9B98A]">
                  {s.runDeep}
                </span>
                <span className="font-mono text-[11px] leading-[1.2] text-[#c9b48c]">
                  {s.runDeepMeta}
                </span>
              </button>
            )}
          </div>
        )}
    </article>
  );
}
