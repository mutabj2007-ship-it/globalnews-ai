'use client';

import { useAdminContext } from '../shell/AdminContext';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { ADMIN_API, ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import type { AdminNewsProvidersResponse, AdminProviderHealth } from '@/lib/admin/adminApiTypes';
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
 * MVP-G4 MADE THAT SEPARATION VISIBLE. Listing the registered set
 * without saying which rows serve reads implied that all of them did,
 * and a synthetic provider reporting "ok" then read as a healthy
 * deployment. Every row now carries whether it is SERVING and whether it
 * is SYNTHETIC, both asserted by the backend from the DI token sets.
 *
 * THE DETAIL COLUMN IS GONE, AND NOT BY OVERSIGHT. It rendered the
 * provider's free-text `message`, which the backend fills from
 * `error.message` when a provider's health check throws: untranslatable
 * in a bilingual surface, and an uncontrolled channel for whatever a
 * provider puts in an error. The field no longer exists on the type.
 *
 * THE COUNTER COLUMNS READ UNKNOWN, ON PURPOSE. `AdminProviderHealth`
 * declares requestCount, failureCount, lastLatencyMs, lastSuccessAt and
 * rateLimitState, and no provider populates any of them. The backend projection omits an absent field rather
 * than zero-filling it, and this table renders the absence as UNKNOWN. A
 * zero here would be a measurement nobody took.
 *
 * ACCURACY CLAIMS STAY REMOVED. The artifact's "AI VERIFIED" and "FACT
 * CHECKED" badges are tagged D and are absent from this screen. They have
 * no backend contract defining what they would mean, and the platform's
 * own SourceDiversity contract already refuses claims of this shape.
 */
export type OperationsTab = 'news' | 'sources' | 'ai' | 'providers';

const HEALTH_TONE: Record<AdminProviderHealth['status'], ChipTone> = {
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

      {tab === 'sources' && <PublisherSourcePanel />}

      {tab === 'news' && <ArticleInventoryPanel />}

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

function PublisherSourcePanel(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.operations;
  const resource = useAdminResource<AdminNewsProvidersResponse>(ADMIN_API.newsProviders);
  const sources = resource.data?.sources ?? [];

  return (
    <AdminPanel
      title="Publisher & official sources"
      field="admin-06.providerHealth"
      note="Individual sources carried by the Publisher Feeds transport. Source identity and country are preserved independently."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map((source) => (
          <div key={source.sourceId} className="rounded-lg border border-adm-edge bg-adm-card-soft p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-adm-ink">{source.displayName}</div>
                <div className="mt-1 font-cd-mono text-[10px] text-adm-ink-faint">
                  {source.countryCode} · {source.language ?? '—'} · {source.sourceType.replace('_', ' ')}
                </div>
              </div>
              <StatusChip label={source.enabled ? 'ACTIVE' : 'INACTIVE'} tone={source.enabled ? 'good' : 'mute'} />
            </div>
          </div>
        ))}
      </div>
    </AdminPanel>
  );
}

function ArticleInventoryPanel(): JSX.Element {
  const resource = useAdminResource<AdminNewsProvidersResponse>(ADMIN_API.newsProviders);
  const inventory = resource.data?.inventory;

  return (
    <AdminPanel
      title="Article inventory"
      field="admin-06.articleInventory"
      note="Measured from retained Article rows. This read does not call a provider."
    >
      {resource.state === 'loading' ? (
        <div className="py-8 font-cd-mono text-[10px] uppercase text-adm-ink-mute">Loading inventory…</div>
      ) : inventory === null || inventory === undefined ? (
        <div className="py-8 text-sm text-adm-ink-dim">Article inventory could not be read.</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-adm-edge bg-adm-card-soft p-3">
              <div className="font-cd-mono text-[10px] uppercase tracking-wider text-adm-ink-faint">Stored articles</div>
              <div className="mt-1 text-2xl font-semibold text-adm-ink">{inventory.articleCount}</div>
            </div>
            <div className="rounded-lg border border-adm-edge bg-adm-card-soft p-3">
              <div className="font-cd-mono text-[10px] uppercase tracking-wider text-adm-ink-faint">Latest retained</div>
              <div className="mt-1 break-all font-cd-mono text-[10px] text-adm-ink">{inventory.latestFetchedAt ?? '—'}</div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-adm-edge">
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead className="font-cd-mono text-[10px] uppercase tracking-wider text-adm-ink-faint">
                <tr><th className="p-3">Source</th><th className="p-3">Articles</th><th className="p-3">Latest retained</th></tr>
              </thead>
              <tbody>
                {inventory.bySource.map((source) => (
                  <tr key={source.sourceId} className="border-t border-adm-edge">
                    <td className="p-3"><div className="font-semibold text-adm-ink">{source.sourceName}</div><div className="font-cd-mono text-[10px] text-adm-ink-faint">{source.sourceId}</div></td>
                    <td className="p-3 text-adm-ink">{source.articleCount}</td>
                    <td className="p-3 font-cd-mono text-[10px] text-adm-ink-dim">{source.latestFetchedAt ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminPanel>
  );
}

function ProviderHealthPanel(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.operations;
  const resource = useAdminResource<AdminNewsProvidersResponse>(ADMIN_API.newsProviders);

  const unknown = (
    <span className="font-cd-mono text-[10px] text-adm-val-mute">{t.states.unknown}</span>
  );

  const columns: ReadonlyArray<AdminColumn<AdminProviderHealth>> = [
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
      id: 'serving',
      header: screen.columns.serving,
      render: (row) => (
        <StatusChip
          label={row.enabled ? screen.serving.yes : screen.serving.no}
          tone={row.enabled ? 'good' : 'mute'}
        />
      ),
    },
    {
      id: 'kind',
      header: screen.columns.kind,
      render: (row) => (
        <StatusChip
          label={screen.providerKinds[row.providerKind]}
          tone={row.providerKind === 'REAL' ? 'good' : 'warn'}
        />
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
  ];

  return (
    <AdminPanel
      title={screen.providerHealthTitle}
      field="admin-06.providerHealth"
      note={`${screen.providerHealthNote} ${screen.servingNote} ${screen.countersNote}`}
    >
      <AdminFilterBar
        labels={[screen.columns.provider, screen.columns.health, screen.columns.serving]}
      />
      <AdminDataTable<AdminProviderHealth>
        caption={screen.providerHealthTitle}
        columns={columns}
        rows={resource.data?.providers ?? []}
        state={resource.state}
        /*
          A-1 — the empty copy now describes THIS table. It used to pass
          `aiProvidersRequirement`, which is about the AI analysis provider and
          which the table also rendered on a failed fetch, so a working
          capability was reported as a missing one. The error state no longer
          reaches this copy at all: AdminDataTable handles it through
          AdminStateBlock, and `onRetry` gives the reader the resource's own
          reload rather than a page refresh.
        */
        emptyTitle={screen.providerHealthEmptyTitle}
        emptyBody={screen.providerHealthEmptyBody}
        rowKey={(row) => row.providerId}
        onRetry={resource.reload}
      />
    </AdminPanel>
  );
}
