'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  MyIntelligenceFeedResponse,
  QuestionHistoryEntryView,
  SavedStoryView,
  SaveStoryRequest,
} from '@globalnews-ai/shared';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import {
  fetchMyIntelligenceFeed,
  fetchQuestionHistory,
  fetchSavedStories,
  removeSavedStory,
  saveStory,
} from './myIntelligenceApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE R1 — DATA HOOKS (non-visual integration seams for H's UI)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Conventions follow useCountryFollows: ONE read on mount, a refusal is
 * reported and never optimistically applied, and `null` data means
 * unavailable (signed out, or the request failed) — never an empty account.
 *
 * ZERO COMPUTE. Nothing in this file imports or reaches analyzeNews. Opening
 * My Intelligence, switching tabs, saving, unsaving, reading history and
 * reopening a question are account reads/writes, never AI and never a live
 * provider. The one compute boundary is runSelectionAction (selection.ts).
 */

export interface LoadState<T> {
  readonly data: T | null;
  readonly isLoading: boolean;
  readonly failed: boolean;
  readonly refresh: () => Promise<void>;
}

function useAccountRead<T>(read: () => Promise<T>): LoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await read());
      setFailed(false);
    } catch {
      setData(null);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
    // `read` is a module-level function; one reader per hook instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, failed, refresh };
}

/** Following / For You / New Since — retained reporting only. */
export function useMyIntelligenceFeed(): LoadState<MyIntelligenceFeedResponse> {
  return useAccountRead(fetchMyIntelligenceFeed);
}

export interface SavedStoriesState extends LoadState<readonly SavedStoryView[]> {
  readonly pendingRef: string | null;
  readonly failedUrl: string | null;
  readonly save: (request: SaveStoryRequest) => Promise<SavedStoryView | null>;
  readonly remove: (articleRef: string) => Promise<boolean>;
  readonly isSaved: (articleRef: string) => boolean;
}

export function useSavedStories(): SavedStoriesState {
  const base = useAccountRead(async () => (await fetchSavedStories()).stories);
  const [stories, setStories] = useState<readonly SavedStoryView[] | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => setStories(base.data), [base.data]);

  const save = useCallback(async (request: SaveStoryRequest) => {
    setPendingRef(request.url);
    setFailedUrl(null);
    try {
      const saved = await saveStory(request);
      setStories((current) =>
        current?.some((story) => story.articleRef === saved.articleRef)
          ? current
          : [saved, ...(current ?? [])],
      );
      return saved;
    } catch {
      setFailedUrl(request.url);
      return null;
    } finally {
      setPendingRef(null);
    }
  }, []);

  const remove = useCallback(async (articleRef: string) => {
    setPendingRef(articleRef);
    try {
      await removeSavedStory(articleRef);
      setStories((current) => current?.filter((story) => story.articleRef !== articleRef) ?? current);
      return true;
    } catch {
      return false;
    } finally {
      setPendingRef(null);
    }
  }, []);

  const isSaved = useCallback(
    (articleRef: string) => stories?.some((story) => story.articleRef === articleRef) ?? false,
    [stories],
  );

  return { ...base, data: stories, pendingRef, failedUrl, save, remove, isSaved };
}

export interface QuestionHistoryState extends LoadState<readonly QuestionHistoryEntryView[]> {
  /**
   * Reopen an old question: it is STAGED in Ask and nothing runs. Only the
   * reader's explicit Send starts retrieval/analysis — and only that Send
   * records a new history entry (server-side).
   */
  readonly stage: (entry: Pick<QuestionHistoryEntryView, 'query'>) => void;
}

export function useQuestionHistory(): QuestionHistoryState {
  const base = useAccountRead(fetchQuestionHistory);
  const stage = useCallback((entry: Pick<QuestionHistoryEntryView, 'query'>) => {
    openGlobalAsk(entry.query);
  }, []);
  return { ...base, stage };
}
