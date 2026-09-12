'use client';

import { useAdminContext } from '../shell/AdminContext';
import type { ProvenanceKey } from '@/lib/admin/adminProvenance';
import { ProvenanceBadge } from './ProvenanceBadge';

/**
 * F1.b — the striped placeholder the approved contract specifies for a
 * surface that has a purpose and no backend.
 *
 * It states BOTH: what the panel is for, and what would have to exist for
 * it to work. That second half is the point — a placeholder that only
 * says "coming soon" tells a reader nothing, while "requires
 * request-level geography, which this platform does not collect" tells
 * them exactly what the gap is.
 *
 * It holds its layout slot rather than collapsing, so the screen reads as
 * designed rather than as broken.
 */
export function PlaceholderPanel({
  title,
  purpose,
  requirement,
  field,
  ratio = 'aspect-[16/9]',
}: {
  title: string;
  purpose: string;
  requirement: string;
  field: ProvenanceKey;
  ratio?: string;
}): JSX.Element {
  const { t } = useAdminContext();

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-adm-edge-soft bg-adm-card-soft p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-adm-ink-2">{title}</h2>
        <ProvenanceBadge field={field} />
        <span className="ml-auto rounded-full border border-adm-chip-warn-edge bg-adm-chip-warn-bg px-2.5 py-1 font-cd-mono text-[9px] tracking-[0.08em] text-adm-chip-warn-ink">
          {t.states.notImplemented}
        </span>
      </div>

      <div
        className={`flex ${ratio} w-full items-center justify-center rounded-lg border border-dashed border-adm-edge bg-[repeating-linear-gradient(135deg,rgba(45,212,232,.05)_0_8px,transparent_8px_16px)] p-6`}
      >
        <div className="max-w-md text-center">
          <p className="text-[12px] leading-relaxed text-adm-ink-4">{purpose}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-adm-ink-dim">{requirement}</p>
        </div>
      </div>
    </section>
  );
}
