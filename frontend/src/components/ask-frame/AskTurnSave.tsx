'use client';
import type { DisplayLocale } from '@globalnews-ai/shared';

import { useRef, useState } from 'react';
import { askR2PayloadOf, askV2Api, type AskV2Operation } from '@/lib/api/askV2Api';
import { askContinuityStrings } from '@/lib/ask/askContinuityStrings';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — Save / Saved on a stored Ask turn.
 *
 * A bookmark is a link to the reader's OWN turn (H's AskBookmark), never a copy. This control
 * only exists where the server already returned the reader's `turnId` for a COMPLETED,
 * stored result — which it does only for the owner of a signed-in Ask V2 operation. One press
 * is one request: POST to save, DELETE to unsave. A press while a request is in flight is
 * ignored. The state shown is the server's answer, never an optimistic guess. Zero AI, zero
 * provider, zero Sand, no new turn: nothing here reaches the execution path.
 */
/**
 * ALPHA VISUAL ACCEPTANCE REPAIR (M4) — only a PRODUCED answer is worth bookmarking. A
 * clarification or broadening prompt, an insufficient-evidence result and a typed refusal are
 * stored turns too, but they answer nothing, so they carry no Save / Saved. A turn saved
 * before this rule can still be removed from Saved.
 */
export const ASK_SAVABLE_ANSWER_STATES: ReadonlySet<string> = new Set([
  'CURRENTLY_VERIFIED',
  'CURRENT_REPORTING',
  'PARTIAL',
  'REFERENCE_BACKGROUND',
  /* LIVE ACCEPTANCE REPAIR R1 — a governed retained record is a produced answer. */
  'RETAINED_RECORD',
]);

export function AskTurnSave({
  operation,
  locale,
}: {
  readonly operation: AskV2Operation | undefined;
  readonly locale: DisplayLocale;
}): JSX.Element | null {
  const t = askShellStrings(locale).askContinuityStrings;
  const [saved, setSaved] = useState(operation?.bookmarked === true);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const turnId = operation?.turnId ?? null;
  const state = askR2PayloadOf(operation)?.answer.state;
  const eligible =
    turnId !== null &&
    operation?.status === 'COMPLETED' &&
    operation.result !== null &&
    state !== undefined &&
    ASK_SAVABLE_ANSWER_STATES.has(state);
  if (!eligible) return null;

  async function toggle(): Promise<void> {
    if (inFlight.current || turnId === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const outcome = saved ? await askV2Api.unbookmark(turnId) : await askV2Api.bookmark(turnId);
      if (outcome.ok) setSaved(outcome.value.bookmarked);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      data-ask="save"
      data-ask-saved={saved ? 'true' : 'false'}
      aria-pressed={saved}
      disabled={busy}
      onClick={() => void toggle()}
      className={`ms-auto inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] border px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-60 ${
        saved
          ? 'border-[#1b6fa8] bg-[#07304f] text-[#8fd3ff]'
          : 'border-[#1d4a73] text-[#b6c9de] hover:border-[#5abff5]'
      }`}
    >
      <span aria-hidden="true">{saved ? '★' : '☆'}</span>
      {saved ? t.saved : t.save}
    </button>
  );
}
