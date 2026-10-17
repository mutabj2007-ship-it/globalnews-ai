'use client';

import { useEffect, useState, type JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askExploreStrings } from '@/lib/ask/askExploreStrings';
import { ASK_EXPLORE_HREF, readerDate, tenderRows, type TenderRow } from '@/lib/ask/askExploreRegions';
import { readMarketProcurement } from '@/lib/market/mktProcurementRead';
import { usePlatformPages } from './AskExploreContext';
import styles from './askDashboard.module.css';

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
 * READS: the same public `/market-data/procurement` proxy /market uses, once, when the sheet opens.
 * No model, no provider, no quota. Renders nothing until the read succeeds with at least one notice.
 */
export function AskTendersBlock({ locale }: { readonly locale: DisplayLocale }): JSX.Element | null {
  const x = askExploreStrings(locale);
  const platformPages = usePlatformPages();
  const [rows, setRows] = useState<readonly TenderRow[] | null>(null);

  useEffect(() => {
    let live = true;
    void readMarketProcurement().then((result) => {
      if (!live) return;
      setRows(result.kind === 'PROCUREMENT' ? tenderRows(result.notices, locale, new Date(), TENDERS_BLOCK_LIMIT).latest : []);
    });
    return () => {
      live = false;
    };
  }, [locale]);

  if (rows === null || rows.length === 0) return null;

  return (
    <section data-ask="job-tenders" className={styles.exploreBlock}>
      <h3 className={styles.exploreHeading}>{x.tendersTitle}</h3>
      <p className={styles.r3Small}>{x.tendersNote}</p>
      <ul className={styles.exploreList}>
        {rows.map((row) => (
          <li key={row.key} data-ask="job-tender" className={styles.exploreRow}>
            <span className={styles.exploreRowTitle} dir="auto">
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
      {platformPages && (
        <a href={ASK_EXPLORE_HREF.market} data-ask="job-tenders-all" className={styles.r3TextButton}>
          {x.tendersAll}
        </a>
      )}
    </section>
  );
}
