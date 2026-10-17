'use client';

import type { JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askExploreStrings } from '@/lib/ask/askExploreStrings';
import { ASK_EXPLORE_DRAWER, ASK_EXPLORE_HREF } from '@/lib/ask/askExploreRegions';
import { usePlatformPages } from './AskExploreContext';
import styles from './askDashboard.module.css';

/**
 * R135 ASK EXPLORE R1 — the drawer's Explore list: every page already built on this deployment,
 * reachable from Ask (PO 2026-10-17: "all pages you built attached to the Ask"). Data pages first,
 * design previews last and labelled "Design preview, not live data". Plain links: opening the drawer
 * reads nothing. Absent on a Standalone deployment, where these routes redirect to `/`.
 */
export function AskExploreLinks({
  locale,
  onNavigate,
}: {
  readonly locale: DisplayLocale;
  readonly onNavigate?: () => void;
}): JSX.Element | null {
  const platformPages = usePlatformPages();
  if (!platformPages) return null;
  const x = askExploreStrings(locale);
  return (
    <nav aria-label={x.exploreTitle} data-ask-nav="explore" className={styles.exploreBlock}>
      <h3 className={styles.exploreHeading}>{x.exploreTitle}</h3>
      <ul className={styles.exploreList}>
        {ASK_EXPLORE_DRAWER.map((page) => (
          <li key={page}>
            <a href={ASK_EXPLORE_HREF[page]} data-ask-nav-explore={page} onClick={onNavigate} className={styles.exploreLink}>
              <span className={styles.exploreRowTitle}>{x.page[page].label}</span>
              <span className={styles.r3Small}>{x.page[page].detail}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
