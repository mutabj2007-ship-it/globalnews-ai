'use client';

import { useCallback, useState } from 'react';
import {
  MAX_SELECTED_STORIES,
  MULTI_STORY_MIN_STORIES,
  type LanguageCode,
  type MultiStoryAction,
  type SelectedStoryRef,
} from '@globalnews-ai/shared';
import type { AskV2ContextRef } from '@/lib/api/askV2Api';
import type { AskR2SubmitOutcome, AskR2Turn } from '@/lib/ask/useAskR2Conversation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE R1 — MULTI-STORY SELECTION AND THE ONE COMPUTE BOUNDARY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Selecting, deselecting, clearing and choosing an action are pure local
 * state: 0 requests. runSelectionAction is the ONLY function here that can
 * start compute, and H's UI calls it only from the explicit final Run /
 * Confirm.
 *
 * UNIFIED INTELLIGENCE BINDING R2D — it no longer calls POST /analysis/news. The explicit
 * Confirm is ONE canonical Ask V2 turn (the caller's conversation submit) carrying a SELECTION
 * reference — the action and the SelectedStoryRefs, nothing else. The server resolves every
 * story (or refuses the turn), executes the existing selection branch under the canonical
 * controls, and the result is an Ask answer: thread, Recent, reopenable. No Sand.
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

/** R2D — the canonical conversation's submit (useAskR2Conversation().submit). */
export type SelectionSubmit = (
  question: string,
  context: AskV2ContextRef,
  onTurn: (turn: AskR2Turn) => void,
) => Promise<AskR2SubmitOutcome>;

/** What one explicit Run produced: the canonical outcome and, when a turn exists, that turn. */
export interface SelectionRun {
  readonly outcome: AskR2SubmitOutcome;
  readonly turn: AskR2Turn | null;
  readonly question: string;
}

/**
 * THE EXPLICIT RUN. One call → at most one canonical Ask V2 turn. Refuses locally, with no
 * request, when the selection is outside the action's bounds or "Ask about selected" has no
 * question.
 */
export async function runSelectionAction(
  action: MultiStoryAction,
  stories: readonly SelectedStoryRef[],
  language: LanguageCode,
  question: string | undefined,
  submit: SelectionSubmit,
): Promise<SelectionRun> {
  if (stories.length > MAX_SELECTED_STORIES) throw new SelectionActionError('too-many');
  if (stories.length < MULTI_STORY_MIN_STORIES[action]) throw new SelectionActionError('too-few');

  const typed = question?.trim() ?? '';
  if (action === 'ASK_SELECTED' && typed.length < 2) {
    throw new SelectionActionError('question-required');
  }
  const labels = SELECTION_ACTION_QUESTIONS[language === 'pl' ? 'pl' : 'en'];
  const query = typed.length >= 2 ? typed : labels[action];

  let answered: AskR2Turn | null = null;
  const outcome = await submit(
    query,
    {
      kind: 'SELECTION',
      action,
      stories: stories.map((story) => ({ articleRef: story.articleRef, url: story.url })),
    },
    (turn) => {
      answered = turn;
    },
  );
  return { outcome, turn: answered, question: query };
}
