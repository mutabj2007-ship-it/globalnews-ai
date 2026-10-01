'use client';

import { useSyncExternalStore } from 'react';
import { MAX_SELECTED_STORIES } from '@globalnews-ai/shared';

/**
 * HOME R1 · STAGE A — HOLD → COMPARE (FINAL spec §9; Claude H §11).
 *
 * The Home's held stories. The SAME contract as My Intelligence's `useStorySelection`
 * (identity `{articleRef, url}`, MAX_SELECTED_STORIES = 8, the ninth refused) — but shared
 * between the cards, the tray and the Compare view, so it is a tiny module store rather
 * than component state. Rules carried across verbatim:
 *
 *   · ZERO NETWORK. Holding, releasing, clearing and refusing touch no API, no provider,
 *     no model and no storage — in memory only (the saved-stories "nothing is kept in
 *     browser storage" rule). Reload clears it.
 *   · The ninth story is REFUSED, at zero network, and the refusal is returned so the UI
 *     can say so.
 *   · `card` is DISPLAY data the reader already sees on the card (title, image, publisher).
 *     It is never sent anywhere: Compare reads the retained record from the server by
 *     identity, and Ask receives the identity only.
 */

export interface HeldStoryCard {
  readonly title: string;
  readonly imageUrl?: string;
  readonly sourceName: string;
}

export interface HeldStory {
  readonly articleRef: string;
  readonly url: string;
  readonly card: HeldStoryCard;
}

export type HoldOutcome = 'held' | 'released' | 'full';

let held: readonly HeldStory[] = [];
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const listener of listeners) listener();
};

export function toggleHeldStory(story: HeldStory): HoldOutcome {
  if (held.some((s) => s.articleRef === story.articleRef)) {
    held = held.filter((s) => s.articleRef !== story.articleRef);
    emit();
    return 'released';
  }
  if (held.length >= MAX_SELECTED_STORIES) return 'full';
  held = [...held, story];
  emit();
  return 'held';
}

export function releaseHeldStory(articleRef: string): void {
  if (!held.some((s) => s.articleRef === articleRef)) return;
  held = held.filter((s) => s.articleRef !== articleRef);
  emit();
}

export function clearHeldStories(): void {
  if (held.length === 0) return;
  held = [];
  emit();
}

export function peekHeldStories(): readonly HeldStory[] {
  return held;
}

const EMPTY: readonly HeldStory[] = [];

export function useHeldStories(): readonly HeldStory[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => held,
    () => EMPTY,
  );
}
