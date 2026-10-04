'use client';

import { isolatedAuto, isolatedLtr } from '@/lib/ask/askDirection';
import type { StoryContext } from '@globalnews-ai/shared';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { AskIntelligenceBasis } from './AskIntelligenceBasis';
import { askGovernedConversation } from '@/lib/ask/askGovernedConversation';
import { askR2Strings, type AskR2Locale } from '@/lib/ask/askR2Strings';
import { askR2View, failedTurnCopy, type AskR2View } from '@/lib/ask/askR2View';
import { openFullAnalysisHref, type AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { localisedCountryName } from '@/lib/map/geography/displayName';
import { AskTurnSave } from './AskTurnSave';
import { AskTurnBrief } from './AskTurnBrief';
import { AskTurnCopy } from './AskTurnCopy';
import { AskRecentReporting } from './AskRecentReporting';

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
  retained: 'border border-[#2f5d4a] bg-[#0f2a22] text-[#a8e0c6]',
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
  retained: 'border border-[#1f4a3a] bg-[#0a1c17] text-[#e6eef6]',
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
  onUseQuestion,
  canSave = true,
  storyBookmarks = false,
}: {
  readonly turn: AskR2Turn;
  readonly locale: AskR2Locale;
  readonly context: StoryContext | undefined;
  readonly onRunDeeper?: (question: string) => void;
  /** The Open-full-analysis target itself: no link back to the page it is on. */
  readonly displayOnly?: boolean;
  /**
   * ALPHA VISUAL ACCEPTANCE REPAIR R1 (F) — a clarification's suggested question or choice is
   * placed in the composer as a DRAFT. Nothing is sent until the reader presses Ask.
   */
  readonly onUseQuestion?: (question: string) => void;
  /** ASK GUEST TRIAL R3 — saving is an account feature; a guest turn shows no Save control. */
  readonly canSave?: boolean;
  /**
   * UNIFIED INTELLIGENCE BINDING R2C — the per-source story bookmark of the compact result. Off
   * on the standalone /ask frame (no Saved-stories read in that journey); the platform dock,
   * which always offered it, turns it on so the migration loses no visible capability.
   */
  readonly storyBookmarks?: boolean;
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
          data-ask-failure={turn.failure === 'NETWORK' ? 'network' : undefined}
          className={`rounded-[12px] p-3.5 text-[15px] leading-[1.55] md:p-5 ${CARD_CLASS.unavailable}`}
        >
          {/* LIVE ACCEPTANCE REPAIR R1 (budget) + R3 L-3 (a dropped connection is not an outage) */}
          {failedTurnCopy(turn.failure, s)}
        </p>
      </article>
    );
  }

  const view = askR2View(
    payload,
    s,
    locale,
    (iso3) => localisedCountryName(iso3, locale) ?? iso3,
    turn.question,
  );
  const operationId = turn.operation?.operationId;
  /*
    GOVERNED ANSWER CONVERSATIONAL UX R1 — conversation first, governance second, evidence third.
    A zero-AI governed answer (retained record, or a governed record / official source that
    cannot be shown) leads with a plain-language answer; its governance state becomes restrained
    status and provenance; the evidence stays below. Null for every other turn (unchanged).
  */
  const governed = askGovernedConversation(payload, locale, turn.question);
  /* PUBLIC BETA HARDENING R1A — a deterministic computation's calculation card IS its answer:
     no second, empty Answer container is drawn beneath it. */
  const computedAnswer = view.badge === 'calc' && payload.computation != null;
  /* R3 — which kind of guidance labels this answer (§28 human labels) */
  const guidanceKind = payload.guidance?.kind ?? null;

  return (
    <article data-ask-turn data-ask="turn" data-ask-state={view.badge} className={TURN}>
      <p className={EYEBROW}>{s.youAsked}</p>
      <h2 className={QUESTION}>{turn.question}</h2>
      {/* CTO checkpoint 5 §5 — "And in Kenya?" answered as the earlier question for Kenya: said, never hidden. */}
      {payload.continuation != null && (
        <p data-ask="continuation" className="-mt-1 mb-3 text-[13px] leading-[1.5] text-[#9fb4cc]">
          {s.continuationAnsweredAs}: “{payload.continuation.answeredAs}” ·{' '}
          {payload.continuation.kind === 'JOB_CONTEXT'
            ? s.r3.continuationJobNote
            : s.continuationNote}
        </p>
      )}
      {/* R3 §14 — a relationship question is scoped to BOTH sides, said in plain words */}
      {payload.relationship != null && payload.relationship.countries.length === 2 && (
        <p data-ask="relationship" className="-mt-1 mb-3 text-[13px] leading-[1.5] text-[#9fb4cc]">
          {s.r3.relationshipScope(
            localisedCountryName(payload.relationship.countries[0], locale) ??
              payload.relationship.countries[0],
            localisedCountryName(payload.relationship.countries[1], locale) ??
              payload.relationship.countries[1],
            payload.relationship.relations
              .map((r) => s.r3.relations[r])
              .filter((r): r is string => r !== undefined),
          )}
        </p>
      )}

      <div data-ask="scope" className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="me-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f89a8]">
          {s.scope}
        </span>
        {view.chips.items.map((chip, i) => (
          <span
            key={`${chip.kind}-${i}`}
            data-ask-chip={chip.kind}
            data-ask-chip-kept={chip.kept ? 'true' : undefined}
            /* R4 · a chip is a self-contained run: a publisher name, a domain or the
               reader's own words. Isolated so its boundaries cannot reorder the row — a
               DOMAIN chip beside an Arabic TOPIC chip is the case this exists for. */
            {...isolatedAuto()}
            className={`inline-flex h-7 items-center whitespace-nowrap rounded-[14px] border bg-[#06223d] px-2.5 text-[13px] font-semibold text-[#cfe2f2] ${chip.kept ? 'border-dashed border-[#c98a8a]/60' : 'border-[#1d4a73]'}`}
          >
            {chip.label}
          </span>
        ))}
        {view.chips.note !== null && (
          <span className="text-[13px] italic text-[#8fa6c0]" {...isolatedAuto()}>
            {view.chips.note}
          </span>
        )}
      </div>

      <div data-ask="engine-state" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {governed !== null ? (
          /* Restrained: the machine state is metadata, never the headline of the answer. */
          <span
            data-ask-badge={view.badge}
            data-ask-badge-restrained="true"
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6f89a8]"
          >
            {view.badgeText}
          </span>
        ) : (
          <>
            <span
              data-ask-badge={view.badge}
              className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-[6px] px-2.5 font-mono text-[11px] font-bold tracking-[0.08em] ${TONE_CLASS[view.tone]}`}
            >
              {view.badgeText}
            </span>
            <span
              data-ask="freshness"
              className="font-mono text-[12px] leading-[1.3] text-[#8299b4]"
            >
              {view.freshness}
            </span>
          </>
        )}
        {turn.expired === true && (
          <span data-ask="expired" className="font-mono text-[12px] text-[#8299b4]">
            {s.expiredNote}
          </span>
        )}
        {/* STANDALONE PUBLIC BETA CONVERGENCE R1 — the reader's Save / Saved (0 AI). */}
        {canSave && <AskTurnSave operation={turn.operation} locale={locale} />}
        {/* R2 · D1 — Save as briefing (signed-in, produced answers, only when the server has briefings on). */}
        {canSave && <AskTurnBrief operation={turn.operation} locale={locale} />}
        {/* TRUST R1 — copy this answer (local clipboard only; nothing is shared or sent). */}
        <AskTurnCopy locale={locale} />
      </div>

      {/* ASK TECHNICAL / SCIENTIFIC REASONING R1 — the server's deterministic computation. */}
      {payload.computation != null && (
        <section
          data-ask="computation"
          className={`flex flex-col gap-2 ${CARD} ${CARD_CLASS.current}`}
        >
          <p className={EYEBROW}>{s.answer}</p>
          <p data-ask="computation-result" className="text-[18px] font-bold leading-[1.4]">
            {payload.computation.result.name}: {payload.computation.result.value}{' '}
            {payload.computation.result.unit}
          </p>
          <ul data-ask="computation-inputs" className="flex flex-col gap-0.5">
            {payload.computation.inputs.map((input) => (
              <li key={input.name} className="font-mono text-[12px] text-[#8fa6c0]">
                {input.name} = {input.value}
                {input.unit === '' ? '' : ` ${input.unit}`} (“{input.quoted}”)
              </li>
            ))}
          </ul>
          <ol data-ask="computation-steps" className="flex flex-col gap-1">
            {payload.computation.steps.map((step) => (
              <li key={step.label} className="text-[15px] leading-[1.5]">
                {step.label}: <span className="font-mono">{step.expression}</span> ={' '}
                <strong>
                  {step.value} {step.unit}
                </strong>
              </li>
            ))}
          </ol>
          {payload.computation.conventions.map((convention) => (
            <p key={convention} className="text-[13px] text-[#8fa6c0]">
              {convention}
            </p>
          ))}
        </section>
      )}

      {/* ASK TRUTHFUL RETRIEVAL R2A — what was checked; never a denial built on absence. */}
      {view.badge !== 'clar' && view.verification !== null && (
        <section data-ask="verification" className="flex flex-col gap-2">
          {view.verification.notice !== null && (
            <p data-ask="verification-notice" className="text-[15px] leading-[1.5]">
              {view.verification.notice}
            </p>
          )}
          {view.verification.lanes.length > 0 && (
            <div data-ask="sources-checked" className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#8fa6c0]">
                {s.verification.sourcesChecked}
              </span>
              {view.verification.lanes.map((lane) => (
                <span
                  key={`${lane.label}-${lane.status}`}
                  data-ask-lane={lane.ok ? 'ok' : 'unavailable'}
                  className="font-mono text-[12px] text-[#8299b4]"
                >
                  {lane.label} {lane.ok ? '✓' : '—'} {lane.ok ? '' : lane.status}
                </span>
              ))}
            </div>
          )}
          {view.verification.claims.length > 0 && (
            <ul data-ask="claim-states" className="flex flex-col gap-1">
              {view.verification.claims.map((claim) => (
                <li
                  key={claim.text}
                  data-ask-claim-state={claim.state}
                  className="text-[13px] leading-[1.45] text-[#b7c7da]"
                >
                  {claim.text}: <strong>{claim.label}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view.badge === 'clar' ? (
        <section
          data-ask="clarification"
          className={`flex flex-col gap-3 ${CARD} ${CARD_CLASS.clarification}`}
        >
          {view.clarification.candidates.length > 0 ? (
            <>
              <p className="text-[19px] font-bold leading-[1.2] md:text-[22px]">
                {/* R3 §12 — "best for what?" asks its own question above the objectives */}
                {view.clarification.lead ?? s.whichOne}
              </p>
              <ul data-ask="clarification-candidates" className="flex flex-col gap-2">
                {view.clarification.candidates.map((name, i) => {
                  const choice = view.clarification.choices[i];
                  const itemClass =
                    'flex min-h-[48px] w-full items-center rounded-[10px] border border-[#1d4a73] bg-[#06223d] px-3.5 text-start text-[15px] font-semibold';
                  return (
                    <li key={name}>
                      {onUseQuestion !== undefined && choice !== undefined ? (
                        <button
                          type="button"
                          data-ask="clarification-choice"
                          onClick={() => onUseQuestion(choice.question)}
                          className={`${itemClass} hover:border-[rgba(34,211,238,0.55)]`}
                        >
                          {name}
                        </button>
                      ) : (
                        <span className={itemClass}>{name}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {onUseQuestion !== undefined && view.clarification.choices.length > 0 && (
                <p className="text-[13px] text-[#8fa6c0]">{s.clarify.chooseHint}</p>
              )}
            </>
          ) : (
            /* ALPHA VISUAL ACCEPTANCE REPAIR R1 (F) — never a clarification without a question. */
            <>
              <p data-ask="clarification-lead" className="text-[16px] leading-[1.55]">
                {view.clarification.lead ?? s.clarify.fallback}
              </p>
              {view.clarification.suggestion !== null && (
                <div data-ask="clarification-suggestion" className="flex flex-col gap-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#8fa6c0]">
                    {s.clarify.suggestion}
                  </p>
                  <p className="text-[15px] font-semibold leading-[1.45]">
                    {view.clarification.suggestion}
                  </p>
                  {onUseQuestion !== undefined && (
                    <button
                      type="button"
                      data-ask="clarification-use"
                      onClick={() => onUseQuestion(view.clarification.suggestion ?? '')}
                      className="inline-flex min-h-11 w-fit items-center rounded-[9px] border border-[#1d4a73] bg-[#06223d] px-3.5 text-[14px] font-semibold hover:border-[rgba(34,211,238,0.55)]"
                    >
                      {s.clarify.useSuggestion}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <p className="font-mono text-[12px] text-[#6f89a8]">
            {view.clarification.byExecutor ? s.clarificationFooterNoAi : s.clarificationFooter}
          </p>
          {/* At ≥1280 the Sources column states this instead; never both (CTO ruling). */}
          <p data-ask="sources-after-choice" className="font-mono text-[12px] text-[#6f89a8]">
            {s.sourcesAfterChoice}
          </p>
        </section>
      ) : governed !== null ? (
        <section
          data-ask="answer"
          data-ask-governed="true"
          data-ask-basis={payload.answer.basis}
          className={`flex flex-col gap-3 ${CARD} ${CARD_CLASS.current}`}
        >
          <p className={EYEBROW}>{s.answer}</p>
          {/* A governed answer is never blank: the helper always returns at least one paragraph. */}
          {governed.paragraphs.map((line) => (
            <p
              key={line}
              data-ask="governed-answer"
              className="text-[16px] leading-[1.6] md:text-[17px]"
            >
              {line}
            </p>
          ))}
          <p
            data-ask="governed-provenance"
            className="font-mono text-[11.5px] leading-[1.4] text-[#8299b4]"
          >
            {governed.provenance}
          </p>
          {governed.followUps.length > 0 && (
            /* Continuity: a suggestion only becomes a DRAFT in the composer; nothing runs. */
            <div data-ask="governed-follow-ups" className="flex flex-wrap items-center gap-2 pt-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#6f89a8]">
                {s.followUpHint}
              </span>
              {governed.followUps.map((q) =>
                onUseQuestion !== undefined ? (
                  <button
                    key={q}
                    type="button"
                    data-ask="governed-follow-up"
                    onClick={() => onUseQuestion(q)}
                    className="inline-flex min-h-9 items-center rounded-[16px] border border-[#1d4a73] bg-[#06223d] px-3 text-start text-[13.5px] font-semibold text-[#cfe2f2] hover:border-[rgba(34,211,238,0.55)]"
                  >
                    {q}
                  </button>
                ) : (
                  <span
                    key={q}
                    data-ask="governed-follow-up"
                    className="text-[13.5px] text-[#cfe2f2]"
                  >
                    {q}
                  </span>
                ),
              )}
            </div>
          )}
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
      ) : computedAnswer ? null : (
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
              {/* CTO P0 — advice is labelled as general guidance, never as current sourced research */}
              <p className="font-bold text-[#d3dbe5]">
                {guidanceKind === 'DECISION_SUPPORT'
                  ? s.r3.decisionNoteTitle
                  : guidanceKind === 'CONCEPTUAL_ANALYSIS'
                    ? s.r4.conceptualNoteTitle
                    : guidanceKind === 'CONVERSATION_WORK'
                      ? s.r4.workNoteTitle
                      : guidanceKind !== null && guidanceKind !== 'MIXED_REFERENCE_CURRENT'
                        ? s.guidanceNoteTitle
                        : s.referenceNoteTitle}
              </p>
              <p>
                {guidanceKind === 'DECISION_SUPPORT'
                  ? s.r3.decisionNoteBody
                  : guidanceKind === 'CONCEPTUAL_ANALYSIS'
                    ? s.r4.conceptualNoteBody
                    : guidanceKind === 'CONVERSATION_WORK'
                      ? s.r4.workNoteBody
                      : guidanceKind !== null && guidanceKind !== 'MIXED_REFERENCE_CURRENT'
                        ? s.guidanceNoteBody
                        : s.referenceNoteBody}
              </p>
              {payload.guidance?.objective != null && (
                <p data-ask="decision-objective">
                  {s.r3.decisionObjective}: {payload.guidance.objective}
                </p>
              )}
            </div>
          )}
          {payload.guidance != null && payload.guidance.currentEvidenceNeeded.length > 0 && (
            <div
              data-ask="guidance-current-gap"
              data-ask-partial={payload.guidance.currentPart ?? undefined}
              className="rounded-[8px] border border-[#5a4a2a] bg-[#17130c] px-3 py-2.5 text-[13px] leading-[1.45] text-[#c9b27a]"
            >
              <p className="font-bold">
                {payload.guidance.currentPart != null
                  ? s.r3.partialCurrent[payload.guidance.currentPart]
                  : s.guidanceCurrentGap}
              </p>
              <ul className="list-disc ps-5">
                {payload.guidance.currentEvidenceNeeded.map((clause) => (
                  <li key={clause}>{clause}</li>
                ))}
              </ul>
            </div>
          )}
          {view.badge === 'insuf' && (
            <p className="text-[19px] font-bold leading-[1.2] md:text-[22px]">
              {view.searchLimited ? s.limitedTitle : s.insufficientTitle}
            </p>
          )}
          {/* ASK FIRST-ANSWER RETRIEVAL R3 — an answer standing on reachable reporting says so. */}
          {view.badge !== 'insuf' && view.searchLimited && (
            <p data-ask="search-limited" className="text-[13px] leading-[1.45] text-[#c9b27a]">
              {s.limitedNote}
            </p>
          )}
          {payload.analysis !== null && (
            <AskCompactResult
              response={payload.analysis}
              question={turn.question}
              language={locale}
              context={context}
              showFullAnalysisLink={false}
              storyBookmarks={storyBookmarks}
              comparisonTable={payload.comparisonTable ?? null}
            />
          )}
          {/*
           * ASK GENERAL BACKGROUND EXECUTION R1 — plain-text model background (Gate E's
           * REFERENCE_BACKGROUND_ONLY execution). Mutually exclusive with `analysis` above.
           * Reuses the already-accepted `ref` badge/disclosure chrome as-is (D25 authority:
           * badges.ref, referenceNoteTitle/Body, freshness.reference) — no new copy, no new
           * UI surface. Plain prose, never routed through AskCompactResult (which is
           * evidence-citation/sources-specific and would misrepresent this as sourced).
           */}
          {payload.analysis === null && payload.background != null && (
            <p
              data-ask="background-text"
              className="whitespace-pre-wrap text-[16px] leading-[1.55]"
            >
              {payload.background.text}
            </p>
          )}
          {/* TRUST R1 — mixed answer: retained recent reporting about the same place. */}
          {payload.analysis === null && payload.recentReporting != null && (
            <AskRecentReporting reporting={payload.recentReporting} locale={locale} />
          )}
          {view.badge === 'ref' && view.sourceCount === 0 && (
            <p data-ask="no-citable" className="font-mono text-[12px] text-[#8fa6c0]">
              {s.noCitable}
            </p>
          )}
        </section>
      )}

      {/* ASK INTELLIGENCE BINDING R1 — the governed structured basis of this one answer. */}
      <AskIntelligenceBasis
        payload={payload}
        locale={locale}
        reportingSourceCount={view.sourceCount}
        hideNotes={governed !== null}
      />

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
