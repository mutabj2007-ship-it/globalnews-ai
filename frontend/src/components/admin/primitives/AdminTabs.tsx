'use client';

import Link from 'next/link';
import type { AdminRoute } from '@/lib/admin/adminRoutes';

/**
 * F1.b — the tab row.
 *
 * Every tab is a REAL ROUTE, not client state, so a filtered view is a
 * shareable URL — the approved navigation contract's "every tab and
 * filter set is URL-encoded and shareable". The active tab is derived
 * from the route and announced with aria-current.
 */
export interface AdminTab {
  id: string;
  label: string;
  href: AdminRoute;
}

export function AdminTabs({
  tabs,
  activeId,
}: {
  tabs: readonly AdminTab[];
  activeId: string;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="navigation">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-lg border px-3.5 py-2 font-cd-mono text-[11px] leading-none tracking-[0.06em] transition-colors ${
              isActive
                ? 'border-adm-chip-info-edge bg-adm-accent-wash text-adm-accent-hi'
                : 'border-transparent text-adm-ink-mute hover:bg-adm-accent-hover'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
