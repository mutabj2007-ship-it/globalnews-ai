'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { AdminDictionary } from '@/lib/i18n/dictionaries/adminEn';
import { useAdminMe } from '@/lib/admin/useAdminMe';
import { navItemForPath } from '@/lib/admin/adminNavManifest';
import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { AdminContextProvider } from './AdminContext';
import { AdminAccessState } from './AdminAccessState';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';

/**
 * F1.b — THE ONE CLIENT BOUNDARY FOR THE ENTIRE ADMIN SURFACE.
 *
 * Twenty routes, one `/admin/me` call, one dictionary, one access state
 * machine. No screen fetches its own identity and no screen renders
 * before this component has a 200.
 *
 * THIS GATE IS CONVENIENCE, NOT SECURITY, and it is important that
 * whoever reads this next understands why it is still worth having.
 * Every admin endpoint enforces authorization independently in the
 * backend (AdminPlatformEnabledGuard -> RequireAuthGuard -> AdminGuard,
 * fail-closed, F1.a). If this client check were bypassed entirely, the
 * visitor would reach an empty shell whose every request returns 403 or
 * 404. It exists so an administrator is not shown a broken screen, and
 * so a non-administrator is not shown a teaser — not to protect data.
 *
 * Nothing here is persisted. The role and capability list are re-read
 * from the server on every mount; they are never written to
 * localStorage, sessionStorage, a cookie, or any other client store.
 */
export function AdminShell({
  t,
  children,
}: {
  t: AdminDictionary;
  children: ReactNode;
}): JSX.Element {
  const { outcome, me, reload } = useAdminMe();
  const pathname = usePathname() ?? ADMIN_ROUTES.overview;
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (outcome !== 'authorized' || !me) {
    return (
      <AdminAccessState
        t={t}
        variant={outcome === 'authorized' ? 'unreachable' : outcome}
        onRetry={reload}
      />
    );
  }

  const activeItem = navItemForPath(pathname);

  return (
    <AdminContextProvider t={t} me={me}>
      <div className="flex min-h-screen bg-adm-void bg-adm-page font-cd-body text-adm-ink">
        <a
          href="#admin-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-30 focus:rounded-lg focus:border focus:border-adm-accent focus:bg-adm-card focus:px-3 focus:py-2 focus:text-sm"
        >
          {t.nav.skipToContent}
        </a>

        {drawerOpen && (
          <button
            type="button"
            aria-label={t.nav.closeMenu}
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-10 bg-black/60 adm-rail:hidden"
          />
        )}

        <AdminSidebar
          t={t}
          capabilities={me.capabilities}
          pathname={pathname}
          drawerOpen={drawerOpen}
          onNavigate={() => setDrawerOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar
            t={t}
            me={me}
            activeItem={activeItem}
            onOpenDrawer={() => setDrawerOpen(true)}
          />
          <main id="admin-content" className="min-w-0 flex-1 px-4 py-6 adm-full:px-[26px]">
            {children}
          </main>
        </div>
      </div>
    </AdminContextProvider>
  );
}
