'use client';

import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AdaptiveTextarea } from '@/components/ui/AdaptiveTextarea';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE HERO ASK FIELD — A REAL COMPOSER, NOT A DECORATIVE INPUT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Correction item 6:
 *
 *   "On explicit click/tap: focus the real text input immediately; place the
 *    cursor in it; expand to its usable typing state; do not navigate merely
 *    because the field received focus; do not start AI merely because the
 *    field received focus."
 *
 *   "On desktop, expansion must remain visually controlled and must not
 *    destroy Hero geometry. On phone, the same user tap must summon the
 *    software keyboard and keep the active composer visible."
 *
 * ── WHAT WAS ACTUALLY WRONG ─────────────────────────────────────────────
 *
 * The field was a bare `<input>` inside a padded wrapper. Clicking the INPUT
 * focused it, but clicking the wrapper — the icon, the padding, most of the
 * pill's area — did nothing at all, so the control read as decorative. That is
 * the regression. The fix is that the whole pill is now a focus target that
 * forwards to the real input, and the input visibly changes state when it has
 * focus.
 *
 * ── WHAT IT STILL CANNOT DO ─────────────────────────────────────────────
 *
 * Focus does NOT navigate and does NOT start anything. There is no router
 * call, no fetch and no submit handler in this file. The surrounding element
 * is still a plain GET `<form action="/ask">`: submitting navigates to /ask
 * with the text as a query, which stages a DRAFT there. The first metered
 * moment is still the reader pressing Send on /ask.
 *
 * On phone, focusing a real `<input>` is what summons the keyboard —
 * `scrollIntoView` then keeps the composer above it. The final keyboard-open
 * geometry arrives with the phone correction; this is the shared behaviour it
 * will build on.
 */
interface HeroAskFieldProps {
  placeholder: string;
  ariaLabel: string;
  buttonLabel: string;
  hint: string;
}

export function HeroAskField({ placeholder, ariaLabel, buttonLabel, hint }: HeroAskFieldProps): JSX.Element {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [active, setActive] = useState(false);

  /* Any press on the pill is a press on the field. Guarded so a press on the
     submit button still submits instead of being swallowed. */
  const focusInput = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    /* A press on the submit button must still submit. */
    if (target.closest('button') !== null) return;
    /* A press on the input itself already lands there — and letting the
       browser handle it is what preserves caret placement by click position. */
    if (target.tagName === 'TEXTAREA') return;
    /*
      THE ACTUAL BUG THIS FIXES.

      Calling focus() on mousedown is not enough: the browser's own default
      action for mousedown then moves focus to whatever was pressed. The pill's
      padding and icon are not focusable, so focus landed on <body> and the
      field stayed dead — measured, with activeElement reading BODY after a
      press on the pill's left padding.

      Preventing the default stops that reassignment, so the focus() below is
      the one that sticks.
    */
    event.preventDefault();
    inputRef.current?.focus();
  }, []);

  // Keyboard clearance and smooth content growth are owned by AdaptiveTextarea.
  // This surface owns one additional rule: expansion must float OVER the Hero
  // rather than change the Hero's document-flow height.

  const collapseAfterBlur = (): void => {
    setActive(false);
    const node = inputRef.current;
    if (node === null) return;
    const collapsed = window.innerWidth >= 1024 ? 32 : 44;
    node.style.height = `${collapsed}px`;
    node.style.maxHeight = `${collapsed}px`;
    node.style.overflowY = 'hidden';
  };

  return (
    <>
      {/*
        A GET form with no handler: it navigates, it does not compute.
        `autoComplete="off"` keeps a previous question from reappearing as if
        it were live context.
      */}
      <form
        action="/ask"
        method="get"
        role="search"
        aria-label={ariaLabel}
        className="relative z-30 mt-3.5 h-[54px] w-full max-w-[506px] overflow-visible xl:h-[42px]"
      >
        <div
          onMouseDown={focusInput}
          data-gn-hero-composer-overlay=""
          className={`absolute inset-x-0 top-0 z-50 flex w-full items-end gap-2 rounded-[14px] border bg-[linear-gradient(180deg,#17335b_0%,#112750_100%)] p-[5px] pl-[13px] transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none ${
            active
              ? 'border-[#4f9fe6] shadow-[inset_0_1px_0_rgba(150,200,255,0.16),0_0_0_3px_rgba(59,141,251,0.20),0_18px_40px_-22px_rgba(0,0,0,0.9)]'
              : 'border-[#1b3a68] shadow-[inset_0_1px_0_rgba(150,200,255,0.10),0_16px_36px_-22px_rgba(0,0,0,0.9)]'
          }`}
        >
          <Sparkles size={17} strokeWidth={1.85} aria-hidden="true" className="shrink-0 text-[#9db8dd]" />
          <AdaptiveTextarea
            ref={inputRef}
            name="q"
            autoComplete="off"
            placeholder={placeholder}
            aria-label={ariaLabel}
            maxLength={1000}
            minHeight={32}
            maxHeight={280}
            maxViewportFraction={0.42}
            keepVisible
            onFocus={() => setActive(true)}
            onBlur={collapseAfterBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className={`min-h-[44px] min-w-0 flex-1 bg-transparent py-1 text-white outline-none transition-[height,font-size] duration-200 placeholder:text-[#7e99ba] motion-reduce:transition-none lg:min-h-[32px] ${
              active ? 'text-[16px] lg:text-[15px]' : 'text-[15px] lg:text-[14px]'
            }`}
          />
          <button
            type="submit"
            aria-label={buttonLabel}
            className="flex h-[44px] min-w-[76px] shrink-0 items-center justify-center rounded-[11px] bg-[linear-gradient(180deg,#3b8dfb_0%,#1f6ae0_100%)] px-4 text-[14px] font-bold text-white shadow-[0_0_18px_-2px_rgba(59,141,251,0.85)] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 motion-reduce:transition-none motion-reduce:hover:scale-100 lg:h-[44px] lg:w-[44px] lg:min-w-0 lg:rounded-full lg:px-0 lg:hover:scale-105 xl:h-[30px] xl:w-[30px]"
          >
            <span aria-hidden="true" className="lg:hidden">
              {buttonLabel}
            </span>
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" className="hidden lg:block" />
          </button>
        </div>
      </form>

      {/* The metered-cost disclosure. Approved copy, stated before the spend. */}
      <p className="mt-2 flex max-w-xl items-start gap-1.5 text-[11px] leading-snug text-ink-tertiary">
        <span aria-hidden="true" className="mt-[2px] shrink-0 text-amber-300">
          &#9889;
        </span>
        <span>{hint}</span>
      </p>
    </>
  );
}
