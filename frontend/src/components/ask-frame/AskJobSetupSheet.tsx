'use client';

import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { askR32Strings } from '@/lib/ask/askR32Strings';
import { askR38Strings } from '@/lib/ask/askR38Strings';
import { AskTendersBlock } from './AskTendersBlock';
import styles from './askDashboard.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R38 · U-3 — JOBS: SAY IT FIRST, THEN OFFER A GENUINE CAREER QUESTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ask has NO job-listing source (East Africa Opportunities R1-A is fixture-only; every candidate
 * source is NOT_ASSESSED / BLOCKED for rights). The earlier sheet (J01) collected role, place and
 * filters behind a "Search opportunities" button whose submit only revealed that nothing could be
 * searched — the Product Owner rejected that as a pretend search.
 *
 * Now the FIRST thing the sheet says is that job listings are not connected, before any field. What
 * it offers is real: the reader's role (optional) and place become an UNSENT general career question
 * in the Ask box ("What is the job market like for nurses in Kigali?"), answered from news and public
 * sources when the reader presses Send. No vacancy, employer, deadline, filter, "searched" state or
 * network request; "Use my location" stays absent (R1-A §4).
 */
export function AskJobSetupSheet({
  locale,
  onClose,
  onAskGeneral,
}: {
  readonly locale: DisplayLocale;
  readonly onClose: () => void;
  /** Closes the sheet and STAGES the general career question in the Ask box: unsent, nothing searched. */
  readonly onAskGeneral: (draft: string) => void;
}): JSX.Element {
  const s = askR3FullStrings(locale);
  const r32 = askR32Strings(locale);
  const r38 = askR38Strings(locale);
  const titleId = useId();
  const noticeId = useId();
  const sheet = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState('');
  const [place, setPlace] = useState('');

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || sheet.current === null) return;
      const nodes = Array.from(
        sheet.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [href]'),
      );
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (first === undefined || last === undefined) return;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const destination = place.trim();
  const work = role.trim();

  return (
    <div data-ask="job-sheet-backdrop" className={styles.r3SheetBackdrop} onClick={onClose}>
      <section
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noticeId}
        data-ask="job-sheet"
        className={styles.r3Sheet}
        onClick={(event) => event.stopPropagation()}
        {...askDirectionProps(locale)}
      >
        <div className={styles.r3SheetHead}>
          <h2 id={titleId}>{r38.jobsCue}</h2>
          <button ref={closeRef} type="button" data-ask="job-sheet-close" onClick={onClose} className={styles.r3TextButton}>
            {s.close}
          </button>
        </div>
        <form
          data-ask="job-setup"
          className={styles.r3SheetBody}
          onSubmit={(event) => {
            event.preventDefault();
            if (destination === '') {
              placeRef.current?.focus();
              return;
            }
            onAskGeneral(work === '' ? r32.jobGeneralDraftNoRole(destination) : r32.jobGeneralDraft(work, destination));
          }}
        >
          {/* Said FIRST, before any field: nothing here searches vacancies. */}
          <div id={noticeId} role="note" data-ask="job-not-connected" className={styles.r3Notice}>
            <p className={styles.r3NoticeTitle}>{r38.jobsNotConnected}</p>
            <p>{r38.jobsCareerIntro}</p>
          </div>
          <label className={styles.r3Field}>
            <span>{r38.jobsRoleLabel}</span>
            <input
              data-ask="job-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder={s.jobRolePlaceholder}
              dir="auto"
            />
          </label>
          <label className={styles.r3Field}>
            <span>{r38.jobsPlaceLabel}</span>
            <input
              ref={placeRef}
              data-ask="job-place"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder={s.jobPlacePlaceholder}
              dir="auto"
            />
          </label>
          {destination === '' && <p className={styles.r3Small}>{s.jobNeedsPlace}</p>}
          <button type="submit" data-ask="job-ask-general" disabled={destination === ''} className={styles.r3Primary}>
            {r38.jobsStageQuestion}
          </button>
          <p className={styles.r3Small}>{r38.jobsNothingSent}</p>
          <p className={styles.r3Small}>{s.jobBoundary}</p>
          {/* R135 ASK EXPLORE R1 — real public tenders we hold, labelled as tenders, never vacancies. */}
          <AskTendersBlock locale={locale} />
        </form>
      </section>
    </div>
  );
}
