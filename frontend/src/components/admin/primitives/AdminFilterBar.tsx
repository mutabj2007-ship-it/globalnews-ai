'use client';

import { useAdminContext } from '../shell/AdminContext';

/**
 * F1.b — the filter bar, rendered and MARKED INERT.
 *
 * The approved design places a filter set on most screens. F1.b has no
 * data behind those screens, and a working-looking filter over an empty
 * result set is theatre — so the fields render at their designed size,
 * are not focusable, and the bar states plainly that they do nothing
 * yet. When a screen gains data, its filters become real controls and
 * this notice goes away.
 */
export function AdminFilterBar({ labels }: { labels: readonly string[] }): JSX.Element {
  const { t } = useAdminContext();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
        {labels.map((label) => (
          <span
            key={label}
            className="rounded-lg border border-adm-edge-input bg-adm-card px-3 py-2 font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-faint"
          >
            {label}
          </span>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-adm-ink-dim">{t.states.inertFilters}</p>
    </div>
  );
}
