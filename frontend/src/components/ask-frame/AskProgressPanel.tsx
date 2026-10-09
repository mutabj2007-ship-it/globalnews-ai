'use client';

import { useId, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askProgressStrings } from '@/lib/ask/askProgressStrings';
import { AskStaticEmblem, AskWorkingEmblem } from './AskEmblem';

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

export function AskSearchActivity({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const s = askProgressStrings(locale);
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div data-ask="progress" data-ask-progress="collapsed" className="mb-3 flex flex-col gap-2">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {`${s.completed}: ${s.answerReady}`}
      </p>
      <button
        type="button"
        data-ask="search-activity"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-[18px] px-2 text-[0.8125rem] font-medium text-[var(--ask-read-ink2,#9fb4cc)]"
      >
        <AskStaticEmblem size={18} />
        <span>{s.collapsed(1)}</span>
        <span aria-hidden="true" className="text-[var(--ask-read-rule-current,#5abff5)]">
          {open ? s.hide : s.show}
        </span>
      </button>
      {open && (
        <ul id={listId} data-ask="search-activity-steps" className="ms-4 flex flex-col gap-2 border-s-2 border-[var(--ask-read-line,#1e2636)] px-3.5 py-2.5">
          <li className="text-[0.8125rem] leading-[1.45]">
            <span className="font-semibold text-[var(--ask-read-rule-current,#5abff5)]">{`✓ ${s.completed}`}</span>
            {` · ${s.answerReady}`}
          </li>
        </ul>
      )}
    </div>
  );
}
