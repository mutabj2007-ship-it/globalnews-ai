/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — where a reader lands when Ask must start CLEAN.
 *
 * Two journeys need a clean Ask screen, and both were proven broken on Alpha:
 *
 *   A · New question on an Ask conversation surface. A Next <Link href="/ask"> while already
 *       at /ask (or /ask?operation=…) is a same-route navigation: the Ask frame does not
 *       remount, so the previous turns, the opened stored result, the thread continuation,
 *       a pending clarification and the Save state all stayed on screen.
 *   B · Sign out. The session ended but the signed-in answer stayed visible until a manual
 *       refresh — a privacy defect.
 *
 * Both now clear the private Ask content synchronously (AskNavProvider's `cleared` flag) and
 * then perform a DOCUMENT navigation to the clean opening screen. A document load is the one
 * reset that provably leaves no client state behind — hook state, refs, module-level stores —
 * and it asks for nothing: no thread is created until the reader presses Ask, and no model,
 * provider or compute call is made. No query parameter is invented to force a remount.
 *
 * The standalone root `/` is itself the Ask opening screen, so a reader there stays there;
 * every other surface lands on `/ask`.
 */
export function cleanAskDestination(pathname: string | null): string {
  return pathname === '/' ? '/' : '/ask';
}

/** The surfaces that hold a live Ask conversation in client state. */
export function isAskConversationSurface(pathname: string | null): boolean {
  return pathname === '/' || pathname === '/ask';
}

/** A plain primary click — a modified click (new tab/window) keeps the browser's own meaning. */
export function isPlainClick(event: {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Indirection so a unit test can observe the navigation without a browser. */
export const askLocation = {
  assign(url: string): void {
    window.location.assign(url);
  },
};
