'use client';

/**
 * CHECKPOINT I — AUTH RETURN-STATE PRESERVATION FOR THE SELECTED MAP GEOGRAPHY.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 *
 * Every sign-in link on the map passes the bare string `'/map'` as its return
 * destination. So a reader who has selected Rwanda, set a period and framed a
 * camera, and then presses SIGN IN to follow that country, comes back to an
 * empty world map. The thing they were trying to act on is gone, and they have
 * to find it again before they can do what they signed in for.
 *
 * ── WHY THE OBVIOUS FIX IS FORBIDDEN, AND CORRECTLY SO ───────────────────
 *
 * The obvious repair is to return to `/map?sel=…`. The backend refuses it:
 * `return-destination.util.ts` rejects `?` and `#` OUTRIGHT, and says why —
 *
 *     "no query string and no fragment are accepted at all. The contract is
 *      'return to the originating PAGE' … so no state needs to survive the
 *      redirect and none is allowed to." (CTO requirement 9)
 *
 * That gate exists because `returnTo` is attacker-authored by definition and a
 * redirect target taken from a request is the classic open-redirect primitive —
 * more dangerous here than anywhere, because the user arrives having just
 * completed a real Google sign-in and is primed to trust what follows.
 *
 * Widening it to carry map state would trade a real security property for a
 * convenience. So this does not touch it: `returnTo` stays exactly `/map`, with
 * no query, and passes the allowlist unchanged.
 *
 * ── THE STATE NEVER ENTERS THE REDIRECT AT ALL ───────────────────────────
 *
 * It is kept in the BROWSER, which is where it was already. `sessionStorage`
 * survives a same-tab navigation out to Google and back, is scoped to that one
 * tab, and is discarded when the tab closes — which is the exact lifetime of
 * "where was I when I signed in".
 *
 * Nothing about it reaches the server, so there is no new input to validate, no
 * new redirect surface, and the three gates in `return-destination.util.ts`
 * govern precisely what they governed before.
 *
 * ── WHAT IS STORED ────────────────────────────────────────────────────────
 *
 * The map route's own query string, verbatim, as the shell's URL writer already
 * produced it — selection, mode, period and camera together. Nothing is parsed,
 * re-encoded or reconstructed here, so this module cannot disagree with
 * `mapUrl.ts` about what any key means: it copies a string and hands it back.
 *
 * ── AND IT IS CONSUMED ONCE ───────────────────────────────────────────────
 *
 * Read-and-clear. A restored state that lingered would re-apply itself to a
 * later, deliberate visit to the bare map — the reader would ask for the world
 * and be given Rwanda, with no way to tell why.
 */

const KEY = 'gn.map.signInReturn';

/**
 * Called immediately before navigating to sign-in.
 *
 * Best-effort throughout: a browser with storage disabled loses the
 * convenience and keeps the sign-in, which is the correct trade. It must never
 * be able to prevent the navigation it precedes.
 */
export function rememberMapStateForSignIn(search: string): void {
  if (typeof window === 'undefined') return;

  /*
    An empty query is not worth storing, and storing it would be actively
    wrong: on return it would "restore" the bare map over whatever the URL
    already said.
  */
  if (search.length === 0 || search === '?') return;

  try {
    window.sessionStorage.setItem(KEY, search);
  } catch {
    /* Private mode, disabled storage, quota. The sign-in still proceeds. */
  }
}

/**
 * Called once on the map route after a return. Returns the stored query string
 * and forgets it, or null when there is nothing to restore.
 */
export function consumeMapStateAfterSignIn(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.sessionStorage.getItem(KEY);

    if (stored === null || stored.length === 0) return null;

    window.sessionStorage.removeItem(KEY);

    /*
      A stored value that is not a query string is not something to act on.
      This can only happen if another writer took the key, and the honest
      response is to ignore it rather than to route from it.
    */
    return stored.startsWith('?') ? stored : null;
  } catch {
    return null;
  }
}

/** Test seam and reset path. */
export function forgetMapStateForSignIn(): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing to do — the value is unreadable either way. */
  }
}
