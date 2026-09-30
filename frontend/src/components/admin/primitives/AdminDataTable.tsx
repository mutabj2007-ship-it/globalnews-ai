'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { useAdminContext } from '../shell/AdminContext';
import { AdminStateBlock } from './AdminStateBlock';
import { fillTokens, selectAdminTableView } from './adminTableView';
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
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN COMPACT LISTS R1 — SEARCH, PAGINATION AND STACKED ROWS, ALL OPT-IN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * EVERY EXISTING CALLER IS UNCHANGED. `search`, `pageSize`, `loadedOnlyNote` and
 * `stackedOnNarrow` are all optional, and with none of them supplied this
 * component renders exactly the markup it rendered before — no input, no
 * buttons, no `<details>`, every row, in the order given. Twenty-odd tables
 * across the surface keep their behaviour; the two that need more ask for it.
 * `adminCompactLists.spec.ts` pins that by rendering a no-options table and
 * asserting the absence of all four affordances.
 *
 * ONE CONTRACT DOES SHIFT, AND IT IS DELIBERATE. The paragraph above says the
 * caller owns "no record matches this filter", because until now only the caller
 * could know a filter was applied. When `search` is supplied, this component
 * applies the filter, so it — not the caller — now owns that wording, and it
 * keeps the search box on screen so the reader can clear it. The caller's
 * `emptyTitle`/`emptyBody` still own the case that matters to them: a successful
 * read that returned nothing at all. The two are no longer the same branch.
 *
 * SEARCH IS OVER EVERY FETCHED ROW, BEFORE PAGINATION, and the page resets when
 * the query changes — see `adminTableView.ts`, which holds that logic as a pure
 * function so it can be exercised at every boundary without a render.
 *
 * NOTHING HERE FETCHES. Typing in the search box, turning a page and opening a
 * row are pure client-side operations over rows already in hand: there is no
 * `fetch`, no `useAdminResource`, and no call to the caller's `onRetry` outside
 * the error branch. `adminCompactLists.spec.ts` mocks `fetch` at the wire and
 * asserts the request count stays at ZERO across a search, a page turn and a row
 * expansion — because "searching must not trigger AI computation" is a claim
 * that has to be measured, not asserted.
 *
 * STACKED ROWS — M-B. `secondary` columns are hidden below 900px, which keeps a
 * wide table readable on a phone but makes those columns UNREACHABLE there. For
 * a records table — an audit history whose WHO and REASON are exactly the
 * columns that get marked secondary — that is a hole, and pagination does not
 * fix it: fewer rows per page still shows the same truncated row. With
 * `stackedOnNarrow`, each row below the breakpoint becomes a native
 * `<details>` whose summary carries the primary columns and whose body lists
 * EVERY column, secondary included, as label/value pairs.
 *
 * WHY NATIVE `<details>` AND NOT A SCRIPTED DISCLOSURE: it is keyboard-operable
 * and screen-reader-announced with no JavaScript, it cannot trap page scroll
 * because it is in the document flow rather than a fixed overlay, and it needs
 * no focus management. The table and the stacked list are BOTH in the DOM,
 * switched by `hidden` — which removes the inactive one from the accessibility
 * tree, so nothing is announced twice.
 */
export interface AdminColumn<Row> {
  id: string;
  header: string;
  /**
   * Hidden below 900px. Identifier, value and status columns must not be
   * secondary. With `stackedOnNarrow`, a secondary column is still reachable on
   * a phone — inside the row's expansion — rather than being dropped.
   */
  secondary?: boolean;
  align?: 'left' | 'right';
  render: (row: Row) => ReactNode;
}

/*
  THE FOCUS RING, once.

  MEASURED GAP, REPORTED RATHER THAN QUIETLY PATCHED EVERYWHERE: the admin
  surface defines no focus styling of its own beyond `AdminNavItem`, and the
  `adm` palette has no focus token — so every admin button today falls back to
  the PRODUCT blue in `globals.css`, on an admin ground it was not chosen for.
  Rather than invent a token (which the `adm-*` visual contract would have to
  approve) this reuses `outline-adm-accent`, exactly as `AdminNavItem` does. The
  wider gap is named in the delivery; it is not this candidate's to close.
*/
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-accent';

/** How a table offers search. Supplying it is what turns the feature on. */
export interface AdminTableSearch<Row> {
  /**
   * Decides whether a row matches. The CALLER supplies it because only the
   * caller knows which of its columns a reader would type into a search box. A
   * generic "stringify everything" matcher would search ids and timestamps
   * nobody types, and would silently start matching whatever a future column
   * added.
   */
  matches: (row: Row, query: string) => boolean;
  /** Overrides the shared label, for a table whose records need naming. */
  label?: string;
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
  search,
  pageSize,
  loadedOnlyNote,
  stackedOnNarrow,
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
  /** OPT-IN. Absent means no search box, exactly as before. */
  search?: AdminTableSearch<Row>;
  /** OPT-IN. Absent or 0 means every row renders, exactly as before. */
  pageSize?: number;
  /**
   * OPT-IN, and REQUIRED of any caller whose rows the server already truncated.
   * Rendered beside the search box to say that searching cannot reach a record
   * the server did not send. Without it a reader would read "0 of 25 match" as
   * "this does not exist", which is a stronger claim than the data supports.
   */
  loadedOnlyNote?: string;
  /** OPT-IN. Absent means `secondary` columns stay hidden below 900px, as before. */
  stackedOnNarrow?: boolean;
}): JSX.Element {
  const { t } = useAdminContext();
  const copy = t.table;

  /*
    HOOKS FIRST, ahead of every early return below. This component returns early
    for loading, error and each empty branch, so a hook placed after any of them
    would run in a different order between renders. Declaring them here costs
    nothing when the features are unused: `selectAdminTableView` with no query
    and no pageSize returns the input rows.
  */
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const searchInputId = useId();
  const bodyId = useId();

  const view = useMemo(
    () =>
      selectAdminTableView<Row>({
        rows,
        query,
        matches: search?.matches,
        page,
        pageSize,
      }),
    [rows, query, search, page, pageSize],
  );

  const visible = view.rows;
  const paginated = pageSize !== undefined && pageSize > 0;
  const interactive = search !== undefined || paginated;

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

  /*
    THE COUNT LINE, in a live region.

    Four wordings, because "3 of 195" and "showing 1–25 of 195" answer different
    questions and a reader mid-search needs both the match count and their
    position in it. `role="status"` announces the new count when a query changes
    — otherwise a screen-reader user types and hears nothing, and cannot tell a
    narrowed result from a broken one.
  */
  const countLine = view.hasQuery
    ? paginated
      ? fillTokens(copy.countMatchPage, {
          from: String(view.from),
          to: String(view.to),
          matching: String(view.matching),
          total: String(view.total),
        })
      : fillTokens(copy.countMatch, {
          matching: String(view.matching),
          total: String(view.total),
        })
    : paginated
      ? fillTokens(copy.countPage, {
          from: String(view.from),
          to: String(view.to),
          total: String(view.total),
        })
      : fillTokens(copy.countAll, { total: String(view.total) });

  const toolbar = interactive ? (
    <div className="flex flex-col gap-2">
      {search && (
        /*
          PHONE-SAFE BY CONSTRUCTION. This is an input in the document flow, not
          a dropdown in a fixed overlay — so there is no viewport to fit, no
          scroll to trap, and nothing for the on-screen keyboard to cover that
          the page cannot scroll to. Keeping records in a table rather than
          inside a dropdown is what makes that true.
        */
        <div className="flex flex-col gap-1">
          <label
            htmlFor={searchInputId}
            className="font-cd-mono text-[9px] uppercase tracking-[0.12em] text-adm-ink-faint"
          >
            {search.label ?? copy.searchLabel}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={searchInputId}
              type="search"
              inputMode="search"
              autoComplete="off"
              value={query}
              aria-controls={bodyId}
              aria-describedby={loadedOnlyNote ? `${bodyId}-loaded` : undefined}
              placeholder={copy.searchPlaceholder}
              onChange={(event) => {
                /*
                  THE PAGE RESETS WITH THE QUERY, in the same handler. A reader on
                  page 6 who narrows 195 rows to 2 must land on the matches, not
                  on an empty page 6. `selectAdminTableView` also clamps, so a
                  reset that is ever missed still cannot render a blank table.
                */
                setQuery(event.target.value);
                setPage(1);
              }}
              className={`min-w-0 flex-1 rounded-lg border border-adm-edge-input bg-adm-card px-3 py-2 text-[12px] text-adm-ink-2 placeholder:text-adm-ink-faint ${FOCUS_RING}`}
            />
            {query !== '' && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
                className={`rounded-lg border border-adm-edge-input px-3 py-2 font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-dim ${FOCUS_RING}`}
              >
                {copy.clear}
              </button>
            )}
          </div>
        </div>
      )}

      <p role="status" className="text-[11px] leading-relaxed text-adm-ink-dim">
        {countLine}
      </p>

      {loadedOnlyNote && (
        <p id={`${bodyId}-loaded`} className="text-[11px] leading-relaxed text-adm-ink-dim">
          {loadedOnlyNote}
        </p>
      )}
    </div>
  ) : null;

  /*
    PAGINATION. Buttons, not links: this is view state, not a route, and the
    users tab already established this shape. `disabled` rather than hidden, so
    the control does not move under the reader's finger at a boundary.
  */
  const pagination =
    paginated && view.pages > 1 ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={view.page <= 1}
          aria-label={copy.previousPage}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className={`rounded-lg border border-adm-edge-input px-3 py-2 font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-2 disabled:opacity-40 ${FOCUS_RING}`}
        >
          {copy.previousPage}
        </button>
        <span className="font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-dim">
          {fillTokens(copy.pageOf, { page: String(view.page), pages: String(view.pages) })}
        </span>
        <button
          type="button"
          disabled={view.page >= view.pages}
          aria-label={copy.nextPage}
          onClick={() => setPage((current) => Math.min(view.pages, current + 1))}
          className={`rounded-lg border border-adm-edge-input px-3 py-2 font-cd-mono text-[10px] uppercase tracking-[0.1em] text-adm-ink-2 disabled:opacity-40 ${FOCUS_RING}`}
        >
          {copy.nextPage}
        </button>
      </div>
    ) : null;

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

  /*
    A SEARCH THAT MATCHED NOTHING IS NOT AN EMPTY TABLE, and it is not the
    caller's copy either — the caller's wording describes a read that returned
    nothing, which is a different fact about the world. The search box stays on
    screen so the reader can clear it; an empty state that removed the control
    that caused it would be a dead end.
  */
  if (view.hasQuery && view.matching === 0) {
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        <div className="rounded-lg border border-dashed border-adm-edge px-4 py-6">
          <p className="text-[12px] font-semibold text-adm-ink-2">{copy.noMatch}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-adm-ink-dim">{copy.noMatchBody}</p>
        </div>
      </div>
    );
  }

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <caption className="sr-only">{caption}</caption>
        {head}
        <tbody>
          {visible.map((row, index) => (
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

  if (!stackedOnNarrow) {
    return interactive ? (
      <div className="flex flex-col gap-3">
        {toolbar}
        {/* `aria-controls` on the input points HERE — the results, not the wrapper
            that contains the input itself. */}
        <div id={bodyId}>{table}</div>
        {pagination}
      </div>
    ) : (
      table
    );
  }

  /*
    M-B — STACKED ROWS BELOW THE RAIL BREAKPOINT.

    `secondary` columns are hidden below 900px. On a records table that is where
    WHO and REASON live, so on a phone in portrait the reader can see that
    something changed and not who changed it or why. Pagination does not help:
    fewer rows per page still shows the same truncated row.

    Each row becomes a native `<details>`: the summary carries the columns that
    survive a narrow viewport, and the body lists EVERY column — secondary
    included — as a `<dl>` of label/value pairs. Native, so it is keyboard-
    operable and announced without script, sits in the document flow so it
    cannot trap page scroll, and needs no focus management.

    Both renderings are in the DOM and switched with `hidden`, which takes the
    inactive one out of the accessibility tree — so nothing is announced twice.
  */
  const stacked = (
    <ul className="flex flex-col gap-2 adm-rail:hidden">
      {visible.map((row, index) => (
        <li
          key={rowKey(row, index)}
          className="rounded-lg border border-adm-edge-mute bg-adm-card"
        >
          <details className="group">
            <summary
              className={`flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-3 text-[12px] text-adm-ink-2 ${FOCUS_RING}`}
            >
              {columns
                .filter((column) => !column.secondary)
                .map((column) => (
                  <span key={column.id} className="min-w-0">
                    {column.render(row)}
                  </span>
                ))}
              <span className="ml-auto font-cd-mono text-[9px] uppercase tracking-[0.12em] text-adm-ink-faint">
                {copy.rowDetails}
              </span>
            </summary>
            <dl className="border-t border-adm-edge-mute px-3 py-2">
              {columns.map((column) => (
                <div key={column.id} className="flex flex-col gap-0.5 py-1">
                  <dt className="font-cd-mono text-[9px] uppercase tracking-[0.12em] text-adm-ink-faint">
                    {column.header}
                  </dt>
                  <dd className="text-[12px] leading-relaxed text-adm-ink-2">
                    {column.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      <div id={bodyId}>
        {stacked}
        <div className="hidden adm-rail:block">{table}</div>
      </div>
      {pagination}
    </div>
  );
}
