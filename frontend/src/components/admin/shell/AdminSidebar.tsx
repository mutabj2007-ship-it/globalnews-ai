'use client';

import type { AdminDictionary } from '@/lib/i18n/dictionaries/adminEn';
import { visibleNavGroups } from '@/lib/admin/adminNavManifest';
import { ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { AdminNavItem } from './AdminNavItem';

/**
 * F1.b — the 252px sidebar, its 68px icon rail, and its drawer.
 *
 * Responsive behaviour is exactly ADMIN-01's:
 *   below 900px     drawer, off-canvas until opened
 *   >= 900px        68px icon rail (numbers only)
 *   >= 1280px       the full 252px sidebar
 *
 * The nav is built from `visibleNavGroups(capabilities)`, so an entry a
 * role cannot access does not exist in the DOM at all — not hidden by
 * CSS, not disabled, not present with a tooltip.
 */
export function AdminSidebar({
  t,
  capabilities,
  pathname,
  drawerOpen,
  onNavigate,
}: {
  t: AdminDictionary;
  capabilities: readonly string[];
  pathname: string;
  drawerOpen: boolean;
  onNavigate: () => void;
}): JSX.Element {
  const groups = visibleNavGroups(capabilities);

  return (
    <nav
      aria-label={t.nav.landmarkLabel}
      data-drawer-open={drawerOpen ? 'true' : 'false'}
      className={[
        'z-20 flex shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-adm-edge bg-adm-rail px-[14px] pb-6 pt-5',
        'fixed inset-y-0 left-0 w-adm-rail transition-transform',
        drawerOpen ? 'translate-x-0' : '-translate-x-full',
        'adm-rail:static adm-rail:w-adm-icon-rail adm-rail:translate-x-0 adm-rail:px-2',
        'adm-full:w-adm-rail adm-full:px-[14px]',
      ].join(' ')}
    >
      <div className="flex flex-col gap-[3px] border-b border-adm-edge-mute px-1.5 pb-3.5">
        <div className="text-[19px] font-bold leading-none tracking-tight text-adm-ink adm-rail:hidden adm-full:block">
          {t.brand.name} <span className="text-adm-accent">{t.brand.accent}</span>
        </div>
        <div
          aria-hidden="true"
          className="hidden text-center font-cd-mono text-[13px] font-bold text-adm-accent adm-rail:block adm-full:hidden"
        >
          AI
        </div>
        <div className="font-cd-mono text-[10px] uppercase leading-none tracking-[0.18em] text-adm-ink-dim adm-rail:hidden adm-full:block">
          {t.brand.subtitle}
        </div>
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg border border-adm-edge px-3 py-3 adm-rail:hidden adm-full:block">
          <p className="text-[13px] font-semibold text-adm-ink-2">{t.nav.emptyTitle}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{t.nav.emptyBody}</p>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.labelKey} className="flex flex-col gap-0.5">
          <div className="px-2 pb-2 font-cd-mono text-[10px] uppercase leading-none tracking-[0.16em] text-adm-ink-faint adm-rail:hidden adm-full:block">
            {t.nav.groups[group.labelKey as keyof typeof t.nav.groups] ?? group.label}
          </div>
          {group.items.map((item) => (
            <div key={item.id}>
              {/* Full sidebar (>=1280) and drawer (<900) render the label. */}
              <div className="adm-rail:hidden adm-full:block">
                <AdminNavItem
                  item={item}
                  t={t}
                  isActive={isActiveRoute(pathname, item.route)}
                  collapsed={false}
                  onNavigate={onNavigate}
                />
              </div>
              {/* Icon rail (900-1279) renders the number only. */}
              <div className="hidden adm-rail:block adm-full:hidden">
                <AdminNavItem
                  item={item}
                  t={t}
                  isActive={isActiveRoute(pathname, item.route)}
                  collapsed
                  onNavigate={onNavigate}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * `/admin` must not light up for every deeper route, so the overview
 * entry matches exactly while every other entry also matches its own
 * sub-paths (`/admin/news/sources` keeps Global sources active).
 */
export function isActiveRoute(pathname: string, route: string): boolean {
  if (route === ADMIN_ROUTES.overview) return pathname === ADMIN_ROUTES.overview;
  return pathname === route || pathname.startsWith(`${route}/`);
}
