'use client';

import { useSyncExternalStore } from 'react';
import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * COMPACT VISUAL PRODUCT R1 — which story's Brief panel is open, and at which section.
 *
 * Module state only, in the stageBStore manner: NO browser storage (S-8). Opening the panel sends
 * no request by itself and starts no compute — the panel's own adapter READ does, and today that
 * read answers OFF without the network (lib/api/storyBriefApi.ts).
 *
 * The story is carried as the fields the feed already delivered to the page, so the panel can
 * show the reporting we hold without a second request. `articleRef` is the governed identity the
 * server resolves to its canonical Story (Discussion and Alerts use the same key).
 */
export interface VisualBriefStory {
  readonly articleRef: string;
  readonly url: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceName: string;
  readonly sourcesCount: number;
  readonly publishedAt: string;
  readonly publishedAtBasis: NewsArticle['publishedAtBasis'];
  readonly category: NewsArticle['category'];
}

export type VisualBriefSection = 'top' | 'discussion';

/** One item the INTERNAL evidence preview shows: a Brief evidence reference or the card's own source. */
export interface VisualEvidenceItem {
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
  readonly publishedAtBasis: NewsArticle['publishedAtBasis'];
  readonly url: string | null;
  /** The publisher's own summary, only for the card's own source (attributed). */
  readonly summary: string | null;
}

export type VisualBriefPanel =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'brief';
      readonly story: VisualBriefStory;
      readonly section: VisualBriefSection;
      /** The evidence item being previewed inside the panel, or null for the Brief itself. */
      readonly evidence: VisualEvidenceItem | null;
    };

let panel: VisualBriefPanel = { kind: 'none' };
const listeners = new Set<() => void>();
const emit = (next: VisualBriefPanel): void => {
  panel = next;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useVisualBrief(): VisualBriefPanel {
  return useSyncExternalStore(subscribe, () => panel, () => panel);
}

/** The history marker a pushed entry carries, so Back can close exactly the panel it opened. */
export const VISUAL_BRIEF_HISTORY_KEY = 'gnaVisualBrief';

export function openVisualBrief(story: VisualBriefStory, section: VisualBriefSection = 'top'): void {
  const wasOpen = panel.kind === 'brief';
  emit({ kind: 'brief', story, section, evidence: null });
  /* Browser Back closes the brief (design doc 01): one history entry per opening, never stacked. */
  if (!wasOpen && typeof window !== 'undefined') {
    window.history.pushState({ ...(window.history.state ?? {}), [VISUAL_BRIEF_HISTORY_KEY]: true }, '');
  }
}

export function setVisualEvidence(evidence: VisualEvidenceItem | null): void {
  if (panel.kind !== 'brief') return;
  emit({ ...panel, evidence });
}

/** Close from a control (Close, Escape, scrim): consume the entry the opening pushed. */
export function closeVisualBrief(): void {
  if (panel.kind === 'none') return;
  emit({ kind: 'none' });
  if (typeof window !== 'undefined' && (window.history.state as Record<string, unknown> | null)?.[VISUAL_BRIEF_HISTORY_KEY] === true) {
    window.history.back();
  }
}

/** Back was pressed: the entry is already gone, only the state closes. */
export function closeVisualBriefFromHistory(): void {
  if (panel.kind !== 'none') emit({ kind: 'none' });
}

export function readVisualBrief(): VisualBriefPanel {
  return panel;
}

/** Test seam. */
export function resetVisualBriefForTests(): void {
  emit({ kind: 'none' });
}
