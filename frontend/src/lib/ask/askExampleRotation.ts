import type { DisplayLocale } from '@globalnews-ai/shared';
import {
  EXAMPLE_CAPABILITIES,
  QUESTION_EXAMPLES,
  type ExampleCapability,
  type QuestionExample,
} from './askQuestionExamples';

/**
 * STANDALONE CENTERED INTELLIGENCE COMPOSER + ROTATING QUESTION EXAMPLES R1 — THE ROTATION,
 * AS A PURE STATE MACHINE.
 *
 * Every rule the contract writes about rotation (sections 5, 8, 9, 11) is decided here, in
 * functions that take a state and an event and return a state. Nothing in this module reads
 * the DOM, starts a timer, or touches React. That is deliberate: the acceptance criteria are
 * BEHAVIOURAL ("pauses on focus", "stops on typing", "resumes after idle", "Enter does
 * nothing while the value is empty"), and behaviour asserted by a source-text regex is not
 * asserted at all. The hook that drives this is a few lines of plumbing on top.
 *
 * ZERO COMPUTE, ZERO NETWORK, ZERO PERSONALISATION (sections 16, 17): the queue is a
 * permutation of a static table, built from a seed, in the reader's browser.
 */

/**
 * THE ONE PLACE TIMING IS TUNED (section 5: "Do not hard-code timing so tightly that it
 * cannot be tuned from one constant/token").
 */
export interface RotationTiming {
  readonly dwellMs: number;
  readonly fadeMs: number;
  readonly resumeAfterClearMs: number;
  readonly tickMs: number;
}

export const EXAMPLE_ROTATION: RotationTiming = Object.freeze({
  /** Dwell per example. The contract's suggested band is 3–5 s; this sits in the middle. */
  dwellMs: 4_000,
  /** The soft transition. Restrained fade + a few pixels of rise — never a typewriter. */
  fadeMs: 420,
  /** Quiet delay before rotation resumes after the reader empties the field (band 8–15 s). */
  resumeAfterClearMs: 10_000,
  /** How often the driver asks the machine whether anything is due. */
  tickMs: 250,
});

export type RotationPhase =
  /** Advancing on the dwell clock. */
  | 'ROTATING'
  /** The reader focused the empty field: the current example stays, frozen. */
  | 'PAUSED_FOCUS'
  /** The reader typed, or took an example into the field: rotation is over for this draft. */
  | 'STOPPED'
  /** The field was emptied again: waiting out the quiet delay before resuming. */
  | 'RESUMING';

export interface RotationState {
  readonly phase: RotationPhase;
  /** Position in the queue, not in the catalogue. */
  readonly cursor: number;
  /** Whether an example should be rendered at all. */
  readonly visible: boolean;
  /** Timestamp the current example was shown; the dwell is measured from it. */
  readonly shownAt: number;
  /** When RESUMING, the moment rotation may restart. Null otherwise. */
  readonly resumeAt: number | null;
  /** Set for one transition so the view can run its fade; never read as state. */
  readonly changed: boolean;
}

export type RotationEvent =
  /** The driver's heartbeat. The machine, not the timer, decides what is due. */
  | { readonly type: 'TICK'; readonly now: number }
  /** The reader focused the composer. */
  | { readonly type: 'FOCUS'; readonly now: number }
  /** The reader left the composer. */
  | { readonly type: 'BLUR'; readonly now: number }
  /** The composer value changed. `value` is the reader's text — never written back. */
  | { readonly type: 'VALUE'; readonly now: number; readonly value: string }
  /** The reader clicked/tapped the visible example and it went into the field. */
  | { readonly type: 'USE_EXAMPLE'; readonly now: number };

export function initialRotationState(now = 0): RotationState {
  return {
    phase: 'ROTATING',
    cursor: 0,
    visible: true,
    shownAt: now,
    resumeAt: null,
    changed: false,
  };
}

/**
 * THE MACHINE.
 *
 * Read the four guarantees off the branches:
 *   · typing hides the example at once and stops rotation (section 8);
 *   · focus freezes the CURRENT example rather than clearing it (section 8);
 *   · emptying the field resumes only after the quiet delay (section 8);
 *   · taking an example stops rotation and hands the text to the composer (section 9).
 */
export function rotationReducer(
  state: RotationState,
  event: RotationEvent,
  queueLength: number,
  timing: RotationTiming = EXAMPLE_ROTATION,
): RotationState {
  const still = (next: Partial<RotationState>): RotationState => ({
    ...state,
    changed: false,
    ...next,
  });

  switch (event.type) {
    case 'VALUE': {
      if (event.value.length > 0) {
        /* The reader is composing their own question. The suggestion is not competing with
           it, and the typed text is never touched. */
        return still({ phase: 'STOPPED', visible: false, resumeAt: null });
      }
      /* Cleared. Rotation MAY resume — after a quiet delay, so a backspace to empty does not
         immediately animate under the caret. */
      return still({
        phase: 'RESUMING',
        visible: true,
        resumeAt: event.now + timing.resumeAfterClearMs,
      });
    }

    case 'USE_EXAMPLE':
      /* The example became ordinary editable text. Nothing was submitted. */
      return still({ phase: 'STOPPED', visible: false, resumeAt: null });

    case 'FOCUS':
      if (state.phase === 'STOPPED') return still({});
      /* "Leave the currently shown example as non-entered suggestion content." */
      return still({ phase: 'PAUSED_FOCUS', visible: true, resumeAt: null });

    case 'BLUR':
      if (state.phase === 'STOPPED') return still({});
      return still({ phase: 'ROTATING', visible: true, shownAt: event.now, resumeAt: null });

    case 'TICK': {
      if (state.phase === 'RESUMING') {
        if (state.resumeAt !== null && event.now >= state.resumeAt) {
          return still({ phase: 'ROTATING', shownAt: event.now, resumeAt: null });
        }
        return still({});
      }
      if (state.phase !== 'ROTATING') return still({});
      if (queueLength <= 1) return still({});
      if (event.now - state.shownAt < timing.dwellMs) return still({});
      return {
        ...state,
        cursor: (state.cursor + 1) % queueLength,
        visible: true,
        shownAt: event.now,
        resumeAt: null,
        changed: true,
      };
    }
  }
}

/**
 * THE QUEUE — a permutation, not a random pick per tick.
 *
 * Two properties the contract asks for (section 6) fall out of building it this way:
 *   · NO REPEAT until the whole queue has cycled — because it is a permutation of every
 *     example, which is the strongest reading of "no repeat until a meaningful portion of
 *     the queue has cycled";
 *   · NO TWO CONSECUTIVE examples from one capability family — stricter than the contract's
 *     "avoid more than two consecutive", and provable rather than curated.
 *
 * It is built greedily: take the family with the most examples left that is not the family
 * just used. With fourteen families of three, the largest remaining family can never be the
 * forbidden one unless it holds more than half the remainder, which three-of-forty-two
 * cannot. A deterministic seed decides the order inside each family, so the sequence varies
 * between readers and sessions without any randomness during render.
 */
export function buildExampleQueue(
  examples: readonly QuestionExample[] = QUESTION_EXAMPLES,
  seed = 1,
): readonly QuestionExample[] {
  if (examples.length === 0) return [];
  const random = mulberry32(seed >>> 0 || 1);

  const buckets = new Map<ExampleCapability, QuestionExample[]>();
  for (const capability of EXAMPLE_CAPABILITIES) buckets.set(capability, []);
  for (const example of examples) {
    const bucket = buckets.get(example.capability);
    /* An unknown family would silently vanish from rotation; fail loudly instead. */
    if (bucket === undefined) throw new Error(`unknown capability: ${example.capability}`);
    bucket.push(example);
  }
  for (const bucket of buckets.values()) shuffleInPlace(bucket, random);

  /*
    THE FIRST EXAMPLE IS FIXED, NOT SHUFFLED. The server renders the composer before any
    seed exists, so the first example a reader sees must be the same on the server and in
    the browser — otherwise the entry view hydrates with a mismatch. Only the ORDER AFTER it
    is seeded.
  */
  const first = examples[0];
  const firstBucket = buckets.get(first.capability);
  if (firstBucket !== undefined) {
    const at = firstBucket.indexOf(first);
    if (at > 0) [firstBucket[0], firstBucket[at]] = [firstBucket[at], firstBucket[0]];
  }

  const queue: QuestionExample[] = [];
  let previous: ExampleCapability | null = null;
  while (queue.length < examples.length) {
    let chosen: ExampleCapability | null = null;
    let best = -1;
    for (const capability of EXAMPLE_CAPABILITIES) {
      const size = buckets.get(capability)?.length ?? 0;
      if (size === 0 || capability === previous) continue;
      if (size > best) {
        best = size;
        chosen = capability;
      }
    }
    /* Only reachable if a single family is all that remains; then the run is unavoidable and
       the alternation rule has already been honoured for every other position. */
    if (chosen === null) {
      for (const capability of EXAMPLE_CAPABILITIES) {
        if ((buckets.get(capability)?.length ?? 0) > 0) {
          chosen = capability;
          break;
        }
      }
    }
    if (chosen === null) break;
    const next = buckets.get(chosen)?.shift();
    if (next === undefined) break;
    queue.push(next);
    previous = chosen;
  }
  return Object.freeze(queue);
}

/** Longest run of one capability family in a sequence — the alternation rule, measurable. */
export function longestFamilyRun(queue: readonly QuestionExample[]): number {
  let longest = 0;
  let run = 0;
  let previous: ExampleCapability | null = null;
  for (const example of queue) {
    run = example.capability === previous ? run + 1 : 1;
    previous = example.capability;
    if (run > longest) longest = run;
  }
  return longest;
}

/**
 * A seed that differs per reader and per visit without identifying anyone, and without
 * reading history, location, account intelligence or prior questions (section 17). The
 * clock is not a personal attribute.
 */
export function rotationSeed(now: number = Date.now()): number {
  return (now % 2_147_483_647) >>> 0 || 1;
}

/** The locale is the reader's current selection; no second Ask-only selector (section 7). */
export function exampleForCursor(
  queue: readonly QuestionExample[],
  cursor: number,
): QuestionExample | undefined {
  if (queue.length === 0) return undefined;
  return queue[((cursor % queue.length) + queue.length) % queue.length];
}

/** Locales whose examples read right-to-left take the paragraph direction, never a marker. */
export function exampleIsRtl(locale: DisplayLocale): boolean {
  return locale === 'ar';
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffleInPlace<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}
