/**
 * STAGE B — LOGICAL ALERT CONVERGENCE (one rule, used everywhere).
 *
 * A reader may hold several StoryAlert ROWS across one canonical alias set (a merge joins two
 * stories the reader alerted on separately; a removed row is kept for audit / undo). They are
 * ONE LOGICAL alert, chosen deterministically:
 *
 *   rank:  ACTIVE  >  PAUSED  >  REMOVED       (a live row always outranks a removed one)
 *   tie:   oldest createdAt, then smallest id  (stable across replays)
 *
 * Invariant kept by merge / split / create / restore: at most ONE live (ACTIVE or PAUSED) row
 * per reader per canonical alias set. List, byArticle, version events and unread counts all
 * resolve to that one logical alert.
 */
export type AlertStatus = 'ACTIVE' | 'PAUSED' | 'REMOVED';

const RANK: Readonly<Record<string, number>> = { ACTIVE: 0, PAUSED: 1, REMOVED: 2 };

export const isLiveStatus = (status: string): boolean => status === 'ACTIVE' || status === 'PAUSED';

export function compareAlertRows(a: { status: string; createdAt: Date; id: string }, b: { status: string; createdAt: Date; id: string }): number {
  const rank = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
  if (rank !== 0) return rank;
  const age = a.createdAt.getTime() - b.createdAt.getTime();
  if (age !== 0) return age;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The logical alert among one reader's rows (or null). */
export function logicalAlert<T extends { status: string; createdAt: Date; id: string }>(rows: readonly T[]): T | null {
  return rows.length === 0 ? null : [...rows].sort(compareAlertRows)[0];
}

/** Per reader: the logical row, and the OTHER live rows that must converge to REMOVED. */
export function convergeLive<T extends { userId: string; status: string; createdAt: Date; id: string }>(
  rows: readonly T[],
): { keep: Map<string, T>; demote: T[] } {
  const byUser = new Map<string, T[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const keep = new Map<string, T>();
  const demote: T[] = [];
  for (const [user, list] of byUser) {
    const best = logicalAlert(list)!;
    keep.set(user, best);
    for (const r of list) if (r.id !== best.id && isLiveStatus(r.status)) demote.push(r);
  }
  return { keep, demote };
}
