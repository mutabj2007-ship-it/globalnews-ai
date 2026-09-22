'use client';

import { useState } from 'react';
import { useAdminContext } from '../shell/AdminContext';
import { sectionNumber, sectionState } from '@/lib/admin/adminDataState';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import type { AdminUsersResponse } from '@/lib/admin/adminApiTypes';
import { AdminDataTable } from '../primitives/AdminDataTable';
import { AdminPanel } from '../primitives/AdminPanel';
import { KpiCard } from '../primitives/KpiCard';

/**
 * ADMIN-03 — the account list. SUPER_ADMIN only, and read-only.
 *
 * FOUR COLUMNS, AND THE ABSENT ONES ARE THE DESIGN. There is no address
 * here, no masked or partial address, no domain, no search-history text,
 * no sign-in identity value, no session data — and no display name. None
 * of them is hidden by this component; none is fetched by the service or
 * declared by the contract, so there is nothing here to hide.
 *
 * WHY NOT DISPLAY NAME. The ruling named six forbidden fields and did
 * not name that one, but it is a person's real name from their sign-in
 * profile and it identifies an individual about as well as the address
 * the ruling removed. Nothing on this screen acts on a person — no role
 * can be granted, changed or removed anywhere in this platform — so an
 * identifying label answers no question this view can ask. The notice at
 * the foot of the panel says all of this to the operator rather than
 * leaving them to wonder what they are not being shown.
 *
 * A ROW IS NOT A PERSON'S RECORD. It is an account's shape: when it
 * arrived, whether it has been observed returning, and whether it holds
 * an administrative role.
 */
export function AnalyticsUsersTab(): JSX.Element {
  const { can, t } = useAdminContext();
  return can('access.manage') ? <UsersData /> : <p>{t.access.forbiddenBody}</p>;
}

function UsersData(): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.analytics;
  const [page, setPage] = useState(1);

  const users = useAdminResource<AdminUsersResponse>(`${ADMIN_API.users}?page=${String(page)}`);

  const accounts = users.data?.accounts ?? null;
  const byRole = users.data?.byAdminRole ?? null;
  const listState = sectionState(users.state, accounts);

  const total = users.data?.totalCount ?? null;
  const pageSize = users.data?.pageSize ?? null;
  const hasNext =
    total !== null && pageSize !== null && accounts !== null && page * pageSize < total;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-3">
        <KpiCard
          label={screen.usersTotal}
          field="admin-03.userRecords"
          data={sectionNumber(users.state, accounts, total ?? undefined)}
          onRetry={users.reload}
        />
      </div>

      <AdminPanel
        title={screen.usersTitle}
        field="admin-03.userRecords"
        note={screen.usersPurpose}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-adm-edge px-3 py-1 font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-2 disabled:opacity-40"
            >
              {screen.usersPagePrevious}
            </button>
            <span className="font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-faint">
              {screen.usersPageLabel} {String(page)}
            </span>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-full border border-adm-edge px-3 py-1 font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-2 disabled:opacity-40"
            >
              {screen.usersPageNext}
            </button>
          </div>
        }
      >
        <AdminDataTable
          caption={screen.usersTitle}
          state={listState}
          rows={accounts ?? []}
          rowKey={(row) => row.id}
          emptyTitle={screen.usersEmptyTitle}
          emptyBody={screen.usersEmptyBody}
          onRetry={users.reload}
          columns={[
            { id: 'id', header: screen.usersIdColumn, render: (row) => row.id },
            {
              id: 'createdAt',
              header: screen.usersCreatedColumn,
              render: (row) => row.createdAt,
            },
            {
              id: 'lastSeenAt',
              header: screen.usersLastSeenColumn,
              secondary: true,
              // NULL IS "NEVER OBSERVED", NOT "INACTIVE" AND NOT A BLANK
              // CELL. An empty cell in a table of people reads as a fact
              // about the person rather than about the measurement.
              render: (row) => row.lastSeenAt ?? screen.usersNeverSeen,
            },
            {
              id: 'adminRole',
              header: screen.usersRoleColumn,
              render: (row) => row.adminRole ?? screen.usersNoRole,
            },
          ]}
        />

        <p className="mt-3 text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.usersOmittedFields}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">
          {screen.usersNoWritePath}
        </p>
      </AdminPanel>

      <AdminPanel title={screen.usersRoleDistribution} field="admin-03.userRecords">
        <AdminDataTable
          caption={screen.usersRoleDistribution}
          state={sectionState(users.state, byRole)}
          rows={byRole ?? []}
          rowKey={(row) => row.key}
          emptyTitle={screen.usersEmptyTitle}
          emptyBody={screen.usersEmptyBody}
          onRetry={users.reload}
          columns={[
            {
              id: 'role',
              header: screen.usersRoleColumn,
              render: (row) => (row.key === 'none' ? screen.usersNoRole : row.key),
            },
            {
              id: 'count',
              header: screen.usersTotal,
              align: 'right',
              render: (row) => String(row.count),
            },
          ]}
        />
      </AdminPanel>
    </>
  );
}
