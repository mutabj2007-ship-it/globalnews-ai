'use client';

import type { ReactNode } from 'react';
import { useAdminContext } from '../shell/AdminContext';
import { AdminStateBlock } from './AdminStateBlock';
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
 * A-1 REPAIR — A FAILED FETCH IS NOT AN EMPTY RESULT.
 *
 * This table used to collapse EVERY non-presented state into one branch:
 *
 *     if (state !== 'real' && state !== 'zero') { ...emptyTitle/emptyBody... }
 *
 * so `error` rendered byte-identical markup to "no records", with no
 * retry and no alert role. On /admin/news that meant a failed
 * `GET /admin/news/providers` displayed the caller's capability-absence
 * copy — a confident statement that no such capability exists — when in
 * fact the capability exists and the request failed. `useAdminResource`
 * already documents the opposite guarantee: a failure "resolves to state
 * 'error' … so a panel renders the error branch rather than an empty
 * table that could read as 'no records'." This is the branch that makes
 * that true.
 *
 * `error` is now handled FIRST and delegated to `AdminStateBlock` — the
 * one six-state renderer the rest of the platform already composes — so
 * a failing table looks like every other failing panel, carries
 * role="alert", and offers the caller's own reload as Retry.
 *
 * THE THREE OUTCOMES THAT REMAIN, AND WHY TWO SHARE COPY:
 *   error                      -> AdminStateBlock, never the caller's copy
 *   unavailable/notImplemented -> the caller's copy: a CAPABILITY absence
 *   real/zero with no rows     -> the caller's copy: a READING of none
 * The last two render the same markup because the caller — which is the
 * only thing that knows which of the two it is — supplies the wording.
 * That is also what keeps the empty state FILTER-AWARE: "no records at
 * all" and "no record matches this filter" are the caller's to
 * distinguish, and the audit screen passes its own copy for exactly that
 * reason.
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
  onRetry,
}: {
  caption: string;
  columns: ReadonlyArray<AdminColumn<Row>>;
  rows: readonly Row[];
  state: AdminDataState;
  emptyTitle: string;
  emptyBody: string;
  rowKey: (row: Row, index: number) => string;
  /**
   * A-1 — offered to the reader only on the error branch. Optional
   * because a table whose caller has no reload has nothing honest to
   * offer; AdminStateBlock omits the button rather than rendering a
   * control that does nothing.
   */
  onRetry?: () => void;
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

  /**
   * A-1 — FIRST, and deliberately ahead of every branch that could render
   * the caller's copy. A request that failed must never be described with
   * wording written for a capability that does not exist.
   */
  if (state === 'error') {
    return (
      <div className="rounded-lg border border-dashed border-adm-edge px-4 py-6">
        <AdminStateBlock state="error" onRetry={onRetry} />
      </div>
    );
  }

  const callerCopy = (
    <div className="rounded-lg border border-dashed border-adm-edge px-4 py-6">
      <p className="text-[12px] font-semibold text-adm-ink-2">{emptyTitle}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{emptyBody}</p>
    </div>
  );

  // 'unavailable' and 'notImplemented' — a CAPABILITY absence. The caller
  // states which capability and why.
  if (state !== 'real' && state !== 'zero') {
    return callerCopy;
  }

  // A successful read that returned nothing — a READING of none, not an
  // absence of capability. Still the caller's copy, because only the
  // caller knows whether a filter is applied.
  if (rows.length === 0) {
    return callerCopy;
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
