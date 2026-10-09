'use client';

import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { askDirectionProps } from '@/lib/ask/askDirection';
import styles from './askDashboard.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 FULL DESIGN R1 — J01 JOB SEARCH SETUP (optional) AND ITS TRUTHFUL OUTCOME (J06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Claude Design R3 J01 (AskPrototype `ov === 'jobSetup'`): role or keywords, an editable city or
 * country, progressive filters and an explicit "Search opportunities". Opening the sheet and typing
 * run NOTHING (addendum §2, acceptance 4).
 *
 * WHAT SEARCH DOES TODAY, AND WHY. Ask has NO job-listing source: the East Africa Opportunities
 * R1-A domain package is fixture-only and every candidate source is NOT_ASSESSED / BLOCKED for
 * rights (R1-A §7). So the only true outcome for ANY place the reader types is J06-unsupported:
 * "Ask doesn't check job sources for {place} yet. This isn't a 'no jobs' result." It is decided
 * here, with no network request and no AI call, and it never reads as "no jobs" (addendum §4).
 * Results (J03), source review (J04), follow (J05) and the other J06 states arrive only with a
 * rights-cleared source — never from fixtures.
 *
 * "Use my location" is deliberately absent: R1-A §4 requires a permission flow and a geography
 * authority that do not exist yet. The typed destination is the only input, as R1-A requires.
 */
export function AskJobSetupSheet({
  locale,
  onClose,
  onAskGeneral,
}: {
  readonly locale: DisplayLocale;
  readonly onClose: () => void;
  /** Closes the sheet and focuses the composer, empty: nothing is written or sent. */
  readonly onAskGeneral: () => void;
}): JSX.Element {
  const s = askR3FullStrings(locale);
  const titleId = useId();
  const helpId = useId();
  const sheet = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState('');
  const [place, setPlace] = useState('');
  const [filters, setFilters] = useState(false);
  const [workType, setWorkType] = useState(0);
  const [level, setLevel] = useState(0);
  /** The place the reader searched, once they chose Search. */
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);

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
  const canSearch = destination !== '';

  return (
    <div data-ask="job-sheet-backdrop" className={styles.r3SheetBackdrop} onClick={onClose}>
      <section
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-ask="job-sheet"
        className={styles.r3Sheet}
        onClick={(event) => event.stopPropagation()}
        {...askDirectionProps(locale)}
      >
        <div className={styles.r3SheetHead}>
          <h2 id={titleId}>{s.jobEntry}</h2>
          <button ref={closeRef} type="button" data-ask="job-sheet-close" onClick={onClose} className={styles.r3TextButton}>
            {s.close}
          </button>
        </div>
        {outcomeFor === null ? (
          <form
            data-ask="job-setup"
            className={styles.r3SheetBody}
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSearch) {
                placeRef.current?.focus();
                return;
              }
              setOutcomeFor(destination);
            }}
          >
            <p className={styles.r3Quiet}>{s.jobIntro}</p>
            <label className={styles.r3Field}>
              <span>{s.jobRoleLabel}</span>
              <input
                data-ask="job-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder={s.jobRolePlaceholder}
              />
            </label>
            <label className={styles.r3Field}>
              <span>{s.jobPlaceLabel}</span>
              <input
                ref={placeRef}
                data-ask="job-place"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder={s.jobPlacePlaceholder}
                aria-describedby={helpId}
              />
            </label>
            <p id={helpId} className={styles.r3Small}>
              {s.jobPlaceHelp}
            </p>
            <button
              type="button"
              data-ask="job-filters-toggle"
              aria-expanded={filters}
              onClick={() => setFilters((open) => !open)}
              className={styles.r3TextButton}
            >
              {filters ? s.jobHideFilters : s.jobMoreFilters}
            </button>
            {filters && (
              <>
                <Chips label={s.jobWorkType} options={s.jobWorkTypes} value={workType} onChange={setWorkType} name="work" />
                <Chips label={s.jobExperience} options={s.jobLevels} value={level} onChange={setLevel} name="level" />
              </>
            )}
            {!canSearch && <p className={styles.r3Small}>{s.jobNeedsPlace}</p>}
            <button type="submit" data-ask="job-search" disabled={!canSearch} className={styles.r3Primary}>
              {s.jobSearch}
            </button>
            <p className={styles.r3Small}>{s.jobBoundary}</p>
          </form>
        ) : (
          <div data-ask="job-outcome" data-ask-job-outcome="UNSUPPORTED" className={styles.r3SheetBody}>
            <div role="status" className={styles.r3Notice}>
              <p className={styles.r3NoticeTitle}>{s.jobUnsupported(outcomeFor)}</p>
              <p>{s.jobNotNoJobs(outcomeFor)}</p>
              <p className={styles.r3Quiet}>{s.jobGeneralHint}</p>
            </div>
            <div className={styles.r3Actions}>
              <button
                type="button"
                data-ask="job-change-place"
                onClick={() => {
                  setOutcomeFor(null);
                  requestAnimationFrame(() => placeRef.current?.focus());
                }}
                className={styles.r3Secondary}
              >
                {s.jobChangePlace}
              </button>
              <button type="button" data-ask="job-ask-general" onClick={onAskGeneral} className={styles.r3Secondary}>
                {s.jobAskGeneral}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
  name,
}: {
  readonly label: string;
  readonly options: readonly string[];
  readonly value: number;
  readonly onChange: (next: number) => void;
  readonly name: string;
}): JSX.Element {
  return (
    <div role="group" aria-label={label} data-ask={`job-${name}`} className={styles.r3ChipGroup}>
      <span className={styles.r3Small}>{label}</span>
      <div>
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === index}
            onClick={() => onChange(index)}
            className={styles.r3Chip}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
