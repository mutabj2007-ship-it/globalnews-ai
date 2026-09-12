'use client';

import type { ReactNode } from 'react';
import type { ProvenanceKey } from '@/lib/admin/adminProvenance';
import { ProvenanceBadge } from './ProvenanceBadge';

/**
 * F1.b — the section card every screen composes.
 *
 * `field` is required, not optional: a panel that shows data must
 * declare which field it shows, so the provenance badge can never be
 * forgotten. `note` carries the panel's own honest caveat — the
 * signed-in-only warning, the coverage-vs-audience distinction, the
 * counters-are-UNKNOWN explanation.
 */
export function AdminPanel({
  title,
  field,
  note,
  actions,
  children,
}: {
  title: string;
  field: ProvenanceKey;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-adm-edge-soft bg-adm-card-soft p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-adm-ink-2">{title}</h2>
        <ProvenanceBadge field={field} />
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {note && <p className="text-[11px] leading-relaxed text-adm-ink-dim">{note}</p>}

      {children}
    </section>
  );
}
