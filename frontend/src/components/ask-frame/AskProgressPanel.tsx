'use client';

import { useId, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askProgressStrings } from '@/lib/ask/askProgressStrings';
import { AskStaticEmblem, AskWorkingEmblem } from './AskEmblem';
import type { SearchActivity, SearchStep, SearchStepStatus } from '@/lib/ask/askSearchActivity';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 PROGRESS R1 — THE RESEARCH PROGRESS AREA, AT THE ONE TRUTHFUL GRAIN AVAILABLE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Claude Design R3 (ProgressPanel.dc.html, PROGRESS_MOTION_SPEC.md, the Research Progress
 * addendum §5–§7). The display is driven by execution events, never a timer. Today the client
 * observes exactly ONE real signal: the request is in flight, then it settles (`r2.pending`). The
 * design's own rule for that case (addendum §6, HANDOFF "if only start/finish exists, UI shows one
 * row"): "show one honest animated line … until completion. Missing telemetry is not permission to
 * invent intermediate steps." So:
 *
 *   running    one row: the ORIGINAL emblem with the working motion beside the working line;
 *              reduced motion → static pose + visible "In progress ·"; one polite, atomic status.
 *   completed  the emblem unmounts (its motion stops with the work); the area collapses to
 *              "Search activity · 1 step" with the 18 px static emblem, closed; opened, it lists
 *              "✓ Completed · Answer ready". Shown only for the answer that just finished in this
 *              session — never replayed on a reopened answer (R3 D15-stale `prog: null`).
 *   failed     unchanged: the existing failure block ("Try again", the kept question).
 *
 * Multi-stage rows (searching → checking dates → preparing), the emblem moving from line to line,
 * per-stage partial / failed, queued, slow and cancel need real progress events (backend B4) and
 * are NOT drawn here.
 */
export function AskProgressRunning({
  locale,
  label,
}: {
  readonly locale: DisplayLocale;
  /** The running line (the qualified `r2s.working`; ruling 7 decides "question" vs "answer"). */
  readonly label: string;
}): JSX.Element {
  const s = askProgressStrings(locale);
  return (
    <div data-ask="progress" data-ask-progress="running" role="group" aria-label={s.group} className="mt-3 flex flex-col gap-2">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-ask="working">
        {`${s.inProgress}: ${label}`}
      </p>
      <div aria-hidden="true" className="gna-ask-progress-row flex items-start gap-2.5">
        <AskWorkingEmblem />
        <span className="pt-0.5 text-[0.9375rem] font-medium leading-[1.4] text-[var(--ask-read-ink,#e6edf6)]">
          <span className="gna-ask-rm-only">{`${s.inProgress} · `}</span>
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * ASK R3 RESEARCH ACTIVITY R1 — the collapsed "Search activity" RECORD of a stored answer: derived
 * from what the backend recorded (`searchActivityOf`), shown live and on reopen alike, static and
 * closed (no replay, no announcement — a record is not a live event). Glyphs per R3 ProgressPanel:
 * ✓ completed · ! partly completed · × not completed; a check only where the step completed.
 */
export function AskSearchActivity({
  locale,
  activity,
  laneLabel,
}: {
  readonly locale: DisplayLocale;
  readonly activity: SearchActivity;
  /** The same lane names the "Sources checked" line uses. */
  readonly laneLabel: (lane: string) => string;
}): JSX.Element {
  const s = askProgressStrings(locale);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const text = (step: SearchStep): string =>
    step.kind === 'ANSWER'
      ? step.answer === 'NOT_PRODUCED'
        ? s.noAnswerProduced
        : step.answer === 'COMPLETED_UNVERIFIED'
          ? s.requestCompleted
          : s.answerReady
      : step.kind === 'REUSED'
        ? s.earlierReviewed
        : step.status === 'failed'
          ? s.couldNotFinish
          : step.status === 'partial'
            ? s.someSourcesSearched
            : s.sourcesSearched;
  const notes = (step: SearchStep): string[] => [
    ...(step.kind === 'REUSED' ? [s.noNewSearch] : []),
    ...(step.answer === 'COMPLETED_UNVERIFIED' ? [s.noVerifiedAnswer] : step.answer === 'PARTLY_SOURCED' ? [s.someEvidenceMissing] : []),
    ...(step.found === 'NO_MATCH' ? [s.noMatch] : step.found === 'FILTERED' ? [s.filtered] : []),
    ...(step.rightsWithheld !== undefined && step.rightsWithheld > 0 ? [s.rightsWithheld(step.rightsWithheld)] : []),
    ...(step.unreached !== undefined && step.unreached.length > 0 ? [s.unreached(step.unreached.map(laneLabel).join(', '))] : []),
  ];
  const tag = (status: SearchStepStatus): { glyph: string; word: string; color: string } =>
    status === 'unknown'
      ? { glyph: '–', word: s.outcomeUnavailable, color: 'var(--ask-read-ink2,#9fb4cc)' }
      : status === 'completed'
      ? { glyph: '✓', word: s.completed, color: 'var(--ask-read-rule-current,#5abff5)' }
      : status === 'partial'
        ? { glyph: '!', word: s.partlyCompleted, color: 'var(--ask-read-rule-reference,#c9a227)' }
        : { glyph: '×', word: s.notCompleted, color: 'var(--ask-read-rule-insufficient,#e06c6c)' };
  return (
    <div data-ask="progress" data-ask-progress="collapsed" data-ask-research-basis={activity.basis} className="mb-3 flex flex-col gap-2">
      <button
        type="button"
        data-ask="search-activity"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-[18px] px-2 text-[0.8125rem] font-medium text-[var(--ask-read-ink2,#9fb4cc)]"
      >
        <AskStaticEmblem size={18} />
        <span>{s.collapsed(activity.steps.length)}</span>
        <span aria-hidden="true" className="text-[var(--ask-read-rule-current,#5abff5)]">
          {open ? s.hide : s.show}
        </span>
      </button>
      {open && (
        <ul id={listId} data-ask="search-activity-steps" className="ms-4 flex flex-col gap-2 border-s-2 border-[var(--ask-read-line,#1e2636)] px-3.5 py-2.5">
          {activity.steps.map((step, i) => {
            const t = tag(step.status);
            return (
              <li key={i} data-ask="search-step" data-ask-step={step.kind} data-ask-step-status={step.status} className="flex flex-col gap-0.5 text-[0.8125rem] leading-[1.45]">
                {step.kind === 'SEARCH' && step.status === 'unknown' ? (
                  /* R1.1 (CTO) — nothing is claimed beyond the attempt: one plain sentence, no check */
                  <span>
                    <span aria-hidden="true" className="font-semibold" style={{ color: t.color }}>{`${t.glyph} `}</span>
                    {s.searchAttemptedUnknown}
                  </span>
                ) : (
                  <span>
                    <span className="font-semibold" style={{ color: t.color }}>{`${t.glyph} ${t.word}`}</span>
                    {` · ${text(step)}`}
                  </span>
                )}
                {notes(step).map((note) => (
                  <span key={note} className="text-[var(--ask-read-ink2,#9fb4cc)]">
                    {note}
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
