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
}: {
  readonly locale: DisplayLocale;
  /** Entry state only. The answered workspace is out of this contract's scope. */
  readonly enabled: boolean;
  readonly compact?: boolean;
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

  /* prefers-reduced-motion is a MOTION preference: the examples still rotate, they simply do
     not move or fade. The pause mechanisms the reader has are focus and typing, and those
     exist for everyone. */
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

  const onFocus = useCallback(() => dispatch({ type: 'FOCUS', now: Date.now() }), []);
  const onBlur = useCallback(() => dispatch({ type: 'BLUR', now: Date.now() }), []);
  const onValue = useCallback(
    (value: string) => dispatch({ type: 'VALUE', now: Date.now(), value }),
    [],
  );
  const onUse = useCallback(() => dispatch({ type: 'USE_EXAMPLE', now: Date.now() }), []);

  const example = exampleForCursor(queue, state.cursor);
  const visible = enabled && state.visible && example !== undefined;

  return {
    text: visible && example !== undefined ? exampleText(example, locale, compact) : null,
    id: visible && example !== undefined ? example.id : null,
    visible,
    animate: visible && !reducedMotion,
    generation: generation.current,
    onFocus,
    onBlur,
    onValue,
    onUse,
  };
}
