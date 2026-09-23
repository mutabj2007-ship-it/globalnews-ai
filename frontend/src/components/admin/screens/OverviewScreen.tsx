'use client';

import { useAdminContext } from '../shell/AdminContext';
import { NOT_IMPLEMENTED, UNAVAILABLE, sectionNumber } from '@/lib/admin/adminDataState';
import { AdminPanel } from '../primitives/AdminPanel';
import { KpiCard } from '../primitives/KpiCard';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import type {
  AdminAnalyticsUsageResponse,
  AdminCoverageGeographyResponse,
  AdminSystemHealthResponse,
} from '@/lib/admin/adminApiTypes';
import { AnalyticsGeographyTab } from './AnalyticsGeographyTab';
import { AlphaReviewPanel } from './AlphaReviewPanel';

/** Overview: existing aggregate reads only; no provider acquisition. */
export function OverviewScreen(): JSX.Element {
  const { can, t } = useAdminContext();
  return can('analytics.view') ? <OverviewData /> : <p>{t.access.forbiddenBody}</p>;
}

function OverviewData(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.overview;
  const usage = useAdminResource<AdminAnalyticsUsageResponse>(ADMIN_API.analyticsUsage);
  const health = useAdminResource<AdminSystemHealthResponse>(ADMIN_API.systemHealth);
  const geography = useAdminResource<AdminCoverageGeographyResponse>(
    ADMIN_API.analyticsCoverageGeography,
  );

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <div className="rounded-lg border border-adm-edge bg-adm-card-soft px-3.5 py-3">
        <p className="text-[12px] font-semibold text-adm-ink-2">{t.truthBanner.title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{t.truthBanner.body}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-3 adm-full:grid-cols-5">
        <KpiCard
          label={t.screens.systemHealth.ingestionCountLabel}
          field="admin-07.ingestionVolume"
          data={sectionNumber(
            health.state,
            health.data?.ingestion,
            health.data?.ingestion?.articleCount,
          )}
          onRetry={health.reload}
        />
        <KpiCard
          label={screen.kpis.activeUsers}
          windowLabel={screen.windows.h24}
          field="admin-02.activeUsers"
          data={UNAVAILABLE}
        />
        <KpiCard
          label={t.screens.analytics.coverageDistinct}
          field="admin-03.contentGeography"
          data={sectionNumber(
            geography.state,
            geography.data?.distinctCountriesWithRelevantCoverage,
            geography.data?.distinctCountriesWithRelevantCoverage,
          )}
          onRetry={geography.reload}
        />
        <KpiCard
          label={screen.kpis.analysisRequests}
          windowLabel={screen.windows.h24}
          field="admin-03.analysisRuns"
          data={sectionNumber(usage.state, usage.data?.analysis, usage.data?.analysis?.runsLast24h)}
          onRetry={usage.reload}
        />
        <KpiCard
          label={screen.kpis.providerErrors}
          windowLabel={screen.windows.h24}
          field="admin-02.providerErrors"
          data={NOT_IMPLEMENTED}
        />
      </div>

      <AlphaReviewPanel />

      <div className="grid grid-cols-1 gap-4 adm-full:grid-cols-3">
        <div className="adm-full:col-span-2">
          <AnalyticsGeographyTab resource={geography} />
        </div>

        <div className="flex flex-col gap-4">
          <AdminPanel
            title={screen.pipelineTitle}
            field="admin-02.pipelineMode"
            note={screen.pipelineNote}
          >
            <p className="text-[11px] leading-relaxed text-adm-ink-4">{t.states.unavailableNote}</p>
          </AdminPanel>

          <PlaceholderPanel
            title={screen.alertsTitle}
            purpose={screen.purpose}
            requirement={screen.alertsRequirement}
            field="admin-02.alerts"
            ratio="min-h-[120px]"
          />
        </div>
      </div>
    </div>
  );
}
