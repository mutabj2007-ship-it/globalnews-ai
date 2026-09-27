'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK GEOGRAPHY CONTEXT — A SELECTED COUNTRY IS NOT A STORY ANCHOR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling, Map R1 item 7: *"Do not widen `usePublishStoryContext`. Do not
 * make `/map` a story-context publisher. A selected country is not a story
 * anchor. Create a separate bounded Ask geography context."*
 *
 * ── WHY A SECOND STORE AND NOT A SECOND FIELD ────────────────────────────
 *
 * `storyContextStore` anchors an Ask to ONE REPORT: a title, an article id, a
 * publisher, a URL. Its publisher set is pinned to the two analysis-owning
 * surfaces by `askAiRevA.spec.ts` L4, and that pin is a safety contract about
 * one reader's anchor leaking into another surface's request.
 *
 * "The reader is looking at Algeria" is a different kind of fact with a
 * different lifetime, and it is not more specific — it is LESS specific. Fold
 * the two together and the narrower fact silently becomes the broader one, or
 * a country arrives at the backend wearing a headline's clothes. So they are
 * two stores, and the precedence between them is stated rather than emergent:
 * **story context wins, because it is the more specific anchor.**
 *
 * ── THE BOUND IS THE POINT ───────────────────────────────────────────────
 *
 * Exactly two fields. No article ids, no source ids, no evidence, report or
 * cluster ids, and no prior AI output — the ruling names each of those, and
 * `ASK_GEOGRAPHY_KEYS` below is what a test asserts against so the bound
 * cannot widen quietly.
 *
 * ── IT COSTS NOTHING ─────────────────────────────────────────────────────
 *
 * Publishing is a module-store write in an effect. Selecting a country still
 * issues zero requests, opening the dock still issues zero requests, and the
 * only place analysis begins is an explicit Send.
 */

/** The whole contract. Two fields, and no room for a third by accident. */
export interface AskGeographyContext {
  /** ISO country code, as the map's own selection holds it. */
  readonly countryCode: string;
  /** What to show the reader. A label, never an identifier. */
  readonly displayName: string;
}

/** The permitted keys, exported so a test can assert the bound has not widened. */
export const ASK_GEOGRAPHY_KEYS = ['countryCode', 'displayName'] as const;

interface Entry {
  readonly token: symbol;
  readonly context: AskGeographyContext;
}

let current: Entry | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function same(a: AskGeographyContext, b: AskGeographyContext): boolean {
  return a.countryCode === b.countryCode && a.displayName === b.displayName;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AskGeographyContext | undefined {
  return current === null ? undefined : current.context;
}

/**
 * Undefined on the server, unconditionally.
 *
 * A module store is per-process on the server, so returning the live value
 * would leak one reader's selection into another reader's SSR output — the
 * same reasoning `storyContextStore` records, applied to the same hazard.
 */
function getServerSnapshot(): AskGeographyContext | undefined {
  return undefined;
}

/**
 * Publish the reader's current selected geography.
 *
 * Normalised on the way in rather than trusted: whatever the caller passes,
 * exactly two fields are stored. A caller that hands over a whole country
 * record cannot accidentally widen the contract.
 */
export function publishGeographyContext(token: symbol, context: AskGeographyContext): void {
  const bounded: AskGeographyContext = {
    countryCode: context.countryCode,
    displayName: context.displayName,
  };

  if (current !== null && current.token === token && same(current.context, bounded)) return;

  current = { token, context: bounded };
  emit();
}

/** Clear, but only if this owner is the one still published. */
export function clearGeographyContext(token: symbol): void {
  if (current === null || current.token !== token) return;
  current = null;
  emit();
}

export function resetGeographyContextStoreForTest(): void {
  current = null;
  emit();
}

export function peekGeographyContextForTest(): AskGeographyContext | undefined {
  return getSnapshot();
}

/** Read the published geography. The dock's only view of it. */
export function useAskGeographyContext(): AskGeographyContext | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Publish while mounted and a context exists; clear on change and on unmount.
 *
 * Two effects rather than one, for the reason `storyContextStore` gives: a
 * selection can be cleared WITHOUT the surface unmounting, and an unmount-only
 * cleanup would never fire for that case.
 */
export function usePublishGeographyContext(context: AskGeographyContext | undefined): void {
  const tokenRef = useRef<symbol | null>(null);
  if (tokenRef.current === null) tokenRef.current = Symbol('ask-geography-owner');
  const token = tokenRef.current;

  useEffect(() => {
    if (context === undefined) {
      clearGeographyContext(token);
      return;
    }
    publishGeographyContext(token, context);
  }, [context, token]);

  useEffect(
    () => () => {
      clearGeographyContext(token);
    },
    [token],
  );
}
