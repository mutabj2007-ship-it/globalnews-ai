'use client';

import type { ReactNode } from 'react';
import { useAdminContext } from '../shell/AdminContext';
import type { AdminDataState } from '@/lib/admin/adminDataState';

/**
 * F1.b — the admin table.
 *
 * Real table semantics with scope headers, because the approved
 * accessibility contract requires them and because a grid of divs is not
 * navigable by a screen reader's table mode.
 *
 * COLUMN PRIORITY: a column marked `secondary` is hidden below 900px, so
 * the identifier, the primary value and the status survive on a narrow
 * viewport — the design's own collapse rule.
 *
 * THE EMPTY STATE IS FILTER-AWARE and it distinguishes two things the
 * approved contract insists are different: "there are no records at all"
 * and "no record matches this filter". An empty audit table is never
 * shown as "no records" — the audit screen passes its own copy.
 */
export interface AdminColumn<Row> {
  id: string;
  header: string;
  /** Hidden below 900px. Identifier, value and status columns must not be secondary. */
  secondary?: boolean;
  align?: 'left' | 'right';
  render: (row: Row) => ReactNode;
}

export function AdminDataTable<Row>({
  caption,
  columns,
  rows,
  state,
  emptyTitle,
  emptyBody,
  rowKey,
}: {
  caption: string;
  columns: ReadonlyArray<AdminColumn<Row>>;
  rows: readonly Row[];
  state: AdminDataState;
  emptyTitle: string;
  emptyBody: string;
  rowKey: (row: Row, index: number) => string;
}): JSX.Element {
  const { t } = useAdminContext();

  const head = (
    <thead>
      <tr className="border-b border-adm-edge">
        {columns.map((column) => (
          <th
            key={column.id}
            scope="col"
            className={[
              'px-3 py-2 font-cd-mono text-[9px] uppercase tracking-[0.12em] text-adm-ink-faint',
              column.align === 'right' ? 'text-right' : 'text-left',
              column.secondary ? 'hidden adm-rail:table-cell' : '',
            ].join(' ')}
          >
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  if (state === 'loading') {
    return (
      <div className="overflow-x-auto" aria-busy="true">
        <table className="w-full border-collapse text-[12px]">
          <caption className="sr-only">{caption}</caption>
          {head}
          <tbody>
            {[0, 1, 2].map((index) => (
              <tr key={index} className="border-b border-adm-edge-mute">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-3 py-3 ${column.secondary ? 'hidden adm-rail:table-cell' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className="block h-3 w-full animate-pulse rounded bg-adm-edge"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <span className="sr-only">{t.states.loading}</span>
      </div>
    );
  }

  if (state !== 'real' && state !== 'zero') {
    return (
      <div className="rounded-lg border border-dashed border-adm-edge px-4 py-6">
        <p className="text-[12px] font-semibold text-adm-ink-2">{emptyTitle}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{emptyBody}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-adm-edge px-4 py-6">
        <p className="text-[12px] font-semibold text-adm-ink-2">{emptyTitle}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <caption className="sr-only">{caption}</caption>
        {head}
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className="border-b border-adm-edge-mute last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={[
                    'px-3 py-3 align-middle text-adm-ink-2',
                    column.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                    column.secondary ? 'hidden adm-rail:table-cell' : '',
                  ].join(' ')}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
