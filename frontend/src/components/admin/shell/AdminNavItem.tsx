'use client';

import Link from 'next/link';
import type { AdminDictionary } from '@/lib/i18n/dictionaries/adminEn';
import type { AdminNavItem as AdminNavItemModel } from '@/lib/admin/adminNavManifest';

/**
 * F1.b — one sidebar entry.
 *
 * There is NO disabled variant, deliberately and by construction. The
 * approved navigation contract says an item the role cannot access is
 * omitted entirely, never rendered-and-teased — so an item that reaches
 * this component has already passed the capability filter, and this
 * component has no way to express "present but forbidden".
 *
 * A `not_implemented` item renders a chip and is NOT a link. No entry
 * carries that state today (see adminNavManifest's own note), but the
 * mechanism is here and tested so a genuinely unbuilt future section can
 * use it.
 *
 * Active state comes from the ROUTE, never from click state, and is
 * announced with aria-current="page".
 */
export function AdminNavItem({
  item,
  t,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItemModel;
  t: AdminDictionary;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}): JSX.Element {
  const label = t.nav.items[item.labelKey as keyof typeof t.nav.items] ?? item.label;

  const shell =
    'relative flex items-center gap-[9px] rounded-lg px-[10px] py-2 text-[13px] leading-tight transition-colors';

  const numberGlyph = (
    <span
      aria-hidden="true"
      className="relative w-[14px] shrink-0 font-cd-mono text-[9px] leading-none text-adm-ink-ghost"
    >
      {item.num}
    </span>
  );

  if (item.state === 'not_implemented') {
    return (
      <span className={`${shell} cursor-not-allowed text-adm-ink-dim`} aria-disabled="true">
        {numberGlyph}
        {!collapsed && (
          <>
            <span className="relative flex-1 truncate">{label}</span>
            <span className="relative rounded-full border border-adm-chip-warn-edge bg-adm-chip-warn-bg px-2 py-0.5 font-cd-mono text-[9px] tracking-[0.08em] text-adm-chip-warn-ink">
              {t.states.planned}
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.route}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`${shell} text-adm-ink-2 hover:bg-adm-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent ${
        isActive ? 'bg-adm-accent-wash' : ''
      }`}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 rounded-l-lg bg-adm-accent"
        />
      )}
      {numberGlyph}
      {!collapsed && <span className="relative flex-1 truncate">{label}</span>}
      {collapsed && <span className="sr-only">{label}</span>}
    </Link>
  );
}
