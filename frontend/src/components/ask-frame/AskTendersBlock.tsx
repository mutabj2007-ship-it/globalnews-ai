'use client';

import { useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askExploreStrings } from '@/lib/ask/askExploreStrings';
import { ASK_EXPLORE_HREF, readerDate, tenderRows, type TenderRow } from '@/lib/ask/askExploreRegions';
import { readMarketProcurement } from '@/lib/market/mktProcurementRead';
import { usePlatformPages } from './AskExploreContext';
import styles from './askDashboard.module.css';
import ex from './askExplore.module.css';

export const TENDERS_BLOCK_LIMIT = 3;

/**
 * R135 ASK EXPLORE R1 — the jobs sheet's "something real to open" (PO: "having some already shown").
 *
 * Ask has no job-vacancy source, and nothing here pretends otherwise: the sheet still says listings
 * are not connected FIRST. What GlobalNewsAI does hold are official EU procurement notices (TED),
 * retained and already public on /market. They are shown here AS TENDERS — "contracts open to bids,
 * not job vacancies" — with the buyer, the publication date, and the stated deadline (or "Closed"
 * when that day has passed; an unknown deadline is never called open).
 *
 * READS: nothing until the reader taps "Show open public tenders" — the J01 sheet still opens with
 * zero network (R38 U-3 pin). The tap reads the same public `/market-data/procurement` proxy /market
 * uses, once. No model, no provider, no quota.
 */
export function AskTendersBlock({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const x = askExploreStrings(locale);
  const platformPages = usePlatformPages();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [rows, setRows] = useState<readonly TenderRow[]>([]);

  const load = (): void => {
    if (state !== 'idle') return;
    setState('loading');
    void readMarketProcurement().then((result) => {
      setRows(result.kind === 'PROCUREMENT' ? tenderRows(result.notices, locale, new Date(), TENDERS_BLOCK_LIMIT).latest : []);
      setState('done');
    });
  };

  return (
    <section data-ask="job-tenders" className={ex.exploreBlock}>
      <h3 className={ex.exploreHeading}>{x.tendersTitle}</h3>
      <p className={styles.r3Small}>{x.tendersNote}</p>
      {state === 'idle' && (
        <button type="button" data-ask="job-tenders-show" onClick={load} className={styles.r3Secondary}>
          {x.tendersShow}
        </button>
      )}
      {state === 'loading' && (
        <p role="status" className={styles.r3Small}>
          {x.eventsLoading}
        </p>
      )}
      {state === 'done' && rows.length === 0 && <p className={styles.r3Small}>{x.tendersNone}</p>}
      {state === 'done' && rows.length > 0 && (
      <ul className={ex.exploreList}>
        {rows.map((row) => (
          <li key={row.key} data-ask="job-tender" className={ex.exploreRow}>
            <span className={ex.exploreRowTitle} dir="auto">
              {row.title}
            </span>
            {row.buyer !== null && (
              <span className={styles.r3Small} dir="auto">
                {row.buyer}
              </span>
            )}
            <span className={styles.r3Small}>
              {x.tenderPublished(readerDate(row.published, locale))}
              {row.deadline !== null &&
                ` · ${row.closed ? x.tenderClosed(readerDate(row.deadline, locale)) : x.tenderDeadline(readerDate(row.deadline, locale))}`}
            </span>
            <a href={row.href} target="_blank" rel="noopener noreferrer" data-ask="job-tender-open" className={styles.r3TextButton}>
              {x.tenderOpen}
            </a>
          </li>
        ))}
      </ul>
      )}
      {platformPages && (
        <a href={ASK_EXPLORE_HREF.market} data-ask="job-tenders-all" className={styles.r3TextButton}>
          {x.tendersAll}
        </a>
      )}
    </section>
  );
}
