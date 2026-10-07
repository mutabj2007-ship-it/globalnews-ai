import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskEmblem, COMPACT_MIN_PX, emblemTypingFit } from './AskEmblem';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHONE TYPING EMBLEM REPAIR R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Approved Design: READY large emblem · TYPING welcome collapses and an understated emblem stays ·
 * the composer sits above the on-screen keyboard · only SUBMIT fades the emblem out.
 *
 * Defect: `visualViewport.height < 480` marked the typing emblem `short`, and globals.css hid it
 * (`[data-ask-emblem-short='true'] { display: none }`) — exactly the iPhone Safari keyboard-open
 * state. The repair keeps a compact mark, sized from the space it actually has.
 */
const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const globals = read('app', 'globals.css');
const emblemCss = code(globals.slice(globals.indexOf('.gna-ask-emblem {'), globals.indexOf('@keyframes gnaAskEmblemTurn')));
const component = code(read('components', 'ask-frame', 'AskEmblem.tsx'));

describe('PT-1 · the fit decision (pure)', () => {
  it('room for the typing size → full (nothing changes: desktop, tablets, taller phones)', () => {
    expect(emblemTypingFit(400, 64)).toEqual({ fit: 'full', size: 64 });
    expect(emblemTypingFit(68, 64)).toEqual({ fit: 'full', size: 64 });
    expect(emblemTypingFit(600, 72)).toEqual({ fit: 'full', size: 72 });
    expect(emblemTypingFit(200, 48)).toEqual({ fit: 'full', size: 48 });
  });

  it('short of room → compact: the resting margin goes first, then the mark shrinks to the space', () => {
    /* 66 px: the 64 px mark still fits once its 4 px margin is released */
    expect(emblemTypingFit(66, 64)).toEqual({ fit: 'compact', size: 64 });
    expect(emblemTypingFit(57.6, 64)).toEqual({ fit: 'compact', size: 57 });
    expect(emblemTypingFit(48, 64)).toEqual({ fit: 'compact', size: 48 });
  });

  it('never smaller than 48 px; only when not even 48 px fits does the composer take the space', () => {
    expect(COMPACT_MIN_PX).toBe(48);
    expect(emblemTypingFit(47, 64)).toEqual({ fit: 'none', size: 0 });
    expect(emblemTypingFit(0, 64)).toEqual({ fit: 'none', size: 0 });
  });

  it('an unmeasurable layout (SSR, tests, no nominal size) keeps the full mark', () => {
    expect(emblemTypingFit(Number.NaN, 64).fit).toBe('full');
    expect(emblemTypingFit(30, 0).fit).toBe('full');
  });
});

describe('PT-2 · the root cause is gone', () => {
  it('no viewport-height threshold and no "short" flag in the component', () => {
    expect(component).not.toMatch(/<\s*480/);
    expect(component).not.toMatch(/data-ask-emblem-short/);
    expect(component).not.toMatch(/setShort/);
  });

  it('no CSS rule hides the typing emblem for a short viewport', () => {
    expect(emblemCss).not.toMatch(/data-ask-emblem-short/);
    /* the only `display: none` left is the measured last resort */
    const hides = emblemCss.match(/[^{}]+\{[^}]*display:\s*none[^}]*\}/g) ?? [];
    expect(hides).toHaveLength(1);
    expect(hides[0]).toMatch(/\[data-ask-emblem-fit='none'\]/);
  });

  it('the decision is measured from the visible viewport and the scroll container, never a device', () => {
    expect(component).toMatch(/visualViewport/);
    expect(component).toMatch(/ResizeObserver/);
    expect(component).not.toMatch(/userAgent|iPhone|iPad|Safari/);
  });
});

describe('PT-3 · Design sizes are unchanged', () => {
  it('READY 136 phone · 144 tablet · 160 desktop · 96 dock', () => {
    expect(emblemCss).toMatch(/\.gna-ask-emblem \{\s*--emblem-size: 136px;/);
    expect(emblemCss).toMatch(/min-width: 700px\) \{\s*\.gna-ask-emblem \{\s*--emblem-size: 144px;/);
    expect(emblemCss).toMatch(/min-width: 1024px\) \{\s*\.gna-ask-emblem \{\s*--emblem-size: 160px;/);
    expect(emblemCss).toMatch(/\[data-ask-emblem-placement='dock'\] \{\s*--emblem-size: 96px;/);
  });

  it('TYPING 64 phone · 72 tablet/desktop · 48 dock, and the rendered size follows it', () => {
    expect(emblemCss).toMatch(/\[data-ask-emblem-from='typing'\] \{\s*--emblem-typing-size: 64px;/);
    expect(emblemCss).toMatch(/min-width: 700px\) \{[^}]*\{\s*--emblem-typing-size: 72px;/);
    expect(emblemCss).toMatch(/\[data-ask-emblem-placement='dock'\]\[data-ask-emblem-from='typing'\] \{\s*--emblem-typing-size: 48px;/);
    expect(emblemCss).toMatch(/\{\s*--emblem-size: var\(--emblem-typing-size\);/);
  });

  it('compact overrides every placement and drops the resting margin; leaving keeps it', () => {
    const compact = emblemCss.slice(emblemCss.indexOf("[data-ask-emblem-fit='compact']"));
    expect(compact).toMatch(/\[data-ask-emblem-placement='dock'\]\[data-ask-emblem-fit='compact'\] \{\s*--emblem-size: var\(--emblem-fit-size, 48px\);\s*margin-bottom: 0;/);
    /* the compact rule comes after every typing / from-typing size rule, so it wins the cascade */
    expect(emblemCss.lastIndexOf('--emblem-size: var(--emblem-typing-size)')).toBeLessThan(
      emblemCss.indexOf("[data-ask-emblem-fit='compact']"),
    );
    /* leaving does not reset the measured fit (no grow-back during the 200 ms fade) */
    expect(component).toMatch(/if \(state === 'leaving'\) return;/);
  });

  it('a READY render carries no fit attribute and no inline size', () => {
    const html = renderToStaticMarkup(createElement(AskEmblem, { state: 'ready', placement: 'page' }));
    expect(html).toMatch(/data-ask-emblem-state="ready"/);
    expect(html).not.toMatch(/data-ask-emblem-fit/);
    expect(html).not.toMatch(/--emblem-fit-size/);
  });

  it('SUBMIT still fades then unmounts (leaving opacity 0, 200 ms)', () => {
    expect(emblemCss).toMatch(/\[data-ask-emblem-state='leaving'\] \{\s*opacity: 0;/);
    expect(component).toMatch(/const LEAVE_MS = 200;/);
    expect(renderToStaticMarkup(createElement(AskEmblem, { state: 'typing', placement: 'dock' }))).toMatch(
      /data-ask-emblem-state="typing"/,
    );
  });
});
