'use client';

import { useAdminContext } from '../shell/AdminContext';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import type {
  AdminComponentProbe,
  AdminProbeStatus,
  AdminSystemHealthResponse,
} from '@/lib/admin/adminApiTypes';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminStateBlock } from '../primitives/AdminStateBlock';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { StatusChip, type ChipTone } from '../primitives/StatusChip';
import { ProvenanceBadge } from '../primitives/ProvenanceBadge';
import type { ProvenanceKey } from '@/lib/admin/adminProvenance';

/**
 * ADMIN-07 — System health. ONE OF THE TWO SCREENS WITH REAL DATA.
 *
 * Three of the eight components are genuinely probed today — the backend
 * process, the database (`SELECT 1`, the same check GET /health/ready
 * runs) and the news providers. The other five have no probe anywhere in
 * this platform, and they say UNKNOWN or NOT IMPLEMENTED rather than
 * guessing.
 *
 * THE BANNER CANNOT READ HEALTHY, and that is correct rather than a
 * defect. The approved rule is "all systems operational requires every
 * component healthy AND fresh"; the backend implements it by ranking
 * UNKNOWN above HEALTHY, so while five components are unprobed the
 * overall status resolves to UNKNOWN. When the missing probes land, the
 * banner starts being able to say something stronger.
 */
const STATUS_TONE: Record<AdminProbeStatus, ChipTone> = {
  HEALTHY: 'good',
  DEGRADED: 'warn',
  FAILING: 'bad',
  UNKNOWN: 'mute',
  NOT_IMPLEMENTED: 'warn',
};

const COMPONENT_FIELD: Record<string, ProvenanceKey> = {
  FRONTEND: 'admin-07.frontendProbe',
  BACKEND: 'admin-07.appProbe',
  DATABASE: 'admin-07.databaseProbe',
  NEWS_PROVIDER: 'admin-07.newsProviderProbe',
  AI_PROVIDER: 'admin-07.aiProviderProbe',
  AUTHENTICATION: 'admin-07.authenticationProbe',
  BACKGROUND_SERVICES: 'admin-07.backgroundServices',
  KSEF_INTEGRATION: 'admin-07.ksefIntegration',
};

export function SystemHealthScreen(): JSX.Element {
  const { t } = useAdminContext();
  const health = useAdminResource<AdminSystemHealthResponse>(ADMIN_API.systemHealth);
  const screen = t.screens.systemHealth;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />

      <AdminPanel
        title={screen.overallTitle}
        field="admin-07.overallStatus"
        note={screen.overallNote}
      >
        <AdminStateBlock state={health.state} onRetry={health.reload}>
          {health.data && (
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip
                label={screen.statuses[health.data.overall]}
                tone={STATUS_TONE[health.data.overall]}
              />
              <span className="font-cd-mono text-[11px] text-adm-ink-dim">
                {health.data.probedComponentCount}/{health.data.totalComponentCount}{' '}
                {screen.probedSummary}
              </span>
            </div>
          )}
        </AdminStateBlock>
      </AdminPanel>

      <AdminPanel title={screen.componentsTitle} field="admin-07.appProbe">
        <AdminStateBlock state={health.state} onRetry={health.reload}>
          <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-2 adm-full:grid-cols-4">
            {(health.data?.components ?? []).map((component) => (
              <ComponentCard key={component.component} probe={component} />
            ))}
          </div>
        </AdminStateBlock>
      </AdminPanel>

      <PlaceholderPanel
        title={screen.incidentsTitle}
        purpose={screen.purpose}
        requirement={screen.incidentsRequirement}
        field="admin-07.incidents"
        ratio="min-h-[140px]"
      />
    </div>
  );
}

function ComponentCard({ probe }: { probe: AdminComponentProbe }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.systemHealth;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-adm-edge-soft bg-adm-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-cd-mono text-[9px] uppercase tracking-[0.14em] text-adm-ink-faint">
          {screen.components[probe.component]}
        </span>
        <ProvenanceBadge field={COMPONENT_FIELD[probe.component]} />
      </div>

      <StatusChip label={screen.statuses[probe.status]} tone={STATUS_TONE[probe.status]} />

      <p className="text-[11px] leading-relaxed text-adm-ink-4">{screen.details[probe.detail]}</p>

      <p className="font-cd-mono text-[9px] text-adm-ink-faint">
        {probe.lastProbeAt ? `${screen.lastProbeAt}: ${probe.lastProbeAt}` : screen.neverProbed}
      </p>
    </div>
  );
}

export function ScreenHeading({ title, purpose }: { title: string; purpose: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[19px] font-semibold tracking-tight text-adm-ink">{title}</h1>
      <p className="max-w-3xl text-[12px] leading-relaxed text-adm-ink-4">{purpose}</p>
    </div>
  );
}
