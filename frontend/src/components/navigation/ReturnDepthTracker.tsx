'use client';

import { useEffect } from 'react';
import { recordInAppNavigation } from '@/lib/navigation/returnDepth';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE IN-APP NAVIGATION TRACKER — ONE MOUNT, NO RENDER, NO REQUEST
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `ReturnControl` needs to know whether a product page sits behind the current
 * one. Neither `history.length` nor `document.referrer` can answer that (see
 * `lib/navigation/returnDepth.ts` for why each is rejected), so the product
 * counts its own route changes. This counts them.
 *
 * MOUNT POINT IS A PRECEDENT, NOT A NEW PATTERN. `app/layout.tsx` already
 * mounts exactly one always-present client affordance — `<AskAiDock />` — with
 * that file's own note that *"it issues no request on mount and none on open."*
 * The tracker mounts the same way, once, in the root layout.
 *
 * ── WHY IT INSTRUMENTS `history` RATHER THAN CALLING `usePathname` ─────────
 *
 * `usePathname` throws *"invariant expected app router to be mounted"* outside
 * an App Router context, which would make this component unrenderable in the
 * static harnesses that govern several surfaces. Instrumenting the History API
 * is context-free and measures the same thing more directly: the App Router
 * performs its client navigations THROUGH `pushState`/`replaceState`, and the
 * browser's own Back/Forward raise `popstate`. Watching those three covers
 * every way the current entry can change.
 *
 * `replaceState` is deliberately NOT counted. It rewrites the current entry
 * rather than adding one — the Map uses it to keep `?sel=` in the URL — so
 * counting it would claim a page behind the reader that does not exist.
 *
 * WHAT IT DELIBERATELY IS NOT:
 *
 *   not a provider     holds no context and wraps no children, so it cannot
 *                      cause a re-render anywhere in the tree
 *   not stateful       the counter is module scope; no `useState`, so changing
 *                      it never schedules React work
 *   not visible        returns `null` — no element, no text node, no class, so
 *                      it cannot affect layout, chrome height or any frozen
 *                      geometry
 *   not a fetch        issues no request on mount or on any navigation
 *
 * IT RESTORES WHAT IT PATCHED. The original `pushState` is put back on unmount,
 * so the instrumentation cannot outlive the component or stack across mounts.
 */
export function ReturnDepthTracker(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalPushState = window.history.pushState;

    /*
      A pushState IS a new entry, which is exactly "there is now a page behind
      the reader". Counted once per call, after the real implementation runs so
      a throw inside the router cannot leave the counter ahead of the history.
    */
    window.history.pushState = function patchedPushState(
      this: History,
      ...args: Parameters<History['pushState']>
    ): void {
      originalPushState.apply(this, args);
      recordInAppNavigation();
    };

    /*
      Back/Forward move between entries that already exist. Moving at all means
      the reader is somewhere reachable from within this tab's product history,
      so the depth stays meaningful; the counter only ever needs to answer
      "> 0?", never an exact distance.
    */
    const onPopState = (): void => {
      recordInAppNavigation();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.history.pushState = originalPushState;
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return null;
}
