'use client';
import type { DisplayLocale } from '@globalnews-ai/shared';

import { isolatedAuto, isolatedLtr } from '@/lib/ask/askDirection';
import type { StoryContext } from '@globalnews-ai/shared';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { AskIntelligenceBasis } from './AskIntelligenceBasis';
import { askGovernedConversation } from '@/lib/ask/askGovernedConversation';
import { askR2View, failedTurnCopy, type AskR2View } from '@/lib/ask/askR2View';
import { openFullAnalysisHref, type AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { askCountryName } from '@/lib/ask/askCountryName';
import { AskTurnSave } from './AskTurnSave';
import { AskTurnBrief } from './AskTurnBrief';
import { AskTurnCopy } from './AskTurnCopy';
import { AskRecentReporting } from './AskRecentReporting';
import { AskAnswerProse } from '@/components/ask/AskAnswerProse';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askLocaleForLegacyCatalogue } from '@/lib/ask/askLocale';
import { useAskSourcesPanel } from './AskSourcesPanel';

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
/*
  ASK READING EXPERIENCE R1 — every colour is a `--ask-read-*` role with the accepted dark value
  as its var() fallback (the R4 Phase C consumption rule): a dark scope, and any surface with no
  theme scope, renders exactly the accepted palette; a light scope resolves the reading tokens.
*/
const TONE_CLASS: Readonly<Record<AskR2View['tone'], string>> = {
  reference:
    'border border-[var(--ask-read-rule-reference,#3a4a5e)] bg-[var(--ask-read-sunk,#1a2230)] text-[var(--ask-read-ink2,#c3ccd8)]',
  verified:
    'border border-[var(--ask-read-control-line,#1b6fa8)] bg-[var(--ask-read-sunk,#07304f)] text-[var(--ask-read-control-ink,#8fd3ff)]',
  current:
    'border border-[var(--ask-read-control-line,#1b6fa8)] bg-[var(--ask-read-sunk,#07304f)] text-[var(--ask-read-control-ink,#8fd3ff)]',
  clarification:
    'border border-[var(--ask-read-rule-clarify,#2a6d9e)] bg-[var(--ask-read-sunk,#0a2a47)] text-[var(--ask-read-control-ink,#bfe3fb)]',
  partial:
    'border border-[var(--ask-read-deep-line,#6b5a20)] bg-[var(--ask-read-deep-bg,#2a2410)] text-[var(--ask-read-deep-ink,#f3d36b)]',
  insufficient:
    'border border-[var(--ask-read-rule-insufficient,#6b3236)] bg-[var(--ask-read-sunk,#2d1618)] text-[var(--ask-read-rule-insufficient,#f2a5a5)]',
  unavailable:
    'border border-[var(--ask-read-line,#3a4a5e)] bg-[var(--ask-read-sunk,#12161c)] text-[var(--ask-read-ink2,#c5ccd6)]',
  retained:
    'border border-[var(--ask-read-rule-retained,#2f5d4a)] bg-[var(--ask-read-sunk,#0f2a22)] text-[var(--ask-read-rule-retained,#a8e0c6)]',
};

/* D25 answer surfaces: Reference is dashed and muted, never styled like current evidence. */
const ANSWER_SURFACE =
  'border border-[var(--ask-read-line-soft,#0e2d4d)] [background:var(--ask-read-answer-bg,linear-gradient(#082038,#041a30_46%,#02152b))] text-[var(--ask-read-ink,#e6eef6)]';
const CARD_CLASS: Readonly<Record<AskR2View['tone'], string>> = {
  reference:
    'border border-dashed border-[var(--ask-read-rule-reference,#4a5a6e)] bg-[var(--ask-read-sunk,#0e1520)] text-[var(--ask-read-ink2,#c3ccd8)]',
  verified: ANSWER_SURFACE,
  current: ANSWER_SURFACE,
  clarification:
    'border border-[var(--ask-read-rule-clarify,#2a6d9e)] [background:var(--ask-read-answer-bg,linear-gradient(#08263f,#051a2e))] text-[var(--ask-read-ink,#e6eef6)]',
  partial: ANSWER_SURFACE,
  insufficient:
    'border border-[var(--ask-read-rule-insufficient,#4a2a2e)] bg-[var(--ask-read-sunk,#0b1522)] text-[var(--ask-read-ink,#cfe2f2)]',
  unavailable:
    'border border-[var(--ask-read-line,#3a4a5e)] bg-[var(--ask-read-sunk,#12161c)] text-[var(--ask-read-ink2,#c5ccd6)]',
  retained:
    'border border-[var(--ask-read-rule-retained,#1f4a3a)] bg-[var(--ask-read-sunk,#0a1c17)] text-[var(--ask-read-ink,#e6eef6)]',
};

/* ASK READING EXPERIENCE R1 — a label is reading type, not 11px monospace. */
const EYEBROW =
  'text-[0.75rem] font-semibold leading-none tracking-[0.04em] text-[var(--ask-read-ink3,#6f89a8)]';
/* Secondary text: provenance, notes, metadata. One size, one ink — never mono. */
const META = 'text-[0.8125rem] leading-[1.5] text-[var(--ask-read-ink3,#8299b4)]';
const NOTE = 'text-[0.8125rem] leading-[1.5] text-[var(--ask-read-ink2,#9fb4cc)]';
const CAUTION = 'text-[0.8125rem] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]';
const TURN = 'mb-6 flex flex-col';
/*
  ASK READING EXPERIENCE R1 — THE QUESTION IS A COMPACT BUBBLE, NOT A DISPLAY HEADING.

  It was the D25 question heading at 21 / 26 / 30 px bold, so every turn opened with the
  reader's own words repeated as the largest object on the page, above the answer they came
  for. Design R1 freezes a compact question: 17px, wrapping, at most 85% of the column, at the
  inline END (the reader's side, mirrored in RTL). It keeps its <h2>: the question still names
  the turn for assistive technology, and Copy still reads it from there.
*/
const QUESTION =
  'mb-3 mt-1 ms-auto w-fit max-w-[85%] whitespace-pre-line break-words rounded-[14px] border border-[var(--ask-read-line-soft,#0e2d4d)] bg-[var(--ask-read-sunk,#06223d)] px-4 py-2.5 text-[1.0625rem] font-semibold leading-[1.45] text-[var(--ask-read-ink,#fff)]';
const CARD = 'rounded-[12px] p-3.5 md:p-5';

/*
  R4 · PHASE C — WHICH TONES ARE A BOX AND WHICH ARE THE PAGE.

  `CARD_CLASS` gave every answer a border, a gradient and a 20px pad. The three NORMAL
  answered tones — current, verified, partial — lose the box: they are the answer, and the
  answer is the page. The QUALIFIED tones keep a visible edge, because a reference-background
  or insufficient-evidence answer must never read like a researched one; the stylesheet turns
  that edge into a 3px start-rule, so the distinction survives at a quarter of the weight.

  This is a VISUAL decision only. No tone is merged, no state is renamed, and
  `data-ask-tone` still carries the state for anything that reads it.
*/
const PLAIN_TONES: ReadonlySet<AskR2View['tone']> = new Set(['current', 'verified', 'partial']);

function readingTone(tone: AskR2View['tone']): {
  readonly 'data-ask-read-plain'?: 'true';
  readonly 'data-ask-read-rule'?: AskR2View['tone'];
} {
  return PLAIN_TONES.has(tone) ? { 'data-ask-read-plain': 'true' } : { 'data-ask-read-rule': tone };
}

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
  readonly locale: DisplayLocale;
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
  const s = askShellStrings(locale).askR2Strings;
  /* ASK READING EXPERIENCE R1 — the Sources panel/sheet, when this surface provides one. */
  const openSources = useAskSourcesPanel();
  const payload = turn.payload ?? null;

  if (payload === null) {
    return (
      <article data-ask-turn data-ask="turn" data-ask-state="unavail" className={TURN}>
        <p className="sr-only">{s.youAsked}</p>
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
    /* R4 · LOCALIZATION CONVERGENCE (category B) — the country named in the reader's own
       DisplayLocale; the legacy crossing gave German and Portuguese readers English names. */
    (iso3) => askCountryName(iso3, locale) ?? iso3,
    turn.question,
  );
  const operationId = turn.operation?.operationId;
  /*
    GOVERNED ANSWER CONVERSATIONAL UX R1 — conversation first, governance second, evidence third.
    A zero-AI governed answer (retained record, or a governed record / official source that
    cannot be shown) leads with a plain-language answer; its governance state becomes restrained
    status and provenance; the evidence stays below. Null for every other turn (unchanged).
  */
  const governed = askGovernedConversation(
    payload,
    askShellStrings(locale).askGovernedCopy,
    turn.question,
  );
  /* PUBLIC BETA HARDENING R1A — a deterministic computation's calculation card IS its answer:
     no second, empty Answer container is drawn beneath it. */
  const computedAnswer = view.badge === 'calc' && payload.computation != null;
  /* R3 — which kind of guidance labels this answer (§28 human labels) */
  const guidanceKind = payload.guidance?.kind ?? null;
  /* The SAME array the inline citations number against, so item n is always [n]. */
  const answerSources = payload.analysis?.analysis?.sources ?? [];

  return (
    <article data-ask-turn data-ask="turn" data-ask-state={view.badge} className={TURN}>
      <p className="sr-only">{s.youAsked}</p>
      <h2 className={QUESTION}>{turn.question}</h2>
      {/* CTO checkpoint 5 §5 — "And in Kenya?" answered as the earlier question for Kenya: said, never hidden. */}
      {payload.continuation != null && (
        <p data-ask="continuation" className={`-mt-1 mb-3 ${NOTE}`}>
          {s.continuationAnsweredAs}: “{payload.continuation.answeredAs}” ·{' '}
          {payload.continuation.kind === 'JOB_CONTEXT'
            ? s.r3.continuationJobNote
            : s.continuationNote}
        </p>
      )}
      {/* R3 §14 — a relationship question is scoped to BOTH sides, said in plain words */}
      {payload.relationship != null && payload.relationship.countries.length === 2 && (
        <p data-ask="relationship" className={`-mt-1 mb-3 ${NOTE}`}>
          {s.r3.relationshipScope(
            askCountryName(payload.relationship.countries[0], locale) ??
              payload.relationship.countries[0],
            askCountryName(payload.relationship.countries[1], locale) ??
              payload.relationship.countries[1],
            payload.relationship.relations
              .map((r) => s.r3.relations[r])
              .filter((r): r is string => r !== undefined),
          )}
        </p>
      )}

      {/*
        ASK READING EXPERIENCE R1 — ANSWER FIRST. The scope chips and the engine-state line
        (badge, freshness, expired) used to stand between the question and the answer, so a
        reader met a wall of metadata before the first sentence they came for. They are the
        same elements with the same content; they now follow the answer as its status footer
        (`answer-meta` below). A qualified answer still opens with its own qualification INSIDE
        the answer — the reference note, the insufficient title, the limited-search note — so
        no caveat moves away from the claims it qualifies.
      */}
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
              <li key={input.name} className="text-[0.75rem] text-[var(--ask-read-ink2,#8fa6c0)]">
                {input.name} = {input.value}
                {input.unit === '' ? '' : ` ${input.unit}`} (“{input.quoted}”)
              </li>
            ))}
          </ul>
          <ol data-ask="computation-steps" className="flex flex-col gap-1">
            {payload.computation.steps.map((step) => (
              <li key={step.label} className="text-[15px] leading-[1.5]">
                {step.label}: <span className="">{step.expression}</span> ={' '}
                <strong>
                  {step.value} {step.unit}
                </strong>
              </li>
            ))}
          </ol>
          {payload.computation.conventions.map((convention) => (
            <p key={convention} className="text-[13px] text-[var(--ask-read-ink2,#8fa6c0)]">
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
              <span className="text-[0.75rem] text-[var(--ask-read-ink2,#8fa6c0)]">
                {s.verification.sourcesChecked}
              </span>
              {view.verification.lanes.map((lane) => (
                <span
                  key={`${lane.label}-${lane.status}`}
                  data-ask-lane={lane.ok ? 'ok' : 'unavailable'}
                  className="text-[0.75rem] text-[var(--ask-read-ink3,#8299b4)]"
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
                  className="text-[13px] leading-[1.45] text-[var(--ask-read-ink2,#b7c7da)]"
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
                    'flex min-h-[48px] w-full items-center rounded-[10px] border border-[var(--ask-read-line,#1d4a73)] bg-[var(--ask-read-sunk,#06223d)] px-3.5 text-start text-[15px] font-semibold';
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
                <p className="text-[13px] text-[var(--ask-read-ink2,#8fa6c0)]">{s.clarify.chooseHint}</p>
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
                  <p className="text-[0.75rem] text-[var(--ask-read-ink2,#8fa6c0)]">
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
                      className="inline-flex min-h-11 w-fit items-center rounded-[9px] border border-[var(--ask-read-line,#1d4a73)] bg-[var(--ask-read-sunk,#06223d)] px-3.5 text-[14px] font-semibold hover:border-[rgba(34,211,238,0.55)]"
                    >
                      {s.clarify.useSuggestion}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <p className="text-[0.75rem] text-[var(--ask-read-ink3,#6f89a8)]">
            {view.clarification.byExecutor ? s.clarificationFooterNoAi : s.clarificationFooter}
          </p>
          {/* At ≥1280 the Sources column states this instead; never both (CTO ruling). */}
          <p data-ask="sources-after-choice" className="text-[0.75rem] text-[var(--ask-read-ink3,#6f89a8)]">
            {s.sourcesAfterChoice}
          </p>
        </section>
      ) : governed !== null ? (
        <section
          data-ask="answer"
          data-ask-governed="true"
          data-ask-basis={payload.answer.basis}
          data-ask-tone="current"
          {...readingTone('current')}
          className={`flex flex-col gap-3 ${CARD} ${CARD_CLASS.current}`}
        >
          <p data-ask-eyebrow="answer" className={EYEBROW}>
            {s.answer}
          </p>
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
            className="text-[0.75rem] leading-[1.4] text-[var(--ask-read-ink3,#8299b4)]"
          >
            {governed.provenance}
          </p>
          {governed.followUps.length > 0 && (
            /* Continuity: a suggestion only becomes a DRAFT in the composer; nothing runs. */
            <div data-ask="governed-follow-ups" className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[0.75rem] text-[var(--ask-read-ink3,#6f89a8)]">
                {s.followUpHint}
              </span>
              {governed.followUps.map((q) =>
                onUseQuestion !== undefined ? (
                  <button
                    key={q}
                    type="button"
                    data-ask="governed-follow-up"
                    onClick={() => onUseQuestion(q)}
                    className="inline-flex min-h-9 items-center rounded-[16px] border border-[var(--ask-read-line,#1d4a73)] bg-[var(--ask-read-sunk,#06223d)] px-3 text-start text-[13.5px] font-semibold text-[var(--ask-read-ink,#cfe2f2)] hover:border-[rgba(34,211,238,0.55)]"
                  >
                    {q}
                  </button>
                ) : (
                  <span
                    key={q}
                    data-ask="governed-follow-up"
                    className="text-[13.5px] text-[var(--ask-read-ink,#cfe2f2)]"
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
          data-ask-tone={view.tone}
          {...readingTone(view.tone)}
          className={`flex flex-col gap-3.5 ${CARD} ${CARD_CLASS[view.tone]}`}
        >
          <p data-ask-eyebrow="answer" className={EYEBROW}>
            {s.answer}
          </p>
          {view.badge === 'ref' && !view.citable && (
            <div
              data-ask="reference-note"
              /* R4 · PHASE C — compact metadata beside the answer header, same words. */
              data-ask-read="r4"
              className="rounded-[8px] border border-dashed border-[var(--ask-read-line,#4a5a6e)] bg-[var(--ask-read-sunk,#121a26)] px-3 py-2.5 text-[13px] leading-[1.45] text-[var(--ask-read-ink2,#a9b6c6)]"
            >
              {/* CTO P0 — advice is labelled as general guidance, never as current sourced research */}
              <p className="font-bold text-[var(--ask-read-ink,#d3dbe5)]">
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
          {/* R4 ALPHA R-2 — a MIXED answer whose current part was SOURCED has no current gap to
              name; if its explanatory part could not be produced, that is said instead */}
          {payload.guidance?.currentPart === 'SOURCED' &&
            payload.guidance.stablePart === 'UNAVAILABLE' && (
              <p
                data-ask="mixed-stable-unavailable"
                className="text-[13px] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]"
              >
                {s.r4.mixedStableUnavailable}
              </p>
            )}
          {payload.guidance != null &&
            payload.guidance.currentPart !== 'SOURCED' &&
            payload.guidance.currentEvidenceNeeded.length > 0 && (
              <div
                data-ask="guidance-current-gap"
                data-ask-partial={payload.guidance.currentPart ?? undefined}
                className="rounded-[8px] border border-[var(--ask-read-deep-line,#5a4a2a)] bg-[var(--ask-read-deep-bg,#17130c)] px-3 py-2.5 text-[13px] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]"
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
            <p data-ask="search-limited" className="text-[13px] leading-[1.45] text-[var(--ask-read-deep-ink,#c9b27a)]">
              {s.limitedNote}
            </p>
          )}
          {/*
            R4 ALPHA R-2 — MIXED: the explanatory part (model reasoning, never a source) beside the
            sourced current part below.

            RECONCILIATION, 5699eb7 x H (CTO ruling: semantics from the baseline, rendering from H).
            The baseline's CONDITION is kept exactly — when a mixed answer shows its stable part is
            a semantic decision and it is not this lane's. Its RENDERING is not: it reintroduced
            `<p className="whitespace-pre-wrap">{payload.background.text}</p>`, a second instance of
            the very defect phase A closed, and its own comment ("kept as written (paragraphs,
            lists)") shows the intent was to preserve the authored structure — which a raw <p>
            cannot do. A model-background answer written with `## headings` and `- bullets` would
            have reached readers as raw syntax here exactly as it did on the other path.

            A clean cherry-pick would have left this standing, because the two edits are in
            different regions and git has no conflict to raise. This is why the ruling said not to
            blind-cherry-pick through.
          */}
          {payload.analysis !== null &&
            payload.background != null &&
            payload.guidance?.kind === 'MIXED_REFERENCE_CURRENT' && (
              <div data-ask="mixed-stable" className="flex flex-col gap-1.5">
                <p className={EYEBROW}>{s.r4.mixedStableTitle}</p>
                <AskAnswerProse source={payload.background.text} sources={[]} language={locale} />
              </div>
            )}
          {payload.analysis !== null && (
            <AskCompactResult
              response={payload.analysis}
              question={turn.question}
              /* The accepted dock boundary is `LanguageCode` (category C: kept for the props that
                 still take it); every label on the card reads the reader's own `locale`. */
              language={askLocaleForLegacyCatalogue(locale)}
              locale={locale}
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
            /*
              R4 PHASE A — THE DEFECT THE PRODUCT OWNER REPORTED, CLOSED AT ITS SOURCE.

              This was one <p> with `whitespace-pre-wrap`, so every heading, bullet, numbered
              step and bold run a model-background answer was authored with reached the reader
              as raw syntax — `**Nationally Determined Contributions**` with its asterisks.
              The same renderer the cited brief uses now draws it: the answer's OWN structure,
              nothing invented, no HTML executed. There are no statements and no sources on a
              background answer, so no citation can be placed — which is correct, and the
              provenance line beside the header says so.
            */
            <div data-ask="background-text">
              <AskAnswerProse source={payload.background.text} sources={[]} language={locale} />
            </div>
          )}
          {/* TRUST R1 — mixed answer: retained recent reporting about the same place. */}
          {payload.analysis === null && payload.recentReporting != null && (
            <AskRecentReporting reporting={payload.recentReporting} locale={locale} />
          )}
          {view.badge === 'ref' && view.sourceCount === 0 && (
            <p data-ask="no-citable" className="text-[0.75rem] text-[var(--ask-read-ink2,#8fa6c0)]">
              {s.noCitable}
            </p>
          )}
        </section>
      )}

      {/* ASK READING EXPERIENCE R1 — the answer's status footer: what it was scoped to and
          what state it is in, after the answer rather than before it. */}
      <div data-ask="answer-meta" className="mt-4 flex flex-col gap-2">
        <div data-ask="scope" className="flex flex-wrap items-center gap-1.5">
          <span className={`me-1 ${EYEBROW}`}>{s.scope}</span>
          {view.chips.items.map((chip, i) => (
            <span
              key={`${chip.kind}-${i}`}
              data-ask-chip={chip.kind}
              data-ask-chip-kept={chip.kept ? 'true' : undefined}
              /* R4 · a chip is a self-contained run: a publisher name, a domain or the
                 reader's own words. Isolated so its boundaries cannot reorder the row — a
                 DOMAIN chip beside an Arabic TOPIC chip is the case this exists for. */
              {...isolatedAuto()}
              className={`inline-flex min-h-7 items-center rounded-[14px] border bg-[var(--ask-read-sunk,#06223d)] px-2.5 text-[0.8125rem] font-semibold text-[var(--ask-read-ink,#cfe2f2)] ${chip.kept ? 'border-dashed border-[var(--ask-read-rule-insufficient,rgba(201,138,138,0.6))]' : 'border-[var(--ask-read-line,#1d4a73)]'}`}
            >
              {chip.label}
            </span>
          ))}
          {view.chips.note !== null && (
            <span className={META} {...isolatedAuto()}>
              {view.chips.note}
            </span>
          )}
        </div>

        <div data-ask="engine-state" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {governed !== null ? (
            /* Restrained: the machine state is metadata, never the headline of the answer. */
            <span data-ask-badge={view.badge} data-ask-badge-restrained="true" className={EYEBROW}>
              {view.badgeText}
            </span>
          ) : (
            <>
              <span
                data-ask-badge={view.badge}
                className={`inline-flex min-h-[26px] items-center rounded-[6px] px-2.5 text-[0.75rem] font-semibold tracking-[0.04em] ${TONE_CLASS[view.tone]}`}
              >
                {view.badgeText}
              </span>
              <span data-ask="freshness" className={META}>
                {view.freshness}
              </span>
            </>
          )}
          {/* ASK RELIABILITY R1 (L) — a reporting re-use window passing does not make a timeless
              explanation or a computed result "expired": the note is shown only for answers that
              rest on CURRENT reporting, where re-checking genuinely matters. */}
          {turn.expired === true && payload.answer.state !== 'REFERENCE_BACKGROUND' && payload.answer.state !== 'COMPUTED_RESULT' && (
            <span data-ask="expired" className={META}>
              {s.expiredNote}
            </span>
          )}
        </div>
      </div>

      {/* ASK INTELLIGENCE BINDING R1 — the governed structured basis of this one answer. */}
      <AskIntelligenceBasis
        payload={payload}
        locale={locale}
        reportingSourceCount={view.sourceCount}
        hideNotes={governed !== null}
      />

      {/*
        ASK READING EXPERIENCE R1 — the answer's actions, after the answer and its footer
        (CAPABILITY-MATRIX §A/§B): only controls with a real backing render. Copy (local
        clipboard), Save and Save as briefing (their endpoints), Sources (this answer's own
        list, zero network). Share / Copy link, Download and remembered preferences have no
        endpoint (D7, D8, D6) and are omitted, never shown disabled.
      */}
      <div data-ask="turn-actions" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {/* TRUST R1 — copy this answer (local clipboard only; nothing is shared or sent). */}
        <AskTurnCopy locale={locale} />
        {/* STANDALONE PUBLIC BETA CONVERGENCE R1 — the reader's Save / Saved (0 AI). */}
        {canSave && <AskTurnSave operation={turn.operation} locale={locale} />}
        {/* R2 · D1 — Save as briefing (signed-in, produced answers, only when the server has briefings on). */}
        {canSave && <AskTurnBrief operation={turn.operation} locale={locale} />}
        {openSources !== null && answerSources.length > 0 && (
          <button
            type="button"
            data-ask="open-sources"
            onClick={(event) => openSources({ sources: answerSources, opener: event.currentTarget })}
            className="inline-flex min-h-[44px] items-center rounded-[8px] px-3 text-[0.8125rem] font-semibold text-[var(--ask-read-control-ink,#cfe2f2)] underline decoration-transparent underline-offset-[3px] hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ask-read-control-ink,#5abff5)] md:min-h-[32px]"
          >
            {s.sourcesLabel(answerSources.length)}
          </button>
        )}
      </div>

      {((view.handoffs.openFull && !displayOnly) ||
        (view.handoffs.runDeeper && onRunDeeper !== undefined)) &&
        operationId !== undefined && (
          <div data-ask="handoffs" className="mt-4 flex flex-wrap gap-2.5">
            {view.handoffs.openFull && !displayOnly && (
              <a
                data-ask="open-full-analysis"
                href={openFullAnalysisHref(operationId)}
                className="flex min-h-[56px] flex-[1_1_220px] flex-col justify-center gap-1 rounded-[12px] border border-[var(--ask-read-control-line,#1b6fa8)] px-4 py-2.5 hover:bg-[var(--ask-read-sunk,#07304f)]"
              >
                <span className="text-[15px] font-bold leading-[1.1] text-[var(--ask-read-ink,#cfe2f2)]">
                  {s.openFull}
                </span>
                <span className="text-[0.75rem] leading-[1.2] text-[var(--ask-read-ink3,#8299b4)]">
                  {s.openFullMeta}
                </span>
              </a>
            )}
            {view.handoffs.runDeeper && onRunDeeper !== undefined && (
              <button
                type="button"
                data-ask="run-deeper"
                onClick={() => onRunDeeper(turn.question)}
                className="flex min-h-[56px] flex-[1_1_220px] flex-col justify-center gap-1 rounded-[12px] border-2 border-[var(--ask-read-deep-line,#6a5634)] bg-[var(--ask-read-deep-bg,#2e2618)] px-4 py-2.5 text-left hover:bg-[var(--ask-read-deep-bg,#3a3020)]"
              >
                <span className="text-[15px] font-bold leading-[1.1] text-[var(--ask-read-deep-ink,#d9b98a)]">
                  {s.runDeep}
                </span>
                <span className="text-[0.75rem] leading-[1.2] text-[var(--ask-read-deep-ink,#c9b48c)]">
                  {s.runDeepMeta}
                </span>
              </button>
            )}
          </div>
        )}
    </article>
  );
}
