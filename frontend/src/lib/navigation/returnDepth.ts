/**
 * ════════════════════════════════════════════════════════════════════════════
 * RETURN DEPTH — THE ONLY HISTORY SIGNAL THIS PRODUCT TRUSTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * H measured the Back/Return defect across fourteen surfaces and two viewports:
 * ONE surface carried any return affordance at all (Energy, compact only). The
 * shared control that closes that gap has to answer one question before it can
 * act — *is there a product page behind this one?* — and the two obvious
 * browser signals both answer it wrongly.
 *
 *   window.history.length > 1   REJECTED. It counts the whole TAB session. A
 *                               reader who visited another site, then typed our
 *                               URL, has length 2 — and `router.back()` would
 *                               LEAVE THE PRODUCT entirely.
 *
 *   document.referrer           REJECTED ALONE. Client-side App Router moves do
 *                               not update it, so an in-app navigation is
 *                               indistinguishable from a direct entry.
 *
 * THE SIGNAL MUST BE ONE THE PRODUCT SETS ITSELF, because only the product
 * knows whether the previous entry is one of its own. `RETURN_DEPTH` is a
 * module-scope counter incremented exactly once per in-app route change and
 * read synchronously by the control:
 *
 *     0   this is the entry point of this session — `router.back()` would leave
 *         the product, so the control pushes the governed fallback instead.
 *   > 0   a product entry is behind us — `router.back()` is legitimate.
 *
 * WHY MODULE SCOPE RATHER THAN CONTEXT. The value is read during an event
 * handler, never during render, so nothing needs to re-render when it changes.
 * A context would force a provider around the whole tree and produce re-renders
 * for a value no component displays. This holds no React state by design.
 *
 * SSR-SAFE. The module initialises to 0 on the server and is never read during
 * render, so a server and client pass cannot disagree about markup — there is
 * no hydration surface here at all.
 */

/**
 * In-app route changes observed so far in this tab. Module scope: it resets on
 * a full document load, which is exactly the semantics wanted — a hard load IS
 * a fresh entry point regardless of what the tab did before it.
 */
let RETURN_DEPTH = 0;

/**
 * Records one in-app route change. Called only by the tracker mounted in the
 * root layout, once per pathname change, never from a surface.
 */
export function recordInAppNavigation(): void {
  RETURN_DEPTH += 1;
}

/**
 * Reads the depth. Null-safe by construction: it returns a number in every
 * environment, including the server, so callers never branch on undefined.
 */
export function readReturnDepth(): number {
  return RETURN_DEPTH;
}

/**
 * TRUE when `router.back()` is guaranteed to land on a page of this product.
 *
 * This is the whole decision the control makes, expressed once so the component
 * cannot reimplement it and drift. It is deliberately total — there is no third
 * state and no "unknown" — which is what makes a dead Back control impossible:
 * whichever branch is taken, the control does something.
 */
export function canReturnInApp(): boolean {
  return readReturnDepth() > 0;
}

/**
 * TEST SEAM. Resets the counter between cases. Not called by product code —
 * the counter's real reset is a document load.
 */
export function __resetReturnDepthForTests(): void {
  RETURN_DEPTH = 0;
}
