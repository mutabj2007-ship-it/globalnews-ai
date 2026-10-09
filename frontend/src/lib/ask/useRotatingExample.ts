'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { QUESTION_EXAMPLES, exampleText } from './askQuestionExamples';
import {
  EXAMPLE_ROTATION,
  buildExampleQueue,
  exampleForCursor,
  initialRotationState,
  rotationReducer,
  rotationSeed,
  type RotationEvent,
  type RotationState,
} from './askExampleRotation';

/**
 * STANDALONE CENTERED COMPOSER R1 — the driver. Plumbing only: it owns a timer, a seed and a
 * media query, and defers every decision to `rotationReducer`. Keeping the rules in the pure
 * module is what lets the acceptance criteria be tested as behaviour instead of as source text.
 *
 * CLAUDE DESIGN R3 §11 (Welcome R1-C) adds two of the driver's three observations: the hidden
 * tab, and the caller-declared overlay. The third, reduced motion, changed meaning rather than
 * mechanism — see the superseded note on `reducedMotion` below.
 */
export interface RotatingExample {
  /** The text to show inside the empty composer, or null when nothing should be shown. */
  readonly text: string | null;
  /** The example's canonical id — for proof and for a later contract's analytics, not for display. */
  readonly id: string | null;
  /** False once the reader types, takes the example, or rotation is disabled. */
  readonly visible: boolean;
  /** True only when a soft transition should run: a change happened AND motion is allowed. */
  readonly animate: boolean;
  /** Bumped on every change so the view can key its transition. */
  readonly generation: number;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
  /** Call with the composer's value on every change. The value is read, never written. */
  readonly onValue: (value: string) => void;
  /** Call when the reader took the visible example into the composer. */
  readonly onUse: () => void;
}

export function useRotatingExample({
  locale,
  enabled,
  compact = false,
  suspended = false,
}: {
  readonly locale: DisplayLocale;
  /** Entry state only. The answered workspace is out of this contract's scope. */
  readonly enabled: boolean;
  readonly compact?: boolean;
  /**
   * CLAUDE DESIGN R3 §11 (R1-C) — "Stops immediately on focus, typing, keyboard, overlays or
   * hidden tab". The hidden tab this hook observes itself; an OVERLAY is the caller's own
   * knowledge, so the caller says so here. The current example is frozen, not cleared, exactly
   * as on focus.
   */
  readonly suspended?: boolean;
}): RotatingExample {
  /*
    The seed is drawn ONCE, in the browser, after mount. During server render and the first
    client render there is no seed, so both produce the catalogue's first example and the
    entry view hydrates clean.
  */
  const [seed, setSeed] = useState<number | null>(null);
  useEffect(() => setSeed(rotationSeed()), []);

  const queue = useMemo(() => buildExampleQueue(QUESTION_EXAMPLES, seed ?? 1), [seed]);

  const [state, dispatch] = useReducer(
    (current: RotationState, event: RotationEvent) => rotationReducer(current, event, queue.length),
    undefined,
    /*
      The first example dwells its FULL term: seeding `shownAt` with 0 would have made the
      very first deadline already past, and the entry view would have swapped examples a
      quarter-second after it appeared. `shownAt` is never rendered, so reading the clock here
      cannot cause a hydration mismatch — only the EXAMPLE is render-visible, and that is
      fixed for every seed.
    */
    () => initialRotationState(Date.now()),
  );

  const generation = useRef(0);
  if (state.changed) generation.current += 1;

  /*
    SUPERSEDED BY PRODUCT OWNER / CLAUDE DESIGN R3 §11 (Welcome R1-C, 9 Oct 2026).

    The superseded position, kept here on the record in full because its reasoning was sound and
    is the reason this reversal needed an owner's decision rather than an engineer's:

      "prefers-reduced-motion is a MOTION preference: the examples still rotate, they simply do
       not move or fade. The pause mechanisms the reader has are focus and typing, and those
       exist for everyone."

    R1-C rules the other way, and the difference is WHERE the example now sits. Behind that
    reasoning the example was a line of guidance beside the field, and a line of guidance that
    changes its words without moving is a reasonable thing to show someone who asked only for
    less motion. R1-C puts the example INSIDE the composer, in the placeholder's own slot: text
    that replaces itself every few seconds in the field a reader is about to type into is a
    change of CONTENT under the caret, not a transition, and it is not something a reduced-motion
    reader opted into by asking for fewer transitions.

    So under reduced motion there is no rotation at all — `visible` is false, the composer falls
    back to its own static placeholder ("Ask anything…", `askR2Strings.read.placeholderFirst`,
    qualified in all seven locales), and no new string is introduced for it. Focus and typing
    remain everyone's pause mechanisms, as before.
  */
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (query === undefined) return;
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  /*
    ONE TIMEOUT PER DUE MOMENT, NOT A HEARTBEAT.

    The first version polled the machine every 250 ms. It worked, but it woke the page
    sixteen times per example to discover that nothing was due, and it kept firing inside
    component specs that mount the frame and never unmount — logging act() warnings into
    other lanes' suites. Because the machine is time-based, the driver can compute the next
    deadline and sleep exactly that long: ~1 wake per example instead of ~16, and nothing
    pending when there is nothing to do.
  */
  const deadline =
    state.phase === 'ROTATING'
      ? state.shownAt + EXAMPLE_ROTATION.dwellMs
      : state.phase === 'RESUMING'
        ? (state.resumeAt ?? null)
        : null;

  useEffect(() => {
    if (!enabled || deadline === null) return;
    const wait = Math.max(EXAMPLE_ROTATION.tickMs, deadline - Date.now());
    const timer = window.setTimeout(() => dispatch({ type: 'TICK', now: Date.now() }), wait);
    return () => window.clearTimeout(timer);
  }, [enabled, deadline]);

  /*
    R1-C — THE HIDDEN TAB, and the overlay the caller declares.

    One effect drives both, because the machine treats them identically: the example freezes and
    the dwell restarts when the reader can see it again. `document.visibilityState` is read on
    every run, so a `suspended` change while the tab is already hidden cannot resume rotation.

    The on-screen KEYBOARD needs nothing here. It cannot open over this composer without the
    composer being focused, and focus already freezes the example (`FOCUS` → `PAUSED_FOCUS`).
    This hook deliberately does NOT observe `visualViewport`: that is the approved iPhone 13 Pro
    Max keyboard path in `AskFrameScreen`, and the CTO's directive is to preserve it exactly.
  */
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const read = (): void => {
      const away = suspended || document.visibilityState === 'hidden';
      dispatch({ type: away ? 'SUSPEND' : 'RESUME', now: Date.now() });
    };
    read();
    /*
      The listener is OPTIONAL, exactly as `matchMedia` is above. A host that renders the frame
      without a full DOM — the frame's own component specs build a minimal `document` for
      `react-test-renderer` — has no listener API, and asking for one there threw. The
      caller-declared `suspended` rule still applies in those hosts; only the tab-hidden half of
      R1-C needs the event, and where it cannot be observed the example simply keeps its own
      dwell. Nothing is assumed about the host beyond what it offers.
    */
    if (typeof document.addEventListener !== 'function') return;
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener?.('visibilitychange', read);
  }, [enabled, suspended]);

  const onFocus = useCallback(() => dispatch({ type: 'FOCUS', now: Date.now() }), []);
  const onBlur = useCallback(() => dispatch({ type: 'BLUR', now: Date.now() }), []);
  const onValue = useCallback(
    (value: string) => dispatch({ type: 'VALUE', now: Date.now(), value }),
    [],
  );
  const onUse = useCallback(() => dispatch({ type: 'USE_EXAMPLE', now: Date.now() }), []);

  const example = exampleForCursor(queue, state.cursor);
  /* R1-C — reduced motion shows no example at all; see the superseded note above. */
  const visible = enabled && !reducedMotion && state.visible && example !== undefined;

  return {
    text: visible && example !== undefined ? exampleText(example, locale, compact) : null,
    id: visible && example !== undefined ? example.id : null,
    visible,
    /* Nothing visible is ever un-animated now: under reduced motion nothing is visible. */
    animate: visible,
    generation: generation.current,
    onFocus,
    onBlur,
    onValue,
    onUse,
  };
}
