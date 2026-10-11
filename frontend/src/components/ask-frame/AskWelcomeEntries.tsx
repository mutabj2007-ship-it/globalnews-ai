'use client';

import type { JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { askDiscoverStrings } from '@/lib/ask/askDiscoverStrings';
import { AskDiscoverIcon } from './AskDiscoverIcon';
import styles from './askDashboard.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 FULL DESIGN R1 — WELCOME ENTRIES (WELCOME_PLACEHOLDER_SPEC §Composition 7–8)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── ASK R3 IA + GUIDED DISCOVER R2 (approved 11 Oct 2026, "APPROVE ALL AS DRAWN") ────────────
 * Claude Design `GLOBALNEWSAI-R3-IA-DISCOVER-FINAL-R2.zip` (SHA-256 574fc35b…55e32be8, verified),
 * `03-CLAUDE-H-IMPLEMENTATION-HANDOFF.md` §4, frames F01b / F02 / F03a–d / F05a.
 *
 *   G1 "What changed in my region?"  → STAGES a draft in the composer. Never submits.
 *   G2 "Explain a story"             → STAGES a draft in the composer. Never submits.
 *   G3 "Find job opportunities"      → opens the EXISTING J01 sheet (`onOpenJobs`).
 *   G4 globe                         → INFORMATIONAL ONLY on the coverage line. Not a control,
 *                                      no handler, no tabindex (02 decision 3).
 *
 * "Europe · East Africa · Middle East", 13 px ink-3; screen readers hear "Coverage focus: …". An
 * orientation statement, never a claim that a place has reporting or job coverage.
 *
 * COMPACT (02 decision 4): width < 360 OR height < 640 → the cues become a three-row list. The
 * caller measures and passes `compact`.
 *
 * ── R3.1 PRODUCT OWNER ACCEPTANCE · FIX 1 (MASTER CTO, 2026-10-11) ───────────────────────────
 * SUPERSEDED: §Composition 6 (Resume · Continue rows, "All conversations", the My updates activity
 * line). The Ask home shows NONE of the reader's history — no question titles, no timestamps, no
 * Continue card — at any width, signed in or not, after any refresh. Their reads went with them:
 * `useRecentConversations` (GET /ask-v2/threads) and `useFollowSummary` (GET /ask-v2/briefings)
 * are removed, so opening /ask reads nothing for a panel that no longer exists. History lives
 * only in the Conversations drawer, read when the reader opens it; My updates and Saved stay in the
 * primary navigation. Staging a cue still issues no request at all.
 */
export function AskWelcomeEntries({
  locale,
  onStageDraft,
  compact = false,
  onOpenJobs,
  placement,
}: {
  readonly locale: DisplayLocale;
  /** IA R2 — G1/G2 stage a composer draft. */
  readonly onStageDraft?: (draft: string, hint: string) => void;
  /** IA R2 — width < 360 or height < 640 (02 decision 4). */
  readonly compact?: boolean;
  readonly onOpenJobs: () => void;
  /** The phone/tablet welcome group, or under the centred desktop composer. CSS shows one. */
  readonly placement: 'welcome' | 'desktop';
}): JSX.Element {
  const s = askR3FullStrings(locale);
  const g = askDiscoverStrings(locale);
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
    </div>
  );
}
