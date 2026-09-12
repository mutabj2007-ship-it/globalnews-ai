'use client';

import { useAdminContext } from '../shell/AdminContext';
import { NOT_IMPLEMENTED, UNAVAILABLE } from '@/lib/admin/adminDataState';
import { AdminPanel } from '../primitives/AdminPanel';
import { KpiCard } from '../primitives/KpiCard';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-02 — Overview.
 *
 * Five KPI cards, and not one of them has a backend today. They render
 * "No source" or "Planned" with their provenance tag rather than a
 * number, because every figure in the approved artifact is tagged D and
 * D does not ship.
 *
 * Two of the five are worth naming precisely, because F0 corrected the
 * design's own tags on both:
 *   ARTICLES INGESTED  the rows genuinely exist (Article.fetchedAt is
 *                      indexed) but no endpoint returns a count — tag B,
 *                      not the A the design assumed
 *   ACTIVE USERS       there is no activity record of any kind in this
 *                      platform; a Session row is a sign-in, not
 *                      activity — tag C, not B
 *
 * The window selector is rendered inert: switching a window over five
 * empty cards would be a control that pretends to do something.
 */
export function OverviewScreen(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.overview;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <div className="rounded-lg border border-adm-edge bg-adm-card-soft px-3.5 py-3">
        <p className="text-[12px] font-semibold text-adm-ink-2">{t.truthBanner.title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{t.truthBanner.body}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-3 adm-full:grid-cols-5">
        <KpiCard
          label={screen.kpis.articlesIngested}
          windowLabel={screen.windows.h24}
          field="admin-02.articlesIngested"
          data={UNAVAILABLE}
        />
        <KpiCard
          label={screen.kpis.activeUsers}
          windowLabel={screen.windows.h24}
          field="admin-02.activeUsers"
          data={UNAVAILABLE}
        />
        <KpiCard
          label={screen.kpis.countries}
          field="admin-02.countriesWithActivity"
          data={UNAVAILABLE}
        />
        <KpiCard
          label={screen.kpis.analysisRequests}
          windowLabel={screen.windows.h24}
          field="admin-02.analysisRequests"
          data={NOT_IMPLEMENTED}
        />
        <KpiCard
          label={screen.kpis.providerErrors}
          windowLabel={screen.windows.h24}
          field="admin-02.providerErrors"
          data={NOT_IMPLEMENTED}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 adm-full:grid-cols-3">
        <div className="adm-full:col-span-2">
          <PlaceholderPanel
            title={screen.reachTitle}
            purpose={screen.reachPurpose}
            requirement={screen.reachRequirement}
            field="admin-02.reachMap"
          />
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
