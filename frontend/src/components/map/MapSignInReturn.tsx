'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { consumeMapStateAfterSignIn } from '@/lib/map/state/signInReturnState';

/**
 * CHECKPOINT I — THE RETURN HALF OF AUTH RETURN-STATE PRESERVATION.
 *
 * The sign-in links on the map remember the route's own query string before
 * navigating away (`signInReturnState.ts` explains why it cannot travel in
 * `returnTo`). The backend brings the reader back to a bare `/map`, which is
 * exactly what its allowlist permits and all it is allowed to say.
 *
 * This restores the rest, from the browser.
 *
 * ── IT RESTORES ONLY ONTO A BARE MAP ──────────────────────────────────────
 *
 * If the URL already carries map state, the reader arrived deliberately — by a
 * shared link, a bookmark, or the back button — and that URL is the authority.
 * Overwriting it with a remembered one would answer a specific request with a
 * stale answer, which is worse than not restoring at all.
 *
 * ── AND ONLY ONCE ─────────────────────────────────────────────────────────
 *
 * `consumeMapStateAfterSignIn` is read-and-clear, so a later deliberate visit
 * to the bare world map stays the bare world map. A reader who asks for the
 * world and is given Rwanda, with nothing on screen explaining why, has met a
 * bug rather than a convenience.
 *
 * ── replace, NOT push ─────────────────────────────────────────────────────
 *
 * The bare `/map` the redirect landed on is not a place the reader chose to be,
 * and leaving it in history would make Back return them to the empty map they
 * just escaped. `replace` removes it.
 *
 * Renders nothing.
 */
export function MapSignInReturn(): null {
  const router = useRouter();

  useEffect(() => {
    /*
      Read from `window` rather than `useSearchParams`, deliberately: this must
      observe the URL as it actually is at mount, and it must not put the route
      behind a Suspense boundary to do it.
    */
    const current = window.location.search;

    if (current.length > 1) return;

    const restored = consumeMapStateAfterSignIn();

    if (restored === null) return;

    router.replace(`/map${restored}`);
  }, [router]);

  return null;
}
