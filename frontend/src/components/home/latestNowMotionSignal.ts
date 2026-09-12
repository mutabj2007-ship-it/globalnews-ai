/**
 * Milestone #51 (browser acceptance correction) — a minimal
 * coordination point between two independent client components
 * (LatestNowTicker, which owns the rAF auto-scroll loop, and
 * LatestNowScrollControls, the pre-existing arrow buttons) so a
 * manual arrow click doesn't fight the automatic movement. Not React
 * state/context deliberately: this value changes far more often than
 * either component needs to re-render for, and a plain module-level
 * timestamp avoids any render cost entirely — the ticker's animation
 * loop simply reads it once per frame.
 */
let pausedUntil = 0;

/** Suppresses auto-scroll for `ms` milliseconds from now — called on manual arrow clicks. */
export function pauseLatestNowMotion(ms: number): void {
  pausedUntil = Date.now() + ms;
}

export function isLatestNowMotionPaused(): boolean {
  return Date.now() < pausedUntil;
}
