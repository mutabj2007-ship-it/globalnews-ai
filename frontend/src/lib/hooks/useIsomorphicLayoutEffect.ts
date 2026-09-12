'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * R3 — the isomorphic layout effect.
 *
 * WHY THIS EXISTS. `AnalysisFrame` restores the centre column's scroll
 * position inside `useLayoutEffect`, and the choice of hook is the whole
 * point: the restore must land in the SAME commit as the track resize, so
 * a growing brief never moves the claim the reader is looking at. Run it
 * in `useEffect` instead and the browser paints the resized tracks first,
 * which is a visible jump.
 *
 * React has no layout phase on the server, so it warns — correctly —
 * whenever `useLayoutEffect` is reached during `renderToString`. The
 * frame's own specs render through `react-dom/server`, so the warning was
 * emitted 76 times per full suite run: noise loud enough to hide a real
 * warning behind it.
 *
 * THE CORRECTION CHANGES NOTHING IN THE BROWSER. On the client this IS
 * `useLayoutEffect` — same hook, same pre-paint timing, same scroll
 * behaviour, byte for byte. Only the server, where neither hook ever runs
 * a body, takes the `useEffect` branch, and `useEffect` is the hook React
 * does not warn about because it makes no layout promise it cannot keep.
 *
 * The `typeof window` test is evaluated ONCE at module scope, not per
 * render: a hook whose identity changed between renders would violate the
 * rules of hooks. `useIsomorphicLayoutEffect.spec.ts` asserts both the
 * binding and the absence of the warning.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
