'use client';

import { useEffect, useRef, type JSX } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { useHomeSession } from '@/components/home/reva/HomeSession';
import { fetchAlertsByArticle, fetchDiscussionCounts } from '@/lib/stories/stageBApi';
import { openAlertSetup, openDiscussion, setAlertsByRef, setCounts, useStageB } from '@/lib/stories/stageBStore';
import { takeStoryTask } from '@/lib/stories/storyTask';
import { DiscussionPanel } from './DiscussionPanel';
import { AlertSetupSheet } from './AlertSetupSheet';
import { AlertsCentre } from './AlertsCentre';

/**
 * HOME R1 · STAGE B — the one client host for Discuss / Alert on Home.
 *
 * Reads, at most once per page view and only for capabilities that exist:
 *   discussion.read → ONE batched POST /discussion/counts for the cards on the page;
 *   alerts.inApp + signed in → ONE POST /alerts/by-article for the same cards.
 * Restores a sign-in continuation (storyTask.ts) once the session is known: it reopens the
 * panel with the kept draft; it never posts or saves by itself.
 * No AI, no provider, no Ask. Theme changes re-render tokens only — no request.
 */
export function StageBHost({
  language,
  articleRefs,
  discussionRead,
  discussionWrite,
  alertsInApp,
}: {
  readonly language: LanguageCode;
  readonly articleRefs: readonly string[];
  readonly discussionRead: boolean;
  readonly discussionWrite: boolean;
  readonly alertsInApp: boolean;
}): JSX.Element | null {
  const { user, isLoading } = useHomeSession();
  const { panel } = useStageB();
  const signedIn = isLoading ? null : user !== null;
  const countsRead = useRef(false);
  const alertsReadFor = useRef<string | null>(null);
  const restored = useRef(false);
  const refsKey = articleRefs.join(',');

  useEffect(() => {
    if (!discussionRead || countsRead.current || articleRefs.length === 0) return;
    countsRead.current = true;
    void fetchDiscussionCounts(articleRefs).then(setCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionRead, refsKey]);

  useEffect(() => {
    if (!alertsInApp || user === null || articleRefs.length === 0 || alertsReadFor.current === user.id) return;
    alertsReadFor.current = user.id;
    void fetchAlertsByArticle(articleRefs).then((byRef) => {
      if (byRef !== null) setAlertsByRef(byRef);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsInApp, user, refsKey]);

  useEffect(() => {
    if (isLoading || restored.current) return;
    restored.current = true;
    const task = takeStoryTask();
    if (task === null) return;
    if (task.kind === 'discuss' && discussionRead) openDiscussion(task.story, task.draft, task.parentId ?? null);
    if (task.kind === 'alert' && alertsInApp) openAlertSetup(task.story);
  }, [isLoading, discussionRead, alertsInApp]);

  if (panel.kind === 'discussion' && discussionRead) {
    return (
      <DiscussionPanel
        key={panel.story.articleRef}
        story={panel.story}
        language={language}
        canWrite={discussionWrite}
        signedIn={signedIn}
        initialDraft={panel.draft}
        initialParentId={panel.parentId}
      />
    );
  }
  if (panel.kind === 'alertSetup' && alertsInApp) return <AlertSetupSheet story={panel.story} language={language} signedIn={signedIn} />;
  if (panel.kind === 'alerts' && alertsInApp && user !== null) return <AlertsCentre language={language} replies={discussionRead} />;
  return null;
}
