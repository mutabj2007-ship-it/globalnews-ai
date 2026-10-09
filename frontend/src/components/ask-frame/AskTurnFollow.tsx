'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import styles from './askDashboard.module.css';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askR2PayloadOf, askV2Api, type AskV2Operation } from '@/lib/api/askV2Api';
import { briefingsAvailable } from '@/lib/ask/briefingStrings';
import { followStrings } from '@/lib/ask/followStrings';
import { isFollowedQuestion, MY_UPDATES_HREF, sameFollowedQuestion } from '@/lib/ask/followedQuestions';
import { ASK_SAVABLE_ANSWER_STATES } from './AskTurnSave';

/**
 * REASON TO RETURN R1 · §8 — "Follow this question", a first-class toolbar action (FJ-6: the
 * briefing control used to be reachable only inside More, and More was hidden whenever it had no
 * other row).
 *
 * Following saves THIS answer as the starting point (version 1 of the reader's own briefing,
 * scope ASK_QUESTION — the one shared store; no second following system). Nothing is scheduled
 * and nothing runs later on its own: a check is always one the reader starts in My updates.
 * Shown only for a signed-in reader's saveable answer and only when the server has briefings on.
 */
export function AskTurnFollow({
  operation,
  question,
  locale,
}: {
  readonly operation: AskV2Operation | undefined;
  readonly question: string;
  readonly locale: DisplayLocale;
}): JSX.Element | null {
  const s = followStrings(locale);
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'following' | 'failed'>('idle');
  const inFlight = useRef(false);
  const turnId = operation?.turnId ?? null;
  const answerState = askR2PayloadOf(operation)?.answer.state;
  const eligible =
    turnId !== null &&
    operation?.status === 'COMPLETED' &&
    operation.result !== null &&
    answerState !== undefined &&
    ASK_SAVABLE_ANSWER_STATES.has(answerState);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    void briefingsAvailable(() => askV2Api.briefings()).then(async (on) => {
      if (cancelled) return;
      setAvailable(on);
      if (!on) return;
      /* already followed → say so, never offer a duplicate (a failed read: not known, so offer) */
      const list = await askV2Api.briefings().catch(() => null);
      if (cancelled || list === null || !list.ok) return;
      if (
        list.value.some(
          (row) =>
            isFollowedQuestion(row) &&
            row.status !== 'ARCHIVED' &&
            sameFollowedQuestion(row.scope.question as string, question),
        )
      ) {
        setState('following');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [eligible, question]);

  if (!eligible || !available) return null;

  if (state === 'following') {
    /* the toolbar's own pressed state (as Save's), and it opens My updates */
    return (
      <button
        type="button"
        data-ask="follow"
        data-ask-follow-state="following"
        aria-pressed="true"
        title={s.openMyUpdates}
        onClick={() => window.location.assign(MY_UPDATES_HREF)}
      >
        {s.following}
        <span className={styles.visuallyHidden}>{` — ${s.openMyUpdates}`}</span>
      </button>
    );
  }

  async function follow(): Promise<void> {
    if (inFlight.current || turnId === null) return;
    inFlight.current = true;
    setState('busy');
    try {
      const outcome = await askV2Api.createBriefing(turnId);
      setState(outcome.ok ? 'following' : 'failed');
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <>
      <button
        type="button"
        data-ask="follow"
        data-ask-follow-state={state}
        disabled={state === 'busy'}
        onClick={() => void follow()}
        title={s.followNote}
      >
        {s.follow}
      </button>
      {state === 'failed' && (
        <span role="status" data-ask="follow-failed">
          {s.followFailed}
        </span>
      )}
    </>
  );
}
