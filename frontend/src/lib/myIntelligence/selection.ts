'use client';

import { useCallback, useState } from 'react';
import {
  MAX_SELECTED_STORIES,
  MULTI_STORY_MIN_STORIES,
  type AnalysisApiResponse,
  type LanguageCode,
  type MultiStoryAction,
  type SelectedStoryRef,
} from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE R1 — MULTI-STORY SELECTION AND THE ONE COMPUTE BOUNDARY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Selecting, deselecting, clearing and choosing an action are pure local
 * state: 0 requests. runSelectionAction is the ONLY function here that can
 * start compute, and H's UI calls it only from the explicit final Run /
 * Confirm. It goes through the existing analyzeNews() client and the existing
 * POST /analysis/news — no second pipeline, no Ask V2, no Sand.
 */

export interface StorySelectionState {
  readonly selected: readonly SelectedStoryRef[];
  readonly isSelected: (articleRef: string) => boolean;
  /** Returns false (and changes nothing) when adding would exceed MAX_SELECTED_STORIES. */
  readonly toggle: (story: SelectedStoryRef) => boolean;
  readonly clear: () => void;
  readonly canRun: (action: MultiStoryAction) => boolean;
  readonly maxSelected: number;
}

export function useStorySelection(): StorySelectionState {
  const [selected, setSelected] = useState<readonly SelectedStoryRef[]>([]);

  const isSelected = useCallback(
    (articleRef: string) => selected.some((story) => story.articleRef === articleRef),
    [selected],
  );

  const toggle = useCallback(
    (story: SelectedStoryRef) => {
      if (selected.some((entry) => entry.articleRef === story.articleRef)) {
        setSelected(selected.filter((entry) => entry.articleRef !== story.articleRef));
        return true;
      }
      if (selected.length >= MAX_SELECTED_STORIES) return false;
      setSelected([...selected, { articleRef: story.articleRef, url: story.url }]);
      return true;
    },
    [selected],
  );

  const clear = useCallback(() => setSelected([]), []);
  const canRun = useCallback(
    (action: MultiStoryAction) =>
      selected.length >= MULTI_STORY_MIN_STORIES[action] && selected.length <= MAX_SELECTED_STORIES,
    [selected],
  );

  return { selected, isSelected, toggle, clear, canRun, maxSelected: MAX_SELECTED_STORIES };
}

/**
 * The question text recorded and sent for an action without a typed question.
 * It names the action the reader ran — never an answer.
 */
export const SELECTION_ACTION_QUESTIONS: Readonly<Record<'en' | 'pl', Readonly<Record<MultiStoryAction, string>>>> = {
  en: {
    COMPARE: 'Compare the selected stories',
    SUMMARIZE: 'Summarize the selected stories',
    ASK_SELECTED: 'Ask about the selected stories',
    EXPLAIN_DISAGREEMENTS: 'Explain the disagreements between the selected stories',
    WHAT_CHANGED: 'What changed across the selected stories',
    CREATE_BRIEFING: 'Create a briefing from the selected stories',
  },
  pl: {
    COMPARE: 'Porównaj wybrane artykuły',
    SUMMARIZE: 'Podsumuj wybrane artykuły',
    ASK_SELECTED: 'Zapytaj o wybrane artykuły',
    EXPLAIN_DISAGREEMENTS: 'Wyjaśnij rozbieżności między wybranymi artykułami',
    WHAT_CHANGED: 'Co się zmieniło w wybranych artykułach',
    CREATE_BRIEFING: 'Przygotuj briefing z wybranych artykułów',
  },
};

export class SelectionActionError extends Error {
  constructor(readonly reason: 'too-few' | 'too-many' | 'question-required') {
    super(`Selection action refused: ${reason}`);
    this.name = 'SelectionActionError';
  }
}

/**
 * THE EXPLICIT RUN. One call → at most one POST /analysis/news → at most one
 * history entry (server-side). Refuses locally, with no request, when the
 * selection is outside the action's bounds or "Ask about selected" has no
 * question.
 */
export function runSelectionAction(
  action: MultiStoryAction,
  stories: readonly SelectedStoryRef[],
  language: LanguageCode,
  question?: string,
): Promise<AnalysisApiResponse> {
  if (stories.length > MAX_SELECTED_STORIES) return Promise.reject(new SelectionActionError('too-many'));
  if (stories.length < MULTI_STORY_MIN_STORIES[action]) return Promise.reject(new SelectionActionError('too-few'));

  const typed = question?.trim() ?? '';
  if (action === 'ASK_SELECTED' && typed.length < 2) {
    return Promise.reject(new SelectionActionError('question-required'));
  }
  const labels = SELECTION_ACTION_QUESTIONS[language === 'pl' ? 'pl' : 'en'];
  const query = typed.length >= 2 ? typed : labels[action];

  return analyzeNews(query, language, undefined, undefined, {
    action,
    stories: stories.map((story) => ({ articleRef: story.articleRef, url: story.url })),
  });
}
