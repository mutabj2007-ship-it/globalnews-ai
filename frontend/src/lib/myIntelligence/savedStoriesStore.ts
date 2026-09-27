'use client';

import { normalizeArticleUrl, type SavedStoryView, type SaveStoryRequest } from '@globalnews-ai/shared';
import { hasSessionHint } from '@/lib/api/sessionHint';
import { MyIntelligenceApiError, fetchSavedStories, removeSavedStory, saveStory } from './myIntelligenceApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE DENSITY + UNIVERSAL BOOKMARK R1 — ONE SAVED-STORY STATE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every bookmark in the product reads and writes THIS store, so a page that
 * shows 1, 10 or 50 bookmarkable stories makes at most ONE
 * GET /users/me/saved/stories — never one per card. A save or unsave is
 * applied here once and every card showing the same story (compared by the
 * normalized URL, the same identity the server hashes) updates together.
 *
 * It is the EXISTING saved-story system, not a second one: the same three
 * endpoints, the same server-resolved metadata and the same server-governed
 * articleRef. Nothing is kept in browser storage, no article body is held,
 * and save / unsave are account persistence only — no AI, no live provider.
 *
 * Signed out (no session hint), nothing is requested at all: the bookmark
 * stays visible and routes to sign-in, and no saved state is invented.
 */

export interface SavedStoriesSnapshot {
  readonly data: readonly SavedStoryView[] | null;
  readonly isLoading: boolean;
  readonly failed: boolean;
  /** No session: the reader must sign in to save. */
  readonly signedOut: boolean;
  /** The URL or articleRef whose save/unsave is in flight. */
  readonly pendingKey: string | null;
  /** The URL whose last save did not succeed, and why. */
  readonly failedUrl: string | null;
  readonly failureKind: 'unavailable' | 'error' | null;
}

const INITIAL: SavedStoriesSnapshot = {
  data: null,
  isLoading: true,
  failed: false,
  signedOut: false,
  pendingKey: null,
  failedUrl: null,
  failureKind: null,
};

let snapshot: SavedStoriesSnapshot = INITIAL;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<SavedStoriesSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function subscribeSavedStories(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSavedStoriesSnapshot(): SavedStoriesSnapshot {
  return snapshot;
}

/** Server render: never another reader's state. */
export function getServerSavedStoriesSnapshot(): SavedStoriesSnapshot {
  return INITIAL;
}

/** The one read. Concurrent callers share the same promise; a loaded store is not re-read. */
export function ensureSavedStoriesLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight !== null) return inflight;

  if (!hasSessionHint()) {
    loaded = true;
    set({ data: null, isLoading: false, failed: false, signedOut: true });
    return Promise.resolve();
  }

  inflight = fetchSavedStories()
    .then((response) => set({ data: response.stories, isLoading: false, failed: false, signedOut: false }))
    .catch((error: unknown) => {
      const unauthorized = error instanceof MyIntelligenceApiError && error.status === 401;
      set({ data: null, isLoading: false, failed: !unauthorized, signedOut: unauthorized });
    })
    .finally(() => {
      loaded = true;
      inflight = null;
    });
  return inflight;
}

/** An explicit re-read (retry). Still one request, shared by every subscriber. */
export function refreshSavedStories(): Promise<void> {
  loaded = false;
  return ensureSavedStoriesLoaded();
}

/**
 * Account change / sign-out: forget everything, so the next reader starts clean.
 * Mounted bookmarks re-evaluate at once — after sign-out there is no session
 * hint, so that means "signed out" with ZERO requests, never the old saved set.
 */
export function invalidateSavedStories(): void {
  loaded = false;
  inflight = null;
  snapshot = INITIAL;
  for (const listener of listeners) listener();
  if (listeners.size > 0) void ensureSavedStoriesLoaded();
}

export function resetSavedStoriesStoreForTest(): void {
  loaded = false;
  inflight = null;
  snapshot = INITIAL;
  listeners.clear();
}

/** The saved record for a URL, matched on the normalized URL the server hashes. */
export function findSavedStory(
  stories: readonly SavedStoryView[] | null,
  url: string,
): SavedStoryView | undefined {
  if (stories === null) return undefined;
  const normalized = normalizeArticleUrl(url);
  return stories.find(
    (story) =>
      normalizeArticleUrl(story.canonicalUrl) === normalized || normalizeArticleUrl(story.sourceUrl) === normalized,
  );
}

/** Exactly one POST. The server resolves the story; a story it cannot resolve is reported, not faked. */
export async function saveSavedStory(request: SaveStoryRequest): Promise<SavedStoryView | null> {
  set({ pendingKey: request.url, failedUrl: null, failureKind: null });
  try {
    const saved = await saveStory(request);
    const current = snapshot.data ?? [];
    set({
      data: current.some((story) => story.articleRef === saved.articleRef) ? current : [saved, ...current],
      pendingKey: null,
    });
    return saved;
  } catch (error) {
    const unavailable = error instanceof MyIntelligenceApiError && (error.status === 404 || error.status === 422);
    set({ pendingKey: null, failedUrl: request.url, failureKind: unavailable ? 'unavailable' : 'error' });
    return null;
  }
}

/** Exactly one DELETE, by the server-issued articleRef. */
export async function removeSavedStoryByRef(articleRef: string): Promise<boolean> {
  set({ pendingKey: articleRef, failedUrl: null, failureKind: null });
  try {
    await removeSavedStory(articleRef);
    set({ data: snapshot.data?.filter((story) => story.articleRef !== articleRef) ?? snapshot.data, pendingKey: null });
    return true;
  } catch {
    set({ pendingKey: null });
    return false;
  }
}
