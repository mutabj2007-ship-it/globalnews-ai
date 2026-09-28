'use client';

import { useEffect, useRef } from 'react';
import { askR2Strings, type AskR2Locale } from '@/lib/ask/askR2Strings';
import { resolveAskStrings } from '@/lib/ask/askStrings';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE G — "RUN DEEPER ANALYSIS?" (D25 10).
 *
 * The ONLY Sand control, and it always confirms: the four named steps (governed
 * `computeSteps`), "Estimate · 24 Sand", and the fixture note that charging is off in
 * Alpha. Centred dialog at ≥1024 px; a short bounded bottom sheet below — the one kind of
 * sheet the mobile authority permits. The server already holds a QUOTE; nothing runs
 * until `onConfirm`. Escape and "Not now" release the quote.
 */
export function AskDeepConfirm({
  locale,
  onConfirm,
  onCancel,
}: {
  readonly locale: AskR2Locale;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const s = askR2Strings(locale);
  const steps = resolveAskStrings(locale).strings.computeSteps;
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      data-ask="deep-confirm-backdrop"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 lg:items-center"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-deep-title"
        data-ask="deep-confirm"
        className="w-full max-w-[520px] rounded-t-2xl border border-[#6a5634] bg-[#0f1823] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#e8eef8] lg:rounded-2xl"
      >
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[#D9B98A]">
          {s.deepEyebrow}
        </p>
        <h2 id="ask-deep-title" className="mt-1 text-[18px] font-semibold">
          {s.deepTitle}
        </h2>
        <p className="mt-2 text-[15px] leading-[1.55]">{s.deepBody}</p>
        <ol className="mt-3 list-decimal space-y-1 ps-5 text-[13px]">
          {Object.values(steps).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-[13px] font-semibold text-[#D9B98A]">{s.estimate}</p>
        <p className="mt-1 text-[12px] text-sp-ink-2">{s.deepNote}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            data-ask="deep-cancel"
            onClick={onCancel}
            className="min-h-[44px] rounded px-4 text-[14px]"
          >
            {s.notNow}
          </button>
          <button
            ref={confirmRef}
            type="button"
            data-ask="deep-run"
            onClick={onConfirm}
            className="min-h-[44px] rounded border-2 border-[#6a5634] bg-[#2e2618] px-4 text-[14px] font-semibold text-[#D9B98A]"
          >
            {s.runConfirm}
          </button>
        </div>
      </section>
    </div>
  );
}
