'use client';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { AskActionGlyph } from './AskActionGlyph';

import { useRef, useState } from 'react';
import { askR2PayloadOf, askV2Api, type AskV2Operation } from '@/lib/api/askV2Api';
import { askContinuityStrings } from '@/lib/ask/askContinuityStrings';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { useAskToast } from './AskToast';

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
  /* CURRENT-REPORTING TRUTH R1 — an answer from retained reporting is a produced answer. */
  'RETAINED_REPORTING',
]);

export function AskTurnSave({
  operation,
  locale,
}: {
  readonly operation: AskV2Operation | undefined;
  readonly locale: DisplayLocale;
}): JSX.Element | null {
  const t = askShellStrings(locale).askContinuityStrings;
  /* ASK DESIGN COMPLETENESS R1 — Saved feedback (Design C5): the server's confirmation, with Undo. */
  const read = askShellStrings(locale).askR2Strings.read;
  const toast = useAskToast();
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

  async function toggle(wasSaved: boolean = saved): Promise<void> {
    if (inFlight.current || turnId === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const outcome = wasSaved ? await askV2Api.unbookmark(turnId) : await askV2Api.bookmark(turnId);
      if (outcome.ok) {
        setSaved(outcome.value.bookmarked);
        /* Only a save the server confirmed is announced; Undo is the real unbookmark. */
        if (!wasSaved && outcome.value.bookmarked) {
          toast?.({ text: read.savedToast, action: { label: read.undo, run: () => void toggle(true) } });
        }
      }
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
      /*
        ASK READING EXPERIENCE R1 — one of the answer actions now (after the answer), so it no
        longer pushes itself to the row end.

        SUPERSEDED BY PRODUCT OWNER / CLAUDE DESIGN R3 §10 · the bordered pill with the ★ / ☆
        character and a text label is replaced by the package's own bookmark glyph, whose FILL
        is the approved selected/unselected appearance (`saveFill: saved ? 'currentColor' :
        'none'`). `aria-pressed` still carries the state programmatically, and `aria-label` /
        `title` carry the same qualified word the label carried. Geometry, colour and the hover
        and focus states are the stylesheet's, per the package.
      */
      aria-label={saved ? t.saved : t.save}
      title={saved ? t.saved : t.save}
    >
      <AskActionGlyph name="save" selected={saved} />
    </button>
  );
}
