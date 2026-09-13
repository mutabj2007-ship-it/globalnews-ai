/**
 * ASK AI REV A §5 — the story-context provider, fail closed.
 *
 * WHY A MODULE STORE AND NOT A REACT CONTEXT. The dock is mounted from
 * the root layout (`layout.tsx:267`) as a SIBLING of the page, so a
 * React provider would have to wrap `{children}` in that layout.
 * `pwaContract.spec.ts` forbids changing that wrapper, and Rev A §0(a)
 * states the constraint as a fact about the mount, not a defect in
 * `AskAiDock.tsx`. A module-scoped store read through
 * `useSyncExternalStore` crosses the same boundary without touching the
 * layout tree at all.
 *
 * THE RESTING STATE IS `undefined` (§5.2.4). Nothing here initialises to
 * a value, no route "inherits" a previous page's anchor, and every exit
 * path clears. Presence is the exception that a mounted publisher must
 * actively maintain; absence is what the reader gets by default.
 *
 * OWNERSHIP IS A SYMBOL, NOT A BOOLEAN (§5.2.3 and §5.2.5, L3/L5).
 * React mounts the next page's effect BEFORE it runs the previous
 * page's cleanup. A naive `clear()` in cleanup therefore deletes the
 * anchor the NEW page has already published, and the reader silently
 * loses story B's context on an A -> B transition. Each publisher holds
 * its own symbol for its lifetime and can only clear an entry it still
 * owns, so a late cleanup from A is a no-op against B's entry.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { StoryContext } from '@globalnews-ai/shared';

/**
 * §4.6 — `storyTitle` is a title, not a payload. The bound is a guard on
 * a value that is already a query string; it never rewrites, normalises
 * or concatenates. Nothing is truncated, because a truncated subject is
 * a different subject.
 */
export const STORY_TITLE_MAX = 300;

/**
 * THREE STATES, NOT TWO — R2 FINDING 3.
 *
 * R1 collapsed "the parameter is absent" and "the parameter is present
 * but malformed" into one `null`, and then did `title: storyTitle ??
 * query`. In the malformed case that substitutes the FOLLOW-UP as the
 * story subject — precisely the subject/question inversion Rev A's own
 * change log was written to close. A malformed title is not a missing
 * one: something tried to say what this analysis is about and said
 * something unusable, and the safe response is to anchor nothing rather
 * than to anchor the wrong thing.
 *
 *   absent     — no `storyTitle` in the URL. Legacy behaviour, untouched:
 *                the subject falls back to `q`, and an `articleId` /
 *                `countryCode` anchor still applies exactly as it did
 *                before Rev A existed.
 *   valid      — use it as the subject, verbatim.
 *   malformed  — FAIL CLOSED. No anchored `StoryContext` is constructed
 *                or published, and `q` is NEVER promoted to subject.
 *                The reader gets an ordinary generic analysis, which is
 *                a truthful answer to the question they typed.
 */
export type StoryTitleResolution =
  | { readonly kind: 'absent' }
  | { readonly kind: 'valid'; readonly title: string }
  | { readonly kind: 'malformed'; readonly reason: 'blank' | 'over-limit' };

export function resolveStoryTitle(param: string | null): StoryTitleResolution {
  if (param === null) return { kind: 'absent' };
  if (param.trim().length === 0) return { kind: 'malformed', reason: 'blank' };
  if (param.length > STORY_TITLE_MAX) return { kind: 'malformed', reason: 'over-limit' };
  return { kind: 'valid', title: param };
}

/**
 * The outbound half of the same rule.
 *
 * A subject is safely transportable only when it survives the round trip
 * unchanged — that is, when the `storyTitle` this emits would resolve
 * back to `valid` on arrival. Asserted by construction: this asks
 * `resolveStoryTitle` rather than restating its conditions, so the two
 * halves cannot drift apart.
 */
export function isTransportableTitle(title: string): boolean {
  return resolveStoryTitle(title).kind === 'valid';
}

interface Entry {
  readonly token: symbol;
  readonly context: StoryContext;
}

let current: Entry | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function sameContext(a: StoryContext, b: StoryContext): boolean {
  return (
    a.title === b.title &&
    a.articleId === b.articleId &&
    a.countryCode === b.countryCode &&
    a.url === b.url &&
    a.sourceName === b.sourceName
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoryContext | undefined {
  return current === null ? undefined : current.context;
}

/**
 * The server snapshot is `undefined` unconditionally. A module store is
 * per-process on the server, so returning the live value would leak one
 * reader's anchor into another reader's SSR output. Absence is also the
 * correct first paint: the publisher is a client effect and has not run.
 */
function getServerSnapshot(): StoryContext | undefined {
  return undefined;
}

/** §5.2.1 — publish the current valid context. Idempotent per owner. */
export function publishStoryContext(token: symbol, context: StoryContext): void {
  if (current !== null && current.token === token && sameContext(current.context, context)) return;
  current = { token, context };
  emit();
}

/**
 * §5.2.2/§5.2.3 — clear to `undefined`, but ONLY if this owner still
 * holds the entry. See the ownership note above: this guard is what
 * makes L3 (story A -> story B) pass rather than race.
 */
export function clearStoryContext(token: symbol): void {
  if (current === null || current.token !== token) return;
  current = null;
  emit();
}

/**
 * Test seams. NOT used by the product.
 *
 * `peekStoryContextForTest` returns exactly what `getSnapshot` returns, so a
 * node-environment spec can assert the lifecycle semantics (L1-L5) against
 * the REAL store instead of grepping the source for the word "clear". It is
 * the same function the hook reads; there is no second source of truth.
 */
export function resetStoryContextStoreForTest(): void {
  current = null;
  emit();
}

export function peekStoryContextForTest(): StoryContext | undefined {
  return getSnapshot();
}

/**
 * §5.2.5 — the dock READS. It holds no copy, no ref and no memo of a
 * previous anchor, so every submission sees the value that is live at
 * that moment.
 */
export function useAskStoryContext(): StoryContext | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * The publisher side, used by the analysis-owning page.
 *
 * TWO EFFECTS ON PURPOSE. The first publishes or clears as the page's
 * own context changes, which is what closes L2 (`articleId`/
 * `countryCode` leave the URL on the SAME route — no unmount happens, so
 * an unmount-only cleanup would never fire). The second has an empty
 * dependency list and exists solely so that navigation away clears (L1,
 * L5). Folding them into one effect makes the cleanup run on every
 * context change and reintroduces the A -> B race the token guards.
 */
export function usePublishStoryContext(context: StoryContext | undefined): void {
  const tokenRef = useRef<symbol | null>(null);
  if (tokenRef.current === null) tokenRef.current = Symbol('ask-story-context-owner');
  const token = tokenRef.current;

  useEffect(() => {
    if (context === undefined) {
      clearStoryContext(token);
      return;
    }
    publishStoryContext(token, context);
  }, [context, token]);

  useEffect(
    () => () => {
      clearStoryContext(token);
    },
    [token],
  );
}

/**
 * §4.5 / §6.5 — the transition URL.
 *
 * Every parameter whose value is absent is OMITTED; nothing is emitted
 * empty or as the string `undefined`, which is the same "no value is
 * invented" discipline the anchor itself follows. `URLSearchParams`
 * encodes, so no hand-rolled escaping exists to get wrong.
 */
export function fullAnalysisHref(followUp: string, context: StoryContext | undefined): string {
  const params = new URLSearchParams();
  params.set('q', followUp);

  /*
    R2 FINDING 3, OUTBOUND HALF — THE ANCHOR TRAVELS WITH ITS SUBJECT OR
    IT DOES NOT TRAVEL.

    R1 omitted an over-long `storyTitle` but still emitted `articleId`
    and `countryCode`. `/search` then built `title: query`, so the
    anchor arrived paired with the FOLLOW-UP as its subject — the same
    inversion as the inbound case, produced by this function instead of
    by the URL. Omitting one parameter of a set that only means
    something together is not a safe degradation.

    So the anchor set is all-or-nothing: with a subject that will not
    survive the round trip, this emits a plain generic search. The
    reader loses the anchor, which is a visible loss of precision, and
    never gets an answer silently attached to the wrong subject, which
    is an invisible one.
  */
  if (context !== undefined && isTransportableTitle(context.title)) {
    params.set('storyTitle', context.title);
    if (context.articleId !== undefined && context.articleId.length > 0) {
      params.set('articleId', context.articleId);
    }
    if (context.countryCode !== undefined && context.countryCode.length > 0) {
      params.set('countryCode', context.countryCode);
    }
  }

  return `/search?${params.toString()}`;
}

/**
 * The consumer-side bound (§7.2): the ONLY keys the dock may transport.
 * Exported so the spec asserts the same list the product uses rather
 * than a second copy of it.
 */
export const TRANSPORTED_CONTEXT_KEYS = ['title', 'articleId', 'countryCode'] as const;

/**
 * §1.1 — send only `{title, articleId?, countryCode?}`. `url` and
 * `sourceName` are display-only and retrieval ignores them, so they are
 * dropped here rather than at each call site.
 */
export function transportableContext(context: StoryContext | undefined): StoryContext | undefined {
  if (context === undefined) return undefined;
  return {
    title: context.title,
    ...(context.articleId !== undefined ? { articleId: context.articleId } : {}),
    ...(context.countryCode !== undefined ? { countryCode: context.countryCode } : {}),
  };
}
