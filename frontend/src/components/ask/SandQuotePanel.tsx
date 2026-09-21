'use client';

import type { SandQuote } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §9 — the pre-execution quote panel.
 *
 * §9 shows the target exactly:
 *
 *   ────────────────────────
 *   Deep Analysis
 *   24 Sand
 *   ────────────────────────
 *   Cancel     Run Analysis
 *
 * EVERY VALUE ON THIS PANEL COMES FROM THE SERVER. The component
 * performs no Sand arithmetic, holds no price table, and does not
 * know what a Deep Analysis costs — it renders `quote.quotedSand` and
 * `quote.label` as given. §8: "Do not hard-code Sand prices
 * throughout React components. One backend/config authority must own
 * pricing."
 *
 * The charging-off notice is likewise driven by the server's own
 * `chargingEnabled` flag rather than a build-time constant, so the
 * panel can never tell a user they will not be charged while the
 * backend is configured to charge them.
 */
export function SandQuotePanel({
  quote,
  onConfirm,
  onCancel,
  busy,
}: {
  quote: SandQuote;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}): JSX.Element {
  return (
    <section
      // role="group" + an accessible name so a screen reader announces
      // this as one decision rather than as loose text followed by two
      // unexplained buttons.
      role="group"
      aria-label={`${quote.label} requires confirmation`}
      className="rounded-2xl border border-border-strong bg-surface-raised p-5 shadow-lg"
    >
      <p className="font-display text-base text-ink-primary">{quote.label}</p>

      <p className="mt-1 font-mono text-2xl text-ice">
        {quote.quotedSand} <span className="text-base text-ink-secondary">Sand</span>
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
        This question needs substantially more computation than an ordinary answer, so it is
        metered. Nothing runs until you confirm.
      </p>

      {!quote.chargingEnabled && (
        <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink-tertiary">
          Sand charging is off during Beta — confirming will not deduct anything.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {/* Cancel is first in DOM order so keyboard and screen-reader
            users reach the non-destructive, non-spending option first. */}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-[44px] flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-ink-secondary transition-colors hover:border-border-strong hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="min-h-[44px] flex-1 rounded-xl bg-signal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-signal-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Run Analysis'}
        </button>
      </div>
    </section>
  );
}
