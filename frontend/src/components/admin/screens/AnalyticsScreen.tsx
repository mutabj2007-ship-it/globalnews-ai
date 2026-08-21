'use client';

import { useAdminContext } from '../shell/AdminContext';
import { NOT_IMPLEMENTED, UNAVAILABLE } from '@/lib/admin/adminDataState';
import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { AdminFilterBar } from '../primitives/AdminFilterBar';
import { AdminTabs } from '../primitives/AdminTabs';
import { KpiCard } from '../primitives/KpiCard';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-03 — Users, usage & geography.
 *
 * TWO CORRECTIONS FROM F0 ARE VISIBLE ON THIS SCREEN, and both change
 * what it may claim.
 *
 * 1. THE MAP IS COVERAGE GEOGRAPHY, NOT AUDIENCE GEOGRAPHY. The design
 *    specifies "requests by country", which needs request-level
 *    collection this platform does not perform — no IP capture, no geo
 *    enrichment, and the access logger deliberately never records a
 *    query string. What the platform genuinely holds is a populated
 *    article-to-country relation: where the coverage is about, not where
 *    the readers are. The panel is titled and described accordingly.
 *
 * 2. EVERY USER AND SESSION FIGURE WOULD COVER SIGNED-IN ACCOUNTS ONLY.
 *    GlobalNews AI is anonymous-first — accounts are optional and no
 *    public route is guarded — so those figures are a biased subset of
 *    real usage. The notice saying so is part of the screen, not a
 *    footnote, and it stays even while the numbers themselves are absent.
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

      {tab === 'analytics' && (
        <>
          <AdminFilterBar
            labels={[screen.tabs.geography, screen.topLanguages, screen.topFeatures]}
          />

          <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-3 adm-full:grid-cols-6">
            <KpiCard
              label={screen.kpis.activeUsers}
              field="admin-03.activeReturning"
              data={UNAVAILABLE}
            />
            <KpiCard label={screen.kpis.newUsers} field="admin-03.newUsers" data={UNAVAILABLE} />
            <KpiCard
              label={screen.kpis.returning}
              field="admin-03.activeReturning"
              data={UNAVAILABLE}
            />
            <KpiCard label={screen.kpis.sessions} field="admin-03.newUsers" data={UNAVAILABLE} />
            <KpiCard
              label={screen.kpis.aiQuestions}
              field="admin-03.featureUsage"
              data={NOT_IMPLEMENTED}
            />
            <KpiCard
              label={screen.kpis.clientErrors}
              field="admin-03.clientErrors"
              data={NOT_IMPLEMENTED}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 adm-rail:grid-cols-2 adm-full:grid-cols-3">
            <PlaceholderPanel
              title={screen.topCountries}
              purpose={screen.purpose}
              requirement={screen.geographyRequirement}
              field="admin-03.audienceGeography"
              ratio="min-h-[160px]"
            />
            <PlaceholderPanel
              title={screen.topLanguages}
              purpose={screen.purpose}
              requirement={screen.errorsRequirement}
              field="admin-03.languagePerSession"
              ratio="min-h-[160px]"
            />
            <PlaceholderPanel
              title={screen.topFeatures}
              purpose={screen.purpose}
              requirement={screen.retentionRequirement}
              field="admin-03.featureUsage"
              ratio="min-h-[160px]"
            />
          </div>

          <PlaceholderPanel
            title={screen.retentionTitle}
            purpose={screen.retentionPurpose}
            requirement={screen.retentionRequirement}
            field="admin-03.retention"
            ratio="min-h-[180px]"
          />
        </>
      )}

      {tab === 'geography' && (
        <PlaceholderPanel
          title={screen.geographyTitle}
          purpose={screen.geographyNote}
          requirement={screen.geographyRequirement}
          field="admin-03.contentGeography"
        />
      )}

      {tab === 'users' && (
        <PlaceholderPanel
          title={screen.usersTitle}
          purpose={screen.purpose}
          requirement={screen.usersRequirement}
          field="admin-03.userRecords"
          ratio="min-h-[180px]"
        />
      )}

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
