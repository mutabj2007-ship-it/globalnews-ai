'use client';

import type { ProviderHealthStatus } from '@globalnews-ai/shared';
import { useAdminContext } from '../shell/AdminContext';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { ADMIN_API, ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import type { AdminNewsProvidersResponse } from '@/lib/admin/adminApiTypes';
import { AdminPanel } from '../primitives/AdminPanel';
import { AdminDataTable, type AdminColumn } from '../primitives/AdminDataTable';
import { AdminFilterBar } from '../primitives/AdminFilterBar';
import { AdminTabs } from '../primitives/AdminTabs';
import { StatusChip, type ChipTone } from '../primitives/StatusChip';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';
import { ScreenHeading } from './SystemHealthScreen';

/**
 * ADMIN-06 — News, sources & AI operations. THE OTHER SCREEN WITH REAL
 * DATA.
 *
 * The provider health table is live, from the probe this platform
 * already runs, and it reports EVERY registered provider — including one
 * that contributes no articles, because E1 keeps the registered set
 * separate from the active set.
 *
 * THE COUNTER COLUMNS READ UNKNOWN, ON PURPOSE. `ProviderHealthStatus`
 * declares requestCount, failureCount, lastLatencyMs, lastSuccessAt and
 * rateLimitState, and its own contract records that no provider
 * populates them. The backend projection omits an absent field rather
 * than zero-filling it, and this table renders the absence as UNKNOWN. A
 * zero here would be a measurement nobody took.
 *
 * ACCURACY CLAIMS STAY REMOVED. The artifact's "AI VERIFIED" and "FACT
 * CHECKED" badges are tagged D and are absent from this screen. They have
 * no backend contract defining what they would mean, and the platform's
 * own SourceDiversity contract already refuses claims of this shape.
 */
export type OperationsTab = 'news' | 'sources' | 'ai' | 'providers';

const HEALTH_TONE: Record<ProviderHealthStatus['status'], ChipTone> = {
  ok: 'good',
  degraded: 'warn',
  down: 'bad',
};

export function OperationsScreen({ tab }: { tab: OperationsTab }): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.operations;

  const tabs = [
    { id: 'news', label: screen.tabs.news, href: ADMIN_ROUTES.news },
    { id: 'sources', label: screen.tabs.sources, href: ADMIN_ROUTES.newsSources },
    { id: 'ai', label: screen.tabs.ai, href: ADMIN_ROUTES.ai },
    { id: 'providers', label: screen.tabs.providers, href: ADMIN_ROUTES.aiProviders },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={screen.title} purpose={screen.purpose} />
      <AdminTabs tabs={tabs} activeId={tab} />

      <p className="rounded-lg border border-adm-edge bg-adm-card-soft px-3.5 py-2.5 text-[11px] leading-relaxed text-adm-ink-dim">
        {screen.claimsRemovedNote}
      </p>

      {(tab === 'news' || tab === 'sources') && <ProviderHealthPanel />}

      {tab === 'news' && (
        <PlaceholderPanel
          title={screen.articlesTitle}
          purpose={screen.purpose}
          requirement={screen.articlesRequirement}
          field="admin-06.articleInventory"
          ratio="min-h-[140px]"
        />
      )}

      {tab === 'ai' && (
        <>
          <PlaceholderPanel
            title={screen.aiOpsTitle}
            purpose={screen.purpose}
            requirement={screen.aiOpsRequirement}
            field="admin-06.aiOperations"
            ratio="min-h-[140px]"
          />
          <PlaceholderPanel
            title={screen.modulesTitle}
            purpose={screen.purpose}
            requirement={screen.modulesRequirement}
            field="admin-06.intelligenceModules"
            ratio="min-h-[140px]"
          />
        </>
      )}

      {tab === 'providers' && (
        <PlaceholderPanel
          title={screen.aiProvidersTitle}
          purpose={screen.purpose}
          requirement={screen.aiProvidersRequirement}
          field="admin-06.aiProviders"
          ratio="min-h-[140px]"
        />
      )}
    </div>
  );
}

function ProviderHealthPanel(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.operations;
  const resource = useAdminResource<AdminNewsProvidersResponse>(ADMIN_API.newsProviders);

  const unknown = (
    <span className="font-cd-mono text-[10px] text-adm-val-mute">{t.states.unknown}</span>
  );

  const columns: ReadonlyArray<AdminColumn<ProviderHealthStatus>> = [
    {
      id: 'provider',
      header: screen.columns.provider,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-adm-ink">{row.displayName}</span>
          <span className="font-cd-mono text-[10px] text-adm-ink-faint">{row.providerId}</span>
        </div>
      ),
    },
    {
      id: 'health',
      header: screen.columns.health,
      render: (row) => (
        <StatusChip label={row.status.toUpperCase()} tone={HEALTH_TONE[row.status]} />
      ),
    },
    {
      id: 'checkedAt',
      header: screen.columns.checkedAt,
      secondary: true,
      render: (row) => (
        <span className="font-cd-mono text-[10px] text-adm-ink-mute">{row.checkedAt}</span>
      ),
    },
    {
      id: 'requests',
      header: screen.columns.requests,
      align: 'right',
      secondary: true,
      render: (row) => (row.requestCount === undefined ? unknown : <span>{row.requestCount}</span>),
    },
    {
      id: 'failures',
      header: screen.columns.failures,
      align: 'right',
      secondary: true,
      render: (row) => (row.failureCount === undefined ? unknown : <span>{row.failureCount}</span>),
    },
    {
      id: 'latency',
      header: screen.columns.latency,
      align: 'right',
      secondary: true,
      render: (row) =>
        row.lastLatencyMs === undefined ? unknown : <span>{row.lastLatencyMs}</span>,
    },
    {
      id: 'lastSuccess',
      header: screen.columns.lastSuccess,
      secondary: true,
      render: (row) =>
        row.lastSuccessAt === undefined ? (
          unknown
        ) : (
          <span className="font-cd-mono text-[10px]">{row.lastSuccessAt}</span>
        ),
    },
    {
      id: 'rateLimit',
      header: screen.columns.rateLimit,
      secondary: true,
      render: (row) =>
        row.rateLimitState === undefined ? unknown : <span>{row.rateLimitState}</span>,
    },
    {
      id: 'message',
      header: screen.columns.message,
      secondary: true,
      render: (row) =>
        row.message === undefined ? (
          unknown
        ) : (
          <span className="text-[11px] text-adm-ink-4">{row.message}</span>
        ),
    },
  ];

  return (
    <AdminPanel
      title={screen.providerHealthTitle}
      field="admin-06.providerHealth"
      note={`${screen.providerHealthNote} ${screen.countersNote}`}
    >
      <AdminFilterBar
        labels={[screen.columns.provider, screen.columns.health, screen.columns.mode]}
      />
      <AdminDataTable<ProviderHealthStatus>
        caption={screen.providerHealthTitle}
        columns={columns}
        rows={resource.data?.providers ?? []}
        state={resource.state}
        emptyTitle={screen.providerHealthTitle}
        emptyBody={screen.aiProvidersRequirement}
        rowKey={(row) => row.providerId}
      />
    </AdminPanel>
  );
}
