'use client';

import type { AdminDictionary } from '@/lib/i18n/dictionaries/adminEn';
import type { AdminMeResponse } from '@/lib/admin/adminApiTypes';
import type { AdminNavItem } from '@/lib/admin/adminNavManifest';

/**
 * F1.b — the sticky topbar.
 *
 * THE ROLE IS DISPLAYED, NEVER SELECTED. The approved artifact carries a
 * role dropdown in this position; it exists so a reviewer can preview
 * what each of the four roles sees. Per CTO decision it is NOT built as
 * a production control — a widget that changes your own role in the
 * browser is precisely the fiction F1.a exists to prevent. What renders
 * here is the real role that GET /admin/me returned, read-only, and the
 * count of capabilities the SERVER granted.
 *
 * The search field is rendered because the design places it here, and it
 * is explicitly labelled as not implemented: there is no search endpoint,
 * and a working-looking box over nothing would be a lie about capability.
 */
export function AdminTopBar({
  t,
  me,
  activeItem,
  onOpenDrawer,
}: {
  t: AdminDictionary;
  me: AdminMeResponse;
  activeItem: AdminNavItem | undefined;
  onOpenDrawer: () => void;
}): JSX.Element {
  const screenCode = activeItem?.screen ?? 'ADMIN-01';
  const screenTitle = activeItem
    ? (t.nav.items[activeItem.labelKey as keyof typeof t.nav.items] ?? activeItem.label)
    : t.brand.subtitle;

  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-adm-edge bg-adm-topbar px-4 py-3.5 backdrop-blur-md adm-full:px-[26px]">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label={t.nav.openMenu}
        className="rounded-lg border border-adm-edge-input px-2.5 py-1.5 text-adm-ink-mute hover:border-adm-accent/50 adm-rail:hidden"
      >
        <span aria-hidden="true" className="block h-0.5 w-4 bg-current" />
        <span aria-hidden="true" className="mt-1 block h-0.5 w-4 bg-current" />
        <span aria-hidden="true" className="mt-1 block h-0.5 w-4 bg-current" />
      </button>

      <div className="flex min-w-0 flex-col gap-[3px]">
        <div className="font-cd-mono text-[9px] uppercase leading-none tracking-[0.16em] text-adm-ink-faint">
          {screenCode}
        </div>
        <div className="truncate text-[17px] font-semibold leading-tight tracking-tight text-adm-ink">
          {screenTitle}
        </div>
      </div>

      <div
        className="hidden min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-adm-edge-input bg-adm-card px-3.5 py-2.5 adm-full:flex adm-full:max-w-[380px]"
        title={t.topbar.searchNotImplemented}
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full border-[1.5px] border-adm-ink-faint"
        />
        <span className="truncate text-xs text-adm-ink-dim">{t.topbar.searchPlaceholder}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="font-cd-mono text-[9px] uppercase tracking-[0.14em] text-adm-ink-faint">
            {t.topbar.roleLabel}
          </span>
          {/*
            Plain text. Not a <select>, not a button, not a link: there is
            no client-side role switching on this platform.
          */}
          <span className="font-cd-mono text-[11px] tracking-[0.06em] text-adm-accent-hi">
            {me.role}
          </span>
        </div>
        <div className="hidden flex-col items-end adm-rail:flex">
          <span className="font-cd-mono text-[9px] uppercase tracking-[0.14em] text-adm-ink-faint">
            {t.topbar.capabilityCount}
          </span>
          <span className="font-cd-mono text-[11px] text-adm-ink-mute">
            {me.capabilities.length}
          </span>
        </div>
      </div>
    </header>
  );
}
