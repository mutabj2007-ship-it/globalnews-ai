'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker. Renders nothing.
 *
 * WHY IT RETURNS null. This component is mounted inside <body> in the
 * root layout, which means it sits above every Claude Design surface in the
 * tree. Returning null rather than a fragment or a wrapper guarantees it
 * contributes no element, no text node and no class to the document, so the
 * approved M66 presentation cannot move by a pixel because of it.
 * pwaContract.spec.ts asserts the null return, so that stays true.
 *
 * WHY IT REGISTERS AFTER `load`. Registration kicks off an install that
 * fetches and precaches six files. Doing that during page load would put it in
 * competition with the resources the user is actually waiting for. Deferring to
 * the `load` event moves the whole cost outside FCP, LCP and TTI.
 *
 * WHY PRODUCTION ONLY. `next dev` serves unhashed assets and relies on HMR; a
 * worker with a fetch handler in front of that is a debugging trap for the next
 * person, not a feature. The guard is also what keeps every existing test and
 * local workflow behaving exactly as it did before this component existed.
 *
 * FAILURES ARE SILENT ON PURPOSE. Registration rejects for reasons that are
 * never the user's problem and never actionable by them — an insecure context
 * (the API is only available over HTTPS, localhost excepted), a browser that
 * does not implement it, or a user profile with service workers disabled. In
 * every one of those cases the application is fully functional without a worker;
 * the only thing lost is the offline fallback. So the catch is empty by design,
 * not by oversight. Nothing is logged to the console either, because a console
 * error on a perfectly healthy iOS Lockdown Mode session would be noise that
 * looks like a defect.
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return undefined;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    let cancelled = false;

    const register = (): void => {
      if (cancelled) return;
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Intentionally silent — see the note above.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return undefined;
    }

    window.addEventListener('load', register, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
