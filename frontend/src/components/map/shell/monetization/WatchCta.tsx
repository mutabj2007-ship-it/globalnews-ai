'use client';

import {
  watchCtaIsSolePrimary,
  watchCtaIsVisible,
  type WatchCtaStage,
} from '@/lib/map/monetization/watchCtaLadder';

/**
 * PART IV §6.1a — ONE CONTROL, FOUR TREATMENTS, NO NEW ELEMENT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS ONE COMPONENT AND NOT FOUR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "Promotion is a CROSS-FADE of the same control in the same position. Never a
 * new element appearing, never a nudge, never motion on the map."
 *
 * A button that materialises is an interruption — the reader's eye is pulled
 * away from what they were reading to something the product wants. A button
 * that firms up where it already was is an observation they can take or leave.
 *
 * So there is exactly one `<button>` here at every visible stage, in one
 * position, and only its border, fill and weight change. The transition is on
 * colour and background alone: a control that also moved or resized would be a
 * nudge wearing a cross-fade's clothes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MINT, AND WHAT IT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the ONLY filled-mint element in the product. Mint says a standing
 * assignment is running — a live indicator, not a receipt. It is never amber:
 * amber means the WORLD changed, mint means the USER has work running, and one
 * hue cannot carry both without the watchboard becoming unreadable.
 *
 * It is also never violet. Violet marks a tier boundary, and Watch itself is not
 * a tier boundary — composing is free and complete. The paid moment is
 * activation, and the violet lives there, in the activation panel.
 */

export interface WatchCtaLabels {
  /** STAGE 2 — the quiet glyph's accessible name. */
  readonly glyph: string;
  /** STAGES 3 and 4 — the verb. Never "subscribe", never "upgrade". */
  readonly watch: string;
  /** Explains what a Watch is, on hover and to assistive technology. */
  readonly description: string;
}

export interface WatchCtaProps {
  readonly stage: WatchCtaStage;
  readonly labels: WatchCtaLabels;
  readonly onOpenComposer: () => void;
  /** True once a Watch exists on this subject — the control reads as running. */
  readonly running?: boolean;
}

export function WatchCta({
  stage,
  labels,
  onOpenComposer,
  running = false,
}: WatchCtaProps): JSX.Element | null {
  /* STAGE 1: no affordance at all. Identity and counts only. */
  if (!watchCtaIsVisible(stage)) return null;

  const solePrimary = watchCtaIsSolePrimary(stage);

  /*
    STAGE 2 — SELECTED. A quiet glyph in the callout: recognisable, not loud.
    It is a full control rather than an icon-shaped decoration, because a reader
    who already knows what Watch is should be able to reach it here.
  */
  if (stage === 'SELECTED') {
    return (
      <button
        type="button"
        data-gn="watch-cta"
        data-gn-stage={stage}
        data-gn-running={running ? 'true' : 'false'}
        onClick={onOpenComposer}
        title={labels.description}
        aria-label={labels.glyph}
        className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[2px] border border-sp-watch-line/60 text-sp-watch outline-none transition-[color,background-color,border-color] duration-[160ms] hover:bg-sp-watch-dim focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sp-watch"
      >
        {/* A ring, not a bell: the mark means "running", not "notify me". */}
        <span aria-hidden="true" className="block h-[9px] w-[9px] rounded-full border-[1.5px] border-current" />
      </button>
    );
  }

  /*
    STAGES 3 and 4 — the same element, the same position, two treatments.

    OPENED     outline mint, full width, EQUAL weight with Follow and Ask
    UNDERSTOOD filled mint, sole primary — dominant only now that it is earned
  */
  return (
    <button
      type="button"
      data-gn="watch-cta"
      data-gn-stage={stage}
      data-gn-sole-primary={solePrimary ? 'true' : 'false'}
      data-gn-running={running ? 'true' : 'false'}
      onClick={onOpenComposer}
      title={labels.description}
      className={`flex min-h-[44px] w-full items-center justify-center gap-[8px] rounded-[2px] px-[10px] py-[11px] font-gn-mono text-[10px] uppercase tracking-[0.14em] outline-none transition-[color,background-color,border-color] duration-[220ms] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-watch ${
        solePrimary
          ? 'border border-sp-watch bg-sp-watch font-semibold text-[#04140d] hover:bg-[#6ee9b6]'
          : 'border border-sp-watch-line text-sp-watch hover:bg-sp-watch-dim'
      }`}
    >
      <span
        aria-hidden="true"
        className={`block h-[8px] w-[8px] rounded-full ${
          solePrimary ? 'bg-[#04140d]' : 'border-[1.5px] border-current'
        }`}
      />
      {labels.watch}
    </button>
  );
}
