'use client';

import { useAdminContext } from '../shell/AdminContext';
import type { AdminValue } from '@/lib/admin/adminDataState';
import type { ProvenanceKey } from '@/lib/admin/adminProvenance';
import { AdminStateBlock } from './AdminStateBlock';
import { ProvenanceBadge } from './ProvenanceBadge';

/**
 * F1.b — a KPI card, in the approved shape:
 *   { value | null, state, provenance, windowLabel, asOf }
 *
 * The card CANNOT render a number it was not given. `value` is only read
 * on the 'real' and 'zero' branches, and a zero is rendered as `0` beside
 * its window label rather than being mistaken for "no data" — the
 * approved contract's distinction between a measured zero and an absent
 * source.
 */
export function KpiCard({
  label,
  windowLabel,
  field,
  data,
  onRetry,
}: {
  label: string;
  windowLabel?: string;
  field: ProvenanceKey;
  data: AdminValue<number | string>;
  onRetry?: () => void;
}): JSX.Element {
  const { t } = useAdminContext();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-adm-edge-soft bg-adm-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-cd-mono text-[9px] uppercase leading-tight tracking-[0.14em] text-adm-ink-faint">
          {label}
        </span>
        <ProvenanceBadge field={field} />
      </div>

      <AdminStateBlock state={data.state} correlationId={data.correlationId} onRetry={onRetry}>
        <span className="block text-[25px] font-semibold leading-none tracking-tight text-adm-val">
          {data.state === 'zero' ? '0' : String(data.value ?? '')}
        </span>
      </AdminStateBlock>

      {windowLabel && (
        <span className="text-[10.5px] leading-tight text-adm-ink-dim">{windowLabel}</span>
      )}

      {data.asOf && <span className="font-cd-mono text-[9px] text-adm-ink-faint">{data.asOf}</span>}

      {data.state === 'zero' && (
        <span className="text-[10.5px] leading-tight text-adm-ink-dim">{t.states.zeroNote}</span>
      )}
    </div>
  );
}
