'use client';

import { useSyncExternalStore } from 'react';
import { MAX_SELECTED_STORIES, type MultiStoryAction, type SelectedStoryRef } from '@globalnews-ai/shared';

/**
 * HOME R1 · STAGE A — "Ask GlobalNewsAI about these stories".
 *
 * The held stories a reader explicitly hands to Ask (from the Compare view, the selected
 * tray or My Intelligence). In memory only — never browser storage (the saved-stories
 * rule) — and identity only: `{articleRef, url}` plus a DISPLAY label for the chip. The
 * label is never sent: the dock sends the identities as governed references and the server
 * resolves them. Publishing opens nothing and sends nothing; the dock reads it live at Send.
 *
 * `entry` / `action` say where the selection came from and which governed multi-story action
 * an ordinary Send applies (My Intelligence: ASK_SELECTED); both are closed vocabularies.
 */

export interface HeldStory extends SelectedStoryRef {
  /** Display only (chip / Inspect before resolution). Never transported. */
  readonly label: string;
}

export interface AskSelection {
  readonly stories: readonly HeldStory[];
  readonly entry: 'compare' | 'my-intelligence';
  readonly action?: MultiStoryAction;
}

const NONE: AskSelection = Object.freeze({ stories: Object.freeze([]) as readonly HeldStory[], entry: 'compare' });
let current: AskSelection = NONE;
const listeners = new Set<() => void>();
const emit = (): void => {
  for (const listener of listeners) listener();
};

export function publishAskSelection(
  stories: readonly HeldStory[],
  meta: { readonly entry?: AskSelection['entry']; readonly action?: MultiStoryAction } = {},
): void {
  const seen = new Set<string>();
  current = {
    stories: stories
      .filter((s) => (seen.has(s.articleRef) ? false : (seen.add(s.articleRef), true)))
      .slice(0, MAX_SELECTED_STORIES),
    entry: meta.entry ?? 'compare',
    ...(meta.action === undefined ? {} : { action: meta.action }),
  };
  emit();
}

export function clearAskSelection(): void {
  if (current.stories.length === 0) return;
  current = NONE;
  emit();
}

export function peekAskSelection(): AskSelection {
  return current;
}

export function useAskSelection(): AskSelection {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => NONE,
  );
}
