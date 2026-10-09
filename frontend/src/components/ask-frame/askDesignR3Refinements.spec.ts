import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXAMPLE_ROTATION, initialRotationState, rotationReducer } from '@/lib/ask/askExampleRotation';
import { QUESTION_EXAMPLES } from '@/lib/ask/askQuestionExamples';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CLAUDE DESIGN R3 — THE FOUR APPROVED REFINEMENTS (CTO directive, 9 Oct 2026)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * D06 and the R1-C stop rules are asserted as BEHAVIOUR wherever the behaviour is reachable
 * (the rotation is a pure state machine, so its rules are), and as source text only where the
 * guarantee is structural — a row that must not wrap, a control that must not exist, a comment
 * that must be superseded rather than deleted.
 *
 * House rule: comment-strip before scanning for a prohibition. The docblocks in these files
 * name what they forbid, so a scan over raw source would match the prohibition's own wording.
 */
const strip = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const read = (...p: readonly string[]): string => readFileSync(join(__dirname, ...p), 'utf8');
const raw = {
  toolbar: read('AskAnswerToolbar.tsx'),
  follow: read('AskTurnFollow.tsx'),
  css: read('askDashboard.module.css'),
  screen: read('AskFrameScreen.tsx'),
  parts: read('AskParts.tsx'),
  hook: read('../../lib/ask/useRotatingExample.ts'),
  machine: read('../../lib/ask/askExampleRotation.ts'),
};
const code = {
  toolbar: strip(raw.toolbar),
  css: strip(raw.css),
  screen: strip(raw.screen),
  parts: strip(raw.parts),
  hook: strip(raw.hook),
};

describe('D06 · one row, no wrap, nothing dropped', () => {
  it('the row does not wrap at any width — not in the markup and not in the stylesheet', () => {
    expect(code.toolbar).not.toMatch(/flex-wrap/);
    expect(code.css).toMatch(/\[data-ask='turn-actions'\]\)\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(code.css).not.toMatch(/\[data-ask='turn-actions'\]\)\s*\{[^}]*flex-wrap:\s*wrap/);
  });

  it('keeps ONE toolbar: the directive forbids a second one', () => {
    expect(code.toolbar.match(/role="toolbar"/g)).toHaveLength(1);
    expect(code.toolbar).toMatch(/data-ask="turn-actions"/);
  });

  it('Copy, Save and the source count are unconditional on width; only Share moves', () => {
    /* Copy and Save carry no `compact` guard; Share is in the row or in More, never neither. */
    expect(code.toolbar).toMatch(/<AskTurnCopy locale=\{locale\} \/>/);
    expect(code.toolbar).toMatch(/\{canSave && <AskTurnSave/);
    expect(code.toolbar).toMatch(/openSources !== null && sources\.length > 0/);
    expect(code.toolbar).toMatch(/\{canShare && !compact && \(/);
    expect(code.toolbar).toMatch(/const shareInMore = canShare && compact;/);
  });

  it('More is still offered only when it holds a real action', () => {
    expect(code.toolbar).toMatch(
      /const offerMore =\s*shareInMore \|\| onRefresh !== undefined \|\| openFullHref !== undefined \|\| onRunDeeper !== undefined;/,
    );
  });

  it('adds no unbacked control: no Download, Compare, Listen or per-answer Delete', () => {
    /* Matched on the CONTROL, not on bare words: `addEventListener` contains "listen", which is
       how this assertion first failed. */
    expect(code.toolbar).not.toMatch(
      /data-ask="[^"]*(?:download|compare|listen|delete)/i,
    );
    expect(code.toolbar).not.toMatch(/r\.(?:download|compare|listen)|useInListen/i);
    /* R3 §10 lists "Listen · coming later" as `aria-disabled`; the same Design forbids dummy
       controls, so it is omitted rather than shipped disabled. */
    expect(code.toolbar).not.toMatch(/aria-disabled/);
  });

  it('Follow left the row for its own card, and is not inside More', () => {
    expect(code.toolbar).toMatch(/<div data-ask="turn-continuity">/);
    const row = code.toolbar.slice(
      code.toolbar.indexOf('data-ask="turn-actions"'),
      code.toolbar.indexOf('data-ask="turn-continuity"'),
    );
    expect(row).not.toMatch(/AskTurnFollow/);
    const sheets = code.toolbar.slice(code.toolbar.indexOf("sheet === 'more'"));
    expect(sheets).not.toMatch(/AskTurnFollow/);
    /* The card collapses rather than drawing an empty box when Follow renders nothing. */
    expect(code.css).toMatch(/\[data-ask='turn-continuity'\]:empty\)\s*\{\s*display:\s*none/);
  });

  it('role="toolbar" gains arrow/Home/End movement, RTL-mirrored, and loses no Tab target', () => {
    expect(code.toolbar).toMatch(/key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End'/);
    expect(code.toolbar).toMatch(/getComputedStyle\(row\.current\)\.direction === 'rtl'/);
    /* A roving tabindex would take four of five actions out of the Tab order. */
    expect(code.toolbar).not.toMatch(/tabIndex/);
  });

  it('the superseded wrap claims are superseded in place, not deleted', () => {
    for (const src of [raw.toolbar, raw.css, raw.follow]) {
      expect(src).toMatch(/SUPERSEDED BY/);
    }
    /* The old words are still on the record with their reasons. */
    expect(raw.toolbar).toContain('ended "wraps"');
    expect(raw.css).toContain('`flex-wrap`');
    expect(raw.follow).toContain('a first-class TOOLBAR action');
  });
});

describe('D01-D03 · R1-C timing comes from one constant', () => {
  it('dwell 5200 ms and fade 400 ms', () => {
    expect(EXAMPLE_ROTATION.dwellMs).toBe(5_200);
    expect(EXAMPLE_ROTATION.fadeMs).toBe(400);
    expect(Object.isFrozen(EXAMPLE_ROTATION)).toBe(true);
  });

  it('the stylesheet reads its fade from that constant, so the two cannot drift', () => {
    expect(code.css).toContain(`animation: exampleEnter ${EXAMPLE_ROTATION.fadeMs}ms`);
  });

  it('the machine still holds no literal millisecond figure', () => {
    const machine = strip(raw.machine).replace(/EXAMPLE_ROTATION[\s\S]*?\}\);/, '');
    expect(machine).not.toMatch(/\b\d{3,}_?\d*\s*(?:\/\*|;|\))/);
  });
});

describe('D01-D03 · the example never advances where it cannot be read', () => {
  const Q = QUESTION_EXAMPLES.length;
  const at = (t: number) => ({ type: 'TICK' as const, now: t });

  it('a hidden tab freezes the current example instead of clearing it', () => {
    let st = initialRotationState(0);
    st = rotationReducer(st, { type: 'SUSPEND', now: 100 }, Q);
    expect(st.phase).toBe('PAUSED_AWAY');
    expect(st.visible).toBe(true);
    const cursor = st.cursor;
    /* Ten dwells pass while the reader is away: nothing moves. */
    st = rotationReducer(st, at(100 + EXAMPLE_ROTATION.dwellMs * 10), Q);
    expect(st.cursor).toBe(cursor);
    expect(st.changed).toBe(false);
  });

  it('coming back restarts the dwell rather than expiring it in that instant', () => {
    let st = initialRotationState(0);
    st = rotationReducer(st, { type: 'SUSPEND', now: 100 }, Q);
    const back = 100 + EXAMPLE_ROTATION.dwellMs * 10;
    st = rotationReducer(st, { type: 'RESUME', now: back }, Q);
    expect(st.phase).toBe('ROTATING');
    /* The deadline that passed while hidden is gone: a tick one ms short still holds. */
    st = rotationReducer(st, at(back + EXAMPLE_ROTATION.dwellMs - 1), Q);
    expect(st.changed).toBe(false);
    st = rotationReducer(st, at(back + EXAMPLE_ROTATION.dwellMs), Q);
    expect(st.changed).toBe(true);
  });

  it('focus outranks away in both directions: a focused field is not un-frozen by returning', () => {
    let st = rotationReducer(initialRotationState(0), { type: 'FOCUS', now: 10 }, Q);
    expect(st.phase).toBe('PAUSED_FOCUS');
    st = rotationReducer(st, { type: 'SUSPEND', now: 20 }, Q);
    expect(st.phase).toBe('PAUSED_FOCUS');
    st = rotationReducer(st, { type: 'RESUME', now: 30 }, Q);
    expect(st.phase).toBe('PAUSED_FOCUS');
  });

  it('typing still outranks everything, and the typed text is never touched', () => {
    let st = rotationReducer(initialRotationState(0), { type: 'VALUE', now: 10, value: 'war' }, Q);
    expect(st.phase).toBe('STOPPED');
    expect(st.visible).toBe(false);
    st = rotationReducer(st, { type: 'SUSPEND', now: 20 }, Q);
    expect(st.phase).toBe('STOPPED');
    st = rotationReducer(st, { type: 'RESUME', now: 30 }, Q);
    expect(st.phase).toBe('STOPPED');
  });
});

describe('D01-D03 · the overlay is guidance, never a control', () => {
  it('the layer takes no pointer events and the words are aria-hidden plain text', () => {
    expect(code.parts).toMatch(/data-ask="composer-example-layer"[\s\S]{0,120}pointer-events-none/);
    expect(code.parts).toMatch(/data-ask="composer-example"[\s\S]{0,400}aria-hidden="true"/);
    /* Not a button, not focusable, and nothing is submitted or typed from it. */
    const start = code.parts.indexOf('composer-example-layer');
    const layer = code.parts.slice(start, code.parts.indexOf('{example.text}', start));
    expect(layer).not.toMatch(/<button|onClick|tabIndex|requestSubmit|role=/);
  });

  it('the field keeps its own accessible name: the example is never the label', () => {
    expect(code.parts).toMatch(/<label className="sr-only" htmlFor="ask-frame-composer">\s*\{inputLabel\}/);
    expect(code.parts).not.toMatch(/aria-label=\{example/);
    expect(code.parts).not.toMatch(/aria-live/);
  });

  it('reduced motion shows no rotation at all, and no new string was invented for it', () => {
    expect(code.hook).toMatch(/const visible = enabled && !reducedMotion &&/);
    expect(code.hook).toMatch(/'\(prefers-reduced-motion: reduce\)'/);
    /* The fallback is the composer's own static placeholder, already qualified in seven locales. */
    expect(code.screen).toMatch(/placeholder=\{entryState \? r2s\.read\.placeholderFirst/);
  });

  it('the rotation is wired to the entry state only, and declares its overlay rule', () => {
    expect(code.screen).toMatch(/useRotatingExample\(\{[\s\S]{0,200}enabled: entryState,/);
    expect(code.screen).toMatch(/suspended: r2\.signInRequired !== null \|\| r2\.deepQuote !== null,/);
  });

  it('the composer contract is untouched: no limit change, no viewport observation here', () => {
    expect(code.parts).toMatch(/placeholder=\{showExample \? '' : placeholder\}/);
    expect(code.parts).not.toMatch(/maxLength/);
    expect(code.hook).not.toMatch(/visualViewport/);
    expect(code.toolbar).not.toMatch(/visualViewport/);
  });

  it('both reversed positions are superseded explicitly, with their rationale preserved', () => {
    expect(raw.hook).toContain('SUPERSEDED BY PRODUCT OWNER / CLAUDE DESIGN R3');
    expect(raw.hook).toContain('prefers-reduced-motion is a MOTION preference');
    expect(raw.screen).toContain('NO ROTATING EXAMPLE IN THE FIELD');
    expect(raw.screen).toContain('SUPERSEDED BY PRODUCT OWNER DIRECTIVE 9 Oct 2026');
  });
});

describe('P01/P02 · no visual change today', () => {
  it('the research status is still one truthful line with no stages, timers or percentages', () => {
    const working = strip(read('AskWorkingStatus.tsx'));
    expect(working).not.toMatch(/stage|percent|%|progress|setInterval|setTimeout|ProgressEvent/i);
    expect(working).toMatch(/role="status"/);
    expect(working).toMatch(/aria-live="polite"/);
  });

  it('this lane changed neither the status line nor the emblem', () => {
    /* EMBLEM-FREEZE E-6 and the truthful fallback are outside the four approved refinements. */
    for (const f of ['AskWorkingStatus.tsx', 'AskEmblem.tsx']) {
      expect(readFileSync(join(__dirname, f), 'utf8')).not.toMatch(/DESIGN R3 §(10|11)/);
    }
  });
});
