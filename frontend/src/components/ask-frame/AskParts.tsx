'use client';

import type { IsolatedAutoProps, IsolatedRunProps } from '@/lib/ask/askDirection';
/*
  R1-C's overlay geometry is Claude Design's, down to the pixel, and belongs in the stylesheet
  beside the rest of the composer rather than as literals here. This is the one stylesheet import
  this module takes; every other value it draws still comes in as a prop.
*/
import styles from './askDashboard.module.css';
import { useRef, type JSX } from 'react';
import { AdaptiveTextarea } from '@/components/ui/AdaptiveTextarea';
import {
  AskQuestionLimitNote,
  askQuestionLimitState,
  type AskQuestionLimitCopy,
} from '@/components/ask/AskQuestionLimit';

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
  /**
   * SUPERSEDED BY PRODUCT OWNER / ASK RELIABILITY R1 §8 — these two described the example while
   * it was a real control ("Accessible name of the control, in the reader's language" and "Take
   * the example into the composer. Never submits (section 9)"). §8 ruled the example is visible
   * GUIDANCE ONLY: plain `aria-hidden` text that is not clickable or focusable. CLAUDE DESIGN R3
   * §11 (R1-C) confirms it — "Not clickable, never submitted, never starts research." Both are
   * therefore OPTIONAL and are no longer read when rendering; they are kept in the type so a
   * later owner ruling that restores tap-to-use has somewhere to land instead of a new shape.
   */
  readonly useLabel?: string;
  readonly onUse?: () => void;
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
  /**
   * R1-C · true while the current example is fading out, before the text swaps.
   * The approved mechanism is a CSS TRANSITION on one persistent element's opacity
   * (prototype: `opacity:{{ rotorO }}; transition:opacity 400ms {{ rotorEase }}`), so this
   * drives a data attribute rather than replaying a keyframe animation.
   */
  readonly fading?: boolean;
  /**
   * Changes on every rotation.
   *
   * SUPERSEDED BY CLAUDE DESIGN R3 §11 (R1-C) as a React `key`: it used to remount the span so a
   * keyframe animation replayed. R1-C cross-fades ONE element — out, swap, in — and a remount
   * at the swap would leave the fade-in with nothing to transition from. Kept on the interface
   * because it is still the example's change counter for proof and for a later contract.
   */
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
  exampleFocus,
  limitCopy,
  cueHint,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly inputLabel: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  /** ASK DESIGN AUTHORITY R3 (CTO ruling 3) — absent on standalone Ask: no cost line under the composer. */
  readonly costNote?: string;
  /**
   * R4 · bidi props for the cost note when it is still EN/PL copy inside an RTL scope.
   * Optional and absent by default, so a left-to-right reader's markup is unchanged. Typed
   * as the direction module's own return so no other shape can be passed here.
   */
  readonly costNoteProps?: IsolatedRunProps;
  readonly onSubmit?: () => void;
  readonly pending?: boolean;
  /** D25 04: 220 on desktop, 140 on full-screen phone / 768 portrait. */
  readonly maxHeight: 220 | 168 | 140;
  /** CENTERED COMPOSER R1 — the rotating example. Absent for every other caller. */
  readonly example?: ComposerExample;
  /**
   * R3 INTEGRATION (Claude Code) — the rotation's focus / blur, wired for as long as rotation
   * runs. They used to travel inside `example`, which is undefined while the example is hidden
   * — and focus hides it — so the field lost its onBlur and BLUR never arrived: after one focus
   * the example never came back (R1-C: "blur restores a full hold"). Measured in a real browser.
   */
  readonly exampleFocus?: { readonly onFocus: () => void; readonly onBlur: () => void };
  /** ASK R2 — the documented input limit's copy (askR2Strings); the limit itself is shared. */
  readonly limitCopy: AskQuestionLimitCopy;
  /* ASK R3 IA + DISCOVER R2 — the staged cue's hint, announced via aria-describedby. */
  readonly cueHint?: string | null;
}): JSX.Element {
  /* ASK R2 — the whole draft is kept; over the documented limit Send waits and says why. */
  const limit = askQuestionLimitState(value);
  const ready = !pending && value.trim().length > 0 && !limit.over && onSubmit !== undefined;
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
      {/* R1-C · `relative` so the overlay's approved insets (19 px / 54 px) are measured from the
          FIELD, which is the box Send sits in — that is what the 54 px end inset clears. */}
      <div
        className={`relative flex min-h-[56px] items-end gap-2 rounded-[14px] border bg-[var(--ask-read-answer-bg,#061a30)] py-1.5 pe-1.5 ps-4 focus-within:border-[var(--ask-read-rule-current,#5abff5)] ${
          value.trim() ? 'border-[var(--ask-read-rule-current,#5abff5)]' : 'border-[var(--ask-read-line,#1d4a73)]'
        }`}
      >
        <label className="sr-only" htmlFor="ask-frame-composer">
          {inputLabel}
        </label>
        {/* IA R2 — the guided cue's hint. It describes the staged draft; it never submits. */}
        {cueHint && (
          <p id="ask-frame-cue-hint" data-ask="cue-hint" className="sr-only">
            {cueHint}
          </p>
        )}
        <div className="relative flex min-w-0 flex-1 self-center">
          <AdaptiveTextarea
            id="ask-frame-composer"
            data-ask="composer-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={exampleFocus?.onFocus ?? example?.onFocus}
            onBlur={exampleFocus?.onBlur ?? example?.onBlur}
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
            aria-invalid={limit.over ? true : undefined}
            /* IA R2 — the cue hint joins the limit message rather than replacing it; the limit
               is listed first so an over-limit reader hears the blocking fact first. */
            aria-describedby={
              [limit.near || limit.over ? 'ask-frame-composer-limit' : null, cueHint ? 'ask-frame-cue-hint' : null]
                .filter((id): id is string => id !== null)
                .join(' ') || undefined
            }
            minHeight={32}
            maxHeight={maxHeight}
            maxViewportFraction={0.4}
            keepVisible
            className="w-full min-w-0 flex-1 bg-transparent py-1.5 text-[16px] leading-[1.45] text-[var(--ad-ink,#edeff5)] placeholder:text-[var(--ask-read-ink3,#6f89a8)] focus:outline-none"
          />
        </div>
          {showExample && example !== undefined && (
            /*
              THE ROTATING EXAMPLE (sections 5, 9, 15).
              · SUPERSEDED BY PRODUCT OWNER / ASK RELIABILITY R1 §8 — this bullet ended "only the
                WORDS are clickable, which is precisely 'the reader taps the visible example'".
                Nothing here is clickable now. The layer takes no pointer events and neither do
                the words, so a tap anywhere in the field — including straight through the
                example — focuses the composer. R1-C: "`pointer-events: none`; tapping it focuses
                the field underneath as normal."
              · SUPERSEDED BY PRODUCT OWNER / ASK RELIABILITY R1 §8 — this bullet read "It is a
                real <button>, keyboard reachable, named by a visually hidden verb phrase plus
                the question, so a screen reader hears what activating it does." §8 ruled the
                example is guidance only; it is now the `aria-hidden` span below and there is no
                control here at all. CLAUDE DESIGN R3 §11 confirms it.
              · There is NO aria-live region. The example changes every few seconds; a live
                region would announce it every few seconds — R1-C: "never an unsolicited
                screenreader announcement". Rotation also PAUSES on focus, STOPS on typing and
                freezes while the tab is hidden, so the example a reader is reading never
                changes under them. The field's accessible name comes from its own `sr-only`
                label (`inputLabel`) and never from the example, so it is stable.
            */
            /*
              R1-C · the approved overlay geometry, verbatim from the package: "an `aria-hidden`
              overlay span positioned over the first text line (inline-start 19 px, inline-end
              54 px to clear Send), `white-space: nowrap; text-overflow: ellipsis`, same font as
              the input, `--ink-3`". The prototype writes it as
              `position:absolute; inset-inline-start:19px; inset-inline-end:54px; top:1px;
              height:50px; display:flex; align-items:center; pointer-events:none`.

              The insets are logical, so RTL mirrors without a second rule, and the 54 px end
              inset is what keeps a long example from running under Send.
            */
            <div
              data-ask="composer-example-layer"
              className={styles.composerExampleLayer}
            >
              {/* ASK RELIABILITY R1 (§8) — Product Owner instruction: a sample question shown inside
                  the input is visible GUIDANCE ONLY. It is plain text: not clickable, not
                  focusable, never fills, submits, navigates or steals focus. A tap goes straight
                  through it to the composer (the layer takes no pointer events). */}
              <span
                data-ask="composer-example"
                data-ask-example-id={example.id}
                data-ask-example-fading={example.fading === true ? 'true' : 'false'}
                aria-hidden="true"
                className={`${styles.composerExampleText} ${example.animationClass ?? ''}`}
                {...(example.directionProps ?? {})}
              >
                {example.text}
              </span>
            </div>
          )}
        <button
          type="submit"
          data-ask="send"
          disabled={!ready}
          data-ask-ready={ready ? 'true' : 'false'}
          /* ASK DESIGN COMPLETENESS R1 — colour comes from the Design tokens (askDashboard.module.css):
             no literal palette class here, so no theme adapter can repaint the Design's send. */
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[10px] px-[18px] text-[14px] font-bold"
        >
          {/*
            ASK DESIGN COMPLETENESS R1 — the Design's 44 px round send: an arrow mark, the label
            still the button's accessible name (visually hidden inside the frame's stylesheet,
            visible everywhere this primitive is reused without it).
          */}
          {submitLabel}
          <span aria-hidden="true" data-ask="send-glyph">↑</span>
        </button>
      </div>
      <AskQuestionLimitNote id="ask-frame-composer-limit" state={limit} copy={limitCopy} />
      {costNote !== undefined && (
        <p
          data-ask="cost-note"
          className="text-[0.75rem] leading-[1.3] text-[var(--ask-read-ink3,#6f89a8)]"
          {...(costNoteProps ?? {})}
        >
          {costNote}
        </p>
      )}
    </form>
  );
}
