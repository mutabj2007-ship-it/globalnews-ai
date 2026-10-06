import type { JSX } from 'react';

/**
 * ASK READING EXPERIENCE R1 — THE TRUTHFUL WORKING STATE (H-FREEZE §5, STATE-MATRIX §1).
 *
 * This replaces `LoadingStages` on the Ask surface. That component advanced four retrieval
 * labels ("Searching trusted sources…", "Comparing coverage…") on a 1.8 s client timer that
 * knew nothing of the request — so it could claim a news search for a calculation, or claim
 * the analysis was being prepared while the server was still deciding what to do.
 *
 * The client receives no progress events (Design dependency D1), so the only true thing it can
 * say is that the request is being worked on: one neutral line, no stage, no percentage, no
 * timer. When a real progress channel exists its events may replace this line; until then
 * nothing here may imply work that is not known to be happening. The accent dot is static —
 * motion carries no information, so reduced motion loses nothing.
 */
export function AskWorkingStatus({ label }: { readonly label: string }): JSX.Element {
  return (
    <div
      data-ask="working"
      role="status"
      aria-live="polite"
      className="mt-3 flex items-center gap-2.5 text-[0.9375rem] leading-[1.5] text-[var(--ask-read-ink2,#9fb4cc)]"
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--ask-read-rule-current,#5abff5)]"
      />
      <span>{label}</span>
    </div>
  );
}
