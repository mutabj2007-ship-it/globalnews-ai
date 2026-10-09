'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import type { DisplayLocale } from '@globalnews-ai/shared';
import {
  askV2Api,
  type AskV2BriefingDetail,
  type AskV2FollowedCheck,
} from '@/lib/api/askV2Api';
import type { AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { followStrings } from '@/lib/ask/followStrings';
import { finishedCheckTurn, MY_UPDATES_HREF } from '@/lib/ask/followedQuestions';
import { askFormatLocalDay } from '@/lib/ask/askDirection';
import { AskFollowAssessment } from './AskFollowAssessment';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REASON TO RETURN R1 · §8 — "CHECK FOR CHANGES", INSIDE ASK (one shared engine, G13)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `/ask?follow=<id>` (an id only — the question text never travels in the URL). Arrival is a
 * READ: the followed question is placed in the composer as a DRAFT and a banner says what will
 * happen. NOTHING RUNS until the reader presses Send — then it is an ordinary, metered Ask turn.
 * When that turn has finished, it is recorded as the check (`POST …/checks`, 0 AI: the server
 * only compares the stored result with the last saved answer) and the assessment is shown here.
 * A paused or missing followed question offers no check.
 */
export function AskFollowCheck({
  followId,
  turns,
  locale,
  onDraft,
}: {
  readonly followId: string;
  readonly turns: readonly AskR2Turn[];
  readonly locale: DisplayLocale;
  readonly onDraft: (question: string) => void;
}): JSX.Element | null {
  const s = followStrings(locale);
  const [followed, setFollowed] = useState<AskV2BriefingDetail | null | 'missing'>(null);
  const [recorded, setRecorded] = useState<AskV2FollowedCheck | 'recording' | 'failed' | null>(null);
  /* turns already on screen at arrival are never the check */
  const sentFrom = useRef<number | null>(null);
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    void askV2Api.briefing(followId).then((read) => {
      if (!live) return;
      if (!read.ok || typeof read.value.scope.question !== 'string') {
        setFollowed('missing');
        return;
      }
      setFollowed(read.value);
      if (read.value.status === 'ACTIVE') onDraft(read.value.scope.question);
    });
    return () => {
      live = false;
    };
    /* onDraft is the frame's setter; arrival is read once per followed id */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followId]);

  if (sentFrom.current === null && followed !== null) sentFrom.current = turns.length;

  const question = followed !== null && followed !== 'missing' ? (followed.scope.question ?? '') : '';
  const done =
    followed !== null && followed !== 'missing' && followed.status === 'ACTIVE'
      ? finishedCheckTurn(turns, question, sentFrom.current ?? turns.length)
      : null;
  const doneTurnId = done?.operation?.turnId ?? null;

  useEffect(() => {
    if (doneTurnId === null || recordedFor.current === doneTurnId) return;
    recordedFor.current = doneTurnId;
    setRecorded('recording');
    void askV2Api.recordFollowedCheck(followId, doneTurnId).then((outcome) => {
      setRecorded(outcome.ok ? outcome.value : 'failed');
    });
  }, [doneTurnId, followId]);

  if (followed === null || followed === 'missing') return null;
  if (followed.status !== 'ACTIVE') {
    return (
      <section data-ask="follow-check" data-ask-follow-check="paused" role="status" className="mb-4 flex flex-col gap-2 rounded-[var(--ad-radius-card,12px)] border border-[var(--ad-line,#26324a)] bg-[var(--ad-surface,#0f1420)] p-4 text-[var(--ad-t-sm,0.9375rem)] leading-[1.5] text-[var(--ad-ink,#edeff5)]">
        <p>{s.checkPausedBanner}</p>
        <Link href={MY_UPDATES_HREF} prefetch={false} className="font-medium text-[var(--ad-accent,#7aa2ff)] underline underline-offset-4">
          {s.openMyUpdates}
        </Link>
      </section>
    );
  }

  const latest = followed.versions[followed.versions.length - 1];
  const asOf = latest ? askFormatLocalDay(new Date(latest.asOf), locale) : '—';

  return (
    <section
      data-ask="follow-check"
      data-ask-follow-check={recorded === null ? 'ready' : typeof recorded === 'string' ? recorded : 'recorded'}
      aria-live="polite"
      className="mb-4 flex flex-col gap-2 rounded-[var(--ad-radius-card,12px)] border border-[var(--ad-line,#26324a)] bg-[var(--ad-surface,#0f1420)] p-4 text-[var(--ad-t-sm,0.9375rem)] leading-[1.5] text-[var(--ad-ink,#edeff5)]"
    >
      {recorded === null && (
        <>
          <p>{s.checkBanner(followed.title, asOf)}</p>
          <p>{s.checkBannerHint}</p>
          <p>{s.checkCost}</p>
        </>
      )}
      {recorded === 'recording' && <p role="status">{s.checkRecording}</p>}
      {recorded === 'failed' && <p role="status">{s.checkNotRecorded}</p>}
      {recorded !== null && typeof recorded !== 'string' && (
        <>
          <AskFollowAssessment check={recorded} locale={locale} />
          <p role="status">{s.checkRecorded}</p>
        </>
      )}
      <Link href={MY_UPDATES_HREF} prefetch={false} data-ask="follow-open-updates" className="font-medium text-[var(--ad-accent,#7aa2ff)] underline underline-offset-4">
        {s.openMyUpdates}
      </Link>
    </section>
  );
}
