'use client';

import type { JSX } from 'react';
import { AdaptiveTextarea } from '@/components/ui/AdaptiveTextarea';

/**
 * ASK R2 CLAUDE DESIGN RECONCILIATION R1 — presentation primitives of the frozen D25
 * authority (GNAI_ASK_INTELLIGENCE_WORKSPACE_R2_FINAL_DESIGN_AUTHORITY_D25, SHA256
 * 4ca6c22d9e995901b9b61fd5e55080885913138d9877c296ed8acfd21399ed53). The v1.8 dashboard
 * primitives (Situation context, five absent suggestion rows, Watch, Recent alerts) are
 * not in D25's idle state and are gone; D25 01 lists every region the workspace has.
 */

/** D25 micro label: mono 11 / .12em, the eyebrow every Ask section carries. */
export const ASK_EYEBROW =
  'font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-[#8fa6c0]';

/**
 * QUESTIONS WORTH ASKING — ONE CARD, ONE TRUTHFUL SENTENCE.
 *
 * D25 00-empty: the card states that no question is available yet and that this is not a
 * claim that nothing is worth asking. No rows are drawn for questions that do not exist.
 */
export function QuestionsWorthAsking({
  label,
  statement,
}: {
  readonly label: string;
  readonly statement: string;
}): JSX.Element {
  return (
    <section
      data-ask="suggestions"
      aria-label={label}
      className="mt-3 flex flex-col gap-1.5 rounded-[10px] border border-[#0e2d4d] bg-[#03152a] p-3.5"
    >
      <h2 className={ASK_EYEBROW}>{label}</h2>
      <p data-ask="statement" className="text-[13px] leading-[1.55] text-[#b6c9de]">
        {statement}
      </p>
    </section>
  );
}

/**
 * Persistent composer (D25 04). Only form submission starts research; opening, focusing
 * and typing request nothing. One row: the field grows to ~6 lines (220 px desktop,
 * 140 px phone) and then scrolls inside itself; Ask stays at its right. The cost line
 * sits under the row, never as a caption on the button.
 */
/** TRUST R1 — a fine pointer (mouse / trackpad) means a physical keyboard: Enter sends. */
export function enterSends(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true;
}

export function Composer({
  value,
  onChange,
  inputLabel,
  placeholder,
  submitLabel,
  costNote,
  onSubmit,
  pending = false,
  maxHeight,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly inputLabel: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly costNote: string;
  readonly onSubmit?: () => void;
  readonly pending?: boolean;
  /** D25 04: 220 on desktop, 140 on full-screen phone / 768 portrait. */
  readonly maxHeight: 220 | 140;
}): JSX.Element {
  const ready = !pending && value.trim().length > 0 && onSubmit !== undefined;
  return (
    <form
      data-ask="composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      className="flex min-w-0 flex-col gap-2"
    >
      <div
        className={`flex min-h-[56px] items-end gap-2 rounded-[14px] border bg-[#061a30] py-1.5 pe-1.5 ps-4 focus-within:border-[#5abff5] ${
          value.trim() ? 'border-[#5abff5]' : 'border-[#1d4a73]'
        }`}
      >
        <label className="sr-only" htmlFor="ask-frame-composer">
          {inputLabel}
        </label>
        <AdaptiveTextarea
          id="ask-frame-composer"
          data-ask="composer-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            /* TRUST R1 — Enter sends on a desktop keyboard (Shift+Enter = new line); on a touch
               keyboard Enter stays a new line and the Ask button sends. Never mid-composition
               (IME), never while a question is in flight or the box is empty. */
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            if (!enterSends()) return;
            event.preventDefault();
            if (ready) event.currentTarget.form?.requestSubmit();
          }}
          placeholder={placeholder}
          maxLength={1000}
          minHeight={32}
          maxHeight={maxHeight}
          maxViewportFraction={0.4}
          keepVisible
          className="min-w-0 flex-1 self-center bg-transparent py-1.5 text-[16px] leading-[1.45] text-white placeholder:text-[#6f89a8] focus:outline-none"
        />
        <button
          type="submit"
          data-ask="send"
          disabled={!ready}
          className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[10px] border border-[#1b6fa8] px-[18px] text-[14px] font-bold text-[#e6f5ff] ${
            ready ? 'bg-[#0a6bd6]' : 'bg-[#07304f] opacity-55'
          }`}
        >
          {submitLabel}
          {ready && (
            <span aria-hidden="true" className="text-[15px] leading-none">
              ↑
            </span>
          )}
        </button>
      </div>
      <p data-ask="cost-note" className="font-mono text-[11px] leading-[1.3] text-[#6f89a8]">
        {costNote}
      </p>
    </form>
  );
}
