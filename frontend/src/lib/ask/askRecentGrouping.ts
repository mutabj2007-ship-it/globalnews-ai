import type { AskV2Bookmark, AskV2RecentThread } from '@/lib/api/askV2Api';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC BETA ASK CONTINUITY R1 — RECENT GROUPING AND REOPEN ADDRESSES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pure. No fetch, no clock of its own, no AI. `now` is a parameter so the
 * boundaries are testable rather than "whatever the machine thought at render".
 *
 * WHY CALENDAR DAYS AND NOT ELAPSED HOURS. "Yesterday" means the previous
 * calendar day to a reader, not "24 to 48 hours ago". A conversation at 23:50
 * belongs to Today for ten minutes and to Yesterday after midnight, which is what
 * a reader expects; an elapsed-hours rule would still call it Today at 23:00 the
 * following night. The comparison therefore runs on local date parts.
 */

export type AskRecentGroup = 'today' | 'yesterday' | 'earlier';

/** Rendering order. Newest band first; a band with no rows is not rendered at all. */
export const ASK_RECENT_GROUPS: readonly AskRecentGroup[] = ['today', 'yesterday', 'earlier'];

export interface GroupedRecent {
  readonly today: readonly AskV2RecentThread[];
  readonly yesterday: readonly AskV2RecentThread[];
  readonly earlier: readonly AskV2RecentThread[];
}

/** Local midnight of the day `at` falls in. */
function startOfLocalDay(at: Date): number {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which band a stored timestamp falls in.
 *
 * A timestamp in the FUTURE is Today, not a fourth band. Clock skew between the
 * server that stamped `updatedAt` and the browser reading it is real and small,
 * and inventing an "Upcoming" band for it would show the reader a category the
 * product does not have. An unparseable timestamp is `earlier` — the band that
 * claims the least.
 */
export function askRecentGroupOf(lastActiveAt: string, now: Date): AskRecentGroup {
  const at = Date.parse(lastActiveAt);
  if (Number.isNaN(at)) return 'earlier';

  const todayStart = startOfLocalDay(now);
  if (at >= todayStart) return 'today';
  if (at >= todayStart - DAY_MS) return 'yesterday';

  return 'earlier';
}

/**
 * Group rows into the three bands, preserving the server's order inside each.
 *
 * The server already returns newest-first (`updatedAt desc, id asc`), so this
 * never re-sorts: re-sorting on the client would be a second ordering authority
 * and the two could disagree about ties.
 */
export function groupRecentThreads(rows: readonly AskV2RecentThread[], now: Date): GroupedRecent {
  const today: AskV2RecentThread[] = [];
  const yesterday: AskV2RecentThread[] = [];
  const earlier: AskV2RecentThread[] = [];

  for (const row of rows) {
    const group = askRecentGroupOf(row.lastActiveAt, now);
    if (group === 'today') today.push(row);
    else if (group === 'yesterday') yesterday.push(row);
    else earlier.push(row);
  }

  return { today, yesterday, earlier };
}

/**
 * The reopen address.
 *
 * Contract §15: the canonical result identity is the Ask V2 OPERATION, reopened at
 * `/ask?operation=<id>` — not `/analysis/results/:id` and not `/search?op=`. When a
 * thread has no operation yet (a thread created but never submitted) the thread
 * itself is the address, and reopening it shows the conversation with no result,
 * which is the truth about it.
 *
 * NEITHER FORM CARRIES A COMPUTE GRANT. Reopening is navigation to something that
 * already exists; continuing requires a new explicit Send.
 */
export function askReopenHref(row: {
  readonly id: string;
  readonly latestOperationId: string | null;
}): string {
  return row.latestOperationId === null
    ? `/ask?thread=${encodeURIComponent(row.id)}`
    : `/ask?operation=${encodeURIComponent(row.latestOperationId)}`;
}

/** The reopen address of a saved question. Same rule, same absence of a grant. */
export function askBookmarkReopenHref(row: {
  readonly threadId: string;
  readonly operationId: string | null;
}): string {
  return row.operationId === null
    ? `/ask?thread=${encodeURIComponent(row.threadId)}`
    : `/ask?operation=${encodeURIComponent(row.operationId)}`;
}

/**
 * Filtering is a pure predicate over material already fetched.
 *
 * It matches the reader's own stored question text only — never a generated title,
 * and never the answer, which lives in the operation's display artifact and is not
 * loaded here. So filtering cannot become a reason to fetch anything.
 */
export function filterRecent(
  rows: readonly AskV2RecentThread[],
  term: string,
): readonly AskV2RecentThread[] {
  const needle = term.trim().toLocaleLowerCase();
  if (needle.length === 0) return rows;

  return rows.filter((row) => (row.firstQuestion ?? '').toLocaleLowerCase().includes(needle));
}

/** The same predicate for saved questions. */
export function filterBookmarks(
  rows: readonly AskV2Bookmark[],
  term: string,
): readonly AskV2Bookmark[] {
  const needle = term.trim().toLocaleLowerCase();
  if (needle.length === 0) return rows;

  return rows.filter((row) => row.question.toLocaleLowerCase().includes(needle));
}
