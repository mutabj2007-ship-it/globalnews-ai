'use client';

import { useAdminContext } from '../shell/AdminContext';
import { provenanceOf, type ProvenanceKey } from '@/lib/admin/adminProvenance';

/**
 * F1.b — the A/B/C/D badge the approved contract requires on EVERY data
 * field.
 *
 * The tag is not passed in as a prop by the calling screen; it is looked
 * up from the central registry by field key. A screen therefore cannot
 * claim a better provenance than the registry records, and the registry
 * holds the F0-VERIFIED tags — the corrected ones, where nine fields the
 * design tagged A turned out to have no backing data at all.
 *
 * D is unreachable by construction: nothing in the registry carries it,
 * and `adminProvenance.spec.ts` asserts that. D means design sample data,
 * and design sample data does not ship.
 */
const TONE: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'border-adm-chip-good-edge bg-adm-chip-good-bg text-adm-chip-good-ink',
  B: 'border-adm-chip-info-edge bg-adm-chip-info-bg text-adm-chip-info-ink',
  C: 'border-adm-chip-warn-edge bg-adm-chip-warn-bg text-adm-chip-warn-ink',
  D: 'border-adm-chip-violet-edge bg-adm-chip-violet-bg text-adm-chip-violet-ink',
};

export function ProvenanceBadge({ field }: { field: ProvenanceKey }): JSX.Element {
  const { t } = useAdminContext();
  const tag = provenanceOf(field);

  const description = {
    A: t.provenance.a,
    B: t.provenance.b,
    C: t.provenance.c,
    D: t.provenance.d,
  }[tag];

  return (
    <span
      title={description}
      aria-label={`${t.provenance.ariaPrefix}: ${description}`}
      className={`inline-flex min-w-[20px] items-center justify-center rounded-full border px-2 py-0.5 font-cd-mono text-[9px] leading-tight tracking-[0.08em] ${TONE[tag]}`}
    >
      {tag}
    </span>
  );
}
