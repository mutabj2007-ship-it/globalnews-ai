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
import { askDiscoverStrings } from '@/lib/ask/askDiscoverStrings';
import { useAskNavOptional } from '@/components/ask-nav/AskNavShell';
import { AskDiscoverIcon } from './AskDiscoverIcon';
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
 *
 * ── ASK R3 IA + GUIDED DISCOVER R2 (approved 11 Oct 2026, "APPROVE ALL AS DRAWN") ────────────
 * Claude Design `GLOBALNEWSAI-R3-IA-DISCOVER-FINAL-R2.zip` (SHA-256 574fc35b…55e32be8, verified),
 * `03-CLAUDE-H-IMPLEMENTATION-HANDOFF.md` §4, frames F01b / F02 / F03a–d / F05a.
 *
 *   G1 "What changed in my region?"  → STAGES a draft in the composer. Never submits.
 *   G2 "Explain a story"             → STAGES a draft in the composer. Never submits.
 *   G3 "Find job opportunities"      → opens the EXISTING J01 sheet (`onOpenJobs`); replaces the
 *                                      old "Job opportunities ›" text link (02 decision 2).
 *   G4 globe                         → INFORMATIONAL ONLY on the coverage line. Not a control,
 *                                      no handler, no tabindex (02 decision 3).
 *
 * Continue shows up to N real conversations — 3 on a phone, 5 at ≥1024, 1 when compact — each a
 * two-line title with its real local time and NO count of any kind. "All conversations" opens the
 * existing drawer; it is not a new destination. Every row is a read of `GET /ask-v2/threads`
 * already in flight: 0 AI · 0 provider. Staging a cue issues no request at all.
 *
 * COMPACT (02 decision 4): width < 360 OR height < 640 → the cues become a three-row list and
 * Continue shows one row. The caller measures and passes `compact`.
 */
/**
 * The signed-in reader's reopenable conversations, newest first — ONE `GET /ask-v2/threads`
 * (a read: 0 AI · 0 provider). Empty while unknown, on failure, and for a signed-out reader, so
 * Continue is omitted rather than shown empty (handoff §7: "threads read failed → no Continue").
 */
export function useRecentConversations(signedIn: boolean): readonly AskV2RecentThread[] {
  const [rows, setRows] = useState<readonly AskV2RecentThread[]>([]);
  useEffect(() => {
    if (!signedIn) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void askV2Api.threads().then((outcome) => {
      if (cancelled || !outcome.ok) return;
      setRows(
        outcome.value
          .filter((row) => askReopenHref(row) !== null)
          .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);
  return rows;
}

/** The single most recent one. Kept so existing callers and specs read the same value. */
export function useResumeConversation(signedIn: boolean): AskV2RecentThread | null {
  return useRecentConversations(signedIn)[0] ?? null;
}

/** 02 decision 5 — 3 on a phone, 5 at >=1024, 1 when compact. */
export function continueRowCount(compact: boolean, wide: boolean): number {
  if (compact) return 1;
  return wide ? 5 : 3;
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
  recent = [],
  follows = null,
  onStageDraft,
  compact = false,
  wide = false,
  onOpenJobs,
  placement,
}: {
  readonly locale: DisplayLocale;
  readonly signedIn: boolean;
  /** From `useResumeConversation`, read once by the frame for both placements. */
  readonly latest: AskV2RecentThread | null;
  /** IA R2 — the reopenable conversations behind Continue, newest first. */
  readonly recent?: readonly AskV2RecentThread[];
  /** IA R2 — G1/G2 stage a composer draft. Omitted → the cue cluster is not rendered. */
  readonly onStageDraft?: (draft: string, hint: string) => void;
  /** IA R2 — width < 360 or height < 640 (02 decision 4). */
  readonly compact?: boolean;
  /** IA R2 — viewport >= 1024: Continue shows 5 rows. */
  readonly wide?: boolean;
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

  /* ASK R3 IA + DISCOVER R2 */
  const g = askDiscoverStrings(locale);
  const nav = useAskNavOptional();
  const rows = (recent.length > 0 ? recent : latest !== null ? [latest] : []).slice(
    0,
    continueRowCount(compact, wide),
  );
  const cues: readonly { readonly id: 'g1' | 'g2' | 'g3'; readonly label: string; readonly run: () => void }[] = [
    { id: 'g1', label: g.cueRegion, run: () => onStageDraft?.(g.draftRegion, g.hintRegion) },
    { id: 'g2', label: g.cueStory, run: () => onStageDraft?.(g.draftStory, g.hintStory) },
    { id: 'g3', label: g.cueJobs, run: onOpenJobs },
  ];

  return (
    <div
      data-ask={placement === 'welcome' ? 'welcome-entries' : 'welcome-entries-desktop'}
      className={placement === 'welcome' ? styles.r3EntriesWelcome : styles.r3EntriesDesktop}
    >
      {/* G1 · G2 · G3 — the approved cue cluster. G3 replaces the old "Job opportunities ›"
          text link and opens the SAME J01 sheet (02 decision 2). Pills at >=360 w and >=640 h,
          a three-row list when compact (02 decision 4). 44 px targets at every width. */}
      <div
        role="group"
        aria-label={g.cuesLabel}
        data-ask="discover-cues"
        data-ask-compact={compact ? 'true' : 'false'}
        className={compact ? styles.iaCuesList : styles.iaCuesPills}
      >
        {cues.map((cue) => (
          <button
            key={cue.id}
            type="button"
            data-ask={`cue-${cue.id}`}
            onClick={cue.run}
            className={styles.iaCue}
          >
            <AskDiscoverIcon name={cue.id} className={styles.iaCueGlyph} />
            <span>{cue.label}</span>
          </button>
        ))}
      </div>
      {/* G4 — informational only: a globe beside the regional orientation line. Not a control. */}
      <p data-ask="coverage-focus" className={styles.r3Coverage}>
        <span className={styles.visuallyHidden}>{s.coverageFocusLabel}</span>
        <AskDiscoverIcon name="g4" size={16} className={styles.iaGlobe} />
        {s.coverageRegions}
      </p>
      {signedIn && showGroup && (
        <div role="group" aria-label={s.resumeGroupLabel} data-ask="welcome-resume-group" className={styles.r3ResumeGroup}>
          {/* CONTINUE (02 decision 5) — up to 3 phone / 5 desktop / 1 compact REAL conversations,
              two-line titles, the row's own real local time, and no count of any kind. */}
          {rows.length > 0 && (
            <p data-ask="continue-heading" className={styles.iaContinueHead}>
              {g.continueH}
            </p>
          )}
          {rows.map((row, index) => {
            const href = askReopenHref(row);
            if (href === null) return null;
            const when = new Date(row.lastActiveAt);
            return (
              <Link
                key={row.id}
                href={href}
                prefetch={false}
                data-ask={index === 0 ? 'welcome-resume' : 'welcome-continue'}
                data-ask-continue-index={index}
              >
                <span>
                  {index === 0 && <span className={styles.r3Small}>{s.resume}</span>}
                  {/* the reader's own words keep their own direction (an English title in Arabic chrome) */}
                  <span dir="auto" className={styles.iaTwoLine}>
                    {conversationTitle(row, noQuestion)}
                  </span>
                  <span className={styles.r3Small} data-ask="continue-when">
                    {`${askFormatLocalDay(when, locale)} ${askFormatLocalTime(when, locale)}`}
                  </span>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            );
          })}
          {/* "All conversations" opens the EXISTING drawer — not a new destination. Omitted where
              no drawer is supplied (the standalone placements render their own history). */}
          {rows.length > 0 && nav !== null && (
            <button
              type="button"
              data-ask="all-conversations"
              onClick={() => nav.setOpen(true)}
              className={styles.iaAllConversations}
            >
              {g.allConvs}
            </button>
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
    </div>
  );
}
