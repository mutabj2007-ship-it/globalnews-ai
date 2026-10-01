'use client';

import { useSyncExternalStore } from 'react';

/**
 * HOME R1 · STAGE B — the in-memory UI state of Discuss / Alert / the Alerts centre.
 *
 * Module state only (no browser storage — the one exception is the sign-in continuation
 * record in storyTask.ts). Opening a panel never sends a request by itself; the panel's own
 * read does, and only the read that capability exists for.
 */
export interface StoryTarget {
  readonly articleRef: string;
  readonly url: string;
  readonly title: string;
  readonly sourceName: string;
}

export type StageBPanel =
  | { readonly kind: 'none' }
  | { readonly kind: 'discussion'; readonly story: StoryTarget; readonly draft?: string; readonly parentId?: string | null }
  | { readonly kind: 'alertSetup'; readonly story: StoryTarget }
  | { readonly kind: 'alerts' };

interface State {
  readonly panel: StageBPanel;
  /** Real server counts only: a ref is present only when the server reported > 0. */
  readonly counts: Readonly<Record<string, number>>;
  /** The reader's alerts by article (signed in + alerts.inApp only). */
  readonly alertsByRef: Readonly<Record<string, { alertId: string; status: string }>>;
  /** Unread total for the header badge (null = unknown, never guessed). */
  readonly unread: number | null;
}

let state: State = { panel: { kind: 'none' }, counts: {}, alertsByRef: {}, unread: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<State>): void => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useStageB(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const openDiscussion = (story: StoryTarget, draft?: string, parentId?: string | null): void =>
  emit({ panel: { kind: 'discussion', story, draft, parentId } });
export const openAlertSetup = (story: StoryTarget): void => emit({ panel: { kind: 'alertSetup', story } });
export const openAlertsCentre = (): void => emit({ panel: { kind: 'alerts' } });
export const closePanel = (): void => emit({ panel: { kind: 'none' } });

export const setCounts = (counts: Readonly<Record<string, number>>): void => emit({ counts: { ...state.counts, ...counts } });
export function setCount(articleRef: string, count: number): void {
  const counts = { ...state.counts };
  if (count > 0) counts[articleRef] = count;
  else delete counts[articleRef];
  emit({ counts });
}
export const setAlertsByRef = (alertsByRef: Readonly<Record<string, { alertId: string; status: string }>>): void =>
  emit({ alertsByRef: { ...state.alertsByRef, ...alertsByRef } });
export function setAlertFor(articleRef: string, value: { alertId: string; status: string } | null): void {
  const alertsByRef = { ...state.alertsByRef };
  if (value === null) delete alertsByRef[articleRef];
  else alertsByRef[articleRef] = value;
  emit({ alertsByRef });
}
export const setUnread = (unread: number | null): void => emit({ unread });

/** Test seam. */
export function resetStageBForTests(): void {
  state = { panel: { kind: 'none' }, counts: {}, alertsByRef: {}, unread: null };
  for (const listener of listeners) listener();
}
export const readStageB = (): State => state;
