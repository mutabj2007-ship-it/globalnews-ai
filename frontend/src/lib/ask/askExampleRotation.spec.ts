import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUESTION_EXAMPLES } from './askQuestionExamples';
import {
  EXAMPLE_ROTATION,
  buildExampleQueue,
  exampleForCursor,
  exampleIsRtl,
  initialRotationState,
  longestFamilyRun,
  rotationReducer,
  rotationSeed,
  type RotationState,
} from './askExampleRotation';

/**
 * STANDALONE CENTERED COMPOSER R1 — THE ROTATION, TESTED AS BEHAVIOUR.
 *
 * Group R-1  the queue: no repeat, family alternation, deterministic first example
 * Group R-2  rotation advances on the dwell clock
 * Group R-3  focus pauses; typing stops; clearing resumes after the quiet delay
 * Group R-4  taking an example stops rotation and submits nothing
 * Group R-5  timing is tunable from one constant and sits in the contract's bands
 * Group R-6  no compute, no network, no personalisation
 */

/*
  Source scans read the module with COMMENTS STRIPPED, the same way `askChatUx.spec.ts` does.
  The docblocks in this module deliberately NAME what it must not do ("the machine never
  submits", "without reading history, location, account intelligence"); scanning raw text
  would let a prohibition fail on the sentence that states it.
*/
const moduleSource = () =>
  readFileSync(join(__dirname, 'askExampleRotation.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const QUEUE_LENGTH = QUESTION_EXAMPLES.length;
const tickOnce = (state: RotationState, now: number) =>
  rotationReducer(state, { type: 'TICK', now }, QUEUE_LENGTH);

/*
  SUPERSEDED BY PRODUCT OWNER / CLAUDE DESIGN R3 §11 (R1-C), CTO 9 Oct 2026.

  `tick` used to be one TICK, because a swap used to happen in one step. R1-C's sequence is
  "hold 5,200 ms → opacity 1→0 over 400 ms ease-in → swap text → 0→1 over 400 ms ease-out", so
  the text now changes HALF WAY through a transition and a swap takes two deadlines: the hold
  expiring, then the fade completing.

  `tick(state, now)` therefore drives the machine to `now` AND, if that began a fade, on through
  the fade so the caller sees the state it used to see. Tests that care about the two halves
  separately use `tickOnce`, and the halves themselves are asserted by name in
  `askDesignR3Refinements.spec.ts`.
*/
/** R1-C · one complete cycle: hold + fade out + fade in ≈ 6.0 s. */
const CYCLE = EXAMPLE_ROTATION.dwellMs + EXAMPLE_ROTATION.fadeMs * 2;

const tick = (state: RotationState, now: number) => {
  const first = tickOnce(state, now);
  return first.fading ? tickOnce(first, now + EXAMPLE_ROTATION.fadeMs) : first;
};

describe('R-1 · the queue', () => {
  it('is a permutation: every example appears exactly once, so nothing repeats until it cycles', () => {
    for (const seed of [1, 7, 99, 123_456, 2_147_483_646]) {
      const queue = buildExampleQueue(QUESTION_EXAMPLES, seed);
      expect(queue).toHaveLength(QUEUE_LENGTH);
      expect(new Set(queue.map((e) => e.id)).size).toBe(QUEUE_LENGTH);
    }
  });

  it('never places two examples from the same capability family back to back', () => {
    for (const seed of [1, 2, 3, 42, 777, 20_260_104]) {
      const queue = buildExampleQueue(QUESTION_EXAMPLES, seed);
      /* The contract allows up to two in a row; the queue builder achieves one. */
      expect(longestFamilyRun(queue)).toBe(1);
      expect(longestFamilyRun(queue)).toBeLessThanOrEqual(2);
    }
  });

  it('starts from the same example for every seed, so the server and the browser agree', () => {
    const first = QUESTION_EXAMPLES[0].id;
    for (const seed of [1, 5, 50, 5_000, 500_000]) {
      expect(buildExampleQueue(QUESTION_EXAMPLES, seed)[0]?.id).toBe(first);
    }
  });

  it('varies the order after the first example, so two readers do not see one sequence', () => {
    const a = buildExampleQueue(QUESTION_EXAMPLES, 11).map((e) => e.id);
    const b = buildExampleQueue(QUESTION_EXAMPLES, 12).map((e) => e.id);
    expect(a).not.toEqual(b);
    expect(a[0]).toBe(b[0]);
  });

  it('is deterministic for one seed', () => {
    expect(buildExampleQueue(QUESTION_EXAMPLES, 31).map((e) => e.id)).toEqual(
      buildExampleQueue(QUESTION_EXAMPLES, 31).map((e) => e.id),
    );
  });

  it('wraps the cursor rather than running off the end', () => {
    const queue = buildExampleQueue(QUESTION_EXAMPLES, 3);
    expect(exampleForCursor(queue, 0)?.id).toBe(queue[0].id);
    expect(exampleForCursor(queue, QUEUE_LENGTH)?.id).toBe(queue[0].id);
    expect(exampleForCursor(queue, -1)?.id).toBe(queue[QUEUE_LENGTH - 1].id);
    expect(exampleForCursor([], 4)).toBeUndefined();
  });

  it('survives a degenerate catalogue instead of throwing at a reader', () => {
    expect(buildExampleQueue([], 1)).toEqual([]);
    const one = buildExampleQueue([QUESTION_EXAMPLES[0]], 1);
    expect(one).toHaveLength(1);
  });
});

describe('R-2 · rotation advances on the dwell clock', () => {
  it('shows an example as soon as the composer is empty', () => {
    const state = initialRotationState(0);
    expect(state.visible).toBe(true);
    expect(state.phase).toBe('ROTATING');
    expect(state.cursor).toBe(0);
  });

  it('does not advance before the dwell has elapsed', () => {
    const state = tick(initialRotationState(0), EXAMPLE_ROTATION.dwellMs - 1);
    expect(state.cursor).toBe(0);
    expect(state.changed).toBe(false);
  });

  it('advances to another example once it has', () => {
    const state = tick(initialRotationState(0), EXAMPLE_ROTATION.dwellMs);
    expect(state.cursor).toBe(1);
    expect(state.changed).toBe(true);
    expect(state.visible).toBe(true);
  });

  it('keeps advancing, and the examples it shows do not repeat across a full cycle', () => {
    const queue = buildExampleQueue(QUESTION_EXAMPLES, 9);
    let state = initialRotationState(0);
    const seen = [exampleForCursor(queue, state.cursor)!.id];
    /*
      SUPERSEDED BY CLAUDE DESIGN R3 §11 (R1-C) · the step was `i * EXAMPLE_ROTATION.dwellMs`.
      A cycle is no longer one hold: it is hold + fade out + fade in, because the hold is
      measured from the moment the new example is fully visible. The property under test — no
      repeat across a full queue — is unchanged.
    */
    for (let i = 1; i < QUEUE_LENGTH; i += 1) {
      state = tick(state, i * CYCLE);
      seen.push(exampleForCursor(queue, state.cursor)!.id);
    }
    expect(new Set(seen).size).toBe(QUEUE_LENGTH);
    /* And the cycle closes rather than stalling. */
    state = tick(state, QUEUE_LENGTH * CYCLE);
    expect(exampleForCursor(queue, state.cursor)!.id).toBe(seen[0]);
  });

  it('stands still when there is nothing to rotate to', () => {
    const state = rotationReducer(initialRotationState(0), { type: 'TICK', now: 10_000 }, 1);
    expect(state.cursor).toBe(0);
    expect(state.changed).toBe(false);
  });
});

describe('R-3 · focus pauses, typing stops, clearing resumes', () => {
  it('clears the example on focus and freezes the queue where it stood', () => {
    /*
      SUPERSEDED BY PRODUCT OWNER / CTO DESIGN R3 REVIEW, 9 Oct 2026. This test was "pauses on
      focus and leaves the CURRENT example in place as a suggestion" and asserted
      `expect(state.visible).toBe(true)`, under contract §8's "leave the currently shown example
      as non-entered suggestion content". R1-C moved the example into the placeholder's own slot
      and the CTO ruled it must disappear on focus. The CURSOR assertion is unchanged and is the
      half that still holds: focus is a pause, not the end of rotation.
    */
    let state = tick(initialRotationState(0), EXAMPLE_ROTATION.dwellMs);
    const frozenAt = state.cursor;
    state = rotationReducer(state, { type: 'FOCUS', now: 5_000 }, QUEUE_LENGTH);
    expect(state.phase).toBe('PAUSED_FOCUS');
    expect(state.visible).toBe(false);
    expect(state.cursor).toBe(frozenAt);
    /* No amount of ticking moves it while the reader is in the field. */
    state = tick(state, 5_000 + EXAMPLE_ROTATION.dwellMs * 10);
    expect(state.cursor).toBe(frozenAt);
    expect(state.phase).toBe('PAUSED_FOCUS');
  });

  it('resumes rotating when the reader leaves an empty field', () => {
    let state = rotationReducer(initialRotationState(0), { type: 'FOCUS', now: 100 }, QUEUE_LENGTH);
    state = rotationReducer(state, { type: 'BLUR', now: 200 }, QUEUE_LENGTH);
    expect(state.phase).toBe('ROTATING');
    state = tick(state, 200 + EXAMPLE_ROTATION.dwellMs);
    expect(state.cursor).toBe(1);
  });

  it('stops the moment the reader types, and hides the example at once', () => {
    let state = initialRotationState(0);
    state = rotationReducer(state, { type: 'VALUE', now: 300, value: 'W' }, QUEUE_LENGTH);
    expect(state.phase).toBe('STOPPED');
    expect(state.visible).toBe(false);
    /* And it never comes back under an active draft, however long the reader thinks. */
    state = tick(state, 300 + EXAMPLE_ROTATION.dwellMs * 20);
    expect(state.visible).toBe(false);
    expect(state.cursor).toBe(0);
  });

  it('never changes the cursor on a VALUE event, so typed text cannot be touched', () => {
    const before = tick(initialRotationState(0), EXAMPLE_ROTATION.dwellMs * 3);
    const after = rotationReducer(
      before,
      { type: 'VALUE', now: 99_999, value: 'my own question' },
      QUEUE_LENGTH,
    );
    expect(after.cursor).toBe(before.cursor);
  });

  it('focus while stopped stays stopped: a draft is not interrupted by a suggestion', () => {
    const stopped = rotationReducer(
      initialRotationState(0),
      { type: 'VALUE', now: 0, value: 'x' },
      QUEUE_LENGTH,
    );
    const focused = rotationReducer(stopped, { type: 'FOCUS', now: 1 }, QUEUE_LENGTH);
    expect(focused.phase).toBe('STOPPED');
    expect(focused.visible).toBe(false);
  });

  it('waits out the quiet delay after the field is emptied, then resumes', () => {
    let state = rotationReducer(
      initialRotationState(0),
      { type: 'VALUE', now: 1_000, value: 'abc' },
      QUEUE_LENGTH,
    );
    state = rotationReducer(state, { type: 'VALUE', now: 2_000, value: '' }, QUEUE_LENGTH);
    expect(state.phase).toBe('RESUMING');
    expect(state.visible).toBe(true);
    expect(state.resumeAt).toBe(2_000 + EXAMPLE_ROTATION.resumeAfterClearMs);

    /* One tick inside the delay changes nothing — no animation under a caret that just cleared. */
    state = tick(state, 2_000 + EXAMPLE_ROTATION.resumeAfterClearMs - 1);
    expect(state.phase).toBe('RESUMING');
    expect(state.changed).toBe(false);

    state = tick(state, 2_000 + EXAMPLE_ROTATION.resumeAfterClearMs);
    expect(state.phase).toBe('ROTATING');
    /* The dwell is measured from the resume, not from before the draft. */
    expect(tick(state, 2_000 + EXAMPLE_ROTATION.resumeAfterClearMs + 1).cursor).toBe(state.cursor);
  });
});

describe('R-4 · taking an example', () => {
  it('stops rotation and hands the text over — the machine never submits anything', () => {
    const state = rotationReducer(
      initialRotationState(0),
      { type: 'USE_EXAMPLE', now: 10 },
      QUEUE_LENGTH,
    );
    expect(state.phase).toBe('STOPPED');
    expect(state.visible).toBe(false);
    const source = moduleSource();
    for (const forbidden of ['submit', 'fetch', 'requestSubmit', 'onSubmit']) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe('R-5 · timing', () => {
  it('is tunable from ONE constant and sits inside the contract bands', () => {
    /*
      SUPERSEDED BY PRODUCT OWNER / CLAUDE DESIGN R3 §11 (Welcome R1-C, 9 Oct 2026). This was a
      band assertion, `>= 3_000` and `<= 5_000`, taken from the original contract's "suggested
      band 3–5 s". The band is obsolete, not merely exceeded: R1-C specifies the hold EXACTLY,
      at 5.2 s, because the example now sits inside the composer where it must be readable in
      full. An exact assertion is also the stronger one — a band would have let a later edit
      drift the hold without a ruling.
    */
    expect(EXAMPLE_ROTATION.dwellMs).toBe(5_200);
    expect(EXAMPLE_ROTATION.fadeMs).toBe(400);
    expect(EXAMPLE_ROTATION.resumeAfterClearMs).toBeGreaterThanOrEqual(8_000);
    expect(EXAMPLE_ROTATION.resumeAfterClearMs).toBeLessThanOrEqual(15_000);
    expect(Object.isFrozen(EXAMPLE_ROTATION)).toBe(true);
  });

  it('obeys an injected timing table, so a later contract can retune without editing logic', () => {
    /*
      SUPERSEDED BY CLAUDE DESIGN R3 §11 (R1-C) · one TICK used to swap. It now begins the fade,
      and the swap lands on the tick that completes it — both read from the SAME injected table,
      which is what this test exists to prove.
    */
    const fast = { ...EXAMPLE_ROTATION, dwellMs: 1_000, fadeMs: 50 };
    const fading = rotationReducer(
      initialRotationState(0),
      { type: 'TICK', now: 1_000 },
      QUEUE_LENGTH,
      fast,
    );
    expect(fading.fading).toBe(true);
    expect(fading.cursor).toBe(0);
    const state = rotationReducer(
      fading,
      { type: 'TICK', now: 1_000 + fast.fadeMs },
      QUEUE_LENGTH,
      fast,
    );
    expect(state.cursor).toBe(1);
  });

  it('holds no literal millisecond figure in the machine itself', () => {
    const machine = moduleSource()
      .split('export const EXAMPLE_ROTATION')[1]
      .split('export function buildExampleQueue')[0];
    expect(machine).not.toMatch(/now [+-] [0-9]{3,}/);
  });
});

describe('R-6 · inert by construction', () => {
  it('reaches no network, no provider, no AI and no analytics', () => {
    const source = moduleSource();
    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'analytics',
      'openai',
      '/api/',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('personalises nothing: no history, no location, no account, no prior questions', () => {
    const source = moduleSource();
    for (const forbidden of [
      'localStorage',
      'sessionStorage',
      'document.cookie',
      'geolocation',
      'navigator.language',
      'history',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    /* The only outside value is the clock, and only as a seed. */
    expect(rotationSeed(1_000)).toBe(1_000);
    expect(rotationSeed(0)).toBe(1);
    expect(rotationSeed(2_147_483_647)).toBe(1);
  });

  it('decides direction from the locale, with no per-language branch beyond it', () => {
    expect(exampleIsRtl('ar')).toBe(true);
    for (const locale of ['en', 'pl', 'fr', 'de', 'es', 'pt'] as const) {
      expect(exampleIsRtl(locale)).toBe(false);
    }
  });
});
