'use client';

import { useEffect, useState, type JSX } from 'react';
import Link from 'next/link';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askV2Api, type AskV2RecentThread } from '@/lib/api/askV2Api';
import { askReopenHref } from '@/lib/ask/askRecentGrouping';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { followStrings } from '@/lib/ask/followStrings';
import { MY_UPDATES_HREF, summarizeFollows, type FollowSummary } from '@/lib/ask/followedQuestions';
import { askPrimaryNavStrings } from '@/lib/ask/askPrimaryNavStrings';
import { askFormatLocalDay, askFormatLocalTime } from '@/lib/ask/askDirection';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { conversationTitle } from './AskConversations';
import styles from './askDashboard.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 FULL DESIGN R1 — WELCOME ENTRIES (WELCOME_PLACEHOLDER_SPEC §Composition 6–8)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 6. D02 only, "when genuinely available": one compact group — Resume · {root title} and
 *    My updates. Resume is the reader's OWN most recent conversation (`GET /ask-v2/threads`, a
 *    read: 0 AI · 0 provider), shown only to a signed-in reader and only when it can be reopened.
 *    My updates (R3 NAV/USABILITY R1) appears only when the reader really follows questions, with
 *    the facts GET /ask-v2/briefings returns (N followed, changes at last check, last completed
 *    check). Still no "to review" count: there is no reviewed/unreviewed state yet (B2).
 * 7. "Job opportunities ›" — a text button with a 44 px target that opens the J01 setup sheet.
 * 8. "Europe · East Africa · Middle East", 13 px ink-3; screen readers hear "Coverage focus: …".
 *    An orientation statement, never a claim that a place has reporting or job coverage.
 */
/** The signed-in reader's most recent reopenable conversation; null while unknown or absent. */
export function useResumeConversation(signedIn: boolean): AskV2RecentThread | null {
  const [latest, setLatest] = useState<AskV2RecentThread | null>(null);
  useEffect(() => {
    if (!signedIn) {
      setLatest(null);
      return;
    }
    let cancelled = false;
    void askV2Api.threads().then((outcome) => {
      if (cancelled || !outcome.ok) return;
      const reopenable = outcome.value
        .filter((row) => askReopenHref(row) !== null)
        .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));
      setLatest(reopenable[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);
  return latest;
}

/**
 * ASK R3 NAVIGATION / USABILITY R1 — the signed-in reader's real follow facts for the welcome's
 * My updates entry: one `GET /ask-v2/briefings` (a database read: 0 AI · 0 provider). Null while
 * unread (so the entry never flashes "0"), on any failure (briefings off, network), and when the
 * reader follows nothing — the entry is then omitted, never shown empty.
 */
export function useFollowSummary(signedIn: boolean): FollowSummary | null {
  const [summary, setSummary] = useState<FollowSummary | null>(null);
  useEffect(() => {
    if (!signedIn) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    void askV2Api.briefings().then((outcome) => {
      if (cancelled) return;
      setSummary(outcome.ok ? summarizeFollows(outcome.value) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);
  return summary;
}

export function AskWelcomeEntries({
  locale,
  signedIn,
  latest,
  follows = null,
  onOpenJobs,
  placement,
}: {
  readonly locale: DisplayLocale;
  readonly signedIn: boolean;
  /** From `useResumeConversation`, read once by the frame for both placements. */
  readonly latest: AskV2RecentThread | null;
  /** From `useFollowSummary`: null → no My updates entry (nothing followed, or not yet read). */
  readonly follows?: FollowSummary | null;
  readonly onOpenJobs: () => void;
  /** The phone/tablet welcome group, or under the centred desktop composer. CSS shows one. */
  readonly placement: 'welcome' | 'desktop';
}): JSX.Element {
  const s = askR3FullStrings(locale);
  const f = followStrings(locale);
  const noQuestion = askShellStrings(locale).askContinuityStrings.noQuestionStored;
  const resumeHref = latest === null ? null : askReopenHref(latest);
  const n = askPrimaryNavStrings(locale);
  const followLine =
    follows === null
      ? null
      : [n.followedCount(follows.followed), follows.withChanges > 0 ? n.withChangesAtLastCheck(follows.withChanges) : null]
          .filter((part): part is string => part !== null)
          .join(' · ');
  const lastCheck =
    follows === null || follows.lastSuccessfulAt === null
      ? null
      : f.lastSuccessful(
          `${askFormatLocalDay(new Date(follows.lastSuccessfulAt), locale)} ${askFormatLocalTime(new Date(follows.lastSuccessfulAt), locale)}`,
        );
  const showGroup = (latest !== null && resumeHref !== null) || follows !== null;

  return (
    <div
      data-ask={placement === 'welcome' ? 'welcome-entries' : 'welcome-entries-desktop'}
      className={placement === 'welcome' ? styles.r3EntriesWelcome : styles.r3EntriesDesktop}
    >
      {signedIn && showGroup && (
        <div role="group" aria-label={s.resumeGroupLabel} data-ask="welcome-resume-group" className={styles.r3ResumeGroup}>
          {latest !== null && resumeHref !== null && (
            <Link href={resumeHref} prefetch={false} data-ask="welcome-resume">
              <span>
                <span className={styles.r3Small}>{s.resume}</span>
                {/* the reader's own words keep their own direction (an English title in Arabic chrome) */}
                <span dir="auto" className={styles.r3OneLine}>
                  {conversationTitle(latest, noQuestion)}
                </span>
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          )}
          {/* ASK R3 NAVIGATION / USABILITY R1 — only when real followed questions exist, with only
              the facts the briefings read returned (R3 spec L12: omit the row with no data). */}
          {follows !== null && followLine !== null && (
            <Link href={MY_UPDATES_HREF} prefetch={false} data-ask="welcome-updates" data-ask-followed={follows.followed}>
              <span>
                <span className={styles.r3Small}>{f.myUpdates}</span>
                <span data-ask="welcome-updates-facts">{followLine}</span>
                {lastCheck !== null && (
                  <span data-ask="welcome-updates-checked" className={styles.r3Small}>
                    {lastCheck}
                  </span>
                )}
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          )}
        </div>
      )}
      <button type="button" data-ask="job-entry" onClick={onOpenJobs} className={styles.r3JobEntry}>
        {s.jobEntry}
        <span aria-hidden="true">›</span>
      </button>
      <p data-ask="coverage-focus" className={styles.r3Coverage}>
        <span className={styles.visuallyHidden}>{s.coverageFocusLabel}</span>
        {s.coverageRegions}
      </p>
    </div>
  );
}
