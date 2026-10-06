'use client';

import type { IsolatedAutoProps, IsolatedRunProps } from '@/lib/ask/askDirection';
import { useRef, type JSX } from 'react';
import { AdaptiveTextarea } from '@/components/ui/AdaptiveTextarea';

/**
 * ASK R2 CLAUDE DESIGN RECONCILIATION R1 — presentation primitives of the frozen D25
 * authority (GNAI_ASK_INTELLIGENCE_WORKSPACE_R2_FINAL_DESIGN_AUTHORITY_D25, SHA256
 * 4ca6c22d9e995901b9b61fd5e55080885913138d9877c296ed8acfd21399ed53). The v1.8 dashboard
 * primitives (Situation context, five absent suggestion rows, Watch, Recent alerts) are
 * not in D25's idle state and are gone; D25 01 lists every region the workspace has.
 */

/**
 * D25 micro label — the eyebrow every Ask section carries. ASK READING EXPERIENCE R1: reading
 * type (sans, 12px) in the reading token, no longer 11px monospace caps.
 */
export const ASK_EYEBROW =
  'text-[0.75rem] font-semibold leading-none tracking-[0.04em] text-[var(--ask-read-ink2,#8fa6c0)]';

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
      className="mt-3 flex flex-col gap-1.5 rounded-[10px] border border-[var(--ask-read-line-soft,#0e2d4d)] bg-[var(--ask-read-sunk,#03152a)] p-3.5"
    >
      <h2 className={ASK_EYEBROW}>{label}</h2>
      <p data-ask="statement" className="text-[13px] leading-[1.55] text-[var(--ask-read-ink2,#b6c9de)]">
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
/**
 * TRUST R1 — a fine pointer (mouse / trackpad) means a physical keyboard: Enter sends.
 *
 * CROSS-PLATFORM FUNCTIONAL PARITY ADDENDUM — widened from `(pointer: fine)` to
 * `(any-pointer: fine)`. The addendum requires that a PHYSICAL KEYBOARD ATTACHED TO A PHONE
 * OR TABLET gets `Enter = Ask` and `Shift+Enter = newline`, exactly as a laptop does. On a
 * tablet with a keyboard case the PRIMARY pointer is still coarse (the touchscreen), so
 * `(pointer: fine)` answered false and the reader was denied Enter on a real keyboard —
 * precisely the downgrade the addendum forbids. `any-pointer` asks whether ANY available
 * pointer is fine, which a keyboard case's trackpad is.
 *
 * A keyboard with no pointer at all is covered separately, by observed evidence — see
 * `physicalKeyboardEvidence`.
 */
export function enterSends(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(any-pointer: fine)').matches === true ||
    window.matchMedia?.('(pointer: fine)').matches === true
  );
}

/**
 * CROSS-PLATFORM PARITY — DID THIS KEYSTROKE COME FROM A KEYBOARD A SOFT KEYBOARD CANNOT BE?
 *
 * The remaining case is a phone or tablet with a Bluetooth keyboard and no pointing device:
 * no media query can see it, and a hardware Enter is indistinguishable from a virtual one.
 * What IS distinguishable is everything else on a physical keyboard. A software keyboard
 * cannot produce Tab, an arrow key, a Control/Alt/Meta chord, or Shift+Enter. The first time
 * one of those arrives in the composer, a physical keyboard is attached as a matter of fact,
 * not of inference — and from then on Enter sends there too.
 *
 * Deliberately conservative: it can only ever ENABLE Enter-to-send, never withdraw it, and
 * until the evidence appears the reader still has the Ask button, which is the same submit
 * handler. No fingerprinting, nothing stored, nothing sent anywhere.
 */
export function physicalKeyboardEvidence(event: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) return true;
  if (event.key === 'Tab' || event.key === 'Escape') return true;
  if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') return true;
  return event.key === 'Enter' && event.shiftKey;
}

/**
 * CENTERED COMPOSER R1 — THE KEYBOARD RULING, AS A PURE DECISION.
 *
 * Contract section 10 makes Enter load-bearing: on a desktop keyboard it must be EXACTLY the
 * Ask button's action — same validation, same operation, same quota path, same disabled and
 * loading behaviour, same errors — and section 11 forbids a visible rotating example from
 * ever being submitted. Both were already true of the released composer, but they were true
 * inside an inline event handler, where the only available proof was a regex over the source.
 *
 * The behaviour is unchanged and moved here so it can be asserted as behaviour:
 *   'SUBMIT'  — ask the FORM to submit. The Ask button is `type="submit"` in the same form,
 *               so there is exactly ONE submit pipeline, not an Enter route beside it.
 *   'SUPPRESS'— swallow the keystroke: a desktop Enter must not insert a newline, but there
 *               is nothing to send (empty value, or a question already in flight). THIS is
 *               the branch that makes a visible rotating example un-submittable: the example
 *               is a suggestion, so the value is still empty and `ready` is still false.
 *   'DEFAULT' — let the browser do its normal thing: Shift+Enter and touch keyboards insert
 *               a newline, and an IME confirmation stays with the IME.
 */
export type ComposerKeyAction = 'SUBMIT' | 'SUPPRESS' | 'DEFAULT';

export function composerKeyAction(input: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly isComposing: boolean;
  readonly enterSends: boolean;
  /** Non-empty trimmed value, not pending, and a submit handler exists. */
  readonly ready: boolean;
}): ComposerKeyAction {
  if (input.key !== 'Enter' || input.shiftKey || input.isComposing) return 'DEFAULT';
  if (!input.enterSends) return 'DEFAULT';
  return input.ready ? 'SUBMIT' : 'SUPPRESS';
}

/**
 * The rotating example, as the composer needs it. Supplied by `useRotatingExample`; absent
 * everywhere this contract does not reach, so every other caller's markup is unchanged.
 */
export interface ComposerExample {
  readonly text: string;
  /** Canonical catalogue id — proof and future analytics, never display. */
  readonly id: string;
  /** Accessible name of the control, in the reader's language. */
  readonly useLabel: string;
  /** Take the example into the composer. Never submits (section 9). */
  readonly onUse: () => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
  /**
   * The transition class, or undefined when the reader prefers reduced motion.
   *
   * Passed IN rather than imported here: this module stays free of the CSS-module import so
   * it can be unit-tested directly, and the frame — which already owns the stylesheet —
   * decides whether motion is allowed.
   */
  readonly animationClass?: string;
  /** Changes on every rotation so the transition replays. */
  readonly generation: number;
  /** Direction props for the example's own run, from the shared direction module. */
  readonly directionProps?: IsolatedAutoProps | IsolatedRunProps;
}

export function Composer({
  value,
  onChange,
  inputLabel,
  placeholder,
  submitLabel,
  costNote,
  costNoteProps,
  onSubmit,
  pending = false,
  maxHeight,
  example,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly inputLabel: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly costNote: string;
  /**
   * R4 · bidi props for the cost note when it is still EN/PL copy inside an RTL scope.
   * Optional and absent by default, so a left-to-right reader's markup is unchanged. Typed
   * as the direction module's own return so no other shape can be passed here.
   */
  readonly costNoteProps?: IsolatedRunProps;
  readonly onSubmit?: () => void;
  readonly pending?: boolean;
  /** D25 04: 220 on desktop, 140 on full-screen phone / 768 portrait. */
  readonly maxHeight: 220 | 140;
  /** CENTERED COMPOSER R1 — the rotating example. Absent for every other caller. */
  readonly example?: ComposerExample;
}): JSX.Element {
  const ready = !pending && value.trim().length > 0 && onSubmit !== undefined;
  /*
    CROSS-PLATFORM PARITY — latched evidence of a physical keyboard. A ref, not state: it must
    not re-render, and it only ever turns on.
  */
  const physicalKeyboard = useRef(false);
  /*
    The example occupies the placeholder's position, so the native placeholder stands down
    while one is shown — two hints in one slot is noise, and the empty-state heading above
    the composer already carries the hint.
  */
  const showExample = example !== undefined && value.length === 0;
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
        className={`flex min-h-[56px] items-end gap-2 rounded-[14px] border bg-[var(--ask-read-answer-bg,#061a30)] py-1.5 pe-1.5 ps-4 focus-within:border-[var(--ask-read-rule-current,#5abff5)] ${
          value.trim() ? 'border-[var(--ask-read-rule-current,#5abff5)]' : 'border-[var(--ask-read-line,#1d4a73)]'
        }`}
      >
        <label className="sr-only" htmlFor="ask-frame-composer">
          {inputLabel}
        </label>
        <div className="relative flex min-w-0 flex-1 self-center">
          <AdaptiveTextarea
            id="ask-frame-composer"
            data-ask="composer-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={example?.onFocus}
            onBlur={example?.onBlur}
            onKeyDown={(event) => {
              /* Observed first, so the very keystroke that proves a keyboard also counts. */
              if (physicalKeyboardEvidence(event)) physicalKeyboard.current = true;
              /* TRUST R1 / CENTERED COMPOSER R1 §10–§11 — one decision, one pipeline. Enter
                 sends on a desktop keyboard; Shift+Enter, a touch keyboard and an IME
                 confirmation keep a new line; an empty box (a visible rotating example is
                 still an empty box), a question in flight, or no handler sends nothing. */
              const action = composerKeyAction({
                key: event.key,
                shiftKey: event.shiftKey,
                isComposing: event.nativeEvent.isComposing,
                enterSends: enterSends() || physicalKeyboard.current,
                ready,
              });
              if (action === 'DEFAULT') return;
              event.preventDefault();
              /* The SAME form submit the Ask button triggers — never a parallel send path. */
              if (action === 'SUBMIT') event.currentTarget.form?.requestSubmit();
            }}
            placeholder={showExample ? '' : placeholder}
            maxLength={1000}
            minHeight={32}
            maxHeight={maxHeight}
            maxViewportFraction={0.4}
            keepVisible
            className="w-full min-w-0 flex-1 bg-transparent py-1.5 text-[16px] leading-[1.45] text-white placeholder:text-[var(--ask-read-ink3,#6f89a8)] focus:outline-none"
          />
          {showExample && example !== undefined && (
            /*
              THE ROTATING EXAMPLE (sections 5, 9, 15).
              · The layer itself takes no pointer events, so clicking anywhere else in the
                field focuses the composer exactly as before; only the WORDS are clickable,
                which is precisely "the reader taps the visible example".
              · It is a real <button>, keyboard reachable, named by a visually hidden verb
                phrase plus the question, so a screen reader hears what activating it does.
              · There is NO aria-live region. The example changes every few seconds; a live
                region would announce it every few seconds. Rotation also PAUSES on focus, so
                the example a reader is reading never changes under them.
            */
            <div
              data-ask="composer-example-layer"
              className="pointer-events-none absolute inset-0 flex items-center"
            >
              {/* ASK RELIABILITY R1 (§8) — Product Owner instruction: a sample question shown inside
                  the input is visible GUIDANCE ONLY. It is plain text: not clickable, not
                  focusable, never fills, submits, navigates or steals focus. A tap goes straight
                  through it to the composer (the layer takes no pointer events). */}
              <span
                data-ask="composer-example"
                data-ask-example-id={example.id}
                key={example.generation}
                aria-hidden="true"
                className={`max-w-full select-none truncate text-start text-[16px] leading-[1.45] text-[var(--ask-read-ink3,#6f89a8)] ${
                  example.animationClass ?? ''
                }`}
                {...(example.directionProps ?? {})}
              >
                {example.text}
              </span>
            </div>
          )}
        </div>
        <button
          type="submit"
          data-ask="send"
          disabled={!ready}
          className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[10px] border border-[#1b6fa8] px-[18px] text-[14px] font-bold text-[#e6f5ff] ${
            ready ? 'bg-[#0a6bd6]' : 'bg-[var(--ask-read-sunk,#07304f)] opacity-55'
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
      <p
        data-ask="cost-note"
        className="text-[0.75rem] leading-[1.3] text-[var(--ask-read-ink3,#6f89a8)]"
        {...(costNoteProps ?? {})}
      >
        {costNote}
      </p>
    </form>
  );
}
