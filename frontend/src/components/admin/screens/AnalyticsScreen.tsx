'use client';

import { useAdminContext } from '../shell/AdminContext';
import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { AdminTabs } from '../primitives/AdminTabs';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { AnalyticsGeographyTab } from './AnalyticsGeographyTab';
import { AnalyticsUsageTab } from './AnalyticsUsageTab';
import { AnalyticsUsersTab } from './AnalyticsUsersTab';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-03 — Users, usage & geography. THE TAB ROUTER, AND THE TWO
 * NOTICES THAT APPLY TO ALL OF IT.
 *
 * Each tab is a sibling file in THIS directory rather than a
 * subdirectory. That is deliberate and load-bearing:
 * `adminDataStates.spec.ts` sweeps this folder with a NON-RECURSIVE
 * readdir looking for rendered numeric literals — the guard that stops
 * the design's sample figures creeping back in — and a nested folder
 * would have escaped it silently. The layout follows the guard rather
 * than the guard being loosened to suit the layout.
 *
 * TWO CORRECTIONS FROM F0 SURVIVE INTO THE LIVE SCREEN, and both still
 * change what it may claim.
 *
 * 1. GEOGRAPHY HERE IS COVERAGE AND DECLARED INTEREST, NEVER AUDIENCE.
 *    The design specifies "requests by country", which needs
 *    request-level collection this platform does not perform — no
 *    address capture, no geo enrichment, and the access logger
 *    deliberately never records a query string. What the platform holds
 *    is an article-to-country relation and a followed-countries table:
 *    where the coverage is about, and which countries accounts chose.
 *    Neither is where anyone is, and neither is used to guess.
 *
 * 2. EVERY ACCOUNT FIGURE COVERS SIGNED-IN ACCOUNTS ONLY. GlobalNews AI
 *    is anonymous-first — accounts are optional and no public route is
 *    guarded — so those figures are a biased subset of real usage whose
 *    size is unknown. The notice saying so is part of the screen, not a
 *    footnote, and it now matters MORE than it did while the numbers
 *    were absent: an empty card invites no conclusions, and a populated
 *    one does.
 */
export type AnalyticsTab = 'analytics' | 'geography' | 'users' | 'subscriptions';

export function AnalyticsScreen({ tab }: { tab: AnalyticsTab }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.analytics;

  const tabs = [
    { id: 'analytics', label: screen.tabs.analytics, href: ADMIN_ROUTES.analytics },
    { id: 'geography', label: screen.tabs.geography, href: ADMIN_ROUTES.analyticsGeography },
    { id: 'users', label: screen.tabs.users, href: ADMIN_ROUTES.users },
    {
      id: 'subscriptions',
      label: screen.tabs.subscriptions,
      href: ADMIN_ROUTES.usersSubscriptions,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />
      <AdminTabs tabs={tabs} activeId={tab} />

      <p className="rounded-lg border border-adm-chip-warn-edge bg-adm-chip-warn-bg px-3.5 py-2.5 text-[11px] leading-relaxed text-adm-chip-warn-ink">
        {screen.signedInOnlyNotice}
      </p>

      {tab === 'analytics' && <AnalyticsUsageTab />}

      {tab === 'geography' && <AnalyticsGeographyTab />}

      {tab === 'users' && <AnalyticsUsersTab />}

      {tab === 'subscriptions' && (
        <PlaceholderPanel
          title={screen.subscriptionsTitle}
          purpose={screen.purpose}
          requirement={screen.subscriptionsRequirement}
          field="admin-03.subscriptions"
          ratio="min-h-[180px]"
        />
      )}
    </div>
  );
}
