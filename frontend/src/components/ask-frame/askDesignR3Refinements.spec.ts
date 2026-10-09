import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXAMPLE_ROTATION,
  initialRotationState,
  rotationReducer,
  type RotationEvent,
} from '@/lib/ask/askExampleRotation';
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
  glyphs: read('AskActionGlyph.tsx'),
  copy: read('AskTurnCopy.tsx'),
  save: read('AskTurnSave.tsx'),
  toolbar: read('AskAnswerToolbar.tsx'),
  follow: read('AskTurnFollow.tsx'),
  css: read('askDashboard.module.css'),
  screen: read('AskFrameScreen.tsx'),
  parts: read('AskParts.tsx'),
  hook: read('../../lib/ask/useRotatingExample.ts'),
  machine: read('../../lib/ask/askExampleRotation.ts'),
};
const code = {
  glyphs: strip(raw.glyphs),
  copy: strip(raw.copy),
  save: strip(raw.save),
  toolbar: strip(raw.toolbar),
  css: strip(raw.css),
  screen: strip(raw.screen),
  parts: strip(raw.parts),
  hook: strip(raw.hook),
};

/**
 * The four glyphs EXACTLY as Claude Design supplies them in `AskPrototype.dc.html`. These
 * literals are the authority, not a description of the code: if an implementation ever re-paths,
 * simplifies or re-proportions a glyph, these fail.
 */
const APPROVED_GLYPH_PATHS = {
  copy: [
    '<rect x="7" y="7" width="10" height="10" rx="2"',
    'd="M13 7V5.5A2.5 2.5 0 0 0 10.5 3h-5A2.5 2.5 0 0 0 3 5.5v5A2.5 2.5 0 0 0 5.5 13H7"',
  ],
  share: [
    'd="M10 12.5V3"',
    'd="M6.5 6.5 10 3l3.5 3.5"',
    'd="M4 11v3.5A2.5 2.5 0 0 0 6.5 17h7a2.5 2.5 0 0 0 2.5-2.5V11"',
  ],
  save: ['d="M5.5 3h9a.5.5 0 0 1 .5.5V17l-5-3.4L5 17V3.5a.5.5 0 0 1 .5-.5Z"'],
  more: ['cx="4.5" cy="10" r="1.5"', 'cx="10" cy="10" r="1.5"', 'cx="15.5" cy="10" r="1.5"'],
} as const;

describe('D06 \u00b7 the approved glyphs, as supplied', () => {
  it('every path is the package\'s own, unmodified', () => {
    for (const paths of Object.values(APPROVED_GLYPH_PATHS)) {
      for (const d of paths) expect(code.glyphs).toContain(d);
    }
  });

  it('keeps the approved geometry: 20x20 viewBox, 1.6 stroke, round joins', () => {
    expect(code.glyphs).toContain("viewBox: '0 0 20 20'");
    expect(code.glyphs).toContain('strokeWidth: 1.6');
    expect(code.glyphs).toContain("strokeLinejoin: 'round'");
    expect(code.glyphs).toContain("strokeLinecap: 'round'");
    expect(code.glyphs).toContain('viewBox="0 0 20 20"');
    expect(code.glyphs).toContain('strokeWidth={1.6}');
    /* No size, stroke or colour was chosen here: colour is inherited via currentColor. */
    expect(code.glyphs).toMatch(/stroke="currentColor"/);
    expect(code.glyphs).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('Save carries the approved selected/unselected appearance in its fill', () => {
    expect(code.glyphs).toContain("fill={selected ? 'currentColor' : 'none'}");
    expect(code.save).toContain('<AskActionGlyph name="save" selected={saved} />');
    /* The state is still programmatic, not only visual. */
    expect(code.save).toContain('aria-pressed={saved}');
  });

  it('every glyph is hidden from assistive tech; the BUTTON carries the name', () => {
    expect(code.glyphs).toMatch(/aria-hidden/);
    expect(code.glyphs).toMatch(/focusable: 'false'|focusable="false"/);
    /* Each icon control names itself from the existing qualified catalogue \u2014 no new string. */
    expect(code.copy).toContain('aria-label={label}');
    expect(code.copy).toContain('title={label}');
    expect(code.save).toContain('aria-label={saved ? t.saved : t.save}');
    expect(code.toolbar).toContain('aria-label={r.share}');
    expect(code.toolbar).toContain('aria-label={r.moreTitle}');
  });

  it('Copy still reports its result to a screen reader without a visible label', () => {
    expect(code.copy).toMatch(/aria-live="polite"/);
    expect(code.copy).toContain('styles.visuallyHidden');
  });

  it('Sources stays a TEXT control with its count chip, per \u00a710', () => {
    expect(code.toolbar).toContain("<span aria-hidden=\"true\" data-count=\"\">");
    expect(code.toolbar).toContain('{s.sources}');
    expect(code.toolbar).not.toMatch(/AskActionGlyph name="sources"/);
    expect(code.css).toMatch(/\[data-ask='open-sources'\] > span\[data-count\]\)[^}]*background: var\(--ad-accent-soft/);
  });

  it('the row uses Design\'s colours and dimensions, not this lane\'s', () => {
    const row = code.css.slice(code.css.lastIndexOf(":global([data-ask='turn-actions'])"));
    expect(row).toMatch(/margin-inline: -10px/);
    expect(row).toMatch(/width: var\(--ad-target, 44px\)/);
    expect(row).toMatch(/height: var\(--ad-target, 44px\)/);
    expect(row).toMatch(/border: 0/);
    expect(row).toMatch(/background: transparent/);
    expect(row).toMatch(/color: var\(--ad-ink-2, #93a0b8\)/);
    expect(row).toMatch(/background: var\(--ad-surface-2, #161d2c\)/);
    expect(row).toMatch(/outline: 2px solid var\(--ad-focus, #6c93ff\)/);
    expect(row).toMatch(/outline-offset: -2px/);
  });

  it('Share moves to More below 360px \u2014 the package\'s own breakpoint', () => {
    expect(code.toolbar).toContain("ASK_TOOLBAR_COMPACT_QUERY = '(max-width: 359px)'");
  });
});

describe('D06 \u00b7 one row, no wrap, nothing dropped', () => {
  it('the row does not wrap at any width — not in the markup and not in the stylesheet', () => {
    expect(code.toolbar).not.toMatch(/flex-wrap/);
    const at = code.css.lastIndexOf(":global([data-ask='turn-actions'])");
    /* The row's OWN rule only: the Follow card below it wraps by design. */
    const rule = code.css.slice(at, code.css.indexOf('}', at));
    expect(rule).toMatch(/flex-wrap: nowrap/);
    expect(rule).not.toMatch(/flex-wrap: wrap/);
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
    /*
      SUPERSEDED BY CLAUDE DESIGN R3 §11 (R1-C) · this read
      `animation: exampleEnter ${EXAMPLE_ROTATION.fadeMs}ms`. R1-C's mechanism is a TRANSITION on
      one persistent element, not a keyframe animation, because the text swaps half way through.
      The tie to the constant is what matters and is kept, now on both halves.
    */
    expect(code.css).toContain(`transition: opacity ${EXAMPLE_ROTATION.fadeMs}ms ease-out`);
    expect(code.css).toContain(`transition: opacity ${EXAMPLE_ROTATION.fadeMs}ms ease-in`);
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
    expect(st.fading).toBe(false);
    expect(st.changed).toBe(false);
    /* R1-C · the hold expiring begins the fade OUT; the swap is one fade later. */
    st = rotationReducer(st, at(back + EXAMPLE_ROTATION.dwellMs), Q);
    expect(st.fading).toBe(true);
    expect(st.changed).toBe(false);
    st = rotationReducer(st, at(back + EXAMPLE_ROTATION.dwellMs + EXAMPLE_ROTATION.fadeMs), Q);
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

describe('D01-D03 · the approved fade sequence, overlay geometry and suspension', () => {
  const Q2 = QUESTION_EXAMPLES.length;
  const tick = (t: number): RotationEvent => ({ type: 'TICK', now: t });

  it('holds 5200 ms, fades OUT 400, swaps, and the next hold starts after the fade in', () => {
    /* R1-C: "hold 5,200 ms -> opacity 1->0 over 400 ms ease-in -> swap text -> 0->1 over 400 ms
       ease-out. Cycle ~ 6.0 s." The swap is HALF WAY through, not at the start. */
    let st = initialRotationState(0);
    st = rotationReducer(st, tick(EXAMPLE_ROTATION.dwellMs - 1), Q2);
    expect(st.fading).toBe(false);
    expect(st.changed).toBe(false);

    st = rotationReducer(st, tick(EXAMPLE_ROTATION.dwellMs), Q2);
    expect(st.fading).toBe(true);
    expect(st.changed).toBe(false);
    expect(st.cursor).toBe(0);

    st = rotationReducer(st, tick(EXAMPLE_ROTATION.dwellMs + EXAMPLE_ROTATION.fadeMs - 1), Q2);
    expect(st.fading).toBe(true);
    expect(st.cursor).toBe(0);

    const swapAt = EXAMPLE_ROTATION.dwellMs + EXAMPLE_ROTATION.fadeMs;
    st = rotationReducer(st, tick(swapAt), Q2);
    expect(st.changed).toBe(true);
    expect(st.fading).toBe(false);
    expect(st.cursor).toBe(1);
    /* The hold begins when the new example is fully visible: one fade-in after the swap, so the
       whole cycle is 5200 + 400 + 400 = 6000 ms. */
    expect(st.shownAt).toBe(EXAMPLE_ROTATION.dwellMs + EXAMPLE_ROTATION.fadeMs * 2);
  });

  it('an interruption cancels the fade: the swap never lands behind it', () => {
    const interruptions: readonly RotationEvent[] = [
      { type: 'FOCUS', now: 5_400 },
      { type: 'VALUE', now: 5_400, value: 'w' },
      { type: 'SUSPEND', now: 5_400 },
    ];
    for (const event of interruptions) {
      let st = rotationReducer(initialRotationState(0), tick(EXAMPLE_ROTATION.dwellMs), Q2);
      expect(st.fading).toBe(true);
      st = rotationReducer(st, event, Q2);
      expect(st.fading).toBe(false);
      expect(st.fadeAt).toBeNull();
      expect(st.cursor).toBe(0);
    }
  });

  it('only opacity animates \u2014 the unauthorized vertical rise is gone', () => {
    const enter = code.css.slice(code.css.indexOf('.exampleEnter'));
    const block = enter.slice(0, enter.indexOf('.composerExampleLayer'));
    expect(block).toMatch(/transition: opacity 400ms ease-out/);
    expect(block).toMatch(/\[data-ask-example-fading='true'\][^}]*opacity: 0/);
    expect(block).toMatch(/transition: opacity 400ms ease-in/);
    expect(block).not.toMatch(/transform|translateY/);
    expect(code.css).not.toMatch(/@keyframes exampleEnter/);
  });

  it('reduced motion removes the transition as well as the overlay', () => {
    expect(code.css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.exampleEnter \{\s*transition: none;/,
    );
  });

  it('uses the approved overlay geometry, not substituted spacing', () => {
    const layer = code.css.slice(code.css.indexOf('.composerExampleLayer'));
    expect(layer).toMatch(/inset-inline-start: 19px/);
    expect(layer).toMatch(/inset-inline-end: 54px/);
    expect(layer).toMatch(/top: 1px/);
    expect(layer).toMatch(/height: 50px/);
    const text = code.css.slice(code.css.indexOf('.composerExampleText'));
    expect(text).toMatch(/white-space: nowrap/);
    expect(text).toMatch(/text-overflow: ellipsis/);
    /* DECLARED CONFLICT · R1-C says `--ink-3`; the RELEASED Ask placeholder ink is
       `--ask-read-ink3`, and the example must match the placeholder it hands over to on focus.
       The released ink wins and the discrepancy is reported. See the stylesheet comment. */
    expect(text).toMatch(/color: var\(--ask-read-ink3, #6f89a8\)/);
  });

  it('the overlay is measured from the FIELD, so the 54px clears Send', () => {
    const after = code.parts.slice(code.parts.indexOf('data-ask="composer-example-layer"'));
    expect(after).toMatch(/<button\s+type="submit"/);
    expect(code.parts).toMatch(/relative flex min-h-\[56px\]/);
  });

  it('rotation stops while a sheet, drawer or dialog is open', () => {
    /* R1-C: "Runs only when ALL are true: ... no sheet/drawer/dialog open". nav.open is the
       conversations drawer, which IS reachable from the welcome view. */
    expect(code.screen).toMatch(/suspended: nav\?\.open === true/);
    expect(code.hook).toMatch(/const away = suspended \|\| document\.visibilityState === 'hidden';/);
  });

  it('focus shows the native static placeholder; blur restores a FULL hold', () => {
    let st = rotationReducer(initialRotationState(0), { type: 'FOCUS', now: 100 }, Q2);
    expect(st.visible).toBe(false);
    st = rotationReducer(st, { type: 'BLUR', now: 200 }, Q2);
    expect(st.visible).toBe(true);
    expect(st.cursor).toBe(0);
    /* "rotation resumes from the current example after a full hold (no instant change)" */
    st = rotationReducer(st, tick(200 + EXAMPLE_ROTATION.dwellMs - 1), Q2);
    expect(st.fading).toBe(false);
    st = rotationReducer(st, tick(200 + EXAMPLE_ROTATION.dwellMs), Q2);
    expect(st.fading).toBe(true);
    expect(st.cursor).toBe(0);
  });
});

describe('D01-D03 · the overlay is guidance, never a control', () => {
  it('the layer takes no pointer events and the words are aria-hidden plain text', () => {
    /* R1-C's geometry moved to the stylesheet with the approved insets; the rule that matters
       is unchanged and is asserted where it now lives. */
    expect(code.parts).toMatch(/data-ask="composer-example-layer"[\s\S]{0,120}composerExampleLayer/);
    expect(code.css).toMatch(/\.composerExampleLayer[^}]*pointer-events: none/);
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
    expect(code.screen).toMatch(
      /suspended: nav\?\.open === true \|\| r2\.signInRequired !== null \|\| r2\.deepQuote !== null,/,
    );
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
