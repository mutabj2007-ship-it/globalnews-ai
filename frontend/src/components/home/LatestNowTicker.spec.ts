import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Milestone #51 (browser acceptance correction) — LatestNowTicker.
 *
 * These are structural/source-inspection tests. They CANNOT and do
 * not claim to prove the animation feels smooth, that pause-on-hover
 * is perceptible, or that the reversal at the rail's end looks
 * natural — those require real browser acceptance. What these DO
 * verify: the specific engineering requirements this round asked
 * for (rAF not setInterval, no forced re-renders, cleanup on unmount,
 * reduced-motion opt-out, tab-visibility pausing, no duplicated DOM).
 */
const source = readFileSync(join(__dirname, 'LatestNowTicker.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('LatestNowTicker (Milestone #51 browser-acceptance correction)', () => {
  it('is a client component', () => {
    expect(source.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('uses requestAnimationFrame, not setInterval, for the auto-scroll loop', () => {
    expect(source).toMatch(/requestAnimationFrame/);
    expect(stripComments(source)).not.toMatch(/setInterval/);
  });

  it('never calls a state setter inside the animation loop — advancing scroll must not trigger a React re-render every frame', () => {
    expect(source).not.toMatch(/useState/);
    expect(source).toMatch(/useRef/);
  });

  it('mutates scrollLeft directly rather than re-rendering DOM nodes to move them', () => {
    expect(source).toMatch(/\.scrollLeft\s*=/);
  });

  it('reverses direction at the scroll boundaries instead of duplicating article content for a fake-infinite loop', () => {
    expect(source).toMatch(/directionRef/);
    expect(source).not.toMatch(/\[\.\.\.\w+,\s*\.\.\.\w+\]/);
  });

  it('checks prefers-reduced-motion and skips starting the animation loop entirely when active', () => {
    expect(source).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(source).toMatch(/if \(prefersReducedMotion\) return;/);
  });

  it('pauses (cancels the animation frame) when the document is hidden, and resumes on visibility return', () => {
    expect(source).toMatch(/visibilitychange/);
    expect(source).toMatch(/document\.hidden/);
    expect(source).toMatch(/cancelAnimationFrame/);
  });

  it('pauses on pointer hover, touch, and keyboard focus — not hover-only', () => {
    expect(source).toMatch(/pointerenter/);
    expect(source).toMatch(/pointerleave/);
    expect(source).toMatch(/touchstart/);
    expect(source).toMatch(/touchend/);
    expect(source).toMatch(/focusin/);
    expect(source).toMatch(/focusout/);
  });

  it('coordinates with manual arrow-button clicks via the shared pause signal, so automatic movement does not fight manual interaction', () => {
    expect(source).toMatch(/isLatestNowMotionPaused/);
  });

  it('cleans up the animation frame and every event listener on unmount', () => {
    expect(source).toMatch(/return \(\) => \{[\s\S]*cancelAnimationFrame[\s\S]*\};/);
    expect(source).toMatch(/removeEventListener\('visibilitychange'/);
    expect(source).toMatch(/removeEventListener\('pointerenter'/);
    expect(source).toMatch(/removeEventListener\('touchstart'/);
    expect(source).toMatch(/removeEventListener\('focusin'/);
  });

  it('keeps the container natively scrollable (overflow-x-auto) — auto-scroll augments, never replaces, native scroll/touch/drag', () => {
    expect(source).toMatch(/overflow-x-auto/);
  });

  it('hides the native scrollbar without removing native scroll functionality', () => {
    expect(source).toMatch(/scrollbar-width:none/);
  });

  it('provides an edge fade/mask rather than an abrupt visual cutoff', () => {
    expect(source).toMatch(/pointer-events-none/);
    expect(source).toMatch(/gradient/);
  });

  it('renders children (the server-rendered cards) rather than accepting/re-deriving an article list itself — no duplicate data path', () => {
    expect(source).toMatch(/children/);
    expect(source).not.toMatch(/NewsArticle\[\]/);
  });
});

describe('latestNowMotionSignal (Milestone #51)', () => {
  const signalSource = readFileSync(join(__dirname, 'latestNowMotionSignal.ts'), 'utf-8');

  it('is a plain module-level value, not React state/context — avoids any render cost for a per-frame-read signal', () => {
    expect(signalSource).not.toMatch(/useState/);
    expect(signalSource).not.toMatch(/createContext/);
  });

  it('exposes exactly the pause/query pair the ticker and controls need', () => {
    expect(signalSource).toMatch(/export function pauseLatestNowMotion/);
    expect(signalSource).toMatch(/export function isLatestNowMotionPaused/);
  });
});
