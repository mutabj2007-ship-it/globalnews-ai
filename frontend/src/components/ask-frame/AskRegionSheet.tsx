'use client';

import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { ConflictObservation, DisplayLocale } from '@globalnews-ai/shared';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { askExploreStrings } from '@/lib/ask/askExploreStrings';
import {
  ASK_EXPLORE_HREF,
  ASK_REGIONS,
  askRegion,
  readerDate,
  regionEvents,
  regionMapHref,
  regionMemberNames,
  type AskRegionId,
} from '@/lib/ask/askExploreRegions';
import { reviewedObservations } from '@/lib/conflict/retained';
import { usePlatformPages } from './AskExploreContext';
import styles from './askDashboard.module.css';

/** How many of the newest events the sheet lists per region. */
export const REGION_SHEET_EVENT_LIMIT = 6;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R135 ASK EXPLORE R1 — "WHAT CHANGED IN MY REGION?" INSIDE ASK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product Owner order (2026-10-17): the region cue must be "ready and clickable, showing features
 * and some articles". What GlobalNewsAI lawfully holds today for a region is the retained, reviewed
 * UCDP conflict-event set the /conflict map already shows publicly — so the sheet lists the newest
 * of those events for the chosen region (source-stated country and event date, the outlets the
 * dataset cites by NAME only, never a headline), opens the map over the region, links the region's
 * other built pages, and offers "Ask about <region>", which only STAGES a draft.
 *
 * READS: one GET of the public `/conflict-data/observations` proxy, when the sheet opens — the same
 * read the /conflict page makes. No model, no news provider, no Ask quota, nothing written.
 * Rows are labelled as recorded EVENTS, not news articles; an empty region says it is a gap in what
 * we hold, not that nothing happened. EA R135 ruling: the map link says it opens OVER the region
 * (the map is worldwide); COD is "DR Congo", never bare "Congo".
 */
export function AskRegionSheet({
  locale,
  initialRegion,
  onClose,
  onAskRegion,
}: {
  readonly locale: DisplayLocale;
  readonly initialRegion: AskRegionId;
  readonly onClose: () => void;
  /** Closes the sheet and STAGES the region question in the Ask box: unsent. */
  readonly onAskRegion: (draft: string) => void;
}): JSX.Element {
  const s = askR3FullStrings(locale);
  const x = askExploreStrings(locale);
  const platformPages = usePlatformPages();
  const titleId = useId();
  const sheet = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [regionId, setRegionId] = useState<AskRegionId>(initialRegion);
  const [rows, setRows] = useState<readonly ConflictObservation[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    fetch('/conflict-data/observations?limit=500', { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        setRows(reviewedObservations(payload));
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || sheet.current === null) return;
      const nodes = Array.from(sheet.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], summary'));
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

  const region = askRegion(regionId);
  const regionName = x.regionName[regionId];
  const events = regionEvents(rows, region, REGION_SHEET_EVENT_LIMIT);

  return (
    <div data-ask="region-sheet-backdrop" className={styles.r3SheetBackdrop} onClick={onClose}>
      <section
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-ask="region-sheet"
        data-ask-region={regionId}
        className={styles.r3Sheet}
        onClick={(event) => event.stopPropagation()}
        {...askDirectionProps(locale)}
      >
        <div className={styles.r3SheetHead}>
          <h2 id={titleId}>{x.regionSheetTitle}</h2>
          <button ref={closeRef} type="button" data-ask="region-sheet-close" onClick={onClose} className={styles.r3TextButton}>
            {s.close}
          </button>
        </div>
        <div className={styles.r3SheetBody}>
          <p className={styles.r3Small}>{x.regionIntro}</p>
          <div role="group" aria-label={x.regionPickerLabel} data-ask="region-picker" className={styles.r3Actions}>
            {ASK_REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                data-ask={`region-choose-${r.id}`}
                aria-pressed={r.id === regionId}
                onClick={() => setRegionId(r.id)}
                className={styles.r3Chip}
              >
                {x.regionName[r.id]}
              </button>
            ))}
          </div>

          <section aria-labelledby={`${titleId}-events`} data-ask="region-events" className={styles.exploreBlock}>
            <h3 id={`${titleId}-events`} className={styles.exploreHeading}>
              {x.eventsTitle(regionName)}
            </h3>
            {status === 'loading' && (
              <p role="status" data-ask="region-events-loading" className={styles.r3Small}>
                {x.eventsLoading}
              </p>
            )}
            {status === 'error' && (
              <div role="status" data-ask="region-events-error" className={styles.r3Notice}>
                <p>{x.eventsError}</p>
                <button type="button" data-ask="region-events-retry" onClick={() => setAttempt((n) => n + 1)} className={styles.r3TextButton}>
                  {x.eventsRetry}
                </button>
              </div>
            )}
            {status === 'ready' && events.latest.length === 0 && (
              <p data-ask="region-events-none" className={styles.r3Small}>
                {x.eventsNone(regionName)}
              </p>
            )}
            {status === 'ready' && events.latest.length > 0 && (
              <ol data-ask="region-events-list" className={styles.exploreList}>
                {events.latest.map((event) => (
                  <li key={event.key} data-ask="region-event" className={styles.exploreRow}>
                    <span className={styles.exploreRowTitle}>
                      <time dateTime={event.eventDate}>{readerDate(event.eventDate, locale)}</time>
                      {' · '}
                      <span dir="auto">{event.iso3 === 'COD' ? x.drCongo : event.place}</span>
                    </span>
                    {event.reportedBy.length > 0 && (
                      <span className={styles.r3Small} dir="auto">
                        {x.reportedBy(event.reportedBy.join(', '))}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className={styles.r3Small}>{x.eventsSourceNote}</p>
            <details data-ask="region-members" className={styles.exploreMembers}>
              <summary>{x.membersLabel}</summary>
              <p className={styles.r3Small}>{regionMemberNames(region, locale, x.drCongo).join(', ')}</p>
            </details>
          </section>

          {platformPages && (
            <section aria-labelledby={`${titleId}-more`} data-ask="region-pages" className={styles.exploreBlock}>
              <h3 id={`${titleId}-more`} className={styles.exploreHeading}>
                {x.moreForRegion}
              </h3>
              <ul className={styles.exploreList}>
                {region.pages.map((page) => {
                  const href = page === 'conflict' ? regionMapHref(region) : ASK_EXPLORE_HREF[page];
                  const label = page === 'conflict' ? x.openOnMap(regionName) : x.page[page].label;
                  const detail =
                    page === 'conflict' ? x.mapNote : page === 'humanitarian' ? x.allRegions : x.page[page].detail;
                  return (
                    <li key={page}>
                      <a href={href} data-ask={`region-page-${page}`} className={styles.exploreLink}>
                        <span className={styles.exploreRowTitle}>{label}</span>
                        <span className={styles.r3Small}>{detail}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <button
            type="button"
            data-ask="region-ask"
            onClick={() => onAskRegion(x.regionDraft(regionName))}
            className={styles.r3Primary}
          >
            {x.askAboutRegion(regionName)}
          </button>
          <p className={styles.r3Small}>{x.nothingSent}</p>
          <p className={styles.r3Small}>{x.newsNote}</p>
        </div>
      </section>
    </div>
  );
}
