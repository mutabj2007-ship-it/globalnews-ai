/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN COMPACT LISTS R1 — WHICH ROWS THE TABLE SHOWS, AS A PURE FUNCTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Extracted from the component on purpose. The three properties the directive
 * names are all properties of THIS function, and a pure function can be
 * exercised exhaustively — every page boundary, every query, an empty result —
 * without a DOM, a context provider or a render:
 *
 *   1. SEARCH COVERS ALL FETCHED ROWS BEFORE PAGINATION. Filtering happens
 *      first and over the whole `rows` array; only then is a page cut from the
 *      result. Paginating first and filtering the page would silently answer a
 *      different question — "does page 3 contain PL" instead of "does this data
 *      contain PL" — and would look identical on screen.
 *   2. THE PAGE IS CLAMPED, NEVER OUT OF RANGE. A query that narrows 195 rows
 *      to 2 while the reader sits on page 6 yields page 1, not an empty table.
 *      The component also resets the page on every query change; this clamp is
 *      the second line of defence, because a reset that is ever missed must not
 *      show a blank result.
 *   3. THE COUNTS IT REPORTS ARE THE COUNTS IT USED. `matching` and `total` come
 *      out of the same computation that chose the rows, so the summary cannot
 *      drift from the table beneath it.
 *
 * NOTHING HERE FETCHES, and nothing can: there is no argument through which a
 * request could be made. That is the structural answer to "searching must not
 * trigger AI computation" — the rows are already in hand.
 */

export interface AdminTableView<Row> {
  /** The rows to render — one page of the matches. */
  readonly rows: readonly Row[];
  /** How many rows matched, across every page. */
  readonly matching: number;
  /** How many rows were fetched, before any query. */
  readonly total: number;
  /** 1-based, clamped into range. */
  readonly page: number;
  readonly pages: number;
  /** 1-based inclusive position of the first and last rendered row, within the matches. */
  readonly from: number;
  readonly to: number;
  readonly hasQuery: boolean;
  readonly isFiltered: boolean;
}

export function selectAdminTableView<Row>({
  rows,
  query,
  matches,
  page,
  pageSize,
}: {
  rows: readonly Row[];
  /** The raw input value. Trimmed here so a stray space is not a query. */
  query?: string;
  /**
   * Supplied by the caller, because only the caller knows which of its columns
   * are worth searching. A generic "stringify every field" matcher would search
   * ids and timestamps nobody types, and would quietly start matching any field
   * a future column added.
   */
  matches?: (row: Row, query: string) => boolean;
  page?: number;
  /** Absent or 0 means no pagination: every match renders. */
  pageSize?: number;
}): AdminTableView<Row> {
  const total = rows.length;
  const trimmed = (query ?? '').trim();
  const hasQuery = trimmed.length > 0 && matches !== undefined;

  /* STEP 1 — filter, over EVERY fetched row. */
  const matched = hasQuery ? rows.filter((row) => matches!(row, trimmed)) : rows;
  const matching = matched.length;

  /* STEP 2 — page, over the filtered set. */
  const size = pageSize !== undefined && pageSize > 0 ? pageSize : 0;
  const pages = size === 0 ? 1 : Math.max(1, Math.ceil(matching / size));
  const requested = page !== undefined && Number.isFinite(page) ? Math.trunc(page) : 1;
  const clamped = Math.min(Math.max(requested, 1), pages);

  const start = size === 0 ? 0 : (clamped - 1) * size;
  const pageRows = size === 0 ? matched : matched.slice(start, start + size);

  return {
    rows: pageRows,
    matching,
    total,
    page: clamped,
    pages,
    from: pageRows.length === 0 ? 0 : start + 1,
    to: start + pageRows.length,
    hasQuery,
    isFiltered: hasQuery && matching !== total,
  };
}

/**
 * The dictionary's `{token}` interpolation, as the rest of this product already
 * does it (`t.turnCount.replace('{n}', …)` and a dozen siblings). A local helper
 * rather than a new i18n mechanism, and `adminCompactLists.spec.ts` asserts that
 * EN and PL declare the SAME tokens — so a translation that drops `{total}`
 * fails the build instead of rendering a sentence with a hole in it.
 */
export function fillTokens(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (text, [token, value]) => text.split(`{${token}}`).join(value),
    template,
  );
}

/** The tokens a template declares, for the EN/PL parity assertion. */
export function tokensIn(template: string): string[] {
  return [...template.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]).sort();
}
