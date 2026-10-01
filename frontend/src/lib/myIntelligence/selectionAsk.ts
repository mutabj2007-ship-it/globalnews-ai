'use client';

import {
  MAX_SELECTED_STORIES,
  MULTI_STORY_MIN_STORIES,
  type LanguageCode,
  type MultiStoryAction,
  type SelectedStoryRef,
} from '@globalnews-ai/shared';
import { selectionContextRef } from '@/lib/ask/askContextRef';
import { requestDeeperAsk } from '@/lib/ask/requestDeeperAsk';
import { publishAskSelection } from '@/lib/ask/selectionContextStore';
import { submitGlobalAsk } from '@/lib/ask/submitGlobalAsk';
import { SELECTION_ACTION_QUESTIONS, SelectionActionError } from './selection';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — MY INTELLIGENCE ON THE ONE ASK ENGINE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Under `ask.embedded` + `ask.contextEnvelope` My Intelligence's multi-story actions stop
 * calling `runSelectionAction → analyzeNews → POST /analysis/news` (still present, still
 * the path when the gates are OFF, and still the /search path) and route to Ask R2/V2
 * (Claude H §3):
 *
 *   ASK_SELECTED   → ONE ordinary Ask turn, the reader's typed question, the selection
 *                    attached as governed references (action ASK_SELECTED).
 *   COMPARE · SUMMARIZE · EXPLAIN_DISAGREEMENTS · WHAT_CHANGED · CREATE_BRIEFING
 *                  → the Ask V2 DEEP operation: a QUOTE only (intent deep-analysis, the
 *                    selection + action as references). Nothing runs until the reader
 *                    accepts it; accept → reserve → execute is the server's, idempotent.
 *
 * THE SAFEGUARDS CARRY ACROSS VERBATIM, and still refuse BEFORE anything is published or
 * dispatched — so the zero-compute matrix stays provable: more than MAX_SELECTED_STORIES
 * (`too-many`), fewer than the action's MULTI_STORY_MIN_STORIES (`too-few`), and Ask about
 * selected without a ≥2-character question (`question-required`). Identity only crosses
 * (`{articleRef, url}`); the titles go to the chip as display labels and are never sent.
 */
export type SelectionAskOutcome = 'asked' | 'quoted';

export function routeSelectionToAsk(
  action: MultiStoryAction,
  stories: readonly SelectedStoryRef[],
  language: LanguageCode,
  question: string | undefined,
  labels: Readonly<Record<string, string>>,
): SelectionAskOutcome {
  if (stories.length > MAX_SELECTED_STORIES) throw new SelectionActionError('too-many');
  if (stories.length < MULTI_STORY_MIN_STORIES[action]) throw new SelectionActionError('too-few');
  const typed = question?.trim() ?? '';
  if (action === 'ASK_SELECTED' && typed.length < 2) throw new SelectionActionError('question-required');

  const held = stories.map((story) => ({
    articleRef: story.articleRef,
    url: story.url,
    label: labels[story.articleRef] ?? '',
  }));
  /* The held selection is what an ordinary follow-up Send carries: always ASK_SELECTED. A
     deeper action travels only on its own quote request, below. */
  publishAskSelection(held, { entry: 'my-intelligence', action: 'ASK_SELECTED' });

  if (action === 'ASK_SELECTED') {
    submitGlobalAsk(typed);
    return 'asked';
  }
  const label = SELECTION_ACTION_QUESTIONS[language === 'pl' ? 'pl' : 'en'][action];
  requestDeeperAsk({ question: typed.length >= 2 ? typed : label, context: selectionContextRef(action, stories) });
  return 'quoted';
}
